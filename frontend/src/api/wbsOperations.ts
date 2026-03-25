import { apiClient } from './client';

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

  shiftDates: (projectIds: number[], taskIds: number[], subtaskIds: number[], newBaseDate: string) =>
    apiClient.post('/items/shift-dates', { 
      project_ids: projectIds, 
      task_ids: taskIds, 
      subtask_ids: subtaskIds,
      new_base_date: newBaseDate
    }),

  getWBS: (projectIds?: number[], includeDone?: boolean, includeRemoved?: boolean, weeks: number = 8) => {
    const params = new URLSearchParams();
    if (projectIds && projectIds.length > 0) {
      projectIds.forEach(id => params.append('project_ids', id.toString()));
    }
    if (includeDone !== undefined) params.append('include_done', includeDone.toString());
    if (includeRemoved !== undefined) params.append('include_removed', includeRemoved.toString());
    params.append('weeks', weeks.toString());
    return apiClient.get(`/wbs?${params.toString()}`);
  },

  getDashboard: () => 
    apiClient.get('/dashboard'),
};

