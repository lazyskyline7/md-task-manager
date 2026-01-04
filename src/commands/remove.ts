import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { removeTaskByName } from '../task-service';
import { COMMANDS } from '../config';
import { extractArg } from '../utils';

export const removeCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('❌ Please provide a task name to remove');
  }

  try {
    const text = ctx.message.text;
    const arg = extractArg(text, COMMANDS.Remove.name);

    if (arg) {
      const success = await removeTaskByName(arg);
      if (success) {
        ctx.reply(`🗑️ Removed: ${arg}`);
      } else {
        ctx.reply('❌ Task not found!');
      }
    } else {
      ctx.reply('❌ /remove followed by the task name');
    }
  } catch (error) {
    ctx.reply('❌ Error removing task. Please try again.');
    console.error('Remove command error:', error);
  }
};
