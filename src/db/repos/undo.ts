import { db } from '../schema';
import { getAuditEntry, logAudit } from './audit';
import type { Entity } from '../types';

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
    default:
      return false;
  }
}
