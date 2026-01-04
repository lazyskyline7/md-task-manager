import { Task } from '../types';
import { queryTasks } from './queryTasks';
import { saveTasks } from './saveTasks';
import { googleCalendarService } from './google-calendar';
import { logger } from '../logger';

export const listTasks = async (): Promise<Task[]> => {
  const { tasks } = await queryTasks();
  return tasks.filter((task) => !task.completed);
};

export const listAllTasks = async (): Promise<Task[]> => {
  const { tasks } = await queryTasks();
  return tasks;
};

export const completeTask = async (taskIdx: number): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  if (taskIdx < 0 || taskIdx >= tasks.length) {
    return false;
  }
  tasks[taskIdx].completed = true;
  await saveTasks(tasks, metadata);
  return true;
};

export const removeTask = async (taskIdx: number): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  if (taskIdx < 0 || taskIdx >= tasks.length) {
    return false;
  }

  const taskToRemove = tasks[taskIdx];

  // Delete calendar event if it exists
  if (taskToRemove.calendarEventId) {
    await googleCalendarService.deleteEvent(taskToRemove.calendarEventId);
  }

  tasks.splice(taskIdx, 1);
  await saveTasks(tasks, metadata);
  return true;
};

export const completeTaskByName = async (name: string): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  const taskIdx = tasks.findIndex((task) => task.name === name);
  if (taskIdx === -1) {
    return false;
  }
  tasks[taskIdx].completed = true;
  await saveTasks(tasks, metadata);
  return true;
};

export const removeTaskByName = async (name: string): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  const taskIdx = tasks.findIndex((task) => task.name === name);
  if (taskIdx === -1) {
    return false;
  }

  const taskToRemove = tasks[taskIdx];
  // Delete calendar event if it exists
  if (taskToRemove.calendarEventId) {
    const removed = await googleCalendarService.deleteEvent(
      taskToRemove.calendarEventId,
    );
    if (removed) {
      logger.info(`Removed calendar event for task: ${taskToRemove.name}`);
    } else {
      logger.error(
        `Failed to remove calendar event for task: ${taskToRemove.name}`,
      );
    }
  }

  tasks.splice(taskIdx, 1);
  await saveTasks(tasks, metadata);
  return true;
};

export const clearCompletedTasks = async (): Promise<void> => {
  const { tasks, metadata } = await queryTasks();
  const filteredTasks = tasks.filter((task) => !task.completed);
  await saveTasks(filteredTasks, metadata);
};
