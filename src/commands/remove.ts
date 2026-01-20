import { Context } from 'telegraf';
import { Command } from '../core/config.js';
import {
  extractArg,
  formatOperatedTaskStr,
  findTaskIdxByName,
} from '../utils/index.js';
import { queryTasks } from '../services/queryTasks.js';
import { googleCalendarService } from '../clients/google-calendar.js';
import logger from '../core/logger.js';
import { saveTasks } from '../services/saveTasks.js';
import {
  getNoTaskNameMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../views/generalView.js';
import { TaskTypeToOp } from '../core/types.js';

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

    const { taskData, metadata } = await queryTasks();

    let taskIdx = findTaskIdxByName(taskData.uncompleted, arg);
    let taskTypeToRemove: TaskTypeToOp = 'none';
    if (taskIdx === -1) {
      taskIdx = findTaskIdxByName(taskData.completed, arg);
      if (taskIdx === -1) {
        return ctx.reply(TASK_NOT_FOUND_MESSAGE);
      }
      taskTypeToRemove = 'completed';
    } else {
      taskTypeToRemove = 'uncompleted';
    }

    const taskToRemove =
      taskTypeToRemove === 'uncompleted'
        ? taskData.uncompleted[taskIdx]
        : taskData.completed[taskIdx];

    logger.infoWithContext({
      userId: ctx.from?.id,
      op: Command.REMOVE,
      message: `Attempting to remove task from ${taskTypeToRemove} tasks: ${taskToRemove?.name}`,
    });

    // Remove from calendar first
    let removedFromCalendar = false;
    if (taskToRemove.calendarEventId) {
      removedFromCalendar = await googleCalendarService.deleteEvent(
        taskToRemove.calendarEventId,
      );
      if (removedFromCalendar) {
        logger.infoWithContext({
          userId: ctx.from?.id,
          op: Command.REMOVE,
          message: `Removed calendar event for task: ${taskToRemove.name}`,
        });
      } else {
        logger.errorWithContext({
          userId: ctx.from?.id,
          op: Command.REMOVE,
          error: `Failed to remove calendar event with ID: ${taskToRemove.calendarEventId}`,
        });
      }
    }

    // Then remove from task table
    taskData[taskTypeToRemove].splice(taskIdx, 1);
    await saveTasks(taskData, metadata);

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
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.REMOVE,
      error,
    });
  }
};
