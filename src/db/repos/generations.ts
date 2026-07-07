import { db } from '../schema';
import { newId } from '@/lib/id';
import type { GenerationRecord } from '../types';
import { bundleTitle, type GenerationBundle } from '@/services/generate/types';

/** Keep the history honest — the newest 25 generations per project. */
const HISTORY_CAP = 25;

/** Record a generated bundle in the per-project history, trimming to the
 * last HISTORY_CAP. Best-effort: callers fire-and-forget it. */
export async function recordGeneration(bundle: GenerationBundle): Promise<void> {
  const record: GenerationRecord = {
    id: newId(),
    projectId: bundle.projectId,
    title: bundleTitle(bundle),
    mode: bundle.mode,
    kind: bundle.request.kind,
    seed: bundle.seed,
    bundle,
    createdAt: bundle.createdAt || Date.now(),
  };
  await db.generations.add(record);
  const all = await db.generations.where('projectId').equals(bundle.projectId).sortBy('createdAt');
  if (all.length > HISTORY_CAP) {
    await db.generations.bulkDelete(all.slice(0, all.length - HISTORY_CAP).map((r) => r.id));
  }
}

/** Newest-first generation history for a project. */
export async function listGenerations(projectId: string): Promise<GenerationRecord[]> {
  const rows = await db.generations.where('projectId').equals(projectId).sortBy('createdAt');
  return rows.reverse();
}

/** The stored bundle, typed back to its real shape for re-staging. */
export function bundleOf(record: GenerationRecord): GenerationBundle {
  return record.bundle as GenerationBundle;
}
