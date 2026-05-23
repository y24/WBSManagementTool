import { useMemo } from 'react';
import { parseISO, differenceInCalendarDays, max, min, addDays, format, isAfter, isBefore } from 'date-fns';
import { Project, Subtask } from '../../types/wbs';
import { InitialData, MstMember, MstHoliday } from '../../types';

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0: Sunday, 6: Saturday
}

function countWorkDays(start: Date, end: Date, holidays: MstHoliday[]) {
  if (isAfter(start, end)) return 0;
  
  let count = 0;
  let current = new Date(start);
  const holidayStrings = new Set(holidays.map(h => h.holiday_date));
  
  const daysTotal = differenceInCalendarDays(end, start);
  for (let i = 0; i <= daysTotal; i++) {
    const dateStr = format(current, 'yyyy-MM-dd');
    if (!isWeekend(current) && !holidayStrings.has(dateStr)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

export interface ResourceSubtask extends Subtask {
  project_name: string;
  task_name: string;
  subtask_type_name: string;
}

export interface ResourceRow {
  assignee: MstMember | null; // null for unassigned
  subtasks: ResourceSubtask[];
  tracks: ResourceSubtask[][]; // Packed rows of non-overlapping subtasks
  plannedTracks: ResourceSubtask[][];
  actualTracks: ResourceSubtask[][];
  inProgressCount: number;
  delayedCount: number;
  endingThisWeekCount: number;
  reviewWaitingCount: number;
}

type DateBounds = { start: number; end: number };

function getWeekBoundaries(dateStr: string) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 (Sun) to 6 (Sat)
  // Assuming Monday is the first day of the week
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startOfWeek: monday.toISOString().split('T')[0],
    endOfWeek: sunday.toISOString().split('T')[0],
  };
}

export function useResourceData(
  projects: Project[],
  initialData: InitialData | null,
  todayStr: string
): ResourceRow[] {
  return useMemo(() => {
    if (!initialData) return [];

    const { startOfWeek, endOfWeek } = getWeekBoundaries(todayStr);

    const doneStatusId = initialData.status_mapping_done ? Number.parseInt(initialData.status_mapping_done, 10) : null;
    const newStatusId = initialData.statuses.find(s => s.status_name === 'New')?.id;
    const inProgressStatusIds = initialData.statuses
      .filter(s => ['In Progress', 'In Review'].includes(s.status_name))
      .map(s => s.id);
    const inReviewStatusId = initialData.statuses.find(s => s.status_name === 'In Review')?.id;
    const removedStatusId = initialData.statuses.find(s => s.status_name === 'Removed')?.id ?? 7;

    const assigneeMap = new Map<number | 'unassigned', ResourceRow>();

    // Initialize map with all members
    initialData.members.forEach(member => {
      assigneeMap.set(member.id, {
        assignee: member,
        subtasks: [],
        tracks: [],
        plannedTracks: [],
        actualTracks: [],
        inProgressCount: 0,
        delayedCount: 0,
        endingThisWeekCount: 0,
        reviewWaitingCount: 0,
      });
    });

    assigneeMap.set('unassigned', {
      assignee: null,
      subtasks: [],
      tracks: [],
      plannedTracks: [],
      actualTracks: [],
      inProgressCount: 0,
      delayedCount: 0,
      endingThisWeekCount: 0,
      reviewWaitingCount: 0,
    });

    projects.forEach(project => {
      project.tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
          const assigneeKey = subtask.assignee_id ?? 'unassigned';
          const row = assigneeMap.get(assigneeKey);
          if (!row) return; // Should not happen unless bad initial data

          const typeName = initialData.subtask_types.find(t => t.id === subtask.subtask_type_id)?.type_name ?? '';

          const isRemoved = subtask.status_id === removedStatusId;

          row.subtasks.push({
            ...subtask,
            project_name: project.project_name,
            task_name: task.task_name,
            subtask_type_name: typeName,
          });

          // If removed, don't count towards heatmap metrics
          if (isRemoved) return;

          // In Progress
          if (inProgressStatusIds.includes(subtask.status_id)) {
            row.inProgressCount++;
          }

          // Delayed
          const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
          const isNew = newStatusId !== undefined && subtask.status_id === newStatusId;
          const startDelayed = isNew && !!subtask.planned_start_date && subtask.planned_start_date < todayStr;
          const endDelayed = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
          if (startDelayed || endDelayed) {
            row.delayedCount++;
          }

          // Ending This Week
          if (subtask.planned_end_date && subtask.planned_end_date >= startOfWeek && subtask.planned_end_date <= endOfWeek) {
            row.endingThisWeekCount++;
          }

          // Review Waiting (Before In Review, has review_days, review_start_date <= today)
          if (
            inReviewStatusId !== undefined &&
            subtask.status_id < inReviewStatusId &&
            subtask.review_days && subtask.review_days > 0 &&
            subtask.review_start_date && subtask.review_start_date <= todayStr
          ) {
            row.reviewWaitingCount++;
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
      const end = t.actual_end_date ? parseISO(t.actual_end_date) : start;
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
        if (resumptionDate > currentStart) {
          currentStart = resumptionDate;
        }

        if (currentStart >= end) break;
      }

      if (currentStart < end) {
        segments.push({ start: currentStart.getTime(), end: end.getTime() });
      }

      if (segments.length === 0 && start.getTime() === end.getTime()) {
        segments.push({ start: start.getTime(), end: end.getTime() });
      }

      return segments;
    };

    const packTracks = (
      subtasks: ResourceSubtask[],
      getBounds: (subtask: ResourceSubtask) => DateBounds[]
    ) => {
      const subtaskEx = subtasks
        .map(s => ({
          subtask: s,
          bounds: getBounds(s)
        }))
        .filter((item): item is { subtask: ResourceSubtask; bounds: DateBounds[] } => item.bounds.length > 0);

      // Sort by start date, then ID for stability
      subtaskEx.sort((a, b) => {
        const aStart = Math.min(...a.bounds.map(bounds => bounds.start));
        const bStart = Math.min(...b.bounds.map(bounds => bounds.start));
        if (aStart !== bStart) return aStart - bStart;
        return a.subtask.id - b.subtask.id;
      });

      const tracks: ResourceSubtask[][] = [];
      const trackBounds: DateBounds[][] = [];
      
      subtaskEx.forEach(item => {
        const { subtask, bounds } = item;

        let placed = false;
        for (let i = 0; i < tracks.length; i++) {
          const tBounds = trackBounds[i];
          let hasOverlap = false;
          
          for (const existingBounds of tBounds) {
            if (bounds.some(newBounds => newBounds.start <= existingBounds.end && newBounds.end >= existingBounds.start)) {
              hasOverlap = true;
              break;
            }
          }

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

    // Packing subtasks into separate planned/actual tracks for each assignee
    assigneeMap.forEach(row => {
      if (row.subtasks.length === 0) return;

      row.plannedTracks = packTracks(row.subtasks, getPlannedBounds);
      row.actualTracks = packTracks(row.subtasks, getActualBounds);
      row.tracks = row.plannedTracks.length >= row.actualTracks.length ? row.plannedTracks : row.actualTracks;
    });

    // Remove assignees with 0 subtasks, and sort by counts (In Progress, Delayed, Ending This Week)
    return Array.from(assigneeMap.values())
      .filter(row => row.subtasks.length > 0)
      .sort((a, b) => {
        // 1. In Progress (Descending)
        if (b.inProgressCount !== a.inProgressCount) {
          return b.inProgressCount - a.inProgressCount;
        }
        // 2. Delayed (Descending)
        if (b.delayedCount !== a.delayedCount) {
          return b.delayedCount - a.delayedCount;
        }
        // 3. Ending This Week (Descending)
        if (b.endingThisWeekCount !== a.endingThisWeekCount) {
          return b.endingThisWeekCount - a.endingThisWeekCount;
        }
        // Stable fallback: name or unassigned status
        if (!a.assignee && b.assignee) return 1;
        if (a.assignee && !b.assignee) return -1;
        const nameA = a.assignee?.member_name || '';
        const nameB = b.assignee?.member_name || '';
        return nameA.localeCompare(nameB, 'ja');
      });
  }, [projects, initialData, todayStr]);
}
