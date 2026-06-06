import React, { useMemo, forwardRef, useState, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, parseISO, startOfDay, eachDayOfInterval, isSameDay, isWeekend, subDays, startOfWeek } from 'date-fns';
import { Project, Subtask, Task, GanttRange } from '../types/wbs';
import { InitialData, Marker } from '../types';
import MarkerModal from './MarkerModal';
import { apiClient } from '../api/client';
import { useGanttDrag } from '../hooks/useGanttDrag';
import GanttBar from './GanttBar';
import GanttHeader from './GanttHeader';
import GanttBackground from './GanttBackground';
import { addBusinessDays } from './WBSTree/utils';
import GanttDateTooltip from './GanttDateTooltip';
import { GanttScale } from '../types/wbs';
import { getScaleCellWidth, getDateX, getDateWidth, getGanttUnits } from '../utils/ganttUtils';
import { getDisplayActualEndDate } from '../utils/ganttDateRange';
import { showErrorToastUnlessNetworkError } from '../utils/toast';
import ResourceTaskContextMenu, { ContextMenuSubtask } from './ResourceView/ResourceTaskContextMenu';

interface GanttChartProps {
  projects: Project[];
  initialData: InitialData | null;
  markers: Marker[];
  range: GanttRange;
  currentTodayStr: string;
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  showProjectRange: boolean;
  showTodayHighlight: boolean;
  showAssigneeName?: boolean;
  showProgressRate?: boolean;
  showMarkers?: boolean;
  scale: GanttScale;
  colorMode?: 'status' | 'assignee';
  highlightSameAssignee?: boolean;
  highlightDelayedTasks?: boolean;
  showInterruptionReason?: boolean;
  isDarkMode?: boolean;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onRefresh?: () => void;
  onMarkerRefresh?: () => void;
  onLocalUpdate?: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, unknown>) => void;
}

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({
  projects,
  initialData,
  markers,
  range,
  currentTodayStr,
  expandedProjects,
  expandedTasks,
  showProjectRange,
  showTodayHighlight,
  showAssigneeName = false,
  showProgressRate = false,
  showMarkers = true,
  scale,
  colorMode = 'status',
  highlightSameAssignee = false,
  highlightDelayedTasks = true,
  showInterruptionReason = false,
  isDarkMode = false,
  onScroll,
  onRefresh,
  onMarkerRefresh,
  onLocalUpdate
}, ref) => {
  const [hoveredDateInfo, setHoveredDateInfo] = useState<{ date: string; x: number; y: number } | null>(null);
  const hoveredDate = hoveredDateInfo?.date ?? null;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [hoveredAssigneeId, setHoveredAssigneeId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    subtask: ContextMenuSubtask;
    x: number;
    y: number;
  } | null>(null);

  // Drag logic
  const { dragState, tempDates, handleMouseDown } = useGanttDrag(initialData, scale, onRefresh, onMarkerRefresh);

  const days = useMemo(() => {
    if (!range.start_date || !range.end_date) return [];
    return getGanttUnits(range.start_date, range.end_date, scale);
  }, [range, scale]);

  const cellWidth = getScaleCellWidth(scale);

  const handleMarkerSave = async (name: string, note: string, color: string) => {
    if (!selectedDate) return;
    try {
      await apiClient.post('/markers', {
        marker_date: format(selectedDate, 'yyyy-MM-dd'),
        name,
        note,
        color
      });
      setIsMarkerModalOpen(false);
      onMarkerRefresh?.();
    } catch (err) {
      console.error('Failed to save marker:', err);
      showErrorToastUnlessNetworkError(err, 'マーカーの保存に失敗しました。');
    }
  };

  const handleMarkerDelete = async (id: number) => {
    try {
      await apiClient.delete(`/markers/${id}`);
      setIsMarkerModalOpen(false);
      onMarkerRefresh?.();
    } catch (err) {
      console.error('Failed to delete marker:', err);
      showErrorToastUnlessNetworkError(err, 'マーカーの削除に失敗しました。');
    }
  };

  const getStatusColor = useCallback((statusId: number | null | undefined): string => {
    if (statusId === null || statusId === undefined) return isDarkMode ? '#334155' : '#cbd5e1';
    let color = initialData?.statuses.find(s => s.id === statusId)?.color_code || '#a0aec0';
    if (!color.startsWith('#')) color = '#' + color;
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color;
  }, [initialData, isDarkMode]);

  const normalizeColor = useCallback((color: string | null | undefined, fallback: string): string => {
    let normalized = color || fallback;
    if (!normalized.startsWith('#')) normalized = '#' + normalized;
    if (normalized.length === 4) {
      normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
    }
    return normalized;
  }, []);

  const getAssigneeColor = useCallback((assigneeId: number | null | undefined): string => {
    if (!assigneeId) return isDarkMode ? '#334155' : '#cbd5e1';
    const memberColor = initialData?.members.find(m => m.id === assigneeId)?.color_code;
    return normalizeColor(memberColor, '#9ca3af');
  }, [initialData, isDarkMode, normalizeColor]);

  const handleSubtaskContextMenu = useCallback((
    event: React.MouseEvent,
    subtask: Subtask,
    project: Project,
    task: Task,
    subtaskTypeName?: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      subtask: {
        ...subtask,
        project_name: project.project_name,
        task_name: task.task_name,
        subtask_type_name: subtaskTypeName,
      },
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const baseDate = useMemo(() => range.start_date ? parseISO(range.start_date) : new Date(), [range.start_date]);

  const isRowEmpty = useCallback((item: any) => {
    return !item.planned_start_date && !item.planned_end_date && 
           !item.actual_start_date && !item.actual_end_date;
  }, []);

  const todayStr = currentTodayStr;
  const doneStatusId = useMemo(() => initialData?.status_mapping_done ? Number.parseInt(initialData.status_mapping_done, 10) : null, [initialData]);
  const newStatusId = useMemo(() => initialData?.status_mapping_new ? Number.parseInt(initialData.status_mapping_new, 10) : undefined, [initialData]);

  const isDelayed = useCallback((subtask: Subtask) => {
    if (isRowEmpty(subtask)) return false;
    const status = initialData?.statuses.find(s => s.id === subtask.status_id);
    if (status && (status.status_name === 'Done' || status.status_name === 'Removed' || status.status_name === 'Pending')) {
      return false;
    }
    const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
    const isNew = newStatusId !== undefined && subtask.status_id === newStatusId;
    const startDelayed = isNew && !!subtask.planned_start_date && subtask.planned_start_date < todayStr;
    const endDelayed = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
    return startDelayed || endDelayed;
  }, [isRowEmpty, doneStatusId, newStatusId, todayStr, initialData]);

  const handleRowDoubleClick = useCallback(async (e: React.MouseEvent, item: Task | Subtask, itemType: 'task' | 'subtask') => {
    // すでに計画か実績が入力されている場合はダブルクリックしても何も反応しなくて良い
    if (!isRowEmpty(item)) {
      return;
    }

    e.stopPropagation();

    // Get the click position relative to the Gantt area
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    
    // 計画入力は日単位表示（scale === 'day'）と週単位表示（scale === 'week'）の時のみサポートする
    if (scale === 'month') return;
    
    let clickDate: Date;
    if (scale === 'day') {
      const dayIndex = Math.floor(offsetX / getScaleCellWidth('day'));
      clickDate = addDays(baseDate, dayIndex);
    } else if (scale === 'week') {
      const startOfBaseWeek = startOfWeek(baseDate, { weekStartsOn: 1 });
      const daysFromStart = Math.floor(offsetX / (getScaleCellWidth('week') / 7));
      clickDate = addDays(startOfBaseWeek, daysFromStart);
    } else {
      return;
    }
    
    const startDate = clickDate;
    
    // Calculate initial duration based on work_days + review_days
    const workDays = Number((item as any).work_days) || 0;
    const reviewDays = Number((item as any).review_days) || 0;
    const totalDays = workDays + reviewDays;
    
    let endDate: Date;
    if (totalDays > 0) {
      const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
      endDate = addBusinessDays(startDate, totalDays, holidays);
    } else {
      endDate = addDays(startDate, 0); // Default 1 day (ends on the same day)
    }

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    try {
      const endpoint = itemType === 'subtask' ? `/subtasks/${item.id}` : `/tasks/${item.id}`;
      await apiClient.patch(endpoint, {
        planned_start_date: startStr,
        planned_end_date: endStr,
        ...(itemType === 'task' ? { is_auto_planned_date: false } : {})
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to set initial plan:', err);
    }
  }, [baseDate, isRowEmpty, onRefresh]);

  const projectDisplayRanges = useMemo(() => {
    if (!range.start_date || !projects.length) return {};
    const baseDate = parseISO(range.start_date);

    return projects.reduce((acc, project) => {
      const allDates: number[] = [];
      const collect = (item: any) => {
        const dates = {
          pS: item.planned_start_date,
          pE: item.planned_end_date,
          aS: item.actual_start_date,
          aE: item.actual_end_date,
          rS: item.review_start_date,
        };
        Object.values(dates).forEach(v => {
          if (v) {
            const d = parseISO(v as string);
            if (!isNaN(d.getTime())) allDates.push(d.getTime());
          }
        });
      };

      collect(project);
      (project.tasks || []).forEach(t => {
        collect(t);
        (t.subtasks || []).forEach(s => collect(s));
      });

      if (allDates.length > 0) {
        const min = Math.min(...allDates);
        const max = Math.max(...allDates);
        const left = getDateX(new Date(min), baseDate, scale);
        const width = getDateWidth(new Date(min), new Date(max), scale);
        acc[project.id] = { left, width, status_id: project.status_id };
      }
      return acc;
    }, {} as Record<number, { left: number; width: number; status_id?: number | null }>);
  }, [projects, range.start_date, scale]);

  // ホバーされた日のサブタスクを抽出
  const subtasksOnHoveredDate = useMemo(() => {
    if (!hoveredDate || !projects.length) return [];
    
    const results: (Subtask & { project_name: string; task_name: string })[] = [];
    const hDate = hoveredDate; // yyyy-MM-dd

    projects.forEach(project => {
      project.tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
          // ドラッグ中の値があればそれを使う
          const temp = tempDates[subtask.id];
          const ps = temp?.planned_start_date || subtask.planned_start_date;
          const pe = temp?.planned_end_date || subtask.planned_end_date;
          const as = temp?.actual_start_date || subtask.actual_start_date;
          const ae = temp?.actual_end_date || subtask.actual_end_date;
          const rs = temp?.review_start_date || subtask.review_start_date;
          const displayActualEnd = getDisplayActualEndDate({
            actual_start_date: as,
            actual_end_date: ae,
            review_start_date: rs,
          });

          const matchPlanned = ps && pe && hDate >= ps && hDate <= pe;
          const matchActual = as && displayActualEnd && hDate >= as && hDate <= displayActualEnd;

          if (matchPlanned || matchActual) {
            results.push({
              ...subtask,
              project_name: project.project_name,
              task_name: task.task_name
            });
          }
        });
      });
    });

    return results;
  }, [projects, hoveredDate, tempDates]);

  const visibleRows = useMemo(() => {
    const rows: Array<
      | { key: string; itemType: 'project'; project: Project; item: Project }
      | { key: string; itemType: 'task'; project: Project; task: Task; item: Task }
      | { key: string; itemType: 'subtask'; project: Project; task: Task; item: Subtask }
    > = [];

    projects.forEach(project => {
      rows.push({ key: `p-${project.id}`, itemType: 'project', project, item: project });

      if (expandedProjects[project.id] !== false) {
        project.tasks.forEach(task => {
          rows.push({ key: `t-${task.id}`, itemType: 'task', project, task, item: task });

          if (expandedTasks[task.id] !== false) {
            task.subtasks.forEach(subtask => {
              rows.push({ key: `s-${subtask.id}`, itemType: 'subtask', project, task, item: subtask });
            });
          }
        });
      }
    });

    return rows;
  }, [projects, expandedProjects, expandedTasks]);

  const projectRowSpans = useMemo(() => {
    const spans: Record<number, { top: number; height: number }> = {};
    let rowIndex = 0;

    projects.forEach(project => {
      const start = rowIndex;
      rowIndex += 1;

      if (expandedProjects[project.id] !== false) {
        project.tasks.forEach(task => {
          rowIndex += 1;
          if (expandedTasks[task.id] !== false) {
            rowIndex += task.subtasks.length;
          }
        });
      }

      spans[project.id] = {
        top: start * 37,
        height: Math.max(1, rowIndex - start) * 37,
      };
    });

    return spans;
  }, [projects, expandedProjects, expandedTasks]);

  const totalWidth = useMemo(() => {
    if (scale === 'day') return days.length * cellWidth;
    // For week/month, the last unit might end after the range.end_date
    // So we just use its count * cellWidth
    return days.length * cellWidth;
  }, [days, cellWidth, scale]);
  const commonRowClasses = "transition-colors h-[37px]";

  return (
    <div className="h-full min-h-0 w-full overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div ref={ref} className="h-full min-h-0 overflow-y-auto overflow-x-scroll relative gantt-body" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          <GanttHeader
            days={days}
            cellWidth={cellWidth}
            scale={scale}
            initialData={initialData}
            markers={markers}
            showMarkers={showMarkers}
            onDateClick={(d) => {
              setSelectedDate(d);
              setIsMarkerModalOpen(true);
            }}
            setHoveredDate={(date, x, y) => {
              if (date && x !== undefined && y !== undefined) {
                setHoveredDateInfo({ date, x, y });
              } else {
                setHoveredDateInfo(null);
              }
            }}
            handleMouseDown={handleMouseDown}
            dragState={dragState}
            tempDates={tempDates}
            todayStr={todayStr}
          />

          <GanttBackground
            days={days}
            cellWidth={cellWidth}
            scale={scale}
            initialData={initialData}
            markers={markers}
            range={range}
            hoveredDate={hoveredDate}
            showTodayHighlight={showTodayHighlight}
            showMarkers={showMarkers}
            dragState={dragState}
            tempDates={tempDates}
            todayStr={todayStr}
          />

          {/* 要素行の描画 (z-10) */}
          <div className="relative z-10">
            {showProjectRange && projects.map(project => {
              const pRange = projectDisplayRanges[project.id];
              const span = projectRowSpans[project.id];
              if (!pRange || !span) return null;

              return (
                <div 
                  key={`p-range-${project.id}`}
                  className="wbs-project-range-highlight"
                  style={{
                    left: `${pRange.left}px`,
                    width: `${pRange.width}px`,
                    top: `${span.top}px`,
                    height: `${span.height}px`,
                    zIndex: 0,
                    '--highlight-bg': `${getStatusColor(pRange.status_id)}26`,
                    '--highlight-border': `${getStatusColor(pRange.status_id)}73`
                  } as React.CSSProperties}
                />
              );
            })}

            {visibleRows.map(row => {
              if (row.itemType === 'project') {
                const project = row.project;
                return (
                  <div key={row.key} className={`${commonRowClasses} wbs-row-project relative z-10`}>
                    <GanttBar
                      item={project}
                      itemType="project"
                      baseDate={baseDate}
                      cellWidth={cellWidth}
                      scale={scale}
                      initialData={initialData}
                      tempDates={tempDates}
                      dragState={dragState}
                      isDarkMode={!!isDarkMode}
                      showProgressRate={showProgressRate}
                      showAssigneeName={showAssigneeName}
                      handleMouseDown={handleMouseDown}
                      getStatusColor={getStatusColor}
                      getAssigneeColor={getAssigneeColor}
                      colorMode={colorMode}
                      isExpanded={expandedProjects[project.id] !== false}
                      highlightSameAssignee={highlightSameAssignee}
                      hoveredAssigneeId={hoveredAssigneeId}
                      setHoveredAssigneeId={setHoveredAssigneeId}
                    />
                  </div>
                );
              }

              if (row.itemType === 'task') {
                const task = row.task;
                return (
                  <div 
                    key={row.key}
                    className={`${commonRowClasses} wbs-row-task relative z-10 w-full pointer-events-auto select-none`}
                    onDoubleClick={(e) => handleRowDoubleClick(e, task, 'task')}
                  >
                    <GanttBar
                      item={task}
                      itemType="task"
                      projectName={row.project.project_name}
                      baseDate={baseDate}
                      cellWidth={cellWidth}
                      scale={scale}
                      initialData={initialData}
                      tempDates={tempDates}
                      dragState={dragState}
                      isDarkMode={!!isDarkMode}
                      showProgressRate={showProgressRate}
                      showAssigneeName={showAssigneeName}
                      handleMouseDown={handleMouseDown}
                      getStatusColor={getStatusColor}
                      getAssigneeColor={getAssigneeColor}
                      colorMode={colorMode}
                      isExpanded={expandedTasks[task.id] !== false}
                      highlightSameAssignee={highlightSameAssignee}
                      hoveredAssigneeId={hoveredAssigneeId}
                      setHoveredAssigneeId={setHoveredAssigneeId}
                    />
                  </div>
                );
              }

              const subtask = row.item;
              const typeName = initialData?.subtask_types.find(t => t.id === subtask.subtask_type_id)?.type_name;
              const delayed = highlightDelayedTasks && isDelayed(subtask);

              return (
                <div 
                  key={row.key}
                  className={`${commonRowClasses} wbs-row-subtask relative z-10 w-full pointer-events-auto select-none ${isRowEmpty(subtask) && scale !== 'month' ? 'wbs-row-empty' : ''} ${delayed ? 'delayed' : ''}`}
                  onDoubleClick={(e) => handleRowDoubleClick(e, subtask, 'subtask')}
                  title={isRowEmpty(subtask) && scale !== 'month' ? (typeName ? `ダブルクリックで計画を入力: ${typeName}` : 'ダブルクリックで計画を入力') : undefined}
                >
                  <GanttBar
                    item={subtask}
                    itemType="subtask"
                    projectName={row.project.project_name}
                    taskName={row.task.task_name}
                    baseDate={baseDate}
                    cellWidth={cellWidth}
                    scale={scale}
                    initialData={initialData}
                    tempDates={tempDates}
                    dragState={dragState}
                    isDarkMode={!!isDarkMode}
                    showProgressRate={showProgressRate}
                    showAssigneeName={showAssigneeName}
                    handleMouseDown={handleMouseDown}
                    getStatusColor={getStatusColor}
                    getAssigneeColor={getAssigneeColor}
                    colorMode={colorMode}
                    highlightSameAssignee={highlightSameAssignee}
                    hoveredAssigneeId={hoveredAssigneeId}
                    setHoveredAssigneeId={setHoveredAssigneeId}
                    onBarContextMenu={(e) => handleSubtaskContextMenu(e, subtask, row.project, row.task, typeName)}
                  />
                  {showInterruptionReason && subtask.interruptions?.map(inter => {
                    const interDate = parseISO(inter.interruption_date);
                    const x = getDateX(interDate, baseDate, scale);
                    if (x < 0 || x > totalWidth) return null;
                    return (
                      <div
                        key={`inter-${inter.id}`}
                        className="absolute top-0 h-full flex items-center pointer-events-none z-20"
                        style={{ left: `${x}px` }}
                      >
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded shadow-sm ml-1 select-none">
                          <span 
                            className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]"
                            title={inter.reason || undefined}
                          >
                            ⚠️ {inter.reason || '中断'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedDate && (
        <MarkerModal
          isOpen={isMarkerModalOpen}
          date={selectedDate}
          existingMarker={markers.find(m => m.marker_date === format(selectedDate, 'yyyy-MM-dd'))}
          onSave={handleMarkerSave}
          onDelete={handleMarkerDelete}
          onClose={() => setIsMarkerModalOpen(false)}
        />
      )}

      {hoveredDateInfo && (
        <GanttDateTooltip
          date={hoveredDateInfo.date}
          subtasks={subtasksOnHoveredDate}
          mouseX={hoveredDateInfo.x}
          mouseY={hoveredDateInfo.y}
          initialData={initialData}
          isVisible={true}
        />
      )}

      {contextMenu && (
        <ResourceTaskContextMenu
          subtask={contextMenu.subtask}
          initialData={initialData}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRefresh={onRefresh ?? (() => {})}
          onLocalUpdate={onLocalUpdate}
        />
      )}
    </div>
  );
});

export default React.memo(GanttChart);
