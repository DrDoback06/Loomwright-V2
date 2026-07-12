import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import type { Entity, ReviewCandidate } from '../types';
import { buildMergePreview, commitMerge } from './merge';

export async function listPendingCandidates(projectId: string): Promise<ReviewCandidate[]> {
  const rows = await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray();
  return rows.sort((a, b) => b.confidence - a.confidence);
}

export async function countPendingCandidates(projectId: string): Promise<number> {
  return db.candidates.where('[projectId+status]').equals([projectId, 'pending']).count();
}

/** Apply one queue item through the same graph-safe merge engine used by the
 * full preview. This keeps direct/safe accepts fast while still producing a
 * receipt, learned identity rules, chapter-aware history, location visits,
 * occurrence relinking and cross-tab reference updates. */
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
  // Remove the pending mentions tied to this candidate.
  await db.occurrences.where('candidateId').equals(id).delete();
  await logAudit({
    projectId: candidate.projectId,
    action: 'review.deny',
    target: { table: 'candidates', id, label: candidate.name },
  });
}

export async function acceptAllCandidates(projectId: string, ids?: string[]): Promise<number> {
  const pending = ids ?? (await listPendingCandidates(projectId)).map((c) => c.id);
  let done = 0;
  for (const id of pending) {
    const entity = await acceptCandidate(id);
    if (entity) done++;
  }
  return done;
}

/** Insert fresh candidates for a chapter, replacing its pending ones. User
 * identity lessons live in their own table, so re-extraction can replace raw
 * rows without forgetting what Graham, Captain Graham, or any other accepted
 * surface means. */
export async function replaceChapterCandidates(
  projectId: string,
  chapterId: string,
  candidates: Omit<ReviewCandidate, 'id' | 'projectId' | 'chapterId' | 'status' | 'createdAt' | 'source'>[]
): Promise<ReviewCandidate[]> {
  const priorPending = await db.candidates
    .where('[projectId+chapterId]')
    .equals([projectId, chapterId])
    .filter((c) => c.status === 'pending')
    .toArray();
  await db.candidates.bulkDelete(priorPending.map((c) => c.id));

  const now = Date.now();
  const rows: ReviewCandidate[] = candidates.map((c) => ({
    ...c,
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
