import { db } from '../schema';
import { newId } from '@/lib/id';
import type { GraphEdge, GraphNode, SkillTree, TangleBoard } from '../types';
import type { EntityRef } from '@/domain/entity-types';

type Kind = 'tangle' | 'skilltree';

function table(kind: Kind) {
  return kind === 'tangle' ? db.tangleBoards : db.skillTrees;
}

/** Tangle boards and skill trees share one node+edge document shape; the
 * repo is generic over which table it hits. */
export async function listGraphs(kind: Kind, projectId: string): Promise<(TangleBoard | SkillTree)[]> {
  const rows = await table(kind).where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createGraph(kind: Kind, projectId: string, name: string) {
  const row: TangleBoard = {
    id: newId(),
    projectId,
    name: name.trim() || (kind === 'tangle' ? 'New board' : 'New tree'),
    ...(kind === 'tangle' ? { cards: [] } : { nodes: [] }),
    edges: [],
    updatedAt: Date.now(),
  } as TangleBoard;
  await table(kind).add(row as never);
  return row;
}

function nodesOf(row: TangleBoard | SkillTree): GraphNode[] {
  return (row as TangleBoard).cards ?? (row as SkillTree).nodes;
}

function withNodes(kind: Kind, nodes: GraphNode[]) {
  return kind === 'tangle' ? { cards: nodes } : { nodes };
}

export async function addNode(
  kind: Kind,
  graphId: string,
  input: { label: string; x: number; y: number; entity?: EntityRef }
): Promise<GraphNode | null> {
  const row = await table(kind).get(graphId);
  if (!row) return null;
  const node: GraphNode = {
    id: newId(),
    label: input.label,
    x: input.x,
    y: input.y,
    entity: input.entity,
    ...(kind === 'skilltree' ? { unlocked: false } : {}),
  };
  await table(kind).update(graphId, {
    ...withNodes(kind, [...nodesOf(row), node]),
    updatedAt: Date.now(),
  } as never);
  return node;
}

/** Bulk re-position (auto-arrange): one write for the whole document. */
export async function arrangeNodes(
  kind: Kind,
  graphId: string,
  positions: Map<string, { x: number; y: number }>
) {
  const row = await table(kind).get(graphId);
  if (!row) return;
  await table(kind).update(graphId, {
    ...withNodes(
      kind,
      nodesOf(row).map((n) => {
        const p = positions.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      })
    ),
    updatedAt: Date.now(),
  } as never);
}

export async function moveNode(kind: Kind, graphId: string, nodeId: string, x: number, y: number) {
  const row = await table(kind).get(graphId);
  if (!row) return;
  await table(kind).update(graphId, {
    ...withNodes(kind, nodesOf(row).map((n) => (n.id === nodeId ? { ...n, x, y } : n))),
    updatedAt: Date.now(),
  } as never);
}

export async function patchNode(
  kind: Kind,
  graphId: string,
  nodeId: string,
  patch: Partial<GraphNode>
) {
  const row = await table(kind).get(graphId);
  if (!row) return;
  await table(kind).update(graphId, {
    ...withNodes(kind, nodesOf(row).map((n) => (n.id === nodeId ? { ...n, ...patch } : n))),
    updatedAt: Date.now(),
  } as never);
}

export async function removeNode(kind: Kind, graphId: string, nodeId: string) {
  const row = await table(kind).get(graphId);
  if (!row) return;
  await table(kind).update(graphId, {
    ...withNodes(kind, nodesOf(row).filter((n) => n.id !== nodeId)),
    edges: row.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    updatedAt: Date.now(),
  } as never);
}

export async function addEdge(
  kind: Kind,
  graphId: string,
  input: { from: string; to: string; label?: string; directed?: boolean }
): Promise<GraphEdge | null> {
  const row = await table(kind).get(graphId);
  if (!row || input.from === input.to) return null;
  const edge: GraphEdge = { id: newId(), ...input };
  await table(kind).update(graphId, {
    edges: [...row.edges, edge],
    updatedAt: Date.now(),
  } as never);
  return edge;
}

export async function removeEdge(kind: Kind, graphId: string, edgeId: string) {
  const row = await table(kind).get(graphId);
  if (!row) return;
  await table(kind).update(graphId, {
    edges: row.edges.filter((e) => e.id !== edgeId),
    updatedAt: Date.now(),
  } as never);
}

export async function renameGraph(kind: Kind, graphId: string, name: string) {
  await table(kind).update(graphId, { name: name.trim() || 'Untitled', updatedAt: Date.now() } as never);
}

export async function deleteGraph(kind: Kind, graphId: string) {
  await table(kind).delete(graphId);
}
