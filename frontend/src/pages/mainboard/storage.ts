import { DisplayOptions, FilterState } from '../../components/FilterPanel';

const STORAGE_KEYS = {
  filters: 'wbs_filters',
  expandedProjects: 'wbs_expanded_projects',
  expandedTasks: 'wbs_expanded_tasks',
  treeWidth: 'wbs_tree_width',
  ganttScrollLeft: 'wbs_gantt_scroll_left',
  displayOptions: 'wbs_display_options',
} as const;

export const createDefaultFilters = (): FilterState => ({
  projectIds: [],
  statusIds: [],
  assigneeIds: [],
  subtaskTypeIds: [],
  onlyDelayed: false,
  searchTerm: '',
});

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showProjectRange: true,
  showTodayHighlight: true,
  showRemoved: false,
  showDoneProjects: false,
  hidePlanningColumns: false,
  showGanttChart: true,
  showAssigneeName: false,
  showProgressRate: false,
  isDarkMode: false,
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

export function getInitialTreeWidth(): number {
  const width = readNumber(STORAGE_KEYS.treeWidth, 1000);
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

export function persistTreeWidth(treeWidth: number): void {
  localStorage.setItem(STORAGE_KEYS.treeWidth, treeWidth.toString());
}

export function persistDisplayOptions(displayOptions: DisplayOptions): void {
  localStorage.setItem(STORAGE_KEYS.displayOptions, JSON.stringify(displayOptions));
}

export function persistGanttScrollLeft(scrollLeft: number): void {
  localStorage.setItem(STORAGE_KEYS.ganttScrollLeft, scrollLeft.toString());
}
