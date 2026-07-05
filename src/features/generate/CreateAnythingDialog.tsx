import { useState } from 'react';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { getEntityConfig } from '@/domain/entity-configs';
import { applyBundle } from '@/services/generate/apply';
import { draftToInitialForm } from '@/services/generate/coerce';
import { loadKnownEntities } from '@/services/generate/known';
import { buildGenerationPrompt, parseWireBundle } from '@/services/generate/wire';
import { needsStaging, type GenerationBundle } from '@/services/generate/types';
import { generateRandomBundle } from '@/services/generate/random/engine';
import { THEMES } from '@/services/generate/random/packs/lexicon';
import { undoAuditEntry } from '@/db/repos/undo';
import { useEditorStore } from '@/stores/editor';
import { useGenerationStore } from '@/stores/generation';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

type TabId = 'manual' | 'random' | 'paste';

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

  const [tab, setTab] = useState<TabId>('random');

  if (!target || !projectId) return null;

  const meta = target.entityType ? ENTITY_TYPE_META[target.entityType] : null;
  const config = target.entityType ? getEntityConfig(target.entityType) : null;
  const subject = config?.displayName ?? meta?.label ?? 'anything';

  const openManual = () => {
    closeDialog();
    if (target.entityType) openCreate(target.entityType);
  };

  /** Route a parsed bundle: one plain entity → prefilled drawer (Save =
   * accept); anything bigger → staged preview / inline accept. */
  const deliver = (bundle: GenerationBundle) => {
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
    stage(bundle);
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
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'manual'}
            className={tab === 'manual' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setTab('manual')}
          >
            Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'random'}
            className={tab === 'random' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setTab('random')}
          >
            Random
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'paste'}
            className={tab === 'paste' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setTab('paste')}
          >
            Paste JSON
          </button>
        </div>

        {tab === 'manual' ? (
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
        ) : tab === 'random' ? (
          <RandomTab
            projectId={projectId}
            entityType={target.entityType}
            onDeliver={deliver}
            onCancel={closeDialog}
          />
        ) : (
          <PasteTab
            projectId={projectId}
            entityType={target.entityType}
            onDeliver={deliver}
            onCancel={closeDialog}
          />
        )}
      </div>
    </div>
  );
}

/** Apply an entity bundle and toast one Undo for the lot. */
async function acceptEntityBundle(bundle: GenerationBundle, onDone: () => void) {
  const result = await applyBundle(bundle);
  const total = result.created.length + result.updated.length;
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
  entityType,
  onDeliver,
  onCancel,
}: {
  projectId: string;
  entityType?: EntityType;
  onDeliver: (bundle: GenerationBundle) => void;
  onCancel: () => void;
}) {
  const [theme, setTheme] = useState('any');
  const [hint, setHint] = useState('');
  const [count, setCount] = useState(1);
  const [parsed, setParsed] = useState<GenerationBundle | null>(null);

  const roll = async () => {
    if (!entityType) return;
    const known = await loadKnownEntities(projectId);
    const bundle = generateRandomBundle(
      {
        kind: count > 1 ? 'entity-batch' : 'entity',
        entityType,
        theme: theme === 'any' ? undefined : theme,
        hint: hint.trim() || undefined,
        count,
      },
      { projectId, known }
    );
    if (bundle.entities.length === 1) {
      onDeliver(bundle);
      return;
    }
    setParsed(bundle);
  };

  return (
    <div className="lw-gentab" data-testid="random-tab">
      <p className="lw-fieldnote">
        Themed, offline, instant. A single roll lands in the editor — reroll any field with its
        dice, then save when it sings. Batches preview here first.
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
          placeholder='e.g. "a sorcerer who hates fire" or "poison"'
          value={hint}
          onChange={(e) => setHint(e.target.value)}
        />
        <label className="lw-field__label" htmlFor="gen-count">
          How many
        </label>
        <input
          id="gen-count"
          className="lw-input"
          type="number"
          min={1}
          max={24}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
        />
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
  entityType,
  onDeliver,
  onCancel,
}: {
  projectId: string;
  entityType?: EntityType;
  onDeliver: (bundle: GenerationBundle) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<GenerationBundle | null>(null);

  const copyPrompt = async () => {
    const known = await loadKnownEntities(projectId);
    const prompt = buildGenerationPrompt(
      { kind: 'entity', entityType },
      { projectId, known }
    );
    await navigator.clipboard.writeText(prompt);
    toast('Prompt copied — paste it into any AI, then paste the JSON reply back here.', {
      kind: 'success',
    });
  };

  const parse = async () => {
    setError('');
    setParsed(null);
    const known = await loadKnownEntities(projectId);
    const result = parseWireBundle(text, { kind: 'entity', entityType }, { projectId, known });
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (result.bundle.entities.length === 1 && !needsStaging(result.bundle)) {
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
