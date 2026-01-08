import { Task, Metadata } from '../types';
import { saveFileContent } from '../github-client';
import { TABLE_COLUMNS } from '../config';
import { formatTags } from '../utils';
import { validateTask } from '../validators';
import { logger } from '../logger';

// Pre-compute table header and separator for better performance
export const TABLE_HEADER = `| ${TABLE_COLUMNS.map((col) => col.header).join(' | ')} |`;
export const TABLE_SEPARATOR = `| ${TABLE_COLUMNS.map(() => ':--------').join(' | ')} |`;

const serializeTaskMarkdown = (tasks: Task[], metadata: Metadata): string => {
  const lines: string[] = [];

  // Add frontmatter
  lines.push('---');
  if (metadata.last_synced) {
    lines.push(`last_synced: ${metadata.last_synced}`);
  }
  lines.push(`total_tasks: ${tasks.length}`);
  if (metadata.timezone) {
    lines.push(`timezone: ${metadata.timezone}`);
  }
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push('tags:');
    metadata.tags.forEach((tag) => lines.push(`  - ${tag}`));
  }
  lines.push('---');
  lines.push('');

  // Add table header (use parsed header or default)
  lines.push(metadata.table_header || '# Task Table');
  lines.push('');
  lines.push(TABLE_HEADER);
  lines.push(TABLE_SEPARATOR);

  // Add task rows
  tasks.forEach((task) => {
    const checkbox = task.completed ? '[x]' : '[ ]';
    const tags = formatTags(task.tags);

    const row = [
      checkbox,
      task.name || '',
      task.date || '',
      task.time || '',
      task.duration || '',
      task.priority || '',
      tags,
      task.description || '',
      task.link || '',
      task.calendarEventId || '',
    ];

    lines.push(`| ${row.join(' | ')} |`);
  });

  return lines.join('\n');
};

export const saveTasks = async (
  tasks: Task[],
  metadata: Metadata,
): Promise<boolean> => {
  // Validate all tasks before saving
  const invalidTasks = tasks
    .map((task, index) => ({ index, result: validateTask(task) }))
    .filter(({ result }) => !result.valid);

  if (invalidTasks.length > 0) {
    invalidTasks.forEach(({ index, result }) => {
      logger.error(
        `Task at index ${index} is invalid: ${result.errors.join(', ')}`,
      );
    });
    throw new Error(
      `Cannot save tasks: ${invalidTasks.length} tasks are invalid. Check logs for details.`,
    );
  }

  // Ensure timezone is set
  if (!metadata.timezone) {
    throw new Error('User timezone is not set in metadata.');
  }

  // Update metadata tags from tasks
  const allTags = new Set<string>(metadata.tags || []);
  tasks.forEach((task) => {
    if (task.tags) {
      task.tags.forEach((tag) => allTags.add(tag));
    }
  });
  metadata.tags = Array.from(allTags).sort();

  // Update last_synced timestamp
  const now = new Date();
  metadata.last_synced = now.toISOString();
  // Serialize tasks to markdown
  const content = serializeTaskMarkdown(tasks, metadata);

  // Save to GitHub
  const commitMessage = `Update tasks - ${now.toISOString()}`;
  const success = await saveFileContent(content, commitMessage);
  return success;
};
