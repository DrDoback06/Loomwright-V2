import Dexie from 'dexie';
import { db } from '../schema';
import { logAudit } from './audit';
import type { Entity, TrashRow } from '../types';

export async function listTrash(projectId: string): Promise<TrashRow[]> {
  return db.trash
    .where('[projectId+deletedAt]')
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .reverse()
    .toArray();
}

/** Restore a trashed row back into its table. */
export async function restoreFromTrash(id: string): Promise<void> {
  const row = await db.trash.get(id);
  if (!row) return;
  await db.transaction('rw', [db.trash, db.entities, db.chapters, db.auditLog], async () => {
    if (row.table === 'entities') {
      await db.entities.put(row.payload as Entity);
    } else if (row.table === 'chapters') {
      await db.chapters.put(row.payload as never);
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
