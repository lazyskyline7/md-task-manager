import { EditableField, Field } from './types.js';
import { format } from 'date-fns-tz';

// Table column configuration - type-safe with Task interface
export const TABLE_COLUMNS: ReadonlyArray<{
  key: Field;
  header: string;
}> = [
  { key: 'completed', header: 'Completed' },
  { key: 'name', header: 'Task' },
  { key: 'date', header: 'Date' },
  { key: 'time', header: 'Time' },
  { key: 'duration', header: 'Duration' },
  { key: 'priority', header: 'Priority' },
  { key: 'tags', header: 'Tags' },
  { key: 'description', header: 'Description' },
  { key: 'link', header: 'Link' },
  { key: 'calendarEventId', header: 'CalendarEventId' },
] as const;

export enum Command {
  SETTIMEZONE = 'settimezone',
  MYTIMEZONE = 'mytimezone',
  TODAY = 'today',
  LIST = 'list',
  ADD = 'add',
  COMPLETE = 'complete',
  EDIT = 'edit',
  REMOVE = 'remove',
  LISTALL = 'listall',
  CLEARCOMPLETED = 'clearcompleted',
  LISTTIMEZONES = 'listtimezones',
}
type CommandCategory =
  | 'calendar-operation'
  | 'task-operation'
  | 'info'
  | 'config';
interface CommandType {
  desc: string;
  category: CommandCategory;
}
export const COMMANDS: Record<Command, CommandType> = {
  [Command.SETTIMEZONE]: {
    desc: 'set your timezone',
    category: 'config',
  },
  [Command.MYTIMEZONE]: {
    desc: 'show your current timezone',
    category: 'config',
  },
  [Command.TODAY]: {
    desc: "show today's tasks",
    category: 'info',
  },
  [Command.LIST]: {
    desc: 'list all incomplete tasks',
    category: 'info',
  },
  [Command.ADD]: {
    desc: 'add a new task',
    category: 'calendar-operation',
  },
  [Command.COMPLETE]: {
    desc: 'mark a task as complete by task name',
    category: 'task-operation',
  },
  [Command.EDIT]: {
    desc: 'edit a task by task name',
    category: 'task-operation',
  },
  [Command.REMOVE]: {
    desc: 'remove a task by task name',
    category: 'calendar-operation',
  },
  [Command.LISTALL]: {
    desc: 'list all tasks including completed ones',
    category: 'info',
  },
  [Command.CLEARCOMPLETED]: {
    desc: 'clear all completed tasks',
    category: 'task-operation',
  },
  [Command.LISTTIMEZONES]: {
    desc: 'list available timezones',
    category: 'config',
  },
} as const;

// Common timezones for quick selection
export const COMMON_TIMEZONES = [
  { name: '(UTC+0) London, Lisbon', value: 'Europe/London' },
  { name: '(UTC+1) Paris, Berlin, Lagos', value: 'Europe/Paris' },
  { name: '(UTC+2) Cairo, Athens', value: 'Europe/Athens' },
  { name: '(UTC+3) Moscow, Riyadh', value: 'Europe/Moscow' },
  { name: '(UTC+4) Dubai', value: 'Asia/Dubai' },
  { name: '(UTC+5:30) Mumbai, Delhi', value: 'Asia/Kolkata' },
  { name: '(UTC+7) Bangkok, Jakarta', value: 'Asia/Bangkok' },
  {
    name: '(UTC+8) Beijing, Singapore, Hong Kong, Taipei',
    value: 'Asia/Singapore',
  },
  { name: '(UTC+9) Tokyo, Seoul', value: 'Asia/Tokyo' },
  { name: '(UTC+10) Sydney', value: 'Australia/Sydney' },
  { name: '(UTC-8) Los Angeles', value: 'America/Los_Angeles' },
  { name: '(UTC-7) Denver', value: 'America/Denver' },
  { name: '(UTC-6) Chicago, Mexico City', value: 'America/Chicago' },
  { name: '(UTC-5) New York, Toronto', value: 'America/New_York' },
  { name: '(UTC-3) São Paulo, Buenos Aires', value: 'America/Sao_Paulo' },
] as const;

export const GEMINI_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Concise title of the task.' },
    date: {
      type: 'STRING',
      description: 'YYYY-MM-DD format based on timezone. Use "" if missing.',
    },
    time: {
      type: 'STRING',
      description: '24h HH:MM format. Use "" if missing.',
    },
    duration: {
      type: 'STRING',
      description:
        'H:MM format. Default to "1:00" if date/time exist but duration is missing.',
    },
    description: {
      type: 'STRING',
      description: 'AI-generated insight/note. DO NOT include tags here.',
    },
    link: {
      type: 'STRING',
      description:
        'Official resolved URL for brands (e.g., shopee.tw) or the raw URL.',
    },
  },
  required: ['name', 'date', 'time', 'duration', 'description', 'link'],
} as const;

export const getGeminiSystemPrompt = (timezone: string) => {
  const now = new Date();
  const todayInTz = format(now, 'yyyy-MM-dd', { timeZone: timezone });
  const dayOfWeekInTz = format(now, 'EEEE', { timeZone: timezone });

  return `
You are a high-precision Task Extraction Engine.

### CONTEXT
- Current Date: ${todayInTz}
- Current Day: ${dayOfWeekInTz}
- User Timezone: ${timezone}

### RECURRING TASK BLOCKER
If the input implies a recurring event (e.g., "every Monday", "daily", "each weekend", "everyday"), return this JSON error state:
{ "name": "", "date": "", "time": "", "duration": "", "description": "ERROR: Recurring tasks are not supported.", "link": "" }

### LOGIC & EXTRACTION RULES
1. **Date**: Convert relative terms (tomorrow, next Friday) to YYYY-MM-DD based on the ${todayInTz} context. If no date is found, return "".
2. **Time**: Convert to 24h HH:MM. If no time is found, return "".
3. **Duration (H:MM)**:
   - If Date + Time exist but no duration: Default to "1:00".
   - If Date is missing: Return "".
4. **Link Resolution**:
   - If a URL is in the text, use it. 
   - If a brand is mentioned, resolve to its official domain.
   - Regional Bias: Use .tw domains for regional brands (e.g., Shopee -> https://shopee.tw) unless timezone suggests otherwise.
5. **AI Description Insight**: 
   - Generate a brief (max 15 words) helpful insight, background, or instruction.
   - **STRICT RULE**: Do NOT include the user's tags in the description.

### OUTPUT
- Return ONLY valid JSON matching the schema.
`;
};

// Editable fields for tasks
export const EDITABLE_FIELDS: EditableField[] = [
  'name',
  'date',
  'time',
  'duration',
  'priority',
  'tags',
  'description',
  'link',
] as const;
