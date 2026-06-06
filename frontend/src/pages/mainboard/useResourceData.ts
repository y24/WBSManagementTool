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

function isPlanOnlySuspendedSubtask(subtask: Subtask, suspendedStatusIds: Set<number>): boolean {
  if (!suspendedStatusIds.has(subtask.status_id)) return false;

  const hasPlannedDate = !!subtask.planned_start_date || !!subtask.planned_end_date;
  const hasActualDate = !!subtask.actual_start_date || !!subtask.actual_end_date;
  return hasPlannedDate && !hasActualDate;
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
    const suspendedStatusIds = new Set(
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
          if (isPlanOnlySuspendedSubtask(subtask, suspendedStatusIds)) return;

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
      ? countWorkingDaysInRange(todayStr, loadScopeEndDate, holidaySet)
      : 0;
    const actualAvailableWorkingDays = actualLoadScopeStartDate
      ? countWorkingDaysInRange(actualLoadScopeStartDate, todayStr, holidaySet)
      : 0;
    const combinedScopeStartDate = actualLoadScopeStartDate ?? todayStr;
    const combinedScopeEndDate = loadScopeEndDate ?? todayStr;

    const hasDateOverlap = (
      startStr: string | null | undefined,
      endStr: string | null | undefined,
      scopeStartStr: string,
      scopeEndStr: string
    ): boolean => {
      if (!startStr) return false;
      const start = startStr.split('T')[0];
      const end = (endStr ?? startStr).split('T')[0];
      if (end < start) return false;
      return getOverlapRange(start, end, scopeStartStr, scopeEndStr) !== null;
    };

    const getExpectedProgressPercent = (subtask: ResourceSubtask): number | null => {
      if (!subtask.planned_start_date || !subtask.planned_end_date) return null;

      const plannedStart = subtask.planned_start_date.split('T')[0];
      const plannedEnd = subtask.planned_end_date.split('T')[0];
      if (plannedEnd < plannedStart) return null;
      if (todayStr < plannedStart) return 0;
      if (todayStr >= plannedEnd) return 100;

      const totalWorkingDays = countWorkingDaysInRange(plannedStart, plannedEnd, holidaySet);
      if (totalWorkingDays <= 0) return null;

      const elapsedWorkingDays = countWorkingDaysInRange(plannedStart, todayStr, holidaySet);
      return Math.min(100, Math.max(0, (elapsedWorkingDays / totalWorkingDays) * 100));
    };

    const getVarianceWeight = (subtask: ResourceSubtask): number => {
      const explicitEffort = Number(subtask.planned_effort_days ?? subtask.work_days ?? 0);
      if (Number.isFinite(explicitEffort) && explicitEffort > 0) return explicitEffort;
      if (subtask.planned_start_date && subtask.planned_end_date) {
        const plannedDays = countWorkingDaysInRange(
          subtask.planned_start_date.split('T')[0],
          subtask.planned_end_date.split('T')[0],
          holidaySet
        );
        if (plannedDays > 0) return plannedDays;
      }
      const actualEffort = Number(subtask.actual_effort_days ?? 0);
      return Number.isFinite(actualEffort) && actualEffort > 0 ? actualEffort : 1;
    };

    assigneeMap.forEach(row => {
      if (row.subtasks.length === 0) return;

      row.overlaidTracks = packTracks(row.subtasks, getMergedBounds);

      if (availableWorkingDays > 0 && loadScopeEndDate) {
        let plannedEffortDays = 0;
        row.subtasks.forEach(subtask => {
          if (subtask.status_id === removedStatusId) return;
          if (!subtask.planned_start_date || !subtask.planned_end_date) return;
          const plannedStart = subtask.planned_start_date.split('T')[0];
          const plannedEnd = subtask.planned_end_date.split('T')[0];
          const start = plannedStart > todayStr
            ? plannedStart
            : todayStr;
          const end = plannedEnd < loadScopeEndDate
            ? plannedEnd
            : loadScopeEndDate;
          if (start > end) return;
          plannedEffortDays += countWorkingDaysInRange(start, end, holidaySet) * getWorkloadFactor(subtask);
        });
        row.loadRate = Math.round((plannedEffortDays / availableWorkingDays) * 100);
      }

      if (actualAvailableWorkingDays > 0 && actualLoadScopeStartDate) {
        let actualEffortDays = 0;
        row.subtasks.forEach(subtask => {
          if (subtask.status_id === removedStatusId) return;
          if (!subtask.actual_start_date) return;

          const actualStart = subtask.actual_start_date.split('T')[0];
          const actualEnd = subtask.actual_end_date
            ? subtask.actual_end_date.split('T')[0]
            : todayStr;
          if (actualStart > todayStr || actualEnd < actualStart) return;

          const overlap = getOverlapRange(
            actualStart,
            actualEnd,
            actualLoadScopeStartDate,
            todayStr
          );
          if (!overlap) return;

          const totalActualWorkingDays = countWorkingDaysInRange(actualStart, actualEnd, holidaySet);
          if (totalActualWorkingDays <= 0) return;

          const overlapWorkingDays = countWorkingDaysInRange(overlap.start, overlap.end, holidaySet);
          if (overlapWorkingDays <= 0) return;

          const explicitActualEffort = Number(subtask.actual_effort_days);
          if (subtask.actual_effort_days !== null && subtask.actual_effort_days !== undefined && Number.isFinite(explicitActualEffort)) {
            actualEffortDays += explicitActualEffort * (overlapWorkingDays / totalActualWorkingDays);
          } else {
            actualEffortDays += overlapWorkingDays * getWorkloadFactor(subtask);
          }
        });
        row.actualLoadRate = Math.round((actualEffortDays / actualAvailableWorkingDays) * 100);
      }

      let weightedVariance = 0;
      let totalVarianceWeight = 0;
      row.subtasks.forEach(subtask => {
        if (subtask.status_id === removedStatusId) return;
        const inScope =
          hasDateOverlap(subtask.planned_start_date, subtask.planned_end_date, combinedScopeStartDate, combinedScopeEndDate) ||
          hasDateOverlap(
            subtask.actual_start_date,
            getDisplayActualEndDate(subtask),
            combinedScopeStartDate,
            combinedScopeEndDate
          );
        if (!inScope) return;

        const expectedProgress = getExpectedProgressPercent(subtask);
        if (expectedProgress === null) return;

        const actualProgress = Number(subtask.progress_percent ?? 0);
        const weight = getVarianceWeight(subtask);
        weightedVariance += (actualProgress - expectedProgress) * weight;
        totalVarianceWeight += weight;
      });
      row.scheduleVariancePt = totalVarianceWeight > 0
        ? Math.round(weightedVariance / totalVarianceWeight)
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
