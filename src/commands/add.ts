import { Context } from 'telegraf';
import { COMMANDS } from '../config';
import {
  extractArg,
  findConflictingTask,
  escapeMarkdownV2,
  formatTimeRange,
} from '../utils';
import { message } from 'telegraf/filters';
import { queryTasks } from '../task-service/queryTasks';
import { saveTasks } from '../task-service/saveTasks';
import { googleCalendarService } from '../task-service/google-calendar';
import { parseTask } from '../task-service/gemini';

export const addCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('Please provide a task name to add');
  }

  const text = ctx.message.text;
  const arg = extractArg(text, COMMANDS.Add.name);

  if (!arg) {
    return ctx.reply('/add followed by the task name');
  }

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
    eventId = await googleCalendarService.createEvent(task, metadata.timezone);
  }

  if (eventId) {
    task.calendarEventId = eventId;
  }
  tasks.push(task);

  await saveTasks(tasks, metadata);

  const escapedName = escapeMarkdownV2(task.name);
  const escapedDesc = task.description
    ? escapeMarkdownV2(task.description)
    : '';
  const escapedDate = task.date ? escapeMarkdownV2(task.date) : '';
  const timeRange =
    task.date && task.time && task.duration
      ? escapeMarkdownV2(formatTimeRange(task.time, task.duration))
      : '';
  const escapedTags =
    task.tags?.map((t) => `\\#${escapeMarkdownV2(t)}`).join(' ') || '';

  let response = `✅ *Task Added*\n\n`;
  response += `*Task:* ${escapedName}\n`;
  if (escapedDesc) response += `*Description:* ${escapedDesc}\n`;
  if (escapedDate)
    response += `*Time:* ${escapedDate}${timeRange ? ` \\(${timeRange}\\)` : ''}\n`;
  if (escapedTags) response += `*Tags:* ${escapedTags}\n`;
  if (task.link) {
    const escapedUrl = task.link.replace(/([)\\])/g, '\\$1');
    response += `*Link:* [Visit](${escapedUrl})\n`;
  }
  if (eventId) response += `\n_Calendar event created_`;

  ctx.reply(response, { parse_mode: 'MarkdownV2' });
};
