import { Context } from 'telegraf';
import { Command } from '../config';
import {
  extractArg,
  findConflictingTask,
  formatTimeRange,
  getErrorLog,
  getFormatOperatedTaskStr,
} from '../utils';
import { message } from 'telegraf/filters';
import { queryTasks } from '../task-service/queryTasks';
import { saveTasks } from '../task-service/saveTasks';
import { googleCalendarService } from '../task-service/google-calendar';
import { parseTask } from '../task-service/gemini';
import { getNoTaskNameMessage, getNoTextMessage } from '../bot-message';
import { logger } from '../logger';

export const addCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply(getNoTextMessage(Command.ADD));
  }

  const text = ctx.message.text;
  const arg = extractArg(text, Command.ADD);

  if (!arg) {
    return ctx.reply(getNoTaskNameMessage(Command.ADD));
  }

  try {
    const { metadata, tasks } = await queryTasks();

    if (!metadata.timezone) {
      return ctx.reply(
        '❌ Timezone not set. Please set your timezone first using /settimezone command.',
      );
    }

    let task;
    try {
      task = await parseTask(arg, metadata.timezone);
    } catch (error) {
      return ctx.reply(
        `❌ ${error instanceof Error ? error.message : 'Failed to add task due to an unknown error.'}`,
      );
    }

    const conflictingTask = findConflictingTask(task, tasks);

    if (conflictingTask) {
      return ctx.reply(
        `❌ Time conflict with existing task: "${conflictingTask.name}" (Date: ${conflictingTask.date}, Time: ${formatTimeRange(conflictingTask.time!, conflictingTask.duration!)})`,
      );
    }

    // Create calendar event if task has date and time
    let eventId: string | null = null;

    if (task.date && task.time) {
      eventId = await googleCalendarService.createEvent(
        task,
        metadata.timezone,
      );
    }

    if (eventId) {
      task.calendarEventId = eventId;
    }
    tasks.push(task);

    await saveTasks(tasks, metadata);

    const response = getFormatOperatedTaskStr(task, {
      command: Command.ADD,
      prefix: '✅ ',
      suffix: eventId ? '\n_Calendar event created_' : undefined,
    });
    ctx.reply(response, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    ctx.reply('❌ Error adding task. Please try again.');
    logger.error(getErrorLog({ userId: ctx.from?.id, op: Command.ADD, error }));
  }
};
