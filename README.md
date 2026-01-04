# Markdown Task Manager

A Telegram bot for managing your tasks efficiently with GitHub storage and Google Calendar integration. Track, organize, and complete tasks directly through Telegram!

## Features

✅ **Add Tasks** - Create new tasks with simple commands  
📋 **List Tasks** - View all your tasks in a clean format  
✅ **Complete Tasks** - Mark tasks as done  
🗑️ **Delete Tasks** - Remove tasks you no longer need  
📊 **GitHub Integration** - Sync tasks to a GitHub repository  
📅 **Google Calendar** - Automatically create calendar events for tasks with dates/times  
🧹 **Clear Completed** - Remove all completed tasks at once  

## Architecture

- **Telegram Bot** - User interface for task management
- **GitHub Storage** - Tasks persisted in a markdown file in your GitHub repository
- **Google Calendar API** - Optional integration for task scheduling
- **TypeScript** - Type-safe codebase with modern Node.js

## Setup

### Prerequisites

- Node.js version 24.x (as specified in package.json)
- pnpm package manager: `npm install -g pnpm`
- A Telegram account
- A GitHub account and personal access token
- (Optional) Google Cloud account for Calendar integration

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
   - Steps:
     1. Open Telegram and search for `@BotFather`
     2. Send `/newbot` command
     3. Follow the instructions to create your bot
     4. Copy the bot token provided (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
   - Example: `TELEGRAM_BOT_TOKEN=6789012345:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`

   #### GitHub Configuration

   **`GITHUB_TOKEN`** (Required)
   - Personal access token for GitHub API access
   - Steps to create:
     1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
     2. Click "Generate new token (classic)"
     3. Give it a name (e.g., "Task Manager Bot")
     4. Select scopes: `repo` (full control of private repositories)
     5. Click "Generate token" and copy the token
   - Example: `GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890`

   **`GITHUB_PATH`** (Required)
   - Path to your tasks file in the GitHub repository
   - Format: `owner/repo/path/to/file.md`
   - The file should be a markdown file where tasks will be stored
   - Example: `GITHUB_PATH=lazyskyline7/my-tasks/tasks/work-tasks.md`

   #### Google Calendar Configuration (Optional)

   **`GOOGLE_CALENDAR_CREDENTIALS_PATH`** (Optional)
   - Path to your Google service account credentials JSON file
   - Steps to create:
     1. Go to [Google Cloud Console](https://console.cloud.google.com)
     2. Create a new project or select existing one
     3. Enable Google Calendar API
     4. Go to "Credentials" → "Create Credentials" → "Service Account"
     5. Create a service account and download the JSON key file
     6. Save the file in your project directory
   - Example: `GOOGLE_CALENDAR_CREDENTIALS_PATH=./gen-lang-client-0078613630-da997bc0eafd.json`
   - If not provided, calendar integration will be disabled

   **`GOOGLE_CALENDAR_ID`** (Optional)
   - The Google Calendar ID where events will be created
   - Usually your Gmail address or a specific calendar ID
   - Steps to find:
     1. Open [Google Calendar](https://calendar.google.com)
     2. Click settings (gear icon) → Settings
     3. Click on the calendar you want to use
     4. Scroll down to "Integrate calendar" section
     5. Copy the "Calendar ID"
     6. Share this calendar with the service account email (from your credentials JSON)
   - Example: `GOOGLE_CALENDAR_ID=your-email@gmail.com`
   - If not provided, calendar integration will be disabled

   #### Server Configuration

   **`PORT`** (Optional)
   - Port number for the Express server (for webhook mode)
   - Default: `3000`
   - Example: `PORT=3000`

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
| `/add [task name]` | Add a new task (automatically sets date to tomorrow, time to 09:00) |
| `/list` | Show all incomplete tasks |
| `/listall` | Show all tasks (including completed) |
| `/complete [index]` | Mark a task as complete by its index |
| `/remove [index]` | Delete a task by its index |
| `/clear` | Delete all completed tasks |

### Examples

```
/add Review pull request
/add Write documentation
/list
/complete 0
/remove 1
/clear
```

## Project Structure

```
src/
├── index.ts                    # Main entry point and Telegram bot setup
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Application constants
├── logger.ts                   # Logging utility
├── utils.ts                    # Helper functions
├── github-client.ts            # GitHub API client
├── commands/                   # Bot command handlers
│   ├── add.ts                 # Add task command
│   ├── list.ts                # List tasks command
│   ├── listAll.ts             # List all tasks command
│   ├── complete.ts            # Complete task command
│   ├── remove.ts              # Remove task command
│   └── clearCompleted.ts      # Clear completed tasks command
└── task-service/              # Task management logic
    ├── index.ts               # Task service interface
    ├── queryTasks.ts          # Query tasks from GitHub
    ├── saveTasks.ts           # Save tasks to GitHub
    └── google-calendar.ts     # Google Calendar integration
tasks/                         # (Optional) Local task storage directory
```

## Development Commands

- **Run in dev mode:** `pnpm run dev` - Uses nodemon to watch for changes
- **Build:** `pnpm run build` - Compile TypeScript to JavaScript
- **Start production:** `pnpm start` - Run compiled JavaScript
- **Lint:** `pnpm run lint` - Check code with ESLint
- **Fix linting:** `pnpm run lint:fix` - Auto-fix linting issues
- **Format:** `pnpm run format` - Format code with Prettier

## How It Works

### Task Storage
- Tasks are stored in a markdown file in your GitHub repository
- The file path is specified in `GITHUB_PATH` environment variable
- Tasks are automatically synced to GitHub on every add/update/delete operation

### Task Properties
Each task can have the following properties:
- `name` (string, required) - Task name/description
- `completed` (boolean) - Completion status
- `date` (string, optional) - Date in YYYY-MM-DD format
- `time` (string, optional) - Time in HH:MM format
- `duration` (string, optional) - Duration in HH:MM format
- `priority` (string, optional) - Task priority
- `tags` (array, optional) - Task tags
- `description` (string, optional) - Detailed description
- `calendarEventId` (string, optional) - Google Calendar event ID

### Google Calendar Integration
- When you add a task, if date and time are provided (or mocked), a Google Calendar event is automatically created
- Calendar events include the task name, description, start time, and duration
- If you delete a task with a calendar event, the event is also removed from Google Calendar
- Calendar integration is optional and only works if credentials are properly configured

### Mock Task Data
- By default, when adding a task without specifying date/time:
  - Date is set to tomorrow
  - Time is set to 09:00
  - Duration is set to 1:00 (1 hour)
- This allows for easy testing of the calendar integration

## Troubleshooting

### Bot Not Responding
- Verify the bot token is correct in `.env`
- Check the bot is running: `pnpm run dev`
- Ensure your network connection is stable

### GitHub Integration Issues
- Verify `GITHUB_TOKEN` has `repo` scope permissions
- Check `GITHUB_PATH` format is correct: `owner/repo/path/to/file.md`
- Ensure the file exists in the repository (or will be created on first task add)
- Check GitHub API rate limits

### Google Calendar Issues
- Verify credentials file exists at `GOOGLE_CALENDAR_CREDENTIALS_PATH`
- Check that the Calendar API is enabled in Google Cloud Console
- Ensure the calendar is shared with the service account email
- Verify `GOOGLE_CALENDAR_ID` is correct
- Check logs for specific error messages

### TypeScript Compilation Errors
- Run `pnpm install` to ensure all dependencies are installed
- Check TypeScript version: `pnpm list typescript`
- Clear build cache: `rm -rf dist/` and rebuild

### Node.js Version Issues
- This project requires Node.js 24.x (as specified in package.json)
- Check your version: `node --version`
- Use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
