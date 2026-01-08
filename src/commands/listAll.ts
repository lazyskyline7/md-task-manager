import { Context } from 'telegraf';
import { listAllTasks } from '../task-service';
import { formatTaskListStr, getErrorLog } from '../utils';
import { Command } from '../config';
import { logger } from '../logger';
import { NO_TASK_MESSAGE } from '../bot-message';

export const listAllCommand = async (ctx: Context) => {
  try {
    const tasks = await listAllTasks();

    if (tasks.length === 0) {
      return ctx.reply(NO_TASK_MESSAGE);
    }

    const message = `📚 *All Tasks*\n\n${formatTaskListStr(tasks, true)}`;

    ctx.replyWithMarkdownV2(message);
  } catch (error) {
    logger.error(
      getErrorLog({ userId: ctx.from?.id, op: Command.LISTALL, error }),
    );
    ctx.reply('❌ Error fetching tasks');
  }
};
