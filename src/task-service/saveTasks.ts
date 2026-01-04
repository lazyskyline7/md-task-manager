import { Task, TaskMetadata } from '../types';
import { saveFileContent } from '../github-client';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from '../constants';

const serializeMdTasks = (tasks: Task[], metadata: TaskMetadata): string => {
  const lines: string[] = [];

  // Add frontmatter
  lines.push('---');
  if (metadata.last_synced) {
    lines.push(`last_synced: ${metadata.last_synced}`);
  }
  lines.push(`total_tasks: ${tasks.length}`);
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
    '| Completed | Task              | Date       | Time  | Duration | Priority | Tags           | Description                        | Link                               |',
  );
  lines.push(
    '| :-------- | :---------------- | :--------- | :---- | :------- | :------- | :------------- | :--------------------------------- | :--------------------------------- |',
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
    ];

    lines.push(`| ${row.join(' | ')} |`);
  });

  return lines.join('\n');
};

export const saveTasks = async (
  tasks: Task[],
  metadata: TaskMetadata,
): Promise<void> => {
  // Update last_synced timestamp
  const now = new Date();
  metadata.last_synced = now.toISOString();

  // Serialize tasks to markdown
  const content = serializeMdTasks(tasks, metadata);

  // Save to GitHub with localized commit message
  const commitMessage = `Update tasks - ${formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`;
  await saveFileContent(content, commitMessage);
};
