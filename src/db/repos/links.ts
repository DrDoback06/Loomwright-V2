import type { Entity } from '../types';

/** Merge `source` into `target` using the full reversible identity-resolution pipeline. */
export async function mergeEntities(sourceId: string, targetId: string): Promise<Entity | null> {
  const { mergeEntityRecordsDirect } = await import('./merge');
  return mergeEntityRecordsDirect(sourceId, targetId);
}
