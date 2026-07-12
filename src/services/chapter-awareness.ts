import { db } from '@/db/schema';
import type { Chapter, Entity, ReviewCandidate } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';

export interface ChapterAnchoredFact {
  id: string;
  chapterId: string | null;
  chapterOrder: number | null;
  chapterLabel: string;
  /** True when the stable chapter id no longer exists (for example, the
   * chapter is in Trash). Evidence is preserved and clearly marked. */
  chapterMissing?: boolean;
  paragraphId?: string | null;
  kind: string;
  summary: string;
  sourceQuote?: string;
  candidateId?: string;
  sourceEntityId?: string;
  location?: EntityRef;
  createdAt: number;
}

export interface ChapterLookup {
  ordered: Chapter[];
  byId: Map<string, { chapter: Chapter; order: number; label: string }>;
}

export async function buildChapterLookup(projectId: string): Promise<ChapterLookup> {
  const ordered = await db.chapters
    .where('[projectId+order]')
    .between([projectId, -Infinity], [projectId, Infinity])
    .toArray();
  const byId = new Map<string, { chapter: Chapter; order: number; label: string }>();
  ordered.forEach((chapter, index) => {
    byId.set(chapter.id, {
      chapter,
      order: index,
      label: `Chapter ${index + 1} · ${chapter.title}`,
    });
  });
  return { ordered, byId };
}

function factKey(fact: ChapterAnchoredFact): string {
  return [
    fact.candidateId ?? '',
    fact.sourceEntityId ?? '',
    fact.chapterId ?? '',
    fact.kind,
    fact.location?.id ?? '',
    String(fact.summary ?? fact.kind ?? 'Evidence').trim().toLowerCase(),
    fact.sourceQuote?.trim().toLowerCase() ?? '',
  ].join('|');
}

export function mergeChapterFacts(
  existing: ChapterAnchoredFact[],
  incoming: ChapterAnchoredFact[],
  lookup: ChapterLookup
): ChapterAnchoredFact[] {
  const map = new Map<string, ChapterAnchoredFact>();
  for (const fact of [...existing, ...incoming]) {
    const chapter = fact.chapterId ? lookup.byId.get(fact.chapterId) : undefined;
    const missing = !!fact.chapterId && !chapter;
    const preservedLabel = fact.chapterLabel && !fact.chapterLabel.startsWith('Removed chapter · ')
      ? fact.chapterLabel
      : fact.chapterLabel?.replace(/^Removed chapter · /, '') || 'Unknown chapter';
    const next: ChapterAnchoredFact = {
      ...fact,
      summary: String(fact.summary ?? fact.kind ?? 'Evidence'),
      chapterOrder: chapter?.order ?? null,
      chapterLabel: chapter?.label ?? (missing ? `Removed chapter · ${preservedLabel}` : (fact.chapterLabel || 'Unplaced evidence')),
      chapterMissing: missing || undefined,
    };
    map.set(factKey(next), next);
  }
  return [...map.values()].sort((a, b) => {
    const ao = a.chapterOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.chapterOrder ?? Number.MAX_SAFE_INTEGER;
    return ao - bo || a.createdAt - b.createdAt;
  });
}

export async function candidateToChapterFact(
  candidate: ReviewCandidate,
  lookup: ChapterLookup
): Promise<ChapterAnchoredFact> {
  const chapter = candidate.chapterId ? lookup.byId.get(candidate.chapterId) : undefined;
  let location: EntityRef | undefined;
  const locationId = candidate.suggestedChanges?.location;
  if (typeof locationId === 'string') {
    const place = await db.entities.get(locationId);
    if (place) location = { id: place.id, type: place.type, name: place.name };
  }
  return {
    id: `candidate:${candidate.id}`,
    chapterId: candidate.chapterId ?? null,
    chapterOrder: chapter?.order ?? null,
    chapterLabel: chapter?.label ?? 'Unplaced evidence',
    kind: candidate.detector ?? candidate.suggestedAction,
    summary:
      candidate.summary ||
      `${candidate.name}: ${candidate.suggestedAction === 'create' ? 'new entity' : 'new information'}`,
    sourceQuote: candidate.sourceQuote,
    candidateId: candidate.id,
    location,
    createdAt: candidate.createdAt,
  };
}

function isFactArray(value: unknown): value is ChapterAnchoredFact[] {
  return Array.isArray(value) && value.every((row) => typeof row === 'object' && row !== null);
}

function refsFromTravelFacts(facts: ChapterAnchoredFact[]): EntityRef[] {
  const out: EntityRef[] = [];
  for (const fact of facts) {
    if (!fact.location) continue;
    const prior = out[out.length - 1];
    if (!prior || prior.id !== fact.location.id) out.push(fact.location);
  }
  return out;
}

function refreshEntityFields(entity: Entity, lookup: ChapterLookup): Record<string, unknown> | null {
  const fields = { ...entity.fields };
  let changed = false;
  for (const key of ['timelineFacts', 'travelTimeline', 'characterVisits']) {
    const value = fields[key];
    if (!isFactArray(value)) continue;
    const refreshed = mergeChapterFacts([], value, lookup);
    if (JSON.stringify(refreshed) !== JSON.stringify(value)) {
      fields[key] = refreshed;
      changed = true;
    }
  }

  if (entity.type === 'cast' && isFactArray(fields.travelTimeline)) {
    const travelTimeline = fields.travelTimeline;
    const history = refsFromTravelFacts(travelTimeline);
    const current = history[history.length - 1];
    if (JSON.stringify(fields.travelHistory ?? []) !== JSON.stringify(history)) {
      fields.travelHistory = history;
      changed = true;
    }
    if (JSON.stringify(fields.currentLocation ?? null) !== JSON.stringify(current ?? null)) {
      fields.currentLocation = current ?? null;
      changed = true;
    }
    const first = travelTimeline[0];
    const last = travelTimeline[travelTimeline.length - 1];
    if (first && fields.firstAppearance !== first.chapterLabel) {
      fields.firstAppearance = first.chapterLabel;
      changed = true;
    }
    if (last && fields.lastAppearance !== last.chapterLabel) {
      fields.lastAppearance = last.chapterLabel;
      changed = true;
    }
  }
  return changed ? fields : null;
}

/** Re-index lightweight chapter-aware snapshots after a chapter is inserted,
 * moved, renamed, or removed. Stable chapter ids remain canonical, so this
 * does not re-run extraction; it only re-sorts small fact arrays and refreshes
 * display labels/current-location derivatives. */
export async function refreshProjectChapterReferences(projectId: string): Promise<number> {
  const lookup = await buildChapterLookup(projectId);
  const entities = await db.entities.where('projectId').equals(projectId).toArray();
  let changed = 0;
  await db.transaction('rw', db.entities, async () => {
    for (const entity of entities) {
      if (entity.status === 'merged') continue;
      const fields = refreshEntityFields(entity, lookup);
      if (!fields) continue;
      changed += 1;
      await db.entities.update(entity.id, { fields, updatedAt: Date.now() });
    }
  });
  return changed;
}

export function chapterInsertionDescription(
  chapterId: string | undefined,
  existingFacts: ChapterAnchoredFact[],
  lookup: ChapterLookup
): string | null {
  if (!chapterId) return null;
  const chapter = lookup.byId.get(chapterId);
  if (!chapter) return null;
  const orderedExisting = existingFacts
    .filter((fact) => fact.chapterOrder != null)
    .sort((a, b) => (a.chapterOrder ?? 0) - (b.chapterOrder ?? 0));
  const before = [...orderedExisting]
    .reverse()
    .find((fact) => (fact.chapterOrder ?? -1) < chapter.order);
  const after = orderedExisting.find((fact) => (fact.chapterOrder ?? Infinity) > chapter.order);
  if (before && after) return `Inserted between ${before.chapterLabel} and ${after.chapterLabel}`;
  if (before) return `Added after ${before.chapterLabel}`;
  if (after) return `Added before ${after.chapterLabel}`;
  return `Added at ${chapter.label}`;
}
