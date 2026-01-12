import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import dns from 'dns';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import https from 'https';
import { fileURLToPath } from 'url';
import { Command } from '../src/config.js';
import logger from '../src/logger.js';
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
import { aboutCommand } from '../src/commands/about.js';
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
  logger.errorWithContext({ message: 'TELEGRAM_BOT_TOKEN is required!' });
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
    const userId = ctx.from?.id;

    // Public commands that don't require authentication
    const messageText =
      ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const isAboutCommand =
      messageText === `/${Command.ABOUT}` ||
      messageText.startsWith(`/${Command.ABOUT} `);
    const isCommand = messageText.startsWith('/');

    // Allow /about and non-command messages without authentication
    if (isAboutCommand || !isCommand) {
      return await next();
    }

    if (!userId || !ALLOWED_USERS.includes(userId)) {
      logger.warnWithContext({
        userId,
        message: 'Unauthorized access attempt',
      });

      const contactInfo =
        ALLOWED_USERS.length > 0
          ? `Please contact the [administrator](tg://user?id=${ALLOWED_USERS[0]}) to gain access\\.`
          : 'Please configure `TELEGRAM_BOT_WHITELIST` in your environment variables\\.';

      await ctx.reply(
        `*Access Restricted* \\- This bot is private\\. ${contactInfo}`,
        {
          parse_mode: 'MarkdownV2',
        },
      );
      return;
    }
    await next();
  } catch (error) {
    logger.errorWithContext({
      message: 'Security middleware error',
      error: error instanceof Error ? error.message : error,
    });
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
bot.command(Command.ABOUT, aboutCommand);

// Register Action Handlers
registerEditActions(bot);

// Register middleware for handling edit input
bot.use(handleEditInput);

// Bot command handlers
bot.on(message('text'), (ctx) => {
  ctx.reply(START_WORDING, { parse_mode: 'MarkdownV2' }).catch((error) => {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: 'BOT_REPLY',
      error,
    });
  });
});

logger.debugWithContext({ message: START_WORDING });

// Health check
app.get('/api', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Bot webhook server' });
});

// Webhook endpoint - use Telegraf to handle updates
app.post('/api', async (req: Request, res: Response) => {
  // Check for secret token
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (process.env.BOT_SECRET && secretToken !== process.env.BOT_SECRET) {
    logger.warnWithContext({
      message: 'Unauthorized webhook attempt - invalid secret token',
    });
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await bot.handleUpdate(req.body, res);

    if (!res.writableEnded) {
      res.status(200).json({ ok: true });
    }
  } catch (error) {
    logger.errorWithContext({
      message: 'Error handling update',
      error: error instanceof Error ? error.message : error,
    });
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
      logger.warnWithContext({
        message: 'Timezone not set - skipping notification',
      });
      return res
        .status(200)
        .json({ success: true, message: 'Timezone not set' });
    }

    const now = new Date();
    const dailyTasks = getTasksByDay(
      tasks.uncompleted,
      now,
      metadata.timezone!,
    );

    // Don't send notification if there are no tasks
    if (dailyTasks.length === 0) {
      logger.infoWithContext({
        message: 'No tasks for today, skipping notification',
      });
      return res
        .status(200)
        .json({ success: true, message: 'No tasks for today' });
    }
    const message = getTodaysTasksMessage(
      dailyTasks,
      metadata.timezone!,
      '🔔',
      'Daily Reminder',
    );

    await bot.telegram.sendMessage(ALLOWED_USERS[0], message, {
      parse_mode: 'MarkdownV2',
    });

    res.status(200).json({ success: true, notified: ALLOWED_USERS[0] });
  } catch (error) {
    logger.errorWithContext({
      op: 'CRON_JOB',
      error,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  app.listen(PORT, () => {
    logger.infoWithContext({
      message: `Server running on http://localhost:${PORT}`,
    });
    logger.infoWithContext({ message: 'Webhook endpoint ready' });
  });
}

export default app;

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.errorWithContext(
    {
      op: 'PROCESS',
      message: 'Unhandled Rejection',
      error: reason,
    },
    promise,
  );
});

process.on('uncaughtException', (error) => {
  logger.errorWithContext({
    op: 'PROCESS',
    message: 'Uncaught Exception',
    error,
  });
  process.exit(1);
});
