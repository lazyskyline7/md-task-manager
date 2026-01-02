import { Octokit } from '@octokit/rest';
import { Task, TaskMetadata } from './types';

// Extract argument from command text
export const extractArg = (text: string, name: string) =>
  text.substring(name.length + 1).trim();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});
const fetchContentFromGitHub = async (): Promise<string> => {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  try {
    const path = process.env.GITHUB_PATH;
    if (!path) {
      throw new Error('GITHUB_PATH is not configured');
    }

    // Extract owner, repo, ref and file path from GITHUB_PATH
    const match = path.match(
      /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/,
    );
    if (!match) {
      throw new Error(
        'GITHUB_PATH format is invalid. Expected format: https://github.com/owner/repo/blob/branch/path/to/file',
      );
    }


    const [, owner, repo, ref, filePath] = match;
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: decodeURIComponent(filePath),
      // branch
      ref,
    });

    if (Array.isArray(res.data) || res.data.type !== 'file') {
      throw new Error('Path is not a file');
    }

    const base64 = res.data.content.replace(/\n/g, '');
    const text = Buffer.from(base64, 'base64').toString('utf8');

    return text;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error('GitHub fetch error:', errorMsg);

    if (errorMsg.includes('404')) {
      throw new Error(
        'Tasks file not found. Make sure Tasks Tracker.md exists in the tasks-tracker repo.',
      );
    }

    throw new Error(`Failed to fetch tasks from GitHub: ${errorMsg}`);
  }
};

interface MdTasksResult {
  metadata: TaskMetadata;
  tasks: Task[];
}
const parseMdTasks = (content: string): MdTasksResult => {
  if (!content || content.trim().length === 0) {
    throw new Error('Content is empty');
  }

  const lines = content.split('\n');
  const metadata: TaskMetadata = {};
  const tasks: Task[] = [];

  let inFrontmatter = false;
  let inTable = false;
  let tableStartIndex = -1;
  let currentFrontmatterKey: string | null = null;

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
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          if (key === 'last_synced') {
            metadata.last_synced = value;
          } else if (key === 'total_tasks') {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
              metadata.total_tasks = parsed;
            }
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
        } else if (line.match(/^\w+:$/)) {
          // Handle key without value (for arrays)
          const key = line.replace(':', '').trim();
          if (key === 'tags') {
            currentFrontmatterKey = 'tags';
            metadata.tags = [];
          }
        }
        continue;
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
      if (inTable && tableStartIndex === i - 1 && line.match(/^\|[\s:-]+\|/)) {
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
              console.warn(`Skipping row with empty task name at line ${i + 1}`);
              continue;
            }

            const task: Task = {
              completed,
              name: taskName,
              date: cells[2] || undefined,
              time: cells[3] || undefined,
              duration: cells[4] || undefined,
              priority: cells[5] || undefined,
              tags: cells[6]
                ? cells[6]
                    .split(/\s+/)
                    .filter((tag) => tag.startsWith('#'))
                    .map((tag) => tag.substring(1))
                : undefined,
              description: cells[7] || undefined,
            };
            tasks.push(task);
          }
        } catch (rowError) {
          console.warn(
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
      console.warn('No task table found in content');
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
  const content = await fetchContentFromGitHub();

  const result = parseMdTasks(content);

  return result;
};
