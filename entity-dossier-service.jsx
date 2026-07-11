// =====================================================================
// entity-dossier-service.jsx — canonical live dossiers and comparison.
//
// Builds read models from the existing EntityService, OccurrenceService,
// ManuscriptChapterService, ReviewService, ReferencesService, AuditService,
// ImpactReviewService and StoryIntelligenceService. It introduces no second
// entity store and performs no silent canon mutation.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend?.EntityService || backend.EntityDossierService) return;

  const PIN_KEY = "lw:v2:entity-compare-pins";
  const MAX_PINS = 12;
  const HISTORY_FIELDS = new Set([
    "ownershipHistory", "locationHistory", "statusHistory", "usageHistory",
    "conditions", "intentions", "motives", "knowledgeClaims", "beliefs",
    "factionMemberships", "markers", "relationshipMarkers", "evidence",
    "sourceEvidence", "branches", "steps",
  ]);
  const HIDDEN_FIELDS = new Set([
    "id", "type", "entityType", "createdAt", "updatedAt", "deletedAt",
    "sourceMentions", "reviewQueueCount", "trackingFact", "provenance",
    "lastStateChange", "lastMovement", "lastStatusChange", "lastKnowledgeChange",
    "lastFactionChange", "lastIntention", "lastMotiveEvidence", "lastInteraction",
  ]);

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const normalise = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  const uniq = (rows) => [...new Set((rows || []).filter(Boolean))];
  const titleCase = (value) => {
    const text = String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
    return text ? text[0].toUpperCase() + text.slice(1) : "Field";
  };
  const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const entityRef = (entity) => entity ? ({ id: entity.id, name: entity.name, type: entity.type }) : null;
  const valueRef = (value, snapshot) => {
    if (!value) return null;
    if (typeof value === "string") {
      const entity = snapshot?.entityById?.get(value);
      return entity ? entityRef(entity) : { id: value, name: value, type: "unknown" };
    }
    if (typeof value === "object") {
      const id = value.id || value.entityId || value.targetId || null;
      const entity = id ? snapshot?.entityById?.get(id) : null;
      return entity ? entityRef(entity) : {
        id,
        name: value.name || value.label || value.title || id || "Unknown",
        type: value.type || value.entityType || entity?.type || "unknown",
      };
    }
    return null;
  };
  const displayValue = (value) => {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : String(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      if (!value.length) return "—";
      return value.map((row) => {
        if (row == null) return "";
        if (typeof row !== "object") return String(row);
        return row.name || row.label || row.title || row.statement || row.action || row.goal || row.status || row.id || "Record";
      }).filter(Boolean).join(" · ");
    }
    if (typeof value === "object") return value.name || value.label || value.title || value.statement || value.status || value.id || JSON.stringify(value);
    return String(value);
  };
  const stable = (value) => {
    try { return JSON.stringify(value, Object.keys(value || {}).sort()); } catch (_) { return String(value); }
  };

  function manuscriptContext() {
    const manuscript = backend.ManuscriptChapterService?.loadSync?.() || {};
    const chapters = (manuscript.chapters || []).filter((chapter) => !chapter.reserved).map((chapter, index) => ({
      ...chapter,
      index,
      number: chapter.num || chapter.slotNumber || index + 1,
      label: `Ch. ${chapter.num || chapter.slotNumber || index + 1}${chapter.title ? ` · ${chapter.title}` : ""}`,
    }));
    return {
      manuscript,
      chapters,
      chapterById: new Map(chapters.map((chapter) => [chapter.id, chapter])),
      chapterIndex: new Map(chapters.map((chapter) => [chapter.id, chapter.index])),
    };
  }

  function storySnapshot() {
    const story = backend.StoryIntelligenceService || window.StoryIntelligenceService;
    if (story?.buildSnapshot) return story.buildSnapshot();
    const entities = Object.entries(backend.EntityService.listAllSync() || {}).flatMap(([type, byId]) =>
      Object.values(byId || {}).filter((entity) => entity?.status !== "deleted").map((entity) => ({ ...entity, type: entity.type || type }))
    );
    return {
      entities,
      entityById: new Map(entities.map((entity) => [entity.id, entity])),
      linksByEntity: new Map(),
      backlinks: new Map(),
      occurrences: backend.OccurrenceService?.listAllSync?.() || [],
      review: backend.ReviewService?.listSync?.() || [],
    };
  }

  function entityAliases(entity) {
    return uniq([
      ...(entity.aliases || []),
      ...(entity.data?.aliases || []),
      ...(entity.data?.titles || []),
    ].map((value) => typeof value === "object" ? (value.name || value.label || value.title) : value).filter(Boolean));
  }

  function fieldEntries(entity) {
    const merged = { ...entity, ...(entity.data || {}) };
    const rows = [];
    for (const [key, value] of Object.entries(merged)) {
      if (HIDDEN_FIELDS.has(key) || HISTORY_FIELDS.has(key) || value == null || value === "") continue;
      if (Array.isArray(value) && !value.length) continue;
      if (isPlainObject(value) && !Object.keys(value).length) continue;
      rows.push({
        key,
        label: titleCase(key),
        value: clone(value),
        display: displayValue(value),
        kind: Array.isArray(value) ? "list" : isPlainObject(value) ? "object" : typeof value,
      });
    }
    const identityKeys = new Set(["name", "title", "epithet", "role", "pronouns", "age", "origin", "affiliation", "kind", "itemType", "creatureType", "factionType", "eventType", "questType"]);
    const stateKeys = new Set(["status", "currentStatus", "currentLocation", "currentOwner", "condition", "placed", "canon", "scope", "confidence", "unresolved"]);
    const purposeKeys = new Set(["summary", "description", "goal", "goals", "personality", "traits", "fears", "secrets", "writingInstructions", "culture", "history", "danger", "restrictions"]);
    return {
      identity: rows.filter((row) => identityKeys.has(row.key)),
      state: rows.filter((row) => stateKeys.has(row.key)),
      purpose: rows.filter((row) => purposeKeys.has(row.key)),
      other: rows.filter((row) => !identityKeys.has(row.key) && !stateKeys.has(row.key) && !purposeKeys.has(row.key)),
      all: rows,
    };
  }

  function occurrenceEvidence(entity, context, snapshot) {
    const rows = (snapshot.occurrences || backend.OccurrenceService?.listAllSync?.() || [])
      .filter((occurrence) => occurrence.entityId === entity.id && !occurrence.stale)
      .map((occurrence, index) => {
        const chapter = context.chapterById.get(occurrence.chapterId);
        return {
          id: occurrence.occurrenceId || occurrence.id || `${entity.id}-${occurrence.chapterId}-${occurrence.startOffset}-${index}`,
          entityId: entity.id,
          chapterId: occurrence.chapterId,
          chapterNumber: chapter?.number || null,
          chapterLabel: chapter?.label || occurrence.chapterId || "Unknown chapter",
          chapterIndex: chapter?.index ?? Number.MAX_SAFE_INTEGER,
          paragraphId: occurrence.paragraphId || null,
          sceneIndex: occurrence.sceneIndex ?? null,
          sentenceIndex: occurrence.sentenceIndex ?? null,
          exactText: occurrence.exactText || occurrence.matchedName || entity.name,
          quote: occurrence.sourceSentence || occurrence.context || occurrence.excerpt || occurrence.exactText || "",
          startOffset: occurrence.startOffset ?? null,
          endOffset: occurrence.endOffset ?? null,
          sentiment: occurrence.sentiment || "neutral",
          tags: occurrence.trackingTags || [],
          role: occurrence.narrativeRole || "mentioned",
          speakerEntityId: occurrence.speakerEntityId || null,
          temporalAnchor: occurrence.temporalAnchor || null,
          coMentionedEntityIds: occurrence.coMentionedEntityIds || [],
          coMentioned: (occurrence.coMentionedEntityIds || []).map((id) => snapshot.entityById?.get(id)).filter(Boolean).map(entityRef),
          raw: occurrence,
        };
      })
      .sort((a, b) => a.chapterIndex - b.chapterIndex || (a.startOffset || 0) - (b.startOffset || 0));
    return rows;
  }

  function collectHistoryRecords(entity, context, snapshot) {
    const data = entity.data || {};
    const records = [];
    const seen = new Set();
    const add = (field, row, index = 0) => {
      if (row == null) return;
      const object = typeof row === "object" ? row : { value: row };
      const chapterId = object.chapterId || object.sourceChapterId || object.originChapterId || null;
      const chapter = chapterId ? context.chapterById.get(chapterId) : null;
      const label = object.action || object.verb || object.statement || object.title || object.goal || object.status || object.condition || displayValue(row);
      const key = `${field}|${chapterId || ""}|${normalise(label)}|${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      const relatedIds = uniq([
        object.entityId, object.fromId, object.toId, object.factionId,
        object.from?.id, object.to?.id, object.actor?.id, object.causedBy?.id,
        object.sourceEntity?.id, object.faction?.id, object.location?.id,
      ]);
      records.push({
        id: object.id || `${entity.id}-${field}-${records.length}`,
        field,
        kind: field.replace(/History$/, "").replace(/s$/, ""),
        label: titleCase(label || field),
        chapterId,
        chapterNumber: chapter?.number || null,
        chapterLabel: chapter?.label || chapterId || "Unplaced in chronology",
        chapterIndex: chapter?.index ?? Number.MAX_SAFE_INTEGER,
        sourceQuote: object.sourceQuote || object.quote || "",
        temporalAnchor: object.temporalAnchor || null,
        status: object.status || object.condition || object.state || null,
        from: valueRef(object.from || object.previousOwner || object.fromLocation, snapshot),
        to: valueRef(object.to || object.currentOwner || object.location || object.faction, snapshot),
        related: relatedIds.map((id) => snapshot.entityById?.get(id)).filter(Boolean).map(entityRef),
        raw: clone(object),
      });
    };
    for (const field of HISTORY_FIELDS) {
      const value = data[field] ?? entity[field];
      if (Array.isArray(value)) value.forEach((row, index) => add(field, row, index));
      else if (value) add(field, value, 0);
    }
    for (const [field, value] of Object.entries(data)) {
      if (HISTORY_FIELDS.has(field)) continue;
      if (/History$/.test(field) && Array.isArray(value)) value.forEach((row, index) => add(field, row, index));
    }
    return records.sort((a, b) => a.chapterIndex - b.chapterIndex || String(a.id).localeCompare(String(b.id)));
  }

  function connectionRows(entity, snapshot) {
    const ids = new Set([
      ...(snapshot.linksByEntity?.get(entity.id) || []),
      ...(snapshot.backlinks?.get(entity.id) || []),
    ]);
    const relationships = (snapshot.entities || []).filter((row) => row.type === "relationships" && (
      row.data?.fromId === entity.id || row.data?.toId === entity.id || row.fromId === entity.id || row.toId === entity.id
    ));
    relationships.forEach((relationship) => {
      ids.add(relationship.id);
      const other = relationship.data?.fromId === entity.id ? relationship.data?.toId : relationship.data?.fromId;
      if (other) ids.add(other);
    });
    return [...ids].map((id) => snapshot.entityById?.get(id)).filter(Boolean).map((target) => {
      const relationship = relationships.find((row) => row.id === target.id || row.data?.fromId === target.id || row.data?.toId === target.id);
      const incoming = snapshot.backlinks?.get(entity.id)?.has(id) || false;
      const outgoing = snapshot.linksByEntity?.get(entity.id)?.has(id) || false;
      return {
        ...entityRef(target),
        direction: incoming && outgoing ? "mutual" : outgoing ? "outgoing" : incoming ? "incoming" : "linked",
        relationshipId: relationship?.id || null,
        markers: relationship?.data?.markers || relationship?.data?.relationshipMarkers || [],
        kind: relationship?.data?.relationshipType || relationship?.relationshipType || null,
      };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }

  function referenceRows(entity) {
    return (backend.ReferencesService?.listSync?.() || []).filter((reference) => {
      const ids = [
        ...(reference.linkedEntityIds || []),
        ...(reference.linkedEntities || []).map((row) => typeof row === "string" ? row : row?.id),
      ];
      return ids.includes(entity.id) || normalise(reference.content || "").includes(normalise(entity.name));
    }).map((reference) => ({
      id: reference.id,
      title: reference.title || reference.name || "Untitled reference",
      kind: reference.kind || reference.type || "note",
      content: reference.content || reference.notes || "",
      aiContext: reference.aiContext !== false && reference.includedInAIContext !== false,
      updatedAt: reference.updatedAt || reference.createdAt || null,
      raw: reference,
    }));
  }

  function reviewRows(entity, snapshot) {
    const all = backend.ImpactReviewService?.listAllReviewSync?.() || backend.ReviewService?.listSync?.() || [];
    return all.filter((row) => {
      const ids = [row.entityId, row.existingEntityId, row.targetEntityId, ...(row.relatedEntityIds || [])].filter(Boolean);
      return ids.includes(entity.id) || normalise(row.name || row.payload?.name) === normalise(entity.name);
    }).map((row) => {
      const analysis = backend.ImpactReviewService?.analyse?.(row) || null;
      return {
        id: row.id,
        name: row.name || row.payload?.name || "Review decision",
        status: row.status || "pending",
        sourceQuote: row.sourceQuote || row.mention || "",
        suggestedAction: row.suggestedAction || row.action || "review",
        confidence: row.confidence ?? null,
        confidenceBand: row.confidenceBand || row.level || null,
        severity: analysis?.impact?.severity || row.impactReceipt?.severity || "low",
        affectedCount: analysis?.impact?.affected?.length || row.impactReceipt?.affectedEntityIds?.length || 0,
        chapterCount: analysis?.impact?.chapters?.length || row.impactReceipt?.affectedChapterIds?.length || 0,
        receipt: row.impactReceipt || null,
        raw: row,
      };
    }).sort((a, b) => {
      const order = { pending: 0, postponed: 1, done: 2, accepted: 2, denied: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
  }

  function auditRows(entity) {
    const all = backend.AuditService?.getRecentSync?.(250) || [];
    return all.filter((row) => row.targetId === entity.id || row.relatedIds?.includes(entity.id) || row.before?.id === entity.id || row.after?.id === entity.id)
      .map((row) => ({
        id: row.id,
        action: row.action,
        label: row.label || row.action,
        createdAt: row.createdAt || row.at || row.timestamp || null,
        contributor: row.contributor || row.author || row.actor || row.metadata?.contributor || null,
        source: row.source || null,
        reversible: backend.AuditService?.canUndo?.(row.id) || false,
        before: row.before || null,
        after: row.after || null,
        raw: row,
      }));
  }

  function knowledgeRows(entity) {
    const data = entity.data || {};
    const claims = [];
    const add = (kind, row, index) => {
      const value = typeof row === "object" ? row : { statement: row };
      claims.push({
        id: value.id || `${entity.id}-${kind}-${index}`,
        kind,
        statement: value.statement || value.text || value.name || displayValue(row),
        state: value.state || kind,
        certainty: value.certainty || value.confidence || null,
        sourceEntity: value.sourceEntity || null,
        chapterId: value.chapterId || value.sourceChapterId || null,
        sourceQuote: value.sourceQuote || "",
        raw: clone(value),
      });
    };
    (data.knowledgeClaims || []).forEach((row, index) => add("knowledge", row, index));
    (data.beliefs || []).forEach((row, index) => add("belief", row, index));
    (data.secrets || []).forEach?.((row, index) => add("secret", row, index));
    return claims;
  }

  function chapterEvolution(entity, context, evidence, history, asOfChapterId = null) {
    const cutoff = asOfChapterId ? context.chapterIndex.get(asOfChapterId) : Number.MAX_SAFE_INTEGER;
    const rows = context.chapters.map((chapter) => {
      const chapterEvidence = evidence.filter((row) => row.chapterId === chapter.id);
      const chapterHistory = history.filter((row) => row.chapterId === chapter.id);
      return {
        id: chapter.id,
        number: chapter.number,
        label: chapter.label,
        index: chapter.index,
        mentionCount: chapterEvidence.length,
        evidence: chapterEvidence,
        changes: chapterHistory,
        active: chapter.index <= cutoff,
      };
    }).filter((row) => row.mentionCount || row.changes.length);

    const applied = history.filter((row) => row.chapterIndex <= cutoff);
    const current = entity.data || {};
    const snapshot = {
      status: entity.status || current.currentStatus || current.status || null,
      location: current.currentLocation || current.location || null,
      owner: current.currentOwner || current.owner || null,
      condition: current.condition || null,
      faction: current.faction || current.affiliation || null,
    };
    for (const row of applied) {
      const raw = row.raw || {};
      if (/location/i.test(row.field) && (raw.to || raw.location)) snapshot.location = raw.to || raw.location;
      if (/ownership/i.test(row.field)) snapshot.owner = raw.to ?? snapshot.owner;
      if (/status|condition/i.test(row.field)) {
        snapshot.status = raw.status || snapshot.status;
        snapshot.condition = raw.condition || snapshot.condition;
      }
      if (/faction/i.test(row.field) && raw.faction) snapshot.faction = raw.faction;
    }
    return {
      rows,
      cutoffChapterId: asOfChapterId,
      cutoffIndex: cutoff,
      state: snapshot,
      visibleEvidence: evidence.filter((row) => row.chapterIndex <= cutoff),
      visibleHistory: applied,
    };
  }

  function completeness(entity, snapshot) {
    const story = backend.StoryIntelligenceService || window.StoryIntelligenceService;
    try {
      const profile = story?.buildEntityProfile?.(entity, snapshot);
      if (profile) return profile;
    } catch (_) {}
    const fields = fieldEntries(entity).all;
    return {
      entity,
      completeness: Math.min(100, fields.length * 10),
      missing: fields.length ? [] : ["summary", "core fields"],
      mentionCount: 0,
      chapterCount: 0,
      linkedCount: 0,
      riskScore: 0,
      dangling: [],
      unplaced: false,
      isolated: false,
    };
  }

  function build(entityOrId, type, opts = {}) {
    const snapshot = opts.snapshot || storySnapshot();
    const context = opts.context || manuscriptContext();
    const raw = typeof entityOrId === "object"
      ? backend.EntityService.getSync(entityOrId.id, type || entityOrId.type || entityOrId.entityType) || entityOrId
      : backend.EntityService.getSync(entityOrId, type);
    if (!raw) return null;
    const entity = { ...raw, type: raw.type || backend.EntityService.normaliseType(type || raw.entityType) };
    const evidence = occurrenceEvidence(entity, context, snapshot);
    const history = collectHistoryRecords(entity, context, snapshot);
    const profile = completeness(entity, snapshot);
    const connections = connectionRows(entity, snapshot);
    const fields = fieldEntries(entity);
    const evolution = chapterEvolution(entity, context, evidence, history, opts.asOfChapterId || null);
    const references = referenceRows(entity);
    const reviews = reviewRows(entity, snapshot);
    const audit = auditRows(entity);
    const knowledge = knowledgeRows(entity);
    const warnings = [];
    if (profile.missing?.length) warnings.push(`Missing: ${profile.missing.join(", ")}`);
    if (profile.dangling?.length) warnings.push(`${profile.dangling.length} broken linked ${profile.dangling.length === 1 ? "record" : "records"}`);
    if (profile.unplaced) warnings.push("Waiting for Atlas placement");
    if (profile.isolated && evidence.length) warnings.push("Appears in the manuscript but has no canonical entity links");
    const pending = reviews.filter((row) => ["pending", "postponed"].includes(row.status));
    const acceptedReceipts = reviews.filter((row) => row.receipt && !row.receipt.revertedAt);
    const chapterIds = uniq(evidence.map((row) => row.chapterId));
    const aliases = entityAliases(entity);

    return {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      aliases,
      entity,
      profile,
      fields,
      evidence,
      history,
      evolution,
      connections,
      references,
      reviews,
      audit,
      knowledge,
      warnings,
      metrics: {
        completeness: profile.completeness || 0,
        mentions: evidence.length,
        chapters: chapterIds.length,
        links: connections.length,
        pendingReview: pending.length,
        acceptedReceipts: acceptedReceipts.length,
        historyEvents: history.length,
        knowledgeClaims: knowledge.length,
        risk: profile.riskScore || 0,
      },
      firstAppearance: evidence[0] || null,
      lastAppearance: evidence[evidence.length - 1] || null,
      chapterOptions: context.chapters.map((chapter) => ({ id: chapter.id, number: chapter.number, label: chapter.label })),
      currentChapterId: opts.asOfChapterId || null,
      generatedAt: new Date().toISOString(),
    };
  }

  function compare(entityRefs = [], opts = {}) {
    const refs = (entityRefs || []).map((row) => {
      if (typeof row === "string") return { id: row, type: null };
      return { id: row.id || row.entityId, type: row.type || row.entityType || null };
    }).filter((row) => row.id);
    const dossiers = refs.map((ref) => build(ref.id, ref.type, opts)).filter(Boolean).slice(0, 6);
    const standard = [
      { key: "$type", label: "Type", get: (d) => d.type },
      { key: "$status", label: "Status", get: (d) => d.entity.status || d.entity.data?.currentStatus || d.entity.data?.status },
      { key: "$summary", label: "Summary", get: (d) => d.entity.summary || d.entity.data?.summary },
      { key: "$mentions", label: "Manuscript mentions", get: (d) => d.metrics.mentions },
      { key: "$chapters", label: "Chapters", get: (d) => d.metrics.chapters },
      { key: "$first", label: "First appearance", get: (d) => d.firstAppearance?.chapterLabel },
      { key: "$last", label: "Last appearance", get: (d) => d.lastAppearance?.chapterLabel },
      { key: "$links", label: "Canonical links", get: (d) => d.metrics.links },
      { key: "$completeness", label: "Dossier completeness", get: (d) => `${d.metrics.completeness}%` },
      { key: "$review", label: "Pending review", get: (d) => d.metrics.pendingReview },
      { key: "$history", label: "Tracked changes", get: (d) => d.metrics.historyEvents },
      { key: "$knowledge", label: "Knowledge / beliefs", get: (d) => d.metrics.knowledgeClaims },
    ];
    const fieldKeys = uniq(dossiers.flatMap((dossier) => dossier.fields.all.map((row) => row.key)))
      .filter((key) => !["name", "summary", "status"].includes(key))
      .slice(0, 42);
    const dynamic = fieldKeys.map((key) => ({
      key,
      label: titleCase(key),
      get: (dossier) => dossier.fields.all.find((row) => row.key === key)?.value,
    }));
    const rows = [...standard, ...dynamic].map((definition) => {
      const values = dossiers.map((dossier) => {
        const raw = definition.get(dossier);
        return { entityId: dossier.id, raw: clone(raw), display: displayValue(raw), empty: raw == null || raw === "" || (Array.isArray(raw) && !raw.length) };
      });
      const signatures = uniq(values.map((value) => stable(value.raw)));
      return { key: definition.key, label: definition.label, values, same: signatures.length <= 1, populated: values.filter((value) => !value.empty).length };
    }).filter((row) => row.populated > 0);
    const sharedConnectionIds = dossiers.length
      ? dossiers.map((dossier) => new Set(dossier.connections.map((row) => row.id))).reduce((shared, set) => new Set([...shared].filter((id) => set.has(id))))
      : new Set();
    const chapterSets = dossiers.map((dossier) => new Set(dossier.evidence.map((row) => row.chapterId)));
    const sharedChapterIds = chapterSets.length
      ? chapterSets.reduce((shared, set) => new Set([...shared].filter((id) => set.has(id))))
      : new Set();
    return {
      dossiers,
      rows,
      differenceCount: rows.filter((row) => !row.same).length,
      sameCount: rows.filter((row) => row.same).length,
      sharedConnections: [...sharedConnectionIds].map((id) => storySnapshot().entityById?.get(id)).filter(Boolean).map(entityRef),
      sharedChapterIds: [...sharedChapterIds],
      generatedAt: new Date().toISOString(),
    };
  }

  function readPins() {
    try {
      const rows = JSON.parse(window.localStorage.getItem(PIN_KEY) || "[]");
      return Array.isArray(rows) ? rows.filter((row) => row?.id).slice(0, MAX_PINS) : [];
    } catch (_) { return []; }
  }

  function writePins(rows) {
    const next = (rows || []).filter((row) => row?.id).slice(0, MAX_PINS);
    try { window.localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch (_) {}
    window.dispatchEvent(new CustomEvent("lw:entity-compare-pins-updated", { detail: { pins: next } }));
    return next;
  }

  function pin(entityOrRef) {
    const ref = typeof entityOrRef === "string"
      ? entityRef(backend.EntityService.getSync(entityOrRef))
      : entityRef(backend.EntityService.getSync(entityOrRef?.id, entityOrRef?.type || entityOrRef?.entityType) || entityOrRef);
    if (!ref?.id) return readPins();
    return writePins([ref, ...readPins().filter((row) => row.id !== ref.id)]);
  }

  function unpin(id) {
    return writePins(readPins().filter((row) => row.id !== id));
  }

  function togglePin(entityOrRef) {
    const id = typeof entityOrRef === "string" ? entityOrRef : entityOrRef?.id;
    return readPins().some((row) => row.id === id) ? unpin(id) : pin(entityOrRef);
  }

  function clearPins() {
    return writePins([]);
  }

  const EntityDossierService = {
    build,
    compare,
    readPins,
    pin,
    unpin,
    togglePin,
    clearPins,
    manuscriptContext,
    storySnapshot,
    fieldEntries,
    displayValue,
    titleCase,
  };

  backend.EntityDossierService = EntityDossierService;
  window.EntityDossierService = EntityDossierService;
  window.dispatchEvent(new CustomEvent("lw:entity-dossier-ready", { detail: { service: EntityDossierService } }));
})();
