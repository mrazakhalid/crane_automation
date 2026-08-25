import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext, type Toast, type ToastContextValue } from '../context/toast-context.js';

/**
 * Toast provider + on-screen stack.
 *
 * Purpose: Give any component a `notify()` for success/error/info feedback.
 *   Toasts auto-dismiss after a few seconds; IDs come from a monotonic counter
 *   so they stay unique without external deps.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback<ToastContextValue['notify']>(
    (message, variant = 'info') => {
      const id = `t${(counter.current += 1)}`;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast toast--${t.variant}`}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
