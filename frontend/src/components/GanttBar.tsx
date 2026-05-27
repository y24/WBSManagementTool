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
  projectName?: string;
  taskName?: string;
  isDelayedHighlight?: boolean;
  isResourceView?: boolean;
  compactResourceBar?: boolean;
  highlightSameAssignee?: boolean;
  hoveredAssigneeId?: number | null;
  setHoveredAssigneeId?: (id: number | null) => void;
  barVisibility?: 'both' | 'planned' | 'actual';
  overridePlannedBarColor?: string;
  overrideActualBarColor?: string;
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
  compactResourceBar = false,
  projectName,
  taskName,
  highlightSameAssignee = false,
  hoveredAssigneeId = null,
  setHoveredAssigneeId,
  barVisibility = 'both',
  overridePlannedBarColor,
  overrideActualBarColor,
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
      // 同一担当者の強調表示
      if (highlightSameAssignee && item.assignee_id && setHoveredAssigneeId) {
        setHoveredAssigneeId(item.assignee_id);
      }
    }, 500);
  }, [dragState, item.id, item.assignee_id, highlightSameAssignee, setHoveredAssigneeId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setIsHovered(false);
    if (highlightSameAssignee && setHoveredAssigneeId) {
      setHoveredAssigneeId(null);
    }
  }, [highlightSameAssignee, setHoveredAssigneeId]);

  // プロジェクト/タスクで展開中の場合は、従来は何も表示していなかったが、
  // 手入力（is_auto_planned_date = false）の場合は表示するように変更する。
  const isAutoPlanned = (itemType === 'project' || itemType === 'task') && item.is_auto_planned_date;
  const isAutoActual = (itemType === 'project' || itemType === 'task') && item.is_auto_actual_date;
  const tooltipItem = (projectName || taskName)
    ? {
        ...item,
        ...(projectName ? { project_name: projectName } : {}),
        ...(taskName ? { task_name: taskName } : {}),
      }
    : item;

  if ((itemType === 'project' || itemType === 'task') && isExpanded && isAutoPlanned && isAutoActual) {
    return null;
  }

  const isSubtask = itemType === 'subtask';

  const isCurrentDragItem = dragState?.itemId === item.id && dragState?.itemType === itemType;

  // ドラッグ中の反映があればそれを使う。ID は階層間で重複し得るため、対象種別も必ず見る。
  const temp = isCurrentDragItem ? tempDates[item.id] : undefined;
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

  // 中断を考慮したセグメント計算
  const calculateSegments = (start: string, end: string, interruptions: any[]) => {
    const s = parseISO(start);
    const e = parseISO(end);
    if (!isValid(s) || !isValid(e)) return [];
    
    // 終了日が開始日より前なら空
    if (e < s) return [{ start: s, end: s }];

    if (!interruptions || interruptions.length === 0) {
      return [{ start: s, end: e }];
    }
    
    const sorted = [...interruptions]
      .filter(i => i.interruption_date)
      .sort((a, b) => a.interruption_date.localeCompare(b.interruption_date));
      
    const segments: { start: Date, end: Date }[] = [];
    let currentStart = s;
    
    for (const inter of sorted) {
      const iDate = parseISO(inter.interruption_date);
      if (!isValid(iDate)) continue;
      
      // 中断日は作業実績として表示対象に含める。
      // 開始日と中断日が同じ場合も、その1日分のセグメントを残す。
      if (iDate >= currentStart) {
        const segmentEnd = iDate < e ? iDate : e;
        segments.push({ start: currentStart, end: segmentEnd });
        if (segmentEnd.getTime() === e.getTime()) {
          currentStart = e;
          break;
        }
      }
      
      // 再開日があるかチェック
      if (inter.resumption_date) {
        const rDate = parseISO(inter.resumption_date);
        if (isValid(rDate)) {
          if (rDate > currentStart) {
            currentStart = rDate;
          }
        } else {
          // 再開日が不正な場合は、この中断で終了
          currentStart = e;
          break;
        }
      } else {
        // 再開日が無い場合、この中断以降は表示しない
        currentStart = e;
        break;
      }
      
      if (currentStart >= e) break;
    }
    
    if (currentStart < e) {
      segments.push({ start: currentStart, end: e });
    }
    
    return segments;
  };

  // 実績セグメントの計算
  const actualSegments = (actualStart && actualEnd) 
    ? calculateSegments(actualStart, actualEnd, item.interruptions || [])
    : (actualStart ? [{ start: parseISO(actualStart), end: parseISO(actualStart) }] : []);

  // レビューセグメントの計算
  const reviewSegments = (isSubtask && actualStart && actualEnd && reviewStart)
    ? calculateSegments(reviewStart, actualEnd, item.interruptions || [])
    : [];

  const canShowPlannedBar = barVisibility === 'both' || barVisibility === 'planned';
  const canShowActualBar = barVisibility === 'both' || barVisibility === 'actual';
  const showPlannedBar = canShowPlannedBar && pStart !== undefined && pWidth !== undefined && (!isAutoPlanned || !isExpanded);
  const showActualBar = canShowActualBar && actualSegments.length > 0 && (!isAutoActual || !isExpanded);
  const hasActual = showActualBar; 

  const progressPercentValue = Number(item.progress_percent);
  const hasProgressPercent = item.progress_percent !== undefined && item.progress_percent !== null && Number.isFinite(progressPercentValue);
  const clampedProgressPercent = hasProgressPercent ? Math.min(Math.max(progressPercentValue, 0), 100) : 0;
  const actualSegmentWidths = actualSegments.map((seg) => getDateWidth(seg.start, seg.end, scale));
  const totalActualSegmentWidth = actualSegmentWidths.reduce((sum, width) => sum + Math.max(width, 0), 0);
  const actualProgressWidth = totalActualSegmentWidth * (clampedProgressPercent / 100);

  const getActualProgressSegmentWidth = (segmentIndex: number, segmentWidth: number) => {
    if (!hasProgressPercent || totalActualSegmentWidth <= 0) return 0;

    const precedingWidth = actualSegmentWidths
      .slice(0, segmentIndex)
      .reduce((sum, width) => sum + Math.max(width, 0), 0);

    return Math.min(Math.max(actualProgressWidth - precedingWidth, 0), segmentWidth);
  };



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

  const actualRightEdge = actualSegments.length > 0
    ? Math.max(
        ...actualSegments.map((seg) => (
          getDateX(seg.start, baseDate, scale) + getDateWidth(seg.start, seg.end, scale)
        ))
      )
    : 0;

  const rightEdge = Math.max(
    pStart !== undefined && pWidth !== undefined ? pStart + pWidth : 0,
    actualRightEdge
  );

  const isDragging = isCurrentDragItem;
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

  const allowBarEdit = scale !== 'month';

  const subtaskTypeName = isSubtask ? initialData?.subtask_types.find(t => t.id === item.subtask_type_id)?.type_name : null;
  const itemName = itemType === 'project' ? item.project_name : (itemType === 'task' ? item.task_name : subtaskTypeName);


  
  const resourceBarTop = compactResourceBar ? '3px' : '8px';
  const resourceBarLabelTop = compactResourceBar ? '4px' : '9px';
  const subtaskBarTopClass = isSubtask ? (isResourceView ? (compactResourceBar ? 'top-[3px]' : 'top-[8px]') : 'top-[12px]') : 'top-[10px]';
  const subtaskBarTopPx = isSubtask ? (isResourceView ? resourceBarTop : '12px') : '10px';
  const subtaskBarHeightClass = isSubtask && isResourceView ? 'h-[18px]' : 'h-[16px]';
  const subtaskBarHeightPx = isSubtask && isResourceView ? '18px' : '16px';
  const barLabelTopPx = isSubtask && isResourceView ? resourceBarLabelTop : '13px';
  const warningTopPx = isSubtask && isResourceView ? resourceBarTop : '10px';

  const isHighlighted = highlightSameAssignee && hoveredAssigneeId !== null && item.assignee_id === hoveredAssigneeId;
  const customLabelRanges = showActualBar && actualSegments.length > 0
    ? actualSegments.map((seg, idx) => ({
        key: `actual-label-${idx}`,
        left: getDateX(seg.start, baseDate, scale),
        width: actualSegmentWidths[idx] ?? getDateWidth(seg.start, seg.end, scale),
      }))
    : (showPlannedBar && pStart !== undefined && pWidth !== undefined
      ? [{ key: 'planned-label', left: pStart, width: pWidth }]
      : []);

  return (
    <div
      className="relative w-full h-full min-h-[30px] flex flex-col justify-start pointer-events-none"
    >
      {showPlannedBar && (
        <>
          <div
            className={`absolute ${hasActual ? 'top-[6px]' : subtaskBarTopClass} ${hasActual ? 'rounded-t-sm' : 'rounded-sm'} ${hasActual ? (isSubtask ? 'h-1.5' : 'h-1') : subtaskBarHeightClass} ${overridePlannedBarColor ? '' : 'bg-gray-400 dark:bg-slate-500'} ${overridePlannedBarColor ? '' : (isSubtask ? 'opacity-80 dark:opacity-70' : 'opacity-40 dark:opacity-30')} ${!allowBarEdit || isAutoPlanned ? '' : 'gantt-bar-draggable'} ${isDragging && dragState?.barType === 'planned' ? 'gantt-bar-dragging' : ''} ${!hasActual && isDelayedHighlight ? 'ring-2 ring-red-500 ring-inset dark:ring-red-400' : ''} ${!hasActual && isHighlighted ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-slate-900 z-30' : ''} pointer-events-auto transition-shadow duration-200`}
            style={{ left: `${pStart}px`, width: `${pWidth}px`, ...(overridePlannedBarColor ? { backgroundColor: overridePlannedBarColor } : {}) }}
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
          {actualSegments.map((seg, idx) => {
            const sX = getDateX(seg.start, baseDate, scale);
            const sW = actualSegmentWidths[idx] ?? getDateWidth(seg.start, seg.end, scale);
            const progressSegmentWidth = getActualProgressSegmentWidth(idx, sW);
            return (
              <div
                key={`actual-${idx}`}
                className={`absolute ${subtaskBarTopClass} ${subtaskBarHeightClass} rounded-sm shadow-sm flex items-center justify-center overflow-hidden ${isSubtask ? '' : 'opacity-60'} ${!allowBarEdit ? '' : (isFixedEnd ? 'cursor-not-allowed gantt-resize-forbidden' : (isAutoActual ? '' : 'gantt-bar-draggable'))} ${isDragging && dragState?.barType === 'actual' ? 'gantt-bar-dragging' : ''} ${isDelayedHighlight ? 'ring-2 ring-red-500 ring-inset z-20 dark:ring-red-400' : ''} ${isHighlighted ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-slate-900 z-30' : ''} pointer-events-auto transition-shadow duration-200`}
                style={{ left: `${sX}px`, width: `${sW}px`, backgroundColor: overrideActualBarColor ?? typeColor }}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseDown={(e) => {
                  if (!allowBarEdit || isFixedEnd || isAutoActual) return;
                  handleMouseDown(e, item.id, itemType, 'actual', 'move', { start: actualStart, end: actualEnd, reviewStart: reviewStart, name: itemName ?? undefined });
                }}
              >
                {/* リサイズハンドル (最初と最後のセグメントのみ) */}
                {allowBarEdit && (!isAutoActual) && idx === 0 && (
                  <div
                    className="gantt-resize-handle gantt-resize-handle-left"
                    onMouseDown={(e) => handleMouseDown(e, item.id, itemType, 'actual', 'resize-left', { start: actualStart, end: actualEnd, reviewStart: reviewStart, name: itemName ?? undefined })}
                  />
                )}
                {allowBarEdit && (!isAutoActual) && idx === actualSegments.length - 1 && (
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

                {showProgressRate && item.progress_percent !== undefined && item.progress_percent !== null && idx === actualSegments.length - 1 && (
                  <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-none pointer-events-none relative z-10">
                    {item.progress_percent}%
                  </span>
                )}

                {progressSegmentWidth > 0 && (
                  <div
                    className="absolute left-0 bottom-0 h-[3px] rounded-b-sm bg-black/30 dark:bg-black/40 pointer-events-none z-[5]"
                    style={{ width: `${progressSegmentWidth}px` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
          
          {reviewSegments.map((seg, idx) => {
             const rX = getDateX(seg.start, baseDate, scale);
             const rW = getDateWidth(seg.start, seg.end, scale);
             return (
              <div
                key={`review-${idx}`}
                className={`absolute ${subtaskBarTopClass} ${subtaskBarHeightClass} rounded-sm bg-white/30 backdrop-blur-[1px] pointer-events-none`}
                style={{ left: `${rX}px`, width: `${rW}px` }}
                title="レビュー中"
              />
             );
          })}

          {/* レビュー境界ハンドル (常に最初のレビューセグメントの開始位置に表示) */}
          {allowBarEdit && isSubtask && actualStart && actualEnd && reviewStart && reviewSegments.length > 0 && (
            <div
              className="gantt-review-handle pointer-events-auto"
              style={{
                left: `${getDateX(reviewSegments[0].start, baseDate, scale) - 5}px`,
                top: subtaskBarTopPx,
                height: subtaskBarHeightPx,
                zIndex: getDateX(reviewSegments[0].start, baseDate, scale) === getDateX(actualSegments[0].start, baseDate, scale) ? 19 : 25
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
                left: `${(actualSegments.length > 0 ? getDateX(actualSegments[0].start, baseDate, scale) : (pStart || 0)) - 4}px`,
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
                left: `${(actualSegments.length > 0 ? getDateX(actualSegments[0].start, baseDate, scale) : (pStart || 0)) - 4}px`,
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
                left: `${(actualSegments.length > 0 ? getDateX(actualSegments[0].start, baseDate, scale) : (pStart || 0)) - 4}px`,
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
      {customLabel && customLabelRanges.map((range) => (
        <div
          key={range.key}
          className={`absolute text-[11px] whitespace-nowrap pointer-events-none drop-shadow-sm z-30 ${isResourceView ? 'text-white' : 'text-gray-700 dark:text-gray-300'
            }`}
          style={{
            left: `${range.left + 4}px`,
            top: barLabelTopPx,
            maxWidth: `${Math.max(range.width - 8, 0)}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={customLabel}
        >
          {customLabel}
        </div>
      ))}

      {isDelayed && warningText && !customLabel && !isResourceView && (
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
          item={tooltipItem}
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

const getActiveTemp = (props: GanttBarProps) => {
  const { dragState, item, itemType, tempDates } = props;
  return dragState?.itemId === item.id && dragState?.itemType === itemType
    ? tempDates[item.id]
    : undefined;
};

const areGanttBarPropsEqual = (prev: GanttBarProps, next: GanttBarProps) => {
  const prevIsDragging = prev.dragState?.itemId === prev.item.id && prev.dragState?.itemType === prev.itemType;
  const nextIsDragging = next.dragState?.itemId === next.item.id && next.dragState?.itemType === next.itemType;

  return (
    prev.item === next.item &&
    prev.itemType === next.itemType &&
    prev.baseDate === next.baseDate &&
    prev.cellWidth === next.cellWidth &&
    prev.scale === next.scale &&
    prev.initialData === next.initialData &&
    getActiveTemp(prev) === getActiveTemp(next) &&
    Boolean(prev.dragState) === Boolean(next.dragState) &&
    prevIsDragging === nextIsDragging &&
    prev.isDarkMode === next.isDarkMode &&
    prev.showProgressRate === next.showProgressRate &&
    prev.showAssigneeName === next.showAssigneeName &&
    prev.handleMouseDown === next.handleMouseDown &&
    prev.getStatusColor === next.getStatusColor &&
    prev.getAssigneeColor === next.getAssigneeColor &&
    prev.colorMode === next.colorMode &&
    prev.isExpanded === next.isExpanded &&
    prev.customLabel === next.customLabel &&
    prev.projectName === next.projectName &&
    prev.taskName === next.taskName &&
    prev.isDelayedHighlight === next.isDelayedHighlight &&
    prev.isResourceView === next.isResourceView &&
    prev.compactResourceBar === next.compactResourceBar &&
    prev.highlightSameAssignee === next.highlightSameAssignee &&
    prev.hoveredAssigneeId === next.hoveredAssigneeId &&
    prev.setHoveredAssigneeId === next.setHoveredAssigneeId &&
    prev.barVisibility === next.barVisibility &&
    prev.overridePlannedBarColor === next.overridePlannedBarColor &&
    prev.overrideActualBarColor === next.overrideActualBarColor
  );
};

export default React.memo(GanttBar, areGanttBarPropsEqual);
