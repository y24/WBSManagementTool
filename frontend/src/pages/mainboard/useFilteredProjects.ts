import { useMemo } from 'react';
import { FilterState, DisplayOptions } from '../../components/FilterPanel';
import { InitialData } from '../../types';
import { Project, Task, WBSResponse } from '../../types/wbs';

interface UseFilteredProjectsParams {
  data: WBSResponse | null;
  filters: FilterState;
  initialData: InitialData | null;
  displayOptions: DisplayOptions;
}

function containsSearchTerm(text: string | null | undefined, term: string): boolean {
  return (text ?? '').toLowerCase().includes(term);
}

export function useFilteredProjects({
  data,
  filters,
  initialData,
  displayOptions,
}: UseFilteredProjectsParams): Project[] {
  return useMemo(() => {
    if (!data?.projects) return [];

    const todayStr = data.gantt_range?.today || new Date().toISOString().split('T')[0];
    const doneStatusId = initialData?.status_mapping_done ? Number.parseInt(initialData.status_mapping_done, 10) : null;
    const removedStatusId = initialData?.statuses.find((status) => status.status_name === 'Removed')?.id ?? 7;
    const newStatusId = initialData?.statuses.find((status) => status.status_name === 'New')?.id;

    const hasConditions =
      filters.statusIds.length > 0 ||
      filters.assigneeIds.length > 0 ||
      filters.subtaskTypeIds.length > 0 ||
      filters.onlyDelayed ||
      filters.onlyUnplanned ||
      filters.searchTerm !== '';

    return data.projects
      .filter((project) => {
        if (filters.projectIds.length > 0 && !filters.projectIds.includes(project.id)) return false;
        if (!displayOptions.showRemoved && project.status_id === removedStatusId) return false;
        if (!displayOptions.showDoneProjects && doneStatusId !== null && project.status_id === doneStatusId) return false;
        return true;
      })
      .map((project) => {
        const isProjectRemoved = project.status_id === removedStatusId;

        const filteredTasks = project.tasks
          .map((task) => {
            const isTaskRemoved = task.status_id === removedStatusId;
            if (!displayOptions.showRemoved && (isProjectRemoved || isTaskRemoved)) return null;

            const filteredSubtasks = task.subtasks.filter((subtask) => {
              if (
                !displayOptions.showRemoved &&
                (isProjectRemoved || isTaskRemoved || subtask.status_id === removedStatusId)
              ) {
                return false;
              }

              if (filters.statusIds.length > 0 && !filters.statusIds.includes(subtask.status_id)) return false;

              if (
                filters.assigneeIds.length > 0 &&
                (!subtask.assignee_id || !filters.assigneeIds.includes(subtask.assignee_id))
              ) {
                return false;
              }

              if (
                filters.subtaskTypeIds.length > 0 &&
                !filters.subtaskTypeIds.includes(subtask.subtask_type_id)
              ) {
                return false;
              }

              if (filters.onlyDelayed) {
                const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
                const isNew = newStatusId !== undefined && subtask.status_id === newStatusId;
                const isStartDelayed = isNew && !!subtask.planned_start_date && subtask.planned_start_date < todayStr;
                const isEndOverdue = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
                
                if (!isStartDelayed && !isEndOverdue) return false;
              }

              if (filters.onlyUnplanned) {
                const isStartUnplanned = !subtask.planned_start_date;
                const isEndUnplanned = !subtask.planned_end_date;
                if (!isStartUnplanned && !isEndUnplanned) return false;
              }

              if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                const detailMatch = containsSearchTerm(subtask.subtask_detail, term);
                const typeName =
                  initialData?.subtask_types.find((type) => type.id === subtask.subtask_type_id)?.type_name ?? '';
                const typeMatch = containsSearchTerm(typeName, term);
                if (!detailMatch && !typeMatch) return false;
              }

              return true;
            });

            const taskMatches = (() => {
              if (filters.subtaskTypeIds.length > 0) return false;

              if (filters.statusIds.length > 0 && task.status_id && !filters.statusIds.includes(task.status_id)) {
                return false;
              }

              if (
                filters.assigneeIds.length > 0 &&
                task.assignee_id &&
                !filters.assigneeIds.includes(task.assignee_id)
              ) {
                return false;
              }

              if (filters.onlyDelayed) {
                const isDone = doneStatusId !== null && task.status_id === doneStatusId;
                const isNew = newStatusId !== undefined && task.status_id === newStatusId;
                const isStartDelayed = isNew && !!task.planned_start_date && task.planned_start_date < todayStr;
                const isEndOverdue = !isDone && !!task.planned_end_date && task.planned_end_date < todayStr;

                if (!isStartDelayed && !isEndOverdue) return false;
              }

              if (filters.onlyUnplanned) {
                const isStartUnplanned = !task.planned_start_date;
                const isEndUnplanned = !task.planned_end_date;
                if (!isStartUnplanned && !isEndUnplanned) return false;
              }

              if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                if (!containsSearchTerm(task.task_name, term)) return false;
              }

              return true;
            })();

            if (hasConditions) {
              if (taskMatches || filteredSubtasks.length > 0) {
                return { ...task, subtasks: filteredSubtasks };
              }
              return null;
            }

            return { ...task, subtasks: filteredSubtasks };
          })
          .filter(Boolean) as Task[];

        const projectMatches = filters.searchTerm
          ? containsSearchTerm(project.project_name, filters.searchTerm.toLowerCase())
          : false;

        if (hasConditions) {
          if (projectMatches || filteredTasks.length > 0) {
            return { ...project, tasks: filteredTasks };
          }
          return null;
        }

        return { ...project, tasks: filteredTasks };
      })
      .filter(Boolean) as Project[];
  }, [data, filters, initialData, displayOptions]);
}
