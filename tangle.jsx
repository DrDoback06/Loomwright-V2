// =====================================================================
// tangle.jsx — Tangle side panel + full-screen interactive canvas
//
// Tangle = freeform mind-mapping / corkboard. Drag entities + notes
// onto an infinite parchment canvas; connect, group, send to Writer's
// Room or convert clusters to quests/events.
//
// The canvas implements:
//   - pan (drag empty canvas, or hold space + drag)
//   - zoom (wheel)
//   - drag nodes
//   - drag-to-connect (drag from a node's handle to another)
//   - mini-map (read-only viewport indicator)
//   - entity tray (drag entity onto canvas to add a node)
//   - inspector panel for the selected node
// =====================================================================

const { useState: _tn_us, useRef: _tn_ur, useEffect: _tn_ue, useCallback: _tn_uc, useMemo: _tn_um } = React;

// ---------------------------------------------------------------------
// Sample tangle board — seeded with our Pale Reach plot threads
// ---------------------------------------------------------------------
const TANGLE_BOARDS = [
  { id: "tb1", name: "Acts II–III plot", active: true,  pinned: true,  notes: 5, nodes: 11 },
  { id: "tb2", name: "Aelinor arc",      active: false, pinned: false, notes: 3, nodes: 6  },
  { id: "tb3", name: "Salt-wraith motif",active: false, pinned: false, notes: 2, nodes: 4  },
];

const TANGLE_NODE_TYPES = [
  { id: "note",      label: "Text note",       glyph: "✎", color: "#9a7b3a" },
  { id: "cast",      label: "Character",       glyph: "◐", color: "#7a6aa3" },
  { id: "locations", label: "Location",        glyph: "▲", color: "#6b8a4a" },
  { id: "items",     label: "Item",            glyph: "✧", color: "#b08a3e" },
  { id: "quests",    label: "Quest",           glyph: "✦", color: "#8a3a4f" },
  { id: "events",    label: "Event",           glyph: "◈", color: "#c79545" },
  { id: "lore",      label: "Lore fact",       glyph: "◉", color: "#7a5a3a" },
  { id: "references",label: "Reference",       glyph: "▤", color: "#76684c" },
  { id: "image",     label: "Image",           glyph: "▢", color: "#5d7896" },
  { id: "quote",     label: "Quote",           glyph: "❝", color: "#a8553f" },
  { id: "custom",    label: "Custom",          glyph: "·", color: "#3d3a78" },
];

// Initial nodes (positions are in canvas coordinates)
const INITIAL_TANGLE_NODES = [
  { id: "tn1", kind: "cast",      title: "Aelinor Vey",     preview: "Inherits the Auger. Chooses to bind or break.", cite: "Ch. 1", x: 200, y: 200 },
  { id: "tn2", kind: "cast",      title: "Saren of Hess",   preview: "Asks for the Auger as bond.",                   cite: "Ch. 7", x: 600, y: 200 },
  { id: "tn3", kind: "cast",      title: "Captain Brec",    preview: "Leaves first. Loyal but absent.",               cite: "Ch. 7", x: 400, y: 360 },
  { id: "tn4", kind: "items",     title: "Bone Auger",      preview: "The hinge of every break.",                     cite: "Ch. 1, 7", x: 400, y: 80 },
  { id: "tn5", kind: "quests",    title: "Hess negotiation",preview: "Three-day audience. Breaks Ch. 7.",             cite: "Ch. 3–7", x: 380, y: 540 },
  { id: "tn6", kind: "events",    title: "Negotiation break",preview: "Aelinor refuses. Audience pauses.",            cite: "Ch. 7", x: 640, y: 540 },
  { id: "tn7", kind: "lore",      title: "Hard canon: Auger Stone",   preview: "Once used, cannot be used again in same generation.", cite: "Ch. 6", x: 110, y: 540 },
  { id: "tn8", kind: "note",      title: "Three-day rule",  preview: "Glass Throne audiences last exactly three days.", x: 760, y: 100 },
  { id: "tn9", kind: "quote",     title: "\"Today, or not at all.\"", preview: "Aelinor's break-line in Ch. 7.", cite: "Ch. 7, p. 188", x: 820, y: 400 },
  { id: "tn10",kind: "note",      title: "Motif: salt",     preview: "Salt cuts, salt holds, salt remembers.",          x: 80, y: 100 },
  { id: "tn11",kind: "locations", title: "Glass Court",     preview: "Where the audience happens.",                     cite: "Ch. 3–7", x: 760, y: 280 },
];

const INITIAL_TANGLE_EDGES = [
  { id: "te1", from: "tn1", to: "tn4", label: "carries" },
  { id: "te2", from: "tn4", to: "tn5", label: "asked for in" },
  { id: "te3", from: "tn5", to: "tn6", label: "breaks at" },
  { id: "te4", from: "tn1", to: "tn3", label: "trusts" },
  { id: "te5", from: "tn2", to: "tn5", label: "opens" },
  { id: "te6", from: "tn4", to: "tn7", label: "bound by" },
  { id: "te7", from: "tn5", to: "tn11", label: "set in" },
];

// ---------------------------------------------------------------------
// Side panel preview SVG (mini-board)
// ---------------------------------------------------------------------
const TanglePreviewMini = ({ nodes, edges }) => {
  if (!nodes || !nodes.length) return null;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));
  const padding = 60;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;
  const proj = (n) => ({ x: n.x - minX + padding, y: n.y - minY + padding });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {edges.map((e) => {
        const a = nodes.find((n) => n.id === e.from);
        const b = nodes.find((n) => n.id === e.to);
        if (!a || !b) return null;
        const pa = proj(a); const pb = proj(b);
        return <line key={e.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="var(--ink-4)" strokeWidth={2}/>;
      })}
      {nodes.map((n) => {
        const t = TANGLE_NODE_TYPES.find((x) => x.id === n.kind) || TANGLE_NODE_TYPES[0];
        const p = proj(n);
        return <circle key={n.id} cx={p.x} cy={p.y} r="16" fill={t.color} stroke="var(--bg-paper)" strokeWidth="3"/>;
      })}
    </svg>
  );
};

// ---------------------------------------------------------------------
// TanglePanelBody — side panel
// ---------------------------------------------------------------------
const TanglePanelBody = ({ panel }) => {
  const [fullScreen, setFullScreen] = _tn_us(false);
  const activeBoard = TANGLE_BOARDS.find((b) => b.active) || TANGLE_BOARDS[0];

  return (
    <div className="tan-side" data-ui="TanglePanelBody">
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)" }}>
          Current board
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", color: "var(--ink-1)", margin: "2px 0 4px" }}>
          {activeBoard.name}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", color: "var(--ink-4)" }}>
          {activeBoard.nodes} nodes · {activeBoard.notes} notes
        </div>
      </div>

      <div className="tan-side__preview">
        <TanglePreviewMini nodes={INITIAL_TANGLE_NODES} edges={INITIAL_TANGLE_EDGES}/>
        <button className="tan-side__expand" data-callback="onOpenTangleCanvas" onClick={() => setFullScreen(true)}>
          Open Tangle Canvas →
        </button>
      </div>

      <div className="tan-side__list">
        <div className="tan-side__list-head">Recent notes</div>
        {INITIAL_TANGLE_NODES.filter((n) => n.kind === "note" || n.kind === "quote").slice(0, 3).map((n) => {
          const t = TANGLE_NODE_TYPES.find((x) => x.id === n.kind);
          return (
            <div key={n.id} className="tan-side__item" style={{ borderLeftColor: t.color }}>
              <span className="tan-side__item-glyph" style={{ background: t.color }}>{t.glyph}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-4)", fontStyle: "italic" }}>{n.preview}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tan-side__list">
        <div className="tan-side__list-head">Pinned clusters</div>
        <div className="tan-side__item">
          <span className="tan-side__item-glyph">◧</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div>Negotiation arc</div>
            <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-4)" }}>5 nodes · 1 unresolved</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <button className="rpg-btn rpg-btn--primary rpg-btn--small" data-callback="onCreateTangleNode" style={{ flex: 1 }}>New note</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onSendTangleItemToWriter" style={{ flex: 1 }}>Send to Writer</button>
      </div>

      {fullScreen && <TangleFullScreen onClose={() => setFullScreen(false)}/>}
    </div>
  );
};

// ---------------------------------------------------------------------
// TangleNode — draggable node on the canvas
// ---------------------------------------------------------------------
const TangleNode = ({ node, selected, onSelect, onDrag, onStartConnect, scale }) => {
  const ref = _tn_ur(null);
  const t = TANGLE_NODE_TYPES.find((x) => x.id === node.kind) || TANGLE_NODE_TYPES[0];

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.classList && e.target.classList.contains("tan-node__handle")) return; // handled below
    e.stopPropagation();
    onSelect && onSelect(node.id);
    const startX = e.clientX, startY = e.clientY;
    const startNodeX = node.x, startNodeY = node.y;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onDrag && onDrag(node.id, startNodeX + dx, startNodeY + dy);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  return (
    <div
      ref={ref}
      className={"tan-node" + (selected ? " is-selected" : "")}
      data-ui="TangleNode"
      style={{ left: node.x, top: node.y, "--ec": t.color }}
      onMouseDown={onMouseDown}
    >
      <div className="tan-node__head">
        <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: t.color }}>{t.glyph}</span>
        <span>{t.label}</span>
      </div>
      <div className="tan-node__title">{node.title}</div>
      {node.preview && <div className="tan-node__preview">{node.preview}</div>}
      {node.cite && <span className="tan-node__cite">{node.cite}</span>}
      <span
        className="tan-node__handle tan-node__handle--r"
        data-callback="onConnectTangleNodes"
        onMouseDown={(e) => { e.stopPropagation(); onStartConnect && onStartConnect(node.id, e); }}
      />
      <span
        className="tan-node__handle tan-node__handle--l"
        onMouseDown={(e) => { e.stopPropagation(); onStartConnect && onStartConnect(node.id, e); }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------
// TangleFullScreen — the canvas
// ---------------------------------------------------------------------
const TangleFullScreen = ({ onClose }) => {
  const [nodes, setNodes]     = _tn_us(INITIAL_TANGLE_NODES);
  const [edges, setEdges]     = _tn_us(INITIAL_TANGLE_EDGES);
  const [selectedId, setSelectedId] = _tn_us("tn1");
  const [pan, setPan]         = _tn_us({ x: 0, y: 0 });
  const [scale, setScale]     = _tn_us(1);
  const [panning, setPanning] = _tn_us(false);
  const [connectFrom, setConnectFrom] = _tn_us(null);  // node id of the source
  const [connectPos, setConnectPos]   = _tn_us(null);  // current mouse pos in canvas coords
  const [filterKind, setFilterKind]   = _tn_us("all");
  const [layer, setLayer]             = _tn_us("all"); // all | sketch | clusters
  const canvasRef = _tn_ur(null);

  const selected = nodes.find((n) => n.id === selectedId);

  // ---- Pan handler -------------------------------------------------
  const onCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".tan-node")) return;
    setPanning(true);
    const startX = e.clientX, startY = e.clientY;
    const startPan = { ...pan };
    const onMove = (ev) => setPan({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) });
    const onUp = () => {
      setPanning(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  // ---- Wheel zoom --------------------------------------------------
  const onWheel = (e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Pre-zoom canvas point under mouse
    const px = (mx - pan.x) / scale;
    const py = (my - pan.y) / scale;
    const delta = -e.deltaY * 0.0015;
    const next = Math.max(0.3, Math.min(2.5, scale + delta));
    // Adjust pan so the canvas point stays under the mouse
    setScale(next);
    setPan({ x: mx - px * next, y: my - py * next });
  };

  // ---- Connect drag ----------------------------------------------
  const onStartConnect = (fromId, e) => {
    setConnectFrom(fromId);
    const rect = canvasRef.current?.getBoundingClientRect();
    const onMove = (ev) => {
      if (!rect) return;
      const x = (ev.clientX - rect.left - pan.x) / scale;
      const y = (ev.clientY - rect.top  - pan.y) / scale;
      setConnectPos({ x, y });
    };
    const onUp = (ev) => {
      // If we landed on a node, create an edge; else cancel.
      const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
      const nodeEl = dropEl?.closest && dropEl.closest(".tan-node");
      if (nodeEl) {
        // The node's React state doesn't carry its id in DOM; we look it up by position.
        // Simpler approach: tag each node with data-tn-id when rendering.
        const targetId = nodeEl.getAttribute("data-tn-id");
        if (targetId && targetId !== fromId) {
          setEdges((curr) => [...curr, { id: "te-new-" + curr.length, from: fromId, to: targetId, label: "" }]);
        }
      }
      setConnectFrom(null);
      setConnectPos(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  // ---- Drag node ---------------------------------------------------
  const onDragNode = (id, x, y) => {
    setNodes((curr) => curr.map((n) => n.id === id ? { ...n, x, y } : n));
  };

  // ---- Drop entity tile from tray to canvas ----------------------
  const onTrayDrop = (kind, e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / scale;
    const y = (e.clientY - rect.top  - pan.y) / scale;
    const t = TANGLE_NODE_TYPES.find((x) => x.id === kind);
    setNodes((curr) => [...curr, {
      id: "tn-new-" + curr.length,
      kind, x, y,
      title: "New " + (t?.label || "node"),
      preview: "",
    }]);
  };

  // Visible nodes after filter
  const visibleNodes = nodes.filter((n) => filterKind === "all" ? true : n.kind === filterKind);

  // Render edges (only between visible nodes)
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));

  // Edge endpoints in canvas-space
  const edgePath = (e) => {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    if (!a || !b) return null;
    // Approximate node anchor (center, offset by node size estimate)
    const ax = a.x + 80, ay = a.y + 30;
    const bx = b.x + 80, by = b.y + 30;
    const mx = (ax + bx) / 2;
    return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
  };

  // Mini-map: render down-scaled
  const mmExtent = _tn_um(() => {
    const xs = nodes.map((n) => n.x); const ys = nodes.map((n) => n.y);
    return { minX: Math.min(...xs) - 80, minY: Math.min(...ys) - 60, maxX: Math.max(...xs) + 160, maxY: Math.max(...ys) + 80 };
  }, [nodes]);

  return (
    <div className="tan-fs" data-ui="TangleFullScreen" role="dialog" aria-label="Tangle canvas">
      <button className="rpg-btn rpg-btn--small tan-fs__close" data-callback="onCloseTangleCanvas" onClick={onClose}>Close ✕</button>

      {/* Tray */}
      <aside className="tan-fs__tray">
        <div className="tan-fs__tray-head">Entity tray</div>
        <div className="tan-fs__tray-section">
          <h4>Drag onto canvas</h4>
          {TANGLE_NODE_TYPES.map((t) => (
            <div key={t.id} className="tan-fs__tray-tile"
                 draggable
                 onDragEnd={(e) => onTrayDrop(t.id, e)}
                 title={"Drag to add a " + t.label}>
              <span style={{ color: t.color, fontFamily: "var(--font-display)" }}>{t.glyph}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
        <div className="tan-fs__tray-section">
          <h4>Filter</h4>
          <select className="loc-body__filter" value={filterKind} onChange={(e) => setFilterKind(e.target.value)} style={{ width: "100%" }}>
            <option value="all">All node types</option>
            {TANGLE_NODE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="tan-fs__tray-section">
          <h4>Layers</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["all", "All layers"], ["sketch", "Sketch"], ["clusters", "Named clusters"]].map(([k, l]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)" }}>
                <input type="radio" name="tan-layer" checked={layer === k} onChange={() => setLayer(k)}/>
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="tan-fs__tray-section">
          <h4>Quick add</h4>
          <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onCreateTangleNode"
                  style={{ width: "100%" }}
                  onClick={() => onTrayDrop("note", { clientX: 200, clientY: 200 })}>
            + New note
          </button>
          <button className="rpg-btn rpg-btn--small" data-callback="onCreateTangleGroup"
                  style={{ width: "100%", marginTop: 4 }}>
            + Group selection
          </button>
        </div>
      </aside>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={"tan-fs__canvas" + (panning ? " is-panning" : "")}
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Floating toolbar */}
        <div className="tan-fs__toolbar">
          <button className="tan-fs__tb-btn"            data-callback="onCreateTangleNode">+ Note</button>
          <button className="tan-fs__tb-btn"            data-callback="onConnectTangleNodes">Connect</button>
          <button className="tan-fs__tb-btn"            data-callback="onCreateTangleGroup">Group</button>
          <button className="tan-fs__tb-btn"            data-callback="onCreateQuestFromTangle">→ Quest</button>
          <button className="tan-fs__tb-btn"            data-callback="onCreateEventFromTangle">→ Event</button>
          <button className="tan-fs__tb-btn"            data-callback="onSendTangleItemToWriter">→ Writer's Room</button>
          <button className="tan-fs__tb-btn"            data-callback="onTangleSearch">Search</button>
          <button className="tan-fs__tb-btn" onClick={() => { setPan({ x: 0, y: 0 }); setScale(1); }}>Fit</button>
        </div>

        <div
          className="tan-fs__canvas-inner"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          {/* Edges (SVG) */}
          <svg className="tan-fs__svg" width="3000" height="2000" style={{ overflow: "visible" }}>
            <defs>
              <marker id="tan-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="var(--ink-3)"/>
              </marker>
            </defs>
            {visibleEdges.map((e) => (
              <g key={e.id}>
                <path d={edgePath(e)} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" markerEnd="url(#tan-arrow)"/>
                {e.label && (() => {
                  const a = nodes.find((n) => n.id === e.from);
                  const b = nodes.find((n) => n.id === e.to);
                  if (!a || !b) return null;
                  const mx = (a.x + b.x) / 2 + 80;
                  const my = (a.y + b.y) / 2 + 20;
                  return (
                    <text x={mx} y={my} fontSize="11" fontFamily="var(--font-serif)" fontStyle="italic" fill="var(--ink-3)" textAnchor="middle">{e.label}</text>
                  );
                })()}
              </g>
            ))}
            {connectFrom && connectPos && (() => {
              const a = nodes.find((n) => n.id === connectFrom);
              if (!a) return null;
              return <path d={`M ${a.x + 80} ${a.y + 30} L ${connectPos.x} ${connectPos.y}`} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4"/>;
            })()}
          </svg>

          {/* Nodes */}
          {visibleNodes.map((n) => (
            <div key={n.id} data-tn-id={n.id} style={{ position: "absolute", left: 0, top: 0 }}>
              <TangleNode
                node={n}
                selected={selectedId === n.id}
                onSelect={setSelectedId}
                onDrag={onDragNode}
                onStartConnect={onStartConnect}
                scale={scale}
              />
            </div>
          ))}
        </div>

        {/* Mini-map */}
        <div className="tan-fs__minimap" aria-hidden>
          <svg viewBox={`${mmExtent.minX} ${mmExtent.minY} ${mmExtent.maxX - mmExtent.minX} ${mmExtent.maxY - mmExtent.minY}`}>
            {edges.map((e) => {
              const a = nodes.find((n) => n.id === e.from); const b = nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              return <line key={e.id} x1={a.x + 80} y1={a.y + 30} x2={b.x + 80} y2={b.y + 30} stroke="var(--ink-4)" strokeWidth={4}/>;
            })}
            {nodes.map((n) => {
              const t = TANGLE_NODE_TYPES.find((x) => x.id === n.kind) || TANGLE_NODE_TYPES[0];
              return <circle key={n.id} cx={n.x + 80} cy={n.y + 30} r={16} fill={t.color} stroke="var(--bg-paper)" strokeWidth={3}/>;
            })}
          </svg>
        </div>
      </div>

      {/* Inspector */}
      <aside className="tan-fs__inspect">
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)" }}>Inspector</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", color: "var(--ink-1)", lineHeight: 1.1, marginTop: 2 }}>
            {selected?.title || "—"}
          </div>
          {selected && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
              {(TANGLE_NODE_TYPES.find((t) => t.id === selected.kind) || {}).label}
              {selected.cite && <span> · {selected.cite}</span>}
            </div>
          )}
        </div>

        {selected ? (
          <>
            <div>
              <div className="aiw__section-title">Note</div>
              <textarea
                className="aiw__textarea"
                value={selected.preview || ""}
                data-callback="onEditTangleNode"
                onChange={(e) => setNodes((curr) => curr.map((n) => n.id === selected.id ? { ...n, preview: e.target.value } : n))}
                placeholder="Write a note for this card…"
              />
            </div>
            <div>
              <div className="aiw__section-title">Edges</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {edges.filter((e) => e.from === selected.id || e.to === selected.id).map((e) => {
                  const other = nodes.find((n) => n.id === (e.from === selected.id ? e.to : e.from));
                  if (!other) return null;
                  return (
                    <li key={e.id} style={{
                      padding: "5px 8px", background: "var(--bg-paper)", border: "1px solid var(--line-2)",
                      borderRadius: "var(--r-2)", fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)",
                      display: "flex", gap: 6, alignItems: "center",
                    }}>
                      <span style={{ fontStyle: "italic", color: "var(--ink-3)" }}>{e.from === selected.id ? "→" : "←"}</span>
                      <span style={{ flex: 1 }}>{other.title}</span>
                      <button
                        className="stat-rule-row__icon"
                        data-callback="onDisconnectTangleNodes"
                        onClick={() => setEdges((curr) => curr.filter((x) => x.id !== e.id))}
                      >✕</button>
                    </li>
                  );
                })}
                {edges.filter((e) => e.from === selected.id || e.to === selected.id).length === 0 && (
                  <li style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-4)", fontSize: "var(--fs-sm)" }}>
                    No edges yet. Drag from a handle to connect.
                  </li>
                )}
              </ul>
            </div>
            <div className="rpg-actions" style={{ marginTop: 0 }}>
              <button className="rpg-btn rpg-btn--small" data-callback="onSendTangleItemToWriter">Send to Writer</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onCreateQuestFromTangle">→ Quest</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onCreateEventFromTangle">→ Event</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onOpenRelatedTab">Open related</button>
              <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDeleteTangleNodeRequest"
                      onClick={() => { setNodes((curr) => curr.filter((n) => n.id !== selected.id)); setEdges((curr) => curr.filter((e) => e.from !== selected.id && e.to !== selected.id)); setSelectedId(null); }}>
                Delete
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-4)", fontSize: "var(--fs-sm)" }}>
            Pick a node, or drag one onto the canvas from the tray.
          </div>
        )}

        <div style={{ marginTop: "auto", fontFamily: "var(--font-sans)", fontSize: "var(--fs-3xs)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {nodes.length} nodes · {edges.length} edges · zoom {Math.round(scale * 100)}%
        </div>
      </aside>
    </div>
  );
};

window.TANGLE_BOARDS = TANGLE_BOARDS;
window.TANGLE_NODES = INITIAL_TANGLE_NODES;
window.TANGLE_EDGES = INITIAL_TANGLE_EDGES;
window.TANGLE_NODE_TYPES = TANGLE_NODE_TYPES;
Object.assign(window, { TanglePanelBody, TangleFullScreen, TangleNode, TanglePreviewMini });
