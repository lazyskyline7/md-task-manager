import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import https from 'https';
import dns from 'dns';
import { COMMANDS, START_WORDING } from './config';
import { logger } from './logger';
import {
  addCommand,
  completeCommand,
  removeCommand,
  listCommand,
  listAllCommand,
  clearCompletedCommand,
  setTimezoneCommand,
  listTimezonesCommand,
  myTimezoneCommand,
} from './commands';

// Force IPv4 for DNS resolution
dns.setDefaultResultOrder('ipv4first');

const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const ALLOWED_USERS = process.env.TELEGRAM_ALLOWED_USERS
  ? process.env.TELEGRAM_ALLOWED_USERS.split(',').map((id) => parseInt(id.trim()))
  : [];

if (!token) {
  logger.error('TELEGRAM_BOT_TOKEN is required!');
  process.exit(1);
}

const httpsAgent = new https.Agent({
  family: 4, // Force IPv4
});

const bot = new Telegraf(token, {
  telegram: {
    agent: httpsAgent,
  },
});

const app = express();

app.use(express.json());

// Security middleware
bot.use(async (ctx, next) => {
  if (ALLOWED_USERS.length > 0) {
    const userId = ctx.from?.id;
    if (!userId || !ALLOWED_USERS.includes(userId)) {
      logger.warn(`Unauthorized access attempt from user ID: ${userId}`);
      return; // Silently ignore unauthorized requests
    }
  }
  await next();
});

// Verify bot connection
bot.telegram
  .getMe()
  .then((botInfo) => {
    logger.info(`Bot connected: @${botInfo.username}`);
  })
  .catch((error) => {
    logger.error('Failed to connect:', error.message);
  });

// Register commands
bot.command(COMMANDS.Add.name, addCommand);
bot.command(COMMANDS.List.name, listCommand);
bot.command(COMMANDS.Complete.name, completeCommand);
bot.command(COMMANDS.Remove.name, removeCommand);
bot.command(COMMANDS.ListAll.name, listAllCommand);
bot.command(COMMANDS.ClearCompleted.name, clearCompletedCommand);
bot.command(COMMANDS.SetTimezone.name, setTimezoneCommand);
bot.command(COMMANDS.ListTimezones.name, listTimezonesCommand);
bot.command(COMMANDS.MyTimezone.name, myTimezoneCommand);

// Bot command handlers
bot.on(message('text'), (ctx) => {
  ctx.reply(START_WORDING, { parse_mode: 'MarkdownV2' }).catch((error) => {
    logger.error('Failed to send reply:', error.message);
  });
});

logger.debug(START_WORDING);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bot webhook server' });
});

// Webhook endpoint - use Telegraf to handle updates
app.post('/webhook', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error(
      'Error handling update:',
      error instanceof Error ? error.message : error,
    );
    res.status(200).json({ ok: true }); // Still return 200 to Telegram
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info('Webhook endpoint ready');
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give logger time to write before exiting
  setTimeout(() => process.exit(1), 1000);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
