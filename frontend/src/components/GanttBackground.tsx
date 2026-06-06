import React from 'react';
import { format, getDay, parseISO, isValid } from 'date-fns';
import { InitialData, Marker } from '../types';
import { Project, GanttScale } from '../types/wbs';
import { getDateX } from '../utils/ganttUtils';

interface GanttBackgroundProps {
  days: Date[];
  cellWidth: number;
  scale: GanttScale;
  initialData: InitialData | null;
  markers: Marker[];
  range: { start_date: string; end_date: string };
  hoveredDate: string | null;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  dragState: any;
  tempDates: Record<number, any>;
  todayStr: string;
}

const GanttBackground: React.FC<GanttBackgroundProps> = ({
  days,
  cellWidth,
  scale,
  initialData,
  markers,
  range,
  hoveredDate,
  showTodayHighlight,
  showMarkers,
  dragState,
  tempDates,
  todayStr,
}) => {
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return initialData?.holidays.some(h => h.holiday_date === dateStr);
  };

  const markerRange = React.useMemo(() => {
    if (!range.start_date || !range.end_date) return null;
    const start = parseISO(range.start_date);
    const end = parseISO(range.end_date);
    if (!isValid(start) || !isValid(end)) return null;
    return { start, end };
  }, [range.start_date, range.end_date]);

  const todayLineX = React.useMemo(() => {
    if (!showTodayHighlight || !range.start_date || !markerRange) return null;
    const today = parseISO(todayStr);
    if (!isValid(today) || today < markerRange.start || today > markerRange.end) return null;
    return getDateX(today, parseISO(range.start_date), scale);
  }, [markerRange, range.start_date, scale, showTodayHighlight, todayStr]);

  return (
    <>
      {/* 背景の縦線 (z-0) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {days.map((d, i) => {
          const dow = getDay(d);
          const isSaturday = dow === 6;
          const isSunday = dow === 0;
          const holidayFlag = isHoliday(d);
          const isSundayOrHoliday = isSunday || holidayFlag;

          let bgClass = "";
          if (scale === 'day') {
            if (isSundayOrHoliday) {
              bgClass = "bg-red-100/40 dark:bg-rose-900/10";
            } else if (isSaturday) {
              bgClass = "bg-blue-100/40 dark:bg-blue-900/10";
            }
          }

          return (
            <div
              key={`bg-${d.toISOString()}`}
              className={`absolute top-0 bottom-0 wbs-cell-border ${bgClass}`}
              style={{ left: `${i * cellWidth}px`, width: `${cellWidth}px` }}
            />
          );
        })}
      </div>

      {/* マーカー垂直線 (z-25) */}
      {showMarkers && markers.map(m => {
        if (!range.start_date || !markerRange) return null;
        const temp = tempDates[m.id];
        const isDragging = dragState?.itemId === m.id && dragState?.itemType === 'marker';
        const displayDate = (isDragging && temp?.marker_date) ? temp.marker_date : m.marker_date;
        
        const mDate = parseISO(displayDate);
        if (!isValid(mDate) || mDate < markerRange.start || mDate > markerRange.end) return null;

        const left = getDateX(mDate, parseISO(range.start_date), scale);
        return (
          <div
            key={`marker-line-${m.id}`}
            className={`absolute top-0 bottom-0 z-25 pointer-events-none border-l-2 border-dashed ${isDragging ? 'opacity-50' : ''}`}
            style={{ left: `${left}px`, borderLeftColor: m.color }}
          />
        );
      })}

      {/* プレビュー線 (z-25) */}
      {hoveredDate && (
        <div
          className="absolute top-0 bottom-0 z-25 pointer-events-none border-l border-dashed border-gray-400 opacity-50"
          style={{ left: `${getDateX(parseISO(hoveredDate), parseISO(range.start_date!), scale)}px` }}
        />
      )}

      {/* 今日線 (z-20) */}
      {todayLineX !== null && (
        <div
          className="absolute top-0 bottom-0 border-l-[3px] border-amber-500/65 dark:border-amber-300/65 z-20 pointer-events-none"
          style={{ left: `${todayLineX}px` }}
        />
      )}
    </>
  );
};

const getActiveMarkerTemp = (props: GanttBackgroundProps) => {
  const { dragState, tempDates } = props;
  return dragState?.itemType === 'marker' ? tempDates[dragState.itemId] : undefined;
};

const areGanttBackgroundPropsEqual = (prev: GanttBackgroundProps, next: GanttBackgroundProps) => {
  const prevMarkerDragId = prev.dragState?.itemType === 'marker' ? prev.dragState.itemId : null;
  const nextMarkerDragId = next.dragState?.itemType === 'marker' ? next.dragState.itemId : null;

  return (
    prev.days === next.days &&
    prev.cellWidth === next.cellWidth &&
    prev.scale === next.scale &&
    prev.initialData === next.initialData &&
    prev.markers === next.markers &&
    prev.range.start_date === next.range.start_date &&
    prev.range.end_date === next.range.end_date &&
    prev.hoveredDate === next.hoveredDate &&
    prev.showTodayHighlight === next.showTodayHighlight &&
    prev.showMarkers === next.showMarkers &&
    prev.todayStr === next.todayStr &&
    prevMarkerDragId === nextMarkerDragId &&
    getActiveMarkerTemp(prev) === getActiveMarkerTemp(next)
  );
};

export default React.memo(GanttBackground, areGanttBackgroundPropsEqual);
