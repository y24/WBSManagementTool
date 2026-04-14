import { MasterBase, MstStatus, MstSubtaskType, MstMember } from './index';

export type GanttScale = 'day' | 'week' | 'month';

export interface Subtask {
  id: number;
  task_id: number;
  subtask_type_id: number;
  status_id: number;
  assignee_id?: number | null;
  subtask_detail?: string | null;
  progress_percent?: number | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  review_start_date?: string | null;
  actual_end_date?: string | null;
  planned_effort_days?: number | null;
  actual_effort_days?: number | null;
  work_days?: number | null;
  review_days?: number | null;
  ticket_id?: number | null;
  link_url?: string | null;
  memo?: string | null;
  sort_order: number;
  is_auto_effort: boolean;
  workload_percent?: number | null;
  is_deleted: boolean;
  project_name?: string;
  task_name?: string;
  
  // Relations mapped by backend (if needed, otherwise manually mapped from initial-data)
  // For now we map using the masters
}

export interface Task {
  id: number;
  project_id: number;
  task_name: string;
  detail?: string | null;
  ticket_id?: number | null;
  link_url?: string | null;
  memo?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  is_auto_planned_date: boolean;
  is_auto_actual_date: boolean;
  sort_order: number;
  is_deleted: boolean;
  status_id?: number | null;
  assignee_id?: number | null;
  is_overlapping?: boolean;
  planned_effort_total?: number;
  work_days?: number | null;
  work_days_total?: number;
  actual_effort_total?: number;
  progress_percent?: number | null;
  subtasks: Subtask[];
}

export interface Project {
  id: number;
  project_name: string;
  detail?: string | null;
  ticket_id?: number | null;
  link_url?: string | null;
  memo?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  is_auto_planned_date: boolean;
  is_auto_actual_date: boolean;
  sort_order: number;
  is_deleted: boolean;
  status_id?: number | null;
  assignee_id?: number | null;
  is_overlapping?: boolean;
  planned_effort_total?: number;
  work_days?: number | null;
  work_days_total?: number;
  actual_effort_total?: number;
  progress_percent?: number | null;
  tasks: Task[];
}

export interface GanttRange {
  start_date: string;
  end_date: string;
  today: string;
}

export interface WBSResponse {
  filters: any;
  gantt_range: GanttRange;
  projects: Project[];
}
