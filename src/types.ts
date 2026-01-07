export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export const isValidPriority = (value: string): value is Priority => {
  return Object.values(Priority).includes(value as Priority);
};

export interface Task {
  name: string;
  completed: boolean;
  // formatted as "YYYY-MM-DD"
  date?: string;
  // formatted as "HH:MM"
  time?: string;
  // formatted as "HH:MM"
  duration?: string;
  priority?: Priority;
  tags?: string[];
  description?: string;
  // External link related to the task
  link?: string;
  // Google Calendar event ID
  calendarEventId?: string;
}

export interface Metadata {
  last_synced?: string;
  total_tasks?: number;
  tags?: string[];
  table_header?: string;
  timezone?: string;
}
