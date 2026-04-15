import { GanttScale } from '../../types/wbs';

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
  showProjectRange: boolean;
  showTodayHighlight: boolean;
  showRemoved: boolean;
  showDoneProjects: boolean;
  hidePlanningColumns: boolean;
  isPlanningMode: boolean;
  showGanttChart: boolean;
  showAssigneeName: boolean;
  showProgressRate: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  viewMode: 'wbs' | 'resource';
  overlapThreshold: number;
  ganttScale: GanttScale;
  colorMode: 'status' | 'assignee';
  highlightSameAssignee: boolean;
  highlightDelayedTasks: boolean;
}
