import { db } from '../schema';
import { newId } from '@/lib/id';
import type { EntityType } from '@/domain/entity-types';
import type { IdentityRule } from '../types';

export function normaliseIdentitySurface(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function listIdentityRules(projectId: string): Promise<IdentityRule[]> {
  return db.identityRules.where('projectId').equals(projectId).toArray();
}

export async function rememberSameIdentity(input: {
  projectId: string;
  entityType: EntityType;
  surface: string;
  canonicalEntityId: string;
}): Promise<IdentityRule> {
  const surface = normaliseIdentitySurface(input.surface);
  const existing = await db.identityRules
    .where('[projectId+entityType]')
    .equals([input.projectId, input.entityType])
    .filter(
      (rule) =>
        rule.kind === 'same' &&
        rule.surface === surface &&
        rule.canonicalEntityId === input.canonicalEntityId
    )
    .first();
  if (existing) return existing;
  const now = Date.now();
  const rule: IdentityRule = {
    id: newId(),
    projectId: input.projectId,
    entityType: input.entityType,
    kind: 'same',
    surface,
    canonicalEntityId: input.canonicalEntityId,
    createdAt: now,
    updatedAt: now,
  };
  await db.identityRules.add(rule);
  return rule;
}

export async function rememberDifferentIdentity(input: {
  projectId: string;
  entityType: EntityType;
  left: string;
  right: string;
}): Promise<IdentityRule> {
  const pair = [normaliseIdentitySurface(input.left), normaliseIdentitySurface(input.right)].sort();
  const [surface, otherSurface] = pair;
  const existing = await db.identityRules
    .where('[projectId+entityType]')
    .equals([input.projectId, input.entityType])
    .filter(
      (rule) =>
        rule.kind === 'different' &&
        rule.surface === surface &&
        rule.otherSurface === otherSurface
    )
    .first();
  if (existing) return existing;
  const now = Date.now();
  const rule: IdentityRule = {
    id: newId(),
    projectId: input.projectId,
    entityType: input.entityType,
    kind: 'different',
    surface,
    otherSurface,
    createdAt: now,
    updatedAt: now,
  };
  await db.identityRules.add(rule);
  return rule;
}

export function isRejectedPair(rules: IdentityRule[], left: string, right: string): boolean {
  const pair = [normaliseIdentitySurface(left), normaliseIdentitySurface(right)].sort();
  return rules.some(
    (rule) =>
      rule.kind === 'different' &&
      rule.surface === pair[0] &&
      rule.otherSurface === pair[1]
  );
}

export function canonicalRuleFor(
  rules: IdentityRule[],
  entityType: EntityType,
  surface: string
): IdentityRule | undefined {
  const key = normaliseIdentitySurface(surface);
  return rules.find(
    (rule) =>
      rule.kind === 'same' &&
      rule.entityType === entityType &&
      rule.surface === key &&
      !!rule.canonicalEntityId
  );
}
