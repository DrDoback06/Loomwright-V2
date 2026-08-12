import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { createProgression, progressionsForEntity } from '@/db/repos/progressions';
import { entityAtScene } from '@/services/context/entity-at-scene';
import { storySoFar, storyToCome } from '@/services/context/story-so-far';
import { isSummaryStale, summarizeSceneLocally } from '@/services/context/summarize';
import { buildSceneContext } from '@/services/context/scene-context';
import type { Entity, Progression, Scene } from '@/db/types';

const PROJECT = 'p-prog';

function scene(patch: Partial<Scene> = {}): Scene {
  return {
    id: 'sc1',
    projectId: PROJECT,
    chapterId: 'ch1',
    title: '',
    order: 0,
    globalOrder: 0,
    doc: {},
    paragraphs: [],
    wordCount: 0,
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

function progression(patch: Partial<Progression> = {}): Progression {
  return {
    id: 'pr1',
    projectId: PROJECT,
    entityId: 'e1',
    sceneId: 'sc1',
    mode: 'addition',
    fieldId: null,
    text: 'Something happened.',
    source: 'manual',
    confidence: 1,
    createdAt: 1,
    ...patch,
  };
}

function entity(patch: Partial<Entity> = {}): Entity {
  return {
    id: 'e1',
    projectId: PROJECT,
    type: 'cast',
    name: 'Vex',
    aliases: [],
    summary: 'A courier.',
    status: 'active',
    tags: [],
    fields: {},
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

/** scene id → position, the shape the assembler passes in. */
const ORDER: Record<string, number> = { sc1: 0, sc2: 1, sc3: 2, sc10: 10 };
const orderOf = (id: string) => ORDER[id];

describe('entityAtScene', () => {
  it('returns the entity untouched when nothing is anchored to it', () => {
    const e = entity();
    expect(entityAtScene(e, [], 5, orderOf)).toBe(e);
  });

  it('layers additions onto the summary in story order', () => {
    const result = entityAtScene(
      entity(),
      [
        progression({ id: 'b', sceneId: 'sc3', text: 'Then she lost it.' }),
        progression({ id: 'a', sceneId: 'sc2', text: 'She took the blade.' }),
      ],
      5,
      orderOf
    );
    expect(result.summary).toBe('A courier. She took the blade. Then she lost it.');
  });

  it('a replacement overrides its field, latest anchor winning', () => {
    const result = entityAtScene(
      entity({ fields: { occupation: 'Courier' } }),
      [
        progression({ id: 'a', sceneId: 'sc1', mode: 'replacement', fieldId: 'occupation', text: 'Smuggler' }),
        progression({ id: 'b', sceneId: 'sc3', mode: 'replacement', fieldId: 'occupation', text: 'Captain' }),
      ],
      5,
      orderOf
    );
    expect(result.fields.occupation).toBe('Captain');
  });

  it('A SCENE BEFORE THE ANCHOR CANNOT SEE IT — the whole feature', () => {
    const result = entityAtScene(
      entity(),
      [progression({ sceneId: 'sc10', text: 'She is dead by now.' })],
      2,
      orderOf
    );
    expect(result.summary).toBe('A courier.');
    expect(result.summary).not.toContain('dead');
  });

  it('withholds a field whose only news is still in the future', () => {
    // The stored row already holds chapter 40's owner. Leaving it in place
    // while claiming to have withheld the progression would be the exact
    // leak this function exists to close, dressed up as a fix.
    const result = entityAtScene(
      entity({ type: 'items', name: 'Ash-blade', fields: { currentOwner: 'Vex' } }),
      [progression({ sceneId: 'sc10', mode: 'replacement', fieldId: 'currentOwner', text: 'Vex' })],
      2,
      orderOf
    );
    expect(result.fields.currentOwner).toBeUndefined();
  });

  it('keeps the earlier value when one anchor is past and one is future', () => {
    const result = entityAtScene(
      entity({ fields: { occupation: 'Captain' } }),
      [
        progression({ id: 'a', sceneId: 'sc1', mode: 'replacement', fieldId: 'occupation', text: 'Courier' }),
        progression({ id: 'b', sceneId: 'sc10', mode: 'replacement', fieldId: 'occupation', text: 'Captain' }),
      ],
      2,
      orderOf
    );
    expect(result.fields.occupation).toBe('Courier');
  });

  it('skips a progression whose scene has been deleted', () => {
    // Positions are resolved at read time precisely because they move;
    // an unresolvable anchor is not a reason to send a fact early.
    const result = entityAtScene(
      entity(),
      [progression({ sceneId: 'gone', text: 'Orphaned.' })],
      99,
      orderOf
    );
    expect(result.summary).toBe('A courier.');
  });

  it('never mutates the stored row — the codex keeps showing current truth', () => {
    const e = entity({ fields: { occupation: 'Courier' } });
    entityAtScene(
      e,
      [progression({ sceneId: 'sc1', mode: 'replacement', fieldId: 'occupation', text: 'Captain' })],
      5,
      orderOf
    );
    expect(e.fields.occupation).toBe('Courier');
    expect(e.summary).toBe('A courier.');
  });
});

describe('progressions repo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('round-trips and is reversible through the audit log', async () => {
    const vex = await createEntity({ projectId: PROJECT, type: 'cast', name: 'Vex' });
    await createProgression({
      projectId: PROJECT,
      entityId: vex.id,
      sceneId: 'sc1',
      text: 'She took the blade.',
    });
    const rows = await progressionsForEntity(PROJECT, vex.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('manual');
    expect(rows[0].mode).toBe('addition');

    const audit = await db.auditLog.where('projectId').equals(PROJECT).toArray();
    expect(audit.some((e) => e.action === 'progression.create' && e.reversible)).toBe(true);
  });
});

describe('buildSceneContext with progressions', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('an earlier scene is drafted without a later fact — through the real assembler', async () => {
    const vex = await createEntity({
      projectId: PROJECT,
      type: 'cast',
      name: 'Vex',
      summary: 'A courier.',
    });
    await db.scenes.bulkAdd([
      scene({ id: 'sc1', globalOrder: 0, paragraphs: [{ id: 'p1', text: 'Vex waited.' }] }),
      scene({ id: 'sc2', globalOrder: 1, paragraphs: [{ id: 'p2', text: 'Vex waited again.' }] }),
    ]);
    await createProgression({
      projectId: PROJECT,
      entityId: vex.id,
      sceneId: 'sc2',
      text: 'Vex is carrying the ash-blade.',
    });

    const early = await buildSceneContext(
      PROJECT,
      scene({ id: 'sc1', globalOrder: 0, paragraphs: [{ id: 'p1', text: 'Vex waited.' }] })
    );
    expect(early.text).toContain('Vex');
    expect(early.text).not.toContain('ash-blade');

    const later = await buildSceneContext(
      PROJECT,
      scene({ id: 'sc2', globalOrder: 1, paragraphs: [{ id: 'p2', text: 'Vex waited again.' }] })
    );
    expect(later.text).toContain('ash-blade');
  });
});

describe('storySoFar', () => {
  const book = [
    scene({ id: 'sc1', globalOrder: 0, title: 'One', summary: 'Vex leaves the city.' }),
    scene({ id: 'sc2', globalOrder: 1, title: 'Two', summary: 'Marrow refuses the crossing.', pov: 'marrow' }),
    scene({ id: 'sc3', globalOrder: 2, title: 'Three', summary: 'They cross anyway, and it costs.' }),
  ];

  it('sends prior summaries in story order and stops at the current scene', () => {
    const text = storySoFar(book, 2);
    expect(text).toBe('One: Vex leaves the city.\nTwo: Marrow refuses the crossing.');
  });

  it('drops the OPENING when the budget runs out, never the most recent', () => {
    // Truncating from the front is the obvious implementation and the wrong
    // one: it hands a model the setup and withholds the situation it is
    // being asked to continue.
    const text = storySoFar(book, 3, { budgetChars: 40 });
    expect(text).toContain('They cross anyway');
    expect(text).not.toContain('Vex leaves the city');
  });

  it('filters to one POV', () => {
    expect(storySoFar(book, 3, { pov: 'marrow' })).toBe('Two: Marrow refuses the crossing.');
  });

  it('a scene hidden from AI is hidden here too', () => {
    const hidden = book.map((s) => (s.id === 'sc1' ? { ...s, aiVisible: false } : s));
    expect(storySoFar(hidden, 3)).not.toContain('Vex leaves the city');
  });

  it('storyToCome truncates from the far end — the next scene always survives', () => {
    const text = storyToCome(book, 0, { budgetChars: 40 });
    expect(text).toContain('Marrow refuses');
    expect(text).not.toContain('They cross anyway');
  });

  it('says nothing rather than something empty when no scene is summarised', () => {
    expect(storySoFar([scene({ summary: '' })], 5)).toBe('');
  });
});

describe('the offline summariser', () => {
  it('builds a summary from the scene’s own sentences, with no provider', () => {
    const result = summarizeSceneLocally(
      scene({
        paragraphs: [
          { id: 'p1', text: 'Vex arrived at the ferry landing before dawn.' },
          { id: 'p2', text: '"You are early," Marrow said, and did not look up.' },
          { id: 'p3', text: 'The water was flat and grey and it went on for a long way.' },
          { id: 'p4', text: 'She told him she had found the ash-blade in the reeds.' },
        ],
      }),
      40
    );
    // Every word is a word the author wrote — an extractive summary can be
    // wrong about emphasis but it cannot invent an event.
    expect(result).toContain('Vex arrived at the ferry landing');
    expect(result.length).toBeGreaterThan(0);
  });

  it('prefers the sentence that carries a change over the one that carries scenery', () => {
    const result = summarizeSceneLocally(
      scene({
        paragraphs: [
          { id: 'p1', text: 'The rain had a particular grey to it that afternoon.' },
          { id: 'p2', text: 'Marrow told Vex that the crossing was closed for good.' },
        ],
      }),
      12
    );
    expect(result).toContain('crossing was closed');
  });

  it('returns nothing for an empty scene rather than pretending', () => {
    expect(summarizeSceneLocally(scene(), 80)).toBe('');
  });

  it('keeps the sentences in reading order, not in relevance order', () => {
    const result = summarizeSceneLocally(
      scene({
        paragraphs: [
          { id: 'p1', text: 'Vex found the ash-blade beneath the floorboards of the mill.' },
          { id: 'p2', text: 'Marrow told her it had always been there, waiting for someone.' },
        ],
      }),
      60
    );
    expect(result.indexOf('ash-blade')).toBeLessThan(result.indexOf('always been there'));
  });
});

describe('isSummaryStale', () => {
  it('fires when the prose moved on after the summary was written', () => {
    expect(
      isSummaryStale(
        scene({ summary: 'They cross.', summaryUpdatedAt: 1_000, proseUpdatedAt: 2_000 })
      )
    ).toBe(true);
  });

  it('does NOT fire for a metadata edit — a POV dropdown cannot stale a summary', () => {
    // The reason this reads `proseUpdatedAt` and not `updatedAt`: every
    // label, status and target bumps the second one.
    expect(
      isSummaryStale(
        scene({
          summary: 'They cross.',
          summaryUpdatedAt: 2_000,
          proseUpdatedAt: 1_000,
          updatedAt: 90_000,
        })
      )
    ).toBe(false);
  });

  it('never fires for a scene with no summary — there is nothing to be stale', () => {
    expect(isSummaryStale(scene({ summary: '', proseUpdatedAt: 90_000 }))).toBe(false);
  });

  it('reports fresh for a scene written before the prose stamp existed', () => {
    expect(isSummaryStale(scene({ summary: 'They cross.', summaryUpdatedAt: 1_000 }))).toBe(false);
  });
});
