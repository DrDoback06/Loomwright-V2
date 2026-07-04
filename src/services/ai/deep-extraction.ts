import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import type { Chapter, ReviewCandidate } from '@/db/types';
import { chunkText } from '@/services/extraction/text-utils';
import type { KnownEntity } from '@/services/extraction/known-index';
import { complete, type ProviderConfig } from './providers';
import { extractJsonBlock, extractionPrompt, mapAiPayload } from './ai-candidates';

/** The AI deep pass: chunk the chapter, ask the provider for structured
 * entities, and add the results to the SAME review queue as the local
 * pass (deduped against pending). Never auto-applies anything. */
export async function runDeepExtraction(
  chapter: Chapter,
  config: ProviderConfig,
  known: KnownEntity[]
): Promise<{ added: number }> {
  const projectId = chapter.projectId;
  const fullText = chapter.paragraphs.map((p) => p.text).join('\n\n');
  if (!fullText.trim()) return { added: 0 };

  const knownNames = (['cast', 'locations', 'items', 'factions'] as const).map((type) => ({
    type,
    names: known.filter((k) => k.type === type).map((k) => k.name),
  }));
  const system = extractionPrompt(knownNames);

  const chunks = chunkText(fullText, 5000, 500);
  const collected = [];
  for (const chunk of chunks) {
    const text = await complete(config, {
      system,
      prompt: `Chapter chunk ${chunk.index + 1}/${chunks.length}:\n\n${chunk.text}`,
      maxTokens: 2000,
    });
    const payload = extractJsonBlock(text);
    if (payload) collected.push(...mapAiPayload(payload, known, 'ai'));
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
  return { added: rows.length };
}
