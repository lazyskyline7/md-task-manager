import { Context } from 'telegraf';
import { COMMANDS } from '../config';
import { extractArg } from '../utils';
import { message } from 'telegraf/filters';
import { queryTasks } from '../task-service/queryTasks';
import { saveTasks } from '../task-service/saveTasks';
import { Task } from '../types';
import { googleCalendarService } from '../task-service/google-calendar';

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

  const task: Task = { name: arg, completed: false };

  // TODO: update after llm integrated
  // Mock date and time if not provided
  if (!task.date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    task.date = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  if (!task.time) {
    task.time = '09:00';
  }
  if (!task.duration) {
    task.duration = '1:00';
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

  ctx.reply(
    `✅ Task added: ${text}${task.date ? ` on ${task.date}` : ''}${
      task.time ? ` at ${task.time}` : ''
    }${eventId ? ' (Calendar event also created)' : ''}
    }`,
  );
};
