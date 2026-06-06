import { GanttScale } from '../../types/wbs';

export type ResourceLoadScope = '1w' | '2w' | '1m' | '2m' | '3m';

export const UNASSIGNED_ASSIGNEE_ID = -1;

export interface FilterState {
  projectIds: number[];
  statusIds: number[];
  assigneeIds: number[];
  subtaskTypeIds: number[];
  onlyDelayed: boolean;
  onlyUnplanned: boolean;
  searchTerm: string;
}

export interface DisplayOptions {
  showTodayHighlight: boolean;
  showRemoved: boolean;
  showDoneProjects: boolean;
  hidePlanningColumns: boolean;
  isPlanningMode: boolean;
  showGanttChart: boolean;
  showAssigneeName: boolean;
  showProgressRate: boolean;
  showManHours: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  viewMode: 'wbs' | 'resource';
  ganttScale: GanttScale;
  colorMode: 'status' | 'assignee';
  highlightSameAssignee: boolean;
  highlightDelayedTasks: boolean;
  showInterruptionReason: boolean;
  showResourceTaskType: boolean;
  showResourceScopeMask: boolean;
  highlightResourceDelayedTasks: boolean;
  resourceLoadScope: ResourceLoadScope;
  overlapThreshold: number;
}
