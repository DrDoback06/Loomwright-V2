import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import type { Chapter, ReviewCandidate } from '@/db/types';
import { chunkText } from '@/services/extraction/text-utils';
import type { KnownEntity } from '@/services/extraction/known-index';
import { type ProviderConfig } from './providers';
import { completeJson } from './json';
import { TIER_BUDGET, tierForModel } from './prompts';
import { buildExtractionPrompt } from './prompts/extraction';
import { mapAiPayload, type AiExtractionPayload } from './ai-candidates';

export interface DeepExtractionResult {
  added: number;
  /** Chunks the model could not be made to answer in JSON for. */
  failedChunks: number;
  /** Chunks whose reply was cut off — the passage was too long for the model. */
  truncatedChunks: number;
  /** How many chunks needed a repair round-trip to parse. */
  repairedChunks: number;
}

/**
 * The AI deep pass: chunk the chapter, ask the provider for structured
 * entities, and add the results to the SAME review queue as the local pass
 * (deduped against pending). Never auto-applies anything.
 *
 * Three things changed to make this work on a free key. The request now forces
 * JSON at the API level and runs at temperature 0, so the same chapter gives
 * the same answer twice. A reply that will not parse gets one repair
 * round-trip instead of being silently dropped. And chunk size follows the
 * model's tier — an 8B model handed 5,000 characters returns a summary of the
 * chunk rather than an extraction of it.
 */
export async function runDeepExtraction(
  chapter: Chapter,
  config: ProviderConfig,
  known: KnownEntity[]
): Promise<DeepExtractionResult> {
  const projectId = chapter.projectId;
  const fullText = chapter.paragraphs.map((p) => p.text).join('\n\n');
  const empty = { added: 0, failedChunks: 0, truncatedChunks: 0, repairedChunks: 0 };
  if (!fullText.trim()) return empty;

  const tier = tierForModel(config);
  const budget = TIER_BUDGET[tier];

  const knownNames = (['cast', 'locations', 'items', 'factions', 'skills'] as const).map((type) => ({
    type,
    names: known.filter((k) => k.type === type).map((k) => k.name),
  }));
  const system = buildExtractionPrompt(knownNames, { tier, namesPerType: budget.namesPerType });

  // Overlap scales with the window so a sentence never straddles a cut.
  const chunks = chunkText(fullText, budget.chunkChars, Math.round(budget.chunkChars / 10));
  const collected = [];
  let failedChunks = 0;
  let truncatedChunks = 0;
  let repairedChunks = 0;

  for (const chunk of chunks) {
    const result = await completeJson(config, {
      system,
      prompt: `Passage ${chunk.index + 1} of ${chunks.length}:\n\n${chunk.text}`,
      maxTokens: budget.maxTokens,
    });
    if (result.repaired && result.value) repairedChunks++;
    if (result.truncated) truncatedChunks++;
    if (!result.value) {
      failedChunks++;
      continue;
    }
    collected.push(...mapAiPayload(result.value as AiExtractionPayload, known, 'ai'));
  }

  // Dedupe against each other AND against existing pending candidates.
  const pending = await db.candidates
    .where('[projectId+status]')
    .equals([projectId, 'pending'])
    .toArray();
  const seen = new Set(
    pending.map((c) => `${c.entityType}|${c.name.toLowerCase()}|${c.suggestedAction}`)
  );
  const rows: ReviewCandidate[] = [];
  for (const c of collected) {
    const key = `${c.entityType}|${c.name.toLowerCase()}|${c.suggestedAction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: newId(),
      projectId,
      chapterId: chapter.id,
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
      source: 'ai',
      createdAt: Date.now(),
    });
  }
  if (rows.length) await db.candidates.bulkAdd(rows);
  return { added: rows.length, failedChunks, truncatedChunks, repairedChunks };
}

/** A one-line honest account of a deep pass, for the toast. */
export function describeDeepExtraction(result: DeepExtractionResult): string {
  const parts: string[] = [
    result.added > 0
      ? `AI deep pass found ${result.added} new candidate${result.added === 1 ? '' : 's'}.`
      : 'AI deep pass found nothing beyond the local scan.',
  ];
  if (result.truncatedChunks) {
    parts.push(
      `${result.truncatedChunks} section${result.truncatedChunks === 1 ? '' : 's'} were cut off — the model ran out of output room.`
    );
  }
  if (result.failedChunks) {
    parts.push(
      `${result.failedChunks} section${result.failedChunks === 1 ? ' reply was' : ' replies were'} unreadable.`
    );
  }
  return parts.join(' ');
}
