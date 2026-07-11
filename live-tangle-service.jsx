// =====================================================================
// live-tangle-service.jsx — persistent multi-board planning over canonical
// Loomwright entities. Uses the existing tangle_canvas archive key so older
// exports remain readable and future exports include the live board state.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend || backend.LiveTangleService) return;

  const STORAGE_KEY = backend.StorageService?.keys?.tangle || "tangle_canvas";
  const VERSION = 2;
  const DEFAULT_BOARD_ID = "tangle-board-main";
  const ENTITY_TYPES = ["cast", "locations", "items", "quests", "events", "relationships", "lore", "factions", "bestiary", "skills", "classes", "races", "stats", "references"];

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const nowIso = () => new Date().toISOString();
  const uuid = (prefix = "tangle") => prefix + "-" + (window.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  const uniq = (rows) => [...new Set((rows || []).filter(Boolean))];

  function defaultBoard() {
    return {
      id: DEFAULT_BOARD_ID,
      name: "Story board",
      description: "",
      pinned: true,
      layout: "freeform",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  function defaultState() {
    return {
      version: VERSION,
      activeBoardId: DEFAULT_BOARD_ID,
      boards: [defaultBoard()],
      nodes: [],
      edges: [],
      groups: [],
      views: { [DEFAULT_BOARD_ID]: { x: 0, y: 0, zoom: 1 } },
      updatedAt: null,
    };
  }

  function normaliseBoard(board, index) {
    return {
      ...clone(board || {}),
      id: board?.id || uuid("tangle-board"),
      name: board?.name || `Board ${index + 1}`,
      description: board?.description || "",
      pinned: !!board?.pinned,
      layout: board?.layout || "freeform",
      createdAt: board?.createdAt || nowIso(),
      updatedAt: board?.updatedAt || nowIso(),
    };
  }

  function normaliseState(raw) {
    const fallback = defaultState();
    const legacyNodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
    let boards = Array.isArray(raw?.boards) && raw.boards.length
      ? raw.boards.map(normaliseBoard)
      : fallback.boards;
    const boardIds = new Set(boards.map((board) => board.id));
    const activeBoardId = boardIds.has(raw?.activeBoardId)
      ? raw.activeBoardId
      : (boards.find((board) => board.active)?.id || boards[0].id);
    const nodeBoard = (node) => boardIds.has(node?.boardId) ? node.boardId : activeBoardId;
    const nodes = legacyNodes.map((node, index) => ({
      ...clone(node),
      id: node.id || uuid("tangle-node"),
      boardId: nodeBoard(node),
      kind: node.kind || (node.entityId ? "entity" : "note"),
      entityType: node.entityType || (ENTITY_TYPES.includes(node.kind) ? node.kind : null),
      entityId: node.entityId || null,
      title: node.title || node.name || `Node ${index + 1}`,
      body: node.body ?? node.preview ?? "",
      quote: node.quote || "",
      sourceRef: node.sourceRef || null,
      x: Number.isFinite(Number(node.x)) ? Number(node.x) : 120 + index * 32,
      y: Number.isFinite(Number(node.y)) ? Number(node.y) : 120 + index * 24,
      width: Number(node.width) || 220,
      height: Number(node.height) || 140,
      groupId: node.groupId || null,
      createdAt: node.createdAt || nowIso(),
      updatedAt: node.updatedAt || nowIso(),
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = (Array.isArray(raw?.edges) ? raw.edges : []).filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)).map((edge) => ({
      ...clone(edge),
      id: edge.id || uuid("tangle-edge"),
      boardId: boardIds.has(edge.boardId) ? edge.boardId : (nodes.find((node) => node.id === edge.from)?.boardId || activeBoardId),
      label: edge.label || "",
      direction: edge.direction || "forward",
      createdAt: edge.createdAt || nowIso(),
      updatedAt: edge.updatedAt || nowIso(),
    }));
    const groups = (Array.isArray(raw?.groups) ? raw.groups : []).map((group, index) => ({
      ...clone(group),
      id: group.id || uuid("tangle-group"),
      boardId: boardIds.has(group.boardId) ? group.boardId : activeBoardId,
      name: group.name || group.title || `Group ${index + 1}`,
      description: group.description || "",
      nodeIds: uniq(group.nodeIds || group.nodes || []).filter((id) => nodeIds.has(id)),
      collapsed: !!group.collapsed,
      color: group.color || null,
      createdAt: group.createdAt || nowIso(),
      updatedAt: group.updatedAt || nowIso(),
    }));
    const views = raw?.views && typeof raw.views === "object" ? clone(raw.views) : {};
    boards.forEach((board) => {
      if (!views[board.id]) views[board.id] = { x: 0, y: 0, zoom: 1 };
    });
    return {
      version: VERSION,
      activeBoardId,
      boards,
      nodes,
      edges,
      groups,
      views,
      updatedAt: raw?.updatedAt || null,
    };
  }

  function loadStateSync() {
    return normaliseState(backend.StorageService?.getSync?.(STORAGE_KEY, null));
  }

  async function saveState(state, reason = "save") {
    const next = { ...normaliseState(state), updatedAt: nowIso() };
    await backend.StorageService?.set?.(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("lw:live-tangle-updated", { detail: { state: next, reason } }));
    return next;
  }

  async function createBoard(fields = {}) {
    const state = loadStateSync();
    const board = normaliseBoard({
      id: fields.id || uuid("tangle-board"),
      name: String(fields.name || "New board").trim() || "New board",
      description: fields.description || "",
      pinned: !!fields.pinned,
      layout: fields.layout || "freeform",
    }, state.boards.length);
    state.boards.push(board);
    state.activeBoardId = board.id;
    state.views[board.id] = { x: 0, y: 0, zoom: 1 };
    await saveState(state, "board-create");
    return board;
  }

  async function updateBoard(boardId, patch = {}) {
    const state = loadStateSync();
    let updated = null;
    state.boards = state.boards.map((board) => {
      if (board.id !== boardId) return board;
      updated = { ...board, ...clone(patch), id: board.id, updatedAt: nowIso() };
      return updated;
    });
    await saveState(state, "board-update");
    return updated;
  }

  async function setActiveBoard(boardId) {
    const state = loadStateSync();
    if (!state.boards.some((board) => board.id === boardId)) return null;
    state.activeBoardId = boardId;
    await saveState(state, "board-activate");
    return state.boards.find((board) => board.id === boardId) || null;
  }

  async function deleteBoard(boardId) {
    const state = loadStateSync();
    if (state.boards.length <= 1) throw new Error("Tangle must keep at least one board.");
    const found = state.boards.find((board) => board.id === boardId);
    if (!found) return null;
    const ids = new Set(state.nodes.filter((node) => node.boardId === boardId).map((node) => node.id));
    state.boards = state.boards.filter((board) => board.id !== boardId);
    state.nodes = state.nodes.filter((node) => node.boardId !== boardId);
    state.edges = state.edges.filter((edge) => edge.boardId !== boardId && !ids.has(edge.from) && !ids.has(edge.to));
    state.groups = state.groups.filter((group) => group.boardId !== boardId);
    delete state.views[boardId];
    state.activeBoardId = state.boards[0].id;
    await saveState(state, "board-delete");
    return found;
  }

  function nextPosition(state, boardId) {
    const count = state.nodes.filter((node) => node.boardId === boardId).length;
    const column = count % 4;
    const row = Math.floor(count / 4);
    return { x: 90 + column * 270, y: 90 + row * 190 };
  }

  async function addNode(fields = {}) {
    const state = loadStateSync();
    const boardId = fields.boardId || state.activeBoardId;
    if (!state.boards.some((board) => board.id === boardId)) throw new Error("Choose a valid board.");
    const position = nextPosition(state, boardId);
    const node = {
      id: fields.id || uuid("tangle-node"),
      boardId,
      kind: fields.kind || (fields.entityId ? "entity" : "note"),
      entityType: fields.entityType || null,
      entityId: fields.entityId || null,
      title: fields.title || "Untitled note",
      body: fields.body || fields.preview || "",
      quote: fields.quote || "",
      sourceRef: fields.sourceRef || null,
      x: Number.isFinite(Number(fields.x)) ? Number(fields.x) : position.x,
      y: Number.isFinite(Number(fields.y)) ? Number(fields.y) : position.y,
      width: Number(fields.width) || 220,
      height: Number(fields.height) || 140,
      groupId: fields.groupId || null,
      color: fields.color || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.nodes.push(node);
    if (node.groupId) {
      state.groups = state.groups.map((group) => group.id === node.groupId ? { ...group, nodeIds: uniq([...(group.nodeIds || []), node.id]), updatedAt: nowIso() } : group);
    }
    await saveState(state, "node-create");
    return node;
  }

  async function addEntityNode(entityType, entityId, options = {}) {
    const entity = backend.EntityService?.getSync?.(entityId, entityType);
    if (!entity) throw new Error("The selected canonical entity no longer exists.");
    const existing = loadStateSync().nodes.find((node) => node.boardId === (options.boardId || loadStateSync().activeBoardId) && node.entityId === entityId);
    if (existing) return existing;
    return addNode({
      ...options,
      kind: "entity",
      entityType: entity.type || entityType,
      entityId: entity.id,
      title: entity.name || entity.title || "Untitled entity",
      body: entity.data?.summary || entity.summary || "",
    });
  }

  async function updateNode(nodeId, patch = {}) {
    const state = loadStateSync();
    let updated = null;
    state.nodes = state.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      updated = { ...node, ...clone(patch), id: node.id, boardId: node.boardId, updatedAt: nowIso() };
      return updated;
    });
    if (!updated) return null;
    if (Object.prototype.hasOwnProperty.call(patch, "groupId")) {
      state.groups = state.groups.map((group) => ({
        ...group,
        nodeIds: group.id === patch.groupId
          ? uniq([...(group.nodeIds || []).filter((id) => id !== nodeId), nodeId])
          : (group.nodeIds || []).filter((id) => id !== nodeId),
        updatedAt: nowIso(),
      }));
    }
    await saveState(state, "node-update");
    return updated;
  }

  async function moveNode(nodeId, x, y) {
    return updateNode(nodeId, { x: clamp(x, -4000, 12000), y: clamp(y, -4000, 12000) });
  }

  async function deleteNode(nodeId) {
    const state = loadStateSync();
    const found = state.nodes.find((node) => node.id === nodeId);
    if (!found) return null;
    state.nodes = state.nodes.filter((node) => node.id !== nodeId);
    state.edges = state.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
    state.groups = state.groups.map((group) => ({ ...group, nodeIds: (group.nodeIds || []).filter((id) => id !== nodeId), updatedAt: nowIso() }));
    await saveState(state, "node-delete");
    return found;
  }

  async function connectNodes(from, to, fields = {}) {
    if (!from || !to || from === to) return null;
    const state = loadStateSync();
    const a = state.nodes.find((node) => node.id === from);
    const b = state.nodes.find((node) => node.id === to);
    if (!a || !b || a.boardId !== b.boardId) throw new Error("Connections must join nodes on the same board.");
    const existing = state.edges.find((edge) => edge.from === from && edge.to === to);
    if (existing) return existing;
    const edge = {
      id: fields.id || uuid("tangle-edge"),
      boardId: a.boardId,
      from,
      to,
      label: fields.label || "",
      direction: fields.direction || "forward",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.edges.push(edge);
    await saveState(state, "edge-create");
    return edge;
  }

  async function updateEdge(edgeId, patch = {}) {
    const state = loadStateSync();
    let updated = null;
    state.edges = state.edges.map((edge) => edge.id === edgeId ? (updated = { ...edge, ...clone(patch), id: edge.id, updatedAt: nowIso() }) : edge);
    await saveState(state, "edge-update");
    return updated;
  }

  async function deleteEdge(edgeId) {
    const state = loadStateSync();
    const found = state.edges.find((edge) => edge.id === edgeId);
    state.edges = state.edges.filter((edge) => edge.id !== edgeId);
    await saveState(state, "edge-delete");
    return found || null;
  }

  async function createGroup(fields = {}) {
    const state = loadStateSync();
    const boardId = fields.boardId || state.activeBoardId;
    const nodeIds = uniq(fields.nodeIds || []).filter((id) => state.nodes.some((node) => node.id === id && node.boardId === boardId));
    const group = {
      id: fields.id || uuid("tangle-group"),
      boardId,
      name: fields.name || "New group",
      description: fields.description || "",
      nodeIds,
      collapsed: !!fields.collapsed,
      color: fields.color || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.groups.push(group);
    state.nodes = state.nodes.map((node) => nodeIds.includes(node.id) ? { ...node, groupId: group.id, updatedAt: nowIso() } : node);
    await saveState(state, "group-create");
    return group;
  }

  async function updateGroup(groupId, patch = {}) {
    const state = loadStateSync();
    let updated = null;
    state.groups = state.groups.map((group) => group.id === groupId ? (updated = { ...group, ...clone(patch), id: group.id, updatedAt: nowIso() }) : group);
    if (updated && Array.isArray(patch.nodeIds)) {
      const ids = new Set(patch.nodeIds);
      state.nodes = state.nodes.map((node) => node.boardId !== updated.boardId ? node : ({ ...node, groupId: ids.has(node.id) ? groupId : (node.groupId === groupId ? null : node.groupId), updatedAt: nowIso() }));
    }
    await saveState(state, "group-update");
    return updated;
  }

  async function deleteGroup(groupId) {
    const state = loadStateSync();
    const found = state.groups.find((group) => group.id === groupId);
    state.groups = state.groups.filter((group) => group.id !== groupId);
    state.nodes = state.nodes.map((node) => node.groupId === groupId ? { ...node, groupId: null, updatedAt: nowIso() } : node);
    await saveState(state, "group-delete");
    return found || null;
  }

  async function saveView(boardId, view = {}) {
    const state = loadStateSync();
    state.views[boardId] = {
      x: Number(view.x) || 0,
      y: Number(view.y) || 0,
      zoom: clamp(view.zoom || 1, 0.25, 2.5),
    };
    await saveState(state, "view-save");
    return state.views[boardId];
  }

  async function autoLayout(boardId = null) {
    const state = loadStateSync();
    const id = boardId || state.activeBoardId;
    const nodes = state.nodes.filter((node) => node.boardId === id);
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    state.nodes = state.nodes.map((node) => {
      const index = nodes.findIndex((row) => row.id === node.id);
      if (index < 0) return node;
      return {
        ...node,
        x: 80 + (index % columns) * 280,
        y: 80 + Math.floor(index / columns) * 190,
        updatedAt: nowIso(),
      };
    });
    await saveState(state, "auto-layout");
    return state.nodes.filter((node) => node.boardId === id);
  }

  async function promoteNode(nodeId, entityType, fields = {}) {
    const state = loadStateSync();
    const node = state.nodes.find((row) => row.id === nodeId);
    if (!node) throw new Error("Tangle node not found.");
    if (node.entityId) return backend.EntityService?.getSync?.(node.entityId, node.entityType) || null;
    const type = entityType || fields.entityType || "lore";
    const entity = await backend.EntityService.save(type, {
      name: fields.name || node.title || "Tangle idea",
      data: {
        summary: fields.summary || node.body || node.quote || "",
        tangleSource: { boardId: node.boardId, nodeId: node.id },
        relatedEntityIds: uniq(fields.relatedEntityIds || []),
        ...(fields.data || {}),
      },
      source: "tangle",
    }, { status: fields.status || "draft" });
    await updateNode(node.id, {
      kind: "entity",
      entityType: entity.type,
      entityId: entity.id,
      title: entity.name,
      promotedAt: nowIso(),
    });
    return entity;
  }

  async function promoteGroup(groupId, entityType = "quests", fields = {}) {
    const state = loadStateSync();
    const group = state.groups.find((row) => row.id === groupId);
    if (!group) throw new Error("Tangle group not found.");
    const nodes = state.nodes.filter((node) => (group.nodeIds || []).includes(node.id));
    const linkedIds = uniq(nodes.map((node) => node.entityId));
    const summary = nodes.map((node) => `${node.title}: ${node.body || node.quote || ""}`.trim()).join("\n");
    const entity = await backend.EntityService.save(entityType, {
      name: fields.name || group.name,
      data: {
        summary: fields.summary || summary,
        relatedEntityIds: uniq([...(fields.relatedEntityIds || []), ...linkedIds]),
        tangleSource: { boardId: group.boardId, groupId: group.id, nodeIds: group.nodeIds || [] },
        ...(fields.data || {}),
      },
      source: "tangle",
    }, { status: fields.status || "draft" });
    await addEntityNode(entity.type, entity.id, { boardId: group.boardId, x: 100, y: 100, groupId: group.id });
    return entity;
  }

  function resolveNode(node) {
    if (!node.entityId) return { ...node, liveEntity: null, missingEntity: false };
    const entity = backend.EntityService?.getSync?.(node.entityId, node.entityType);
    if (!entity) return { ...node, liveEntity: null, missingEntity: true };
    return {
      ...node,
      title: entity.name || entity.title || node.title,
      body: entity.data?.summary || entity.summary || node.body || "",
      entityType: entity.type || node.entityType,
      liveEntity: entity,
      missingEntity: false,
    };
  }

  function entityTray(boardId, query = "") {
    const state = loadStateSync();
    const onBoard = new Set(state.nodes.filter((node) => node.boardId === boardId && node.entityId).map((node) => node.entityId));
    const needle = String(query || "").trim().toLowerCase();
    const all = backend.EntityService?.listAllSync?.() || {};
    return ENTITY_TYPES.flatMap((type) => Object.values(all[type] || {}).map((entity) => ({
      id: entity.id,
      type: entity.type || type,
      name: entity.name || entity.title || "Untitled",
      summary: entity.data?.summary || entity.summary || "",
      onBoard: onBoard.has(entity.id),
      entity,
    }))).filter((row) => !needle || `${row.name} ${row.type} ${row.summary}`.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name));
  }

  function buildWorkspace(options = {}) {
    const state = loadStateSync();
    const boardId = options.boardId && state.boards.some((board) => board.id === options.boardId) ? options.boardId : state.activeBoardId;
    const board = state.boards.find((row) => row.id === boardId) || state.boards[0];
    const nodes = state.nodes.filter((node) => node.boardId === board.id).map(resolveNode);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = state.edges.filter((edge) => edge.boardId === board.id && nodeIds.has(edge.from) && nodeIds.has(edge.to));
    const groups = state.groups.filter((group) => group.boardId === board.id).map((group) => ({ ...group, nodeIds: (group.nodeIds || []).filter((id) => nodeIds.has(id)) }));
    return {
      version: VERSION,
      state,
      boards: state.boards,
      board,
      boardId: board.id,
      nodes,
      edges,
      groups,
      view: state.views[board.id] || { x: 0, y: 0, zoom: 1 },
      tray: entityTray(board.id, options.query || ""),
      summary: {
        boardCount: state.boards.length,
        nodeCount: nodes.length,
        entityNodeCount: nodes.filter((node) => !!node.entityId).length,
        noteCount: nodes.filter((node) => !node.entityId).length,
        edgeCount: edges.length,
        groupCount: groups.length,
        missingEntityCount: nodes.filter((node) => node.missingEntity).length,
      },
      generatedAt: nowIso(),
    };
  }

  const LiveTangleService = {
    version: VERSION,
    storageKey: STORAGE_KEY,
    entityTypes: ENTITY_TYPES,
    defaultState,
    normaliseState,
    loadStateSync,
    saveState,
    createBoard,
    updateBoard,
    setActiveBoard,
    deleteBoard,
    addNode,
    addEntityNode,
    updateNode,
    moveNode,
    deleteNode,
    connectNodes,
    updateEdge,
    deleteEdge,
    createGroup,
    updateGroup,
    deleteGroup,
    saveView,
    autoLayout,
    promoteNode,
    promoteGroup,
    entityTray,
    buildWorkspace,
  };

  backend.LiveTangleService = LiveTangleService;
  window.LiveTangleService = LiveTangleService;
  window.dispatchEvent(new CustomEvent("lw:live-tangle-ready", { detail: { service: LiveTangleService } }));
})();
