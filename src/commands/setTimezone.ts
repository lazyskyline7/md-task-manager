import { Context } from 'telegraf';
import { queryTasks } from '../task-service/queryTasks.js';
import { saveTasks } from '../task-service/saveTasks.js';
import logger from '../logger.js';
import { extractArg } from '../utils.js';
import { Command } from '../config.js';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { Task } from '../types.js';
import { getNoTextMessage, TIME_ZONE_LIST_MESSAGE } from '../bot-message.js';

export const listTimezonesCommand = async (ctx: Context) => {
  ctx.reply(TIME_ZONE_LIST_MESSAGE, { parse_mode: 'MarkdownV2' });
};

export const myTimezoneCommand = async (ctx: Context) => {
  try {
    const { metadata } = await queryTasks();
    const timezone = metadata.timezone || 'Not set';
    ctx.reply(`🌍 Current timezone: *${timezone}*`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.MYTIMEZONE,
      error,
    });
    ctx.reply('❌ Failed to retrieve timezone.');
  }
};

export const setTimezoneCommand = async (ctx: Context) => {
  if (!ctx.message || !('text' in ctx.message)) {
    return ctx.reply(getNoTextMessage(Command.SETTIMEZONE));
  }

  const text = ctx.message.text;
  const timezone = extractArg(text, Command.SETTIMEZONE);

  if (!timezone) {
    return ctx.reply(
      '❌ Please provide a timezone. Use /listtimezones to see available options.',
    );
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch (e) {
    return ctx.reply('❌ Invalid timezone ID. Please check /listtimezones');
  }

  try {
    const { taskData, metadata } = await queryTasks();
    const oldTimezone = metadata.timezone;

    // Only convert tasks if timezone is actually changing
    if (oldTimezone === timezone) {
      return ctx.reply(`Timezone is already set to: ${timezone}`);
    }

    metadata.timezone = timezone;

    if (!oldTimezone) {
      // If no previous timezone, just set and save
      await saveTasks(taskData, metadata);
      return ctx.reply(`✅ Timezone set to: *${timezone}*`, {
        parse_mode: 'Markdown',
      });
    }
    // Convert all task dates/times from old timezone to new timezone
    taskData.uncompleted = taskData.uncompleted.map((task: Task) => {
      if (task.date && task.time) {
        try {
          // Parse date and time in old timezone
          const dateTimeStr = `${task.date}T${task.time}:00`;
          const dateInUtc = fromZonedTime(dateTimeStr, oldTimezone);

          // Convert to new timezone
          const dateInNewTz = toZonedTime(dateInUtc, timezone);

          const formatted = format(dateInNewTz, 'yyyy-MM-dd HH:mm', {
            timeZone: timezone,
          });
          [task.date, task.time] = formatted.split(' ');
        } catch (error) {
          logger.warnWithContext({
            userId: ctx.from?.id,
            op: Command.SETTIMEZONE,
            message: `Failed to convert timezone for task: ${task.name}`,
            error,
          });
          // Keep original date/time if conversion fails
        }
      }
      return task;
    });

    await saveTasks(taskData, metadata);

    await ctx.reply(
      `✅ Timezone updated to: *${timezone}*\n\nAll task dates and times have been converted to the new timezone.`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.SETTIMEZONE,
      error,
    });
    await ctx.reply('❌ Failed to update timezone. Please try again.');
  }
};
