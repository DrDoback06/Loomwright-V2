import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import type { Chapter } from '../types';

export async function listChapters(projectId: string): Promise<Chapter[]> {
  return db.chapters.where('[projectId+order]').between([projectId, -Infinity], [projectId, Infinity]).toArray();
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

export async function createChapter(projectId: string, title?: string): Promise<Chapter> {
  const existing = await listChapters(projectId);
  const now = Date.now();
  const chapter: Chapter = {
    id: newId(),
    projectId,
    title: title?.trim() || `Chapter ${existing.length + 1}`,
    order: existing.length,
    doc: null,
    paragraphs: [],
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.chapters.add(chapter);
  await logAudit({
    projectId,
    action: 'chapter.create',
    target: { table: 'chapters', id: chapter.id, label: chapter.title },
    after: chapter,
  });
  return chapter;
}

export async function renameChapter(id: string, title: string): Promise<void> {
  const chapter = await db.chapters.get(id);
  if (!chapter) return;
  await db.chapters.update(id, { title: title.trim() || chapter.title, updatedAt: Date.now() });
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

/** Move a chapter one slot earlier/later, swapping orders. */
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
    await logAudit({
      projectId: chapter.projectId,
      action: 'chapter.delete',
      target: { table: 'chapters', id, label: chapter.title },
      before: chapter,
    });
  });
}
