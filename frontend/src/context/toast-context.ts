import { createContext } from 'react';

/** A transient notification. */
export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
}

export interface ToastContextValue {
  /** Show a toast; auto-dismisses. */
  notify: (message: string, variant?: Toast['variant']) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
