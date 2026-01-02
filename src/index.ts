import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import https from 'https';
import dns from 'dns';

// Force IPv4 for DNS resolution
dns.setDefaultResultOrder('ipv4first');

const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required!');
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
    console.log(`Bot connected: @${botInfo.username}`);
  })
  .catch((error) => {
    console.error('Failed to connect:', error.message);
  });

// Bot command handlers
bot.command('start', async (ctx) =>
  ctx.reply('👋 Hello! Commands:\n/add <task>\n/list\n/complete <id>'),
);

bot.command('add', async (ctx) => {
  const text = ctx.message.text;
  const taskText = text.substring(5).trim();

  if (!taskText) {
    return ctx.reply('❌ Usage: /add <task text>');
  }

  await ctx.reply(`✅ Task added: ${text}`);
});

bot.command('list', async (ctx) => {
  const tasks = ['1. Buy groceries', '2. Walk the dog']; // Placeholder tasks

  if (tasks.length === 0) {
    return ctx.reply('📭 No tasks yet!');
  }

  const message = '📋 Your tasks:\n\n' + tasks.join('\n');

  await ctx.reply(message);
});

bot.command('complete', async (ctx) => {
  const text = ctx.message.text;
  const taskId = text.substring(10).trim();

  if (!taskId) {
    return ctx.reply('❌ Usage: /complete <task_id>');
  }

  if (text) {
    await ctx.reply(`✅ Completed: ${text}`);
  } else {
    await ctx.reply('❌ Task not found!');
  }
});

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
    console.error(
      'Error handling update:',
      error instanceof Error ? error.message : error,
    );
    res.status(200).json({ ok: true }); // Still return 200 to Telegram
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 Webhook endpoint ready`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping...');
  process.exit(0);
});
