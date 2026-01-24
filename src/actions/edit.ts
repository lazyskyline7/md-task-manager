import {
  escapeMarkdownV2,
  parseTags,
  formatOperatedTaskStr,
  findTimeConflictingTask,
  findTaskIdxByName,
} from '../utils/index.js';
import { FIELD_CONFIGS } from '../utils/validators.js';
import { Command, EDITABLE_FIELDS } from '../core/config.js';
import logger from '../core/logger.js';
import { EditableField, Priority, Task } from '../core/types.js';
import { queryTasks } from '../services/queryTasks.js';
import { saveTasks } from '../services/saveTasks.js';
import { generateAiTask } from '../clients/gemini.js';
import { googleCalendarService } from '../clients/google-calendar.js';
import {
  BotContext,
  clearSessionData,
  setSessionData,
} from '../middlewares/session.js';
import { Telegraf } from 'telegraf';

const isValidField = (field: string): field is EditableField =>
  (EDITABLE_FIELDS as readonly string[]).includes(field);

export const registerEditAction = (bot: Telegraf<BotContext>) => {
  bot.action(/^edit_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const userId = ctx.from!.id;
    const state = ctx.session.editState;

    if (!state) {
      return ctx.answerCbQuery('⚠️ Session expired. Please start over.');
    }

    if (action === 'cancel') {
      clearSessionData(ctx);
      await ctx.editMessageText('❌ Edit cancelled.');
      return ctx.answerCbQuery();
    }

    if (isValidField(action)) {
      state.field = action;
      setSessionData(userId, { editState: state });
      await ctx.editMessageText(
        `✏️ Please enter the new value for *${escapeMarkdownV2(action)}*:`,
        { parse_mode: 'MarkdownV2' },
      );
    } else {
      await ctx.answerCbQuery('⚠️ Unknown field');
    }

    return ctx.answerCbQuery();
  });
};

export const handleEditInput = async (
  ctx: BotContext,
  next: () => Promise<void>,
) => {
  if (!ctx.message || !('text' in ctx.message)) return next();

  const userId = ctx.from?.id;
  if (!userId) return next();

  const state = ctx.session.editState;
  if (!state?.field) {
    return next();
  }

  const fieldToUpdate = state.field;
  const newValue = ctx.message.text;

  try {
    const { metadata, taskData } = await queryTasks();

    if (!metadata.timezone) {
      return ctx.reply(
        '❌ Timezone not set. Please set your timezone first using /settimezone command.',
      );
    }

    const oldTask = taskData.uncompleted[state.taskIdx];

    let updatedTask = validateAndGetUpdatedTask(
      taskData.uncompleted,
      oldTask,
      fieldToUpdate,
      newValue,
    );

    if (!updatedTask) {
      return ctx.reply(
        `⚠️ The new value is the same as the current one for *${escapeMarkdownV2(
          fieldToUpdate,
        )}*. No changes made.`,
        { parse_mode: 'MarkdownV2' },
      );
    }

    if (fieldToUpdate === 'name') {
      const generatedTask = await generateAiTask(
        newValue,
        updatedTask.tags,
        metadata.timezone,
      );
      updatedTask = { ...updatedTask, ...generatedTask };
    }

    let eventId: string | undefined;
    if (oldTask.calendarEventId) {
      if (
        ['name', 'description', 'link', 'date', 'time', 'duration'].includes(
          fieldToUpdate,
        )
      ) {
        // Handle calendar event updates
        eventId = await googleCalendarService.updateEvent(
          oldTask.calendarEventId,
          updatedTask,
          metadata.timezone!,
        );
        if (eventId) updatedTask.calendarEventId = eventId;
      }
    }

    // Update the task
    taskData.uncompleted[state.taskIdx] = updatedTask;
    await saveTasks(taskData, metadata);
    await ctx.reply(
      formatOperatedTaskStr(updatedTask, {
        command: Command.EDIT,
        prefix: `✅ *${escapeMarkdownV2(state.field)}* in `,
        suffix: eventId
          ? '\n_Corresponding calendar event updated_'
          : undefined,
      }),
      { parse_mode: 'MarkdownV2' },
    );
  } catch (error) {
    await ctx.reply(
      `❌ Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    logger.errorWithContext({ userId, op: Command.EDIT, error });
  }

  clearSessionData(ctx);
};

const validateAndGetUpdatedTask = (
  unCompletedTasks: Task[],
  task: Task,
  field: EditableField,
  value: string,
): Task | undefined => {
  const newTask = { ...task };
  const trimmedValue = value.trim();
  const config = FIELD_CONFIGS[field];

  const newValue = field === 'tags' ? undefined : trimmedValue;
  const newTags = field === 'tags' ? parseTags(trimmedValue) : [];

  // Validate tags format
  if (field === 'tags' && trimmedValue && !trimmedValue.includes('#')) {
    throw new Error('Tags must be prefixed with # (e.g., #work #sports)');
  }

  // Check for no-op (same value)
  let isSameValue = false;
  if (field === 'tags') {
    const existingTags = task.tags || [];
    isSameValue =
      existingTags.length === newTags.length &&
      existingTags.every((tag) => newTags.includes(tag));
  } else isSameValue = task[field] === (newValue || undefined);

  if (isSameValue) {
    logger.warnWithContext({
      message: `New ${field} is the same as the current one`,
    });
    return;
  }

  // Handle clearing the field (empty value)
  if (isEmptyValue(field === 'tags' ? newTags : newValue!)) {
    return clearField(newTask, field, config);
  }

  // Validate the new value
  if (!config.validator(field === 'tags' ? newTags : newValue)) {
    throw new Error(config.errorMessage);
  }

  // Constraint: Check name uniqueness
  if (
    field === 'name' &&
    findTaskIdxByName(unCompletedTasks, newValue!) !== -1
  ) {
    throw new Error('Task name must be unique');
  }

  // Constraint: Time conflict check
  if (field === 'time' || field === 'duration') {
    const simulatedTask = { ...newTask };
    if (field === 'time') {
      simulatedTask.time = newValue!;
      // default value for duration
      simulatedTask.duration = '1:00';
    }
    if (field === 'duration') {
      simulatedTask.duration = newValue!;
    }
    const conflictingTask = findTimeConflictingTask(
      simulatedTask,
      unCompletedTasks,
      task.name,
    );
    if (conflictingTask) {
      throw new Error(
        `Time conflict with existing task: "${conflictingTask.name}" (Date: ${conflictingTask.date}, Time: ${conflictingTask.time}, Duration: ${conflictingTask.duration})`,
      );
    }
  }

  // Assign the value
  if (field === 'tags') {
    newTask.tags = newTags;
  } else if (field === 'priority') {
    newTask.priority = value as Priority;
  } else {
    newTask[field] = value;
  }

  return newTask;
};

const isEmptyValue = (value: string | string[]): boolean => {
  if (typeof value === 'string') {
    return value.trim() === '';
  } else if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
};

const clearField = (
  task: Task,
  field: EditableField,
  config: (typeof FIELD_CONFIGS)[EditableField],
): Task => {
  if (field === 'name') {
    throw new Error('Task name cannot be empty');
  }

  if (field === 'tags') {
    task.tags = [];
    return task;
  }

  // Clear dependent fields if configured
  config.clearDependents?.forEach((dep) => {
    delete task[dep];
  });

  // Clear the field itself
  delete task[field];

  return task;
};
