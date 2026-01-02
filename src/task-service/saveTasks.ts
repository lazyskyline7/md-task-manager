import { Task, TaskMetadata } from '../types';
import { saveFileContent } from '../github-client';

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
    '| Completed | Task              | Date       | Time  | Duration | Priority | Tags           | Description                        |',
  );
  lines.push(
    '| :-------- | :---------------- | :--------- | :---- | :------- | :------- | :------------- | :--------------------------------- |',
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
  metadata.last_synced = new Date().toISOString();

  // Serialize tasks to markdown
  const content = serializeMdTasks(tasks, metadata);

  // Save to GitHub
  const commitMessage = `Update tasks - ${new Date().toISOString()}`;
  await saveFileContent(content, commitMessage);
};
