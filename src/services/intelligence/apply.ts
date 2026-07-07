import { applyBundle, type ApplyResult } from '@/services/generate/apply';
import type { StoryDelta } from './types';

/** Apply a StoryDelta's FACTS — entity creates, field patches to existing
 * entities, graph/tree placements, chapters, and links — in one Dexie
 * transaction with one reversible `generate.apply` audit entry (reusing the
 * generation apply + undo machinery). Suggestions are NOT applied here; they
 * ride the inbox lane (`db/repos/suggestions`). One Undo reverts everything
 * this created or patched. */
export async function applyDelta(delta: StoryDelta): Promise<ApplyResult> {
  return applyBundle({
    id: delta.id,
    projectId: delta.projectId,
    entities: delta.entities,
    graphs: delta.graphs,
    chapters: delta.chapters,
    links: delta.links,
    patches: delta.patches,
  });
}
