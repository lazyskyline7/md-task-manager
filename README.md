# 📋 Markdown Task Manager Bot

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-%5E5.0.0-blue)

A sophisticated **Telegram Bot** that bridges the gap between natural language task management and your personal knowledge base. It stores tasks in a simple, human-readable **Markdown table** on GitHub, ensuring you own your data while enjoying the convenience of AI-powered entry and Google Calendar synchronization.

---

## ✨ Key Features

- **🗣️ Natural Language Interface**: Chat with your bot naturally.
  - *"Book dentist appointment for next Tuesday at 2pm"* → Automatically parses date, time, and creates a task.
  - **Smart Extraction**: Resolves links, detects brand domains (e.g., `shopee.tw`), and generates helpful AI insights for each task.
  - Powered by **Google Gemini AI** for high-precision extraction.
- **☁️ Markdown-First Storage**: Tasks live in a `tasks.md` file in your GitHub repository.
  - **Sync-Ready**: Seamlessly integrates with **Obsidian**, **Logseq**, or any Git-backed note-taking tool.
  - **Vendor Lock-in Free**: Your data is just text.
- **📅 Smart Calendar Integration**:
  - Automatically creates **Google Calendar** events when you add tasks via Telegram.
  - Removes calendar events when tasks are deleted via the bot.
  - *Note: Sync is one-way (Bot → Calendar). Deleting an event in Google Calendar will not remove the task.*
- **🌍 Timezone Intelligence**:
  - Handles timezones correctly for users traveling or working across regions.
  - Support for creating tasks in relative terms (e.g., "tomorrow morning").
- **🔒 Secure & Private**:
  - Whitelist-based access control (only *you* can talk to your bot).
  - Runs on your own infrastructure (Vercel/Self-hosted).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v24+
- **pnpm** (recommended) or npm
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))
- **Google Cloud Console Project** (for Calendar & Gemini APIs)
- **GitHub Personal Access Token** (Repo scope)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/lazyskyline7/md-task-manager.git
cd md-task-manager
pnpm install
```

### 2. Configuration

Create your environment file:

```bash
cp .env.example .env
```

Populate `.env` with your credentials:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from [@BotFather](https://t.me/BotFather) |
| `BOT_SECRET` | ✅ | Secret token to verify webhook requests (recommended for security) |
| `TELEGRAM_BOT_WHITELIST` | ✅ | Comma-separated list of allowed Telegram user IDs |
| `GITHUB_TOKEN` | ✅ | GitHub Personal Access Token with `repo` scope |
| `GITHUB_PATH` | ✅ | Path to tasks file: `owner/repo/path/to/task-table.md` (file will be auto-created if it doesn't exist) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GOOGLE_CALENDAR_ID` | ✅ | Calendar email (usually your Gmail address) |
| `GOOGLE_CALENDAR_CREDENTIALS_PATH` | ✅ | Path to Service Account JSON key file |
| `CRON_SECRET` | ⚠️ | Secret token for cron endpoint (required for daily reminders) |
| `PORT` | ❌ | Server port (default: 3000) |

> **Note**: For Google Calendar, ensure you share your specific calendar with the Service Account email address and give it "Make changes to events" permissions.

### 3. Running Locally

Start the development server with hot-reload:

```bash
pnpm dev
```

### 4. Deployment (Vercel)

This project is optimized for Vercel serverless functions.

1.  Push your code to a private GitHub repository.
2.  Import the project into Vercel.
3.  Add all environment variables in the Vercel dashboard.
    *   *Tip: For the Service Account JSON, you might need to flatten it or handle the file path carefully in a serverless environment. Alternatively, commit an encrypted version.*

---

## 🤖 Command Reference

### Task Operations
| Command | Description |
| :--- | :--- |
| `/add <text>` | **AI-Powered Add**. Examples:<br>• `/add Call mom Sunday`<br>• `/add Review PR #42 at 10am for 30m #work` |
| `/complete <task>` | Mark a task as done. |
| `/edit <task>` | Interactively edit a task's details (time, tags, etc.). |
| `/remove <task>` | Delete a task (and its calendar event). |
| `/clearcompleted` | Archive or delete completed tasks to keep the list clean. |

### Views & Info
| Command | Description |
| :--- | :--- |
| `/today` | 📅 Show tasks scheduled for **today**. |
| `/list` | 📋 List all pending/incomplete tasks. |
| `/listall` | List *all* tasks, including completed ones. |

### Settings
| Command | Description |
| :--- | :--- |
| `/settimezone` | Set your active timezone (critical for accurate "tomorrow" logic). |
| `/mytimezone` | Check your current timezone. |
| `/listtimezones` | View common timezone strings. |

---

## ⚙️ Architecture & Integrations

### The `tasks.md` Format
The bot maintains a standard Markdown table with the following columns. You can safely add columns to the end, but avoid reordering the core fields.

| Completed | Task | Date | Time | Duration | Priority | Tags | Description | Link | CalendarEventId |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [ ] | Buy Milk | 2024-01-01 | 18:00 | 0:30 | | #personal | Pick up organic | | abc12345... |

### Daily Reminders (Cron)
The bot includes a webhook endpoint for daily summaries.

- **URL**: `GET /api/cron`
- **Auth**: `Authorization: Bearer <CRON_SECRET>`
- **Behavior**: Checks for tasks due today and sends a summary message to the **first user** in the whitelist.

You can trigger this via **GitHub Actions** or **Vercel Cron Jobs**.

---

## 🛠️ Development

- **Linting**: `pnpm lint`
- **Formatting**: `pnpm format`
- **Build**: `pnpm build`

## 📄 License

This project is licensed under the **ISC License**.
