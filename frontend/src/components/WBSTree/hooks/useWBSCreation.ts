import { useState, useCallback, useEffect } from 'react';
import { wbsOps } from '../../../api/wbsOperations';
import { InitialData } from '../../../types';
import { showErrorToastUnlessNetworkError } from '../../../utils/toast';

export const useWBSCreation = (
  onUpdate: () => void,
  initialData: InitialData | null,
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
  setSaving: (saving: boolean) => void
) => {
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [bulkCreateConfig, setBulkCreateConfig] = useState<{
    isOpen: boolean;
    type: 'project' | 'task' | 'subtask';
    title: string;
    parentId?: number;
  }>({
    isOpen: false,
    type: 'project',
    title: ''
  });

  const handleAddProject = useCallback(async (count: number = 1) => {
    try {
      setSaving(true);
      let firstId = null;
      for (let i = 0; i < count; i++) {
        const res = await wbsOps.createProject(count > 1 ? `新しいプロジェクト ${i + 1}` : '新しいプロジェクト');
        if (i === 0 && res.data && res.data.id) {
          firstId = `p-${res.data.id}`;
        }
      }
      if (firstId) {
        setLastAddedId(firstId);
      }
      onUpdate();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, 'プロジェクトの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, setSaving]);

  useEffect(() => {
    const handler = (e: any) => {
      const isShift = e.detail?.isShift;
      if (isShift) {
        setBulkCreateConfig({
          isOpen: true,
          type: 'project',
          title: 'プロジェクトの一括作成'
        });
      } else {
        handleAddProject();
      }
    };
    window.addEventListener('add-project', handler);
    return () => window.removeEventListener('add-project', handler);
  }, [handleAddProject]);

  const handleAddTask = useCallback(async (projectId: number, count: number = 1) => {
    try {
      setSaving(true);
      let firstId = null;
      for (let i = 0; i < count; i++) {
        const res = await wbsOps.createTask(projectId, count > 1 ? `新しいタスク ${i + 1}` : '新しいタスク');
        if (i === 0 && res.data && res.data.id) {
          firstId = `t-${res.data.id}`;
        }
      }
      if (firstId) {
        setLastAddedId(firstId);
      }
      setExpandedProjects(p => ({ ...p, [projectId]: true }));
      onUpdate();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, 'タスクの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, setExpandedProjects, setSaving]);

  const handleAddSubtask = useCallback(async (taskId: number, count: number = 1) => {
    if (!initialData) return;
    try {
      setSaving(true);
      const typeId = null;
      const newStatus = initialData.statuses.find(s => s.status_name === 'New') || initialData.statuses[0];
      const statusId = newStatus?.id || 1;
      
      let firstId = null;
      for (let i = 0; i < count; i++) {
        const res = await wbsOps.createSubtask(taskId, typeId, statusId);
        if (i === 0 && res.data && res.data.id) {
          firstId = `s-${res.data.id}`;
        }
      }
      if (firstId) {
        setLastAddedId(firstId);
      }
      setExpandedTasks(t => ({ ...t, [taskId]: true }));
      onUpdate();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, 'サブタスクの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, initialData, setExpandedTasks, setSaving]);

  const handleBulkCreateConfirm = (count: number) => {
    if (bulkCreateConfig.type === 'project') {
      handleAddProject(count);
    } else if (bulkCreateConfig.type === 'task' && bulkCreateConfig.parentId) {
      handleAddTask(bulkCreateConfig.parentId, count);
    } else if (bulkCreateConfig.type === 'subtask' && bulkCreateConfig.parentId) {
      handleAddSubtask(bulkCreateConfig.parentId, count);
    }
  };

  const onAddTaskClick = (projectId: number, isShift: boolean) => {
    if (isShift) {
      setBulkCreateConfig({
        isOpen: true,
        type: 'task',
        title: 'タスクの一括作成',
        parentId: projectId
      });
    } else {
      handleAddTask(projectId);
    }
  };

  const onAddSubtaskClick = (taskId: number, isShift: boolean) => {
    if (isShift) {
      setBulkCreateConfig({
        isOpen: true,
        type: 'subtask',
        title: 'サブタスクの一括作成',
        parentId: taskId
      });
    } else {
      handleAddSubtask(taskId);
    }
  };

  return {
    lastAddedId,
    setLastAddedId,
    handleAddProject,
    handleAddTask,
    handleAddSubtask,
    bulkCreateConfig,
    setBulkCreateConfig,
    handleBulkCreateConfirm,
    onAddTaskClick,
    onAddSubtaskClick
  };
};
