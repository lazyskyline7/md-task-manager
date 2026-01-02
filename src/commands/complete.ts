import { Context } from 'telegraf';
import { completeTaskByName } from '../task-service';
import { COMMANDS } from '../constants';
import { extractArg } from '../utils';
import { message } from 'telegraf/filters';

export const completeCommand = (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('Please provide a task name to complete');
  }
  const text = ctx.message.text;
  const arg = extractArg(text, COMMANDS.Complete.name);

  if (arg) {
    const success = completeTaskByName(arg);
    if (success) ctx.reply(`✅ Completed: ${arg}`);
    else ctx.reply('❌ Task not found!');
  } else {
    ctx.reply('❌ /complete followed by the task name');
  }
};
