import { PlugZap, ShieldCheck, Unplug } from 'lucide-react';
import { useState } from 'react';
import { endpointSchema } from '../schemas/plc.js';
import {
  SECURITY_MODES,
  SECURITY_POLICIES,
  type PlcConnection,
  type PlcConnectionState,
  type SecurityMode,
  type SecurityPolicy,
} from '../types/plc.js';
import { Spinner } from './Spinner.js';

const STATE_LABEL: Record<PlcConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

/**
 * PLC connection panel.
 *
 * Purpose: The one place you point the app at a PLC. Type the endpoint, pick the
 *   security the server expects (None for OpenPLC v4; Sign/SignAndEncrypt +
 *   Basic256Sha256 for a Siemens S7-1500), and Connect. Keeps the app generic:
 *   only these three fields change between PLCs, never the code.
 * Args: connection — live status; defaults — pre-fill endpoint + security; busy —
 *   action in flight; onConnect/onDisconnect — actions.
 */
export function PlcConnectionPanel({
  connection,
  defaultEndpoint,
  defaultSecurityMode,
  defaultSecurityPolicy,
  busy,
  onConnect,
  onDisconnect,
}: {
  connection: PlcConnection;
  defaultEndpoint: string;
  defaultSecurityMode: SecurityMode;
  defaultSecurityPolicy: SecurityPolicy;
  busy: boolean;
  onConnect: (endpoint: string, mode: SecurityMode, policy: SecurityPolicy) => void;
  onDisconnect: () => void;
}) {
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [mode, setMode] = useState<SecurityMode>(defaultSecurityMode);
  const [policy, setPolicy] = useState<SecurityPolicy>(defaultSecurityPolicy);
  const [error, setError] = useState<string | null>(null);
  const connected = connection.state === 'connected';
  const secured = mode !== 'None';

  /** None mode has no cipher; a secured mode needs a real policy. Keep them consistent. */
  function changeMode(next: SecurityMode) {
    setMode(next);
    if (next === 'None') setPolicy('None');
    else if (policy === 'None') setPolicy('Basic256Sha256');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = endpointSchema.safeParse(endpoint);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid endpoint');
      return;
    }
    setError(null);
    onConnect(parsed.data, mode, secured ? policy : 'None');
  }

  return (
    <form className="card plc-connect" onSubmit={submit} noValidate>
      <div className="plc-connect__head">
        <span className="plc-section__label">Connection</span>
        <span className="plc-status">
          <span className={`plc-status__dot plc-status__dot--${connection.state}`} aria-hidden />
          <strong>{STATE_LABEL[connection.state]}</strong>
          {connected && connection.security && (
            <span className="plc-chip">{connection.security}</span>
          )}
        </span>
      </div>
      {connection.endpoint && connected && (
        <p className="plc-connect__endpoint muted">{connection.endpoint}</p>
      )}
      {connection.lastError && (
        <p className="form-error" role="alert">{connection.lastError}</p>
      )}

      <label className="field">
        <span>Endpoint</span>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="opc.tcp://host:4840"
          autoComplete="off"
          disabled={connected || busy}
          spellCheck={false}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Security</span>
          <select
            value={mode}
            onChange={(e) => changeMode(e.target.value as SecurityMode)}
            disabled={connected || busy}
          >
            {SECURITY_MODES.map((m) => (
              <option key={m} value={m}>{m === 'None' ? 'None (plain)' : m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Policy</span>
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value as SecurityPolicy)}
            disabled={!secured || connected || busy}
          >
            {SECURITY_POLICIES.filter((p) => (secured ? p !== 'None' : p === 'None')).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      {secured && !connected && (
        <p className="plc-hint">
          <ShieldCheck size={14} aria-hidden />
          The PLC must trust our client certificate first — move it from the PLC's rejected to
          trusted store, and check the PLC clock.
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      {connected ? (
        <button className="btn btn--danger" type="button" onClick={onDisconnect} disabled={busy}>
          {busy ? <Spinner label="Working" /> : (<><Unplug size={16} aria-hidden /> Disconnect</>)}
        </button>
      ) : (
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? <Spinner label="Connecting" /> : (<><PlugZap size={16} aria-hidden /> Connect</>)}
        </button>
      )}
    </form>
  );
}
