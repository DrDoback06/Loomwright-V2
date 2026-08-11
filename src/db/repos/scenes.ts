import { db } from '../schema';
import { newId } from '@/lib/id';
import { paragraphsFromDoc } from '@/lib/prose';
import { logAudit } from './audit';
import type { Act, Chapter, Scene, SceneSnapshot } from '../types';
import { refreshProjectChapterReferences } from '@/services/chapter-awareness';

/* ---------------------------------------------------------------------
   Acts
   Optional by design: a book can live in one act or in none. Nothing in
   the app requires an act to exist.
   --------------------------------------------------------------------- */

export async function listActs(projectId: string): Promise<Act[]> {
  const rows = await db.acts.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function createAct(projectId: string, title?: string): Promise<Act> {
  const existing = await listActs(projectId);
  const now = Date.now();
  const act: Act = {
    id: newId(),
    projectId,
    title: title?.trim() || `Act ${existing.length + 1}`,
    order: existing.length,
    summary: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.acts.add(act);
  await logAudit({
    projectId,
    action: 'act.create',
    target: { table: 'acts', id: act.id, label: act.title },
    after: act,
  });
  return act;
}

export async function updateAct(id: string, patch: Partial<Act>): Promise<void> {
  await db.acts.update(id, { ...patch, updatedAt: Date.now() });
}

export async function renameAct(id: string, title: string): Promise<void> {
  const act = await db.acts.get(id);
  if (!act) return;
  await updateAct(id, { title: title.trim() || act.title });
}

/** Swap an act with its neighbour. Acts carry their own order — they are a
 * grouping over chapters, not a re-ordering of them — so moving one never
 * touches a chapter's position in the manuscript. */
export async function moveAct(id: string, direction: 'up' | 'down'): Promise<void> {
  const act = await db.acts.get(id);
  if (!act) return;
  const siblings = await listActs(act.projectId);
  const index = siblings.findIndex((a) => a.id === id);
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return;
  const now = Date.now();
  await db.transaction('rw', db.acts, async () => {
    await db.acts.update(act.id, { order: swapWith.order, updatedAt: now });
    await db.acts.update(swapWith.id, { order: act.order, updatedAt: now });
  });
}

/** Put a chapter in an act, or take it out of one. Grouping only: the
 * chapter's `order`, its scenes and its prose are all untouched. */
export async function setChapterAct(chapterId: string, actId: string | null): Promise<void> {
  const chapter = await db.chapters.get(chapterId);
  if (!chapter) return;
  await db.chapters.update(chapterId, { actId, updatedAt: Date.now() });
  await logAudit({
    projectId: chapter.projectId,
    action: 'chapter.act',
    target: { table: 'chapters', id: chapterId, label: chapter.title },
    before: { actId: chapter.actId ?? null },
    after: { actId },
  });
}

/** Deleting an act never deletes prose — its chapters simply stop
 * belonging to one. Losing a grouping must not be able to lose a word. */
export async function deleteAct(id: string): Promise<void> {
  const act = await db.acts.get(id);
  if (!act) return;
  await db.transaction('rw', [db.acts, db.chapters, db.auditLog], async () => {
    const orphans = await db.chapters.where('projectId').equals(act.projectId).toArray();
    for (const chapter of orphans.filter((c) => c.actId === id)) {
      await db.chapters.update(chapter.id, { actId: null, updatedAt: Date.now() });
    }
    await db.acts.delete(id);
    await logAudit({
      projectId: act.projectId,
      action: 'act.delete',
      target: { table: 'acts', id, label: act.title },
      before: act,
    });
  });
}

/* ---------------------------------------------------------------------
   Scenes
   --------------------------------------------------------------------- */

export async function listScenes(projectId: string): Promise<Scene[]> {
  const rows = await db.scenes.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => a.globalOrder - b.globalOrder);
}

export async function listScenesInChapter(chapterId: string): Promise<Scene[]> {
  const rows = await db.scenes.where('chapterId').equals(chapterId).toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

function blankScene(projectId: string, chapterId: string, title: string, order: number): Scene {
  const now = Date.now();
  return {
    id: newId(),
    projectId,
    chapterId,
    title,
    order,
    globalOrder: 0, // resequenceScenes() sets the real value
    doc: null,
    paragraphs: [],
    wordCount: 0,
    summary: '',
    summaryUpdatedAt: 0,
    status: 'outline',
    pov: null,
    povType: null,
    characterIds: [],
    locationId: null,
    attachedRefs: [],
    labels: [],
    targetWords: null,
    aiVisible: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Create a scene at the end of a chapter, or immediately after one of
 * its siblings. Mirrors `createChapter`: order values shift, ids never
 * move, so every extracted fact anchored to a scene stays anchored. */
export async function createScene(
  projectId: string,
  chapterId: string,
  title?: string,
  afterSceneId?: string | null
): Promise<Scene> {
  const siblings = await listScenesInChapter(chapterId);
  const after = afterSceneId ? siblings.find((s) => s.id === afterSceneId) : null;
  const insertAt = after ? after.order + 1 : siblings.length;
  const scene = blankScene(
    projectId,
    chapterId,
    title?.trim() || `Scene ${insertAt + 1}`,
    insertAt
  );

  await db.transaction('rw', db.scenes, async () => {
    if (after) {
      for (const sibling of siblings.filter((s) => s.order >= insertAt)) {
        await db.scenes.update(sibling.id, { order: sibling.order + 1, updatedAt: scene.createdAt });
      }
    }
    await db.scenes.add(scene);
  });
  await resequenceScenes(projectId);
  await logAudit({
    projectId,
    action: 'scene.create',
    target: { table: 'scenes', id: scene.id, label: scene.title },
    after: { scene, afterSceneId: after?.id ?? null },
  });
  return (await db.scenes.get(scene.id)) ?? scene;
}

/** Persist the edited document. Called from autosave — no audit entry per
 * keystroke, exactly as `saveChapterDoc` behaves; `updatedAt` is the save
 * marker and `snapshotScene` is what makes the history recoverable. */
export async function saveSceneDoc(
  id: string,
  doc: unknown,
  paragraphs: { id: string; text: string }[],
  wordCount: number
): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  await maybeIntervalSnapshot(scene);
  await db.scenes.update(id, {
    doc,
    paragraphs,
    wordCount,
    // A scene with prose in it is not an outline any more. Promote once,
    // on the first real words, and never again: this is the only status
    // transition the app makes on the author's behalf, and it exists so
    // the Board is useful on day one rather than a column of "Outline"
    // that everyone has to hand-correct. Nothing is ever demoted.
    ...(scene.status === 'outline' && wordCount > 0 ? { status: 'draft' as const } : {}),
    updatedAt: Date.now(),
  });
  await chapterRollup(scene.chapterId);
}

export async function updateSceneMeta(id: string, patch: Partial<Scene>): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  await db.scenes.update(id, { ...patch, updatedAt: Date.now() });
  // `aiVisible` is a rollup input, not just a stored flag — untick it and
  // the chapter's paragraph substrate has to be rebuilt at once, or the
  // model keeps seeing the scene until the next keystroke saves it.
  if (patch.title !== undefined || patch.aiVisible !== undefined) {
    await chapterRollup(scene.chapterId);
  }
}

export async function renameScene(id: string, title: string): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  await updateSceneMeta(id, { title: title.trim() || scene.title });
}

/** Move a scene within its chapter or into another one. The two chapters
 * involved both re-roll up, because a chapter's prose is the concatenation
 * of the scenes it currently holds. */
export async function moveScene(id: string, toChapterId: string, toIndex: number): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  const fromChapterId = scene.chapterId;

  await db.transaction('rw', db.scenes, async () => {
    const source = (await db.scenes.where('chapterId').equals(fromChapterId).toArray())
      .filter((s) => s.id !== id)
      .sort((a, b) => a.order - b.order);
    const target =
      fromChapterId === toChapterId
        ? source
        : (await db.scenes.where('chapterId').equals(toChapterId).toArray()).sort(
            (a, b) => a.order - b.order
          );

    target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, {
      ...scene,
      chapterId: toChapterId,
    });

    const now = Date.now();
    if (fromChapterId !== toChapterId) {
      for (const [order, row] of source.entries()) {
        if (row.order !== order) await db.scenes.update(row.id, { order, updatedAt: now });
      }
    }
    for (const [order, row] of target.entries()) {
      await db.scenes.update(row.id, { order, chapterId: toChapterId, updatedAt: now });
    }
  });

  await resequenceScenes(scene.projectId);
  await chapterRollup(fromChapterId);
  if (fromChapterId !== toChapterId) {
    await chapterRollup(toChapterId);
    // A mention belongs to the chapter its prose is in. Occurrences are
    // anchored by paragraph id, so moving the scene has to carry them
    // across or every chapter-anchored projection — travel timelines,
    // entity "last seen in", the Atlas routes — quietly points at the
    // chapter the text used to be in.
    await reanchorOccurrences(scene, toChapterId);
    await refreshProjectChapterReferences(scene.projectId);
  }
  await logAudit({
    projectId: scene.projectId,
    action: 'scene.move',
    target: { table: 'scenes', id, label: scene.title },
    before: { chapterId: fromChapterId, order: scene.order },
    after: { chapterId: toChapterId, order: toIndex },
  });
}

/** Repoint every occurrence that lives in this scene's paragraphs at the
 * chapter the scene has moved into. */
async function reanchorOccurrences(scene: Scene, toChapterId: string): Promise<void> {
  const pids = new Set(scene.paragraphs.map((p) => p.id));
  if (!pids.size) return;
  const rows = await db.occurrences.where('projectId').equals(scene.projectId).toArray();
  const moved = rows.filter((row) => row.paragraphId && pids.has(row.paragraphId));
  if (!moved.length) return;
  await db.transaction('rw', db.occurrences, async () => {
    for (const row of moved) {
      await db.occurrences.update(row.id, { chapterId: toChapterId });
    }
  });
}

export async function deleteSceneToTrash(id: string): Promise<void> {
  const scene = await db.scenes.get(id);
  if (!scene) return;
  await db.transaction('rw', [db.scenes, db.trash, db.auditLog], async () => {
    await db.trash.put({
      id: scene.id,
      projectId: scene.projectId,
      table: 'scenes',
      label: scene.title,
      payload: scene,
      deletedAt: Date.now(),
    });
    await db.scenes.delete(id);
    const remaining = (await db.scenes.where('chapterId').equals(scene.chapterId).toArray()).sort(
      (a, b) => a.order - b.order
    );
    for (const [order, row] of remaining.entries()) {
      if (row.order !== order) await db.scenes.update(row.id, { order, updatedAt: Date.now() });
    }
    await logAudit({
      projectId: scene.projectId,
      action: 'scene.delete',
      target: { table: 'scenes', id, label: scene.title },
      before: scene,
    });
  });
  await resequenceScenes(scene.projectId);
  await chapterRollup(scene.chapterId);
}

/** Recompute `globalOrder` across the whole manuscript. This is the
 * x-axis every planning view and every health analyzer reads, so it is
 * computed once here rather than re-derived by walking chapters in five
 * different places. */
export async function resequenceScenes(projectId: string): Promise<void> {
  const chapters = (await db.chapters.where('projectId').equals(projectId).toArray()).sort(
    (a, b) => a.order - b.order
  );
  const scenes = await db.scenes.where('projectId').equals(projectId).toArray();
  const byChapter = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const list = byChapter.get(scene.chapterId) ?? [];
    list.push(scene);
    byChapter.set(scene.chapterId, list);
  }

  let cursor = 0;
  const updates: { id: string; globalOrder: number }[] = [];
  for (const chapter of chapters) {
    const list = (byChapter.get(chapter.id) ?? []).sort((a, b) => a.order - b.order);
    for (const scene of list) {
      if (scene.globalOrder !== cursor) updates.push({ id: scene.id, globalOrder: cursor });
      cursor += 1;
    }
  }
  if (!updates.length) return;
  await db.transaction('rw', db.scenes, async () => {
    for (const update of updates) {
      await db.scenes.update(update.id, { globalOrder: update.globalOrder });
    }
  });
}

/* ---------------------------------------------------------------------
   Chapter rollup
   --------------------------------------------------------------------- */

interface DocNode {
  type?: string;
  content?: unknown[];
}

/** Recompute a chapter's doc, paragraphs and word count from its scenes.
 *
 * This is what let scenes arrive without touching extraction, search, the
 * world bible, the speed reader or the archive: they all still read a
 * chapter as one document, and that document is now assembled rather than
 * typed. Scene boundaries appear as horizontal rules, which is what the
 * editor already renders as a scene break.
 *
 * It is also the single choke point where `scene.aiVisible` becomes real.
 * Every AI path in the app — beats, Compose, deep extraction, the handoff
 * pack, style analysis — reads `chapter.paragraphs`, so a scene the author
 * has hidden contributes its `doc` (the chapter still reads as one
 * document, and the speed reader and world bible still show the prose) and
 * its `wordCount` (they wrote those words), but **not** its paragraphs.
 * That array is the substrate every model sees, and this is the one filter
 * that keeps it honest. */
export async function chapterRollup(chapterId: string): Promise<void> {
  const chapter = await db.chapters.get(chapterId);
  if (!chapter) return;
  const scenes = await listScenesInChapter(chapterId);

  const content: unknown[] = [];
  const paragraphs: { id: string; text: string }[] = [];
  let wordCount = 0;

  scenes.forEach((scene, index) => {
    if (index > 0) content.push({ type: 'horizontalRule' });
    const doc = scene.doc as DocNode | null;
    if (doc?.content?.length) content.push(...doc.content);
    if (scene.aiVisible !== false) paragraphs.push(...scene.paragraphs);
    wordCount += scene.wordCount;
  });

  await db.chapters.update(chapterId, {
    doc: content.length ? { type: 'doc', content } : null,
    paragraphs,
    wordCount,
    updatedAt: Date.now(),
  });
}

/* ---------------------------------------------------------------------
   Snapshots
   The app had no prose history at all: the audit log covers entities, and
   an overwritten chapter was simply gone. These are cheap and bounded.
   --------------------------------------------------------------------- */

/** One interval snapshot per window, each overwriting the previous within
 * that window. Three minutes is enough that a session leaves a usable
 * trail without a snapshot per keystroke. */
export const SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000;
/** Kept per scene, newest first, plus one per calendar day beyond that. */
export const SNAPSHOT_KEEP = 20;

export async function listSnapshots(sceneId: string): Promise<SceneSnapshot[]> {
  const rows = await db.sceneSnapshots.where('sceneId').equals(sceneId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Take a snapshot of the scene as it stands. Always call this before an
 * AI insertion or an import — those are the two moments where a lot of
 * text changes at once and the author did not type any of it. */
export async function snapshotScene(
  sceneId: string,
  reason: SceneSnapshot['reason'],
  label?: string
): Promise<SceneSnapshot | null> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) return null;
  const snapshot: SceneSnapshot = {
    id: newId(),
    projectId: scene.projectId,
    sceneId,
    doc: scene.doc,
    wordCount: scene.wordCount,
    label: label?.trim() || defaultLabel(reason),
    reason,
    createdAt: Date.now(),
  };
  await db.sceneSnapshots.add(snapshot);
  await pruneSnapshots(sceneId);
  return snapshot;
}

function defaultLabel(reason: SceneSnapshot['reason']): string {
  switch (reason) {
    case 'pre-ai':
      return 'Before AI wrote';
    case 'pre-import':
      return 'Before import';
    case 'manual':
      return 'Manual save point';
    default:
      return 'Autosave';
  }
}

/** Snapshot on save, but at most once per interval window. Skips the
 * write entirely when the scene has no prose yet — an empty scene has no
 * history worth keeping. */
async function maybeIntervalSnapshot(scene: Scene): Promise<void> {
  if (!scene.wordCount) return;
  const latest = (await db.sceneSnapshots.where('sceneId').equals(scene.id).toArray()).sort(
    (a, b) => b.createdAt - a.createdAt
  )[0];
  if (latest && Date.now() - latest.createdAt < SNAPSHOT_INTERVAL_MS) return;
  await snapshotScene(scene.id, 'interval');
}

/** Keep the newest SNAPSHOT_KEEP, and one per calendar day beyond them.
 * `pre-ai` and `pre-import` are never pruned: they are the two a reader
 * is most likely to actually want back. */
async function pruneSnapshots(sceneId: string): Promise<void> {
  const all = await listSnapshots(sceneId);
  if (all.length <= SNAPSHOT_KEEP) return;

  const keep = new Set(all.slice(0, SNAPSHOT_KEEP).map((s) => s.id));
  const dailySeen = new Set<string>();
  for (const snapshot of all) {
    if (snapshot.reason === 'pre-ai' || snapshot.reason === 'pre-import') {
      keep.add(snapshot.id);
      continue;
    }
    const day = new Date(snapshot.createdAt).toISOString().slice(0, 10);
    if (!dailySeen.has(day)) {
      dailySeen.add(day);
      keep.add(snapshot.id);
    }
  }
  const doomed = all.filter((s) => !keep.has(s.id)).map((s) => s.id);
  if (doomed.length) await db.sceneSnapshots.bulkDelete(doomed);
}

/** Restore a snapshot over the live scene, taking a `manual` snapshot of
 * what was there first — so restoring is itself undoable, and a mis-click
 * on the history list cannot cost anyone their afternoon. */
export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.sceneSnapshots.get(snapshotId);
  if (!snapshot) return;
  const scene = await db.scenes.get(snapshot.sceneId);
  if (!scene) return;

  await snapshotScene(scene.id, 'manual', 'Before restore');
  const paragraphs = paragraphsFromDoc(snapshot.doc);
  await db.scenes.update(scene.id, {
    doc: snapshot.doc,
    paragraphs,
    wordCount: snapshot.wordCount,
    updatedAt: Date.now(),
  });
  await chapterRollup(scene.chapterId);
  await logAudit({
    projectId: scene.projectId,
    action: 'scene.restore',
    target: { table: 'scenes', id: scene.id, label: scene.title },
    before: { wordCount: scene.wordCount },
    after: { wordCount: snapshot.wordCount, snapshotId },
  });
}

/** Give every chapter at least one scene, carrying whatever prose the
 * chapter already holds.
 *
 * The Dexie v9 upgrade handles the database that was already on disk, but
 * chapters are also written directly by the sample project, the
 * onboarding wizard, generation, story-intelligence apply and archive
 * import — five call sites that would each have to remember. This runs on
 * project load instead: idempotent, cheap when there is nothing to do,
 * and it covers a v2 archive imported into a v9 database, which no
 * migration could have reached. */
export async function ensureScenesForProject(projectId: string): Promise<number> {
  const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
  if (!chapters.length) return 0;
  const scenes = await db.scenes.where('projectId').equals(projectId).toArray();
  const covered = new Set(scenes.map((s) => s.chapterId));
  const missing = chapters.filter((c) => !covered.has(c.id));
  if (!missing.length) return 0;

  const now = Date.now();
  await db.scenes.bulkAdd(
    missing.map((chapter) => ({
      ...blankScene(projectId, chapter.id, chapter.title, 0),
      doc: chapter.doc,
      paragraphs: chapter.paragraphs ?? [],
      wordCount: chapter.wordCount ?? 0,
      status: ((chapter.wordCount ?? 0) > 0 ? 'draft' : 'outline') as Scene['status'],
      createdAt: chapter.createdAt ?? now,
      updatedAt: chapter.updatedAt ?? now,
    }))
  );
  await resequenceScenes(projectId);
  return missing.length;
}

/** Every chapter needs at least one scene to hold its prose. */
export async function ensureChapterHasScene(chapter: Chapter): Promise<Scene> {
  const existing = await listScenesInChapter(chapter.id);
  if (existing.length) return existing[0];
  return createScene(chapter.projectId, chapter.id, chapter.title);
}
