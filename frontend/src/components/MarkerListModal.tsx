import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Plus, Edit2, Trash2, Calendar, MessageSquare, Palette, Check, AlertTriangle } from 'lucide-react';
import { Marker, InitialData } from '../types';
import { apiClient } from '../api/client';
import { format, parseISO } from 'date-fns';

interface MarkerListModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: InitialData | null;
  onRefresh?: () => void;
}

const COLORS = [
  { name: 'Red', value: '#be123c' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Green', value: '#15803d' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Pink', value: '#be185d' },
  { name: 'Purple', value: '#7e22ce' },
  { name: 'Slate', value: '#334155' },
];

const MarkerListModal: React.FC<MarkerListModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onRefresh
}) => {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editForm, setEditForm] = useState({
    marker_date: '',
    name: '',
    note: '',
    color: COLORS[0].value
  });
  
  // 編集前の初期値保持用（変更判定）
  const initialFormState = useRef({ ...editForm });

  const [showConfirm, setShowConfirm] = useState(false);
  const [localMarkers, setLocalMarkers] = useState<Marker[]>(initialData?.markers || []);

  useEffect(() => {
    if (initialData?.markers) {
      // 親コンポーネントからの更新があれば反映する（ただし編集中でない場合や、外部由来の変更の場合を考慮し、通常は同期されます）
      setLocalMarkers(initialData.markers);
    }
  }, [initialData?.markers]);

  const isChanged = () => {
    if (editingId === null) return false;
    return (
      editForm.marker_date !== initialFormState.current.marker_date ||
      editForm.name !== initialFormState.current.name ||
      editForm.note !== initialFormState.current.note ||
      editForm.color !== initialFormState.current.color
    );
  };

  const handleCloseRequest = () => {
    if (isChanged()) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirm) {
          setShowConfirm(false);
        } else if (editingId !== null) {
            handleCancelEdit();
        } else {
          handleCloseRequest();
        }
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirm, editingId, editForm, onClose]);

  if (!isOpen) return null;

  const handleEditClick = (marker: Marker) => {
    if (isChanged()) {
      if (!window.confirm('未保存の変更があります。破棄してもよろしいですか？')) return;
    }
    const state = {
      marker_date: marker.marker_date,
      name: marker.name,
      note: marker.note || '',
      color: marker.color
    };
    setEditForm(state);
    initialFormState.current = { ...state };
    setEditingId(marker.id);
  };

  const handleNewClick = () => {
    if (isChanged()) {
      if (!window.confirm('未保存の変更があります。破棄してもよろしいですか？')) return;
    }
    const state = {
      marker_date: format(new Date(), 'yyyy-MM-dd'),
      name: '',
      note: '',
      color: COLORS[0].value
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
    if (!editForm.marker_date || !editForm.name.trim()) return;

    // 上書き確認: 既に同日のマーカーが存在し、かつそれが自分自身ではない場合
    const existingMarkerOnDate = localMarkers.find(
      m => m.marker_date === editForm.marker_date && m.id !== editingId
    );
    if (existingMarkerOnDate) {
      if (!window.confirm(`${editForm.marker_date} には既にマーカー「${existingMarkerOnDate.name}」が存在します。上書きして保存してもよろしいですか？`)) {
        return;
      }
    }
    
    try {
      const response = await apiClient.post('/markers', {
        marker_date: editForm.marker_date,
        name: editForm.name,
        note: editForm.note,
        color: editForm.color
      });
      const savedMarker = response.data;
      
      setLocalMarkers(prev => {
        const exists = prev.find(m => m.id === savedMarker.id);
        if (exists) {
          return prev.map(m => m.id === savedMarker.id ? savedMarker : m);
        }
        return [...prev, savedMarker];
      });

      setEditingId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to save marker:', err);
      alert('保存に失敗しました。');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('このマーカーを削除してもよろしいですか？')) return;
    try {
      await apiClient.delete(`/markers/${id}`);
      setLocalMarkers(prev => prev.filter(m => m.id !== id));
      if (editingId === id) setEditingId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete marker:', err);
      alert('削除に失敗しました。');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <Tag size={18} className="text-gray-500" />
            マーカー管理
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
          <div className="space-y-3">
            {editingId === 'new' && (
              <MarkerEditRow
                form={editForm}
                setForm={setEditForm}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                COLORS={COLORS}
              />
            )}
            
            {localMarkers.length === 0 && editingId !== 'new' && (
              <div className="text-center py-10 text-gray-500 dark:text-slate-400 text-sm">
                登録されているマーカーはありません。
              </div>
            )}

            {localMarkers.sort((a, b) => a.marker_date.localeCompare(b.marker_date)).map(marker => (
              editingId === marker.id ? (
                <MarkerEditRow
                  key={marker.id}
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleSave}
                  onCancel={handleCancelEdit}
                  COLORS={COLORS}
                />
              ) : (
                <div key={marker.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: marker.color }} />
                      <div className="font-medium text-sm text-gray-700 dark:text-slate-200">
                        {marker.marker_date}
                      </div>
                    </div>
                    <div className="col-span-3 font-bold text-sm text-gray-900 dark:text-slate-100 truncate flex items-center gap-2">
                       <Tag size={14} style={{ color: marker.color }} />
                       {marker.name}
                    </div>
                    <div className="col-span-6 text-sm text-gray-500 dark:text-slate-400 truncate">
                      {marker.note || <span className="italic text-gray-400">メモなし</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEditClick(marker)}
                      disabled={editingId !== null}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="編集"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(marker.id)}
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
      {showConfirm && <SmallConfirmModal onConfirm={onClose} onCancel={() => setShowConfirm(false)} />}
    </div>,
    document.body
  );
};

const MarkerEditRow = ({ form, setForm, onSave, onCancel, COLORS }: any) => {
  return (
    <div className="bg-blue-50/50 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 p-4 rounded-xl shadow-inner animate-in fade-in zoom-in-95 duration-200">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            <Calendar size={10} className="inline mr-1" /> 日付
          </label>
          <input
            type="date"
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={form.marker_date}
            onChange={(e) => setForm({ ...form, marker_date: e.target.value })}
          />
        </div>
        <div className="col-span-4">
          <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            名称
          </label>
          <input
            type="text"
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="マーカー名"
            autoFocus
          />
        </div>
        <div className="col-span-5">
           <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            <Palette size={10} className="inline mr-1" /> カラー
          </label>
          <div className="flex gap-2 items-center h-[34px]">
            {COLORS.map((c: any) => (
              <button
                key={c.value}
                onClick={() => setForm({ ...form, color: c.value })}
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                  form.color === c.value
                    ? 'border-gray-400 dark:border-slate-300 scale-110 shadow-md'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              >
                {form.color === c.value && <Check size={12} className="text-white drop-shadow-md" />}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-9">
          <label className="block mb-1 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
            <MessageSquare size={10} className="inline mr-1" /> メモ
          </label>
          <input
            type="text"
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="メモ (任意)"
          />
        </div>
        <div className="col-span-3 flex items-end justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={!form.marker_date || !form.name.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
          >
            <Check size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

const SmallConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 p-6">
        <div className="flex items-center gap-3 text-amber-500 mb-4">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">変更を破棄しますか？</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
          入力された内容が保存されていません。変更を破棄して終了してもよろしいですか？
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
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all active:scale-95"
          >
            破棄して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkerListModal;
