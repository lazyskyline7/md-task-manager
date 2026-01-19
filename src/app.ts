import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dns from 'dns';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import https from 'https';
import { ALLOWED_USERS, Command } from './config.js';
import logger from './logger.js';
import { addCommand } from './commands/add.js';
import { completeCommand } from './commands/complete.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { clearCompletedCommand } from './commands/clearCompleted.js';
import {
  setTimezoneCommand,
  listTimezonesCommand,
  myTimezoneCommand,
} from './commands/timezone.js';

import {
  editCommand,
  registerEditActions,
  handleEditInput,
} from './commands/edit.js';
import { sortCommand, registerSortActions } from './commands/sort.js';
import { todayCommand } from './commands/today.js';
import { aboutCommand } from './commands/about.js';
import { START_WORDING, getTodaysTasksMessage } from './bot-message.js';
import { queryTasks } from './services/queryTasks.js';
import { asyncHandler, getTasksByDay } from './utils.js';
import { cronAuthMiddleware } from './middlewares/cronAuthMiddleware.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';
import { githubWebhookMiddleware } from './middlewares/githubWebhookMiddleware.js';
import { handleGitHubWebhook } from './services/githubWebhookHandler.js';

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const BOT_SECRET = process.env.BOT_SECRET;

if (!token) {
  logger.errorWithContext({ message: 'TELEGRAM_BOT_TOKEN is required!' });
  process.exit(1);
}

/**
 * DNS and Agent configuration for local development.
 * - DNS: Prefer IPv4 to avoid Telegram API connection issues on some networks
 * - HTTPS Agent: Force IPv4 and enable keep-alive for better performance
 */
if (!isProduction) {
  dns.setDefaultResultOrder('ipv4first');
}
const bot = new Telegraf(token, {
  telegram: {
    // Only use the custom agent locally
    agent: !isProduction
      ? new https.Agent({ family: 4, keepAlive: true })
      : undefined,
  },
});

/**
 * Telegraf error handler.
 * Catches errors thrown by bot middleware and command handlers.
 * Without this, errors would crash the app or be silently swallowed.
 */
bot.catch((err) => {
  logger.errorWithContext({
    op: 'TELEGRAF',
    error: err instanceof Error ? err.message : err,
  });
});

const app = express();
app.use(express.json());

app.post('/api', bot.webhookCallback('/api', { secretToken: BOT_SECRET }));

// Trust Vercel proxy to get real client IP
app.set('trust proxy', 1);

// Log incoming requests for debugging and monitoring
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debugWithContext({
    message: `${req.method} ${req.url} (ip: ${req.ip})`,
  });
  next();
});

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

// Register bot command handlers
bot.command(Command.ADD, addCommand);
bot.command(Command.LIST, listCommand);
bot.command(Command.COMPLETE, completeCommand);
bot.command(Command.EDIT, editCommand);
bot.command(Command.REMOVE, removeCommand);
bot.command(Command.CLEARCOMPLETED, clearCompletedCommand);
bot.command(Command.SETTIMEZONE, setTimezoneCommand);
bot.command(Command.LISTTIMEZONES, listTimezonesCommand);
bot.command(Command.MYTIMEZONE, myTimezoneCommand);
bot.command(Command.TODAY, todayCommand);
bot.command(Command.ABOUT, aboutCommand);
bot.command(Command.SORT, sortCommand);

// Register Action Handlers
registerEditActions(bot);
registerSortActions(bot);

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

const router = express.Router();

/**
 * Health check endpoint.
 * Used by monitoring services and to verify the server is running.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Bot webhook server',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Scheduled cron job endpoint for daily task reminders.
 * Sends today's tasks to the first whitelisted user at scheduled time.
 */
router.get(
  '/cron',
  cronAuthMiddleware,
  asyncHandler(async (_: Request, res: Response) => {
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

    // Don't send notification if there are no tasks
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
  }),
);

/**
 * GitHub Webhook endpoint.
 * Receives push events, analyzes changes, and sends notifications.
 */
router.post(
  '/github-webhook',
  express.json({ limit: '10mb' }),
  githubWebhookMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    // The middleware already verifies the signature and event type
    // We pass the bot instance to the handler
    await handleGitHubWebhook(req.body, bot);
    res.status(200).json({ success: true });
  }),
);

app.use('/api', router);

/**
 * 404 handler for undefined routes.
 * Catches all requests that don't match any defined routes.
 * Must be placed after all route definitions but before error middleware.
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

app.use(errorMiddleware);

/**
 * Local development server setup and graceful shutdown.
 * Not needed on Vercel (FaaS) where each request is an isolated execution.
 */
if (!isProduction) {
  const server = app.listen(PORT, () => {
    logger.infoWithContext({
      message: `Server running on http://localhost:${PORT}`,
    });
    logger.infoWithContext({
      message: 'Webhook endpoint ready at /api',
    });
  });

  /**
   * Performs graceful shutdown of the server and bot
   * @param signal - The signal that triggered the shutdown
   */
  const gracefulShutdown = (signal: string) => {
    logger.infoWithContext({
      message: `${signal} received, shutting down gracefully`,
    });

    server.close(() => {
      logger.infoWithContext({ message: 'Server closed successfully' });
      bot.stop(signal);
      process.exit(0);
    });
  };

  /**
   * Handle termination signals for clean restarts.
   * SIGTERM: Sent by tsx watch when restarting on code changes
   * SIGINT: Sent by Ctrl+C in terminal
   */
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
