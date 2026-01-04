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
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0);

          if (cells.length >= 2) {
            const completed =
              cells[0].includes('[x]') || cells[0].includes('[X]');
            const taskName = cells[1];

            if (!taskName || taskName.length === 0) {
              logger.warn(`Skipping row with empty task name at line ${i + 1}`);
              continue;
            }

            // Parse tags efficiently in single pass
            let taskTags: string[] | undefined;
            if (cells[6]) {
              const tagsCell = cells[6];
              const tags: string[] = [];
              let currentTag = '';

              for (let j = 0; j < tagsCell.length; j++) {
                const char = tagsCell[j];
                if (char === ' ' || char === '\t' || char === '\n') {
                  if (currentTag.startsWith('#') && currentTag.length > 1) {
                    tags.push(currentTag.substring(1));
                  }
                  currentTag = '';
                } else {
                  currentTag += char;
                }
              }

              // last tag
              if (currentTag.startsWith('#') && currentTag.length > 1) {
                tags.push(currentTag.substring(1));
              }

              taskTags = tags.length > 0 ? tags : undefined;
            }

            const task: Task = {
              completed,
              name: taskName,
              date: cells[2] || undefined,
              time: cells[3] || undefined,
              duration: cells[4] || undefined,
              priority: cells[5] || undefined,
              tags: taskTags,
              description: cells[7] || undefined,
              link: cells[8] || undefined,
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
