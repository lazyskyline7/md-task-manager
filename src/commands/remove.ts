import { Context } from 'telegraf';
import { Command } from '../config.js';
import {
  extractArg,
  getErrorLog,
  formatOperatedTaskStr,
  findTaskIdxByName,
} from '../utils.js';
import { queryTasks } from '../task-service/queryTasks.js';
import { googleCalendarService } from '../task-service/google-calendar.js';
import { logger } from '../logger.js';
import { saveTasks } from '../task-service/saveTasks.js';
import {
  getNoTaskNameMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../bot-message.js';
import { TaskTypeToOp } from '../types.js';

export const removeCommand = async (ctx: Context) => {
  if (!ctx.message || !('text' in ctx.message)) {
    return ctx.reply('❌ Please provide a task name to remove');
  }

  try {
    const text = ctx.message.text;
    const arg = extractArg(text, Command.REMOVE);

    if (!arg) {
      return ctx.reply(getNoTaskNameMessage(Command.REMOVE));
    }

    const { tasks, metadata } = await queryTasks();

    let taskIdx = findTaskIdxByName(tasks.uncompleted, arg);
    let taskTypeToRemove: TaskTypeToOp = 'none';
    if (taskIdx === -1) {
      taskIdx = findTaskIdxByName(tasks.completed, arg);
      if (taskIdx === -1) {
        return ctx.reply(TASK_NOT_FOUND_MESSAGE);
      }
      taskTypeToRemove = 'completed';
    } else {
      taskTypeToRemove = 'uncompleted';
    }

    const taskToRemove =
      taskTypeToRemove === 'uncompleted'
        ? tasks.uncompleted[taskIdx]
        : tasks.completed[taskIdx];

    logger.info(
      `Attempting to remove task from ${taskTypeToRemove} tasks: ${taskToRemove?.name}`,
    );

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
    tasks[taskTypeToRemove].splice(taskIdx, 1);
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
