import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { buildMegaPrompt, buildWorldDigest, parseDeltaReply } from '@/services/intelligence/digest';
import type { StoryDelta } from '@/services/intelligence/types';

async function seedWorld() {
  const marrow = await createEntity({ projectId: 'p1', type: 'cast', name: 'Marrow' });
  const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
  const vraska = await createEntity({ projectId: 'p1', type: 'locations', name: 'Vraska' });
  const sword = await createEntity({
    projectId: 'p1',
    type: 'items',
    name: 'Saltbrand',
    fields: { currentOwner: { id: marrow.id, type: 'cast', name: 'Marrow' } },
  });
  return { marrow, vex, vraska, sword };
}

const asDelta = (d: StoryDelta | { error: string }): StoryDelta => {
  if ('error' in d) throw new Error(`expected a delta, got: ${d.error}`);
  return d;
};

describe('intelligence/world digest + mega-prompt round trip', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('describes ownership and hierarchy so an external model can reason about state', async () => {
    const { vraska } = await seedWorld();
    await createEntity({
      projectId: 'p1',
      type: 'locations',
      name: 'Ashen Ford',
      fields: { parentId: { id: vraska.id, type: 'locations', name: 'Vraska' } },
    });

    const digest = await buildWorldDigest('p1', 'standard');
    expect(digest).toContain('Saltbrand — owned by Marrow');
    expect(digest).toContain('Ashen Ford — inside Vraska');
  });

  it('never leaks internal ids into the digest', async () => {
    const { sword, marrow } = await seedWorld();
    const digest = await buildWorldDigest('p1', 'full');
    expect(digest).not.toContain(sword.id);
    expect(digest).not.toContain(marrow.id);
  });

  it('degrades over budget and says so rather than silently truncating', async () => {
    for (let i = 0; i < 400; i++) {
      await createEntity({
        projectId: 'p1',
        type: 'cast',
        name: `Character ${i}`,
        summary: 'A reasonably long summary line that eats into the digest budget quickly.',
      });
    }
    const digest = await buildWorldDigest('p1', 'lean');
    expect(digest).toContain('truncated to fit');
    expect(digest.length).toBeLessThan(8000);
  });

  it('carries the manuscript and asks for facts plus suggestions', () => {
    const prompt = buildMegaPrompt('# World digest (lean)', 'Marrow gave Saltbrand to Vex.');
    expect(prompt).toContain('Marrow gave Saltbrand to Vex.');
    expect(prompt).toContain('"facts"');
    expect(prompt).toContain('"suggestions"');
    expect(prompt).toContain('never an open question');
  });

  describe('reply verification', () => {
    it('runs external facts through the same offline rules', async () => {
      const { vex, sword } = await seedWorld();
      const reply = JSON.stringify({
        facts: [
          {
            kind: 'item-transfer',
            item: 'Saltbrand',
            from: 'Marrow',
            to: 'Vex',
            quote: 'Marrow gave Saltbrand to Vex.',
          },
        ],
        suggestions: [],
      });

      const delta = asDelta(await parseDeltaReply('p1', reply));
      const owner = delta.patches.find((p) => p.entityId === sword.id && p.fieldId === 'currentOwner');
      expect((owner?.after as { id: string }).id).toBe(vex.id);
      expect(delta.source).toBe('handoff');
    });

    it('refuses to write anything for a thing that does not exist', async () => {
      await seedWorld();
      const reply = JSON.stringify({
        facts: [{ kind: 'item-transfer', item: 'Crown of Nowhere', to: 'Vex', quote: 'x' }],
        suggestions: [],
      });

      const delta = asDelta(await parseDeltaReply('p1', reply));
      expect(delta.patches).toHaveLength(0);
      expect(delta.warnings.join(' ')).toContain('Crown of Nowhere');
    });

    it('still flags a continuity conflict a model tried to assert past', async () => {
      const { sword } = await seedWorld();
      const kell = await createEntity({ projectId: 'p1', type: 'cast', name: 'Kell' });
      await db.entities.update(sword.id, {
        fields: { currentOwner: { id: kell.id, type: 'cast', name: 'Kell' } },
      });

      const reply = JSON.stringify({
        facts: [
          { kind: 'item-transfer', item: 'Saltbrand', from: 'Marrow', to: 'Vex', quote: 'x' },
        ],
      });
      const delta = asDelta(await parseDeltaReply('p1', reply));
      const owner = delta.patches.find((p) => p.fieldId === 'currentOwner');
      expect(owner?.conflict).toBeTruthy();
    });

    it('tolerates a fenced reply wrapped in chatter', async () => {
      await seedWorld();
      const reply = [
        'Sure! Here is what changed:',
        '```json',
        JSON.stringify({
          facts: [
            { kind: 'travel', character: 'Vex', place: 'Vraska', quote: 'Vex reached Vraska.' },
          ],
        }),
        '```',
        'Let me know if you want more.',
      ].join('\n');

      const delta = asDelta(await parseDeltaReply('p1', reply));
      expect(delta.patches.some((p) => p.fieldId === 'currentLocation')).toBe(true);
    });

    it('keeps suggestions in their own group', async () => {
      const { vex } = await seedWorld();
      const reply = JSON.stringify({
        facts: [],
        suggestions: [
          {
            kind: 'skill-next-tier',
            target: 'Vex',
            title: 'Venom Strike II',
            body: 'The coating spreads to thrown weapons (cost: 2 doses).',
          },
        ],
      });

      const delta = asDelta(await parseDeltaReply('p1', reply));
      expect(delta.suggestions).toHaveLength(1);
      expect(delta.suggestions[0].targetRef?.id).toBe(vex.id);
      const group = delta.groups.find((g) => g.headline.includes('suggestion'));
      expect(group?.unitIds).toEqual([delta.suggestions[0].unitId]);
    });

    it('reports a useful error for a reply that is not JSON', async () => {
      await seedWorld();
      const result = await parseDeltaReply('p1', 'I could not find anything to report.');
      expect('error' in result).toBe(true);
    });
  });
});
