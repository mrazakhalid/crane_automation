import { useState } from 'react';
import { CreateUserForm } from '../components/CreateUserForm.js';
import { EditUserDialog } from '../components/EditUserDialog.js';
import { PageTabs, type PageTab } from '../components/PageTabs.js';
import { UserList } from '../components/UserList.js';
import { useUsers } from '../hooks/useUsers.js';
import type { User } from '../types/auth.js';

type Tab = 'create' | 'managers' | 'operators' | 'super_admins';

/**
 * Users page — super-admin management.
 *
 * Purpose: Options (Create / Managers / Operators / Super Admins) live in the
 *   top page-nav bar; the active section's content is centered in the free
 *   workspace below. Managers/operators are editable; super-admins are shown
 *   read-only (the backend protects them — no IDOR).
 */
export function UsersPage() {
  const { users, loading, create, update, remove } = useUsers();
  const [tab, setTab] = useState<Tab>('create');
  const [editing, setEditing] = useState<User | null>(null);

  const managers = users.filter((u) => u.role === 'manager');
  const operators = users.filter((u) => u.role === 'operator');
  const superAdmins = users.filter((u) => u.role === 'super_admin');

  const tabs: PageTab[] = [
    { key: 'create', label: 'Create user' },
    { key: 'managers', label: 'Managers', badge: loading ? undefined : managers.length },
    { key: 'operators', label: 'Operators', badge: loading ? undefined : operators.length },
    { key: 'super_admins', label: 'Super Admins', badge: loading ? undefined : superAdmins.length },
  ];

  function onDelete(user: User) {
    if (window.confirm(`Remove ${user.username}?`)) void remove(user.id);
  }

  return (
    <div className="page">
      <PageTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />
      <div className="page-body">
        <div className="page-body__inner">
          {tab === 'create' && <CreateUserForm onCreate={create} />}

          {tab === 'managers' && (
            <UserList
              users={managers}
              loading={loading}
              emptyLabel="No managers yet — add one from the Create user tab."
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}

          {tab === 'operators' && (
            <UserList
              users={operators}
              loading={loading}
              emptyLabel="No operators yet — add one from the Create user tab."
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}

          {tab === 'super_admins' && (
            <UserList
              users={superAdmins}
              loading={loading}
              emptyLabel="No super-admins found."
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>

      {editing && (
        <EditUserDialog
          user={editing}
          onSave={(patch) => update(editing.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
