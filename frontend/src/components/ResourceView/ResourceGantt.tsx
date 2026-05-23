import React, { useMemo, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, parseISO, subDays, isValid, getDaysInMonth, startOfDay } from 'date-fns';
import { InitialData } from '../../types';
import { GanttRange, GanttScale } from '../../types/wbs';
import { ResourceRow, ResourceSubtask } from '../../pages/mainboard/useResourceData';
import { getScaleCellWidth, getGanttUnits } from '../../utils/ganttUtils';
import { useGanttDrag } from '../../hooks/useGanttDrag';
import { calculateReviewCalendarDays } from '../WBSTree/utils';
import GanttHeader from '../GanttHeader';
import GanttBackground from '../GanttBackground';
import GanttBar from '../GanttBar';

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
};

const PLANNED_TRACK_HEIGHT = 32;
const ACTUAL_TRACK_HEIGHT = 40;
const STACKED_TRACK_HEIGHT = 24;
const STACKED_LANE_VERTICAL_PADDING = 5;

const getPlannedTrackHeight = (row: ResourceRow) => row.plannedTracks.length > 1 ? STACKED_TRACK_HEIGHT : PLANNED_TRACK_HEIGHT;
const getActualTrackHeight = (row: ResourceRow) => row.actualTracks.length > 1 ? STACKED_TRACK_HEIGHT : ACTUAL_TRACK_HEIGHT;
const getLanePadding = (trackCount: number) => trackCount > 1 ? STACKED_LANE_VERTICAL_PADDING * 2 : 0;
const getPlannedLaneHeight = (row: ResourceRow) => Math.max(1, row.plannedTracks.length) * getPlannedTrackHeight(row) + getLanePadding(row.plannedTracks.length);
const getActualLaneHeight = (row: ResourceRow) => Math.max(1, row.actualTracks.length) * getActualTrackHeight(row) + getLanePadding(row.actualTracks.length);

interface ResourceGanttProps {
  data: ResourceRow[];
  range: GanttRange;
  initialData: InitialData | null;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  overlapThreshold: number;
  showResourceTaskType: boolean;
  showResourceOverlapHighlight: boolean;
  highlightResourceUnplanned: boolean;
  colorByTask: boolean;
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
  showResourceTaskType,
  showResourceOverlapHighlight,
  highlightResourceUnplanned,
  colorByTask,
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
  const removedStatusId = useMemo(
    () => initialData?.statuses.find(status => status.status_name === 'Removed')?.id,
    [initialData],
  );
  const holidaySet = useMemo(
    () => new Set(initialData?.holidays.map(holiday => holiday.holiday_date) ?? []),
    [initialData],
  );
  const unitDateKeys = useMemo(() => {
    return days.map(unitStart => {
      const unitDates: string[] = [];
      const unitLength = scale === 'week' ? 7 : scale === 'month' ? getDaysInMonth(unitStart) : 1;
      for (let d = 0; d < unitLength; d++) {
        unitDates.push(format(addDays(unitStart, d), 'yyyy-MM-dd'));
      }
      return {
        key: format(unitStart, 'yyyy-MM-dd'),
        dates: unitDates,
        end: unitLength === 1 ? unitStart : addDays(unitStart, unitLength - 1),
      };
    });
  }, [days, scale]);

  const getStatusColor = useCallback((statusId: number | null | undefined): string => {
    if (statusId === null || statusId === undefined) return isDarkMode ? '#334155' : '#cbd5e1';
    let color = initialData?.statuses.find(s => s.id === statusId)?.color_code || '#a0aec0';
    if (!color.startsWith('#')) color = '#' + color;
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color;
  }, [initialData, isDarkMode]);

  const getAssigneeColor = useCallback((assigneeId: number | null | undefined): string => {
    if (!assigneeId) return isDarkMode ? '#334155' : '#cbd5e1';
    
    const palette = [
      '#6366f1', // Indigo 500
      '#8b5cf6', // Violet 500
      '#ec4899', // Pink 500
      '#f43f5e', // Rose 500
      '#ef4444', // Red 500
      '#f97316', // Orange 500
      '#f59e0b', // Amber 500
      '#eab308', // Yellow 500
      '#84cc16', // Lime 500
      '#22c55e', // Green 500
      '#10b981', // Emerald 500
      '#14b8a6', // Teal 500
      '#06b6d4', // Cyan 500
      '#0ea5e9', // Sky 500
      '#3b82f6', // Blue 500
      '#a855f7', // Purple 500
      '#d946ef', // Fuchsia 500
    ];

    return palette[assigneeId % palette.length];
  }, [isDarkMode]);

  const taskColorPalette = [
    // 隣接する色相が大きく異なるよう配置。落ち着いたトーン（Tableau 10 準拠）
    '#4e79a7', // blue
    '#f28e2b', // orange
    '#59a14f', // green
    '#e05759', // red
    '#76b7b2', // teal
    '#c4a030', // gold
    '#b07aa1', // purple
    '#d37295', // pink
    '#6a9cc5', // sky blue
    '#d47840', // warm orange
    '#4e9050', // mid green
    '#c44e52', // deep red
    '#46a09c', // deep teal
    '#8870c0', // indigo
    '#c47030', // amber
    '#54a07a', // emerald
    '#c46090', // deep pink
  ];

  const getSubtaskColor = useCallback((subtaskId: number | null | undefined): string => {
    if (!subtaskId) return isDarkMode ? '#334155' : '#cbd5e1';
    return taskColorPalette[subtaskId % taskColorPalette.length];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkMode]);

  const getSubtaskColorLight = useCallback((subtaskId: number | null | undefined): string => {
    const base = getSubtaskColor(subtaskId);
    const rgb = hexToRgb(base);
    if (!rgb) return base;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
  }, [getSubtaskColor]);

  // Heatmap rendering function
  const renderHeatmap = useCallback((row: ResourceRow, lane: 'planned' | 'actual') => {
    if (!showResourceOverlapHighlight) return null;

    const overlapsByDay = new Map<string, number>();

    const addDateRangeToHeatmap = (startDate: Date, endDate: Date) => {
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
      if (differenceInCalendarDays(endDate, startDate) < 0) return;

      let current = startDate;
      while (differenceInCalendarDays(endDate, current) >= 0) {
        const dStr = format(current, 'yyyy-MM-dd');
        overlapsByDay.set(dStr, (overlapsByDay.get(dStr) || 0) + 1);
        current = addDays(current, 1);
      }
    };

    const addActualWorkSegmentsToHeatmap = (task: ResourceSubtask, endDate: Date) => {
      if (!task.actual_start_date) return;

      const startDate = parseISO(task.actual_start_date);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;

      if (differenceInCalendarDays(endDate, startDate) < 0) return;

      const interruptions = [...(task.interruptions || [])]
        .filter(interruption => interruption.interruption_date)
        .sort((a, b) => a.interruption_date.localeCompare(b.interruption_date));

      if (interruptions.length === 0) {
        addDateRangeToHeatmap(startDate, endDate);
        return;
      }

      let currentStart = startDate;
      let isClosed = false;

      for (const interruption of interruptions) {
        const interruptionDate = parseISO(interruption.interruption_date);
        if (!isValid(interruptionDate)) continue;

        if (differenceInCalendarDays(interruptionDate, currentStart) >= 0) {
          const segmentEnd = differenceInCalendarDays(endDate, interruptionDate) >= 0 ? interruptionDate : endDate;
          addDateRangeToHeatmap(currentStart, segmentEnd);
          if (segmentEnd.getTime() === endDate.getTime()) {
            isClosed = true;
            break;
          }
        }

        if (!interruption.resumption_date) {
          isClosed = true;
          break;
        }

        const resumptionDate = parseISO(interruption.resumption_date);
        if (!isValid(resumptionDate)) {
          isClosed = true;
          break;
        }

        if (differenceInCalendarDays(resumptionDate, currentStart) > 0) {
          currentStart = resumptionDate;
        }

        if (differenceInCalendarDays(currentStart, endDate) >= 0) break;
      }

      if (!isClosed && differenceInCalendarDays(endDate, currentStart) > 0) {
        addDateRangeToHeatmap(currentStart, endDate);
      }
    };

    // Count active subtasks per day by lane.
    // Planned and actual lanes are evaluated independently so actual-only overlap does not tint planned, and vice versa.
    row.subtasks.forEach(task => {
      // Skip removed items from heatmap overlap calculation
      if (removedStatusId !== undefined && task.status_id === removedStatusId) return;

      const startStr = lane === 'actual' ? task.actual_start_date : task.planned_start_date;
      const endStr = lane === 'actual'
        ? (task.actual_end_date || task.actual_start_date)
        : (task.planned_end_date || task.planned_start_date);

      if (startStr && endStr) {
        const startDate = parseISO(startStr);
        let endDate = parseISO(endStr);
        
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;

        // レビュー期間を除外
        if (lane === 'actual') {
          if (task.review_start_date) {
            const rsDate = parseISO(task.review_start_date);
            if (isValid(rsDate)) {
              // レビュー開始日の前日までを「作業期間」とする
              endDate = subDays(rsDate, 1);
            }
          }
          addActualWorkSegmentsToHeatmap(task, endDate);
          return;
        } else {
          if (task.review_days && task.review_days > 0) {
            const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
            const r_days_cal = calculateReviewCalendarDays(endDate, task.review_days, holidays);
            // 終了予定日からレビュー（カレンダー日）分を差し引いた日までを「作業期間」とする
            endDate = subDays(endDate, r_days_cal);
          }
        }

        if (differenceInCalendarDays(endDate, startDate) < 0) return;

        addDateRangeToHeatmap(startDate, endDate);
      } else if (startStr) { // 開始日のみ
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

    for (let i = 0; i < unitDateKeys.length; i++) {
        const unit = unitDateKeys[i];

        // 当該セルの期間（日単位）をスキャンして最大重複を出す
        let maxInUnit = 0;
        for (const dateStr of unit.dates) {
          maxInUnit = Math.max(maxInUnit, overlapsByDay.get(dateStr) || 0);
        }

        if (maxInUnit > overlapThreshold) {
            const normalized =
              maxOverlap > overlapThreshold ? (maxInUnit - overlapThreshold) / (maxOverlap - overlapThreshold) : 0;
            const lightAlpha = 0.04 + (0.16 * normalized);
            const darkAlpha = 0.06 + (0.19 * normalized);
            const backgroundColor = isDarkMode
              ? `rgba(251, 191, 36, ${darkAlpha})`
              : `rgba(245, 158, 11, ${lightAlpha})`;
            const borderAlpha = isDarkMode ? darkAlpha * 0.35 : lightAlpha * 0.3;

            cells.push(
                <div 
                    key={`heatmap-${unit.key}`}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${i * cellWidth}px`,
                      width: `${cellWidth}px`,
                      backgroundColor,
                      boxShadow: `inset 0 0 0 1px rgba(245, 158, 11, ${borderAlpha})`,
                    }}
                />
            );
        }
    }
    return cells;
  }, [cellWidth, initialData, isDarkMode, overlapThreshold, removedStatusId, showResourceOverlapHighlight, unitDateKeys]);

  const renderUnplannedHighlights = useCallback((row: ResourceRow) => {
    if (!highlightResourceUnplanned) return null;

    const isWeekendOrHoliday = (date: Date): boolean => {
      const day = date.getDay();
      return day === 0 || day === 6 || holidaySet.has(format(date, 'yyyy-MM-dd'));
    };

    const plannedDays = new Set<string>();

    row.subtasks.forEach(task => {
      if (removedStatusId !== undefined && task.status_id === removedStatusId) return;

      const startStr = task.planned_start_date;
      const endStr = task.planned_end_date || task.planned_start_date;
      if (!startStr && !endStr) return;

      const startDate = parseISO(startStr || endStr || '');
      const endDate = parseISO(endStr || startStr || '');
      if (!isValid(startDate) || !isValid(endDate)) return;

      const rangeStart = differenceInCalendarDays(endDate, startDate) >= 0 ? startDate : endDate;
      const rangeEnd = differenceInCalendarDays(endDate, startDate) >= 0 ? endDate : startDate;
      let current = rangeStart;

      while (differenceInCalendarDays(rangeEnd, current) >= 0) {
        plannedDays.add(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
      }
    });

    const cells = [];
    const today = startOfDay(new Date());

    for (let i = 0; i < unitDateKeys.length; i++) {
      const unit = unitDateKeys[i];
      // 今日より前のセルはハイライト対象外
      if (differenceInCalendarDays(unit.end, today) < 0) {
        continue;
      }

      let hasPlanInUnit = false;
      let hasWorkingDayInUnit = false;

      for (let d = 0; d < unit.dates.length; d++) {
        const checkDate = addDays(days[i], d);
        if (!isWeekendOrHoliday(checkDate)) {
          hasWorkingDayInUnit = true;
          if (plannedDays.has(unit.dates[d])) {
            hasPlanInUnit = true;
            break;
          }
        }
      }

      if (hasWorkingDayInUnit && !hasPlanInUnit) {
        cells.push(
          <div
            key={`unplanned-${row.assignee?.id ?? 'unassigned'}-${unit.key}`}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${i * cellWidth}px`,
              width: `${cellWidth}px`,
              background: isDarkMode
                ? 'repeating-linear-gradient(45deg, rgba(234, 179, 8, 0.18) 0px, rgba(234, 179, 8, 0.18) 2px, transparent 2px, transparent 8px)'
                : 'repeating-linear-gradient(45deg, rgba(250, 204, 21, 0.35) 0px, rgba(250, 204, 21, 0.35) 2px, transparent 2px, transparent 8px)',
            }}
          />
        );
      }
    }

    return cells;
  }, [cellWidth, days, highlightResourceUnplanned, holidaySet, isDarkMode, removedStatusId, unitDateKeys]);

  return (
    <div className="h-full min-h-0 w-full overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div
        ref={ganttRef}
        className="h-full min-h-0 overflow-y-auto overflow-x-scroll relative gantt-body"
        style={{ scrollbarGutter: 'stable' }}
        onScroll={onScroll}
      >
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

          <div className="relative pb-[100px]">
            {data.map((row, rowIndex) => {
              const plannedTrackHeight = getPlannedTrackHeight(row);
              const actualTrackHeight = getActualTrackHeight(row);
              const hasStackedPlannedTracks = row.plannedTracks.length > 1;
              const hasStackedActualTracks = row.actualTracks.length > 1;
              return (
              <div
                key={row.assignee?.id ?? 'unassigned'}
                className="relative group/ganttrow"
              >
                <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-px bg-slate-400 dark:bg-slate-600" />
                {rowIndex === data.length - 1 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-px bg-slate-400 dark:bg-slate-600" />
                )}
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300/45 via-slate-200/20 to-slate-300/45 dark:from-slate-600/45 dark:via-slate-700/15 dark:to-slate-600/45" />
                <div
                  className="resource-lane-planned relative border-b border-slate-300/70 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-900/80 w-full pointer-events-auto"
                  style={{
                    height: `${getPlannedLaneHeight(row)}px`,
                    paddingTop: hasStackedPlannedTracks ? `${STACKED_LANE_VERTICAL_PADDING}px` : undefined,
                    paddingBottom: hasStackedPlannedTracks ? `${STACKED_LANE_VERTICAL_PADDING}px` : undefined,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0">
                    {renderUnplannedHighlights(row)}
                    {renderHeatmap(row, 'planned')}
                  </div>
                  {(row.plannedTracks.length > 0 ? row.plannedTracks : [[]]).map((track, trackIndex) => (
                    <div
                      key={`planned-track-${trackIndex}`}
                      className="relative w-full border-b border-slate-200/20 last:border-b-0 dark:border-slate-800/30"
                      style={{ height: `${plannedTrackHeight}px` }}
                    >
                      {track.map((subtask) => (
                          <div key={`r-planned-${subtask.id}`} className="absolute top-0 left-0 w-full h-full pointer-events-none">
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
                              getAssigneeColor={getAssigneeColor}
                              colorMode="status"
                              handleMouseDown={handleMouseDown}
                              customLabel={showResourceTaskType ? subtask.subtask_type_name : undefined}
                              isResourceView={true}
                              compactResourceBar={hasStackedPlannedTracks}
                              barVisibility="planned"
                              overridePlannedBarColor={colorByTask ? getSubtaskColorLight(subtask.id) : undefined}
                            />
                          </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  className="resource-lane-actual relative bg-white dark:bg-slate-950 w-full pointer-events-auto"
                  style={{
                    height: `${getActualLaneHeight(row)}px`,
                    paddingTop: hasStackedActualTracks ? `${STACKED_LANE_VERTICAL_PADDING}px` : undefined,
                    paddingBottom: hasStackedActualTracks ? `${STACKED_LANE_VERTICAL_PADDING}px` : undefined,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0">
                    {renderHeatmap(row, 'actual')}
                  </div>
                  {(row.actualTracks.length > 0 ? row.actualTracks : [[]]).map((track, trackIndex) => (
                    <div
                      key={`actual-track-${trackIndex}`}
                      className="relative w-full border-b border-slate-200/20 last:border-b-0 dark:border-slate-800/30"
                      style={{ height: `${actualTrackHeight}px` }}
                    >
                      {track.map((subtask) => (
                          <div key={`r-actual-${subtask.id}`} className="absolute top-0 left-0 w-full h-full pointer-events-none">
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
                              getAssigneeColor={getAssigneeColor}
                              colorMode="status"
                              handleMouseDown={handleMouseDown}
                              customLabel={showResourceTaskType ? subtask.subtask_type_name : undefined}
                              isResourceView={true}
                              compactResourceBar={hasStackedActualTracks}
                              barVisibility="actual"
                              overrideActualBarColor={colorByTask ? getSubtaskColor(subtask.id) : undefined}
                            />
                          </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
