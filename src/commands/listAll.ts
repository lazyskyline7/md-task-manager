import { Context } from 'telegraf';
import { listAllTasks } from '../task-manage';

export const listAllCommand = (ctx: Context) => {
  const tasks = listAllTasks();

  if (tasks.length === 0) {
    return ctx.reply('No tasks yet!');
  }

  const message =
    'All tasks:\n' +
    tasks
      .map(
        (task, index) =>
          `${index + 1}. [${task.completed ? 'x' : ' '}] ${task.name}`,
      )
      .join('\n');

  ctx.reply(message);
};
