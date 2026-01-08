import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { Command } from '../config';
import { extractArg, getErrorLog, formatOperatedTaskStr } from '../utils';
import { queryTasks } from '../task-service/queryTasks';
import { googleCalendarService } from '../task-service/google-calendar';
import { logger } from '../logger';
import { saveTasks } from '../task-service/saveTasks';
import { findTaskIdxByName } from '../task-service';
import { getNoTaskNameMessage, TASK_NOT_FOUND_MESSAGE } from '../bot-message';

export const removeCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('❌ Please provide a task name to remove');
  }

  try {
    const text = ctx.message.text;
    const arg = extractArg(text, Command.REMOVE);

    if (!arg) {
      return ctx.reply(getNoTaskNameMessage(Command.REMOVE));
    }

    const { tasks, metadata } = await queryTasks();
    const taskIdx = findTaskIdxByName(tasks, arg);

    if (taskIdx === -1) {
      return ctx.reply(TASK_NOT_FOUND_MESSAGE);
    }
    const taskToRemove = tasks[taskIdx];
    logger.info(`Attempting to remove task: ${taskToRemove?.name}`);

    // Remove from calendar first
    let removedFromCalendar = false;
    if (taskToRemove.calendarEventId) {
      removedFromCalendar = await googleCalendarService.deleteEvent(
        taskToRemove.calendarEventId,
      );
      if (removedFromCalendar) {
        logger.info(`Removed calendar event for task: ${taskToRemove.name}`);
      } else {
        logger.error(
          getErrorLog({
            userId: ctx.from?.id,
            op: Command.REMOVE,
            error: `Failed to remove calendar event with ID: ${taskToRemove.calendarEventId}`,
          }),
        );
      }
    }

    // Then remove from task table
    tasks.splice(taskIdx, 1);
    await saveTasks(tasks, metadata);

    ctx.reply(
      formatOperatedTaskStr(taskToRemove, {
        command: Command.REMOVE,
        prefix: '🗑️ ',
        suffix: removedFromCalendar
          ? '\n_Corresponding calendar event removed_'
          : undefined,
      }),
      { parse_mode: 'MarkdownV2' },
    );
  } catch (error) {
    ctx.reply('❌ Error removing task. Please try again.');
    logger.error(
      getErrorLog({ userId: ctx.from?.id, op: Command.REMOVE, error }),
    );
  }
};
