import { Task, TaskDiff, TaskChange, Priority, Metadata } from '../types.js';
import { parseTags } from '../utils.js';
import { TABLE_COLUMNS } from '../config.js';
import logger from '../logger.js';

const getColIdx = (key: keyof Task) =>
  TABLE_COLUMNS.findIndex((col) => col.key === key);

const COL_IDX = {
  COMPLETED: getColIdx('completed'),
  NAME: getColIdx('name'),
  DATE: getColIdx('date'),
  TIME: getColIdx('time'),
  DURATION: getColIdx('duration'),
  PRIORITY: getColIdx('priority'),
  TAGS: getColIdx('tags'),
  DESCRIPTION: getColIdx('description'),
  LINK: getColIdx('link'),
  CALENDAR_EVENT_ID: getColIdx('calendarEventId'),
};

const TABLE_SEPARATOR_PATTERN = /^\|[\s:-]+\|/;
const FRONTMATTER_KEY_VALUE_PATTERN = /^(\w+):\s*(.+)$/;
const FRONTMATTER_KEY_ONLY_PATTERN = /^\w+:$/;

const getCell = (cells: string[], index: number) =>
  cells[index] && cells[index].length > 0 ? cells[index] : undefined;

const parseContent = (
  content: string,
): { tasks: Task[]; metadata: Metadata } => {
  if (!content || content.trim().length === 0) {
    return { tasks: [], metadata: {} };
  }

  const lines = content.split('\n');
  const tasks: Task[] = [];
  const metadata: Metadata = {};
  let inFrontmatter = false;
  let inTable = false;
  let tableStartIndex = -1;
  let currentFrontmatterKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '---') {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) currentFrontmatterKey = null;
      continue;
    }

    if (inFrontmatter) {
      const match = line.match(FRONTMATTER_KEY_VALUE_PATTERN);
      if (match) {
        const [, key, value] = match;
        if (key === 'last_synced') {
          metadata.last_synced = value;
        } else if (key === 'total_tasks') {
          metadata.total_tasks = parseInt(value, 10);
        } else if (key === 'timezone') {
          metadata.timezone = value;
        } else if (key === 'tags') {
          currentFrontmatterKey = 'tags';
          metadata.tags = [];
        }
      } else if (line.startsWith('- ') && currentFrontmatterKey === 'tags') {
        const tag = line.substring(2).trim();
        if (tag && metadata.tags) metadata.tags.push(tag);
      } else if (line.match(FRONTMATTER_KEY_ONLY_PATTERN)) {
        const key = line.replace(':', '').trim();
        if (key === 'tags') {
          currentFrontmatterKey = 'tags';
          metadata.tags = [];
        }
      }
      continue;
    }

    if (
      line.startsWith('|') &&
      line.includes('Completed') &&
      line.includes('Task')
    ) {
      inTable = true;
      tableStartIndex = i;
      continue;
    }

    if (
      inTable &&
      tableStartIndex === i - 1 &&
      line.match(TABLE_SEPARATOR_PATTERN)
    ) {
      continue;
    }

    if (inTable && line.startsWith('|')) {
      try {
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());

        if (cells.length >= 2) {
          const completed =
            cells[COL_IDX.COMPLETED].includes('[x]') ||
            cells[COL_IDX.COMPLETED].includes('[X]');
          const taskName = cells[COL_IDX.NAME];

          if (!taskName || taskName.length === 0) continue;

          const task: Task = {
            completed,
            name: taskName,
            date: getCell(cells, COL_IDX.DATE),
            time: getCell(cells, COL_IDX.TIME),
            duration: getCell(cells, COL_IDX.DURATION),
            priority: getCell(cells, COL_IDX.PRIORITY) as Priority | undefined,
            tags: parseTags(getCell(cells, COL_IDX.TAGS)),
            description: getCell(cells, COL_IDX.DESCRIPTION),
            link: getCell(cells, COL_IDX.LINK),
            calendarEventId: getCell(cells, COL_IDX.CALENDAR_EVENT_ID),
          };

          tasks.push(task);
        }
      } catch (error) {
        logger.warnWithContext({
          op: 'DIFF_ANALYZER',
          message: `Error parsing row at line ${i + 1}`,
          error,
        });
        continue;
      }
    } else if (inTable && !line.startsWith('|')) {
      break;
    }
  }

  return { tasks, metadata };
};

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
    parseContent(beforeContent);
  const { tasks: afterTasks, metadata: afterMetadata } =
    parseContent(afterContent);

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
