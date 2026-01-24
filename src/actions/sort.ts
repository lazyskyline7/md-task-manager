import { Markup, Telegraf } from 'telegraf';
import { BotContext } from '../middlewares/session.js';
import { Command } from '../core/config.js';
import logger from '../core/logger.js';
import { Priority, Task } from '../core/types.js';
import { queryTasks } from '../services/queryTasks.js';
import { saveTasks } from '../services/saveTasks.js';

enum SortType {
  PRIORITY = 'priority',
  TIME = 'time',
}

const PRIORITY_ORDER: Record<Priority, number> = {
  [Priority.URGENT]: 0,
  [Priority.HIGH]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.LOW]: 3,
};

const sortByPriority = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    const priorityA = a.priority ? PRIORITY_ORDER[a.priority] : 4;
    const priorityB = b.priority ? PRIORITY_ORDER[b.priority] : 4;
    return priorityA - priorityB;
  });
};

const sortByTime = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;

    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;

    return a.time.localeCompare(b.time);
  });
};

export const generateSortKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('🔥 By Priority', `sort_${SortType.PRIORITY}`),
      Markup.button.callback('🕐 By Time', `sort_${SortType.TIME}`),
    ],
    [Markup.button.callback('❌ Cancel', 'sort_cancel')],
  ]);

export const registerSortAction = (bot: Telegraf<BotContext>) => {
  bot.action(/^sort_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const userId = ctx.from!.id;

    if (action === 'cancel') {
      await ctx.editMessageText('❌ Sort cancelled.');
      return ctx.answerCbQuery();
    }

    try {
      const { metadata, taskData } = await queryTasks();

      let sortedTasks: Task[];
      let sortLabel: string;

      if (action === SortType.PRIORITY) {
        sortedTasks = sortByPriority(taskData.uncompleted);
        sortLabel = 'priority';
      } else if (action === SortType.TIME) {
        sortedTasks = sortByTime(taskData.uncompleted);
        sortLabel = 'time';
      } else {
        await ctx.answerCbQuery('⚠️ Unknown sort type');
        return;
      }

      taskData.uncompleted = sortedTasks;
      await saveTasks(taskData, metadata);

      await ctx.editMessageText(
        `✅ Tasks sorted by ${sortLabel}. (${sortedTasks.length} tasks)`,
      );
      await ctx.answerCbQuery(`Sorted by ${sortLabel}`);
    } catch (error) {
      await ctx.editMessageText('❌ Failed to sort tasks. Please try again.');
      logger.errorWithContext({ userId, op: Command.SORT, error });
      await ctx.answerCbQuery('Error');
    }
  });
};
