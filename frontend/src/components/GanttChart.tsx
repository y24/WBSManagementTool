import { useMemo, forwardRef, useState, useCallback } from 'react';
import { format, differenceInCalendarDays, addDays, getDay, isToday, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Project, Task, Subtask, GanttRange } from '../types/wbs';
import { InitialData, Marker } from '../types';
import { getWarning, subtractBusinessDays, calculateReviewCalendarDays } from './WBSTree/utils';
import MarkerModal from './MarkerModal';
import { apiClient } from '../api/client';

interface GanttChartProps {
  projects: Project[];
  initialData: InitialData | null;
  range: GanttRange;
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  showProjectRange: boolean;
  showTodayHighlight: boolean;
  showAssigneeName?: boolean;
  showProgressRate?: boolean;
  showMarkers?: boolean;
  isDarkMode?: boolean;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onRefresh?: () => void;
}

const CELL_WIDTH = 24; // 1日あたりのピクセル幅

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({
  projects,
  initialData,
  range,
  expandedProjects,
  expandedTasks,
  showProjectRange,
  showTodayHighlight,
  showAssigneeName = false,
  showProgressRate = false,
  showMarkers = true,
  isDarkMode = false,
  onScroll,
  onRefresh
}, ref) => {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);

  // 休日判定ロジック
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = initialData?.holidays.find(h => h.holiday_date === dateStr);
    return !!holiday;
  };

  const days = useMemo(() => {
    if (!range.start_date || !range.end_date) return [];
    try {
      const start = parseISO(range.start_date);
      const end = parseISO(range.end_date);
      const totalDays = differenceInCalendarDays(end, start) + 1;
      return Array.from({ length: totalDays }).map((_, i) => addDays(start, i));
    } catch {
      return [];
    }
  }, [range]);

  const handleMarkerSave = async (name: string, note: string, color: string) => {
    if (!selectedDate) return;
    try {
      await apiClient.post('/markers', {
        marker_date: format(selectedDate, 'yyyy-MM-dd'),
        name,
        note,
        color
      });
      setIsMarkerModalOpen(false);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save marker:', err);
      alert('マーカーの保存に失敗しました。');
    }
  };

  const handleMarkerDelete = async (id: number) => {
    try {
      await apiClient.delete(`/markers/${id}`);
      setIsMarkerModalOpen(false);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete marker:', err);
      alert('マーカーの削除に失敗しました。');
    }
  };

  const getStatusColor = (statusId: number | null | undefined): string => {
    if (statusId === null || statusId === undefined) return isDarkMode ? '#334155' : '#cbd5e1';
    let color = initialData?.statuses.find(s => s.id === statusId)?.color_code || '#a0aec0';
    if (!color.startsWith('#')) color = '#' + color;
    // 3桁の16進数の場合は6桁に拡張
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color;
  };

  const renderBar = (item: any, isSubtask = false) => {
    if (!range.start_date || !days.length) return null;
    const baseDate = parseISO(range.start_date);

    // 計画バーの計算
    let pStart, pWidth;
    if (item.planned_start_date && item.planned_end_date) {
      const pS = parseISO(item.planned_start_date);
      const pE = parseISO(item.planned_end_date);
      pStart = differenceInCalendarDays(pS, baseDate) * CELL_WIDTH;
      pWidth = (differenceInCalendarDays(pE, pS) + 1) * CELL_WIDTH;
    }

    // 実績バーの計算
    let aStart, aWidth;
    let arStart, arWidth;
    if (item.actual_start_date) {
      const aS = parseISO(item.actual_start_date);
      const aE = item.actual_end_date ? parseISO(item.actual_end_date) : aS;
      aStart = differenceInCalendarDays(aS, baseDate) * CELL_WIDTH;
      aWidth = (differenceInCalendarDays(aE, aS) + 1) * CELL_WIDTH;

      if (isSubtask && item.review_start_date) {
        const rS = parseISO(item.review_start_date);
        const effectiveRS = rS < aS ? aS : rS;
        const effectiveRE = aE < effectiveRS ? effectiveRS : aE;
        arStart = differenceInCalendarDays(effectiveRS, baseDate) * CELL_WIDTH;
        arWidth = (differenceInCalendarDays(effectiveRE, effectiveRS) + 1) * CELL_WIDTH;
      }
    }

    const typeColor = isSubtask ? getStatusColor(item.status_id) : (isDarkMode ? '#334155' : '#cbd5e1');

    let rStart, rWidth;
    if (isSubtask && item.planned_start_date && item.planned_end_date && item.review_days && item.review_days > 0) {
      const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
      const pE = parseISO(item.planned_end_date);
      const r_days_cal = calculateReviewCalendarDays(pE, item.review_days, holidays);
      rWidth = r_days_cal * CELL_WIDTH;

      const calcPWidth = (differenceInCalendarDays(pE, parseISO(item.planned_start_date)) + 1) * CELL_WIDTH;
      if (rWidth > calcPWidth) rWidth = calcPWidth;
      rStart = pStart! + calcPWidth - rWidth;
    }

    const warningText = getWarning(item, initialData, isSubtask);
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
              className={`absolute top-[6px] rounded-t-sm ${isSubtask ? 'h-1.5' : 'h-1'} bg-gray-300 dark:bg-slate-600 opacity-85 dark:opacity-70`}
              style={{ left: `${pStart}px`, width: `${pWidth}px` }}
            />
            {rStart !== undefined && rWidth !== undefined && (
              <div
                className="absolute top-[6px] rounded-tr-sm h-1.5 bg-gray-400 dark:bg-slate-500 opacity-60 dark:opacity-50"
                style={{ left: `${rStart}px`, width: `${rWidth}px` }}
                title={`レビュー期間: ${item.review_days}日`}
              />
            )}
          </>
        )}
        {aStart !== undefined && aWidth !== undefined && (
          <>
            <div
              className={`absolute ${isSubtask ? 'top-[12px] h-[16px]' : 'top-[10px] h-[16px]'} rounded-sm shadow-sm flex items-center justify-center overflow-hidden`}
              style={{ left: `${aStart}px`, width: `${aWidth}px`, backgroundColor: typeColor }}
              title={`${item.progress_percent ? item.progress_percent + '%' : ''}`}
            >
              {showProgressRate && item.progress_percent !== undefined && item.progress_percent !== null && (
                <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-none pointer-events-none">
                  {item.progress_percent}%
                </span>
              )}
            </div>
            {arStart !== undefined && arWidth !== undefined && (
              <div
                className={`absolute ${isSubtask ? 'top-[12px] h-[16px]' : 'top-[10px] h-[16px]'} rounded-sm bg-black/20 pointer-events-none`}
                style={{ left: `${arStart}px`, width: `${arWidth}px` }}
                title="レビュー中"
              />
            )}
          </>
        )}
        {isSubtask && showAssigneeName && item.assignee_id && (aStart !== undefined || pStart !== undefined) && (
          <div
            className="absolute text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap pointer-events-none"
            style={{
              left: `${(aStart !== undefined ? aStart : pStart!) - 4}px`,
              top: '13px',
              transform: 'translateX(-100%)'
            }}
          >
            {initialData?.members.find(m => m.id === item.assignee_id)?.member_name}
          </div>
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

  // プロジェクトごとの期間（背景ハイライト用）を計算
  const projectDisplayRanges = useMemo(() => {
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
        const left = differenceInCalendarDays(new Date(minTime), baseDate) * CELL_WIDTH;
        const width = (differenceInCalendarDays(new Date(maxTime), new Date(minTime)) + 1) * CELL_WIDTH;
        acc[project.id] = { left, width };
      }
      return acc;
    }, {} as Record<number, { left: number; width: number }>);
  }, [projects, range.start_date]);

  return (
    <div className="h-full w-full overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      {/* スクロール領域 (Ganttバー & ヘッダー) */}
      <div ref={ref} className="h-full overflow-auto relative gantt-body" onScroll={onScroll}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%', position: 'relative', minHeight: '100%' }}>
          {/* ヘッダー領域 (垂直スクロールに追従するためsticky) */}
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
                  style={{ width: `${CELL_WIDTH}px`, borderLeftColor: marker ? marker.color : undefined }}
                  title={marker ? `[マイルストーン] ${marker.name}${marker.note ? '\n' + marker.note : ''}` : holidayInfo?.holiday_name}
                  onMouseEnter={() => setHoveredDate(dateStr)}
                  onMouseLeave={() => setHoveredDate(null)}
                  onClick={() => {
                    setSelectedDate(d);
                    setIsMarkerModalOpen(true);
                  }}
                >
                  {format(d, 'd')}
                  {/* マーカー名表示 (ヘッダー内) */}
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

          {/* マーカー垂直線 (z-25) */}
          {showMarkers && initialData?.markers?.map(m => {
            if (!range.start_date) return null;
            const mDate = parseISO(m.marker_date);
            const left = differenceInCalendarDays(mDate, parseISO(range.start_date)) * CELL_WIDTH;
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
              style={{ left: `${differenceInCalendarDays(parseISO(hoveredDate), parseISO(range.start_date!)) * CELL_WIDTH}px` }}
            />
          )}

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
                  style={{ width: `${CELL_WIDTH}px` }}
                />
              );
            })}
          </div>

          {/* 今日列のハイライト (z-20) - 左右の細い線と薄いオーバーレイ */}
          {showTodayHighlight && days.map((d, i) => isToday(d) && (
            <div
              key={`today-highlight-${d.toISOString()}`}
              className="absolute top-0 bottom-0 border-x border-amber-400/50 bg-amber-400/10 z-20 pointer-events-none"
              style={{ left: `${i * CELL_WIDTH}px`, width: `${CELL_WIDTH}px` }}
            />
          ))}

          {/* 要素行の描画 (z-10) */}
          <div className="relative z-10">
            {projects.map(project => {
              const pRange = projectDisplayRanges[project.id];
              return (
                <div key={`p-wrapper-${project.id}`} className="relative">
                  {/* プロジェクト全体の期間をハイライト */}
                  {showProjectRange && pRange && (
                    <div
                      className="wbs-project-range-highlight"
                      style={{
                        left: `${pRange.left}px`,
                        width: `${pRange.width}px`,
                        '--highlight-bg': `${getStatusColor(project.status_id)}26`, // 15% opacity
                        '--highlight-border': `${getStatusColor(project.status_id)}73` // 45% opacity
                      } as React.CSSProperties}
                    />
                  )}

                  {/* Project Row */}
                  <div key={`p-${project.id}`} className={`${commonRowClasses} wbs-row-project`}>
                    {renderBar(project, false)}
                  </div>

                  {expandedProjects[project.id] !== false && project.tasks.map(task => (
                    <div key={`t-wrapper-${task.id}`}>
                      {/* Task Row */}
                      <div key={`t-${task.id}`} className={`${commonRowClasses} wbs-row-task`}>
                        {renderBar(task, false)}
                      </div>

                      {expandedTasks[task.id] !== false && task.subtasks.map(subtask => (
                        <div key={`s-${subtask.id}`} className={`${commonRowClasses} wbs-row-subtask`}>
                          {renderBar(subtask, true)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedDate && (
        <MarkerModal
          isOpen={isMarkerModalOpen}
          date={selectedDate}
          existingMarker={initialData?.markers?.find(m => m.marker_date === format(selectedDate, 'yyyy-MM-dd'))}
          onSave={handleMarkerSave}
          onDelete={handleMarkerDelete}
          onClose={() => setIsMarkerModalOpen(false)}
        />
      )}
    </div>
  );
});

export default GanttChart;
