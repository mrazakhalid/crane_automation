import { Container } from 'lucide-react';
import { CraneVisualizer } from '../components/CraneVisualizer.js';
import { useCraneView } from '../hooks/useCraneView.js';

/**
 * Crane View page (manager + super-admin).
 *
 * Purpose: A live, animated picture of the gantry crane driven by the PLC — the
 *   trolley moves station to station and the hoist raises/lowers as the batch
 *   runs. Read-only; it polls `GET /plc/crane-view`.
 */
export function CraneViewPage() {
  const { view, connected, error } = useCraneView();

  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner">
          <p className="eyebrow">Workspace</p>
          <section className="card">
            <h2 className="form__title">
              <Container size={20} aria-hidden /> Crane view
            </h2>
            <p className="muted form__sub">
              Live gantry position from the PLC — updates as the crane runs a batch.
            </p>

            {view ? (
              <>
                <CraneVisualizer view={view} />
                {!connected && (
                  <p className="muted crane-viz__note">Reconnecting to the PLC — showing last position…</p>
                )}
              </>
            ) : (
              <p className="muted crane-viz__note">
                {error ?? 'Connecting to the PLC…'} Ask an admin to connect on the PLC page if this persists.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
