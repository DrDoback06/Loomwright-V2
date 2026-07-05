import { useEffect, useRef, useState } from 'react';
import type { GraphEdge, GraphNode } from '@/db/types';
import { useCanvas } from './useCanvas';

export interface NodeGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Currently armed interaction. 'connect' waits for two node clicks. */
  mode: 'select' | 'connect' | 'place';
  onPlace?: (x: number, y: number) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onNodeClick?: (node: GraphNode) => void;
  onConnect?: (fromId: string, toId: string) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  selectedNodeId?: string | null;
  /** Per-node accent color (defaults to parchment ink). */
  nodeColor?: (node: GraphNode) => string | undefined;
  /** Node/edge ids rendered as staged ghosts (generation preview). */
  stagedIds?: Set<string>;
  /** Change this value to fit the viewport around all current nodes. */
  fitKey?: unknown;
  testId?: string;
}

const NODE_W = 148;
const NODE_H = 44;

/** Shared node+edge canvas used by Tangle and Skill Trees: pan/zoom/pinch
 * from useCanvas, pointer-dragged nodes, click-click connecting, edge
 * labels with optional direction arrows. */
export function NodeGraphCanvas({
  nodes,
  edges,
  mode,
  onPlace,
  onMoveNode,
  onNodeClick,
  onConnect,
  onEdgeClick,
  selectedNodeId,
  nodeColor,
  stagedIds,
  fitKey,
  testId,
}: NodeGraphCanvasProps) {
  const { viewport, rootRef, toCanvas, claimPointer, fitTo, handlers } = useCanvas({ x: 30, y: 20, scale: 1 });
  const dragging = useRef<{ nodeId: string; moved: boolean } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Fit-to-view on demand: the parent bumps fitKey (staged bundle arrived,
  // "Fit to view" clicked) and the viewport frames every node.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  useEffect(() => {
    if (fitKey === undefined) return;
    fitTo(nodesRef.current.map((n) => ({ x: n.x, y: n.y })));
  }, [fitKey, fitTo]);

  const startDrag = (e: React.PointerEvent, node: GraphNode) => {
    e.stopPropagation();
    claimPointer();
    dragging.current = { nodeId: node.id, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current.moved = true;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    onMoveNode(dragging.current.nodeId, Math.round(x), Math.round(y));
  };
  const endDrag = () => {
    dragging.current = null;
  };

  const clickNode = (node: GraphNode) => {
    if (dragging.current?.moved) return;
    if (mode === 'connect' && onConnect) {
      if (!connectFrom) {
        setConnectFrom(node.id);
      } else if (connectFrom !== node.id) {
        onConnect(connectFrom, node.id);
        setConnectFrom(null);
      }
      return;
    }
    onNodeClick?.(node);
  };

  return (
    <div
      ref={rootRef}
      className={`lw-graphcanvas ${mode === 'place' ? 'lw-graphcanvas--placing' : ''}`}
      data-testid={testId ?? 'graph-canvas'}
      {...handlers}
      onClick={(e) => {
        if (mode === 'place' && onPlace) {
          const { x, y } = toCanvas(e.clientX, e.clientY);
          onPlace(Math.round(x), Math.round(y));
        }
      }}
    >
      <svg
        className="lw-graphcanvas__svg"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
        width={4000}
        height={4000}
      >
        <defs>
          <marker id="lw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="lw-graph__arrowhead" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const a = byId.get(edge.from);
          const b = byId.get(edge.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const staged = stagedIds?.has(edge.id);
          return (
            <g
              key={edge.id}
              className={staged ? 'lw-graph__edge lw-graph__edge--staged' : 'lw-graph__edge'}
              data-testid={`edge-${edge.label ?? edge.id}`}
            >
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                markerEnd={edge.directed ? 'url(#lw-arrow)' : undefined}
              />
              {/* generous invisible hit line for edge clicks */}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="lw-graph__edgehit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdgeClick?.(edge);
                }}
              />
              {edge.label ? (
                <text x={mx} y={my - 6} textAnchor="middle" className="lw-graph__edgelabel">
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {nodes.map((node, i) => {
          const color = nodeColor?.(node);
          const isSelected = node.id === selectedNodeId || node.id === connectFrom;
          const staged = stagedIds?.has(node.id);
          const classes = [
            'lw-graph__node',
            isSelected ? 'lw-graph__node--selected' : '',
            staged ? 'lw-graph__node--staged' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className={classes}
              style={staged ? { animationDelay: `${(i % 24) * 70}ms` } : undefined}
              data-testid={`node-${node.label}`}
              onPointerDown={(e) => startDrag(e, node)}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onClick={(e) => {
                e.stopPropagation();
                clickNode(node);
              }}
            >
              <rect
                x={-NODE_W / 2}
                y={-NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                className="lw-graph__nodebox"
                style={color ? { stroke: color } : undefined}
              />
              {node.unlocked !== undefined && (
                <circle cx={-NODE_W / 2 + 16} cy={0} r={7} className={node.unlocked ? 'lw-graph__unlock lw-graph__unlock--on' : 'lw-graph__unlock'} />
              )}
              <text x={node.unlocked !== undefined ? 10 : 0} y={5} textAnchor="middle" className="lw-graph__nodelabel">
                {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
              </text>
            </g>
          );
        })}
      </svg>
      {mode === 'connect' && (
        <p className="lw-graphcanvas__hint" data-testid="connect-hint">
          {connectFrom ? 'Now click the target node.' : 'Click the first node to connect.'}
        </p>
      )}
    </div>
  );
}
