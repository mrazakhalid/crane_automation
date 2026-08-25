import { ListChecks, QrCode, Send, Upload } from 'lucide-react';
import { useRef } from 'react';
import { Spinner } from './Spinner.js';
import { TaskList } from './TaskList.js';
import { useTaskGenerator } from '../hooks/useTaskGenerator.js';

/**
 * Manager task generator (dashboard tool).
 *
 * Purpose: Pick a saved line, attach a QR-code image (decoded in the browser),
 *   then generate the ordered task list for that recipe. The QR text is shown
 *   editable so it can also be pasted directly. Nothing leaves the device until
 *   "Generate" posts the recipe text to the backend.
 */
export function TaskGenerator() {
  const g = useTaskGenerator();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="task-gen">
      <section className="card">
        <h2 className="form__title">
          <QrCode size={20} aria-hidden /> Scan a QR to generate tasks
        </h2>
        <p className="muted form__sub">
          Choose a line, attach the recipe QR image, then generate its task list.
        </p>

        <label className="field">
          <span>Line</span>
          <select
            value={g.lineId}
            onChange={(e) => g.setLineId(e.target.value)}
            disabled={g.loading || g.lines.length === 0}
          >
            {g.lines.length === 0 && <option value="">No lines saved yet</option>}
            {g.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="QR image file"
          onChange={(e) => void g.decode(e.target.files?.[0])}
        />

        <div className="qr__actions">
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            disabled={g.decoding}
          >
            {g.decoding ? (
              <Spinner label="Decoding" />
            ) : (
              <>
                <Upload size={16} aria-hidden /> Attach QR image
              </>
            )}
          </button>
        </div>

        <label className="field qr__output">
          <span>QR recipe data</span>
          <textarea
            value={g.qr}
            onChange={(e) => g.setQr(e.target.value)}
            placeholder="1-1=60;1-2=30;1-3=5;…"
            rows={3}
          />
        </label>

        <button
          className="btn btn--primary"
          onClick={() => void g.generate()}
          disabled={g.generating || !g.lineId || !g.qr.trim()}
        >
          {g.generating ? (
            <Spinner label="Generating" />
          ) : (
            <>
              <ListChecks size={16} aria-hidden /> Generate tasks
            </>
          )}
        </button>
      </section>

      {g.result && (
        <>
          <TaskList tasks={g.result.tasks} lineName={g.result.lineName} />

          <div className="qr__actions qr__send">
            <button
              className="btn btn--primary"
              onClick={() => void g.sendToPlc()}
              disabled={g.sending || g.batchBusy}
            >
              {g.batchBusy ? (
                <Spinner label="Tasks in progress" />
              ) : g.sending ? (
                <Spinner label="Sending" />
              ) : (
                <>
                  <Send size={16} aria-hidden /> Send to PLC
                </>
              )}
            </button>
            {g.batchBusy && (
              <p className="muted form__sub" role="status">
                Tasks in progress — Send re-enables when the PLC reports done.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
