import type { Request, Response } from 'express';
import type { Telegraf } from 'telegraf';
import logger from '../core/logger.js';
import { ALLOWED_USERS } from '../core/config.js';
import { queryTasks } from '../services/queryTasks.js';
import { getTasksByDay } from '../utils/index.js';
import { getTodaysTasksMessage } from '../views/generalView.js';
import { BotContext } from '../middlewares/session.js';

export const cronHandler = async (
  _req: Request,
  res: Response,
  bot: Telegraf<BotContext>,
): Promise<void> => {
  const { taskData, metadata } = await queryTasks();

  if (!metadata.timezone) {
    logger.warnWithContext({
      message: 'Timezone not set - skipping notification',
    });
    res.status(200).json({ success: true, message: 'Timezone not set' });
    return;
  }

  const now = new Date();
  const dailyTasks = getTasksByDay(
    taskData.uncompleted,
    now,
    metadata.timezone,
  );

  if (dailyTasks.length === 0) {
    logger.infoWithContext({
      message: 'No tasks for today, skipping notification',
    });
    res.status(200).json({ success: true, message: 'No tasks for today' });
    return;
  }

  const message = getTodaysTasksMessage(
    dailyTasks,
    metadata.timezone,
    '🔔',
    'Daily Reminder',
  );

  await bot.telegram.sendMessage(ALLOWED_USERS[0], message, {
    parse_mode: 'MarkdownV2',
  });

  res.status(200).json({ success: true, notified: ALLOWED_USERS[0] });
};
