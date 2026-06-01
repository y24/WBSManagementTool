import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeToToasts, type ToastMessage } from '../utils/toast';

const DEFAULT_DURATION = 6000;

const toastStyles = {
  error: {
    border: 'border-red-200 dark:border-red-900/60',
    icon: 'text-red-600 dark:text-red-400',
    Icon: AlertCircle,
  },
  info: {
    border: 'border-blue-200 dark:border-blue-900/60',
    icon: 'text-blue-600 dark:text-blue-400',
    Icon: Info,
  },
  success: {
    border: 'border-emerald-200 dark:border-emerald-900/60',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((current) => [...current, toast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.duration ?? DEFAULT_DURATION);
    });
  }, []);

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  return (
    <div className="fixed right-4 top-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const style = toastStyles[toast.type];
  const Icon = style.Icon;

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg shadow-slate-900/10 dark:bg-slate-900 dark:shadow-black/30 ${style.border}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="通知を閉じる"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
