import { db } from '../schema';
import type { SuggestionRecord } from '@/services/intelligence/types';

/** Keep the inbox honest — an unbounded list of ideas is noise, not help.
 * Oldest dismissed rows are pruned first. */
const MAX_PER_PROJECT = 200;

export async function listPendingSuggestions(projectId: string): Promise<SuggestionRecord[]> {
  const rows = await db.suggestions
    .where('[projectId+status]')
    .equals([projectId, 'pending'])
    .toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Pending suggestions attached to one entity — the dossier chips. */
export async function listSuggestionsFor(
  projectId: string,
  entityId: string
): Promise<SuggestionRecord[]> {
  const rows = await db.suggestions.where('targetEntityId').equals(entityId).toArray();
  return rows
    .filter((r) => r.projectId === projectId && r.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function dismissSuggestion(id: string): Promise<void> {
  await db.suggestions.update(id, { status: 'dismissed' });
}

export async function markSuggestionAccepted(id: string): Promise<void> {
  await db.suggestions.update(id, { status: 'accepted' });
}

/** Trim the oldest resolved rows once a project runs over the cap. */
export async function pruneSuggestions(projectId: string): Promise<number> {
  const rows = await db.suggestions.where('projectId').equals(projectId).toArray();
  if (rows.length <= MAX_PER_PROJECT) return 0;
  const resolved = rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);
  const excess = rows.length - MAX_PER_PROJECT;
  const doomed = resolved.slice(0, excess);
  await db.suggestions.bulkDelete(doomed.map((r) => r.id));
  return doomed.length;
}
