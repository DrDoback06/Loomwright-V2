// =====================================================================
// narrative-tracking-rules.jsx — refinements over NarrativeTrackingService.
//
// 1. Preserve extraction history across the legacy single-session write.
// 2. Resolve He/She/They across sentence boundaries when the immediately
//    preceding sentence contains one unambiguous cast entity.
//
// These are additive rules. The existing extractor and tracking service remain
// the only persistence and review pipelines.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const service = backend?.NarrativeTrackingService;
  if (!backend?.ExtractionService || !service || service.__rulesInstalled) return;

  const MAX_HISTORY = 60;
  const originalAnalyse = service.analyseChapter.bind(service);
  const originalRun = backend.ExtractionService.runExtraction.bind(backend.ExtractionService);
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

  function paragraphFor(offset, paragraphs) {
    return (paragraphs || []).find((row) => row.start <= offset && row.end >= offset) || null;
  }

  function sentenceQuote(sentence) {
    return String(sentence?.text || "").replace(/\s+/g, " ").trim();
  }

  function trackingFingerprint(fact) {
    return [
      fact.chapterId || "",
      fact.kind || "",
      fact.subject?.id || "",
      fact.object?.id || fact.location?.id || "",
      normalise(fact.predicate || fact.statement || fact.action || ""),
    ].join("|");
  }

  function candidate({ fact, entityType, name, summary, existingEntityId = null, suggestedChanges = null, payloadData = null, confidence = 0.72, relatedEntityIds = [] }) {
    const previousState = existingEntityId ? backend.EntityService.getSync(existingEntityId, entityType) : null;
    const sourceQuote = fact.sourceQuote || "";
    return {
      id: uuid("rq"),
      candidateId: uuid("cand"),
      entityType,
      name,
      summary,
      suggestedAction: existingEntityId ? "update" : "create",
      confidence,
      confidenceBand: confidenceBand(confidence),
      matchType: existingEntityId ? "exact" : "new",
      existingEntityId,
      targetEntityId: existingEntityId,
      sourceQuote,
      sourceQuotes: sourceQuote ? [sourceQuote] : [],
      chapterId: fact.chapterId,
      paragraphId: fact.paragraphId || null,
      startOffset: fact.startOffset,
      endOffset: fact.endOffset,
      previousState,
      relatedEntityIds: uniq(relatedEntityIds),
      suggestedChanges,
      payload: {
        name,
        summary,
        data: {
          ...(payloadData || {}),
          trackingFact: clone(fact),
          provenance: {
            kind: fact.kind,
            explicit: false,
            detector: fact.detector,
            chapterId: fact.chapterId,
            paragraphId: fact.paragraphId || null,
            extractionSessionId: fact.extractionSessionId,
            trackingVersion: service.version || 1,
          },
        },
      },
      reason: summary,
      action: "Narrative tracking",
      level: "tracking",
      value: Math.round(confidence * 100),
      extractionSessionId: fact.extractionSessionId,
      status: "pending",
      trackingKind: fact.kind,
      trackingFingerprint: trackingFingerprint(fact),
      trackingFacts: [clone(fact)],
      sentenceGroupId: `${fact.chapterId || "chapter"}:${fact.sentenceIndex ?? 0}`,
    };
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

  function baseFact(kind, detector, actor, sentence, context, match) {
    const absoluteStart = sentence.start + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    return {
      id: uuid("fact"),
      kind,
      detector,
      explicit: false,
      chapterId: context.chapterId,
      paragraphId: paragraphFor(absoluteStart, context.paragraphs)?.id || null,
      sentenceIndex: sentence.index,
      sceneIndex: 0,
      temporalAnchor: null,
      startOffset: absoluteStart,
      endOffset: absoluteEnd,
      sourceQuote: sentenceQuote(sentence),
      extractionSessionId: context.sessionId,
      createdAt: nowIso(),
      subject: entityRef(actor),
    };
  }

  function supplementalPronounCandidates(result) {
    const context = result.context;
    const rows = [];
    for (const sentence of context.sentences) {
      if (!/^\s*(?:he|she|they)\b/i.test(sentence.text)) continue;
      const actor = previousSingleCast(context, sentence.index);
      if (!actor) continue;
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      const castMentions = mentions.filter((row) => row.entityType === "cast");
      // A named cast entity in the sentence gives the base detectors enough
      // evidence; only supplement genuinely pronoun-led subjects.
      if (castMentions.some((row) => row.start < sentence.start + Math.max(20, sentence.text.length * 0.35))) continue;

      let match = sentence.text.match(/\b(entered|reached|arrived at|returned to|travelled to|traveled to|walked to|rode to|sailed to|fled to|went to|moved to)\b/i);
      if (match) {
        const location = mentions.filter((row) => row.entityType === "locations" && row.start >= sentence.start + match.index + match[0].length)[0];
        if (location) {
          const data = actor.data || {};
          const previous = data.currentLocation || data.location || null;
          const movement = {
            id: uuid("movement"),
            from: previous,
            to: entityRef(location.entity),
            verb: match[0].toLowerCase(),
            chapterId: context.chapterId,
            sourceQuote: sentenceQuote(sentence),
            extractionSessionId: context.sessionId,
            inferredSubject: true,
          };
          const fact = {
            ...baseFact("movement", "cross-sentence-pronoun", actor, sentence, context, match),
            location: entityRef(location.entity),
            fromLocation: previous,
            predicate: match[0].toLowerCase(),
          };
          rows.push(candidate({
            fact,
            entityType: "cast",
            name: actor.name,
            summary: `${actor.name} moves to ${location.entity.name}; the subject is resolved from the previous sentence.`,
            existingEntityId: actor.id,
            suggestedChanges: {
              currentLocation: entityRef(location.entity),
              locationHistory: appendUnique(data.locationHistory, movement, (row) => `${row.chapterId}|${row.to?.id || row.to}|${normalise(row.sourceQuote)}`),
              lastMovement: movement,
            },
            confidence: 0.69,
            relatedEntityIds: [location.entityId],
          }));
        }
      }

      match = sentence.text.match(/\b(learned|discovered|realised|realized|knew|understood|remembered|believed|thought|assumed|suspected|doubted|forgot|heard)\b/i);
      if (match) {
        const statement = sentence.text.slice(match.index + match[0].length)
          .replace(/^\s*(?:that|how|why|whether|about)\s+/i, "")
          .replace(/[.!?]+$/, "").trim().slice(0, 220);
        if (statement.length >= 4) {
          const verb = match[0].toLowerCase();
          const state = /believed|thought|assumed/.test(verb) ? "belief" : /suspected|doubted/.test(verb) ? "suspicion" : /forgot/.test(verb) ? "forgotten" : "known";
          const field = state === "belief" || state === "suspicion" ? "beliefs" : "knowledgeClaims";
          const claim = {
            id: uuid("claim"), statement, state,
            certainty: "pronoun-resolved",
            chapterId: context.chapterId,
            sourceQuote: sentenceQuote(sentence),
            extractionSessionId: context.sessionId,
          };
          const fact = {
            ...baseFact(field === "beliefs" ? "belief" : "knowledge", "cross-sentence-pronoun", actor, sentence, context, match),
            predicate: verb,
            statement,
            knowledgeState: state,
          };
          rows.push(candidate({
            fact,
            entityType: "cast",
            name: actor.name,
            summary: `${actor.name} ${verb} ${statement}; the subject is resolved from the previous sentence.`,
            existingEntityId: actor.id,
            suggestedChanges: {
              [field]: appendUnique(actor.data?.[field], claim, (row) => `${row.state}|${normalise(row.statement)}`),
              lastKnowledgeChange: claim,
            },
            confidence: 0.67,
            relatedEntityIds: mentions.map((row) => row.entityId),
          }));
        }
      }

      match = sentence.text.match(/\b(promised|vowed|swore|pledged)\b/i);
      if (match) {
        const action = sentence.text.slice(match.index + match[0].length)
          .replace(/^\s*to\s+/i, "")
          .replace(/[.!?]+$/, "").trim().slice(0, 180);
        if (action.length >= 3) {
          const fact = {
            ...baseFact("promise", "cross-sentence-pronoun", actor, sentence, context, match),
            predicate: match[0].toLowerCase(),
            action,
          };
          const step = { id: uuid("step"), title: action, status: "Not started", sourceChapterId: context.chapterId };
          rows.push(candidate({
            fact,
            entityType: "quests",
            name: `Promise · ${actor.name}: ${action.slice(0, 70)}`,
            summary: `${actor.name} ${match[0].toLowerCase()} ${action}; the subject is resolved from the previous sentence.`,
            suggestedChanges: {
              questType: "promise",
              status: "Active",
              goal: action,
              participants: [entityRef(actor)],
              steps: [step],
              unresolved: true,
              originChapterId: context.chapterId,
              sourceEvidence: [{ chapterId: context.chapterId, sourceQuote: sentenceQuote(sentence) }],
            },
            payloadData: { questType: "promise", status: "Active", goal: action, participants: [entityRef(actor)], steps: [step], unresolved: true },
            confidence: 0.68,
            relatedEntityIds: [actor.id],
          }));
        }
      }

      match = sentence.text.match(/\b(was wounded|was injured|was stabbed|was shot|was poisoned|was cursed|fell unconscious|was captured|was killed|died|recovered|was healed|went missing|vanished)\b/i);
      if (match) {
        const verb = match[0].toLowerCase();
        const status = /killed|died/.test(verb) ? "dead"
          : /captured/.test(verb) ? "captured"
            : /missing|vanished/.test(verb) ? "missing"
              : /recovered|healed/.test(verb) ? "active"
                : /unconscious/.test(verb) ? "unconscious"
                  : /poisoned|cursed/.test(verb) ? "afflicted" : "wounded";
        const state = {
          id: uuid("state"), status, condition: status, verb,
          chapterId: context.chapterId,
          sourceQuote: sentenceQuote(sentence),
          extractionSessionId: context.sessionId,
          inferredSubject: true,
        };
        const fact = {
          ...baseFact("character-status", "cross-sentence-pronoun", actor, sentence, context, match),
          predicate: verb,
          statement: status,
        };
        rows.push(candidate({
          fact,
          entityType: "cast",
          name: actor.name,
          summary: `${actor.name} becomes ${status}; the subject is resolved from the previous sentence.`,
          existingEntityId: actor.id,
          suggestedChanges: {
            currentStatus: status,
            conditions: appendUnique(actor.data?.conditions, state, (row) => `${row.chapterId}|${row.status}|${normalise(row.sourceQuote)}`),
            statusHistory: appendUnique(actor.data?.statusHistory, state, (row) => `${row.chapterId}|${row.status}|${normalise(row.sourceQuote)}`),
            lastStatusChange: state,
          },
          confidence: 0.7,
          relatedEntityIds: mentions.map((row) => row.entityId),
        }));
      }
    }
    return rows;
  }

  service.analyseChapter = function analyseWithPronouns(args) {
    const result = originalAnalyse(args);
    const supplemental = supplementalPronounCandidates(result);
    if (!supplemental.length) return result;
    const seen = new Set((result.candidates || []).map((row) => row.trackingFingerprint));
    return {
      ...result,
      candidates: [
        ...(result.candidates || []),
        ...supplemental.filter((row) => !seen.has(row.trackingFingerprint)),
      ],
    };
  };

  backend.ExtractionService.runExtraction = async function runWithPersistentHistory(args = {}) {
    const previousHistory = clone(backend.ExtractionService.loadHistorySync?.() || []);
    const result = await originalRun(args);
    const current = backend.ExtractionService.loadSessionSync() || result.session || {};
    const entry = current.current || (current.tracking ? {
      id: current.tracking.sessionId,
      sessionId: current.tracking.sessionId,
      chapterId: current.tracking.chapterId,
      chapterLabel: current.tracking.chapterId || "Selected text",
      mode: current.tracking.deep ? "deep" : "quick",
      privacy: current.aiUsed ? "ai" : "local",
      state: current.status || "complete",
      startedAt: current.updatedAt || nowIso(),
      completedAt: current.tracking.generatedAt || nowIso(),
      totals: { candidates: current.candidateCount || 0 },
      tracking: current.tracking,
    } : null);
    if (!entry) return result;
    const history = [
      entry,
      ...previousHistory.filter((row) => (row.sessionId || row.id) !== (entry.sessionId || entry.id)),
    ].slice(0, MAX_HISTORY);
    const next = { ...current, history, current: entry, updatedAt: nowIso() };
    await backend.ExtractionService.saveSession(next);
    if (result) result.session = next;
    window.dispatchEvent(new CustomEvent("lw:narrative-tracking-updated", { detail: { report: current.tracking, session: next } }));
    return result;
  };

  service.__rulesInstalled = true;
})();
