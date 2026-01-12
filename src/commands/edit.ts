import { Context, Markup, Telegraf } from 'telegraf';
import {
  extractArg,
  escapeMarkdownV2,
  parseTags,
  formatOperatedTaskStr,
  findTimeConflictingTask,
  findTaskIdxByName,
} from '../utils.js';
import { listAllTasks } from '../task-service/index.js';
import { FIELD_CONFIGS } from '../validators.js';
import { Command, EDITABLE_FIELDS } from '../config.js';
import {
  getNoTaskNameMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../bot-message.js';
import logger from '../logger.js';
import { EditableField, Priority, Task } from '../types.js';
import { queryTasks } from '../task-service/queryTasks.js';
import { saveTasks } from '../task-service/saveTasks.js';
import { generateAiTask } from '../task-service/gemini.js';
import { googleCalendarService } from '../task-service/google-calendar.js';

// State management for edit flows
interface EditState {
  taskIdx: number;
  task: Task;
  field?: EditableField;
}

const editSessions = new Map<number, EditState>();

const isValidField = (field: string): field is EditableField =>
  (EDITABLE_FIELDS as readonly string[]).includes(field);

const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.substring(1);

const isFieldEditable = (field: EditableField, task: Task): boolean => {
  if (field === 'time' || field === 'duration') {
    if (!task.date) return false;
  }
  if (field === 'duration') {
    if (!task.time) return false;
  }
  return true;
};

const generateEditKeyboard = (task: Task) => {
  const fields = Array.from(EDITABLE_FIELDS).filter((field) =>
    isFieldEditable(field, task),
  );
  const buttons = [];

  // Create rows with 2 buttons each
  for (let i = 0; i < fields.length; i += 2) {
    const row = [
      Markup.button.callback(capitalize(fields[i]), `edit_${fields[i]}`),
    ];
    if (i + 1 < fields.length) {
      row.push(
        Markup.button.callback(
          capitalize(fields[i + 1]),
          `edit_${fields[i + 1]}`,
        ),
      );
    }
    buttons.push(row);
  }

  // Add cancel button - append to last row if it has only one element
  const cancelButton = Markup.button.callback('❌ Cancel', 'edit_cancel');
  if (buttons.length > 0 && buttons[buttons.length - 1].length === 1) {
    buttons[buttons.length - 1].push(cancelButton);
  } else {
    buttons.push([cancelButton]);
  }

  return Markup.inlineKeyboard(buttons);
};

export const editCommand = async (ctx: Context) => {
  if (!ctx.message || !('text' in ctx.message)) return;

  const taskName = extractArg(ctx.message.text, Command.EDIT);

  if (!taskName) {
    return ctx.reply(getNoTaskNameMessage(Command.EDIT));
  }

  const tasks = await listAllTasks();
  const taskIdx = findTaskIdxByName(tasks, taskName);

  if (taskIdx === -1) {
    return ctx.reply(TASK_NOT_FOUND_MESSAGE);
  }

  const task = tasks[taskIdx];
  editSessions.set(ctx.from!.id, { taskIdx, task });

  await ctx.reply(
    `📝 *Editing Task: ${escapeMarkdownV2(task.name)}*\n\nSelect a field to update:`,
    {
      parse_mode: 'MarkdownV2',
      ...generateEditKeyboard(task),
    },
  );
};

export const registerEditActions = (bot: Telegraf) => {
  bot.action(/^edit_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const userId = ctx.from!.id;
    const state = editSessions.get(userId);

    if (!state) {
      return ctx.answerCbQuery('⚠️ Session expired. Please start over.');
    }

    if (action === 'cancel') {
      editSessions.delete(userId);
      await ctx.editMessageText('❌ Edit cancelled.');
      return ctx.answerCbQuery();
    }

    if (isValidField(action)) {
      state.field = action;
      editSessions.set(userId, state);
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
  ctx: Context,
  next: () => Promise<void>,
) => {
  if (!ctx.message || !('text' in ctx.message)) return next();

  const userId = ctx.from?.id;
  if (!userId) return next();

  const state = editSessions.get(userId);
  if (!state?.field) {
    return next();
  }

  const fieldToUpdate = state.field;
  const newValue = ctx.message.text;

  try {
    const { metadata, tasks } = await queryTasks();

    if (!metadata.timezone) {
      return ctx.reply(
        '❌ Timezone not set. Please set your timezone first using /settimezone command.',
      );
    }

    const oldTask = state.task;

    let updatedTask = validateAndGetUpdatedTask(
      tasks.uncompleted,
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
    tasks.uncompleted[state.taskIdx] = updatedTask;
    await saveTasks(tasks, metadata);
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

  editSessions.delete(userId);
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
