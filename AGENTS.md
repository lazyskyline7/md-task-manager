# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-18
**Commit:** a14f1ee
**Branch:** main

## OVERVIEW

Telegram bot managing tasks via GitHub Markdown file. Uses Gemini AI for NLP parsing, Google Calendar sync. Deployed on Vercel serverless.

## STRUCTURE

```
md-task-manager/
├── api/index.ts        # Vercel entry point (thin proxy to src/app.ts)
├── src/
│   ├── app.ts          # Express + Telegraf bot setup, webhook routes
│   ├── config.ts       # Commands enum, Gemini schema, table columns
│   ├── types.ts        # Task, Metadata, Priority interfaces
│   ├── logger.ts       # Custom Logger class (replaces console.*)
│   ├── utils.ts        # Task parsing, date/time utilities
│   ├── validators.ts   # Markdown parsing, task validation
│   ├── bot-message.ts  # Telegram message templates
│   ├── error.ts        # Custom error classes
│   ├── commands/       # Bot command handlers (1 file per command)
│   ├── services/       # External integrations (GitHub, Gemini, Calendar)
│   └── middlewares/    # Auth, error handling
├── vercel.json         # Serverless config + cron schedule
└── example-task-table.md  # Markdown "database" schema template
```

## WHERE TO LOOK

| Task                  | Location                          | Notes                                                  |
| --------------------- | --------------------------------- | ------------------------------------------------------ |
| Add bot command       | `src/commands/`                   | Create file, register in `src/app.ts`                  |
| Modify AI extraction  | `src/config.ts`                   | `GEMINI_JSON_SCHEMA`, `getGeminiSystemPrompt()`        |
| Change task structure | `src/types.ts`                    | Update `Task` interface                                |
| GitHub read/write     | `src/services/github-client.ts`   | Singleton Octokit                                      |
| Calendar sync         | `src/services/google-calendar.ts` | Service account auth                                   |
| Parse Markdown table  | `src/services/queryTasks.ts`      | YAML frontmatter + table parsing                       |
| Serialize tasks       | `src/services/saveTasks.ts`       | Task-to-Markdown conversion                            |
| Webhook endpoint      | `src/app.ts`                      | `/api` route via `bot.webhookCallback()`               |
| Cron job              | `src/app.ts:191`                  | `/api/cron` endpoint, secured via `cronAuthMiddleware` |
| User whitelist        | `src/app.ts:94`                   | Bot middleware checks `TELEGRAM_BOT_WHITELIST`         |

## ARCHITECTURE DEVIATIONS

### GitHub as Database

- **No traditional DB**. Tasks stored in Markdown file on GitHub repo.
- CRUD via `@octokit/rest` (fetch → parse → modify → commit).
- Conflict handling: 3 retries with exponential backoff on 409.

### Vercel Proxy Pattern

- `api/index.ts` imports and re-exports `src/app.ts` for Vercel FaaS.
- ESM import uses `.js` extension: `import app from '../src/app.js'`

### Local Dev Network Workarounds

- `src/app.ts:56-66`: Forces IPv4 DNS + HTTPS agent locally (Telegram API IPv6 issues).
- Only applies when `NODE_ENV !== 'production'`.

## CONVENTIONS

### TypeScript

- **Strict mode** enabled, `NodeNext` module resolution.
- ESM imports require `.js` extension (even for `.ts` files).
- No `@ts-ignore` or `@ts-expect-error` allowed (codebase has zero).
- Single explicit `any` usage in `github-client.ts` for Octokit error handling.

### Formatting

- **Prettier**: single quotes, trailing commas, 80 char width, semicolons.
- **ESLint**: recommended TS rules, Prettier integration.

### Logging

- **Never use `console.*` directly**. Use `logger` from `src/logger.ts`.
- Context methods: `logger.infoWithContext({ userId, op, message })`.
- Log levels: `LOG_LEVEL` env var (debug/info/warn/error).

### Bot Commands

- Each command = separate file in `src/commands/`.
- Pattern: `export const xyzCommand = async (ctx: Context) => {...}`.
- Register in `src/app.ts`: `bot.command(Command.XYZ, xyzCommand)`.
- Commands enum in `src/config.ts`.

### Error Handling

- Commands wrap logic in try/catch, reply with user-friendly `ctx.reply('...')`.
- Log errors via `logger.errorWithContext({ userId, op, error })`.

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** use `console.log/warn/error` - use Logger class.
- **DO NOT** include tags in AI-generated descriptions (enforced in Gemini prompt).
- **DO NOT** add recurring tasks - AI returns error state for "every", "daily", etc.
- **DO NOT** suppress TypeScript errors with `as any` or `@ts-ignore`.

## AI INTEGRATION

### Gemini Task Extraction

- Model: `gemini-2.0-flash` (configurable via `AI_MODEL` env).
- Schema: `src/config.ts:GEMINI_JSON_SCHEMA`.
- System prompt: `getGeminiSystemPrompt(timezone)` - includes current date context.
- Returns structured JSON: name, date, time, duration, description, link.

### Strict Rules in Prompt

- Recurring tasks blocked (returns error JSON).
- Duration defaults to "1:00" if date+time exist.
- Links resolved to official domains (regional bias: `.tw`).

## COMMANDS

```bash
# Development
pnpm dev          # tsx watch api/index.ts (hot reload)

# Production
pnpm build        # tsc → dist/
pnpm start        # node dist/api/index.js

# Quality
pnpm lint         # eslint src/**/*.ts
pnpm lint:fix     # eslint --fix
pnpm format       # prettier --write
```

## ENVIRONMENT

| Variable                 | Required | Description               |
| ------------------------ | -------- | ------------------------- |
| `TELEGRAM_BOT_TOKEN`     | Yes      | Bot token from @BotFather |
| `TELEGRAM_BOT_WHITELIST` | Yes      | Comma-separated user IDs  |
| `GITHUB_TOKEN`           | Yes      | PAT with `repo` scope     |
| `GITHUB_PATH`            | Yes      | Full blob URL to tasks.md |
| `GEMINI_API_KEY`         | Yes      | Google AI Studio key      |
| `CRON_SECRET`            | Yes      | Vercel cron auth          |
| `BOT_SECRET`             | No       | Webhook secret token      |
| `GOOGLE_CALENDAR_ID`     | No       | Calendar sync             |
| `LOG_LEVEL`              | No       | debug/info/warn/error     |

## NOTES

- **Node 24.x required** (aggressive target in `engines`).
- **No tests** - project relies on manual verification via `pnpm dev`.
- **Vercel Cron**: `0 2 * * 1-5` (2 AM UTC, Mon-Fri) → `/api/cron`.
- **Task name uniqueness**: Auto-increments suffix `(1)`, `(2)` on conflicts.
- **Time conflict detection**: Prevents overlapping scheduled tasks.
- **License**: BUSL-1.1 (Business Source License).
