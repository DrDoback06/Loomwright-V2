import type { EntityType } from '@/domain/entity-types';
import type { GraphEdge, GraphNode, SkillTree } from '@/db/types';
import type { KnownEntity } from '@/services/extraction/known-index';
import { newId } from '@/lib/id';
import { entitySpec } from '../spec';
import { layoutTree } from '../layout';
import type { BundleGraphDraft, GenerationBundle, GenerationRequest } from '../types';
import { createRng, randomSeed, type Rng } from './rng';
import { generateDraftFor, matchArchetype, resolveTheme, type Archetype } from './packs';
import { rollGenericField, type GenCtx } from './packs/generic';
import { generateSkillDraft, skillNameFor, skillsPack, treeNameFor } from './packs/skills';
import { generateBranchTopology, generateTreeTopology, type TreeTopology } from './topology';

export interface RandomCtx {
  projectId: string;
  known: KnownEntity[];
}

/** Generate a bundle offline from authored content. Deterministic for a
 * given (request, seed) — Reroll passes a fresh seed, tests fix one. */
export function generateRandomBundle(
  request: GenerationRequest,
  ctx: RandomCtx,
  seed = randomSeed()
): GenerationBundle {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, request.theme);
  const genCtx = { theme, hint: request.hint ?? '', known: ctx.known };

  const bundle: GenerationBundle = {
    id: newId(),
    projectId: ctx.projectId,
    request,
    mode: 'random',
    seed,
    entities: [],
    graphs: [],
    chapters: [],
    links: [],
    warnings: [],
    createdAt: Date.now(),
  };

  switch (request.kind) {
    case 'entity': {
      if (request.entityType) {
        bundle.entities.push(generateDraftFor(rng, request.entityType, genCtx));
      }
      break;
    }
    case 'entity-batch': {
      if (request.entityType) {
        const count = Math.max(1, Math.min(request.count ?? 3, 24));
        for (let i = 0; i < count; i++) {
          bundle.entities.push(generateDraftFor(rng, request.entityType, genCtx));
        }
      }
      break;
    }
    case 'skilltree': {
      buildSkillTree(rng, bundle, genCtx);
      break;
    }
    case 'questline': {
      buildQuestline(rng, bundle, genCtx);
      break;
    }
    case 'relationship-set': {
      buildRelationshipSet(rng, bundle, genCtx);
      break;
    }
    case 'tangle': {
      buildTangleBoard(rng, bundle, genCtx);
      break;
    }
    default:
      // Chapter generation registers its builder in its milestone.
      break;
  }
  return bundle;
}

const BOND_TYPES = ['family', 'ally', 'enemy', 'lover', 'rival', 'mentor', 'debt', 'oath'];
const VALENCES = ['positive', 'negative', 'mixed', 'cold', 'heated', 'quiet'];
const DIRECTIONALITIES = ['mutual', 'one-way', 'conflicted'];

/** Relationships among EXISTING cast: unique pairs from the request's
 * context refs (or the whole cast), each fully fielded. */
function buildRelationshipSet(rng: Rng, bundle: GenerationBundle, ctx: GenCtx): void {
  const fromRefs = (bundle.request.contextRefs ?? []).filter((r) => r.type === 'cast');
  const pool = fromRefs.length >= 2 ? fromRefs : ctx.known.filter((k) => k.type === 'cast');
  if (pool.length < 2) {
    bundle.warnings.push('Need at least two characters to weave relationships between.');
    return;
  }
  const pairs: [typeof pool[number], typeof pool[number]][] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
  }
  const count = Math.max(1, Math.min(bundle.request.count ?? 3, pairs.length, 12));
  for (const [a, b] of rng.shuffle(pairs).slice(0, count)) {
    const [from, to] = rng.chance(0.5) ? [a, b] : [b, a];
    const bondType = rng.pick(BOND_TYPES);
    const valence = rng.pick(VALENCES);
    bundle.entities.push({
      localId: newId(),
      type: 'relationships',
      name: `${from.name} → ${to.name}`,
      aliases: [],
      summary: `A ${valence} ${bondType} bond — ${rng.pick([
        'older than either admits',
        'newer than it looks',
        'held together by necessity',
        'one secret away from breaking',
        'the talk of everyone around them',
      ])}.`,
      tags: [bondType],
      fields: {
        from: { id: from.id, type: 'cast', name: from.name },
        to: { id: to.id, type: 'cast', name: to.name },
        bondType,
        valence,
        directionality: rng.pick(DIRECTIONALITIES),
        intensity: String(rng.int(20, 95)),
      },
    });
  }
}

const THREAD_LABELS = ['leads to', 'because of', 'conflicts with', 'hides', 'mirrors', 'owes'];

/** A story corkboard: bound cards for context entities plus themed note
 * cards, joined by labelled threads. */
function buildTangleBoard(rng: Rng, bundle: GenerationBundle, ctx: GenCtx): void {
  const refs = (bundle.request.contextRefs ?? []).slice(0, 6);
  const noteCount = Math.max(2, Math.min((bundle.request.count ?? 6) - refs.length, 10));
  const nodes: GraphNode[] = [];
  const place = (i: number, total: number) => {
    const angle = (i / Math.max(total, 1)) * Math.PI * 2;
    const radius = 170 + (i % 2) * 70;
    return {
      x: Math.round(380 + Math.cos(angle) * radius),
      y: Math.round(300 + Math.sin(angle) * radius * 0.7),
    };
  };
  const total = refs.length + noteCount;
  refs.forEach((ref, i) => {
    nodes.push({ id: newId(), label: ref.name, entity: ref, ...place(i, total) });
  });
  for (let i = 0; i < noteCount; i++) {
    const draft = generateDraftFor(rng, 'lore', ctx);
    nodes.push({
      id: newId(),
      label: draft.summary.slice(0, 60) || draft.name,
      ...place(refs.length + i, total),
    });
  }
  const edges: GraphEdge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[rng.int(0, i - 1)];
    edges.push({
      id: newId(),
      from: from.id,
      to: nodes[i].id,
      label: rng.pick(THREAD_LABELS),
      directed: rng.chance(0.7),
    });
  }
  bundle.graphs.push({
    localId: newId(),
    kind: 'tangle',
    targetGraphId: bundle.request.targetGraphId,
    name: `${ctx.hint ? ctx.hint.slice(0, 40) : 'Tangle'} board`,
    nodes,
    edges,
  });
}

/** A chain of linked quests (leads-to) with occasional attendant events,
 * cast from the request's context refs where possible. */
function buildQuestline(rng: Rng, bundle: GenerationBundle, ctx: GenCtx): void {
  const count = Math.max(2, Math.min(bundle.request.count ?? 3, 8));
  let previous: string | null = null;
  for (let i = 0; i < count; i++) {
    const quest = generateDraftFor(rng, 'quests', ctx);
    bundle.entities.push(quest);
    if (previous) bundle.links.push({ from: previous, to: quest.localId, kind: 'leads-to' });
    previous = quest.localId;
    if (rng.chance(0.5)) {
      const event = generateDraftFor(rng, 'events', ctx);
      bundle.entities.push(event);
      bundle.links.push({ from: quest.localId, to: event.localId, kind: 'during' });
    }
  }
  // Weave in the explicitly-selected participants.
  for (const ref of bundle.request.contextRefs ?? []) {
    const firstQuest = bundle.entities.find((d) => d.type === 'quests');
    if (firstQuest) bundle.links.push({ from: firstQuest.localId, to: ref.id, kind: 'involves' });
  }
}

/** Turn a topology + archetype into skill drafts and a positioned graph
 * draft, appended to the bundle. */
function skillNodesFrom(
  rng: Rng,
  topo: TreeTopology,
  arch: Archetype,
  ctx: GenCtx,
  bundle: GenerationBundle,
  branchNames: string[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const usedNames = new Set<string>();
  const uniqueName = (tier: number) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const name = skillNameFor(rng, arch, tier);
      if (!usedNames.has(name.toLowerCase())) {
        usedNames.add(name.toLowerCase());
        return name;
      }
    }
    const fallback = `${skillNameFor(rng, arch, tier)} ${usedNames.size + 1}`;
    usedNames.add(fallback.toLowerCase());
    return fallback;
  };

  const positions = layoutTree(
    topo.nodes.map((n) => n.localId),
    topo.edges
  );

  const nodes: GraphNode[] = topo.nodes.map((tn) => {
    const draft = generateSkillDraft(rng, arch, ctx, {
      tier: tn.tier,
      name: uniqueName(tn.tier),
    });
    bundle.entities.push(draft);
    const pos = positions.get(tn.localId)!;
    return {
      id: tn.localId,
      label: draft.name,
      x: pos.x,
      y: pos.y,
      unlocked: tn.tier === 0,
      entity: { id: draft.localId, type: draft.type, name: draft.name },
      group: branchNames[tn.branch % branchNames.length],
    };
  });
  const edges: GraphEdge[] = topo.edges.map((e) => ({
    id: newId(),
    from: e.from,
    to: e.to,
    directed: true,
  }));
  return { nodes, edges };
}

function buildSkillTree(rng: Rng, bundle: GenerationBundle, ctx: GenCtx): void {
  const request = bundle.request;
  const arch = matchArchetype(rng, skillsPack, ctx.theme, ctx.hint);
  const count = Math.max(3, Math.min(request.count ?? 12, 40));
  const topo = generateTreeTopology(rng, {
    nodeCount: count,
    branchCount: request.options?.branches,
    idPrefix: 'sk',
  });
  const branchNames = rng.shuffle(arch.branchNames ?? ['Path']).slice(0, topo.branchCount);
  while (branchNames.length < topo.branchCount) branchNames.push(`Path ${branchNames.length + 1}`);
  const { nodes, edges } = skillNodesFrom(rng, topo, arch, ctx, bundle, branchNames);
  // The root belongs to no single branch.
  if (nodes[0]) nodes[0] = { ...nodes[0], group: undefined };
  const graph: BundleGraphDraft = {
    localId: newId(),
    kind: 'skilltree',
    name: treeNameFor(rng, arch),
    nodes,
    edges,
  };
  bundle.graphs.push(graph);
}

/** "Generate branch" — a themed chain of new skills hanging off a node of
 * an EXISTING tree, positioned into free space beside it. */
export function generateSkillTreeBranchBundle(
  request: GenerationRequest,
  ctx: RandomCtx,
  tree: SkillTree,
  seed = randomSeed()
): GenerationBundle {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, request.theme);
  const genCtx: GenCtx = { theme, hint: request.hint ?? '', known: ctx.known };
  const bundle: GenerationBundle = {
    id: newId(),
    projectId: ctx.projectId,
    request,
    mode: 'random',
    seed,
    entities: [],
    graphs: [],
    chapters: [],
    links: [],
    warnings: [],
    createdAt: Date.now(),
  };
  const attach =
    tree.nodes.find((n) => n.id === request.options?.attachNodeId) ??
    shallowestLeaf(tree) ??
    tree.nodes[0];
  if (!attach) {
    bundle.warnings.push('The tree has no nodes to attach a branch to.');
    return bundle;
  }
  const arch = matchArchetype(rng, skillsPack, theme, genCtx.hint);
  const count = Math.max(2, Math.min(request.count ?? 5, 20));
  const topo = generateBranchTopology(rng, { nodeCount: count, attachId: attach.id, idPrefix: 'br' });
  const branchName = rng.pick(arch.branchNames ?? ['New branch']);
  const { nodes, edges } = skillNodesFrom(
    rng,
    { ...topo, nodes: topo.nodes },
    arch,
    genCtx,
    bundle,
    [branchName]
  );
  // Layout ran relative to the chain alone; translate it into free space
  // beside the existing tree, level with the attach node.
  const maxX = Math.max(...tree.nodes.map((n) => n.x));
  const first = nodes[0];
  const dx = maxX + 190 - (first?.x ?? 0);
  const dy = attach.y + 110 - (first?.y ?? 0);
  const placed = nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy, unlocked: false }));
  bundle.graphs.push({
    localId: newId(),
    kind: 'skilltree',
    targetGraphId: tree.id,
    name: tree.name,
    nodes: placed,
    edges,
  });
  return bundle;
}

function shallowestLeaf(tree: SkillTree): GraphNode | undefined {
  const hasChild = new Set(tree.edges.map((e) => e.from));
  const leaves = tree.nodes.filter((n) => !hasChild.has(n.id));
  if (!leaves.length) return undefined;
  const depth = new Map<string, number>();
  const parentOf = new Map(tree.edges.map((e) => [e.to, e.from]));
  const depthOf = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const parent = parentOf.get(id);
    const d = parent ? depthOf(parent) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  return leaves.sort((a, b) => depthOf(a.id) - depthOf(b.id))[0];
}

/** One field's worth of fresh random content — powers the editor drawer's
 * per-field dice and "Fill empty fields". */
export function rollField(
  type: EntityType,
  fieldId: string,
  ctx: RandomCtx & { theme?: string; hint?: string },
  seed = randomSeed()
): unknown {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, ctx.theme);
  const spec = entitySpec(type);
  const field = spec?.fields.find((f) => f.id === fieldId);
  if (!field) return undefined;
  return rollGenericField(rng, field, { theme, hint: ctx.hint ?? '', known: ctx.known }, { force: true });
}

/** Roll a full draft and return the fields that are empty in `current` —
 * "Fill empty fields" merges these into the open form. */
export function rollEmptyFields(
  type: EntityType,
  current: Record<string, unknown>,
  ctx: RandomCtx & { theme?: string; hint?: string },
  seed = randomSeed()
): Record<string, unknown> {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, ctx.theme);
  const draft = generateDraftFor(rng, type, { theme, hint: ctx.hint ?? '', known: ctx.known });
  const out: Record<string, unknown> = {};
  const isEmpty = (v: unknown) =>
    v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const spec = entitySpec(type);
  const nameField = spec?.nameField ?? 'name';
  if (isEmpty(current[nameField])) out[nameField] = draft.name;
  if (isEmpty(current.summary)) out.summary = draft.summary;
  if (isEmpty(current.tags)) out.tags = draft.tags;
  for (const [id, value] of Object.entries(draft.fields)) {
    if (isEmpty(current[id])) out[id] = value;
  }
  return out;
}
