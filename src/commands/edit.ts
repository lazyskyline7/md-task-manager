import { Markup } from 'telegraf';
import {
  extractArg,
  escapeMarkdownV2,
  findTaskIdxByName,
} from '../utils/index.js';
import { Command, EDITABLE_FIELDS } from '../core/config.js';
import {
  getNoTaskNameMessage,
  TASK_NOT_FOUND_MESSAGE,
} from '../views/generalView.js';
import { EditableField, Task } from '../core/types.js';
import { queryTasks } from '../services/queryTasks.js';
import { BotContext, setSessionData } from '../middlewares/session.js';

const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.substring(1);

const isFieldEditable = (field: EditableField, task: Task): boolean => {
  if (field === 'time' || field === 'duration') {
    if (!task.date) return false;
  }
  if (field === 'duration') {
    if (!task.time) return false;
  }
  return true;
};

const generateEditKeyboard = (task: Task) => {
  const fields = Array.from(EDITABLE_FIELDS).filter((field) =>
    isFieldEditable(field, task),
  );
  const buttons = [];

  // Create rows with 2 buttons each
  for (let i = 0; i < fields.length; i += 2) {
    const row = [
      Markup.button.callback(capitalize(fields[i]), `edit_${fields[i]}`),
    ];
    if (i + 1 < fields.length) {
      row.push(
        Markup.button.callback(
          capitalize(fields[i + 1]),
          `edit_${fields[i + 1]}`,
        ),
      );
    }
    buttons.push(row);
  }

  // Add cancel button - append to last row if it has only one element
  const cancelButton = Markup.button.callback('❌ Cancel', 'edit_cancel');
  if (buttons.length > 0 && buttons[buttons.length - 1].length === 1) {
    buttons[buttons.length - 1].push(cancelButton);
  } else {
    buttons.push([cancelButton]);
  }

  return Markup.inlineKeyboard(buttons);
};

export const editCommand = async (ctx: BotContext) => {
  if (!ctx.message || !('text' in ctx.message)) return;

  const taskName = extractArg(ctx.message.text, Command.EDIT);

  if (!taskName) {
    return ctx.reply(getNoTaskNameMessage(Command.EDIT));
  }

  const { taskData } = await queryTasks();
  const tasks = taskData.uncompleted.concat(taskData.completed);
  const taskIdx = findTaskIdxByName(tasks, taskName);

  if (taskIdx === -1) {
    return ctx.reply(TASK_NOT_FOUND_MESSAGE);
  }

  const task = tasks[taskIdx];
  setSessionData(ctx.from!.id, { editState: { taskIdx } });

  await ctx.reply(
    `📝 *Editing Task: ${escapeMarkdownV2(task.name)}*\n\nSelect a field to update:`,
    {
      parse_mode: 'MarkdownV2',
      ...generateEditKeyboard(task),
    },
  );
};
