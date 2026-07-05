import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getProject } from '@/db/repos/projects';
import { listAudit } from '@/db/repos/audit';
import { countPendingCandidates } from '@/db/repos/review';
import { undoAuditEntry } from '@/db/repos/undo';
import { ensureWordsBaseline, todayKey } from '@/services/insights';
import { useInstallPrompt } from '@/features/shell/useInstallPrompt';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

export function HomePage() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const installPrompt = useInstallPrompt();

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
  const entityCount = useLiveQuery(
    async () => (projectId ? db.entities.where('projectId').equals(projectId).count() : 0),
    [projectId],
    0
  );
  const chapterStats = useLiveQuery(
    async () => {
      if (!projectId) return { chapters: 0, words: 0 };
      const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
      return { chapters: chapters.length, words: chapters.reduce((s, c) => s + c.wordCount, 0) };
    },
    [projectId],
    null
  );
  useEffect(() => {
    if (projectId && chapterStats) void ensureWordsBaseline(projectId, chapterStats.words);
  }, [projectId, chapterStats]);
  const wordsToday = useLiveQuery(
    async () => {
      if (!projectId || !chapterStats) return 0;
      const row = await db.uiState.get(`${projectId}:wordsBaseline`);
      const baseline = row?.value as { date: string; words: number } | undefined;
      if (!baseline || baseline.date !== todayKey()) return 0;
      return Math.max(0, chapterStats.words - baseline.words);
    },
    [projectId, chapterStats],
    0
  );
  const pendingReview = useLiveQuery(
    async () => (projectId ? countPendingCandidates(projectId) : 0),
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
        <button
          type="button"
          className="lw-card lw-stattile"
          onClick={() => {
            setCodexType('cast');
            setRoute('codex');
          }}
        >
          <span className="lw-stattile__value">{entityCount}</span>
          <span className="lw-stattile__label">Codex entries</span>
        </button>
        <button
          type="button"
          className="lw-card lw-stattile"
          onClick={() => setRoute('writers-room')}
        >
          <span className="lw-stattile__value">{chapterStats?.chapters ?? 0}</span>
          <span className="lw-stattile__label">Chapters</span>
        </button>
        <button
          type="button"
          className="lw-card lw-stattile"
          onClick={() => setRoute('writers-room')}
        >
          <span className="lw-stattile__value">{(chapterStats?.words ?? 0).toLocaleString()}</span>
          <span className="lw-stattile__label">Total words</span>
        </button>
        <button type="button" className="lw-card lw-stattile" onClick={() => setRoute('today')}>
          <span className="lw-stattile__value">{wordsToday.toLocaleString()}</span>
          <span className="lw-stattile__label">Words today</span>
        </button>
        <button type="button" className="lw-card lw-stattile" onClick={() => setRoute('review')}>
          <span className="lw-stattile__value">{pendingReview}</span>
          <span className="lw-stattile__label">Awaiting review</span>
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

      {installPrompt.available && (
        <div className="lw-card">
          <h2 className="lw-card__title">Install Loomwright</h2>
          <p>
            Put it on your home screen — it works fully offline, and your projects stay on
            this device.
          </p>
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            onClick={() => void installPrompt.install()}
          >
            Install app
          </button>
        </div>
      )}

      <div className="lw-card">
        <h2 className="lw-card__title">Find anything, fast</h2>
        <p style={{ marginBottom: 0 }}>
          Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (or the ⌕ button up top) to search every entity,
          chapter, and command. The <strong>Today</strong> page suggests what to work on next.
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
