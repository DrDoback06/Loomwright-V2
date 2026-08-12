import { db } from '@/db/schema';
import type { KnownEntity } from '@/services/extraction/known-index';
import { toKnownEntity } from '@/services/extraction/entity-to-known';

/** Every entity in the project as the minimal shape coercion and prompt
 * context need. One query; callers pass the result around synchronously. */
export async function loadKnownEntities(projectId: string): Promise<KnownEntity[]> {
  const rows = await db.entities.where('projectId').equals(projectId).toArray();
  // Deliberately stricter than `isLiveEntity`: generation should not offer
  // an archived entry as an existing name to reference.
  return rows.filter((e) => e.status === 'active').map((e) => toKnownEntity(e));
}
