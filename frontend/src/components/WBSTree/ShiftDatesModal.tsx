import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, X, Check, ArrowRight } from 'lucide-react';

interface ShiftDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newBaseDate: string) => void;
  currentMinDate: string | null;
  totalSelectedCount: number;
}

const ShiftDatesModal = ({
  isOpen,
  onClose,
  onConfirm,
  currentMinDate,
  totalSelectedCount,
}: ShiftDatesModalProps) => {
  const [newBaseDate, setNewBaseDate] = useState<string>('');

  useEffect(() => {
    if (isOpen && currentMinDate) {
      setNewBaseDate(currentMinDate);
    }
  }, [isOpen, currentMinDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-900/10">
          <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays size={18} className="text-indigo-600 dark:text-indigo-400" />
            日付一括変更
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
            選択された <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalSelectedCount}</span> 件の項目（およびその配下）の各日付を、営業日数を維持して一括で移動します。
          </p>

          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">現在の起点 (最古日)</span>
                <span className="font-mono text-gray-700 dark:text-slate-200 font-bold">{currentMinDate || '未設定'}</span>
              </div>
              <ArrowRight className="text-gray-300 dark:text-slate-600" size={20} />
              <div className="space-y-1 text-right">
                <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider">変更後の起点</span>
                <input
                  type="date"
                  className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-transparent border-b-2 border-indigo-200 dark:border-indigo-900 focus:border-indigo-500 outline-none text-right"
                  value={newBaseDate}
                  onChange={(e) => setNewBaseDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 italic">
            <span>※</span>
            <span>土日および祝日を考慮して、営業日数を保ったまま移動します。</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-slate-800/80 border-t dark:border-slate-800 items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700 border border-transparent rounded-lg transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={() => onConfirm(newBaseDate)}
            disabled={!newBaseDate || newBaseDate === currentMinDate}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all active:scale-95"
          >
            <Check size={16} />
            実行する
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShiftDatesModal;
