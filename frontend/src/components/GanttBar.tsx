import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { parseISO, differenceInCalendarDays, isValid, addDays } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { InitialData } from '../types';
import { ItemType, BarType, DragMode, DragState } from '../hooks/useGanttDrag';
import { GanttScale } from '../types/wbs';
import { getDateX, getDateWidth } from '../utils/ganttUtils';
import { getWarning, calculateReviewCalendarDays } from './WBSTree/utils';
import GanttTooltip from './GanttTooltip';

interface GanttBarProps {
  item: any;
  itemType: 'project' | 'task' | 'subtask';
  baseDate: Date;
  cellWidth: number;
  scale: GanttScale;
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
    initialDates: { start?: string; end?: string; reviewStart?: string; reviewDays?: number; name?: string }
  ) => void;
  getStatusColor: (statusId: number | null | undefined) => string;
  getAssigneeColor: (assigneeId: number | null | undefined) => string;
  colorMode: 'status' | 'assignee';
  isExpanded?: boolean;
  customLabel?: string;
  isDelayedHighlight?: boolean;
  isResourceView?: boolean;
}

const GanttBar: React.FC<GanttBarProps> = ({
  item,
  itemType,
  baseDate,
  cellWidth,
  scale,
  initialData,
  tempDates,
  dragState,
  isDarkMode,
  showProgressRate,
  showAssigneeName,
  handleMouseDown,
  getStatusColor,
  getAssigneeColor,
  colorMode,
  isExpanded = false,
  customLabel,
  isDelayedHighlight = false,
  isResourceView = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    // ドラッグ中は何もしない
    if (dragState && dragState.itemId === item.id) return;

    setMousePos({ x: e.clientX, y: e.clientY });

    // 少し遅延させて表示（チラつき防止）
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setIsHovered(true);
    }, 500);
  }, [dragState, item.id]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setIsHovered(false);
  }, []);

  // プロジェクト/タスクで展開中の場合は、従来は何も表示していなかったが、
  // 手入力（is_auto_planned_date = false）の場合は表示するように変更する。
  const isAutoPlanned = (itemType === 'project' || itemType === 'task') && item.is_auto_planned_date;
  const isAutoActual = (itemType === 'project' || itemType === 'task') && item.is_auto_actual_date;

  if ((itemType === 'project' || itemType === 'task') && isExpanded && isAutoPlanned && isAutoActual) {
    return null;
  }

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
      pStart = getDateX(pS, baseDate, scale);
      pWidth = getDateWidth(pS, pE, scale);
    }
  }

  // 実績バーの計算
  let aStart: number | undefined, aWidth: number | undefined;
  let arStart: number | undefined, arWidth: number | undefined;
  if (actualStart) {
    const aS = parseISO(actualStart);
    const aE = actualEnd ? parseISO(actualEnd) : aS;
    if (isValid(aS) && isValid(aE)) {
      aStart = getDateX(aS, baseDate, scale);
      aWidth = getDateWidth(aS, aE, scale);

      if (isSubtask && reviewStart) {
        const rS = parseISO(reviewStart);
        if (isValid(rS)) {
          const effectiveRS = rS < aS ? aS : rS;
          const effectiveRE = aE < effectiveRS ? effectiveRS : aE;
          arStart = getDateX(effectiveRS, baseDate, scale);
          arWidth = getDateWidth(effectiveRS, effectiveRE, scale);
        }
      }
    }
  }

  const showPlannedBar = pStart !== undefined && pWidth !== undefined && (!isAutoPlanned || !isExpanded) && !(isResourceView && (aStart !== undefined && !isAutoActual));
  const showActualBar = aStart !== undefined && aWidth !== undefined && (!isAutoActual || !isExpanded);
  const hasActual = showActualBar; // For positioning other elements



  const typeColor = colorMode === 'assignee' && item.assignee_id 
    ? getAssigneeColor(item.assignee_id) 
    : getStatusColor(item.status_id);

  let rStart: number | undefined, rWidth: number | undefined;
  if (isSubtask && plannedStart && plannedEnd && reviewDays && reviewDays > 0) {
    const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
    const pE = parseISO(plannedEnd);
    const r_days_cal = calculateReviewCalendarDays(pE, reviewDays, holidays);
    rWidth = r_days_cal * (scale === 'day' ? cellWidth : (cellWidth / 30)); // Approximate for non-day scale
    // In non-day scale, it's better to calculate from specific dates
    const pS = parseISO(plannedStart);
    const rStartObj = new Date(pE);
    rStartObj.setDate(rStartObj.getDate() - (r_days_cal - 1));
    
    rStart = getDateX(rStartObj, baseDate, scale);
    rWidth = getDateWidth(rStartObj, pE, scale);

    const calcPWidth = getDateWidth(pS, pE, scale);
    if (rWidth > calcPWidth) rWidth = calcPWidth;
    if (rStart < (pStart || 0)) rStart = pStart;
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

  // すでに上で計算済みだがここでも定義 (読み取り専用・ドラッグ不可の判定用)
  const isActuallyAutoPlanned = (itemType === 'project' || itemType === 'task') && item.is_auto_planned_date;
  const isActuallyAutoActual = (itemType === 'project' || itemType === 'task') && item.is_auto_actual_date;

  const allowBarEdit = !isResourceView && scale !== 'month';

  const subtaskTypeName = isSubtask ? initialData?.subtask_types.find(t => t.id === item.subtask_type_id)?.type_name : null;
  const itemName = itemType === 'project' ? item.project_name : (itemType === 'task' ? item.task_name : subtaskTypeName);


  
  const subtaskBarTopClass = isSubtask ? (isResourceView ? 'top-[8px]' : 'top-[12px]') : 'top-[10px]';
  const subtaskBarTopPx = isSubtask ? (isResourceView ? '8px' : '12px') : '10px';
  const subtaskBarHeightClass = isSubtask && isResourceView ? 'h-[18px]' : 'h-[16px]';
  const subtaskBarHeightPx = isSubtask && isResourceView ? '18px' : '16px';
  const barLabelTopPx = isSubtask && isResourceView ? '9px' : '13px';
  const warningTopPx = isSubtask && isResourceView ? '8px' : '10px';

  return (
    <div
      className="relative w-full h-full min-h-[30px] flex flex-col justify-start pointer-events-none"
    >
      {showPlannedBar && (
        <>
          <div
            className={`absolute ${hasActual ? 'top-[6px]' : subtaskBarTopClass} ${hasActual ? 'rounded-t-sm' : 'rounded-sm'} ${hasActual ? (isSubtask ? 'h-1.5' : 'h-1') : subtaskBarHeightClass} bg-gray-400 dark:bg-slate-500 ${isSubtask ? 'opacity-80 dark:opacity-70' : 'opacity-40 dark:opacity-30'} ${!allowBarEdit || isAutoPlanned ? '' : 'gantt-bar-draggable'} ${isDragging && dragState?.barType === 'planned' ? 'gantt-bar-dragging' : ''} ${!hasActual && isDelayedHighlight ? 'ring-2 ring-red-500 ring-inset dark:ring-red-400' : ''} pointer-events-auto`}
            style={{ left: `${pStart}px`, width: `${pWidth}px` }}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => {
              if (!allowBarEdit || isAutoPlanned) return;
              handleMouseDown(e, item.id, itemType, 'planned', 'move', { start: plannedStart, end: plannedEnd, reviewDays, name: itemName ?? undefined });
            }}
          >
            {/* リサイズハンドル */}
            {allowBarEdit && !isAutoPlanned && (
              <>
                <div className="gantt-resize-handle gantt-resize-handle-left" onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'planned', 'resize-left', { start: plannedStart, end: plannedEnd, reviewDays, name: itemName ?? undefined })} />
                <div className="gantt-resize-handle gantt-resize-handle-right" onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'planned', 'resize-right', { start: plannedStart, end: plannedEnd, reviewDays, name: itemName ?? undefined })} />
              </>
            )}
          </div>
          {/* 計画レビュー境界ハンドル */}
          {allowBarEdit && isSubtask && rStart !== undefined && !isAutoPlanned && (
            <div
              className="gantt-review-handle pointer-events-auto"
              style={{
                left: `${rStart - 5}px`,
                top: hasActual ? '6px' : subtaskBarTopPx,
                height: hasActual ? (isSubtask ? '6px' : '4px') : subtaskBarHeightPx,
                // 開始日と重なっている時は、開始日のドラッグハンドル(z-index: 20)を優先するため、
                // レビューハンドルのz-indexを下げる
                zIndex: rStart === pStart ? 19 : 25
              }}
              onMouseDown={(e) => {
                handleMouseDown(e, item.id, itemType, 'planned', 'resize-planned-review', { start: plannedStart, end: plannedEnd, reviewDays, name: itemName ?? undefined });
              }}
            />
          )}
          {rStart !== undefined && rWidth !== undefined && (
            <div
              className={`absolute ${hasActual ? 'top-[6px]' : subtaskBarTopClass} ${hasActual ? 'rounded-tr-sm' : 'rounded-r-sm'} ${hasActual ? (isSubtask ? 'h-1.5' : 'h-1') : 'h-[16px]'} bg-white/40 dark:bg-white/10 ${isSubtask ? '' : 'opacity-40'} pointer-events-none`}
              style={{ left: `${rStart}px`, width: `${rWidth}px` }}
            />
          )}
        </>
      )}
      {showActualBar && (
        <>
          <div
            className={`absolute ${subtaskBarTopClass} ${subtaskBarHeightClass} rounded-sm shadow-sm flex items-center justify-center overflow-hidden ${isSubtask ? '' : 'opacity-60'} ${!allowBarEdit ? '' : (isFixedEnd ? 'cursor-not-allowed gantt-resize-forbidden' : (isAutoActual ? '' : 'gantt-bar-draggable'))} ${isDragging && dragState?.barType === 'actual' ? 'gantt-bar-dragging' : ''} ${isDelayedHighlight ? 'ring-2 ring-red-500 ring-inset z-20 dark:ring-red-400' : ''} pointer-events-auto`}
            style={{ left: `${aStart}px`, width: `${aWidth}px`, backgroundColor: typeColor }}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => {
              if (!allowBarEdit || isFixedEnd || isAutoActual) return;
              handleMouseDown(e, item.id, itemType, 'actual', 'move', { start: actualStart, end: actualEnd, reviewStart: reviewStart, name: itemName ?? undefined });
            }}
          >
            {/* リサイズハンドル */}
            {allowBarEdit && (!isAutoActual) && (
              <div
                className="gantt-resize-handle gantt-resize-handle-left"
                onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'actual', 'resize-left', { start: actualStart, end: actualEnd, reviewStart: reviewStart, name: itemName ?? undefined })}
              />
            )}
            {allowBarEdit && (!isAutoActual) && (
              <div
                className={`gantt-resize-handle gantt-resize-handle-right ${isFixedEnd ? 'gantt-resize-forbidden' : ''}`}
                onMouseDown={(e) => {
                  if (isFixedEnd) {
                    e.stopPropagation();
                    return;
                  }
                  handleMouseDown(e, item.id, itemType, 'actual', 'resize-right', { start: actualStart, end: actualEnd, reviewStart: reviewStart, name: itemName ?? undefined });
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
              className={`absolute ${subtaskBarTopClass} ${subtaskBarHeightClass} rounded-sm bg-white/30 backdrop-blur-[1px] pointer-events-none`}
              style={{ left: `${arStart}px`, width: `${arWidth}px` }}
              title="レビュー中"
            />
          )}
          {/* レビュー境界ハンドル */}
          {allowBarEdit && isSubtask && actualStart && actualEnd && reviewStart && arStart !== undefined && (
            <div
              className="gantt-review-handle pointer-events-auto"
              style={{
                left: `${arStart - 5}px`,
                top: subtaskBarTopPx,
                height: subtaskBarHeightPx,
                // 開始日と重なっている時は、開始日のドラッグハンドル(z-index: 20)を優先するため、
                // レビューハンドルのz-indexを下げる
                zIndex: arStart === aStart ? 19 : 25
              }}
              onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'actual', 'resize-review', { start: actualStart, end: actualEnd, reviewStart: reviewStart, name: itemName ?? undefined })}
            />
          )}
        </>
      )}
      {showAssigneeName && (showActualBar || showPlannedBar) && (
        <>

          {itemType === 'subtask' && item.assignee_id && (
            <div
              className="absolute text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap pointer-events-none"
              style={{
                left: `${(showActualBar ? aStart! : (pStart || 0)) - 4}px`,
                top: barLabelTopPx,
                transform: 'translateX(-100%)'
              }}
            >
              {subtaskTypeName
                ? `(${subtaskTypeName}) ${initialData?.members.find(m => m.id === item.assignee_id)?.member_name || ''}`
                : initialData?.members.find(m => m.id === item.assignee_id)?.member_name}
            </div>
          )}
          {itemType === 'task' && (
            <div
              className="absolute text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap pointer-events-none"
              style={{
                left: `${(showActualBar ? aStart! : (pStart || 0)) - 4}px`,
                top: barLabelTopPx,
                transform: 'translateX(-100%)'
              }}
            >
              ({item.task_name}){item.assignee_id ? ` ${initialData?.members.find(m => m.id === item.assignee_id)?.member_name || ''}` : ''}
            </div>
          )}
          {itemType === 'project' && (
            <div
              className="absolute text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap pointer-events-none"
              style={{
                left: `${(showActualBar ? aStart! : (pStart || 0)) - 4}px`,
                top: barLabelTopPx,
                transform: 'translateX(-100%)'
              }}
            >
              {item.project_name}
            </div>
          )}
        </>
      )}

      {/* カスタムラベル（担当者ビュー用） */}
      {customLabel && (showActualBar || showPlannedBar) && (
        <div

          className={`absolute text-[11px] whitespace-nowrap pointer-events-none drop-shadow-sm z-30 ${isResourceView ? 'text-white' : 'text-gray-700 dark:text-gray-300'
            }`}
          style={{
            left: `${(showActualBar ? aStart! : (pStart || 0)) + 4}px`,
            top: barLabelTopPx,
            maxWidth: `${Math.max((aWidth ?? pWidth ?? 0) - 8, 0)}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}

        >
          {customLabel}
        </div>
      )}

      {isDelayed && warningText && !customLabel && (
        <div
          className="absolute flex items-center z-20 pointer-events-auto cursor-help"
          style={{ top: warningTopPx, left: `${rightEdge + 4}px` }}
          title={warningText}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
        </div>
      )}

      {/* ドラッグ中のツールチップを表示 */}
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

      {/* 詳細ツールチップ */}
      {!dragState && isHovered && (
        <GanttTooltip
          item={item}
          itemType={itemType}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
          initialData={initialData}
          isVisible={isHovered}
        />
      )}
    </div>
  );
};

export default React.memo(GanttBar);
