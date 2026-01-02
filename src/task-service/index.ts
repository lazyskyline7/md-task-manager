import { Task } from '../types';
import { queryTasks } from './queryTasks';

export const addTask = async (task: Task) => {
  const { tasks } = await queryTasks();
  tasks.push(task);
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
  const { tasks } = await queryTasks();
  if (taskIdx < 0 || taskIdx >= tasks.length) {
    return false;
  }
  tasks[taskIdx].completed = true;
  return true;
};

export const removeTask = async (taskIdx: number): Promise<boolean> => {
  const { tasks } = await queryTasks();
  if (taskIdx < 0 || taskIdx >= tasks.length) {
    return false;
  }
  tasks.splice(taskIdx, 1);
  return true;
};

export const completeTaskByName = async (name: string): Promise<boolean> => {
  const { tasks } = await queryTasks();
  const taskIdx = tasks.findIndex((task) => task.name === name);
  if (taskIdx === -1) {
    return false;
  }
  completeTask(taskIdx);
  return true;
};

export const removeTaskByName = async (name: string): Promise<boolean> => {
  const { tasks } = await queryTasks();
  const taskIdx = tasks.findIndex((task) => task.name === name);
  if (taskIdx === -1) {
    return false;
  }
  removeTask(taskIdx);
  return true;
};

export const clearCompletedTasks = async (): Promise<void> => {
  const { tasks } = await queryTasks();
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].completed) {
      tasks.splice(i, 1);
    }
  }
};
