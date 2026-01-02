import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import https from 'https';
import dns from 'dns';
import {
  addTask,
  clearCompletedTasks,
  completeTaskByName,
  listAllTasks,
  listTasks,
  removeTaskByName,
} from './task-manage';
import { COMMANDS, START_WORDING } from './constants';
import { extractArg } from './utils';

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

bot.command(COMMANDS.Add.name, async (ctx) => {
  const text = ctx.message.text;
  const arg = extractArg(text, COMMANDS.Add.name);

  if (!arg) {
    return ctx.reply('/add followed by the task name');
  }

  addTask({
    name: arg,
    completed: false,
  });

  await ctx.reply(`✅ Task added: ${text}`);
});

bot.command(COMMANDS.List.name, (ctx) => {
  const tasks = listTasks();

  if (tasks.length === 0) {
    return ctx.reply('No tasks yet!');
  }

  const message =
    'Your tasks:\n' +
    tasks.map((task, index) => `${index + 1}. ${task.name}`).join('\n');

  ctx.reply(message);
});

bot.command(COMMANDS.Complete.name, (ctx) => {
  const text = ctx.message.text;
  const arg = extractArg(text, COMMANDS.Complete.name);

  if (arg) {
    const success = completeTaskByName(arg);
    if (success) ctx.reply(`✅ Completed: ${arg}`);
    else ctx.reply('❌ Task not found!');
  } else {
    ctx.reply('❌ /complete followed by the task name');
  }
});

bot.command(COMMANDS.Remove.name, (ctx) => {
  const text = ctx.message.text;
  const arg = extractArg(text, COMMANDS.Remove.name);

  if (arg) {
    const success = removeTaskByName(arg);
    if (success) ctx.reply(`🗑️ Removed: ${arg}`);
  } else {
    ctx.reply('❌ /remove followed by the task name');
  }
});

bot.command(COMMANDS.ListAll.name.trim(), (ctx) => {
  const tasks = listAllTasks();

  if (tasks.length === 0) {
    return ctx.reply('No tasks yet!');
  }

  const message =
    'All tasks:\n' +
    tasks
      .map(
        (task, index) =>
          `${index + 1}. [${task.completed ? 'x' : ' '}] ${task.name}`,
      )
      .join('\n');

  ctx.reply(message);
});

bot.command(COMMANDS.ClearCompleted.name, (ctx) => {
  clearCompletedTasks();
  ctx.reply('🧹 Cleared all completed tasks!');
});

// Bot command handlers
bot.on(message('text'), (ctx) => ctx.reply(START_WORDING));

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

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
