import { Copy, QrCode, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Spinner } from './Spinner.js';
import { useToast } from '../hooks/useToast.js';
import { decodeQrFromFile } from '../utils/qr.js';

/**
 * QR image decoder (Manager dashboard tool).
 *
 * Purpose: Attach a QR-code image; it's decoded entirely in the browser and its
 *   contents are shown in an editable textarea (copyable). No upload leaves the
 *   device.
 */
export function QrScanner() {
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setText('');
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const decoded = await decodeQrFromFile(file);
      setText(decoded);
      notify('QR decoded', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not decode the image';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setText('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied', 'success');
    } catch {
      notify('Copy failed', 'error');
    }
  }

  return (
    <section className="card qr">
      <h2 className="form__title">
        <QrCode size={20} aria-hidden /> Scan a QR image
      </h2>
      <p className="muted form__sub">Attach a QR-code image — its contents appear below.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="QR image file"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="qr__actions">
        <button
          type="button"
          className="btn"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Spinner label="Decoding" />
          ) : (
            <>
              <Upload size={16} aria-hidden /> Attach image
            </>
          )}
        </button>
        {(text || preview) && (
          <button type="button" className="btn btn--sm" onClick={clear}>
            <X size={16} aria-hidden /> Clear
          </button>
        )}
      </div>

      {preview && <img src={preview} alt="Attached QR preview" className="qr__preview" />}
      {error && <p className="form-error" role="alert">{error}</p>}

      <label className="field qr__output">
        <span>Decoded data</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Decoded QR text will appear here"
          rows={4}
        />
      </label>
      {text && (
        <button type="button" className="btn btn--sm" onClick={copy}>
          <Copy size={16} aria-hidden /> Copy
        </button>
      )}
    </section>
  );
}
