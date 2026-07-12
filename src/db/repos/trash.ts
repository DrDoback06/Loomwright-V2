import Dexie from 'dexie';
import { db } from '../schema';
import { logAudit } from './audit';
import type { Chapter, Entity, TrashRow } from '../types';
import { refreshProjectChapterReferences } from '@/services/chapter-awareness';

export async function listTrash(projectId: string): Promise<TrashRow[]> {
  return db.trash
    .where('[projectId+deletedAt]')
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .reverse()
    .toArray();
}

/** Restore a trashed row back into its table. Chapter restoration preserves
 * the original stable id and reinserts it at its previous narrative position,
 * shifting later chapters rather than creating duplicate order values. All
 * chapter-anchored entity/Atlas/timeline projections are then refreshed locally. */
export async function restoreFromTrash(id: string): Promise<void> {
  const row = await db.trash.get(id);
  if (!row) return;
  let restoredChapter = false;
  await db.transaction('rw', [db.trash, db.entities, db.chapters, db.auditLog], async () => {
    if (row.table === 'entities') {
      await db.entities.put(row.payload as Entity);
    } else if (row.table === 'chapters') {
      const chapter = row.payload as Chapter;
      const siblings = await db.chapters
        .where('[projectId+order]')
        .between([row.projectId, -Infinity], [row.projectId, Infinity])
        .toArray();
      const insertAt = Math.max(0, Math.min(chapter.order, siblings.length));
      const now = Date.now();
      for (const sibling of siblings.filter((candidate) => candidate.order >= insertAt)) {
        await db.chapters.update(sibling.id, { order: sibling.order + 1, updatedAt: now });
      }
      await db.chapters.put({ ...chapter, order: insertAt, updatedAt: now });
      restoredChapter = true;
    } else {
      throw new Error(`Cannot restore rows from table ${row.table}`);
    }
    await db.trash.delete(id);
    await logAudit({
      projectId: row.projectId,
      action: `${row.table === 'entities' ? 'entity' : 'chapter'}.restore`,
      target: { table: row.table, id: row.id, label: row.label },
      after: row.payload,
    });
  });
  if (restoredChapter) await refreshProjectChapterReferences(row.projectId);
}

/** Permanently delete a trashed row. The UI must double-confirm. */
export async function purgeFromTrash(id: string): Promise<void> {
  const row = await db.trash.get(id);
  if (!row) return;
  await db.trash.delete(id);
  await logAudit({
    projectId: row.projectId,
    action: 'trash.purge',
    target: { table: row.table, id: row.id, label: row.label },
    before: row.payload,
  });
}
