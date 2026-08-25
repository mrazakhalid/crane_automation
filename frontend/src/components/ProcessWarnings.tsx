import { AlertTriangle, HelpCircle, ServerOff } from 'lucide-react';
import type { ProcessPlan } from '../types/process.js';

/**
 * Process warnings panel.
 *
 * Purpose: Surface everything that needs attention after dividing a recipe —
 *   ambiguous steps (a tank name on more than one line) get an inline line-picker;
 *   missing keys (no line has the tank) and unrouted tasks (crane with no PLC)
 *   are listed so nothing is silently dropped.
 */
export function ProcessWarnings({
  plan,
  onResolve,
}: {
  plan: ProcessPlan;
  onResolve: (step: number, lineId: string) => void;
}) {
  const { ambiguous, missing, unrouted } = plan;
  if (ambiguous.length === 0 && missing.length === 0 && unrouted.length === 0) return null;

  return (
    <div className="process-warnings">
      {ambiguous.length > 0 && (
        <section className="card warn warn--pick">
          <h3 className="warn__title">
            <HelpCircle size={18} aria-hidden /> Choose a line for these tanks
          </h3>
          <ul className="warn__list">
            {ambiguous.map((a) => (
              <li key={a.step} className="warn__pick">
                <span>
                  Step {a.step}: <strong>{a.key}</strong> exists on more than one line
                </span>
                <select defaultValue="" onChange={(e) => e.target.value && onResolve(a.step, e.target.value)}>
                  <option value="" disabled>
                    Pick a line…
                  </option>
                  {a.candidateLineIds.map((id, i) => (
                    <option key={id} value={id}>
                      {a.candidateLineNames[i]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missing.length > 0 && (
        <section className="card warn warn--danger">
          <h3 className="warn__title">
            <AlertTriangle size={18} aria-hidden /> Not on any line
          </h3>
          <p className="muted">
            {missing.map((m) => `${m.key} (step ${m.step})`).join(', ')} — fix the recipe or add the
            tank to a line.
          </p>
        </section>
      )}

      {unrouted.length > 0 && (
        <section className="card warn">
          <h3 className="warn__title">
            <ServerOff size={18} aria-hidden /> No PLC assigned
          </h3>
          <p className="muted">
            {unrouted.map((u) => `${u.key} (${u.lineName} / crane ${u.crane})`).join(', ')} — assign
            the crane to a PLC in PLC Manager to route it. These still appear below, unassigned.
          </p>
        </section>
      )}
    </div>
  );
}
