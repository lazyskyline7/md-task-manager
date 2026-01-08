import { Task } from '../types';
import { queryTasks } from './queryTasks';
import { saveTasks } from './saveTasks';

export const listTasks = async (): Promise<Task[]> => {
  const { tasks } = await queryTasks();
  return tasks.filter((task) => !task.completed);
};

export const listAllTasks = async (): Promise<Task[]> => {
  const { tasks } = await queryTasks();
  return tasks;
};

export const findTaskIdxByName = (tasks: Task[], name: string): number =>
  tasks.findIndex((task) => task.name === name);

export const clearCompletedTasks = async (): Promise<boolean> => {
  const { tasks, metadata } = await queryTasks();
  const filteredTasks = tasks.filter((task) => !task.completed);
  return saveTasks(filteredTasks, metadata);
};
