import { Context } from 'telegraf';
import { clearCompletedTasks } from '../task-manage';

export const clearCompletedCommand = (ctx: Context) => {
  clearCompletedTasks();
  ctx.reply('Cleared all completed tasks!');
};
