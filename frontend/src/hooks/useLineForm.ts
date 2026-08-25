import { useState } from 'react';
import { lineSchema } from '../schemas/line.js';
import type { Line, NewLine, Tank } from '../types/line.js';

/** One editable tank row (flattened for the form; transfer split into a checkbox + select). */
export interface TankDraft {
  number: number;
  name: string;
  crane: string;
  transfer: boolean;
  sharedCrane: string;
  note: string;
}

const emptyTank = (number: number, crane: string): TankDraft => ({
  number,
  name: '',
  crane,
  transfer: false,
  sharedCrane: '',
  note: '',
});

/** Flatten a stored tank into an editable draft. */
function toDraft(t: Tank): TankDraft {
  return {
    number: t.number,
    name: t.name,
    crane: t.crane,
    transfer: t.transfer ?? false,
    sharedCrane: t.cranes?.find((c) => c !== t.crane) ?? '',
    note: t.note ?? '',
  };
}

/**
 * Line-builder state hook (shared by create + edit).
 *
 * Purpose: Own the name/cranes/tanks draft and the add/remove/update handlers,
 *   plus validation + payload assembly. Keeps `LineForm` presentational.
 * Args: initial — an existing line to edit, or undefined to start blank.
 * Returns: The draft state, mutators, and `submit(onSave)`.
 */
export function useLineForm(initial?: Line) {
  const [name, setName] = useState(initial?.name ?? '');
  const [cranes, setCranes] = useState<string[]>(initial?.cranes ?? []);
  const [tanks, setTanks] = useState<TankDraft[]>(initial?.tanks.map(toDraft) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addCrane = (code: string) => {
    const c = code.trim();
    if (c && !cranes.includes(c)) setCranes((prev) => [...prev, c]);
  };
  const removeCrane = (code: string) => setCranes((prev) => prev.filter((c) => c !== code));

  const addTank = () =>
    setTanks((prev) => [...prev, emptyTank(prev.length + 1, cranes[0] ?? '')]);
  const removeTank = (i: number) =>
    setTanks((prev) => prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, number: idx + 1 })));
  const updateTank = (i: number, patch: Partial<TankDraft>) =>
    setTanks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  /** Assemble the API payload from the current draft. */
  function buildPayload(): NewLine {
    return {
      name: name.trim(),
      cranes,
      tanks: tanks.map((t) => ({
        number: t.number,
        name: t.name.trim(),
        crane: t.crane,
        ...(t.transfer ? { transfer: true } : {}),
        ...(t.transfer && t.sharedCrane ? { cranes: [t.crane, t.sharedCrane] } : {}),
        ...(t.note.trim() ? { note: t.note.trim() } : {}),
      })),
    };
  }

  /** Validate + persist via `onSave`; returns whether it succeeded. */
  async function submit(onSave: (input: NewLine) => Promise<boolean>): Promise<boolean> {
    const payload = buildPayload();
    const parsed = lineSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid line');
      return false;
    }
    setError(null);
    setBusy(true);
    const ok = await onSave(payload);
    setBusy(false);
    return ok;
  }

  return {
    name, setName,
    cranes, addCrane, removeCrane,
    tanks, addTank, removeTank, updateTank,
    error, busy, submit,
  };
}
