import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import type { KnownEntity } from '@/services/extraction/known-index';
import type { ExtractionCandidate } from '@/services/extraction/detectors';
import { runLocalExtraction } from '@/services/extraction/engine';
import { buildCandidate } from '@/services/extraction/detectors';
import { propagate, type PropagateContext } from '@/services/intelligence/propagate';
import { applyDelta } from '@/services/intelligence/apply';

/** A minimal known-entity + row pair, so ctx.known and ctx.entities agree. */
function ctxFrom(
  rows: { id: string; type: KnownEntity['type']; name: string; fields?: Record<string, unknown> }[],
  extra: Partial<PropagateContext> = {}
): PropagateContext {
  return {
    projectId: 'p1',
    known: rows.map((r) => ({ id: r.id, type: r.type, name: r.name })),
    entities: rows.map((r) => ({ id: r.id, type: r.type, name: r.name, fields: r.fields ?? {} })),
    ...extra,
  };
}

function cand(over: Partial<ExtractionCandidate>): ExtractionCandidate {
  return buildCandidate({
    entityType: 'items', name: 'X', suggestedAction: 'update', matchType: 'exact',
    confidence: 0.8, sourceQuote: '', ...over,
  });
}

describe('intelligence/propagate — offline rules', () => {
  it('ownership: item-transfer sets currentOwner, appends history, flags a conflict', () => {
    const ctx = ctxFrom([
      { id: 'giver', type: 'cast', name: 'Vex' },
      { id: 'recv', type: 'cast', name: 'Mara' },
      { id: 'wrong', type: 'cast', name: 'Someone Else' },
      { id: 'amulet', type: 'items', name: 'Bone Amulet', fields: { currentOwner: { id: 'wrong', type: 'cast', name: 'Someone Else' } } },
    ]);
    const delta = propagate(
      [cand({
        entityType: 'items', name: 'Bone Amulet', existingEntityId: 'amulet', detector: 'itemTransfer',
        suggestedChanges: { currentOwner: { id: 'recv', type: 'cast', name: 'Mara' } },
        relatedEntityIds: ['giver', 'recv'],
      })],
      ctx
    );
    const owner = delta.patches.find((p) => p.field === 'currentOwner')!;
    expect(owner.mode).toBe('replace');
    expect(owner.after).toEqual({ id: 'recv', type: 'cast', name: 'Mara' });
    expect(owner.conflict).toBe(true); // recorded owner (Someone Else) ≠ giver (Vex)
    const history = delta.patches.find((p) => p.field === 'ownershipHistory')!;
    expect(history.mode).toBe('append');
    expect(String(history.after)).toContain('Mara');
    expect(delta.warnings.some((w) => w.includes('flagged'))).toBe(true);
  });

  it('item-loss sets status to destroyed', () => {
    const ctx = ctxFrom([{ id: 'blade', type: 'items', name: 'Old Blade', fields: { status: 'carried' } }]);
    const delta = propagate(
      [cand({ entityType: 'items', name: 'Old Blade', existingEntityId: 'blade', detector: 'itemLoss', suggestedChanges: { destroyed: true } })],
      ctx
    );
    const status = delta.patches.find((p) => p.field === 'status')!;
    expect(status.after).toBe('destroyed');
    expect(status.before).toBe('carried');
  });

  it('travel sets currentLocation and appends travelHistory', () => {
    const ctx = ctxFrom([
      { id: 'vex', type: 'cast', name: 'Vex' },
      { id: 'town', type: 'locations', name: 'Vraska Town' },
    ]);
    const delta = propagate(
      [cand({ entityType: 'cast', name: 'Vex', existingEntityId: 'vex', detector: 'travel', suggestedChanges: { location: 'town' }, relatedEntityIds: ['town'] })],
      ctx
    );
    expect(delta.patches.find((p) => p.field === 'currentLocation')?.after).toEqual({ id: 'town', type: 'locations', name: 'Vraska Town' });
    const travel = delta.patches.find((p) => p.field === 'travelHistory')!;
    expect(travel.mode).toBe('append');
    expect((travel.after as { id: string }).id).toBe('town');
  });

  it('nesting: a new place infers its parent from a containment cue', () => {
    const ctx = ctxFrom([{ id: 'vraska', type: 'locations', name: 'Vraska' }]);
    const delta = propagate(
      [cand({
        entityType: 'locations', name: 'Millbrook', suggestedAction: 'create', matchType: 'new',
        sourceQuote: 'Millbrook, a town in the Vraska region, kept to itself.',
      })],
      ctx
    );
    const place = delta.entities.find((e) => e.name === 'Millbrook')!;
    expect(place.fields.parentId).toEqual({ id: 'vraska', type: 'locations', name: 'Vraska' });
  });

  it('nesting: an unknown parent cue becomes a flagged picker suggestion', () => {
    const ctx = ctxFrom([]);
    const delta = propagate(
      [cand({
        entityType: 'locations', name: 'Millbrook', suggestedAction: 'create', matchType: 'new',
        sourceQuote: 'Millbrook, a town in the Kethrin region, kept to itself.',
      })],
      ctx
    );
    expect(delta.entities.find((e) => e.name === 'Millbrook')?.fields.parentId).toBeUndefined();
    expect(delta.suggestions.some((s) => s.kind === 'location-parent')).toBe(true);
  });

  it('relationships: a signal creates a relationship entity between two cast', () => {
    const ctx = ctxFrom([
      { id: 'a', type: 'cast', name: 'Aelinor' },
      { id: 'b', type: 'cast', name: 'Brann' },
    ]);
    const delta = propagate(
      [cand({
        entityType: 'relationships', name: 'Aelinor → Brann', suggestedAction: 'create', matchType: 'new',
        detector: 'relationships', suggestedChanges: { fromId: 'a', toId: 'b', relationshipType: 'betrayed' },
      })],
      ctx
    );
    const rel = delta.entities.find((e) => e.type === 'relationships')!;
    expect(rel.fields.from).toEqual({ id: 'a', type: 'cast', name: 'Aelinor' });
    expect(rel.fields.to).toEqual({ id: 'b', type: 'cast', name: 'Brann' });
    expect(rel.fields.bondType).toBe('betrayed');
  });

  it('quest-progress creates the quest and hands back an outcome suggestion', () => {
    const ctx = ctxFrom([]);
    const delta = propagate(
      [cand({ entityType: 'quests', name: 'The Hunt for the Bone Auger', suggestedAction: 'create', matchType: 'new', detector: 'questProgression' })],
      ctx
    );
    expect(delta.entities.find((e) => e.type === 'quests')?.fields.status).toBe('active');
    expect(delta.suggestions.some((s) => s.kind === 'quest-outcome')).toBe(true);
  });

  it('skill-learning: a rich new skill, the character link, and expansion suggestions', () => {
    const ctx = ctxFrom(
      [{ id: 'vex', type: 'cast', name: 'Vex', fields: { skills: [] } }],
      { text: 'That winter, Vex learned Venom Strike from the serpent-priest.', theme: 'grimdark' }
    );
    const delta = propagate([], ctx);
    // A rich skill sheet was created and assigned to the character.
    const skill = delta.entities.find((e) => e.type === 'skills' && e.name === 'Venom Strike')!;
    expect(skill).toBeDefined();
    expect((skill.fields.effects as string[]).length).toBeGreaterThan(0);
    expect(skill.fields.assignedCast).toEqual([{ id: 'vex', type: 'cast', name: 'Vex' }]);
    // The character gains the skill (patch references the new draft's localId).
    const link = delta.patches.find((p) => p.field === 'skills' && p.entityId === 'vex')!;
    expect((link.after as { id: string }).id).toBe(skill.localId);
    // Forward-looking: a sibling + a tree-placement suggestion.
    expect(delta.suggestions.some((s) => s.kind === 'skill-sibling')).toBe(true);
    expect(delta.suggestions.some((s) => s.kind === 'skill-placement')).toBe(true);
  });

  it('an already-known learned skill links without duplicating the sheet', () => {
    const ctx = ctxFrom(
      [
        { id: 'vex', type: 'cast', name: 'Vex', fields: { skills: [] } },
        { id: 'vs', type: 'skills', name: 'Venom Strike' },
      ],
      { text: 'Vex mastered Venom Strike at last.' }
    );
    const delta = propagate([], ctx);
    expect(delta.entities.filter((e) => e.type === 'skills')).toHaveLength(0);
    expect(delta.patches.find((p) => p.field === 'skills')?.after).toEqual({ id: 'vs', type: 'skills', name: 'Venom Strike' });
  });
});

describe('intelligence/propagate — detector → propagate → apply pipeline', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('runs the real local detectors, propagates, and applies ownership to the item', async () => {
    const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
    await createEntity({ projectId: 'p1', type: 'cast', name: 'Mara' });
    const amulet = await createEntity({
      projectId: 'p1', type: 'items', name: 'Bone Amulet',
      fields: { currentOwner: { id: vex.id, type: 'cast', name: 'Vex' } },
    });

    const rows = await db.entities.where('projectId').equals('p1').toArray();
    const known: KnownEntity[] = rows.map((e) => ({ id: e.id, type: e.type, name: e.name, aliases: e.aliases }));
    const text = 'In the harbour, Vex handed the Bone Amulet to Mara without a word.';

    const { candidates } = runLocalExtraction({ text, entities: known });
    const transfer = candidates.find((c) => c.detector === 'itemTransfer');
    expect(transfer, 'the itemTransfer detector should fire').toBeDefined();

    const delta = propagate(candidates, {
      projectId: 'p1',
      known,
      entities: rows.map((e) => ({ id: e.id, type: e.type, name: e.name, fields: e.fields })),
      text,
    });
    const result = await applyDelta(delta);
    expect(result.updated.some((r) => r.id === amulet.id)).toBe(true);

    const patched = (await db.entities.get(amulet.id))!;
    expect((patched.fields.currentOwner as { name: string }).name).toBe('Mara');
    expect(String(patched.fields.ownershipHistory)).toContain('Mara');
  });
});
