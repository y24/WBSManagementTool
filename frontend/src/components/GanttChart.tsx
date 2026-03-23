import { useMemo, forwardRef } from 'react';
import { format, differenceInDays, addDays, getDay, isToday } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Project, Task, Subtask, GanttRange } from '../types/wbs';
import { InitialData } from '../types';
import { getWarning, subtractBusinessDays, calculateReviewCalendarDays } from './WBSTree/utils';

interface GanttChartProps {
  projects: Project[];
  initialData: InitialData | null;
  range: GanttRange;
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const CELL_WIDTH = 24; // 1日あたりのピクセル幅

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({
  projects,
  initialData,
  range,
  expandedProjects,
  expandedTasks,
  onScroll
}, ref) => {
  // 休日判定ロジック
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = initialData?.holidays.find(h => h.holiday_date === dateStr);
    return !!holiday;
  };

  const days = useMemo(() => {
    if (!range.start_date || !range.end_date) return [];
    try {
      const start = new Date(range.start_date);
      const end = new Date(range.end_date);
      const totalDays = differenceInDays(end, start) + 1;
      return Array.from({ length: totalDays }).map((_, i) => addDays(start, i));
    } catch {
      return [];
    }
  }, [range]);

  const getStatusColor = (statusId: number) => {
    return initialData?.statuses.find(s => s.id === statusId)?.color_code || '#a0aec0';
  };

  const renderBar = (item: any, isSubtask = false) => {
    if (!range.start_date || !days.length) return null;
    const baseDate = new Date(range.start_date);

    // 計画バーの計算
    let pStart, pWidth;
    if (item.planned_start_date && item.planned_end_date) {
      const pS = new Date(item.planned_start_date);
      const pE = new Date(item.planned_end_date);
      pStart = differenceInDays(pS, baseDate) * CELL_WIDTH;
      pWidth = (differenceInDays(pE, pS) + 1) * CELL_WIDTH;
    }

    // 実績バーの計算
    let aStart, aWidth;
    if (item.actual_start_date) {
      const aS = new Date(item.actual_start_date);
      // 終了日がない(現在進行中)場合は表示範囲の末尾か今日を終わりの目安としたりするが、今回はシンプルに
      const aE = item.actual_end_date ? new Date(item.actual_end_date) : aS;
      aStart = differenceInDays(aS, baseDate) * CELL_WIDTH;
      aWidth = (differenceInDays(aE, aS) + 1) * CELL_WIDTH;
    }

    const typeColor = isSubtask ? getStatusColor(item.status_id) : '#cbd5e1';

    let rStart, rWidth;
    if (isSubtask && item.planned_start_date && item.planned_end_date && item.review_days && item.review_days > 0) {
      const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
      const pE = new Date(item.planned_end_date);
      const r_days_cal = calculateReviewCalendarDays(pE, item.review_days, holidays);
      rWidth = r_days_cal * CELL_WIDTH;
      
      const calcPWidth = (differenceInDays(pE, new Date(item.planned_start_date)) + 1) * CELL_WIDTH;
      if (rWidth > calcPWidth) rWidth = calcPWidth;
      rStart = pStart! + calcPWidth - rWidth;
    }

    const warningText = getWarning(item, initialData);
    const isDelayed = !!warningText;

    const rightEdge = Math.max(
      pStart !== undefined && pWidth !== undefined ? pStart + pWidth : 0,
      aStart !== undefined && aWidth !== undefined ? aStart + aWidth : 0
    );

    return (
      <div className="relative w-full h-full min-h-[30px] flex flex-col justify-start">
        {pStart !== undefined && pWidth !== undefined && (
          <>
            <div
              className={`absolute top-[6px] rounded-t-sm ${isSubtask ? 'h-1.5' : 'h-1'} bg-gray-300 opacity-85`}
              style={{ left: `${pStart}px`, width: `${pWidth}px` }}
            />
            {rStart !== undefined && rWidth !== undefined && (
              <div
                className="absolute top-[6px] rounded-tr-sm h-1.5 bg-gray-400 opacity-60"
                style={{ left: `${rStart}px`, width: `${rWidth}px` }}
                title={`レビュー期間: ${item.review_days}日`}
              />
            )}
          </>
        )}
        {aStart !== undefined && aWidth !== undefined && (
          <div
            className={`absolute ${isSubtask ? 'top-[12px] h-[16px]' : 'top-[10px] h-[16px]'} rounded-sm shadow-sm`}
            style={{ left: `${aStart}px`, width: `${aWidth}px`, backgroundColor: typeColor }}
            title={`${item.progress_percent ? item.progress_percent + '%' : ''}`}
          />
        )}
        {isDelayed && warningText && (
          <div
            className="absolute flex items-center z-20 pointer-events-auto cursor-help"
            style={{ top: '10px', left: `${rightEdge + 4}px` }}
            title={warningText}
          >
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          </div>
        )}
      </div>
    );
  };

  const commonRowClasses = "transition-colors h-[37px]"; // ボーダーはCSS側の wbs-row-* クラスで制御

  const totalWidth = useMemo(() => days.length * CELL_WIDTH, [days]);

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      {/* スクロール領域 (Ganttバー & ヘッダー) */}
      <div ref={ref} className="h-full overflow-auto relative gantt-body" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          {/* ヘッダー領域 (垂直スクロールに追従するためsticky) */}
          <div className="flex border-b-[1px] border-slate-200 shadow-sm sticky top-0 z-30 bg-slate-100 flex-shrink-0" style={{ height: '33px' }}>
            {days.map(d => {
              const dow = getDay(d);
              const isSaturday = dow === 6;
              const isSunday = dow === 0;
              const holidayFlag = isHoliday(d);
              const isSundayOrHoliday = isSunday || holidayFlag;
              const holidayInfo = initialData?.holidays.find(h => h.holiday_date === format(d, 'yyyy-MM-dd'));

              let dayClasses = "text-gray-500";
              if (isSundayOrHoliday) {
                dayClasses = "bg-red-50 text-red-500";
              } else if (isSaturday) {
                dayClasses = "bg-blue-50 text-blue-500";
              }

              return (
                <div
                  key={d.toISOString()}
                  className={`flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[10px] ${dayClasses} ${isToday(d) ? 'font-bold' : ''}`}
                  style={{ width: `${CELL_WIDTH}px` }}
                  title={holidayInfo?.holiday_name}
                >
                  {format(d, 'd')}
                </div>
              );
            })}
          </div>

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
                bgClass = "bg-red-50/30";
              } else if (isSaturday) {
                bgClass = "bg-blue-50/30";
              }

              return (
                <div
                  key={`bg-${d.toISOString()}`}
                  className={`flex-shrink-0 wbs-cell-border ${bgClass}`}
                  style={{ width: `${CELL_WIDTH}px` }}
                />
              );
            })}
          </div>

          {/* 今日列のハイライト (z-20) - 左右の細い線と薄いオーバーレイ */}
          {days.map((d, i) => isToday(d) && (
            <div
              key={`today-highlight-${d.toISOString()}`}
              className="absolute top-0 bottom-0 border-x border-amber-400/50 bg-amber-400/10 z-20 pointer-events-none"
              style={{ left: `${i * CELL_WIDTH}px`, width: `${CELL_WIDTH}px` }}
            />
          ))}

          {/* 要素行の描画 (z-10) */}
          <div className="relative z-10">
            {projects.map(project => (
              <div key={`p-${project.id}`}>
                {/* Project Row */}
                <div className={`${commonRowClasses} wbs-row-project`}>{renderBar(project, false)}</div>

                {expandedProjects[project.id] !== false && project.tasks.map(task => (
                  <div key={`t-${task.id}`}>
                    {/* Task Row */}
                    <div className={`${commonRowClasses} wbs-row-task`}>{renderBar(task, false)}</div>

                    {expandedTasks[task.id] !== false && task.subtasks.map(subtask => (
                      <div key={`s-${subtask.id}`} className={`${commonRowClasses} wbs-row-subtask`}>
                        {renderBar(subtask, true)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GanttChart;
