import { useState, useRef } from 'react';
import { Project } from '../../../types/wbs';
import { wbsOps } from '../../../api/wbsOperations';

interface UseWBSTreeActionsProps {
  projects: Project[];
  selectedIds: { pIds: number[], tIds: number[], sIds: number[] };
  minimalIds: { pIds: number[], tIds: number[], sIds: number[] };
  selectedCounts: { pCount: number, tCount: number, sCount: number };
  totalSelectedCount: number;
  checkedIds: Record<string, boolean>;
  onUpdate: () => void;
  setSaving: (saving: boolean) => void;
  clearSelection: () => void;
}

export const useWBSTreeActions = ({
  projects,
  selectedIds,
  minimalIds,
  selectedCounts,
  totalSelectedCount,
  checkedIds,
  onUpdate,
  setSaving,
  clearSelection
}: UseWBSTreeActionsProps) => {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isShiftDatesModalOpen, setIsShiftDatesModalOpen] = useState(false);
  const [currentMinDate, setCurrentMinDate] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState({
    total: 0,
    detail: '',
    title: '',
    confirmText: '',
    variant: 'danger' as 'danger' | 'warning',
    onConfirm: () => { }
  });

  const handleDeleteSelected = () => {
    if (totalSelectedCount === 0) return;

    const detailMsg = `削除対象の内訳: プロジェクト:${selectedCounts.pCount}, タスク:${selectedCounts.tCount}, サブタスク:${selectedCounts.sCount}`;
    setConfirmData({
      total: totalSelectedCount,
      detail: detailMsg,
      title: '項目の削除確認',
      confirmText: '削除を実行',
      variant: 'danger',
      onConfirm: executeDelete
    });
    setIsConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    setIsConfirmModalOpen(false);
    setSaving(true);
    try {
      const promises = [
        ...minimalIds.pIds.map(id => wbsOps.deleteProject(id)),
        ...minimalIds.tIds.map(id => wbsOps.deleteTask(id)),
        ...minimalIds.sIds.map(id => wbsOps.deleteSubtask(id))
      ];
      if (promises.length > 0) {
        await Promise.all(promises);
      }
      clearSelection();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('削除中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleClearActualsSelected = () => {
    if (totalSelectedCount === 0) return;

    const detailMsg = `クリア対象の内訳: プロジェクト:${selectedCounts.pCount}, タスク:${selectedCounts.tCount}, サブタスク:${selectedCounts.sCount}\n\n対象の実績開始、レビュー開始、実績終了、実績工数、進捗が消去されます。`;
    setConfirmData({
      total: totalSelectedCount,
      detail: detailMsg,
      title: '実績値のクリア確認',
      confirmText: '実績値をクリアする',
      variant: 'warning',
      onConfirm: () => executeClearActuals(selectedIds.pIds, selectedIds.tIds, selectedIds.sIds)
    });
    setIsConfirmModalOpen(true);
  };

  const executeClearActuals = async (pIds: number[], tIds: number[], sIds: number[]) => {
    setIsConfirmModalOpen(false);
    setSaving(true);
    try {
      await wbsOps.clearActuals(pIds, tIds, sIds);
      clearSelection();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('クリア中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateSelected = async () => {
    if (totalSelectedCount === 0) return;
    setSaving(true);
    try {
      await wbsOps.duplicateItems(selectedIds.pIds, selectedIds.tIds, selectedIds.sIds);
      clearSelection();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('複製中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleShiftDatesSelected = () => {
    if (totalSelectedCount === 0) return;

    let minDate: string | null = null;
    const updateMinDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return;
      if (!minDate || dateStr < minDate) {
        minDate = dateStr;
      }
    };

    projects.forEach(p => {
      const isPChecked = checkedIds[`p-${p.id}`];
      if (isPChecked) {
        updateMinDate(p.planned_start_date);
        updateMinDate(p.planned_end_date);
        updateMinDate(p.actual_start_date);
        updateMinDate(p.actual_end_date);
      }
      p.tasks.forEach(t => {
        const isTChecked = checkedIds[`t-${t.id}`] || isPChecked;
        if (isTChecked) {
          updateMinDate(t.planned_start_date);
          updateMinDate(t.planned_end_date);
          updateMinDate(t.actual_start_date);
          updateMinDate(t.actual_end_date);
        }
        t.subtasks.forEach(s => {
          const isSChecked = checkedIds[`s-${s.id}`] || isTChecked;
          if (isSChecked) {
            updateMinDate(s.planned_start_date);
            updateMinDate(s.planned_end_date);
            updateMinDate(s.actual_start_date);
            updateMinDate(s.review_start_date);
            updateMinDate(s.actual_end_date);
          }
        });
      });
    });

    if (!minDate) {
      alert('日付が設定されている項目がありません。');
      return;
    }

    setCurrentMinDate(minDate);
    setIsShiftDatesModalOpen(true);
  };

  const executeShiftDates = async (newBaseDate: string) => {
    setIsShiftDatesModalOpen(false);
    setSaving(true);
    try {
      await wbsOps.shiftDates(selectedIds.pIds, selectedIds.tIds, selectedIds.sIds, newBaseDate);
      clearSelection();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('日付の移動中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  return {
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    confirmData,
    isShiftDatesModalOpen,
    setIsShiftDatesModalOpen,
    currentMinDate,
    handleDeleteSelected,
    handleClearActualsSelected,
    handleDuplicateSelected,
    handleShiftDatesSelected,
    executeShiftDates,
    setConfirmData
  };
};
