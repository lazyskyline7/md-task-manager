import { Context } from 'telegraf';
import { listTasks } from '../task-service';
import { logger } from '../logger';
import { formatTaskList } from '../utils';

export const listCommand = async (ctx: Context) => {
  try {
    const tasks = await listTasks();

    if (tasks.length === 0) {
      return ctx.reply('No pending tasks!');
    }

    const message = `📋 *Pending Tasks*\n\n${formatTaskList(tasks)}`;

    ctx.replyWithMarkdownV2(message);
  } catch (error) {
    const message = `Error fetching tasks: ${(error as Error).message}`;
    logger.error(message);
    ctx.reply(`❌ ${message}`);
  }
};
