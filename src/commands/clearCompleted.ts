import { Context } from 'telegraf';
import { clearCompletedTasks } from '../task-service';
import { logger } from '../logger';
import { getErrorLog } from '../utils';
import { Command } from '../config';

export const clearCompletedCommand = async (ctx: Context) => {
  try {
    const success = await clearCompletedTasks();
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
    ctx.reply('❌ Failed to clear completed tasks}');
  }
};
