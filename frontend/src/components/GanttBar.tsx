import React from 'react';
import { parseISO, differenceInCalendarDays, isValid } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { InitialData } from '../types';
import { ItemType, BarType, DragMode, DragState } from '../hooks/useGanttDrag';
import { getWarning, calculateReviewCalendarDays } from './WBSTree/utils';

interface GanttBarProps {
  item: any;
  itemType: ItemType;
  baseDate: Date;
  cellWidth: number;
  initialData: InitialData | null;
  tempDates: Record<number, any>;
  dragState: DragState | null;
  isDarkMode: boolean;
  showProgressRate: boolean;
  showAssigneeName: boolean;
  handleMouseDown: (
    e: React.MouseEvent,
    itemId: number,
    itemType: ItemType,
    barType: BarType,
    mode: DragMode,
    initialDates: { start?: string; end?: string; reviewStart?: string; reviewDays?: number }
  ) => void;
  getStatusColor: (statusId: number | null | undefined) => string;
}

const GanttBar: React.FC<GanttBarProps> = ({
  item,
  itemType,
  baseDate,
  cellWidth,
  initialData,
  tempDates,
  dragState,
  isDarkMode,
  showProgressRate,
  showAssigneeName,
  handleMouseDown,
  getStatusColor,
}) => {
  const isSubtask = itemType === 'subtask';

  // ドラッグ中の反映があればそれを使う
  const temp = tempDates[item.id];
  const plannedStart = temp?.planned_start_date || item.planned_start_date;
  const plannedEnd = temp?.planned_end_date || item.planned_end_date;
  const actualStart = temp?.actual_start_date || item.actual_start_date;
  const actualEnd = temp?.actual_end_date || item.actual_end_date;
  const reviewStart = temp?.review_start_date || item.review_start_date;
  const reviewDays = temp?.review_days !== undefined ? temp.review_days : item.review_days;

  // 計画バーの計算
  let pStart: number | undefined, pWidth: number | undefined;
  if (plannedStart && plannedEnd) {
    const pS = parseISO(plannedStart);
    const pE = parseISO(plannedEnd);
    if (isValid(pS) && isValid(pE)) {
      pStart = differenceInCalendarDays(pS, baseDate) * cellWidth;
      pWidth = (differenceInCalendarDays(pE, pS) + 1) * cellWidth;
    }
  }

  // 実績バーの計算
  let aStart: number | undefined, aWidth: number | undefined;
  let arStart: number | undefined, arWidth: number | undefined;
  if (actualStart) {
    const aS = parseISO(actualStart);
    const aE = actualEnd ? parseISO(actualEnd) : aS;
    if (isValid(aS) && isValid(aE)) {
      aStart = differenceInCalendarDays(aS, baseDate) * cellWidth;
      aWidth = (differenceInCalendarDays(aE, aS) + 1) * cellWidth;

      if (isSubtask && reviewStart) {
        const rS = parseISO(reviewStart);
        if (isValid(rS)) {
          const effectiveRS = rS < aS ? aS : rS;
          const effectiveRE = aE < effectiveRS ? effectiveRS : aE;
          arStart = differenceInCalendarDays(effectiveRS, baseDate) * cellWidth;
          arWidth = (differenceInCalendarDays(effectiveRE, effectiveRS) + 1) * cellWidth;
        }
      }
    }
  }

  const typeColor = isSubtask ? getStatusColor(item.status_id) : (isDarkMode ? '#334155' : '#cbd5e1');

  let rStart: number | undefined, rWidth: number | undefined;
  if (isSubtask && plannedStart && plannedEnd && reviewDays && reviewDays > 0) {
    const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
    const pE = parseISO(plannedEnd);
    const r_days_cal = calculateReviewCalendarDays(pE, reviewDays, holidays);
    rWidth = r_days_cal * cellWidth;

    const calcPWidth = (differenceInCalendarDays(pE, parseISO(plannedStart)) + 1) * cellWidth;
    if (rWidth > calcPWidth) rWidth = calcPWidth;
    rStart = (pStart || 0) + calcPWidth - rWidth;
  }

  const warningText = getWarning(item, initialData, isSubtask);
  const isDelayed = !!warningText;

  const rightEdge = Math.max(
    pStart !== undefined && pWidth !== undefined ? pStart + pWidth : 0,
    aStart !== undefined && aWidth !== undefined ? aStart + aWidth : 0
  );

  const isDragging = dragState?.itemId === item.id;
  const statusName = initialData?.statuses.find(s => s.id === item.status_id)?.status_name;
  const isFixedEnd = (
    statusName === 'In Progress' ||
    statusName === '進捗中' ||
    statusName === 'In Review' ||
    statusName === 'レビュー中'
  ) && itemType === 'subtask';

  const isAutoPlanned = (itemType === 'project' || itemType === 'task') && item.is_auto_planned_date;
  const isAutoActual = (itemType === 'project' || itemType === 'task') && item.is_auto_actual_date;

  return (
    <div className="relative w-full h-full min-h-[30px] flex flex-col justify-start">
      {pStart !== undefined && pWidth !== undefined && (
        <>
          <div
            className={`absolute top-[6px] rounded-t-sm ${isSubtask ? 'h-1.5' : 'h-1'} bg-gray-300 dark:bg-slate-600 opacity-85 dark:opacity-70 ${isAutoPlanned ? '' : 'gantt-bar-draggable'} ${isDragging && dragState?.barType === 'planned' ? 'gantt-bar-dragging' : ''}`}
            style={{ left: `${pStart}px`, width: `${pWidth}px` }}
            onMouseDown={(e) => {
              if (isAutoPlanned) return;
              handleMouseDown(e, item.id, itemType, 'planned', 'move', { start: plannedStart, end: plannedEnd, reviewDays });
            }}
          >
            {/* リサイズハンドル */}
            {!isAutoPlanned && (
              <>
                <div className="gantt-resize-handle gantt-resize-handle-left" onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'planned', 'resize-left', { start: plannedStart, end: plannedEnd, reviewDays })} />
                <div className="gantt-resize-handle gantt-resize-handle-right" onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'planned', 'resize-right', { start: plannedStart, end: plannedEnd, reviewDays })} />
              </>
            )}
          </div>
          {/* 計画レビュー境界ハンドル */}
          {isSubtask && rStart !== undefined && !isAutoPlanned && (
            <div
              className="gantt-review-handle"
              style={{ left: `${rStart - 5}px`, top: '6px', height: '6px' }}
              onMouseDown={(e) => {
                handleMouseDown(e, item.id, itemType, 'planned', 'resize-planned-review', { start: plannedStart, end: plannedEnd, reviewDays });
              }}
            />
          )}
          {rStart !== undefined && rWidth !== undefined && (
            <div
              className="absolute top-[6px] rounded-tr-sm h-1.5 bg-gray-400 dark:bg-slate-500 opacity-60 dark:opacity-50 pointer-events-none"
              style={{ left: `${rStart}px`, width: `${rWidth}px` }}
              title={`レビュー期間: ${reviewDays}日`}
            />
          )}
        </>
      )}
      {aStart !== undefined && aWidth !== undefined && (
        <>
          <div
            className={`absolute ${isSubtask ? 'top-[12px] h-[16px]' : 'top-[10px] h-[16px]'} rounded-sm shadow-sm flex items-center justify-center overflow-hidden ${isFixedEnd ? 'cursor-not-allowed gantt-resize-forbidden' : (isAutoActual ? '' : 'gantt-bar-draggable')} ${isDragging && dragState?.barType === 'actual' ? 'gantt-bar-dragging' : ''}`}
            style={{ left: `${aStart}px`, width: `${aWidth}px`, backgroundColor: typeColor }}
            title={`${item.progress_percent ? item.progress_percent + '%' : ''}`}
            onMouseDown={(e) => {
              if (isFixedEnd || isAutoActual) return;
              handleMouseDown(e, item.id, itemType, 'actual', 'move', { start: actualStart, end: actualEnd, reviewStart: reviewStart });
            }}
          >
            {/* リサイズハンドル */}
            {(!isAutoActual) && (
              <div
                className="gantt-resize-handle gantt-resize-handle-left"
                onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'actual', 'resize-left', { start: actualStart, end: actualEnd, reviewStart: reviewStart })}
              />
            )}
            {(!isAutoActual) && (
              <div
                className={`gantt-resize-handle gantt-resize-handle-right ${isFixedEnd ? 'gantt-resize-forbidden' : ''}`}
                onMouseDown={(e) => {
                  if (isFixedEnd) {
                    e.stopPropagation();
                    return;
                  }
                  handleMouseDown(e, item.id, itemType, 'actual', 'resize-right', { start: actualStart, end: actualEnd, reviewStart: reviewStart });
                }}
              />
            )}

            {showProgressRate && item.progress_percent !== undefined && item.progress_percent !== null && (
              <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-none pointer-events-none relative z-10">
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
          {/* レビュー境界ハンドル */}
          {isSubtask && actualStart && actualEnd && reviewStart && arStart !== undefined && (
            <div
              className="gantt-review-handle"
              style={{
                left: `${arStart - 5}px`,
                top: isSubtask ? '12px' : '10px',
                height: '16px',
                // 開始日と重なっている時は、開始日のドラッグハンドル(z-index: 20)を優先するため、
                // レビューハンドルのz-indexを下げる
                zIndex: arStart === aStart ? 19 : 25
              }}
              onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'actual', 'resize-review', { start: actualStart, end: actualEnd, reviewStart: reviewStart })}
            />
          )}
        </>
      )}
      {isSubtask && showAssigneeName && item.assignee_id && (aStart !== undefined || pStart !== undefined) && (
        <div
          className="absolute text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap pointer-events-none"
          style={{
            left: `${(aStart !== undefined ? aStart : (pStart || 0)) - 4}px`,
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

export default GanttBar;
