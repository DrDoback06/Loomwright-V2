/** Pure auto-layout for prerequisite DAGs (skill trees). Tiers come from
 * the longest path below a root; branches become columns. Every
 * generation mode uses this — models and packs emit semantic topology
 * (tier/branch/requires), never coordinates. The same function powers the
 * surface's "Auto-arrange" for hand-made trees. */

export interface LayoutEdgeInput {
  from: string;
  to: string;
}

export interface LayoutOptions {
  originX?: number;
  originY?: number;
  columnGap?: number;
  rowGap?: number;
  /** Horizontal spread for same-column same-tier collisions. */
  siblingGap?: number;
  /** Deterministic organic jitter, ±px. 0 for grid-perfect. */
  jitter?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  originX: 140,
  originY: 90,
  columnGap: 190,
  rowGap: 110,
  siblingGap: 64,
  jitter: 12,
};

/** Small deterministic hash → [-1, 1), so jitter survives re-layout. */
function jitterOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2048) / 1024 - 1;
}

export function layoutTree(
  nodeIds: string[],
  edges: LayoutEdgeInput[],
  options: LayoutOptions = {}
): Map<string, { x: number; y: number }> {
  const opts = { ...DEFAULTS, ...options };
  const ids = [...new Set(nodeIds)];
  const idSet = new Set(ids);
  const valid = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to);

  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  const parents = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of valid) {
    children.get(e.from)!.push(e.to);
    parents.get(e.to)!.push(e.from);
  }

  // Tier = longest path from a root. Kahn topological pass; nodes caught
  // in a cycle (never released) fall back to tier 0 + parent-following.
  const tier = new Map<string, number>(ids.map((id) => [id, 0]));
  const indegree = new Map(ids.map((id) => [id, parents.get(id)!.length]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  const released = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    released.add(id);
    for (const child of children.get(id)!) {
      tier.set(child, Math.max(tier.get(child)!, tier.get(id)! + 1));
      indegree.set(child, indegree.get(child)! - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }
  for (const id of ids) {
    if (!released.has(id)) {
      const p = parents.get(id)!.find((pid) => released.has(pid));
      tier.set(id, p ? tier.get(p)! + 1 : 0);
    }
  }

  // Connected components — laid out side by side.
  const component = new Map<string, number>();
  let componentCount = 0;
  for (const id of ids) {
    if (component.has(id)) continue;
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (component.has(cur)) continue;
      component.set(cur, componentCount);
      for (const next of [...children.get(cur)!, ...parents.get(cur)!]) {
        if (!component.has(next)) stack.push(next);
      }
    }
    componentCount++;
  }

  // Column: roots spread left→right; children inherit their first
  // parent's column, and forks fan out beside it.
  const column = new Map<string, number>();
  const byTier = [...ids].sort((a, b) => tier.get(a)! - tier.get(b)!);
  const takenPerComponent = new Map<number, Set<string>>();
  const keyOf = (t: number, c: number) => `${t}:${c}`;
  for (const id of byTier) {
    const comp = component.get(id)!;
    const taken = takenPerComponent.get(comp) ?? new Set<string>();
    takenPerComponent.set(comp, taken);
    const parentCols = parents
      .get(id)!
      .filter((p) => column.has(p))
      .map((p) => column.get(p)!);
    let col: number;
    if (parentCols.length) {
      col = parentCols[0];
    } else {
      // A root: next free column in this component.
      col = 0;
      while (taken.has(keyOf(0, col))) col++;
    }
    // Resolve same-tier collisions by fanning outward from the target.
    const t = tier.get(id)!;
    let offset = 0;
    let placed = col;
    while (taken.has(keyOf(t, placed))) {
      offset = offset >= 0 ? -(offset + 1) : -offset;
      placed = col + offset;
    }
    taken.add(keyOf(t, placed));
    column.set(id, placed);
  }

  // Components sit side by side with a column of breathing room.
  const componentOffset = new Map<number, number>();
  let runningOffset = 0;
  for (let c = 0; c < componentCount; c++) {
    const cols = ids.filter((id) => component.get(id) === c).map((id) => column.get(id)!);
    const min = Math.min(...cols);
    const max = Math.max(...cols);
    componentOffset.set(c, runningOffset - min);
    runningOffset += max - min + 2;
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const col = column.get(id)! + componentOffset.get(component.get(id)!)!;
    const x = opts.originX + col * opts.columnGap + jitterOf(id) * opts.jitter;
    const y = opts.originY + tier.get(id)! * opts.rowGap + jitterOf(`${id}:y`) * opts.jitter;
    out.set(id, { x: Math.round(x), y: Math.round(y) });
  }
  return out;
}
