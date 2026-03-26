import React from 'react';
import { format, getDay, isToday, parseISO, differenceInCalendarDays } from 'date-fns';
import { InitialData } from '../types';
import { Project } from '../types/wbs';

interface GanttBackgroundProps {
  days: Date[];
  cellWidth: number;
  initialData: InitialData | null;
  range: { start_date: string; end_date: string };
  hoveredDate: string | null;
  showTodayHighlight: boolean;
  showMarkers: boolean;
  showProjectRange: boolean;
  projects: Project[];
  getStatusColor: (statusId: number | null | undefined) => string;
}

const GanttBackground: React.FC<GanttBackgroundProps> = ({
  days,
  cellWidth,
  initialData,
  range,
  hoveredDate,
  showTodayHighlight,
  showMarkers,
  showProjectRange,
  projects,
  getStatusColor,
}) => {
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return initialData?.holidays.some(h => h.holiday_date === dateStr);
  };

  const projectDisplayRanges = React.useMemo(() => {
    if (!range.start_date || !projects.length) return {};
    const baseDate = parseISO(range.start_date);

    return projects.reduce((acc, project) => {
      const allDates: number[] = [];
      const collect = (item: any) => {
        ['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'review_start_date'].forEach(k => {
          if (item[k]) {
            try {
              const d = parseISO(item[k]);
              if (!isNaN(d.getTime())) allDates.push(d.getTime());
            } catch { }
          }
        });
      };

      collect(project);
      project.tasks.forEach(task => {
        collect(task);
        task.subtasks.forEach(subtask => collect(subtask));
      });

      if (allDates.length > 0) {
        const minTime = Math.min(...allDates);
        const maxTime = Math.max(...allDates);
        const left = differenceInCalendarDays(new Date(minTime), baseDate) * cellWidth;
        const width = (differenceInCalendarDays(new Date(maxTime), new Date(minTime)) + 1) * cellWidth;
        acc[project.id] = { left, width, status_id: project.status_id };
      }
      return acc;
    }, {} as Record<number, { left: number; width: number, status_id?: number | null }>);
  }, [projects, range.start_date, cellWidth]);

  return (
    <>
      {/* 背景の縦線 (z-0) */}
      <div className="absolute inset-0 flex pointer-events-none z-0">
        {days.map(d => {
          const dow = getDay(d);
          const isSaturday = dow === 6;
          const isSunday = dow === 0;
          const holidayFlag = isHoliday(d);
          const isSundayOrHoliday = isSunday || holidayFlag;

          let bgClass = "";
          if (isSundayOrHoliday) {
            bgClass = "bg-red-100/40 dark:bg-rose-900/10";
          } else if (isSaturday) {
            bgClass = "bg-blue-100/40 dark:bg-blue-900/10";
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
        if (!range.start_date) return null;
        const mDate = parseISO(m.marker_date);
        const left = differenceInCalendarDays(mDate, parseISO(range.start_date)) * cellWidth;
        return (
          <div
            key={`marker-line-${m.id}`}
            className="absolute top-0 bottom-0 z-25 pointer-events-none border-l-2"
            style={{ left: `${left}px`, borderLeftColor: m.color }}
          />
        );
      })}

      {/* プレビュー線 (z-25) */}
      {hoveredDate && (
        <div
          className="absolute top-0 bottom-0 z-25 pointer-events-none border-l border-dashed border-gray-400 opacity-50"
          style={{ left: `${differenceInCalendarDays(parseISO(hoveredDate), parseISO(range.start_date!)) * cellWidth}px` }}
        />
      )}

      {/* 今日列のハイライト (z-20) */}
      {showTodayHighlight && days.map((d, i) => isToday(d) && (
        <div
          key={`today-highlight-${d.toISOString()}`}
          className="absolute top-0 bottom-0 border-x border-amber-400/50 bg-amber-400/10 z-20 pointer-events-none"
          style={{ left: `${i * cellWidth}px`, width: `${cellWidth}px` }}
        />
      ))}

      {/* プロジェクト期間ハイライト (z-10は要素行の親で指定するため、ここは z-0 または考慮不要だが、絶対配置で要素行の背後に配置する) */}
      {showProjectRange && projects.map(p => {
        const pRange = projectDisplayRanges[p.id];
        if (!pRange) return null;
        return (
          <div
            key={`p-range-${p.id}`}
            className="wbs-project-range-highlight"
            style={{
              left: `${pRange.left}px`,
              width: `${pRange.width}px`,
              top: '33px', // ヘッダー高
              bottom: 0,
              '--highlight-bg': `${getStatusColor(pRange.status_id)}26`,
              '--highlight-border': `${getStatusColor(pRange.status_id)}73`
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
};

export default GanttBackground;
