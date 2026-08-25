import { useState } from 'react';
import { CreateLinePanel } from '../components/CreateLinePanel.js';
import { EditLineDialog } from '../components/EditLineDialog.js';
import { LineList } from '../components/LineList.js';
import { PageTabs, type PageTab } from '../components/PageTabs.js';
import { useLines } from '../hooks/useLines.js';
import type { Line } from '../types/line.js';

type Tab = 'lines' | 'create';

/**
 * Lines page — super-admin management.
 *
 * Purpose: Options (Lines / Add line) live in the top page-nav bar; the active
 *   section fills the workspace below. Super-admins build/save custom lines,
 *   edit or delete existing ones. Managers consume these lines when scanning QRs.
 */
export function LinesPage() {
  const { lines, loading, create, update, remove } = useLines();
  const [tab, setTab] = useState<Tab>('lines');
  const [editing, setEditing] = useState<Line | null>(null);

  const tabs: PageTab[] = [
    { key: 'lines', label: 'Lines', badge: loading ? undefined : lines.length },
    { key: 'create', label: 'Add line' },
  ];

  function onDelete(line: Line) {
    if (window.confirm(`Delete line "${line.name}"? This cannot be undone.`)) void remove(line.id);
  }

  return (
    <div className="page">
      <PageTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />
      <div className="page-body">
        <div className="page-body__inner page-body__inner--wide">
          {tab === 'lines' && (
            <LineList
              lines={lines}
              loading={loading}
              emptyLabel="No lines yet — add one from the Add line tab."
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}
          {tab === 'create' && <CreateLinePanel onCreate={create} />}
        </div>
      </div>

      {editing && (
        <EditLineDialog
          line={editing}
          onSave={(patch) => update(editing.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
