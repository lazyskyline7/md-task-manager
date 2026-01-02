interface Task {
  name: string;
  completed: boolean;
  date?: string;
  time?: string;
  duration?: string;
  priority?: string;
  tags?: string[];
  description?: string;
}
// TODO: Replace with persistent storage
const tasks: Task[] = [];

export const addTask = (task: Task) => {
  tasks.push(task);
};

export const listTasks = (): Task[] => {
  return tasks.filter((task) => !task.completed);
};

export const listAllTasks = (): Task[] => {
  return tasks;
};

export const completeTask = (taskIdx: number): boolean => {
  if (taskIdx < 0 || taskIdx >= tasks.length) {
    return false;
  }
  tasks[taskIdx].completed = true;
  return true;
};

export const removeTask = (taskIdx: number): boolean => {
  if (taskIdx < 0 || taskIdx >= tasks.length) {
    return false;
  }
  tasks.splice(taskIdx, 1);
  return true;
};

export const completeTaskByName = (name: string): boolean => {
  const taskIdx = tasks.findIndex((task) => task.name === name);
  if (taskIdx === -1) {
    return false;
  }
  completeTask(taskIdx);
  return true;
};

export const removeTaskByName = (name: string): boolean => {
  const taskIdx = tasks.findIndex((task) => task.name === name);
  if (taskIdx === -1) {
    return false;
  }
  removeTask(taskIdx);
  return true;
};

export const clearCompletedTasks = (): void => {
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].completed) {
      tasks.splice(i, 1);
    }
  }
};

export const getAllTasks = (): Task[] => {
  return tasks;
};
