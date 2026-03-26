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
    initialDates: { start?: string; end?: string; reviewStart?: string; reviewDays?: number }
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
    const { start, end, reviewStart } = currentDrag.initialDates;
    const update: any = { barType: currentDrag.barType };

    if (deltaDays === 0) {
      setTempDates(prev => {
        const next = { ...prev, [currentDrag.itemId]: null };
        tempDatesRef.current = next;
        return next;
      });
      return;
    }

    if (currentDrag.mode === 'move') {
      if (start && end) {
        const s = parseISO(start);
        const eDate = parseISO(end);
        const businessDays = getBusinessDaysCount(s, eDate, holidays);
        const movedStart = addDays(s, deltaDays);
        const movedEnd = addBusinessDays(movedStart, businessDays, holidays);

        if (currentDrag.barType === 'planned') {
          update.planned_start_date = format(movedStart, 'yyyy-MM-dd');
          update.planned_end_date = format(movedEnd, 'yyyy-MM-dd');
        } else {
          update.actual_start_date = format(movedStart, 'yyyy-MM-dd');
          update.actual_end_date = format(movedEnd, 'yyyy-MM-dd');
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
        if (end && updated > parseISO(end)) return;
        if (currentDrag.barType === 'planned') {
          update.planned_start_date = format(updated, 'yyyy-MM-dd');
        } else {
          update.actual_start_date = format(updated, 'yyyy-MM-dd');
        }
      }
    } else if (currentDrag.mode === 'resize-right') {
      if (end) {
        const eDate = parseISO(end);
        const updated = addDays(eDate, deltaDays);
        if (start && updated < parseISO(start)) return;
        if (currentDrag.barType === 'planned') {
          update.planned_end_date = format(updated, 'yyyy-MM-dd');
        } else {
          update.actual_end_date = format(updated, 'yyyy-MM-dd');
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
      }
    } else if (currentDrag.mode === 'marker-move') {
      if (start) {
        const s = parseISO(start);
        const updated = addDays(s, deltaDays);
        update.marker_date = format(updated, 'yyyy-MM-dd');
      }
    }

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

    if (!finalTemp) return;

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
