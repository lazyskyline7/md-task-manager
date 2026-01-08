import { EditableField, Task } from '../types';
import { validators } from '../validators';
import { googleCalendarService } from './google-calendar';
import { queryTasks } from './queryTasks';
import { saveTasks } from './saveTasks';

export const updateTask = async (
  taskIdx: number,
  update: {
    field: EditableField;
    value: Task[EditableField];
  },
): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  const oldTask = tasks[taskIdx];

  // Extract the single field being updated
  const entries = Object.entries(update);
  if (entries.length !== 1) {
    throw new Error('Only one field can be updated at a time');
  }
  const [field, value] = entries[0] as [EditableField, Task[EditableField]];

  // Validate the field value
  if (!validators[field](value)) {
    throw new Error(`Invalid value for field ${field}`);
  }

  const updatedTask = { ...oldTask, ...update };

  // If date or time changed, we might need to update calendar
  const timeChanged =
    oldTask.date !== updatedTask.date ||
    oldTask.time !== updatedTask.time ||
    oldTask.duration !== updatedTask.duration;

  if (timeChanged) {
    // If it had an event, delete it first (simplest approach for now)
    if (oldTask.calendarEventId) {
      await googleCalendarService.deleteEvent(oldTask.calendarEventId);
      updatedTask.calendarEventId = undefined; // Will be recreated if valid
    }

    // Create new event if valid date/time exists
    if (updatedTask.date && updatedTask.time) {
      const eventId = await googleCalendarService.createEvent(
        updatedTask,
        metadata.timezone || 'UTC',
      );
      if (eventId) {
        updatedTask.calendarEventId = eventId;
      }
    }
  } else if (
    oldTask.name !== updatedTask.name ||
    oldTask.description !== updatedTask.description
  ) {
    // If only details changed and event exists, update it
    if (updatedTask.calendarEventId) {
      // For now, simpler to delete and recreate or just leave it.
      // A proper updateEvent would be better but let's stick to consistent behavior.
      // Re-creating ensures consistency.
      await googleCalendarService.deleteEvent(updatedTask.calendarEventId);
      const eventId = await googleCalendarService.createEvent(
        updatedTask,
        metadata.timezone || 'UTC',
      );
      if (eventId) {
        updatedTask.calendarEventId = eventId;
      }
    }
  }

  tasks[taskIdx] = updatedTask;
  await saveTasks(tasks, metadata);
  return true;
};
