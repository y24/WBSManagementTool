import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Trash2, Tag, MessageSquare, Palette, AlertTriangle } from 'lucide-react';
import { Marker } from '../types';

interface MarkerModalProps {
  isOpen: boolean;
  date: Date;
  existingMarker?: Marker;
  onSave: (name: string, note: string, color: string) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

const COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Slate', value: '#64748b' },
];

const MarkerModal: React.FC<MarkerModalProps> = ({
  isOpen,
  date,
  existingMarker,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [showConfirm, setShowConfirm] = useState(false);

  // 初期値を保持
  const initialValues = useRef({
    name: '',
    note: '',
    color: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (existingMarker) {
        setName(existingMarker.name);
        setNote(existingMarker.note || '');
        setColor(existingMarker.color);
        initialValues.current = {
          name: existingMarker.name,
          note: existingMarker.note || '',
          color: existingMarker.color,
        };
      } else {
        setName('');
        setNote('');
        setColor(COLORS[0].value);
        initialValues.current = {
          name: '',
          note: '',
          color: COLORS[0].value,
        };
      }
      setShowConfirm(false);
    }
  }, [existingMarker, isOpen]);

  const isChanged = () => {
    return (
      name !== initialValues.current.name ||
      note !== initialValues.current.note ||
      color !== initialValues.current.color
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
        } else {
          handleCloseRequest();
        }
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirm, name, note, color, onClose]);

  if (!isOpen) return null;

  const dateStr = date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
          <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <Tag size={18} className="text-rose-500" />
            マーカーの{existingMarker ? '編集' : '作成'}
          </h3>
          <button
            onClick={handleCloseRequest}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Date Label */}
        <div className="px-6 py-3 bg-rose-50 dark:bg-rose-900/10 border-b dark:border-slate-800">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
            {dateStr}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block mb-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              名称
            </label>
            <input
              type="text"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="マーカーの名称を入力してください"
              autoFocus
            />
          </div>

          {/* Note */}
          <div>
            <label className="block mb-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <MessageSquare size={12} className="text-blue-500" />
              メモ
            </label>
            <textarea
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 font-medium resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="メモを入力してください"
              rows={3}
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block mb-2 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Palette size={12} className="text-emerald-500" />
              カラー
            </label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                    color === c.value
                      ? 'border-gray-400 dark:border-slate-300 scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {color === c.value && <Check size={16} className="text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
          <div>
            {existingMarker && (
              <button
                onClick={() => onDelete(existingMarker.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
              >
                <Trash2 size={16} />
                削除
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCloseRequest}
              className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700 border border-transparent rounded-lg transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={() => onSave(name, note, color)}
              disabled={!name.trim()}
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all active:scale-95"
            >
              <Check size={18} />
              OK
            </button>
          </div>
        </div>
      </div>
      {showConfirm && <SmallConfirmModal onConfirm={onClose} onCancel={() => setShowConfirm(false)} />}
    </div>,
    document.body
  );
};

// 確認用の小さなモーダルコンポーネント（内部使用）
const SmallConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
  return (
    <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 p-6">
        <div className="flex items-center gap-3 text-amber-500 mb-4">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">変更を破棄しますか？</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
          入力された内容が保存されていません。変更を破棄して編集を終了してもよろしいですか？
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

export default MarkerModal;
