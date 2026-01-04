import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { queryTasks } from '../task-service/queryTasks';
import { saveTasks } from '../task-service/saveTasks';
import { logger } from '../logger';
import { extractArg } from '../utils';
import { COMMANDS, TIME_ZONE_LIST_MESSAGE } from '../config';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { Task } from '../types';

export const listTimezonesCommand = async (ctx: Context) => {
  ctx.reply(TIME_ZONE_LIST_MESSAGE, { parse_mode: 'MarkdownV2' });
};

export const setTimezoneCommand = async (ctx: Context) => {
  if (!ctx.has(message('text'))) {
    return ctx.reply('Please provide a timezone value');
  }

  const text = ctx.message.text;
  const timezone = extractArg(text, COMMANDS.SetTimezone.name);

  if (!timezone) {
    return ctx.reply(
      'Please provide a timezone. Use /listtimezones to see available options.',
    );
  }

  try {
    const { tasks, metadata } = await queryTasks();
    const oldTimezone = metadata.timezone;

    // Only convert tasks if timezone is actually changing
    if (oldTimezone === timezone) {
      return ctx.reply(`Timezone is already set to: ${timezone}`);
    }

    metadata.timezone = timezone;

    if (!oldTimezone) {
      // If no previous timezone, just set and save
      await saveTasks(tasks, metadata);
      return ctx.reply(`✅ Timezone set to: ${timezone}`);
    }
    // Convert all task dates/times from old timezone to new timezone
    const updatedTasks = tasks.map((task: Task) => {
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
          logger.warn(
            `Failed to convert timezone for task: ${task.name}`,
            error,
          );
          // Keep original date/time if conversion fails
        }
      }
      return task;
    });

    await saveTasks(updatedTasks, metadata);

    await ctx.reply(
      `✅ Timezone updated to: ${timezone}\n\nAll task dates and times have been converted to the new timezone.`,
    );
  } catch (error) {
    logger.error('Failed to set timezone:', error);
    await ctx.reply('❌ Failed to update timezone. Please try again.');
  }
};
