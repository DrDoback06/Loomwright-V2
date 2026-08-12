import type { EntityRef } from '@/domain/entity-types';

/** An entity ref, not merely something with a name. A stat row is
 * `{name, value}` and must render as "Grit: 3", not "Grit" — so the check
 * needs `id` and `type` the way `services/relations.ts` does it. */
function isRefLike(v: unknown): v is EntityRef {
  const r = v as Partial<EntityRef>;
  return typeof r.id === 'string' && typeof r.type === 'string' && typeof r.name === 'string';
}

/**
 * One field value as the plain text a model should read.
 *
 * Deliberately NOT `renderValue` from `archive/world-bible.ts`, which is
 * module-private and shaped for markdown bullets in a document a person
 * reads. Sharing it would drag the world bible's formatting decisions into
 * every prompt, and the two want different things: the bible can afford
 * `**bold**` and blank lines, a prompt cannot.
 *
 * Returns `''` for anything with no useful text, so callers can drop empty
 * fields with one falsy check.
 */
export function fieldValueToText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  // A false boolean is not worth a line in a prompt — "Deceased: no" invites
  // a model to mention it. Only the true case says anything.
  if (typeof value === 'boolean') return value ? 'yes' : '';
  if (Array.isArray(value)) {
    return value.map(fieldValueToText).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // An entity ref, a stat row, or a quest step — all carry their own label.
    if (isRefLike(v)) return v.name.trim();
    if (typeof v.text === 'string') {
      const status = typeof v.status === 'string' && v.status ? ` (${v.status})` : '';
      return `${v.text.trim()}${status}`;
    }
    if (typeof v.name === 'string' && v.value != null) {
      return `${v.name}: ${fieldValueToText(v.value)}`;
    }
    // A dual-number pair, or anything else with no label. Coordinates are
    // meaningless to a model writing prose, so say nothing rather than
    // emitting "[object Object]" or a raw JSON blob.
    return '';
  }
  return '';
}
