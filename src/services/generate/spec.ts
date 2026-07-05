import { getEntityConfig } from '@/domain/entity-configs';
import type { EntityConfig, FieldDef } from '@/domain/entity-configs/types';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';

/** Some configs (quests, events, lore, references, timeline) call their
 * name field 'title'; relationships have neither and derive theirs from
 * from → to. Shared with the editor drawer. */
export function nameFieldIdOf(config: EntityConfig): 'name' | 'title' | null {
  for (const section of config.sections) {
    for (const f of section.fields) {
      if (f.id === 'name') return 'name';
      if (f.id === 'title') return 'title';
    }
  }
  return null;
}

/** Field ids that live on the Entity record itself rather than in
 * entity.fields — kept aligned with the editor drawer and import paths. */
export const TOP_LEVEL_FIELD_IDS = new Set(['name', 'title', 'aliases', 'summary', 'tags']);

/** Kinds that never travel on the wire or get generated. */
const SKIPPED_KINDS = new Set<FieldDef['kind']>(['image', 'phrase-tester']);

export interface FieldSpec extends FieldDef {
  sectionTitle: string;
}

export interface EntitySpec {
  type: EntityType;
  displayName: string;
  description: string;
  nameField: 'name' | 'title' | null;
  /** Every editor field, in section order (identity fields included). */
  fields: FieldSpec[];
}

/** Machine-readable view of an entity config — the single source the AI
 * prompts, wire schemas, paste coercion, and random fill targets derive
 * from, so all 16 types get generation coverage from their configs. */
export function entitySpec(type: EntityType): EntitySpec | null {
  const config = getEntityConfig(type);
  if (!config) return null;
  const fields: FieldSpec[] = [];
  for (const section of config.sections) {
    for (const f of section.fields) {
      fields.push({ ...f, sectionTitle: section.title });
    }
  }
  return {
    type,
    displayName: config.displayName,
    description: config.defaultSummary,
    nameField: nameFieldIdOf(config),
    fields,
  };
}

/** The fields a generator should fill: everything except identity fields
 * (handled at the draft level) and interactive/binary kinds. */
export function generableFields(spec: EntitySpec): FieldSpec[] {
  return spec.fields.filter((f) => !TOP_LEVEL_FIELD_IDS.has(f.id) && !SKIPPED_KINDS.has(f.kind));
}

function relatedLabel(field: FieldDef): string {
  if (!field.related || field.related === 'any') return 'any codex entry';
  return ENTITY_TYPE_META[field.related].plural.toLowerCase();
}

/** Example wire value per field, used to render the JSON shape external
 * AIs (and users) fill in. Related fields travel as NAMES, never ids. */
export function wireExampleValue(field: FieldDef): unknown {
  switch (field.kind) {
    case 'chips':
    case 'row-list':
    case 'multiselect':
      return [];
    case 'toggle':
      return false;
    case 'number':
      return '';
    case 'dual-number':
      return { x: '', y: '' };
    case 'related':
      return `<name of a ${relatedLabel(field)} entry>`;
    case 'related-multi':
      return [];
    case 'stat-grid':
      return [{ name: '', value: '' }];
    case 'step-list':
      return [{ text: '', status: 'pending' }];
    default:
      return '';
  }
}

/** The JSON object shape one entity of this type takes on the wire. */
export function wireExample(type: EntityType): Record<string, unknown> {
  const spec = entitySpec(type);
  if (!spec) return {};
  const fields: Record<string, unknown> = {};
  for (const f of generableFields(spec)) fields[f.id] = wireExampleValue(f);
  return {
    type,
    [spec.nameField ?? 'name']: '',
    aliases: [],
    summary: '',
    tags: [],
    fields,
  };
}

function fieldGuidance(field: FieldSpec): string {
  switch (field.kind) {
    case 'pills':
    case 'select':
      return `one of: ${(field.options ?? []).join(' | ')}`;
    case 'multiselect':
      return `any of: ${(field.options ?? []).join(' | ')} (list)`;
    case 'chips':
    case 'row-list':
      return 'list of short strings';
    case 'toggle':
      return 'true or false';
    case 'number':
      return 'a number';
    case 'dual-number':
      return 'object { "x": number, "y": number }';
    case 'related':
      return `the name of one ${relatedLabel(field)} entry (existing or new)`;
    case 'related-multi':
      return `names of ${relatedLabel(field)} entries (list)`;
    case 'stat-grid':
      return 'list of { "name": string, "value": string }';
    case 'step-list':
      return 'list of { "text": string, "status": "pending"|"active"|"done"|"skipped" }';
    case 'longtext':
      return 'a paragraph or two of prose';
    default:
      return 'short text';
  }
}

/** Compact per-field guidance lines for AI prompts:
 * `- skillType (Skill type, required): one of: active | passive | …` */
export function promptFieldLines(type: EntityType): string[] {
  const spec = entitySpec(type);
  if (!spec) return [];
  return generableFields(spec).map((f) => {
    const flags = f.required ? ', required' : '';
    const hint = f.hint ? ` — ${f.hint}` : '';
    return `- ${f.id} (${f.label}${flags}): ${fieldGuidance(f)}${hint}`;
  });
}
