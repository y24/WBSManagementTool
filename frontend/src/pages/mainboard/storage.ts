import { DisplayOptions, FilterState } from '../../components/FilterPanel';

const STORAGE_KEYS = {
  filters: 'wbs_filters',
  expandedProjects: 'wbs_expanded_projects',
  expandedTasks: 'wbs_expanded_tasks',
  treeWidthLegacy: 'wbs_tree_width',
  treeWidthWbs: 'wbs_tree_width_wbs',
  treeWidthResource: 'wbs_tree_width_resource',
  ganttScrollLeft: 'wbs_gantt_scroll_left',
  displayOptions: 'wbs_display_options',
} as const;

type ViewMode = 'wbs' | 'resource';

function getTreeWidthStorageKey(viewMode: ViewMode): string {
  return viewMode === 'resource' ? STORAGE_KEYS.treeWidthResource : STORAGE_KEYS.treeWidthWbs;
}

export const createDefaultFilters = (): FilterState => ({
  projectIds: [],
  statusIds: [],
  assigneeIds: [],
  subtaskTypeIds: [],
  onlyDelayed: false,
  onlyUnplanned: false,
  searchTerm: '',
});

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showProjectRange: true,
  showTodayHighlight: true,
  showRemoved: false,
  showDoneProjects: false,
  hidePlanningColumns: false,
  isPlanningMode: false,
  showGanttChart: true,
  showAssigneeName: false,
  showProgressRate: false,
  showMarkers: true,
  isDarkMode: false,
  viewMode: 'wbs',
  overlapThreshold: 1,
  ganttScale: 'day',
  colorMode: 'status',
  highlightSameAssignee: false,
  highlightDelayedTasks: true,
};

function readJson<T extends object>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved);
    return Object.assign({}, fallback, parsed);
  } catch (error) {
    console.error(`Failed to parse localStorage key: ${key}`, error);
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  const parsed = Number(saved);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function getInitialFilters(): FilterState {
  return readJson(STORAGE_KEYS.filters, createDefaultFilters());
}

export function getInitialDisplayOptions(): DisplayOptions {
  return readJson(STORAGE_KEYS.displayOptions, DEFAULT_DISPLAY_OPTIONS);
}

export function getInitialExpandedProjects(): Record<number, boolean> {
  const saved = localStorage.getItem(STORAGE_KEYS.expandedProjects);
  if (!saved) return {};

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse saved expanded projects', error);
    return {};
  }
}

export function getInitialExpandedTasks(): Record<number, boolean> {
  const saved = localStorage.getItem(STORAGE_KEYS.expandedTasks);
  if (!saved) return {};

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse saved expanded tasks', error);
    return {};
  }
}

export function getInitialTreeWidth(viewMode: ViewMode): number {
  const modeSpecificKey = getTreeWidthStorageKey(viewMode);
  const hasModeSpecificValue = localStorage.getItem(modeSpecificKey) !== null;
  const width = hasModeSpecificValue
    ? readNumber(modeSpecificKey, 1000)
    : readNumber(STORAGE_KEYS.treeWidthLegacy, 1000);
  if (typeof window === 'undefined') return width;

  const maxWidth = window.innerWidth - 100;
  if (width > maxWidth) return Math.max(300, maxWidth);
  return width;
}

export function getInitialGanttScrollLeft(): number {
  return readNumber(STORAGE_KEYS.ganttScrollLeft, 0);
}

export function persistFilters(filters: FilterState): void {
  localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters));
}

export function persistExpandedProjects(expandedProjects: Record<number, boolean>): void {
  localStorage.setItem(STORAGE_KEYS.expandedProjects, JSON.stringify(expandedProjects));
}

export function persistExpandedTasks(expandedTasks: Record<number, boolean>): void {
  localStorage.setItem(STORAGE_KEYS.expandedTasks, JSON.stringify(expandedTasks));
}

export function persistTreeWidth(treeWidth: number, viewMode: ViewMode): void {
  localStorage.setItem(getTreeWidthStorageKey(viewMode), treeWidth.toString());
}

export function persistDisplayOptions(displayOptions: DisplayOptions): void {
  localStorage.setItem(STORAGE_KEYS.displayOptions, JSON.stringify(displayOptions));
}

export function persistGanttScrollLeft(scrollLeft: number): void {
  localStorage.setItem(STORAGE_KEYS.ganttScrollLeft, scrollLeft.toString());
}
