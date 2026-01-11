import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import dns from 'dns';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import https from 'https';
import { fileURLToPath } from 'url';
import { Command } from '../src/config.js';
import { logger } from '../src/logger.js';
import { addCommand } from '../src/commands/add.js';
import { completeCommand } from '../src/commands/complete.js';
import { removeCommand } from '../src/commands/remove.js';
import { listCommand } from '../src/commands/list.js';
import { listAllCommand } from '../src/commands/listAll.js';
import { clearCompletedCommand } from '../src/commands/clearCompleted.js';
import {
  setTimezoneCommand,
  listTimezonesCommand,
  myTimezoneCommand,
} from '../src/commands/setTimezone.js';

import {
  editCommand,
  registerEditActions,
  handleEditInput,
} from '../src/commands/edit.js';
import { todayCommand } from '../src/commands/today.js';
import { START_WORDING, getTodaysTasksMessage } from '../src/bot-message.js';
import { queryTasks } from '../src/task-service/queryTasks.js';
import { getTasksByDay } from '../src/utils.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const ALLOWED_USERS = process.env.TELEGRAM_BOT_WHITELIST
  ? process.env.TELEGRAM_BOT_WHITELIST.split(',').map((id) =>
      parseInt(id.trim()),
    )
  : [];

if (!token) {
  logger.error('TELEGRAM_BOT_TOKEN is required!');
  process.exit(1);
}

const isVercel = process.env.VERCEL === '1';

// Only apply DNS/Agent fixes if NOT on Vercel
if (!isVercel) {
  dns.setDefaultResultOrder('ipv4first');
}

const bot = new Telegraf(token, {
  telegram: {
    // Only use the custom agent locally
    agent: !isVercel
      ? new https.Agent({ family: 4, keepAlive: true })
      : undefined,
  },
});

const app = express();

app.use(express.json());

// Security middleware
bot.use(async (ctx, next) => {
  try {
    if (ALLOWED_USERS.length > 0) {
      const userId = ctx.from?.id;
      if (!userId || !ALLOWED_USERS.includes(userId)) {
        logger.warn(`Unauthorized access attempt from user ID: ${userId}`);
        await ctx.reply(
          `*Access Restricted* \\- This bot is private\\. Please contact the [administrator](tg://user?id=${ALLOWED_USERS[0]}) to gain access\\.`,
          {
            parse_mode: 'MarkdownV2',
          },
        );
        return;
      }
    }
    await next();
  } catch (error) {
    logger.error(
      'Security middleware error:',
      error instanceof Error ? error.message : error,
    );
    // Don't re-throw - prevent error from propagating to user
  }
});

// Register commands
bot.command(Command.ADD, addCommand);
bot.command(Command.LIST, listCommand);
bot.command(Command.COMPLETE, completeCommand);
bot.command(Command.EDIT, editCommand);
bot.command(Command.REMOVE, removeCommand);
bot.command(Command.LISTALL, listAllCommand);
bot.command(Command.CLEARCOMPLETED, clearCompletedCommand);
bot.command(Command.SETTIMEZONE, setTimezoneCommand);
bot.command(Command.LISTTIMEZONES, listTimezonesCommand);
bot.command(Command.MYTIMEZONE, myTimezoneCommand);
bot.command(Command.TODAY, todayCommand);

// Register Action Handlers
registerEditActions(bot);

// Register middleware for handling edit input
bot.use(handleEditInput);

// Bot command handlers
bot.on(message('text'), (ctx) => {
  ctx.reply(START_WORDING, { parse_mode: 'MarkdownV2' }).catch((error) => {
    logger.error('Failed to send reply:', error.message);
  });
});

logger.debug(START_WORDING);

// Health check
app.get('/api', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Bot webhook server' });
});

// Webhook endpoint - use Telegraf to handle updates
app.post('/api', async (req: Request, res: Response) => {
  try {
    await bot.handleUpdate(req.body, res);

    if (!res.writableEnded) {
      res.status(200).json({ ok: true });
    }
  } catch (error) {
    logger.error(
      'Error handling update:',
      error instanceof Error ? error.message : error,
    );
    res.status(200).json({ ok: true });
  }
});

// Cron job
app.get('/api/cron', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    
    const { tasks, metadata } = await queryTasks();

    if (!metadata.timezone) {
      logger.warn('Timezone not set - skipping notification');
      return res.status(200).json({ success: true, message: 'Timezone not set' });
    }

    const now = new Date();
    const dailyTasks = getTasksByDay(tasks, now, metadata.timezone!);

    // Don't send notification if there are no tasks
    if (dailyTasks.length === 0) {
      logger.info('No tasks for today, skipping notification');
      return res.status(200).json({ success: true, message: 'No tasks for today' });
    }
    const message = getTodaysTasksMessage(
      dailyTasks,
      metadata.timezone!,
      '🔔',
      'Daily Reminder'
    );

    await bot.telegram.sendMessage(ALLOWED_USERS[0], message, {
      parse_mode: 'MarkdownV2',
    });

    res.status(200).json({ success: true, notified: ALLOWED_USERS[0] });
  } catch (error) {
    logger.error('Cron job failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info('Webhook endpoint ready');
  });
}

export default app;

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give logger time to write before exiting
  setTimeout(() => process.exit(1), 1000);
});
