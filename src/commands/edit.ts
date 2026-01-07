import { Context, Markup, Telegraf } from 'telegraf';
import { extractArg, escapeMarkdownV2, parseTags } from '../utils';
import { findTaskIdxByName, listAllTasks } from '../task-service';
import { updateTask } from '../task-service/updateTask';
import { validators } from '../validators';
import { EDITABLE_FIELDS } from '../config';

type EditableField = (typeof EDITABLE_FIELDS)[number];

// State management for edit flows
interface EditState {
  taskIdx: number;
  field?: EditableField;
}

const editSessions = new Map<number, EditState>();

const isValidField = (field: string): field is EditableField =>
  (EDITABLE_FIELDS as readonly string[]).includes(field);

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

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

  // Validate and set the new value based on the field type
  if (!validators[state.field](newValue)) {
    await ctx.reply(`❌ Invalid value for ${escapeMarkdownV2(state.field)}`);
    editSessions.delete(userId);
    return;
  }

  try {
    await updateTask(state.taskIdx, { field: state.field, value: newValue });
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
