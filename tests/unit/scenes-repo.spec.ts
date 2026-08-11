import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createChapter, deleteChapterToTrash, saveChapterDoc } from '@/db/repos/chapters';
import { restoreFromTrash } from '@/db/repos/trash';
import {
  SNAPSHOT_KEEP,
  chapterRollup,
  createScene,
  deleteSceneToTrash,
  ensureScenesForProject,
  listScenes,
  listScenesInChapter,
  listSnapshots,
  moveScene,
  resequenceScenes,
  restoreSnapshot,
  saveSceneDoc,
  snapshotScene,
  updateSceneMeta,
} from '@/db/repos/scenes';

const PROJECT = 'p-scenes';

function doc(text: string, pid = 'p1') {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', attrs: { pid }, content: [{ type: 'text', text }] }],
  };
}

async function seed() {
  await db.projects.add({ id: PROJECT, name: 'Scenes', createdAt: 1, updatedAt: 1 });
  const chapter = await createChapter(PROJECT, 'Chapter 1');
  return chapter;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('scenes: structure', () => {
  it('a new chapter arrives with exactly one scene to write in', async () => {
    const chapter = await seed();
    const scenes = await listScenesInChapter(chapter.id);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].status).toBe('outline');
    expect(scenes[0].aiVisible).toBe(true);
  });

  it('globalOrder runs across the manuscript, not within a chapter', async () => {
    const one = await seed();
    const two = await createChapter(PROJECT, 'Chapter 2');
    await createScene(PROJECT, one.id, 'Scene 1b');
    await createScene(PROJECT, two.id, 'Scene 2b');

    const scenes = await listScenes(PROJECT);
    expect(scenes.map((s) => s.title)).toEqual([
      'Scene 1',
      'Scene 1b',
      'Scene 1',
      'Scene 2b',
    ]);
    expect(scenes.map((s) => s.globalOrder)).toEqual([0, 1, 2, 3]);
  });

  it('inserting after a scene shifts its siblings rather than colliding', async () => {
    const chapter = await seed();
    const first = (await listScenesInChapter(chapter.id))[0];
    const last = await createScene(PROJECT, chapter.id, 'Last');
    const middle = await createScene(PROJECT, chapter.id, 'Middle', first.id);

    const scenes = await listScenesInChapter(chapter.id);
    expect(scenes.map((s) => s.id)).toEqual([first.id, middle.id, last.id]);
    expect(scenes.map((s) => s.order)).toEqual([0, 1, 2]);
  });
});

describe('scenes: the chapter rollup', () => {
  it("a chapter's doc is the concatenation of its scenes, separated by a break", async () => {
    const chapter = await seed();
    const first = (await listScenesInChapter(chapter.id))[0];
    const second = await createScene(PROJECT, chapter.id, 'Scene 2');

    await saveSceneDoc(first.id, doc('The harbour bells rang.', 'a1'), [
      { id: 'a1', text: 'The harbour bells rang.' },
    ], 4);
    await saveSceneDoc(second.id, doc('Vex waited at the ferry.', 'b1'), [
      { id: 'b1', text: 'Vex waited at the ferry.' },
    ], 5);

    const rolled = (await db.chapters.get(chapter.id))!;
    expect(rolled.wordCount).toBe(9);
    expect(rolled.paragraphs.map((p) => p.id)).toEqual(['a1', 'b1']);
    const content = (rolled.doc as { content: { type: string }[] }).content;
    expect(content.map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
  });

  it('saveChapterDoc writes through to a scene, so the rollup cannot erase it', async () => {
    const chapter = await seed();
    await saveChapterDoc(chapter.id, doc('Written the old way.'), [
      { id: 'p1', text: 'Written the old way.' },
    ], 4);

    const scenes = await listScenesInChapter(chapter.id);
    expect(scenes[0].wordCount).toBe(4);

    // A rollup triggered by anything else must not lose it.
    await chapterRollup(chapter.id);
    expect((await db.chapters.get(chapter.id))!.wordCount).toBe(4);
  });
});

describe('scenes: moving between chapters', () => {
  it('carries its mentions to the chapter it lands in', async () => {
    const one = await seed();
    const two = await createChapter(PROJECT, 'Chapter 2');
    const scene = await createScene(PROJECT, one.id, 'Travelling');
    await saveSceneDoc(scene.id, doc('Vex crossed the pass.', 'm1'), [
      { id: 'm1', text: 'Vex crossed the pass.' },
    ], 4);
    await db.occurrences.add({
      id: 'occ1',
      projectId: PROJECT,
      entityId: 'e1',
      entityType: 'cast',
      chapterId: one.id,
      paragraphId: 'm1',
      start: 0,
      end: 3,
      exactText: 'Vex',
      createdAt: 1,
    });

    await moveScene(scene.id, two.id, 0);

    expect((await db.occurrences.get('occ1'))!.chapterId).toBe(two.id);
    expect((await db.chapters.get(one.id))!.wordCount).toBe(0);
    expect((await db.chapters.get(two.id))!.wordCount).toBe(4);
    // And the manuscript-wide order is rebuilt, not left stale.
    const scenes = await listScenes(PROJECT);
    expect(scenes.map((s) => s.globalOrder)).toEqual([0, 1, 2]);
  });
});

describe('scenes: trash', () => {
  it('deleting a chapter takes its prose with it, and restore brings it back', async () => {
    const chapter = await seed();
    const scene = (await listScenesInChapter(chapter.id))[0];
    await saveSceneDoc(scene.id, doc('Do not lose this sentence.', 'k1'), [
      { id: 'k1', text: 'Do not lose this sentence.' },
    ], 5);

    await deleteChapterToTrash(chapter.id);
    // Crucially: no orphan scenes left pointing at a chapter that is gone.
    expect(await db.scenes.where('projectId').equals(PROJECT).count()).toBe(0);

    await restoreFromTrash(chapter.id);
    const restored = await listScenesInChapter(chapter.id);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(scene.id);
    expect(restored[0].paragraphs[0].text).toBe('Do not lose this sentence.');
    expect((await db.chapters.get(chapter.id))!.wordCount).toBe(5);
  });

  it('a deleted scene restores into its old position', async () => {
    const chapter = await seed();
    const first = (await listScenesInChapter(chapter.id))[0];
    const middle = await createScene(PROJECT, chapter.id, 'Middle');
    const last = await createScene(PROJECT, chapter.id, 'Last');

    await deleteSceneToTrash(middle.id);
    expect((await listScenesInChapter(chapter.id)).map((s) => s.id)).toEqual([first.id, last.id]);

    await restoreFromTrash(middle.id);
    expect((await listScenesInChapter(chapter.id)).map((s) => s.id)).toEqual([
      first.id,
      middle.id,
      last.id,
    ]);
  });
});

describe('scenes: history', () => {
  it('restoring keeps the version you had, so the restore is itself undoable', async () => {
    const chapter = await seed();
    const scene = (await listScenesInChapter(chapter.id))[0];
    await saveSceneDoc(scene.id, doc('First draft.', 'v1'), [{ id: 'v1', text: 'First draft.' }], 2);
    const snapshot = (await snapshotScene(scene.id, 'manual', 'Draft one'))!;

    await saveSceneDoc(scene.id, doc('Second draft, longer.', 'v2'), [
      { id: 'v2', text: 'Second draft, longer.' },
    ], 3);

    await restoreSnapshot(snapshot.id);
    const after = (await db.scenes.get(scene.id))!;
    expect(after.paragraphs[0].text).toBe('First draft.');
    expect(after.wordCount).toBe(2);
    // The second draft was preserved on the way past.
    const labels = (await listSnapshots(scene.id)).map((s) => s.label);
    expect(labels).toContain('Before restore');
  });

  it('prunes to a bounded history but never discards a pre-AI save point', async () => {
    const chapter = await seed();
    const scene = (await listScenesInChapter(chapter.id))[0];
    await saveSceneDoc(scene.id, doc('Prose.', 'w1'), [{ id: 'w1', text: 'Prose.' }], 1);

    const precious = (await snapshotScene(scene.id, 'pre-ai'))!;
    for (let i = 0; i < SNAPSHOT_KEEP + 8; i += 1) {
      await snapshotScene(scene.id, 'manual', `Point ${i}`);
    }

    const kept = await listSnapshots(scene.id);
    expect(kept.length).toBeLessThanOrEqual(SNAPSHOT_KEEP + 2);
    expect(kept.some((s) => s.id === precious.id)).toBe(true);
  });
});

describe('scenes: the backfill', () => {
  it('gives a directly-written chapter a scene carrying its prose', async () => {
    await db.projects.add({ id: PROJECT, name: 'Scenes', createdAt: 1, updatedAt: 1 });
    // What sample-project, onboarding, generation and import all do.
    await db.chapters.add({
      id: 'raw-ch',
      projectId: PROJECT,
      title: 'Seeded',
      order: 0,
      doc: doc('Seeded straight into the table.', 's1'),
      paragraphs: [{ id: 's1', text: 'Seeded straight into the table.' }],
      wordCount: 5,
      createdAt: 1,
      updatedAt: 1,
    });

    expect(await ensureScenesForProject(PROJECT)).toBe(1);
    const scenes = await listScenesInChapter('raw-ch');
    expect(scenes).toHaveLength(1);
    expect(scenes[0].wordCount).toBe(5);
    expect(scenes[0].status).toBe('draft');

    // Idempotent: running it again changes nothing.
    expect(await ensureScenesForProject(PROJECT)).toBe(0);
  });
});

describe('scenes: metadata', () => {
  it('holds the columns the planning views read', async () => {
    const chapter = await seed();
    const scene = (await listScenesInChapter(chapter.id))[0];
    await updateSceneMeta(scene.id, {
      status: 'revised',
      pov: 'cast-1',
      povType: 'third-limited',
      labels: ['setup', 'night'],
      targetWords: 1200,
      aiVisible: false,
      summary: 'Vex confronts Marrow.',
    });

    const saved = (await db.scenes.get(scene.id))!;
    expect(saved.status).toBe('revised');
    expect(saved.pov).toBe('cast-1');
    expect(saved.labels).toEqual(['setup', 'night']);
    expect(saved.targetWords).toBe(1200);
    expect(saved.aiVisible).toBe(false);
    expect(saved.summary).toBe('Vex confronts Marrow.');
  });

  it('resequencing follows chapter order, not scene creation order', async () => {
    const one = await seed();
    const two = await createChapter(PROJECT, 'Chapter 2');
    const late = await createScene(PROJECT, two.id, 'In chapter two');

    // Put chapter two first.
    await db.chapters.update(two.id, { order: -1 });
    await resequenceScenes(PROJECT);

    expect((await db.scenes.get(late.id))!.globalOrder).toBeLessThan(
      (await listScenesInChapter(one.id))[0].globalOrder
    );
  });
});

describe('scenes: the v8 → v9 migration', () => {
  it('turns every chapter already on disk into one scene, without touching its text', async () => {
    // Build a v8 database by hand — the shape a real user's browser held
    // before scenes existed — then let Dexie upgrade it.
    //
    // The delete matters: beforeEach has already created the database at
    // v9, and declaring version(8) against an existing v9 store does not
    // downgrade it, so the upgrade would never fire and the test would
    // pass by accident having tested nothing.
    await db.delete();
    const legacy = new Dexie('loomwright');
    legacy.version(8).stores({
      projects: 'id, updatedAt',
      entities: 'id, projectId, [projectId+type], [projectId+status], [projectId+name]',
      links: 'id, projectId, [projectId+kind]',
      chapters: 'id, projectId, [projectId+order]',
      notes: 'id, projectId, [projectId+chapterId]',
      occurrences: 'id, projectId, [projectId+entityId], [projectId+chapterId], candidateId',
      candidates:
        'id, projectId, [projectId+status], [projectId+createdAt], [projectId+chapterId]',
      auditLog: 'id, projectId, [projectId+at]',
      trash: 'id, projectId, [projectId+deletedAt]',
      settings: 'key',
      uiState: 'key',
      atlasMaps: 'id, projectId',
      skillTrees: 'id, projectId',
      tangleBoards: 'id, projectId',
      keys: 'provider',
      randomTables: 'id, projectId',
      templates: 'id, projectId, [projectId+kind]',
      identityRules:
        'id, projectId, [projectId+kind], [projectId+entityType], canonicalEntityId',
      mergeReceipts: 'id, projectId, [projectId+createdAt], targetEntityId',
      suggestions: 'id, projectId, [projectId+status], [projectId+createdAt], targetEntityId',
    });
    await legacy.open();
    await legacy.table('projects').add({ id: PROJECT, name: 'Old', createdAt: 1, updatedAt: 1 });
    await legacy.table('chapters').bulkAdd([
      {
        id: 'old-2',
        projectId: PROJECT,
        title: 'Second',
        order: 1,
        doc: doc('The drovers road, two days ahead of the frost.', 'o2'),
        paragraphs: [{ id: 'o2', text: 'The drovers road, two days ahead of the frost.' }],
        wordCount: 8,
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'old-1',
        projectId: PROJECT,
        title: 'First',
        order: 0,
        doc: doc('The harbour bells rang the short peal.', 'o1'),
        paragraphs: [{ id: 'o1', text: 'The harbour bells rang the short peal.' }],
        wordCount: 7,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    await legacy.close();

    await db.open();
    const scenes = await listScenes(PROJECT);
    expect(scenes).toHaveLength(2);
    // globalOrder follows chapter order, not insertion order.
    expect(scenes.map((s) => s.chapterId)).toEqual(['old-1', 'old-2']);
    expect(scenes[0].paragraphs[0].text).toBe('The harbour bells rang the short peal.');
    expect(scenes[0].wordCount).toBe(7);
    expect(scenes[0].status).toBe('draft');

    // The chapter's own doc is deliberately left alone, so rolling back to
    // v8 cannot lose a word.
    const chapter = (await db.chapters.get('old-1'))!;
    expect(chapter.paragraphs[0].text).toBe('The harbour bells rang the short peal.');
  });
});

describe('scenes: status', () => {
  it('promotes an outline scene to draft on its first real words, and only once', async () => {
    const chapter = await seed();
    const scene = (await listScenesInChapter(chapter.id))[0];
    expect(scene.status).toBe('outline');

    await saveSceneDoc(scene.id, doc('Words at last.', 'd1'), [
      { id: 'd1', text: 'Words at last.' },
    ], 3);
    expect((await db.scenes.get(scene.id))!.status).toBe('draft');

    // A hand-set status is never overwritten by a later save.
    await updateSceneMeta(scene.id, { status: 'final' });
    await saveSceneDoc(scene.id, doc('More words.', 'd2'), [{ id: 'd2', text: 'More words.' }], 2);
    expect((await db.scenes.get(scene.id))!.status).toBe('final');
  });

  it('leaves an empty scene alone', async () => {
    const chapter = await seed();
    const scene = (await listScenesInChapter(chapter.id))[0];
    await saveSceneDoc(scene.id, null, [], 0);
    expect((await db.scenes.get(scene.id))!.status).toBe('outline');
  });
});
