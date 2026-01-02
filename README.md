# Markdown Task Manager

A Telegram bot for managing your tasks efficiently using webhooks. Track, organize, and complete tasks directly through Telegram!

## Features

✅ **Add Tasks** - Create new tasks with simple commands  
📋 **List Tasks** - View all your tasks in a clean format  
✅ **Complete Tasks** - Mark tasks as done  
🗑️ **Delete Tasks** - Remove tasks you no longer need  
📊 **Statistics** - Track your progress with task stats  
🧹 **Clear Completed** - Remove all completed tasks at once  

## Architecture

- **Webhook-based** - Serverless-ready, FaaS compatible
- **Express server** - Receives updates from Telegram
- **File-based storage** - Each user's tasks stored in separate JSON files

## Setup

### Prerequisites

- Node.js version 18 or higher
- pnpm package manager: `npm install -g pnpm`
- A Telegram account
- [ngrok](https://ngrok.com) or similar for local testing (optional)

### Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. **Create a Telegram Bot:**
   - Open Telegram and search for [@BotFather](https://t.me/botfather)
   - Send `/newbot` and follow the instructions
   - Copy the bot token provided by BotFather

4. **Configure Environment:**
   - Copy `.env.example` to `.env`
   - Paste your bot token in the `TELEGRAM_BOT_TOKEN` field
   - Optionally set `PORT` (defaults to 3000)

## Usage

### Running Locally with Webhook

1. **Start the server:**
   ```bash
   pnpm run dev
   ```

2. **Expose your local server** (for Telegram to reach it):
   ```bash
   ngrok http 3000
   ```
   This will give you a public URL like `https://abc123.ngrok.io`

3. **Set the webhook** (replace `<TOKEN>` with your bot token and `<NGROK_URL>` with your ngrok URL):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=<NGROK_URL>/webhook"
   ```

4. **Test the bot** - Search for your bot on Telegram and send `/start`

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and available commands |
| `/help` | Display all available commands |
| `/add [Title]` | Add a new task with the given title |
| `/list` | Show all your tasks |
| `/complete [ID]` | Mark a task as complete |
| `/delete [ID]` | Delete a task |
| `/stats` | View your task statistics |
| `/clear` | Delete all completed tasks |

**Quick tip:** Just send any text (without `/`) to instantly create a task!

### Examples

```
/add Buy groceries
/add Fix bug in login page
/list
/complete 1234567890
/stats
```

## Project Structure

```
src/
├── index.ts          # Express server & webhook handler
├── taskManager.ts    # Task management logic
└── telegramBot.ts    # Telegram bot command handlers
tasks/                # User task data (auto-created)
```

## Development Commands

- **Run in dev mode:** `pnpm run dev`
- **Build:** `pnpm run build`
- **Start production:** `pnpm start`
- **Lint:** `pnpm run lint`
- **Fix linting:** `pnpm run lint:fix`
- **Format:** `pnpm run format`

## Deployment

This bot is designed for webhook mode and can be deployed to:

- **Vercel** - Zero config deployment
- **AWS Lambda** - Serverless function
- **Google Cloud Functions** - FaaS
- **Cloudflare Workers** - Edge functions
- **Any server** - Traditional hosting

For production deployment, set the webhook URL to your production domain:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/webhook"
```

## Troubleshooting

- **Bot not responding:** 
  - Verify webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
  - Check server is running and accessible
  - Verify `TELEGRAM_BOT_TOKEN` in `.env` is correct
  
- **Webhook errors:**
  - Ensure your URL is HTTPS (Telegram requires SSL)
  - Check ngrok is running for local testing
  
- **Tasks not saving:** 
  - Ensure the project has write permissions in the `tasks/` directory
  
- **TypeScript errors:** 
  - Run `pnpm add -D typescript`
  
- **Node.js version issues:** 
  - Check your Node version with `node --version` (18+ required)

## How It Works

- Each user's tasks are stored in separate JSON files in the `tasks/` directory
- Tasks are identified by their creation timestamp
- All commands are user-specific and isolated
- Tasks persist between server restarts
- Webhook mode allows for serverless deployment and better scalability