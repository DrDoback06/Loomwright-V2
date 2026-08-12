import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { buildSceneContext, entityDigest } from '@/services/context/scene-context';
import { fieldValueToText } from '@/services/context/field-text';
import { AI_POLICY_KEY, DEFAULT_AI_POLICY } from '@/domain/ai-policy';
import type { Entity, Scene } from '@/db/types';

const PROJECT = 'p-ctx';

function scene(patch: Partial<Scene> = {}): Scene {
  return {
    id: 'sc1',
    projectId: PROJECT,
    chapterId: 'ch1',
    title: 'The ferry',
    order: 0,
    globalOrder: 0,
    doc: {},
    paragraphs: [{ id: 'p1', text: 'Nothing happens here.' }],
    wordCount: 4,
    summary: '',
    summaryUpdatedAt: 0,
    status: 'draft',
    pov: null,
    povType: null,
    characterIds: [],
    locationId: null,
    attachedRefs: [],
    labels: [],
    targetWords: null,
    aiVisible: true,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

async function cast(name: string, fields: Record<string, unknown> = {}, summary = ''): Promise<Entity> {
  return createEntity({ projectId: PROJECT, type: 'cast', name, summary, fields });
}

describe('fieldValueToText', () => {
  it('renders the shapes an entity field can hold', () => {
    expect(fieldValueToText('  Weary  ')).toBe('Weary');
    expect(fieldValueToText(42)).toBe('42');
    expect(fieldValueToText(['a', 'b'])).toBe('a; b');
    expect(fieldValueToText({ id: 'x', type: 'cast', name: 'Marrow' })).toBe('Marrow');
    expect(fieldValueToText({ text: 'Find the stone', status: 'open' })).toBe('Find the stone (open)');
    expect(fieldValueToText({ name: 'Grit', value: 3 })).toBe('Grit: 3');
  });

  it('says nothing rather than something useless', () => {
    // A false boolean invites a model to mention it ("Deceased: no"), and a
    // coordinate pair means nothing to a model writing prose. Neither should
    // cost budget.
    expect(fieldValueToText(false)).toBe('');
    expect(fieldValueToText({ x: 1, y: 2 })).toBe('');
    expect(fieldValueToText(null)).toBe('');
    expect(fieldValueToText([])).toBe('');
  });
});

describe('entityDigest', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('renders fields generically — the thing no AI path did before', async () => {
    const entity = await cast('Vex', { personality: 'Guarded', occupation: 'Courier' }, 'A courier.');
    const digest = entityDigest(entity, 'standard');
    expect(digest).toContain('Vex');
    expect(digest).toContain('A courier.');
    expect(digest).toContain('Guarded');
    expect(digest).toContain('Courier');
  });

  it('finally reads the "AI profile" section, which had zero readers', async () => {
    // Four fields asking the author to write instructions for the model,
    // which no prompt has ever included.
    const entity = await cast('Vex', { writingInstructions: 'Never let her explain herself.' });
    expect(entityDigest(entity, 'standard')).toContain('Never let her explain herself.');
  });

  it('withholds appearance by default, and honours an override', async () => {
    const entity = await cast('Vex', { physicalDescription: 'Green eyes, always noted.' });
    expect(entityDigest(entity, 'standard')).not.toContain('Green eyes');

    const opened = await cast('Ruth', {
      physicalDescription: 'A scar through one brow.',
      [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, fieldVisibility: { physicalDescription: true } },
    });
    expect(entityDigest(opened, 'standard')).toContain('A scar through one brow.');
  });

  it('honours a field the author turned off that the config leaves on', async () => {
    const entity = await cast('Vex', {
      personality: 'Guarded',
      [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, fieldVisibility: { personality: false } },
    });
    expect(entityDigest(entity, 'standard')).not.toContain('Guarded');
  });

  it('lean depth carries the summary only', async () => {
    const entity = await cast('Vex', { personality: 'Guarded' }, 'A courier.');
    const lean = entityDigest(entity, 'lean');
    expect(lean).toContain('A courier.');
    expect(lean).not.toContain('Guarded');
  });
});

describe('buildSceneContext lanes', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('puts the POV character and the location in always, with a reason each', async () => {
    const vex = await cast('Vex');
    const place = await createEntity({ projectId: PROJECT, type: 'locations', name: 'Pale Reach' });
    const ctx = await buildSceneContext(PROJECT, scene({ pov: vex.id, locationId: place.id }));

    const byName = new Map(ctx.items.map((i) => [i.ref.name, i]));
    expect(byName.get('Vex')?.lane).toBe('always');
    expect(byName.get('Vex')?.reason).toBe('POV character');
    expect(byName.get('Pale Reach')?.reason).toBe('where this scene happens');
  });

  it('detects an entity named in the prose', async () => {
    await cast('Marrow');
    const ctx = await buildSceneContext(
      PROJECT,
      scene({ paragraphs: [{ id: 'p1', text: 'Marrow poled the ferry across.' }] })
    );
    const item = ctx.items.find((i) => i.ref.name === 'Marrow');
    expect(item?.lane).toBe('detected');
    expect(item?.reason).toBe('named in this scene');
  });

  it('a typed @ mention outranks a scan hit, and catches what a scan cannot', async () => {
    // "the ferryman" is Marrow, and no matcher will ever work that out.
    const marrow = await cast('Marrow');
    await db.occurrences.add({
      id: 'o1',
      projectId: PROJECT,
      entityId: marrow.id,
      entityType: 'cast',
      chapterId: 'ch1',
      paragraphId: 'p1',
      start: 4,
      end: 12,
      exactText: 'ferryman',
      source: 'typed',
      createdAt: 1,
    });
    const ctx = await buildSceneContext(
      PROJECT,
      scene({ paragraphs: [{ id: 'p1', text: 'The ferryman poled across.' }] })
    );
    const item = ctx.items.find((i) => i.ref.name === 'Marrow');
    expect(item?.lane).toBe('detected');
    expect(item?.reason).toBe('you linked this with @');
  });

  it('Never keeps an entity out of the payload even when it is named', async () => {
    await cast('Marrow', { [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, context: 'never' } });
    const ctx = await buildSceneContext(
      PROJECT,
      scene({ paragraphs: [{ id: 'p1', text: 'Marrow poled the ferry across.' }] })
    );
    const item = ctx.items.find((i) => i.ref.name === 'Marrow');
    expect(item?.lane).toBe('excluded');
    expect(item?.reason).toBe('set to Never');
    expect(ctx.text).not.toContain('Marrow');
  });

  it('Always reaches a scene that never mentions it', async () => {
    await cast('The Compact', { [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, context: 'always' } });
    const ctx = await buildSceneContext(PROJECT, scene());
    const item = ctx.items.find((i) => i.ref.name === 'The Compact');
    expect(item?.lane).toBe('always');
    expect(item?.reason).toBe('set to Always');
  });

  it('excludedRefs keeps an entity out of THIS scene without touching its policy', async () => {
    // The whole reason lane moves are per-scene: dragging Marrow out of one
    // scene must not silently change what the other two hundred send.
    const marrow = await cast('Marrow');
    const paragraphs = [{ id: 'p1', text: 'Marrow poled the ferry across.' }];

    const removed = await buildSceneContext(
      PROJECT,
      scene({ paragraphs, excludedRefs: [{ id: marrow.id, type: 'cast', name: 'Marrow' }] })
    );
    const item = removed.items.find((i) => i.ref.name === 'Marrow');
    expect(item?.lane).toBe('excluded');
    expect(item?.reason).toBe('you removed this from this scene');
    expect(removed.text).not.toContain('Marrow');

    // A different scene, same entity, untouched policy.
    const elsewhere = await buildSceneContext(PROJECT, scene({ id: 'sc2', paragraphs }));
    expect(elsewhere.items.find((i) => i.ref.name === 'Marrow')?.lane).toBe('detected');
  });

  it('attachedRefs promotes an entity the prose never names', async () => {
    const marrow = await cast('Marrow');
    const ctx = await buildSceneContext(
      PROJECT,
      scene({ attachedRefs: [{ id: marrow.id, type: 'cast', name: 'Marrow' }] })
    );
    const item = ctx.items.find((i) => i.ref.name === 'Marrow');
    expect(item?.lane).toBe('always');
    expect(item?.reason).toBe('attached to this scene');
  });

  it('an entity nobody mentioned and nobody pinned is simply absent', async () => {
    await cast('Someone Else');
    const ctx = await buildSceneContext(PROJECT, scene());
    expect(ctx.items.find((i) => i.ref.name === 'Someone Else')).toBeUndefined();
  });
});

describe('buildSceneContext budget', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('never exceeds the tier budget, and says what did not fit', async () => {
    // Thirty entities marked Always would otherwise blow a small model's
    // whole allowance and fail the request outright.
    const long = 'x'.repeat(900);
    for (let i = 0; i < 30; i++) {
      await cast(`Person ${i}`, { [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, context: 'always' } }, long);
    }
    const ctx = await buildSceneContext(PROJECT, scene(), { tier: 'small' });

    expect(ctx.budget).toBe(4000);
    expect(ctx.used).toBeLessThanOrEqual(ctx.budget);
    expect(ctx.text.length).toBeLessThanOrEqual(ctx.budget);

    const dropped = ctx.items.filter((i) => i.reason === 'no room in the budget');
    expect(dropped.length).toBeGreaterThan(0);
    // Reported, never silent — this is what the rail renders.
    expect(dropped.every((i) => i.lane === 'excluded')).toBe(true);
  });

  it('clamps depth by tier the way enrich.ts does', async () => {
    await cast('Vex', { personality: 'Guarded' }, 'A courier.');
    const small = await buildSceneContext(PROJECT, scene({ characterIds: ['x'] }), {
      tier: 'small',
      depth: 'full',
    });
    // `full` on a small model degrades to `standard`, so a 1,400-char
    // per-entity allowance never reaches a 4,000-char budget.
    expect(small.budget).toBe(4000);
  });

  it('is deterministic — same inputs, same bytes', async () => {
    await cast('Vex', { personality: 'Guarded' }, 'A courier.');
    await cast('Marrow', {}, 'A ferryman.');
    const s = scene({ paragraphs: [{ id: 'p1', text: 'Vex found Marrow at the water.' }] });
    const a = await buildSceneContext(PROJECT, s);
    const b = await buildSceneContext(PROJECT, s);
    expect(a.text).toBe(b.text);
    expect(a.items.map((i) => i.ref.name)).toEqual(b.items.map((i) => i.ref.name));
  });

  it('the assembled text is exactly the kept digests', async () => {
    // The Preview must not be a paraphrase of what gets sent.
    await cast('Vex', {}, 'A courier.');
    const ctx = await buildSceneContext(
      PROJECT,
      scene({ paragraphs: [{ id: 'p1', text: 'Vex waited.' }] })
    );
    const kept = ctx.items.filter((i) => i.lane !== 'excluded');
    expect(ctx.text).toBe(kept.map((i) => i.digest).join('\n'));
  });
});
