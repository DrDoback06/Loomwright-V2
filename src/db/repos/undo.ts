import { db } from '../schema';
import { getAuditEntry, logAudit } from './audit';
import type { Entity } from '../types';
import type { GenerateApplyRecord } from '@/services/generate/apply';

/** Undo a reversible audit entry by writing its `before` snapshot back
 * (or removing the record for a create). Logs a fresh audit entry —
 * undo itself is auditable and re-undoable. */
export async function undoAuditEntry(entryId: string): Promise<boolean> {
  const entry = await getAuditEntry(entryId);
  if (!entry || !entry.reversible) return false;

  switch (entry.action) {
    case 'entity.create': {
      const created = entry.after as Entity | null;
      if (!created) return false;
      await db.entities.delete(created.id);
      await logAudit({
        projectId: entry.projectId,
        action: 'entity.delete',
        target: entry.target,
        before: created,
        reversible: true,
      });
      return true;
    }
    case 'entity.update': {
      const before = entry.before as Entity | null;
      if (!before) return false;
      const current = await db.entities.get(before.id);
      await db.entities.put(before);
      await logAudit({
        projectId: entry.projectId,
        action: 'entity.update',
        target: entry.target,
        before: current ?? null,
        after: before,
        reversible: true,
      });
      return true;
    }
    case 'entity.delete': {
      const deleted = entry.before as Entity | null;
      if (!deleted) return false;
      await db.transaction('rw', [db.entities, db.trash, db.auditLog], async () => {
        await db.entities.put(deleted);
        await db.trash.delete(deleted.id);
        await logAudit({
          projectId: entry.projectId,
          action: 'entity.create',
          target: entry.target,
          after: deleted,
          reversible: true,
        });
      });
      return true;
    }
    case 'generate.apply': {
      const record = entry.after as GenerateApplyRecord | null;
      if (!record) return false;
      await db.transaction(
        'rw',
        [db.entities, db.skillTrees, db.tangleBoards, db.chapters, db.links, db.auditLog],
        async () => {
          await db.entities.bulkDelete(record.entityIds);
          for (const patched of record.patchedEntities) {
            await db.entities.put(patched.before);
          }
          // Story-delta field patches: restore the pre-patch snapshots.
          for (const patched of record.patchedFields ?? []) {
            await db.entities.put(patched.before);
          }
          for (const graph of record.graphs) {
            const table = graph.kind === 'skilltree' ? db.skillTrees : db.tangleBoards;
            await table.delete(graph.id);
          }
          for (const patched of record.patchedGraphs) {
            const table = patched.kind === 'skilltree' ? db.skillTrees : db.tangleBoards;
            await table.put(patched.before as never);
          }
          await db.chapters.bulkDelete(record.chapterIds);
          await db.links.bulkDelete(record.linkIds);
          await logAudit({
            projectId: entry.projectId,
            action: 'generate.undo',
            target: entry.target,
            before: record,
            reversible: false,
          });
        }
      );
      return true;
    }
    default:
      return false;
  }
}
