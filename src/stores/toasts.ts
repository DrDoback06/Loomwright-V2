import { create } from 'zustand';
import { newId } from '@/lib/id';

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'error';
  /** Optional primary action (e.g. Undo). */
  action?: ToastAction;
  /** Optional secondary actions (e.g. "Save as template" beside Undo). */
  actions?: ToastAction[];
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, opts?: Partial<Pick<Toast, 'kind' | 'action' | 'actions'>>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, opts) => {
    const toast: Toast = {
      id: newId(),
      message,
      kind: opts?.kind ?? 'info',
      action: opts?.action,
      actions: opts?.actions,
    };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toast.id) }));
    }, 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, opts?: Partial<Pick<Toast, 'kind' | 'action' | 'actions'>>) {
  useToastStore.getState().push(message, opts);
}
