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
} from './commands';

// Force IPv4 for DNS resolution
dns.setDefaultResultOrder('ipv4first');

const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

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

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
