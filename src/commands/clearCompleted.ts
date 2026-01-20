import { Context } from 'telegraf';
import logger from '../core/logger.js';
import { Command } from '../core/config.js';
import { saveTasks } from '../services/saveTasks.js';
import { queryTasks } from '../services/queryTasks.js';

export const clearCompletedCommand = async (ctx: Context) => {
  try {
    const { taskData, metadata } = await queryTasks();
    taskData.completed = [];
    const success = await saveTasks(taskData, metadata);
    if (success) {
      ctx.reply('Cleared all completed tasks!');
    } else {
      ctx.reply('❌ Failed to clear completed tasks.');
    }
  } catch (error) {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.CLEARCOMPLETED,
      error,
    });
    ctx.reply('❌ Failed to clear completed tasks.');
  }
};
