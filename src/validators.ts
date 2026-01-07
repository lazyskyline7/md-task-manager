import { Task, isValidPriority } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DURATION_REGEX = /^\d+:[0-5]\d$/;

export const validateTask = (task: Task): ValidationResult => {
  const errors: string[] = [];

  if (!task.name || task.name.trim().length === 0) {
    errors.push('Task name cannot be empty');
  }

  if (task.date && !DATE_REGEX.test(task.date)) {
    errors.push(`Invalid date format: "${task.date}". Expected YYYY-MM-DD`);
  }

  if (task.time && !TIME_REGEX.test(task.time)) {
    errors.push(`Invalid time format: "${task.time}". Expected HH:MM`);
  }

  if (task.duration && !DURATION_REGEX.test(task.duration)) {
    errors.push(`Invalid duration format: "${task.duration}". Expected HH:MM`);
  }

  if (task.tags && !Array.isArray(task.tags)) {
    errors.push('Tags must be an array of strings');
  }

  if (task.priority && !isValidPriority(task.priority)) {
    errors.push(`Invalid priority: "${task.priority}"`);
  }

  if (task.link && !isValidUrl(task.link)) {
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
