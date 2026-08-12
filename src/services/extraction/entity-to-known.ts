import type { Entity } from '@/db/types';
import type { KnownEntity } from './known-index';
import { readAiPolicy } from '@/domain/ai-policy';

/** The one place a stored entity becomes the shape the engine matches on.
 *
 * There were seven of these, hand-rolled, and they had already drifted:
 * `intelligence/engine.ts` read `fields.statPhrases` while the stats config
 * actually writes `extractionRules`, so whole-book intake had never seen a
 * single author-defined stat phrase. Four of the seven dropped pronouns and
 * gender entirely, which silently disabled pronoun resolution on those
 * paths.
 *
 * Type-only imports, so this stays usable from anywhere without dragging
 * Dexie in — `known-index.ts` itself is deliberately decoupled from the
 * database record so fixtures can seed plain objects, and that stays true.
 *
 * `extraAliases` carries the identity lessons the author has already
 * confirmed; only the project loader has them to hand. */
export function toKnownEntity(entity: Entity, extraAliases: readonly string[] = []): KnownEntity {
  const policy = readAiPolicy(entity.fields);
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    aliases: [...new Set([...(entity.aliases ?? []), ...extraAliases])],
    pronouns: typeof entity.fields.pronouns === 'string' ? entity.fields.pronouns : undefined,
    gender: typeof entity.fields.gender === 'string' ? entity.fields.gender : undefined,
    statPhrases:
      entity.type === 'stats' && Array.isArray(entity.fields.extractionRules)
        ? entity.fields.extractionRules.filter((p): p is string => typeof p === 'string')
        : undefined,
    caseSensitive: policy.caseSensitive || undefined,
    exclusions: policy.exclusions.length ? policy.exclusions : undefined,
  };
}

/** Whether an entity belongs in the extraction vocabulary at all.
 *
 * A merged record is a redirect, not a thing in the world: its name is
 * usually already an alias of the survivor, so scanning for it separately
 * only produces a second finding for one mention. Archived entities are
 * deliberately still included — an archived character who appears in
 * chapter three should still be recognised there. */
export function isLiveEntity(entity: Entity): boolean {
  return entity.status !== 'merged' && !entity.mergedIntoId;
}
