import { Container } from 'lucide-react';
import { PlantVisualizer } from '../components/PlantVisualizer.js';
import { usePlantView } from '../hooks/usePlantView.js';

/**
 * Crane View page (manager + super-admin).
 *
 * Purpose: The live crane on its line, drawn with the **same layout, colours,
 *   compass and direction frame as the Plant page** (reuses `PlantVisualizer`) so
 *   the two views are visually identical. It focuses on the line(s) that currently
 *   have a connected crane; if none are connected yet it shows all lines so the
 *   page isn't blank. Read-only; polls `GET /plc/plant-view` and animates as a
 *   recipe runs.
 */
export function CraneViewPage() {
  const { plant, loading, error } = usePlantView();

  // Focus on the line(s) with a connected crane; fall back to all lines when none
  // are connected yet, so the page still shows the layout.
  const focused = plant ? plant.lines.filter((l) => l.cranesView.some((c) => c.connected)) : [];
  const view = plant ? { lines: focused.length ? focused : plant.lines } : null;

  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner page-body__inner--fluid">
          <p className="eyebrow">Workspace</p>
          <section className="card">
            <h2 className="form__title">
              <Container size={20} aria-hidden /> Crane view
            </h2>
            <p className="muted form__sub">
              Live crane on its line — same layout &amp; colours as the Plant view, focused on the
              connected crane. Animates as a recipe runs.
            </p>

            {loading && !view ? (
              <p className="muted crane-viz__note">Connecting to the PLC…</p>
            ) : view ? (
              <PlantVisualizer plant={view} />
            ) : (
              <p className="muted crane-viz__note">
                {error ?? 'No plant data.'} Ask an admin to connect on the PLC page if this persists.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
