import { useMemo } from 'react';
import { parseISO, format, addDays } from 'date-fns';
import { Project, Subtask } from '../../types/wbs';
import { InitialData, MstMember } from '../../types';
import { getDisplayActualEndDate } from '../../utils/ganttDateRange';

export interface ResourceSubtask extends Subtask {
  project_name: string;
  task_name: string;
  subtask_type_name: string;
}

export interface ResourceRow {
  assignee: MstMember | null;
  subtasks: ResourceSubtask[];
  overlaidTracks: ResourceSubtask[][];
  loadRate: number;
  actualLoadRate: number;
  scheduleVariancePt: number | null;
  inProgressCount: number;
  delayedCount: number;
  completedCount: number;
}

type DateBounds = { start: number; end: number };
type WorkSegmentMode = 'planned' | 'actual';

function countWorkingDaysInRange(
  startStr: string,
  endStr: string,
  holidays: Set<string>
): number {
  let current = parseISO(startStr);
  const end = parseISO(endStr);
  let count = 0;
  while (current <= end) {
    const day = current.getDay();
    const dateStr = format(current, 'yyyy-MM-dd');
    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

function getOverlapRange(
  startStr: string,
  endStr: string,
  scopeStartStr: string,
  scopeEndStr: string
): { start: string; end: string } | null {
  const start = startStr > scopeStartStr ? startStr : scopeStartStr;
  const end = endStr < scopeEndStr ? endStr : scopeEndStr;
  return start <= end ? { start, end } : null;
}

function getWorkloadFactor(subtask: Pick<Subtask, 'workload_percent'>): number {
  const percent = subtask.workload_percent ?? 100;
  if (!Number.isFinite(percent)) return 1;
  return Math.max(0, percent) / 100;
}

function isPlanOnlyPendingSubtask(subtask: Subtask, pendingStatusId: number | undefined): boolean {
  if (pendingStatusId === undefined || subtask.status_id !== pendingStatusId) return false;

  const hasPlannedDate = !!subtask.planned_start_date || !!subtask.planned_end_date;
  const hasActualDate = !!subtask.actual_start_date || !!subtask.actual_end_date;
  return hasPlannedDate && !hasActualDate;
}

function getFiniteEffort(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const effort = Number(value);
  return Number.isFinite(effort) ? Math.max(0, effort) : null;
}

function getPreviousDateTimestamp(timestamp: number): number {
  return addDays(new Date(timestamp), -1).getTime();
}

function getNextDateTimestamp(timestamp: number): number {
  return addDays(new Date(timestamp), 1).getTime();
}

export function useResourceData(
  projects: Project[],
  initialData: InitialData | null,
  todayStr: string,
  loadScopeEndDate?: string,
  actualLoadScopeStartDate?: string
): ResourceRow[] {
  return useMemo(() => {
    if (!initialData) return [];

    const doneStatusId = initialData.status_mapping_done
      ? Number.parseInt(initialData.status_mapping_done, 10)
      : null;
    const statusIdByName = new Map(initialData.statuses.map(s => [s.status_name, s.id]));
    const subtaskTypeNameById = new Map(initialData.subtask_types.map(t => [t.id, t.type_name]));
    const newStatusId = statusIdByName.get('New');
    const pendingStatusId = statusIdByName.get('Pending');
    const blockedStatusId = statusIdByName.get('Blocked');
    const actualStopStatusIds = new Set(
      [pendingStatusId, blockedStatusId].filter((id): id is number => id !== undefined)
    );
    const inProgressStatusSet = new Set(
      initialData.statuses
        .filter(s => ['In Progress', 'In Review'].includes(s.status_name))
        .map(s => s.id)
    );
    const removedStatusId = statusIdByName.get('Removed') ?? 7;
    const holidaySet = new Set(initialData.holidays.map(h => h.holiday_date));

    const assigneeMap = new Map<number | 'unassigned', ResourceRow>();

    initialData.members
      .filter(member => !member.exclude_from_resource_view)
      .forEach(member => {
        assigneeMap.set(member.id, {
          assignee: member,
          subtasks: [],
          overlaidTracks: [],
          loadRate: 0,
          actualLoadRate: 0,
          scheduleVariancePt: null,
          inProgressCount: 0,
          delayedCount: 0,
          completedCount: 0,
        });
      });
    assigneeMap.set('unassigned', {
      assignee: null,
      subtasks: [],
      overlaidTracks: [],
      loadRate: 0,
      actualLoadRate: 0,
      scheduleVariancePt: null,
      inProgressCount: 0,
      delayedCount: 0,
      completedCount: 0,
    });

    projects.forEach(project => {
      project.tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
          const assigneeKey = subtask.assignee_id ?? 'unassigned';
          const row = assigneeMap.get(assigneeKey);
          if (!row) return;
          if (isPlanOnlyPendingSubtask(subtask, pendingStatusId)) return;

          const typeName = subtaskTypeNameById.get(subtask.subtask_type_id) ?? '';
          const isRemoved = subtask.status_id === removedStatusId;

          row.subtasks.push({
            ...subtask,
            project_name: project.project_name,
            task_name: task.task_name,
            subtask_type_name: typeName,
          });

          if (isRemoved) return;

          if (inProgressStatusSet.has(subtask.status_id)) {
            row.inProgressCount++;
          }

          const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
          if (isDone) {
            row.completedCount++;
          }

          const isNew = newStatusId !== undefined && subtask.status_id === newStatusId;
          const startDelayed = isNew && !!subtask.planned_start_date && subtask.planned_start_date < todayStr;
          const endDelayed = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
          if (startDelayed || endDelayed) {
            row.delayedCount++;
          }
        });
      });
    });

    const parseDateTime = (s: string | null | undefined): number | null => {
      if (!s) return null;
      const day = s.split('T')[0];
      const d = new Date(`${day}T12:00:00Z`);
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    const getPlannedBounds = (t: ResourceSubtask): DateBounds[] => {
      const start = parseDateTime(t.planned_start_date);
      const end = parseDateTime(t.planned_end_date);
      return start !== null && end !== null ? [{ start, end }] : [];
    };

    const subtractBounds = (segments: DateBounds[], excludedBounds: DateBounds[]): DateBounds[] => {
      return excludedBounds.reduce((currentSegments, excluded) => {
        const nextSegments: DateBounds[] = [];

        currentSegments.forEach(segment => {
          if (excluded.end < segment.start || excluded.start > segment.end) {
            nextSegments.push(segment);
            return;
          }

          if (excluded.start > segment.start) {
            const beforeEnd = getPreviousDateTimestamp(excluded.start);
            if (segment.start <= beforeEnd) {
              nextSegments.push({ start: segment.start, end: beforeEnd });
            }
          }

          if (excluded.end < segment.end) {
            const afterStart = getNextDateTimestamp(excluded.end);
            if (afterStart <= segment.end) {
              nextSegments.push({ start: afterStart, end: segment.end });
            }
          }
        });

        return nextSegments;
      }, segments);
    };

    const getPlannedReviewBounds = (t: ResourceSubtask): DateBounds[] => {
      const plannedEnd = t.planned_end_date ? parseISO(t.planned_end_date) : null;
      const reviewDays = getFiniteEffort(t.review_days);
      if (!plannedEnd || Number.isNaN(plannedEnd.getTime()) || reviewDays === null || reviewDays <= 0) {
        return [];
      }

      let remainingWorkingDays = Math.ceil(reviewDays);
      let current = plannedEnd;

      while (remainingWorkingDays > 0) {
        const currentStr = format(current, 'yyyy-MM-dd');
        const day = current.getDay();
        if (day !== 0 && day !== 6 && !holidaySet.has(currentStr)) {
          remainingWorkingDays--;
        }
        if (remainingWorkingDays > 0) {
          current = addDays(current, -1);
        }
      }

      return [{ start: current.getTime(), end: plannedEnd.getTime() }];
    };

    const getPlannedWorkSegments = (t: ResourceSubtask): DateBounds[] => {
      return subtractBounds(getPlannedBounds(t), getPlannedReviewBounds(t));
    };

    const getActualBounds = (t: ResourceSubtask): DateBounds[] => {
      if (!t.actual_start_date) return [];
      const start = parseISO(t.actual_start_date);
      const displayActualEnd = getDisplayActualEndDate(t);
      const end = displayActualEnd ? parseISO(displayActualEnd) : start;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
      if (end < start) {
        const timestamp = parseDateTime(t.actual_start_date);
        return timestamp !== null ? [{ start: timestamp, end: timestamp }] : [];
      }

      const interruptions = [...(t.interruptions || [])]
        .filter(i => i.interruption_date)
        .sort((a, b) => a.interruption_date.localeCompare(b.interruption_date));

      const segments: DateBounds[] = [];
      let currentStart = start;

      for (const interruption of interruptions) {
        const interruptionDate = parseISO(interruption.interruption_date);
        if (Number.isNaN(interruptionDate.getTime())) continue;
        if (interruptionDate >= currentStart) {
          const segmentEnd = interruptionDate < end ? interruptionDate : end;
          segments.push({ start: currentStart.getTime(), end: segmentEnd.getTime() });
          if (segmentEnd.getTime() === end.getTime()) { currentStart = end; break; }
        }
        if (!interruption.resumption_date) { currentStart = end; break; }
        const resumptionDate = parseISO(interruption.resumption_date);
        if (Number.isNaN(resumptionDate.getTime())) { currentStart = end; break; }
        if (resumptionDate > currentStart) currentStart = resumptionDate;
        if (currentStart >= end) break;
      }
      if (currentStart < end) segments.push({ start: currentStart.getTime(), end: end.getTime() });
      if (segments.length === 0 && start.getTime() === end.getTime()) {
        segments.push({ start: start.getTime(), end: end.getTime() });
      }
      return segments;
    };

    const getActualWorkSegments = (t: ResourceSubtask): DateBounds[] => {
      if (!t.actual_start_date) return [];

      const start = parseISO(t.actual_start_date);
      if (Number.isNaN(start.getTime())) return [];

      let endDateStr = t.actual_end_date?.split('T')[0] ?? null;
      if (!endDateStr) {
        const isStoppedWithoutActualEnd = actualStopStatusIds.has(t.status_id);
        if (isStoppedWithoutActualEnd) {
          const lastInterruptionDate = [...(t.interruptions || [])]
            .map(i => i.interruption_date)
            .filter((date): date is string => !!date)
            .sort()
            .at(-1);
          endDateStr = lastInterruptionDate ?? t.actual_start_date.split('T')[0];
        } else {
          endDateStr = todayStr;
        }
      }

      const end = parseISO(endDateStr);
      if (Number.isNaN(end.getTime())) return [];
      if (end < start) {
        return [{ start: start.getTime(), end: start.getTime() }];
      }

      const interruptions = [...(t.interruptions || [])]
        .filter(i => i.interruption_date)
        .sort((a, b) => a.interruption_date.localeCompare(b.interruption_date));

      const segments: DateBounds[] = [];
      let currentStart = start;

      for (const interruption of interruptions) {
        const interruptionDate = parseISO(interruption.interruption_date);
        if (Number.isNaN(interruptionDate.getTime())) continue;

        if (interruptionDate >= currentStart) {
          const segmentEnd = interruptionDate < end ? interruptionDate : end;
          segments.push({ start: currentStart.getTime(), end: segmentEnd.getTime() });
          if (segmentEnd.getTime() === end.getTime()) {
            currentStart = end;
            break;
          }
        }

        if (!interruption.resumption_date) {
          currentStart = end;
          break;
        }

        const resumptionDate = parseISO(interruption.resumption_date);
        if (Number.isNaN(resumptionDate.getTime())) {
          currentStart = end;
          break;
        }
        if (resumptionDate > currentStart) currentStart = resumptionDate;
        if (currentStart >= end) break;
      }

      if (currentStart < end) segments.push({ start: currentStart.getTime(), end: end.getTime() });
      if (segments.length === 0 && start.getTime() === end.getTime()) {
        segments.push({ start: start.getTime(), end: end.getTime() });
      }

      const reviewStart = t.review_start_date ? parseISO(t.review_start_date) : null;
      const reviewBounds = reviewStart && !Number.isNaN(reviewStart.getTime()) && reviewStart <= end
        ? [{ start: reviewStart.getTime(), end: end.getTime() }]
        : [];

      return subtractBounds(segments, reviewBounds);
    };

    const getWorkSegments = (subtask: ResourceSubtask, mode: WorkSegmentMode): DateBounds[] => {
      return mode === 'planned' ? getPlannedWorkSegments(subtask) : getActualWorkSegments(subtask);
    };

    const formatBoundsDate = (timestamp: number): string => format(new Date(timestamp), 'yyyy-MM-dd');

    const countWorkingDaysInBounds = (bounds: DateBounds): number => {
      return countWorkingDaysInRange(formatBoundsDate(bounds.start), formatBoundsDate(bounds.end), holidaySet);
    };

    const availableCapacity = (windowStart: string, windowEnd: string): number => {
      return countWorkingDaysInRange(windowStart, windowEnd, holidaySet);
    };

    const effortInWindow = (
      subtask: ResourceSubtask,
      windowStart: string,
      windowEnd: string,
      mode: WorkSegmentMode
    ): number => {
      const segments = getWorkSegments(subtask, mode);
      if (segments.length === 0) return 0;

      const totalWorkingDays = segments.reduce((sum, segment) => sum + countWorkingDaysInBounds(segment), 0);
      if (totalWorkingDays <= 0) return 0;

      const overlapWorkingDays = segments.reduce((sum, segment) => {
        const overlap = getOverlapRange(
          formatBoundsDate(segment.start),
          formatBoundsDate(segment.end),
          windowStart,
          windowEnd
        );
        return overlap
          ? sum + countWorkingDaysInRange(overlap.start, overlap.end, holidaySet)
          : sum;
      }, 0);
      if (overlapWorkingDays <= 0) return 0;

      const workloadEffort = overlapWorkingDays * getWorkloadFactor(subtask);
      const explicitEffort = mode === 'planned'
        ? getFiniteEffort(subtask.planned_effort_days)
        : getFiniteEffort(subtask.actual_effort_days);

      if (explicitEffort === null) return workloadEffort;
      if (mode === 'planned' && subtask.is_auto_effort) return workloadEffort;

      const proportionalEffort = explicitEffort * (overlapWorkingDays / totalWorkingDays);
      return mode === 'planned'
        ? Math.max(proportionalEffort, workloadEffort)
        : Math.min(proportionalEffort, workloadEffort);
    };

    // Outer envelope of planned + actual bounds used for track packing
    const getMergedBounds = (t: ResourceSubtask): DateBounds[] => {
      const all = [...getPlannedBounds(t), ...getActualBounds(t)];
      if (all.length === 0) return [];
      const start = Math.min(...all.map(b => b.start));
      const end = Math.max(...all.map(b => b.end));
      return [{ start, end }];
    };

    const packTracks = (
      subtasks: ResourceSubtask[],
      getBounds: (s: ResourceSubtask) => DateBounds[]
    ): ResourceSubtask[][] => {
      const items = subtasks
        .map(s => ({ subtask: s, bounds: getBounds(s) }))
        .filter((item): item is { subtask: ResourceSubtask; bounds: DateBounds[] } => item.bounds.length > 0);

      items.sort((a, b) => {
        const aStart = Math.min(...a.bounds.map(b => b.start));
        const bStart = Math.min(...b.bounds.map(b => b.start));
        return aStart !== bStart ? aStart - bStart : a.subtask.id - b.subtask.id;
      });

      const tracks: ResourceSubtask[][] = [];
      const trackBounds: DateBounds[][] = [];

      items.forEach(({ subtask, bounds }) => {
        let placed = false;
        for (let i = 0; i < tracks.length; i++) {
          const tBounds = trackBounds[i];
          const hasOverlap = tBounds.some(eb =>
            bounds.some(nb => nb.start <= eb.end && nb.end >= eb.start)
          );
          if (!hasOverlap) {
            tracks[i].push(subtask);
            tBounds.push(...bounds);
            placed = true;
            break;
          }
        }
        if (!placed) {
          tracks.push([subtask]);
          trackBounds.push([...bounds]);
        }
      });
      return tracks;
    };

    const availableWorkingDays = loadScopeEndDate
      ? availableCapacity(todayStr, loadScopeEndDate)
      : 0;
    const actualAvailableWorkingDays = actualLoadScopeStartDate
      ? availableCapacity(actualLoadScopeStartDate, todayStr)
      : 0;
    const varianceScopeStart = actualLoadScopeStartDate ?? todayStr;

    assigneeMap.forEach(row => {
      if (row.subtasks.length === 0) return;

      row.overlaidTracks = packTracks(row.subtasks, getMergedBounds);

      if (availableWorkingDays > 0 && loadScopeEndDate) {
        let plannedEffortDays = 0;
        row.subtasks.forEach(subtask => {
          if (subtask.status_id === removedStatusId) return;
          if (doneStatusId !== null && subtask.status_id === doneStatusId) return;
          plannedEffortDays += effortInWindow(subtask, todayStr, loadScopeEndDate, 'planned');
        });
        row.loadRate = Math.round((plannedEffortDays / availableWorkingDays) * 100);
      }

      if (actualAvailableWorkingDays > 0 && actualLoadScopeStartDate) {
        let actualEffortDays = 0;
        row.subtasks.forEach(subtask => {
          if (subtask.status_id === removedStatusId) return;
          actualEffortDays += effortInWindow(subtask, actualLoadScopeStartDate, todayStr, 'actual');
        });
        row.actualLoadRate = Math.round((actualEffortDays / actualAvailableWorkingDays) * 100);
      }

      let plannedDueEffort = 0;
      let actualDoneEffort = 0;
      row.subtasks.forEach(subtask => {
        if (subtask.status_id === removedStatusId) return;
        plannedDueEffort += effortInWindow(subtask, varianceScopeStart, todayStr, 'planned');
        actualDoneEffort += effortInWindow(subtask, varianceScopeStart, todayStr, 'actual');
      });
      row.scheduleVariancePt = plannedDueEffort > 0
        ? Math.round((actualDoneEffort - plannedDueEffort) * 10) / 10
        : null;
    });

    const getSortCategory = (row: ResourceRow) => {
      if (row.delayedCount > 0) return 0;
      if (row.loadRate > 100) return 1;
      if (row.loadRate >= 30) return 2;
      return 3;
    };

    return Array.from(assigneeMap.values())
      .filter(row => row.subtasks.length > 0)
      .sort((a, b) => {
        if (!a.assignee && b.assignee) return 1;
        if (a.assignee && !b.assignee) return -1;

        const catA = getSortCategory(a);
        const catB = getSortCategory(b);
        if (catA !== catB) return catA - catB;

        if (b.delayedCount !== a.delayedCount) return b.delayedCount - a.delayedCount;
        if (b.loadRate !== a.loadRate) return b.loadRate - a.loadRate;

        return (a.assignee?.member_name || '').localeCompare(b.assignee?.member_name || '', 'ja');
      });
  }, [projects, initialData, todayStr, loadScopeEndDate, actualLoadScopeStartDate]);
}
