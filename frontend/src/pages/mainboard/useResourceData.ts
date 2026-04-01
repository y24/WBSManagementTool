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
  inProgressCount: number;
  delayedCount: number;
  endingThisWeekCount: number;
  reviewWaitingCount: number;
}

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

    const getBounds = (t: ResourceSubtask) => {
      // GanttBar renders the colored bar (Actual) if actual_start_date exists.
      // If it doesn't, it renders the grey bar (Planned).
      // We must match this logic for packing.
      
      const hasActual = !!t.actual_start_date;
      let startStr = hasActual ? t.actual_start_date : t.planned_start_date;
      let endStr = hasActual ? (t.actual_end_date || t.actual_start_date) : t.planned_end_date;

      // In Review state in GanttBar might extend the actual bar
      if (hasActual && t.review_start_date) {
        // GanttBar doesn't necessarily extend the bar length for review_start_date,
        // it just overlays a dark part. The total length is still aS to aE.
      }

      const parse = (s: string | null | undefined): number | null => {
        if (!s) return null;
        const day = s.split('T')[0];
        const d = new Date(`${day}T12:00:00Z`);
        return isNaN(d.getTime()) ? null : d.getTime();
      };

      const start = parse(startStr) ?? 9999999999999;
      const end = parse(endStr) ?? 0;

      return { start, end };
    };

    // Packing subtasks into tracks for each assignee
    assigneeMap.forEach(row => {
      if (row.subtasks.length === 0) return;

      const subtaskEx = row.subtasks.map(s => ({
        subtask: s,
        bounds: getBounds(s)
      }));

      // Sort by start date, then ID for stability
      subtaskEx.sort((a, b) => {
        if (a.bounds.start !== b.bounds.start) return a.bounds.start - b.bounds.start;
        return a.subtask.id - b.subtask.id;
      });

      const tracks: ResourceSubtask[][] = [];
      const trackBounds: { start: number; end: number }[][] = [];
      
      subtaskEx.forEach(item => {
        const { subtask, bounds } = item;
        // If neither planned nor actual exists, we can't really pack it, but skip for now
        if (bounds.start > 8000000000000 && bounds.end === 0) {
          // No dates, add to first track or handle specially.
          if (tracks.length === 0) {
            tracks.push([subtask]);
            trackBounds.push([{ start: 0, end: 0 }]);
          } else {
            tracks[0].push(subtask);
          }
          return;
        }

        let placed = false;
        for (let i = 0; i < tracks.length; i++) {
          const tBounds = trackBounds[i];
          let hasOverlap = false;
          
          for (const eb of tBounds) {
            // Overlap if not completely before OR completely after
            // Standard condition: (Start1 <= End2) AND (End1 >= Start2)
            if (bounds.start <= eb.end && bounds.end >= eb.start) {
              hasOverlap = true;
              break;
            }
          }

          if (!hasOverlap) {
            tracks[i].push(subtask);
            tBounds.push(bounds);
            placed = true;
            break;
          }
        }

        if (!placed) {
          tracks.push([subtask]);
          trackBounds.push([bounds]);
        }
      });

      row.tracks = tracks;
    });

    // Remove assignees with 0 subtasks, except unassigned which only is shown if it has subtasks
    return Array.from(assigneeMap.values()).filter(row => row.subtasks.length > 0);
  }, [projects, initialData, todayStr]);
}
