import { Context } from 'telegraf';
import { format } from 'date-fns-tz';
import { Command } from '../config.js';
import { extractArg, getErrorLog, findTaskIdxByName } from '../utils.js';
import {
  getNoTaskNameMessage,
  getNoTextMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../bot-message.js';
import { queryTasks } from '../task-service/queryTasks.js';
import { saveTasks } from '../task-service/saveTasks.js';
import { logger } from '../logger.js';

export const completeCommand = async (ctx: Context) => {
  try {
    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply(getNoTextMessage(Command.COMPLETE));
    }

    const text = ctx.message.text;
    const arg = extractArg(text, Command.COMPLETE);

    if (!arg) return ctx.reply(getNoTaskNameMessage(Command.COMPLETE));

    const { tasks, metadata } = await queryTasks();
    const taskIdx = findTaskIdxByName(tasks.uncompleted, arg);
    if (taskIdx === -1) {
      return ctx.reply(TASK_NOT_FOUND_MESSAGE);
    }

    tasks.uncompleted[taskIdx].completed = true;
    const now = new Date();
    const completedAt = format(now, 'yyyy-MM-dd HH:mm:ss', {
      timeZone: metadata.timezone,
    });
    tasks.uncompleted[taskIdx].log =
      `Completed ${completedAt} (${metadata.timezone})`;
    await saveTasks(tasks, metadata);

    ctx.reply(`✅ Completed: ${arg}`);
  } catch (error) {
    ctx.reply('❌ Error completing task. Please try again.');
    logger.error(
      getErrorLog({ userId: ctx.from?.id, op: Command.COMPLETE, error }),
    );
  }
};
