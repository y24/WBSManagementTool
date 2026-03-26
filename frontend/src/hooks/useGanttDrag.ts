import { useState, useCallback, useEffect } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { apiClient } from '../api/client';
import { InitialData } from '../types';
import { addBusinessDays, getBusinessDaysCount, calculateReviewCalendarDays } from '../components/WBSTree/utils';

export type DragMode = 'move' | 'resize-left' | 'resize-right' | 'resize-review' | 'resize-planned-review';
export type ItemType = 'project' | 'task' | 'subtask';
export type BarType = 'planned' | 'actual';

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
    setDragState({
      itemId,
      itemType,
      barType,
      mode,
      startX: e.clientX,
      initialDates
    });
    document.body.classList.add('user-select-none');
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !initialData) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaDays = Math.round(deltaX / CELL_WIDTH);

    if (deltaDays === 0) {
      setTempDates(prev => ({ ...prev, [dragState.itemId]: null }));
      return;
    }

    const holidays = initialData.holidays.map(h => h.holiday_date);
    const { start, end, reviewStart } = dragState.initialDates;
    const update: any = { barType: dragState.barType };

    if (dragState.mode === 'move') {
      if (start && end) {
        const s = parseISO(start);
        const eDate = parseISO(end);
        const businessDays = getBusinessDaysCount(s, eDate, holidays);
        const movedStart = addDays(s, deltaDays);
        const movedEnd = addBusinessDays(movedStart, businessDays, holidays);

        if (dragState.barType === 'planned') {
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
    } else if (dragState.mode === 'resize-left') {
      if (start) {
        const s = parseISO(start);
        const updated = addDays(s, deltaDays);
        if (end && updated > parseISO(end)) return;
        if (dragState.barType === 'planned') {
          update.planned_start_date = format(updated, 'yyyy-MM-dd');
        } else {
          update.actual_start_date = format(updated, 'yyyy-MM-dd');
        }
      }
    } else if (dragState.mode === 'resize-right') {
      if (end) {
        const eDate = parseISO(end);
        const updated = addDays(eDate, deltaDays);
        if (start && updated < parseISO(start)) return;
        if (dragState.barType === 'planned') {
          update.planned_end_date = format(updated, 'yyyy-MM-dd');
        } else {
          update.actual_end_date = format(updated, 'yyyy-MM-dd');
          if (reviewStart) {
            const rs = parseISO(reviewStart);
            update.review_start_date = format(addDays(rs, deltaDays), 'yyyy-MM-dd');
          }
        }
      }
    } else if (dragState.mode === 'resize-review') {
      if (reviewStart) {
        const rs = parseISO(reviewStart);
        const updated = addDays(rs, deltaDays);
        if (start && updated < parseISO(start)) return;
        if (end && updated > parseISO(end)) return;
        update.review_start_date = format(updated, 'yyyy-MM-dd');
      }
    } else if (dragState.mode === 'resize-planned-review') {
      if (end) {
        const pEnd = parseISO(end);
        const pStart = parseISO(start!);
        const calendarDays = calculateReviewCalendarDays(pEnd, dragState.initialDates.reviewDays || 0, holidays);
        const initialRStart = addDays(pEnd, -(calendarDays - 1));
        const movedRStart = addDays(initialRStart, deltaDays);
        let effectiveRStart = movedRStart;
        if (effectiveRStart < pStart) effectiveRStart = pStart;
        if (effectiveRStart > pEnd) effectiveRStart = pEnd;
        update.review_days = getBusinessDaysCount(effectiveRStart, pEnd, holidays);
      }
    }

    setTempDates(prev => ({
      ...prev,
      [dragState.itemId]: {
        ...prev[dragState.itemId],
        ...update
      }
    }));
  }, [dragState, initialData]);

  const handleMouseUp = useCallback(async () => {
    if (!dragState) return;

    const finalTemp = tempDates[dragState.itemId];
    setDragState(null);
    setTempDates({});
    document.body.classList.remove('user-select-none');

    if (!finalTemp) return;

    try {
      const endpoint = `/${dragState.itemType}s/${dragState.itemId}`;
      const payload: any = {};

      if (dragState.barType === 'planned') {
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
  }, [dragState, tempDates, onRefresh]);

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
