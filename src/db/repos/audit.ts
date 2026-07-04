import Dexie from 'dexie';
import { db } from '../schema';
import { newId } from '@/lib/id';
import type { AuditActor, AuditEntry } from '../types';

const MAX_ENTRIES_PER_PROJECT = 500;

interface LogInput {
  projectId: string;
  action: string;
  target: { table: string; id: string; label?: string };
  before?: unknown;
  after?: unknown;
  actor?: AuditActor;
  reversible?: boolean;
}

function projectRange(projectId: string) {
  return db.auditLog
    .where('[projectId+at]')
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey]);
}

/** Append an audit entry. Callers pass full before/after snapshots for
 * reversible actions; undo simply writes `before` back through the repo. */
export async function logAudit(input: LogInput): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: newId(),
    projectId: input.projectId,
    at: Date.now(),
    actor: input.actor ?? 'user',
    action: input.action,
    target: input.target,
    before: input.before ?? null,
    after: input.after ?? null,
    reversible: input.reversible ?? false,
  };
  await db.auditLog.add(entry);
  const count = await projectRange(input.projectId).count();
  if (count > MAX_ENTRIES_PER_PROJECT) {
    const oldest = await projectRange(input.projectId)
      .limit(count - MAX_ENTRIES_PER_PROJECT)
      .toArray();
    await db.auditLog.bulkDelete(oldest.map((e) => e.id));
  }
  return entry;
}

export async function listAudit(projectId: string, limit = 50): Promise<AuditEntry[]> {
  return projectRange(projectId).reverse().limit(limit).toArray();
}

export async function getAuditEntry(id: string): Promise<AuditEntry | undefined> {
  return db.auditLog.get(id);
}
