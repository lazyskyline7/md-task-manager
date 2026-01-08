import { Task } from '../types';
import { queryTasks } from './queryTasks';

export const listTasks = async (): Promise<readonly Task[]> => {
  const { tasks } = await queryTasks();
  return tasks.filter((task) => !task.completed);
};

export const listAllTasks = async (): Promise<readonly Task[]> => {
  const { tasks } = await queryTasks();
  return tasks;
};

export const findTaskIdxByName = (
  tasks: readonly Task[],
  name: string,
): number => tasks.findIndex((task) => task.name === name);
