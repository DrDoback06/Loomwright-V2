import { db } from '@/db/schema';
import type { KnownEntity } from '@/services/extraction/known-index';

/** Every entity in the project as the minimal shape coercion and prompt
 * context need. One query; callers pass the result around synchronously. */
export async function loadKnownEntities(projectId: string): Promise<KnownEntity[]> {
  const rows = await db.entities.where('projectId').equals(projectId).toArray();
  return rows
    .filter((e) => e.status === 'active')
    .map((e) => ({ id: e.id, type: e.type, name: e.name, aliases: e.aliases }));
}
