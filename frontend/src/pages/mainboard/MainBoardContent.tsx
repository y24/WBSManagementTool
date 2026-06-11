import React, { Dispatch, RefObject, SetStateAction, UIEvent, useRef } from 'react';
import WBSTree from '../../components/WBSTree';
import GanttChart from '../../components/GanttChart';
import ResourceBoard from '../../components/ResourceView/ResourceBoard';
import { DisplayOptions } from '../../components/FilterPanel';
import { InitialData, Marker } from '../../types';
import { GanttRange, Project } from '../../types/wbs';

type WBSRefreshOptions = boolean | {
  showLoading?: boolean;
  skipStatusAutoRefresh?: boolean;
};

interface MainBoardContentProps {
  displayOptions: DisplayOptions;
  treeWidth: number;
  setIsResizing: Dispatch<SetStateAction<boolean>>;
  treeRef: RefObject<HTMLDivElement | null>;
  ganttRef: RefObject<HTMLDivElement | null>;
  filteredProjects: Project[];
  initialData: InitialData | null;
  markers: Marker[];
  onUpdate: (options?: WBSRefreshOptions) => Promise<void>;
  onMarkerRefresh: () => void;
  onLocalUpdate: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, unknown>) => void;
  onLocalReorder: (newProjects: Project[]) => void;
  expandedProjects: Record<number, boolean>;
  setExpandedProjects: Dispatch<SetStateAction<Record<number, boolean>>>;
  expandedTasks: Record<number, boolean>;
  setExpandedTasks: Dispatch<SetStateAction<Record<number, boolean>>>;
  dynamicGanttRange?: GanttRange;
  currentTodayStr: string;
  onTreeScroll: (e: UIEvent<HTMLDivElement>) => void;
  onGanttScroll: (e: UIEvent<HTMLDivElement>) => void;
  isInitialLoading?: boolean;
}

const MainBoardContent: React.FC<MainBoardContentProps> = ({
  displayOptions,
  treeWidth,
  setIsResizing,
  treeRef,
  ganttRef,
  filteredProjects,
  initialData,
  markers,
  onUpdate,
  onMarkerRefresh,
  onLocalUpdate,
  onLocalReorder,
  expandedProjects,
  setExpandedProjects,
  expandedTasks,
  setExpandedTasks,
  dynamicGanttRange,
  currentTodayStr,
  onTreeScroll,
  onGanttScroll,
  isInitialLoading = false,
}) => {
  const isResourceView = displayOptions.viewMode === 'resource';
  const mountedViewsRef = useRef({
    wbs: !isResourceView,
    resource: isResourceView,
  });
  const inactiveTreeRef = useRef<HTMLDivElement | null>(null);
  const inactiveGanttRef = useRef<HTMLDivElement | null>(null);

  mountedViewsRef.current.wbs ||= !isResourceView;
  mountedViewsRef.current.resource ||= isResourceView;

  return (
    <div className="flex flex-1 min-h-0 w-full bg-white dark:bg-slate-900 relative overflow-hidden select-none transition-colors">
      {mountedViewsRef.current.resource && (
        <div className={`contents ${isResourceView ? '' : 'hidden'}`} aria-hidden={!isResourceView}>
        <ResourceBoard
          projects={filteredProjects}
          initialData={initialData}
          markers={markers}
          treeWidth={treeWidth}
          setIsResizing={setIsResizing}
          listRef={isResourceView ? treeRef : inactiveTreeRef}
          ganttRef={isResourceView ? ganttRef : inactiveGanttRef}
          dynamicGanttRange={dynamicGanttRange}
          currentTodayStr={currentTodayStr}
          showTodayHighlight={displayOptions.showTodayHighlight}
          showMarkers={displayOptions.showMarkers}
          isDarkMode={displayOptions.isDarkMode}
          showResourceTaskType={displayOptions.showResourceTaskType}
          showResourceScopeMask={displayOptions.showResourceScopeMask}
          highlightResourceDelayedTasks={displayOptions.highlightResourceDelayedTasks}
          resourceLoadScope={displayOptions.resourceLoadScope}
          scale={displayOptions.ganttScale}
          onListScroll={onTreeScroll}
          onGanttScroll={onGanttScroll}
          onRefresh={() => onUpdate(false)}
          onLocalUpdate={onLocalUpdate}
        />
        </div>
      )}

      {mountedViewsRef.current.wbs && (
        <div className={`contents ${!isResourceView ? '' : 'hidden'}`} aria-hidden={isResourceView}>
      <div
        className={`flex flex-col min-h-0 relative z-20 overflow-hidden ${displayOptions.showGanttChart ? 'flex-shrink-0' : 'flex-1'}`}
        style={{ width: displayOptions.showGanttChart ? `${treeWidth}px` : '100%' }}
      >
        <WBSTree
          ref={!isResourceView ? treeRef : inactiveTreeRef}
          projects={filteredProjects}
          initialData={initialData}
          onUpdate={onUpdate}
          onLocalUpdate={onLocalUpdate}
          onLocalReorder={onLocalReorder}
          expandedProjects={expandedProjects}
          setExpandedProjects={setExpandedProjects}
          expandedTasks={expandedTasks}
          setExpandedTasks={setExpandedTasks}
          hidePlanningColumns={displayOptions.hidePlanningColumns}
          isPlanningMode={displayOptions.isPlanningMode}
          displayOptions={displayOptions}
          currentTodayStr={currentTodayStr}
          onScroll={onTreeScroll}
          isInitialLoading={isInitialLoading}
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

          <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col z-10 w-0 transition-colors">
            {dynamicGanttRange && (
              <GanttChart
                ref={!isResourceView ? ganttRef : inactiveGanttRef}
                projects={filteredProjects}
                initialData={initialData}
                markers={markers}
                range={dynamicGanttRange}
                currentTodayStr={currentTodayStr}
                expandedProjects={expandedProjects}
                expandedTasks={expandedTasks}
                showTodayHighlight={displayOptions.showTodayHighlight}
                showAssigneeName={displayOptions.showAssigneeName}
                showProgressRate={displayOptions.showProgressRate}
                showMarkers={displayOptions.showMarkers}
                scale={displayOptions.ganttScale}
                colorMode={displayOptions.colorMode}
                highlightSameAssignee={displayOptions.highlightSameAssignee}
                highlightDelayedTasks={displayOptions.highlightDelayedTasks}
                showInterruptionReason={displayOptions.showInterruptionReason}
                isDarkMode={displayOptions.isDarkMode}
                onScroll={onGanttScroll}
                onRefresh={() => onUpdate(false)}
                onMarkerRefresh={onMarkerRefresh}
                onLocalUpdate={onLocalUpdate}
              />
            )}
          </div>
        </>
      )}
        </div>
      )}
    </div>
  );
};

export default React.memo(MainBoardContent);
