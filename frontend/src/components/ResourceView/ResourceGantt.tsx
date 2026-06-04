import React, { useMemo, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, parseISO, isValid, getDaysInMonth, startOfDay } from 'date-fns';
import { InitialData } from '../../types';
import { GanttRange, GanttScale } from '../../types/wbs';
import { ResourceRow, ResourceSubtask } from '../../pages/mainboard/useResourceData';
import { getScaleCellWidth, getDateX, getGanttUnits } from '../../utils/ganttUtils';
import { useGanttDrag } from '../../hooks/useGanttDrag';
import GanttHeader from '../GanttHeader';
import GanttBackground from '../GanttBackground';
import GanttBar from '../GanttBar';

const OVERLAID_TRACK_HEIGHT = 36;
const OVERLAID_STACKED_TRACK_HEIGHT = 26;
const OVERLAID_LANE_VERTICAL_PADDING = 5;
export const UNASSIGNED_SEPARATOR_HEIGHT = 36;

const getOverlaidTrackHeight = (row: ResourceRow) =>
  row.overlaidTracks.length > 1 ? OVERLAID_STACKED_TRACK_HEIGHT : OVERLAID_TRACK_HEIGHT;

export const getOverlaidLaneHeight = (row: ResourceRow) => {
  const trackCount = Math.max(1, row.overlaidTracks.length);
  const padding = row.overlaidTracks.length > 1 ? OVERLAID_LANE_VERTICAL_PADDING * 2 : 0;
  return trackCount * getOverlaidTrackHeight(row) + padding;
};

interface ResourceGanttProps {
  data: ResourceRow[];
  range: GanttRange;
  initialData: InitialData | null;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  isDarkMode: boolean;
  showResourceTaskType: boolean;
  showResourceScopeMask: boolean;
  highlightResourceDelayedTasks: boolean;
  loadScopeEndDate?: string;
  actualLoadScopeStartDate?: string;
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
  showResourceTaskType,
  showResourceScopeMask,
  highlightResourceDelayedTasks,
  loadScopeEndDate,
  actualLoadScopeStartDate,
  scale,
  onScroll,
  ganttRef,
  onRefresh
}: ResourceGanttProps) {
  const { dragState, tempDates, handleMouseDown } = useGanttDrag(initialData, scale, onRefresh);
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);

  const todayStr = useMemo(() => range.today || new Date().toISOString().split('T')[0], [range.today]);

  const doneStatusId = useMemo(
    () => initialData?.status_mapping_done ? parseInt(initialData.status_mapping_done, 10) : null,
    [initialData]
  );
  const newStatusId = useMemo(() => {
    if (initialData?.status_mapping_new) {
      return parseInt(initialData.status_mapping_new, 10);
    }
    return initialData?.statuses.find(s => s.status_name === 'New')?.id ?? null;
  }, [initialData]);

  const days = useMemo(() => {
    if (!range.start_date || !range.end_date) return [];
    return getGanttUnits(range.start_date, range.end_date, scale);
  }, [range, scale]);

  const cellWidth = getScaleCellWidth(scale);
  const baseDate = useMemo(() => range.start_date ? parseISO(range.start_date) : new Date(), [range.start_date]);
  const totalWidth = useMemo(() => days.length * cellWidth, [days, cellWidth]);

  const scopeMask = useMemo(() => {
    if (!actualLoadScopeStartDate || !loadScopeEndDate || !range.start_date) return null;

    const scopeStart = parseISO(actualLoadScopeStartDate);
    const scopeEndExclusive = addDays(parseISO(loadScopeEndDate), 1);
    if (!isValid(scopeStart) || !isValid(scopeEndExclusive)) return null;

    const startX = Math.max(0, Math.min(totalWidth, getDateX(scopeStart, baseDate, scale)));
    const endX = Math.max(startX, Math.min(totalWidth, getDateX(scopeEndExclusive, baseDate, scale)));

    return {
      leftWidth: startX,
      rightLeft: endX,
      rightWidth: Math.max(0, totalWidth - endX),
    };
  }, [actualLoadScopeStartDate, baseDate, loadScopeEndDate, range.start_date, scale, totalWidth]);

  const removedStatusId = useMemo(
    () => initialData?.statuses.find(s => s.status_name === 'Removed')?.id,
    [initialData],
  );
  const holidaySet = useMemo(
    () => new Set(initialData?.holidays.map(h => h.holiday_date) ?? []),
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

  const renderUnplannedHighlights = useCallback((row: ResourceRow) => {
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
      if (differenceInCalendarDays(unit.end, today) < 0) continue;
      if (loadScopeEndDate && unit.dates[0] > loadScopeEndDate) continue;

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
                ? 'repeating-linear-gradient(45deg, rgba(234, 179, 8, 0.22) 0px, rgba(234, 179, 8, 0.22) 2px, transparent 2px, transparent 8px)'
                : 'repeating-linear-gradient(45deg, rgba(234, 179, 8, 0.42) 0px, rgba(234, 179, 8, 0.42) 2px, transparent 2px, transparent 8px)',
            }}
          />
        );
      }
    }

    return cells;
  }, [cellWidth, days, holidaySet, isDarkMode, loadScopeEndDate, removedStatusId, unitDateKeys]);

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
              const overlaidTrackHeight = getOverlaidTrackHeight(row);
              const overlaidLaneHeight = getOverlaidLaneHeight(row);
              const hasStackedTracks = row.overlaidTracks.length > 1;
              const isFirstUnassigned =
                row.assignee === null &&
                (rowIndex === 0 || data[rowIndex - 1].assignee !== null);

              return (
                <React.Fragment key={row.assignee?.id ?? 'unassigned'}>
                  {isFirstUnassigned && (
                    <div
                      className="relative flex items-center border-t border-b border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/50"
                      style={{ height: `${UNASSIGNED_SEPARATOR_HEIGHT}px` }}
                    />
                  )}
                  <div className="relative group/ganttrow">
                    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-px bg-slate-400 dark:bg-slate-600" />
                    {rowIndex === data.length - 1 && (
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-px bg-slate-400 dark:bg-slate-600" />
                    )}
                    <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300/45 via-slate-200/20 to-slate-300/45 dark:from-slate-600/45 dark:via-slate-700/15 dark:to-slate-600/45" />

                    <div
                      className="resource-lane-overlaid relative bg-white dark:bg-slate-950 w-full pointer-events-auto"
                      style={{
                        height: `${overlaidLaneHeight}px`,
                        paddingTop: hasStackedTracks ? `${OVERLAID_LANE_VERTICAL_PADDING}px` : undefined,
                        paddingBottom: hasStackedTracks ? `${OVERLAID_LANE_VERTICAL_PADDING}px` : undefined,
                      }}
                    >
                      <div className="pointer-events-none absolute inset-0">
                        {renderUnplannedHighlights(row)}
                      </div>

                      {(row.overlaidTracks.length > 0 ? row.overlaidTracks : [[]]).map((track, trackIndex) => (
                        <div
                          key={`overlaid-track-${trackIndex}`}
                          className="relative w-full border-b border-slate-200/20 last:border-b-0 dark:border-slate-800/30"
                          style={{ height: `${overlaidTrackHeight}px` }}
                        >
                          {track.map((subtask: ResourceSubtask) => {
                            const isStartDelayed =
                              newStatusId !== null &&
                              subtask.status_id === newStatusId &&
                              !subtask.actual_start_date &&
                              !!subtask.planned_start_date &&
                              subtask.planned_start_date < todayStr;
                            const isEndOverdue =
                              doneStatusId !== null &&
                              subtask.status_id !== doneStatusId &&
                              !!subtask.planned_end_date &&
                              subtask.planned_end_date < todayStr;

                            const ghostColor = isDarkMode
                              ? 'rgba(100, 116, 139, 0.28)'
                              : 'rgba(180, 175, 165, 0.35)';
                            const isDelayed = isStartDelayed || isEndOverdue;

                            return (
                              <React.Fragment key={`r-overlaid-${subtask.id}`}>
                                {/* Ghost planned bar */}
                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
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
                                    isResourceView={true}
                                    compactResourceBar={hasStackedTracks}
                                    customLabel={isStartDelayed && showResourceTaskType ? `${subtask.project_name} ${subtask.subtask_type_name}` : undefined}
                                    showCustomLabelWarning={isStartDelayed}
                                    isDelayedHighlight={highlightResourceDelayedTasks && isStartDelayed}
                                    barVisibility="planned"
                                    overridePlannedBarColor={ghostColor}
                                  />
                                </div>
                                {/* Actual status bar */}
                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
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
                                    customLabel={showResourceTaskType ? `${subtask.project_name} ${subtask.subtask_type_name}` : undefined}
                                    showCustomLabelWarning={isDelayed}
                                    isDelayedHighlight={highlightResourceDelayedTasks && isEndOverdue}
                                    isResourceView={true}
                                    compactResourceBar={hasStackedTracks}
                                    barVisibility="actual"
                                  />
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {showResourceScopeMask && scopeMask && (
              <div className="pointer-events-none absolute inset-0 z-40">
                {scopeMask.leftWidth > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-black/15 dark:bg-black/30"
                    style={{ left: 0, width: `${scopeMask.leftWidth}px` }}
                  />
                )}
                {scopeMask.rightWidth > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-black/15 dark:bg-black/30"
                    style={{ left: `${scopeMask.rightLeft}px`, width: `${scopeMask.rightWidth}px` }}
                  />
                )}
                <div
                  className="absolute top-0 bottom-0 border-l border-slate-500/25 dark:border-slate-300/20"
                  style={{ left: `${scopeMask.leftWidth}px` }}
                />
                <div
                  className="absolute top-0 bottom-0 border-l border-slate-500/25 dark:border-slate-300/20"
                  style={{ left: `${scopeMask.rightLeft}px` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
