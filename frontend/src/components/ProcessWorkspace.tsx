import { useState } from 'react';
import { ProcessSummary } from './ProcessSummary.js';
import { ProcessWarnings } from './ProcessWarnings.js';
import { RecipeInput } from './RecipeInput.js';
import { useProcessContext } from '../context/ProcessProvider.js';
import { useRecipes } from '../hooks/useRecipes.js';

/**
 * Process workspace (recipe → divide → run).
 *
 * Purpose: The shared manager flow used by both the Process page and the manager
 *   Dashboard — upload/paste/pick a recipe, divide it across ALL lines/PLCs
 *   automatically (no line picker), resolve any ambiguous tanks, then run a live
 *   simulation. Owns the recipe + process hooks; renders the input, the warnings,
 *   and the per-PLC summary. Layout-agnostic (the host page provides the shell).
 */
export function ProcessWorkspace() {
  const recipesState = useRecipes();
  const p = useProcessContext();
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  /** Load a saved recipe (or reset to a blank "new recipe" workspace). */
  function selectRecipe(id: string): void {
    setSelectedRecipeId(id);
    const recipe = recipesState.recipes.find((r) => r.id === id);
    p.loadRecipe(recipe?.qr ?? '', recipe?.overrides ?? {});
  }

  /** Save the current recipe text under a name, then select it. */
  async function saveRecipe(name: string): Promise<void> {
    const saved = await recipesState.save({ name, qr: p.qr.trim(), overrides: p.overrides });
    if (saved) setSelectedRecipeId(saved.id);
  }

  /** Edit a saved recipe (name + data); reload it into the workspace if active. */
  async function updateRecipe(id: string, patch: { name: string; qr: string }) {
    const saved = await recipesState.update(id, patch);
    if (saved && id === selectedRecipeId) p.loadRecipe(saved.qr, saved.overrides ?? {});
    return saved;
  }

  /** Delete a saved recipe; clear the selection if it was the active one. */
  async function deleteRecipe(id: string): Promise<void> {
    await recipesState.remove(id);
    if (id === selectedRecipeId) setSelectedRecipeId('');
  }

  return (
    <>
      <RecipeInput
        recipes={recipesState.recipes}
        recipesLoading={recipesState.loading}
        selectedRecipeId={selectedRecipeId}
        onSelectRecipe={selectRecipe}
        onUpdateRecipe={updateRecipe}
        onDeleteRecipe={(id) => void deleteRecipe(id)}
        qr={p.qr}
        setQr={p.setQr}
        onDecode={(f) => void p.decode(f)}
        decoding={p.decoding}
        onSave={(name) => void saveRecipe(name)}
        onDivide={() => void p.divide()}
        planning={p.planning}
      />

      {p.plan && (
        <>
          <ProcessWarnings plan={p.plan} onResolve={p.resolveAmbiguity} />
          <ProcessSummary
            plan={p.plan}
            status={p.status}
            running={p.running}
            starting={p.starting}
            sending={p.sending}
            stateForStep={p.stateForStep}
            onSendToPlc={() => void p.sendToPlc()}
            onStart={() => void p.start()}
            onStop={() => void p.stop()}
          />
        </>
      )}
    </>
  );
}
