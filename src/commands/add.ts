import { Context } from 'telegraf';
import { addTask } from '../task-manage';
import { COMMANDS } from '../constants';
import { extractArg } from '../utils';
import { message } from 'telegraf/filters';

export const addCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('Please provide a task name to add');
  }

  const text = ctx.message.text;
  const arg = extractArg(text, COMMANDS.Add.name);

  if (!arg) {
    return ctx.reply('/add followed by the task name');
  }

  addTask({
    name: arg,
    completed: false,
  });

  await ctx.reply(`✅ Task added: ${text}`);
};
