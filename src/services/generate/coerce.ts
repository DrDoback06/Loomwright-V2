import type { StatRow, StepRow } from '@/domain/entity-configs/types';
import type { EntityRef, EntityType } from '@/domain/entity-types';
import { findKnownEntityMention, type KnownEntity } from '@/services/extraction/known-index';
import { newId } from '@/lib/id';
import { entitySpec, generableFields, TOP_LEVEL_FIELD_IDS, type FieldSpec } from './spec';
import type { BundleEntityDraft } from './types';

/** Trimmed, length-capped string or undefined. */
export function str(v: unknown, max = 2000): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/** Coerce anything (string or array) into a clean deduped string[]. */
export function strList(v: unknown, max = 40, itemMax = 400): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = str(item, itemMax);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, max);
}

/** Keep only values that belong to a known option set (case-insensitive). */
export function fromSet(values: string[], set: Set<string>): string[] {
  const canon = new Map([...set].map((o) => [o.toLowerCase(), o]));
  const out: string[] = [];
  for (const v of values) {
    const hit = canon.get(v.toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/** Match one value against an option list: exact (case-insensitive) first,
 * then unambiguous prefix/substring. Returns the canonical option. */
export function matchOption(value: string, options: readonly string[]): string | undefined {
  const lower = value.trim().toLowerCase();
  if (!lower) return undefined;
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const partial = options.filter(
    (o) => o.toLowerCase().startsWith(lower) || lower.startsWith(o.toLowerCase())
  );
  return partial.length === 1 ? partial[0] : undefined;
}

export interface CoerceContext {
  known: KnownEntity[];
  siblings: BundleEntityDraft[];
}

function resolveRelatedName(
  name: string,
  relatedType: EntityType | 'any' | undefined,
  ctx: CoerceContext
): EntityRef | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const pool =
    !relatedType || relatedType === 'any' ? ctx.known : ctx.known.filter((e) => e.type === relatedType);
  const hit = findKnownEntityMention(trimmed, pool, { threshold: 0.85 });
  if (hit) return { id: hit.entity.id, type: hit.entity.type, name: hit.entity.name };
  const lower = trimmed.toLowerCase();
  const sibling = ctx.siblings.find(
    (d) =>
      (relatedType === undefined || relatedType === 'any' || d.type === relatedType) &&
      (d.name.toLowerCase() === lower || d.aliases.some((a) => a.toLowerCase() === lower))
  );
  if (sibling) return { id: sibling.localId, type: sibling.type, name: sibling.name };
  return null;
}

/** Accept a name string, {name}, or a full EntityRef; resolve to a ref. */
function coerceRef(
  raw: unknown,
  relatedType: EntityType | 'any' | undefined,
  ctx: CoerceContext
): EntityRef | null {
  if (typeof raw === 'string') return resolveRelatedName(raw, relatedType, ctx);
  if (raw && typeof raw === 'object') {
    const r = raw as { id?: unknown; name?: unknown };
    const name = str(r.name, 120);
    if (typeof r.id === 'string') {
      const known = ctx.known.find((e) => e.id === r.id);
      if (known) return { id: known.id, type: known.type, name: known.name };
      const sibling = ctx.siblings.find((d) => d.localId === r.id);
      if (sibling) return { id: sibling.localId, type: sibling.type, name: sibling.name };
    }
    if (name) return resolveRelatedName(name, relatedType, ctx);
  }
  return null;
}

const STEP_STATUSES = new Set<StepRow['status']>(['pending', 'active', 'done', 'skipped']);

function coerceStatGrid(raw: unknown): StatRow[] | undefined {
  if (Array.isArray(raw)) {
    const rows: StatRow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const name = str(r.name, 60);
      if (!name) continue;
      const row: StatRow = { name, value: str(r.value, 60) ?? '' };
      const min = str(r.min, 20);
      const max = str(r.max, 20);
      if (min !== undefined) row.min = min;
      if (max !== undefined) row.max = max;
      rows.push(row);
    }
    return rows.length ? rows : undefined;
  }
  if (raw && typeof raw === 'object') {
    // Object-map form: { "STR": 14, "DEX": "12" }
    const rows: StatRow[] = [];
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      const v = str(value, 60);
      if (name.trim() && v !== undefined) rows.push({ name: name.trim(), value: v });
    }
    return rows.length ? rows : undefined;
  }
  return undefined;
}

function coerceStepList(raw: unknown): StepRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows: StepRow[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = str(item, 400);
      if (text) rows.push({ text, status: 'pending' });
      continue;
    }
    if (item && typeof item === 'object') {
      const r = item as Record<string, unknown>;
      const text = str(r.text ?? r.step ?? r.description, 400);
      if (!text) continue;
      const status =
        typeof r.status === 'string' && STEP_STATUSES.has(r.status.toLowerCase() as StepRow['status'])
          ? (r.status.toLowerCase() as StepRow['status'])
          : 'pending';
      rows.push({ text, status });
    }
  }
  return rows.length ? rows : undefined;
}

function coerceDualNumber(raw: unknown): { x?: string; y?: string } | undefined {
  if (Array.isArray(raw) && raw.length >= 2) {
    const x = str(raw[0], 20);
    const y = str(raw[1], 20);
    if (x !== undefined || y !== undefined) return { x: x ?? '', y: y ?? '' };
    return undefined;
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const x = str(r.x, 20);
    const y = str(r.y, 20);
    if (x !== undefined || y !== undefined) return { x: x ?? '', y: y ?? '' };
    return undefined;
  }
  if (typeof raw === 'string') {
    const m = /^\s*(-?[\d.]+)\s*[/,;x ]\s*(-?[\d.]+)\s*$/.exec(raw);
    if (m) return { x: m[1], y: m[2] };
  }
  return undefined;
}

export interface CoercedField {
  value: unknown | undefined;
  warnings: string[];
}

/** Coerce one wire value into the exact shape the field widget stores.
 * Undefined value = nothing usable; the field stays empty. */
export function coerceFieldValue(field: FieldSpec, raw: unknown, ctx: CoerceContext): CoercedField {
  const warnings: string[] = [];
  if (raw === null || raw === undefined) return { value: undefined, warnings };
  switch (field.kind) {
    case 'text':
      return { value: str(raw, 400), warnings };
    case 'textarea':
      return { value: str(raw, 2000), warnings };
    case 'longtext': {
      const joined = Array.isArray(raw) ? raw.filter((v) => typeof v === 'string').join('\n\n') : raw;
      return { value: str(joined, 20000), warnings };
    }
    case 'number':
      return { value: str(raw, 40), warnings };
    case 'dual-number':
      return { value: coerceDualNumber(raw), warnings };
    case 'toggle': {
      if (typeof raw === 'boolean') return { value: raw, warnings };
      if (typeof raw === 'string') {
        const v = raw.trim().toLowerCase();
        if (['true', 'yes', '1', 'on'].includes(v)) return { value: true, warnings };
        if (['false', 'no', '0', 'off'].includes(v)) return { value: false, warnings };
      }
      return { value: undefined, warnings };
    }
    case 'chips':
    case 'row-list': {
      const list = Array.isArray(raw) ? strList(raw) : strList(str(raw));
      return { value: list.length ? list : undefined, warnings };
    }
    case 'pills':
    case 'select': {
      const value = str(raw, 120);
      if (!value) return { value: undefined, warnings };
      const hit = matchOption(value, field.options ?? []);
      if (!hit) warnings.push(`"${value}" is not a valid ${field.label} option — dropped.`);
      return { value: hit, warnings };
    }
    case 'multiselect': {
      const values = strList(raw, 40, 120);
      const matched = values
        .map((v) => matchOption(v, field.options ?? []))
        .filter((v): v is string => Boolean(v));
      const deduped = [...new Set(matched)];
      if (values.length && !deduped.length) {
        warnings.push(`No valid ${field.label} options in "${values.join(', ')}" — dropped.`);
      }
      return { value: deduped.length ? deduped : undefined, warnings };
    }
    case 'stat-grid':
      return { value: coerceStatGrid(raw), warnings };
    case 'step-list':
      return { value: coerceStepList(raw), warnings };
    case 'related': {
      const ref = coerceRef(raw, field.related, ctx);
      if (!ref) {
        const label = typeof raw === 'string' ? raw : (raw as { name?: string })?.name;
        if (label) warnings.push(`Couldn't match "${label}" for ${field.label} — left empty.`);
      }
      return { value: ref ?? undefined, warnings };
    }
    case 'related-multi': {
      const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\n]/) : [raw];
      const refs: EntityRef[] = [];
      for (const item of items) {
        const ref = coerceRef(item, field.related, ctx);
        if (ref) {
          if (!refs.some((r) => r.id === ref.id)) refs.push(ref);
        } else {
          const label = typeof item === 'string' ? item.trim() : (item as { name?: string })?.name;
          if (label) warnings.push(`Couldn't match "${label}" for ${field.label} — skipped.`);
        }
      }
      return { value: refs.length ? refs : undefined, warnings };
    }
    default:
      // image / phrase-tester never travel on the wire.
      return { value: undefined, warnings };
  }
}

interface RawEntityShape {
  type?: unknown;
  name?: unknown;
  title?: unknown;
  aliases?: unknown;
  summary?: unknown;
  tags?: unknown;
  fields?: unknown;
  [key: string]: unknown;
}

export interface CoercedDraft {
  draft: BundleEntityDraft;
  warnings: string[];
}

/** Turn one wire entity object (nested `fields` bag, flat legacy JSON, or
 * anything in between) into an editor-shaped draft. Returns null when no
 * usable identity parses. Duplicate-name guard: an exact name/alias match
 * against an existing entity of the same type sets `existingEntityId`, so
 * accept merges fields instead of creating a duplicate row. */
export function coerceEntityDraft(
  type: EntityType,
  raw: unknown,
  ctx: CoerceContext,
  localId?: string
): CoercedDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const spec = entitySpec(type);
  if (!spec) return null;
  const r = raw as RawEntityShape;
  const warnings: string[] = [];

  // Field values may sit under `fields` or flat at the top level (legacy).
  const bag: Record<string, unknown> = {};
  if (r.fields && typeof r.fields === 'object' && !Array.isArray(r.fields)) {
    Object.assign(bag, r.fields as Record<string, unknown>);
  }
  for (const [key, value] of Object.entries(r)) {
    if (key === 'fields' || key === 'type' || TOP_LEVEL_FIELD_IDS.has(key)) continue;
    if (!(key in bag)) bag[key] = value;
  }

  const fields: Record<string, unknown> = {};
  const specFields = generableFields(spec);
  const byId = new Map(specFields.map((f) => [f.id.toLowerCase(), f]));
  const byLabel = new Map(specFields.map((f) => [f.label.toLowerCase(), f]));

  const draft: BundleEntityDraft = {
    localId: localId ?? newId(),
    type,
    name: '',
    aliases: strList(r.aliases, 12, 80),
    summary: str(r.summary ?? (type === 'lore' ? r.body : undefined), 2000) ?? '',
    tags: strList(r.tags, 16, 40),
    fields,
  };

  for (const [key, value] of Object.entries(bag)) {
    const field = byId.get(key.toLowerCase()) ?? byLabel.get(key.toLowerCase());
    if (!field) {
      warnings.push(`Ignored unknown field "${key}".`);
      continue;
    }
    if (field.id in fields) continue;
    const { value: coerced, warnings: fieldWarnings } = coerceFieldValue(field, value, ctx);
    warnings.push(...fieldWarnings);
    if (coerced !== undefined) fields[field.id] = coerced;
  }

  // Identity: accept name/title interchangeably; relationships derive
  // theirs from the from → to endpoints (mirrors the editor drawer).
  const rawName = str(r.name ?? r.title, 120);
  if (spec.nameField) {
    if (!rawName) return null;
    draft.name = rawName;
  } else {
    const from = fields.from as EntityRef | undefined;
    const to = fields.to as EntityRef | undefined;
    if (!from?.name || !to?.name) return null;
    draft.name = `${from.name} → ${to.name}`;
  }

  const dupe = findExactMatch(draft.name, type, ctx.known);
  if (dupe) {
    draft.existingEntityId = dupe.id;
    warnings.push(`"${draft.name}" matches the existing ${type} entry — accepting will update it.`);
  }

  return { draft, warnings };
}

/** Exact name/alias match only — fuzzy near-misses stay separate rows. */
function findExactMatch(name: string, type: EntityType, known: KnownEntity[]): KnownEntity | null {
  const lower = name.toLowerCase();
  for (const e of known) {
    if (e.type !== type) continue;
    if (e.name.toLowerCase() === lower) return e;
    if ((e.aliases ?? []).some((a) => a.toLowerCase() === lower)) return e;
  }
  return null;
}

/** Flat form-state prefill for the editor drawer (`openCreate` initial):
 * identity fields at the top level plus the coerced field bag. */
export function draftToInitialForm(draft: BundleEntityDraft): Record<string, unknown> {
  const spec = entitySpec(draft.type);
  const nameField = spec?.nameField ?? 'name';
  return {
    ...(spec?.nameField ? { [nameField]: draft.name } : {}),
    aliases: draft.aliases,
    summary: draft.summary,
    tags: draft.tags,
    ...draft.fields,
  };
}
