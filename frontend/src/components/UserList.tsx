import { ROLE_LABELS, type User } from '../types/auth.js';

/**
 * Presentational list of users for one role (managers or operators).
 *
 * Purpose: Render the rows with edit/delete actions, plus skeleton and empty
 *   states. All data/handlers come from the parent (super-admin Users page).
 */
export function UserList({
  users,
  loading,
  emptyLabel,
  onEdit,
  onDelete,
}: {
  users: User[];
  loading: boolean;
  emptyLabel: string;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  return (
    <div className="user-list">
      {loading && [0, 1, 2].map((i) => <div key={i} className="user-row skeleton" aria-hidden />)}

      {!loading && users.length === 0 && <p className="muted empty">{emptyLabel}</p>}

      {!loading &&
        users.map((u) => {
          const protectedRow = u.role === 'super_admin';
          return (
            <div key={u.id} className="user-row">
              <span className={`avatar avatar--${u.role}`} aria-hidden>
                {u.username.charAt(0).toUpperCase()}
              </span>
              <span className="user-row__name">{u.username}</span>
              <span className={`badge badge--${u.role}`}>{ROLE_LABELS[u.role]}</span>
              <span className="user-row__spacer" />
              {protectedRow ? (
                <span className="muted user-row__note">Protected</span>
              ) : (
                <>
                  <button className="btn btn--sm" onClick={() => onEdit(u)}>Edit</button>
                  <button className="btn btn--sm btn--danger" onClick={() => onDelete(u)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}
