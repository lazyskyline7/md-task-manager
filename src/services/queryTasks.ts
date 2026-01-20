import { Task, Metadata, TaskData } from '../types.js';
import logger from '../logger.js';
import { fetchFileContent, saveFileContent } from './github-client.js';
import { getInitialContent } from '../config.js';
import { validateTask } from '../validators.js';
import { parseMarkdown } from './markdownParser.js';

interface MdTasksResult {
  metadata: Metadata;
  taskData: TaskData;
}

const deserializeTaskMarkdown = (content: string): MdTasksResult => {
  try {
    const { metadata, tasks } = parseMarkdown(content);

    const completedTasks: Task[] = [];
    const uncompletedTasks: Task[] = [];

    // Validate all tasks and split them
    tasks.forEach((task, index) => {
      // Validation
      const result = validateTask(task);
      if (!result.valid) {
        logger.warnWithContext({
          op: 'VALIDATE_TASKS',
          message: `Task at index ${index} ("${task.name}") has validation warnings: ${result.errors.join(', ')}`,
        });
      }

      // Split
      if (task.completed) {
        completedTasks.push(task);
      } else {
        uncompletedTasks.push(task);
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
        await saveFileContent(content, '[bot] init');
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
