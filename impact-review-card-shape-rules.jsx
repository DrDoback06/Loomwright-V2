// =====================================================================
// impact-review-card-shape-rules.jsx — bridge the existing review-card
// display contract with the full raw review item needed by Impact Review.
//
// ReviewQueueCard historically receives candidateToCardItem(raw), while the
// Impact service needs suggestedChanges, relatedEntityIds, previousState,
// decision metadata, and receipts. This adapter returns one enriched object
// containing both shapes so no existing rendering/action contract is lost.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.ImpactReviewService;
  if (!service || service.__cardShapeRulesInstalled) return;

  const originalGetItemSync = service.getItemSync.bind(service);

  function enrich(raw) {
    if (!raw) return null;
    let card = {};
    try {
      if (typeof candidateToCardItem === "function") card = candidateToCardItem(raw) || {};
    } catch (_) {}

    return {
      ...raw,
      ...card,
      // Raw decision data remains authoritative when the display normaliser
      // does not expose it.
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
      // Keep the untouched persisted row available for diagnostics without
      // creating another source of truth.
      __rawReviewItem: raw,
    };
  }

  service.getItemSync = function getEnrichedImpactReviewItem(id) {
    return enrich(originalGetItemSync(id));
  };
  service.enrichCardItem = enrich;
  service.__cardShapeRulesInstalled = true;
})();
