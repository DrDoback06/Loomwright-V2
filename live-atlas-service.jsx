// =====================================================================
// live-atlas-service.jsx — canonical Atlas read/write model.
//
// Derives maps, locations, historical positions and travel routes from the
// existing entity, manuscript, review and HistoricalWorldState services.
// Atlas-specific cartography (maps and placements) is stored separately so
// moving a pin never mutates story canon.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend || backend.LiveAtlasService) return;

  const STORAGE_KEY = "live_atlas_v1";
  const VERSION = 1;
  const DEFAULT_MAP_ID = "atlas-map-world";
  const CURRENT_INDEX = Number.MAX_SAFE_INTEGER;

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const nowIso = () => new Date().toISOString();
  const uuid = (prefix = "atlas") => prefix + "-" + (window.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
  const uniq = (rows) => [...new Set((rows || []).filter(Boolean))];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

  function defaultMap() {
    return {
      id: DEFAULT_MAP_ID,
      name: "World map",
      type: "world",
      parentMapId: null,
      locationId: null,
      width: 1000,
      height: 650,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  function defaultState() {
    return {
      version: VERSION,
      activeMapId: DEFAULT_MAP_ID,
      maps: [defaultMap()],
      placements: {},
      explicitRoutes: [],
      updatedAt: null,
    };
  }

  function normaliseState(raw) {
    const fallback = defaultState();
    const maps = Array.isArray(raw?.maps) && raw.maps.length ? raw.maps.map((map) => ({
      ...map,
      id: map.id || uuid("atlas-map"),
      name: map.name || "Untitled map",
      type: map.type || "region",
      parentMapId: map.parentMapId || null,
      locationId: map.locationId || null,
      width: Number(map.width) || 1000,
      height: Number(map.height) || 650,
    })) : fallback.maps;
    const ids = new Set(maps.map((map) => map.id));
    return {
      version: VERSION,
      activeMapId: ids.has(raw?.activeMapId) ? raw.activeMapId : maps[0].id,
      maps,
      placements: raw?.placements && typeof raw.placements === "object" ? clone(raw.placements) : {},
      explicitRoutes: Array.isArray(raw?.explicitRoutes) ? clone(raw.explicitRoutes) : [],
      updatedAt: raw?.updatedAt || null,
    };
  }

  function loadStateSync() {
    return normaliseState(backend.StorageService?.getSync?.(STORAGE_KEY, null));
  }

  async function saveState(state) {
    const next = { ...normaliseState(state), updatedAt: nowIso() };
    await backend.StorageService?.set?.(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("lw:live-atlas-updated", { detail: { state: next } }));
    return next;
  }

  async function createMap(fields = {}) {
    const state = loadStateSync();
    const map = {
      id: fields.id || uuid("atlas-map"),
      name: String(fields.name || "New map").trim() || "New map",
      type: fields.type || "region",
      parentMapId: fields.parentMapId || null,
      locationId: fields.locationId || null,
      width: Number(fields.width) || 1000,
      height: Number(fields.height) || 650,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.maps.push(map);
    state.activeMapId = map.id;
    await saveState(state);
    return map;
  }

  async function updateMap(mapId, patch = {}) {
    const state = loadStateSync();
    let updated = null;
    state.maps = state.maps.map((map) => {
      if (map.id !== mapId) return map;
      updated = { ...map, ...clone(patch), id: map.id, updatedAt: nowIso() };
      return updated;
    });
    await saveState(state);
    return updated;
  }

  async function deleteMap(mapId) {
    if (mapId === DEFAULT_MAP_ID) throw new Error("The world map cannot be deleted.");
    const state = loadStateSync();
    if (!state.maps.some((map) => map.id === mapId)) return false;
    state.maps = state.maps.filter((map) => map.id !== mapId);
    Object.keys(state.placements).forEach((locationId) => {
      if (state.placements[locationId]?.mapId === mapId) delete state.placements[locationId];
    });
    state.activeMapId = state.maps[0]?.id || DEFAULT_MAP_ID;
    await saveState(state);
    return true;
  }

  async function setActiveMap(mapId) {
    const state = loadStateSync();
    if (!state.maps.some((map) => map.id === mapId)) return null;
    state.activeMapId = mapId;
    await saveState(state);
    return state.maps.find((map) => map.id === mapId) || null;
  }

  async function setPlacement(locationId, placement = {}) {
    if (!locationId) throw new Error("Choose a location before placing it.");
    const state = loadStateSync();
    const mapId = placement.mapId || state.activeMapId || DEFAULT_MAP_ID;
    if (!state.maps.some((map) => map.id === mapId)) throw new Error("Choose a valid map.");
    const previous = state.placements[locationId] || {};
    state.placements[locationId] = {
      ...previous,
      locationId,
      mapId,
      x: clamp(placement.x ?? previous.x ?? 50, 0, 100),
      y: clamp(placement.y ?? previous.y ?? 50, 0, 100),
      parentLocationId: placement.parentLocationId ?? previous.parentLocationId ?? null,
      source: placement.source || previous.source || "manual",
      updatedAt: nowIso(),
      createdAt: previous.createdAt || nowIso(),
    };
    await saveState(state);
    return clone(state.placements[locationId]);
  }

  async function removePlacement(locationId) {
    const state = loadStateSync();
    const found = state.placements[locationId] || null;
    delete state.placements[locationId];
    await saveState(state);
    return found;
  }

  async function autoPlace(locationIds = [], mapId = null) {
    const state = loadStateSync();
    const targetMapId = mapId || state.activeMapId || DEFAULT_MAP_ID;
    const ids = uniq(locationIds);
    const count = ids.length;
    if (!count) return [];
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const placed = [];
    ids.forEach((locationId, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      state.placements[locationId] = {
        ...(state.placements[locationId] || {}),
        locationId,
        mapId: targetMapId,
        x: count === 1 ? 50 : 12 + (col * (76 / Math.max(1, columns - 1))),
        y: count === 1 ? 50 : 14 + (row * (72 / Math.max(1, rows - 1))),
        source: "auto-layout",
        createdAt: state.placements[locationId]?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      placed.push(clone(state.placements[locationId]));
    });
    await saveState(state);
    return placed;
  }

  function chapterContext() {
    const worldState = backend.HistoricalWorldStateService;
    if (worldState?.chapterContext) return worldState.chapterContext();
    const state = backend.ManuscriptChapterService?.loadSync?.() || { chapters: [], activeChapterId: null };
    const chapters = (state.chapters || []).filter((row) => !row.reserved).map((chapter, index) => ({
      id: chapter.id,
      index,
      num: chapter.num || index + 1,
      title: chapter.title || `Chapter ${index + 1}`,
      label: `Ch. ${chapter.num || index + 1} · ${chapter.title || `Chapter ${index + 1}`}`,
      chapter,
    }));
    return {
      chapters,
      activeChapterId: state.activeChapterId || chapters[0]?.id || null,
      chapterIndex: new Map(chapters.map((chapter) => [chapter.id, chapter.index])),
      chapterById: new Map(chapters.map((chapter) => [chapter.id, chapter])),
    };
  }

  function anchorFor(anchorId, context = chapterContext()) {
    if (!anchorId || anchorId === "current") return { type: "current", id: "current", label: "Current accepted state" };
    const chapter = context.chapterById.get(anchorId);
    return chapter ? { type: "chapter", id: chapter.id, label: chapter.label } : { type: "current", id: "current", label: "Current accepted state" };
  }

  function canonicalSnapshot(anchor, branchId) {
    const service = backend.HistoricalWorldStateService;
    if (service?.snapshot) {
      try { return service.snapshot({ anchor, branchId: branchId || "canonical" }); } catch (_) {}
    }
    const entities = Object.values(backend.EntityService?.listAllSync?.() || {}).flatMap((bucket) => Object.values(bucket || {}));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    return {
      anchor,
      branchId: branchId || "canonical",
      entities,
      entityById,
      byType: entities.reduce((out, entity) => {
        (out[entity.type] = out[entity.type] || []).push(entity);
        return out;
      }, {}),
    };
  }

  function entityData(entity) {
    return entity?.data && typeof entity.data === "object" ? entity.data : {};
  }

  function locationReference(value, locations, locationByName) {
    if (!value) return null;
    if (typeof value === "object") {
      const id = value.id || value.locationId || value.entityId;
      if (id && locations.has(id)) return locations.get(id);
      const name = value.name || value.label || value.title;
      return name ? locationByName.get(String(name).toLowerCase()) || { id: id || null, name } : null;
    }
    const direct = locations.get(String(value));
    return direct || locationByName.get(String(value).toLowerCase()) || { id: null, name: String(value) };
  }

  function canonicalPlacement(location, state) {
    const stored = state.placements[location.id];
    if (stored) return clone(stored);
    const data = entityData(location);
    const source = data.mapPlacement || data.coordinates || location.mapPlacement || null;
    if (!source || source.x == null || source.y == null) return null;
    return {
      locationId: location.id,
      mapId: source.mapId || data.mapId || state.activeMapId || DEFAULT_MAP_ID,
      x: clamp(source.x, 0, 100),
      y: clamp(source.y, 0, 100),
      parentLocationId: source.parentLocationId || data.parentLocationId || data.parentId || null,
      source: "entity",
    };
  }

  function normaliseLocation(entity, state) {
    const data = entityData(entity);
    const placement = canonicalPlacement(entity, state);
    return {
      id: entity.id,
      name: entity.name || entity.title || "Untitled location",
      entity,
      type: data.locationType || data.kind || data.type || entity.locationType || "location",
      parentLocationId: data.parentLocationId || data.parentId || data.parent?.id || entity.parentLocationId || null,
      summary: data.summary || entity.summary || "",
      status: data.currentStatus || data.status || entity.status || "active",
      aliases: data.aliases || entity.aliases || [],
      placement,
      placed: !!placement,
      mapId: placement?.mapId || null,
      x: placement?.x ?? null,
      y: placement?.y ?? null,
      sourceMentions: entity.sourceMentions || [],
    };
  }

  function locationHistories(entity) {
    const data = entityData(entity);
    return [
      ...(Array.isArray(data.locationHistory) ? data.locationHistory : []),
      ...(Array.isArray(data.travelHistory) ? data.travelHistory : []),
      ...(Array.isArray(data.movementHistory) ? data.movementHistory : []),
      ...(Array.isArray(entity.locationHistory) ? entity.locationHistory : []),
    ];
  }

  function chapterIndexFor(record, context) {
    const id = record?.chapterId || record?.sourceChapterId || record?.originChapterId;
    return id ? (context.chapterIndex.get(id) ?? CURRENT_INDEX) : CURRENT_INDEX;
  }

  function pointFromRecord(record, side, locations, locationByName) {
    if (!record) return null;
    const values = side === "from"
      ? [record.from, record.previousLocation, record.fromLocation, record.origin, record.originLocationId]
      : [record.to, record.location, record.currentLocation, record.destination, record.destinationLocationId, record.locationId];
    for (const value of values) {
      const resolved = locationReference(value, locations, locationByName);
      if (resolved) return resolved;
    }
    return null;
  }

  function deriveTravelRoute(entity, snapshotEntity, opts) {
    const { context, cutoff, locations, locationByName, locationRows, mapId } = opts;
    const history = locationHistories(entity)
      .map((record, index) => ({ record, index, chapterIndex: chapterIndexFor(record, context) }))
      .filter((row) => row.chapterIndex <= cutoff)
      .sort((a, b) => a.chapterIndex - b.chapterIndex || a.index - b.index);
    const waypoints = [];
    const push = (location, row, kind) => {
      if (!location?.id) return;
      const normalised = locationRows.get(location.id);
      if (!normalised?.placement || normalised.placement.mapId !== mapId) return;
      if (waypoints.at(-1)?.locationId === location.id) return;
      waypoints.push({
        locationId: location.id,
        locationName: normalised.name,
        x: normalised.placement.x,
        y: normalised.placement.y,
        chapterId: row?.record?.chapterId || null,
        chapterIndex: row?.chapterIndex ?? -1,
        sourceQuote: row?.record?.sourceQuote || "",
        kind,
      });
    };
    if (history.length) push(pointFromRecord(history[0].record, "from", locations, locationByName), history[0], "origin");
    history.forEach((row) => push(pointFromRecord(row.record, "to", locations, locationByName), row, "travel"));
    const currentRef = locationReference(entityData(snapshotEntity).currentLocation || entityData(snapshotEntity).location || snapshotEntity?.currentLocation, locations, locationByName);
    push(currentRef, null, "snapshot");
    return {
      id: `travel-${entity.id}`,
      entityId: entity.id,
      entityType: entity.type,
      name: entity.name || "Traveller",
      initials: String(entity.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
      waypoints,
      segments: waypoints.slice(1).map((point, index) => ({ from: waypoints[index], to: point })),
    };
  }

  function reviewLocationCandidates() {
    const rows = backend.ReviewService?.listSync?.() || [];
    return rows.filter((review) => review.status === "pending" && review.entityType === "locations").map((review) => ({
      id: review.id,
      name: review.name || review.payload?.name || "Location candidate",
      summary: review.summary || review.reason || "",
      chapterId: review.chapterId || null,
      sourceQuote: review.sourceQuote || review.payload?.sourceQuote || "",
      existingEntityId: review.existingEntityId || review.targetEntityId || null,
      suggestedAction: review.suggestedAction || review.action || "create",
      review,
    }));
  }

  function buildWorkspace(options = {}) {
    const state = loadStateSync();
    const context = chapterContext();
    const anchor = anchorFor(options.anchorId || options.anchor?.id || "current", context);
    const branchId = options.branchId || "canonical";
    const snapshot = canonicalSnapshot(anchor, branchId);
    const mapId = options.mapId && state.maps.some((map) => map.id === options.mapId) ? options.mapId : state.activeMapId;
    const activeMap = state.maps.find((map) => map.id === mapId) || state.maps[0];
    const latestAll = backend.EntityService?.listAllSync?.() || {};
    const latestLocations = Object.values(latestAll.locations || {});
    const snapshotLocations = snapshot.byType?.locations || latestLocations;
    const locationEntities = new Map(latestLocations.map((entity) => [entity.id, entity]));
    snapshotLocations.forEach((entity) => locationEntities.set(entity.id, { ...(locationEntities.get(entity.id) || {}), ...entity }));
    const locations = new Map(locationEntities);
    const locationByName = new Map([...locations.values()].map((entity) => [String(entity.name || entity.title || "").toLowerCase(), entity]));
    const locationRows = new Map([...locations.values()].map((entity) => [entity.id, normaliseLocation(entity, state)]));
    const allLocations = [...locationRows.values()].sort((a, b) => a.name.localeCompare(b.name));
    const placedLocations = allLocations.filter((location) => location.placement?.mapId === activeMap.id);
    const stagedLocations = allLocations.filter((location) => !location.placement);

    const branches = [{ id: "canonical", name: "Canonical", status: "accepted" }].concat(
      (backend.HistoricalWorldStateService?.loadStoreSync?.()?.branches || []).map((branch) => ({
        id: branch.id,
        name: branch.name,
        status: branch.status || "draft",
        forkAnchor: branch.forkAnchor || null,
      })),
    );
    const cutoff = anchor.type === "chapter" ? (context.chapterIndex.get(anchor.id) ?? CURRENT_INDEX) : CURRENT_INDEX;
    const travellerTypes = ["cast"];
    const routes = [];
    travellerTypes.forEach((type) => {
      const latestRows = Object.values(latestAll[type] || {});
      latestRows.forEach((entity) => {
        const snapshotEntity = snapshot.entityById?.get(entity.id) || entity;
        const route = deriveTravelRoute(entity, snapshotEntity, { context, cutoff, locations, locationByName, locationRows, mapId: activeMap.id });
        if (route.waypoints.length) routes.push(route);
      });
    });

    const positionTypes = ["cast", "items", "bestiary", "factions"];
    const positions = [];
    positionTypes.forEach((type) => {
      (snapshot.byType?.[type] || []).forEach((entity) => {
        const data = entityData(entity);
        const ref = locationReference(data.currentLocation || data.location || entity.currentLocation, locations, locationByName);
        const location = ref?.id ? locationRows.get(ref.id) : null;
        if (!location?.placement || location.placement.mapId !== activeMap.id) return;
        positions.push({
          id: entity.id,
          name: entity.name || entity.title || "Untitled",
          type,
          entity,
          locationId: location.id,
          locationName: location.name,
          x: location.placement.x,
          y: location.placement.y,
        });
      });
    });

    const reviewCandidates = reviewLocationCandidates();
    const pendingUnplacedReviews = reviewCandidates.filter((candidate) => !candidate.existingEntityId || !locationRows.get(candidate.existingEntityId)?.placement);
    return {
      version: VERSION,
      state,
      maps: state.maps,
      activeMap,
      mapId: activeMap.id,
      chapters: context.chapters,
      activeChapterId: context.activeChapterId || null,
      anchor,
      branchId,
      branches,
      snapshot,
      locations: allLocations,
      placedLocations,
      stagedLocations,
      locationById: locationRows,
      routes,
      positions,
      reviewCandidates,
      pendingUnplacedReviews,
      summary: {
        locationCount: allLocations.length,
        placedCount: placedLocations.length,
        stagedCount: stagedLocations.length,
        routeCount: routes.filter((route) => route.waypoints.length >= 2).length,
        positionCount: positions.length,
        reviewCount: pendingUnplacedReviews.length,
      },
      generatedAt: nowIso(),
    };
  }

  const LiveAtlasService = {
    version: VERSION,
    storageKey: STORAGE_KEY,
    defaultState,
    loadStateSync,
    saveState,
    createMap,
    updateMap,
    deleteMap,
    setActiveMap,
    setPlacement,
    removePlacement,
    autoPlace,
    chapterContext,
    anchorFor,
    buildWorkspace,
    deriveTravelRoute,
    reviewLocationCandidates,
    _test: {
      normaliseState,
      locationReference,
      canonicalPlacement,
      chapterIndexFor,
    },
  };

  backend.LiveAtlasService = LiveAtlasService;
  window.LiveAtlasService = LiveAtlasService;
  window.dispatchEvent(new CustomEvent("lw:live-atlas-ready", { detail: { service: LiveAtlasService } }));
})();
