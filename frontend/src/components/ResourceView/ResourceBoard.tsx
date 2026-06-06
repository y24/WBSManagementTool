import React, { UIEvent, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import ResourceList from './ResourceList';
import ResourceGantt from './ResourceGantt';
import ResourceSummaryBar from './ResourceSummaryBar';
import { ResourceRow, useResourceData } from '../../pages/mainboard/useResourceData';
import { Project, GanttRange, GanttScale } from '../../types/wbs';
import { InitialData, Marker } from '../../types';
import { ResourceLoadScope } from '../FilterPanel/FilterPanelTypes';
import { getLoadRateThresholds, getScheduleVarianceThresholds } from '../../utils/loadRateThresholds';

export type ResourceSortKey =
  | 'assignee'
  | 'loadRate'
  | 'actualLoadRate'
  | 'scheduleVariancePt'
  | 'inProgressCount'
  | 'delayedCount';

export type ResourceSortDirection = 'asc' | 'desc';

export interface ResourceSortState {
  key: ResourceSortKey;
  direction: ResourceSortDirection;
}

const RESOURCE_SORT_STORAGE_KEY = 'wbs_resource_sort';

const isResourceSortKey = (value: unknown): value is ResourceSortKey =>
  value === 'assignee' ||
  value === 'loadRate' ||
  value === 'actualLoadRate' ||
  value === 'scheduleVariancePt' ||
  value === 'inProgressCount' ||
  value === 'delayedCount';

const readInitialResourceSort = (): ResourceSortState | null => {
  try {
    const saved = localStorage.getItem(RESOURCE_SORT_STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as Partial<ResourceSortState>;
    if (!isResourceSortKey(parsed.key)) return null;
    if (parsed.direction !== 'asc' && parsed.direction !== 'desc') return null;
    return { key: parsed.key, direction: parsed.direction };
  } catch (error) {
    console.error(`Failed to parse localStorage key: ${RESOURCE_SORT_STORAGE_KEY}`, error);
    return null;
  }
};

const compareNullableNumber = (
  a: number | null,
  b: number | null,
  direction: ResourceSortDirection
) => {
  const aMissing = a === null;
  const bMissing = b === null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return direction === 'asc' ? a - b : b - a;
};

const compareRowsBySort = (
  a: ResourceRow,
  b: ResourceRow,
  sortState: ResourceSortState
) => {
  if (!a.assignee && b.assignee) return 1;
  if (a.assignee && !b.assignee) return -1;

  let result = 0;
  switch (sortState.key) {
    case 'assignee':
      result = (a.assignee?.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.assignee?.sort_order ?? Number.MAX_SAFE_INTEGER);
      if (result === 0) result = (a.assignee?.id ?? Number.MAX_SAFE_INTEGER) - (b.assignee?.id ?? Number.MAX_SAFE_INTEGER);
      break;
    case 'loadRate':
      result = compareNullableNumber(a.loadRate, b.loadRate, sortState.direction);
      break;
    case 'actualLoadRate':
      result = compareNullableNumber(a.actualLoadRate, b.actualLoadRate, sortState.direction);
      break;
    case 'scheduleVariancePt':
      result = compareNullableNumber(a.scheduleVariancePt, b.scheduleVariancePt, sortState.direction);
      break;
    case 'inProgressCount':
      result = compareNullableNumber(a.inProgressCount, b.inProgressCount, sortState.direction);
      break;
    case 'delayedCount':
      result = compareNullableNumber(a.delayedCount, b.delayedCount, sortState.direction);
      break;
  }

  if (sortState.key === 'assignee') {
    return sortState.direction === 'asc' ? result : -result;
  }
  if (result !== 0) return result;

  return (a.assignee?.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.assignee?.sort_order ?? Number.MAX_SAFE_INTEGER);
};

interface ResourceBoardProps {
  projects: Project[];
  initialData: InitialData | null;
  markers: Marker[];
  treeWidth: number;
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
  listRef: React.RefObject<HTMLDivElement | null>;
  ganttRef: React.RefObject<HTMLDivElement | null>;
  dynamicGanttRange?: GanttRange;
  currentTodayStr: string;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  showResourceTaskType: boolean;
  showResourceScopeMask: boolean;
  highlightResourceDelayedTasks: boolean;
  resourceLoadScope: ResourceLoadScope;
  scale: GanttScale;
  onListScroll: (e: UIEvent<HTMLDivElement>) => void;
  onGanttScroll: (e: UIEvent<HTMLDivElement>) => void;
  onRefresh: () => void;
  onLocalUpdate?: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, unknown>) => void;
}

export default function ResourceBoard({
  projects,
  initialData,
  markers,
  treeWidth,
  setIsResizing,
  listRef,
  ganttRef,
  dynamicGanttRange,
  currentTodayStr,
  showTodayHighlight,
  showMarkers,
  isDarkMode,
  showResourceTaskType,
  showResourceScopeMask,
  highlightResourceDelayedTasks,
  resourceLoadScope,
  scale,
  onListScroll,
  onGanttScroll,
  onRefresh,
  onLocalUpdate
}: ResourceBoardProps) {
  const effectiveTodayStr = dynamicGanttRange?.today || currentTodayStr;
  const [resourceSort, setResourceSort] = useState<ResourceSortState | null>(() => readInitialResourceSort());
  const loadRateThresholds = useMemo(() => getLoadRateThresholds(initialData), [initialData]);
  const scheduleVarianceThresholds = useMemo(() => getScheduleVarianceThresholds(initialData), [initialData]);

  const loadScopeEndDate = useMemo(() => {
    const today = parseISO(effectiveTodayStr);
    const days = resourceLoadScope === '1w' ? 6 : resourceLoadScope === '2w' ? 13 : resourceLoadScope === '1m' ? 29 : resourceLoadScope === '2m' ? 59 : 89;
    return format(addDays(today, days), 'yyyy-MM-dd');
  }, [effectiveTodayStr, resourceLoadScope]);

  const actualLoadScopeStartDate = useMemo(() => {
    const today = parseISO(effectiveTodayStr);
    const days = resourceLoadScope === '1w' ? 6 : resourceLoadScope === '2w' ? 13 : resourceLoadScope === '1m' ? 29 : resourceLoadScope === '2m' ? 59 : 89;
    return format(addDays(today, -days), 'yyyy-MM-dd');
  }, [effectiveTodayStr, resourceLoadScope]);

  const resourceData = useResourceData(
    projects,
    initialData,
    effectiveTodayStr,
    loadScopeEndDate,
    actualLoadScopeStartDate
  );
  const sortedResourceData = useMemo(() => {
    if (!resourceSort) return resourceData;
    return [...resourceData].sort((a, b) => compareRowsBySort(a, b, resourceSort));
  }, [resourceData, resourceSort]);

  useEffect(() => {
    if (resourceSort) {
      localStorage.setItem(RESOURCE_SORT_STORAGE_KEY, JSON.stringify(resourceSort));
    } else {
      localStorage.removeItem(RESOURCE_SORT_STORAGE_KEY);
    }
  }, [resourceSort]);

  const handleSortChange = (key: ResourceSortKey) => {
    setResourceSort(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <ResourceSummaryBar
        data={sortedResourceData}
        loadRateThresholds={loadRateThresholds}
        initialData={initialData}
        todayStr={effectiveTodayStr}
        loadScopeEndDate={loadScopeEndDate}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex flex-col min-h-0 relative z-20 overflow-hidden flex-shrink-0"
          style={{ width: `${treeWidth}px` }}
        >
          <ResourceList
            data={sortedResourceData}
            width={treeWidth}
            loadRateThresholds={loadRateThresholds}
            scheduleVarianceThresholds={scheduleVarianceThresholds}
            sortState={resourceSort}
            onSortChange={handleSortChange}
            onScroll={onListScroll}
            listRef={listRef}
          />
        </div>

        <div
          className="w-1.5 bg-gray-200 dark:bg-slate-800 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors z-30 flex items-center justify-center shrink-0"
          onMouseDown={(event) => {
            event.preventDefault();
            setIsResizing(true);
          }}
        />

        <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col z-10 w-0 transition-colors">
          {dynamicGanttRange && (
            <ResourceGantt
              data={sortedResourceData}
              range={dynamicGanttRange}
              initialData={initialData}
              markers={markers}
              showTodayHighlight={showTodayHighlight}
              showMarkers={showMarkers}
              isDarkMode={isDarkMode}
              showResourceTaskType={showResourceTaskType}
              showResourceScopeMask={showResourceScopeMask}
              highlightResourceDelayedTasks={highlightResourceDelayedTasks}
              loadScopeEndDate={loadScopeEndDate}
              actualLoadScopeStartDate={actualLoadScopeStartDate}
              todayStr={effectiveTodayStr}
              scale={scale}
              onScroll={onGanttScroll}
              ganttRef={ganttRef}
              onRefresh={onRefresh}
              onLocalUpdate={onLocalUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
