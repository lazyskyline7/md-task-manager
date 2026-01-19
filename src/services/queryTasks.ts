import { Task, Metadata, Priority, TaskData } from '../types.js';
import logger from '../logger.js';
import { fetchFileContent, saveFileContent } from './github-client.js';
import { TABLE_COLUMNS, getInitialContent } from '../config.js';
import { parseTags } from '../utils.js';
import { validateTask } from '../validators.js';

interface MdTasksResult {
  metadata: Metadata;
  taskData: TaskData;
}

// Regex patterns for content parsing
const FRONTMATTER_KEY_VALUE_PATTERN = /^(\w+):\s*(.+)$/;
const FRONTMATTER_KEY_ONLY_PATTERN = /^\w+:$/;
const TABLE_SEPARATOR_PATTERN = /^\|[\s:-]+\|/;

// Map column indices dynamically
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

const deserializeTaskMarkdown = (content: string): MdTasksResult => {
  if (!content || content.trim().length === 0) {
    throw new Error('Content is empty');
  }

  const lines = content.split('\n');
  const metadata: Metadata = {};
  const tasks: Task[] = [];
  const completedTasks: Task[] = [];
  const uncompletedTasks: Task[] = [];

  let inFrontmatter = false;
  let inTable = false;
  let tableStartIndex = -1;
  let currentFrontmatterKey: string | null = null;
  let tableHeader: string | undefined;

  // Helper to get cell value or undefined if empty (defined once)
  const getCell = (cells: string[], index: number) =>
    cells[index] && cells[index].length > 0 ? cells[index] : undefined;

  try {
    // Parse frontmatter and find table
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Handle YAML frontmatter
      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          inFrontmatter = false;
          currentFrontmatterKey = null;
        }
        continue;
      }

      if (inFrontmatter) {
        // Handle single-line key-value pairs
        const match = line.match(FRONTMATTER_KEY_VALUE_PATTERN);
        if (match) {
          const [, key, value] = match;
          if (key === 'last_synced') {
            metadata.last_synced = value;
          } else if (key === 'total_tasks') {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
              metadata.total_tasks = parsed;
            }
          } else if (key === 'timezone') {
            metadata.timezone = value;
          } else if (key === 'tags') {
            currentFrontmatterKey = 'tags';
            metadata.tags = [];
          }
        } else if (line.startsWith('- ') && currentFrontmatterKey === 'tags') {
          // Handle array items
          const tag = line.substring(2).trim();
          if (tag && metadata.tags) {
            metadata.tags.push(tag);
          }
        } else if (line.match(FRONTMATTER_KEY_ONLY_PATTERN)) {
          // Handle key without value (for arrays)
          const key = line.replace(':', '').trim();
          if (key === 'tags') {
            currentFrontmatterKey = 'tags';
            metadata.tags = [];
          }
        }
        continue;
      }

      // Capture markdown header before table (e.g., # Task Tracker)
      if (!inTable && !inFrontmatter && !tableHeader && line.match(/^#+ /)) {
        tableHeader = line;
      }

      // Detect table start (header row with pipes)
      if (
        line.startsWith('|') &&
        line.includes('Completed') &&
        line.includes('Task')
      ) {
        inTable = true;
        tableStartIndex = i;
        continue;
      }

      // Skip separator row
      if (
        inTable &&
        tableStartIndex === i - 1 &&
        line.match(TABLE_SEPARATOR_PATTERN)
      ) {
        continue;
      }

      // Parse table rows
      if (inTable && line.startsWith('|')) {
        try {
          const cells = line
            .split('|')
            .slice(1, -1) // Remove artifacts before first | and after last |
            .map((cell) => cell.trim());

          if (cells.length >= 2) {
            const completed =
              cells[COL_IDX.COMPLETED].includes('[x]') ||
              cells[COL_IDX.COMPLETED].includes('[X]');
            const taskName = cells[COL_IDX.NAME];

            if (!taskName || taskName.length === 0) {
              logger.warnWithContext({
                op: 'PARSE_TASKS',
                message: `Skipping row with empty task name at line ${i + 1}`,
              });
              continue;
            }

            const task: Task = {
              completed,
              name: taskName,
              date: getCell(cells, COL_IDX.DATE),
              time: getCell(cells, COL_IDX.TIME),
              duration: getCell(cells, COL_IDX.DURATION),
              priority: getCell(cells, COL_IDX.PRIORITY) as
                | Priority
                | undefined,
              tags: parseTags(getCell(cells, COL_IDX.TAGS)),
              description: getCell(cells, COL_IDX.DESCRIPTION),
              link: getCell(cells, COL_IDX.LINK),
              calendarEventId: getCell(cells, COL_IDX.CALENDAR_EVENT_ID),
            };

            tasks.push(task);
            if (completed) {
              completedTasks.push(task);
            } else {
              uncompletedTasks.push(task);
            }
          }
        } catch (rowError) {
          logger.warnWithContext({
            op: 'PARSE_TASKS',
            error: rowError,
            message: `Error parsing row at line ${i + 1}`,
          });
          continue;
        }
      } else if (inTable && !line.startsWith('|')) {
        // End of table
        break;
      }
    }

    if (!inTable && tasks.length === 0) {
      logger.warnWithContext({
        op: 'PARSE_TASKS',
        message: 'No task table found in content',
      });
    }

    // Add table header to metadata if found
    if (tableHeader) {
      metadata.table_header = tableHeader;
    }

    // Validate all tasks after deserialization
    tasks.forEach((task, index) => {
      const result = validateTask(task);
      if (!result.valid) {
        logger.warnWithContext({
          op: 'VALIDATE_TASKS',
          message: `Task at index ${index} ("${task.name}") has validation warnings: ${result.errors.join(', ')}`,
        });
      }
    });

    return {
      metadata,
      taskData: {
        completed: completedTasks,
        uncompleted: uncompletedTasks,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to parse md tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const queryTasks = async (): Promise<MdTasksResult> => {
  let content: string;
  try {
    content = await fetchFileContent();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Tasks file not found')
    ) {
      // File doesn't exist, create initial content and save it
      content = getInitialContent(new Date());
      try {
        await saveFileContent(content, '[bot] Initialize tasks file');
        logger.infoWithContext({
          op: 'INIT_TASKS_FILE',
          message: 'Created initial tasks file on GitHub',
        });
      } catch (saveError) {
        logger.warnWithContext({
          op: 'INIT_TASKS_FILE',
          error: saveError,
          message: 'Failed to save initial tasks file',
        });
        // Continue with content even if save fails
      }
    } else {
      throw error;
    }
  }

  const result = deserializeTaskMarkdown(content);

  return result;
};
