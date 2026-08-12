import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { listSnapshots, restoreSnapshot, snapshotScene, updateSceneMeta } from '@/db/repos/scenes';
import type { Scene, ScenePovType, SceneStatus } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { createProgression, deleteProgression } from '@/db/repos/progressions';
import { entitySpec, generableFields } from '@/services/generate/spec';
import { isSummaryStale, summarizeScene } from '@/services/context/summarize';
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
  focusProgressions = 0,
}: {
  scene: Scene;
  onClose: () => void;
  /** Bumped by `/progress` in the editor. A token rather than a boolean so
   * typing the slash again re-focuses a panel that never closed. */
  focusProgressions?: number;
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
  /** Anything worth forcing into a prompt. Deliberately broader than the
   * POV and location pickers above: the point of an attachment is the
   * faction, quest or object the prose has not named yet. */
  const attachable = useLiveQuery(
    async () =>
      (await db.entities.where('projectId').equals(scene.projectId).toArray())
        .filter((e) => e.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 200),
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

  const [summarizing, setSummarizing] = useState(false);

  /** Everything anchored at this scene, whoever wrote it. Extraction's rows
   * sit in the same list as the author's — a fact found and a fact stated
   * are the same claim about the story, and both are removable here. */
  const progressions = useLiveQuery(
    async () =>
      (await db.progressions.where('projectId').equals(scene.projectId).toArray())
        .filter((row) => row.sceneId === scene.id)
        .sort((a, b) => a.createdAt - b.createdAt),
    [scene.projectId, scene.id],
    []
  );
  const nameOf = (entityId: string) =>
    attachable.find((entity) => entity.id === entityId)?.name ?? 'Removed entry';

  const [progEntity, setProgEntity] = useState('');
  const [progField, setProgField] = useState('');
  const [progText, setProgText] = useState('');
  const progType = attachable.find((entity) => entity.id === progEntity)?.type;
  // The same field list the drawer and the context assembler use, so the
  // three cannot disagree about which fields exist.
  const progSpec = progType ? entitySpec(progType) : null;
  const progFields = progSpec ? generableFields(progSpec) : [];

  const progEntityRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (focusProgressions > 0) progEntityRef.current?.focus();
  }, [focusProgressions]);

  const addProgression = () => {
    const text = progText.trim();
    if (!progEntity || !text) return;
    void createProgression({
      projectId: scene.projectId,
      entityId: progEntity,
      sceneId: scene.id,
      text,
      mode: progField ? 'replacement' : 'addition',
      fieldId: progField || null,
      source: 'manual',
    });
    setProgText('');
  };

  const [labelDraft, setLabelDraft] = useState('');
  const addLabel = () => {
    const label = labelDraft.trim();
    if (!label || draft.labels.includes(label)) {
      setLabelDraft('');
      return;
    }
    patch({ labels: [...draft.labels, label] });
    setLabelDraft('');
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
        <div className="lw-scenepanel__historyhead">
          <label htmlFor="scene-summary">Summary</label>
          <button
            type="button"
            className="lw-btn lw-btn--sm"
            disabled={summarizing || draft.wordCount === 0}
            onClick={() => {
              setSummarizing(true);
              void summarizeScene(scene.projectId, scene)
                .then((result) => {
                  if (!result.text) {
                    toast('There is not enough prose here to summarise yet.', { kind: 'error' });
                    return;
                  }
                  patch({ summary: result.text });
                  toast(
                    result.truncated
                      ? 'Summarised, but the model stopped early — check the end.'
                      : result.source === 'ai'
                        ? 'Summarised with your model.'
                        : 'Summarised from the scene’s own sentences.'
                  );
                })
                .finally(() => setSummarizing(false));
            }}
          >
            {summarizing ? 'Summarising…' : 'Summarise'}
          </button>
        </div>
        <textarea
          id="scene-summary"
          className="lw-input lw-input--area"
          rows={3}
          placeholder="What happens, in a sentence or two."
          value={draft.summary}
          onChange={(e) => patch({ summary: e.target.value })}
        />
        {/* A chip, never a toast: staleness is a state of the scene, not an
            event, so it belongs beside the thing that is stale. */}
        {isSummaryStale({ ...scene, summary: draft.summary }) ? (
          <p className="lw-stale" data-testid="summary-stale">
            <span aria-hidden>◑</span> The prose changed after this summary was written.
          </p>
        ) : null}
        <p className="lw-fieldnote">
          The unit long-book memory is built from — summaries travel to the AI instead of the
          whole manuscript. Summarising works with no API key: it takes the scene’s own
          strongest sentences.
        </p>
      </div>

      <div className="lw-field lw-field--full">
        <span className="lw-tweak__label" id="scene-progressions">
          What changed here
        </span>
        <p className="lw-fieldnote">
          Facts that become true at this point in the book. Every earlier scene is written
          without them, so drafting chapter two can’t leak chapter forty.
        </p>
        {progressions.length ? (
          <ul className="lw-progressions" aria-labelledby="scene-progressions">
            {progressions.map((row) => (
              <li key={row.id} className="lw-progression" data-source={row.source}>
                <span className="lw-progression__who">{nameOf(row.entityId)}</span>
                <span className="lw-progression__text">{row.text}</span>
                {row.source === 'extracted' ? (
                  <span className="lw-progression__badge">found</span>
                ) : null}
                <button
                  type="button"
                  className="lw-chip__x"
                  aria-label={`Remove progression ${row.text}`}
                  onClick={() => void deleteProgression(row.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lw-empty__note">Nothing yet.</p>
        )}

        <div className="lw-field">
          <label htmlFor="prog-entity">Who or what</label>
          <select
            id="prog-entity"
            ref={progEntityRef}
            className="lw-input"
            value={progEntity}
            onChange={(e) => {
              setProgEntity(e.target.value);
              setProgField('');
            }}
          >
            <option value="">Choose an entry…</option>
            {attachable.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {ENTITY_TYPE_META[entity.type].label} · {entity.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lw-field">
          <label htmlFor="prog-field">Replaces</label>
          <select
            id="prog-field"
            className="lw-input"
            value={progField}
            disabled={!progFields.length}
            onChange={(e) => setProgField(e.target.value)}
          >
            <option value="">Nothing — this is an addition</option>
            {progFields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lw-chips__add">
          <input
            className="lw-input"
            aria-label="What became true"
            placeholder="Vex is carrying the ash-blade."
            value={progText}
            onChange={(e) => setProgText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              addProgression();
            }}
          />
          <button
            type="button"
            className="lw-btn lw-btn--sm"
            disabled={!progEntity || !progText.trim()}
            onClick={addProgression}
          >
            Anchor here
          </button>
        </div>
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
        <span className="lw-tweak__label" id="scene-labels">
          Labels
        </span>
        <div className="lw-chips" aria-labelledby="scene-labels">
          {draft.labels.length ? (
            <div className="lw-chips__row">
              {draft.labels.map((label) => (
                <span key={label} className="lw-chip">
                  {label}
                  <button
                    type="button"
                    className="lw-chip__x"
                    aria-label={`Remove label ${label}`}
                    onClick={() => patch({ labels: draft.labels.filter((l) => l !== label) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="lw-chips__add">
            <input
              className="lw-input"
              aria-label="Add a label"
              placeholder="setup, night, flashback…"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addLabel();
              }}
            />
            <button
              type="button"
              className="lw-btn lw-btn--sm"
              disabled={!labelDraft.trim()}
              onClick={addLabel}
            >
              Add
            </button>
          </div>
        </div>
        <p className="lw-fieldnote">
          Your own words for what a scene is. They colour the Board cards and can be a Matrix
          axis.
        </p>
      </div>

      <div className="lw-field lw-field--full">
        <label htmlFor="scene-attach">Always in this scene&rsquo;s AI context</label>
        <div className="lw-chips">
          {draft.attachedRefs.length ? (
            <div className="lw-chips__row">
              {draft.attachedRefs.map((ref) => (
                <span key={ref.id} className="lw-chip">
                  <span aria-hidden>{ENTITY_TYPE_META[ref.type].glyph}</span> {ref.name}
                  <button
                    type="button"
                    className="lw-chip__x"
                    aria-label={`Remove ${ref.name} from this scene`}
                    onClick={() =>
                      patch({ attachedRefs: draft.attachedRefs.filter((r) => r.id !== ref.id) })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <select
            id="scene-attach"
            className="lw-input"
            value=""
            onChange={(e) => {
              const entity = attachable.find((c) => c.id === e.target.value);
              if (!entity) return;
              patch({
                attachedRefs: [
                  ...draft.attachedRefs,
                  { id: entity.id, type: entity.type, name: entity.name },
                ],
              });
            }}
          >
            <option value="">Add an entry…</option>
            {attachable
              .filter((entity) => !draft.attachedRefs.some((r) => r.id === entity.id))
              .map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {ENTITY_TYPE_META[entity.type].label} · {entity.name}
                </option>
              ))}
          </select>
        </div>
        <p className="lw-fieldnote">
          Forced into every prompt this scene sends, whether or not it is named in the prose —
          the thing the model would otherwise have no way to know is relevant here.
        </p>
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
