// =====================================================================
// impact-review-receipt-rules.jsx — occurrence-aware acceptance receipts.
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

  service.acceptWithReceipt = async function occurrenceAwareAccept(itemOrId, acceptFn) {
    const item = typeof itemOrId === "string" ? service.getItemSync(itemOrId) : itemOrId;
    const beforeOccurrences = occurrenceSnapshot();
    const updated = await originalAccept(item, acceptFn);
    const afterOccurrences = occurrenceSnapshot();
    const occurrenceChanges = diffOccurrences(beforeOccurrences, afterOccurrences);
    if (!updated?.id) return updated;
    return service.updateItem(updated.id, (current) => ({
      ...current,
      impactReceipt: {
        ...(current.impactReceipt || {}),
        changedOccurrences: occurrenceChanges,
      },
    }));
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

  service.diffOccurrences = diffOccurrences;
  service.__occurrenceReceiptsInstalled = true;
})();
