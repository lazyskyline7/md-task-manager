import { Task } from './types';

// Extract argument from command text
export const extractArg = (text: string, command: string) =>
  text.substring(command.length + 1).trim();
/**
 * Parse tags from text input to array
 * - Only handles tags with '#' prefix
 * - Splits by '#' symbol and extracts all segments
 * - Removes duplicates and empty values
 * - Converts to lowercase for consistency
 *
 * ⚠️ Note: This treats text before first '#' as a tag too.
 * For extracting tags from mixed text, use specific extraction in context.
 *
 * Examples:
 *   - "#tag1 #tag2" → ["tag1", "tag2"]
 *   - "#fork#knife" → ["fork", "knife"]
 *   - "hi #1#2" → ["hi", "1", "2"] (includes "hi")
 */
export const parseTags = (input: string): string[] => {
  if (!input || input.trim() === '') return [];

  return Array.from(
    new Set(
      input
        .split('#')
        .map((tag) => tag.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter((tag) => tag.length > 0),
    ),
  );
};
export const formatTags = (tags: string[]): string =>
  tags.map((tag) => `#${escapeMarkdownV2(tag)}`).join(' ');

/**
 * Escapes special characters for Telegram MarkdownV2 format
 * Reference: https://core.telegram.org/bots/api#markdownv2-style
 */
const SPECIAL_CHARS = /([_*[\]()~`>#+\-=|{}.!\\])/g;
export const escapeMarkdownV2 = (text: string): string =>
  text.replace(SPECIAL_CHARS, '\\$1');

const parseDateTime = (dateStr: string, timeStr: string): Date => {
  return new Date(`${dateStr}T${timeStr}`);
};

export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

export const parseDurationInMinutes = (durationStr: string): number => {
  const [hours, minutes] = durationStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const formatTimeRange = (
  timeStr: string,
  durationStr: string,
): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = (hours || 0) * 60 + (minutes || 0);
  const durationMinutes = parseDurationInMinutes(durationStr);
  const endTotalMinutes = totalMinutes + durationMinutes;

  const endHours = Math.floor(endTotalMinutes / 60) % 24;
  const endMinutes = endTotalMinutes % 60;

  return `${timeStr} - ${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
};

export const formatTaskList = (tasks: Task[], showStatus = false): string => {
  return tasks
    .map((task, index) => {
      const escapedName = escapeMarkdownV2(task.name);
      const status = showStatus ? (task.completed ? '✅ ' : '⚪ ') : '';
      const calendarIcon = task.calendarEventId ? '🗓️ ' : '';
      const date = task.date ? ` \\(${escapeMarkdownV2(task.date)}\\)` : '';
      const timeRange =
        task.date && task.time && task.duration
          ? ` \\[${escapeMarkdownV2(formatTimeRange(task.time, task.duration))}\\]`
          : '';
      const tags =
        task.tags && task.tags.length > 0
          ? ` ${task.tags.map((t) => `\\#${escapeMarkdownV2(t)}`).join(' ')}`
          : '';

      let line = `${index + 1}\\. ${status}${calendarIcon}*${escapedName}*${date}${timeRange}${tags}`;

      if (task.description) {
        line += `\n> _${escapeMarkdownV2(task.description)}_`;
      }

      if (task.link) {
        const escapedUrl = task.link.replace(/([)\\])/g, '\\$1');
        line += `\n> 🔗 [Visit](${escapedUrl})`;
      }

      return line;
    })
    .join('\n\n');
};

// Time conflict checking
export const findConflictingTask = (
  newTask: Task,
  tasks: Task[],
): Task | undefined => {
  if (!newTask.date || !newTask.time || !newTask.duration) {
    return undefined;
  }
  const newTaskStart = parseDateTime(newTask.date, newTask.time);
  const newTaskDuration = parseDurationInMinutes(newTask.duration);
  const newTaskEnd = addMinutes(newTaskStart, newTaskDuration);

  return tasks.find((t) => {
    // Check if task has necessary time info
    if (!t.date || !t.time || !t.duration) return false;

    // Check if it's the same day
    if (t.date !== newTask.date) return false;

    const tStart = parseDateTime(t.date, t.time);
    const tDuration = parseDurationInMinutes(t.duration);
    const tEnd = addMinutes(tStart, tDuration);

    // Check for overlap: (StartA < EndB) && (EndA > StartB)
    return newTaskStart < tEnd && newTaskEnd > tStart;
  });
};

// Extract tags from user text while preserving main text
export const parseUserText = (
  text: string,
): { tags: string[]; text: string } => {
  // Extract tags only from #-prefixed words
  const tagMatches = text.match(/#\w+/g) || [];
  const extractedTags = tagMatches.map((tag) => tag.slice(1).toLowerCase());

  // Remove only the #tags, keep everything else
  const cleanedText = text
    .replace(/#\w+/g, '') // Remove all #word patterns
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();

  return { tags: Array.from(new Set(extractedTags)), text: cleanedText };
};
