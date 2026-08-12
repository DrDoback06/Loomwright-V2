import { db } from '@/db/schema';
import type { IdentityRule } from '@/db/types';
import type { KnownEntity } from './known-index';
import { isLiveEntity, toKnownEntity } from './entity-to-known';

function learnedAliases(entityId: string, rules: IdentityRule[]): string[] {
  return rules
    .filter(
      (rule) =>
        rule.kind === 'same' &&
        rule.canonicalEntityId === entityId &&
        typeof rule.surface === 'string' &&
        rule.surface.length >= 2
    )
    .map((rule) => rule.surface);
}

/** Load the canonical extraction vocabulary for a project. User-confirmed
 * identity lessons are folded into the aliases before every scan, so once
 * “Graham” is merged into “Graham Hendricks”, later chapters resolve it
 * directly instead of returning the same review problem. */
export async function loadKnownProjectEntities(projectId: string): Promise<KnownEntity[]> {
  const [rows, rules] = await Promise.all([
    db.entities.where('projectId').equals(projectId).toArray(),
    db.identityRules.where('projectId').equals(projectId).toArray(),
  ]);
  return rows
    .filter(isLiveEntity)
    .map((entity) => toKnownEntity(entity, learnedAliases(entity.id, rules)));
}
