import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import { logAudit } from '@/db/repos/audit';
import { replaceChapterCandidates } from '@/db/repos/review';
import type { Chapter, Occurrence } from '@/db/types';
import { isProvisionalId, runLocalExtraction } from './engine';
import type { ExtractionCandidate } from './detectors';
import { loadKnownProjectEntities } from './project-known';

export interface ExtractionSummary {
  occurrenceCount: number;
  candidateCount: number;
  /** Known-entity mentions re-confirmed, by entity. */
  knownMentions: { entityId: string; name: string; count: number }[];
  /** The candidates this pass produced. Returned so callers that also want a
   * StoryDelta can propagate from them instead of re-scanning the same prose
   * with a second engine — the scan is the expensive half. */
  candidates: ExtractionCandidate[];
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

  const entities = await loadKnownProjectEntities(projectId);
  const overrides = await loadDetectorOverrides(projectId);
  const { occurrences, candidates } = runLocalExtraction({
    text: fullText,
    entities,
    confidenceOverrides: overrides,
  });

  // Replace this chapter's prior occurrences — but only the ones this pass
  // owns.
  //
  // A `typed` row is a projection of an `@` mention in the prose, and the
  // author put it there deliberately. Clearing it here would mean the Save
  // & Extract button silently deleted an assertion every time it ran, and
  // the only reason it would come back is that the next keystroke saves the
  // scene. Leave them alone.
  await db.occurrences
    .where('[projectId+chapterId]')
    .equals([projectId, chapter.id])
    .and((row) => row.source !== 'typed')
    .delete();

  // What the author has already said is here, so the detectors do not say
  // it again. A typed mention and a matched name over the same words are
  // one mention, and two rows would double every count built on them.
  const typedSpans = await loadTypedSpans(projectId, chapter.id);

  // Persist candidates first so candidate occurrences can point at them.
  //
  // Provisional ids are stripped on the way in. They are a delta-lane concept
  // — a stand-in for a row that does not exist yet, which `applyDelta` swaps
  // for a real id at accept time. In this table `existingEntityId` means "a
  // row you can go and update", so a provisional id here would send Accept
  // looking for an entity that was never created.
  const rows = await replaceChapterCandidates(
    projectId,
    chapter.id,
    candidates.map((c) => ({
      entityType: c.entityType,
      name: c.name,
      suggestedAction: isProvisionalId(c.existingEntityId) ? 'create' : c.suggestedAction,
      matchType: isProvisionalId(c.existingEntityId) ? 'new' : c.matchType,
      existingEntityId: isProvisionalId(c.existingEntityId) ? null : c.existingEntityId ?? null,
      suggestedChanges: c.suggestedChanges ?? null,
      confidence: c.confidence,
      confidenceBand: c.confidenceBand,
      sourceQuote: c.sourceQuote,
      sourceQuotes: c.sourceQuotes,
      relatedEntityIds: c.relatedEntityIds,
      summary: c.summary,
      detector: c.detector,
      typeSuggestions: c.typeSuggestions,
      interpretation: c.interpretation,
    }))
  );
  const candidateIdByName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));

  const toParagraph = (start: number, end: number) =>
    spans.find((s) => s.start <= start && s.end >= end) ?? null;

  const now = Date.now();
  const occurrenceRows: Occurrence[] = occurrences
    .map((o) => {
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
        source: 'extraction' as const,
        createdAt: now,
      };
    })
    // A typed mention wins. The author said so; the matcher only guessed.
    .filter((row) => !overlapsTypedSpan(typedSpans, row));
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
    candidates,
  };
}

/** Paragraph-relative spans the author has already claimed with `@`,
 * grouped by paragraph. Read from the scene rows rather than from the
 * occurrence table so this is true even on the very first extraction after
 * a mention was typed, before any reconciliation has run. */
async function loadTypedSpans(
  projectId: string,
  chapterId: string
): Promise<Map<string, { start: number; end: number }[]>> {
  const scenes = await db.scenes.where('chapterId').equals(chapterId).toArray();
  const byParagraph = new Map<string, { start: number; end: number }[]>();
  for (const scene of scenes) {
    if (scene.projectId !== projectId) continue;
    for (const mention of scene.mentions ?? []) {
      const list = byParagraph.get(mention.pid) ?? [];
      list.push({ start: mention.start, end: mention.end });
      byParagraph.set(mention.pid, list);
    }
  }
  return byParagraph;
}

/** True when a detector hit sits on words a typed mention already covers. */
export function overlapsTypedSpan(
  typed: Map<string, { start: number; end: number }[]>,
  row: Pick<Occurrence, 'paragraphId' | 'start' | 'end'>
): boolean {
  if (!row.paragraphId) return false;
  const spans = typed.get(row.paragraphId);
  if (!spans) return false;
  return spans.some((span) => row.start < span.end && span.start < row.end);
}

async function loadDetectorOverrides(projectId: string): Promise<Record<string, number>> {
  const row = await db.settings.get(`${projectId}:extraction`);
  const value = row?.value as { detectorConfidence?: Record<string, number> } | undefined;
  return value?.detectorConfidence ?? {};
}
