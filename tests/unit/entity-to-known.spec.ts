import { describe, expect, it } from 'vitest';
import { isLiveEntity, toKnownEntity } from '@/services/extraction/entity-to-known';
import type { Entity } from '@/db/types';

function entity(patch: Partial<Entity> = {}): Entity {
  return {
    id: 'e1',
    projectId: 'p1',
    type: 'cast',
    name: 'Grimguff',
    aliases: ['Grim'],
    summary: '',
    status: 'active',
    tags: [],
    fields: {},
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

/** There were seven hand-rolled copies of this mapping and they had already
 * drifted apart. These tests exist to stop an eighth, and to pin the two
 * bugs the consolidation fixed. */
describe('toKnownEntity', () => {
  it('carries the name and both kinds of alias', () => {
    const known = toKnownEntity(entity(), ['Graham']);
    expect(known.name).toBe('Grimguff');
    expect(known.aliases).toEqual(['Grim', 'Graham']);
  });

  it('does not repeat an alias the author has also confirmed', () => {
    expect(toKnownEntity(entity(), ['Grim']).aliases).toEqual(['Grim']);
  });

  it('carries pronouns and gender, which four of the seven copies dropped', () => {
    // Dropping these silently disabled pronoun resolution on those paths —
    // no error, just a scan that stopped finding "she" anywhere.
    const known = toKnownEntity(entity({ fields: { pronouns: 'he/him', gender: 'male' } }));
    expect(known.pronouns).toBe('he/him');
    expect(known.gender).toBe('male');
  });

  it('reads stat phrases from the field the stats config actually writes', () => {
    // `intelligence/engine.ts` read `fields.statPhrases`. The config writes
    // `extractionRules`. Whole-book intake had therefore never seen a single
    // author-defined phrase rule.
    const stat = entity({
      type: 'stats',
      fields: { extractionRules: ['felt the cold', 'shivered'] },
    });
    expect(toKnownEntity(stat).statPhrases).toEqual(['felt the cold', 'shivered']);
  });

  it('only reads stat phrases for stats', () => {
    const notAStat = entity({ fields: { extractionRules: ['nonsense'] } });
    expect(toKnownEntity(notAStat).statPhrases).toBeUndefined();
  });

  it('refuses to trust the untyped bag', () => {
    // `Entity.fields` is `Record<string, unknown>`; an import or an older
    // schema can put anything in it, and a number where a string belongs
    // would reach a regex constructor.
    const junk = entity({
      type: 'stats',
      fields: { pronouns: 42, gender: null, extractionRules: ['ok', 7, null] },
    });
    const known = toKnownEntity(junk);
    expect(known.pronouns).toBeUndefined();
    expect(known.gender).toBeUndefined();
    expect(known.statPhrases).toEqual(['ok']);
  });

  it('survives an entity with no aliases at all', () => {
    expect(toKnownEntity(entity({ aliases: [] })).aliases).toEqual([]);
  });
});

describe('isLiveEntity', () => {
  it('keeps active and archived entities in the vocabulary', () => {
    // An archived character who appears in chapter three should still be
    // recognised there.
    expect(isLiveEntity(entity())).toBe(true);
    expect(isLiveEntity(entity({ status: 'archived' }))).toBe(true);
  });

  it('drops a merged record, by either marker', () => {
    // A merged record is a redirect, not a thing in the world: its name is
    // usually already an alias of the survivor, so scanning for it again
    // produces a second finding for one mention.
    expect(isLiveEntity(entity({ status: 'merged' }))).toBe(false);
    expect(isLiveEntity(entity({ mergedIntoId: 'e2' }))).toBe(false);
  });
});
