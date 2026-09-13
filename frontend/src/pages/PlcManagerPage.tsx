import { useState } from 'react';
import { ConnectionForm } from '../components/ConnectionForm.js';
import { ConnectionList } from '../components/ConnectionList.js';
import { Modal } from '../components/Modal.js';
import { PageTabs, type PageTab } from '../components/PageTabs.js';
import { TagsPanel } from '../components/TagsPanel.js';
import { useLines } from '../hooks/useLines.js';
import { usePlcConnections } from '../hooks/usePlcConnections.js';
import { usePlcTags } from '../hooks/usePlcTags.js';
import type { PlcConnectionConfig } from '../types/plc-config.js';

type Tab = 'connections' | 'new';

/**
 * PLC Manager page — super-admin.
 *
 * Purpose: All OPC UA configuration lives here (no `.env`/code): manage saved
 *   connections (endpoint + security), mark the Active one the app connects to,
 *   and map friendly tag labels → NodeIds per connection. Options live in the top
 *   page-nav bar; content is centered in the workspace below.
 */
export function PlcManagerPage() {
  const {
    connections,
    statuses,
    pendingId,
    loading,
    create,
    update,
    remove,
    activate,
    connect,
    disconnect,
    stop,
    clean,
  } = usePlcConnections();
  const { lines } = useLines();
  const [tab, setTab] = useState<Tab>('connections');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlcConnectionConfig | null>(null);

  const tags = usePlcTags(selectedId);
  const selected = connections.find((c) => c.id === selectedId) ?? null;

  const tabs: PageTab[] = [
    { key: 'connections', label: 'Connections', badge: loading ? undefined : connections.length },
    { key: 'new', label: 'New connection' },
  ];

  function onDelete(c: PlcConnectionConfig) {
    if (!window.confirm(`Delete "${c.name}" and its tag mappings?`)) return;
    if (selectedId === c.id) setSelectedId(null);
    void remove(c.id);
  }

  return (
    <div className="page">
      <PageTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />
      <div className="page-body">
        <div className="page-body__inner">
          {tab === 'new' && (
            <ConnectionForm
              lines={lines}
              onSubmit={async (input) => {
                const ok = await create(input);
                if (ok) setTab('connections');
                return ok;
              }}
              submitLabel="Create connection"
            />
          )}

          {tab === 'connections' && (
            <div className="plc-manager">
              <ConnectionList
                connections={connections}
                lines={lines}
                statuses={statuses}
                pendingId={pendingId}
                loading={loading}
                selectedId={selectedId}
                onSelect={(c) => setSelectedId((prev) => (prev === c.id ? null : c.id))}
                onConnect={(c) => void connect(c.id)}
                onDisconnect={(c) => void disconnect(c.id)}
                onActivate={(c) => void activate(c.id)}
                onStop={(c) => void stop(c.id)}
                onClean={(c) => {
                  if (window.confirm(`Send ${c.name}'s crane(s) home to Parking and clear the recipe?`))
                    void clean(c.id);
                }}
                onEdit={setEditing}
                onDelete={onDelete}
              />
              {selected && (
                <TagsPanel
                  connection={selected}
                  tags={tags.tags}
                  loading={tags.loading}
                  onAdd={tags.add}
                  onRemove={tags.remove}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ConnectionForm
            initial={editing}
            lines={lines}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              const ok = await update(editing.id, input);
              if (ok) setEditing(null);
              return ok;
            }}
          />
        </Modal>
      )}
    </div>
  );
}
