import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Project, Task, Subtask } from '../../../types/wbs';
import { InitialData } from '../../../types';
import { wbsOps } from '../../../api/wbsOperations';
import { addBusinessDays, getBusinessDaysCount } from '../utils';

interface UseWBSUpdatesProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
  onLocalUpdate?: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, any>) => void;
  setSaving: (saving: boolean) => void;
  checkedIds: Record<string, boolean>;
  setConfirmData: (data: any) => void;
  setIsConfirmModalOpen: (open: boolean) => void;
}

export const useWBSUpdates = ({
  projects,
  initialData,
  onUpdate,
  onLocalUpdate,
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
          
          // 連動更新ロジック (サブタスク)
          if (item.type === 'subtask') {
            const data = findItem(item.type, item.id) as Subtask;
            if (data) {
              const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
              
              // 1. 作業日数 or レビュー日数が変更された場合 -> 終了日を再計算
              if (field === 'work_days' || field === 'review_days') {
                if (data.planned_start_date) {
                  const start = parseISO(data.planned_start_date);
                  const wDays = field === 'work_days' ? Number(value) : (Number(data.work_days) || 0);
                  const rDays = field === 'review_days' ? Number(value) : (Number(data.review_days) || 0);
                  const totalBD = wDays + rDays;
                  if (totalBD > 0) {
                    const newEnd = addBusinessDays(start, totalBD, holidays);
                    updates.planned_end_date = format(newEnd, 'yyyy-MM-dd');
                  }
                }
              }
              // 2. 開始日が変更された場合 -> 期間を維持して終了日を再計算
              else if (field === 'planned_start_date' && value) {
                if (data.work_days != null) {
                  const start = parseISO(value);
                  const wDays = Number(data.work_days) || 0;
                  const rDays = Number(data.review_days) || 0;
                  const totalBD = wDays + rDays;
                  if (totalBD > 0) {
                    const newEnd = addBusinessDays(start, totalBD, holidays);
                    updates.planned_end_date = format(newEnd, 'yyyy-MM-dd');
                  }
                }
              }
              // 3. 終了日が変更された場合 -> 作業日数を再計算
              else if (field === 'planned_end_date' && value) {
                if (data.planned_start_date) {
                  const start = parseISO(data.planned_start_date);
                  const end = parseISO(value);
                  const rDays = Number(data.review_days) || 0;
                  const totalBD = getBusinessDaysCount(start, end, holidays);
                  updates.work_days = Math.max(0, totalBD - rDays);
                }
              }
            }
          }
          // タスク・プロジェクトの連動 (作業日数の更新のみ)
          else if ((item.type === 'task' || item.type === 'project') && field.includes('planned_')) {
            const data = findItem(item.type, item.id) as any;
            if (data) {
              const holidays = initialData?.holidays.map(h => h.holiday_date) || [];
              if (field.endsWith('start_date') && value && data.work_days) {
                const start = parseISO(value);
                const wDays = Number(data.work_days) || 0;
                if (wDays > 0) {
                  const newEnd = addBusinessDays(start, wDays, holidays);
                  updates.planned_end_date = format(newEnd, 'yyyy-MM-dd');
                }
              } else if (field.endsWith('end_date') && value && data.planned_start_date) {
                const start = parseISO(data.planned_start_date);
                const end = parseISO(value);
                updates.work_days = getBusinessDaysCount(start, end, holidays);
              }
            }
          }

          if (item.type === 'subtask' && field === 'status_id' && initialData) {
            const newIds = initialData.status_mapping_new?.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) || [1];
            const doneIds = initialData.status_mapping_done?.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) || [4, 7];
            const targetStatusId = parseInt(value, 10);
            
            if (newIds.includes(targetStatusId)) {
              updates.progress_percent = 0;
              updates.actual_start_date = null;
              updates.actual_end_date = null;
              updates.review_start_date = null;
            } else if (doneIds.includes(targetStatusId)) {
              updates.progress_percent = 100;
            }
          }

          // 楽観的更新
          if (onLocalUpdate) {
            onLocalUpdate(item.type, item.id, updates);
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
        onUpdate(); // エラー時はサーバーから最新状態を取得してUIを戻す
      } finally {
        setSaving(false);
      }
    };

    // Check for potential date/progress overwrites on status change
    let statusOverwriteMsg = '';
    if (field === 'status_id' && initialData) {
      const doneIds = initialData.status_mapping_done?.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) || [4, 7];
      const newIds = initialData.status_mapping_new?.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) || [1];
      const newStatusId = parseInt(value, 10);
      const isDone = doneIds.includes(newStatusId);
      const isNew = newIds.includes(newStatusId);
      const isOngoing = [2, 3].includes(newStatusId);

      const overwriteDetails: string[] = [];
      applicableItems.forEach(item => {
        if (item.type !== 'subtask') return;
        const data = findItem(item.type, item.id) as Subtask | null;
        if (!data) return;

        const oldIsDone = doneIds.includes(data.status_id);

        if (isNew) {
          if (data.progress_percent !== 0 && data.progress_percent !== null) {
            overwriteDetails.push(`進捗率: ${data.progress_percent}% -> 0%`);
          }
          if (data.actual_start_date) {
            overwriteDetails.push(`実績開始日: ${data.actual_start_date} -> (消去)`);
          }
          if (data.review_start_date) {
            overwriteDetails.push(`レビュー開始日: ${data.review_start_date} -> (消去)`);
          }
          if (data.actual_end_date) {
            overwriteDetails.push(`実績終了日: ${data.actual_end_date} -> (消去)`);
          }
        } else {
          // 1. Progress -> 100% (if currently set and not 100)
          if (isDone && data.progress_percent !== 100 && data.progress_percent !== 0 && data.progress_percent !== null) {
            overwriteDetails.push(`進捗率: ${data.progress_percent}% -> 100%`);
          }

          // 2. actual_end_date (overwritten by backend for Ongoing status)
          if (isOngoing && data.actual_end_date) {
            const today = new Date().toISOString().split('T')[0];
            if (data.actual_end_date !== today) {
              overwriteDetails.push(`実績終了日: ${data.actual_end_date} -> 今日 (自動更新)`);
            }
          }

          // 3. actual_end_date cleared when moving away from Done
          if (oldIsDone && !isDone && data.actual_end_date) {
            overwriteDetails.push(`実績終了日: ${data.actual_end_date} -> (消去)`);
          }
        }
      });

      const uniqueDetails = Array.from(new Set(overwriteDetails));
      if (uniqueDetails.length > 0) {
        statusOverwriteMsg = `ステータスの変更により、以下のデータが自動更新・消去されます。上書きしてよろしいですか？\n\n${uniqueDetails.join('\n')}`;
      }
    }

    if (applicableItems.length > 1 || statusOverwriteMsg) {
      const hasBulkValueOverwrite = applicableItems.length > 1 && applicableItems.some(item => {
        if (item.type === type && item.id === id) return false;
        const data = findItem(item.type, item.id);
        if (!data) return false;
        const currentVal = (data as any)[field];
        return currentVal != null && currentVal !== '' && currentVal !== 0 && currentVal !== value;
      });

      if (hasBulkValueOverwrite || statusOverwriteMsg) {
        let detail = '';
        if (hasBulkValueOverwrite && statusOverwriteMsg) {
          detail = `選択された項目のうち、すでに値が入力されているものがあります。また、自動入力による上書きも発生します。\n\n${statusOverwriteMsg}`;
        } else if (hasBulkValueOverwrite) {
          detail = `選択された項目のうち、すでに値が入力されているものがあります。上書きしてよろしいですか？\n(対象項目数: ${applicableItems.length})`;
        } else {
          detail = statusOverwriteMsg;
        }

        setConfirmData({
          total: applicableItems.length,
          detail: detail,
          title: statusOverwriteMsg ? '自動入力の確認' : '一括編集の確認',
          confirmText: '更新',
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
  }, [onUpdate, initialData, findItem, checkedIds, setSaving, setIsConfirmModalOpen, setConfirmData, onLocalUpdate]);

  return {
    handleUpdate,
    findItem
  };
};
