import { Save } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './Modal.js';
import { RecipeTable } from './RecipeTable.js';
import { Spinner } from './Spinner.js';
import type { Recipe } from '../types/recipe.js';

/**
 * Edit-an-existing-recipe popup.
 *
 * Purpose: Let a manager rename a saved recipe and edit its Tank / Time table in a
 *   modal, then save the change. Edits a local copy of the recipe's name + raw
 *   `qr`, so cancelling discards; Save posts a `{ name, qr }` patch to the parent.
 */
export function RecipeEditModal({
  recipe,
  saving,
  onClose,
  onSave,
}: {
  recipe: Recipe;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: { name: string; qr: string }) => void;
}) {
  const [name, setName] = useState(recipe.name);
  const [qr, setQr] = useState(recipe.qr);

  return (
    <Modal title={`Edit “${recipe.name}”`} onClose={onClose}>
      <label className="field">
        <span>Recipe name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
      </label>
      <div className="field">
        <span>Recipe data</span>
        <RecipeTable qr={qr} setQr={setQr} />
      </div>
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onSave({ name: name.trim(), qr })}
          disabled={saving || !name.trim() || !qr.trim()}
        >
          {saving ? <Spinner label="Saving" /> : (<><Save size={16} aria-hidden /> Save changes</>)}
        </button>
      </div>
    </Modal>
  );
}
