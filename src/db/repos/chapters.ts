import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import { deriveScene } from '@/lib/prose';
import type { Chapter } from '../types';
import { refreshProjectChapterReferences } from '@/services/chapter-awareness';
import {
  chapterRollup,
  createScene,
  ensureChapterHasScene,
  listScenesInChapter,
} from './scenes';

export async function listChapters(projectId: string): Promise<Chapter[]> {
  return db.chapters
    .where('[projectId+order]')
    .between([projectId, -Infinity], [projectId, Infinity])
    .toArray();
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

/** Create a chapter at the end or immediately after a selected chapter.
 * Chapter ids, not display numbers, anchor every extracted fact. Shifting the
 * lightweight order values therefore re-indexes all linked views without a
 * manuscript re-scan. */
export async function createChapter(
  projectId: string,
  title?: string,
  afterChapterId?: string | null
): Promise<Chapter> {
  const existing = await listChapters(projectId);
  const after = afterChapterId ? existing.find((chapter) => chapter.id === afterChapterId) : null;
  const insertAt = after ? after.order + 1 : existing.length;
  const now = Date.now();
  const chapter: Chapter = {
    id: newId(),
    projectId,
    title: title?.trim() || `Chapter ${insertAt + 1}`,
    order: insertAt,
    doc: null,
    paragraphs: [],
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.chapters, async () => {
    if (after) {
      for (const sibling of existing.filter((row) => row.order >= insertAt)) {
        await db.chapters.update(sibling.id, { order: sibling.order + 1, updatedAt: now });
      }
    }
    await db.chapters.add(chapter);
  });
  // A chapter is a container; the prose lives in scenes. Creating the
  // first one here means no surface ever has to handle a chapter with
  // nowhere to type.
  await createScene(projectId, chapter.id, 'Scene 1');
  await refreshProjectChapterReferences(projectId);
  await logAudit({
    projectId,
    action: after ? 'chapter.insert' : 'chapter.create',
    target: { table: 'chapters', id: chapter.id, label: chapter.title },
    after: { chapter, afterChapterId: after?.id ?? null },
  });
  return chapter;
}

export async function renameChapter(id: string, title: string): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) return;
  await db.chapters.update(id, { title: title.trim() || chapter.title, updatedAt: Date.now() });
}

/** Refresh labels after a title edit settles. Kept separate from rename so
 * typing a title never walks the entity store on every keystroke. */
export async function refreshChapterLabels(projectId: string): Promise<number> {
  return refreshProjectChapterReferences(projectId);
}

/** Persist a whole chapter's prose.
 *
 * Since v9 a chapter's doc is a rollup of its scenes, so writing the
 * chapter row directly would be silently overwritten the next time
 * anything recomputed it. This writes into the chapter's first scene and
 * rolls up, which keeps the old contract — "save this chapter's text" —
 * true under the new model. Callers that know about scenes should prefer
 * `saveSceneDoc`; this exists so the ones that do not cannot corrupt
 * anything.
 *
 * No audit entry per keystroke; `updatedAt` is the save marker and
 * `snapshotScene` is what makes the history recoverable. */
export async function saveChapterDoc(
  id: string,
  doc: unknown,
  paragraphs: { id: string; text: string }[],
  wordCount: number
): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) return;
  const scenes = await listScenesInChapter(id);
  const scene = scenes[0] ?? (await ensureChapterHasScene(chapter));
  await db.scenes.update(scene.id, { doc, paragraphs, wordCount, updatedAt: Date.now() });
  await chapterRollup(id);
}

/** Append a plain paragraph to a chapter (random-table results, tool
 * output). The prose lives in scenes now, so this lands in the chapter's
 * last scene and the chapter re-rolls up; doc, derived paragraphs and
 * word count stay in step, and the editor picks the block up like any
 * other on next load. */
export async function appendParagraphToChapter(id: string, text: string): Promise<void> {
  const chapter = await db.chapters.get(id);
  const line = text.trim();
  if (!chapter || !line) return;
  const scenes = await listScenesInChapter(id);
  const scene = scenes[scenes.length - 1] ?? (await ensureChapterHasScene(chapter));

  const pid = newId();
  const node = {
    type: 'paragraph',
    attrs: { pid },
    content: [{ type: 'text', text: line }],
  };
  const doc = (scene.doc as { type?: string; content?: unknown[] } | null) ?? {
    type: 'doc',
    content: [],
  };
  const nextDoc = { ...doc, type: doc.type ?? 'doc', content: [...(doc.content ?? []), node] };
  // Both numbers re-derived from the document rather than incremented by
  // hand: they are two different filters over it now, and a hand-rolled
  // increment can only ever be right for one of them.
  await db.scenes.update(scene.id, {
    doc: nextDoc,
    ...deriveScene(nextDoc),
    updatedAt: Date.now(),
  });
  await chapterRollup(id);
}

/** Move a chapter one slot earlier/later, swapping orders, then refresh the
 * small chapter-aware projections used by entities, Atlas and timelines. */
export async function moveChapter(id: string, direction: 'up' | 'down'): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) return;
  const siblings = await listChapters(chapter.projectId);
  const index = siblings.findIndex((c) => c.id === id);
  const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return;
  await db.transaction('rw', db.chapters, async () => {
    await db.chapters.update(chapter.id, { order: swapWith.order, updatedAt: Date.now() });
    await db.chapters.update(swapWith.id, { order: chapter.order, updatedAt: Date.now() });
  });
  await refreshProjectChapterReferences(chapter.projectId);
  await logAudit({
    projectId: chapter.projectId,
    action: 'chapter.move',
    target: { table: 'chapters', id: chapter.id, label: chapter.title },
    before: { order: chapter.order },
    after: { order: swapWith.order },
  });
}

export async function deleteChapterToTrash(id: string): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) return;
  await db.transaction('rw', [db.chapters, db.scenes, db.trash, db.auditLog], async () => {
    // The chapter's prose lives in its scenes, so they travel into the
    // trash with it. Leaving them behind would orphan rows pointing at a
    // chapter that no longer exists, and restoring would bring back an
    // empty chapter with the text still gone.
    const scenes = await db.scenes.where('chapterId').equals(id).toArray();
    await db.trash.put({
      id: chapter.id,
      projectId: chapter.projectId,
      table: 'chapters',
      label: chapter.title,
      payload: { ...chapter, scenes },
      deletedAt: Date.now(),
    });
    if (scenes.length) await db.scenes.bulkDelete(scenes.map((s) => s.id));
    await db.chapters.delete(id);
    const remaining = await db.chapters
      .where('[projectId+order]')
      .between([chapter.projectId, -Infinity], [chapter.projectId, Infinity])
      .toArray();
    for (const [order, row] of remaining.entries()) {
      if (row.order !== order) await db.chapters.update(row.id, { order, updatedAt: Date.now() });
    }
    await logAudit({
      projectId: chapter.projectId,
      action: 'chapter.delete',
      target: { table: 'chapters', id, label: chapter.title },
      before: chapter,
    });
  });
  await refreshProjectChapterReferences(chapter.projectId);
}
