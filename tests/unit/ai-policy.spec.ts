import { describe, expect, it } from 'vitest';
import {
  AI_POLICY_KEY,
  DEFAULT_AI_POLICY,
  isFieldHiddenFromAi,
  isReservedFieldKey,
  readAiPolicy,
} from '@/domain/ai-policy';
import type { FieldDef } from '@/domain/entity-configs/types';
import { getEntityConfig } from '@/domain/entity-configs';

const plain: FieldDef = { id: 'personality', label: 'Personality', kind: 'textarea' };
const hidden: FieldDef = { id: 'physicalDescription', label: 'Physical', kind: 'longtext', aiHidden: true };

describe('readAiPolicy', () => {
  it('defaults to "when detected" for an entity that has never been configured', () => {
    expect(readAiPolicy({})).toEqual(DEFAULT_AI_POLICY);
    expect(readAiPolicy(undefined).context).toBe('detected');
  });

  it('reads a stored policy back', () => {
    const stored = {
      [AI_POLICY_KEY]: {
        context: 'always',
        caseSensitive: true,
        exclusions: ['the Reach'],
        fieldVisibility: { physicalDescription: true },
      },
    };
    expect(readAiPolicy(stored)).toEqual({
      context: 'always',
      caseSensitive: true,
      exclusions: ['the Reach'],
      fieldVisibility: { physicalDescription: true },
    });
  });

  it('degrades to the default rather than throwing on a malformed bag', () => {
    // `Entity.fields` is Record<string, unknown>; an import or a hand-edited
    // archive can put anything here. A bad policy must not take out the
    // whole prompt path.
    expect(readAiPolicy({ [AI_POLICY_KEY]: 'nonsense' })).toEqual(DEFAULT_AI_POLICY);
    expect(readAiPolicy({ [AI_POLICY_KEY]: [1, 2] })).toEqual(DEFAULT_AI_POLICY);
    expect(readAiPolicy({ [AI_POLICY_KEY]: null })).toEqual(DEFAULT_AI_POLICY);
  });

  it('discards junk inside an otherwise valid policy', () => {
    const policy = readAiPolicy({
      [AI_POLICY_KEY]: {
        context: 'sideways',
        caseSensitive: 'yes',
        exclusions: ['ok', 42, '', '   ', null],
        fieldVisibility: { a: true, b: 'maybe', c: false },
      },
    });
    expect(policy.context).toBe('detected');
    expect(policy.caseSensitive).toBe(false);
    expect(policy.exclusions).toEqual(['ok']);
    expect(policy.fieldVisibility).toEqual({ a: true, c: false });
  });
});

describe('isFieldHiddenFromAi', () => {
  it('follows the config when the entity has no opinion', () => {
    expect(isFieldHiddenFromAi(plain, DEFAULT_AI_POLICY)).toBe(false);
    expect(isFieldHiddenFromAi(hidden, DEFAULT_AI_POLICY)).toBe(true);
  });

  it('overrides the config in both directions', () => {
    // A single `hiddenFieldIds` array could only express the first of these.
    const showHidden = { ...DEFAULT_AI_POLICY, fieldVisibility: { physicalDescription: true } };
    const hideShown = { ...DEFAULT_AI_POLICY, fieldVisibility: { personality: false } };
    expect(isFieldHiddenFromAi(hidden, showHidden)).toBe(false);
    expect(isFieldHiddenFromAi(plain, hideShown)).toBe(true);
  });
});

describe('isReservedFieldKey', () => {
  it('claims the __ prefix and nothing else', () => {
    expect(isReservedFieldKey('__ai')).toBe(true);
    expect(isReservedFieldKey('__summary')).toBe(true);
    expect(isReservedFieldKey('personality')).toBe(false);
    expect(isReservedFieldKey('timelineFacts')).toBe(false);
  });

  it('is disjoint from every id any entity config declares', () => {
    // The reserved namespace is only safe while no real field lives in it.
    for (const type of ['cast', 'items', 'locations', 'stats', 'quests'] as const) {
      for (const section of getEntityConfig(type)?.sections ?? []) {
        for (const field of section.fields) {
          expect(isReservedFieldKey(field.id)).toBe(false);
        }
      }
    }
  });
});

describe('the appearance default', () => {
  it('is carried by the cast config, not written into entity rows', () => {
    // Storing it on create would freeze today's opinion into data and reach
    // only entities made after the change.
    const appearance = getEntityConfig('cast')?.sections.find((s) => s.id === 'appearance');
    expect(appearance?.fields.filter((f) => f.aiHidden === true).map((f) => f.id)).toEqual([
      'physicalDescription',
      'clothing',
      'distinguishingMarks',
    ]);
  });
});
