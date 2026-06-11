import { Subtask } from '../types/wbs';
import { toDateKey } from './ganttDateRange';

export type ResourcePlannedDateRange = {
  start: string;
  end: string;
};

export function getResourcePlannedDateRange(
  subtask: Pick<Subtask, 'planned_start_date' | 'planned_end_date' | 'actual_end_date' | 'status_id'>,
  doneStatusId: number | null
): ResourcePlannedDateRange | null {
  const plannedStart = toDateKey(subtask.planned_start_date);
  const plannedEnd = toDateKey(subtask.planned_end_date);
  if (!plannedStart && !plannedEnd) return null;

  const rangeStart = plannedStart ?? plannedEnd;
  const rangeEnd = plannedEnd ?? plannedStart;
  if (!rangeStart || !rangeEnd) return null;

  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  let end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;

  const actualEnd = toDateKey(subtask.actual_end_date);
  if (doneStatusId !== null && subtask.status_id === doneStatusId && actualEnd && actualEnd < end) {
    end = actualEnd;
  }

  return start <= end ? { start, end } : null;
}

export function withResourcePlannedDateRange<T extends Pick<Subtask, 'planned_start_date' | 'planned_end_date' | 'actual_end_date' | 'status_id'>>(
  subtask: T,
  doneStatusId: number | null
): T {
  const range = getResourcePlannedDateRange(subtask, doneStatusId);
  const nextStart = range?.start ?? null;
  const nextEnd = range?.end ?? null;

  if (subtask.planned_start_date === nextStart && subtask.planned_end_date === nextEnd) {
    return subtask;
  }

  return {
    ...subtask,
    planned_start_date: nextStart,
    planned_end_date: nextEnd,
  };
}
