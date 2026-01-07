import { Context, Markup, Telegraf } from 'telegraf';
import { extractArg, escapeMarkdownV2, parseTags } from '../utils';
import { findTaskIdxByName, listAllTasks } from '../task-service';
import { Task } from '../types';
import { updateTask } from '../task-service/updateTask';

// State management for edit flows
interface EditState {
  taskIdx: number;
  field?: keyof Task;
}

const editSessions = new Map<number, EditState>();
// Map action to Task key
const fieldMap: Record<string, keyof Task> = {
  name: 'name',
  date: 'date',
  time: 'time',
  duration: 'duration',
  priority: 'priority',
  tags: 'tags',
  description: 'description',
  link: 'link',
} as const;

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
          Markup.button.callback('Name', `edit_${fieldMap['name']}`),
          Markup.button.callback('Date', `edit_${fieldMap['date']}`),
        ],
        [
          Markup.button.callback('Time', `edit_${fieldMap['time']}`),
          Markup.button.callback('Duration', `edit_${fieldMap['duration']}`),
        ],
        [
          Markup.button.callback('Priority', `edit_${fieldMap['priority']}`),
          Markup.button.callback('Tags', `edit_${fieldMap['tags']}`),
        ],
        [
          Markup.button.callback(
            'Description',
            `edit_${fieldMap['description']}`,
          ),
          Markup.button.callback('Link', `edit_${fieldMap['link']}`),
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

    const field = fieldMap[action];
    if (field) {
      state.field = field;
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

  const newValue = ctx.message.text;
  const updates: Partial<Task> = {};

  if (state.field === 'tags') {
    updates.tags = parseTags(newValue);
  } else {
    // @ts-expect-error - dynamic assignment
    updates[state.field] = newValue;
  }

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
