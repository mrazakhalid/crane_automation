import { X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Accessible modal dialog shell.
 *
 * Purpose: Reusable centered overlay with a title and a close affordance.
 *   Closes on Escape and on backdrop click; content is provided as children.
 * Args: title — heading; onClose — dismiss handler; children — body.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
