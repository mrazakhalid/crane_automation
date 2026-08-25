import { Send } from 'lucide-react';
import { useState } from 'react';
import { commandSchema } from '../schemas/plc.js';
import { WRITE_DATA_TYPES, type WriteDataType } from '../types/plc.js';
import { Spinner } from './Spinner.js';

/**
 * PLC command (write) form.
 *
 * Purpose: Prove software → PLC. Pick a NodeId + data type and send a value; the
 *   backend writes it over OPC UA and reads it straight back. Boolean writes get
 *   a true/false toggle (coils), other types a numeric input (registers).
 * Args: defaultWriteNode — pre-fill; onSend — performs the write (returns success).
 */
export function PlcCommandForm({
  defaultWriteNode,
  onSend,
}: {
  defaultWriteNode: string;
  onSend: (nodeId: string, dataType: WriteDataType, value: boolean | number) => Promise<boolean>;
}) {
  const [nodeId, setNodeId] = useState(defaultWriteNode);
  const [dataType, setDataType] = useState<WriteDataType>('Boolean');
  const [boolValue, setBoolValue] = useState('true');
  const [numValue, setNumValue] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isBool = dataType === 'Boolean';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = isBool ? boolValue === 'true' : Number(numValue);
    const parsed = commandSchema.safeParse({ nodeId, dataType, value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid command');
      return;
    }
    setError(null);
    setBusy(true);
    await onSend(parsed.data.nodeId, parsed.data.dataType, parsed.data.value);
    setBusy(false);
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <h2 className="form__title">
        <Send size={16} aria-hidden /> Send command <span className="muted">(software → PLC)</span>
      </h2>
      <label className="field">
        <span>Write NodeId</span>
        <input
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          placeholder="ns=1;s=WriteVar"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span>Data type</span>
        <select value={dataType} onChange={(e) => setDataType(e.target.value as WriteDataType)}>
          {WRITE_DATA_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Value</span>
        {isBool ? (
          <select value={boolValue} onChange={(e) => setBoolValue(e.target.value)}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type="number"
            value={numValue}
            onChange={(e) => setNumValue(e.target.value)}
            placeholder="0"
          />
        )}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? <Spinner label="Sending" /> : 'Send to PLC'}
      </button>
    </form>
  );
}
