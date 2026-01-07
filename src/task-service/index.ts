import { Task } from '../types';
import { queryTasks } from './queryTasks';
import { saveTasks } from './saveTasks';
import { googleCalendarService } from './google-calendar';

export const listTasks = async (): Promise<Task[]> => {
  const { tasks } = await queryTasks();
  return tasks.filter((task) => !task.completed);
};

export const listAllTasks = async (): Promise<Task[]> => {
  const { tasks } = await queryTasks();
  return tasks;
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
  const taskIdx = findTaskIdxByName(tasks, name);
  if (taskIdx === -1) {
    return false;
  }
  tasks[taskIdx].completed = true;
  return saveTasks(tasks, metadata);
};

export const findTaskIdxByName = (tasks: Task[], name: string): number =>
  tasks.findIndex((task) => task.name === name);

export const clearCompletedTasks = async (): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  const filteredTasks = tasks.filter((task) => !task.completed);
  return saveTasks(filteredTasks, metadata);
};
