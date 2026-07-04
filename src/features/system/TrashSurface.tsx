import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listTrash, purgeFromTrash, restoreFromTrash } from '@/db/repos/trash';
import type { TrashRow } from '@/db/types';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

export function TrashSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const rows = useLiveQuery(
    async () => (projectId ? listTrash(projectId) : []),
    [projectId],
    [] as TrashRow[]
  );
  const [confirmingPurge, setConfirmingPurge] = useState<string | null>(null);

  return (
    <div className="lw-page" data-testid="surface-trash">
      <div>
        <h1 className="lw-page__title">Trash</h1>
        <p className="lw-page__subtitle">
          Deleted things wait here until you restore them or delete them forever.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="lw-card lw-empty lw-empty--center">
          <p className="lw-empty__title">The trash is empty.</p>
        </div>
      ) : (
        <ul className="lw-trashlist">
          {rows.map((row) => (
            <li key={row.id} className="lw-card lw-trashrow">
              <div className="lw-trashrow__text">
                <span className="lw-trashrow__label">{row.label}</span>
                <span className="lw-trashrow__meta">
                  {row.table === 'entities' ? 'Entity' : row.table} · deleted{' '}
                  {new Date(row.deletedAt).toLocaleString()}
                </span>
              </div>
              <div className="lw-trashrow__actions">
                <button
                  type="button"
                  className="lw-btn"
                  onClick={async () => {
                    await restoreFromTrash(row.id);
                    toast(`${row.label} restored.`, { kind: 'success' });
                  }}
                >
                  Restore
                </button>
                {confirmingPurge === row.id ? (
                  <span className="lw-confirm">
                    <button
                      type="button"
                      className="lw-btn lw-btn--danger"
                      onClick={async () => {
                        await purgeFromTrash(row.id);
                        setConfirmingPurge(null);
                        toast(`${row.label} deleted forever.`);
                      }}
                    >
                      Delete forever
                    </button>
                    <button type="button" className="lw-btn" onClick={() => setConfirmingPurge(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="lw-btn"
                    onClick={() => setConfirmingPurge(row.id)}
                  >
                    Delete forever…
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
