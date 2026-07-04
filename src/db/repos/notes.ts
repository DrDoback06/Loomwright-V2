import { db } from '../schema';
import { newId } from '@/lib/id';
import type { ParagraphNote } from '../types';

export async function listChapterNotes(
  projectId: string,
  chapterId: string
): Promise<ParagraphNote[]> {
  const notes = await db.notes.where('[projectId+chapterId]').equals([projectId, chapterId]).toArray();
  return notes.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addParagraphNote(
  projectId: string,
  chapterId: string,
  paragraphId: string,
  text: string
): Promise<ParagraphNote> {
  const note: ParagraphNote = {
    id: newId(),
    projectId,
    chapterId,
    paragraphId,
    text: text.trim(),
    resolved: false,
    createdAt: Date.now(),
  };
  await db.notes.add(note);
  return note;
}

export async function resolveParagraphNote(id: string, resolved: boolean): Promise<void> {
  await db.notes.update(id, { resolved });
}

export async function deleteParagraphNote(id: string): Promise<void> {
  await db.notes.delete(id);
}
