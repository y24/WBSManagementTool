import type { AxiosResponse } from 'axios';
import { apiClient } from './client';

interface WBSVersion {
  tree_version: string;
  initial_data_version: string;
}

interface AzureDevopsChildWorkItem {
  id: number;
  title?: string | null;
  work_item_type?: string | null;
  state?: string | null;
}

interface GetWBSOptions {
  projectIds?: number[];
  includeDone?: boolean;
  includeRemoved?: boolean;
  weeks?: number;
  refreshOngoingEndDates?: boolean;
  doneProjectWindowStart?: string;
  doneProjectWindowEnd?: string;
}

const azureDevopsChildWorkItemsCache = new Map<string, AxiosResponse<AzureDevopsChildWorkItem[]>>();
const azureDevopsChildWorkItemsRequests = new Map<string, Promise<AxiosResponse<AzureDevopsChildWorkItem[]>>>();
let wbsVersionRequest: Promise<AxiosResponse<WBSVersion>> | null = null;
let dashboardRequest: Promise<AxiosResponse> | null = null;

const getWBSVersion = () => {
  if (wbsVersionRequest) return wbsVersionRequest;

  wbsVersionRequest = apiClient.get<WBSVersion>('/wbs/version')
    .finally(() => {
      wbsVersionRequest = null;
    });

  return wbsVersionRequest;
};

const getDashboard = () => {
  if (dashboardRequest) return dashboardRequest;

  dashboardRequest = apiClient.get('/dashboard')
    .finally(() => {
      dashboardRequest = null;
    });

  return dashboardRequest;
};

const getAzureDevopsChildWorkItems = (
  parentWorkItemId: number,
  options: { forceRefresh?: boolean; filterByWorkItemType?: boolean; subtaskTypeId?: number | null } = {}
) => {
  const cacheKey = [
    parentWorkItemId,
    options.filterByWorkItemType ? 'type-filter' : 'all',
    options.subtaskTypeId ?? 'none',
  ].join(':');

  const shouldUseCache = !options.forceRefresh && !options.filterByWorkItemType;

  if (shouldUseCache) {
    const cached = azureDevopsChildWorkItemsCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const pending = azureDevopsChildWorkItemsRequests.get(cacheKey);
    if (pending) return pending;
  }

  const params = new URLSearchParams();
  if (options.filterByWorkItemType) params.append('filter_by_work_item_type', 'true');
  if (options.subtaskTypeId != null) params.append('subtask_type_id', String(options.subtaskTypeId));
  const query = params.toString();

  const request = apiClient
    .get<AzureDevopsChildWorkItem[]>(`/integrations/azure-devops/work-items/${parentWorkItemId}/children${query ? `?${query}` : ''}`)
    .then((response) => {
      if (!options.filterByWorkItemType) {
        azureDevopsChildWorkItemsCache.set(cacheKey, response);
      }
      return response;
    })
    .finally(() => {
      if (azureDevopsChildWorkItemsRequests.get(cacheKey) === request) {
        azureDevopsChildWorkItemsRequests.delete(cacheKey);
      }
    });

  azureDevopsChildWorkItemsRequests.set(cacheKey, request);
  return request;
};

export const wbsOps = {
  createProject: (projectName: string) => 
    apiClient.post('/projects', { project_name: projectName }),
    
  createTask: (projectId: number, taskName: string) => 
    apiClient.post('/tasks', { project_id: projectId, task_name: taskName }),
    
  createSubtask: (taskId: number, typeId: number | null, statusId: number) => 
    apiClient.post('/subtasks', { task_id: taskId, subtask_type_id: typeId, status_id: statusId }),
    
  updateProject: (id: number, data: any) => 
    apiClient.patch(`/projects/${id}`, data),
    
  updateTask: (id: number, data: any) => 
    apiClient.patch(`/tasks/${id}`, data),
    
  updateSubtask: (id: number, data: any) => 
    apiClient.patch(`/subtasks/${id}`, data),
    
  deleteProject: (id: number) => 
    apiClient.delete(`/projects/${id}`),
    
  deleteTask: (id: number) => 
    apiClient.delete(`/tasks/${id}`),
    
  deleteSubtask: (id: number) => 
    apiClient.delete(`/subtasks/${id}`),
    
  reorderProjects: (orderedIds: number[]) =>
    apiClient.post('/projects/reorder', { ordered_ids: orderedIds }),
    
  reorderTasks: (orderedIds: number[]) =>
    apiClient.post('/tasks/reorder', { ordered_ids: orderedIds }),
    
  reorderSubtasks: (orderedIds: number[]) =>
    apiClient.post('/subtasks/reorder', { ordered_ids: orderedIds }),
    
  // Import
  getImportTemplate: () => 
    apiClient.get('/import/template', { responseType: 'blob' }),
    
  previewImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  executeImport: (rows: any[]) => 
    apiClient.post('/import/execute', { rows }),

  duplicateItems: (projectIds: number[], taskIds: number[], subtaskIds: number[]) =>
    apiClient.post('/items/duplicate', { project_ids: projectIds, task_ids: taskIds, subtask_ids: subtaskIds }),

  clearActuals: (projectIds: number[], taskIds: number[], subtaskIds: number[]) =>
    apiClient.post('/items/clear-actuals', { project_ids: projectIds, task_ids: taskIds, subtask_ids: subtaskIds }),

  clearPlanAndActuals: (projectIds: number[], taskIds: number[], subtaskIds: number[]) =>
    apiClient.post('/items/clear-plans-actuals', { project_ids: projectIds, task_ids: taskIds, subtask_ids: subtaskIds }),

  shiftDates: (projectIds: number[], taskIds: number[], subtaskIds: number[], newBaseDate: string) =>
    apiClient.post('/items/shift-dates', { 
      project_ids: projectIds, 
      task_ids: taskIds, 
      subtask_ids: subtaskIds,
      new_base_date: newBaseDate
    }),

  getWBS: (
    projectIdsOrOptions?: number[] | GetWBSOptions,
    includeDone?: boolean,
    includeRemoved?: boolean,
    weeks: number = 8,
    refreshOngoingEndDates: boolean = true
  ) => {
    const options: GetWBSOptions = Array.isArray(projectIdsOrOptions)
      ? { projectIds: projectIdsOrOptions, includeDone, includeRemoved, weeks, refreshOngoingEndDates }
      : projectIdsOrOptions ?? {};
    const params = new URLSearchParams();
    if (options.projectIds && options.projectIds.length > 0) {
      options.projectIds.forEach(id => params.append('project_ids', id.toString()));
    }
    if (options.includeDone !== undefined) params.append('include_done', options.includeDone.toString());
    if (options.includeRemoved !== undefined) params.append('include_removed', options.includeRemoved.toString());
    params.append('weeks', (options.weeks ?? weeks).toString());
    if (options.doneProjectWindowStart) params.append('done_project_window_start', options.doneProjectWindowStart);
    if (options.doneProjectWindowEnd) params.append('done_project_window_end', options.doneProjectWindowEnd);
    params.append('refresh_ongoing_end_dates', (options.refreshOngoingEndDates ?? refreshOngoingEndDates).toString());
    return apiClient.get(`/wbs?${params.toString()}`);
  },

  getWBSVersion,

  getDashboard,

  getAzureDevopsChildWorkItems,

  exportWBS: (projects: any[]) =>
    apiClient.post('/wbs/export', projects, { responseType: 'blob' }),
};

