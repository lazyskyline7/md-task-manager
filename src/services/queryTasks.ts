import { Task, Metadata, TaskData } from '../core/types.js';
import logger from '../core/logger.js';
import { fetchFileContent } from '../clients/github.js';
import { validateTask } from '../utils/validators.js';
import { parseMarkdown } from './markdownParser.js';
import { initTasks } from './initTasks.js';

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
      content = await initTasks();
    } else {
      throw error;
    }
  }

  const result = deserializeTaskMarkdown(content);

  return result;
};
