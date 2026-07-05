import { useEffect, useMemo, useState } from 'react';
import { getEntityConfig } from '@/domain/entity-configs';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { createEntity, getEntity, updateEntity } from '@/db/repos/entities';
import type { Entity } from '@/db/types';
import { useEditorStore } from '@/stores/editor';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';
import { nameFieldIdOf, TOP_LEVEL_FIELD_IDS as TOP_LEVEL_FIELDS } from '@/services/generate/spec';
import { coerceEntityDraft, draftToInitialForm } from '@/services/generate/coerce';
import { loadKnownEntities } from '@/services/generate/known';
import { generateRandomBundle, rollEmptyFields, rollField } from '@/services/generate/random/engine';
import { parseJsonObject } from '@/services/ai/ai-candidates';
import type { FieldDef } from '@/domain/entity-configs/types';
import { FieldInput } from './fields/FieldInput';

/** Kinds the per-field dice can roll something for. */
const ROLLABLE_KINDS = new Set<FieldDef['kind']>([
  'text', 'textarea', 'longtext', 'chips', 'pills', 'select', 'multiselect',
  'toggle', 'number', 'related', 'related-multi',
]);

type FormState = Record<string, unknown>;

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
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

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
    setPasteOpen(false);
    setPasteText('');
    close();
  };

  const generation = target.mode === 'create' ? target.generation : undefined;

  /** Per-field dice: fresh themed content for just this field. */
  const rollOne = async (field: FieldDef) => {
    const known = await loadKnownEntities(projectId);
    const value = rollField(target.type, field.id, {
      projectId,
      known,
      theme: generation?.theme,
      hint: generation?.hint,
    });
    if (value === undefined) {
      toast(`Nothing to roll for ${field.label} yet — add some entries to link first.`, { kind: 'info' });
      return;
    }
    setForm((f) => ({ ...f, [field.id]: value }));
  };

  /** Random-fill only the fields that are still blank. */
  const fillEmpty = async () => {
    const known = await loadKnownEntities(projectId);
    const rolled = rollEmptyFields(target.type, form, {
      projectId,
      known,
      theme: generation?.theme,
      hint: generation?.hint,
    });
    const count = Object.keys(rolled).length;
    if (!count) {
      toast('Every field already has something — nothing to fill.', { kind: 'info' });
      return;
    }
    setForm((f) => ({ ...f, ...rolled }));
    toast(`${count} field${count === 1 ? '' : 's'} filled.`, { kind: 'success' });
  };

  /** Fresh draft, same theme/hint — replaces the whole form. */
  const rerollAll = async () => {
    const known = await loadKnownEntities(projectId);
    const bundle = generateRandomBundle(
      { kind: 'entity', entityType: target.type, theme: generation?.theme, hint: generation?.hint },
      { projectId, known }
    );
    const draft = bundle.entities[0];
    if (!draft) return;
    setForm({ aliases: [], tags: [], ...draftToInitialForm(draft) });
  };

  /** Paste entity JSON (from Copy as JSON, an external AI, or by hand):
   * every recognised field coerces into the form; blanks stay untouched. */
  const applyPastedJson = async () => {
    const parsed = parseJsonObject(pasteText);
    if (!parsed) {
      toast('No JSON object found in that text.', { kind: 'error' });
      return;
    }
    const known = await loadKnownEntities(projectId);
    const result = coerceEntityDraft(target.type, parsed, { known, siblings: [] });
    if (!result) {
      toast('That JSON has no usable name/title for this entry type.', { kind: 'error' });
      return;
    }
    const incoming = draftToInitialForm(result.draft);
    const values = Object.entries(incoming).filter(
      ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
    );
    setForm((f) => ({ ...f, ...Object.fromEntries(values) }));
    setPasteOpen(false);
    setPasteText('');
    toast(
      `${values.length} field${values.length === 1 ? '' : 's'} filled from JSON${
        result.warnings.length ? ` (${result.warnings.length} skipped — see the fields)` : ''
      }.`,
      { kind: 'success' }
    );
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
          <div className="lw-drawer__headactions">
            <button
              type="button"
              className="lw-btn"
              aria-pressed={pasteOpen}
              onClick={() => setPasteOpen((v) => !v)}
            >
              Paste JSON
            </button>
            <button type="button" className="lw-iconbtn" aria-label="Close editor" onClick={cancel}>
              ×
            </button>
          </div>
        </header>

        {pasteOpen ? (
          <div className="lw-drawer__paste" data-testid="drawer-paste">
            <textarea
              className="lw-input"
              rows={5}
              placeholder="Paste entity JSON — fields auto-fill across every tab."
              aria-label="Entity JSON"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="lw-chips__add">
              <button
                type="button"
                className="lw-btn lw-btn--primary"
                disabled={!pasteText.trim()}
                onClick={() => void applyPastedJson()}
              >
                Fill fields
              </button>
              <button type="button" className="lw-btn" onClick={() => setPasteOpen(false)}>
                Close
              </button>
            </div>
          </div>
        ) : null}

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
                  <span className="lw-field__labelrow">
                    <label className="lw-field__label" htmlFor={`field-${field.id}`}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {target.mode === 'create' &&
                    ROLLABLE_KINDS.has(field.kind) &&
                    !TOP_LEVEL_FIELDS.has(field.id) ? (
                      <button
                        type="button"
                        className="lw-iconbtn lw-dice"
                        aria-label={`Reroll ${field.label}`}
                        title={`Reroll ${field.label}`}
                        onClick={() => void rollOne(field)}
                      >
                        🎲
                      </button>
                    ) : null}
                  </span>
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
          {target.mode === 'create' ? (
            <span className="lw-drawer__foot-tools">
              <button
                type="button"
                className="lw-btn"
                title="Random-fill only the blank fields"
                onClick={() => void fillEmpty()}
              >
                🎲 Fill empty fields
              </button>
              <button
                type="button"
                className="lw-btn"
                title="Replace everything with a fresh roll"
                onClick={() => void rerollAll()}
              >
                Reroll all
              </button>
            </span>
          ) : null}
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
