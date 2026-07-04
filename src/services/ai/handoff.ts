import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import type { Chapter, ReviewCandidate } from '@/db/types';
import type { KnownEntity } from '@/services/extraction/known-index';
import { extractJsonBlock, extractionPrompt, mapAiPayload } from './ai-candidates';

/** The AI Handoff pack: use ANY external AI (ChatGPT, Claude, a free
 * tier…) instead of in-app tokens. Export a self-contained prompt with
 * project context; paste the AI's JSON reply back and it lands in the
 * review queue exactly like in-app extraction. */

export function buildHandoffPack(input: {
  projectName: string;
  known: KnownEntity[];
  chapter?: Pick<Chapter, 'title' | 'paragraphs'> | null;
}): string {
  const knownNames = (['cast', 'locations', 'items', 'factions'] as const).map((type) => ({
    type,
    names: input.known.filter((k) => k.type === type).map((k) => k.name),
  }));
  const lines = [
    `# Loomwright handoff — ${input.projectName}`,
    '',
    extractionPrompt(knownNames),
  ];
  if (input.chapter) {
    lines.push('', `## Chapter: ${input.chapter.title}`, '');
    lines.push(input.chapter.paragraphs.map((p) => p.text).join('\n\n'));
  } else {
    lines.push('', '## Paste your chapter text below this line before sending.', '');
  }
  return lines.join('\n');
}

/** Parse an external AI's reply into pending review candidates. */
export async function importHandoffResponse(
  projectId: string,
  responseText: string,
  known: KnownEntity[]
): Promise<{ added: number } | { error: string }> {
  const payload = extractJsonBlock(responseText);
  if (!payload) {
    return { error: 'No JSON found in the pasted reply — copy the whole answer including the {...} block.' };
  }
  const candidates = mapAiPayload(payload, known, 'handoff');
  if (candidates.length === 0) {
    return { error: 'The reply parsed, but contained no usable entities.' };
  }
  const pending = await db.candidates
    .where('[projectId+status]')
    .equals([projectId, 'pending'])
    .toArray();
  const seen = new Set(
    pending.map((c) => `${c.entityType}|${c.name.toLowerCase()}|${c.suggestedAction}`)
  );
  const rows: ReviewCandidate[] = [];
  for (const c of candidates) {
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
      source: 'handoff',
      createdAt: Date.now(),
    });
  }
  if (rows.length) await db.candidates.bulkAdd(rows);
  return { added: rows.length };
}
