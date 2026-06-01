export type ToastType = 'error' | 'info' | 'success';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();
const recentToastKeys = new Map<string, number>();
const networkErrorToastSources = new WeakSet<object>();
let nextToastId = 1;

export const subscribeToToasts = (listener: ToastListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const showToast = (
  toast: Omit<ToastMessage, 'id'>,
  options: { dedupeKey?: string; cooldownMs?: number } = {},
) => {
  const now = Date.now();
  const cooldownMs = options.cooldownMs ?? 3000;

  if (options.dedupeKey) {
    const lastShownAt = recentToastKeys.get(options.dedupeKey);
    if (lastShownAt && now - lastShownAt < cooldownMs) {
      return;
    }
    recentToastKeys.set(options.dedupeKey, now);
  }

  const message = { ...toast, id: nextToastId++ };
  listeners.forEach((listener) => listener(message));
};

export const showErrorToast = (title: string, message?: string) => {
  showToast({ type: 'error', title, message });
};

export const showInfoToast = (title: string, message?: string) => {
  showToast({ type: 'info', title, message });
};

export const markNetworkErrorToastShown = (error: unknown) => {
  if (error && typeof error === 'object') {
    networkErrorToastSources.add(error);
  }
};

export const wasNetworkErrorToastShown = (error: unknown) => (
  !!error && typeof error === 'object' && networkErrorToastSources.has(error)
);

export const showErrorToastUnlessNetworkError = (error: unknown, title: string, message?: string) => {
  if (wasNetworkErrorToastShown(error)) return;
  showErrorToast(title, message);
};
