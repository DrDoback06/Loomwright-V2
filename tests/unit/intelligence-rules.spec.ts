import { describe, expect, it } from 'vitest';
import type { Entity, SkillTree } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';
import { buildStoryDelta } from '@/services/intelligence/engine';
import type { StoryDelta } from '@/services/intelligence/types';

let seq = 0;
function entity(type: EntityType, name: string, fields: Record<string, unknown> = {}): Entity {
  seq++;
  return {
    id: `${type}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    projectId: 'p1',
    type,
    name,
    aliases: [],
    summary: '',
    status: 'active',
    tags: [],
    fields,
    createdAt: seq,
    updatedAt: seq,
  };
}

function build(text: string, entities: Entity[], trees: SkillTree[] = []): StoryDelta {
  return buildStoryDelta({ projectId: 'p1', text, entities, trees });
}

const patchFor = (d: StoryDelta, entityId: string, fieldId: string) =>
  d.patches.find((p) => p.entityId === entityId && p.fieldId === fieldId);

describe('intelligence/propagation — consequences, not just nouns', () => {
  describe('skill learning', () => {
    it('creates the skill, attaches it to the character, and places it on the matching tree', () => {
      const vex = entity('cast', 'Vex');
      const tree: SkillTree = {
        id: 'tree-serpent',
        projectId: 'p1',
        name: 'Serpent Path',
        nodes: [
          { id: 'n-root', label: 'Coil', x: 0, y: 0, group: 'poison' },
          { id: 'n-deep', label: 'Sap', x: 0, y: 100, group: 'poison' },
        ],
        edges: [],
        updatedAt: 1,
      };

      const delta = build('Vex learned Venom Strike before the tide turned.', [vex], [tree]);

      // 1. the skill became a real entity
      const skill = delta.entities.find((e) => e.draft.type === 'skills');
      expect(skill?.draft.name).toBe('Venom Strike');
      // and arrived with a filled sheet, not a bare name
      expect(skill!.draft.fields.skillType).toBeTruthy();

      // 2. it attached to that character
      const skills = patchFor(delta, vex.id, 'skills');
      expect(skills?.mode).toBe('append');
      expect((skills?.after as { name: string }).name).toBe('Venom Strike');

      // 3. it landed on the right branch of the right tree
      const placement = delta.graphPlacements[0];
      expect(placement?.graphId).toBe('tree-serpent');
      expect(placement?.group).toBe('poison');
      // anchored below the deepest node of that branch
      expect(placement.node.y).toBeGreaterThan(100);
      expect(placement.edges[0]?.from).toBe('n-deep');

      // and the whole thing reads as ONE cascade
      const group = delta.groups.find((g) => g.headline.includes('Venom Strike'));
      expect(group?.headline).toContain('Serpent Path');
      expect(group?.headline).toContain('poison');
      expect(group!.unitIds.length).toBeGreaterThanOrEqual(3);
    });

    it('links an already-known skill in both directions instead of duplicating it', () => {
      const vex = entity('cast', 'Vex');
      const skill = entity('skills', 'Venom Strike');

      const delta = build('Vex learned Venom Strike that winter.', [vex, skill]);

      expect(delta.entities.filter((e) => e.draft.type === 'skills')).toHaveLength(0);
      expect(patchFor(delta, vex.id, 'skills')).toBeTruthy();
      expect(patchFor(delta, skill.id, 'assignedCast')).toBeTruthy();
    });

    it('does not invent a tree placement when nothing matches', () => {
      const vex = entity('cast', 'Vex');
      const tree: SkillTree = {
        id: 'tree-cook',
        projectId: 'p1',
        name: 'Hearthcraft',
        nodes: [{ id: 'n1', label: 'Simmer', x: 0, y: 0, group: 'baking' }],
        edges: [],
        updatedAt: 1,
      };
      const delta = build('Vex learned Venom Strike.', [vex], [tree]);
      expect(delta.graphPlacements).toHaveLength(0);
    });
  });

  describe('item transfer', () => {
    it('flips the owner, appends chain of custody, and fills the receiver inventory', () => {
      const marrow = entity('cast', 'Marrow');
      const vex = entity('cast', 'Vex');
      const sword = entity('items', 'Saltbrand', {
        currentOwner: { id: marrow.id, type: 'cast', name: 'Marrow' },
      });

      const delta = build('Marrow gave Saltbrand to Vex at the gate.', [marrow, vex, sword]);

      const owner = patchFor(delta, sword.id, 'currentOwner');
      expect(owner?.mode).toBe('replace');
      expect((owner?.after as { id: string }).id).toBe(vex.id);
      expect((owner?.before as { id: string }).id).toBe(marrow.id);
      expect(owner?.conflict).toBeUndefined();

      const history = patchFor(delta, sword.id, 'ownershipHistory');
      expect(history?.mode).toBe('append');
      expect(history?.after).toBe('Marrow → Vex');

      expect(patchFor(delta, vex.id, 'inventory')?.mode).toBe('append');
    });

    it('does not take the receiver from the following sentence', () => {
      // "…to Vex at the gate. Aelinor reached…" — the forward window used to
      // run past the full stop and hand the sword to Aelinor instead.
      const marrow = entity('cast', 'Marrow');
      const vex = entity('cast', 'Vex');
      const aelinor = entity('cast', 'Aelinor');
      const sword = entity('items', 'Saltbrand');

      const delta = build(
        'Marrow gave Saltbrand to Vex at the gate. Aelinor reached the far shore.',
        [marrow, vex, aelinor, sword]
      );

      const owner = patchFor(delta, sword.id, 'currentOwner');
      expect((owner?.after as { name: string }).name).toBe('Vex');
      expect(patchFor(delta, vex.id, 'inventory')).toBeTruthy();
      expect(patchFor(delta, aelinor.id, 'inventory')).toBeUndefined();
    });

    it('flags a continuity conflict when the recorded owner is not the giver', () => {
      const marrow = entity('cast', 'Marrow');
      const vex = entity('cast', 'Vex');
      const kell = entity('cast', 'Kell');
      // The codex says Kell owns it, but the prose has Marrow handing it over.
      const sword = entity('items', 'Saltbrand', {
        currentOwner: { id: kell.id, type: 'cast', name: 'Kell' },
      });

      const delta = build('Marrow gave Saltbrand to Vex at the gate.', [marrow, vex, kell, sword]);

      const owner = patchFor(delta, sword.id, 'currentOwner');
      expect(owner?.conflict).toBeTruthy();
      expect(owner!.conflict!.reason).toContain('Kell');
      // Best guess still applied, so Accept-all keeps working…
      expect((owner?.after as { id: string }).id).toBe(vex.id);
      // …but confidence drops and the cascade is flagged for a look.
      expect(owner!.confidence).toBeLessThanOrEqual(0.55);
      expect(delta.groups.some((g) => g.flagged)).toBe(true);
      // and the picker offers both readings
      expect(owner!.conflict!.options.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('travel and location nesting', () => {
    it('moves a character to a known place and logs the leg', () => {
      const aelinor = entity('cast', 'Aelinor');
      const pass = entity('locations', 'Vraska Pass');

      const delta = build('Aelinor crossed Vraska Pass at first light.', [aelinor, pass]);

      const loc = patchFor(delta, aelinor.id, 'currentLocation');
      expect(loc?.mode).toBe('replace');
      expect((loc?.after as { id: string }).id).toBe(pass.id);
      expect(patchFor(delta, aelinor.id, 'travelHistory')?.mode).toBe('append');
    });

    it('creates an unknown town nested under the region the sentence named', () => {
      const aelinor = entity('cast', 'Aelinor');
      const vraska = entity('locations', 'Vraska');

      const delta = build(
        'Aelinor reached Ashen Ford, a town in the Vraska region, before dusk.',
        [aelinor, vraska]
      );

      const town = delta.entities.find((e) => e.draft.name === 'Ashen Ford');
      expect(town).toBeTruthy();

      const nesting = delta.hierarchyPlacements[0];
      expect(nesting?.parentId).toBe(vraska.id);
      expect(nesting?.childId).toBe(town!.draft.localId);
      expect(delta.groups[0].headline).toContain('nested under Vraska');
    });

    it('does not attribute a journey to whoever appeared in the previous sentence', () => {
      // Aelinor is not a known character, so the only cast name in range is Vex
      // — one sentence earlier. Reaching across the full stop to grab a subject
      // silently credits the wrong person, which is worse than no candidate.
      const vex = entity('cast', 'Vex');
      const vraska = entity('locations', 'Vraska');

      const delta = build(
        'Vex learned Venom Strike before the tide turned. Aelinor reached Ashen Ford, a town in the Vraska region, before dusk.',
        [vex, vraska]
      );

      expect(patchFor(delta, vex.id, 'currentLocation')).toBeUndefined();
      expect(patchFor(delta, vex.id, 'travelHistory')).toBeUndefined();
      // The skill cascade from the FIRST sentence is unaffected.
      expect(patchFor(delta, vex.id, 'skills')).toBeTruthy();
    });

    it('leaves an unresolvable parent as a low-confidence picker rather than dropping it', () => {
      const aelinor = entity('cast', 'Aelinor');

      const delta = build(
        'Aelinor reached Ashen Ford, a town in the Duskmere region, before dusk.',
        [aelinor]
      );

      const nesting = delta.hierarchyPlacements[0];
      expect(nesting?.parentId).toBeNull();
      expect(nesting?.unresolvedParentName).toBe('Duskmere');
      expect(nesting!.confidence).toBeLessThan(0.6);
    });
  });

  describe('relationships', () => {
    it('creates a bond entity with a vocabulary term the config actually offers', () => {
      const vex = entity('cast', 'Vex');
      const marrow = entity('cast', 'Marrow');

      const delta = build('Vex betrayed Marrow at the crossing.', [vex, marrow]);

      const bond = delta.entities.find((e) => e.draft.type === 'relationships');
      expect(bond?.draft.fields.bondType).toBe('enemy');
      expect(bond?.draft.fields.valence).toBe('negative');
      expect((bond?.draft.fields.from as { id: string }).id).toBe(vex.id);
      expect(delta.links[0]?.link.kind).toBe('enemy');
    });

    it('nudges an existing bond instead of creating a duplicate', () => {
      const vex = entity('cast', 'Vex');
      const marrow = entity('cast', 'Marrow');
      const existing = entity('relationships', 'Vex → Marrow', {
        from: { id: vex.id, type: 'cast', name: 'Vex' },
        to: { id: marrow.id, type: 'cast', name: 'Marrow' },
        bondType: 'ally',
      });

      const delta = build('Vex betrayed Marrow at the crossing.', [vex, marrow, existing]);

      expect(delta.entities.filter((e) => e.draft.type === 'relationships')).toHaveLength(0);
      const bondPatch = patchFor(delta, existing.id, 'bondType');
      expect(bondPatch?.before).toBe('ally');
      expect(bondPatch?.after).toBe('enemy');
      expect(patchFor(delta, existing.id, 'evidence')?.mode).toBe('append');
    });
  });

  describe('item loss', () => {
    it('marks a destroyed item on both status and condition', () => {
      const sword = entity('items', 'Saltbrand', { status: 'carried' });
      const delta = build('The blow shattered Saltbrand on the stones.', [sword]);

      expect(patchFor(delta, sword.id, 'status')?.after).toBe('destroyed');
      expect(patchFor(delta, sword.id, 'condition')?.after).toBe('Destroyed');
    });

    it('stays quiet when the codex already records the loss', () => {
      const sword = entity('items', 'Saltbrand', { status: 'lost' });
      const delta = build('Aelinor lost Saltbrand in the reeds.', [sword]);
      expect(patchFor(delta, sword.id, 'status')).toBeUndefined();
    });
  });

  describe('whole-book intake', () => {
    it('reports progress per chunk and does not double-apply an event at a seam', () => {
      const marrow = entity('cast', 'Marrow');
      const vex = entity('cast', 'Vex');
      const sword = entity('items', 'Saltbrand');

      // Put the event inside the overlap window so both chunks see it.
      const filler = 'The road went on and the rain did not stop. '.repeat(120);
      const event = 'Marrow gave Saltbrand to Vex at the gate. ';
      const text = filler + event + filler;
      expect(text.length).toBeGreaterThan(5000);

      const progress: number[] = [];
      const delta = buildStoryDelta({
        projectId: 'p1',
        text,
        entities: [marrow, vex, sword],
        trees: [],
        onProgress: (_done, total) => progress.push(total),
      });

      expect(progress.length).toBeGreaterThan(1);
      // One owner change, not one per chunk.
      expect(delta.patches.filter((p) => p.fieldId === 'currentOwner')).toHaveLength(1);
    });
  });

  it('produces nothing at all from prose with no trackable events', () => {
    const delta = build('The morning came grey and cold. Nothing else stirred.', []);
    expect(delta.patches).toHaveLength(0);
    expect(delta.groups).toHaveLength(0);
  });
});
