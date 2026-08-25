import { ListTree, QrCode, Save, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Spinner } from './Spinner.js';
import type { Recipe } from '../types/recipe.js';

/**
 * Recipe input panel (Process page).
 *
 * Purpose: Choose a saved recipe from the dropdown, or attach a QR image / paste
 *   recipe text, name it and save it, then divide it into tasks. Kept purely
 *   presentational — all state + actions come from the Process page hooks.
 */
export function RecipeInput({
  recipes,
  recipesLoading,
  selectedRecipeId,
  onSelectRecipe,
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

  return (
    <section className="card process-input">
      <h2 className="form__title">
        <QrCode size={20} aria-hidden /> Upload a recipe
      </h2>
      <p className="muted form__sub">
        Load a saved recipe, or attach a QR image / paste its text. The recipe can span several
        lines — the system detects which line and PLC each task belongs to.
      </p>

      <div className="form-row">
        <label className="field">
          <span>Saved recipe</span>
          <select
            value={selectedRecipeId}
            onChange={(e) => onSelectRecipe(e.target.value)}
            disabled={recipesLoading}
          >
            <option value="">— New recipe —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {selectedRecipeId && (
          <button
            type="button"
            className="btn btn--danger btn--sm process-input__del"
            onClick={() => onDeleteRecipe(selectedRecipeId)}
            title="Delete this saved recipe"
          >
            <Trash2 size={16} aria-hidden /> Delete
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="QR image file"
        onChange={(e) => onDecode(e.target.files?.[0])}
      />
      <div className="qr__actions">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={decoding}>
          {decoding ? <Spinner label="Decoding" /> : (<><Upload size={16} aria-hidden /> Attach QR image</>)}
        </button>
      </div>

      <label className="field qr__output">
        <span>Recipe data</span>
        <textarea
          value={qr}
          onChange={(e) => setQr(e.target.value)}
          placeholder="1-1A=60;5-2=30;4-7=15;…"
          rows={3}
        />
      </label>

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
    </section>
  );
}
