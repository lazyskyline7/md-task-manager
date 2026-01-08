import { Context, Markup, Telegraf } from 'telegraf';
import { extractArg, escapeMarkdownV2, parseTags, getErrorLog } from '../utils';
import { findTaskIdxByName, listAllTasks } from '../task-service';
import { validators } from '../validators';
import { Command, EDITABLE_FIELDS } from '../config';
import { getNoTaskNameMessage, TASK_NOT_FOUND_MESSAGE } from '../bot-message';
import { logger } from '../logger';
import { EditableField, Task } from '../types';
import { queryTasks } from '../task-service/queryTasks';
import { message } from 'telegraf/filters';
import { saveTasks } from '../task-service/saveTasks';

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

    // Validate and prepare updated task
    const updatedTask = validateAndGetUpdatedTask(
      tasks,
      state.taskIdx,
      fieldToUpdate,
      newValue,
    );

    // Update the task
    tasks[state.taskIdx] = updatedTask;
    await ctx.reply(
      `✅ Updated *${escapeMarkdownV2(state.field)}* successfully\\!`,
      { parse_mode: 'MarkdownV2' },
    );
    await saveTasks(tasks, metadata);
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
) => {
  const newTask = { ...tasks[taskIdx] };
  value = value.trim();

  // Check for no-op
  let sameValue = false;
  if (field === 'tags') {
    const existingTags = tasks[taskIdx].tags;
    const newTags = parseTags(value);
    sameValue =
      existingTags.length === newTags.length &&
      existingTags.every((tag) => newTags.includes(tag));
  } else {
    sameValue = tasks[taskIdx][field] === (value || undefined);
  }
  if (sameValue) {
    logger.warn(`New ${field} is the same as the current one`);
    return newTask;
  }

  // Handle clearing the field
  if (value === '') {
    if (field === 'name') {
      logger.error('Update task with empty name');
      throw new Error('Task name cannot be empty');
    }
    if (field === 'tags') {
      newTask.tags = [];
      return newTask;
    }
    // For date/time fields, clear dependent fields as well
    if (field === 'date') {
      newTask.time = undefined;
      newTask.duration = undefined;
    }
    if (field === 'time') {
      newTask.duration = undefined;
    }
    // Clear the specified field
    newTask[field] = undefined;

    return newTask;
  }

  switch (field) {
    case 'name':
      if (findTaskIdxByName(tasks, value) !== -1) {
        throw new Error('Task name must be unique');
      }
      newTask.name = value;
      return newTask;
    case 'priority':
      if (!validators.priority(value)) {
        throw new Error(`Invalid priority: "${value}"`);
      }
      newTask.priority = value;
      return newTask;
    case 'date':
      if (!validators.date(value)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      newTask.date = value;
      return newTask;
    case 'time':
      if (!validators.time(value)) {
        throw new Error('Invalid time format. Expected HH:MM');
      }
      newTask.time = value;
      return newTask;
    case 'duration':
      if (!validators.duration(value)) {
        throw new Error('Invalid duration format. Expected HH:MM');
      }
      newTask.duration = value;
      return newTask;
    case 'link':
      if (!validators.link(value)) {
        throw new Error('Invalid link format. Please provide a valid URL.');
      }
      newTask.link = value;
      return newTask;
    case 'tags':
      newTask.tags = parseTags(value);
      return newTask;
    case 'description':
      newTask.description = value;
      return newTask;
    default:
      throw new Error(`Unknown editable field: ${field}`);
  }
};
