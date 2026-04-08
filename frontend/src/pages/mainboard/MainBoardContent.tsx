import { Dispatch, RefObject, SetStateAction, UIEvent } from 'react';
import WBSTree from '../../components/WBSTree';
import GanttChart from '../../components/GanttChart';
import ResourceBoard from '../../components/ResourceView/ResourceBoard';
import { DisplayOptions } from '../../components/FilterPanel';
import { InitialData } from '../../types';
import { GanttRange, Project } from '../../types/wbs';

interface MainBoardContentProps {
  displayOptions: DisplayOptions;
  treeWidth: number;
  setIsResizing: Dispatch<SetStateAction<boolean>>;
  treeRef: RefObject<HTMLDivElement | null>;
  ganttRef: RefObject<HTMLDivElement | null>;
  filteredProjects: Project[];
  initialData: InitialData | null;
  onUpdate: (isInitial?: boolean) => Promise<void>;
  expandedProjects: Record<number, boolean>;
  setExpandedProjects: Dispatch<SetStateAction<Record<number, boolean>>>;
  expandedTasks: Record<number, boolean>;
  setExpandedTasks: Dispatch<SetStateAction<Record<number, boolean>>>;
  dynamicGanttRange?: GanttRange;
  onTreeScroll: (e: UIEvent<HTMLDivElement>) => void;
  onGanttScroll: (e: UIEvent<HTMLDivElement>) => void;
}

export default function MainBoardContent({
  displayOptions,
  treeWidth,
  setIsResizing,
  treeRef,
  ganttRef,
  filteredProjects,
  initialData,
  onUpdate,
  expandedProjects,
  setExpandedProjects,
  expandedTasks,
  setExpandedTasks,
  dynamicGanttRange,
  onTreeScroll,
  onGanttScroll,
}: MainBoardContentProps) {
  if (displayOptions.viewMode === 'resource') {
    return (
      <div className="flex flex-1 w-full bg-white dark:bg-slate-900 relative overflow-hidden select-none transition-colors">
        <ResourceBoard
          projects={filteredProjects}
          initialData={initialData}
          treeWidth={treeWidth}
          setIsResizing={setIsResizing}
          listRef={treeRef}
          ganttRef={ganttRef}
          dynamicGanttRange={dynamicGanttRange}
          showTodayHighlight={displayOptions.showTodayHighlight}
          showMarkers={displayOptions.showMarkers}
          isDarkMode={displayOptions.isDarkMode}
          overlapThreshold={displayOptions.overlapThreshold}
          onListScroll={onTreeScroll}
          onGanttScroll={onGanttScroll}
          onRefresh={() => onUpdate(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full bg-white dark:bg-slate-900 relative overflow-hidden select-none transition-colors">
      <div
        className={`flex flex-col relative z-20 overflow-hidden ${displayOptions.showGanttChart ? 'flex-shrink-0' : 'flex-1'}`}
        style={{ width: displayOptions.showGanttChart ? `${treeWidth}px` : '100%' }}
      >
        <WBSTree
          ref={treeRef}
          projects={filteredProjects}
          initialData={initialData}
          onUpdate={onUpdate}
          expandedProjects={expandedProjects}
          setExpandedProjects={setExpandedProjects}
          expandedTasks={expandedTasks}
          setExpandedTasks={setExpandedTasks}
          hidePlanningColumns={displayOptions.hidePlanningColumns}
          isPlanningMode={displayOptions.isPlanningMode}
          onScroll={onTreeScroll}
        />
      </div>

      {displayOptions.showGanttChart && (
        <>
          <div
            className="w-1.5 bg-gray-200 dark:bg-slate-800 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors z-30 flex items-center justify-center shrink-0"
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
            }}
          />

          <div className="flex-1 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col z-10 w-0 transition-colors">
            {dynamicGanttRange && (
              <GanttChart
                ref={ganttRef}
                projects={filteredProjects}
                initialData={initialData}
                range={dynamicGanttRange}
                expandedProjects={expandedProjects}
                expandedTasks={expandedTasks}
                showProjectRange={displayOptions.showProjectRange}
                showTodayHighlight={displayOptions.showTodayHighlight}
                showAssigneeName={displayOptions.showAssigneeName}
                showProgressRate={displayOptions.showProgressRate}
                showMarkers={displayOptions.showMarkers}
                isDarkMode={displayOptions.isDarkMode}
                onScroll={onGanttScroll}
                onRefresh={() => onUpdate(false)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
