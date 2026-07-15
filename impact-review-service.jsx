// =====================================================================
// impact-review-service.jsx — Impact Review logic layered over the existing
// ReviewService, EntityService, AuditService, ReferencesService, and
// StoryIntelligenceService.
//
// No competing entity/review store is introduced. Decision metadata and
// reversible receipts live on the existing review item so project export,
// search, audit, and migration continue to see one source of truth.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend || backend.ImpactReviewService) return;

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const nowIso = () => backend.nowIso ? backend.nowIso() : new Date().toISOString();
  const reviewKey = backend.keys.reviewQueue;

  function listAllReviewSync() {
    return backend.StorageService.getSync(reviewKey, []) || [];
  }

  async function updateItem(id, patch) {
    if (!id) return null;
    const all = await backend.StorageService.get(reviewKey, []);
    let updated = null;
    const next = all.map((item) => {
      if (item.id !== id) return item;
      updated = {
        ...item,
        ...(typeof patch === "function" ? patch(clone(item)) : clone(patch || {})),
        updatedAt: nowIso(),
      };
      return updated;
    });
    await backend.StorageService.set(reviewKey, next);
    window.dispatchEvent(new CustomEvent("lw:review-queue-updated", { detail: { id, item: updated } }));
    window.dispatchEvent(new CustomEvent("lw:impact-review-updated", { detail: { id, item: updated } }));
    return updated;
  }

  function getItemSync(id) {
    return listAllReviewSync().find((item) => item.id === id) || null;
  }

  function entityStoreSnapshot() {
    return clone(backend.EntityService.listAllSync() || {});
  }

  function flattenEntityStore(store = {}) {
    const map = new Map();
    for (const [type, byId] of Object.entries(store || {})) {
      for (const entity of Object.values(byId || {})) {
        if (entity?.id) map.set(entity.id, { type: entity.type || type, entity: clone(entity) });
      }
    }
    return map;
  }

  function stable(value) {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function diffEntityStores(beforeStore, afterStore) {
    const before = flattenEntityStore(beforeStore);
    const after = flattenEntityStore(afterStore);
    const ids = new Set([...before.keys(), ...after.keys()]);
    const changes = [];
    for (const id of ids) {
      const a = before.get(id) || null;
      const b = after.get(id) || null;
      if (stable(a?.entity || null) === stable(b?.entity || null)) continue;
      changes.push({
        id,
        type: b?.type || a?.type || "generic",
        name: b?.entity?.name || a?.entity?.name || id,
        before: a?.entity || null,
        after: b?.entity || null,
        kind: !a ? "created" : !b ? "deleted" : "updated",
      });
    }
    return changes;
  }

  function shallowChangeRows(item) {
    const existingId = item?.existingEntityId || item?.targetEntityId || item?.entityId;
    const current = existingId ? backend.EntityService.getSync(existingId, item.entityType) : null;
    const proposed = item?.suggestedChanges || item?.payload || item?.candidate || {};
    const base = current?.data || current || {};
    const rows = [];
    for (const [key, after] of Object.entries(proposed || {})) {
      if (["id", "type", "entityType", "createdAt", "updatedAt"].includes(key)) continue;
      const before = base?.[key];
      if (stable(before) === stable(after)) continue;
      rows.push({ key, before: clone(before), after: clone(after) });
    }
    if (!current && !rows.length && item?.name) {
      rows.push({ key: "entity", before: null, after: { name: item.name, type: item.entityType } });
    }
    return rows;
  }

  function consequenceHints(item, impact) {
    const type = backend.EntityService.normaliseType(item?.entityType || item?.type || "");
    const keys = Object.keys(item?.suggestedChanges || item?.payload || {});
    const hints = [];
    if (type === "relationships" || keys.some((k) => /relationship|trust|conflict|affection|loyal/i.test(k))) {
      hints.push("Relationship history, character knowledge, and future scene context may change.");
    }
    if (type === "locations" || keys.some((k) => /location|route|travel|parent/i.test(k))) {
      hints.push("Atlas placement, travel routes, and chapter snapshots may change.");
    }
    if (type === "items" || keys.some((k) => /owner|ownership|equipped|condition|lost|found/i.test(k))) {
      hints.push("Ownership, equipment, location, and item-history views may change.");
    }
    if (type === "quests" || keys.some((k) => /quest|step|phase|goal|status/i.test(k))) {
      hints.push("Story-thread progress, Today guidance, and linked events may change.");
    }
    if (type === "events" || keys.some((k) => /event|consequence|cause|outcome|timeline/i.test(k))) {
      hints.push("Timeline ordering and downstream world-state consequences may change.");
    }
    if (type === "cast" || keys.some((k) => /knowledge|belief|secret|motive|goal|fear/i.test(k))) {
      hints.push("Character viewpoint, AI embodiment context, and continuity checks may change.");
    }
    if (impact?.knockOnCount > 0) {
      hints.push(`${impact.knockOnCount} indirectly linked ${impact.knockOnCount === 1 ? "record" : "records"} should be rechecked after the decision.`);
    }
    if (impact?.chapters?.length > 1) {
      hints.push(`Evidence or references span ${impact.chapters.length} chapters, so this is not an isolated edit.`);
    }
    return [...new Set(hints)];
  }

  function evidenceRows(item, impact) {
    const values = [
      item?.sourceQuote,
      item?.mention,
      ...(Array.isArray(item?.sourceQuotes) ? item.sourceQuotes : []),
      item?.payload?.sourceQuote,
      item?.candidate?.sourceQuote,
    ].filter(Boolean);
    const seen = new Set();
    return values.filter((text) => {
      const key = String(text).trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((quote, index) => ({
      id: `${item.id}-evidence-${index}`,
      quote,
      chapterId: item.chapterId || item.sourceChapter?.id || null,
      paragraphId: item.paragraphId || item.sourceParagraph || null,
      kind: item.matchType === "inferred" || item.payload?.inference ? "inference" : "manuscript",
    }));
  }

  function analyse(itemOrId) {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    if (!item) return null;
    const story = backend.StoryIntelligenceService || window.StoryIntelligenceService;
    const snapshot = story?.buildSnapshot?.();
    const impact = story?.buildReviewImpact?.(item, snapshot) || {
      direct: [], affected: [], knockOnCount: 0, chapters: [], score: 0, severity: "low",
      summary: "No linked records detected",
    };
    const changes = shallowChangeRows(item);
    const evidence = evidenceRows(item, impact);
    const hints = consequenceHints(item, impact);
    const sourceKind = item.matchType === "inferred" || item.payload?.inference
      ? "inferred"
      : item.payload?.detector || item.matchType === "exact"
        ? "explicit"
        : "suggested";
    return {
      item,
      impact,
      changes,
      evidence,
      hints,
      sourceKind,
      requiresDeliberateConfirm: impact.severity === "critical" || impact.severity === "high",
    };
  }

  async function postpone(itemOrId, reason = "Review later") {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    if (!item) return null;
    const updated = await updateItem(item.id, {
      status: "postponed",
      decision: {
        ...(item.decision || {}),
        status: "postponed",
        reason: reason || "Review later",
        postponedAt: nowIso(),
      },
    });
    try {
      backend.AuditService?.log?.({
        action: "review.postpone",
        label: `Postponed review: ${item.name || item.candidate?.name || item.id}`,
        targetType: "review",
        targetId: item.id,
        targetName: item.name || item.candidate?.name,
        entityType: item.entityType,
        before: item,
        after: updated,
        source: "ImpactReviewService",
        reversible: false,
      });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Review postponed. It remains visible in Impact Review." } }));
    return updated;
  }

  async function resume(itemOrId) {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    if (!item) return null;
    return updateItem(item.id, (current) => ({
      status: "pending",
      decision: {
        ...(current.decision || {}),
        status: "pending",
        resumedAt: nowIso(),
      },
    }));
  }

  async function createScenario(itemOrId, label) {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    if (!item) return null;
    const analysis = analyse(item);
    const name = item.name || item.candidate?.name || "Review decision";
    const scenario = await backend.ReferencesService.save({
      kind: "scenario",
      title: label || `Scenario · ${name}`,
      content: [
        `Alternative path created from review item ${item.id}.`,
        item.sourceQuote || item.mention ? `Evidence: ${item.sourceQuote || item.mention}` : "",
        analysis?.hints?.length ? `Possible consequences:\n- ${analysis.hints.join("\n- ")}` : "",
      ].filter(Boolean).join("\n\n"),
      linkedEntities: (analysis?.impact?.affected || []).map((entity) => ({ id: entity.id, name: entity.name, type: entity.type })),
      reviewScenario: {
        reviewItemId: item.id,
        proposedChanges: clone(item.suggestedChanges || item.payload || item.candidate || {}),
        impact: {
          severity: analysis?.impact?.severity,
          affectedEntityIds: (analysis?.impact?.affected || []).map((entity) => entity.id),
          chapterIds: (analysis?.impact?.chapters || []).map((chapter) => chapter.id),
        },
        createdAt: nowIso(),
        committed: false,
      },
      includedInAIContext: false,
    });
    await updateItem(item.id, (current) => ({
      status: "postponed",
      scenarioIds: [...new Set([...(current.scenarioIds || []), scenario.id])],
      decision: {
        ...(current.decision || {}),
        status: "scenario",
        scenarioId: scenario.id,
        scenarioCreatedAt: nowIso(),
      },
    }));
    try {
      backend.AuditService?.log?.({
        action: "review.scenario-create",
        label: `Created scenario from review: ${name}`,
        targetType: "review",
        targetId: item.id,
        targetName: name,
        entityType: item.entityType,
        relatedIds: [scenario.id],
        source: "ImpactReviewService",
        reversible: false,
      });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: `Scenario created: ${scenario.title}` } }));
    return scenario;
  }

  async function acceptWithReceipt(itemOrId, acceptFn) {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    if (!item || typeof acceptFn !== "function") return null;
    const analysis = analyse(item);
    const beforeStore = entityStoreSnapshot();
    const beforeItem = clone(getItemSync(item.id) || item);
    await Promise.resolve(acceptFn(item));
    const afterStore = entityStoreSnapshot();
    const changedEntities = diffEntityStores(beforeStore, afterStore);
    const receipt = {
      id: backend.uuid ? backend.uuid("receipt") : `receipt-${Date.now()}`,
      reviewItemId: item.id,
      acceptedAt: nowIso(),
      severity: analysis?.impact?.severity || "low",
      sourceKind: analysis?.sourceKind || "suggested",
      changedEntities,
      affectedEntityIds: (analysis?.impact?.affected || []).map((entity) => entity.id),
      affectedChapterIds: (analysis?.impact?.chapters || []).map((chapter) => chapter.id),
      evidence: clone(analysis?.evidence || []),
      revertedAt: null,
    };
    const updated = await updateItem(item.id, (current) => ({
      ...current,
      status: current.status === "done" ? "done" : current.status,
      impactReceipt: receipt,
      decision: {
        ...(current.decision || {}),
        status: "accepted",
        acceptedAt: receipt.acceptedAt,
        beforeReviewItem: beforeItem,
      },
    }));
    try {
      backend.AuditService?.log?.({
        action: "review.impact-receipt",
        label: `Recorded impact receipt: ${item.name || item.candidate?.name || item.id}`,
        targetType: "review",
        targetId: item.id,
        targetName: item.name || item.candidate?.name,
        entityType: item.entityType,
        before: beforeItem,
        after: updated,
        relatedIds: changedEntities.map((change) => change.id),
        metadata: { receiptId: receipt.id, severity: receipt.severity, changedCount: changedEntities.length },
        source: "ImpactReviewService",
        reversible: false,
      });
    } catch (_) {}
    return updated;
  }

  function receiptSafety(itemOrId) {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    const receipt = item?.impactReceipt;
    if (!receipt || receipt.revertedAt) return { safe: false, reason: "No active acceptance receipt.", conflicts: [] };
    const conflicts = [];
    for (const change of receipt.changedEntities || []) {
      const current = backend.EntityService.getSync(change.id, change.type);
      if (stable(current || null) !== stable(change.after || null)) {
        conflicts.push({ id: change.id, type: change.type, name: change.name, expected: change.after, current });
      }
    }
    return {
      safe: conflicts.length === 0,
      reason: conflicts.length ? "One or more affected entities changed after acceptance." : "No later edits detected.",
      conflicts,
    };
  }

  async function revertAcceptance(itemOrId, opts = {}) {
    const item = typeof itemOrId === "string" ? getItemSync(itemOrId) : itemOrId;
    const receipt = item?.impactReceipt;
    if (!item || !receipt || receipt.revertedAt) throw new Error("This review change has no active revert receipt.");
    const safety = receiptSafety(item);
    if (!safety.safe && !opts.force) {
      const error = new Error("Later edits were detected. Open the impact receipt and resolve them before forcing a revert.");
      error.code = "REVERT_CONFLICT";
      error.conflicts = safety.conflicts;
      throw error;
    }

    for (const change of [...(receipt.changedEntities || [])].reverse()) {
      if (change.before == null && change.after != null) {
        await backend.EntityService.delete(change.type, change.id, { hard: true, skipAudit: true });
      } else if (change.before != null) {
        await backend.EntityService.save(change.type, clone(change.before), {
          status: change.before.status || "active",
          skipAudit: true,
          sourceSurface: "impact-review-revert",
        });
      }
    }

    const revertedAt = nowIso();
    const updated = await updateItem(item.id, (current) => ({
      ...current,
      status: "pending",
      impactReceipt: { ...(current.impactReceipt || receipt), revertedAt },
      decision: {
        ...(current.decision || {}),
        status: "reverted",
        revertedAt,
      },
    }));
    try {
      backend.AuditService?.log?.({
        action: "review.impact-revert",
        label: `Reverted accepted review: ${item.name || item.candidate?.name || item.id}`,
        targetType: "review",
        targetId: item.id,
        targetName: item.name || item.candidate?.name,
        entityType: item.entityType,
        before: item,
        after: updated,
        relatedIds: (receipt.changedEntities || []).map((change) => change.id),
        metadata: { receiptId: receipt.id, forced: !!opts.force },
        source: "ImpactReviewService",
        reversible: false,
      });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Accepted change reverted and returned to review." } }));
    return updated;
  }

  function receiptHistory(type) {
    const normalType = type ? backend.EntityService.normaliseType(type) : null;
    return listAllReviewSync()
      .filter((item) => item.impactReceipt)
      .filter((item) => !normalType || backend.EntityService.normaliseType(item.entityType || item.type) === normalType)
      .sort((a, b) => String(b.impactReceipt?.acceptedAt || "").localeCompare(String(a.impactReceipt?.acceptedAt || "")));
  }

  const ImpactReviewService = {
    analyse,
    updateItem,
    getItemSync,
    listAllReviewSync,
    postpone,
    resume,
    createScenario,
    acceptWithReceipt,
    receiptSafety,
    revertAcceptance,
    receiptHistory,
    diffEntityStores,
  };

  backend.ImpactReviewService = ImpactReviewService;
  window.ImpactReviewService = ImpactReviewService;
  window.dispatchEvent(new CustomEvent("lw:impact-review-ready", { detail: { service: ImpactReviewService } }));
})();
