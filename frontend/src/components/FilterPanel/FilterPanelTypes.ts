export interface FilterState {
  projectIds: number[];
  statusIds: number[];
  assigneeIds: number[];
  subtaskTypeIds: number[];
  onlyDelayed: boolean;
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
}
