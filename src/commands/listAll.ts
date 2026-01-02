import { Context } from 'telegraf';
import { listAllTasks } from '../task-service';

export const listAllCommand = async (ctx: Context) => {
  const tasks = await listAllTasks();

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
