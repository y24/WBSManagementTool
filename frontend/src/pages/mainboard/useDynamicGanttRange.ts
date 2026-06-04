import { useMemo } from 'react';
import { addDays, endOfMonth, format, parseISO, subDays } from 'date-fns';
import { GanttRange, Project, WBSResponse } from '../../types/wbs';
import { getDisplayActualEndDate } from '../../utils/ganttDateRange';

interface UseDynamicGanttRangeParams {
  data: WBSResponse | null;
  filteredProjects: Project[];
  currentTodayStr: string;
}

interface Schedulable {
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  review_start_date?: string | null;
}

function collectDates(target: Date[], item: Schedulable): void {
  if (item.planned_start_date) target.push(new Date(item.planned_start_date));
  if (item.planned_end_date) target.push(new Date(item.planned_end_date));
  if (item.actual_start_date) target.push(new Date(item.actual_start_date));
  const displayActualEnd = getDisplayActualEndDate(item);
  if (displayActualEnd) target.push(new Date(displayActualEnd));
}

export function useDynamicGanttRange({ data, filteredProjects, currentTodayStr }: UseDynamicGanttRangeParams): GanttRange | undefined {
  return useMemo(() => {
    if (!data?.gantt_range) return undefined;

    const todayStr = currentTodayStr;
    const today = parseISO(todayStr);
    if (filteredProjects.length === 0) {
      return { ...data.gantt_range, today: todayStr };
    }
    const allDates: Date[] = [];

    filteredProjects.forEach((project) => {
      collectDates(allDates, project);
      project.tasks.forEach((task) => {
        collectDates(allDates, task);
        task.subtasks.forEach((subtask) => {
          collectDates(allDates, subtask);
        });
      });
    });

    if (allDates.length === 0) {
      return { ...data.gantt_range, today: todayStr };
    }

    const minDate = new Date(Math.min(...allDates.map((date) => date.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((date) => date.getTime())));

    const startDate = subDays(new Date(Math.min(minDate.getTime(), today.getTime())), 7);
    const targetEndDate = endOfMonth(new Date(
      Math.max(
        addDays(maxDate, 14).getTime(),
        addDays(today, 8 * 7).getTime(),
      ),
    ));

    return {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(targetEndDate, 'yyyy-MM-dd'),
      today: todayStr,
    };
  }, [data, filteredProjects, currentTodayStr]);
}
