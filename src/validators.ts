import { Priority, Task } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DURATION_REGEX = /^\d+:[0-5]\d$/;

export const validateTask = (task: Task): ValidationResult => {
  const errors: string[] = [];

  if (!validators.name(task.name)) {
    errors.push('Task name cannot be empty');
  }

  if (task.date && !validators.date(task.date)) {
    errors.push(`Invalid date format: "${task.date}". Expected YYYY-MM-DD`);
  }

  if (task.time && !validators.time(task.time)) {
    errors.push(`Invalid time format: "${task.time}". Expected HH:MM`);
  }

  if (task.duration && !validators.duration(task.duration)) {
    errors.push(`Invalid duration format: "${task.duration}". Expected HH:MM`);
  }

  if (task.tags && !validators.tags(task.tags)) {
    errors.push('Tags must be an array of strings');
  }

  if (task.priority && !validators.priority(task.priority)) {
    errors.push(`Invalid priority: "${task.priority}"`);
  }

  if (task.link && !validators.link(task.link)) {
    errors.push(`Invalid link format: "${task.link}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidPriority = (value: string): value is Priority => {
  return Object.values(Priority).includes(value as Priority);
};
// Field validators
export const validators = {
  name: (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0,
  completed: (value: unknown): value is boolean => typeof value === 'boolean',
  date: (value: unknown): value is string =>
    typeof value === 'string' && DATE_REGEX.test(value),
  time: (value: unknown): value is string =>
    typeof value === 'string' && TIME_REGEX.test(value),
  duration: (value: unknown): value is string =>
    typeof value === 'string' && DURATION_REGEX.test(value),
  priority: (value: unknown): value is Priority =>
    typeof value === 'string' && isValidPriority(value),
  tags: (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((tag) => typeof tag === 'string'),
  description: (value: unknown): value is string => typeof value === 'string',
  link: (value: unknown): value is string =>
    typeof value === 'string' ? isValidUrl(value) : false,
  calendarEventId: (value: unknown): value is string =>
    typeof value === 'string',
} as const;
