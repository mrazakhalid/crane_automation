import { Factory } from 'lucide-react';
import { PlantVisualizer } from '../components/PlantVisualizer.js';
import { usePlantView } from '../hooks/usePlantView.js';

/**
 * Plant Overview page (manager + super-admin).
 *
 * Purpose: A live, animated picture of the WHOLE plant — every line as a track
 *   with its cranes moving station to station, driven by the PLC signals. Shows
 *   each crane's state and the current/next tank per the loaded recipe. Read-only;
 *   it polls `GET /plc/plant-view`. Lines whose PLC is offline show "no signal".
 */
export function PlantPage() {
  const { plant, error, loading } = usePlantView();

  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner page-body__inner--fluid">
          <p className="eyebrow">Workspace</p>
          <section className="card">
            <h2 className="form__title">
              <Factory size={20} aria-hidden /> Plant overview
            </h2>
            <p className="muted form__sub">
              Live plant activity — each line shows its tanks in order, its cranes, and what each
              crane is doing right now (position, state, current → next tank).
            </p>

            {plant ? (
              <PlantVisualizer plant={plant} />
            ) : (
              <p className="muted crane-viz__note">{loading ? 'Loading the plant view…' : (error ?? 'No data.')}</p>
            )}
            {plant && error && (
              <p className="muted crane-viz__note">Reconnecting… showing last known state.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
