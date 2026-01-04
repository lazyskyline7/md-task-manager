import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { queryTasks } from '../task-service/queryTasks';
import { saveTasks } from '../task-service/saveTasks';
import { logger } from '../logger';
import { extractArg } from '../utils';
import { COMMANDS, TIME_ZONE_LIST_MESSAGE } from '../config';

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
    metadata.timezone = timezone;
    await saveTasks(tasks, metadata);

    await ctx.reply(
      `✅ Timezone updated to: ${timezone}\n\nAll future timestamps will use this timezone.`,
    );
  } catch (error) {
    logger.error('Failed to set timezone:', error);
    await ctx.reply('❌ Failed to update timezone. Please try again.');
  }
};
