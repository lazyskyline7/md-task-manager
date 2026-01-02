import { Context } from 'telegraf';
import { listTasks } from '../task-service';

export const listCommand = async (ctx: Context) => {
  try {
    const tasks = await listTasks();

    if (tasks.length === 0) {
      return ctx.reply('No pending tasks!');
    }

    const message =
      'Pending tasks:\n' +
      tasks.map((task, index) => `${index + 1}. ${task.name}`).join('\n');

    ctx.reply(message);
  } catch (error) {
    const message = `Error fetching tasks: ${(error as Error).message}`;
  }
};
