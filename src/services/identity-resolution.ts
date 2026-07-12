import { db } from '@/db/schema';
import type { Entity, IdentityRule, ReviewCandidate } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';
import {
  canonicalRuleFor,
  isRejectedPair,
  listIdentityRules,
  normaliseIdentitySurface,
} from '@/db/repos/identity';

const HONORIFICS = new Set([
  'the',
  'captain',
  'commander',
  'warden',
  'lord',
  'lady',
  'sir',
  'dame',
  'king',
  'queen',
  'prince',
  'princess',
  'doctor',
  'dr',
  'master',
  'mistress',
  'father',
  'mother',
  'brother',
  'sister',
  'saint',
  'st',
  'chief',
  'general',
  'professor',
]);

export type IdentityCertainty = 'certain' | 'likely' | 'possible' | 'new';

export interface IdentityMatchReason {
  label: string;
  weight: number;
}

export interface IdentityEntityMatch {
  entity: Entity;
  score: number;
  certainty: IdentityCertainty;
  reasons: IdentityMatchReason[];
}

export interface IdentityCluster {
  id: string;
  entityType: EntityType;
  candidateIds: string[];
  candidates: ReviewCandidate[];
  primaryName: string;
  proposedAliases: string[];
  evidenceCount: number;
  chapterIds: string[];
  confidence: number;
  confidenceBand: ReviewCandidate['confidenceBand'];
  suggestedEntity: IdentityEntityMatch | null;
  certainty: IdentityCertainty;
  reasons: IdentityMatchReason[];
}

function tokens(value: string): string[] {
  return normaliseIdentitySurface(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function identityVariants(value: string): string[] {
  const base = tokens(value);
  const variants = new Set<string>();
  if (base.length) variants.add(base.join(' '));
  let stripped = [...base];
  while (stripped.length > 1 && HONORIFICS.has(stripped[0])) stripped = stripped.slice(1);
  if (stripped.length) variants.add(stripped.join(' '));
  if (stripped.length > 1) {
    variants.add(stripped[0]);
    variants.add(stripped[stripped.length - 1]);
  }
  return [...variants];
}

function levenshteinSimilarity(a: string, b: string): number {
  const left = normaliseIdentitySurface(a);
  const right = normaliseIdentitySurface(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= right.length; j += 1) {
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j < next.length; j += 1) prev[j] = next[j];
  }
  return 1 - prev[right.length] / Math.max(left.length, right.length);
}

function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokens(a).filter((token) => !HONORIFICS.has(token)));
  const right = new Set(tokens(b).filter((token) => !HONORIFICS.has(token)));
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.min(left.size, right.size);
}

function scoreNames(
  left: string,
  right: string,
  rules: IdentityRule[],
  entityType: EntityType,
  canonicalEntityId?: string
): { score: number; reasons: IdentityMatchReason[] } {
  if (isRejectedPair(rules, left, right)) return { score: 0, reasons: [{ label: 'Previously kept separate', weight: -1 }] };

  const leftRule = canonicalRuleFor(rules, entityType, left);
  const rightRule = canonicalRuleFor(rules, entityType, right);
  if (
    canonicalEntityId &&
    (leftRule?.canonicalEntityId === canonicalEntityId || rightRule?.canonicalEntityId === canonicalEntityId)
  ) {
    return { score: 1, reasons: [{ label: 'User-confirmed identity', weight: 1 }] };
  }
  if (
    leftRule?.canonicalEntityId &&
    rightRule?.canonicalEntityId &&
    leftRule.canonicalEntityId === rightRule.canonicalEntityId
  ) {
    return { score: 1, reasons: [{ label: 'Both names resolve to the same canonical entity', weight: 1 }] };
  }

  const leftVariants = identityVariants(left);
  const rightVariants = identityVariants(right);
  let best = 0;
  const reasons: IdentityMatchReason[] = [];
  for (const a of leftVariants) {
    for (const b of rightVariants) {
      if (a === b) {
        const fullExact = normaliseIdentitySurface(left) === normaliseIdentitySurface(right);
        const weight = fullExact ? 0.99 : 0.92;
        if (weight > best) {
          best = weight;
          reasons.splice(0, reasons.length, {
            label: fullExact ? 'Exact name match' : 'Title/name variant match',
            weight,
          });
        }
      }
      const overlap = tokenOverlap(a, b);
      if (overlap >= 1 && Math.min(tokens(a).length, tokens(b).length) === 1) {
        const weight = 0.84;
        if (weight > best) {
          best = weight;
          reasons.splice(0, reasons.length, { label: 'First name or surname is contained in the fuller name', weight });
        }
      } else if (overlap >= 0.66) {
        const weight = 0.8 + overlap * 0.1;
        if (weight > best) {
          best = weight;
          reasons.splice(0, reasons.length, { label: 'Most name tokens overlap', weight });
        }
      }
      const edit = levenshteinSimilarity(a, b);
      if (edit >= 0.86 && edit > best) {
        best = edit * 0.92;
        reasons.splice(0, reasons.length, { label: 'Likely spelling variant', weight: best });
      }
    }
  }
  return { score: best, reasons };
}

function certainty(score: number): IdentityCertainty {
  if (score >= 0.93) return 'certain';
  if (score >= 0.78) return 'likely';
  if (score >= 0.62) return 'possible';
  return 'new';
}

function candidatePairScore(
  left: ReviewCandidate,
  right: ReviewCandidate,
  rules: IdentityRule[]
): { score: number; reasons: IdentityMatchReason[] } {
  if (left.entityType !== right.entityType) return { score: 0, reasons: [] };
  // A deliberate “keep separate” decision always wins, even if a previous
  // extraction happened to point both rows at the same entity.
  if (isRejectedPair(rules, left.name, right.name)) {
    return { score: 0, reasons: [{ label: 'Previously kept separate', weight: -1 }] };
  }
  if (left.existingEntityId && left.existingEntityId === right.existingEntityId) {
    return { score: 1, reasons: [{ label: 'Both extractions point at the same entity', weight: 1 }] };
  }
  const direct = scoreNames(left.name, right.name, rules, left.entityType, left.existingEntityId ?? undefined);
  let score = direct.score;
  const reasons = [...direct.reasons];
  const relatedLeft = new Set(left.relatedEntityIds ?? []);
  const sharedRelated = (right.relatedEntityIds ?? []).filter((id) => relatedLeft.has(id)).length;
  if (sharedRelated > 0) {
    score = Math.min(1, score + Math.min(0.08, sharedRelated * 0.025));
    reasons.push({ label: `${sharedRelated} shared linked entit${sharedRelated === 1 ? 'y' : 'ies'}`, weight: 0.025 * sharedRelated });
  }
  if (left.chapterId && left.chapterId === right.chapterId) {
    score = Math.min(1, score + 0.02);
    reasons.push({ label: 'Found in the same chapter', weight: 0.02 });
  }
  return { score, reasons };
}

function entityMatchScore(
  candidates: ReviewCandidate[],
  entity: Entity,
  rules: IdentityRule[]
): { score: number; reasons: IdentityMatchReason[] } {
  let best = 0;
  let bestReasons: IdentityMatchReason[] = [];
  for (const candidate of candidates) {
    const surfaces = [entity.name, ...entity.aliases];
    const explicitlyRejected = surfaces.some((surface) =>
      isRejectedPair(rules, candidate.name, surface)
    );
    if (explicitlyRejected) continue;
    if (candidate.existingEntityId === entity.id) {
      return { score: 1, reasons: [{ label: 'Extraction already targets this entity', weight: 1 }] };
    }
    for (const surface of surfaces) {
      const result = scoreNames(candidate.name, surface, rules, candidate.entityType, entity.id);
      if (result.score > best) {
        best = result.score;
        bestReasons = result.reasons.map((reason) => ({
          ...reason,
          label: surface === entity.name ? reason.label : `${reason.label} via alias “${surface}”`,
        }));
      }
    }
    const rule = canonicalRuleFor(rules, candidate.entityType, candidate.name);
    if (rule?.canonicalEntityId === entity.id) {
      return { score: 1, reasons: [{ label: 'Learned alias maps directly to this entity', weight: 1 }] };
    }
  }
  return { score: best, reasons: bestReasons };
}

function choosePrimary(candidates: ReviewCandidate[]): ReviewCandidate {
  return [...candidates].sort((a, b) => {
    const aLinked = a.existingEntityId ? 1 : 0;
    const bLinked = b.existingEntityId ? 1 : 0;
    if (aLinked !== bLinked) return bLinked - aLinked;
    const aWords = tokens(a.name).length;
    const bWords = tokens(b.name).length;
    if (aWords !== bWords) return bWords - aWords;
    if (a.name.length !== b.name.length) return b.name.length - a.name.length;
    return b.confidence - a.confidence;
  })[0];
}

class DisjointSet {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    if (this.parent[index] !== index) this.parent[index] = this.find(this.parent[index]);
    return this.parent[index];
  }

  union(left: number, right: number) {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent[b] = a;
  }
}

export async function buildIdentityClusters(projectId: string): Promise<IdentityCluster[]> {
  const [candidates, entities, rules] = await Promise.all([
    db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray(),
    db.entities.where('projectId').equals(projectId).filter((entity) => entity.status !== 'merged').toArray(),
    listIdentityRules(projectId),
  ]);
  const byType = new Map<EntityType, ReviewCandidate[]>();
  for (const candidate of candidates) {
    const list = byType.get(candidate.entityType) ?? [];
    list.push(candidate);
    byType.set(candidate.entityType, list);
  }

  const clusters: IdentityCluster[] = [];
  for (const [entityType, rows] of byType) {
    const dsu = new DisjointSet(rows.length);
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const match = candidatePairScore(rows[i], rows[j], rules);
        if (match.score >= 0.78) dsu.union(i, j);
      }
    }
    const grouped = new Map<number, ReviewCandidate[]>();
    rows.forEach((candidate, index) => {
      const root = dsu.find(index);
      grouped.set(root, [...(grouped.get(root) ?? []), candidate]);
    });

    for (const group of grouped.values()) {
      const primary = choosePrimary(group);
      const names = [...new Set(group.map((candidate) => candidate.name).filter(Boolean))];
      const sameTypeEntities = entities.filter((entity) => entity.type === entityType);
      const entityMatches = sameTypeEntities
        .map((entity) => {
          const result = entityMatchScore(group, entity, rules);
          return {
            entity,
            score: result.score,
            certainty: certainty(result.score),
            reasons: result.reasons,
          } satisfies IdentityEntityMatch;
        })
        .filter((match) => match.score >= 0.58)
        .sort((a, b) => b.score - a.score);
      const suggestedEntity = entityMatches[0] ?? null;

      let pairBest = 0;
      let pairReasons: IdentityMatchReason[] = [];
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const result = candidatePairScore(group[i], group[j], rules);
          if (result.score > pairBest) {
            pairBest = result.score;
            pairReasons = result.reasons;
          }
        }
      }
      const score = Math.max(suggestedEntity?.score ?? 0, pairBest);
      const confidence = Math.max(...group.map((candidate) => candidate.confidence));
      const confidenceBand = [...group].sort((a, b) => b.confidence - a.confidence)[0].confidenceBand;
      clusters.push({
        id: `identity:${group.map((candidate) => candidate.id).sort().join(':')}`,
        entityType,
        candidateIds: group.map((candidate) => candidate.id),
        candidates: group.sort((a, b) => b.confidence - a.confidence),
        primaryName: suggestedEntity?.entity.name ?? primary.name,
        proposedAliases: names.filter((name) => normaliseIdentitySurface(name) !== normaliseIdentitySurface(suggestedEntity?.entity.name ?? primary.name)),
        evidenceCount: group.reduce(
          (count, candidate) => count + Math.max(1, candidate.sourceQuotes?.length ?? (candidate.sourceQuote ? 1 : 0)),
          0
        ),
        chapterIds: [...new Set(group.map((candidate) => candidate.chapterId).filter((id): id is string => !!id))],
        confidence,
        confidenceBand,
        suggestedEntity,
        certainty: certainty(score),
        reasons: suggestedEntity?.reasons ?? pairReasons,
      });
    }
  }

  return clusters.sort((a, b) => {
    const rank: Record<IdentityCertainty, number> = { certain: 0, likely: 1, possible: 2, new: 3 };
    return rank[a.certainty] - rank[b.certainty] || b.candidateIds.length - a.candidateIds.length || b.confidence - a.confidence;
  });
}

export async function countIdentityDecisions(projectId: string): Promise<number> {
  return (await buildIdentityClusters(projectId)).length;
}

export function candidateSimilarity(
  left: ReviewCandidate,
  right: ReviewCandidate,
  rules: IdentityRule[]
): number {
  return candidatePairScore(left, right, rules).score;
}
