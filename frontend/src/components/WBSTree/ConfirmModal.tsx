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
  variant?: 'danger' | 'warning' | 'primary';
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  showBodyIcon?: boolean;
  descriptionPosition?: 'beforeButtons' | 'afterButtons';
  footerPosition?: 'beforeButtons' | 'afterButtons';
}

const ConfirmModal = ({ 
  isOpen, 
  totalCount, 
  title, 
  description, 
  confirmText, 
  onConfirm, 
  onCancel, 
  variant = 'danger', 
  icon, 
  footer,
  showBodyIcon = true,
  descriptionPosition = 'beforeButtons',
  footerPosition = 'afterButtons'
}: ConfirmModalProps) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';
  const isPrimary = variant === 'primary';
  const LucideIcon = isDanger ? Trash2 : AlertTriangle;

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className={`flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 ${
          isDanger ? 'bg-red-50/30 dark:bg-red-900/10' : 
          isWarning ? 'bg-amber-50/30 dark:bg-amber-900/10' : 
          'bg-blue-50/30 dark:bg-blue-900/10'
        }`}>
          <h3 className={`font-bold ${
            isDanger ? 'text-red-600 dark:text-red-400' : 
            isWarning ? 'text-amber-600 dark:text-amber-400' : 
            'text-blue-600 dark:text-blue-400'
          } flex items-center gap-2`}>
            {icon || <AlertTriangle size={20} />}
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8 text-center flex flex-col items-center">
          {showBodyIcon && (
            <div className={`mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full ${
              isDanger ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
              isWarning ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 
              'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}>
              {icon ? (
                React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 32 })
              ) : (
                <LucideIcon size={32} />
              )}
            </div>
          )}
          
          <h4 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">
            {totalCount}件の項目を{confirmText.replace('を実行する', '')}しますか？
          </h4>

          {descriptionPosition === 'beforeButtons' && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          )}

          {footerPosition === 'beforeButtons' && (
            <div className="mb-6 w-full">
              {footer}
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 text-sm font-semibold text-white ${
                isDanger ? 'bg-red-600 hover:bg-red-700' : 
                isWarning ? 'bg-amber-600 hover:bg-amber-700' : 
                'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20'
              } rounded-xl transition-all active:scale-95`}
            >
              {confirmText}
            </button>
          </div>

          {footerPosition === 'afterButtons' && (
            <div className="w-full">
              {footer}
            </div>
          )}

          {descriptionPosition === 'afterButtons' && (
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-6 leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
