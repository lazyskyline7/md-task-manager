import { Task } from '../types';
import { queryTasks } from './queryTasks';
import { saveTasks } from './saveTasks';
import { googleCalendarService } from './google-calendar';

export const addTask = async (task: Task): Promise<void> => {
  const { tasks, metadata } = await queryTasks();

  // TODO: update after llm integrated
  // Mock date and time if not provided
  if (!task.date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    task.date = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  if (!task.time) {
    task.time = '09:00';
  }
  if (!task.duration) {
    task.duration = '1:00';
  }

  tasks.push(task);

  // Create calendar event if task has date and time
  if (task.date && task.time) {
    const eventId = await googleCalendarService.createEvent(task);
    if (eventId) {
      // Update task with calendar event ID
      task.calendarEventId = eventId;
    }
  }

  await saveTasks(tasks, metadata);
};

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
  tasks.splice(taskIdx, 1);
  await saveTasks(tasks, metadata);
  return true;
};

export const clearCompletedTasks = async (): Promise<void> => {
  const { tasks, metadata } = await queryTasks();
  const filteredTasks = tasks.filter((task) => !task.completed);
  await saveTasks(filteredTasks, metadata);
};
