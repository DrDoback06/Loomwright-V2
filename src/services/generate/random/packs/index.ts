import type { EntityType } from '@/domain/entity-types';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import { hintWords, THEMES, type ThemeId } from './lexicon';
import { generateGenericDraft, type GenCtx } from './generic';

/** One coherent flavor within a pack: "poison", "sorcerer", "holy"…
 * A single archetype (plus a single rng) drives every field of a draft
 * and every draft of a bundle, so results cohere by construction. */
export interface Archetype {
  id: string;
  /** Hint tokens that select this archetype ("sorcerer", "mage", "spell"). */
  keywords: string[];
  /** Themes it belongs to; 'any' fits every theme. */
  themes: ThemeId[] | 'any';
  /** Slot pools the pack's grammars draw from (verbs, nouns, costs…). */
  lexicon: Record<string, string[]>;
  /** Skill packs: branch names a generated tree can use. */
  branchNames?: string[];
}

/** A deep, hand-authored generator for one entity type. */
export interface TypePack {
  type: EntityType;
  archetypes: Archetype[];
  generate(rng: Rng, arch: Archetype, ctx: GenCtx): BundleEntityDraft;
}

/** Deep packs land per milestone (skills in G3; cast/quests/items/… in G4).
 * Types without one use the config-driven generic filler. */
const DEEP_PACKS: Partial<Record<EntityType, TypePack>> = {};

export function registerPack(pack: TypePack): void {
  DEEP_PACKS[pack.type] = pack;
}

export function deepPackFor(type: EntityType): TypePack | undefined {
  return DEEP_PACKS[type];
}

/** Resolve a UI theme value ('' / 'any' → random) to a concrete theme. */
export function resolveTheme(rng: Rng, theme?: string): ThemeId {
  const known = THEMES.find((t) => t.id === theme);
  return known ? known.id : rng.pick(THEMES).id;
}

/** Score archetypes by hint-keyword overlap within the chosen theme; fall
 * back to a random theme-fitting archetype. Unmatched hint words still
 * flavor names via the lexicon. */
export function matchArchetype(rng: Rng, pack: TypePack, theme: ThemeId, hint: string): Archetype {
  const words = new Set(hintWords(hint));
  const fitting = pack.archetypes.filter((a) => a.themes === 'any' || a.themes.includes(theme));
  const pool = fitting.length ? fitting : pack.archetypes;
  let best: Archetype | null = null;
  let bestScore = 0;
  for (const arch of pool) {
    const score = arch.keywords.reduce((n, k) => n + (words.has(k) ? 1 : 0), 0);
    if (score > bestScore) {
      best = arch;
      bestScore = score;
    }
  }
  return best ?? rng.pick(pool);
}

/** Generate one entity draft: deep pack when one exists, generic otherwise. */
export function generateDraftFor(rng: Rng, type: EntityType, ctx: GenCtx): BundleEntityDraft {
  const pack = DEEP_PACKS[type];
  if (pack) {
    const arch = matchArchetype(rng, pack, ctx.theme, ctx.hint);
    return pack.generate(rng, arch, ctx);
  }
  return generateGenericDraft(rng, type, ctx);
}
