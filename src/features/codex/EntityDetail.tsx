import { useState } from 'react';
import type { Entity } from '@/db/types';
import { getEntityConfig } from '@/domain/entity-configs';
import type { FieldDef } from '@/domain/entity-configs/types';
import type { StatRow } from '@/domain/entity-configs/types';
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

      {config?.sections.map((section) => {
        const rows = section.fields
          .filter((f) => !['name', 'aliases', 'summary'].includes(f.id))
          .map((f) => ({ field: f, rendered: renderValue(f, valueFor(entity, f.id)) }))
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
