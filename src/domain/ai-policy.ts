import type { FieldDef } from './entity-configs/types';

/** Where an entity's policy lives inside the untyped `Entity.fields` bag.
 *
 * `__`-prefixed keys are machine bookkeeping rather than authored content —
 * the same convention `merge.ts` already uses for its synthetic `__summary`
 * row. Nothing declared in an entity config may start with `__`. */
export const AI_POLICY_KEY = '__ai';

/** True for a `fields` key that is settings or bookkeeping rather than
 * something the author wrote.
 *
 * Reserved keys must never reach a human-facing surface: not a merge
 * conflict row, not a template, not a world-bible export. They are not
 * secret — they simply are not content, and rendering them produces either
 * raw JSON or a bullet labelled `" ai"`. */
export function isReservedFieldKey(key: string): boolean {
  return key.startsWith('__');
}

export type AiContextPolicy = 'always' | 'detected' | 'never';

export interface EntityAiPolicy {
  /** `always` — in every prompt for every scene.
   *  `detected` — only when the name or an alias appears in the scene.
   *  `never` — excluded from context entirely, while still being tracked. */
  context: AiContextPolicy;
  /** Match this entity's names case-sensitively when scanning prose. The fix
   * for a character called Red, Will, May or Art, whose name is also an
   * ordinary word. Applies to the prose scan ONLY — resolving a name a model
   * emitted stays case-insensitive, because models return arbitrary case. */
  caseSensitive: boolean;
  /** Phrases that must never count as a mention of this entity, e.g. "the
   * Reach" for an entity named Reach. */
  exclusions: string[];
  /** Per-field override of the config's `aiHidden` default.
   * `true` = send it · `false` = never send it · absent = follow the config. */
  fieldVisibility: Record<string, boolean>;
}

export const DEFAULT_AI_POLICY: EntityAiPolicy = {
  // Matches novelcrafter, and it is what makes a codex feel alive: an entity
  // you mention by name arrives in the prompt without you doing anything.
  context: 'detected',
  caseSensitive: false,
  exclusions: [],
  fieldVisibility: {},
};

/** Read a policy out of the untyped bag.
 *
 * Guarded field by field rather than cast, for the same reason
 * `project-known.ts` guards `pronouns`: `Entity.fields` is
 * `Record<string, unknown>` and an import, an older schema or a hand-edited
 * archive can put anything in it. A malformed policy degrades to the default
 * instead of throwing somewhere far away. */
export function readAiPolicy(fields: Record<string, unknown> | undefined): EntityAiPolicy {
  const raw = fields?.[AI_POLICY_KEY];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_AI_POLICY;
  const bag = raw as Record<string, unknown>;
  return {
    context:
      bag.context === 'always' || bag.context === 'never' || bag.context === 'detected'
        ? bag.context
        : DEFAULT_AI_POLICY.context,
    caseSensitive: bag.caseSensitive === true,
    exclusions: Array.isArray(bag.exclusions)
      ? bag.exclusions.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
      : [],
    fieldVisibility:
      typeof bag.fieldVisibility === 'object' &&
      bag.fieldVisibility !== null &&
      !Array.isArray(bag.fieldVisibility)
        ? Object.fromEntries(
            Object.entries(bag.fieldVisibility).filter(
              (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
            )
          )
        : {},
  };
}

/** Whether this field's value is withheld from models for this entity.
 *
 * The config carries the opinion; the entity may override it in either
 * direction. Never recompute this inline — one helper is what keeps the
 * drawer, the assembler and the Copy-AI-prompt button agreeing. */
export function isFieldHiddenFromAi(field: FieldDef, policy: EntityAiPolicy): boolean {
  const override = policy.fieldVisibility[field.id];
  return typeof override === 'boolean' ? !override : field.aiHidden === true;
}
