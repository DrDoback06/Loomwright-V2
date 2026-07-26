import { describe, expect, it } from 'vitest';
import { runLocalExtraction } from '@/services/extraction/engine';
import { buildStoryDelta } from '@/services/intelligence/engine';
import type { Entity } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';

/**
 * The cold-start contract.
 *
 * Everything here is about a project with an EMPTY codex, because that is the
 * state every author is in on the day they first paste a book in — and the
 * state where the engine used to report "nothing trackable found" while
 * holding a chapter full of characters, places and events.
 */

const CHAPTER = `
Vex crossed into Ashen Ford, a town in the Vraska region, with the rain still on her coat.
"You came back," Marrow said, and handed the Saltbrand to Vex without ceremony.
Vex learned Venom Strike from the old poisoner that winter.
Marrow betrayed Vex before the season turned.
`;

function entity(type: EntityType, name: string, fields: Record<string, unknown> = {}): Entity {
  return {
    id: `${type}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    projectId: 'p1',
    type,
    name,
    aliases: [],
    summary: '',
    tags: [],
    fields,
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Entity;
}

function candidateFor(result: ReturnType<typeof runLocalExtraction>, name: string) {
  return result.candidates.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

describe('typing by evidence, not by first cue', () => {
  it('does not turn a character into a place because something was handed "to" them', () => {
    const result = runLocalExtraction({ text: CHAPTER, entities: [] });
    // One "handed … to Vex" used to outrank three sentences Vex is the
    // subject of, and filed the protagonist under Locations.
    expect(candidateFor(result, 'Vex')?.entityType).toBe('cast');
  });

  it('types a learned technique as a skill, not as a two-word person name', () => {
    const result = runLocalExtraction({ text: CHAPTER, entities: [] });
    expect(candidateFor(result, 'Venom Strike')?.entityType).toBe('skills');
    // And it must not ALSO exist as a character.
    const asCast = result.candidates.filter(
      (c) => c.name === 'Venom Strike' && c.entityType === 'cast'
    );
    expect(asCast).toHaveLength(0);
  });

  it('still types an unambiguous place as a place', () => {
    const result = runLocalExtraction({ text: CHAPTER, entities: [] });
    expect(candidateFor(result, 'Ashen Ford')?.entityType).toBe('locations');
  });
});

describe('bootstrap pass — a project with nothing in it still gets consequences', () => {
  it('reads ownership, travel, learning and bonds out of a cold chapter', () => {
    const delta = buildStoryDelta({ projectId: 'p1', text: CHAPTER, entities: [], trees: [] });
    const headlines = delta.groups.map((g) => g.headline).join(' | ');

    // The four consequences the same prose yields on a fully-seeded project.
    expect(headlines).toMatch(/Saltbrand/);
    expect(headlines).toMatch(/Ashen Ford/);
    expect(headlines).toMatch(/Venom Strike/);
    expect(headlines).toMatch(/bond/);
    expect(delta.patches.length).toBeGreaterThan(0);
  });

  it('creates the people and places it discovered rather than dropping them', () => {
    const delta = buildStoryDelta({ projectId: 'p1', text: CHAPTER, entities: [], trees: [] });
    const created = delta.entities.map((e) => e.draft.name);
    expect(created).toContain('Vex');
    expect(created).toContain('Marrow');
    // Every create belongs to exactly one group — no orphans, no duplicates.
    const grouped = delta.groups.flatMap((g) => g.unitIds);
    for (const create of delta.entities) {
      expect(grouped.filter((id) => id === create.unitId)).toHaveLength(1);
    }
  });

  it('keeps a create in the same toggle group as the cascade that needs it', () => {
    const delta = buildStoryDelta({ projectId: 'p1', text: CHAPTER, entities: [], trees: [] });
    const transfer = delta.groups.find((g) => g.headline.includes('Saltbrand'));
    expect(transfer).toBeDefined();
    const saltbrand = delta.entities.find((e) => e.draft.name === 'Saltbrand');
    // Turning the transfer cascade off must also withhold the item it invented
    // to make the transfer expressible.
    if (saltbrand) expect(transfer!.unitIds).toContain(saltbrand.unitId);
  });

  it('marks bootstrap-only findings as less certain than confirmed ones', () => {
    const cold = buildStoryDelta({ projectId: 'p1', text: CHAPTER, entities: [], trees: [] });
    const warm = buildStoryDelta({
      projectId: 'p1',
      text: CHAPTER,
      entities: [
        entity('cast', 'Vex'),
        entity('cast', 'Marrow'),
        entity('items', 'Saltbrand'),
        entity('locations', 'Vraska'),
      ],
      trees: [],
    });
    const lowest = (d: typeof cold) => Math.min(...d.groups.map((g) => g.confidence));
    expect(lowest(cold)).toBeLessThanOrEqual(lowest(warm));
  });

  it('can be turned off, and then behaves exactly as the single pass did', () => {
    const withBootstrap = runLocalExtraction({ text: CHAPTER, entities: [] });
    const without = runLocalExtraction({ text: CHAPTER, entities: [], bootstrap: false });
    expect(withBootstrap.candidates.length).toBeGreaterThan(without.candidates.length);
    // The bootstrap pass adds consequences, never new highlight spans.
    expect(withBootstrap.occurrences.length).toBe(without.occurrences.length);
  });
});

describe('propagation holes that used to be open', () => {
  it('takes the item out of the giver’s hands, not just into the receiver’s', () => {
    const saltbrand = entity('items', 'Saltbrand');
    const marrow = entity('cast', 'Marrow', { inventory: [{ id: saltbrand.id, type: 'items', name: 'Saltbrand' }] });
    const vex = entity('cast', 'Vex');
    const delta = buildStoryDelta({
      projectId: 'p1',
      text: 'Marrow handed the Saltbrand to Vex at the gate.',
      entities: [saltbrand, marrow, vex],
      trees: [],
    });
    const removal = delta.patches.find((p) => p.entityId === marrow.id && p.mode === 'remove');
    expect(removal?.fieldId).toBe('inventory');
    const addition = delta.patches.find((p) => p.entityId === vex.id && p.mode === 'append');
    expect(addition?.fieldId).toBe('inventory');
  });

  it('moves a quest that the prose actually finished', () => {
    const quest = entity('quests', 'Hunt for the Saltbrand', { status: 'Active' });
    const vex = entity('cast', 'Vex');
    const delta = buildStoryDelta({
      projectId: 'p1',
      text: 'By spring Vex had completed the Hunt for the Saltbrand.',
      entities: [quest, vex],
      trees: [],
    });
    const status = delta.patches.find((p) => p.entityId === quest.id && p.fieldId === 'status');
    expect(status?.after).toBe('Completed');
    expect(delta.suggestions.some((s) => s.kind === 'quest-outcome')).toBe(true);
  });

  it('learns the verbs an author actually writes with', () => {
    const saltbrand = entity('items', 'Saltbrand');
    const marrow = entity('cast', 'Marrow');
    const vex = entity('cast', 'Vex');
    const text = 'Marrow nicked the Saltbrand to Vex before anyone looked.';
    const entities = [saltbrand, marrow, vex].map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: [],
    }));

    const stock = runLocalExtraction({ text, entities });
    expect(stock.candidates.some((c) => c.signal?.kind === 'item-transfer')).toBe(false);

    const taught = runLocalExtraction({
      text,
      entities,
      extraVerbs: { itemTransfer: ['nicked', 'palmed'] },
    });
    expect(taught.candidates.some((c) => c.signal?.kind === 'item-transfer')).toBe(true);
  });
});
