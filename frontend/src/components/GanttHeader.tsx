import React from 'react';
import { format, getDay, isToday } from 'date-fns';
import { InitialData } from '../types';

interface GanttHeaderProps {
  days: Date[];
  cellWidth: number;
  initialData: InitialData | null;
  showMarkers: boolean;
  onDateClick: (date: Date) => void;
  setHoveredDate: (date: string | null) => void;
}

const GanttHeader: React.FC<GanttHeaderProps> = ({
  days,
  cellWidth,
  initialData,
  showMarkers,
  onDateClick,
  setHoveredDate,
}) => {
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return initialData?.holidays.some(h => h.holiday_date === dateStr);
  };

  return (
    <div className="flex border-b-[1px] border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 flex-shrink-0 transition-colors" style={{ height: '33px' }}>
      {days.map(d => {
        const dow = getDay(d);
        const isSaturday = dow === 6;
        const isSunday = dow === 0;
        const holidayFlag = isHoliday(d);
        const isSundayOrHoliday = isSunday || holidayFlag;
        const dateStr = format(d, 'yyyy-MM-dd');
        const holidayInfo = initialData?.holidays.find(h => h.holiday_date === dateStr);
        const marker = initialData?.markers?.find(m => m.marker_date === dateStr);

        let dayClasses = "text-gray-500 dark:text-slate-400";
        if (isSundayOrHoliday) {
          dayClasses = "bg-red-100/80 dark:bg-rose-900/40 text-red-600 dark:text-rose-400";
        } else if (isSaturday) {
          dayClasses = "bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400";
        }

        return (
          <div
            key={d.toISOString()}
            className={`flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex items-center justify-center text-[10px] cursor-pointer transition-colors relative group/header-cell ${dayClasses} ${isToday(d) ? 'font-bold' : ''} ${marker ? 'border-l-2' : ''}`}
            style={{ width: `${cellWidth}px`, borderLeftColor: marker ? marker.color : undefined }}
            title={marker ? `[マイルストーン] ${marker.name}${marker.note ? '\n' + marker.note : ''}` : holidayInfo?.holiday_name}
            onMouseEnter={() => setHoveredDate(dateStr)}
            onMouseLeave={() => setHoveredDate(null)}
            onClick={() => onDateClick(d)}
          >
            {format(d, 'd')}
            {showMarkers && marker && (
              <div
                className="absolute top-full left-0 z-50 pointer-events-none whitespace-nowrap px-1 py-0.5 rounded text-[9px] font-bold text-white shadow-sm"
                style={{ backgroundColor: marker.color, transform: 'translateY(2px)' }}
              >
                {marker.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GanttHeader;
