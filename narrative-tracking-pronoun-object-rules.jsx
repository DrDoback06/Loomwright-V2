// =====================================================================
// narrative-tracking-pronoun-object-rules.jsx
//
// Refines cross-sentence knowledge extraction for sentences such as:
//   “She suspected that Soren had lied.”
// A named cast entity after the knowledge verb is an object of the belief,
// not evidence that the pronoun subject is ambiguous.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.NarrativeTrackingService;
  if (!service || service.__pronounObjectRulesInstalled) return;

  const originalAnalyse = service.analyseChapter.bind(service);
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const normalise = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  const uniq = (list) => [...new Set((list || []).filter(Boolean))];
  const uuid = (prefix) => backend.uuid ? backend.uuid(prefix) : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nowIso = () => backend.nowIso ? backend.nowIso() : new Date().toISOString();
  const entityRef = (entity) => entity ? ({ id: entity.id, name: entity.name, type: entity.type }) : null;
  const confidenceBand = (value) => value >= 0.95 ? "blue" : value >= 0.75 ? "green" : value >= 0.5 ? "orange" : "red";

  function appendUnique(existing, value, keyFn) {
    const rows = Array.isArray(existing) ? clone(existing) : [];
    const key = keyFn(value);
    if (!rows.some((row) => keyFn(row) === key)) rows.push(clone(value));
    return rows;
  }

  function previousSingleCast(context, sentenceIndex) {
    for (let index = sentenceIndex - 1; index >= Math.max(0, sentenceIndex - 2); index--) {
      const sentence = context.sentences[index];
      if (!sentence) continue;
      const ids = uniq((context.mentionsBySentence.get(sentence.id) || [])
        .filter((row) => row.entityType === "cast")
        .map((row) => row.entityId));
      if (ids.length === 1) return context.index.byId.get(ids[0]) || null;
      if (ids.length > 1) return null;
    }
    return null;
  }

  function makeCandidate(context, sentence, actor, objectMentions, match, statement, state) {
    const confidence = 0.68;
    const field = state === "belief" || state === "suspicion" ? "beliefs" : "knowledgeClaims";
    const claim = {
      id: uuid("claim"),
      statement,
      state,
      certainty: "pronoun-resolved",
      chapterId: context.chapterId,
      sourceQuote: sentence.text.replace(/\s+/g, " ").trim(),
      extractionSessionId: context.sessionId,
      relatedEntityIds: objectMentions.map((row) => row.entityId),
    };
    const absoluteStart = sentence.start + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    const fact = {
      id: uuid("fact"),
      kind: field === "beliefs" ? "belief" : "knowledge",
      detector: "cross-sentence-pronoun",
      explicit: false,
      chapterId: context.chapterId,
      paragraphId: (context.paragraphs || []).find((row) => row.start <= absoluteStart && row.end >= absoluteStart)?.id || null,
      sentenceIndex: sentence.index,
      sceneIndex: 0,
      temporalAnchor: null,
      startOffset: absoluteStart,
      endOffset: absoluteEnd,
      sourceQuote: claim.sourceQuote,
      extractionSessionId: context.sessionId,
      createdAt: nowIso(),
      subject: entityRef(actor),
      object: objectMentions.length === 1 ? entityRef(objectMentions[0].entity) : null,
      predicate: match[0].toLowerCase(),
      statement,
      knowledgeState: state,
    };
    const fingerprint = [context.chapterId, fact.kind, actor.id, objectMentions.map((row) => row.entityId).join(","), normalise(`${fact.predicate}|${statement}`)].join("|");
    return {
      id: uuid("rq"),
      candidateId: uuid("cand"),
      entityType: "cast",
      name: actor.name,
      summary: `${actor.name} ${match[0].toLowerCase()} ${statement}; the subject is resolved from the previous sentence.`,
      suggestedAction: "update",
      confidence,
      confidenceBand: confidenceBand(confidence),
      matchType: "exact",
      existingEntityId: actor.id,
      targetEntityId: actor.id,
      sourceQuote: fact.sourceQuote,
      sourceQuotes: [fact.sourceQuote],
      chapterId: context.chapterId,
      paragraphId: fact.paragraphId,
      startOffset: fact.startOffset,
      endOffset: fact.endOffset,
      previousState: backend.EntityService.getSync(actor.id, "cast"),
      relatedEntityIds: uniq(objectMentions.map((row) => row.entityId)),
      suggestedChanges: {
        [field]: appendUnique(actor.data?.[field], claim, (row) => `${row.state}|${normalise(row.statement)}`),
        lastKnowledgeChange: claim,
      },
      payload: {
        name: actor.name,
        summary: `${actor.name} ${match[0].toLowerCase()} ${statement}.`,
        data: {
          trackingFact: clone(fact),
          provenance: {
            kind: fact.kind,
            explicit: false,
            detector: fact.detector,
            chapterId: context.chapterId,
            paragraphId: fact.paragraphId,
            extractionSessionId: context.sessionId,
            trackingVersion: service.version || 1,
          },
        },
      },
      reason: `${actor.name} ${match[0].toLowerCase()} ${statement}.`,
      action: "Narrative tracking",
      level: "tracking",
      value: Math.round(confidence * 100),
      extractionSessionId: context.sessionId,
      status: "pending",
      trackingKind: fact.kind,
      trackingFingerprint: fingerprint,
      trackingFacts: [clone(fact)],
      sentenceGroupId: `${context.chapterId}:${sentence.index}`,
    };
  }

  service.analyseChapter = function analysePronounKnowledgeObjects(args) {
    const result = originalAnalyse(args);
    const context = result.context;
    const existing = new Set((result.candidates || []).map((row) => row.trackingFingerprint));
    const additions = [];

    for (const sentence of context.sentences) {
      if (!/^\s*(?:he|she|they)\b/i.test(sentence.text)) continue;
      const actor = previousSingleCast(context, sentence.index);
      if (!actor) continue;
      const match = sentence.text.match(/\b(learned|discovered|realised|realized|knew|understood|remembered|believed|thought|assumed|suspected|doubted|forgot|heard)\b/i);
      if (!match) continue;
      const verbEnd = sentence.start + match.index + match[0].length;
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      const namedBeforeVerb = mentions.some((row) => row.entityType === "cast" && row.start < verbEnd);
      if (namedBeforeVerb) continue;
      const objectMentions = mentions.filter((row) => row.entityType === "cast" && row.start >= verbEnd && row.entityId !== actor.id);
      const statement = sentence.text.slice(match.index + match[0].length)
        .replace(/^\s*(?:that|how|why|whether|about)\s+/i, "")
        .replace(/[.!?]+$/, "").trim().slice(0, 220);
      if (statement.length < 4) continue;
      const verb = match[0].toLowerCase();
      const state = /believed|thought|assumed/.test(verb) ? "belief"
        : /suspected|doubted/.test(verb) ? "suspicion"
          : /forgot/.test(verb) ? "forgotten" : "known";
      const row = makeCandidate(context, sentence, actor, objectMentions, match, statement, state);
      if (!existing.has(row.trackingFingerprint)) {
        existing.add(row.trackingFingerprint);
        additions.push(row);
      }
    }

    return additions.length ? { ...result, candidates: [...(result.candidates || []), ...additions] } : result;
  };

  service.__pronounObjectRulesInstalled = true;
})();
