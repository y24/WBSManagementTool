import React, { useMemo, forwardRef, useState, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, parseISO, startOfDay, eachDayOfInterval, isSameDay, isWeekend, subDays } from 'date-fns';
import { Project, Subtask, Task, GanttRange } from '../types/wbs';
import { InitialData } from '../types';
import MarkerModal from './MarkerModal';
import { apiClient } from '../api/client';
import { useGanttDrag, CELL_WIDTH } from '../hooks/useGanttDrag';
import GanttBar from './GanttBar';
import GanttHeader from './GanttHeader';
import GanttBackground from './GanttBackground';
import { addBusinessDays } from './WBSTree/utils';

interface GanttChartProps {
  projects: Project[];
  initialData: InitialData | null;
  range: GanttRange;
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  showProjectRange: boolean;
  showTodayHighlight: boolean;
  showAssigneeName?: boolean;
  showProgressRate?: boolean;
  showMarkers?: boolean;
  isDarkMode?: boolean;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onRefresh?: () => void;
}

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({
  projects,
  initialData,
  range,
  expandedProjects,
  expandedTasks,
  showProjectRange,
  showTodayHighlight,
  showAssigneeName = false,
  showProgressRate = false,
  showMarkers = true,
  isDarkMode = false,
  onScroll,
  onRefresh
}, ref) => {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);

  // Drag logic
  const { dragState, tempDates, handleMouseDown } = useGanttDrag(initialData, onRefresh);

  const days = useMemo(() => {
    if (!range.start_date || !range.end_date) return [];
    try {
      const start = parseISO(range.start_date);
      const end = parseISO(range.end_date);
      const totalDays = differenceInCalendarDays(end, start) + 1;
      return Array.from({ length: totalDays }).map((_, i) => addDays(start, i));
    } catch {
      return [];
    }
  }, [range]);

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
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save marker:', err);
      alert('マーカーの保存に失敗しました。');
    }
  };

  const handleMarkerDelete = async (id: number) => {
    try {
      await apiClient.delete(`/markers/${id}`);
      setIsMarkerModalOpen(false);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete marker:', err);
      alert('マーカーの削除に失敗しました。');
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

  const baseDate = useMemo(() => range.start_date ? parseISO(range.start_date) : new Date(), [range.start_date]);

  const isRowEmpty = useCallback((item: any) => {
    return !item.planned_start_date && !item.planned_end_date && 
           !item.actual_start_date && !item.actual_end_date;
  }, []);

  const handleRowDoubleClick = useCallback(async (e: React.MouseEvent, item: Task | Subtask, itemType: 'task' | 'subtask') => {
    // すでに計画か実績が入力されている場合はダブルクリックしても何も反応しなくて良い
    if (!isRowEmpty(item)) {
      return;
    }

    e.stopPropagation();

    // Get the click position relative to the Gantt area
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const dayIndex = Math.floor(offsetX / CELL_WIDTH);
    
    const clickDate = addDays(baseDate, dayIndex);
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
        planned_end_date: endStr
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
        const temp = tempDates[item.id];
        const dates = {
          pS: temp?.planned_start_date || item.planned_start_date,
          pE: temp?.planned_end_date || item.planned_end_date,
          aS: temp?.actual_start_date || item.actual_start_date,
          aE: temp?.actual_end_date || item.actual_end_date,
          rS: temp?.review_start_date || item.review_start_date,
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
        const left = differenceInCalendarDays(new Date(min), baseDate) * CELL_WIDTH;
        const width = (differenceInCalendarDays(new Date(max), new Date(min)) + 1) * CELL_WIDTH;
        acc[project.id] = { left, width, status_id: project.status_id };
      }
      return acc;
    }, {} as Record<number, { left: number; width: number; status_id?: number | null }>);
  }, [projects, range.start_date, tempDates]);

  const totalWidth = useMemo(() => days.length * CELL_WIDTH, [days]);
  const commonRowClasses = "transition-colors h-[37px]";

  return (
    <div className="h-full w-full overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div ref={ref} className="h-full overflow-y-auto overflow-x-scroll relative gantt-body" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          <GanttHeader
            days={days}
            cellWidth={CELL_WIDTH}
            initialData={initialData}
            showMarkers={showMarkers}
            onDateClick={(d) => {
              setSelectedDate(d);
              setIsMarkerModalOpen(true);
            }}
            setHoveredDate={setHoveredDate}
            handleMouseDown={handleMouseDown}
            dragState={dragState}
            tempDates={tempDates}
          />

          <GanttBackground
            days={days}
            cellWidth={CELL_WIDTH}
            initialData={initialData}
            range={range}
            hoveredDate={hoveredDate}
            showTodayHighlight={showTodayHighlight}
            showMarkers={showMarkers}
            dragState={dragState}
            tempDates={tempDates}
          />

          {/* 要素行の描画 (z-10) */}
          <div className="relative z-10">
            {projects.map(project => {
              const pRange = projectDisplayRanges[project.id];
              return (
                <div key={`p-wrapper-${project.id}`} className="relative group/p-wrapper">
                  {/* プロジェクト期間ハイライト (そのプロジェクトの行範囲内のみ) */}
                  {showProjectRange && pRange && (
                    <div 
                      className="wbs-project-range-highlight"
                      style={{
                        left: `${pRange.left}px`,
                        width: `${pRange.width}px`,
                        top: 0,
                        bottom: 0,
                        zIndex: 0, // z-10の要素行よりも背面
                        '--highlight-bg': `${getStatusColor(pRange.status_id)}26`,
                        '--highlight-border': `${getStatusColor(pRange.status_id)}73`
                      } as React.CSSProperties}
                    />
                  )}
                  
                  <div className={`${commonRowClasses} wbs-row-project relative z-10`}>
                    <GanttBar
                      item={project}
                      itemType="project"
                      baseDate={baseDate}
                      cellWidth={CELL_WIDTH}
                      initialData={initialData}
                      tempDates={tempDates}
                      dragState={dragState}
                      isDarkMode={!!isDarkMode}
                      showProgressRate={showProgressRate}
                      showAssigneeName={showAssigneeName}
                      handleMouseDown={handleMouseDown}
                      getStatusColor={getStatusColor}
                      isExpanded={expandedProjects[project.id] !== false}
                    />
                  </div>

                  {expandedProjects[project.id] !== false && project.tasks.map(task => (
                    <div key={`t-wrapper-${task.id}`}>
                      <div 
                        className={`${commonRowClasses} wbs-row-task relative z-10 w-full pointer-events-auto select-none`}
                        onDoubleClick={(e) => handleRowDoubleClick(e, task, 'task')}
                      >
                        <GanttBar
                          item={{ ...task, project_name: project.project_name }}
                          itemType="task"
                          baseDate={baseDate}
                          cellWidth={CELL_WIDTH}
                          initialData={initialData}
                          tempDates={tempDates}
                          dragState={dragState}
                          isDarkMode={!!isDarkMode}
                          showProgressRate={showProgressRate}
                          showAssigneeName={showAssigneeName}
                          handleMouseDown={handleMouseDown}
                          getStatusColor={getStatusColor}
                          isExpanded={expandedTasks[task.id] !== false}
                        />
                      </div>

                      {expandedTasks[task.id] !== false && task.subtasks.map(subtask => {
                        const typeName = initialData?.subtask_types.find(t => t.id === subtask.subtask_type_id)?.type_name;
                        return (
                          <div 
                            key={`s-${subtask.id}`} 
                            className={`${commonRowClasses} wbs-row-subtask relative z-10 w-full pointer-events-auto select-none ${isRowEmpty(subtask) ? 'wbs-row-empty' : ''}`}
                            onDoubleClick={(e) => handleRowDoubleClick(e, subtask, 'subtask')}
                            title={isRowEmpty(subtask) ? (typeName ? `ダブルクリックで計画を入力: ${typeName}` : 'ダブルクリックで計画を入力') : undefined}
                          >
                            <GanttBar
                              item={{ ...subtask, project_name: project.project_name, task_name: task.task_name }}
                              itemType="subtask"
                              baseDate={baseDate}
                              cellWidth={CELL_WIDTH}
                              initialData={initialData}
                              tempDates={tempDates}
                              dragState={dragState}
                              isDarkMode={!!isDarkMode}
                              showProgressRate={showProgressRate}
                              showAssigneeName={showAssigneeName}
                              handleMouseDown={handleMouseDown}
                              getStatusColor={getStatusColor}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
          existingMarker={initialData?.markers?.find(m => m.marker_date === format(selectedDate, 'yyyy-MM-dd'))}
          onSave={handleMarkerSave}
          onDelete={handleMarkerDelete}
          onClose={() => setIsMarkerModalOpen(false)}
        />
      )}
    </div>
  );
});

export default GanttChart;
