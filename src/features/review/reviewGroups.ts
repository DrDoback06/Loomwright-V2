import type { ReviewCandidate } from '@/db/types';
import { propagate, type PropagateContext } from '@/services/intelligence/propagate';
import type { StoryDelta } from '@/services/intelligence/types';

/** One relational cascade on the smart review board — every pending change
 * about a single subject entity, propagated into a mini StoryDelta for
 * display (before→after patches, new entities, and suggestions). */
export interface ReviewGroup {
  key: string;
  title: string;
  /** The pending candidates feeding this group (accept/dismiss operate on these). */
  candidateIds: string[];
  delta: StoryDelta;
  conflict: boolean;
  confidence: number;
}

/** A candidate's subject: the entity it changes (updates) or the new entity
 * it proposes (creates) — the axis cascades group around. */
function subjectKey(c: ReviewCandidate): string {
  if (c.existingEntityId) return c.existingEntityId;
  return `new:${c.entityType}:${c.name.toLowerCase()}`;
}

function subjectTitle(c: ReviewCandidate, ctx: PropagateContext): string {
  if (c.existingEntityId) {
    return ctx.entities.find((e) => e.id === c.existingEntityId)?.name ?? c.name;
  }
  return c.name;
}

/** Group pending candidates by subject and propagate each group into a mini
 * delta. Conflicts float to the top, then highest confidence. (No source
 * text here — the skill-learned scan runs at extraction time, not review.) */
export function buildReviewGroups(candidates: ReviewCandidate[], ctx: PropagateContext): ReviewGroup[] {
  const byKey = new Map<string, ReviewCandidate[]>();
  for (const c of candidates) {
    const k = subjectKey(c);
    const list = byKey.get(k);
    if (list) list.push(c);
    else byKey.set(k, [c]);
  }
  const groups: ReviewGroup[] = [];
  for (const [key, cs] of byKey) {
    const delta = propagate(cs, ctx);
    groups.push({
      key,
      title: subjectTitle(cs[0], ctx),
      candidateIds: cs.map((c) => c.id),
      delta,
      conflict: delta.patches.some((p) => p.conflict),
      confidence: Math.max(...cs.map((c) => c.confidence)),
    });
  }
  return groups.sort(
    (a, b) => Number(b.conflict) - Number(a.conflict) || b.confidence - a.confidence
  );
}
