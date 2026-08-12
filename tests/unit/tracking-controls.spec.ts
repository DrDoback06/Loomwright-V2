import { describe, expect, it } from 'vitest';
import { findRanges, isExcludedAt } from '@/services/extraction/text-utils';
import {
  buildKnownIndex,
  findEntityInSpan,
  findKnownEntityMention,
  resolvePronounsInText,
  scanTextForKnownEntities,
  type KnownEntity,
} from '@/services/extraction/known-index';
import { toKnownEntity } from '@/services/extraction/entity-to-known';
import { AI_POLICY_KEY, DEFAULT_AI_POLICY } from '@/domain/ai-policy';
import type { Entity } from '@/db/types';

const cast = (patch: Partial<KnownEntity>): KnownEntity => ({
  id: 'e1',
  type: 'cast',
  name: 'Red',
  ...patch,
});

describe('findRanges case option', () => {
  it('is case-insensitive by default, and that default is load-bearing', () => {
    // `extraction/engine.ts:180` lowercases a candidate name before calling
    // this, then recovers the casing by re-slicing the original text. A
    // case-sensitive default would make every discovery highlight vanish
    // silently — no error, just no spans.
    expect(findRanges('The Red door', 'red')).toHaveLength(1);
    expect(findRanges('The Red door', 'RED')).toHaveLength(1);
  });

  it('honours the opt-in', () => {
    expect(findRanges('The red door', 'Red', { caseSensitive: true })).toHaveLength(0);
    expect(findRanges('The Red door', 'Red', { caseSensitive: true })).toHaveLength(1);
  });

  it('keeps its word boundaries either way', () => {
    expect(findRanges('hessian cloth', 'Hess', { caseSensitive: true })).toHaveLength(0);
    expect(findRanges('hessian cloth', 'hess')).toHaveLength(0);
  });
});

describe('isExcludedAt', () => {
  const text = 'Ships from the Reach came. Reach the stone before dusk.';
  const first = text.indexOf('Reach');
  const second = text.indexOf('Reach', first + 1);

  it('suppresses by the surrounding phrase, not by the bare label', () => {
    // This is the whole reason exclusions are phrases: the entity's own name
    // is what is matching, so removing it from the label list would turn the
    // entity off entirely.
    expect(isExcludedAt(text, first, first + 5, ['the Reach'])).toBe(true);
    expect(isExcludedAt(text, second, second + 5, ['the Reach'])).toBe(false);
  });

  it('is inert with no exclusions', () => {
    expect(isExcludedAt(text, first, first + 5, [])).toBe(false);
    expect(isExcludedAt(text, first, first + 5, undefined)).toBe(false);
  });

  it('ignores a phrase that does not contain the match', () => {
    expect(isExcludedAt(text, first, first + 5, ['before dusk'])).toBe(false);
  });

  it('follows the entity’s case setting', () => {
    const lower = 'ships from the reach came.';
    const at = lower.indexOf('reach');
    expect(isExcludedAt(lower, at, at + 5, ['the Reach'], false)).toBe(true);
    expect(isExcludedAt(lower, at, at + 5, ['the Reach'], true)).toBe(false);
  });

  it('works at the very start of the text without underflowing', () => {
    expect(isExcludedAt('Reach the stone', 0, 5, ['the Reach'])).toBe(false);
  });
});

describe('the prose scan honours both controls', () => {
  const text = 'The red door. Red waited. Ships from the Reach came. Reach the stone.';

  it('case-sensitivity drops the ordinary-word match and keeps the name', () => {
    const loose = scanTextForKnownEntities(text, [cast({})]);
    const strict = scanTextForKnownEntities(text, [cast({ caseSensitive: true })]);
    expect(loose).toHaveLength(2);
    expect(strict).toHaveLength(1);
    expect(strict[0].exactText).toBe('Red');
  });

  it('exclusions drop only the excluded occurrence', () => {
    const place: KnownEntity = { id: 'reach', type: 'locations', name: 'Reach' };
    expect(scanTextForKnownEntities(text, [place])).toHaveLength(2);
    const filtered = scanTextForKnownEntities(text, [{ ...place, exclusions: ['the Reach'] }]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].start).toBe(text.lastIndexOf('Reach'));
  });
});

describe('findEntityInSpan honours both controls', () => {
  const text = 'The red door. Ships from the Reach came. Reach the stone.';

  it('skips a case mismatch', () => {
    const span = { start: 0, end: 13 };
    expect(findEntityInSpan(text, span, buildKnownIndex([cast({})]))).not.toBeNull();
    expect(
      findEntityInSpan(text, span, buildKnownIndex([cast({ caseSensitive: true })]))
    ).toBeNull();
  });

  it('walks past an excluded hit to a real one later in the span', () => {
    // The naive implementation gives up on the entity at the first hit, which
    // would hide the genuine mention sitting behind the excluded one.
    const index = buildKnownIndex([
      { id: 'reach', type: 'locations', name: 'Reach', exclusions: ['the Reach'] },
    ]);
    const hit = findEntityInSpan(text, { start: 14, end: text.length }, index);
    expect(hit?.offset).toBe(text.lastIndexOf('Reach'));
  });
});

describe('resolvePronounsInText honours both controls', () => {
  it('does not seed a pronoun antecedent from a suppressed match', () => {
    const text = 'The red door stood open. She had left it that way.';
    const loose = resolvePronounsInText(text, [cast({ gender: 'female' })]);
    const strict = resolvePronounsInText(text, [cast({ gender: 'female', caseSensitive: true })]);
    expect(loose.length).toBeGreaterThan(0);
    expect(strict).toHaveLength(0);
  });
});

describe('the controls stop at the prose scan', () => {
  it('findKnownEntityMention still resolves a name whatever case a model used', () => {
    // Six of its callers pass a name a MODEL produced. If this honoured
    // `caseSensitive`, every AI round-trip would silently stop resolving that
    // entity — the finding would just be dropped.
    const strict = [cast({ name: 'Vex Ilmaren', caseSensitive: true })];
    expect(findKnownEntityMention('vex ilmaren', strict)?.entity.id).toBe('e1');
    expect(findKnownEntityMention('VEX ILMAREN', strict)?.entity.id).toBe('e1');
  });

  it('findKnownEntityMention ignores exclusions too', () => {
    // An exclusion is about the words around a match in prose. There is no
    // surrounding text here — only a bare name — so it cannot apply.
    const place = [{ id: 'reach', type: 'locations' as const, name: 'Reach', exclusions: ['the Reach'] }];
    expect(findKnownEntityMention('Reach', place)?.entity.id).toBe('reach');
  });
});

describe('toKnownEntity carries the policy', () => {
  function entity(fields: Record<string, unknown>): Entity {
    return {
      id: 'e1',
      projectId: 'p1',
      type: 'cast',
      name: 'Red',
      aliases: [],
      summary: '',
      status: 'active',
      tags: [],
      fields,
      createdAt: 1,
      updatedAt: 1,
    };
  }

  it('leaves both undefined when the author has no opinion', () => {
    // Optional is load-bearing: two producers hand-build this literal and
    // every fixture seeds a bare object.
    const known = toKnownEntity(entity({}));
    expect(known.caseSensitive).toBeUndefined();
    expect(known.exclusions).toBeUndefined();
  });

  it('carries a configured policy through to the matcher', () => {
    const known = toKnownEntity(
      entity({
        [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, caseSensitive: true, exclusions: ['the Reach'] },
      })
    );
    expect(known.caseSensitive).toBe(true);
    expect(known.exclusions).toEqual(['the Reach']);
    expect(scanTextForKnownEntities('The red door.', [known])).toHaveLength(0);
  });
});
