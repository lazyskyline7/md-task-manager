import { Context } from 'telegraf';
import { findTaskIdxByName } from '../task-service';
import { Command } from '../config';
import { extractArg, getErrorLog } from '../utils';
import { message } from 'telegraf/filters';
import {
  getNoTaskNameMessage,
  getNoTextMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../bot-message';
import { queryTasks } from '../task-service/queryTasks';
import { saveTasks } from '../task-service/saveTasks';
import { logger } from '../logger';

export const completeCommand = async (ctx: Context) => {
  try {
    if (!ctx.has(message('text'))) {
      return ctx.reply(getNoTextMessage(Command.COMPLETE));
    }

    const text = ctx.message.text;
    const arg = extractArg(text, Command.COMPLETE);

    if (!arg) return ctx.reply(getNoTaskNameMessage(Command.COMPLETE));

    const { tasks, metadata } = await queryTasks();
    const taskIdx = findTaskIdxByName(tasks, arg);
    if (taskIdx === -1) {
      return ctx.reply(TASK_NOT_FOUND_MESSAGE);
    }

    tasks[taskIdx].completed = true;
    await saveTasks(tasks, metadata);

    ctx.reply(`✅ Completed: ${arg}`);
  } catch (error) {
    ctx.reply('❌ Error completing task. Please try again.');
    logger.error(
      getErrorLog({ userId: ctx.from?.id, op: Command.COMPLETE, error }),
    );
  }
};
