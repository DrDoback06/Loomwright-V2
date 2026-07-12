import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import type { Chapter } from '../types';
import { refreshProjectChapterReferences } from '@/services/chapter-awareness';

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

/** Persist the edited document. Called from autosave — no audit entry per
 * keystroke; chapter.updatedAt is the save marker. */
export async function saveChapterDoc(
  id: string,
  doc: unknown,
  paragraphs: { id: string; text: string }[],
  wordCount: number
): Promise<void> {
  await db.chapters.update(id, { doc, paragraphs, wordCount, updatedAt: Date.now() });
}

/** Append a plain paragraph to a chapter (random-table results, tool
 * output). Doc, derived paragraphs, and word count stay in step; the
 * editor picks the block up like any other on next load. */
export async function appendParagraphToChapter(id: string, text: string): Promise<void> {
  const chapter = await db.chapters.get(id);
  const line = text.trim();
  if (!chapter || !line) return;
  const pid = newId();
  const node = {
    type: 'paragraph',
    attrs: { pid },
    content: [{ type: 'text', text: line }],
  };
  const doc = (chapter.doc as { type?: string; content?: unknown[] } | null) ?? {
    type: 'doc',
    content: [],
  };
  const nextDoc = { ...doc, type: doc.type ?? 'doc', content: [...(doc.content ?? []), node] };
  const paragraphs = [...chapter.paragraphs, { id: pid, text: line }];
  const words = line.split(/\s+/).length;
  await db.chapters.update(id, {
    doc: nextDoc,
    paragraphs,
    wordCount: chapter.wordCount + words,
    updatedAt: Date.now(),
  });
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
  await db.transaction('rw', [db.chapters, db.trash, db.auditLog], async () => {
    await db.trash.put({
      id: chapter.id,
      projectId: chapter.projectId,
      table: 'chapters',
      label: chapter.title,
      payload: chapter,
      deletedAt: Date.now(),
    });
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
