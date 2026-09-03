import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '../types/recipe.js';

/**
 * Searchable saved-recipe dropdown (combobox).
 *
 * Purpose: One control that both searches and selects — type to filter the (long)
 *   recipe list, click an option to load it. Replaces the separate search box +
 *   native `<select>`. Closes on outside click; `""` selects the "New recipe"
 *   (blank) state. Purely presentational: the list + selection come from props.
 */
export function RecipeCombobox({
  recipes,
  selectedRecipeId,
  onSelect,
  loading,
}: {
  recipes: Recipe[];
  selectedRecipeId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = recipes.find((r) => r.id === selectedRecipeId);
  const q = query.trim().toLowerCase();
  const filtered = q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;

  // Close when clicking outside the control while it's open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /** Pick an option (or `""` for New recipe): notify, reset search, close. */
  function choose(id: string): void {
    onSelect(id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="combobox" ref={rootRef}>
      <div className="combobox__control">
        <Search size={15} className="combobox__icon" aria-hidden />
        <input
          type="text"
          className="combobox__input"
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected ? selected.name : 'Search recipes…'}
          disabled={loading}
          role="combobox"
          aria-expanded={open}
          aria-controls="recipe-combobox-list"
          aria-label="Search saved recipes"
        />
        <ChevronDown size={16} className="combobox__caret" aria-hidden />
      </div>
      {open && (
        <ul className="combobox__list" id="recipe-combobox-list" role="listbox">
          <li>
            <button type="button" className="combobox__option combobox__option--muted" onClick={() => choose('')}>
              — New recipe —
            </button>
          </li>
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`combobox__option${r.id === selectedRecipeId ? ' is-selected' : ''}`}
                onClick={() => choose(r.id)}
              >
                {r.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="combobox__empty muted">No recipes match “{query.trim()}”.</li>
          )}
        </ul>
      )}
    </div>
  );
}
