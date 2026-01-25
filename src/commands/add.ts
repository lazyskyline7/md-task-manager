import { Context, Markup } from 'telegraf';
import { Command } from '../core/config.js';
import {
  extractArg,
  findTimeConflictingTask,
  formatTimeRange,
  formatOperatedTaskStr,
  parseUserText,
  findTaskIdxByName,
} from '../utils/index.js';
import { queryTasks } from '../services/queryTasks.js';
import { saveTasks } from '../services/saveTasks.js';
import { generateAiTask } from '../clients/gemini.js';
import {
  getNoTaskNameMessage,
  getNoTextMessage,
} from '../views/generalView.js';
import logger from '../core/logger.js';
import { Task } from '../core/types.js';
import { setSessionData } from '../middlewares/session.js';

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
    const { metadata, taskData } = await queryTasks();

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

    const timeConflictingTask = findTimeConflictingTask(
      task,
      taskData.uncompleted,
    );

    // Constraint: Time conflict check
    if (timeConflictingTask) {
      return ctx.reply(
        `❌ Time conflict with existing task: "${timeConflictingTask.name}" (Date: ${timeConflictingTask.date}, Time: ${formatTimeRange(timeConflictingTask.time!, timeConflictingTask.duration!)})`,
      );
    }

    // Constraint: Check name uniqueness
    task.name = getUniqueTaskName(task.name, taskData.uncompleted);

    // Add the new task to uncompleted tasks
    taskData.uncompleted.unshift(task);

    await saveTasks(taskData, metadata);

    const response = formatOperatedTaskStr(task, {
      command: Command.ADD,
      prefix: '✅ ',
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });

    if (task.date && task.time) {
      setSessionData(ctx.from!.id, {
        calendarOp: { type: 'add', taskName: task.name },
      });
      await ctx.reply(
        'Add this task to Google Calendar?',
        Markup.inlineKeyboard([
          Markup.button.callback('Yes', 'cal_yes'),
          Markup.button.callback('No', 'cal_no'),
        ]),
      );
    }
  } catch (error) {
    ctx.reply('❌ Error adding task. Please try again.');
    logger.errorWithContext({ userId: ctx.from?.id, op: Command.ADD, error });
  }
};

const getUniqueTaskName = (taskName: string, tasks: Task[]): string => {
  let uniqueName = taskName;

  // Check if name already exists
  if (findTaskIdxByName(tasks, uniqueName) === -1) {
    return uniqueName;
  }

  // Extract base name and counter if exists
  const match = taskName.match(/^(.+?)\s*\((\d+)\)$/);

  if (match) {
    // Name already has a counter like "Task (2)"
    const baseName = match[1];
    let counter = parseInt(match[2], 10);

    // Increment counter until we find a unique name
    do {
      counter++;
      uniqueName = `${baseName} (${counter})`;
    } while (findTaskIdxByName(tasks, uniqueName) !== -1);
  } else {
    // Name doesn't have a counter, start with (1)
    let counter = 1;
    do {
      uniqueName = `${taskName} (${counter})`;
      counter++;
    } while (findTaskIdxByName(tasks, uniqueName) !== -1);
  }

  return uniqueName;
};

const processNewTask = async (
  userText: string,
  timezone: string,
): Promise<Task> => {
  const { tags, text } = parseUserText(userText);

  const task = await generateAiTask(text, tags, timezone);
  return { completed: false, ...task, tags };
};
