# Markdown Task Manager

A powerful Telegram bot that helps you manage tasks using natural language. It stores your tasks in a Markdown table on GitHub, syncs them with Google Calendar, and uses Google's Gemini AI to intelligently parse your requests.

## Features

- **📝 Natural Language Processing**: Just type what you need to do (e.g., "/add Review PR #123 tomorrow at 10am for 2h #work"). Gemini AI extracts the date, time, duration, and tags automatically.
- **☁️ GitHub & Git-Sync Integration**: Tasks are stored in a human-readable Markdown table (`tasks.md`) in your GitHub repository. This means your task list is fully accessible and editable by any Git-sync compatible note-taking app like **Obsidian**, **GitBook**, or **Logseq**. The bot serves as a natural language interface for your central knowledge base.
- **📅 Google Calendar Integration**: Automatically creates calendar events for tasks with dates and times when managed via the bot.
- **🌍 Timezone Support**: Handles timezones intelligently for accurate scheduling.
- **🔒 Secure**: Whitelist-based access control ensures only authorized users can manage tasks.

> [!IMPORTANT]
> **Direct Edits & Calendar Sync**: While you can freely read and edit the `tasks.md` file directly through GitHub or Obsidian, please note that manual edits to the Markdown file **will not** trigger a sync to Google Calendar at this time. Calendar synchronization is only executed when tasks are created or modified through the Telegram bot commands to avoid potential data conflict resolution issues.

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js**: v24.0.0 or higher.
- **Telegram Bot Token**: Create a new bot via [@BotFather](https://t.me/BotFather) on Telegram.
- **GitHub Personal Access Token**: Generate a token with `repo` scope to read/write the tasks file.
- **Google Cloud Credentials**: Service account credentials for the Google Calendar API.
- **Gemini API Key**: API key for Google's Gemini AI.

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/lazyskyline7/md-task-manager.git
    cd md-task-manager
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Environment Configuration**:
    Copy the example environment file and fill in your credentials:
    ```bash
    cp .env.example .env
    ```

    Edit `.env` with your details:
    ```env
    TELEGRAM_BOT_TOKEN=your_token_from_botfather
    TELEGRAM_BOT_WHITELIST=your_chat_id
    GITHUB_TOKEN=your_github_token
    GITHUB_PATH=path/to/tasks.md (e.g., username/repo/tasks.md)
    GOOGLE_CALENDAR_CREDENTIALS_PATH=./path/to/credentials.json
    GOOGLE_CALENDAR_ID=your_email@gmail.com
    GEMINI_API_KEY=your_gemini_api_key
    ```

## Usage

Start the development server:
```bash
pnpm dev
```

Or build and start for production:
```bash
pnpm build
pnpm start
```

### Bot Commands

**Calendar Operations**
- `/add <description>` - Add a new task (e.g., `/add Meeting with team tomorrow 2pm #work`)
- `/remove <task name>` - Remove a task by its name

**Task Operations**
- `/complete <task name>` - Mark a task as complete
- `/edit <task index>` - Edit a task (updates are interactive)
- `/clearcompleted` - Remove all completed tasks from the list

**Information**
- `/list` - List all incomplete tasks
- `/listall` - List all tasks including completed ones

**Configuration**
- `/settimezone <timezone>` - Set your current timezone
- `/listtimezones` - Show available timezones
- `/mytimezone` - Check your configured timezone

## Project Structure

```
├── api/
│   └── index.ts           # Express server & Telegram bot entry point
├── src/
│   ├── commands/          # Telegram command handlers
│   ├── task-service/      # Core task management logic
│   │   ├── gemini.ts      # AI-powered natural language parsing
│   │   ├── google-calendar.ts  # Calendar integration
│   │   ├── queryTasks.ts  # Task retrieval from GitHub
│   │   └── saveTasks.ts   # Task persistence to GitHub
│   ├── config.ts          # Configuration & constants
│   ├── types.ts           # TypeScript interfaces
│   └── ...                # Utilities and helpers
├── dist/                  # Compiled JavaScript output
└── vercel.json            # Vercel deployment configuration
```

## Development

- `pnpm dev`: Run the bot in watch mode.
- `pnpm build`: Compile TypeScript to JavaScript.
- `pnpm lint`: Run ESLint.
- `pnpm format`: Format code with Prettier.

## License

ISC
