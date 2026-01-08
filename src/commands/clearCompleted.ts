import { Context } from 'telegraf';
import { logger } from '../logger';
import { getErrorLog } from '../utils';
import { Command } from '../config';
import { saveTasks } from '../task-service/saveTasks';
import { queryTasks } from '../task-service/queryTasks';

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
