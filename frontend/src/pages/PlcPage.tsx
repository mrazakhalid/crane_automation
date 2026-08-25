import { PlcCommandForm } from '../components/PlcCommandForm.js';
import { PlcConnectionPanel } from '../components/PlcConnectionPanel.js';
import { PlcWatchTable } from '../components/PlcWatchTable.js';
import { Spinner } from '../components/Spinner.js';
import { usePlc } from '../hooks/usePlc.js';

/**
 * PLC (OPC UA) page — connect to a PLC and prove two-way communication.
 *
 * Purpose: The proof-of-concept workspace. Connect to any OPC UA endpoint (OpenPLC
 *   v4's native server today, the physical Siemens S7-1500 later — only the endpoint
 *   + NodeIds change, never the code), watch a value stream in (PLC → software) and
 *   send a command (software → PLC).
 */
export function PlcPage() {
  const { state, connected, watch, readings, addWatch, removeWatch, busy, connect, disconnect, write } =
    usePlc();

  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner page-body__inner--wide">
          <p className="eyebrow">Workspace</p>
          <h1 className="page-title">PLC communication</h1>
          <p className="muted">
            One OPC UA link that works with any PLC. Set the endpoint and security once — OpenPLC
            v4 now, a Siemens S7-1500 later — and the rest of the app never changes.
          </p>

          {!state ? (
            <div className="card qr-loading">
              <Spinner size={24} label="Loading PLC status" />
            </div>
          ) : (
            <div className="plc-layout">
              <PlcConnectionPanel
                connection={state.connection}
                defaultEndpoint={state.defaults.endpoint}
                defaultSecurityMode={state.defaults.securityMode}
                defaultSecurityPolicy={state.defaults.securityPolicy}
                busy={busy}
                onConnect={connect}
                onDisconnect={disconnect}
              />
              {connected ? (
                <div className="plc-io">
                  <PlcWatchTable
                    watch={watch}
                    readings={readings}
                    onAdd={addWatch}
                    onRemove={removeWatch}
                  />
                  <PlcCommandForm defaultWriteNode={state.defaults.writeNode} onSend={write} />
                </div>
              ) : (
                <p className="plc-empty muted">Connect to a PLC to read live values and send commands.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
