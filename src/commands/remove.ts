import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { COMMANDS } from '../config';
import { extractArg } from '../utils';
import { queryTasks } from '../task-service/queryTasks';
import { googleCalendarService } from '../task-service/google-calendar';
import { logger } from '../logger';
import { saveTasks } from '../task-service/saveTasks';

export const removeCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('❌ Please provide a task name to remove');
  }

  try {
    const text = ctx.message.text;
    const arg = extractArg(text, COMMANDS.Remove.name);

    if (!arg) {
      return ctx.reply('❌ Please provide a task name (e.g., /remove My Task)');
    }

    const { tasks, metadata } = await queryTasks();
    const taskIdx = tasks.findIndex((task) => task.name === arg);

    if (taskIdx === -1) {
      return ctx.reply('❌ Task not found!');
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
          `Failed to remove calendar event for task: ${taskToRemove.name}`,
        );
      }
    }
    // Then remove from task table
    tasks.splice(taskIdx, 1);
    await saveTasks(tasks, metadata);

    ctx.reply(
      `🗑️ Removed: ${arg}${removedFromCalendar ? ' (also removed from calendar)' : ''}`,
    );
  } catch (error) {
    ctx.reply('❌ Error removing task. Please try again.');
    console.error('Remove command error:', error);
  }
};
