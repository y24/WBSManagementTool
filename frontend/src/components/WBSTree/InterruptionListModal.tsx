import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Trash2, Calendar, MessageSquare, Check, AlertTriangle, Pause, Play } from 'lucide-react';
import { Subtask, SubtaskInterruption } from '../../types/wbs';
import { apiClient } from '../../api/client';
import { format } from 'date-fns';

interface InterruptionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: Subtask;
  onRefresh?: () => void;
}

interface InterruptionEditForm {
  interruption_date: string;
  resumption_date: string;
  reason: string;
}

const InterruptionListModal: React.FC<InterruptionListModalProps> = ({
  isOpen,
  onClose,
  subtask,
  onRefresh
}) => {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  const [editForm, setEditForm] = useState<InterruptionEditForm>({
    interruption_date: '',
    resumption_date: '',
    reason: ''
  });

  const initialFormState = useRef({ ...editForm });
  const [showConfirm, setShowConfirm] = useState<{ type: 'close' | 'delete', id?: number } | null>(null);
  const [localInterruptions, setLocalInterruptions] = useState<SubtaskInterruption[]>(subtask.interruptions || []);

  useEffect(() => {
    if (isOpen) {
      fetchInterruptions();
    }
  }, [isOpen, subtask.id]);

  const fetchInterruptions = async () => {
    try {
      const response = await apiClient.get(`/subtasks/${subtask.id}/interruptions`);
      setLocalInterruptions(response.data);
    } catch (err) {
      console.error('Failed to fetch interruptions:', err);
    }
  };

  const isChanged = () => {
    if (editingId === null) return false;
    return (
      editForm.interruption_date !== initialFormState.current.interruption_date ||
      editForm.resumption_date !== initialFormState.current.resumption_date ||
      editForm.reason !== initialFormState.current.reason
    );
  };

  const handleCloseRequest = () => {
    if (isChanged()) {
      setShowConfirm({ type: 'close' });
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (showConfirm) {
          setShowConfirm(null);
        } else if (editingId !== null) {
          handleCancelEdit();
        } else {
          handleCloseRequest();
        }
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, showConfirm, editingId, editForm]);

  if (!isOpen) return null;

  const handleEditClick = (interruption: SubtaskInterruption) => {
    if (isChanged()) {
      if (!window.confirm('未保存の変更があります。破棄してもよろしいですか？')) return;
    }
    const state: InterruptionEditForm = {
      interruption_date: interruption.interruption_date,
      resumption_date: interruption.resumption_date || '',
      reason: interruption.reason || ''
    };
    setEditForm(state);
    initialFormState.current = { ...state };
    setEditingId(interruption.id);
  };

  const handleNewClick = () => {
    if (isChanged()) {
      if (!window.confirm('未保存の変更があります。破棄してもよろしいですか？')) return;
    }
    const state = {
      interruption_date: format(new Date(), 'yyyy-MM-dd'),
      resumption_date: '',
      reason: ''
    };
    setEditForm(state);
    initialFormState.current = { ...state };
    setEditingId('new');
  };

  const handleCancelEdit = () => {
    if (isChanged()) {
      if (!window.confirm('未保存の変更があります。破棄してもよろしいですか？')) return;
    }
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!editForm.interruption_date) return;
    if (editForm.resumption_date && editForm.resumption_date < editForm.interruption_date) {
      alert('再開日は中断日以降である必要があります。');
      return;
    }

    try {
      if (editingId === 'new') {
        await apiClient.post(`/subtasks/${subtask.id}/interruptions`, {
          subtask_id: subtask.id,
          interruption_date: editForm.interruption_date,
          resumption_date: editForm.resumption_date || null,
          reason: editForm.reason
        });
      } else {
        await apiClient.patch(`/interruptions/${editingId}`, {
          interruption_date: editForm.interruption_date,
          resumption_date: editForm.resumption_date || null,
          reason: editForm.reason
        });
      }

      setEditingId(null);
      fetchInterruptions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to save interruption:', err);
      alert('保存に失敗しました。');
    }
  };

  const handleDelete = async (id: number) => {
    setShowConfirm({ type: 'delete', id });
  };

  const executeDelete = async (id: number) => {
    try {
      await apiClient.delete(`/interruptions/${id}`);
      fetchInterruptions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete interruption:', err);
      alert('削除に失敗しました。');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <Pause size={18} className="text-amber-500" />
            中断・再開の管理
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewClick}
              disabled={editingId !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
            >
              <Plus size={16} />
              新規追加
            </button>
            <button
              onClick={handleCloseRequest}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Subtask Info */}
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-900/10 border-b dark:border-slate-800 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle size={12} />
          <span>対象: {subtask.subtask_detail || 'サブタスク'}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
          <div className="space-y-3">
            {editingId === 'new' && (
              <InterruptionEditRow
                form={editForm}
                setForm={setEditForm}
                onSave={handleSave}
                onCancel={handleCancelEdit}
              />
            )}

            {localInterruptions.length === 0 && editingId !== 'new' && (
              <div className="text-center py-10 text-gray-500 dark:text-slate-400 text-sm">
                登録されている中断期間はありません。
              </div>
            )}

            {localInterruptions.map(interruption => (
              editingId === interruption.id ? (
                <InterruptionEditRow
                  key={interruption.id}
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleSave}
                  onCancel={handleCancelEdit}
                />
              ) : (
                <div key={interruption.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded text-amber-700 dark:text-amber-400 text-xs font-bold">
                        <Pause size={12} /> {interruption.interruption_date}
                      </div>
                      <div className="text-gray-400">→</div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${interruption.resumption_date ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 italic'}`}>
                        <Play size={12} /> {interruption.resumption_date || '再開待ち'}
                      </div>
                    </div>
                    <div className="col-span-7 text-sm text-gray-600 dark:text-slate-300 flex items-start gap-2">
                      <MessageSquare size={14} className="mt-0.5 text-gray-400 shrink-0" />
                      <span className="truncate">{interruption.reason || <span className="italic text-gray-400">理由なし</span>}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEditClick(interruption)}
                      disabled={editingId !== null}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="編集"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(interruption.id)}
                      disabled={editingId !== null}
                      className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
      {showConfirm?.type === 'close' && (
        <SmallConfirmModal
          title="変更を破棄しますか？"
          message="入力された内容が保存されていません。変更を破棄して終了してもよろしいですか？"
          confirmText="破棄して閉じる"
          onConfirm={onClose}
          onCancel={() => setShowConfirm(null)}
        />
      )}
      {showConfirm?.type === 'delete' && (
        <SmallConfirmModal
          title="中断期間を削除しますか？"
          message="この中断期間を削除してもよろしいですか？この操作は取り消せません。"
          confirmText="削除する"
          confirmColor="rose"
          onConfirm={() => {
            if (showConfirm.id) executeDelete(showConfirm.id);
            setShowConfirm(null);
          }}
          onCancel={() => setShowConfirm(null)}
        />
      )}
    </div>,
    document.body
  );
};

const InterruptionEditRow = ({
  form,
  setForm,
  onSave,
  onCancel
}: {
  form: InterruptionEditForm;
  setForm: React.Dispatch<React.SetStateAction<InterruptionEditForm>>;
  onSave: () => void;
  onCancel: () => void;
}) => {
  return (
    <div className="bg-blue-50/50 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 p-4 rounded-xl shadow-inner animate-in fade-in zoom-in-95 duration-200">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            <Pause size={10} className="inline mr-1" /> 中断日
          </label>
          <input
            type="date"
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={form.interruption_date}
            onChange={(e) => setForm({ ...form, interruption_date: e.target.value })}
          />
        </div>
        <div className="col-span-3">
          <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            <Play size={10} className="inline mr-1" /> 再開日
          </label>
          <input
            type="date"
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={form.resumption_date}
            min={form.interruption_date}
            onChange={(e) => setForm({ ...form, resumption_date: e.target.value })}
          />
        </div>
        <div className="col-span-6">
          <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            備考
          </label>
          <input
            type="text"
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="中断理由など"
            autoFocus
          />
        </div>
        <div className="col-span-12 flex justify-end gap-2 pt-2 border-t border-blue-100 dark:border-slate-700">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={!form.interruption_date}
            className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
          >
            <Check size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

const SmallConfirmModal = ({
  title,
  message,
  confirmText,
  confirmColor = 'amber',
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmText: string;
  confirmColor?: 'amber' | 'rose';
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const colorClasses = {
    amber: "bg-amber-600 hover:bg-amber-700 text-white",
    rose: "bg-rose-600 hover:bg-rose-700 text-white"
  };

  const iconClasses = {
    amber: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    rose: "text-rose-500 bg-rose-50 dark:bg-rose-900/20"
  };

  return (
    <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${iconClasses[confirmColor]}`}>
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all active:scale-95 ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterruptionListModal;
