import { Context } from 'telegraf';
import { COMMANDS } from '../config';
import { extractArg, findConflictingTask } from '../utils';
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
      `❌ Time conflict with existing task: "${conflictingTask.name}" (Date: ${conflictingTask.date}, Time: ${conflictingTask.time}, Duration: ${conflictingTask.duration})`,
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

  ctx.reply(
    `✅ Task added: ${task.name}${task.date ? ` on ${task.date}` : ''}${
      task.time ? ` at ${task.time}` : ''
    }${eventId ? ' (Calendar event also created)' : ''}
    }`,
  );
};
