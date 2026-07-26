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

/**
 * The last timestamp handed out, so two entries in one millisecond still get
 * distinct, increasing ones.
 *
 * `at` is the sort key for the whole history. Two actions inside the same
 * millisecond — which is ordinary, a create followed by an update happens in
 * well under one — produced equal keys, and IndexedDB then ordered them by
 * primary key, which is random. The visible cost is that the newest entry is
 * not reliably first, so "Undo" offered the wrong action. Nudging forward is
 * a lie of at most a few milliseconds and buys a total order.
 */
let lastStamp = 0;

function monotonicNow(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

/** Append an audit entry. Callers pass full before/after snapshots for
 * reversible actions; undo simply writes `before` back through the repo. */
export async function logAudit(input: LogInput): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: newId(),
    projectId: input.projectId,
    at: monotonicNow(),
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
