import { db } from '../schema';
import { newId } from '@/lib/id';
import type { Suggestion } from '../types';
import type { SuggestionDraft } from '@/services/intelligence/types';

/** Keep the inbox honest — newest ~200 per project, dismissed evicted first. */
const SUGGESTION_CAP = 200;

/** Persist suggestion drafts as pending inbox rows, deduped against the
 * pending set (same target + title), and trim to the cap. Returns the rows
 * actually written. */
export async function saveSuggestions(
  projectId: string,
  drafts: SuggestionDraft[]
): Promise<Suggestion[]> {
  const existing = await db.suggestions.where('projectId').equals(projectId).toArray();
  const seen = new Set(
    existing
      .filter((s) => s.status !== 'dismissed')
      .map((s) => `${s.targetId ?? ''}|${s.title.toLowerCase()}`)
  );
  const now = Date.now();
  const rows: Suggestion[] = [];
  drafts.forEach((d, i) => {
    const key = `${d.targetRef?.id ?? ''}|${d.title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      id: newId(),
      projectId,
      targetRef: d.targetRef,
      targetId: d.targetRef?.id,
      kind: d.kind,
      title: d.title,
      detail: d.detail,
      payload: d.payload,
      source: d.source,
      status: 'pending',
      createdAt: now + i, // preserve draft order across a batch
    });
  });
  if (rows.length) await db.suggestions.bulkAdd(rows);
  await trimSuggestions(projectId);
  return rows;
}

async function trimSuggestions(projectId: string): Promise<void> {
  const all = await db.suggestions.where('projectId').equals(projectId).sortBy('createdAt');
  if (all.length <= SUGGESTION_CAP) return;
  const overflow = all.length - SUGGESTION_CAP;
  // Oldest dismissed go first, then oldest of anything else.
  const dismissed = all.filter((s) => s.status === 'dismissed');
  const rest = all.filter((s) => s.status !== 'dismissed');
  const evict = [...dismissed, ...rest].slice(0, overflow).map((s) => s.id);
  await db.suggestions.bulkDelete(evict);
}

/** Pending (or a given status) suggestions for a project, newest first. */
export async function listSuggestions(
  projectId: string,
  status: Suggestion['status'] = 'pending'
): Promise<Suggestion[]> {
  const rows = await db.suggestions.where('[projectId+status]').equals([projectId, status]).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Pending suggestions targeting one entity — the dossier inbox chips. */
export async function listSuggestionsFor(
  projectId: string,
  targetId: string
): Promise<Suggestion[]> {
  const rows = await db.suggestions.where('[projectId+targetId]').equals([projectId, targetId]).toArray();
  return rows.filter((s) => s.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
}

export async function dismissSuggestion(id: string): Promise<void> {
  await db.suggestions.update(id, { status: 'dismissed' });
}

/** Mark a suggestion accepted; its payload delta is staged by the caller. */
export async function markSuggestionAccepted(id: string): Promise<Suggestion | undefined> {
  await db.suggestions.update(id, { status: 'accepted' });
  return db.suggestions.get(id);
}
