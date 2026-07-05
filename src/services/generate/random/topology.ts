import type { Rng } from './rng';

export interface TopologyNode {
  localId: string;
  tier: number;
  /** Branch index (0-based); the root sits on branch 0's column. */
  branch: number;
}

export interface TopologyEdge {
  from: string;
  to: string;
}

export interface TreeTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  branchCount: number;
}

/** Prerequisite-DAG shape for a generated skill tree: one root, N named
 * branches of chained nodes, occasional forks and cross-branch links.
 * Semantic only — layout.ts turns tiers/branches into coordinates. */
export function generateTreeTopology(
  rng: Rng,
  opts: { nodeCount: number; branchCount?: number; idPrefix?: string }
): TreeTopology {
  const nodeCount = Math.max(3, Math.min(opts.nodeCount, 60));
  const branchCount = Math.max(1, Math.min(opts.branchCount ?? (nodeCount <= 6 ? 2 : 3), 5));
  const prefix = opts.idPrefix ?? 'node';

  const root: TopologyNode = { localId: `${prefix}-0`, tier: 0, branch: 0 };
  const nodes: TopologyNode[] = [root];
  const edges: TopologyEdge[] = [];

  // Last node of each branch chain (starts at the root for all).
  const tips: TopologyNode[] = Array.from({ length: branchCount }, () => root);

  for (let i = 1; i < nodeCount; i++) {
    const branch = (i - 1) % branchCount;
    const tip = tips[branch];
    // Fork: occasionally attach beside the tip (same parent) instead of
    // extending the chain, giving the branch a Y-split.
    const parent =
      tip !== root && rng.chance(0.22)
        ? nodes.find((n) => edges.some((e) => e.from === n.localId && e.to === tip.localId)) ?? tip
        : tip;
    const node: TopologyNode = {
      localId: `${prefix}-${i}`,
      tier: parent.tier + 1,
      branch,
    };
    nodes.push(node);
    edges.push({ from: parent.localId, to: node.localId });
    if (parent === tip) tips[branch] = node;

    // Rare cross-branch prerequisite for flavor (never into the root).
    if (rng.chance(0.08) && nodes.length > 4) {
      const other = rng.pick(nodes.filter((n) => n.branch !== branch && n.tier < node.tier));
      if (other && !edges.some((e) => e.from === other.localId && e.to === node.localId)) {
        edges.push({ from: other.localId, to: node.localId });
      }
    }
  }

  return { nodes, edges, branchCount };
}

/** A chain of new nodes hanging off an existing tree node — the
 * "generate branch" mode. Returns topology tiers relative to the attach
 * point so layout can place it into free space beside the tree. */
export function generateBranchTopology(
  rng: Rng,
  opts: { nodeCount: number; attachId: string; attachTier?: number; idPrefix?: string }
): TreeTopology {
  const nodeCount = Math.max(2, Math.min(opts.nodeCount, 20));
  const prefix = opts.idPrefix ?? 'branch';
  const baseTier = (opts.attachTier ?? 0) + 1;
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  let tip = opts.attachId;
  let tier = baseTier;
  for (let i = 0; i < nodeCount; i++) {
    const localId = `${prefix}-${i}`;
    nodes.push({ localId, tier, branch: 0 });
    edges.push({ from: tip, to: localId });
    // Occasional fork keeps generated branches from being pure lines.
    if (!rng.chance(0.2)) {
      tip = localId;
      tier += 1;
    }
  }
  return { nodes, edges, branchCount: 1 };
}
