import { Modal } from './Modal.js';
import { LineForm } from './LineForm.js';
import type { Line, NewLine } from '../types/line.js';

/**
 * Edit-line dialog (super-admin action).
 *
 * Purpose: Edit an existing line's name/cranes/tanks in a modal, reusing the
 *   shared `LineForm` builder. Delegates the write to the caller's `onSave`.
 * Args: line — the target; onSave — persists the payload (returns success);
 *   onClose — dismiss.
 */
export function EditLineDialog({
  line,
  onSave,
  onClose,
}: {
  line: Line;
  onSave: (input: NewLine) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <Modal title={`Edit ${line.name}`} onClose={onClose}>
      <LineForm initial={line} submitLabel="Save changes" onSubmit={onSave} onCancel={onClose} />
    </Modal>
  );
}
