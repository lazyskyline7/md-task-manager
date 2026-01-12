import { Context } from 'telegraf';
import { logger, formatLogMessage } from '../logger.js';
import { Command } from '../config.js';
import { saveTasks } from '../task-service/saveTasks.js';
import { queryTasks } from '../task-service/queryTasks.js';

export const clearCompletedCommand = async (ctx: Context) => {
  try {
    const { tasks, metadata } = await queryTasks();
    tasks.uncompleted = [];
    const success = await saveTasks(tasks, metadata);
    if (success) {
      ctx.reply('Cleared all completed tasks!');
    } else {
      ctx.reply('❌ Failed to clear completed tasks.');
    }
  } catch (error) {
    logger.error(
      formatLogMessage({
        userId: ctx.from?.id,
        op: Command.CLEARCOMPLETED,
        error,
      }),
    );
    ctx.reply('❌ Failed to clear completed tasks.');
  }
};
