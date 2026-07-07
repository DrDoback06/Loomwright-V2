import { useEffect, useMemo, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { Entity, GraphEdge, GraphNode } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { NodeGraphCanvas } from '@/features/canvas/NodeGraphCanvas';
import { useFocusStore } from '@/stores/focus';
import { useGenerationStore } from '@/stores/generation';

interface SimNode extends SimulationNodeDatum {
  id: string;
  ref: EntityRef;
}

/** The minimal relationship shape the network reads — a real Entity or a
 * staged (not-yet-accepted) draft both satisfy it. */
interface RelSource {
  id: string;
  name: string;
  fields: Record<string, unknown>;
}

/** Force-directed network of relationship entities: nodes are the
 * characters referenced by from/to, edges carry the bond type. Layout is
 * computed once per data change (simulation ticked to rest), then nodes
 * stay draggable locally. Clicking a node focuses the character. Staged
 * relationship drafts (a generated "relationship set") join in as dashed
 * ghost bonds until the bundle is accepted or discarded. */
export function RelationshipGraph({ relationships }: { relationships: Entity[] }) {
  const setFocus = useFocusStore((s) => s.setFocus);
  const lock = useFocusStore((s) => s.lock);
  const focus = useFocusStore((s) => s.focus);
  const staged = useGenerationStore((s) => s.staged);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  // Staged relationship drafts render as ghost bonds; their endpoints are
  // real cast refs, so those character nodes simply appear.
  const stagedRels = useMemo<RelSource[]>(
    () =>
      (staged?.entities ?? [])
        .filter((d) => d.type === 'relationships')
        .map((d) => ({ id: d.localId, name: d.name, fields: d.fields })),
    [staged]
  );
  const stagedEdgeIds = useMemo(() => new Set(stagedRels.map((r) => r.id)), [stagedRels]);

  useEffect(() => {
    const refById = new Map<string, EntityRef>();
    const links: { source: string; target: string; label: string; id: string }[] = [];
    const source: RelSource[] = [...relationships, ...stagedRels];
    for (const rel of source) {
      const from = rel.fields.from as EntityRef | undefined;
      const to = rel.fields.to as EntityRef | undefined;
      if (!from?.id || !to?.id) continue;
      refById.set(from.id, from);
      refById.set(to.id, to);
      links.push({
        source: from.id,
        target: to.id,
        label: (rel.fields.bondType as string) || rel.name,
        id: rel.id,
      });
    }
    const simNodes: SimNode[] = [...refById.values()].map((ref) => ({ id: ref.id, ref }));
    if (simNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-600))
      .force(
        'link',
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(
          links.map((l) => ({ source: l.source, target: l.target }))
        )
          .id((d) => d.id)
          .distance(190)
      )
      .force('center', forceCenter(420, 320))
      .force('collide', forceCollide(90))
      .stop();
    for (let i = 0; i < 200; i++) sim.tick();

    setNodes(
      simNodes.map((n) => ({
        id: n.id,
        label: n.ref.name,
        entity: n.ref,
        x: Math.round(n.x ?? 0) + 300,
        y: Math.round(n.y ?? 0) + 200,
      }))
    );
    setEdges(links.map((l) => ({ id: l.id, from: l.source, to: l.target, label: l.label })));
  }, [relationships, stagedRels]);

  if (nodes.length === 0) {
    return (
      <div className="lw-empty lw-empty--center">
        <p className="lw-empty__title">No relationships to map yet.</p>
        <p className="lw-empty__note">
          Create relationships (or accept extracted ones) and the network draws itself.
        </p>
      </div>
    );
  }

  return (
    <NodeGraphCanvas
      testId="relationship-graph"
      nodes={nodes}
      edges={edges}
      mode="select"
      onMoveNode={(id, x, y) =>
        setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x, y } : n)))
      }
      onNodeClick={(node) => node.entity && setFocus(node.entity)}
      selectedNodeId={focus?.id ?? lock?.id ?? null}
      stagedIds={stagedEdgeIds}
      nodeColor={(n) =>
        n.id === lock?.id ? '#b06f1c' : n.entity ? ENTITY_TYPE_META[n.entity.type].color : undefined
      }
    />
  );
}
