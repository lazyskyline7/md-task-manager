export const TIMEZONE = process.env.TIMEZONE || 'UTC';

export const COMMANDS = {
  Add: { name: 'add', desc: 'add a new task' },
  List: { name: 'list', desc: 'list all incomplete tasks' },
  Complete: { name: 'complete', desc: 'complete a task' },
  Remove: { name: 'remove', desc: 'remove a task' },
  ListAll: {
    name: 'listall',
    desc: 'list all tasks including completed ones',
  },
  ClearCompleted: {
    name: 'clearcompleted',
    desc: 'clear all completed tasks',
  },
} as const;

const commandListWording = Object.values(COMMANDS)
  .map((cmd) => `/${cmd.name} - ${cmd.desc}`)
  .join('\n');

export const START_WORDING = `Hello! You can control me by these commands:\n${commandListWording}`;
