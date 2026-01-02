import { Context } from 'telegraf';
import { listTasks } from '../task-manage';

export const listCommand = (ctx: Context) => {
  const tasks = listTasks();

  if (tasks.length === 0) {
    return ctx.reply('No tasks yet!');
  }

  const message =
    'Your tasks:\n' +
    tasks.map((task, index) => `${index + 1}. ${task.name}`).join('\n');

  ctx.reply(message);
};
