import { db } from '../schema';
import type { Progression } from '../types';
import { newId } from '@/lib/id';
import { logAudit } from './audit';

export interface NewProgression {
  projectId: string;
  entityId: string;
  sceneId: string;
  text: string;
  mode?: Progression['mode'];
  fieldId?: string | null;
  source?: Progression['source'];
  confidence?: number;
}

export async function createProgression(input: NewProgression): Promise<Progression> {
  const row: Progression = {
    id: newId(),
    projectId: input.projectId,
    entityId: input.entityId,
    sceneId: input.sceneId,
    mode: input.mode ?? 'addition',
    fieldId: input.fieldId ?? null,
    text: input.text.trim(),
    source: input.source ?? 'manual',
    confidence: input.confidence ?? 1,
    createdAt: Date.now(),
  };
  await db.progressions.add(row);
  await logAudit({
    projectId: input.projectId,
    action: 'progression.create',
    target: { table: 'progressions', id: row.id, label: row.text.slice(0, 60) },
    after: row,
    reversible: true,
  });
  return row;
}

export async function listProgressions(projectId: string): Promise<Progression[]> {
  return db.progressions.where('projectId').equals(projectId).toArray();
}

export async function progressionsForEntity(
  projectId: string,
  entityId: string
): Promise<Progression[]> {
  const rows = await db.progressions
    .where('[projectId+entityId]')
    .equals([projectId, entityId])
    .toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteProgression(id: string): Promise<void> {
  const row = await db.progressions.get(id);
  if (!row) return;
  await db.progressions.delete(id);
  await logAudit({
    projectId: row.projectId,
    action: 'progression.delete',
    target: { table: 'progressions', id, label: row.text.slice(0, 60) },
    before: row,
    reversible: true,
  });
}
