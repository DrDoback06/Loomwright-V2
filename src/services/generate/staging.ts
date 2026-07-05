import { db } from '@/db/schema';
import type { RouteId } from '@/stores/ui';
import type { EntityType } from '@/domain/entity-types';
import { loadKnownEntities } from './known';
import { generateRandomBundle, generateSkillTreeBranchBundle } from './random/engine';
import type { GenerationBundle, GenerationRequest } from './types';

/** Run any random-mode request, loading whatever context it needs (known
 * entities; the existing tree for branch extension). The staged bar's
 * Reroll is this same call with the same request and a fresh seed. */
export async function runRandomGeneration(
  request: GenerationRequest,
  projectId: string
): Promise<GenerationBundle | { error: string }> {
  const known = await loadKnownEntities(projectId);
  const ctx = { projectId, known };
  if (request.kind === 'skilltree-branch') {
    const tree = request.targetGraphId ? await db.skillTrees.get(request.targetGraphId) : undefined;
    if (!tree) return { error: 'Pick a tree to grow a branch on first.' };
    return generateSkillTreeBranchBundle(request, ctx, tree);
  }
  return generateRandomBundle(request, ctx);
}

/** Where a staged bundle should be watched from. */
export function routeForBundle(bundle: GenerationBundle): { route: RouteId; codexType?: EntityType } {
  const graph = bundle.graphs[0];
  if (graph?.kind === 'skilltree') return { route: 'skill-trees' };
  if (graph?.kind === 'tangle') return { route: 'tangle' };
  if (bundle.chapters.length) return { route: 'writers-room' };
  const type = bundle.entities[0]?.type;
  return type ? { route: 'codex', codexType: type } : { route: 'home' };
}

/** Every bundle-local id that should render as a staged ghost. */
export function stagedIdsOf(bundle: GenerationBundle | null): Set<string> {
  const ids = new Set<string>();
  if (!bundle) return ids;
  for (const e of bundle.entities) ids.add(e.localId);
  for (const g of bundle.graphs) {
    ids.add(g.localId);
    for (const n of g.nodes) ids.add(n.id);
    for (const e of g.edges) ids.add(e.id);
  }
  for (const c of bundle.chapters) ids.add(c.localId);
  return ids;
}
