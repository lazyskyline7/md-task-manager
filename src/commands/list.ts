import { Context } from 'telegraf';
import { listTasks } from '../task-service/index.js';
import { logger } from '../logger.js';
import { formatTaskListStr, getErrorLog } from '../utils.js';
import { Command } from '../config.js';
import { NO_TASK_MESSAGE } from '../bot-message.js';

export const listCommand = async (ctx: Context) => {
  try {
    const tasks = await listTasks();

    if (tasks.length === 0) {
      return ctx.reply(NO_TASK_MESSAGE);
    }

    const message = `📋 *Pending Tasks*\n\n${formatTaskListStr(tasks)}`;

    ctx.replyWithMarkdownV2(message);
  } catch (error) {
    logger.error(
      getErrorLog({ userId: ctx.from?.id, op: Command.LIST, error }),
    );
    ctx.reply('❌ Error fetching tasks');
  }
};
