import { Command, COMMANDS, COMMON_TIMEZONES } from './config.js';
import { escapeMarkdownV2, formatTaskListStr } from './utils.js';
import { format } from 'date-fns-tz';
import { Task } from './types.js';

export const getNoTextMessage = (command: Command): string =>
  `Please provide a task ${command === Command.ADD ? 'description' : 'name'} to ${command}`;

export const getNoTaskNameMessage = (command: Command): string =>
  `❌ Please provide a task ${command === Command.ADD ? 'description' : 'name'} (e.g., /${command} My Task${command === Command.ADD ? ' tomorrow at 15:00 for 2h' : ''})`;

export const TASK_NOT_FOUND_MESSAGE = '❌ Task not found!';

export const NO_TASK_MESSAGE = 'No tasks yet!';

export const getTodaysTasksMessage = (
  tasks: Task[],
  timezone: string,
  icon: string = '📅',
  title: string = "Today's Agenda",
): string => {
  const tasksStr = formatTaskListStr(tasks);
  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMM d', { timeZone: timezone });

  return `${icon} *${title}*\n${escapeMarkdownV2(formattedDate)} • ${tasks.length} task${tasks.length > 1 ? 's' : ''}\n━━━━━━━━━━━━━━━\n\n${tasksStr}`;
};

const commandsByCategory = Object.values(Command).reduce(
  (acc, cmd) => {
    const formatted = `/${cmd} \\- ${COMMANDS[cmd].desc}`;
    if (!acc[COMMANDS[cmd].category]) acc[COMMANDS[cmd].category] = [];
    acc[COMMANDS[cmd].category].push(formatted);
    return acc;
  },
  {} as Record<string, string[]>,
);
const calendarOps = commandsByCategory['calendar-operation']?.join('\n') || '';
const taskOps = commandsByCategory['task-operation']?.join('\n') || '';
const infoOps = commandsByCategory['info']?.join('\n') || '';
const configOps = commandsByCategory['config']?.join('\n') || '';

export const START_WORDING = `*Welcome to Md Task Manager\\!* 📎

*Configuration*
> Set up your timezone first:
${configOps}

*Calendar Operations*
> These operations sync with Google Calendar if configured:
${calendarOps}

*Task Operations*
${taskOps}

*Information*
${infoOps}

*Getting Started:* Use /settimezone to configure your timezone before adding tasks\\. View available timezones with /listtimezones\\.
`;

const TIME_ZONE_LIST = COMMON_TIMEZONES.map(
  (tz, index) =>
    `${index + 1}\\. ${escapeMarkdownV2(tz.name)} \\- \`${tz.value}\``,
).join('\n');
export const TIME_ZONE_LIST_MESSAGE = `
*Available Timezones:*

${TIME_ZONE_LIST}

/settimezone to set your timezone

Example: \`/settimezone Asia/Singapore\``;
