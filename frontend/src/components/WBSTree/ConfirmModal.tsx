import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  totalCount: number;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

const ConfirmModal = ({ isOpen, totalCount, title, description, confirmText, onConfirm, onCancel, variant = 'danger' }: ConfirmModalProps) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const colorClass = isDanger ? 'red' : 'amber';
  const Icon = isDanger ? Trash2 : AlertTriangle;

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className={`flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 ${isDanger ? 'bg-red-50/30 dark:bg-red-900/10' : 'bg-amber-50/30 dark:bg-amber-900/10'}`}>
          <h3 className={`font-bold ${isDanger ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} flex items-center gap-2`}>
            <AlertTriangle size={20} />
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8 text-center">
          <div className={`mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full ${isDanger ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
            <Icon size={32} />
          </div>
          <h4 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">
            {totalCount}件の項目を{confirmText.replace('を実行する', '')}しますか？
          </h4>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed whitespace-pre-wrap">
            {description}
            {"\n\n"}この操作は取り消せません。本当によろしいですか？
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 text-sm font-semibold text-white ${isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'} rounded-xl shadow-lg transition-all active:scale-95`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
