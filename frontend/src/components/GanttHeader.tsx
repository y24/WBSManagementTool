import React from 'react';
import { createPortal } from 'react-dom';
import { format, getDay, isToday, parseISO, differenceInCalendarDays, isValid, startOfWeek, endOfWeek, startOfYear } from 'date-fns';
import { GanttScale } from '../types/wbs';
import { getDateX } from '../utils/ganttUtils';
import { InitialData } from '../types';
import { DragMode, ItemType, BarType } from '../hooks/useGanttDrag';

interface GanttHeaderProps {
  days: Date[];
  cellWidth: number;
  scale: GanttScale;
  initialData: InitialData | null;
  showMarkers: boolean;
  onDateClick: (date: Date) => void;
  setHoveredDate: (date: string | null, mouseX?: number, mouseY?: number) => void;
  handleMouseDown?: (
    e: React.MouseEvent,
    itemId: number,
    itemType: ItemType,
    barType: BarType,
    mode: DragMode,
    initialDates: { start?: string; end?: string; reviewStart?: string; reviewDays?: number; name?: string }
  ) => void;
  dragState: any;
  tempDates: Record<number, any>;
}

const GanttHeader: React.FC<GanttHeaderProps> = ({
  days,
  cellWidth,
  scale,
  initialData,
  showMarkers,
  onDateClick,
  setHoveredDate,
  handleMouseDown,
  dragState,
  tempDates,
}) => {
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return initialData?.holidays.some(h => h.holiday_date === dateStr);
  };

  const baseDateStr = days[0] ? format(days[0], 'yyyy-MM-dd') : null;
  const endDateStr = days.length > 0 ? format(days[days.length - 1], 'yyyy-MM-dd') : null;
  const markerRange = React.useMemo(() => {
    if (!baseDateStr || !endDateStr) return null;
    const start = parseISO(baseDateStr);
    const end = parseISO(endDateStr);
    if (!isValid(start) || !isValid(end)) return null;
    return { start, end };
  }, [baseDateStr, endDateStr]);
  
  // 上段ヘッダーのグループ化
  const topGroups = React.useMemo(() => {
    const groups: { label: string; width: number; date: Date }[] = [];
    days.forEach(d => {
      let label = "";
      if (scale === 'day' || scale === 'week') {
        label = format(d, 'yyyy/MM');
      } else if (scale === 'month') {
        label = format(d, 'yyyy');
      }
      
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.width += cellWidth;
      } else {
        groups.push({ label, width: cellWidth, date: d });
      }
    });
    return groups;
  }, [days, cellWidth, scale]);

  return (
    <div className="flex flex-col border-b-[1px] border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 flex-shrink-0 transition-colors" style={{ height: '38px' }}>
      {/* Month Row */}
      {/* Top Row (Month or Year) */}
      <div className="flex border-b-[1px] border-slate-200 dark:border-slate-800 h-[18px]">
        {topGroups.map((g, idx) => (
          <div 
            key={`${g.label}-${idx}`} 
            className="flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex items-center bg-slate-50 dark:bg-slate-900"
            style={{ width: `${g.width}px` }}
          >
            <div className="sticky left-0 pl-1 text-[9px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap z-40 bg-slate-50/80 dark:bg-slate-900/80 rounded-r pr-1 backdrop-blur-sm">
              {g.label}
            </div>
          </div>
        ))}
      </div>

      {/* Day Row */}
      {/* Bottom Row (Day, Week, or Month) */}
      <div className="flex h-[20px]">
        {days.map(d => {
          let label = "";
          let dayClasses = "text-gray-500 dark:text-slate-400";
          let tooltip = "";

          if (scale === 'day') {
            label = format(d, 'd');
            const dow = getDay(d);
            const isSaturday = dow === 6;
            const isSunday = dow === 0;
            const holidayFlag = isHoliday(d);
            const dateStr = format(d, 'yyyy-MM-dd');
            const holidayInfo = initialData?.holidays.find(h => h.holiday_date === dateStr);
            tooltip = holidayInfo?.holiday_name || "";

            if (isSunday || holidayFlag) {
              dayClasses = "bg-red-100/80 dark:bg-rose-900/40 text-red-600 dark:text-rose-400";
            } else if (isSaturday) {
              dayClasses = "bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400";
            }
          } else if (scale === 'week') {
            const start = d;
            const end = endOfWeek(d, { weekStartsOn: 1 });
            label = `${format(start, 'M/d')} - ${format(end, 'M/d')}`;
            tooltip = `${format(start, 'yyyy/MM/dd')} - ${format(end, 'yyyy/MM/dd')}`;
          } else if (scale === 'month') {
            label = format(d, 'M月');
          }

          const dateStr = format(d, 'yyyy-MM-dd');

          return (
            <div
              key={d.toISOString()}
              className={`flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex items-center justify-center text-[10px] cursor-pointer transition-colors relative group/header-cell ${dayClasses} ${(scale === 'day' && isToday(d)) ? 'font-bold' : ''}`}
              style={{ width: `${cellWidth}px` }}
              title={tooltip}
              onMouseEnter={(e) => setHoveredDate(dateStr, e.clientX, e.clientY)}
              onMouseMove={(e) => setHoveredDate(dateStr, e.clientX, e.clientY)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => onDateClick(d)}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* マーカーラベル描画 (z-50) */}
      {showMarkers && baseDateStr && initialData?.markers?.map(marker => {
        if (!markerRange) return null;
        const temp = tempDates[marker.id];
        const isDragging = dragState?.itemId === marker.id && dragState?.itemType === 'marker';
        const displayDate = (isDragging && temp?.marker_date) ? temp.marker_date : marker.marker_date;
        const markerDate = parseISO(displayDate);
        if (!isValid(markerDate) || markerDate < markerRange.start || markerDate > markerRange.end) return null;

        const left = getDateX(markerDate, markerRange.start, scale);

        return (
          <React.Fragment key={`marker-label-${marker.id}`}>
            <div
              className={`absolute top-0 z-50 pointer-events-auto ${scale !== 'month' ? 'cursor-ew-resize' : 'cursor-default'} whitespace-nowrap px-1 py-0.5 rounded text-[9px] font-bold text-white shadow-sm hover:brightness-110 active:brightness-90 select-none ${isDragging ? 'opacity-70 scale-105 ring-2 ring-white ring-offset-1' : ''}`}
              style={{ 
                backgroundColor: marker.color, 
                left: `${left}px`, 
                top: '38px', // 38px header height
              }}
              onMouseDown={(e) => {
                if (scale === 'month') return;
                handleMouseDown?.(
                  e,
                  marker.id,
                  'marker',
                  'marker',
                  'marker-move',
                  { start: marker.marker_date, name: marker.name }
                );
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDateClick(parseISO(marker.marker_date));
              }}
              title={`[マイルストーン] ${marker.name}${marker.note ? '\n' + marker.note : ''}`}
            >
              {marker.name}
            </div>
            {isDragging && temp?.tooltipText && typeof document !== 'undefined' && createPortal(
              <div 
                className="gantt-drag-tooltip"
                style={{ 
                  left: `${temp.mouseX}px`, 
                  top: `${temp.mouseY}px` 
                }}
              >
                {temp.tooltipText}
              </div>,
              document.body
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default GanttHeader;
