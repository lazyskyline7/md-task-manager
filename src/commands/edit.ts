import { Context, Markup, Telegraf } from 'telegraf';
import {
  extractArg,
  escapeMarkdownV2,
  parseTags,
  getErrorLog,
  formatOperatedTaskStr,
} from '../utils';
import { findTaskIdxByName, listAllTasks } from '../task-service';
import { FIELD_CONFIGS } from '../validators';
import { Command, EDITABLE_FIELDS } from '../config';
import { getNoTaskNameMessage, TASK_NOT_FOUND_MESSAGE } from '../bot-message';
import { logger } from '../logger';
import { EditableField, Task } from '../types';
import { queryTasks } from '../task-service/queryTasks';
import { message } from 'telegraf/filters';
import { saveTasks } from '../task-service/saveTasks';
import { generateAiTask } from '../task-service/gemini';
import { googleCalendarService } from '../task-service/google-calendar';

// State management for edit flows
interface EditState {
  taskIdx: number;
  field?: EditableField;
}

const editSessions = new Map<number, EditState>();

const isValidField = (field: string): field is EditableField =>
  (EDITABLE_FIELDS as readonly string[]).includes(field);

const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.substring(1);

const generateEditKeyboard = () => {
  const fields = Array.from(EDITABLE_FIELDS);
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

  // Add cancel button
  buttons.push([Markup.button.callback('❌ Cancel', 'edit_cancel')]);
  return buttons;
};

const EDIT_INLINE_KEYBOARD = Markup.inlineKeyboard(generateEditKeyboard());

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
  editSessions.set(ctx.from!.id, { taskIdx });

  await ctx.reply(
    `📝 *Editing Task: ${escapeMarkdownV2(task.name)}*\n\nSelect a field to update:`,
    {
      parse_mode: 'MarkdownV2',
      ...EDIT_INLINE_KEYBOARD,
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
  if (!ctx.has(message('text'))) return next();

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

    let updatedTask = validateAndGetUpdatedTask(
      tasks,
      state.taskIdx,
      fieldToUpdate,
      newValue,
    );

    if (fieldToUpdate === 'name') {
      const generatedTask = await generateAiTask(
        newValue,
        updatedTask.tags,
        metadata.timezone,
      );
      updatedTask = { ...updatedTask, ...generatedTask };
    }

    let eventId: string | null = null;
    if (
      fieldToUpdate === 'date' ||
      fieldToUpdate === 'time' ||
      fieldToUpdate === 'duration'
    ) {
      // Handle calendar event updates
      const oldTask = tasks[state.taskIdx];
      if (!oldTask.calendarEventId) {
        // No existing event, nothing to update
        return;
      }
      const timeChanged =
        oldTask.date !== updatedTask.date ||
        oldTask.time !== updatedTask.time ||
        oldTask.duration !== updatedTask.duration;

      if (timeChanged) {
        eventId = await googleCalendarService.updateEvent(
          oldTask.calendarEventId,
          updatedTask,
          metadata.timezone!,
        );
        if (eventId) updatedTask.calendarEventId = eventId;
      }
    }

    // Update the task
    tasks[state.taskIdx] = updatedTask;
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
    logger.error(getErrorLog({ userId, op: Command.EDIT, error }));
  }

  editSessions.delete(userId);
};

const validateAndGetUpdatedTask = (
  tasks: Task[],
  taskIdx: number,
  field: EditableField,
  value: string,
): Task => {
  const newTask = { ...tasks[taskIdx] };
  const trimmedValue = value.trim();
  const config = FIELD_CONFIGS[field];

  // Check for no-op (same value)
  if (isSameValue(tasks[taskIdx], field, trimmedValue)) {
    logger.warn(`New ${field} is the same as the current one`);
    return newTask;
  }

  // Handle clearing the field (empty value)
  if (trimmedValue === '') {
    return clearField(newTask, field, config);
  }

  // Validate the new value
  if (!config.validator(trimmedValue)) {
    throw new Error(config.errorMessage);
  }

  // Business logic: Check name uniqueness
  if (field === 'name' && findTaskIdxByName(tasks, trimmedValue) !== -1) {
    throw new Error('Task name must be unique');
  }

  // Transform and assign the value
  assignFieldValue(newTask, field, trimmedValue, config);

  return newTask;
};

const isSameValue = (
  task: Task,
  field: EditableField,
  newValue: string,
): boolean => {
  if (field === 'tags') {
    const newTags = parseTags(newValue);
    const existingTags = task.tags || [];
    return (
      existingTags.length === newTags.length &&
      existingTags.every((tag) => newTags.includes(tag))
    );
  }
  return task[field] === (newValue || undefined);
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

const assignFieldValue = (
  task: Task,
  field: EditableField,
  value: string,
  config: (typeof FIELD_CONFIGS)[EditableField],
): void => {
  if (config.transform) {
    const transformed = config.transform(value);
    switch (field) {
      case 'tags':
        task.tags = transformed as string[];
        break;
      case 'priority':
        task.priority = transformed as typeof task.priority;
        break;
      default:
        task[field] = value as never;
    }
  } else {
    task[field] = value as never;
  }
};
