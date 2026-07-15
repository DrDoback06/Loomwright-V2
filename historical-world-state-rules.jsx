// =====================================================================
// historical-world-state-rules.jsx — branch-lineage and projection parity.
//
// The base service reconstructs canonical history and supports one sandbox
// branch. This layer makes nested branches inherit their parent deltas, and
// ensures comparison/timeline callers use the same public snapshot semantics.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.HistoricalWorldStateService;
  if (!service || service.__lineageRulesInstalled) return;

  const CURRENT_INDEX = Number.MAX_SAFE_INTEGER;
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const stableRecord = (value) => {
    if (value == null) return "null";
    if (typeof value !== "object") return String(value).trim().toLowerCase();
    return value.id || [
      value.chapterId || value.sourceChapterId || "",
      value.status || value.state || value.kind || value.type || "",
      String(value.statement || value.action || value.title || value.sourceQuote || value.name || "").trim().toLowerCase(),
      value.to?.id || value.from?.id || value.entityId || "",
    ].join("|");
  };
  const pathParts = (path) => String(path || "").split(".").filter(Boolean);

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

  function applyDelta(entity, delta) {
    if (!entity) return;
    if (delta.op === "append") {
      const current = service.readPath(entity, delta.path);
      const next = Array.isArray(current) ? [...current] : [];
      if (!next.some((row) => stableRecord(row) === stableRecord(delta.after))) next.push(clone(delta.after));
      service.writePath(entity, delta.path, next);
      return;
    }
    if (delta.op === "remove") {
      const current = service.readPath(entity, delta.path);
      const next = Array.isArray(current) ? [...current] : [];
      const key = stableRecord(delta.before);
      const index = next.findIndex((row) => stableRecord(row) === key);
      if (index >= 0) next.splice(index, 1);
      service.writePath(entity, delta.path, next);
      return;
    }
    if (delta.after === undefined) removePath(entity, delta.path);
    else service.writePath(entity, delta.path, delta.after);
  }

  function lineage(branchId, store = service.loadStoreSync()) {
    if (!branchId || branchId === "canonical") return [];
    const byId = new Map((store.branches || []).map((branch) => [branch.id, branch]));
    const rows = [];
    const seen = new Set();
    let cursor = byId.get(branchId) || null;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      rows.unshift(cursor);
      cursor = cursor.parentBranchId && cursor.parentBranchId !== "canonical"
        ? byId.get(cursor.parentBranchId) || null
        : null;
    }
    return rows;
  }

  const baseSnapshot = service.snapshot.bind(service);
  const baseTimelineProjection = service.timelineProjection.bind(service);

  service.snapshot = function snapshotWithLineage(opts = {}) {
    const branchId = opts.branchId && opts.branchId !== "canonical" ? opts.branchId : "canonical";
    if (branchId === "canonical") return baseSnapshot({ ...opts, branchId: "canonical" });

    const canonical = baseSnapshot({ ...opts, branchId: "canonical" });
    const store = service.loadStoreSync();
    const branches = lineage(branchId, store);
    const cutoff = canonical.cutoffIndex ?? CURRENT_INDEX;
    const branchIds = new Set(branches.map((branch) => branch.id));
    const deltas = (store.deltas || [])
      .filter((delta) => branchIds.has(delta.branchId) && (delta.anchorIndex ?? CURRENT_INDEX) <= cutoff)
      .sort((a, b) => {
        const branchOrder = branches.findIndex((branch) => branch.id === a.branchId) - branches.findIndex((branch) => branch.id === b.branchId);
        return branchOrder || (a.anchorIndex ?? CURRENT_INDEX) - (b.anchorIndex ?? CURRENT_INDEX) || String(a.id).localeCompare(String(b.id));
      });

    deltas.forEach((delta) => applyDelta(canonical.entityById.get(delta.entityId), delta));
    canonical.branchId = branchId;
    canonical.branch = branches[branches.length - 1] || null;
    canonical.branchLineage = branches;
    canonical.branchDeltas = deltas;
    canonical.changedEntityIds = [...new Set([...(canonical.changedEntityIds || []), ...deltas.map((delta) => delta.entityId)])];
    return canonical;
  };

  service.diffSnapshots = function diffSnapshotsWithLineage(leftOpts = {}, rightOpts = {}) {
    const left = service.snapshot(leftOpts);
    const right = service.snapshot(rightOpts);
    const ids = new Set([...left.entityById.keys(), ...right.entityById.keys()]);
    const rows = [];
    const comparable = (entity) => {
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
    };
    const stable = (value) => {
      const seen = new WeakSet();
      const sort = (input) => {
        if (input == null || typeof input !== "object") return input;
        if (seen.has(input)) return "[Circular]";
        seen.add(input);
        if (Array.isArray(input)) return input.map(sort);
        return Object.keys(input).sort().reduce((out, key) => { out[key] = sort(input[key]); return out; }, {});
      };
      try { return JSON.stringify(sort(value)); } catch (_) { return String(value); }
    };
    ids.forEach((id) => {
      const beforeEntity = left.entityById.get(id) || null;
      const afterEntity = right.entityById.get(id) || null;
      const before = comparable(beforeEntity);
      const after = comparable(afterEntity);
      const fields = Object.keys({ ...before, ...after });
      const changes = fields.filter((field) => stable(before[field]) !== stable(after[field])).map((field) => ({
        path: field === "status" ? "status" : `data.${field}`,
        field,
        before: clone(before[field]),
        after: clone(after[field]),
      }));
      if (changes.length || !beforeEntity || !afterEntity) rows.push({
        entityId: id,
        entityType: afterEntity?.type || beforeEntity?.type,
        entityName: afterEntity?.name || beforeEntity?.name || id,
        before: beforeEntity,
        after: afterEntity,
        changes,
        kind: !beforeEntity ? "created" : !afterEntity ? "removed" : "changed",
      });
    });
    return {
      left,
      right,
      rows,
      changedEntityCount: rows.length,
      changedFieldCount: rows.reduce((sum, row) => sum + row.changes.length, 0),
      generatedAt: new Date().toISOString(),
    };
  };

  service.timelineProjection = function timelineProjectionWithLineage(opts = {}) {
    const rows = baseTimelineProjection({ ...opts, branchId: "canonical" });
    const store = service.loadStoreSync();
    const branches = lineage(opts.branchId, store);
    if (!branches.length) return rows;
    const branchIds = new Set(branches.map((branch) => branch.id));
    const deltas = (store.deltas || []).filter((delta) => branchIds.has(delta.branchId));
    return rows.map((row) => ({
      ...row,
      branchDeltas: deltas.filter((delta) => row.id === "unplaced" ? !delta.chapterId : delta.chapterId === row.id),
      branchLineage: branches,
    }));
  };

  service.branchLineage = lineage;
  service.__lineageRulesInstalled = true;
})();
