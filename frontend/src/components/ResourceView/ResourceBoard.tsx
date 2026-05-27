import React, { UIEvent, useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import ResourceList from './ResourceList';
import ResourceGantt from './ResourceGantt';
import ResourceSummaryBar from './ResourceSummaryBar';
import { useResourceData } from '../../pages/mainboard/useResourceData';
import { Project, GanttRange, GanttScale } from '../../types/wbs';
import { InitialData } from '../../types';
import { ResourceLoadScope } from '../FilterPanel/FilterPanelTypes';

interface ResourceBoardProps {
  projects: Project[];
  initialData: InitialData | null;
  treeWidth: number;
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
  listRef: React.RefObject<HTMLDivElement | null>;
  ganttRef: React.RefObject<HTMLDivElement | null>;
  dynamicGanttRange?: GanttRange;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  showResourceTaskType: boolean;
  colorByTask: boolean;
  resourceLoadScope: ResourceLoadScope;
  scale: GanttScale;
  onListScroll: (e: UIEvent<HTMLDivElement>) => void;
  onGanttScroll: (e: UIEvent<HTMLDivElement>) => void;
  onRefresh: () => void;
}

export default function ResourceBoard({
  projects,
  initialData,
  treeWidth,
  setIsResizing,
  listRef,
  ganttRef,
  dynamicGanttRange,
  showTodayHighlight,
  showMarkers,
  isDarkMode,
  showResourceTaskType,
  colorByTask,
  resourceLoadScope,
  scale,
  onListScroll,
  onGanttScroll,
  onRefresh
}: ResourceBoardProps) {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadScopeEndDate = useMemo(() => {
    const today = parseISO(todayStr);
    const days = resourceLoadScope === '1w' ? 6 : resourceLoadScope === '2w' ? 13 : resourceLoadScope === '1m' ? 29 : resourceLoadScope === '2m' ? 59 : 89;
    return format(addDays(today, days), 'yyyy-MM-dd');
  }, [todayStr, resourceLoadScope]);

  const resourceData = useResourceData(
    projects,
    initialData,
    dynamicGanttRange?.today || todayStr,
    loadScopeEndDate
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <ResourceSummaryBar data={resourceData} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex flex-col min-h-0 relative z-20 overflow-hidden flex-shrink-0"
          style={{ width: `${treeWidth}px` }}
        >
          <ResourceList
            data={resourceData}
            width={treeWidth}
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
              data={resourceData}
              range={dynamicGanttRange}
              initialData={initialData}
              showTodayHighlight={showTodayHighlight}
              showMarkers={showMarkers}
              isDarkMode={isDarkMode}
              showResourceTaskType={showResourceTaskType}
              colorByTask={colorByTask}
              loadScopeEndDate={loadScopeEndDate}
              scale={scale}
              onScroll={onGanttScroll}
              ganttRef={ganttRef}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
