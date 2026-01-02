export interface Task {
  name: string;
  completed: boolean;
  date?: string;
  time?: string;
  duration?: string;
  priority?: string;
  tags?: string[];
  description?: string;
}

export interface TaskMetadata {
  last_synced?: string;
  total_tasks?: number;
  tags?: string[];
}
