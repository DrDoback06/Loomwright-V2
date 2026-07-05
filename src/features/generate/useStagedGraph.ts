import { useMemo } from 'react';
import type { GraphEdge, GraphNode } from '@/db/types';
import type { BundleGraphDraft } from '@/services/generate/types';
import { useGenerationStore } from '@/stores/generation';

export interface StagedGraphOverlay {
  /** The staged graph draft of this kind, if any. */
  draft: BundleGraphDraft | null;
  /** True when the draft is a brand-new graph (no target) — the surface
   * shows it as a virtual entry until Accept. */
  isVirtual: boolean;
  stagedIds: Set<string>;
  /** Merge staged nodes/edges into an existing graph's arrays (extension
   * drafts targeting graphId), or pass through untouched. */
  merge: (graphId: string | null, nodes: GraphNode[], edges: GraphEdge[]) => {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  /** Pre-accept drag tweak: move a staged node inside the draft. */
  moveStagedNode: (nodeId: string, x: number, y: number) => void;
}

/** Ghost-rendering support for canvas surfaces: exposes the staged graph
 * draft of a kind, merged render arrays, and pre-accept node drags. */
export function useStagedGraph(kind: 'skilltree' | 'tangle'): StagedGraphOverlay {
  const staged = useGenerationStore((s) => s.staged);
  const updateStaged = useGenerationStore((s) => s.updateStaged);

  return useMemo(() => {
    const draft = staged?.graphs.find((g) => g.kind === kind) ?? null;
    const stagedIds = new Set<string>();
    if (draft) {
      for (const n of draft.nodes) stagedIds.add(n.id);
      for (const e of draft.edges) stagedIds.add(e.id);
    }
    return {
      draft,
      isVirtual: Boolean(draft && !draft.targetGraphId),
      stagedIds,
      merge: (graphId, nodes, edges) => {
        if (!draft || !draft.targetGraphId || draft.targetGraphId !== graphId) {
          return { nodes, edges };
        }
        return { nodes: [...nodes, ...draft.nodes], edges: [...edges, ...draft.edges] };
      },
      moveStagedNode: (nodeId, x, y) => {
        if (!staged || !draft) return;
        updateStaged({
          ...staged,
          graphs: staged.graphs.map((g) =>
            g === draft
              ? { ...g, nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)) }
              : g
          ),
        });
      },
    };
  }, [staged, kind, updateStaged]);
}
