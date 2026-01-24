import { getInitialContent } from '../core/config.js';
import { saveFileContent } from '../clients/github.js';
import logger from '../core/logger.js';

/**
 * Initializes the tasks file on GitHub with initial content if it does not exist.
 * Returns the initial content string.
 */
export async function initTasks(): Promise<string> {
  const content = getInitialContent(new Date());
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
  return content;
}
