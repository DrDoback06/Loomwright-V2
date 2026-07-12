import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  addEdge,
  addNode,
  createGraph,
  deleteGraph,
  moveNode,
  removeEdge,
  removeNode,
  renameGraph,
} from '@/db/repos/graphs';
import type { BoardTemplate, Entity, GraphEdge, GraphNode, TangleBoard } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { NodeGraphCanvas } from '@/features/canvas/NodeGraphCanvas';
import { instantiateBoardTemplate, saveBoardTemplate } from '@/services/templates';
import { useFocusStore } from '@/stores/focus';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

/** Tangle: the freeform story corkboard. Cards (free notes or bound to
 * codex entities) joined by labelled, optionally directed threads. */
export function TangleSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setFocus = useFocusStore((s) => s.setFocus);

  const boards = useLiveQuery(
    async () =>
      projectId
        ? (await db.tangleBoards.where('projectId').equals(projectId).toArray()).sort(
            (a, b) => b.updatedAt - a.updatedAt
          )
        : [],
    [projectId],
    null as TangleBoard[] | null
  );
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const board = boards?.find((b) => b.id === activeBoardId) ?? boards?.[0] ?? null;

  useEffect(() => {
    if (board && board.id !== activeBoardId) setActiveBoardId(board.id);
  }, [board, activeBoardId]);

  const allEntities = useLiveQuery(
    async () => (projectId ? db.entities.where('projectId').equals(projectId).toArray() : []),
    [projectId],
    [] as Entity[]
  );

  const [mode, setMode] = useState<'select' | 'connect' | 'place'>('select');
  const [placeDraft, setPlaceDraft] = useState('');
  const [placeEntity, setPlaceEntity] = useState<Entity | null>(null);
  const [placeTemplate, setPlaceTemplate] = useState<BoardTemplate | null>(null);
  const [edgeLabel, setEdgeLabel] = useState('');
  const [edgeDirected, setEdgeDirected] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const boardTemplates = useLiveQuery(
    async () =>
      projectId
        ? ((await db.templates.where('[projectId+kind]').equals([projectId, 'board']).toArray()) as BoardTemplate[])
        : [],
    [projectId],
    [] as BoardTemplate[]
  );

  if (!projectId || boards === null) return null;

  const newBoard = async () => {
    const b = await createGraph('tangle', projectId, `Board ${boards.length + 1}`);
    setActiveBoardId(b.id);
  };

  const armPlaceNote = () => {
    if (!placeDraft.trim()) {
      toast('Type the note text first.', { kind: 'error' });
      return;
    }
    setPlaceEntity(null);
    setMode('place');
  };

  const place = async (x: number, y: number) => {
    if (!board) return;

    // Consume the armed placement synchronously before touching IndexedDB.
    // Without this, a fast second card can be typed while the first write is
    // still pending, then be cleared when that older promise resolves.
    const template = placeTemplate;
    const entity = placeEntity;
    const note = placeDraft.trim();
    setPlaceTemplate(null);
    setPlaceDraft('');
    setPlaceEntity(null);
    setMode('select');

    if (template) {
      const stamped = instantiateBoardTemplate(template, { x, y });
      await db.transaction('rw', db.tangleBoards, async () => {
        const latest = await db.tangleBoards.get(board.id);
        if (!latest) return;
        await db.tangleBoards.update(board.id, {
          cards: [...latest.cards, ...stamped.cards],
          edges: [...latest.edges, ...stamped.edges],
          updatedAt: Date.now(),
        });
      });
      toast(`Stamped “${template.name}” (${stamped.cards.length} cards).`, { kind: 'success' });
      return;
    }

    const label = entity ? entity.name : note;
    if (!label) return;
    await addNode('tangle', board.id, {
      label,
      x,
      y,
      entity: entity
        ? { id: entity.id, type: entity.type, name: entity.name }
        : undefined,
    });
  };

  const connect = async (fromId: string, toId: string) => {
    if (!board) return;
    await addEdge('tangle', board.id, {
      from: fromId,
      to: toId,
      label: edgeLabel.trim() || undefined,
      directed: edgeDirected,
    });
    setEdgeLabel('');
    setMode('select');
  };

  const onEdgeClick = (edge: GraphEdge) => {
    if (!board) return;
    void removeEdge('tangle', board.id, edge.id);
    toast('Thread removed.');
  };

  return (
    <div className="lw-tangle" data-testid="surface-tangle">
      <aside className="lw-tangle__side">
        <h1 className="lw-atlas__title">
          <span aria-hidden>✕</span> Tangle
        </h1>
        <p className="lw-fieldnote">
          A corkboard for threads your codex can&apos;t hold yet — pin notes and entities,
          join them with labelled threads.
        </p>

        <div className="lw-tangle__boards">
          <label className="lw-field__label" htmlFor="tangle-board">
            Board
          </label>
          <div className="lw-chips__add">
            <select
              id="tangle-board"
              className="lw-input"
              value={board?.id ?? ''}
              onChange={(e) => setActiveBoardId(e.target.value)}
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button type="button" className="lw-btn" onClick={() => void newBoard()}>
              + New
            </button>
          </div>
          {board && (
            <div className="lw-chips__add">
              <input
                className="lw-input"
                aria-label="Rename board"
                value={board.name}
                onChange={(e) => void renameGraph('tangle', board.id, e.target.value)}
              />
              <button
                type="button"
                className="lw-btn"
                onClick={() => {
                  void deleteGraph('tangle', board.id);
                  setActiveBoardId(null);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {board && (
          <>
            <h2 className="lw-atlas__subhead">Add a note card</h2>
            <div className="lw-chips__add">
              <input
                className="lw-input"
                aria-label="Note text"
                placeholder="e.g. Who sent the letter?"
                value={placeDraft}
                onChange={(e) => setPlaceDraft(e.target.value)}
              />
              <button type="button" className="lw-btn" onClick={armPlaceNote}>
                Place
              </button>
            </div>

            <h2 className="lw-atlas__subhead">Add an entity card</h2>
            <select
              className="lw-input"
              aria-label="Add entity card"
              value=""
              onChange={(e) => {
                const entity = allEntities.find((x) => x.id === e.target.value);
                if (entity) {
                  setPlaceEntity(entity);
                  setPlaceDraft('');
                  setMode('place');
                }
              }}
            >
              <option value="">Choose an entity…</option>
              {allEntities.map((e) => (
                <option key={e.id} value={e.id}>
                  {ENTITY_TYPE_META[e.type].glyph} {e.name}
                </option>
              ))}
            </select>
            {mode === 'place' && (
              <p className="lw-atlas__hint" data-testid="tangle-place-hint">
                Click the board to place{' '}
                <strong>
                  {placeTemplate ? `template “${placeTemplate.name}”` : placeEntity ? placeEntity.name : placeDraft}
                </strong>
                .
              </p>
            )}

            <h2 className="lw-atlas__subhead">Templates</h2>
            <button
              type="button"
              className="lw-btn"
              onClick={async () => {
                if (board.cards.length === 0) {
                  toast('Place some cards first — a template snapshots the board.', { kind: 'error' });
                  return;
                }
                const t = await saveBoardTemplate(projectId, `${board.name} template`, board.cards, board.edges);
                toast(`Saved “${t.name}” — stamp it here or from Tools ▸ Templates.`, { kind: 'success' });
              }}
            >
              Save board as template
            </button>
            {boardTemplates.length > 0 && (
              <select
                className="lw-input"
                aria-label="Stamp template"
                value=""
                onChange={(e) => {
                  const t = boardTemplates.find((x) => x.id === e.target.value);
                  if (t) {
                    setPlaceTemplate(t);
                    setPlaceEntity(null);
                    setPlaceDraft('');
                    setMode('place');
                  }
                }}
              >
                <option value="">Stamp a template…</option>
                {boardTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.cards.length} cards)
                  </option>
                ))}
              </select>
            )}

            <h2 className="lw-atlas__subhead">Connect</h2>
            <input
              className="lw-input"
              aria-label="Thread label"
              placeholder="Thread label (e.g. suspects)"
              value={edgeLabel}
              onChange={(e) => setEdgeLabel(e.target.value)}
            />
            <label className="lw-toggle">
              <input
                type="checkbox"
                checked={edgeDirected}
                onChange={(e) => setEdgeDirected(e.target.checked)}
              />
              <span>Directed (arrow)</span>
            </label>
            <button
              type="button"
              className={mode === 'connect' ? 'lw-btn lw-btn--primary' : 'lw-btn'}
              aria-pressed={mode === 'connect'}
              onClick={() => setMode(mode === 'connect' ? 'select' : 'connect')}
            >
              {mode === 'connect' ? 'Cancel connecting' : 'Connect two cards'}
            </button>
            <p className="lw-fieldnote">Click a thread on the board to remove it.</p>

            {selectedNode && (
              <>
                <h2 className="lw-atlas__subhead">Selected card</h2>
                <p className="lw-fieldnote">
                  <strong>{selectedNode.label}</strong>
                </p>
                <div className="lw-chips__add">
                  {selectedNode.entity && (
                    <button
                      type="button"
                      className="lw-btn"
                      onClick={() => setFocus(selectedNode.entity!)}
                    >
                      Focus entity
                    </button>
                  )}
                  <button
                    type="button"
                    className="lw-btn lw-btn--danger"
                    onClick={() => {
                      void removeNode('tangle', board.id, selectedNode.id);
                      setSelectedNode(null);
                    }}
                  >
                    Remove card
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </aside>

      {board ? (
        <NodeGraphCanvas
          testId="tangle-canvas"
          nodes={board.cards}
          edges={board.edges}
          mode={mode}
          onPlace={(x, y) => void place(x, y)}
          onMoveNode={(id, x, y) => void moveNode('tangle', board.id, id, x, y)}
          onConnect={(a, b) => void connect(a, b)}
          onEdgeClick={onEdgeClick}
          onNodeClick={(node) => setSelectedNode(node)}
          selectedNodeId={selectedNode?.id ?? null}
          nodeColor={(n) => (n.entity ? ENTITY_TYPE_META[n.entity.type].color : undefined)}
        />
      ) : (
        <div className="lw-empty lw-empty--center">
          <p className="lw-empty__title">No boards yet.</p>
          <button type="button" className="lw-btn lw-btn--primary" onClick={() => void newBoard()}>
            + New board
          </button>
        </div>
      )}
    </div>
  );
}
