import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  addEdge,
  addNode,
  createGraph,
  deleteGraph,
  moveNode,
  patchNode,
  removeEdge,
  removeNode,
  renameGraph,
} from '@/db/repos/graphs';
import { listEntities } from '@/db/repos/entities';
import type { Entity, GraphEdge, GraphNode, SkillTree } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { NodeGraphCanvas } from '@/features/canvas/NodeGraphCanvas';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

/** Skill Trees: the constellation editor. Nodes are skills (bound to
 * skill entities or free labels) joined by directed prerequisite edges;
 * each node tracks unlocked state. */
export function SkillTreesSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);

  const trees = useLiveQuery(
    async () =>
      projectId
        ? (await db.skillTrees.where('projectId').equals(projectId).toArray()).sort(
            (a, b) => b.updatedAt - a.updatedAt
          )
        : [],
    [projectId],
    null as SkillTree[] | null
  );
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const tree = trees?.find((t) => t.id === activeTreeId) ?? trees?.[0] ?? null;
  useEffect(() => {
    if (tree && tree.id !== activeTreeId) setActiveTreeId(tree.id);
  }, [tree, activeTreeId]);

  const skills = useLiveQuery(
    async () => (projectId ? listEntities(projectId, 'skills') : []),
    [projectId],
    [] as Entity[]
  );

  const [mode, setMode] = useState<'select' | 'connect' | 'place'>('select');
  const [placeDraft, setPlaceDraft] = useState('');
  const [placeEntity, setPlaceEntity] = useState<Entity | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  if (!projectId || trees === null) return null;

  const meta = ENTITY_TYPE_META.skills;

  const newTree = async () => {
    const t = await createGraph('skilltree', projectId, `Tree ${trees.length + 1}`);
    setActiveTreeId(t.id);
  };

  const place = async (x: number, y: number) => {
    if (!tree) return;
    const label = placeEntity ? placeEntity.name : placeDraft.trim();
    if (!label) return;
    await addNode('skilltree', tree.id, {
      label,
      x,
      y,
      entity: placeEntity
        ? { id: placeEntity.id, type: placeEntity.type, name: placeEntity.name }
        : undefined,
    });
    setPlaceDraft('');
    setPlaceEntity(null);
    setMode('select');
  };

  const connect = async (fromId: string, toId: string) => {
    if (!tree) return;
    await addEdge('skilltree', tree.id, { from: fromId, to: toId, directed: true });
    setMode('select');
    toast('Prerequisite linked.');
  };

  const onEdgeClick = (edge: GraphEdge) => {
    if (!tree) return;
    void removeEdge('skilltree', tree.id, edge.id);
    toast('Prerequisite removed.');
  };

  // Keep the side-panel copy of the selected node fresh.
  const liveSelected = tree?.nodes.find((n) => n.id === selectedNode?.id) ?? null;

  return (
    <div className="lw-tangle" data-testid="surface-skill-trees">
      <aside className="lw-tangle__side">
        <h1 className="lw-atlas__title">
          <span aria-hidden style={{ color: meta.color }}>
            ❋
          </span>{' '}
          Skill Trees
        </h1>
        <p className="lw-fieldnote">
          Constellations of skills joined by prerequisite lines. Click a node&apos;s ring to
          mark it unlocked.
        </p>

        <div className="lw-tangle__boards">
          <label className="lw-field__label" htmlFor="skilltree-pick">
            Tree
          </label>
          <div className="lw-chips__add">
            <select
              id="skilltree-pick"
              className="lw-input"
              value={tree?.id ?? ''}
              onChange={(e) => setActiveTreeId(e.target.value)}
            >
              {trees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button type="button" className="lw-btn" onClick={() => void newTree()}>
              + New
            </button>
          </div>
          {tree && (
            <div className="lw-chips__add">
              <input
                className="lw-input"
                aria-label="Rename tree"
                value={tree.name}
                onChange={(e) => void renameGraph('skilltree', tree.id, e.target.value)}
              />
              <button
                type="button"
                className="lw-btn"
                onClick={() => {
                  void deleteGraph('skilltree', tree.id);
                  setActiveTreeId(null);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {tree && (
          <>
            <h2 className="lw-atlas__subhead">Add a skill node</h2>
            <select
              className="lw-input"
              aria-label="Add skill from codex"
              value=""
              onChange={(e) => {
                const entity = skills.find((x) => x.id === e.target.value);
                if (entity) {
                  setPlaceEntity(entity);
                  setPlaceDraft('');
                  setMode('place');
                }
              }}
            >
              <option value="">From your Skills codex…</option>
              {skills.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="lw-chips__add">
              <input
                className="lw-input"
                aria-label="Free skill label"
                placeholder="…or a free label"
                value={placeDraft}
                onChange={(e) => setPlaceDraft(e.target.value)}
              />
              <button
                type="button"
                className="lw-btn"
                onClick={() => {
                  if (!placeDraft.trim()) {
                    toast('Type the skill name first.', { kind: 'error' });
                    return;
                  }
                  setPlaceEntity(null);
                  setMode('place');
                }}
              >
                Place
              </button>
            </div>
            {mode === 'place' && (
              <p className="lw-atlas__hint" data-testid="skilltree-place-hint">
                Click the canvas to place{' '}
                <strong>{placeEntity ? placeEntity.name : placeDraft}</strong>.
              </p>
            )}

            <h2 className="lw-atlas__subhead">Prerequisites</h2>
            <button
              type="button"
              className={mode === 'connect' ? 'lw-btn lw-btn--primary' : 'lw-btn'}
              aria-pressed={mode === 'connect'}
              onClick={() => setMode(mode === 'connect' ? 'select' : 'connect')}
            >
              {mode === 'connect' ? 'Cancel linking' : 'Link prerequisite'}
            </button>
            <p className="lw-fieldnote">
              Click the prerequisite first, then the skill it unlocks. Click a line to remove
              it.
            </p>

            {liveSelected && (
              <>
                <h2 className="lw-atlas__subhead">Selected node</h2>
                <p className="lw-fieldnote">
                  <strong>{liveSelected.label}</strong>
                </p>
                <label className="lw-toggle">
                  <input
                    type="checkbox"
                    checked={!!liveSelected.unlocked}
                    onChange={(e) =>
                      void patchNode('skilltree', tree.id, liveSelected.id, {
                        unlocked: e.target.checked,
                      })
                    }
                  />
                  <span>Unlocked</span>
                </label>
                <button
                  type="button"
                  className="lw-btn lw-btn--danger"
                  onClick={() => {
                    void removeNode('skilltree', tree.id, liveSelected.id);
                    setSelectedNode(null);
                  }}
                >
                  Remove node
                </button>
              </>
            )}
          </>
        )}
      </aside>

      {tree ? (
        <NodeGraphCanvas
          testId="skilltree-canvas"
          nodes={tree.nodes}
          edges={tree.edges}
          mode={mode}
          onPlace={(x, y) => void place(x, y)}
          onMoveNode={(id, x, y) => void moveNode('skilltree', tree.id, id, x, y)}
          onConnect={(a, b) => void connect(a, b)}
          onEdgeClick={onEdgeClick}
          onNodeClick={(node) => setSelectedNode(node)}
          selectedNodeId={liveSelected?.id ?? null}
          nodeColor={(n) => (n.unlocked ? '#4f8045' : meta.color)}
        />
      ) : (
        <div className="lw-empty lw-empty--center">
          <p className="lw-empty__title">No skill trees yet.</p>
          <button type="button" className="lw-btn lw-btn--primary" onClick={() => void newTree()}>
            + New tree
          </button>
        </div>
      )}
    </div>
  );
}
