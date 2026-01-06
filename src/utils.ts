import { addMinutes } from 'date-fns';
import { Task } from './types';

// Extract argument from command text
export const extractArg = (text: string, name: string) =>
  text.substring(name.length + 1).trim();

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

const parseDurationInMinutes = (durationStr: string): number => {
  const [hours, minutes] = durationStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
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
