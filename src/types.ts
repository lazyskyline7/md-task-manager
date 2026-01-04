export interface Task {
  name: string;
  completed: boolean;
  date?: string;
  time?: string;
  duration?: string;
  priority?: string;
  tags?: string[];
  description?: string;
  // Link to the task in integrated Calendar
  link?: string;
}

export interface Metadata {
  last_synced?: string;
  total_tasks?: number;
  tags?: string[];
  table_header?: string;
  timezone?: string;
}
