import { Context } from 'telegraf';
import { listAllTasks } from '../task-service/index.js';
import { formatTaskListStr } from '../utils.js';
import { Command } from '../config.js';
import logger from '../logger.js';
import { NO_TASK_MESSAGE } from '../bot-message.js';

export const listAllCommand = async (ctx: Context) => {
  try {
    const tasks = await listAllTasks();

    if (tasks.length === 0) {
      return ctx.reply(NO_TASK_MESSAGE);
    }

    const message = `📚 *All Tasks*\n\n${formatTaskListStr(tasks, true)}`;

    ctx.replyWithMarkdownV2(message);
  } catch (error) {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.LISTALL,
      error,
    });
    ctx.reply('❌ Error fetching tasks');
  }
};
