import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getProject } from '@/db/repos/projects';
import { listAudit } from '@/db/repos/audit';
import { undoAuditEntry } from '@/db/repos/undo';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

export function HomePage() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);

  const project = useLiveQuery(
    async () => (projectId ? getProject(projectId) : undefined),
    [projectId]
  );
  const castCount = useLiveQuery(
    async () =>
      projectId ? db.entities.where('[projectId+type]').equals([projectId, 'cast']).count() : 0,
    [projectId],
    0
  );
  const recent = useLiveQuery(
    async () => (projectId ? listAudit(projectId, 8) : []),
    [projectId],
    []
  );

  if (!project) return null;

  return (
    <div className="lw-page">
      <div>
        <h1 className="lw-page__title">{project.name}</h1>
        <p className="lw-page__subtitle">
          Local-first writing &amp; worldbuilding. Shape the book. Track the world.
        </p>
      </div>

      <div className="lw-statrow">
        <button
          type="button"
          className="lw-card lw-stattile"
          onClick={() => {
            setCodexType('cast');
            setRoute('codex');
          }}
        >
          <span className="lw-stattile__value">{castCount}</span>
          <span className="lw-stattile__label">Cast members</span>
        </button>
      </div>

      <div className="lw-card">
        <h2 className="lw-card__title">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="lw-empty__note">
            Nothing yet. Create your first character in the Cast panel — everything you do shows
            up here with one-click undo.
          </p>
        ) : (
          <ul className="lw-activity">
            {recent.map((entry) => (
              <li key={entry.id} className="lw-activity__row">
                <span className="lw-activity__text">
                  {describeAction(entry.action)} <strong>{entry.target.label ?? entry.target.id}</strong>
                </span>
                <span className="lw-activity__time">
                  {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {entry.reversible && (
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={async () => {
                      const ok = await undoAuditEntry(entry.id);
                      toast(ok ? 'Undone.' : 'Nothing to undo.', { kind: ok ? 'success' : 'info' });
                    }}
                  >
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lw-card">
        <h2 className="lw-card__title">The rebuild is under way</h2>
        <p style={{ marginBottom: 0 }}>
          Surfaces appear in the sidebar as they become genuinely usable — nothing here is a
          mock-up. Next up: the Writer&apos;s Room and entity extraction.
        </p>
      </div>
    </div>
  );
}

function describeAction(action: string): string {
  switch (action) {
    case 'entity.create':
      return 'Created';
    case 'entity.update':
      return 'Updated';
    case 'entity.delete':
      return 'Deleted';
    case 'entity.restore':
      return 'Restored';
    case 'trash.purge':
      return 'Purged';
    default:
      return action;
  }
}
