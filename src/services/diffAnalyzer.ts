import { Task, TaskDiff, TaskChange, Priority } from '../types.js';
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

const getCell = (cells: string[], index: number) =>
  cells[index] && cells[index].length > 0 ? cells[index] : undefined;

const parseTasksFromContent = (content: string): Task[] => {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const lines = content.split('\n');
  const tasks: Task[] = [];
  let inFrontmatter = false;
  let inTable = false;
  let tableStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }

    if (inFrontmatter) continue;

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

  return tasks;
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

export const analyzeTaskDiff = (
  beforeContent: string,
  afterContent: string,
): TaskDiff => {
  const beforeTasks = parseTasksFromContent(beforeContent);
  const afterTasks = parseTasksFromContent(afterContent);

  const diff: TaskDiff = {
    added: [],
    removed: [],
    modified: [],
    completed: [],
    uncompleted: [],
  };

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
  diff.uncompleted.length > 0;
