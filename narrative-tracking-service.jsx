// =====================================================================
// narrative-tracking-service.jsx — deterministic deep narrative tracking.
//
// This service extends the existing ExtractionService rather than replacing
// it. The original NER, known-entity scan, local detectors, AI routing, review
// queue, occurrences, entity store, and Impact Review remain authoritative.
//
// Added locally/free:
//   • sentence + scene context on every occurrence
//   • aliases/titles, ownership and item-state history
//   • character movement and route history
//   • directional multi-marker relationship evidence
//   • knowledge, belief, suspicion and forgetting
//   • intentions, motives, promises and unresolved questions
//   • injuries, death, capture, recovery and major events
//   • faction membership changes
//   • location/world-state changes
//   • simple evidence-backed contradiction cases
//   • reversible auto-accept for genuinely safe blue candidates
//   • extraction reports and history
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend?.ExtractionService || backend.NarrativeTrackingService) return;

  const originalRunExtraction = backend.ExtractionService.runExtraction.bind(backend.ExtractionService);
  const originalLoadSessionSync = backend.ExtractionService.loadSessionSync.bind(backend.ExtractionService);
  const TRACKING_VERSION = 1;
  const MAX_HISTORY = 60;
  const MAX_FACTS_PER_CHAPTER = 180;

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const stable = (value) => {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  };
  const nowIso = () => backend.nowIso ? backend.nowIso() : new Date().toISOString();
  const uuid = (prefix) => backend.uuid ? backend.uuid(prefix) : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const normalise = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  const escapeRe = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const uniq = (list) => [...new Set((list || []).filter(Boolean))];
  const entityRef = (entity) => entity ? ({ id: entity.id, name: entity.name, type: entity.type }) : null;
  const valueAt = (entity, key, fallback = null) => entity?.data?.[key] ?? entity?.[key] ?? fallback;
  const confidenceBand = (value) => value >= 0.95 ? "blue" : value >= 0.75 ? "green" : value >= 0.5 ? "orange" : "red";

  function appendUnique(existing, value, keyFn) {
    const rows = Array.isArray(existing) ? clone(existing) : [];
    const key = keyFn(value);
    if (!rows.some((row) => keyFn(row) === key)) rows.push(clone(value));
    return rows;
  }

  function mergeStrings(existing, value) {
    const rows = Array.isArray(existing) ? existing.slice() : [];
    if (!rows.some((row) => normalise(typeof row === "object" ? (row.text || row.goal || row.statement || row.name) : row) === normalise(value))) rows.push(value);
    return rows;
  }

  function sentenceSpans(text) {
    const out = [];
    if (!text) return out;
    const re = /[^.!?\n]+(?:[.!?]+|(?=\n)|$)/g;
    let match;
    let index = 0;
    while ((match = re.exec(text)) !== null) {
      let start = match.index;
      let end = match.index + match[0].length;
      while (start < end && /\s/.test(text[start])) start++;
      while (end > start && /\s/.test(text[end - 1])) end--;
      if (end <= start) continue;
      out.push({ id: `sent-${index++}`, start, end, text: text.slice(start, end), index: index - 1 });
    }
    return out;
  }

  function sceneBreakPositions(text) {
    const out = [];
    const re = /^\s*(?:\*{3,}|-{3,}|#{1,6}\s+.+)\s*$/gm;
    let match;
    while ((match = re.exec(text || "")) !== null) out.push(match.index);
    return out;
  }

  function sceneIndexFor(offset, breaks) {
    let count = 0;
    for (const pos of breaks) {
      if (pos >= offset) break;
      count++;
    }
    return count;
  }

  function temporalAnchor(text) {
    const patterns = [
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:minutes?|hours?|days?|weeks?|months?|years?|winters?|summers?)\s+(?:later|ago|before|after)\b/i,
      /\b(?:last|next|that|this|the following|the previous)\s+(?:night|morning|afternoon|evening|day|week|month|winter|summer|spring|autumn|fall|year)\b/i,
      /\b(?:at|before|after|by|near)\s+(?:dawn|dusk|sunrise|sunset|midnight|noon|daybreak|nightfall)\b/i,
      /\b(?:on\s+the\s+)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\s+day\b/i,
      /\b(?:yesterday|today|tomorrow|tonight|that night|the next day|the day before)\b/i,
    ];
    for (const pattern of patterns) {
      const match = String(text || "").match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  const POSITIVE_WORDS = /\b(?:trusted|loved|smiled|laughed|embraced|kissed|saved|helped|comforted|forgave|protected|welcomed|praised|hopeful|relieved|grateful)\b/i;
  const NEGATIVE_WORDS = /\b(?:feared|hated|betrayed|struck|attacked|threatened|lied|deceived|abandoned|accused|angry|furious|terrified|grief|dread|wounded|killed|destroyed)\b/i;
  function sentenceSentiment(text) {
    const positive = (String(text).match(new RegExp(POSITIVE_WORDS.source, "gi")) || []).length;
    const negative = (String(text).match(new RegExp(NEGATIVE_WORDS.source, "gi")) || []).length;
    if (positive > negative) return "positive";
    if (negative > positive) return "negative";
    return "neutral";
  }

  function trackingTags(text) {
    const tags = [];
    const checks = [
      ["travel", /\b(?:entered|reached|arrived|returned|travelled|traveled|walked|rode|sailed|fled|crossed)\b/i],
      ["ownership", /\b(?:gave|handed|passed|received|took|stole|carried|held|lost|dropped|surrendered)\b/i],
      ["relationship", /\b(?:kissed|embraced|betrayed|trusted|forgave|comforted|threatened|attacked|saved|protected)\b/i],
      ["knowledge", /\b(?:knew|learned|discovered|realised|realized|believed|suspected|remembered|forgot|was told)\b/i],
      ["promise", /\b(?:promised|vowed|swore|pledged)\b/i],
      ["intention", /\b(?:planned|intended|wanted|hoped|needed|decided|refused)\b/i],
      ["condition", /\b(?:wounded|injured|poisoned|cursed|healed|recovered|unconscious|captured|killed|died)\b/i],
      ["world-state", /\b(?:sealed|opened|burned|burnt|destroyed|flooded|abandoned|captured|rebuilt|collapsed)\b/i],
      ["question", /\b(?:no one knew|the question remained|had to find out|wondered whether)\b/i],
    ];
    for (const [tag, pattern] of checks) if (pattern.test(text)) tags.push(tag);
    return tags;
  }

  function buildEntityIndex() {
    const raw = backend.EntityService.listAllSync() || {};
    const entities = [];
    const byId = new Map();
    const byType = {};
    const names = [];
    for (const [type, bucket] of Object.entries(raw)) {
      for (const row of Object.values(bucket || {})) {
        if (!row || row.status === "deleted") continue;
        const entity = { ...row, type: row.type || type };
        entities.push(entity);
        byId.set(entity.id, entity);
        (byType[entity.type] = byType[entity.type] || []).push(entity);
        const aliases = uniq([
          entity.name,
          ...(entity.aliases || []),
          ...(entity.data?.aliases || []),
          ...(entity.data?.titles || []),
        ].map((value) => typeof value === "object" ? (value.name || value.label || value.title) : value));
        for (const name of aliases) {
          if (!name || String(name).trim().length < 2) continue;
          let regex = null;
          try { regex = new RegExp(`(?<![A-Za-z0-9])${escapeRe(name)}(?![A-Za-z0-9])`, "gi"); } catch (_) {}
          names.push({ entity, name: String(name), regex });
        }
      }
    }
    names.sort((a, b) => b.name.length - a.name.length);
    return { raw, entities, byId, byType, names };
  }

  function scanMentions(text, index, cap = 6000) {
    const rows = [];
    const seen = new Set();
    for (const entry of index.names) {
      if (!entry.regex || rows.length >= cap) continue;
      entry.regex.lastIndex = 0;
      let match;
      while ((match = entry.regex.exec(text)) !== null) {
        const key = `${entry.entity.id}:${match.index}:${match.index + match[0].length}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            entity: entry.entity,
            entityId: entry.entity.id,
            entityType: entry.entity.type,
            exactText: match[0],
            matchedName: entry.name,
            start: match.index,
            end: match.index + match[0].length,
          });
        }
        if (match[0].length === 0) entry.regex.lastIndex++;
      }
    }
    rows.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    // At identical ranges prefer the longest/canonical match and avoid an alias
    // duplicating the same entity occurrence.
    const deduped = [];
    const rangeKeys = new Set();
    for (const row of rows) {
      const key = `${row.entityId}:${row.start}:${row.end}`;
      if (rangeKeys.has(key)) continue;
      rangeKeys.add(key);
      deduped.push(row);
    }
    return deduped;
  }

  function mentionsForSentence(sentence, mentions) {
    return mentions.filter((mention) => mention.start >= sentence.start && mention.end <= sentence.end);
  }

  function nearestBefore(mentions, absoluteOffset, types) {
    return mentions
      .filter((mention) => mention.end <= absoluteOffset && (!types || types.includes(mention.entityType)))
      .sort((a, b) => b.end - a.end)[0] || null;
  }

  function nearestAfter(mentions, absoluteOffset, types) {
    return mentions
      .filter((mention) => mention.start >= absoluteOffset && (!types || types.includes(mention.entityType)))
      .sort((a, b) => a.start - b.start)[0] || null;
  }

  function nearestAround(mentions, absoluteOffset, types) {
    return mentions
      .filter((mention) => !types || types.includes(mention.entityType))
      .sort((a, b) => Math.min(Math.abs(a.start - absoluteOffset), Math.abs(a.end - absoluteOffset)) - Math.min(Math.abs(b.start - absoluteOffset), Math.abs(b.end - absoluteOffset)))[0] || null;
  }

  function resolvePronounActor(sentence, verbStart, context) {
    const left = sentence.text.slice(0, Math.max(0, verbStart - sentence.start));
    if (!/\b(?:he|she|they|them|him|her|his|hers|their)\b[^.!?]*$/i.test(left)) return null;
    return context.lastCast.length === 1 ? context.lastCast[0] : null;
  }

  function paragraphFor(offset, paragraphs) {
    return (paragraphs || []).find((row) => row.start <= offset && row.end >= offset) || null;
  }

  function sourceSentence(sentence) {
    return sentence.text.replace(/\s+/g, " ").trim();
  }

  function currentRef(value, index) {
    if (!value) return null;
    if (typeof value === "string") {
      const entity = index.byId.get(value);
      return entity ? entityRef(entity) : { id: value, name: value, type: "unknown" };
    }
    if (typeof value === "object") return { id: value.id || value.entityId || null, name: value.name || value.label || value.title || value.id || "Unknown", type: value.type || value.entityType || "unknown" };
    return null;
  }

  function factFingerprint(fact) {
    return [
      fact.chapterId || "",
      fact.kind || "",
      fact.subject?.id || fact.subject?.name || "",
      fact.object?.id || fact.object?.name || "",
      fact.location?.id || "",
      normalise(fact.predicate || fact.statement || fact.action || ""),
    ].join("|");
  }

  function buildCandidate({
    fact,
    entityType,
    name,
    summary,
    existingEntityId = null,
    suggestedAction = null,
    suggestedChanges = null,
    payloadData = null,
    confidence = 0.75,
    relatedEntityIds = [],
    conflict = null,
  }) {
    const previousState = existingEntityId ? backend.EntityService.getSync(existingEntityId, entityType) : null;
    const candidateId = uuid("cand");
    const sourceQuote = fact.sourceQuote || fact.statement || "";
    const payload = {
      name,
      summary,
      data: {
        ...(payloadData || {}),
        trackingFact: clone(fact),
        provenance: {
          kind: fact.kind,
          explicit: fact.explicit !== false,
          detector: fact.detector,
          chapterId: fact.chapterId,
          paragraphId: fact.paragraphId || null,
          extractionSessionId: fact.extractionSessionId,
          trackingVersion: TRACKING_VERSION,
        },
      },
    };
    const action = suggestedAction || (existingEntityId ? "update" : "create");
    return {
      id: uuid("rq"),
      candidateId,
      entityType,
      name,
      summary,
      suggestedAction: action,
      confidence,
      confidenceBand: confidenceBand(confidence),
      matchType: existingEntityId ? "exact" : "new",
      existingEntityId,
      targetEntityId: existingEntityId,
      sourceQuote,
      sourceQuotes: sourceQuote ? [sourceQuote] : [],
      chapterId: fact.chapterId || null,
      paragraphId: fact.paragraphId || null,
      startOffset: fact.startOffset ?? null,
      endOffset: fact.endOffset ?? null,
      previousState,
      relatedEntityIds: uniq(relatedEntityIds),
      suggestedChanges,
      payload,
      reason: summary,
      action: "Narrative tracking",
      level: "tracking",
      value: Math.round(confidence * 100),
      extractionSessionId: fact.extractionSessionId,
      status: "pending",
      trackingKind: fact.kind,
      trackingFingerprint: factFingerprint(fact),
      trackingFacts: [clone(fact)],
      sentenceGroupId: `${fact.chapterId || "chapter"}:${fact.sentenceIndex ?? 0}`,
      conflict,
    };
  }

  function factBase(kind, detector, sentence, context, opts = {}) {
    const paragraph = paragraphFor(opts.startOffset ?? sentence.start, context.paragraphs);
    return {
      id: uuid("fact"),
      kind,
      detector,
      explicit: opts.explicit !== false,
      chapterId: context.chapterId,
      paragraphId: paragraph?.id || null,
      sentenceIndex: sentence.index,
      sceneIndex: sceneIndexFor(sentence.start, context.sceneBreaks),
      temporalAnchor: temporalAnchor(sentence.text),
      startOffset: opts.startOffset ?? sentence.start,
      endOffset: opts.endOffset ?? sentence.end,
      sourceQuote: sourceSentence(sentence),
      extractionSessionId: context.sessionId,
      createdAt: nowIso(),
    };
  }

  function findEntityBySurface(surface, index, types = null) {
    const key = normalise(surface).replace(/^the\s+/, "");
    let exact = null;
    for (const entry of index.names) {
      if (types && !types.includes(entry.entity.type)) continue;
      const name = normalise(entry.name).replace(/^the\s+/, "");
      if (name === key) return entry.entity;
      if (!exact && (name.endsWith(` ${key}`) || key.endsWith(` ${name}`))) exact = entry.entity;
    }
    return exact;
  }

  function relationshipBetween(aId, bId, index) {
    return (index.byType.relationships || []).find((entity) => {
      const from = valueAt(entity, "fromId") || valueAt(entity, "from")?.id;
      const to = valueAt(entity, "toId") || valueAt(entity, "to")?.id;
      return (from === aId && to === bId) || (from === bId && to === aId);
    }) || null;
  }

  function detectAliases(context) {
    const out = [];
    const patterns = [
      /([A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){0,3})\s*,\s*(?:known|called|remembered)\s+as\s+["“]?([^"”.,;]{2,60})/g,
      /([A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){0,3})\s*,\s+the\s+([A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){0,3})\b/g,
      /(?:they|people|everyone)\s+called\s+([A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){0,3})\s+["“]([^"”]{2,60})["”]/gi,
    ];
    for (const sentence of context.sentences) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(sentence.text)) !== null) {
          const entity = findEntityBySurface(match[1], context.index, ["cast", "locations", "items", "factions", "bestiary"]);
          if (!entity) continue;
          const alias = match[2].trim().replace(/^(?:the)\s+/i, "");
          const aliases = appendUnique(entity.data?.aliases || entity.aliases || [], alias, (value) => normalise(typeof value === "object" ? (value.name || value.label) : value));
          const fact = {
            ...factBase("alias", "alias-pattern", sentence, context, { startOffset: sentence.start + match.index, endOffset: sentence.start + match.index + match[0].length }),
            subject: entityRef(entity),
            predicate: "known-as",
            statement: alias,
          };
          out.push(buildCandidate({
            fact,
            entityType: entity.type,
            name: entity.name,
            summary: `${entity.name} is also known as “${alias}”.`,
            existingEntityId: entity.id,
            suggestedChanges: { aliases },
            confidence: 0.88,
            relatedEntityIds: [entity.id],
          }));
        }
      }
    }
    return out;
  }

  const TRANSFER_VERBS = /\b(gave|handed|passed|returned|sold|lent|loaned|entrusted|offered|yielded|surrendered|delivered|gifted)\b/gi;
  const ACQUIRE_VERBS = /\b(took|received|accepted|picked up|found|stole|claimed|recovered|seized)\b/gi;
  const LOSS_VERBS = /\b(lost|dropped|abandoned|discarded|left behind|misplaced|surrendered|destroyed|shattered|broke)\b/gi;
  const USE_VERBS = /\b(used|wielded|activated|opened|unlocked|raised|drew|fired|drank|read)\b/gi;

  function detectOwnership(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      for (const [pattern, mode] of [[TRANSFER_VERBS, "transfer"], [ACQUIRE_VERBS, "acquire"], [LOSS_VERBS, "loss"], [USE_VERBS, "use"]]) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(sentence.text)) !== null) {
          const absoluteStart = sentence.start + match.index;
          const absoluteEnd = absoluteStart + match[0].length;
          let actor = nearestBefore(mentions, absoluteStart, ["cast"]);
          if (!actor) actor = resolvePronounActor(sentence, absoluteStart, context);
          const item = nearestAfter(mentions, absoluteEnd, ["items"]) || nearestBefore(mentions, absoluteStart, ["items"]);
          if (!item) continue;
          const entity = item.entity;
          const data = entity.data || {};
          let receiver = null;
          if (mode === "transfer") receiver = nearestAfter(mentions, item.end, ["cast"]);
          if (mode === "acquire") receiver = actor;
          const previousOwner = currentRef(data.currentOwner || data.owner || data.ownerId, context.index);
          const historyEntry = {
            id: uuid("ownership"),
            action: match[0].toLowerCase(),
            from: previousOwner,
            to: mode === "loss" ? null : entityRef(receiver?.entity || receiver),
            actor: entityRef(actor?.entity || actor),
            chapterId: context.chapterId,
            sourceQuote: sourceSentence(sentence),
            temporalAnchor: temporalAnchor(sentence.text),
            extractionSessionId: context.sessionId,
          };
          const changes = {
            ownershipHistory: appendUnique(data.ownershipHistory, historyEntry, (row) => `${row.chapterId}|${normalise(row.sourceQuote)}|${row.action}`),
            lastStateChange: historyEntry,
          };
          if (mode === "loss") {
            changes.status = /destroyed|shattered|broke/i.test(match[0]) ? "destroyed" : "lost";
            if (!/broke/i.test(match[0])) changes.currentOwner = null;
            if (/broke|shattered|destroyed/i.test(match[0])) changes.condition = "destroyed";
          } else if (mode === "use") {
            changes.usageHistory = appendUnique(data.usageHistory, {
              id: uuid("usage"), actor: entityRef(actor?.entity || actor), action: match[0].toLowerCase(), chapterId: context.chapterId,
              sourceQuote: sourceSentence(sentence), extractionSessionId: context.sessionId,
            }, (row) => `${row.chapterId}|${normalise(row.sourceQuote)}|${row.action}`);
            if (actor && !previousOwner) changes.currentOwner = entityRef(actor.entity || actor);
          } else if (receiver) {
            changes.currentOwner = entityRef(receiver.entity || receiver);
            changes.status = "held";
          }
          const fact = {
            ...factBase(mode === "use" ? "item-use" : "ownership", `item-${mode}`, sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
            subject: entityRef(actor?.entity || actor),
            object: entityRef(entity),
            predicate: match[0].toLowerCase(),
            recipient: entityRef(receiver?.entity || receiver),
            previousOwner,
          };
          let conflict = null;
          if (mode === "transfer" && actor && previousOwner?.id && previousOwner.id !== actor.entityId) {
            conflict = { kind: "ownership-chain-gap", note: `${actor.entity.name} performs the transfer, but ${previousOwner.name} is the last tracked owner.` };
          }
          out.push(buildCandidate({
            fact,
            entityType: "items",
            name: entity.name,
            summary: mode === "loss"
              ? `${entity.name} is ${changes.status}.`
              : mode === "use"
                ? `${actor?.entity?.name || "A character"} ${match[0].toLowerCase()} ${entity.name}.`
                : `${entity.name} passes ${previousOwner ? `from ${previousOwner.name}` : "ownership"}${receiver ? ` to ${receiver.entity.name}` : ""}.`,
            existingEntityId: entity.id,
            suggestedChanges: changes,
            confidence: actor && (receiver || mode !== "transfer") ? 0.93 : 0.76,
            relatedEntityIds: [actor?.entityId, receiver?.entityId, previousOwner?.id].filter(Boolean),
            conflict,
          }));
        }
      }
    }
    return out;
  }

  const MOVEMENT_VERBS = /\b(entered|reached|arrived at|returned to|travelled to|traveled to|walked to|rode to|sailed to|flew to|fled to|crossed into|set out for|came to|went to|moved to)\b/gi;
  function detectMovement(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      MOVEMENT_VERBS.lastIndex = 0;
      let match;
      while ((match = MOVEMENT_VERBS.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        let actor = nearestBefore(mentions, absoluteStart, ["cast"]);
        let pronounResolved = false;
        if (!actor) {
          const entity = resolvePronounActor(sentence, absoluteStart, context);
          if (entity) { actor = { entity, entityId: entity.id, entityType: entity.type, start: sentence.start, end: absoluteStart }; pronounResolved = true; }
        }
        const location = nearestAfter(mentions, absoluteEnd, ["locations"]);
        if (!actor || !location) continue;
        const entity = actor.entity;
        const data = entity.data || {};
        const previous = currentRef(data.currentLocation || data.location, context.index);
        if (previous?.id === location.entityId) continue;
        const movement = {
          id: uuid("movement"),
          from: previous,
          to: entityRef(location.entity),
          verb: match[0].toLowerCase(),
          chapterId: context.chapterId,
          sceneIndex: sceneIndexFor(sentence.start, context.sceneBreaks),
          temporalAnchor: temporalAnchor(sentence.text),
          sourceQuote: sourceSentence(sentence),
          extractionSessionId: context.sessionId,
        };
        const fact = {
          ...factBase("movement", "movement-pattern", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd, explicit: !pronounResolved }),
          subject: entityRef(entity),
          location: entityRef(location.entity),
          fromLocation: previous,
          predicate: match[0].toLowerCase(),
        };
        out.push(buildCandidate({
          fact,
          entityType: "cast",
          name: entity.name,
          summary: `${entity.name} moves${previous ? ` from ${previous.name}` : ""} to ${location.entity.name}.`,
          existingEntityId: entity.id,
          suggestedChanges: {
            currentLocation: entityRef(location.entity),
            locationHistory: appendUnique(data.locationHistory, movement, (row) => `${row.chapterId}|${row.to?.id || row.to}|${normalise(row.sourceQuote)}`),
            lastMovement: movement,
          },
          confidence: pronounResolved ? 0.72 : 0.92,
          relatedEntityIds: [location.entityId, previous?.id].filter(Boolean),
        }));
      }
    }
    return out;
  }

  const RELATIONSHIP_RULES = [
    { re: /\b(kissed|embraced|hugged)\b/gi, type: "affection", polarity: "positive", weight: 2 },
    { re: /\b(saved|protected|defended|comforted|helped|forgave|trusted)\b/gi, type: "trust", polarity: "positive", weight: 1 },
    { re: /\b(betrayed|deceived|lied to|abandoned)\b/gi, type: "trust", polarity: "negative", weight: -2 },
    { re: /\b(struck|attacked|threatened|confronted|accused|challenged)\b/gi, type: "conflict", polarity: "negative", weight: 2 },
    { re: /\b(feared|distrusted|suspected)\b/gi, type: "suspicion", polarity: "negative", weight: 1 },
    { re: /\b(obeyed|commanded|ordered)\b/gi, type: "authority", polarity: "neutral", weight: 1 },
    { re: /\b(admired|respected|praised)\b/gi, type: "respect", polarity: "positive", weight: 1 },
  ];

  function detectRelationships(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      for (const rule of RELATIONSHIP_RULES) {
        rule.re.lastIndex = 0;
        let match;
        while ((match = rule.re.exec(sentence.text)) !== null) {
          const absoluteStart = sentence.start + match.index;
          const absoluteEnd = absoluteStart + match[0].length;
          let subject = nearestBefore(mentions, absoluteStart, ["cast"]);
          if (!subject) {
            const entity = resolvePronounActor(sentence, absoluteStart, context);
            if (entity) subject = { entity, entityId: entity.id, entityType: entity.type, start: sentence.start, end: absoluteStart };
          }
          const object = nearestAfter(mentions, absoluteEnd, ["cast"]);
          if (!subject || !object || subject.entityId === object.entityId) continue;
          const existing = relationshipBetween(subject.entityId, object.entityId, context.index);
          const data = existing?.data || {};
          const marker = {
            id: uuid("relmark"),
            type: rule.type,
            polarity: rule.polarity,
            weight: rule.weight,
            verb: match[0].toLowerCase(),
            fromId: subject.entityId,
            toId: object.entityId,
            chapterId: context.chapterId,
            sourceQuote: sourceSentence(sentence),
            temporalAnchor: temporalAnchor(sentence.text),
            extractionSessionId: context.sessionId,
          };
          const evidence = {
            id: uuid("relev"), chapterId: context.chapterId, sourceQuote: sourceSentence(sentence),
            markerType: rule.type, fromId: subject.entityId, toId: object.entityId,
          };
          const markers = appendUnique(data.markers || data.relationshipMarkers, marker, (row) => `${row.chapterId}|${row.fromId}|${row.toId}|${row.type}|${normalise(row.sourceQuote)}`);
          const fact = {
            ...factBase("relationship", "relationship-action", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
            subject: entityRef(subject.entity),
            object: entityRef(object.entity),
            predicate: match[0].toLowerCase(),
            marker: clone(marker),
          };
          const conflict = rule.type === "trust" && rule.polarity === "negative" && markers.some((row) => row.type === "loyalty" && row.polarity === "positive")
            ? { kind: "relationship-tension", note: "This action conflicts with an existing positive loyalty marker." }
            : null;
          out.push(buildCandidate({
            fact,
            entityType: "relationships",
            name: existing?.name || `${subject.entity.name} → ${object.entity.name}`,
            summary: `${subject.entity.name} ${match[0].toLowerCase()} ${object.entity.name}; ${rule.type} changes ${rule.polarity}.`,
            existingEntityId: existing?.id || null,
            suggestedChanges: {
              fromId: data.fromId || subject.entityId,
              toId: data.toId || object.entityId,
              relationshipType: data.relationshipType || rule.type,
              direction: data.direction || "directed",
              markers,
              relationshipMarkers: markers,
              evidence: appendUnique(data.evidence, evidence, (row) => `${row.chapterId}|${normalise(row.sourceQuote)}`),
              lastInteraction: marker,
              summary: existing?.summary || existing?.data?.summary || `${subject.entity.name} and ${object.entity.name}`,
            },
            payloadData: { fromId: subject.entityId, toId: object.entityId, relationshipType: rule.type, markers: [marker], evidence: [evidence] },
            confidence: 0.89,
            relatedEntityIds: [subject.entityId, object.entityId],
            conflict,
          }));
        }
      }
    }
    return out;
  }

  const KNOWLEDGE_VERBS = /\b(learned|discovered|realised|realized|knew|understood|remembered|believed|thought|assumed|suspected|doubted|forgot|heard)\b/gi;
  const DISCLOSURE_VERBS = /\b(told|warned|informed|confessed to|revealed to)\b/gi;

  function cleanedClause(text) {
    return String(text || "").replace(/^\s*(?:that|how|why|whether|about)\s+/i, "").replace(/^["“]|["”]$/g, "").trim().replace(/[.!?]+$/, "").slice(0, 220);
  }

  function detectKnowledge(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      KNOWLEDGE_VERBS.lastIndex = 0;
      let match;
      while ((match = KNOWLEDGE_VERBS.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        let actor = nearestBefore(mentions, absoluteStart, ["cast"]);
        if (!actor) {
          const entity = resolvePronounActor(sentence, absoluteStart, context);
          if (entity) actor = { entity, entityId: entity.id, entityType: entity.type, start: sentence.start, end: absoluteStart };
        }
        if (!actor) continue;
        const statement = cleanedClause(sentence.text.slice(match.index + match[0].length));
        if (statement.length < 4) continue;
        const verb = match[0].toLowerCase();
        const state = /believed|thought|assumed/.test(verb) ? "belief"
          : /suspected|doubted/.test(verb) ? "suspicion"
            : /forgot/.test(verb) ? "forgotten" : "known";
        const claim = {
          id: uuid("claim"), statement, state,
          certainty: state === "known" ? "confirmed-to-character" : state === "forgotten" ? "lost" : "uncertain",
          chapterId: context.chapterId,
          sourceQuote: sourceSentence(sentence),
          temporalAnchor: temporalAnchor(sentence.text),
          extractionSessionId: context.sessionId,
        };
        const data = actor.entity.data || {};
        const field = state === "belief" || state === "suspicion" ? "beliefs" : "knowledgeClaims";
        const fact = {
          ...factBase(field === "beliefs" ? "belief" : "knowledge", "knowledge-verb", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd, explicit: true }),
          subject: entityRef(actor.entity), predicate: verb, statement, knowledgeState: state,
        };
        out.push(buildCandidate({
          fact,
          entityType: "cast",
          name: actor.entity.name,
          summary: `${actor.entity.name} ${verb} ${statement}.`,
          existingEntityId: actor.entityId,
          suggestedChanges: { [field]: appendUnique(data[field], claim, (row) => `${row.state}|${normalise(row.statement)}`), lastKnowledgeChange: claim },
          confidence: state === "known" ? 0.87 : 0.79,
          relatedEntityIds: (mentions.filter((row) => row.entityId !== actor.entityId).map((row) => row.entityId)),
        }));
      }

      DISCLOSURE_VERBS.lastIndex = 0;
      while ((match = DISCLOSURE_VERBS.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        const source = nearestBefore(mentions, absoluteStart, ["cast"]);
        const recipient = nearestAfter(mentions, absoluteEnd, ["cast"]);
        if (!recipient) continue;
        const thatIndex = sentence.text.toLowerCase().indexOf(" that ", match.index + match[0].length);
        const statement = cleanedClause(thatIndex >= 0 ? sentence.text.slice(thatIndex + 6) : sentence.text.slice(match.index + match[0].length));
        if (statement.length < 4) continue;
        const data = recipient.entity.data || {};
        const claim = {
          id: uuid("claim"), statement, state: "reported",
          certainty: "reported-by-another-character", sourceEntity: entityRef(source?.entity),
          chapterId: context.chapterId, sourceQuote: sourceSentence(sentence), extractionSessionId: context.sessionId,
        };
        const fact = {
          ...factBase("knowledge", "disclosure-verb", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
          subject: entityRef(recipient.entity), object: entityRef(source?.entity), predicate: match[0].toLowerCase(), statement, knowledgeState: "reported",
        };
        out.push(buildCandidate({
          fact,
          entityType: "cast",
          name: recipient.entity.name,
          summary: `${recipient.entity.name} is told: ${statement}.`,
          existingEntityId: recipient.entityId,
          suggestedChanges: { knowledgeClaims: appendUnique(data.knowledgeClaims, claim, (row) => `${row.state}|${normalise(row.statement)}`), lastKnowledgeChange: claim },
          confidence: source ? 0.88 : 0.76,
          relatedEntityIds: [source?.entityId, ...mentions.map((row) => row.entityId)].filter(Boolean),
        }));
      }
    }
    return out;
  }

  const INTENTION_VERBS = /\b(planned|intended|wanted|hoped|needed|decided|meant|refused)\b/gi;
  const PROMISE_VERBS = /\b(promised|vowed|swore|pledged)\b/gi;

  function detectIntentions(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      INTENTION_VERBS.lastIndex = 0;
      let match;
      while ((match = INTENTION_VERBS.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        let actor = nearestBefore(mentions, absoluteStart, ["cast"]);
        if (!actor) {
          const entity = resolvePronounActor(sentence, absoluteStart, context);
          if (entity) actor = { entity, entityId: entity.id, entityType: entity.type, start: sentence.start, end: absoluteStart };
        }
        if (!actor) continue;
        const action = cleanedClause(sentence.text.slice(match.index + match[0].length)).replace(/^to\s+/i, "");
        if (action.length < 3) continue;
        const intention = {
          id: uuid("intent"), verb: match[0].toLowerCase(), action,
          status: /refused/i.test(match[0]) ? "refused" : "active",
          chapterId: context.chapterId, sourceQuote: sourceSentence(sentence), extractionSessionId: context.sessionId,
        };
        const data = actor.entity.data || {};
        const fact = {
          ...factBase("intention", "intention-verb", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
          subject: entityRef(actor.entity), predicate: match[0].toLowerCase(), action,
        };
        out.push(buildCandidate({
          fact,
          entityType: "cast",
          name: actor.entity.name,
          summary: `${actor.entity.name} ${match[0].toLowerCase()} ${action}.`,
          existingEntityId: actor.entityId,
          suggestedChanges: {
            goals: /refused/i.test(match[0]) ? (data.goals || []) : mergeStrings(data.goals, action),
            intentions: appendUnique(data.intentions, intention, (row) => `${row.status}|${normalise(row.action)}`),
            lastIntention: intention,
          },
          confidence: 0.81,
          relatedEntityIds: mentions.filter((row) => row.entityId !== actor.entityId).map((row) => row.entityId),
        }));
      }

      PROMISE_VERBS.lastIndex = 0;
      while ((match = PROMISE_VERBS.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        let actor = nearestBefore(mentions, absoluteStart, ["cast"]);
        if (!actor) {
          const entity = resolvePronounActor(sentence, absoluteStart, context);
          if (entity) actor = { entity, entityId: entity.id, entityType: entity.type, start: sentence.start, end: absoluteStart };
        }
        if (!actor) continue;
        const recipient = nearestAfter(mentions, absoluteEnd, ["cast"]);
        const action = cleanedClause(sentence.text.slice(match.index + match[0].length)).replace(/^to\s+/i, "");
        if (action.length < 3) continue;
        const titleAction = action.split(/[,;]|\b(?:because|although|but)\b/i)[0].trim().slice(0, 70);
        const fact = {
          ...factBase("promise", "promise-verb", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
          subject: entityRef(actor.entity), object: entityRef(recipient?.entity), predicate: match[0].toLowerCase(), action,
        };
        const step = { id: uuid("step"), title: action, status: "Not started", sourceChapterId: context.chapterId };
        out.push(buildCandidate({
          fact,
          entityType: "quests",
          name: `Promise · ${actor.entity.name}: ${titleAction}`,
          summary: `${actor.entity.name} ${match[0].toLowerCase()} ${action}.`,
          suggestedAction: "create",
          suggestedChanges: {
            questType: "promise",
            status: "Active",
            goal: action,
            participants: uniq([actor.entityId, recipient?.entityId]).map((id) => entityRef(context.index.byId.get(id))),
            steps: [step],
            unresolved: true,
            originChapterId: context.chapterId,
            sourceEvidence: [{ chapterId: context.chapterId, sourceQuote: sourceSentence(sentence) }],
          },
          payloadData: { questType: "promise", status: "Active", goal: action, participants: [entityRef(actor.entity), entityRef(recipient?.entity)].filter(Boolean), steps: [step], unresolved: true },
          confidence: 0.9,
          relatedEntityIds: [actor.entityId, recipient?.entityId].filter(Boolean),
        }));
      }

      if (context.deep) {
        const because = sentence.text.match(/\bbecause\s+(.{4,180})/i);
        const actor = mentions.find((row) => row.entityType === "cast");
        if (because && actor) {
          const motive = because[1].replace(/[.!?]+$/, "").trim();
          const data = actor.entity.data || {};
          const row = { id: uuid("motive"), statement: motive, chapterId: context.chapterId, sourceQuote: sourceSentence(sentence), confidence: "inferred", extractionSessionId: context.sessionId };
          const fact = {
            ...factBase("motive", "because-clause", sentence, context, { explicit: false }),
            subject: entityRef(actor.entity), predicate: "because", statement: motive,
          };
          out.push(buildCandidate({
            fact,
            entityType: "cast",
            name: actor.entity.name,
            summary: `Possible motive for ${actor.entity.name}: ${motive}.`,
            existingEntityId: actor.entityId,
            suggestedChanges: { motives: appendUnique(data.motives, row, (value) => normalise(value.statement)), lastMotiveEvidence: row },
            confidence: 0.63,
            relatedEntityIds: mentions.filter((value) => value.entityId !== actor.entityId).map((value) => value.entityId),
          }));
        }
      }
    }
    return out;
  }

  const STATUS_RULES = [
    { re: /\b(died|was killed|fell dead)\b/gi, status: "dead", condition: "dead", major: true },
    { re: /\b(was wounded|was injured|was stabbed|was shot|was burned|was burnt)\b/gi, status: "wounded", condition: "wounded", major: false },
    { re: /\b(was poisoned|was cursed|fell ill|was infected)\b/gi, status: "afflicted", condition: "afflicted", major: false },
    { re: /\b(fell unconscious|was knocked unconscious|collapsed)\b/gi, status: "unconscious", condition: "unconscious", major: false },
    { re: /\b(was captured|was imprisoned|was taken prisoner)\b/gi, status: "captured", condition: "captured", major: true },
    { re: /\b(recovered|was healed|woke|regained consciousness)\b/gi, status: "active", condition: "recovered", major: false },
    { re: /\b(disappeared|went missing|vanished)\b/gi, status: "missing", condition: "missing", major: true },
  ];

  function detectCharacterStatus(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      for (const rule of STATUS_RULES) {
        rule.re.lastIndex = 0;
        let match;
        while ((match = rule.re.exec(sentence.text)) !== null) {
          const absoluteStart = sentence.start + match.index;
          const absoluteEnd = absoluteStart + match[0].length;
          let actor = nearestBefore(mentions, absoluteStart, ["cast"]) || nearestAfter(mentions, absoluteEnd, ["cast"]);
          if (!actor) {
            const entity = resolvePronounActor(sentence, absoluteStart, context);
            if (entity) actor = { entity, entityId: entity.id, entityType: entity.type, start: sentence.start, end: absoluteStart };
          }
          if (!actor) continue;
          const instigator = nearestAfter(mentions, absoluteEnd, ["cast"]);
          const data = actor.entity.data || {};
          const change = {
            id: uuid("state"), status: rule.status, condition: rule.condition, verb: match[0].toLowerCase(),
            chapterId: context.chapterId, sourceQuote: sourceSentence(sentence), causedBy: instigator && instigator.entityId !== actor.entityId ? entityRef(instigator.entity) : null,
            extractionSessionId: context.sessionId,
          };
          const conditions = appendUnique(data.conditions, { ...change }, (row) => `${row.chapterId}|${row.status}|${normalise(row.sourceQuote)}`);
          const fact = {
            ...factBase("character-status", "character-status-pattern", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
            subject: entityRef(actor.entity), object: entityRef(instigator?.entity), predicate: match[0].toLowerCase(), statement: rule.status,
          };
          out.push(buildCandidate({
            fact,
            entityType: "cast",
            name: actor.entity.name,
            summary: `${actor.entity.name} becomes ${rule.status}.`,
            existingEntityId: actor.entityId,
            suggestedChanges: { currentStatus: rule.status, conditions, statusHistory: appendUnique(data.statusHistory, change, (row) => `${row.chapterId}|${row.status}|${normalise(row.sourceQuote)}`), lastStatusChange: change },
            confidence: rule.major ? 0.97 : 0.93,
            relatedEntityIds: [actor.entityId, instigator?.entityId].filter(Boolean),
          }));
          if (rule.major) {
            const eventFact = { ...fact, id: uuid("fact"), kind: "event", detector: "major-character-state", subject: entityRef(actor.entity) };
            out.push(buildCandidate({
              fact: eventFact,
              entityType: "events",
              name: `${actor.entity.name} · ${rule.status}`,
              summary: sourceSentence(sentence),
              suggestedAction: "create",
              suggestedChanges: {
                eventType: "character-state-change",
                chapter: context.chapterId,
                participants: [entityRef(actor.entity), entityRef(instigator?.entity)].filter(Boolean),
                characterStateChanges: [{ entityId: actor.entityId, status: rule.status, condition: rule.condition }],
                sourceEvidence: [{ chapterId: context.chapterId, sourceQuote: sourceSentence(sentence) }],
              },
              payloadData: { eventType: "character-state-change", chapter: context.chapterId, participants: [entityRef(actor.entity)], characterStateChanges: [{ entityId: actor.entityId, status: rule.status }] },
              confidence: 0.94,
              relatedEntityIds: [actor.entityId, instigator?.entityId].filter(Boolean),
            }));
          }
        }
      }
    }
    return out;
  }

  const FACTION_VERBS = /\b(joined|left|deserted|betrayed|was expelled from|pledged allegiance to|swore allegiance to|defected to)\b/gi;
  function detectFactionMembership(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      FACTION_VERBS.lastIndex = 0;
      let match;
      while ((match = FACTION_VERBS.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        const actor = nearestBefore(mentions, absoluteStart, ["cast"]);
        const faction = nearestAfter(mentions, absoluteEnd, ["factions"]);
        if (!actor || !faction) continue;
        const verb = match[0].toLowerCase();
        const status = /left|deserted|betrayed|expelled/.test(verb) ? "former" : "active";
        const data = actor.entity.data || {};
        const membership = {
          id: uuid("membership"), faction: entityRef(faction.entity), status, action: verb,
          chapterId: context.chapterId, sourceQuote: sourceSentence(sentence), extractionSessionId: context.sessionId,
        };
        const existing = Array.isArray(data.factionMemberships) ? data.factionMemberships.filter((row) => (row.faction?.id || row.factionId || row.id) !== faction.entityId) : [];
        existing.push(membership);
        const fact = {
          ...factBase("faction-membership", "faction-membership-pattern", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
          subject: entityRef(actor.entity), object: entityRef(faction.entity), predicate: verb, statement: status,
        };
        out.push(buildCandidate({
          fact,
          entityType: "cast",
          name: actor.entity.name,
          summary: `${actor.entity.name} ${verb} ${faction.entity.name}.`,
          existingEntityId: actor.entityId,
          suggestedChanges: { factionMemberships: existing, lastFactionChange: membership },
          confidence: 0.91,
          relatedEntityIds: [faction.entityId],
        }));
      }
    }
    return out;
  }

  const WORLD_STATE_RULES = [
    { re: /\b(was sealed|sealed|was opened|opened|was burned|burned|burnt|was destroyed|destroyed|was flooded|flooded|was abandoned|abandoned|was captured|captured|fell|was rebuilt|rebuilt|collapsed)\b/gi, types: ["locations"], major: true },
    { re: /\b(was repaired|repaired|was activated|activated|was deactivated|deactivated|was broken|broke|shattered|was destroyed|destroyed|was opened|opened|was sealed|sealed)\b/gi, types: ["items"], major: false },
  ];

  function statusFromVerb(verb) {
    const value = normalise(verb).replace(/^was\s+/, "");
    if (/burn/.test(value)) return "burned";
    if (/destroy/.test(value)) return "destroyed";
    if (/flood/.test(value)) return "flooded";
    if (/abandon/.test(value)) return "abandoned";
    if (/captur|fell/.test(value)) return "captured";
    if (/rebuild/.test(value)) return "rebuilt";
    if (/collaps/.test(value)) return "collapsed";
    if (/seal/.test(value)) return "sealed";
    if (/open/.test(value)) return "open";
    if (/repair/.test(value)) return "repaired";
    if (/deactiv/.test(value)) return "inactive";
    if (/activ/.test(value)) return "active";
    if (/break|shatter/.test(value)) return "broken";
    return value;
  }

  function detectWorldState(context) {
    const out = [];
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      for (const rule of WORLD_STATE_RULES) {
        rule.re.lastIndex = 0;
        let match;
        while ((match = rule.re.exec(sentence.text)) !== null) {
          const absoluteStart = sentence.start + match.index;
          const absoluteEnd = absoluteStart + match[0].length;
          const subject = nearestBefore(mentions, absoluteStart, rule.types) || nearestAfter(mentions, absoluteEnd, rule.types);
          if (!subject) continue;
          const status = statusFromVerb(match[0]);
          const data = subject.entity.data || {};
          const state = {
            id: uuid("worldstate"), status, verb: match[0].toLowerCase(), chapterId: context.chapterId,
            sourceQuote: sourceSentence(sentence), temporalAnchor: temporalAnchor(sentence.text), extractionSessionId: context.sessionId,
          };
          const fact = {
            ...factBase(subject.entityType === "locations" ? "world-state" : "item-state", "world-state-pattern", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
            subject: entityRef(subject.entity), predicate: match[0].toLowerCase(), statement: status,
          };
          out.push(buildCandidate({
            fact,
            entityType: subject.entityType,
            name: subject.entity.name,
            summary: `${subject.entity.name} becomes ${status}.`,
            existingEntityId: subject.entityId,
            suggestedChanges: { status, currentStatus: status, statusHistory: appendUnique(data.statusHistory, state, (row) => `${row.chapterId}|${row.status}|${normalise(row.sourceQuote)}`), lastStateChange: state },
            confidence: 0.92,
            relatedEntityIds: mentions.filter((row) => row.entityId !== subject.entityId).map((row) => row.entityId),
          }));
          if (rule.major && /destroy|burn|flood|captur|fell|rebuild|collaps/.test(normalise(match[0]))) {
            const eventFact = { ...fact, id: uuid("fact"), kind: "event", detector: "major-world-state" };
            out.push(buildCandidate({
              fact: eventFact,
              entityType: "events",
              name: `${subject.entity.name} · ${status}`,
              summary: sourceSentence(sentence),
              suggestedAction: "create",
              suggestedChanges: {
                eventType: "location-state-change",
                chapter: context.chapterId,
                location: entityRef(subject.entity),
                participants: mentions.filter((row) => row.entityType === "cast").map((row) => entityRef(row.entity)),
                locationChanges: [{ entityId: subject.entityId, status }],
                sourceEvidence: [{ chapterId: context.chapterId, sourceQuote: sourceSentence(sentence) }],
              },
              payloadData: { eventType: "location-state-change", chapter: context.chapterId, location: entityRef(subject.entity), locationChanges: [{ entityId: subject.entityId, status }] },
              confidence: 0.9,
              relatedEntityIds: [subject.entityId, ...mentions.map((row) => row.entityId)],
            }));
          }
        }
      }
    }
    return out;
  }

  function detectUnresolvedQuestions(context) {
    if (!context.deep) return [];
    const out = [];
    const patterns = [
      /\bno one knew\s+(.{5,180})/i,
      /\bthe question remained\s*[:—-]?\s*(.{5,180})/i,
      /\b(?:they|he|she|we) still had to find out\s+(.{5,180})/i,
      /\bwondered whether\s+(.{5,180})/i,
    ];
    for (const sentence of context.sentences) {
      for (const pattern of patterns) {
        const match = sentence.text.match(pattern);
        if (!match) continue;
        const question = cleanedClause(match[1]);
        const mentions = context.mentionsBySentence.get(sentence.id) || [];
        const fact = {
          ...factBase("unresolved-question", "unresolved-question-pattern", sentence, context, { explicit: true }),
          predicate: "unresolved", statement: question,
        };
        out.push(buildCandidate({
          fact,
          entityType: "quests",
          name: `Question · ${question.slice(0, 80)}`,
          summary: `Unresolved question: ${question}.`,
          suggestedAction: "create",
          suggestedChanges: {
            questType: "mystery",
            status: "Active",
            goal: `Resolve: ${question}`,
            unresolved: true,
            participants: mentions.filter((row) => row.entityType === "cast").map((row) => entityRef(row.entity)),
            steps: [{ id: uuid("step"), title: `Discover ${question}`, status: "Not started" }],
            originChapterId: context.chapterId,
            sourceEvidence: [{ chapterId: context.chapterId, sourceQuote: sourceSentence(sentence) }],
          },
          payloadData: { questType: "mystery", status: "Active", goal: `Resolve: ${question}`, unresolved: true },
          confidence: 0.78,
          relatedEntityIds: mentions.map((row) => row.entityId),
        }));
      }
    }
    return out;
  }

  function historySupportsNeverClaim(actor, target, action, context) {
    const data = actor?.data || {};
    if (target.type === "cast" && /met|known|seen/.test(action)) return !!relationshipBetween(actor.id, target.id, context.index);
    if (target.type === "locations" && /been to|visited|entered|seen/.test(action)) {
      if (currentRef(data.currentLocation || data.location, context.index)?.id === target.id) return true;
      return (data.locationHistory || []).some((row) => (row.to?.id || row.location?.id || row.locationId || row.to) === target.id);
    }
    if (target.type === "items" && /owned|held|carried|seen/.test(action)) {
      const itemData = target.data || {};
      if (currentRef(itemData.currentOwner || itemData.owner, context.index)?.id === actor.id) return true;
      return (itemData.ownershipHistory || []).some((row) => row.from?.id === actor.id || row.to?.id === actor.id || row.actor?.id === actor.id);
    }
    return false;
  }

  function detectContradictions(context) {
    if (!context.deep) return [];
    const out = [];
    const re = /\bhad never\s+(met|known|seen|visited|been to|entered|owned|held|carried)\b/gi;
    for (const sentence of context.sentences) {
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(sentence.text)) !== null) {
        const absoluteStart = sentence.start + match.index;
        const absoluteEnd = absoluteStart + match[0].length;
        const actor = nearestBefore(mentions, absoluteStart, ["cast"]);
        const target = nearestAfter(mentions, absoluteEnd, ["cast", "locations", "items"]);
        if (!actor || !target || !historySupportsNeverClaim(actor.entity, target.entity, match[1].toLowerCase(), context)) continue;
        const claim = `${actor.entity.name} had never ${match[1].toLowerCase()} ${target.entity.name}`;
        const fact = {
          ...factBase("contradiction", "never-history-contradiction", sentence, context, { startOffset: absoluteStart, endOffset: absoluteEnd }),
          subject: entityRef(actor.entity), object: entityRef(target.entity), predicate: `never-${match[1].toLowerCase()}`, statement: claim,
        };
        out.push(buildCandidate({
          fact,
          entityType: "lore",
          name: `Disputed history · ${actor.entity.name} / ${target.entity.name}`,
          summary: `The manuscript says “${claim}”, but accepted history links these entities.`,
          suggestedAction: "create",
          suggestedChanges: {
            canon: "disputed",
            scope: "continuity",
            statement: claim,
            confidence: "conflict",
            supportingEntityIds: [actor.entityId, target.entityId],
            sourceEvidence: [{ chapterId: context.chapterId, sourceQuote: sourceSentence(sentence) }],
          },
          payloadData: { canon: "disputed", scope: "continuity", statement: claim, supportingEntityIds: [actor.entityId, target.entityId] },
          confidence: 0.9,
          relatedEntityIds: [actor.entityId, target.entityId],
          conflict: { kind: "history-contradiction", note: "Accepted relationship, movement, or ownership history conflicts with this absolute ‘never’ claim." },
        }));
      }
    }
    return out;
  }

  function updateContextCast(context, sentence) {
    const mentions = (context.mentionsBySentence.get(sentence.id) || []).filter((row) => row.entityType === "cast");
    if (mentions.length) context.lastCast = uniq(mentions.map((row) => row.entityId)).map((id) => context.index.byId.get(id)).filter(Boolean).slice(-3);
  }

  function analyseChapter({ chapterId, text, paragraphs = null, deep = false, sessionId = null }) {
    const index = buildEntityIndex();
    const sentences = sentenceSpans(text || "");
    const mentions = scanMentions(text || "", index);
    const mentionsBySentence = new Map(sentences.map((sentence) => [sentence.id, mentionsForSentence(sentence, mentions)]));
    const context = {
      chapterId,
      text: text || "",
      paragraphs: paragraphs || [],
      deep,
      sessionId: sessionId || uuid("track"),
      index,
      sentences,
      mentions,
      mentionsBySentence,
      sceneBreaks: sceneBreakPositions(text || ""),
      lastCast: [],
    };

    // Establish simple cross-sentence pronoun context before detectors use it.
    for (const sentence of sentences) {
      sentence.contextCast = context.lastCast.slice();
      updateContextCast(context, sentence);
    }
    context.lastCast = [];

    const candidates = [];
    const detectors = [
      detectAliases,
      detectOwnership,
      detectMovement,
      detectRelationships,
      detectKnowledge,
      detectIntentions,
      detectCharacterStatus,
      detectFactionMembership,
      detectWorldState,
      detectUnresolvedQuestions,
      detectContradictions,
    ];
    for (const detector of detectors) {
      // Rebuild context progression for detectors that resolve pronouns.
      context.lastCast = [];
      try {
        const rows = detector(context) || [];
        for (const row of rows) {
          if (candidates.length >= MAX_FACTS_PER_CHAPTER) break;
          candidates.push(row);
        }
      } catch (error) {
        console.warn(`[NarrativeTracking] ${detector.name} failed`, error);
      }
    }

    const deduped = [];
    const byFingerprint = new Map();
    for (const candidate of candidates) {
      const key = candidate.trackingFingerprint || `${candidate.entityType}|${normalise(candidate.name)}|${normalise(candidate.sourceQuote)}`;
      const existing = byFingerprint.get(key);
      if (!existing) {
        byFingerprint.set(key, candidate);
        deduped.push(candidate);
        continue;
      }
      existing.relatedEntityIds = uniq([...(existing.relatedEntityIds || []), ...(candidate.relatedEntityIds || [])]);
      existing.sourceQuotes = uniq([...(existing.sourceQuotes || []), ...(candidate.sourceQuotes || [])]).slice(0, 3);
      existing.trackingFacts = [...(existing.trackingFacts || []), ...(candidate.trackingFacts || [])];
      if ((candidate.confidence || 0) > (existing.confidence || 0)) {
        existing.confidence = candidate.confidence;
        existing.confidenceBand = candidate.confidenceBand;
      }
    }

    return { context, candidates: deduped, mentions };
  }

  async function enrichOccurrences(analysis) {
    const { context } = analysis;
    const existing = backend.OccurrenceService.listByChapterSync(context.chapterId) || [];
    const keySet = new Set(existing.map((row) => `${row.entityId}:${row.startOffset}:${row.endOffset}`));
    const missing = context.mentions.filter((mention) => !keySet.has(`${mention.entityId}:${mention.start}:${mention.end}`)).map((mention) => ({
      occurrenceId: uuid("occ"),
      entityId: mention.entityId,
      entityType: mention.entityType,
      exactText: mention.exactText,
      matchedName: mention.matchedName,
      chapterId: context.chapterId,
      paragraphId: paragraphFor(mention.start, context.paragraphs)?.id || null,
      startOffset: mention.start,
      endOffset: mention.end,
      extractionSessionId: context.sessionId,
      source: "narrative-tracking-alias-scan",
    }));
    if (missing.length) await backend.OccurrenceService.saveMany(missing);
    const all = backend.OccurrenceService.listByChapterSync(context.chapterId) || [];
    const enriched = [];
    for (const occurrence of all) {
      const sentence = context.sentences.find((row) => occurrence.startOffset >= row.start && occurrence.endOffset <= row.end);
      if (!sentence) { enriched.push(occurrence); continue; }
      const mentions = context.mentionsBySentence.get(sentence.id) || [];
      const coMentioned = uniq(mentions.map((row) => row.entityId).filter((id) => id && id !== occurrence.entityId));
      const firstVerb = sentence.text.search(/\b(?:is|was|were|had|has|gave|took|entered|reached|said|asked|learned|promised|attacked|saved|died|opened|sealed)\b/i);
      const relativeStart = occurrence.startOffset - sentence.start;
      let narrativeRole = "mentioned";
      if (firstVerb >= 0) narrativeRole = relativeStart <= firstVerb ? "subject-context" : "object-context";
      const speaker = mentions.find((row) => {
        const after = context.text.slice(row.end, Math.min(sentence.end, row.end + 28));
        const before = context.text.slice(Math.max(sentence.start, row.start - 28), row.start);
        return /^\s*[,—-]?\s*(?:said|asked|replied|whispered|shouted|murmured)\b/i.test(after)
          || /\b(?:said|asked|replied|whispered|shouted|murmured)\s*$/i.test(before);
      });
      enriched.push({
        ...occurrence,
        sourceSentence: sourceSentence(sentence),
        sentenceIndex: sentence.index,
        sceneIndex: sceneIndexFor(sentence.start, context.sceneBreaks),
        temporalAnchor: temporalAnchor(sentence.text),
        coMentionedEntityIds: coMentioned,
        sentiment: sentenceSentiment(sentence.text),
        trackingTags: trackingTags(sentence.text),
        narrativeRole,
        speakerEntityId: speaker?.entityId || null,
        trackingVersion: TRACKING_VERSION,
        updatedAt: nowIso(),
      });
    }
    if (enriched.length) await backend.OccurrenceService.saveMany(enriched);
    window.dispatchEvent(new CustomEvent("lw:occurrence-store-updated", { detail: { chapterId: context.chapterId, occurrences: enriched } }));
    return enriched;
  }

  function sameEvidence(a, b) {
    const aq = normalise(a.sourceQuote || a.mention || "");
    const bq = normalise(b.sourceQuote || b.mention || "");
    if (!aq || !bq) return false;
    return aq === bq || aq.includes(bq) || bq.includes(aq);
  }

  async function mergeIntoReview(candidates) {
    const out = [];
    for (const candidate of candidates) {
      const current = backend.ReviewService.listSync();
      const match = current.find((row) => {
        if (["done", "accepted", "denied", "merged"].includes(row.status)) return false;
        if (row.trackingFingerprint && row.trackingFingerprint === candidate.trackingFingerprint) return true;
        if (row.chapterId !== candidate.chapterId || backend.EntityService.normaliseType(row.entityType || row.type) !== candidate.entityType) return false;
        const sameTarget = (row.existingEntityId || row.targetEntityId || null) === (candidate.existingEntityId || null);
        const sameName = normalise(row.name || row.candidate?.name) === normalise(candidate.name);
        return (sameTarget || sameName) && sameEvidence(row, candidate);
      });
      if (match && backend.ImpactReviewService?.updateItem) {
        const updated = await backend.ImpactReviewService.updateItem(match.id, (row) => ({
          ...row,
          summary: row.summary || candidate.summary,
          reason: row.reason || candidate.reason,
          confidence: Math.max(row.confidence || 0, candidate.confidence || 0),
          confidenceBand: confidenceBand(Math.max(row.confidence || 0, candidate.confidence || 0)),
          value: Math.max(row.value || 0, candidate.value || 0),
          relatedEntityIds: uniq([...(row.relatedEntityIds || []), ...(candidate.relatedEntityIds || [])]),
          suggestedChanges: { ...(row.suggestedChanges || {}), ...(candidate.suggestedChanges || {}) },
          trackingKind: row.trackingKind || candidate.trackingKind,
          trackingFingerprint: row.trackingFingerprint || candidate.trackingFingerprint,
          trackingFacts: [...(row.trackingFacts || []), ...(candidate.trackingFacts || [])],
          conflict: row.conflict || candidate.conflict,
          payload: {
            ...(row.payload || {}),
            data: { ...(row.payload?.data || {}), ...(candidate.payload?.data || {}) },
          },
        }));
        out.push(updated || match);
      } else {
        const added = await backend.ReviewService.add(candidate);
        out.push(added || candidate);
      }
    }
    return out;
  }

  async function applyReviewItem(row) {
    if (!row) return null;
    const existingId = row.existingEntityId || row.targetEntityId || row.entityId;
    let saved = null;
    if (existingId && row.suggestedChanges && Object.keys(row.suggestedChanges).length) {
      const existing = backend.EntityService.getSync(existingId, row.entityType);
      if (existing) saved = await backend.EntityService.update(row.entityType, existingId, { data: { ...(existing.data || {}), ...(row.suggestedChanges || {}) } });
    } else if (row.payload && existingId) {
      saved = await backend.EntityService.update(row.entityType, existingId, row.payload);
    } else if (row.payload?.name || row.name) {
      const fields = row.payload?.name ? { ...row.payload } : { name: row.name, summary: row.summary };
      if (row.suggestedChanges && Object.keys(row.suggestedChanges).length) fields.data = { ...(fields.data || {}), ...row.suggestedChanges };
      if (row.relatedEntityIds?.length) fields.data = { ...(fields.data || {}), relatedEntityIds: row.relatedEntityIds };
      saved = await backend.EntityService.save(row.entityType || "references", fields, { status: "active" });
    }
    if (saved?.id && row.candidateId) await backend.OccurrenceService.linkCandidateToEntity(row.candidateId, saved.id, saved.type || row.entityType);
    await backend.ReviewService.resolve(row.id, "done");
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated", { detail: { reason: "tracking-auto-accept", reviewItemId: row.id } }));
    return saved;
  }

  function safeForAutoAccept(row) {
    if (!row || row.confidenceBand !== "blue" || row.conflict) return false;
    if (row.trackingKind) return row.trackingKind === "alias" && !row.existingEntityId;
    if (row.suggestedChanges && Object.keys(row.suggestedChanges).length) return false;
    if (row.suggestedAction === "link") return true;
    return row.matchType === "exact" && !!row.existingEntityId;
  }

  async function autoAcceptSafeRows(chapterId, preferences) {
    if (preferences.autoAdd95 === false || !backend.ImpactReviewService) return [];
    const rows = backend.ReviewService.listSync().filter((row) => row.chapterId === chapterId && row.status === "pending" && safeForAutoAccept(row));
    const accepted = [];
    for (const row of rows) {
      try {
        const analysis = backend.ImpactReviewService.analyse(row);
        if (analysis?.impact && ["high", "critical"].includes(analysis.impact.severity)) continue;
        const updated = await backend.ImpactReviewService.acceptWithReceipt(row, applyReviewItem);
        await backend.ImpactReviewService.updateItem(row.id, (current) => ({
          ...current,
          decision: { ...(current.decision || {}), autoAccepted: true, autoAcceptedAt: nowIso() },
        }));
        accepted.push(updated || row);
      } catch (error) {
        console.warn("[NarrativeTracking] safe auto-accept failed", error);
      }
    }
    return accepted;
  }

  function buildReport({ analysis, enrichedOccurrences, mergedCandidates, baselineResult, autoAccepted }) {
    const facts = mergedCandidates.flatMap((row) => row.trackingFacts || []).filter(Boolean);
    const counts = {};
    for (const fact of facts) counts[fact.kind] = (counts[fact.kind] || 0) + 1;
    const stateKinds = new Set(["ownership", "movement", "character-status", "world-state", "item-state", "faction-membership"]);
    const report = {
      version: TRACKING_VERSION,
      id: uuid("track-report"),
      sessionId: analysis.context.sessionId,
      chapterId: analysis.context.chapterId,
      deep: analysis.context.deep,
      generatedAt: nowIso(),
      sentenceCount: analysis.context.sentences.length,
      mentionCount: analysis.mentions.length,
      enrichedOccurrenceCount: enrichedOccurrences.length,
      candidateCount: mergedCandidates.length,
      baselineCandidateCount: baselineResult?.candidates?.length || 0,
      autoAcceptedCount: autoAccepted.length,
      counts,
      stateChangeCount: facts.filter((fact) => stateKinds.has(fact.kind)).length,
      knowledgeCount: (counts.knowledge || 0) + (counts.belief || 0),
      relationshipCount: counts.relationship || 0,
      promiseCount: (counts.promise || 0) + (counts["unresolved-question"] || 0),
      contradictionCount: counts.contradiction || 0,
      affectedEntityIds: uniq(mergedCandidates.flatMap((row) => row.relatedEntityIds || []).concat(mergedCandidates.map((row) => row.existingEntityId).filter(Boolean))),
      facts: facts.slice(0, 80),
      reviewItemIds: mergedCandidates.map((row) => row.id),
    };
    return report;
  }

  function chapterLabel(chapterId) {
    const manuscript = backend.ManuscriptChapterService.loadSync() || {};
    const chapter = (manuscript.chapters || []).find((row) => row.id === chapterId);
    if (!chapter) return chapterId || "Selected text";
    const number = chapter.num || chapter.slotNumber;
    return `${number ? `Ch. ${number} · ` : ""}${chapter.title || "Untitled"}`;
  }

  async function saveReport(session, report) {
    const previous = originalLoadSessionSync() || {};
    const priorHistory = Array.isArray(previous.history) ? previous.history : [];
    const entry = {
      id: report.sessionId,
      sessionId: report.sessionId,
      chapterId: report.chapterId,
      chapterLabel: chapterLabel(report.chapterId),
      mode: report.deep ? "deep" : "quick",
      privacy: session.aiUsed ? "ai" : "local",
      state: session.status || "complete",
      startedAt: session.startedAt || session.updatedAt || report.generatedAt,
      completedAt: report.generatedAt,
      duration: session.duration || "—",
      totals: {
        candidates: (session.candidateCount || 0) + report.candidateCount,
        autoAdded: report.autoAcceptedCount,
        accepted: 0,
        merged: 0,
        denied: 0,
        failed: 0,
      },
      tracking: clone(report),
      note: `${report.stateChangeCount} state changes · ${report.knowledgeCount} knowledge/belief changes · ${report.promiseCount} open threads · ${report.contradictionCount} contradictions`,
    };
    const history = [entry, ...priorHistory.filter((row) => row.sessionId !== entry.sessionId && row.id !== entry.id)].slice(0, MAX_HISTORY);
    const next = { ...session, tracking: report, history, current: entry, updatedAt: report.generatedAt };
    await backend.ExtractionService.saveSession(next);
    window.dispatchEvent(new CustomEvent("lw:narrative-tracking-updated", { detail: { report, session: next } }));
    return next;
  }

  function latestReportSync() {
    return originalLoadSessionSync()?.tracking || null;
  }

  function historySync() {
    return originalLoadSessionSync()?.history || [];
  }

  async function runEnhancedExtraction(args = {}) {
    const preferences = backend.SettingsService.getSectionSync("extraction", { autoAdd95: true, threshold: 50, scan: {} }) || {};
    // The legacy extractor auto-applied blue candidates before Impact Review
    // could record a before-state. Temporarily suppress only that flag for this
    // call, then re-apply genuinely safe blue rows through reversible receipts.
    const originalGetSection = backend.SettingsService.getSectionSync.bind(backend.SettingsService);
    backend.SettingsService.getSectionSync = function trackingAwareSettings(section, fallback) {
      const value = originalGetSection(section, fallback);
      return section === "extraction" ? { ...(value || {}), autoAdd95: false } : value;
    };
    let baselineResult;
    try {
      baselineResult = await originalRunExtraction(args);
    } finally {
      backend.SettingsService.getSectionSync = originalGetSection;
    }

    const sessionId = baselineResult?.session?.sessionId || uuid("ext");
    const analysis = analyseChapter({
      chapterId: args.chapterId,
      text: args.text || "",
      paragraphs: args.paragraphs || null,
      deep: !!args.deep,
      sessionId,
    });
    const enrichedOccurrences = await enrichOccurrences(analysis);
    const mergedCandidates = await mergeIntoReview(analysis.candidates);
    if (mergedCandidates.length) {
      try {
        args.onProgress?.({
          sessionId,
          chapterId: args.chapterId,
          scope: args.scope || "chapter",
          stage: "narrative-tracking",
          deep: !!args.deep,
          candidates: mergedCandidates,
        });
      } catch (_) {}
      window.dispatchEvent(new CustomEvent("lw:extraction-progress", { detail: {
        sessionId, chapterId: args.chapterId, scope: args.scope || "chapter", stage: "narrative-tracking", deep: !!args.deep, candidates: mergedCandidates,
      } }));
    }

    const autoAccepted = await autoAcceptSafeRows(args.chapterId, preferences);
    const report = buildReport({ analysis, enrichedOccurrences, mergedCandidates, baselineResult, autoAccepted });
    const session = await saveReport({ ...(baselineResult?.session || {}), sessionId, chapterId: args.chapterId }, report);

    const combinedCandidates = [
      ...(baselineResult?.candidates || []),
      ...mergedCandidates.filter((row) => !(baselineResult?.candidates || []).some((base) => base.id === row.id)),
    ];
    return {
      ...(baselineResult || {}),
      session,
      tracking: report,
      occurrences: enrichedOccurrences,
      occurrenceCount: enrichedOccurrences.length,
      candidates: combinedCandidates,
      candidateCount: combinedCandidates.length,
      autoAccepted,
    };
  }

  const NarrativeTrackingService = {
    version: TRACKING_VERSION,
    analyseChapter,
    enrichOccurrences,
    mergeIntoReview,
    buildReport,
    latestReportSync,
    historySync,
    applyReviewItem,
    safeForAutoAccept,
  };

  backend.NarrativeTrackingService = NarrativeTrackingService;
  window.NarrativeTrackingService = NarrativeTrackingService;
  backend.ExtractionService.runExtraction = runEnhancedExtraction;
  backend.ExtractionService.loadHistorySync = historySync;
  backend.ExtractionService.latestTrackingReportSync = latestReportSync;

  // Feed the latest tracking report into the existing Home/Today intelligence
  // surfaces without introducing another dashboard store.
  const story = backend.StoryIntelligenceService;
  if (story && !story.__narrativeTrackingInstalled) {
    const originalSuggestions = story.buildSuggestions.bind(story);
    const originalDashboard = story.buildDashboard.bind(story);
    story.buildSuggestions = function trackingSuggestions(opts = {}) {
      const rows = originalSuggestions({ ...opts, limit: Math.max(opts.limit || 36, 80) });
      const report = latestReportSync();
      if (!report) return rows.slice(0, opts.limit || 36);
      const additions = [];
      if (report.contradictionCount) additions.push({
        id: `tracking-contradictions-${report.id}`, section: "continuity", priority: 98, confidence: "high",
        title: `${report.contradictionCount} evidence-backed ${report.contradictionCount === 1 ? "contradiction" : "contradictions"} found`,
        why: `${report.chapterId ? chapterLabel(report.chapterId) : "The latest extraction"} contains absolute claims that conflict with accepted relationship, movement, or ownership history.`,
        action: "Open Impact Review", actionType: "open-review", chapter: report.chapterId ? chapterLabel(report.chapterId) : "—",
      });
      if (report.promiseCount) additions.push({
        id: `tracking-promises-${report.id}`, section: "threads", priority: 82, confidence: "strong",
        title: `${report.promiseCount} new ${report.promiseCount === 1 ? "promise or question" : "promises and unresolved questions"}`,
        why: "The local deep read converted explicit commitments and open questions into reviewable Story Thread proposals.",
        action: "Review new threads", actionType: "open-review", chapter: report.chapterId ? chapterLabel(report.chapterId) : "—",
      });
      if (report.knowledgeCount) additions.push({
        id: `tracking-knowledge-${report.id}`, section: "intel", priority: 74, confidence: "strong",
        title: `${report.knowledgeCount} character knowledge or belief changes detected`,
        why: "Review who learned, believed, suspected, remembered, or forgot each claim before it becomes part of character perspective.",
        action: "Review perspective changes", actionType: "open-review", chapter: report.chapterId ? chapterLabel(report.chapterId) : "—",
      });
      const seen = new Set(rows.map((row) => row.id));
      return [...additions.filter((row) => !seen.has(row.id)), ...rows]
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, opts.limit || 36);
    };
    story.buildDashboard = function trackingDashboard() {
      const dashboard = originalDashboard();
      return { ...dashboard, tracking: latestReportSync() };
    };
    story.__narrativeTrackingInstalled = true;
  }

  window.dispatchEvent(new CustomEvent("lw:narrative-tracking-ready", { detail: { service: NarrativeTrackingService } }));
})();
