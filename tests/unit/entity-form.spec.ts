import { describe, expect, it } from 'vitest';
import { AI_SECTION_ID, formFromEntity, splitForm } from '@/features/codex/entity-form';
import { AI_POLICY_KEY, DEFAULT_AI_POLICY } from '@/domain/ai-policy';
import type { Entity } from '@/db/types';

function entity(fields: Record<string, unknown> = {}): Entity {
  return {
    id: 'e1',
    projectId: 'p1',
    type: 'cast',
    name: 'Grimguff',
    aliases: ['Grim'],
    summary: 'A man with a clipboard.',
    status: 'active',
    tags: ['pov'],
    fields,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('the drawer form round-trip', () => {
  it('preserves the AI policy across an ordinary field edit', () => {
    // THE test for this module. `updateEntity` replaces the whole `fields`
    // bag, so if `splitForm` ever stops copying unknown keys — for instance
    // by rebuilding from the entity config, which looks like a tidy-up —
    // every policy in the project silently resets and nothing on screen says
    // so. There is no error, no toast, and no failing type.
    const policy = { ...DEFAULT_AI_POLICY, context: 'never' as const, caseSensitive: true };
    const form = formFromEntity(entity({ [AI_POLICY_KEY]: policy, personality: 'Weary' }), 'name');
    form.personality = 'Weary, but hopeful';

    expect(splitForm(form, 'name').fields[AI_POLICY_KEY]).toEqual(policy);
  });

  it('keeps the policy out of the top-level entity columns', () => {
    const data = splitForm(
      formFromEntity(entity({ [AI_POLICY_KEY]: DEFAULT_AI_POLICY }), 'name'),
      'name'
    );
    expect(data.name).toBe('Grimguff');
    expect(data.aliases).toEqual(['Grim']);
    expect(data.tags).toEqual(['pov']);
    expect(Object.keys(data)).not.toContain(AI_POLICY_KEY);
  });

  it('writes no policy at all for an entity nobody configured', () => {
    // The appearance default lives in the entity config, so a new entity
    // stores nothing and a later change to that default still reaches it.
    expect(splitForm(formFromEntity(entity(), 'name'), 'name').fields).not.toHaveProperty(
      AI_POLICY_KEY
    );
  });

  it('uses the same key the drawer navigates by', () => {
    // Two constants that must not drift: the nav entry and the storage key.
    expect(AI_SECTION_ID).toBe(AI_POLICY_KEY);
  });

  it('still drops empty values, which is what makes the object survive', () => {
    const form = formFromEntity(entity({ [AI_POLICY_KEY]: DEFAULT_AI_POLICY }), 'name');
    form.blank = '';
    form.missing = undefined;
    const fields = splitForm(form, 'name').fields;
    expect(fields).not.toHaveProperty('blank');
    expect(fields).not.toHaveProperty('missing');
    expect(fields).toHaveProperty(AI_POLICY_KEY);
  });
});
