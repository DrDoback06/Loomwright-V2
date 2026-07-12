import { db } from '@/db/schema';
import type { IdentityRule } from '@/db/types';
import type { KnownEntity } from './known-index';

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
    .filter((entity) => entity.status !== 'merged')
    .map((entity) => ({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      aliases: [
        ...new Set([
          ...entity.aliases,
          ...learnedAliases(entity.id, rules),
        ]),
      ],
      pronouns: typeof entity.fields.pronouns === 'string' ? entity.fields.pronouns : undefined,
      gender: typeof entity.fields.gender === 'string' ? entity.fields.gender : undefined,
      statPhrases:
        entity.type === 'stats' && Array.isArray(entity.fields.extractionRules)
          ? (entity.fields.extractionRules as string[])
          : undefined,
    }));
}
