import { Context } from 'telegraf';
import { logger, formatLogMessage } from '../logger.js';
import { getTasksByDay } from '../utils.js';
import { Command } from '../config.js';
import { queryTasks } from '../task-service/queryTasks.js';
import { getTodaysTasksMessage } from '../bot-message.js';

export const todayCommand = async (ctx: Context) => {
  try {
    const { tasks, metadata } = await queryTasks();

    if (!metadata.timezone) {
      return ctx.reply(
        '❌ Timezone not set. Please set your timezone first using /settimezone command.',
      );
    }

    const today = new Date();
    const todaysTasks = getTasksByDay(
      tasks.uncompleted,
      today,
      metadata.timezone,
    );

    if (todaysTasks.length === 0) {
      return ctx.reply('📭 No tasks for today!');
    }

    const response = getTodaysTasksMessage(todaysTasks, metadata.timezone!);

    ctx.reply(response, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    logger.error(
      formatLogMessage({ userId: ctx.from?.id, op: Command.TODAY, error }),
    );
    ctx.reply("❌ Failed to get today's tasks.");
  }
};
