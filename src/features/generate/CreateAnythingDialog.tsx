import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { getEntityConfig } from '@/domain/entity-configs';
import { applyBundle } from '@/services/generate/apply';
import { draftToInitialForm } from '@/services/generate/coerce';
import { loadKnownEntities } from '@/services/generate/known';
import { buildGenerationPrompt, parseWireBundle, type WireContext } from '@/services/generate/wire';
import { db } from '@/db/schema';
import { AiTab } from './AiTab';
import { needsStaging, type GenerationBundle } from '@/services/generate/types';
import { routeForBundle, runRandomGeneration } from '@/services/generate/staging';
import { THEMES } from '@/services/generate/random/packs/lexicon';
import { bundleOf, listGenerations, recordGeneration } from '@/db/repos/generations';
import type { GenerationRecord } from '@/db/types';
import { undoAuditEntry } from '@/db/repos/undo';
import { templateActionFor } from './saveAsTemplate';
import { useEditorStore } from '@/stores/editor';
import { useGenerationStore, type GenerationDialogTarget } from '@/stores/generation';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

type TabId = 'manual' | 'random' | 'ai' | 'paste';

/** The app-wide four-mode create flow. Opens pre-targeted (a type, a
 * tree, a board…); Manual forwards straight to the editor drawer, the
 * generation tabs produce a bundle that lands in the drawer (single
 * entity) or the staged preview (anything bigger). */
export function CreateAnythingDialog() {
  const target = useGenerationStore((s) => s.dialog);
  const closeDialog = useGenerationStore((s) => s.closeDialog);
  const stage = useGenerationStore((s) => s.stage);
  const openCreate = useEditorStore((s) => s.openCreate);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);

  const [tab, setTab] = useState<TabId>('random');

  if (!target || !projectId) return null;

  const isTreeKind = target.kind === 'skilltree' || target.kind === 'skilltree-branch';
  const meta = target.entityType ? ENTITY_TYPE_META[target.entityType] : null;
  const config = target.entityType ? getEntityConfig(target.entityType) : null;
  const subject = isTreeKind
    ? target.kind === 'skilltree'
      ? 'skill tree'
      : 'skill tree branch'
    : target.kind === 'tangle'
      ? 'tangle board'
      : target.kind === 'chapter'
        ? 'chapter'
        : (config?.displayName ?? meta?.label ?? 'anything');
  // Trees/boards/chapters have no manual path here — those surfaces build
  // by hand (the Writer's Room for chapters).
  const noManual = isTreeKind || target.kind === 'tangle' || target.kind === 'chapter';
  const activeTab: TabId = noManual && tab === 'manual' ? 'random' : tab;

  const openManual = () => {
    closeDialog();
    if (target.entityType) openCreate(target.entityType);
  };

  const stageAndRoute = (bundle: GenerationBundle) => {
    stage(bundle);
    const { route, codexType } = routeForBundle(bundle);
    if (codexType) setCodexType(codexType);
    setRoute(route);
  };

  /** Route a parsed bundle: one plain entity → prefilled drawer (Save =
   * accept); anything bigger → staged ghost preview in its home surface.
   * Every delivered bundle also lands in the per-project history. */
  const deliver = (bundle: GenerationBundle) => {
    void recordGeneration(bundle);
    if (!needsStaging(bundle) && bundle.entities.length === 1) {
      const draft = bundle.entities[0];
      closeDialog();
      openCreate(draft.type, draftToInitialForm(draft), {
        theme: bundle.request.theme,
        hint: bundle.request.hint,
        seed: bundle.seed,
      });
      if (bundle.warnings.length) {
        toast(`Prefilled with ${bundle.warnings.length} note${bundle.warnings.length === 1 ? '' : 's'} — check the fields.`, { kind: 'info' });
      }
      return;
    }
    stageAndRoute(bundle);
  };

  /** Re-stage a bundle straight from history (no re-recording). */
  const reStage = (bundle: GenerationBundle) => {
    stageAndRoute(bundle);
    closeDialog();
  };

  return (
    <div className="lw-drawer-backdrop" role="presentation" onClick={closeDialog}>
      <div
        className="lw-dialog lw-dialog--wide"
        role="dialog"
        aria-label={`Create ${subject}`}
        data-testid="create-anything"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="lw-card__title">
          {meta ? (
            <>
              <span style={{ color: meta.color }} aria-hidden>
                {meta.glyph}
              </span>{' '}
            </>
          ) : null}
          New {subject.toLowerCase()}
        </h2>
        <div className="lw-viewtoggle" role="tablist" aria-label="Creation mode">
          {!noManual && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'manual'}
              className={activeTab === 'manual' ? 'lw-pill lw-pill--active' : 'lw-pill'}
              onClick={() => setTab('manual')}
            >
              Manual
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'random'}
            className={activeTab === 'random' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setTab('random')}
          >
            Random
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ai'}
            className={activeTab === 'ai' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setTab('ai')}
          >
            AI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paste'}
            className={activeTab === 'paste' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setTab('paste')}
          >
            Paste JSON
          </button>
        </div>

        {activeTab === 'manual' ? (
          <div className="lw-gentab">
            <p className="lw-fieldnote">
              Build it yourself in the full editor — every field, every tab.
            </p>
            <div className="lw-chips__add">
              <button type="button" className="lw-btn lw-btn--primary" onClick={openManual}>
                Open blank editor
              </button>
              <button type="button" className="lw-btn" onClick={closeDialog}>
                Cancel
              </button>
            </div>
          </div>
        ) : activeTab === 'random' ? (
          <RandomTab
            projectId={projectId}
            target={target}
            onDeliver={deliver}
            onCancel={closeDialog}
          />
        ) : activeTab === 'ai' ? (
          <AiTab projectId={projectId} target={target} onDeliver={deliver} onCancel={closeDialog} />
        ) : (
          <PasteTab
            projectId={projectId}
            target={target}
            onDeliver={deliver}
            onCancel={closeDialog}
          />
        )}

        <GenerationHistory projectId={projectId} onReStage={reStage} />
      </div>
    </div>
  );
}

/** The last few generations for this project — re-stage one, or copy its
 * seed to reproduce it exactly. Empty (and hidden) until the first roll. */
function GenerationHistory({
  projectId,
  onReStage,
}: {
  projectId: string;
  onReStage: (bundle: GenerationBundle) => void;
}) {
  const records = useLiveQuery(() => listGenerations(projectId), [projectId], [] as GenerationRecord[]);
  if (!records.length) return null;
  return (
    <details className="lw-genhistory" data-testid="generation-history">
      <summary>Recent generations ({records.length})</summary>
      <ul className="lw-genhistory__list">
        {records.map((r) => (
          <li key={r.id} className="lw-genhistory__item">
            <span className="lw-genhistory__title">
              {r.title}
              <span className="lw-genhistory__meta">
                {' · '}
                {r.mode}
                {r.seed !== undefined ? ` · seed ${r.seed}` : ''}
              </span>
            </span>
            <span className="lw-chips__add">
              <button type="button" className="lw-btn" onClick={() => onReStage(bundleOf(r))}>
                Re-stage
              </button>
              {r.seed !== undefined ? (
                <button
                  type="button"
                  className="lw-btn"
                  onClick={async () => {
                    await navigator.clipboard.writeText(String(r.seed));
                    toast('Seed copied.', { kind: 'success' });
                  }}
                >
                  Copy seed
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Apply an entity bundle and toast one Undo (plus an optional save-as-
 * template) for the lot. */
async function acceptEntityBundle(bundle: GenerationBundle, onDone: () => void) {
  const result = await applyBundle(bundle);
  const total = result.created.length + result.updated.length;
  const templateAction = templateActionFor(bundle, result);
  onDone();
  toast(`${total} ${total === 1 ? 'entry' : 'entries'} added.`, {
    kind: 'success',
    action: {
      label: 'Undo',
      run: async () => {
        await undoAuditEntry(result.auditId);
        toast('Generation undone.', { kind: 'success' });
      },
    },
    actions: templateAction ? [templateAction] : undefined,
  });
}

/** Preview list a multi-entity bundle before Accept — shared by the
 * Random and Paste tabs. */
function EntityBundlePreview({ bundle, testId }: { bundle: GenerationBundle; testId: string }) {
  return (
    <div className="lw-card lw-genpreview" data-testid={testId}>
      <p className="lw-fieldnote">
        {bundle.entities.length} entries staged — accepting creates them all (one Undo reverts
        everything):
      </p>
      <ul className="lw-genpreview__list">
        {bundle.entities.map((d) => (
          <li key={d.localId}>
            <span aria-hidden>{ENTITY_TYPE_META[d.type].glyph}</span> {d.name}
            {d.summary ? <span className="lw-genpreview__sub"> — {d.summary}</span> : null}
            {d.existingEntityId ? <em> — updates existing</em> : null}
          </li>
        ))}
      </ul>
      {bundle.warnings.length ? (
        <details className="lw-genpreview__warnings">
          <summary>
            {bundle.warnings.length} note{bundle.warnings.length === 1 ? '' : 's'}
          </summary>
          <ul>
            {bundle.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function RandomTab({
  projectId,
  target,
  onDeliver,
  onCancel,
}: {
  projectId: string;
  target: GenerationDialogTarget;
  onDeliver: (bundle: GenerationBundle) => void;
  onCancel: () => void;
}) {
  const isTreeKind = target.kind === 'skilltree' || target.kind === 'skilltree-branch';
  const isChapter = target.kind === 'chapter';
  const isFixedKind = isTreeKind || target.kind === 'tangle' || isChapter;
  const canChain = target.entityType === 'quests';
  const canPair = target.entityType === 'relationships';
  const [theme, setTheme] = useState('any');
  const [hint, setHint] = useState('');
  const [count, setCount] = useState(
    isTreeKind ? (target.kind === 'skilltree' ? 12 : 5) : target.kind === 'tangle' ? 8 : isChapter ? 6 : 1
  );
  const [branches, setBranches] = useState(3);
  const [chain, setChain] = useState(false);
  const [pair, setPair] = useState(target.kind === 'relationship-set');
  const [parsed, setParsed] = useState<GenerationBundle | null>(null);

  const roll = async () => {
    const kind = isFixedKind
      ? target.kind
      : canChain && chain
        ? 'questline'
        : canPair && pair
          ? 'relationship-set'
          : count > 1
            ? 'entity-batch'
            : 'entity';
    const result = await runRandomGeneration(
      {
        kind,
        entityType: target.entityType,
        theme: theme === 'any' ? undefined : theme,
        hint: hint.trim() || undefined,
        count: kind === 'questline' ? Math.max(count, 2) : count,
        options: target.kind === 'skilltree' ? { branches } : undefined,
        targetGraphId: target.targetGraphId,
        contextRefs: target.contextRefs,
      },
      projectId
    );
    if ('error' in result) {
      toast(result.error, { kind: 'error' });
      return;
    }
    if (result.entities.length === 1 && !needsStaging(result)) {
      onDeliver(result);
      return;
    }
    if (isFixedKind || kind === 'questline' || kind === 'relationship-set') {
      // Compound results stage as ghosts in their home surface.
      onDeliver(result);
      return;
    }
    setParsed(result);
  };

  return (
    <div className="lw-gentab" data-testid="random-tab">
      <p className="lw-fieldnote">
        {isTreeKind
          ? 'Themed, offline, instant — the tree stages as ghost nodes on the canvas for you to inspect, drag, and accept.'
          : isChapter
            ? 'Themed, offline, instant — a chapter scaffold (premise + beat outline) stages for review, then accepts into the Writer’s Room as paragraphs you overwrite.'
            : 'Themed, offline, instant. A single roll lands in the editor — reroll any field with its dice, then save when it sings. Batches preview here first.'}
      </p>
      <div className="lw-genopts">
        <label className="lw-field__label" htmlFor="gen-theme">
          Theme
        </label>
        <select
          id="gen-theme"
          className="lw-input"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="any">Surprise me</option>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="lw-field__label" htmlFor="gen-hint">
          Tailor it (optional)
        </label>
        <input
          id="gen-hint"
          className="lw-input"
          placeholder={
            isTreeKind ? 'e.g. "sorcerer" or "poison assassin"' : 'e.g. "a sorcerer who hates fire" or "poison"'
          }
          value={hint}
          onChange={(e) => setHint(e.target.value)}
        />
        <label className="lw-field__label" htmlFor="gen-count">
          {isTreeKind ? 'How many skills' : isChapter ? 'How many beats' : 'How many'}
        </label>
        <input
          id="gen-count"
          className="lw-input"
          type="number"
          min={1}
          max={isTreeKind ? 40 : 24}
          value={count}
          onChange={(e) =>
            setCount(Math.max(1, Math.min(isTreeKind ? 40 : 24, Number(e.target.value) || 1)))
          }
        />
        {target.kind === 'skilltree' ? (
          <>
            <label className="lw-field__label" htmlFor="gen-branches">
              Branches
            </label>
            <select
              id="gen-branches"
              className="lw-input"
              value={branches}
              onChange={(e) => setBranches(Number(e.target.value))}
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {canChain ? (
          <label className="lw-toggle">
            <input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} />
            <span>Questline — a linked chain of quests (with events), staged in the roster</span>
          </label>
        ) : null}
        {canPair ? (
          <label className="lw-toggle">
            <input type="checkbox" checked={pair} onChange={(e) => setPair(e.target.checked)} />
            <span>A set — weave several bonds among your existing cast at once</span>
          </label>
        ) : null}
      </div>
      {parsed ? <EntityBundlePreview bundle={parsed} testId="random-preview" /> : null}
      <div className="lw-chips__add">
        {parsed ? (
          <>
            <button
              type="button"
              className="lw-btn lw-btn--primary"
              onClick={() => void acceptEntityBundle(parsed, onCancel)}
            >
              Accept all
            </button>
            <button type="button" className="lw-btn" onClick={() => void roll()}>
              🎲 Reroll
            </button>
          </>
        ) : (
          <button type="button" className="lw-btn lw-btn--primary" onClick={() => void roll()}>
            🎲 Roll it
          </button>
        )}
        <button type="button" className="lw-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PasteTab({
  projectId,
  target,
  onDeliver,
  onCancel,
}: {
  projectId: string;
  target: GenerationDialogTarget;
  onDeliver: (bundle: GenerationBundle) => void;
  onCancel: () => void;
}) {
  const entityType = target.entityType;
  const isTreeKind = target.kind === 'skilltree' || target.kind === 'skilltree-branch';
  const isBranchKind = target.kind === 'skilltree-branch';
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<GenerationBundle | null>(null);
  // What project context to fold into the copied prompt — off by choice
  // keeps a prompt lean or private before it leaves for an external AI.
  const [includeCast, setIncludeCast] = useState(true);
  const [includeLocations, setIncludeLocations] = useState(true);
  const [includeTree, setIncludeTree] = useState(true);
  // Cast/location names only appear in entity + questline prompts; the tree
  // adjacency only in branch prompts.
  const showEntityContext = !isTreeKind;

  const wireContext = async (): Promise<WireContext> => ({
    projectId,
    known: await loadKnownEntities(projectId),
    tree: target.targetGraphId ? await db.skillTrees.get(target.targetGraphId) : undefined,
  });

  const requestOf = () => ({
    kind: isTreeKind || target.kind === 'chapter' ? target.kind : ('entity' as const),
    entityType,
    targetGraphId: target.targetGraphId,
  });

  const copyPrompt = async () => {
    const prompt = buildGenerationPrompt(requestOf(), await wireContext(), {
      includeCast,
      includeLocations,
      includeTree,
    });
    await navigator.clipboard.writeText(prompt);
    toast('Prompt copied — paste it into any AI, then paste the JSON reply back here.', {
      kind: 'success',
    });
  };

  const parse = async () => {
    setError('');
    setParsed(null);
    const result = parseWireBundle(text, requestOf(), await wireContext());
    if ('error' in result) {
      setError(result.error);
      return;
    }
    // Single plain entity → drawer; anything with graphs/links → staged
    // ghosts in its home surface; plain batches preview inline here.
    if (
      (result.bundle.entities.length === 1 && !needsStaging(result.bundle)) ||
      result.bundle.graphs.length ||
      result.bundle.links.length ||
      result.bundle.chapters.length
    ) {
      onDeliver(result.bundle);
      return;
    }
    setParsed(result.bundle);
  };


  return (
    <div className="lw-gentab" data-testid="paste-tab">
      <p className="lw-fieldnote">
        Paste entity JSON from an external AI (or another project) and every field auto-fills.
        Need a prompt to send first?
      </p>
      {(showEntityContext || isBranchKind) && (
        <div className="lw-genopts" data-testid="paste-context-opts">
          <span className="lw-field__label">Include in the copied prompt</span>
          {showEntityContext && (
            <>
              <label className="lw-toggle">
                <input
                  type="checkbox"
                  checked={includeCast}
                  onChange={(e) => setIncludeCast(e.target.checked)}
                />
                <span>Your cast names (so the AI can reference them)</span>
              </label>
              <label className="lw-toggle">
                <input
                  type="checkbox"
                  checked={includeLocations}
                  onChange={(e) => setIncludeLocations(e.target.checked)}
                />
                <span>Your location names</span>
              </label>
            </>
          )}
          {isBranchKind && (
            <label className="lw-toggle">
              <input
                type="checkbox"
                checked={includeTree}
                onChange={(e) => setIncludeTree(e.target.checked)}
              />
              <span>The existing tree (so new skills graft on correctly)</span>
            </label>
          )}
        </div>
      )}
      <div className="lw-chips__add">
        <button type="button" className="lw-btn" onClick={() => void copyPrompt()}>
          Copy prompt for external AI
        </button>
      </div>
      <textarea
        className="lw-input"
        rows={8}
        placeholder='Paste JSON here — a single entry, an array, or {"entities": [...]}'
        aria-label="Pasted JSON"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParsed(null);
          setError('');
        }}
      />
      {error ? <p className="lw-fieldnote lw-fieldnote--error">{error}</p> : null}
      {parsed ? <EntityBundlePreview bundle={parsed} testId="paste-preview" /> : null}
      <div className="lw-chips__add">
        {parsed ? (
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            onClick={() => void acceptEntityBundle(parsed, onCancel)}
          >
            Accept all
          </button>
        ) : (
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            disabled={!text.trim()}
            onClick={() => void parse()}
          >
            Stage it
          </button>
        )}
        <button type="button" className="lw-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
