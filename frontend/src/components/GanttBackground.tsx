import React from 'react';
import { format, getDay, isToday, parseISO, differenceInCalendarDays, isValid } from 'date-fns';
import { InitialData } from '../types';
import { Project, GanttScale } from '../types/wbs';
import { getDateX } from '../utils/ganttUtils';

interface GanttBackgroundProps {
  days: Date[];
  cellWidth: number;
  scale: GanttScale;
  initialData: InitialData | null;
  range: { start_date: string; end_date: string };
  hoveredDate: string | null;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  dragState: any;
  tempDates: Record<number, any>;
}

const GanttBackground: React.FC<GanttBackgroundProps> = ({
  days,
  cellWidth,
  scale,
  initialData,
  range,
  hoveredDate,
  showTodayHighlight,
  showMarkers,
  dragState,
  tempDates,
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

  return (
    <>
      {/* 背景の縦線 (z-0) */}
      <div className="absolute inset-0 flex pointer-events-none z-0">
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
              className={`flex-shrink-0 wbs-cell-border ${bgClass}`}
              style={{ width: `${cellWidth}px` }}
            />
          );
        })}
      </div>

      {/* マーカー垂直線 (z-25) */}
      {showMarkers && initialData?.markers?.map(m => {
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
            className={`absolute top-0 bottom-0 z-25 pointer-events-none border-l-2 ${isDragging ? 'opacity-50' : ''}`}
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

      {/* 今日列のハイライト (z-20) */}
      {showTodayHighlight && days.map((d, i) => isToday(d) && (
        <div
          key={`today-highlight-${d.toISOString()}`}
          className="absolute top-0 bottom-0 border-x border-amber-400/50 bg-amber-400/10 z-20 pointer-events-none"
          style={{ left: `${getDateX(d, parseISO(range.start_date), scale)}px`, width: `${scale === 'day' ? cellWidth : (cellWidth / 7)}px` }}
        />
      ))}
    </>
  );
};

export default React.memo(GanttBackground);
