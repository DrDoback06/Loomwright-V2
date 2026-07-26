import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { enrichDelta, mergeDeltas } from '@/services/intelligence/enrich';
import { emptyDelta, type StoryDelta } from '@/services/intelligence/types';

function delta(overrides: Partial<StoryDelta>): StoryDelta {
  return { ...emptyDelta('d', 'p1', 'local'), createdAt: 1, ...overrides };
}

const unit = (unitId: string) => ({
  unitId,
  confidence: 0.8,
  confidenceBand: 'green' as const,
  sourceQuote: '',
  origin: 'test',
});

const patch = (unitId: string, entityId: string, fieldId: string, after: unknown) => ({
  ...unit(unitId),
  entityId,
  entityType: 'items' as const,
  entityName: 'Saltbrand',
  fieldId,
  fieldLabel: fieldId,
  before: null,
  after,
  mode: 'replace' as const,
});

describe('intelligence/AI enrichment', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('returns the offline delta untouched when no provider is configured', async () => {
    await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
    const base = delta({ patches: [patch('u1', 'e1', 'status', 'lost')] });

    const result = await enrichDelta('p1', base, 'some text');

    expect(result.added).toBe(0);
    expect(result.delta).toBe(base);
  });

  describe('merge semantics', () => {
    it('lets the offline pass win a collision on the same field', () => {
      const base = delta({ patches: [patch('local', 'item1', 'currentOwner', 'LOCAL')] });
      const ai = delta({ patches: [patch('ai', 'item1', 'currentOwner', 'AI')] });

      const merged = mergeDeltas(base, ai);
      expect(merged.patches).toHaveLength(1);
      expect(merged.patches[0].after).toBe('LOCAL');
    });

    it('keeps an AI patch that touches a field the offline pass missed', () => {
      const base = delta({ patches: [patch('local', 'item1', 'currentOwner', 'LOCAL')] });
      const ai = delta({ patches: [patch('ai', 'item1', 'condition', 'Broken')] });

      const merged = mergeDeltas(base, ai);
      expect(merged.patches).toHaveLength(2);
    });

    it('does not create a second entity the offline pass already drafted', () => {
      const draft = (localId: string) => ({
        localId,
        type: 'skills' as const,
        name: 'Venom Strike',
        aliases: [],
        summary: '',
        tags: [],
        fields: {},
      });
      const base = delta({ entities: [{ ...unit('local'), draft: draft('l1') }] });
      const ai = delta({ entities: [{ ...unit('ai'), draft: draft('l2') }] });

      expect(mergeDeltas(base, ai).entities).toHaveLength(1);
    });

    it('drops an AI group whose every member lost the merge', () => {
      const base = delta({ patches: [patch('local', 'item1', 'currentOwner', 'LOCAL')] });
      const ai = delta({
        patches: [patch('ai', 'item1', 'currentOwner', 'AI')],
        groups: [
          {
            id: 'g1',
            subject: { id: 'item1', type: 'items', name: 'Saltbrand' },
            headline: 'AI cascade',
            unitIds: ['ai'],
            confidence: 0.7,
            confidenceBand: 'green',
            flagged: false,
          },
        ],
      });

      // The group's only unit was deduped away, so no empty cascade survives.
      expect(mergeDeltas(base, ai).groups).toHaveLength(0);
    });

    it('deduplicates suggestions by title', () => {
      const suggestion = (unitId: string, title: string) => ({
        ...unit(unitId),
        kind: 'story-arc' as const,
        targetRef: null,
        title,
        body: '…',
        payload: null,
      });
      const base = delta({ suggestions: [suggestion('local', 'Venom Strike II')] });
      const ai = delta({
        suggestions: [suggestion('ai1', 'Venom Strike II'), suggestion('ai2', 'A new arc')],
      });

      const merged = mergeDeltas(base, ai);
      expect(merged.suggestions.map((s) => s.title)).toEqual(['Venom Strike II', 'A new arc']);
    });
  });
});
