import { Command } from '../core/config.js';
import { extractArg, findTaskIdxByName } from '../utils/index.js';
import { queryTasks } from '../services/queryTasks.js';
import {
  getNoTaskNameMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../views/generalView.js';
import logger from '../core/logger.js';
import { BotContext } from '../middlewares/session.js';

export const editCommand = async (ctx: BotContext) => {
  if (!ctx.message || !('text' in ctx.message)) {
    return ctx.reply('❌ Please provide a task name to edit');
  }

  const text = ctx.message.text;
  const arg = extractArg(text, Command.EDIT);

  if (!arg) {
    return ctx.reply(getNoTaskNameMessage(Command.EDIT));
  }

  try {
    const { taskData } = await queryTasks();
    const taskIdx = findTaskIdxByName(taskData.uncompleted, arg);

    if (taskIdx === -1) {
      if (findTaskIdxByName(taskData.completed, arg) !== -1) {
        return ctx.reply(
          '⚠️ Task is completed. Please uncomplete it first to edit.',
        );
      }
      return ctx.reply(TASK_NOT_FOUND_MESSAGE);
    }

    await ctx.scene.enter('edit-task', { taskIdx });
  } catch (error) {
    ctx.reply('❌ Error initiating edit. Please try again.');
    logger.errorWithContext({ userId: ctx.from?.id, op: Command.EDIT, error });
  }
};
