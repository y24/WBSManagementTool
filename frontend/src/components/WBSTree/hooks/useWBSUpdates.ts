import { useCallback } from 'react';
import { Project, Task, Subtask } from '../../../types/wbs';
import { InitialData } from '../../../types';
import { wbsOps } from '../../../api/wbsOperations';

interface UseWBSUpdatesProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
  setSaving: (saving: boolean) => void;
  checkedIds: Record<string, boolean>;
  setConfirmData: (data: any) => void;
  setIsConfirmModalOpen: (open: boolean) => void;
}

export const useWBSUpdates = ({
  projects,
  initialData,
  onUpdate,
  setSaving,
  checkedIds,
  setConfirmData,
  setIsConfirmModalOpen
}: UseWBSUpdatesProps) => {

  const findItem = useCallback((type: 'project' | 'task' | 'subtask', id: number) => {
    if (type === 'project') return projects.find(p => p.id === id);
    for (const p of projects) {
      if (type === 'task') {
        const t = p.tasks.find(t => t.id === id);
        if (t) return t;
      } else {
        for (const t of p.tasks) {
          const s = t.subtasks.find(s => s.id === id);
          if (s) return s;
        }
      }
    }
    return null;
  }, [projects]);

  const handleUpdate = useCallback(async (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => {
    // Name validation
    if ((field === 'project_name' || field === 'task_name') && (!value || value.trim() === '')) {
      alert('名称を入力してください。');
      onUpdate();
      return;
    }

    // Date range validation
    if (['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date'].includes(field)) {
      const item = findItem(type, id);
      if (item) {
        const isPlanned = field.startsWith('planned');
        const isStart = field.endsWith('start_date');
        const otherField = isStart
          ? (isPlanned ? 'planned_end_date' : 'actual_end_date')
          : (isPlanned ? 'planned_start_date' : 'actual_start_date');

        const startVal = isStart ? value : (item as any)[otherField];
        const endVal = isStart ? (item as any)[otherField] : value;

        if (startVal && endVal && startVal > endVal) {
          alert('開始日より後の日付を終了日に設定してください。');
          onUpdate();
          return;
        }
      }
    }

    // Determine target items for update
    const idStr = `${type.charAt(0)}-${id}`;
    const isSelected = !!checkedIds[idStr];
    let targetItems: { type: 'project' | 'task' | 'subtask', id: number }[] = [{ type, id }];

    if (isSelected) {
      const selectedItems: { type: 'project' | 'task' | 'subtask', id: number }[] = [];
      Object.entries(checkedIds).forEach(([key, checked]) => {
        if (!checked) return;
        const [t, i] = key.split('-');
        selectedItems.push({
          type: t === 'p' ? 'project' : t === 't' ? 'task' : 'subtask',
          id: parseInt(i, 10)
        });
      });
      if (selectedItems.length > 1) {
        targetItems = selectedItems;
      }
    }

    // Filter applicable items
    const applicableItems = targetItems.filter(item => {
      const data = findItem(item.type, item.id);
      if (!data) return false;

      // Auto ON check
      if (item.type === 'project' || item.type === 'task') {
        if (['planned_start_date', 'planned_end_date'].includes(field) && (data as any).is_auto_planned_date) return false;
        if (['actual_start_date', 'actual_end_date'].includes(field) && (data as any).is_auto_actual_date) return false;
        if (['progress_percent', 'planned_effort_total', 'actual_effort_total'].includes(field)) return false;
      } else if (item.type === 'subtask') {
        if (['planned_effort_days', 'actual_effort_days'].includes(field) && (data as any).is_auto_effort) return false;
      }

      // Level specific field check
      if (field === 'project_name' && item.type !== 'project') return false;
      if (field === 'task_name' && item.type !== 'task') return false;
      if (['subtask_type_id', 'subtask_detail', 'workload_percent', 'work_days', 'review_days', 'review_start_date'].includes(field) && item.type !== 'subtask') return false;

      return true;
    });

    const performUpdate = async () => {
      setSaving(true);
      setIsConfirmModalOpen(false);
      try {
        const promises = applicableItems.map(item => {
          const updates: any = { [field]: value };
          if (item.type === 'subtask' && field === 'status_id' && initialData) {
            const doneStatus = initialData.statuses.find(s => s.status_name === 'Done');
            if (doneStatus && value === doneStatus.id) {
              updates.progress_percent = 100;
            }
          }
          if (item.type === 'project') return wbsOps.updateProject(item.id, updates);
          if (item.type === 'task') return wbsOps.updateTask(item.id, updates);
          return wbsOps.updateSubtask(item.id, updates);
        });
        await Promise.all(promises);
        onUpdate();
      } catch (err) {
        console.error(err);
        alert('保存に失敗しました。');
      } finally {
        setSaving(false);
      }
    };

    if (applicableItems.length > 1) {
      const hasExistingValue = applicableItems.some(item => {
        if (item.type === type && item.id === id) return false;
        const data = findItem(item.type, item.id);
        if (!data) return false;
        const currentVal = (data as any)[field];
        return currentVal != null && currentVal !== '' && currentVal !== 0 && currentVal !== value;
      });

      if (hasExistingValue) {
        setConfirmData({
          total: applicableItems.length,
          detail: `選択された項目のうち、すでに値が入力されているものがあります。上書きしてよろしいですか？\n(対象項目数: ${applicableItems.length})`,
          title: '一括編集の確認',
          confirmText: '上書き保存',
          variant: 'warning',
          onConfirm: performUpdate
        });
        setIsConfirmModalOpen(true);
      } else {
        await performUpdate();
      }
    } else {
      await performUpdate();
    }
  }, [onUpdate, initialData, findItem, checkedIds, setSaving, setIsConfirmModalOpen, setConfirmData]);

  return {
    handleUpdate,
    findItem
  };
};
