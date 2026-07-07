import { db } from '@/db/schema';
import { saveBoardTemplate, saveEntityTemplate } from '@/services/templates';
import type { ApplyResult } from '@/services/generate/apply';
import type { GenerationBundle } from '@/services/generate/types';
import { toast, type ToastAction } from '@/stores/toasts';

/** A "save what you just accepted as a reusable template" toast action —
 * offered after a bundle lands when it maps cleanly onto the template
 * system: a single created entity (→ entity template) or a brand-new
 * tangle board (→ board template). Returns undefined when neither fits. */
export function templateActionFor(
  bundle: GenerationBundle,
  result: ApplyResult
): ToastAction | undefined {
  // A single fresh entity → an entity template.
  if (result.created.length === 1 && !bundle.graphs.length && !bundle.chapters.length) {
    const ref = result.created[0];
    return {
      label: 'Save as template',
      run: async () => {
        const entity = await db.entities.get(ref.id);
        if (!entity) return;
        const t = await saveEntityTemplate(bundle.projectId, entity);
        toast(`Saved “${t.name}” — reuse it from Tools ▸ Templates.`, { kind: 'success' });
      },
    };
  }

  // A brand-new tangle board (not an add-to-board draft) → a board template.
  const newBoard = bundle.graphs.find((g) => g.kind === 'tangle' && !g.targetGraphId);
  if (newBoard && result.graphIds.length) {
    return {
      label: 'Save board as template',
      run: async () => {
        const board = await db.tangleBoards.get(result.graphIds[0]);
        if (!board) return;
        const t = await saveBoardTemplate(bundle.projectId, `${board.name} template`, board.cards, board.edges);
        toast(`Saved “${t.name}” — stamp it from the Tangle sidebar or Tools ▸ Templates.`, {
          kind: 'success',
        });
      },
    };
  }

  return undefined;
}
