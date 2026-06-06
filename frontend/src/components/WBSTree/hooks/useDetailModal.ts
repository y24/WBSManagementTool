import { useState, useCallback } from 'react';
import { Project, Task, Subtask } from '../../../types/wbs';
import { wbsOps } from '../../../api/wbsOperations';
import { EditingType } from '../DetailModal';
import { showErrorToastUnlessNetworkError } from '../../../utils/toast';

interface UseDetailModalProps {
  onUpdate: () => void;
  onLocalUpdate?: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, any>) => void;
  setSaving: (saving: boolean) => void;
  checkedIds: Record<string, boolean>;
  setIsConfirmModalOpen: (open: boolean) => void;
  setConfirmData: (data: any) => void;
  findItem: (type: 'project' | 'task' | 'subtask', id: number) => any;
}

export const useDetailModal = ({
  onUpdate,
  onLocalUpdate,
  setSaving,
  checkedIds,
  setIsConfirmModalOpen,
  setConfirmData,
  findItem
}: UseDetailModalProps) => {
  const [editingItem, setEditingItem] = useState<{
    type: EditingType;
    id: number;
    name: string;
  } | null>(null);
  const [detailValue, setDetailValue] = useState('');
  const [ticketIdValue, setTicketIdValue] = useState('');
  const [testingIdValue, setTestingIdValue] = useState('');
  const [linkUrlValue, setLinkUrlValue] = useState('');
  const [memoValue, setMemoValue] = useState('');
  const [syncToAzureDevops, setSyncToAzureDevops] = useState(true);
  const [parentTicketId, setParentTicketId] = useState<number | null>(null);

  const openDetailModal = useCallback((type: EditingType, item: any) => {
    let nextParentTicketId: number | null = null;
    if (type === 'task') {
      const parentProject = findItem('project', item.project_id) as Project | null;
      nextParentTicketId = parentProject?.ticket_id ?? null;
    } else if (type === 'subtask') {
      const parentTask = findItem('task', item.task_id) as Task | null;
      nextParentTicketId = parentTask?.ticket_id ?? null;
    }

    setEditingItem({
      type,
      id: item.id,
      name: type === 'project' ? item.project_name : type === 'task' ? item.task_name : `ID: ${item.id}`
    });
    setDetailValue(type === 'subtask' ? (item.subtask_detail || '') : (item.detail || ''));
    setTicketIdValue(item.ticket_id != null ? String(item.ticket_id) : '');
    setTestingIdValue(type === 'project' && item.testing_id != null ? String(item.testing_id) : '');
    setLinkUrlValue(item.link_url || '');
    setMemoValue(item.memo || '');
    setSyncToAzureDevops(item.sync_to_azure_devops !== false);
    setParentTicketId(nextParentTicketId);
  }, [findItem]);

  const closeDetailModal = useCallback(() => setEditingItem(null), []);

  const handleDetailSave = async () => {
    if (!editingItem) return;

    const updates: Record<string, any> = {
      ticket_id: ticketIdValue !== '' ? parseInt(ticketIdValue, 10) : null,
      link_url: linkUrlValue || null,
      memo: memoValue || null,
      sync_to_azure_devops: syncToAzureDevops,
    };
    if (editingItem.type === 'project') {
      updates.testing_id = testingIdValue !== '' ? parseInt(testingIdValue, 10) : null;
    }
    if (editingItem.type === 'subtask') {
      updates.subtask_detail = detailValue || null;
    } else {
      updates.detail = detailValue || null;
    }

    const idStr = `${editingItem.type.charAt(0)}-${editingItem.id}`;
    let targetItems: { type: 'project' | 'task' | 'subtask', id: number }[] = [{ type: editingItem.type as any, id: editingItem.id }];

    if (checkedIds[idStr]) {
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

    const performDetailUpdate = async () => {
      setSaving(true);
      setIsConfirmModalOpen(false);
      try {
        const promises = targetItems.map(item => {
          const itemUpdates = { ...updates };
          if (item.type === 'subtask') {
            if ('detail' in itemUpdates) {
              itemUpdates.subtask_detail = itemUpdates.detail;
              delete (itemUpdates as any).detail;
            }
          } else {
            if ('subtask_detail' in itemUpdates) {
              itemUpdates.detail = itemUpdates.subtask_detail;
              delete (itemUpdates as any).subtask_detail;
            }
            delete (itemUpdates as any).workload_percent;
          }
          if (item.type !== 'project') {
            delete (itemUpdates as any).testing_id;
          }

          // 楽観的更新
          if (onLocalUpdate) {
            onLocalUpdate(item.type, item.id, itemUpdates);
          }

          if (item.type === 'project') return wbsOps.updateProject(item.id, itemUpdates);
          if (item.type === 'task') return wbsOps.updateTask(item.id, itemUpdates);
          return wbsOps.updateSubtask(item.id, itemUpdates);
        });
        await Promise.all(promises);
        setEditingItem(null);
        onUpdate();
      } catch (err) {
        console.error(err);
        showErrorToastUnlessNetworkError(err, '保存に失敗しました。');
        onUpdate(); // エラー時はサーバーから最新状態を取得してUIを戻す
      } finally {
        setSaving(false);
      }
    };

    if (targetItems.length > 1) {
      const hasExisting = targetItems.some(item => {
        if (item.type === editingItem.type && item.id === editingItem.id) return false;
        const data = findItem(item.type, item.id);
        if (!data) return false;

        const fieldsToCheck = [
          { f: 'ticket_id', v: updates.ticket_id },
          { f: 'testing_id', v: item.type === 'project' ? updates.testing_id : null },
          { f: 'memo', v: updates.memo },
          { f: item.type === 'subtask' ? 'subtask_detail' : 'detail', v: editingItem.type === 'subtask' ? updates.subtask_detail : updates.detail },
        ];

        return fieldsToCheck.some(check => {
          if (check.v == null || check.v === '') return false;
          const currentVal = (data as any)[check.f];
          return currentVal != null && currentVal !== '' && currentVal !== 0 && currentVal !== check.v;
        });
      });

      if (hasExisting) {
        setConfirmData({
          total: targetItems.length,
          detail: `選択された項目のうち、すでに詳細やメモが入力されているものがあります。上書きしてよろしいですか？\n(対象項目数: ${targetItems.length})`,
          title: '一括編集の確認',
          confirmText: '上書き保存',
          variant: 'warning',
          onConfirm: performDetailUpdate
        });
        setIsConfirmModalOpen(true);
      } else {
        await performDetailUpdate();
      }
    } else {
      await performDetailUpdate();
    }
  };

  return {
    editingItem,
    setEditingItem,
    detailValue,
    setDetailValue,
    ticketIdValue,
    setTicketIdValue,
    testingIdValue,
    setTestingIdValue,
    linkUrlValue,
    setLinkUrlValue,
    memoValue,
    setMemoValue,
    syncToAzureDevops,
    setSyncToAzureDevops,
    parentTicketId,
    openDetailModal,
    closeDetailModal,
    handleDetailSave
  };
};
