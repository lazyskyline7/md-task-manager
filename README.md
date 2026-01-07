# Markdown Task Manager

A Telegram bot for managing your tasks efficiently with GitHub storage, Google Calendar integration, and AI-powered task extraction. Track, organize, and complete tasks directly through Telegram!

## Features

✅ **AI-Powered Task Parsing** - Create tasks using natural language (e.g., "Meeting with John tomorrow at 3pm")  
✅ **Add Tasks** - Smartly extract date, time, and details from your input  
📋 **List Tasks** - View all your tasks in a clean format  
✅ **Complete Tasks** - Mark tasks as done  
🗑️ **Delete Tasks** - Remove tasks you no longer need  
📊 **GitHub Integration** - Sync tasks to a GitHub repository  
📅 **Google Calendar** - Automatically create calendar events for tasks with dates/times  
🧹 **Clear Completed** - Remove all completed tasks at once  
🌍 **Timezone Support** - Handle tasks across different timezones

## Architecture

- **Telegram Bot** - User interface for task management
- **GitHub Storage** - Tasks persisted in a markdown file in your GitHub repository
- **Google Gemini AI** - Natural language processing for task extraction
- **Google Calendar API** - Optional integration for task scheduling
- **TypeScript** - Type-safe codebase with modern Node.js

## Setup

### Prerequisites

- Node.js version 24.x (as specified in package.json)
- pnpm package manager: `npm install -g pnpm`
- A Telegram account
- A GitHub account and personal access token
- A Google Cloud account for Gemini AI and (Optional) Calendar integration

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/lazyskyline7/md-task-manager.git
   cd md-task-manager
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**

   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Then configure each variable as described below:

   #### Telegram Bot Configuration

   **`TELEGRAM_BOT_TOKEN`** (Required)
   - Get your bot token from [@BotFather](https://t.me/botfather) on Telegram

   **`TELEGRAM_BOT_WHITELIST`** (Optional)
   - Comma-separated list of Telegram User IDs allowed to use the bot.
   - If left empty, anyone can access the bot.
   - If exactly one ID is provided, unauthorized users will see a direct link to contact that user (the administrator) for access.
   
   #### GitHub Configuration

   **`GITHUB_TOKEN`** (Required)
   - Personal access token for GitHub API access (requires `repo` scope)

   **`GITHUB_PATH`** (Required)
   - Path to your tasks file in the GitHub repository (e.g., `owner/repo/tasks.md`)

   #### AI Configuration

   **`GEMINI_API_KEY`** (Required)
   - API key for Google Gemini AI
   - Get it from [Google AI Studio](https://aistudio.google.com/)

   #### Google Calendar Configuration (Optional)

   **`GOOGLE_CALENDAR_CREDENTIALS_PATH`** (Optional)
   - Path to your Google service account credentials JSON file

   **`GOOGLE_CALENDAR_ID`** (Optional)
   - The Google Calendar ID where events will be created

   #### Server Configuration

   **`PORT`** (Optional)
   - Port number for the Express server (default: `3000`)

## Usage

### Running the Bot

1. **Start in development mode:**
   ```bash
   pnpm run dev
   ```

2. **Start the bot** - Search for your bot on Telegram and send `/start`

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and available commands |
| `/help` | Display all available commands |
| `/add [text]` | Add a new task using natural language (AI extracted) |
| `/list` | Show all incomplete tasks |
| `/listall` | Show all tasks (including completed) |
| `/complete [index]` | Mark a task as complete by its index |
| `/remove [index]` | Delete a task by its index |
| `/clearcompleted` | Delete all completed tasks |
| `/settimezone [tz]` | Set your current timezone |
| `/mytimezone` | Show your configured timezone |
| `/listtimezones` | List common supported timezones |

### Examples

```
/settimezone Asia/Taipei
/add Review pull request tomorrow at 10am #work
/add Buy groceries on Saturday morning
/list
/complete 0
/remove 1
/clearcompleted
```

## Project Structure

```
src/
├── index.ts                    # Main entry point and Telegram bot setup
├── config.ts                   # Configuration and constants
├── types.ts                    # TypeScript type definitions
├── logger.ts                   # Logging utility
├── utils.ts                    # Helper functions
├── github-client.ts            # GitHub API client
├── commands/                   # Bot command handlers
│   ├── add.ts                 # Add task command
│   ├── list.ts                # List tasks command
│   ├── listAll.ts             # List all tasks command
│   ├── complete.ts            # Complete task command
│   ├── remove.ts              # Remove task command
│   ├── clearCompleted.ts      # Clear completed tasks command
│   └── setTimezone.ts         # Timezone management commands
└── task-service/              # Task management logic
    ├── index.ts               # Task service interface
    ├── gemini.ts              # AI task extraction logic
    ├── queryTasks.ts          # Query tasks from GitHub
    ├── saveTasks.ts           # Save tasks to GitHub
    └── google-calendar.ts     # Google Calendar integration
tasks/                         # (Optional) Local task storage directory
```

## How It Works

### AI Task Extraction
- When you use `/add`, the bot uses Google's Gemini AI to parse your message.
- It automatically extracts:
  - Task Name
  - Date (resolving relative terms like "tomorrow", "next Friday")
  - Time
  - Duration (defaults to 1 hour if not specified)
  - Description (AI generated insight)
  - Tags (from #hashtags)
  - Links

### Task Storage
- Tasks are stored in a markdown file in your GitHub repository
- The file is updated automatically on every change

### Task Properties
Each task can have the following properties:
- `name` (string, required) - Task name
- `completed` (boolean) - Completion status
- `date` (string, optional) - YYYY-MM-DD format
- `time` (string, optional) - HH:MM format
- `duration` (string, optional) - HH:MM format
- `description` (string, optional) - AI-generated description
- `tags` (array, optional) - Task tags
- `link` (string, optional) - Related URL
- `calendarEventId` (string, optional) - Google Calendar event ID

### Timezone Management
- Setting a timezone is critical for accurate date/time parsing.
- The bot uses your configured timezone to interpret "tomorrow" or "9am" correctly relative to your location.

## Development Commands

- **Run in dev mode:** `pnpm run dev`
- **Build:** `pnpm run build`
- **Start production:** `pnpm start`
- **Lint:** `pnpm run lint`
- **Fix linting:** `pnpm run lint:fix`
- **Format:** `pnpm run format`

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.