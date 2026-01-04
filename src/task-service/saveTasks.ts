import { Task, Metadata } from '../types';
import { saveFileContent } from '../github-client';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from '../config';

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
  lines.push(
    '| Completed | Task              | Date       | Time  | Duration | Priority | Tags           | Description                        | Link                               | CalendarEventId                    |',
  );
  lines.push(
    '| :-------- | :---------------- | :--------- | :---- | :------- | :------- | :------------- | :--------------------------------- | :--------------------------------- | :--------------------------------- |',
  );

  // Add task rows
  tasks.forEach((task) => {
    const checkbox = task.completed ? '[x]' : '[ ]';
    const tags = task.tags ? task.tags.map((tag) => `#${tag}`).join(' ') : '';

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
): Promise<void> => {
  // Use stored timezone or fall back to default
  const userTimezone = metadata.timezone || TIMEZONE;
  // Update last_synced timestamp
  const now = new Date();
  metadata.last_synced = now.toISOString();
  metadata.timezone = userTimezone;
  // Serialize tasks to markdown
  const content = serializeTaskMarkdown(tasks, metadata);

  // Save to GitHub
  const commitMessage = `Update tasks - ${formatInTimeZone(now, userTimezone, 'yyyy-MM-dd HH:mm:ss')}`;
  await saveFileContent(content, commitMessage);
};
