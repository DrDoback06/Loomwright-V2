import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { ENTITY_TYPE_META, type EntityRef } from '@/domain/entity-types';
import { complete } from '@/services/ai/providers';
import { getAiSettings, resolveProvider, saveAiSettings } from '@/services/ai/settings';
import { useFocusStore } from '@/stores/focus';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

const MODES = ['scene', 'chapter opening', 'dialogue', 'description', 'transition'] as const;
const POVS = ['third limited', 'third omniscient', 'first person', 'second person'] as const;
const LENGTHS = ['a few paragraphs', 'half a chapter', 'a full chapter'] as const;

interface ComposePanelProps {
  /** Insert the planning brief (renders as a blockquote note). */
  onInsert: (briefText: string) => void;
  /** Insert generated prose as real manuscript paragraphs. */
  onInsertProse: (prose: string) => void;
  onClose: () => void;
}

/** The composition overlay: gathers the entities currently in context
 * (focus per type + lock) into a structured writing brief. Offline it
 * inserts the brief into the chapter or copies it for an external AI;
 * M7 adds in-app generation on top of the same brief. */
export function ComposePanel({ onInsert, onInsertProse, onClose }: ComposePanelProps) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const focusedByType = useFocusStore((s) => s.focusedByType);
  const lock = useFocusStore((s) => s.lock);

  const [mode, setMode] = useState<(typeof MODES)[number]>('scene');
  const [pov, setPov] = useState<(typeof POVS)[number]>('third limited');
  const [length, setLength] = useState<(typeof LENGTHS)[number]>('a few paragraphs');
  const [instruction, setInstruction] = useState('');
  const [dropped, setDropped] = useState<EntityRef[]>([]);
  const [aiReady, setAiReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);

  const contextRefs: EntityRef[] = (() => {
    const map = new Map<string, EntityRef>();
    if (lock) map.set(lock.id, lock);
    for (const ref of Object.values(focusedByType)) if (ref) map.set(ref.id, ref);
    for (const ref of dropped) map.set(ref.id, ref);
    return [...map.values()];
  })();

  const details = useLiveQuery(
    async () => {
      const rows = await Promise.all(contextRefs.map((r) => db.entities.get(r.id)));
      return rows.filter((r) => r !== undefined);
    },
    [contextRefs.map((r) => r.id).join(',')],
    []
  );

  const removable = (id: string) => dropped.some((d) => d.id === id);

  const buildBrief = (): string => {
    const lines: string[] = [];
    lines.push(`Write ${mode === 'scene' ? 'a scene' : mode} — ${pov}, ${length}.`);
    for (const e of details) {
      const meta = ENTITY_TYPE_META[e.type];
      const bits = [e.summary].filter(Boolean);
      const voice = typeof e.fields.speechStyle === 'string' ? e.fields.speechStyle : '';
      const persona = typeof e.fields.personality === 'string' ? e.fields.personality : '';
      if (persona) bits.push(`personality: ${persona}`);
      if (voice) bits.push(`voice: ${voice.split('\n')[0]}`);
      lines.push(`• ${meta.label}: ${e.name}${bits.length ? ` — ${bits.join('; ')}` : ''}`);
    }
    if (instruction.trim()) lines.push(`Direction: ${instruction.trim()}`);
    lines.push('Stay consistent with the codex; do not contradict established canon.');
    return lines.join('\n');
  };

  const runGenerate = async () => {
    if (!projectId) return;
    const config = await resolveProvider(projectId);
    if (!config) {
      toast('Configure an AI provider in Settings first.', { kind: 'error' });
      return;
    }
    setGenerating(true);
    try {
      const text = await complete(config, {
        system:
          'You are a fiction co-writer. Write polished prose following the brief exactly. Return only the prose — no preamble, no notes.',
        prompt: buildBrief(),
        maxTokens: 1800,
      });
      setDraft(text.trim());
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Generation failed.', { kind: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  if (!projectId) return null;

  return (
    <aside className="lw-compose" data-testid="compose-panel" aria-label="Composition">
      <header className="lw-compose__head">
        <h2 className="lw-compose__title">Compose</h2>
        <button type="button" className="lw-iconbtn" aria-label="Close composition" onClick={onClose}>
          ×
        </button>
      </header>

      <p className="lw-fieldnote">
        Builds a writing brief from the entities in context. Select entities in any panel to
        add them.
      </p>

      <div className="lw-compose__refs">
        {contextRefs.length === 0 ? (
          <p className="lw-empty__note">Nothing in context yet.</p>
        ) : (
          contextRefs.map((ref) => (
            <span key={ref.id} className="lw-chip">
              {ENTITY_TYPE_META[ref.type].glyph} {ref.name}
              {removable(ref.id) && (
                <button
                  type="button"
                  className="lw-chip__x"
                  aria-label={`Remove ${ref.name} from composition`}
                  onClick={() => setDropped((d) => d.filter((x) => x.id !== ref.id))}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>

      <label className="lw-field__label" htmlFor="compose-mode">
        Mode
      </label>
      <select
        id="compose-mode"
        className="lw-input"
        value={mode}
        onChange={(e) => setMode(e.target.value as (typeof MODES)[number])}
      >
        {MODES.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>

      <label className="lw-field__label" htmlFor="compose-pov">
        POV
      </label>
      <select
        id="compose-pov"
        className="lw-input"
        value={pov}
        onChange={(e) => setPov(e.target.value as (typeof POVS)[number])}
      >
        {POVS.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>

      <label className="lw-field__label" htmlFor="compose-length">
        Length
      </label>
      <select
        id="compose-length"
        className="lw-input"
        value={length}
        onChange={(e) => setLength(e.target.value as (typeof LENGTHS)[number])}
      >
        {LENGTHS.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>

      <label className="lw-field__label" htmlFor="compose-instruction">
        Direction
      </label>
      <textarea
        id="compose-instruction"
        className="lw-input lw-input--area"
        rows={3}
        placeholder="What should happen in this passage?"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
      />

      <div className="lw-compose__actions">
        {aiReady && !draft && !confirming && (
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            disabled={generating}
            onClick={async () => {
              if (!projectId) return;
              const settings = await getAiSettings(projectId);
              if (settings.privacy === 'ask') {
                setConfirming(true);
                return;
              }
              await runGenerate();
            }}
          >
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
        )}
        {confirming && (
          <div className="lw-mergebox lw-card" data-testid="privacy-guard">
            <p className="lw-mergebox__note">
              This sends the brief (entity names, summaries, your direction) to your
              configured provider. Continue?
            </p>
            <div className="lw-chips__add">
              <button
                type="button"
                className="lw-btn lw-btn--primary"
                onClick={async () => {
                  setConfirming(false);
                  await runGenerate();
                }}
              >
                Send once
              </button>
              <button
                type="button"
                className="lw-btn"
                onClick={async () => {
                  if (projectId) await saveAiSettings(projectId, { privacy: 'always-allow' });
                  setConfirming(false);
                  await runGenerate();
                }}
              >
                Always allow
              </button>
              <button type="button" className="lw-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {draft && (
          <div className="lw-compose__draft" data-testid="ai-draft">
            <p className="lw-fieldnote">AI draft — review before inserting:</p>
            <textarea
              className="lw-input lw-input--area"
              rows={8}
              aria-label="AI draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="lw-chips__add">
              <button
                type="button"
                className="lw-btn lw-btn--primary"
                onClick={() => {
                  onInsertProse(draft);
                  setDraft('');
                  toast('Draft inserted — it reads as your manuscript now.', { kind: 'success' });
                }}
              >
                Insert draft
              </button>
              <button type="button" className="lw-btn" onClick={() => setDraft('')}>
                Discard
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          className="lw-btn lw-btn--primary"
          onClick={() => {
            onInsert(buildBrief());
            toast('Brief inserted at the end of the chapter.', { kind: 'success' });
          }}
        >
          Insert brief
        </button>
        <button
          type="button"
          className="lw-btn"
          onClick={async () => {
            await navigator.clipboard.writeText(buildBrief());
            toast('Brief copied — paste it into your AI of choice.', { kind: 'success' });
          }}
        >
          Copy for external AI
        </button>
      </div>
    </aside>
  );
}
