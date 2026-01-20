import { Task, TaskDiff, TaskChange, Metadata } from '../types.js';
import { parseMarkdown } from './markdownParser.js';

const findTaskByName = (tasks: Task[], name: string): Task | undefined =>
  tasks.find((t) => t.name === name);

const getTaskChanges = (before: Task, after: Task): string[] => {
  const changes: string[] = [];
  const fieldsToCompare: (keyof Task)[] = [
    'date',
    'time',
    'duration',
    'priority',
    'description',
    'link',
  ];

  for (const field of fieldsToCompare) {
    const beforeVal = before[field];
    const afterVal = after[field];

    if (beforeVal !== afterVal) {
      const beforeStr = beforeVal ?? '(empty)';
      const afterStr = afterVal ?? '(empty)';
      changes.push(`${field}: ${beforeStr} → ${afterStr}`);
    }
  }

  const beforeTags = (before.tags || []).sort().join(', ');
  const afterTags = (after.tags || []).sort().join(', ');
  if (beforeTags !== afterTags) {
    changes.push(`tags: ${beforeTags || '(none)'} → ${afterTags || '(none)'}`);
  }

  return changes;
};

const getMetadataChanges = (before: Metadata, after: Metadata): string[] => {
  const changes: string[] = [];

  if (before.timezone !== after.timezone) {
    changes.push(
      `timezone: ${before.timezone ?? 'UTC'} → ${after.timezone ?? 'UTC'}`,
    );
  }

  const beforeTags = (before.tags || []).sort().join(', ');
  const afterTags = (after.tags || []).sort().join(', ');
  if (beforeTags !== afterTags) {
    changes.push(
      `allowed tags: ${beforeTags || '(none)'} → ${afterTags || '(none)'}`,
    );
  }

  return changes;
};

export const analyzeTaskDiff = (
  beforeContent: string,
  afterContent: string,
): TaskDiff => {
  const { tasks: beforeTasks, metadata: beforeMetadata } =
    parseMarkdown(beforeContent);
  const { tasks: afterTasks, metadata: afterMetadata } =
    parseMarkdown(afterContent);

  const diff: TaskDiff = {
    added: [],
    removed: [],
    modified: [],
    completed: [],
    uncompleted: [],
  };

  const metadataChanges = getMetadataChanges(beforeMetadata, afterMetadata);
  if (metadataChanges.length > 0) {
    diff.metadata = {
      before: beforeMetadata,
      after: afterMetadata,
      changes: metadataChanges,
    };
  }

  const beforeNames = new Set(beforeTasks.map((t) => t.name));
  const afterNames = new Set(afterTasks.map((t) => t.name));

  for (const task of afterTasks) {
    if (!beforeNames.has(task.name)) {
      diff.added.push(task);
    }
  }

  for (const task of beforeTasks) {
    if (!afterNames.has(task.name)) {
      diff.removed.push(task);
    }
  }

  for (const afterTask of afterTasks) {
    const beforeTask = findTaskByName(beforeTasks, afterTask.name);
    if (!beforeTask) continue;

    if (!beforeTask.completed && afterTask.completed) {
      diff.completed.push(afterTask);
    } else if (beforeTask.completed && !afterTask.completed) {
      diff.uncompleted.push(afterTask);
    }

    const changes = getTaskChanges(beforeTask, afterTask);
    if (changes.length > 0) {
      const taskChange: TaskChange = {
        before: beforeTask,
        after: afterTask,
        changes,
      };
      diff.modified.push(taskChange);
    }
  }

  return diff;
};

export const hasChanges = (diff: TaskDiff): boolean =>
  diff.added.length > 0 ||
  diff.removed.length > 0 ||
  diff.modified.length > 0 ||
  diff.completed.length > 0 ||
  diff.uncompleted.length > 0 ||
  (diff.metadata?.changes.length ?? 0) > 0;
