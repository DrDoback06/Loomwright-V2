import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import { logAudit } from '@/db/repos/audit';
import { replaceChapterCandidates } from '@/db/repos/review';
import type { Chapter, Occurrence } from '@/db/types';
import type { KnownEntity } from './known-index';
import { runLocalExtraction } from './engine';

export interface ExtractionSummary {
  occurrenceCount: number;
  candidateCount: number;
  /** Known-entity mentions re-confirmed, by entity. */
  knownMentions: { entityId: string; name: string; count: number }[];
}

async function loadProjectEntities(projectId: string): Promise<KnownEntity[]> {
  const rows = await db.entities.where('projectId').equals(projectId).toArray();
  return rows.map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    aliases: e.aliases,
    pronouns: typeof e.fields.pronouns === 'string' ? e.fields.pronouns : undefined,
    gender: typeof e.fields.gender === 'string' ? e.fields.gender : undefined,
  }));
}

/** Run the offline extraction pass for one chapter and persist the
 * results. Idempotent per chapter: prior occurrences and still-pending
 * candidates are replaced; accepted/denied work is preserved. */
export async function extractChapter(chapter: Chapter): Promise<ExtractionSummary> {
  const projectId = chapter.projectId;

  // Join paragraphs into one text with an offset map (double newline
  // separators keep detector windows from crossing paragraph joins).
  const separator = '\n\n';
  let fullText = '';
  const spans: { id: string; start: number; end: number }[] = [];
  for (const p of chapter.paragraphs) {
    if (fullText) fullText += separator;
    const start = fullText.length;
    fullText += p.text;
    spans.push({ id: p.id, start, end: fullText.length });
  }

  const entities = await loadProjectEntities(projectId);
  const overrides = await loadDetectorOverrides(projectId);
  const { occurrences, candidates } = runLocalExtraction({
    text: fullText,
    entities,
    confidenceOverrides: overrides,
  });

  // Replace this chapter's prior occurrences.
  await db.occurrences.where('[projectId+chapterId]').equals([projectId, chapter.id]).delete();

  // Persist candidates first so candidate occurrences can point at them.
  const rows = await replaceChapterCandidates(
    projectId,
    chapter.id,
    candidates.map((c) => ({
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
    }))
  );
  const candidateIdByName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));

  const toParagraph = (start: number, end: number) =>
    spans.find((s) => s.start <= start && s.end >= end) ?? null;

  const now = Date.now();
  const occurrenceRows: Occurrence[] = occurrences.map((o) => {
    const para = toParagraph(o.start, o.end);
    return {
      id: newId(),
      projectId,
      entityId: o.entityId,
      entityType: o.entityType,
      chapterId: chapter.id,
      paragraphId: para?.id ?? null,
      start: para ? o.start - para.start : o.start,
      end: para ? o.end - para.start : o.end,
      exactText: o.exactText,
      isPronounResolution: o.isPronounResolution,
      candidateId: o.candidateName
        ? candidateIdByName.get(o.candidateName.toLowerCase())
        : undefined,
      createdAt: now,
    };
  });
  if (occurrenceRows.length) await db.occurrences.bulkAdd(occurrenceRows);

  const knownMentions = (() => {
    const byEntity = new Map<string, { entityId: string; name: string; count: number }>();
    for (const o of occurrenceRows) {
      if (!o.entityId) continue;
      const cur = byEntity.get(o.entityId) ?? { entityId: o.entityId, name: '', count: 0 };
      cur.count++;
      byEntity.set(o.entityId, cur);
    }
    return [...byEntity.values()].sort((a, b) => b.count - a.count);
  })();
  for (const km of knownMentions) {
    const e = entities.find((en) => en.id === km.entityId);
    km.name = e?.name ?? km.entityId;
  }

  await logAudit({
    projectId,
    action: 'extraction.run',
    actor: 'extraction',
    target: { table: 'chapters', id: chapter.id, label: chapter.title },
    after: { occurrenceCount: occurrenceRows.length, candidateCount: rows.length },
  });

  return {
    occurrenceCount: occurrenceRows.length,
    candidateCount: rows.length,
    knownMentions,
  };
}

async function loadDetectorOverrides(projectId: string): Promise<Record<string, number>> {
  const row = await db.settings.get(`${projectId}:extraction`);
  const value = row?.value as { detectorConfidence?: Record<string, number> } | undefined;
  return value?.detectorConfidence ?? {};
}
