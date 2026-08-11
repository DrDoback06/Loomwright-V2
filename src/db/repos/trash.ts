import Dexie from 'dexie';
import { db } from '../schema';
import { logAudit } from './audit';
import type { Chapter, Entity, Scene, TrashRow } from '../types';
import { refreshProjectChapterReferences } from '@/services/chapter-awareness';
import { chapterRollup, resequenceScenes } from './scenes';

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
  let resequenceProjectId: string | null = null;
  await db.transaction(
    'rw',
    [db.trash, db.entities, db.chapters, db.scenes, db.auditLog],
    async () => {
      if (row.table === 'entities') {
        await db.entities.put(row.payload as Entity);
      } else if (row.table === 'chapters') {
        const { scenes = [], ...chapter } = row.payload as Chapter & { scenes?: Scene[] };
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
        // The prose came into the trash with the chapter; it goes back out
        // with it, at the same ids, so every occurrence still resolves.
        if (scenes.length) await db.scenes.bulkPut(scenes);
        restoredChapter = true;
        resequenceProjectId = row.projectId;
      } else if (row.table === 'scenes') {
        const scene = row.payload as Scene;
        const siblings = (await db.scenes.where('chapterId').equals(scene.chapterId).toArray()).sort(
          (a, b) => a.order - b.order
        );
        const insertAt = Math.max(0, Math.min(scene.order, siblings.length));
        const now = Date.now();
        for (const sibling of siblings.filter((candidate) => candidate.order >= insertAt)) {
          await db.scenes.update(sibling.id, { order: sibling.order + 1, updatedAt: now });
        }
        await db.scenes.put({ ...scene, order: insertAt, updatedAt: now });
        resequenceProjectId = row.projectId;
      } else {
        throw new Error(`Cannot restore rows from table ${row.table}`);
      }
      await db.trash.delete(id);
      await logAudit({
        projectId: row.projectId,
        action: `${RESTORE_ACTION[row.table] ?? row.table}.restore`,
        target: { table: row.table, id: row.id, label: row.label },
        after: row.payload,
      });
    }
  );
  // Outside the transaction: these read and write the same tables and
  // would deadlock inside it.
  if (resequenceProjectId) {
    await resequenceScenes(resequenceProjectId);
    if (row.table === 'chapters') {
      for (const scene of ((row.payload as { scenes?: Scene[] }).scenes ?? [])) {
        await chapterRollup(scene.chapterId);
      }
    } else {
      await chapterRollup((row.payload as Scene).chapterId);
    }
  }
  if (restoredChapter) await refreshProjectChapterReferences(row.projectId);
}

const RESTORE_ACTION: Record<string, string> = {
  entities: 'entity',
  chapters: 'chapter',
  scenes: 'scene',
};

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
