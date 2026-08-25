import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from '../context/toast-context.js';

/**
 * Access the toast notifier.
 *
 * Returns: `{ notify }`.
 * Raises: Error if used outside a `<ToastProvider>`.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
