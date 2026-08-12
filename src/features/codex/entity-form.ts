/**
 * Pure form <-> entity mapping for the codex editor drawer.
 *
 * Extracted from the component so the round-trip can be unit-tested without
 * React. That matters more than it looks: `splitForm` is what preserves
 * reserved keys like `__ai` across an ordinary field edit, and it does so
 * *incidentally* — it copies every non-top-level key rather than rebuilding
 * from the entity config. `updateEntity` replaces the whole `fields` bag, so
 * the day that changes, every AI policy in the project resets with nothing on
 * screen to show it.
 */
import type { Entity } from '@/db/types';
import { TOP_LEVEL_FIELD_IDS as TOP_LEVEL_FIELDS } from '@/services/generate/spec';

export type FormState = Record<string, unknown>;

/** A synthetic section id — not in any entity config. The AI policy is
 * settings rather than authored content, so it has no `FieldDef`s. */
export const AI_SECTION_ID = '__ai';

export function formFromEntity(entity: Entity, nameFieldId: 'name' | 'title' | null): FormState {
  return {
    ...(nameFieldId ? { [nameFieldId]: entity.name } : {}),
    aliases: entity.aliases,
    summary: entity.summary,
    tags: entity.tags,
    ...entity.fields,
  };
}

export function deriveName(form: FormState, nameFieldId: 'name' | 'title' | null): string {
  if (nameFieldId) return String(form[nameFieldId] ?? '').trim();
  const from = form.from as { name?: string } | undefined;
  const to = form.to as { name?: string } | undefined;
  if (from?.name && to?.name) return `${from.name} → ${to.name}`;
  return '';
}

export function splitForm(form: FormState, nameFieldId: 'name' | 'title' | null) {
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
