import { Task } from '../types.js';
import { queryTasks } from './queryTasks.js';

export const listTasks = async (): Promise<readonly Task[]> => {
  const { tasks } = await queryTasks();
  return tasks.uncompleted;
};

export const listAllTasks = async (): Promise<readonly Task[]> => {
  const { tasks } = await queryTasks();
  return tasks.uncompleted.concat(tasks.completed);
};
