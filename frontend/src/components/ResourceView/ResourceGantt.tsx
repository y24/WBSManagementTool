import React, { useMemo, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, parseISO, subDays, isValid, getDaysInMonth } from 'date-fns';
import { InitialData } from '../../types';
import { GanttRange, GanttScale } from '../../types/wbs';
import { ResourceRow, ResourceSubtask } from '../../pages/mainboard/useResourceData';
import { getScaleCellWidth, getDateX, getGanttUnits } from '../../utils/ganttUtils';
import { useGanttDrag } from '../../hooks/useGanttDrag';
import { calculateReviewCalendarDays } from '../WBSTree/utils';
import GanttHeader from '../GanttHeader';
import GanttBackground from '../GanttBackground';
import GanttBar from '../GanttBar';

const RESOURCE_TRACK_HEIGHT = 32;

interface ResourceGanttProps {
  data: ResourceRow[];
  range: GanttRange;
  initialData: InitialData | null;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  overlapThreshold: number;
  scale: GanttScale;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  ganttRef: React.RefObject<HTMLDivElement | null>;
  onRefresh: () => void;
}

export default function ResourceGantt({
  data,
  range,
  initialData,
  showTodayHighlight,
  showMarkers,
  isDarkMode,
  overlapThreshold,
  scale,
  onScroll,
  ganttRef,
  onRefresh
}: ResourceGanttProps) {
  const { dragState, tempDates, handleMouseDown } = useGanttDrag(initialData, scale, onRefresh);
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);

  const days = useMemo(() => {
    if (!range.start_date || !range.end_date) return [];
    return getGanttUnits(range.start_date, range.end_date, scale);
  }, [range, scale]);

  const cellWidth = getScaleCellWidth(scale);

  const baseDate = useMemo(() => range.start_date ? parseISO(range.start_date) : new Date(), [range.start_date]);
  const totalWidth = useMemo(() => days.length * cellWidth, [days, cellWidth]);

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
  const removedStatusId = initialData?.statuses.find(s => s.status_name === 'Removed')?.id ?? 7;
  const todayStr = range.today || new Date().toISOString().split('T')[0];

  const checkIsDelayed = useCallback((subtask: ResourceSubtask) => {
    const status = initialData?.statuses.find(s => s.id === subtask.status_id);
    if (status?.status_name === 'Removed') return false;
    const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
    const isNew = newStatusId !== undefined && subtask.status_id === newStatusId;
    const isStartDelayed = isNew && !!subtask.planned_start_date && subtask.planned_start_date < todayStr;
    const isEndOverdue = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
    return isStartDelayed || isEndOverdue;
  }, [doneStatusId, newStatusId, removedStatusId, todayStr]);

  // Heatmap rendering function
  const renderHeatmap = useCallback((row: ResourceRow) => {
    const overlapsByDay = new Map<string, number>();

    // Count active subtasks per day.
    // If actual_start_date exists, only actual dates are considered (planned dates are ignored).
    row.subtasks.forEach(task => {
      // Skip removed items from heatmap overlap calculation
      const status = initialData?.statuses.find(s => s.id === task.status_id);
      if (status?.status_name === 'Removed') return;

      const hasActual = !!task.actual_start_date;
      const startStr = hasActual ? task.actual_start_date : task.planned_start_date;
      const endStr = hasActual
        ? (task.actual_end_date || task.actual_start_date)
        : (task.planned_end_date || task.planned_start_date);

      if (startStr && endStr) {
        let startDate = parseISO(startStr);
        let endDate = parseISO(endStr);
        
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;

        // レビュー期間を除外
        if (hasActual) {
          if (task.review_start_date) {
            const rsDate = parseISO(task.review_start_date);
            if (isValid(rsDate)) {
              // レビュー開始日の前日までを「作業期間」とする
              endDate = subDays(rsDate, 1);
            }
          }
        } else {
          if (task.review_days && task.review_days > 0) {
            const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
            const r_days_cal = calculateReviewCalendarDays(endDate, task.review_days, holidays);
            // 終了予定日からレビュー（カレンダー日）分を差し引いた日までを「作業期間」とする
            endDate = subDays(endDate, r_days_cal);
          }
        }

        if (differenceInCalendarDays(endDate, startDate) < 0) return;

        // Ensure start <= end to avoid issues
        const realStart = startDate;
        const realEnd = endDate;
        let current = realStart;

        while (differenceInCalendarDays(realEnd, current) >= 0) {
          const dStr = format(current, 'yyyy-MM-dd');
          overlapsByDay.set(dStr, (overlapsByDay.get(dStr) || 0) + 1);
          current = addDays(current, 1);
        }
      } else if (startStr && !hasActual) { // 計画の開始日のみ（新規ステータスなど）
        // レビュー期間の考慮は不要（1日のみなので）
        const startDate = parseISO(startStr);
        if (!Number.isNaN(startDate.getTime())) {
          const dateStr = format(startDate, 'yyyy-MM-dd');
          overlapsByDay.set(dateStr, (overlapsByDay.get(dateStr) || 0) + 1);
        }
      } else if (endStr) {
        const endDate = parseISO(endStr);
        if (!Number.isNaN(endDate.getTime())) {
          const dateStr = format(endDate, 'yyyy-MM-dd');
          overlapsByDay.set(dateStr, (overlapsByDay.get(dateStr) || 0) + 1);
        }
      }
    });

    const cells = [];
    const maxOverlap = Math.max(...Array.from(overlapsByDay.values()), 0);
    let currentX = 0;

    for (let i = 0; i < days.length; i++) {
        const unitStart = days[i];
        
        // 当該セルの期間（日単位）をスキャンして最大重複を出す
        let maxInUnit = 0;
        if (scale === 'day') {
          maxInUnit = overlapsByDay.get(format(unitStart, 'yyyy-MM-dd')) || 0;
        } else if (scale === 'week') {
          for(let d=0; d<7; d++) {
            const dateStr = format(addDays(unitStart, d), 'yyyy-MM-dd');
            maxInUnit = Math.max(maxInUnit, overlapsByDay.get(dateStr) || 0);
          }
        } else if (scale === 'month') {
          const daysInMonth = getDaysInMonth(unitStart);
          for(let d=0; d<daysInMonth; d++) {
            const dateStr = format(addDays(unitStart, d), 'yyyy-MM-dd');
            maxInUnit = Math.max(maxInUnit, overlapsByDay.get(dateStr) || 0);
          }
        }

        if (maxInUnit > overlapThreshold) {
            const normalized =
              maxOverlap > overlapThreshold ? (maxInUnit - overlapThreshold) / (maxOverlap - overlapThreshold) : 0;
            const lightAlpha = 0.04 + (0.16 * normalized);
            const darkAlpha = 0.06 + (0.19 * normalized);
            const backgroundColor = isDarkMode
              ? `rgba(251, 113, 133, ${darkAlpha})`
              : `rgba(244, 63, 94, ${lightAlpha})`;
            const borderAlpha = isDarkMode ? darkAlpha * 0.35 : lightAlpha * 0.3;

            cells.push(
                <div 
                    key={`heatmap-${format(unitStart, 'yyyy-MM-dd')}`}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${currentX}px`,
                      width: `${cellWidth}px`,
                      backgroundColor,
                      boxShadow: `inset 0 0 0 1px rgba(244, 63, 94, ${borderAlpha})`,
                    }}
                />
            );
        }
        currentX += cellWidth;
    }
    return cells;
  }, [days, isDarkMode, overlapThreshold, scale, cellWidth]);

  return (
    <div className="h-full w-full overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div ref={ganttRef} className="h-full overflow-y-auto overflow-x-scroll relative gantt-body" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          <GanttHeader
            days={days}
            cellWidth={cellWidth}
            scale={scale}
            initialData={initialData}
            showMarkers={showMarkers}
            dragState={dragState}
            tempDates={tempDates}
            onDateClick={() => {}}
            setHoveredDate={setHoveredDate}
            handleMouseDown={handleMouseDown}
          />

          <GanttBackground
            days={days}
            cellWidth={cellWidth}
            scale={scale}
            initialData={initialData}
            range={range}
            hoveredDate={hoveredDate}
            showTodayHighlight={showTodayHighlight}
            showMarkers={showMarkers}
            dragState={dragState}
            tempDates={tempDates}
          />

          <div className="relative z-10 pb-[100px]">
            {data.map((row, rowIndex) => (
              <div
                key={row.assignee?.id ?? 'unassigned'}
                className={`relative group/ganttrow ${
                  rowIndex % 2 === 0
                    ? 'bg-slate-50/50 dark:bg-slate-900/30'
                    : 'bg-white/60 dark:bg-slate-950/30'
                }`}
              >
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300/45 via-slate-200/20 to-slate-300/45 dark:from-slate-600/45 dark:via-slate-700/15 dark:to-slate-600/45" />
                <div className="pointer-events-none absolute left-0 right-0 top-0 bottom-0">
                  {renderHeatmap(row)}
                </div>

                {/* Tracks Rows */}
                {row.tracks.map((track, trackIndex) => (
                  <div 
                    key={`track-${trackIndex}`} 
                    className="relative border-b border-slate-200/30 dark:border-slate-800/45 w-full pointer-events-auto"
                    style={{ height: `${RESOURCE_TRACK_HEIGHT}px` }}
                  >
                    {track.map((subtask) => {
                      const isDelayed = checkIsDelayed(subtask);
                      return (
                        <div key={`r-s-${subtask.id}`} className="absolute top-0 left-0 w-full h-full pointer-events-none">
                          <GanttBar
                            item={subtask}
                            itemType="subtask"
                            baseDate={baseDate}
                            cellWidth={cellWidth}
                            scale={scale}
                            initialData={initialData}
                            tempDates={tempDates}
                            dragState={dragState}
                            isDarkMode={isDarkMode}
                            showProgressRate={false}
                            showAssigneeName={false}
                            getStatusColor={getStatusColor}
                            handleMouseDown={handleMouseDown}
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
