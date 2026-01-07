import { Context, Markup, Telegraf } from 'telegraf';
import { extractArg, escapeMarkdownV2, parseTags } from '../utils';
import { findTaskIdxByName, listAllTasks } from '../task-service';
import { Task } from '../types';
import { updateTask } from '../task-service/updateTask';
import { validators } from '../validators';

// State management for edit flows
interface EditState {
  taskIdx: number;
  field?: keyof Task;
}

const editSessions = new Map<number, EditState>();

const EDITABLE_FIELDS = new Set([
  'name',
  'date',
  'time',
  'duration',
  'priority',
  'tags',
  'description',
  'link',
]);
const isValidField = (field: string): field is keyof Task =>
  EDITABLE_FIELDS.has(field);

export const editCommand = async (ctx: Context) => {
  if (!ctx.message || !('text' in ctx.message)) return;

  const taskName = extractArg(ctx.message.text, 'edit');

  if (!taskName) {
    return ctx.reply('❌ Please provide a task name (e.g., /edit My Task)');
  }

  const tasks = await listAllTasks();
  const taskIdx = findTaskIdxByName(tasks, taskName);

  if (taskIdx === -1) {
    return ctx.reply('❌ Task not found!');
  }

  const task = tasks[taskIdx];
  editSessions.set(ctx.from!.id, { taskIdx });

  await ctx.reply(
    `📝 *Editing Task: ${escapeMarkdownV2(task.name)}*\n\nSelect a field to update:`,
    {
      parse_mode: 'MarkdownV2',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Name', 'edit_name'),
          Markup.button.callback('Date', 'edit_date'),
        ],
        [
          Markup.button.callback('Time', 'edit_time'),
          Markup.button.callback('Duration', 'edit_duration'),
        ],
        [
          Markup.button.callback('Priority', 'edit_priority'),
          Markup.button.callback('Tags', 'edit_tags'),
        ],
        [
          Markup.button.callback('Description', 'edit_description'),
          Markup.button.callback('Link', 'edit_link'),
        ],
        [Markup.button.callback('❌ Cancel', 'edit_cancel')],
      ]),
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
  if (!ctx.message || !('text' in ctx.message)) {
    return next();
  }

  const userId = ctx.from?.id;
  if (!userId) return next();

  const state = editSessions.get(userId);
  if (!state || !state.field) {
    return next();
  }

  const newValue =
    state.field === 'tags' ? parseTags(ctx.message.text) : ctx.message.text;
  const updates: Partial<Task> = {};

  // Validate and set the new value based on the field type
  if (!validators[state.field](newValue)) {
    await ctx.reply(`❌ Invalid value for ${escapeMarkdownV2(state.field)}`);
    editSessions.delete(userId);
    return;
  }

  setField(updates, state.field, newValue);

  try {
    await updateTask(state.taskIdx, updates);
    await ctx.reply(
      `✅ Updated *${escapeMarkdownV2(state.field)}* successfully\\!`,
      { parse_mode: 'MarkdownV2' },
    );
  } catch (error) {
    await ctx.reply(
      `❌ Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  editSessions.delete(userId);
};

// Helper to set field dynamically with type safety
function setField<T, K extends keyof T>(o: T, key: K, value: T[K]) {
  o[key] = value;
}
