import React, { useMemo, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, parseISO } from 'date-fns';
import { InitialData } from '../../types';
import { GanttRange } from '../../types/wbs';
import { ResourceRow, ResourceSubtask } from '../../pages/mainboard/useResourceData';
import { CELL_WIDTH } from '../../hooks/useGanttDrag';
import GanttHeader from '../GanttHeader';
import GanttBackground from '../GanttBackground';
import GanttBar from '../GanttBar';

interface ResourceGanttProps {
  data: ResourceRow[];
  range: GanttRange;
  initialData: InitialData | null;
  showTodayHighlight: boolean;
  isDarkMode: boolean;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  ganttRef: React.RefObject<HTMLDivElement | null>;
  onRefresh: () => void;
}

export default function ResourceGantt({
  data,
  range,
  initialData,
  showTodayHighlight,
  isDarkMode,
  onScroll,
  ganttRef,
  onRefresh
}: ResourceGanttProps) {
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);

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

  const baseDate = useMemo(() => range.start_date ? parseISO(range.start_date) : new Date(), [range.start_date]);
  const totalWidth = useMemo(() => days.length * CELL_WIDTH, [days]);

  const getStatusColor = useCallback((statusId: number | null | undefined): string => {
    if (statusId === null || statusId === undefined) return isDarkMode ? '#334155' : '#cbd5e1';
    let color = initialData?.statuses.find(s => s.id === statusId)?.color_code || '#a0aec0';
    if (!color.startsWith('#')) color = '#' + color;
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color;
  }, [initialData, isDarkMode]);

  const doneStatusId = initialData?.status_mapping_done ? Number.parseInt(initialData.status_mapping_done, 10) : null;
  const newStatusId = initialData?.statuses.find(s => s.status_name === 'New')?.id;
  const todayStr = range.today || new Date().toISOString().split('T')[0];

  const checkIsDelayed = useCallback((subtask: ResourceSubtask) => {
    const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
    const isNew = newStatusId !== undefined && subtask.status_id === newStatusId;
    const isStartDelayed = isNew && !!subtask.planned_start_date && subtask.planned_start_date < todayStr;
    const isEndOverdue = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
    return isStartDelayed || isEndOverdue;
  }, [doneStatusId, newStatusId, todayStr]);

  // Heatmap rendering function
  const renderHeatmap = useCallback((row: ResourceRow) => {
    const capacities = new Map<string, number>();

    // Accumulate planned_effort_days for each day the subtasks span
    row.subtasks.forEach(task => {
      if (task.planned_start_date && task.planned_end_date) {
        const start = task.planned_start_date < task.planned_end_date ? task.planned_start_date : task.planned_end_date;
        const end = task.planned_start_date < task.planned_end_date ? task.planned_end_date : task.planned_start_date;
        let d = parseISO(start);
        const endD = parseISO(end);
        
        while (differenceInCalendarDays(endD, d) >= 0) {
          const dStr = format(d, 'yyyy-MM-dd');
          capacities.set(dStr, (capacities.get(dStr) || 0) + (task.planned_effort_days || 0));
          d = addDays(d, 1);
        }
      } else if (task.planned_start_date) {
         capacities.set(task.planned_start_date, (capacities.get(task.planned_start_date) || 0) + (task.planned_effort_days || 0));
      } else if (task.planned_end_date) {
         capacities.set(task.planned_end_date, (capacities.get(task.planned_end_date) || 0) + (task.planned_effort_days || 0));
      }
    });

    const cells = [];
    let currentX = 0;

    for (let i = 0; i < days.length; i++) {
        const dateStr = format(days[i], 'yyyy-MM-dd');
        const effortSum = capacities.get(dateStr) || 0;
        
        if (effortSum > 1.0) {
            cells.push(
                <div 
                    key={`heatmap-${dateStr}`}
                    className="absolute bg-rose-500/10 dark:bg-rose-500/20 top-0 bottom-0 pointer-events-none"
                    style={{ left: `${currentX}px`, width: `${CELL_WIDTH}px` }}
                />
            );
        }
        currentX += CELL_WIDTH;
    }
    return cells;
  }, [days]);

  return (
    <div className="h-full w-full overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div ref={ganttRef} className="h-full overflow-auto relative gantt-body" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          <GanttHeader
            days={days}
            cellWidth={CELL_WIDTH}
            initialData={initialData}
            showMarkers={true}
            dragState={null}
            tempDates={{}}
            onDateClick={() => {}}
            setHoveredDate={setHoveredDate}
            handleMouseDown={() => {}}
          />

          <GanttBackground
            days={days}
            cellWidth={CELL_WIDTH}
            initialData={initialData}
            range={range}
            hoveredDate={hoveredDate}
            showTodayHighlight={showTodayHighlight}
            showMarkers={true}
            showProjectRange={false}
            projects={[]}
            getStatusColor={getStatusColor}
            dragState={null}
            tempDates={{}}
          />

          <div className="relative z-10 pb-[100px]">
            {data.map((row) => (
              <div key={row.assignee?.id ?? 'unassigned'} className="relative group/ganttrow">
                {/* Header row area (Heatmap goes here) */}
                <div className="relative h-[37px] border-b border-gray-100 dark:border-slate-800/50">
                   {renderHeatmap(row)}
                </div>

                {/* Tracks Rows */}
                {row.tracks.map((track, trackIndex) => (
                  <div 
                    key={`track-${trackIndex}`} 
                    className="relative h-[37px] border-b border-gray-100 dark:border-slate-800/50 w-full pointer-events-auto"
                  >
                    {track.map((subtask) => {
                      const isDelayed = checkIsDelayed(subtask);
                      return (
                        <div key={`r-s-${subtask.id}`} className="absolute top-0 left-0 w-full h-full">
                          <GanttBar
                            item={subtask}
                            itemType="subtask"
                            baseDate={baseDate}
                            cellWidth={CELL_WIDTH}
                            initialData={initialData}
                            tempDates={{}}
                            dragState={null}
                            isDarkMode={isDarkMode}
                            showProgressRate={false}
                            showAssigneeName={false}
                            getStatusColor={getStatusColor}
                            handleMouseDown={() => {}}
                            customLabel={`${initialData?.subtask_types.find(t => t.id === subtask.subtask_type_id)?.type_name || ''} : ${subtask.project_name || ''}`}
                            isDelayedHighlight={isDelayed}
                            isResourceView={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
