// =====================================================================
// narrative-tracking-pronoun-bridge.jsx
//
// NarrativeTrackingService exposes an enhanced public analyser with
// cross-sentence pronoun resolution. The original extraction wrapper closes
// over its private first-pass analyser, so this final bridge runs only the
// supplemental pronoun facts after the normal extraction completes and merges
// them into the same ReviewService, report, session history, and progress flow.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.NarrativeTrackingService;
  if (!backend?.ExtractionService || !service || service.__pronounBridgeInstalled) return;

  const originalRun = backend.ExtractionService.runExtraction.bind(backend.ExtractionService);
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const uniq = (list) => [...new Set((list || []).filter(Boolean))];
  const nowIso = () => backend.nowIso ? backend.nowIso() : new Date().toISOString();

  function isSupplemental(row) {
    return (row?.trackingFacts || []).some((fact) => fact?.detector === "cross-sentence-pronoun");
  }

  function addCount(report, fact) {
    report.counts = { ...(report.counts || {}) };
    report.counts[fact.kind] = (report.counts[fact.kind] || 0) + 1;
    if (["movement", "character-status", "ownership", "world-state", "item-state", "faction-membership"].includes(fact.kind)) report.stateChangeCount = (report.stateChangeCount || 0) + 1;
    if (["knowledge", "belief"].includes(fact.kind)) report.knowledgeCount = (report.knowledgeCount || 0) + 1;
    if (["promise", "unresolved-question"].includes(fact.kind)) report.promiseCount = (report.promiseCount || 0) + 1;
    if (fact.kind === "relationship") report.relationshipCount = (report.relationshipCount || 0) + 1;
    if (fact.kind === "contradiction") report.contradictionCount = (report.contradictionCount || 0) + 1;
  }

  backend.ExtractionService.runExtraction = async function runWithPronounBridge(args = {}) {
    const result = await originalRun(args);
    if (!result?.tracking || !args.text) return result;

    const analysed = service.analyseChapter({
      chapterId: args.chapterId,
      text: args.text,
      paragraphs: args.paragraphs || null,
      deep: !!args.deep,
      sessionId: result.tracking.sessionId,
    });
    const supplemental = (analysed.candidates || []).filter(isSupplemental);
    if (!supplemental.length) return result;

    const merged = await service.mergeIntoReview(supplemental);
    const existingFingerprints = new Set((result.tracking.facts || []).map((fact) => [
      fact.kind, fact.subject?.id || "", fact.object?.id || fact.location?.id || "", fact.sentenceIndex,
    ].join("|")));
    const newFacts = [];
    for (const row of merged) {
      for (const fact of row.trackingFacts || []) {
        if (fact.detector !== "cross-sentence-pronoun") continue;
        const fingerprint = [fact.kind, fact.subject?.id || "", fact.object?.id || fact.location?.id || "", fact.sentenceIndex].join("|");
        if (existingFingerprints.has(fingerprint)) continue;
        existingFingerprints.add(fingerprint);
        newFacts.push(fact);
      }
    }
    if (!newFacts.length) return result;

    const report = clone(result.tracking);
    report.facts = [...(report.facts || []), ...newFacts].slice(0, 80);
    report.candidateCount = (report.candidateCount || 0) + merged.length;
    report.reviewItemIds = uniq([...(report.reviewItemIds || []), ...merged.map((row) => row.id)]);
    report.affectedEntityIds = uniq([
      ...(report.affectedEntityIds || []),
      ...merged.flatMap((row) => row.relatedEntityIds || []),
      ...merged.map((row) => row.existingEntityId).filter(Boolean),
    ]);
    newFacts.forEach((fact) => addCount(report, fact));
    report.generatedAt = nowIso();

    const current = backend.ExtractionService.loadSessionSync() || result.session || {};
    const currentEntry = current.current ? {
      ...current.current,
      tracking: report,
      totals: {
        ...(current.current.totals || {}),
        candidates: ((current.current.totals || {}).candidates || 0) + merged.length,
      },
      note: `${report.stateChangeCount || 0} state changes · ${report.knowledgeCount || 0} knowledge/belief changes · ${report.promiseCount || 0} open threads · ${report.contradictionCount || 0} contradictions`,
    } : null;
    const history = (current.history || []).map((entry) => (
      (entry.sessionId || entry.id) === report.sessionId && currentEntry ? currentEntry : entry
    ));
    const next = {
      ...current,
      tracking: report,
      current: currentEntry || current.current,
      history,
      candidateCount: (current.candidateCount || 0) + merged.length,
      updatedAt: report.generatedAt,
    };
    await backend.ExtractionService.saveSession(next);

    result.tracking = report;
    result.session = next;
    result.candidates = [...(result.candidates || []), ...merged.filter((row) => !(result.candidates || []).some((existing) => existing.id === row.id))];
    result.candidateCount = result.candidates.length;

    try {
      args.onProgress?.({
        sessionId: report.sessionId,
        chapterId: args.chapterId,
        scope: args.scope || "chapter",
        stage: "pronoun-tracking",
        deep: !!args.deep,
        candidates: merged,
      });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("lw:extraction-progress", { detail: {
      sessionId: report.sessionId,
      chapterId: args.chapterId,
      scope: args.scope || "chapter",
      stage: "pronoun-tracking",
      deep: !!args.deep,
      candidates: merged,
    } }));
    window.dispatchEvent(new CustomEvent("lw:narrative-tracking-updated", { detail: { report, session: next } }));
    return result;
  };

  service.__pronounBridgeInstalled = true;
})();
