import { Metadata, TaskData } from '../types.js';
import { saveFileContent } from './github-client.js';
import { TABLE_COLUMNS } from '../config.js';
import { formatTags, escapeMarkdownTable } from '../utils.js';
import { validateTask } from '../validators.js';
import logger from '../logger.js';

// Pre-compute table header and separator for better performance
export const TABLE_HEADER = `| ${TABLE_COLUMNS.map((col) => col.header).join(' | ')} |`;
export const TABLE_SEPARATOR = `| ${TABLE_COLUMNS.map(() => ':--------').join(' | ')} |`;

const serializeTaskMarkdown = (tasks: TaskData, metadata: Metadata): string => {
  const lines: string[] = [];

  // Add frontmatter
  lines.push('---');
  if (metadata.last_synced) {
    lines.push(`last_synced: ${metadata.last_synced}`);
  }
  lines.push(`total_tasks: ${tasks.uncompleted.length}`);
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
  tasks.uncompleted.concat(tasks.completed).forEach((task) => {
    const row = TABLE_COLUMNS.map((col) => {
      const value = task[col.key];

      if (col.key === 'completed') {
        return task.completed ? '[x]' : '[ ]';
      }

      if (col.key === 'tags') {
        return formatTags(task.tags);
      }

      return escapeMarkdownTable(value as string | undefined);
    });

    lines.push(`| ${row.join(' | ')} |`);
  });

  return lines.join('\n');
};

export const saveTasks = async (
  tasks: TaskData,
  metadata: Metadata,
): Promise<boolean> => {
  // Validate all tasks before saving
  const invalidTasks = tasks.uncompleted
    .map((task, index) => ({ index, result: validateTask(task) }))
    .filter(({ result }) => !result.valid);

  if (invalidTasks.length > 0) {
    invalidTasks.forEach(({ index, result }) => {
      logger.errorWithContext({
        message: `Task at index ${index} is invalid: ${result.errors.join(', ')}`,
      });
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
  const activeTags = new Set<string>([]);
  tasks.uncompleted.forEach((task) => {
    if (task.tags) {
      task.tags.forEach((tag) => activeTags.add(tag));
    }
  });
  metadata.tags = Array.from(activeTags).sort();

  // Update last_synced timestamp
  const now = new Date();
  metadata.last_synced = now.toISOString();
  // Serialize tasks to markdown
  const content = serializeTaskMarkdown(tasks, metadata);

  // Save to GitHub
  const commitMessage = `[bot] update - ${now.toISOString()}`;
  const success = await saveFileContent(content, commitMessage);
  return success;
};
