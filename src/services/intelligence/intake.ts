import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import { chunkText } from '@/services/extraction/text-utils';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { ExtractionCandidate } from '@/services/extraction/detectors';
import type { KnownEntity } from '@/services/extraction/known-index';
import type { ReviewCandidate } from '@/db/types';

export interface IntakeProgress {
  chunk: number;
  total: number;
}

export interface IntakeResult {
  added: number;
  chunks: number;
}

/** Whole-book offline intake — the headline onboarding path. Chunk the text
 * (5000/500, so mentions spanning a boundary survive), run the local
 * extraction on each chunk, dedupe candidates across chunks (highest
 * confidence wins) and against the existing queue, and drop the survivors
 * into Review as pending. Reports per-chunk progress and yields between
 * chunks so the UI can paint. Never applies anything — the board does. */
export async function extractWholeText(
  projectId: string,
  text: string,
  known: KnownEntity[],
  onProgress?: (p: IntakeProgress) => void
): Promise<IntakeResult> {
  const chunks = chunkText(text, 5000, 500);
  const merged = new Map<string, ExtractionCandidate>();

  for (const [i, chunk] of chunks.entries()) {
    onProgress?.({ chunk: i + 1, total: chunks.length });
    const { candidates } = runLocalExtraction({ text: chunk.text, entities: known });
    for (const c of candidates) {
      const key = `${c.entityType}|${c.name.toLowerCase()}|${c.suggestedAction}|${c.existingEntityId ?? ''}`;
      const prior = merged.get(key);
      if (!prior) {
        merged.set(key, c);
      } else {
        // Keep the higher-confidence candidate but UNION suggestedChanges and
        // quotes, so e.g. a travel change from one chunk and a faction change
        // from another both survive rather than one clobbering the other.
        const base = c.confidence > prior.confidence ? c : prior;
        merged.set(key, {
          ...base,
          suggestedChanges: { ...(prior.suggestedChanges ?? {}), ...(c.suggestedChanges ?? {}) },
          sourceQuotes: [...new Set([...(prior.sourceQuotes ?? []), ...(c.sourceQuotes ?? [])])].slice(0, 3),
        });
      }
    }
    // Let the event loop breathe so a progress indicator can update.
    await Promise.resolve();
  }

  const pending = await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray();
  const seen = new Set(pending.map((c) => `${c.entityType}|${c.name.toLowerCase()}|${c.suggestedAction}`));
  const now = Date.now();
  const rows: ReviewCandidate[] = [];
  for (const c of merged.values()) {
    const key = `${c.entityType}|${c.name.toLowerCase()}|${c.suggestedAction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: newId(),
      projectId,
      entityType: c.entityType,
      name: c.name,
      suggestedAction: c.suggestedAction,
      matchType: c.matchType,
      existingEntityId: c.existingEntityId ?? null,
      suggestedChanges: c.suggestedChanges ?? null,
      confidence: c.confidence,
      confidenceBand: c.confidenceBand,
      sourceQuote: c.sourceQuote,
      sourceQuotes: c.sourceQuotes,
      relatedEntityIds: c.relatedEntityIds,
      summary: c.summary,
      detector: c.detector,
      status: 'pending',
      source: 'local',
      createdAt: now,
    });
  }
  if (rows.length) await db.candidates.bulkAdd(rows);
  return { added: rows.length, chunks: chunks.length };
}
