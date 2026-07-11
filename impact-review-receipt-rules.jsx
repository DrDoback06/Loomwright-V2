// =====================================================================
// impact-review-receipt-rules.jsx — occurrence-aware acceptance receipts,
// review-card compatibility, receipt-surface persistence, and display polish.
//
// The base ImpactReviewService captures entity mutations. Extraction accept
// can also rebind manuscript occurrences from a candidate to the accepted
// entity, so this refinement records and restores those exact occurrence
// changes without replacing the existing service or occurrence store.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.ImpactReviewService;
  if (!service || service.__occurrenceReceiptsInstalled) return;

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const stable = (value) => {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  };
  const occurrenceKey = backend.keys.occurrences;
  const originalAccept = service.acceptWithReceipt.bind(service);
  const originalSafety = service.receiptSafety.bind(service);
  const originalRevert = service.revertAcceptance.bind(service);
  const originalGetItemSync = service.getItemSync.bind(service);
  const originalAnalyse = service.analyse.bind(service);
  const originalDecoratePanel = backend.EntityService.decoratePanel.bind(backend.EntityService);

  function occurrenceId(row, index) {
    return row?.occurrenceId || row?.id || `${row?.chapterId || "chapter"}:${row?.startOffset ?? index}:${row?.candidateId || row?.entityId || "mention"}`;
  }

  function occurrenceSnapshot() {
    return clone(backend.StorageService.getSync(occurrenceKey, []) || []);
  }

  function diffOccurrences(beforeRows, afterRows) {
    const before = new Map((beforeRows || []).map((row, index) => [occurrenceId(row, index), row]));
    const after = new Map((afterRows || []).map((row, index) => [occurrenceId(row, index), row]));
    const ids = new Set([...before.keys(), ...after.keys()]);
    const changes = [];
    for (const id of ids) {
      const a = before.get(id) || null;
      const b = after.get(id) || null;
      if (stable(a) === stable(b)) continue;
      changes.push({ id, before: clone(a), after: clone(b), kind: !a ? "created" : !b ? "deleted" : "updated" });
    }
    return changes;
  }

  async function restoreOccurrences(changes) {
    if (!changes?.length) return;
    const current = await backend.StorageService.get(occurrenceKey, []);
    const map = new Map((current || []).map((row, index) => [occurrenceId(row, index), row]));
    for (const change of [...changes].reverse()) {
      if (change.before == null) map.delete(change.id);
      else map.set(change.id, clone(change.before));
    }
    const restored = [...map.values()];
    await backend.StorageService.set(occurrenceKey, restored);
    window.dispatchEvent(new CustomEvent("lw:occurrence-store-updated", { detail: { occurrences: restored } }));
    window.dispatchEvent(new CustomEvent("lw:occurrences-updated", { detail: { occurrences: restored } }));
  }

  function enrichReviewCardShape(raw) {
    if (!raw) return null;
    let card = {};
    try {
      if (typeof candidateToCardItem === "function") card = candidateToCardItem(raw) || {};
    } catch (_) {}
    return {
      ...raw,
      ...card,
      id: raw.id || card.id,
      entityType: raw.entityType || raw.type || card.entityType || card.type,
      status: raw.status || card.status || "pending",
      suggestedChanges: raw.suggestedChanges,
      relatedEntityIds: raw.relatedEntityIds,
      previousState: raw.previousState,
      existingEntityId: raw.existingEntityId,
      targetEntityId: raw.targetEntityId,
      candidateId: raw.candidateId,
      payload: raw.payload,
      decision: raw.decision,
      scenarioIds: raw.scenarioIds,
      impactReceipt: raw.impactReceipt,
      sourceQuote: raw.sourceQuote || card.sourceQuote || card.mention,
      sourceQuotes: raw.sourceQuotes,
      chapterId: raw.chapterId,
      paragraphId: raw.paragraphId,
      matchType: raw.matchType,
      __rawReviewItem: raw,
    };
  }

  function sentenceFieldLabel(key) {
    const spaced = String(key || "field")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim()
      .toLowerCase();
    return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : "Field";
  }

  // ReviewQueueCard expects candidateToCardItem(raw), while Impact Review needs
  // the untouched fields used for impact and reversion. Return both shapes in
  // one object so the original renderer and every original action stay intact.
  service.getItemSync = function getEnrichedImpactReviewItem(id) {
    return enrichReviewCardShape(originalGetItemSync(id));
  };
  service.enrichCardItem = enrichReviewCardShape;

  // Preserve a stable machine field key for tests/integrations while providing
  // sentence-style labels such as “Current owner” in the visible comparison.
  service.analyse = function analyseWithDisplayLabels(itemOrId) {
    const analysis = originalAnalyse(itemOrId);
    if (!analysis) return analysis;
    return {
      ...analysis,
      changes: (analysis.changes || []).map((change) => ({
        ...change,
        fieldKey: change.fieldKey || change.key,
        key: sentenceFieldLabel(change.key),
      })),
    };
  };

  service.acceptWithReceipt = async function occurrenceAwareAccept(itemOrId, acceptFn) {
    const item = typeof itemOrId === "string" ? service.getItemSync(itemOrId) : itemOrId;
    const beforeOccurrences = occurrenceSnapshot();
    const updated = await originalAccept(item, acceptFn);
    const afterOccurrences = occurrenceSnapshot();
    const occurrenceChanges = diffOccurrences(beforeOccurrences, afterOccurrences);
    if (!updated?.id) return updated;
    const receiptUpdated = await service.updateItem(updated.id, (current) => ({
      ...current,
      impactReceipt: {
        ...(current.impactReceipt || {}),
        changedOccurrences: occurrenceChanges,
      },
    }));
    // AppShell refreshes panel decoration on entity-store updates. The original
    // Accept path may emit that event before this complete receipt exists, so
    // issue one final refresh only after entity + occurrence receipt data is
    // committed. This does not create another store or mutate entity content.
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated", {
      detail: { reason: "impact-receipt-complete", reviewItemId: updated.id },
    }));
    return receiptUpdated;
  };

  service.receiptSafety = function occurrenceAwareSafety(itemOrId) {
    const item = typeof itemOrId === "string" ? service.getItemSync(itemOrId) : itemOrId;
    const base = originalSafety(item);
    const receipt = item?.impactReceipt;
    if (!receipt || receipt.revertedAt) return base;
    const current = occurrenceSnapshot();
    const map = new Map(current.map((row, index) => [occurrenceId(row, index), row]));
    const occurrenceConflicts = [];
    for (const change of receipt.changedOccurrences || []) {
      const row = map.get(change.id) || null;
      if (stable(row) !== stable(change.after || null)) {
        occurrenceConflicts.push({ id: change.id, type: "occurrence", name: change.after?.exactText || change.before?.exactText || change.id, expected: change.after, current: row });
      }
    }
    const conflicts = [...(base.conflicts || []), ...occurrenceConflicts];
    return {
      safe: base.safe && occurrenceConflicts.length === 0,
      reason: conflicts.length ? "Entities or manuscript occurrence links changed after acceptance." : "No later edits detected.",
      conflicts,
    };
  };

  service.revertAcceptance = async function occurrenceAwareRevert(itemOrId, opts = {}) {
    const item = typeof itemOrId === "string" ? service.getItemSync(itemOrId) : itemOrId;
    const receipt = clone(item?.impactReceipt || null);
    const safety = service.receiptSafety(item);
    if (!safety.safe && !opts.force) {
      const error = new Error("Later edits or occurrence changes were detected. Resolve them before forcing a revert.");
      error.code = "REVERT_CONFLICT";
      error.conflicts = safety.conflicts;
      throw error;
    }
    const updated = await originalRevert(item, { ...opts, force: true });
    await restoreOccurrences(receipt?.changedOccurrences || []);
    return updated;
  };

  // The original panel only mounts EntityReviewQueue while pending reviewItems
  // exist. Once Accept resolves the final card, that would also remove the new
  // receipt history. Add resolved receipt rows only as a mount signal; keep the
  // original queueCount/subtitle untouched so receipts never masquerade as
  // pending work. ImpactEntityReviewQueue separately filters active cards and
  // renders these rows only inside ReceiptHistory.
  backend.EntityService.decoratePanel = function decoratePanelWithReceiptHistory(panel) {
    const decorated = originalDecoratePanel(panel);
    if (!panel?.entityType || !decorated) return decorated;
    const entityType = backend.EntityService.normaliseType(panel.entityType);
    const visible = Array.isArray(decorated.reviewItems) ? decorated.reviewItems : [];
    const visibleIds = new Set(visible.map((item) => item.id));
    const receipts = service.listAllReviewSync()
      .filter((item) => backend.EntityService.normaliseType(item.entityType || item.type) === entityType)
      .filter((item) => item.impactReceipt && !visibleIds.has(item.id));
    if (!receipts.length) return decorated;
    return { ...decorated, reviewItems: [...visible, ...receipts] };
  };

  service.diffOccurrences = diffOccurrences;
  service.__occurrenceReceiptsInstalled = true;
})();
