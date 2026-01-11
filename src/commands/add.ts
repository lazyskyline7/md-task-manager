import { Context } from 'telegraf';
import { Command } from '../config.js';
import {
  extractArg,
  findTimeConflictingTask,
  formatTimeRange,
  getErrorLog,
  formatOperatedTaskStr,
  parseUserText,
} from '../utils.js';
import { queryTasks } from '../task-service/queryTasks.js';
import { saveTasks } from '../task-service/saveTasks.js';
import { googleCalendarService } from '../task-service/google-calendar.js';
import { generateAiTask } from '../task-service/gemini.js';
import { getNoTaskNameMessage, getNoTextMessage } from '../bot-message.js';
import { logger } from '../logger.js';
import { Task } from '../types.js';

export const addCommand = async (ctx: Context) => {
  if (!ctx.message || !('text' in ctx.message)) {
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
      task = await processNewTask(arg, metadata.timezone);
    } catch (error) {
      return ctx.reply(
        `❌ ${error instanceof Error ? error.message : 'Failed to add task due to an unknown error.'}`,
      );
    }

    const timeConflictingTask = findTimeConflictingTask(task, tasks);

    if (timeConflictingTask) {
      return ctx.reply(
        `❌ Time conflict with existing task: "${timeConflictingTask.name}" (Date: ${timeConflictingTask.date}, Time: ${formatTimeRange(timeConflictingTask.time!, timeConflictingTask.duration!)})`,
      );
    }

    // Create calendar event if task has date and time
    let eventId: string | undefined;

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

    const response = formatOperatedTaskStr(task, {
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

const processNewTask = async (
  userText: string,
  timezone: string,
): Promise<Task> => {
  const { tags, text } = parseUserText(userText);

  const task = await generateAiTask(text, tags, timezone);
  return { completed: false, ...task, tags };
};
