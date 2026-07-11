// =====================================================================
// historical-world-state-service.jsx — deterministic historical projection,
// alternate branches, relationship trajectories and retcon impact analysis.
//
// Canon remains in the existing entity/manuscript/review stores. This service
// derives accepted deltas from those stores and persists only non-canon branch
// metadata/deltas. Committing a branch or retcon creates Impact Review work; it
// never silently rewrites canonical entities.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend?.EntityService || backend.HistoricalWorldStateService) return;

  const STORE_KEY = "lw:v2:historical-world-state";
  const VERSION = 1;
  const CURRENT_INDEX = Number.MAX_SAFE_INTEGER;
  const HISTORY_FIELDS = new Set([
    "ownershipHistory", "locationHistory", "statusHistory", "conditionHistory",
    "usageHistory", "factionMemberships", "relationshipHistory", "markerHistory",
    "knowledgeClaims", "beliefs", "intentions", "motives", "conditions",
    "sourceEvidence", "evidence", "markers", "relationshipMarkers",
  ]);

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const nowIso = () => backend.nowIso ? backend.nowIso() : new Date().toISOString();
  const uuid = (prefix) => backend.uuid ? backend.uuid(prefix) : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const normalise = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  const uniq = (rows) => [...new Set((rows || []).filter(Boolean))];
  const stable = (value) => {
    const seen = new WeakSet();
    const walk = (input) => {
      if (input == null || typeof input !== "object") return input;
      if (seen.has(input)) return "[Circular]";
      seen.add(input);
      if (Array.isArray(input)) return input.map(walk);
      return Object.keys(input).sort().reduce((out, key) => {
        out[key] = walk(input[key]);
        return out;
      }, {});
    };
    try { return JSON.stringify(walk(value)); } catch (_) { return String(value); }
  };
  const entityRef = (entity) => entity ? ({ id: entity.id, name: entity.name, type: entity.type || entity.entityType }) : null;
  const pathParts = (path) => String(path || "").split(".").filter(Boolean);

  function readPath(target, path) {
    return pathParts(path).reduce((value, key) => value == null ? undefined : value[key], target);
  }

  function writePath(target, path, value) {
    const parts = pathParts(path);
    if (!parts.length) return target;
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index++) {
      const key = parts[index];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = clone(value);
    return target;
  }

  function removePath(target, path) {
    const parts = pathParts(path);
    if (!parts.length) return;
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index++) {
      cursor = cursor?.[parts[index]];
      if (!cursor) return;
    }
    delete cursor[parts[parts.length - 1]];
  }

  function recordFingerprint(value) {
    if (value == null) return "null";
    if (typeof value !== "object") return normalise(value);
    return value.id || [
      value.chapterId || value.sourceChapterId || "",
      value.status || value.state || value.kind || value.type || "",
      normalise(value.statement || value.action || value.title || value.sourceQuote || value.name || ""),
      value.to?.id || value.from?.id || value.entityId || "",
    ].join("|");
  }

  function removeArrayRecord(array, value) {
    const rows = Array.isArray(array) ? array : [];
    const key = recordFingerprint(value);
    const index = rows.findIndex((row) => recordFingerprint(row) === key);
    if (index >= 0) rows.splice(index, 1);
    return rows;
  }

  function loadStoreSync() {
    const stored = backend.StorageService.getSync(STORE_KEY, null);
    if (!stored || typeof stored !== "object") return { version: VERSION, branches: [], deltas: [], updatedAt: null };
    return {
      version: VERSION,
      branches: Array.isArray(stored.branches) ? stored.branches : [],
      deltas: Array.isArray(stored.deltas) ? stored.deltas : [],
      updatedAt: stored.updatedAt || null,
    };
  }

  async function saveStore(next) {
    const value = { ...next, version: VERSION, updatedAt: nowIso() };
    await backend.StorageService.set(STORE_KEY, value);
    window.dispatchEvent(new CustomEvent("lw:historical-world-state-updated", { detail: { store: value } }));
    return value;
  }

  function chapterContext() {
    const manuscript = backend.ManuscriptChapterService?.loadSync?.() || {};
    const chapters = (manuscript.chapters || []).filter((chapter) => !chapter.reserved).map((chapter, index) => ({
      ...chapter,
      index,
      number: chapter.num || chapter.slotNumber || index + 1,
      label: `Ch. ${chapter.num || chapter.slotNumber || index + 1}${chapter.title ? ` · ${chapter.title}` : ""}`,
    }));
    return {
      manuscript,
      chapters,
      chapterById: new Map(chapters.map((chapter) => [chapter.id, chapter])),
      chapterIndex: new Map(chapters.map((chapter) => [chapter.id, chapter.index])),
    };
  }

  function entitySnapshot() {
    const raw = backend.EntityService.listAllSync() || {};
    const entities = Object.entries(raw).flatMap(([type, byId]) =>
      Object.values(byId || {}).filter((entity) => entity?.status !== "deleted").map((entity) => ({ ...clone(entity), type: entity.type || type }))
    );
    return {
      entities,
      entityById: new Map(entities.map((entity) => [entity.id, entity])),
      byType: entities.reduce((out, entity) => {
        (out[entity.type] = out[entity.type] || []).push(entity);
        return out;
      }, {}),
    };
  }

  function anchorForRecord(record, context) {
    const chapterId = record?.chapterId || record?.sourceChapterId || record?.originChapterId || record?.chapter?.id || null;
    const chapter = chapterId ? context.chapterById.get(chapterId) : null;
    return {
      chapterId,
      chapterIndex: chapter?.index ?? CURRENT_INDEX,
      chapterLabel: chapter?.label || chapterId || "Unplaced",
      eventId: record?.eventId || record?.sourceEventId || null,
      temporalAnchor: record?.temporalAnchor || record?.fictionalDate || record?.date || null,
    };
  }

  function makeDelta({ entity, path, op = "set", before, after, record, field, kind, sourceEntityId = null, relatedEntityIds = [], context }) {
    const anchor = anchorForRecord(record, context);
    const fingerprint = [entity.id, path, op, anchor.chapterId || "current", recordFingerprint(after), recordFingerprint(before)].join("|");
    return {
      id: `canon-${fingerprint}`,
      fingerprint,
      branchId: "canonical",
      entityId: entity.id,
      entityType: entity.type,
      entityName: entity.name,
      path,
      op,
      before: clone(before),
      after: clone(after),
      field,
      kind: kind || field,
      ...anchor,
      sourceQuote: record?.sourceQuote || record?.quote || "",
      sourceReviewId: record?.sourceReviewId || record?.reviewItemId || null,
      sourceEntityId,
      relatedEntityIds: uniq(relatedEntityIds),
      accepted: true,
      provenance: "canonical-history",
      createdAt: record?.createdAt || record?.updatedAt || null,
    };
  }

  function historyDeltasForEntity(entity, context) {
    const data = entity.data || {};
    const deltas = [];
    const addSet = (field, row, path, before, after, kind = field, related = []) => {
      if (after === undefined && before === undefined) return;
      deltas.push(makeDelta({ entity, path, before, after, record: row, field, kind, relatedEntityIds: related, context }));
    };
    const addAppend = (field, row, path, kind = field, related = []) => {
      deltas.push(makeDelta({ entity, path, op: "append", before: null, after: row, record: row, field, kind, relatedEntityIds: related, context }));
    };

    const ownership = data.ownershipHistory || entity.ownershipHistory || [];
    ownership.forEach((row) => addSet("ownershipHistory", row, "data.currentOwner", row.from ?? row.previousOwner ?? null, row.to ?? row.currentOwner ?? row.owner ?? null, "ownership", [row.from?.id, row.to?.id, row.owner?.id]));

    const locations = data.locationHistory || entity.locationHistory || [];
    locations.forEach((row) => addSet("locationHistory", row, "data.currentLocation", row.from ?? row.previousLocation ?? null, row.to ?? row.location ?? row.currentLocation ?? null, "movement", [row.from?.id, row.to?.id, row.location?.id]));

    const statusRows = [
      ...(data.statusHistory || entity.statusHistory || []),
      ...(data.conditionHistory || entity.conditionHistory || []),
    ];
    statusRows.forEach((row) => {
      if (row.status !== undefined || row.previousStatus !== undefined || row.fromStatus !== undefined) {
        addSet("statusHistory", row, "data.currentStatus", row.previousStatus ?? row.fromStatus ?? null, row.status ?? row.toStatus ?? null, "status");
      }
      if (row.condition !== undefined || row.previousCondition !== undefined) {
        addSet("conditionHistory", row, "data.condition", row.previousCondition ?? null, row.condition ?? null, "condition");
      }
    });

    const memberships = data.factionMemberships || entity.factionMemberships || [];
    memberships.forEach((row) => addSet("factionMemberships", row, "data.faction", row.previousFaction ?? row.from ?? null, row.faction ?? row.to ?? null, "faction", [row.faction?.id, row.from?.id, row.to?.id]));

    const arrayHistories = [
      ["knowledgeClaims", "knowledge"], ["beliefs", "belief"], ["intentions", "intention"], ["motives", "motive"],
      ["conditions", "condition"], ["sourceEvidence", "evidence"], ["evidence", "evidence"],
      ["markers", "relationship-marker"], ["relationshipMarkers", "relationship-marker"],
      ["usageHistory", "item-use"], ["relationshipHistory", "relationship"], ["markerHistory", "relationship-marker"],
    ];
    arrayHistories.forEach(([field, kind]) => {
      const rows = data[field] || entity[field] || [];
      if (Array.isArray(rows)) rows.forEach((row) => {
        const related = [row.entityId, row.fromId, row.toId, row.targetId, row.sourceEntity?.id, row.actor?.id].filter(Boolean);
        addAppend(field, row, `data.${field}`, kind, related);
      });
    });

    for (const [field, rows] of Object.entries(data)) {
      if (!/History$/.test(field) || HISTORY_FIELDS.has(field) || !Array.isArray(rows)) continue;
      rows.forEach((row) => addAppend(field, row, `data.${field}`, field.replace(/History$/, "").toLowerCase()));
    }
    return deltas;
  }

  function eventDeltas(entities, context) {
    const deltas = [];
    const eventEntities = entities.filter((entity) => entity.type === "events" || entity.type === "timeline");
    const groups = ["characterStateChanges", "relationshipChanges", "itemStateChanges", "locationChanges", "statChanges", "factionChanges", "worldStateChanges"];
    eventEntities.forEach((eventEntity) => {
      const data = eventEntity.data || {};
      groups.forEach((group) => {
        const rows = data[group] || eventEntity[group] || [];
        if (!Array.isArray(rows)) return;
        rows.forEach((row, index) => {
          const targetId = row.entityId || row.targetEntityId || row.targetId || row.characterId || row.itemId || row.locationId || row.relationshipId;
          const target = entities.find((entity) => entity.id === targetId);
          if (!target) return;
          const path = row.path || (row.field ? (row.field.startsWith("data.") ? row.field : `data.${row.field}`) : null);
          if (!path) return;
          const record = {
            ...row,
            chapterId: row.chapterId || data.chapterId || eventEntity.chapterId || eventEntity.data?.chapter?.id,
            eventId: eventEntity.id,
            sourceQuote: row.sourceQuote || data.sourceQuote || eventEntity.summary || data.summary || "",
          };
          deltas.push(makeDelta({
            entity: target,
            path,
            op: row.op || "set",
            before: row.before ?? row.previousValue ?? null,
            after: row.after ?? row.value ?? row.newValue,
            record,
            field: group,
            kind: row.kind || group.replace(/Changes$/, "").toLowerCase(),
            sourceEntityId: eventEntity.id,
            relatedEntityIds: [eventEntity.id, ...(row.relatedEntityIds || [])],
            context,
          }));
        });
      });
    });
    return deltas;
  }

  function canonicalDeltas() {
    const context = chapterContext();
    const snapshot = entitySnapshot();
    const rows = [
      ...snapshot.entities.flatMap((entity) => historyDeltasForEntity(entity, context)),
      ...eventDeltas(snapshot.entities, context),
    ];
    const unique = new Map();
    rows.forEach((row) => {
      if (!unique.has(row.fingerprint)) unique.set(row.fingerprint, row);
    });
    return [...unique.values()].sort((a, b) => a.chapterIndex - b.chapterIndex || String(a.id).localeCompare(String(b.id)));
  }

  function anchorIndex(anchor = {}, context = chapterContext()) {
    if (!anchor || anchor.type === "current" || anchor.id === "current") return CURRENT_INDEX;
    if (anchor.type === "chapter" || context.chapterById.has(anchor.id)) return context.chapterIndex.get(anchor.id) ?? CURRENT_INDEX;
    if (Number.isFinite(anchor.index)) return anchor.index;
    return CURRENT_INDEX;
  }

  function filterFutureHistoryArrays(entity, cutoff, context) {
    const data = entity.data || {};
    Object.entries(data).forEach(([field, value]) => {
      if (!Array.isArray(value)) return;
      if (!HISTORY_FIELDS.has(field) && !/History$/.test(field)) return;
      data[field] = value.filter((row) => {
        const chapterId = row?.chapterId || row?.sourceChapterId || row?.originChapterId;
        if (!chapterId) return true;
        return (context.chapterIndex.get(chapterId) ?? CURRENT_INDEX) <= cutoff;
      });
    });
    return entity;
  }

  function reverseDelta(entity, delta) {
    if (!entity) return;
    if (delta.op === "append") {
      const array = readPath(entity, delta.path);
      writePath(entity, delta.path, removeArrayRecord(Array.isArray(array) ? [...array] : [], delta.after));
      return;
    }
    if (delta.op === "remove") {
      const array = readPath(entity, delta.path);
      const next = Array.isArray(array) ? [...array] : [];
      next.push(clone(delta.before));
      writePath(entity, delta.path, next);
      return;
    }
    if (delta.before === undefined) removePath(entity, delta.path);
    else writePath(entity, delta.path, delta.before);
  }

  function applyDelta(entity, delta) {
    if (!entity) return;
    if (delta.op === "append") {
      const array = readPath(entity, delta.path);
      const next = Array.isArray(array) ? [...array] : [];
      if (!next.some((row) => recordFingerprint(row) === recordFingerprint(delta.after))) next.push(clone(delta.after));
      writePath(entity, delta.path, next);
      return;
    }
    if (delta.op === "remove") {
      const array = readPath(entity, delta.path);
      writePath(entity, delta.path, removeArrayRecord(Array.isArray(array) ? [...array] : [], delta.before));
      return;
    }
    writePath(entity, delta.path, delta.after);
  }

  function branchById(id, store = loadStoreSync()) {
    return (store.branches || []).find((branch) => branch.id === id) || null;
  }

  function snapshot(opts = {}) {
    const context = chapterContext();
    const canonical = entitySnapshot();
    const cutoff = anchorIndex(opts.anchor || { type: "current", id: "current" }, context);
    const entities = canonical.entities.map((entity) => clone(entity));
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const deltas = canonicalDeltas();

    [...deltas].sort((a, b) => b.chapterIndex - a.chapterIndex).forEach((delta) => {
      if (delta.chapterIndex > cutoff) reverseDelta(entityById.get(delta.entityId), delta);
    });
    entities.forEach((entity) => filterFutureHistoryArrays(entity, cutoff, context));

    const store = loadStoreSync();
    const branchId = opts.branchId && opts.branchId !== "canonical" ? opts.branchId : "canonical";
    const branch = branchId === "canonical" ? null : branchById(branchId, store);
    const branchDeltas = branch
      ? (store.deltas || []).filter((delta) => delta.branchId === branch.id && (delta.anchorIndex ?? CURRENT_INDEX) <= cutoff)
      : [];
    branchDeltas.sort((a, b) => (a.anchorIndex ?? CURRENT_INDEX) - (b.anchorIndex ?? CURRENT_INDEX) || String(a.id).localeCompare(String(b.id)))
      .forEach((delta) => applyDelta(entityById.get(delta.entityId), delta));

    const changedEntityIds = uniq([
      ...deltas.filter((delta) => delta.chapterIndex <= cutoff).map((delta) => delta.entityId),
      ...branchDeltas.map((delta) => delta.entityId),
    ]);
    return {
      id: uuid("snapshot"),
      branchId,
      branch,
      anchor: opts.anchor || { type: "current", id: "current", label: "Current" },
      cutoffIndex: cutoff,
      entities,
      entityById,
      byType: entities.reduce((out, entity) => {
        (out[entity.type] = out[entity.type] || []).push(entity);
        return out;
      }, {}),
      canonicalDeltas: deltas.filter((delta) => delta.chapterIndex <= cutoff),
      branchDeltas,
      changedEntityIds,
      generatedAt: nowIso(),
      confidence: deltas.some((delta) => delta.chapterIndex === CURRENT_INDEX) ? "partial-history" : "tracked-history",
    };
  }

  function flattenComparable(entity) {
    const data = entity?.data || {};
    return {
      name: entity?.name,
      status: entity?.status || data.currentStatus || data.status || null,
      currentLocation: data.currentLocation || data.location || null,
      currentOwner: data.currentOwner || data.owner || null,
      condition: data.condition || null,
      faction: data.faction || data.affiliation || null,
      markers: data.markers || data.relationshipMarkers || [],
      knowledgeClaims: data.knowledgeClaims || [],
      beliefs: data.beliefs || [],
      intentions: data.intentions || [],
      goals: data.goals || [],
    };
  }

  function diffSnapshots(leftOpts = {}, rightOpts = {}) {
    const left = snapshot(leftOpts);
    const right = snapshot(rightOpts);
    const ids = new Set([...left.entityById.keys(), ...right.entityById.keys()]);
    const rows = [];
    ids.forEach((id) => {
      const a = left.entityById.get(id) || null;
      const b = right.entityById.get(id) || null;
      const av = flattenComparable(a);
      const bv = flattenComparable(b);
      const fields = Object.keys({ ...av, ...bv });
      const changes = fields.filter((field) => stable(av[field]) !== stable(bv[field])).map((field) => ({
        path: field === "status" ? "status" : `data.${field}`,
        field,
        before: clone(av[field]),
        after: clone(bv[field]),
      }));
      if (changes.length || !a || !b) rows.push({
        entityId: id,
        entityType: b?.type || a?.type,
        entityName: b?.name || a?.name || id,
        before: a,
        after: b,
        changes,
        kind: !a ? "created" : !b ? "removed" : "changed",
      });
    });
    return {
      left,
      right,
      rows,
      changedEntityCount: rows.length,
      changedFieldCount: rows.reduce((sum, row) => sum + row.changes.length, 0),
      generatedAt: nowIso(),
    };
  }

  async function createBranch({ name, description = "", fromAnchor = { type: "current", id: "current", label: "Current" }, parentBranchId = "canonical" } = {}) {
    const store = loadStoreSync();
    const context = chapterContext();
    const branch = {
      id: uuid("branch"),
      name: name || `Alternative ${store.branches.length + 1}`,
      description,
      parentBranchId,
      forkAnchor: clone(fromAnchor),
      forkIndex: anchorIndex(fromAnchor, context),
      status: "draft",
      reviewIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.branches.unshift(branch);
    await saveStore(store);
    return branch;
  }

  async function updateBranch(branchId, patch = {}) {
    const store = loadStoreSync();
    let updated = null;
    store.branches = store.branches.map((branch) => {
      if (branch.id !== branchId) return branch;
      updated = { ...branch, ...clone(patch), updatedAt: nowIso() };
      return updated;
    });
    await saveStore(store);
    return updated;
  }

  async function addBranchDelta({ branchId, entityId, entityType = null, path, after, op = "set", anchor = null, kind = "branch-change", sourceQuote = "", relatedEntityIds = [] } = {}) {
    const store = loadStoreSync();
    const branch = branchById(branchId, store);
    if (!branch) throw new Error("Choose a valid branch before adding a change.");
    const effectiveAnchor = anchor || branch.forkAnchor || { type: "current", id: "current", label: "Current" };
    const context = chapterContext();
    const beforeSnapshot = snapshot({ anchor: effectiveAnchor, branchId });
    const entity = beforeSnapshot.entityById.get(entityId);
    if (!entity) throw new Error("The selected entity does not exist at this branch point.");
    const delta = {
      id: uuid("branch-delta"),
      branchId,
      entityId,
      entityType: entity.type || entityType,
      entityName: entity.name,
      path,
      op,
      before: clone(readPath(entity, path)),
      after: clone(after),
      kind,
      anchor: clone(effectiveAnchor),
      anchorIndex: anchorIndex(effectiveAnchor, context),
      chapterId: effectiveAnchor.type === "chapter" ? effectiveAnchor.id : null,
      sourceQuote,
      relatedEntityIds: uniq(relatedEntityIds),
      accepted: false,
      provenance: "branch-sandbox",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.deltas.push(delta);
    store.branches = store.branches.map((row) => row.id === branchId ? { ...row, updatedAt: nowIso() } : row);
    await saveStore(store);
    return delta;
  }

  async function removeBranchDelta(deltaId) {
    const store = loadStoreSync();
    const found = store.deltas.find((delta) => delta.id === deltaId) || null;
    store.deltas = store.deltas.filter((delta) => delta.id !== deltaId);
    await saveStore(store);
    return found;
  }

  async function discardBranch(branchId) {
    const store = loadStoreSync();
    const branch = branchById(branchId, store);
    store.branches = store.branches.filter((row) => row.id !== branchId);
    store.deltas = store.deltas.filter((delta) => delta.branchId !== branchId);
    await saveStore(store);
    return branch;
  }

  function patchFromDeltas(deltas) {
    const suggestedChanges = {};
    const payloadData = {};
    deltas.forEach((delta) => {
      const path = pathParts(delta.path);
      if (path[0] === "data" && path.length === 2) {
        suggestedChanges[path[1]] = clone(delta.after);
        payloadData[path[1]] = clone(delta.after);
      } else if (path.length === 1) {
        suggestedChanges[path[0]] = clone(delta.after);
      } else {
        payloadData[path.slice(path[0] === "data" ? 1 : 0).join(".")] = clone(delta.after);
      }
    });
    return { suggestedChanges, payloadData };
  }

  async function commitBranchToReview(branchId) {
    const store = loadStoreSync();
    const branch = branchById(branchId, store);
    if (!branch) throw new Error("Branch not found.");
    const deltas = store.deltas.filter((delta) => delta.branchId === branchId);
    if (!deltas.length) throw new Error("This branch has no changes to propose.");
    const byEntity = deltas.reduce((map, delta) => {
      const rows = map.get(delta.entityId) || [];
      rows.push(delta);
      map.set(delta.entityId, rows);
      return map;
    }, new Map());
    const reviewIds = [];
    for (const [entityId, rows] of byEntity.entries()) {
      const entity = backend.EntityService.getSync(entityId, rows[0].entityType);
      if (!entity) continue;
      const { suggestedChanges, payloadData } = patchFromDeltas(rows);
      const review = await backend.ReviewService.add({
        id: uuid("branch-review"),
        entityType: entity.type,
        name: `${branch.name} · ${entity.name}`,
        status: "pending",
        existingEntityId: entity.id,
        targetEntityId: entity.id,
        suggestedAction: "update",
        suggestedChanges,
        payload: {
          name: entity.name,
          data: payloadData,
          branchProposal: {
            branchId,
            branchName: branch.name,
            forkAnchor: clone(branch.forkAnchor),
            deltaIds: rows.map((delta) => delta.id),
          },
        },
        relatedEntityIds: uniq(rows.flatMap((delta) => delta.relatedEntityIds || [])),
        sourceQuote: rows.map((delta) => delta.sourceQuote).filter(Boolean).join(" | "),
        reason: `Commit ${rows.length} tested branch ${rows.length === 1 ? "change" : "changes"} from ${branch.name}.`,
        trackingKind: "branch-commit",
        worldStateBranchId: branchId,
        worldStateDeltaIds: rows.map((delta) => delta.id),
        chapterId: rows.map((delta) => delta.chapterId).filter(Boolean).sort().slice(-1)[0] || null,
        confidence: 1,
        confidenceBand: "blue",
      });
      if (review?.id) reviewIds.push(review.id);
    }
    await updateBranch(branchId, { status: "proposed", reviewIds });
    window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: `${branch.name} sent ${reviewIds.length} proposal${reviewIds.length === 1 ? "" : "s"} to Impact Review.` } }));
    return reviewIds;
  }

  function retconImpact({ entityId, path, anchor = { type: "current", id: "current" }, after, branchId = "canonical" } = {}) {
    const context = chapterContext();
    const cutoff = anchorIndex(anchor, context);
    const canonical = canonicalDeltas();
    const story = backend.StoryIntelligenceService || window.StoryIntelligenceService;
    const storySnapshot = story?.buildSnapshot?.() || null;
    const target = storySnapshot?.entityById?.get(entityId) || backend.EntityService.getSync(entityId);
    if (!target) return null;
    const linkedIds = new Set([
      ...(storySnapshot?.linksByEntity?.get(entityId) || []),
      ...(storySnapshot?.backlinks?.get(entityId) || []),
    ]);
    const laterDeltas = canonical.filter((delta) => delta.chapterIndex > cutoff && (delta.entityId === entityId || linkedIds.has(delta.entityId) || delta.relatedEntityIds?.includes(entityId)));
    const occurrences = (backend.OccurrenceService?.listAllSync?.() || []).filter((occurrence) => {
      const index = context.chapterIndex.get(occurrence.chapterId) ?? CURRENT_INDEX;
      return index > cutoff && (occurrence.entityId === entityId || linkedIds.has(occurrence.entityId) || occurrence.coMentionedEntityIds?.includes(entityId));
    });
    const reviews = (backend.ImpactReviewService?.listAllReviewSync?.() || backend.ReviewService?.listSync?.() || []).filter((review) => {
      const ids = [review.entityId, review.existingEntityId, review.targetEntityId, ...(review.relatedEntityIds || [])].filter(Boolean);
      return ids.includes(entityId) || ids.some((id) => linkedIds.has(id));
    });
    const chapterIds = uniq([
      ...laterDeltas.map((delta) => delta.chapterId),
      ...occurrences.map((occurrence) => occurrence.chapterId),
      ...reviews.map((review) => review.chapterId),
    ]).filter(Boolean).sort((a, b) => (context.chapterIndex.get(a) ?? CURRENT_INDEX) - (context.chapterIndex.get(b) ?? CURRENT_INDEX));
    const affectedIds = uniq([entityId, ...laterDeltas.map((delta) => delta.entityId), ...occurrences.map((occurrence) => occurrence.entityId), ...reviews.flatMap((review) => review.relatedEntityIds || [])]);
    const score = laterDeltas.length * 4 + chapterIds.length * 2 + occurrences.length + reviews.length * 2 + linkedIds.size;
    const severity = score >= 28 ? "critical" : score >= 15 ? "high" : score >= 6 ? "medium" : "low";
    return {
      entity: entityRef(target),
      path,
      before: clone(readPath(target, path)),
      after: clone(after),
      anchor: clone(anchor),
      branchId,
      severity,
      score,
      laterDeltas,
      occurrences,
      reviews,
      chapterIds,
      chapters: chapterIds.map((id) => context.chapterById.get(id)).filter(Boolean),
      affectedEntityIds: affectedIds,
      affectedEntities: affectedIds.map((id) => storySnapshot?.entityById?.get(id) || backend.EntityService.getSync(id)).filter(Boolean).map(entityRef),
      reasons: [
        laterDeltas.length ? `${laterDeltas.length} later accepted state ${laterDeltas.length === 1 ? "change depends" : "changes depend"} on this history.` : null,
        occurrences.length ? `${occurrences.length} later manuscript ${occurrences.length === 1 ? "reference may" : "references may"} need revision.` : null,
        reviews.length ? `${reviews.length} existing review ${reviews.length === 1 ? "decision is" : "decisions are"} linked to the affected graph.` : null,
        linkedIds.size ? `${linkedIds.size} canonical linked ${linkedIds.size === 1 ? "record" : "records"} should be rechecked.` : null,
      ].filter(Boolean),
      generatedAt: nowIso(),
    };
  }

  async function proposeRetcon(args = {}) {
    const impact = retconImpact(args);
    if (!impact) throw new Error("Could not analyse this retcon.");
    const entity = backend.EntityService.getSync(args.entityId);
    const path = pathParts(args.path);
    const field = path[path.length - 1];
    const review = await backend.ReviewService.add({
      id: uuid("retcon-review"),
      entityType: entity.type,
      name: `Retcon · ${entity.name} · ${field}`,
      status: "pending",
      existingEntityId: entity.id,
      targetEntityId: entity.id,
      suggestedAction: "update",
      suggestedChanges: { [field]: clone(args.after) },
      payload: {
        name: entity.name,
        data: { [field]: clone(args.after) },
        retconImpact: {
          severity: impact.severity,
          score: impact.score,
          anchor: clone(args.anchor),
          affectedEntityIds: impact.affectedEntityIds,
          chapterIds: impact.chapterIds,
        },
      },
      relatedEntityIds: impact.affectedEntityIds.filter((id) => id !== entity.id),
      reason: impact.reasons.join(" ") || "Historical state retcon.",
      trackingKind: "retcon",
      worldStateRetcon: true,
      sourceQuote: args.sourceQuote || "",
      chapterId: args.anchor?.type === "chapter" ? args.anchor.id : null,
      confidence: 1,
      confidenceBand: "blue",
    });
    return { review, impact };
  }

  function relationshipTrajectory(entityOrRelationshipId, opts = {}) {
    const snap = entitySnapshot();
    const context = chapterContext();
    const relationships = snap.entities.filter((entity) => entity.type === "relationships" && (
      entity.id === entityOrRelationshipId
      || entity.data?.fromId === entityOrRelationshipId
      || entity.data?.toId === entityOrRelationshipId
      || entity.fromId === entityOrRelationshipId
      || entity.toId === entityOrRelationshipId
    ));
    const rows = [];
    relationships.forEach((relationship) => {
      const data = relationship.data || {};
      const markers = [
        ...(data.markers || []), ...(data.relationshipMarkers || []), ...(data.markerHistory || []), ...(data.relationshipHistory || []),
      ];
      markers.forEach((marker, index) => {
        const anchor = anchorForRecord(marker, context);
        rows.push({
          id: marker.id || `${relationship.id}-marker-${index}`,
          relationship: entityRef(relationship),
          fromId: data.fromId || relationship.fromId,
          toId: data.toId || relationship.toId,
          marker: clone(marker),
          type: marker.type || marker.label || data.relationshipType || relationship.relationshipType || "relationship",
          polarity: marker.polarity || null,
          value: marker.value ?? marker.strength ?? null,
          sourceQuote: marker.sourceQuote || "",
          ...anchor,
        });
      });
    });
    rows.sort((a, b) => a.chapterIndex - b.chapterIndex || String(a.id).localeCompare(String(b.id)));
    const cutoff = anchorIndex(opts.anchor || { type: "current", id: "current" }, context);
    return {
      relationships: relationships.map(entityRef),
      rows,
      visibleRows: rows.filter((row) => row.chapterIndex <= cutoff),
      futureRows: rows.filter((row) => row.chapterIndex > cutoff),
      byRelationship: rows.reduce((out, row) => {
        (out[row.relationship.id] = out[row.relationship.id] || []).push(row);
        return out;
      }, {}),
      cutoff,
    };
  }

  function timelineProjection(opts = {}) {
    const context = chapterContext();
    const deltas = canonicalDeltas();
    const store = loadStoreSync();
    const branchId = opts.branchId || "canonical";
    const branchRows = branchId === "canonical" ? [] : store.deltas.filter((delta) => delta.branchId === branchId);
    const snap = entitySnapshot();
    const events = snap.entities.filter((entity) => entity.type === "events" || entity.type === "timeline").map((entity) => {
      const anchor = anchorForRecord({ ...(entity.data || {}), chapterId: entity.chapterId || entity.data?.chapterId }, context);
      return { id: entity.id, kind: "event", label: entity.name, entity: entityRef(entity), ...anchor };
    });
    return context.chapters.map((chapter) => ({
      id: chapter.id,
      kind: "chapter",
      chapter,
      label: chapter.label,
      index: chapter.index,
      deltas: deltas.filter((delta) => delta.chapterId === chapter.id),
      branchDeltas: branchRows.filter((delta) => delta.chapterId === chapter.id),
      events: events.filter((event) => event.chapterId === chapter.id),
    })).concat([
      {
        id: "unplaced",
        kind: "unplaced",
        label: "Unplaced / current state",
        index: CURRENT_INDEX,
        deltas: deltas.filter((delta) => !delta.chapterId),
        branchDeltas: branchRows.filter((delta) => !delta.chapterId),
        events: events.filter((event) => !event.chapterId),
      },
    ]);
  }

  function summary(opts = {}) {
    const snap = snapshot(opts);
    const owners = new Map();
    const locations = new Map();
    const statuses = new Map();
    snap.entities.forEach((entity) => {
      const data = entity.data || {};
      const owner = data.currentOwner?.name || data.currentOwner || data.owner?.name || data.owner;
      const location = data.currentLocation?.name || data.currentLocation || data.location?.name || data.location;
      const status = data.currentStatus || data.status || entity.status;
      if (owner) owners.set(String(owner), (owners.get(String(owner)) || 0) + 1);
      if (location) locations.set(String(location), (locations.get(String(location)) || 0) + 1);
      if (status) statuses.set(String(status), (statuses.get(String(status)) || 0) + 1);
    });
    return {
      entityCount: snap.entities.length,
      changedEntityCount: snap.changedEntityIds.length,
      branchChangeCount: snap.branchDeltas.length,
      owners: [...owners.entries()].sort((a, b) => b[1] - a[1]),
      locations: [...locations.entries()].sort((a, b) => b[1] - a[1]),
      statuses: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
      snapshot: snap,
    };
  }

  const HistoricalWorldStateService = {
    version: VERSION,
    loadStoreSync,
    saveStore,
    chapterContext,
    entitySnapshot,
    canonicalDeltas,
    snapshot,
    summary,
    diffSnapshots,
    createBranch,
    updateBranch,
    addBranchDelta,
    removeBranchDelta,
    discardBranch,
    commitBranchToReview,
    retconImpact,
    proposeRetcon,
    relationshipTrajectory,
    timelineProjection,
    readPath,
    writePath,
    entityRef,
    anchorIndex,
  };

  backend.HistoricalWorldStateService = HistoricalWorldStateService;
  window.HistoricalWorldStateService = HistoricalWorldStateService;
  window.dispatchEvent(new CustomEvent("lw:historical-world-state-ready", { detail: { service: HistoricalWorldStateService } }));
})();
