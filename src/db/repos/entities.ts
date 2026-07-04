import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import type { Entity } from '../types';
import type { EntityRef, EntityType } from '@/domain/entity-types';

export function toRef(entity: Entity): EntityRef {
  return { id: entity.id, type: entity.type, name: entity.name };
}

export async function listEntities(projectId: string, type: EntityType): Promise<Entity[]> {
  const rows = await db.entities.where('[projectId+type]').equals([projectId, type]).toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEntity(id: string): Promise<Entity | undefined> {
  return db.entities.get(id);
}

interface CreateEntityInput {
  projectId: string;
  type: EntityType;
  name: string;
  summary?: string;
  aliases?: string[];
  tags?: string[];
  fields?: Record<string, unknown>;
}

export async function createEntity(input: CreateEntityInput): Promise<Entity> {
  const now = Date.now();
  const entity: Entity = {
    id: newId(),
    projectId: input.projectId,
    type: input.type,
    name: input.name.trim(),
    aliases: input.aliases ?? [],
    summary: input.summary ?? '',
    status: 'active',
    tags: input.tags ?? [],
    fields: input.fields ?? {},
    createdAt: now,
    updatedAt: now,
  };
  await db.entities.add(entity);
  await logAudit({
    projectId: input.projectId,
    action: 'entity.create',
    target: { table: 'entities', id: entity.id, label: entity.name },
    after: entity,
    reversible: true,
  });
  return entity;
}

export async function updateEntity(
  id: string,
  patch: Partial<Pick<Entity, 'name' | 'aliases' | 'summary' | 'status' | 'tags' | 'fields'>>
): Promise<Entity> {
  const before = await db.entities.get(id);
  if (!before) throw new Error(`Entity ${id} not found`);
  const after: Entity = { ...before, ...patch, updatedAt: Date.now() };
  await db.entities.put(after);
  await logAudit({
    projectId: before.projectId,
    action: 'entity.update',
    target: { table: 'entities', id, label: after.name },
    before,
    after,
    reversible: true,
  });
  return after;
}

/** Soft delete: the entity moves to the trash table and leaves the live set. */
export async function deleteEntityToTrash(id: string): Promise<void> {
  const entity = await db.entities.get(id);
  if (!entity) return;
  await db.transaction('rw', [db.entities, db.trash, db.auditLog], async () => {
    await db.trash.put({
      id: entity.id,
      projectId: entity.projectId,
      table: 'entities',
      label: entity.name,
      payload: entity,
      deletedAt: Date.now(),
    });
    await db.entities.delete(id);
    await logAudit({
      projectId: entity.projectId,
      action: 'entity.delete',
      target: { table: 'entities', id, label: entity.name },
      before: entity,
      reversible: true,
    });
  });
}

/** Undo helper used by the audit log: writes a snapshot back. */
export async function restoreEntitySnapshot(snapshot: Entity): Promise<void> {
  await db.transaction('rw', [db.entities, db.trash], async () => {
    await db.entities.put(snapshot);
    await db.trash.delete(snapshot.id);
  });
}

export async function removeEntityById(id: string): Promise<void> {
  await db.entities.delete(id);
}
