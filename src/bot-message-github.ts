import { Task, TaskDiff, CommitInfo, TaskChange } from './types.js';
import { escapeMarkdownV2, formatTimeRange } from './utils.js';

const TELEGRAM_MESSAGE_LIMIT = 4096;
const TRUNCATION_SUFFIX = '\n\n\\.\\.\\. _\\(message truncated\\)_';

const formatTaskName = (task: Task): string => {
  const name = escapeMarkdownV2(task.name);
  const date = task.date ? ` \\(${escapeMarkdownV2(task.date)}\\)` : '';
  const time =
    task.time && task.duration
      ? ` \\[${escapeMarkdownV2(formatTimeRange(task.time, task.duration))}\\]`
      : '';
  return `${name}${date}${time}`;
};

const formatTaskList = (tasks: Task[], prefix: string): string => {
  if (tasks.length === 0) return '';

  const lines = tasks.map((task) => `  • ${formatTaskName(task)}`);
  return `${prefix}\n${lines.join('\n')}`;
};

const formatModifiedTasks = (
  modified: TaskChange[],
  prefix: string,
): string => {
  if (modified.length === 0) return '';

  const lines = modified.map((change: TaskChange) => {
    const name = escapeMarkdownV2(change.after.name);
    const changesStr = change.changes
      .map((c: string) => `    \\- ${escapeMarkdownV2(c)}`)
      .join('\n');
    return `  • *${name}*\n${changesStr}`;
  });

  return `${prefix}\n${lines.join('\n')}`;
};

const formatMetadataChanges = (
  metadataDiff: TaskDiff['metadata'],
  prefix: string,
): string => {
  if (!metadataDiff || metadataDiff.changes.length === 0) return '';

  const lines = metadataDiff.changes.map((change) => `  • ${escapeMarkdownV2(change)}`);
  return `${prefix}\n${lines.join('\n')}`;
};

const truncateMessage = (message: string): string => {
  if (message.length <= TELEGRAM_MESSAGE_LIMIT) {
    return message;
  }

  const maxContentLength = TELEGRAM_MESSAGE_LIMIT - TRUNCATION_SUFFIX.length;
  const truncated = message.substring(0, maxContentLength);
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastNewline > maxContentLength * 0.8) {
    return truncated.substring(0, lastNewline) + TRUNCATION_SUFFIX;
  }

  return truncated + TRUNCATION_SUFFIX;
};

export const formatGitHubSyncMessage = (
  diff: TaskDiff,
  commit: CommitInfo,
): string => {
  const escapedAuthor = escapeMarkdownV2(commit.author);
  const escapedMessage = escapeMarkdownV2(commit.message.split('\n')[0]);
  const shortSha = commit.sha.substring(0, 7);
  const escapedUrl = commit.url.replace(/([)\\])/g, '\\$1');

  const sections: string[] = [];

  sections.push(`📝 *Tasks Updated on GitHub*`);
  sections.push('');
  sections.push(`👤 *Author:* ${escapedAuthor}`);
  sections.push(`💬 *Commit:* ${escapedMessage}`);
  sections.push(`🔗 [View Commit \\(${shortSha}\\)](${escapedUrl})`);

  const metadataSection = formatMetadataChanges(
    diff.metadata,
    `\n⚙️ *Metadata Updated*`,
  );
  if (metadataSection) sections.push(metadataSection);

  const completedSection = formatTaskList(
    diff.completed,
    `\n✅ *Completed* \\(${diff.completed.length}\\)`,
  );
  if (completedSection) sections.push(completedSection);

  const uncompletedSection = formatTaskList(
    diff.uncompleted,
    `\n🔄 *Reopened* \\(${diff.uncompleted.length}\\)`,
  );
  if (uncompletedSection) sections.push(uncompletedSection);

  const addedSection = formatTaskList(
    diff.added,
    `\n➕ *Added* \\(${diff.added.length}\\)`,
  );
  if (addedSection) sections.push(addedSection);

  const modifiedSection = formatModifiedTasks(
    diff.modified,
    `\n✏️ *Modified* \\(${diff.modified.length}\\)`,
  );
  if (modifiedSection) sections.push(modifiedSection);

  const removedSection = formatTaskList(
    diff.removed,
    `\n➖ *Removed* \\(${diff.removed.length}\\)`,
  );
  if (removedSection) sections.push(removedSection);

  const message = sections.join('\n');
  return truncateMessage(message);
};
