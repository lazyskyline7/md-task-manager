import { Context } from 'telegraf';
import { logger } from '../logger.js';
import { getErrorLog } from '../utils.js';
import { Command } from '../config.js';
import { saveTasks } from '../task-service/saveTasks.js';
import { queryTasks } from '../task-service/queryTasks.js';

export const clearCompletedCommand = async (ctx: Context) => {
  try {
    const { tasks, metadata } = await queryTasks();
    const filteredTasks = tasks.filter((task) => !task.completed);
    const success = await saveTasks(filteredTasks, metadata);
    if (success) {
      ctx.reply('Cleared all completed tasks!');
    } else {
      ctx.reply('❌ Failed to clear completed tasks.');
    }
  } catch (error) {
    logger.error(
      getErrorLog({
        userId: ctx.from?.id,
        op: Command.CLEARCOMPLETED,
        error,
      }),
    );
    ctx.reply('❌ Failed to clear completed tasks.');
  }
};
