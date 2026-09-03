import { ListTree, Pencil, QrCode, Save, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { RecipeCombobox } from './RecipeCombobox.js';
import { RecipeEditModal } from './RecipeEditModal.js';
import { RecipeTable } from './RecipeTable.js';
import { Spinner } from './Spinner.js';
import type { Recipe } from '../types/recipe.js';

/** A QR image file's base name (extension stripped) — the default recipe name. */
function fileBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

/**
 * Recipe input panel (Process page).
 *
 * Purpose: Choose a saved recipe from the searchable dropdown (or edit/delete it),
 *   or attach a QR image / fill the Tank / Time table, name it and save it, then
 *   divide it into tasks. Attaching a QR pre-fills the name from the file name.
 *   Kept presentational — data + persistence actions come from the Process hooks.
 */
export function RecipeInput({
  recipes,
  recipesLoading,
  selectedRecipeId,
  onSelectRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
  qr,
  setQr,
  onDecode,
  decoding,
  onSave,
  onDivide,
  planning,
}: {
  recipes: Recipe[];
  recipesLoading: boolean;
  selectedRecipeId: string;
  onSelectRecipe: (id: string) => void;
  onUpdateRecipe: (id: string, patch: { name: string; qr: string }) => Promise<Recipe | null>;
  onDeleteRecipe: (id: string) => void;
  qr: string;
  setQr: (v: string) => void;
  onDecode: (file: File | undefined) => void;
  decoding: boolean;
  onSave: (name: string) => void;
  onDivide: () => void;
  planning: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  /** Decode the attached QR image and pre-fill the (editable) name from its file. */
  function onFileChange(file: File | undefined): void {
    onDecode(file);
    if (file) setName(fileBaseName(file.name));
  }

  /** Persist edits from the modal; keep it open on failure so nothing is lost. */
  async function saveEdit(patch: { name: string; qr: string }): Promise<void> {
    if (!selectedRecipe) return;
    setSavingEdit(true);
    const saved = await onUpdateRecipe(selectedRecipe.id, patch);
    setSavingEdit(false);
    if (saved) setEditOpen(false);
  }

  return (
    <section className="card process-input">
      <h2 className="form__title">
        <QrCode size={20} aria-hidden /> Upload a recipe
      </h2>
      <p className="muted form__sub">
        Load a saved recipe, attach a QR image, or fill the Tank / Time table below. The recipe can
        span several lines — the system detects which line and PLC each task belongs to.
      </p>

      <div className="form-row">
        <div className="field">
          <span>Saved recipe</span>
          <RecipeCombobox
            recipes={recipes}
            selectedRecipeId={selectedRecipeId}
            onSelect={onSelectRecipe}
            loading={recipesLoading}
          />
        </div>
        {selectedRecipeId && (
          <div className="process-input__recipe-actions">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setEditOpen(true)}
              title="Edit this saved recipe"
            >
              <Pencil size={16} aria-hidden /> Edit
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => onDeleteRecipe(selectedRecipeId)}
              title="Delete this saved recipe"
            >
              <Trash2 size={16} aria-hidden /> Delete
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="QR image file"
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />
      <div className="qr__actions">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={decoding}>
          {decoding ? <Spinner label="Decoding" /> : (<><Upload size={16} aria-hidden /> Attach QR image</>)}
        </button>
      </div>

      <div className="field qr__output">
        <span>Recipe data</span>
        <RecipeTable qr={qr} setQr={setQr} />
      </div>

      <div className="form-row process-input__foot">
        <label className="field process-input__name">
          <span>Save as</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name"
            maxLength={60}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            onSave(name.trim());
            setName('');
          }}
          disabled={!name.trim() || !qr.trim()}
        >
          <Save size={16} aria-hidden /> Save recipe
        </button>
        <button
          type="button"
          className="btn btn--primary process-input__divide"
          onClick={onDivide}
          disabled={planning || !qr.trim()}
        >
          {planning ? <Spinner label="Dividing" /> : (<><ListTree size={16} aria-hidden /> Divide tasks</>)}
        </button>
      </div>

      {editOpen && selectedRecipe && (
        <RecipeEditModal
          recipe={selectedRecipe}
          saving={savingEdit}
          onClose={() => setEditOpen(false)}
          onSave={(patch) => void saveEdit(patch)}
        />
      )}
    </section>
  );
}
