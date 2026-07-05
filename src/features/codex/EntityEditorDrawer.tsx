import { useEffect, useMemo, useState } from 'react';
import { getEntityConfig } from '@/domain/entity-configs';
import type { EntityConfig } from '@/domain/entity-configs/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { createEntity, getEntity, updateEntity } from '@/db/repos/entities';
import type { Entity } from '@/db/types';
import { useEditorStore } from '@/stores/editor';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';
import { FieldInput } from './fields/FieldInput';

/** Field ids that live on the Entity record itself rather than in
 * entity.fields — kept aligned with extraction + import round-trips.
 * Some configs (quests, events, lore, references, timeline) call their
 * name field 'title'; relationships derive theirs from from → to. */
const TOP_LEVEL_FIELDS = new Set(['name', 'title', 'aliases', 'summary', 'tags']);

type FormState = Record<string, unknown>;

function nameFieldIdOf(config: EntityConfig): 'name' | 'title' | null {
  for (const section of config.sections) {
    for (const f of section.fields) {
      if (f.id === 'name') return 'name';
      if (f.id === 'title') return 'title';
    }
  }
  return null;
}

function formFromEntity(entity: Entity, nameFieldId: 'name' | 'title' | null): FormState {
  return {
    ...(nameFieldId ? { [nameFieldId]: entity.name } : {}),
    aliases: entity.aliases,
    summary: entity.summary,
    tags: entity.tags,
    ...entity.fields,
  };
}

function deriveName(form: FormState, nameFieldId: 'name' | 'title' | null): string {
  if (nameFieldId) return String(form[nameFieldId] ?? '').trim();
  const from = form.from as { name?: string } | undefined;
  const to = form.to as { name?: string } | undefined;
  if (from?.name && to?.name) return `${from.name} → ${to.name}`;
  return '';
}

function splitForm(form: FormState, nameFieldId: 'name' | 'title' | null) {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    if (key === nameFieldId || key === 'name') continue;
    if (!TOP_LEVEL_FIELDS.has(key) && value !== undefined && value !== '') fields[key] = value;
  }
  return {
    name: deriveName(form, nameFieldId),
    aliases: (form.aliases as string[]) ?? [],
    summary: String(form.summary ?? ''),
    tags: (form.tags as string[]) ?? [],
    fields,
  };
}

export function EntityEditorDrawer() {
  const target = useEditorStore((s) => s.target);
  const close = useEditorStore((s) => s.close);
  const projectId = useProjectStore((s) => s.currentProjectId);

  const [form, setForm] = useState<FormState>({});
  const [activeSection, setActiveSection] = useState<string>('');
  const [loadedFor, setLoadedFor] = useState<string>('');

  const config = target ? getEntityConfig(target.type) : undefined;
  const meta = target ? ENTITY_TYPE_META[target.type] : undefined;

  const targetKey = useMemo(() => {
    if (!target) return '';
    return target.mode === 'edit' ? `edit:${target.entityId}` : `create:${target.type}`;
  }, [target]);

  useEffect(() => {
    if (!target || !targetKey || targetKey === loadedFor) return;
    let cancelled = false;
    (async () => {
      if (target.mode === 'edit') {
        const entity = await getEntity(target.entityId);
        if (!cancelled && entity && config) setForm(formFromEntity(entity, nameFieldIdOf(config)));
      } else {
        setForm({ aliases: [], tags: [], ...(target.initial ?? {}) });
      }
      if (!cancelled) {
        setLoadedFor(targetKey);
        setActiveSection(config?.sections[0]?.id ?? '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, targetKey, loadedFor, config]);

  if (!target || !config || !meta || !projectId) return null;

  const section = config.sections.find((s) => s.id === activeSection) ?? config.sections[0];
  const nameFieldId = nameFieldIdOf(config);
  const name = deriveName(form, nameFieldId);

  const save = async () => {
    if (!name) {
      toast(
        nameFieldId
          ? `A ${nameFieldId} is required.`
          : 'Pick both characters for this relationship first.',
        { kind: 'error' }
      );
      return;
    }
    const data = splitForm(form, nameFieldId);
    if (target.mode === 'edit') {
      await updateEntity(target.entityId, data);
      toast(`${data.name} saved.`, { kind: 'success' });
    } else {
      await createEntity({ projectId, type: target.type, ...data });
      toast(`${data.name} added to ${meta.plural}.`, { kind: 'success' });
    }
    setLoadedFor('');
    close();
  };

  const cancel = () => {
    setLoadedFor('');
    close();
  };

  return (
    <div className="lw-drawer-backdrop" role="presentation" onClick={cancel}>
      <div
        className="lw-drawer"
        role="dialog"
        aria-label={`${target.mode === 'edit' ? 'Edit' : 'New'} ${config.displayName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lw-drawer__head">
          <div>
            <div className="lw-drawer__eyebrow" style={{ color: meta.deep }}>
              {meta.glyph} {target.mode === 'edit' ? `Edit ${config.displayName}` : `New ${config.displayName}`}
            </div>
            <h2 className="lw-drawer__title">{name || `Untitled ${config.displayName.toLowerCase()}`}</h2>
          </div>
          <button type="button" className="lw-iconbtn" aria-label="Close editor" onClick={cancel}>
            ×
          </button>
        </header>

        <div className="lw-drawer__body">
          <nav className="lw-drawer__nav" aria-label="Editor sections">
            {config.sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === section.id ? 'lw-navitem lw-navitem--sm' : 'lw-navitem lw-navitem--sm'}
                aria-current={s.id === section.id ? 'true' : undefined}
                onClick={() => setActiveSection(s.id)}
              >
                {s.title}
              </button>
            ))}
          </nav>

          <div className="lw-drawer__fields">
            {section.id === config.sections[0].id && (
              <p className="lw-fieldnote">{config.defaultSummary}</p>
            )}
            <div className="lw-fieldgrid">
              {section.fields.map((field) => (
                <div
                  key={field.id}
                  className={field.span === 2 ? 'lw-field lw-field--full' : 'lw-field'}
                >
                  <label className="lw-field__label" htmlFor={`field-${field.id}`}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  <FieldInput
                    field={field}
                    value={form[field.id]}
                    form={form}
                    onChange={(v) => setForm((f) => ({ ...f, [field.id]: v }))}
                  />
                  {field.hint && field.kind !== 'toggle' ? (
                    <p className="lw-fieldnote">{field.hint}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="lw-drawer__foot">
          <button type="button" className="lw-btn" onClick={cancel}>
            Cancel
          </button>
          <button type="button" className="lw-btn lw-btn--primary" onClick={save}>
            {target.mode === 'edit' ? 'Save changes' : `Create ${config.displayName.toLowerCase()}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
