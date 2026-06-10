// =====================================================================
// tangle.jsx — Tangle side panel + full-screen interactive canvas
//
// Tangle = the story board: freeform mind-mapping / corkboard. Drag
// entities + notes onto an infinite parchment canvas; connect them with
// first-class edges (labelled, directed, multiple per pair), group
// clusters, send cards to the Writer's Room or convert them to
// quests/events.
//
// Everything persists through TangleService (boards / nodes / edges /
// groups survive reload; entity cards stay bound to the live entity and
// rebind on merges).
//
// The canvas implements:
//   - pan (drag empty canvas) + wheel zoom
//   - drag nodes (position persisted on release)
//   - drag-to-connect from a node's handle (labelled edge)
//   - edge editing in the inspector (label / direction / remove)
//   - mini-map (read-only viewport indicator)
//   - entity tray: live entities, draggable onto the canvas
//   - board switcher, board-scoped layers + clusters
// =====================================================================

const { useState: _tn_us, useRef: _tn_ur, useEffect: _tn_ue, useCallback: _tn_uc, useMemo: _tn_um } = React;

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
  { id: "suggestion",label: "Suggestion",      glyph: "✶", color: "#c98a2c" },
  { id: "custom",    label: "Custom",          glyph: "·", color: "#3d3a78" },
];
const _tnType = (kind) => TANGLE_NODE_TYPES.find((x) => x.id === kind) || TANGLE_NODE_TYPES[TANGLE_NODE_TYPES.length - 1];
const _tnDispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const _tnNotice = (message) => _tnDispatch("lw:backend-notice", { message });

// One live snapshot of the board state (+ a version bump hook).
const useTangleState = () => {
  const [tick, setTick] = _tn_us(0);
  _tn_ue(() => {
    const bump = () => setTick((t) => t + 1);
    const evs = ["lw:tangle-updated", "lw:entity-store-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  return _tn_um(() => {
    const B = window.LoomwrightBackend;
    const state = B?.TangleService?.loadSync?.() || { boards: [], activeBoardId: null, nodes: [], edges: [], groups: [] };
    const id = state.activeBoardId || state.boards[0]?.id || null;
    return {
      boards: state.boards || [],
      activeBoardId: id,
      board: (state.boards || []).find((b) => b.id === id) || null,
      nodes: (state.nodes || []).filter((n) => n.boardId === id),
      edges: (state.edges || []).filter((e) => e.boardId === id),
      groups: (state.groups || []).filter((g) => g.boardId === id),
    };
  }, [tick]);
};

// Entity cards degrade to plain notes if their entity disappears.
const _tnResolveNode = (n) => {
  if (!n.entityId) return n;
  const ent = window.LoomwrightBackend?.EntityService?.getSync?.(n.entityId, n.entityType);
  if (!ent || ent.status === "deleted") return { ...n, unlinked: true };
  return { ...n, title: ent.name || n.title, preview: n.preview || ent.summary || "" };
};

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
        const t = _tnType(n.kind);
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
  const live = useTangleState();
  const B = () => window.LoomwrightBackend;

  // First open: make sure a board exists.
  _tn_ue(() => {
    if (!live.board && B()?.TangleService) B().TangleService.ensureBoard();
  }, [live.board]);

  const noteish = live.nodes.filter((n) => n.kind === "note" || n.kind === "quote" || n.kind === "suggestion");

  return (
    <div className="tan-side" data-ui="TanglePanelBody">
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)" }}>
          Current board
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", color: "var(--ink-1)", margin: "2px 0 4px" }}>
          {live.board?.name || "—"}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", color: "var(--ink-4)" }}>
          {live.nodes.length} nodes · {live.edges.length} threads
        </div>
      </div>

      <div className="tan-side__preview">
        {live.nodes.length > 0
          ? <TanglePreviewMini nodes={live.nodes} edges={live.edges}/>
          : <div className="tan-side__empty" data-ui="TangleEmptyPreview">An empty corkboard — open the canvas and pin your first thread.</div>}
        <button className="tan-side__expand" data-callback="onOpenTangleCanvas" data-testid="tan-open-canvas" onClick={() => setFullScreen(true)}>
          Open Tangle Canvas →
        </button>
      </div>

      <div className="tan-side__list">
        <div className="tan-side__list-head">Boards</div>
        {live.boards.map((b) => (
          <button key={b.id} className={"tan-side__item tan-side__item--board" + (b.id === live.activeBoardId ? " is-on" : "")}
                  onClick={() => B()?.TangleService?.setActiveBoard(b.id)}>
            <span className="tan-side__item-glyph">{b.pinned ? "◉" : "○"}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
            </div>
          </button>
        ))}
        <button className="tan-side__item tan-side__item--add" data-testid="tan-add-board"
                onClick={async () => {
                  const row = await B()?.TangleService?.addBoard({ name: "Board " + (live.boards.length + 1) });
                  if (row) _tnNotice("Board created.");
                }}>
          <span className="tan-side__item-glyph">+</span>
          <div>New board</div>
        </button>
      </div>

      <div className="tan-side__list">
        <div className="tan-side__list-head">Recent notes</div>
        {noteish.slice(0, 3).map((n) => {
          const t = _tnType(n.kind);
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
        {noteish.length === 0 && (
          <div className="tan-side__item" style={{ fontStyle: "italic", color: "var(--ink-4)" }}>No notes pinned yet.</div>
        )}
      </div>

      <div className="tan-side__list">
        <div className="tan-side__list-head">Pinned clusters</div>
        {live.groups.map((g) => (
          <div key={g.id} className="tan-side__item">
            <span className="tan-side__item-glyph">◧</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div>{g.title || g.name || "Cluster"}</div>
              <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-4)" }}>{(g.nodeIds || []).length} nodes</div>
            </div>
          </div>
        ))}
        {live.groups.length === 0 && (
          <div className="tan-side__item" style={{ fontStyle: "italic", color: "var(--ink-4)" }}>Group a cluster on the canvas to pin it here.</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <button className="rpg-btn rpg-btn--primary rpg-btn--small" data-callback="onCreateTangleNode" style={{ flex: 1 }}>New note</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onSendTangleItemToWriter" style={{ flex: 1 }}
                onClick={() => {
                  const n = noteish[0];
                  if (!n) { _tnNotice("Pin a note first — it lands in the Writer's Room."); return; }
                  _tnDispatch("lw:dispatch-callback", { name: "onSendTangleItemToWriter", detail: { text: n.title + (n.preview ? "\n\n" + n.preview : "") } });
                }}>Send to Writer</button>
      </div>

      {fullScreen && <TangleFullScreen onClose={() => setFullScreen(false)}/>}
    </div>
  );
};

// ---------------------------------------------------------------------
// TangleNode — draggable node on the canvas
// ---------------------------------------------------------------------
const TangleNode = ({ node, selected, onSelect, onDrag, onDragEnd, onStartConnect, scale }) => {
  const ref = _tn_ur(null);
  const t = _tnType(node.kind);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.classList && e.target.classList.contains("tan-node__handle")) return; // handled below
    e.stopPropagation();
    onSelect && onSelect(node.id);
    const startX = e.clientX, startY = e.clientY;
    const startNodeX = node.x, startNodeY = node.y;
    let lastX = startNodeX, lastY = startNodeY, moved = false;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      moved = moved || Math.abs(dx) > 1 || Math.abs(dy) > 1;
      lastX = startNodeX + dx;
      lastY = startNodeY + dy;
      onDrag && onDrag(node.id, lastX, lastY);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      if (moved && onDragEnd) onDragEnd(node.id, lastX, lastY);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  return (
    <div
      ref={ref}
      className={"tan-node" + (selected ? " is-selected" : "") + (node.unlinked ? " is-unlinked" : "")}
      data-ui="TangleNode"
      style={{ left: node.x, top: node.y, "--ec": t.color }}
      onMouseDown={onMouseDown}
    >
      <div className="tan-node__head">
        <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: t.color }}>{t.glyph}</span>
        <span>{node.unlinked ? t.label + " (unlinked)" : t.label}</span>
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
  const live = useTangleState();
  const B = () => window.LoomwrightBackend;

  // Local optimistic node positions while dragging (id → {x,y}).
  const [dragPos, setDragPos] = _tn_us({});
  const nodes = _tn_um(
    () => live.nodes.map((n) => _tnResolveNode(dragPos[n.id] ? { ...n, ...dragPos[n.id] } : n)),
    [live.nodes, dragPos]
  );
  const edges = live.edges;

  const [selectedId, setSelectedId] = _tn_us(null);
  const [selectedEdgeId, setSelectedEdgeId] = _tn_us(null);
  const [pan, setPan]         = _tn_us({ x: 0, y: 0 });
  const [scale, setScale]     = _tn_us(1);
  const [panning, setPanning] = _tn_us(false);
  const [connectFrom, setConnectFrom] = _tn_us(null);  // node id of the source
  const [connectPos, setConnectPos]   = _tn_us(null);  // current mouse pos in canvas coords
  const [filterKind, setFilterKind]   = _tn_us("all");
  const [layer, setLayer]             = _tn_us("all"); // all | sketch | clusters
  const [traySearch, setTraySearch]   = _tn_us("");
  const [searchOpen, setSearchOpen]   = _tn_us(false);
  const canvasRef = _tn_ur(null);

  const selected = nodes.find((n) => n.id === selectedId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  // ---- Pan handler -------------------------------------------------
  const onCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".tan-node")) return;
    setSelectedEdgeId(null);
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
    const px = (mx - pan.x) / scale;
    const py = (my - pan.y) / scale;
    const delta = -e.deltaY * 0.0015;
    const next = Math.max(0.3, Math.min(2.5, scale + delta));
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
    const onUp = async (ev) => {
      const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
      const nodeEl = dropEl?.closest && dropEl.closest("[data-tn-id]");
      if (nodeEl) {
        const targetId = nodeEl.getAttribute("data-tn-id");
        if (targetId && targetId !== fromId) {
          const row = await B()?.TangleService?.addEdge({ from: fromId, to: targetId, label: "" });
          if (row) setSelectedEdgeId(row.id);
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

  // ---- Drag node (optimistic; persisted on release) ----------------
  const onDragNode = (id, x, y) => setDragPos((curr) => ({ ...curr, [id]: { x, y } }));
  const onDragNodeEnd = async (id, x, y) => {
    await B()?.TangleService?.updateNode(id, { x, y });
    setDragPos((curr) => { const next = { ...curr }; delete next[id]; return next; });
  };

  // ---- Canvas-space point from a mouse event ----------------------
  const canvasPoint = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 200, y: 200 };
    return {
      x: (e.clientX - rect.left - pan.x) / scale,
      y: (e.clientY - rect.top  - pan.y) / scale,
    };
  };

  // ---- Drop a node-type tile from the tray ------------------------
  const onTrayDrop = async (kind, e) => {
    const p = canvasPoint(e);
    const t = _tnType(kind);
    const row = await B()?.TangleService?.addNode({
      boardId: live.activeBoardId, kind, x: p.x, y: p.y,
      title: "New " + (t?.label || "node"), preview: "",
    });
    if (row) setSelectedId(row.id);
  };

  // ---- Drop a LIVE ENTITY from the tray ----------------------------
  const onEntityDrop = async (ent, e) => {
    const p = canvasPoint(e);
    const row = await B()?.TangleService?.addEntityNode(live.activeBoardId, ent, p);
    if (row) setSelectedId(row.id);
  };

  // Live entity tray rows (search across the main types).
  const trayEntities = _tn_um(() => {
    const Bk = window.LoomwrightBackend;
    if (!Bk?.EntityService) return [];
    const q = traySearch.trim().toLowerCase();
    const out = [];
    for (const type of ["cast", "locations", "items", "quests", "events", "lore", "factions"]) {
      for (const ent of Bk.EntityService.listSync(type)) {
        if (!ent || ent.status === "deleted") continue;
        if (q && !String(ent.name || "").toLowerCase().includes(q)) continue;
        out.push(ent);
        if (out.length >= 24) return out;
      }
    }
    return out;
  }, [traySearch, live.nodes.length]);

  // Group the selected node + its direct connections into a cluster.
  const groupSelection = async () => {
    if (!selected) { _tnNotice("Select a node to group its cluster."); return; }
    const linked = new Set([selected.id]);
    for (const e of edges) {
      if (e.from === selected.id) linked.add(e.to);
      if (e.to === selected.id) linked.add(e.from);
    }
    await B()?.TangleService?.addGroup({
      boardId: live.activeBoardId,
      title: selected.title + " cluster",
      nodeIds: [...linked],
    });
    _tnNotice("Cluster pinned (" + linked.size + " nodes).");
  };

  // Search: select + centre the first title match.
  const onSearch = (q) => {
    const hit = nodes.find((n) => String(n.title || "").toLowerCase().includes(q.toLowerCase()));
    if (!hit) { _tnNotice("No card matches “" + q + "”."); return; }
    setSelectedId(hit.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setPan({ x: rect.width / 2 - (hit.x + 80) * scale, y: rect.height / 2 - (hit.y + 30) * scale });
  };

  // Grouped node ids (for the clusters layer).
  const groupedIds = _tn_um(() => new Set(live.groups.flatMap((g) => g.nodeIds || [])), [live.groups]);

  // Visible nodes after filter + layer.
  const visibleNodes = nodes.filter((n) => {
    if (filterKind !== "all" && n.kind !== filterKind) return false;
    if (layer === "clusters" && !groupedIds.has(n.id)) return false;
    if (layer === "sketch" && n.entityId) return false; // sketch = freeform cards only
    return true;
  });

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));

  // Edge endpoints in canvas-space
  const edgePath = (e) => {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    if (!a || !b) return null;
    const ax = a.x + 80, ay = a.y + 30;
    const bx = b.x + 80, by = b.y + 30;
    const mx = (ax + bx) / 2;
    return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
  };

  // Mini-map: render down-scaled
  const mmExtent = _tn_um(() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 700 };
    const xs = nodes.map((n) => n.x); const ys = nodes.map((n) => n.y);
    return { minX: Math.min(...xs) - 80, minY: Math.min(...ys) - 60, maxX: Math.max(...xs) + 160, maxY: Math.max(...ys) + 80 };
  }, [nodes]);

  const openRelated = () => {
    if (!selected) return;
    if (selected.entityId && !selected.unlinked) {
      _tnDispatch("lw:open-search-result", { type: "entity", entityId: selected.entityId, entityType: selected.entityType });
    } else {
      _tnNotice("This card isn't bound to an entity — drag one in from the tray.");
    }
  };

  return (
    <div className="tan-fs" data-ui="TangleFullScreen" role="dialog" aria-label="Tangle canvas">
      <button className="rpg-btn rpg-btn--small tan-fs__close" data-callback="onCloseTangleCanvas" onClick={onClose}>Close ✕</button>

      {/* Tray */}
      <aside className="tan-fs__tray">
        <div className="tan-fs__tray-head">Entity tray</div>
        <div className="tan-fs__tray-section">
          <h4>Your entities — drag onto canvas</h4>
          <input className="loc-body__filter" style={{ width: "100%", marginBottom: 6 }}
                 placeholder="Search entities…" value={traySearch}
                 onChange={(e) => setTraySearch(e.target.value)}/>
          <div className="tan-fs__tray-entities">
            {trayEntities.map((ent) => {
              const t = _tnType(ent.type);
              return (
                <div key={ent.id} className="tan-fs__tray-tile" data-testid={"tan-tray-" + ent.id}
                     draggable
                     onDragEnd={(e) => onEntityDrop(ent, e)}
                     title={"Drag " + (ent.name || "entity") + " onto the board"}>
                  <span style={{ color: t.color, fontFamily: "var(--font-display)" }}>{t.glyph}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ent.name}</span>
                </div>
              );
            })}
            {trayEntities.length === 0 && (
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-sm)", color: "var(--ink-4)" }}>
                No entities yet — cards below still work.
              </div>
            )}
          </div>
        </div>
        <div className="tan-fs__tray-section">
          <h4>Blank cards</h4>
          {TANGLE_NODE_TYPES.filter((t) => ["note", "quote", "image", "custom"].includes(t.id)).map((t) => (
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
            {[["all", "All layers"], ["sketch", "Sketch (free cards)"], ["clusters", "Named clusters"]].map(([k, l]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)" }}>
                <input type="radio" name="tan-layer" checked={layer === k} onChange={() => setLayer(k)}/>
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="tan-fs__tray-section">
          <h4>Quick add</h4>
          <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onCreateTangleNode" data-testid="tan-quick-note"
                  style={{ width: "100%" }}
                  onClick={async () => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    const p = rect
                      ? { x: (rect.width / 2 - pan.x) / scale - 80, y: (rect.height / 2 - pan.y) / scale - 30 }
                      : { x: 200, y: 200 };
                    const row = await B()?.TangleService?.addNode({ boardId: live.activeBoardId, kind: "note", title: "New note", x: p.x, y: p.y });
                    if (row) setSelectedId(row.id);
                  }}>
            + New note
          </button>
          <button className="rpg-btn rpg-btn--small" data-callback="onCreateTangleGroup"
                  style={{ width: "100%", marginTop: 4 }}
                  onClick={groupSelection}>
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
          <button className="tan-fs__tb-btn" data-callback="onCreateTangleNode"
                  onClick={async () => {
                    const row = await B()?.TangleService?.addNode({ boardId: live.activeBoardId, kind: "note", title: "New note", x: (200 - pan.x) / scale, y: (160 - pan.y) / scale });
                    if (row) setSelectedId(row.id);
                  }}>+ Note</button>
          <button className="tan-fs__tb-btn" data-callback="onConnectTangleNodes"
                  onClick={() => _tnNotice("Drag from a card's side handle onto another card to connect them.")}>Connect</button>
          <button className="tan-fs__tb-btn" data-callback="onCreateTangleGroup" onClick={groupSelection}>Group</button>
          <button className="tan-fs__tb-btn" data-callback="onCreateQuestFromTangle"
                  onClick={() => selected
                    ? _tnDispatch("lw:open-entity-editor", { type: "quests", initial: { name: selected.title, summary: selected.preview }, mode: "full" })
                    : _tnNotice("Select a card to seed the quest.")}>→ Quest</button>
          <button className="tan-fs__tb-btn" data-callback="onCreateEventFromTangle"
                  onClick={() => selected
                    ? _tnDispatch("lw:open-entity-editor", { type: "events", initial: { name: selected.title, summary: selected.preview }, mode: "full" })
                    : _tnNotice("Select a card to seed the event.")}>→ Event</button>
          <button className="tan-fs__tb-btn" data-callback="onSendTangleItemToWriter"
                  onClick={() => selected
                    ? _tnDispatch("lw:dispatch-callback", { name: "onSendTangleItemToWriter", detail: { text: selected.title + (selected.preview ? "\n\n" + selected.preview : "") } })
                    : _tnNotice("Select a card to send.")}>→ Writer's Room</button>
          <button className="tan-fs__tb-btn" data-callback="onTangleSearch"
                  onClick={() => setSearchOpen((v) => !v)}>Search</button>
          {searchOpen && (
            <input autoFocus className="tan-fs__tb-search" placeholder="Find a card… ⏎"
                   onKeyDown={(e) => { if (e.key === "Enter") { onSearch(e.target.value); setSearchOpen(false); } if (e.key === "Escape") setSearchOpen(false); }}/>
          )}
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
              <g key={e.id} className={"tan-edge" + (e.id === selectedEdgeId ? " is-selected" : "")}
                 onMouseDown={(ev) => { ev.stopPropagation(); setSelectedEdgeId(e.id); setSelectedId(null); }}
                 style={{ cursor: "pointer" }}>
                <path d={edgePath(e)} fill="none" stroke="transparent" strokeWidth="14"/>
                <path d={edgePath(e)} fill="none"
                      stroke={e.id === selectedEdgeId ? "var(--accent)" : "var(--ink-3)"}
                      strokeWidth={e.id === selectedEdgeId ? 2.5 : 1.5}
                      markerEnd={e.directed === false ? undefined : "url(#tan-arrow)"}/>
                {(e.label || e.id === selectedEdgeId) && (() => {
                  const a = nodes.find((n) => n.id === e.from);
                  const b = nodes.find((n) => n.id === e.to);
                  if (!a || !b) return null;
                  const mx = (a.x + b.x) / 2 + 80;
                  const my = (a.y + b.y) / 2 + 20;
                  return (
                    <text x={mx} y={my} fontSize="11" fontFamily="var(--font-serif)" fontStyle="italic"
                          fill={e.id === selectedEdgeId ? "var(--accent)" : "var(--ink-3)"} textAnchor="middle">
                      {e.label || "…"}
                    </text>
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
                onSelect={(id) => { setSelectedId(id); setSelectedEdgeId(null); }}
                onDrag={onDragNode}
                onDragEnd={onDragNodeEnd}
                onStartConnect={onStartConnect}
                scale={scale}
              />
            </div>
          ))}

          {/* Designed empty hint */}
          {nodes.length === 0 && (
            <div className="tan-fs__empty" data-ui="TangleCanvasEmpty">
              An empty corkboard. Drag an entity or a blank card in from the tray — or Quick-add a note.
            </div>
          )}
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
              const t = _tnType(n.kind);
              return <circle key={n.id} cx={n.x + 80} cy={n.y + 30} r={16} fill={t.color} stroke="var(--bg-paper)" strokeWidth={3}/>;
            })}
          </svg>
        </div>
      </div>

      {/* Inspector */}
      <aside className="tan-fs__inspect">
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)" }}>Inspector</div>
          {selected ? (
            <input
              className="tan-fs__title-edit"
              key={selected.id + ":" + selected.title}
              defaultValue={selected.title}
              aria-label="Card title"
              data-testid="tan-title-edit"
              onBlur={(e) => {
                const title = (e.target.value || "").trim();
                if (title && title !== selected.title) B()?.TangleService?.updateNode(selected.id, { title });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}/>
          ) : selectedEdge ? (
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", color: "var(--ink-1)", lineHeight: 1.1, marginTop: 2 }}>
              Thread
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", color: "var(--ink-1)", lineHeight: 1.1, marginTop: 2 }}>—</div>
          )}
          {selected && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
              {_tnType(selected.kind).label}
              {selected.cite && <span> · {selected.cite}</span>}
              {selected.unlinked && <span> · unlinked</span>}
            </div>
          )}
        </div>

        {selectedEdge && (() => {
          const a = nodes.find((n) => n.id === selectedEdge.from);
          const b = nodes.find((n) => n.id === selectedEdge.to);
          return (
            <div data-ui="TangleEdgeInspector">
              <div className="aiw__section-title">Thread</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-2)", marginBottom: 6 }}>
                {a?.title || "?"} {selectedEdge.directed === false ? "↔" : "→"} {b?.title || "?"}
              </div>
              <input
                className="loc-body__filter" style={{ width: "100%" }}
                key={selectedEdge.id + ":" + (selectedEdge.label || "")}
                defaultValue={selectedEdge.label || ""}
                placeholder="Label this thread… (cause, secret, echoes)"
                data-testid="tan-edge-label"
                onBlur={(e) => B()?.TangleService?.updateEdge(selectedEdge.id, { label: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}/>
              <div className="rpg-actions" style={{ marginTop: 8 }}>
                <button className="rpg-btn rpg-btn--small" data-testid="tan-edge-direction"
                        onClick={() => B()?.TangleService?.updateEdge(selectedEdge.id, { directed: selectedEdge.directed === false })}>
                  {selectedEdge.directed === false ? "Make directed →" : "Make mutual ↔"}
                </button>
                <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDisconnectTangleNodes"
                        onClick={() => { B()?.TangleService?.removeEdge(selectedEdge.id); setSelectedEdgeId(null); }}>
                  Remove thread
                </button>
              </div>
            </div>
          );
        })()}

        {selected ? (
          <>
            <div>
              <div className="aiw__section-title">Note</div>
              <textarea
                className="aiw__textarea"
                key={selected.id}
                defaultValue={selected.preview || ""}
                data-callback="onEditTangleNode"
                onBlur={(e) => B()?.TangleService?.updateNode(selected.id, { preview: e.target.value })}
                placeholder="Write a note for this card…"
              />
            </div>
            <div>
              <div className="aiw__section-title">Threads</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {edges.filter((e) => e.from === selected.id || e.to === selected.id).map((e) => {
                  const other = nodes.find((n) => n.id === (e.from === selected.id ? e.to : e.from));
                  if (!other) return null;
                  return (
                    <li key={e.id} style={{
                      padding: "5px 8px", background: "var(--bg-paper)", border: "1px solid var(--line-2)",
                      borderRadius: "var(--r-2)", fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)",
                      display: "flex", gap: 6, alignItems: "center", cursor: "pointer",
                    }} onClick={() => { setSelectedEdgeId(e.id); setSelectedId(null); }}>
                      <span style={{ fontStyle: "italic", color: "var(--ink-3)" }}>{e.directed === false ? "↔" : (e.from === selected.id ? "→" : "←")}</span>
                      <span style={{ flex: 1 }}>{other.title}</span>
                      {e.label && <span style={{ fontStyle: "italic", color: "var(--ink-4)", fontSize: "var(--fs-2xs)" }}>{e.label}</span>}
                      <button
                        className="stat-rule-row__icon"
                        data-callback="onDisconnectTangleNodes"
                        onClick={(ev) => { ev.stopPropagation(); B()?.TangleService?.removeEdge(e.id); }}
                      >✕</button>
                    </li>
                  );
                })}
                {edges.filter((e) => e.from === selected.id || e.to === selected.id).length === 0 && (
                  <li style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-4)", fontSize: "var(--fs-sm)" }}>
                    No threads yet. Drag from a handle to connect.
                  </li>
                )}
              </ul>
            </div>
            <div className="rpg-actions" style={{ marginTop: 0 }}>
              <button className="rpg-btn rpg-btn--small" data-callback="onSendTangleItemToWriter"
                      onClick={() => _tnDispatch("lw:dispatch-callback", { name: "onSendTangleItemToWriter", detail: { text: selected.title + (selected.preview ? "\n\n" + selected.preview : "") } })}>Send to Writer</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onCreateQuestFromTangle"
                      onClick={() => _tnDispatch("lw:open-entity-editor", { type: "quests", initial: { name: selected.title, summary: selected.preview }, mode: "full" })}>→ Quest</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onCreateEventFromTangle"
                      onClick={() => _tnDispatch("lw:open-entity-editor", { type: "events", initial: { name: selected.title, summary: selected.preview }, mode: "full" })}>→ Event</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onOpenRelatedTab" onClick={openRelated}>Open related</button>
              <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDeleteTangleNodeRequest"
                      onClick={async () => { await B()?.TangleService?.removeNode(selected.id); setSelectedId(null); }}>
                Delete
              </button>
            </div>
          </>
        ) : !selectedEdge && (
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-4)", fontSize: "var(--fs-sm)" }}>
            Pick a node, or drag one onto the canvas from the tray.
          </div>
        )}

        <div style={{ marginTop: "auto", fontFamily: "var(--font-sans)", fontSize: "var(--fs-3xs)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {nodes.length} nodes · {edges.length} threads · zoom {Math.round(scale * 100)}%
        </div>
      </aside>
    </div>
  );
};

window.TANGLE_NODE_TYPES = TANGLE_NODE_TYPES;
Object.assign(window, { TanglePanelBody, TangleFullScreen, TangleNode, TanglePreviewMini, useTangleState });
