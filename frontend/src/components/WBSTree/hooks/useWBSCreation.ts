import { useState, useCallback, useEffect } from 'react';
import { wbsOps } from '../../../api/wbsOperations';
import { InitialData } from '../../../types';

export const useWBSCreation = (
  onUpdate: () => void,
  initialData: InitialData | null,
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
  setSaving: (saving: boolean) => void
) => {
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const handleAddProject = useCallback(async () => {
    try {
      setSaving(true);
      const res = await wbsOps.createProject('新しいプロジェクト');
      if (res.data && res.data.id) {
        setLastAddedId(`p-${res.data.id}`);
      }
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('プロジェクトの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, setSaving]);

  useEffect(() => {
    const handler = () => handleAddProject();
    window.addEventListener('add-project', handler);
    return () => window.removeEventListener('add-project', handler);
  }, [handleAddProject]);

  const handleAddTask = useCallback(async (projectId: number) => {
    try {
      setSaving(true);
      const res = await wbsOps.createTask(projectId, '新しいタスク');
      if (res.data && res.data.id) {
        setLastAddedId(`t-${res.data.id}`);
      }
      setExpandedProjects(p => ({ ...p, [projectId]: true }));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('タスクの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, setExpandedProjects, setSaving]);

  const handleAddSubtask = useCallback(async (taskId: number) => {
    if (!initialData) return;
    try {
      setSaving(true);
      const typeId = null;
      const newStatus = initialData.statuses.find(s => s.status_name === 'New') || initialData.statuses[0];
      const statusId = newStatus?.id || 1;
      const res = await wbsOps.createSubtask(taskId, typeId, statusId);
      if (res.data && res.data.id) {
        setLastAddedId(`s-${res.data.id}`);
      }
      setExpandedTasks(t => ({ ...t, [taskId]: true }));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('サブタスクの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, initialData, setExpandedTasks, setSaving]);

  return {
    lastAddedId,
    setLastAddedId,
    handleAddProject,
    handleAddTask,
    handleAddSubtask
  };
};
