import { useState } from 'react';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { getEntityConfig } from '@/domain/entity-configs';
import { applyBundle } from '@/services/generate/apply';
import { draftToInitialForm } from '@/services/generate/coerce';
import { loadKnownEntities } from '@/services/generate/known';
import { buildGenerationPrompt, parseWireBundle } from '@/services/generate/wire';
import { needsStaging, type GenerationBundle } from '@/services/generate/types';
import { undoAuditEntry } from '@/db/repos/undo';
import { useEditorStore } from '@/stores/editor';
import { useGenerationStore } from '@/stores/generation';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

type TabId = 'manual' | 'paste';

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

  const [tab, setTab] = useState<TabId>('paste');

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
      openCreate(draft.type, draftToInitialForm(draft));
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
  const discardStaged = useGenerationStore((s) => s.discard);

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

  const acceptAll = async () => {
    if (!parsed) return;
    const result = await applyBundle(parsed);
    const total = result.created.length + result.updated.length;
    discardStaged();
    onCancel();
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
      {parsed ? (
        <div className="lw-card lw-genpreview" data-testid="paste-preview">
          <p className="lw-fieldnote">
            Parsed {parsed.entities.length} entries — accepting creates them all (one Undo reverts
            everything):
          </p>
          <ul className="lw-genpreview__list">
            {parsed.entities.map((d) => (
              <li key={d.localId}>
                <span aria-hidden>{ENTITY_TYPE_META[d.type].glyph}</span> {d.name}
                {d.existingEntityId ? <em> — updates existing</em> : null}
              </li>
            ))}
          </ul>
          {parsed.warnings.length ? (
            <details className="lw-genpreview__warnings">
              <summary>
                {parsed.warnings.length} note{parsed.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul>
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      <div className="lw-chips__add">
        {parsed ? (
          <button type="button" className="lw-btn lw-btn--primary" onClick={() => void acceptAll()}>
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
