import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Entity } from '@/db/types';
import { listEntities } from '@/db/repos/entities';
import { mergeEntities } from '@/db/repos/links';
import { useFocusStore } from '@/stores/focus';
import { toast } from '@/stores/toasts';
import { getEntityConfig } from '@/domain/entity-configs';
import type { FieldDef, StatRow, StepRow } from '@/domain/entity-configs/types';
import { updateEntity } from '@/db/repos/entities';
import { saveEntityTemplate } from '@/services/templates';
import { entityWireString } from '@/services/generate/serialize';
import { buildGenerationPrompt } from '@/services/generate/wire';
import { loadKnownEntities } from '@/services/generate/known';
import { ENTITY_TYPE_META, type EntityRef } from '@/domain/entity-types';

interface EntityDetailProps {
  entity: Entity;
  onEdit: () => void;
  onDelete: () => void;
}

/** Read-only dossier view of an entity, driven by its editor config. */
export function EntityDetail({ entity, onEdit, onDelete }: EntityDetailProps) {
  const meta = ENTITY_TYPE_META[entity.type];
  const config = getEntityConfig(entity.type);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [merging, setMerging] = useState(false);
  const lock = useFocusStore((s) => s.lock);
  const toggleLock = useFocusStore((s) => s.toggleLock);
  const isLocked = lock?.id === entity.id;

  const mergeTargets = useLiveQuery(
    async () =>
      merging ? (await listEntities(entity.projectId, entity.type)).filter((e) => e.id !== entity.id) : [],
    [merging, entity.projectId, entity.type, entity.id],
    [] as Entity[]
  );

  const doMerge = async (targetId: string) => {
    const result = await mergeEntities(entity.id, targetId);
    setMerging(false);
    if (result) {
      toast(`${entity.name} merged into ${result.name}. Mentions and references now point at ${result.name}.`, { kind: 'success' });
    } else {
      toast('Merge failed — the target may have been deleted.', { kind: 'error' });
    }
  };

  const portrait = typeof entity.fields.portrait === 'string' ? entity.fields.portrait : '';

  return (
    <article className="lw-dossier" data-testid="entity-detail">
      <header className="lw-dossier__head">
        <span
          className="lw-dossier__avatar"
          style={{ background: meta.soft, color: meta.deep }}
          aria-hidden
        >
          {portrait ? <img src={portrait} alt="" /> : initials(entity.name)}
        </span>
        <div className="lw-dossier__headtext">
          <h2 className="lw-dossier__name">{entity.name}</h2>
          {entity.summary ? <p className="lw-dossier__summary">{entity.summary}</p> : null}
          {entity.aliases.length > 0 ? (
            <p className="lw-dossier__aliases">
              also known as {entity.aliases.join(', ')}
            </p>
          ) : null}
        </div>
        <div className="lw-dossier__actions">
          <button type="button" className="lw-btn" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="lw-btn"
            aria-pressed={isLocked}
            onClick={() => toggleLock({ id: entity.id, type: entity.type, name: entity.name })}
          >
            {isLocked ? '🔒 Locked' : 'Lock'}
          </button>
          <button type="button" className="lw-btn" onClick={() => setMerging((m) => !m)}>
            Merge into…
          </button>
          <button
            type="button"
            className="lw-btn"
            onClick={async () => {
              const t = await saveEntityTemplate(entity.projectId, entity);
              toast(`Saved “${t.name}” — find it under Tools ▸ Templates.`, { kind: 'success' });
            }}
          >
            Save as template
          </button>
          <button
            type="button"
            className="lw-btn"
            onClick={async () => {
              await navigator.clipboard.writeText(entityWireString(entity));
              toast(`${entity.name} copied as JSON — paste it into any create menu (or an AI chat).`, { kind: 'success' });
            }}
          >
            Copy as JSON
          </button>
          <button
            type="button"
            className="lw-btn"
            onClick={async () => {
              const known = await loadKnownEntities(entity.projectId);
              const prompt = [
                buildGenerationPrompt(
                  { kind: 'entity', entityType: entity.type },
                  { projectId: entity.projectId, known }
                ),
                '',
                'Here is an existing entry as a style/shape example — make the new one this rich:',
                entityWireString(entity),
              ].join('\n');
              await navigator.clipboard.writeText(prompt);
              toast('AI prompt copied — paste it into any AI, then paste the JSON reply into a create menu.', { kind: 'success' });
            }}
          >
            Copy AI prompt
          </button>
          {confirmingDelete ? (
            <span className="lw-confirm">
              <button type="button" className="lw-btn lw-btn--danger" onClick={onDelete}>
                Move to trash
              </button>
              <button type="button" className="lw-btn" onClick={() => setConfirmingDelete(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="lw-btn" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </header>

      {merging && (
        <div className="lw-card lw-mergebox" data-testid="merge-picker">
          <p className="lw-mergebox__note">
            Merge <strong>{entity.name}</strong> into another {config?.displayName.toLowerCase() ?? 'record'}.
            Its name becomes an alias; every mention, reference, and link is rewritten. This cannot
            be undone.
          </p>
          {mergeTargets.length === 0 ? (
            <p className="lw-empty__note">No other {meta.plural.toLowerCase()} to merge into.</p>
          ) : (
            <ul className="lw-mergebox__list">
              {mergeTargets.map((t) => (
                <li key={t.id}>
                  <button type="button" className="lw-btn" onClick={() => void doMerge(t.id)}>
                    Merge into {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {config?.sections.map((section) => {
        const rows = section.fields
          .filter((f) => !['name', 'title', 'aliases', 'summary'].includes(f.id))
          .map((f) => ({
            field: f,
            rendered:
              f.kind === 'step-list'
                ? renderSteps(entity, f, valueFor(entity, f.id))
                : renderValue(f, valueFor(entity, f.id)),
          }))
          .filter((r) => r.rendered !== null);
        if (rows.length === 0) return null;
        return (
          <section key={section.id} className="lw-dossier__section">
            <h3 className="lw-dossier__sectiontitle">{section.title}</h3>
            <dl className="lw-dossier__grid">
              {rows.map(({ field, rendered }) => (
                <div key={field.id} className="lw-dossier__row">
                  <dt>{field.label}</dt>
                  <dd>{rendered}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      <footer className="lw-dossier__foot">
        <span>Created {new Date(entity.createdAt).toLocaleDateString()}</span>
        <span>Updated {new Date(entity.updatedAt).toLocaleString()}</span>
      </footer>
    </article>
  );
}

const STEP_CYCLE: StepRow['status'][] = ['pending', 'active', 'done', 'skipped'];
const STEP_GLYPH: Record<StepRow['status'], string> = {
  pending: '○',
  active: '◐',
  done: '●',
  skipped: '⊘',
};

/** Quest steps advance straight from the dossier — click a step's glyph
 * to cycle pending → active → done → skipped. */
function renderSteps(entity: Entity, field: FieldDef, value: unknown): React.ReactNode | null {
  const steps = (value as StepRow[]) ?? [];
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const done = steps.filter((s) => s.status === 'done').length;
  const advance = (i: number) => {
    const next = steps.map((row, idx) =>
      idx === i
        ? { ...row, status: STEP_CYCLE[(STEP_CYCLE.indexOf(row.status) + 1) % STEP_CYCLE.length] }
        : row
    );
    void updateEntity(entity.id, { fields: { ...entity.fields, [field.id]: next } });
  };
  return (
    <span className="lw-steplist lw-steplist--dossier">
      <span className="lw-steplist__progress">
        {done}/{steps.length} done
      </span>
      <ol className="lw-steplist__rows">
        {steps.map((row, i) => (
          <li key={i} className={`lw-step lw-step--${row.status}`}>
            <button
              type="button"
              className="lw-step__status"
              aria-label={`Advance step: ${row.text} (now ${row.status})`}
              title={`${row.status} — click to advance`}
              onClick={() => advance(i)}
            >
              {STEP_GLYPH[row.status]}
            </button>
            <span className="lw-step__label">{row.text}</span>
          </li>
        ))}
      </ol>
    </span>
  );
}

function valueFor(entity: Entity, fieldId: string): unknown {
  if (fieldId === 'tags') return entity.tags;
  return entity.fields[fieldId];
}

function renderValue(field: FieldDef, value: unknown): React.ReactNode | null {
  if (value === undefined || value === null || value === '') return null;
  switch (field.kind) {
    case 'chips': {
      const list = value as string[];
      if (!list.length) return null;
      return (
        <span className="lw-chips__row">
          {list.map((c) => (
            <span key={c} className="lw-chip lw-chip--static">
              {c}
            </span>
          ))}
        </span>
      );
    }
    case 'related': {
      const ref = value as EntityRef;
      return `${ENTITY_TYPE_META[ref.type]?.glyph ?? ''} ${ref.name}`;
    }
    case 'related-multi': {
      const refs = value as EntityRef[];
      if (!refs.length) return null;
      return refs.map((r) => r.name).join(', ');
    }
    case 'stat-grid': {
      const rows = (value as StatRow[]).filter((r) => r.name);
      if (!rows.length) return null;
      return (
        <span className="lw-chips__row">
          {rows.map((r) => (
            <span key={r.name} className="lw-chip lw-chip--static">
              {r.name}: {r.value}
            </span>
          ))}
        </span>
      );
    }
    case 'multiselect': {
      const list = value as string[];
      return list.length ? list.join(', ') : null;
    }
    case 'row-list': {
      const rows = Array.isArray(value)
        ? (value as string[])
        : String(value).split('\n').filter(Boolean);
      if (!rows.length) return null;
      return (
        <ol className="lw-steplist__rows lw-steplist__rows--static">
          {rows.map((r, i) => (
            <li key={i} className="lw-step">
              <span className="lw-step__label">{r}</span>
            </li>
          ))}
        </ol>
      );
    }
    case 'dual-number': {
      const pair = value as { x?: string; y?: string };
      return pair.x || pair.y ? `${pair.x ?? '—'} / ${pair.y ?? '—'}` : null;
    }
    case 'phrase-tester':
      return null; // editor-only tester, not dossier data
    case 'toggle':
      return value ? 'Yes' : null;
    case 'image':
      return null; // portrait renders in the header
    default: {
      const text = String(value);
      return text.trim() ? text : null;
    }
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
