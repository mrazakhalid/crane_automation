import { MISSING, type GeneratedTask } from '../types/line.js';

/**
 * Presentational task list (generated from a decoded QR recipe).
 *
 * Purpose: Render the ordered tasks in the agreed format — crane, tank, time,
 *   next/previous task, status. Unresolved cells show a "missing" badge.
 * Args: tasks — the generated rows; lineName — the line they were decoded against.
 */
export function TaskList({ tasks, lineName }: { tasks: GeneratedTask[]; lineName: string }) {
  return (
    <div className="card task-list">
      <header className="task-list__head">
        <h3 className="form__title">Task list</h3>
        <span className="muted">
          {tasks.length} tasks · <strong>{lineName}</strong>
        </span>
      </header>

      <div className="task-table__scroll">
        <table className="task-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Crane</th>
              <th>Tank</th>
              <th>Time (s)</th>
              <th>Prev</th>
              <th>Next</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.step}>
                <td>{t.step}</td>
                <td>{cell(t.crane_name)}</td>
                <td>{cell(t.tank_name)}</td>
                <td>{t.time}</td>
                <td>{cell(t.previous_task)}</td>
                <td>{cell(t.next_task)}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Render a cell value, badging the "missing" sentinel. */
function cell(value: string | number) {
  if (value === MISSING) return <span className="tag tag--missing">missing</span>;
  return value;
}
