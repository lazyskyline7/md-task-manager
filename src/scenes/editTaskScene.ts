import { Scenes, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext, setSessionData } from '../middlewares/session.js';
import {
  escapeMarkdownV2,
  parseTags,
  formatOperatedTaskStr,
  findTimeConflictingTask,
  findTaskIdxByName,
} from '../utils/index.js';
import { FIELD_CONFIGS } from '../utils/validators.js';
import { Command, EDITABLE_FIELDS } from '../core/config.js';
import { EditableField, Priority, Task } from '../core/types.js';
import { queryTasks } from '../services/queryTasks.js';
import { saveTasks } from '../services/saveTasks.js';
import { generateAiTask } from '../clients/gemini.js';
import logger from '../core/logger.js';

interface EditSceneState {
  taskIdx: number;
  field?: EditableField;
}

const isValidField = (field: string): field is EditableField =>
  (EDITABLE_FIELDS as readonly string[]).includes(field);

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

  const cancelButton = Markup.button.callback('❌ Cancel', 'edit_cancel');
  if (buttons.length > 0 && buttons[buttons.length - 1].length === 1) {
    buttons[buttons.length - 1].push(cancelButton);
  } else {
    buttons.push([cancelButton]);
  }

  return Markup.inlineKeyboard(buttons);
};

export const editTaskScene = new Scenes.BaseScene<BotContext>('edit-task');

// Enter handler: User has run /edit <task>
// The caller (command) should have set state.taskIdx
editTaskScene.enter(async (ctx) => {
  const state = ctx.scene.state as EditSceneState;
  const { taskData } = await queryTasks();
  const task = taskData.uncompleted[state.taskIdx];

  if (!task) {
    await ctx.reply('❌ Task not found.');
    return ctx.scene.leave();
  }

  await ctx.reply(
    `Select a field to edit for *${escapeMarkdownV2(task.name)}*:`,
    {
      parse_mode: 'MarkdownV2',
      ...generateEditKeyboard(task),
    },
  );
});

// Action handler: User clicked a field button
editTaskScene.action(/^edit_(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  const state = ctx.scene.state as EditSceneState;

  if (action === 'cancel') {
    await ctx.editMessageText('❌ Edit cancelled.');
    return ctx.scene.leave();
  }

  if (isValidField(action)) {
    state.field = action;
    await ctx.editMessageText(
      `✏️ Please enter the new value for *${escapeMarkdownV2(action)}*:`,
      { parse_mode: 'MarkdownV2' },
    );
  } else {
    await ctx.answerCbQuery('⚠️ Unknown field');
  }

  return ctx.answerCbQuery();
});

// Text handler: User typed the new value
editTaskScene.on(message('text'), async (ctx) => {
  const state = ctx.scene.state as EditSceneState;
  if (!state.field) {
    return ctx.reply('⚠️ Please select a field first.');
  }

  const fieldToUpdate = state.field;
  const newValue = ctx.message.text;
  const userId = ctx.from.id;

  try {
    const { metadata, taskData } = await queryTasks();

    if (!metadata.timezone) {
      await ctx.reply(
        '❌ Timezone not set. Please set your timezone first using /settimezone command.',
      );
      return ctx.scene.leave();
    }

    const oldTask = taskData.uncompleted[state.taskIdx];
    if (!oldTask) {
      await ctx.reply('❌ Task not found.');
      return ctx.scene.leave();
    }

    let updatedTask = validateAndGetUpdatedTask(
      taskData.uncompleted,
      oldTask,
      fieldToUpdate,
      newValue,
    );

    if (!updatedTask) {
      await ctx.reply(
        `⚠️ The new value is the same as the current one for *${escapeMarkdownV2(
          fieldToUpdate,
        )}*\\. No changes made\\.`,
        { parse_mode: 'MarkdownV2' },
      );
      return ctx.scene.leave();
    }

    if (fieldToUpdate === 'name') {
      const generatedTask = await generateAiTask(
        newValue,
        updatedTask.tags,
        metadata.timezone,
      );
      updatedTask = { ...updatedTask, ...generatedTask };
    }

    taskData.uncompleted[state.taskIdx] = updatedTask;
    await saveTasks(taskData, metadata);
    console.log('hi');
    await ctx.reply(
      formatOperatedTaskStr(updatedTask, {
        command: Command.EDIT,
        prefix: `✅ *${escapeMarkdownV2(state.field)}* in `,
      }),
      { parse_mode: 'MarkdownV2' },
    );

    // Calendar Integration Logic
    if (oldTask.calendarEventId) {
      if (
        ['name', 'description', 'link', 'date', 'time', 'duration'].includes(
          fieldToUpdate,
        )
      ) {
        setSessionData(userId, {
          calendarOps: [
            {
              type: 'update',
              taskName: updatedTask.name,
              calendarEventId: oldTask.calendarEventId,
            },
          ],
        });
        await ctx.reply(
          'Update Google Calendar Event?',
          Markup.inlineKeyboard([
            Markup.button.callback('Yes', 'cal_yes'),
            Markup.button.callback('No', 'cal_no'),
          ]),
        );
      }
    } else {
      if (
        ['date', 'time', 'duration'].includes(fieldToUpdate) &&
        updatedTask.date &&
        updatedTask.time
      ) {
        setSessionData(userId, {
          calendarOps: [
            {
              type: 'add',
              taskName: updatedTask.name,
            },
          ],
        });
        await ctx.reply(
          'Add this task to Google Calendar?',
          Markup.inlineKeyboard([
            Markup.button.callback('Yes', 'cal_yes'),
            Markup.button.callback('No', 'cal_no'),
          ]),
        );
      }
    }
  } catch (error) {
    await ctx.reply(
      `❌ Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    logger.errorWithContext({ userId, op: Command.EDIT, error });
  }

  return ctx.scene.leave();
});

// -- Helpers (duplicated from edit.ts for now, or move to utils) --

const validateAndGetUpdatedTask = (
  unCompletedTasks: Task[],
  task: Task,
  field: EditableField,
  value: string,
): Task | undefined => {
  const newTask = { ...task };
  const trimmedValue = value.trim();
  const config = FIELD_CONFIGS[field];

  const newValue = field === 'tags' ? undefined : trimmedValue;
  const newTags = field === 'tags' ? parseTags(trimmedValue) : [];

  // Validate tags format
  if (field === 'tags' && trimmedValue && !trimmedValue.includes('#')) {
    throw new Error('Tags must be prefixed with # (e.g., #work #sports)');
  }

  // Check for no-op (same value)
  let isSameValue = false;
  if (field === 'tags') {
    const existingTags = task.tags || [];
    isSameValue =
      existingTags.length === newTags.length &&
      existingTags.every((tag) => newTags.includes(tag));
  } else isSameValue = task[field] === (newValue || undefined);

  if (isSameValue) {
    return;
  }

  // Handle clearing the field (empty value)
  if (isEmptyValue(field === 'tags' ? newTags : newValue!)) {
    return clearField(newTask, field, config);
  }

  // Validate the new value
  if (!config.validator(field === 'tags' ? newTags : newValue)) {
    throw new Error(config.errorMessage);
  }

  // Constraint: Check name uniqueness
  if (
    field === 'name' &&
    findTaskIdxByName(unCompletedTasks, newValue!) !== -1
  ) {
    throw new Error('Task name must be unique');
  }

  // Constraint: Time conflict check
  if (field === 'time' || field === 'duration') {
    const simulatedTask = { ...newTask };
    if (field === 'time') {
      simulatedTask.time = newValue!;
      simulatedTask.duration = simulatedTask.duration || '1:00';
    }
    if (field === 'duration') {
      simulatedTask.duration = newValue!;
    }
    const conflictingTask = findTimeConflictingTask(
      simulatedTask,
      unCompletedTasks,
      task.name,
    );
    if (conflictingTask) {
      throw new Error(
        `Time conflict with existing task: "${conflictingTask.name}" (Date: ${conflictingTask.date}, Time: ${conflictingTask.time}, Duration: ${conflictingTask.duration})`,
      );
    }
  }

  // Assign the value
  if (field === 'tags') {
    newTask.tags = newTags;
  } else if (field === 'priority') {
    newTask.priority = value as Priority;
  } else {
    newTask[field] = value;
  }

  return newTask;
};

const isEmptyValue = (value: string | string[]): boolean => {
  if (typeof value === 'string') {
    return value.trim() === '';
  } else if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
};

const clearField = (
  task: Task,
  field: EditableField,
  config: (typeof FIELD_CONFIGS)[EditableField],
): Task => {
  if (field === 'name') {
    throw new Error('Task name cannot be empty');
  }

  if (field === 'tags') {
    task.tags = [];
    return task;
  }

  config.clearDependents?.forEach((dep) => {
    delete task[dep];
  });

  delete task[field];

  return task;
};
