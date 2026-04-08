import React, { UIEvent, useMemo } from 'react';
import ResourceList from './ResourceList';
import ResourceGantt from './ResourceGantt';
import { useResourceData } from '../../pages/mainboard/useResourceData';
import { Project, GanttRange } from '../../types/wbs';
import { InitialData } from '../../types';

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
  overlapThreshold: number;
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
  overlapThreshold,
  onListScroll,
  onGanttScroll,
  onRefresh
}: ResourceBoardProps) {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Use the custom hook to transform data for Resource View
  const resourceData = useResourceData(projects, initialData, dynamicGanttRange?.today || todayStr);

  return (
    <>
      <div
        className="flex flex-col relative z-20 overflow-hidden flex-shrink-0"
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

      <div className="flex-1 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col z-10 w-0 transition-colors">
        {dynamicGanttRange && (
          <ResourceGantt
            data={resourceData}
            range={dynamicGanttRange}
            initialData={initialData}
            showTodayHighlight={showTodayHighlight}
            showMarkers={showMarkers}
            isDarkMode={isDarkMode}
            overlapThreshold={overlapThreshold}
            onScroll={onGanttScroll}
            ganttRef={ganttRef}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </>
  );
}
