# Markdown Task Manager

A Telegram bot that manages tasks using a Markdown file on GitHub. Uses **Google Gemini AI** for natural language processing and integrates with **Google Calendar**.

Try it: [@LazyMdTaskBot](https://t.me/LazyMdTaskBot)

## Features

- **Markdown-as-Database**: Tasks stored in a GitHub Markdown table, editable directly
- **AI-Powered**: Natural language parsing with Google Gemini (e.g., "Meeting tomorrow at 3pm")
- **Google Calendar Sync**: Automatic event creation/updates
- **Timezone Support**: Multi-timezone handling
- **Daily Reminders**: Scheduled task summaries
- **Secure**: Whitelist-based access control

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Create a Markdown task file** in a GitHub repository using `example-task-table.md` as template

### Required Credentials

- Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- GitHub Personal Access Token (with `repo` scope)
- Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
- Google Cloud Service Account (optional, for Calendar sync)

### Configuration

| Variable | Description | Required |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token. | Yes |
| `TELEGRAM_BOT_WHITELIST` | Comma-separated list of Telegram User IDs allowed to use the bot. | Yes |
| `GITHUB_TOKEN` | GitHub Personal Access Token. | Yes |
| `GITHUB_PATH` | Full URL to the blob file (e.g., `https://github.com/user/repo/blob/main/tasks.md`). | Yes |
| `GEMINI_API_KEY` | Google Gemini API Key. | Yes |
| `AI_MODEL` | Gemini model to use (default: `gemini-2.0-flash`). | No |
| `GOOGLE_CALENDAR_ID` | The ID of the Google Calendar to sync with. | Optional |
| `GOOGLE_CALENDAR_CREDENTIALS_PATH` | Path to local service account JSON (for local dev). | Optional |
| `CRON_SECRET` | Secret key for securing the cron endpoint. | Yes |
| `BOT_SECRET` | Secret token to secure Telegram Webhooks. | Optional |

**For Vercel Deployment (Google Calendar):**
Instead of `GOOGLE_CALENDAR_CREDENTIALS_PATH`, set these individual variables:

- `GOOGLE_CALENDAR_CLIENT_EMAIL`
- `GOOGLE_CALENDAR_PROJECT_ID`
- `GOOGLE_CALENDAR_PRIVATE_KEY`

### Local Development

Start the development server:

```bash
pnpm dev
```

The bot uses polling in development (if not configured for webhooks) or you can use `ngrok` to tunnel the webhook to localhost.

## 🛠 Usage

Chat with your bot on Telegram using these commands:

### Task Management

- `/add <text>` - Add a task using natural language (e.g., `/add Buy milk tomorrow at 10am`).
- `/list` - List all incomplete tasks.
- `/today` - Show tasks scheduled for today.
- `/listall` - List all tasks (including completed).
- `/complete <task_name>` - Mark a task as completed.
- `/edit <task_name>` - Edit a task's details interactively.
- `/remove <task_name>` - Permanently remove a task (and its calendar event).
- `/clearcompleted` - Remove all completed tasks from the list.

### Settings

- `/settimezone <timezone>` - Set your preferred timezone (e.g., `/settimezone Asia/Taipei`).
- `/mytimezone` - Check your current timezone setting.
- `/listtimezones` - Show a list of common timezones.
- `/about` - Show bot information.

## 📦 Deployment

This project is optimized for **Vercel**.

1. Import to Vercel
2. Add environment variables
3. Deploy
4. Set webhook via Telegram Bot API

Cron configured in `vercel.json`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
