import { Task } from './types';
import { escapeMarkdownV2 } from './utils';

// Table column configuration - type-safe with Task interface
export const TABLE_COLUMNS: ReadonlyArray<{
  key: keyof Task;
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

interface Command {
  name: string;
  desc: string;
  type: 'calendar-operation' | 'task-operation' | 'info' | 'config';
}
export const COMMANDS: Record<string, Command> = {
  Add: {
    name: 'add',
    desc: 'add a new task',
    type: 'calendar-operation',
  },
  Remove: {
    name: 'remove',
    desc: 'remove a task by task name',
    type: 'calendar-operation',
  },
  List: { name: 'list', desc: 'list all incomplete tasks', type: 'info' },
  Complete: {
    name: 'complete',
    desc: 'mark a task as complete by task name',
    type: 'task-operation',
  },
  ListAll: {
    name: 'listall',
    desc: 'list all tasks including completed ones',
    type: 'info',
  },
  ClearCompleted: {
    name: 'clearcompleted',
    desc: 'clear all completed tasks',
    type: 'task-operation',
  },
  ListTimezones: {
    name: 'listtimezones',
    desc: 'list available timezones',
    type: 'config',
  },
  SetTimezone: {
    name: 'settimezone',
    desc: 'set your timezone',
    type: 'config',
  },
} as const;

// Group commands by type in single iteration for better performance
const commandsByType = Object.values(COMMANDS).reduce(
  (acc, cmd) => {
    const formatted = `/${cmd.name} \\- ${cmd.desc}`;
    if (!acc[cmd.type]) acc[cmd.type] = [];
    acc[cmd.type].push(formatted);
    return acc;
  },
  {} as Record<string, string[]>,
);

const calendarOps = commandsByType['calendar-operation']?.join('\n') || '';
const taskOps = commandsByType['task-operation']?.join('\n') || '';
const infoOps = commandsByType['info']?.join('\n') || '';
const configOps = commandsByType['config']?.join('\n') || '';

export const START_WORDING = `*Welcome to Md Task Manager\\!* 📎

Use any command below to manage your tasks

*Calendar Operations*
> These operations sync with Google Calendar if configured:
${calendarOps}

*Task Operations*
${taskOps}

*Information*
${infoOps}

*Configuration*
${configOps}

To get started, set your timezone using /settimezone command, the supported timezones are listed via /listtimezones
`;

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

const TIME_ZONE_LIST = COMMON_TIMEZONES.map(
  (tz, index) =>
    `${index + 1}\\. ${escapeMarkdownV2(tz.name)} \\- \`${tz.value}\``,
).join('\n');

export const TIME_ZONE_LIST_MESSAGE = `
*Available Timezones:*

${TIME_ZONE_LIST}

To set your timezone, use:
/settimezone \\<timezone\\>

Example: \`/settimezone Asia/Singapore\``;
