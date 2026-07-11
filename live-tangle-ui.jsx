// =====================================================================
// live-tangle-ui.jsx — persistent canonical Tangle workspace.
// =====================================================================

(function () {
  const service = window.LoomwrightBackend?.LiveTangleService;
  if (!service || window.__LW_LIVE_TANGLE_UI__) return;
  window.__LW_LIVE_TANGLE_UI__ = true;

  const { useState, useEffect, useMemo, useCallback } = React;

  const TYPE_META = {
    cast: { glyph: "◐", color: "#765f96" }, locations: { glyph: "▲", color: "#607a4b" },
    items: { glyph: "✧", color: "#a67c35" }, quests: { glyph: "✦", color: "#8a4353" },
    events: { glyph: "◈", color: "#b87d37" }, relationships: { glyph: "↔", color: "#78618c" },
    lore: { glyph: "◉", color: "#725840" }, factions: { glyph: "⚑", color: "#55734e" },
    bestiary: { glyph: "◆", color: "#884f58" }, skills: { glyph: "⌁", color: "#4f7188" },
    classes: { glyph: "◇", color: "#5b5d87" }, races: { glyph: "◒", color: "#7b664c" },
    stats: { glyph: "#", color: "#4c7480" }, references: { glyph: "▤", color: "#75684e" },
    note: { glyph: "✎", color: "#97763a" }, quote: { glyph: "❝", color: "#a15c45" },
    image: { glyph: "▢", color: "#577792" }, frame: { glyph: "▣", color: "#6c665d" },
  };

  function metaFor(node) {
    return TYPE_META[node.entityType || node.kind] || TYPE_META.note;
  }

  function useWorkspace(boardId, query) {
    const [workspace, setWorkspace] = useState(() => service.buildWorkspace({ boardId, query }));
    const refresh = useCallback(() => setWorkspace(service.buildWorkspace({ boardId, query })), [boardId, query]);
    useEffect(() => {
      refresh();
      const events = ["lw:live-tangle-updated", "lw:entity-store-updated", "lw:project-imported", "lw:backend-ready"];
      events.forEach((event) => window.addEventListener(event, refresh));
      return () => events.forEach((event) => window.removeEventListener(event, refresh));
    }, [refresh]);
    return [workspace, refresh];
  }

  function BoardDialog({ workspace, onClose, onCreated }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const create = async () => {
      if (!name.trim()) return;
      const board = await service.createBoard({ name: name.trim(), description });
      onCreated(board.id);
    };
    return (
      <div className="lt-modal" role="dialog" aria-modal="true" data-testid="live-tangle-board-dialog">
        <div className="lt-modal__card">
          <header><div><span>Planning surface</span><h2>Create Tangle board</h2></div><button type="button" onClick={onClose}>×</button></header>
          <label>Board name<input data-testid="live-tangle-board-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus/></label>
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="4"/></label>
          <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="is-primary" data-testid="live-tangle-board-create" onClick={create}>Create board</button></footer>
        </div>
      </div>
    );
  }

  function GroupDialog({ selectedIds, onClose, onCreated }) {
    const [name, setName] = useState("");
    const create = async () => {
      if (!name.trim() || !selectedIds.length) return;
      const group = await service.createGroup({ name: name.trim(), nodeIds: selectedIds });
      onCreated(group.id);
    };
    return (
      <div className="lt-modal" role="dialog" aria-modal="true" data-testid="live-tangle-group-dialog">
        <div className="lt-modal__card">
          <header><div><span>{selectedIds.length} selected nodes</span><h2>Create group</h2></div><button type="button" onClick={onClose}>×</button></header>
          <label>Group name<input data-testid="live-tangle-group-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus/></label>
          <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="is-primary" data-testid="live-tangle-group-create" onClick={create}>Group nodes</button></footer>
        </div>
      </div>
    );
  }

  function TangleNodeCard({ node, selected, hidden, connectFrom, onSelect, onMoved }) {
    const meta = metaFor(node);
    if (hidden) return null;
    const beginDrag = (event) => {
      if (event.button !== 0 || event.target.closest("button,input,textarea,select")) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(node.id, event.shiftKey);
      const target = event.currentTarget;
      const startX = event.clientX;
      const startY = event.clientY;
      const originalX = node.x;
      const originalY = node.y;
      let nextX = originalX;
      let nextY = originalY;
      const move = (moveEvent) => {
        nextX = originalX + moveEvent.clientX - startX;
        nextY = originalY + moveEvent.clientY - startY;
        target.style.left = `${nextX}px`;
        target.style.top = `${nextY}px`;
      };
      const up = async () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        if (nextX !== originalX || nextY !== originalY) await onMoved(node.id, nextX, nextY);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
    return (
      <article
        className={`lt-node ${node.entityId ? "is-entity" : "is-note"} ${selected ? "is-selected" : ""} ${node.missingEntity ? "is-missing" : ""} ${connectFrom === node.id ? "is-connecting" : ""}`}
        style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height, "--node-color": node.color || meta.color }}
        data-testid={`live-tangle-node-${node.id}`}
        onMouseDown={beginDrag}
        onClick={(event) => { event.stopPropagation(); onSelect(node.id, event.shiftKey); }}
      >
        <header><span className="lt-node__glyph">{meta.glyph}</span><span>{node.entityId ? node.entityType : node.kind}</span>{node.groupId ? <span className="lt-node__group">grouped</span> : null}</header>
        <h3>{node.title}</h3>
        {node.body ? <p>{node.body}</p> : null}
        {node.quote ? <blockquote>“{node.quote}”</blockquote> : null}
        {node.missingEntity ? <div className="lt-node__warning">Linked entity was deleted</div> : null}
        {node.entityId ? <div className="lt-node__live">Live canonical node</div> : null}
      </article>
    );
  }

  function EdgeLayer({ nodes, edges, hiddenNodeIds }) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return (
      <svg className="lt-edges" width="2200" height="1400" viewBox="0 0 2200 1400" aria-label="Tangle connections">
        {edges.map((edge) => {
          if (hiddenNodeIds.has(edge.from) || hiddenNodeIds.has(edge.to)) return null;
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + from.width / 2;
          const y1 = from.y + from.height / 2;
          const x2 = to.x + to.width / 2;
          const y2 = to.y + to.height / 2;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={edge.id} data-testid={`live-tangle-edge-${edge.id}`}>
              <path d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} className="lt-edge"/>
              {edge.label ? <text x={midX} y={midY - 5} className="lt-edge__label">{edge.label}</text> : null}
            </g>
          );
        })}
      </svg>
    );
  }

  function GroupLayer({ groups, nodes, onToggle }) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return groups.map((group) => {
      const members = (group.nodeIds || []).map((id) => byId.get(id)).filter(Boolean);
      if (!members.length) return null;
      const minX = Math.min(...members.map((node) => node.x)) - 28;
      const minY = Math.min(...members.map((node) => node.y)) - 42;
      const maxX = Math.max(...members.map((node) => node.x + node.width)) + 28;
      const maxY = Math.max(...members.map((node) => node.y + node.height)) + 28;
      return (
        <section key={group.id} className={`lt-group ${group.collapsed ? "is-collapsed" : ""}`} style={{ left: minX, top: minY, width: maxX - minX, height: group.collapsed ? 58 : maxY - minY }} data-testid={`live-tangle-group-${group.id}`}>
          <header><b>{group.name}</b><span>{members.length} nodes</span><button type="button" onClick={(event) => { event.stopPropagation(); onToggle(group); }}>{group.collapsed ? "Expand" : "Collapse"}</button></header>
          {!group.collapsed && group.description ? <p>{group.description}</p> : null}
        </section>
      );
    });
  }

  function NodeInspector({ node, groups, onSaved, onDeleted, onPromoted, onOpenDossier }) {
    const [title, setTitle] = useState(node?.title || "");
    const [body, setBody] = useState(node?.body || "");
    const [groupId, setGroupId] = useState(node?.groupId || "");
    const [promoteType, setPromoteType] = useState("lore");
    useEffect(() => {
      setTitle(node?.title || "");
      setBody(node?.body || "");
      setGroupId(node?.groupId || "");
    }, [node?.id, node?.title, node?.body, node?.groupId]);
    if (!node) return <p className="lt-muted">Select a node to edit, group, promote or open its canonical dossier.</p>;
    const save = async () => {
      await service.updateNode(node.id, { title, body, groupId: groupId || null });
      onSaved();
    };
    return (
      <div className="lt-inspector" data-testid={`live-tangle-inspector-${node.id}`}>
        <div className="lt-badges"><span>{node.entityId ? "canonical" : node.kind}</span>{node.entityType ? <span>{node.entityType}</span> : null}{node.missingEntity ? <span className="is-warn">missing link</span> : null}</div>
        {node.entityId ? (
          <>
            <h3>{node.title}</h3>
            <p>{node.body || "No canonical summary yet."}</p>
            <button type="button" onClick={() => onOpenDossier(node)}>Open live dossier</button>
          </>
        ) : (
          <>
            <label>Title<input data-testid="live-tangle-inspector-title" value={title} onChange={(event) => setTitle(event.target.value)}/></label>
            <label>Body<textarea data-testid="live-tangle-inspector-body" value={body} onChange={(event) => setBody(event.target.value)} rows="7"/></label>
          </>
        )}
        <label>Group<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        {!node.entityId ? (
          <div className="lt-promote"><label>Promote as<select data-testid="live-tangle-promote-type" value={promoteType} onChange={(event) => setPromoteType(event.target.value)}>{service.entityTypes.filter((type) => type !== "references").map((type) => <option key={type} value={type}>{type}</option>)}</select></label><button type="button" data-testid="live-tangle-promote" onClick={async () => { await service.promoteNode(node.id, promoteType, { name: title, summary: body }); onPromoted(); }}>Create canonical entity</button></div>
        ) : null}
        <div className="lt-inspector__actions">{!node.entityId ? <button type="button" data-testid="live-tangle-inspector-save" onClick={save}>Save note</button> : <button type="button" onClick={save}>Save group</button>}<button type="button" data-testid="live-tangle-delete-node" onClick={() => onDeleted(node.id)}>Delete node</button></div>
      </div>
    );
  }

  function LiveTangleWorkspace() {
    const initial = service.loadStateSync();
    const [boardId, setBoardId] = useState(initial.activeBoardId);
    const [query, setQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [connectFrom, setConnectFrom] = useState(null);
    const [connectionLabel, setConnectionLabel] = useState("");
    const [fullScreen, setFullScreen] = useState(false);
    const [boardDialog, setBoardDialog] = useState(false);
    const [groupDialog, setGroupDialog] = useState(false);
    const [workspace, refresh] = useWorkspace(boardId, query);

    useEffect(() => {
      if (!workspace.boards.some((board) => board.id === boardId)) setBoardId(workspace.board.id);
    }, [workspace.boards, workspace.board.id, boardId]);
    useEffect(() => {
      const open = (event) => {
        const detail = event?.detail || {};
        if (detail.workspaceId === "tangle-canvas" || detail.panelKind === "tangle") setFullScreen(true);
      };
      window.addEventListener("lw:open-panel-workspace", open);
      return () => window.removeEventListener("lw:open-panel-workspace", open);
    }, []);

    const selectedNode = workspace.nodes.find((node) => node.id === selectedIds[0]) || null;
    const collapsedNodeIds = useMemo(() => new Set(workspace.groups.filter((group) => group.collapsed).flatMap((group) => group.nodeIds || [])), [workspace.groups]);
    const selectNode = async (nodeId, additive = false) => {
      if (connectFrom && connectFrom !== nodeId) {
        await service.connectNodes(connectFrom, nodeId, { label: connectionLabel.trim() });
        setConnectFrom(null);
        setConnectionLabel("");
        setSelectedIds([nodeId]);
        refresh();
        return;
      }
      setSelectedIds((current) => additive ? (current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId]) : [nodeId]);
    };
    const addNote = async (kind = "note") => {
      const node = await service.addNode({ boardId: workspace.board.id, kind, title: kind === "quote" ? "New quotation" : "New note", body: "" });
      setSelectedIds([node.id]);
      refresh();
    };
    const addEntity = async (row) => {
      const node = await service.addEntityNode(row.type, row.id, { boardId: workspace.board.id });
      setSelectedIds([node.id]);
      refresh();
    };
    const deleteNode = async (nodeId) => {
      await service.deleteNode(nodeId);
      setSelectedIds((ids) => ids.filter((id) => id !== nodeId));
      refresh();
    };
    const changeBoard = async (id) => {
      await service.setActiveBoard(id);
      setBoardId(id);
      setSelectedIds([]);
      setConnectFrom(null);
    };
    const openDossier = (node) => window.dispatchEvent(new CustomEvent("lw:open-entity-dossier", { detail: { id: node.entityId, type: node.entityType } }));
    const createEntity = () => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "generic", mode: "full", sourcePanel: "p-tangle" } }));

    const content = (
      <div className={`live-tangle ${fullScreen ? "is-fullscreen" : ""}`} data-ui="LiveTangleWorkspace" data-testid="live-tangle-workspace">
        <header className="lt-header">
          <div><span className="lt-eyebrow">Persistent story planning</span><h1>{workspace.board.name}</h1><p>{workspace.board.description || "Freeform notes and live canonical entities on one board."}</p></div>
          <div className="lt-header__actions"><button type="button" onClick={() => setBoardDialog(true)}>New board</button><button type="button" data-testid="live-tangle-fullscreen" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? "Exit workspace" : "Open workspace"}</button></div>
        </header>

        <div className="lt-toolbar" role="toolbar" aria-label="Tangle board controls">
          <label>Board<select data-testid="live-tangle-board-select" value={workspace.board.id} onChange={(event) => changeBoard(event.target.value)}>{workspace.boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label>
          <button type="button" data-testid="live-tangle-new-note" onClick={() => addNote("note")}>New note</button>
          <button type="button" onClick={() => addNote("quote")}>New quote</button>
          <button type="button" data-testid="live-tangle-auto-layout" onClick={async () => { await service.autoLayout(workspace.board.id); refresh(); }}>Auto-layout</button>
          <button type="button" data-testid="live-tangle-group-selected" disabled={selectedIds.length < 2} onClick={() => setGroupDialog(true)}>Group selected ({selectedIds.length})</button>
          <button type="button" data-testid="live-tangle-connect" disabled={selectedIds.length !== 1} onClick={() => setConnectFrom(selectedIds[0])}>{connectFrom ? "Choose target…" : "Connect selected"}</button>
          {connectFrom ? <input className="lt-connection-label" value={connectionLabel} onChange={(event) => setConnectionLabel(event.target.value)} placeholder="Connection label" aria-label="Connection label"/> : null}
        </div>

        <div className="lt-summary" data-testid="live-tangle-summary"><span><b>{workspace.summary.boardCount}</b> boards</span><span><b>{workspace.summary.nodeCount}</b> nodes</span><span><b>{workspace.summary.entityNodeCount}</b> live entities</span><span><b>{workspace.summary.noteCount}</b> planning notes</span><span><b>{workspace.summary.edgeCount}</b> links</span><span><b>{workspace.summary.groupCount}</b> groups</span>{workspace.summary.missingEntityCount ? <span className="is-warn"><b>{workspace.summary.missingEntityCount}</b> missing links</span> : null}</div>

        <div className="lt-layout">
          <aside className="lt-rail lt-rail--left">
            <section><div className="lt-section-head"><div><span>Canonical entity tray</span><h2>Add live nodes</h2></div><button type="button" onClick={createEntity}>+</button></div><input className="lt-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities…" aria-label="Search Tangle entities"/><div className="lt-tray" data-testid="live-tangle-entity-tray">{workspace.tray.length ? workspace.tray.map((row) => { const meta = TYPE_META[row.type] || TYPE_META.note; return <button type="button" key={`${row.type}-${row.id}`} disabled={row.onBoard} onClick={() => addEntity(row)} data-testid={`live-tangle-tray-${row.id}`}><span style={{ "--tray-color": meta.color }}>{meta.glyph}</span><span><b>{row.name}</b><small>{row.type}{row.onBoard ? " · on board" : ""}</small></span></button>; }) : <p className="lt-muted">No canonical entities match this search.</p>}</div></section>
            <section><div className="lt-section-head"><div><span>Groups</span><h2>Board structure</h2></div></div>{workspace.groups.length ? workspace.groups.map((group) => <button type="button" key={group.id} className="lt-group-row" onClick={async () => { await service.updateGroup(group.id, { collapsed: !group.collapsed }); refresh(); }}><b>{group.name}</b><span>{group.nodeIds.length} nodes · {group.collapsed ? "collapsed" : "open"}</span></button>) : <p className="lt-muted">Shift-select two or more nodes to create a collapsible group.</p>}</section>
          </aside>

          <main className="lt-canvas-wrap">
            <div className="lt-canvas" data-testid="live-tangle-canvas" onClick={() => { setSelectedIds([]); setConnectFrom(null); }}>
              <div className="lt-canvas__grid"/>
              <GroupLayer groups={workspace.groups} nodes={workspace.nodes} onToggle={async (group) => { await service.updateGroup(group.id, { collapsed: !group.collapsed }); refresh(); }}/>
              <EdgeLayer nodes={workspace.nodes} edges={workspace.edges} hiddenNodeIds={collapsedNodeIds}/>
              {workspace.nodes.map((node) => <TangleNodeCard key={node.id} node={node} selected={selectedIds.includes(node.id)} hidden={collapsedNodeIds.has(node.id)} connectFrom={connectFrom} onSelect={selectNode} onMoved={async (id, x, y) => { await service.moveNode(id, x, y); refresh(); }}/>) }
              {!workspace.nodes.length ? <div className="lt-empty" data-testid="live-tangle-empty"><div>⌘</div><h2>Blank board</h2><p>Add a live entity from the tray or create a freeform note. No sample plot is inserted.</p><button type="button" onClick={() => addNote("note")}>Create first note</button></div> : null}
            </div>
          </main>

          <aside className="lt-rail lt-rail--right"><section><div className="lt-section-head"><div><span>Node inspector</span><h2>{selectedNode ? selectedNode.title : "Nothing selected"}</h2></div></div><NodeInspector node={selectedNode} groups={workspace.groups} onSaved={refresh} onDeleted={deleteNode} onPromoted={refresh} onOpenDossier={openDossier}/></section><section><div className="lt-section-head"><div><span>Board notes</span><h2>Recent planning</h2></div></div>{workspace.nodes.filter((node) => !node.entityId).slice(-6).reverse().map((node) => <button type="button" className="lt-recent" key={node.id} onClick={() => setSelectedIds([node.id])}><b>{node.title}</b><span>{node.body || "Empty note"}</span></button>)}</section></aside>
        </div>

        {boardDialog ? <BoardDialog workspace={workspace} onClose={() => setBoardDialog(false)} onCreated={(id) => { setBoardDialog(false); setBoardId(id); refresh(); }}/> : null}
        {groupDialog ? <GroupDialog selectedIds={selectedIds} onClose={() => setGroupDialog(false)} onCreated={() => { setGroupDialog(false); refresh(); }}/> : null}
      </div>
    );
    return fullScreen ? ReactDOM.createPortal(content, document.body) : content;
  }

  function mountHost(host) {
    if (!host || host.dataset.liveTangleMounted) return;
    host.dataset.liveTangleMounted = "true";
    Array.from(host.children).forEach((child) => { child.hidden = true; child.setAttribute("aria-hidden", "true"); child.dataset.liveTangleLegacy = "true"; });
    const mount = document.createElement("div");
    mount.className = "live-tangle-mount";
    mount.setAttribute("data-ui", "LiveTangleMount");
    host.appendChild(mount);
    ReactDOM.createRoot(mount).render(<LiveTangleWorkspace/>);
  }

  function bindAll(root = document) {
    const hosts = [];
    if (root.matches?.("[data-ui='TanglePanelBody'], .tan-side")) hosts.push(root);
    root.querySelectorAll?.("[data-ui='TanglePanelBody'], .tan-side").forEach((host) => hosts.push(host));
    document.querySelectorAll("[data-ui='TanglePanelBody'], .tan-side").forEach((host) => hosts.push(host));
    [...new Set(hosts)].forEach(mountHost);
  }

  const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes?.forEach((node) => { if (node.nodeType === 1) bindAll(node); })));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("lw:open-panel", () => setTimeout(() => bindAll(document), 0));
  window.addEventListener("lw:backend-ready", () => setTimeout(() => bindAll(document), 0));
  bindAll(document);
})();
