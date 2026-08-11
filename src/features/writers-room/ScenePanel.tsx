import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { listSnapshots, restoreSnapshot, snapshotScene, updateSceneMeta } from '@/db/repos/scenes';
import type { Scene, ScenePovType, SceneStatus } from '@/db/types';
import { STATUS_META } from './SceneStrip';
import { toast } from '@/stores/toasts';

const STATUSES: SceneStatus[] = ['outline', 'draft', 'revised', 'final'];

const POV_TYPES: { value: ScenePovType; label: string }[] = [
  { value: 'third-limited', label: 'Third limited' },
  { value: 'third-omniscient', label: 'Third omniscient' },
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
];

/** Everything about a scene that is not its prose.
 *
 * These fields exist to be read by other surfaces: status is the Board's
 * columns, POV is a Matrix axis and the POV-balance chart, the summary is
 * what `storySoFar()` will send instead of the whole manuscript, and
 * `aiVisible` is how you keep a scene out of every AI call. Filling them
 * in is optional everywhere — a blank scene still writes. */
export function ScenePanel({
  scene,
  onClose,
  onProseReplaced,
}: {
  scene: Scene;
  onClose: () => void;
  /** Tell the editor its document has been replaced from underneath it.
   * Without this the editor keeps the version on screen and writes it
   * straight back on the next keystroke, undoing the restore. */
  onProseReplaced: () => void;
}) {
  const cast = useLiveQuery(
    async () =>
      (await db.entities.where('[projectId+type]').equals([scene.projectId, 'cast']).toArray())
        .filter((e) => e.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scene.projectId],
    []
  );
  const locations = useLiveQuery(
    async () =>
      (await db.entities.where('[projectId+type]').equals([scene.projectId, 'locations']).toArray())
        .filter((e) => e.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scene.projectId],
    []
  );
  const snapshots = useLiveQuery(async () => listSnapshots(scene.id), [scene.id], []);

  // Edit a local copy, not the row.
  //
  // These are controlled inputs fed by a live query, so writing straight
  // to Dexie meant every keystroke rendered the OLD value back into the
  // field until the query caught up — characters dropped in the summary,
  // and the AI-visibility checkbox appeared not to toggle at all. The
  // draft is authoritative while the panel is open; it re-syncs only when
  // the panel is pointed at a different scene.
  const [draft, setDraft] = useState<Scene>(scene);
  useEffect(() => {
    setDraft(scene);
    // Deliberately keyed on the scene ID alone: re-syncing on every change
    // to the row would clobber what is being typed, because autosave
    // updates the same row's word count while you type.

  }, [scene.id]);

  const patch = (next: Partial<Scene>) => {
    setDraft((current) => ({ ...current, ...next }));
    void updateSceneMeta(scene.id, next);
  };

  return (
    <aside className="lw-scenepanel" aria-label="Scene details" data-testid="scene-panel">
      <div className="lw-scenepanel__head">
        <strong>Scene details</strong>
        <button type="button" className="lw-iconbtn" aria-label="Close scene details" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="lw-field lw-field--full">
        <label htmlFor="scene-summary">Summary</label>
        <textarea
          id="scene-summary"
          className="lw-input lw-input--area"
          rows={3}
          placeholder="What happens, in a sentence or two."
          value={draft.summary}
          onChange={(e) => patch({ summary: e.target.value, summaryUpdatedAt: Date.now() })}
        />
        <p className="lw-fieldnote">
          The unit long-book memory is built from — summaries travel to the AI instead of the
          whole manuscript.
        </p>
      </div>

      <div className="lw-field lw-field--full">
        <span className="lw-tweak__label">Status</span>
        <div className="lw-tweak__options">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={status === draft.status ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={status === draft.status}
              onClick={() => patch({ status })}
            >
              <span aria-hidden>{STATUS_META[status].glyph}</span> {STATUS_META[status].label}
            </button>
          ))}
        </div>
      </div>

      <div className="lw-field">
        <label htmlFor="scene-pov">POV character</label>
        <select
          id="scene-pov"
          className="lw-input"
          value={draft.pov ?? ''}
          onChange={(e) => patch({ pov: e.target.value || null })}
        >
          <option value="">—</option>
          {cast.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      </div>

      <div className="lw-field">
        <label htmlFor="scene-povtype">POV mode</label>
        <select
          id="scene-povtype"
          className="lw-input"
          value={draft.povType ?? ''}
          onChange={(e) => patch({ povType: (e.target.value || null) as ScenePovType | null })}
        >
          <option value="">—</option>
          {POV_TYPES.map((pov) => (
            <option key={pov.value} value={pov.value}>
              {pov.label}
            </option>
          ))}
        </select>
      </div>

      <div className="lw-field">
        <label htmlFor="scene-location">Location</label>
        <select
          id="scene-location"
          className="lw-input"
          value={draft.locationId ?? ''}
          onChange={(e) => patch({ locationId: e.target.value || null })}
        >
          <option value="">—</option>
          {locations.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      </div>

      <div className="lw-field">
        <label htmlFor="scene-target">Word target</label>
        <input
          id="scene-target"
          className="lw-input"
          type="number"
          min={0}
          step={50}
          value={draft.targetWords ?? ''}
          onChange={(e) => patch({ targetWords: e.target.value ? Number(e.target.value) : null })}
        />
      </div>

      <div className="lw-field lw-field--full">
        <label className="lw-toggle">
          <input
            type="checkbox"
            checked={draft.aiVisible}
            onChange={(e) => patch({ aiVisible: e.target.checked })}
          />
          <span>Let AI read this scene</span>
        </label>
        <p className="lw-fieldnote">
          Turn off to keep a scene out of every AI prompt — notes to self, alternate takes,
          anything you would not want written back at you.
        </p>
      </div>

      <div className="lw-field lw-field--full">
        <div className="lw-scenepanel__historyhead">
          <span className="lw-tweak__label">History</span>
          <button
            type="button"
            className="lw-btn lw-btn--sm"
            onClick={() => {
              void snapshotScene(scene.id, 'manual').then(() => toast('Save point taken.'));
            }}
          >
            Save point
          </button>
        </div>
        {snapshots.length === 0 ? (
          <p className="lw-fieldnote">
            Loomwright takes one automatically every few minutes as you write, and always
            before AI writes into a scene.
          </p>
        ) : (
          <ul className="lw-snapshots">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="lw-snapshot">
                <span className="lw-snapshot__label">{snapshot.label}</span>
                <span className="lw-snapshot__meta">
                  {new Date(snapshot.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {snapshot.wordCount.toLocaleString()}w
                </span>
                <button
                  type="button"
                  className="lw-btn lw-btn--sm"
                  onClick={() => {
                    void restoreSnapshot(snapshot.id).then(() => {
                      onProseReplaced();
                      toast('Restored. The version you had is itself a save point now.');
                    });
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
