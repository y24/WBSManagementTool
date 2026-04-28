import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';

interface BulkCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number) => void;
  title: string;
}

const BulkCreateModal = ({ isOpen, onClose, onConfirm, title }: BulkCreateModalProps) => {
  const [count, setCount] = useState<string>('1');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCount('1'); // デフォルト値を1に変更
      // モーダルが開いた後にフォーカスを当てる
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // 入力値を全選択状態にして上書きしやすくする
        }
      }, 100);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const num = Math.max(1, Math.min(50, parseInt(count) || 1));
    onConfirm(num);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10">
          <h3 className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Plus size={20} />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              作成する数 (1-50)
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={count}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^[0-9\b]+$/.test(val)) {
                  setCount(val);
                }
              }}
              className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 rounded-xl transition-all active:scale-95"
            >
              一括作成
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkCreateModal;
