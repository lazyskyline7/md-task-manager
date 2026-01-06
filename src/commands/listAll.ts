import { Context } from 'telegraf';
import { listAllTasks } from '../task-service';
import { formatTaskList } from '../utils';

export const listAllCommand = async (ctx: Context) => {
  try {
    const tasks = await listAllTasks();

    if (tasks.length === 0) {
      return ctx.reply('No tasks yet!');
    }

    const message = `📚 *All Tasks*\n\n${formatTaskList(tasks, true)}`;

    ctx.replyWithMarkdownV2(message);
  } catch (error) {
    ctx.reply(`❌ Error: ${(error as Error).message}`);
  }
};
