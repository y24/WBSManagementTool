import { format } from 'date-fns';
import { InitialData } from '../types';
import { Subtask } from '../types/wbs';

type SubtaskStatusFields = Pick<
  Subtask,
  'status_id' | 'progress_percent' | 'actual_start_date' | 'actual_end_date' | 'review_start_date' | 'review_days'
>;

export const parseStatusMapping = (value: string | null | undefined, fallback: number[]): number[] => {
  const parsed = value
    ?.split(',')
    .map(s => Number.parseInt(s.trim(), 10))
    .filter(n => !Number.isNaN(n));

  return parsed && parsed.length > 0 ? parsed : fallback;
};

export const hasPositiveReviewDays = (reviewDays: unknown): boolean => {
  return reviewDays != null && Number(reviewDays) > 0;
};

export const getSubtaskStatusIds = (initialData: InitialData) => {
  const removedStatusId = initialData.statuses.find(s => s.status_name === 'Removed')?.id ?? 7;
  const newIds = parseStatusMapping(initialData.status_mapping_new, [1]);
  const doneIds = parseStatusMapping(initialData.status_mapping_done, [4, 7]);
  const inReviewStatusId = initialData.statuses.find(s => s.status_name === 'In Review')?.id ?? 3;

  return {
    removedStatusId,
    newIds,
    doneIds,
    inReviewStatusId,
  };
};

export const getSubtaskStatusAutoUpdates = (
  subtask: SubtaskStatusFields,
  statusId: number,
  initialData: InitialData | null,
): Record<string, unknown> => {
  if (!initialData || statusId === subtask.status_id) return {};

  const updates: Record<string, unknown> = {};
  const { removedStatusId, newIds, doneIds, inReviewStatusId } = getSubtaskStatusIds(initialData);
  const today = format(new Date(), 'yyyy-MM-dd');

  if (statusId === removedStatusId) return updates;

  if (newIds.includes(statusId)) {
    updates.progress_percent = 0;
    updates.actual_start_date = null;
    updates.actual_end_date = null;
    updates.review_start_date = null;
    return updates;
  }

  if ([2, 3, ...doneIds].includes(statusId) && !subtask.actual_start_date) {
    updates.actual_start_date = today;
  }

  if (statusId === 2 || (statusId === inReviewStatusId && hasPositiveReviewDays(subtask.review_days))) {
    updates.actual_end_date = today;
  }

  if (statusId === inReviewStatusId && !subtask.review_start_date) {
    updates.review_start_date = today;
  }

  if (doneIds.includes(statusId) && statusId !== removedStatusId) {
    updates.progress_percent = 100;
    if (!subtask.actual_end_date) {
      updates.actual_end_date = today;
    }
  } else if (statusId === inReviewStatusId && (subtask.progress_percent == null || subtask.progress_percent < 80)) {
    updates.progress_percent = 80;
  }

  const wasDone = doneIds.includes(subtask.status_id) && subtask.status_id !== removedStatusId;
  const isDone = doneIds.includes(statusId) && statusId !== removedStatusId;
  if (wasDone && !isDone && statusId !== 2 && statusId !== inReviewStatusId && subtask.actual_end_date) {
    updates.actual_end_date = null;
  }

  return updates;
};

export const getSubtaskStatusOverwriteDetails = (
  subtask: SubtaskStatusFields,
  statusId: number,
  initialData: InitialData,
): string[] => {
  const { removedStatusId, newIds, doneIds, inReviewStatusId } = getSubtaskStatusIds(initialData);
  const isNew = newIds.includes(statusId) && statusId !== removedStatusId;
  const isDone = doneIds.includes(statusId) && statusId !== removedStatusId;
  const isOngoing = [2, 3].includes(statusId);
  const oldIsDone = doneIds.includes(subtask.status_id) && subtask.status_id !== removedStatusId;
  const details: string[] = [];

  if (isNew) {
    if (subtask.progress_percent !== 0 && subtask.progress_percent != null) {
      details.push(`進捗率: ${subtask.progress_percent}% -> 0%`);
    }
    if (subtask.actual_start_date) {
      details.push(`実績開始日: ${subtask.actual_start_date} -> (消去)`);
    }
    if (subtask.review_start_date) {
      details.push(`レビュー開始日: ${subtask.review_start_date} -> (消去)`);
    }
    if (subtask.actual_end_date) {
      details.push(`実績終了日: ${subtask.actual_end_date} -> (消去)`);
    }
    return details;
  }

  if (isDone && subtask.progress_percent !== 100 && subtask.progress_percent !== 0 && subtask.progress_percent != null) {
    details.push(`進捗率: ${subtask.progress_percent}% -> 100% (Done)`);
  }

  if (statusId === inReviewStatusId && subtask.progress_percent != null && subtask.progress_percent > 0 && subtask.progress_percent < 80) {
    details.push(`進捗率: ${subtask.progress_percent}% -> 80% (In Review)`);
  }

  const oldIsOngoing = [2, 3].includes(subtask.status_id);
  const willAutoUpdateActualEnd = statusId === 2 || (statusId === inReviewStatusId && hasPositiveReviewDays(subtask.review_days));
  if (isOngoing && willAutoUpdateActualEnd && !oldIsOngoing && subtask.actual_end_date) {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (subtask.actual_end_date !== today) {
      details.push(`実績終了日: ${subtask.actual_end_date} -> 今日 (自動更新)`);
    }
  }

  if (oldIsDone && !isDone && !isOngoing && statusId !== 1 && statusId !== removedStatusId && subtask.actual_end_date) {
    details.push(`実績終了日: ${subtask.actual_end_date} -> (消去)`);
  }

  return details;
};
