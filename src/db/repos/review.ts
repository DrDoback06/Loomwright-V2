import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import { createEntity, getEntity, updateEntity } from './entities';
import type { Entity, ReviewCandidate } from '../types';
import type { EntityRef } from '@/domain/entity-types';

export async function listPendingCandidates(projectId: string): Promise<ReviewCandidate[]> {
  const rows = await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray();
  return rows.sort((a, b) => b.confidence - a.confidence);
}

export async function countPendingCandidates(projectId: string): Promise<number> {
  return db.candidates.where('[projectId+status]').equals([projectId, 'pending']).count();
}

/** Map a candidate's suggestedChanges into entity top-level + fields.
 * `aliases` merge into the record's aliases; a bare `location` id becomes
 * a currentLocation EntityRef; everything else lands in fields. */
async function applyChangesToEntity(
  entity: Entity,
  changes: Record<string, unknown>
): Promise<{ aliases: string[]; fields: Record<string, unknown> }> {
  const aliases = new Set(entity.aliases);
  const fields = { ...entity.fields };
  for (const [key, value] of Object.entries(changes)) {
    if (value == null) continue;
    if (key === 'aliases' && Array.isArray(value)) {
      for (const a of value) if (typeof a === 'string' && a !== entity.name) aliases.add(a);
      continue;
    }
    if (key === 'location' && typeof value === 'string') {
      const place = await getEntity(value);
      if (place) {
        const ref: EntityRef = { id: place.id, type: place.type, name: place.name };
        fields.currentLocation = ref;
        const history = Array.isArray(fields.travelHistory) ? (fields.travelHistory as EntityRef[]) : [];
        if (!history.some((h) => h.id === ref.id)) fields.travelHistory = [...history, ref];
      }
      continue;
    }
    if (key === 'voiceProfile' && typeof value === 'string') {
      // Dialogue lines append to speech style rather than overwrite voice.
      const prior = typeof fields.speechStyle === 'string' ? fields.speechStyle : '';
      fields.speechStyle = prior ? `${prior}\n${value}` : value;
      continue;
    }
    fields[key] = value;
  }
  return { aliases: [...aliases], fields };
}

/** Backfill occurrences recorded against this candidate with the real
 * entity id once it exists. */
async function backfillCandidateOccurrences(candidateId: string, entityId: string) {
  await db.occurrences.where('candidateId').equals(candidateId).modify({ entityId });
}

export async function acceptCandidate(id: string): Promise<Entity | null> {
  const candidate = await db.candidates.get(id);
  if (!candidate || candidate.status !== 'pending') return null;

  let entity: Entity | null = null;
  if (candidate.suggestedAction === 'create') {
    const changes = candidate.suggestedChanges ?? {};
    const aliases = Array.isArray(changes.aliases) ? (changes.aliases as string[]) : [];
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (k !== 'aliases' && v != null) fields[k] = v;
    }
    entity = await createEntity({
      projectId: candidate.projectId,
      type: candidate.entityType,
      name: candidate.name,
      aliases: aliases.filter((a) => a !== candidate.name),
      summary: candidate.summary ?? '',
      fields,
    });
  } else if (candidate.existingEntityId) {
    const existing = await getEntity(candidate.existingEntityId);
    if (existing) {
      const changes = candidate.suggestedChanges ?? {};
      if (candidate.suggestedAction === 'merge') {
        // The discovered surface form becomes an alias of the existing record.
        if (candidate.name && candidate.name !== existing.name) changes.aliases = [candidate.name];
      }
      const { aliases, fields } = await applyChangesToEntity(existing, changes);
      entity = await updateEntity(existing.id, { aliases, fields });
    }
  }

  await db.candidates.update(id, {
    status: candidate.suggestedAction === 'merge' ? 'merged' : 'accepted',
    acceptedEntityId: entity?.id,
  });
  if (entity) await backfillCandidateOccurrences(id, entity.id);
  await logAudit({
    projectId: candidate.projectId,
    action: 'review.accept',
    actor: 'user',
    target: { table: 'candidates', id, label: candidate.name },
    after: entity,
  });
  return entity;
}

/** Return accepted candidates to the pending queue — the mirror of
 * markCandidatesAccepted, used when the board's one Undo reverts a delta. */
export async function rependCandidates(ids: string[]): Promise<void> {
  await db.candidates.where('id').anyOf(ids).modify({ status: 'pending', acceptedEntityId: undefined });
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

/** Mark candidates resolved WITHOUT re-applying their changes — the smart
 * board already applied them as one StoryDelta (applyDelta). Backfills
 * occurrences for create candidates by matching the delta's created rows on
 * type + name. Audits each as review.accept. */
export async function markCandidatesAccepted(
  ids: string[],
  created: EntityRef[]
): Promise<void> {
  for (const id of ids) {
    const c = await db.candidates.get(id);
    if (!c || c.status !== 'pending') continue;
    const match =
      c.suggestedAction === 'create'
        ? created.find((r) => r.type === c.entityType && r.name.toLowerCase() === c.name.toLowerCase())?.id
        : (c.existingEntityId ?? undefined);
    await db.candidates.update(id, {
      status: c.suggestedAction === 'merge' ? 'merged' : 'accepted',
      acceptedEntityId: match,
    });
    if (match) await db.occurrences.where('candidateId').equals(id).modify({ entityId: match });
    await logAudit({
      projectId: c.projectId,
      action: 'review.accept',
      actor: 'user',
      target: { table: 'candidates', id, label: c.name },
    });
  }
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

/** Insert fresh candidates for a chapter, replacing its pending ones. */
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
  await db.candidates.bulkAdd(rows);
  return rows;
}
