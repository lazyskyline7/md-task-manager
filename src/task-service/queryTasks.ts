import { Task, Metadata } from '../types';
import { logger } from '../logger';
import { fetchFileContent } from '../github-client';

interface MdTasksResult {
  metadata: Metadata;
  tasks: Task[];
}

// Regex patterns for content parsing
const FRONTMATTER_KEY_VALUE_PATTERN = /^(\w+):\s*(.+)$/;
const FRONTMATTER_KEY_ONLY_PATTERN = /^\w+:$/;
const TABLE_SEPARATOR_PATTERN = /^\|[\s:-]+\|/;

const deserializeTaskMarkdown = (content: string): MdTasksResult => {
  if (!content || content.trim().length === 0) {
    throw new Error('Content is empty');
  }

  const lines = content.split('\n');
  const metadata: Metadata = {};
  const tasks: Task[] = [];

  let inFrontmatter = false;
  let inTable = false;
  let tableStartIndex = -1;
  let currentFrontmatterKey: string | null = null;
  let tableHeader: string | undefined;

  // Helper to get cell value or undefined if empty (defined once)
  const getCell = (cells: string[], index: number) =>
    cells[index] && cells[index].length > 0 ? cells[index] : undefined;

  // Optimized tag parser
  const parseTags = (tagsCell: string): string[] | undefined => {
    const tags = tagsCell
      .split(/\s+/)
      .filter((tag) => tag.startsWith('#') && tag.length > 1)
      .map((tag) => tag.substring(1));
    return tags.length > 0 ? tags : undefined;
  };

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
              cells[0].includes('[x]') || cells[0].includes('[X]');
            const taskName = cells[1];

            if (!taskName || taskName.length === 0) {
              logger.warn(`Skipping row with empty task name at line ${i + 1}`);
              continue;
            }

            const tagsCell = getCell(cells, 6);
            const taskTags = tagsCell ? parseTags(tagsCell) : undefined;

            const task: Task = {
              completed,
              name: taskName,
              date: getCell(cells, 2),
              time: getCell(cells, 3),
              duration: getCell(cells, 4),
              priority: getCell(cells, 5),
              tags: taskTags,
              description: getCell(cells, 7),
              link: getCell(cells, 8),
              calendarEventId: getCell(cells, 9),
            };

            tasks.push(task);
          }
        } catch (rowError) {
          logger.warn(
            `Error parsing row at line ${i + 1}:`,
            rowError instanceof Error ? rowError.message : 'Unknown error',
          );
          continue;
        }
      } else if (inTable && !line.startsWith('|')) {
        // End of table
        break;
      }
    }

    if (!inTable && tasks.length === 0) {
      logger.warn('No task table found in content');
    }

    // Add table header to metadata if found
    if (tableHeader) {
      metadata.table_header = tableHeader;
    }

    return {
      metadata,
      tasks,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse md tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const queryTasks = async (): Promise<MdTasksResult> => {
  const content = await fetchFileContent();

  const result = deserializeTaskMarkdown(content);

  return result;
};
