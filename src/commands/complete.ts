import { Context } from 'telegraf';
import { format } from 'date-fns-tz';
import { Command } from '../core/config.js';
import { extractArg, findTaskIdxByName } from '../utils/index.js';
import {
  getNoTaskNameMessage,
  getNoTextMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../views/generalView.js';
import { queryTasks } from '../services/queryTasks.js';
import { saveTasks } from '../services/saveTasks.js';
import logger from '../core/logger.js';

export const completeCommand = async (ctx: Context) => {
  try {
    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply(getNoTextMessage(Command.COMPLETE));
    }

    const text = ctx.message.text;
    const arg = extractArg(text, Command.COMPLETE);

    if (!arg) return ctx.reply(getNoTaskNameMessage(Command.COMPLETE));

    const { taskData, metadata } = await queryTasks();
    const taskIdx = findTaskIdxByName(taskData.uncompleted, arg);
    if (taskIdx === -1) {
      return ctx.reply(TASK_NOT_FOUND_MESSAGE);
    }

    taskData.uncompleted[taskIdx].completed = true;
    const now = new Date();
    const completedAt = format(now, 'yyyy-MM-dd HH:mm:ss', {
      timeZone: metadata.timezone,
    });
    taskData.uncompleted[taskIdx].log =
      `Completed ${completedAt} (${metadata.timezone})`;
    await saveTasks(taskData, metadata);

    ctx.reply(`✅ Completed: ${arg}`);
  } catch (error) {
    ctx.reply('❌ Error completing task. Please try again.');
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.COMPLETE,
      error,
    });
  }
};
