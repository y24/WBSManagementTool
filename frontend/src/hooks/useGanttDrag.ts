import { useState, useCallback, useEffect, useRef } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { apiClient } from '../api/client';
import { InitialData } from '../types';
import { addBusinessDays, getBusinessDaysCount, calculateReviewCalendarDays } from '../components/WBSTree/utils';

export type DragMode = 'move' | 'resize-left' | 'resize-right' | 'resize-review' | 'resize-planned-review' | 'marker-move';
export type ItemType = 'project' | 'task' | 'subtask' | 'marker';
export type BarType = 'planned' | 'actual' | 'marker';

export interface DragState {
  itemId: number;
  itemType: ItemType;
  barType: BarType;
  mode: DragMode;
  startX: number;
  initialDates: {
    start?: string;
    end?: string;
    reviewStart?: string;
    reviewDays?: number;
    name?: string;
  };
}

export const CELL_WIDTH = 24;

export const useGanttDrag = (
  initialData: InitialData | null,
  onRefresh?: () => void
) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tempDates, setTempDates] = useState<Record<number, any>>({});
  
  // イベントリスナー内での最新値参照用
  const dragStateRef = useRef<DragState | null>(null);
  const tempDatesRef = useRef<Record<number, any>>({});
  const movedRef = useRef(false);

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    itemId: number,
    itemType: ItemType,
    barType: BarType,
    mode: DragMode,
    initialDates: { start?: string; end?: string; reviewStart?: string; reviewDays?: number; name?: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const state = {
      itemId,
      itemType,
      barType,
      mode,
      startX: e.clientX,
      initialDates
    };
    setDragState(state);
    dragStateRef.current = state;
    movedRef.current = false;
    document.body.classList.add('user-select-none');
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const currentDrag = dragStateRef.current;
    if (!currentDrag || !initialData) return;

    const deltaX = e.clientX - currentDrag.startX;
    if (Math.abs(deltaX) > 3) {
      movedRef.current = true;
    }
    const deltaDays = Math.round(deltaX / CELL_WIDTH);

    const holidays = initialData.holidays.map(h => h.holiday_date);
    const { start, end, reviewStart, name } = currentDrag.initialDates;
    const update: any = { 
      barType: currentDrag.barType,
      mouseX: e.clientX,
      mouseY: e.clientY
    };
    let tooltipText = "";
    let prefix = "";
    if (currentDrag.barType === 'planned') {
      prefix = "[計画]";
    } else if (currentDrag.barType === 'actual') {
      prefix = "[実績]";
    }
    const namePrefix = name ? `${prefix}${name}: ` : prefix;

    if (currentDrag.mode === 'move') {
      if (start) {
        const s = parseISO(start);
        const eDate = end ? parseISO(end) : s;
        const originalBusinessDays = getBusinessDaysCount(s, eDate, holidays);
        const movedStart = addDays(s, deltaDays);
        const movedEnd = addBusinessDays(movedStart, originalBusinessDays, holidays);

        const startStr = format(movedStart, 'yyyy-MM-dd');
        const endStr = format(movedEnd, 'yyyy-MM-dd');
        
        const startMD = format(movedStart, 'M/d');
        const endMD = format(movedEnd, 'M/d');
        tooltipText = `${namePrefix}${startMD}~${endMD} (${originalBusinessDays}営業日)`;

        if (currentDrag.barType === 'planned') {
          update.planned_start_date = startStr;
          update.planned_end_date = endStr;
        } else {
          update.actual_start_date = startStr;
          update.actual_end_date = endStr;
          if (reviewStart) {
            const rs = parseISO(reviewStart);
            update.review_start_date = format(addDays(rs, deltaDays), 'yyyy-MM-dd');
          }
        }
      }
    } else if (currentDrag.mode === 'resize-left') {
      if (start) {
        const s = parseISO(start);
        const updated = addDays(s, deltaDays);
        const currentEndISO = end || start;
        if (currentEndISO && updated > parseISO(currentEndISO)) return;
        
        const startStr = format(updated, 'yyyy-MM-dd');
        const endStr = currentEndISO!;
        const bDays = getBusinessDaysCount(parseISO(startStr), parseISO(endStr), holidays);
        
        const startMD = format(updated, 'M/d');
        const endMD = format(parseISO(endStr), 'M/d');
        tooltipText = `${namePrefix}${startMD}~${endMD} (${bDays}営業日)`;

        if (currentDrag.barType === 'planned') {
          update.planned_start_date = startStr;
        } else {
          update.actual_start_date = startStr;
        }
      }
    } else if (currentDrag.mode === 'resize-right') {
      if (end || start) {
        const eDate = parseISO(end || start!);
        const updated = addDays(eDate, deltaDays);
        const currentStartISO = start || end;
        if (currentStartISO && updated < parseISO(currentStartISO)) return;
        
        const endStr = format(updated, 'yyyy-MM-dd');
        const startStr = currentStartISO!;
        const bDays = getBusinessDaysCount(parseISO(startStr), parseISO(endStr), holidays);

        const startMD = format(parseISO(startStr), 'M/d');
        const endMD = format(updated, 'M/d');
        tooltipText = `${namePrefix}${startMD}~${endMD} (${bDays}営業日)`;

        if (currentDrag.barType === 'planned') {
          update.planned_end_date = endStr;
        } else {
          update.actual_end_date = endStr;
          if (reviewStart) {
            const rs = parseISO(reviewStart);
            update.review_start_date = format(addDays(rs, deltaDays), 'yyyy-MM-dd');
          }
        }
      }
    } else if (currentDrag.mode === 'resize-review') {
      if (reviewStart) {
        const rs = parseISO(reviewStart);
        const updated = addDays(rs, deltaDays);
        if (start && updated < parseISO(start)) return;
        if (end && updated > parseISO(end)) return;
        update.review_start_date = format(updated, 'yyyy-MM-dd');
        
        const rStartStr = update.review_start_date;
        const rEndStr = end || rStartStr;
        const bDays = getBusinessDaysCount(parseISO(rStartStr), parseISO(rEndStr), holidays);
        tooltipText = `${prefix}レビュー: ${bDays} 営業日`;
      }
    } else if (currentDrag.mode === 'resize-planned-review') {
      if (end) {
        const pEnd = parseISO(end);
        const pStart = parseISO(start!);
        const calendarDays = calculateReviewCalendarDays(pEnd, currentDrag.initialDates.reviewDays || 0, holidays);
        const initialRStart = addDays(pEnd, -(calendarDays - 1));
        const movedRStart = addDays(initialRStart, deltaDays);
        let effectiveRStart = movedRStart;
        if (effectiveRStart < pStart) effectiveRStart = pStart;
        if (effectiveRStart > pEnd) effectiveRStart = pEnd;
        update.review_days = getBusinessDaysCount(effectiveRStart, pEnd, holidays);
        tooltipText = `${prefix}レビュー: ${update.review_days} 営業日`;
      }
    } else if (currentDrag.mode === 'marker-move') {
      if (start) {
        const s = parseISO(start);
        const updated = addDays(s, deltaDays);
        update.marker_date = format(updated, 'yyyy-MM-dd');
        const dateMD = format(updated, 'M/d');
        tooltipText = `${namePrefix}${dateMD}`;
      }
    }

    update.tooltipText = tooltipText;

    setTempDates(prev => {
      const next = {
        ...prev,
        [currentDrag.itemId]: {
          ...prev[currentDrag.itemId],
          ...update
        }
      };
      tempDatesRef.current = next;
      return next;
    });
  }, [initialData]);

  const handleMouseUp = useCallback(async () => {
    const currentDrag = dragStateRef.current;
    if (!currentDrag) return;

    const finalTemp = tempDatesRef.current[currentDrag.itemId];
    const moved = movedRef.current;

    setDragState(null);
    dragStateRef.current = null;
    setTempDates({});
    tempDatesRef.current = {};
    document.body.classList.remove('user-select-none');

    // 次のクリックイベントを抑制するためのフラグ処理
    if (moved) {
      const suppressClick = (e: MouseEvent) => {
        e.stopImmediatePropagation();
        window.removeEventListener('click', suppressClick, true);
      };
      window.addEventListener('click', suppressClick, true);
      setTimeout(() => window.removeEventListener('click', suppressClick, true), 500);
    }

    if (!moved || !finalTemp) return;

    try {
      const endpoint = `/${currentDrag.itemType}s/${currentDrag.itemId}`;
      const payload: any = {};

      if (currentDrag.itemType === 'marker') {
        if (finalTemp.marker_date) payload.marker_date = finalTemp.marker_date;
      } else if (currentDrag.barType === 'planned') {
        if (finalTemp.planned_start_date) payload.planned_start_date = finalTemp.planned_start_date;
        if (finalTemp.planned_end_date) payload.planned_end_date = finalTemp.planned_end_date;
      } else {
        if (finalTemp.actual_start_date) payload.actual_start_date = finalTemp.actual_start_date;
        if (finalTemp.actual_end_date) payload.actual_end_date = finalTemp.actual_end_date;
      }

      if (finalTemp.review_start_date !== undefined) {
        payload.review_start_date = finalTemp.review_start_date;
      }
      if (finalTemp.review_days !== undefined) {
        payload.review_days = finalTemp.review_days;
      }

      await apiClient.patch(endpoint, payload);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to update period:', err);
      alert('期間の更新に失敗しました。');
    }
  }, [onRefresh]);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  return {
    dragState,
    tempDates,
    handleMouseDown
  };
};
