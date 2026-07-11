// =====================================================================
// entity-dossier-history-rules.jsx — deterministic historical projection and
// deep comparison equality refinements over EntityDossierService.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.EntityDossierService;
  if (!service || service.__historyRulesInstalled) return;

  const originalBuild = service.build.bind(service);
  const originalCompare = service.compare.bind(service);
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const deepStable = (value) => {
    const seen = new WeakSet();
    const normalise = (input) => {
      if (input == null || typeof input !== "object") return input;
      if (seen.has(input)) return "[Circular]";
      seen.add(input);
      if (Array.isArray(input)) return input.map(normalise);
      return Object.keys(input).sort().reduce((out, key) => {
        if (["updatedAt", "createdAt", "id"].includes(key) && /^\w+-[0-9a-f-]{8,}$/i.test(String(input[key] || ""))) return out;
        out[key] = normalise(input[key]);
        return out;
      }, {});
    };
    try { return JSON.stringify(normalise(value)); } catch (_) { return String(value); }
  };

  function firstHistory(history, pattern) {
    return (history || []).find((row) => pattern.test(row.field || row.kind || "")) || null;
  }

  function latestAccepted(entity, key, fallbackKeys = []) {
    const data = entity?.data || {};
    if (data[key] != null) return clone(data[key]);
    if (entity?.[key] != null) return clone(entity[key]);
    for (const fallback of fallbackKeys) {
      if (data[fallback] != null) return clone(data[fallback]);
      if (entity?.[fallback] != null) return clone(entity[fallback]);
    }
    return null;
  }

  function earliestState(entity, history) {
    const firstLocation = firstHistory(history, /location/i);
    const firstOwnership = firstHistory(history, /ownership/i);
    const firstStatus = firstHistory(history, /status|condition/i);
    const firstFaction = firstHistory(history, /faction/i);
    return {
      status: clone(firstStatus?.raw?.previousStatus ?? firstStatus?.raw?.fromStatus ?? latestAccepted(entity, "status", ["currentStatus"])),
      location: clone(firstLocation?.raw?.from ?? firstLocation?.raw?.previousLocation ?? latestAccepted(entity, "currentLocation", ["location"])),
      owner: clone(firstOwnership?.raw?.from ?? firstOwnership?.raw?.previousOwner ?? latestAccepted(entity, "currentOwner", ["owner"])),
      condition: clone(firstStatus?.raw?.previousCondition ?? latestAccepted(entity, "condition")),
      faction: clone(firstFaction?.raw?.previousFaction ?? latestAccepted(entity, "faction", ["affiliation"])),
    };
  }

  function applyHistory(state, row) {
    const raw = row.raw || {};
    const field = String(row.field || row.kind || "");
    if (/location/i.test(field)) state.location = clone(raw.to ?? raw.location ?? row.to ?? state.location);
    if (/ownership/i.test(field)) state.owner = clone(raw.to ?? raw.currentOwner ?? row.to ?? null);
    if (/status|condition/i.test(field)) {
      if (raw.status != null) state.status = clone(raw.status);
      if (raw.condition != null) state.condition = clone(raw.condition);
    }
    if (/faction/i.test(field)) state.faction = clone(raw.faction ?? row.to ?? state.faction);
    return state;
  }

  function reproject(dossier, asOfChapterId) {
    if (!dossier?.evolution) return dossier;
    if (!asOfChapterId) {
      dossier.evolution.state = {
        status: latestAccepted(dossier.entity, "status", ["currentStatus"]),
        location: latestAccepted(dossier.entity, "currentLocation", ["location"]),
        owner: latestAccepted(dossier.entity, "currentOwner", ["owner"]),
        condition: latestAccepted(dossier.entity, "condition"),
        faction: latestAccepted(dossier.entity, "faction", ["affiliation"]),
      };
      return dossier;
    }
    const context = service.manuscriptContext();
    const cutoff = context.chapterIndex.get(asOfChapterId);
    const state = earliestState(dossier.entity, dossier.history);
    (dossier.history || [])
      .filter((row) => row.chapterIndex <= (cutoff ?? Number.MAX_SAFE_INTEGER))
      .forEach((row) => applyHistory(state, row));
    dossier.evolution.state = state;
    dossier.evolution.cutoffChapterId = asOfChapterId;
    dossier.evolution.cutoffIndex = cutoff ?? Number.MAX_SAFE_INTEGER;
    dossier.evolution.visibleHistory = (dossier.history || []).filter((row) => row.chapterIndex <= dossier.evolution.cutoffIndex);
    dossier.evolution.visibleEvidence = (dossier.evidence || []).filter((row) => row.chapterIndex <= dossier.evolution.cutoffIndex);
    dossier.evolution.rows = (dossier.evolution.rows || []).map((row) => ({ ...row, active: row.index <= dossier.evolution.cutoffIndex }));
    return dossier;
  }

  service.build = function buildWithHistoricalProjection(entityOrId, type, opts = {}) {
    return reproject(originalBuild(entityOrId, type, opts), opts.asOfChapterId || null);
  };

  service.compare = function compareWithDeepEquality(entityRefs = [], opts = {}) {
    const comparison = originalCompare(entityRefs, opts);
    comparison.rows = (comparison.rows || []).map((row) => {
      const signatures = [...new Set(row.values.map((value) => deepStable(value.raw)))];
      return { ...row, same: signatures.length <= 1 };
    });
    comparison.differenceCount = comparison.rows.filter((row) => !row.same).length;
    comparison.sameCount = comparison.rows.filter((row) => row.same).length;
    return comparison;
  };

  service.__historyRulesInstalled = true;
})();
