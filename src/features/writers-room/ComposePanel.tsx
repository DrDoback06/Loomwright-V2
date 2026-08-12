import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { complete } from '@/services/ai/providers';
import { buildProseBrief } from '@/services/ai/prompts/prose';
import { tierForModel } from '@/services/ai/prompts';
import { buildCanonFacts, checkDraftAgainstCanon, type CanonIssue } from '@/services/ai/canon';
import { analyzeStyle, type StyleProfile } from '@/services/style-analysis';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import { PrivacyConfirm } from '@/features/generate/PrivacyConfirm';
import { useFocusStore } from '@/stores/focus';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';
import type { Scene } from '@/db/types';
import { buildSceneContext } from '@/services/context/scene-context';
import { pinnedRefs } from '@/services/context/pinned';
import { storySoFar } from '@/services/context/story-so-far';

const MODES = ['scene', 'chapter opening', 'dialogue', 'description', 'transition'] as const;
const POVS = ['third limited', 'third omniscient', 'first person', 'second person'] as const;
const TENSES = ['past', 'present'] as const;
const LENGTHS = ['a few paragraphs', 'half a chapter', 'a full chapter'] as const;

/** How much manuscript to measure the author's voice from. Enough to be
 * representative, capped so a long book does not stall the panel. */
const STYLE_SAMPLE_CHARS = 40_000;

const ISSUE_GLYPH: Record<CanonIssue['kind'], string> = {
  contradiction: '⚠',
  change: '↻',
  introduction: '＋',
};

interface ComposePanelProps {
  /** The scene being drafted into. Required because context now comes from
   * `buildSceneContext`, the same call the context rail renders. */
  scene: Scene;
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
export function ComposePanel({ scene, onInsert, onInsertProse, onClose }: ComposePanelProps) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const focusedByType = useFocusStore((s) => s.focusedByType);
  const lock = useFocusStore((s) => s.lock);

  const [mode, setMode] = useState<(typeof MODES)[number]>('scene');
  const [pov, setPov] = useState<(typeof POVS)[number]>('third limited');
  const [tense, setTense] = useState<(typeof TENSES)[number]>('past');
  const [length, setLength] = useState<(typeof LENGTHS)[number]>('a few paragraphs');
  const [instruction, setInstruction] = useState('');
  const [aiReady, setAiReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [issues, setIssues] = useState<CanonIssue[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [matchVoice, setMatchVoice] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);

  /** Every live entity — the canon check needs the whole world, not just what
   * is in context, or it cannot tell a new name from a known one. */
  const world = useLiveQuery(
    async () => (projectId ? db.entities.where('projectId').equals(projectId).toArray() : []),
    [projectId],
    [] as Entity[]
  );

  /** The author's own voice, measured from their own pages. Never guessed,
   * never asked for — it is already computable and was simply never sent. */
  const style = useLiveQuery<StyleProfile | null, StyleProfile | null>(
    async () => {
      if (!projectId) return null;
      const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
      let sample = '';
      for (const chapter of chapters) {
        for (const paragraph of chapter.paragraphs) {
          sample += `${paragraph.text}\n\n`;
          if (sample.length > STYLE_SAMPLE_CHARS) break;
        }
        if (sample.length > STYLE_SAMPLE_CHARS) break;
      }
      return analyzeStyle(sample);
    },
    [projectId],
    null
  );

  // The same call the context rail renders, so the brief and the Preview
  // cannot disagree about what a model is told. Replaces a byte-identical
  // copy of `ai-context.ts`'s personality/speechStyle block.
  const sceneContext = useLiveQuery(
    () => buildSceneContext(scene.projectId, scene, { pinned: pinnedRefs() }),
    [scene, lock, focusedByType],
    null
  );
  const contextItems = (sceneContext?.items ?? []).filter((i) => i.lane !== 'excluded');
  // Long-book memory: what has already happened, as summaries rather than
  // as prose nobody's context window can hold.
  const soFar = useLiveQuery(
    async () =>
      storySoFar(
        await db.scenes.where('projectId').equals(scene.projectId).toArray(),
        scene.globalOrder
      ),
    [scene.projectId, scene.globalOrder],
    ''
  );
  const details = useLiveQuery(
    async () => {
      const rows = await Promise.all(contextItems.map((i) => db.entities.get(i.ref.id)));
      return rows.filter((r) => r !== undefined);
    },
    [contextItems.map((i) => i.ref.id).join(',')],
    []
  );

  /**
   * The brief.
   *
   * "Stay consistent with the codex" was the whole of the canon instruction,
   * addressed to a model that has never seen the codex. It now carries the
   * actual recorded state of everyone in the scene, the author's measured
   * voice, and an explicit form contract — because everything a small model
   * gets wrong here is something the old brief left it to infer.
   */
  const buildBrief = (options: { tier?: 'small' | 'large' } = {}): string =>
    buildProseBrief({
      mode,
      pov,
      tense,
      length,
      instruction,
      context: sceneContext?.text ?? '',
      storySoFar: soFar,
      style: matchVoice ? style : null,
      facts: buildCanonFacts(details, world),
    }, options);

  const runGenerate = async () => {
    if (!projectId) return;
    const config = await resolveProvider(projectId);
    if (!config) {
      toast('Configure an AI provider in Settings first.', { kind: 'error' });
      return;
    }
    setGenerating(true);
    setIssues([]);
    try {
      const text = await complete(config, {
        system:
          'You are a fiction co-writer. Write polished prose following the brief exactly. Return only the prose — no preamble, no notes.',
        prompt: buildBrief({ tier: tierForModel(config) }),
        // Prose is the one place a high temperature is right. Everything else
        // in the app runs at 0; a scene generated at 0 reads like a synopsis.
        temperature: 0.85,
        maxTokens: 1800,
      });
      const cleaned = text.trim();
      setDraft(cleaned);
      // The draft is read by the same engine that reads the manuscript, before
      // the author is offered the Insert button. Nothing used to check it.
      setIssues(checkDraftAgainstCanon(cleaned, world));
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

      {/* Read-only on purpose: the context rail is where context is shaped,
          with a real drop target, a keyboard path and a reason per chip.
          This panel had a remove × that could never render, because the
          state behind it was never written to. */}
      <div className="lw-compose__refs">
        {contextItems.length === 0 ? (
          <p className="lw-empty__note">Nothing in context yet.</p>
        ) : (
          contextItems.map((item) => (
            <span key={item.ref.id} className="lw-chip lw-chip--static">
              <span aria-hidden>{ENTITY_TYPE_META[item.ref.type].glyph}</span> {item.ref.name}
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

      <label className="lw-field__label" htmlFor="compose-tense">
        Tense
      </label>
      <select
        id="compose-tense"
        className="lw-input"
        value={tense}
        onChange={(e) => setTense(e.target.value as (typeof TENSES)[number])}
      >
        {TENSES.map((t) => (
          <option key={t} value={t}>
            {t} tense
          </option>
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

      <label className="lw-fieldnote">
        <input
          type="checkbox"
          checked={matchVoice}
          onChange={(e) => setMatchVoice(e.target.checked)}
        />{' '}
        Match my voice
        {style
          ? ` — measured: ${style.register}, ${style.pacing}, ~${Math.round(style.avgSentenceLength)}-word sentences`
          : ' — write a little more first and this fills in'}
      </label>

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
        {confirming && projectId && (
          <PrivacyConfirm
            projectId={projectId}
            note="This sends the brief (entity names, summaries, your direction) to your configured provider. Continue?"
            onRun={async () => {
              setConfirming(false);
              await runGenerate();
            }}
            onCancel={() => setConfirming(false)}
          />
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
              onBlur={() => setIssues(checkDraftAgainstCanon(draft, world))}
            />

            {/* Read by the same offline engine that reads the manuscript, so
                the author sees what this passage does to their canon BEFORE
                it becomes their canon. Costs nothing and needs no key. */}
            {issues.length > 0 && (
              <div className="lw-compose__canon" data-testid="canon-check" role="status">
                <p className="lw-fieldnote">
                  Checked against your codex — {issues.length} note
                  {issues.length === 1 ? '' : 's'}:
                </p>
                <ul className="lw-compose__issues">
                  {issues.map((issue, i) => (
                    <li key={i} className={`lw-compose__issue lw-compose__issue--${issue.kind}`}>
                      <span aria-hidden>{ISSUE_GLYPH[issue.kind]}</span>{' '}
                      <span>{issue.message}</span>
                      {issue.quote ? <em className="lw-compose__issuequote">“{issue.quote}”</em> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {issues.length === 0 && (
              <p className="lw-fieldnote" data-testid="canon-check">
                Checked against your codex — nothing contradicts what you have recorded.
              </p>
            )}

            <div className="lw-chips__add">
              <button
                type="button"
                className="lw-btn lw-btn--primary"
                onClick={() => {
                  onInsertProse(draft);
                  setDraft('');
                  setIssues([]);
                  toast('Draft inserted — it reads as your manuscript now.', { kind: 'success' });
                }}
              >
                Insert draft
              </button>
              <button
                type="button"
                className="lw-btn"
                onClick={() => {
                  setDraft('');
                  setIssues([]);
                }}
              >
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
