import { useMemo, forwardRef } from 'react';
import { format, differenceInDays, addDays, getDay, isToday } from 'date-fns';
import { Project, Task, Subtask, GanttRange } from '../types/wbs';
import { InitialData } from '../types';

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

    return (
      <div className="relative w-full h-full min-h-[30px] flex flex-col justify-center py-1">
        {pStart !== undefined && pWidth !== undefined && (
          <div 
            className={`absolute top-1 rounded-sm ${isSubtask ? 'h-1.5' : 'h-1'} bg-gray-300 opacity-60`}
            style={{ left: `${pStart}px`, width: `${pWidth}px` }}
          />
        )}
        {aStart !== undefined && aWidth !== undefined && (
          <div 
            className={`absolute bottom-1 rounded-sm ${isSubtask ? 'h-3' : 'h-2'} shadow-sm`}
            style={{ left: `${aStart}px`, width: `${aWidth}px`, backgroundColor: typeColor }}
            title={`${item.progress_percent ? item.progress_percent + '%' : ''}`}
          />
        )}
      </div>
    );
  };

  const commonRowClasses = "transition-colors h-[37px]"; // ボーダーはCSS側の wbs-row-* クラスで制御

  const totalWidth = useMemo(() => days.length * CELL_WIDTH, [days]);

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      {/* スクロール領域 (Ganttバー & ヘッダー) */}
      <div ref={ref} className="h-full overflow-auto relative" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          {/* ヘッダー領域 (垂直スクロールに追従するためsticky) */}
          <div className="flex border-b-[1px] border-[#f1f5f9] shadow-sm sticky top-0 z-30 bg-gray-50 flex-shrink-0" style={{ height: '33px' }}>
            {days.map(d => {
              const isWeekend = getDay(d) === 0 || getDay(d) === 6;
              const holidayFlag = isHoliday(d);
              const holidayInfo = initialData?.holidays.find(h => h.holiday_date === format(d, 'yyyy-MM-dd'));
              
              return (
                <div 
                  key={d.toISOString()} 
                  className={`flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[10px] ${isWeekend || holidayFlag ? 'bg-red-50 text-red-500' : 'text-gray-500'}`}
                  style={{ width: `${CELL_WIDTH}px` }}
                  title={holidayInfo?.holiday_name}
                >
                  {format(d, 'd')}
                </div>
              );
            })}
          </div>

          {/* 背景の縦線 ＆ 今日線 (z-0) */}
          <div className="absolute inset-0 flex pointer-events-none z-0">
            {days.map(d => {
              const isWeekend = getDay(d) === 0 || getDay(d) === 6;
              const holidayFlag = isHoliday(d);
              const today = isToday(d);
              return (
                <div 
                  key={`bg-${d.toISOString()}`} 
                  className={`flex-shrink-0 wbs-cell-border ${isWeekend || holidayFlag ? 'bg-red-50/20' : ''} ${today ? 'border-r-red-400 border-r-2' : ''}`}
                  style={{ width: `${CELL_WIDTH}px` }}
                />
              );
            })}
          </div>

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
