export interface DashboardKPIs {
  ongoing_projects_count: number;
  start_delay_count: number;
  overdue_subtasks_count: number;
  review_delay_count: number;
  this_week_end_count: number;
}

export interface ProjectProgressData {
  project_name: string;
  progress_percent: number;
}

export interface AssigneeDelayData {
  member_name: string;
  delay_count: number;
}

export interface StatusCountData {
  status_name: string;
  count: number;
  color_code: string;
}

export interface SubtaskSummary {
  id: number;
  task_name: string;
  subtask_detail: string;
  planned_end_date: string | null;
  progress_percent: number;
  assignee_name: string | null;
}

export interface ReviewDelaySubtask extends SubtaskSummary {
  review_days: number;
  review_start_date: string | null;
  delay_days: number;
}

export interface AssigneeSummary {
  member_name: string;
  total_count: number;
  this_week_end_count: number;
  overdue_count: number;
  concurrent_count: number;
}

export interface ProjectEffortData {
  project_name: string;
  planned_effort: number;
  actual_effort: number;
}

export interface TaskDeviationData {
  task_name: string;
  project_name: string;
  planned_effort: number;
  actual_effort: number;
  deviation_rate: number;
}

export interface AssigneeEstimateErrorData {
  member_name: string;
  avg_deviation_rate: number;
  task_count: number;
}

export interface EstimateAccuracyTrendData {
  period: string;
  avg_deviation_rate: number;
  task_count: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  project_progress: ProjectProgressData[];
  assignee_delays: AssigneeDelayData[];
  status_counts: StatusCountData[];
  review_delays: ReviewDelaySubtask[];
  low_progress_soon_to_finish: SubtaskSummary[];
  assignee_summary: AssigneeSummary[];
  project_effort: ProjectEffortData[];
  task_deviations: TaskDeviationData[];
  assignee_estimate_errors: AssigneeEstimateErrorData[];
  estimate_accuracy_trend: EstimateAccuracyTrendData[];
}
