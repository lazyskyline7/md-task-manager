import { Task } from './types';

export const TIMEZONE = process.env.TIMEZONE || 'UTC';

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

export const START_WORDING = `*Welcome to Md Task Manager\\!* 📎

*Calendar Operations*
> These operations sync with Google Calendar if configured:
${calendarOps}

*Task Operations*
${taskOps}

*Information*
${infoOps}

Use any command above to manage your tasks\\!`;
