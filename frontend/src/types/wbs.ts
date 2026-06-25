import { MasterBase, MstStatus, MstSubtaskType, MstMember } from './index';

export type GanttScale = 'day' | 'week' | 'month';

export interface SubtaskInterruption {
  id: number;
  subtask_id: number;
  interruption_date: string;
  resumption_date?: string | null;
  reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

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
  sync_to_azure_devops?: boolean;
  sort_order: number;
  is_auto_effort: boolean;
  is_progress_excluded?: boolean;
  workload_percent?: number | null;
  is_deleted: boolean;
  project_name?: string;
  task_name?: string;
  
  interruptions?: SubtaskInterruption[];
}

export interface Task {
  id: number;
  project_id: number;
  task_name: string;
  detail?: string | null;
  ticket_id?: number | null;
  link_url?: string | null;
  memo?: string | null;
  sync_to_azure_devops?: boolean;
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
  testing_id?: number | null;
  link_url?: string | null;
  memo?: string | null;
  sync_to_azure_devops?: boolean;
  sync_testing_to_azure_devops?: boolean;
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
  tree_version: string;
  initial_data_version: string;
  projects: Project[];
}
