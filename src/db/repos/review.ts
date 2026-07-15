import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import type { Entity, ReviewCandidate } from '../types';
import type { EntityType } from '@/domain/entity-types';
import { buildMergePreview, commitMerge } from './merge';

export async function listPendingCandidates(projectId: string): Promise<ReviewCandidate[]> {
  const rows = await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray();
  return rows.sort((a, b) => b.confidence - a.confidence);
}

export async function countPendingCandidates(projectId: string): Promise<number> {
  return db.candidates.where('[projectId+status]').equals([projectId, 'pending']).count();
}

/** Remove only unresolved extraction proposals and their provisional mentions.
 * Manuscript text, accepted/denied decisions, entities, identity lessons and
 * canonical occurrences are untouched. */
export async function clearPendingCandidates(projectId: string): Promise<number> {
  const pending = await listPendingCandidates(projectId);
  if (!pending.length) return 0;
  const ids = pending.map((candidate) => candidate.id);
  await db.transaction('rw', db.candidates, db.occurrences, async () => {
    await db.occurrences.where('candidateId').anyOf(ids).delete();
    await db.candidates.bulkDelete(ids);
  });
  await logAudit({
    projectId,
    action: 'review.clear-pending',
    target: { table: 'candidates', id: projectId, label: 'Pending extraction queue' },
    before: { pendingCount: ids.length },
    after: { pendingCount: 0 },
  });
  return ids.length;
}

/** Apply one queue item through the same graph-safe merge engine used by the
 * full preview. */
export async function acceptCandidate(id: string): Promise<Entity | null> {
  const candidate = await db.candidates.get(id);
  if (!candidate || candidate.status !== 'pending') return null;

  const preview = await buildMergePreview({
    entityType: candidate.entityType,
    candidateIds: [candidate.id],
    targetEntityId: candidate.existingEntityId ?? null,
    canonicalName: candidate.existingEntityId ? undefined : candidate.name,
  });
  const result = await commitMerge(preview, {
    canonicalName: preview.targetEntity?.name ?? preview.canonicalName,
    aliases: preview.aliases,
    fieldDecisions: Object.fromEntries(
      preview.fields.map((field) => [field.key, field.defaultDecision])
    ),
  });
  return result.entity;
}

export async function denyCandidate(id: string): Promise<void> {
  const candidate = await db.candidates.get(id);
  if (!candidate || candidate.status !== 'pending') return;
  await db.candidates.update(id, { status: 'denied' });
  await db.occurrences.where('candidateId').equals(id).delete();
  await logAudit({
    projectId: candidate.projectId,
    action: 'review.deny',
    target: { table: 'candidates', id, label: candidate.name },
  });
}

export async function acceptAllCandidates(projectId: string, ids?: string[]): Promise<number> {
  const pending = ids ?? (await listPendingCandidates(projectId)).map((candidate) => candidate.id);
  let done = 0;
  for (const id of pending) {
    const entity = await acceptCandidate(id);
    if (entity) done += 1;
  }
  return done;
}


export async function retypeCandidates(ids: string[], entityType: EntityType): Promise<number> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return 0;
  const rows = (await db.candidates.bulkGet(uniqueIds)).filter((row): row is ReviewCandidate => Boolean(row && row.status === 'pending'));
  if (!rows.length) return 0;
  await db.transaction('rw', db.candidates, db.occurrences, async () => {
    for (const row of rows) {
      await db.candidates.update(row.id, {
        entityType,
        existingEntityId: null,
        suggestedAction: 'create',
        matchType: 'new',
      });
      await db.occurrences.where('candidateId').equals(row.id).modify({ entityType });
    }
  });
  await logAudit({
    projectId: rows[0].projectId,
    action: 'review.retype',
    target: { table: 'candidates', id: rows[0].id, label: rows.map((row) => row.name).join(', ') },
    before: { entityTypes: [...new Set(rows.map((row) => row.entityType))] },
    after: { entityType, candidateIds: rows.map((row) => row.id) },
  });
  return rows.length;
}

/** Insert fresh candidates for a chapter, replacing its pending ones. User
 * identity lessons live in their own table, so re-extraction can replace raw
 * rows without forgetting accepted surfaces. */
export async function replaceChapterCandidates(
  projectId: string,
  chapterId: string,
  candidates: Omit<ReviewCandidate, 'id' | 'projectId' | 'chapterId' | 'status' | 'createdAt' | 'source'>[]
): Promise<ReviewCandidate[]> {
  const priorPending = await db.candidates
    .where('[projectId+chapterId]')
    .equals([projectId, chapterId])
    .filter((candidate) => candidate.status === 'pending')
    .toArray();
  await db.candidates.bulkDelete(priorPending.map((candidate) => candidate.id));

  const now = Date.now();
  const rows: ReviewCandidate[] = candidates.map((candidate) => ({
    ...candidate,
    id: newId(),
    projectId,
    chapterId,
    status: 'pending',
    source: 'local',
    createdAt: now,
  }));
  if (rows.length) await db.candidates.bulkAdd(rows);
  return rows;
}
