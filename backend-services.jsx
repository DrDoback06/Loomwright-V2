// =====================================================================
// backend-services.jsx — Local-first persistence and backend-shaped APIs.
//
// This file is loaded as a plain Babel script by Loomwright Shell.html.
// It intentionally exports globals instead of ES modules so it matches the
// rest of the static React shell. IndexedDB is used when available, with a
// localStorage mirror for synchronous first paint and browser fallback.
// =====================================================================

(function () {
  const DB_NAME = "loomwright-v2";
  const DB_VERSION = 2;
  const STORE = "kv";
  const KEYRING_STORE = "keyring";
  const PREFIX = "lw:v2:";

  const KEYS = {
    entities: "entities",
    references: "references",
    onboarding: "onboarding_answers",
    onboardingStatus: "onboarding_status",
    projectIntelligence: "project_intelligence",
    settings: "settings",
    providerSettings: "ai_provider_settings",
    apiKeys: "api_keys_encrypted",
    reviewQueue: "review_queue",
    manuscript: "manuscript",
    composition: "composition_overlay",
    handoffLog: "ai_handoff_log",
    trash: "trash",
    manuscriptChapters: "manuscript_chapters",
    speedReader: "speed_reader",
    extractionSession: "extraction_session",
    sampleLoaded: "sample_project_loaded",
    occurrences: "entity_occurrences",
    tangle: "tangle_canvas",
    skillTrees: "skill_trees",
    searchIndex: "search_index",
    auditLog: "audit_log",
    aiRouting: "ai_routing",
    manuscriptNotes: "manuscript_notes",
  };

  // Synchronously read the sample-loaded flag from localStorage BEFORE any
  // panel renders. Upgrade modules (loaded earlier) have already seeded
  // window.ENTITY_SAMPLES; if the user has not opted into the sample project,
  // wipe those seeds now so fresh projects render empty states instead of
  // silently presenting demo data as live content. The captured seeds are
  // moved to __LW_SAMPLE_SOURCES__ so SampleProjectService.loadSample can
  // still restore them on explicit user action.
  window.__LW_SAMPLE_SOURCES__ = {
    ENTITY_SAMPLES: { ...(window.ENTITY_SAMPLES || {}) },
    CAST_SAMPLE: Array.isArray(window.CAST_SAMPLE) ? window.CAST_SAMPLE.slice() : [],
  };
  try {
    const raw = window.localStorage && window.localStorage.getItem(PREFIX + KEYS.sampleLoaded);
    window.__LW_SAMPLE_LOADED__ = raw === "true" || raw === "1";
  } catch (_) {
    window.__LW_SAMPLE_LOADED__ = false;
  }
  if (!window.__LW_SAMPLE_LOADED__) {
    window.ENTITY_SAMPLES = {};
    window.CAST_SAMPLE = [];
  }

  const nowIso = () => new Date().toISOString();
  const uuid = (prefix = "lw") => (
    prefix + "-" + (crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2))
  );
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const storageKey = (key) => PREFIX + key;

  const localMirror = {
    get(key, fallback = null) {
      try {
        const raw = window.localStorage.getItem(storageKey(key));
        return raw == null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try { window.localStorage.setItem(storageKey(key), JSON.stringify(value)); } catch (_) {}
    },
    remove(key) {
      try { window.localStorage.removeItem(storageKey(key)); } catch (_) {}
    },
  };

  let dbPromise = null;
  function openDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(KEYRING_STORE)) db.createObjectStore(KEYRING_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }

  function txStore(db, mode = "readonly") {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function keyringStore(db, mode = "readonly") {
    return db.transaction(KEYRING_STORE, mode).objectStore(KEYRING_STORE);
  }

  async function getKeyringItem(key) {
    const db = await openDb();
    if (!db || !db.objectStoreNames.contains(KEYRING_STORE)) return null;
    return new Promise((resolve) => {
      const req = keyringStore(db).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function setKeyringItem(key, value) {
    const db = await openDb();
    if (!db || !db.objectStoreNames.contains(KEYRING_STORE)) return false;
    return new Promise((resolve) => {
      const req = keyringStore(db, "readwrite").put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  const StorageService = {
    keys: KEYS,

    async ready() {
      await openDb();
      return true;
    },

    getSync(key, fallback = null) {
      return localMirror.get(key, fallback);
    },

    async get(key, fallback = null) {
      const db = await openDb();
      if (!db) return localMirror.get(key, fallback);
      return new Promise((resolve) => {
        const req = txStore(db).get(key);
        req.onsuccess = () => {
          const value = req.result;
          if (typeof value !== "undefined") {
            localMirror.set(key, value);
            resolve(value);
          } else {
            resolve(localMirror.get(key, fallback));
          }
        };
        req.onerror = () => resolve(localMirror.get(key, fallback));
      });
    },

    async set(key, value) {
      localMirror.set(key, value);
      const db = await openDb();
      if (!db) return value;
      return new Promise((resolve) => {
        const req = txStore(db, "readwrite").put(value, key);
        req.onsuccess = () => resolve(value);
        req.onerror = () => resolve(value);
      });
    },

    async remove(key) {
      localMirror.remove(key);
      const db = await openDb();
      if (!db) return true;
      return new Promise((resolve) => {
        const req = txStore(db, "readwrite").delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    },

    async getAll() {
      const data = {};
      for (const key of Object.values(KEYS)) data[key] = await this.get(key, null);
      return data;
    },

    async setAll(data = {}) {
      for (const [key, value] of Object.entries(data)) {
        if (Object.values(KEYS).includes(key)) await this.set(key, value);
      }
      return this.getAll();
    },

    async clear() {
      for (const key of Object.values(KEYS)) await this.remove(key);
    },
  };

  function normaliseType(type) {
    const t = String(type || "generic").trim().toLowerCase();
    const aliases = {
      character: "cast", characters: "cast", actor: "cast",
      location: "locations", atlas: "locations",
      item: "items", class: "classes", race: "races", species: "races",
      stat: "stats", skill: "skills", skilltree: "skills", skilltrees: "skills",
      ability: "abilities", quest: "quests", event: "events",
      faction: "factions", canon: "lore", reference: "references",
      relationship: "relationships",
    };
    return aliases[t] || t;
  }

  function initialsFor(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";
  }

  function collectDefaultEntities() {
    const out = {};
    const add = (type, rows) => {
      const nt = normaliseType(type);
      out[nt] = out[nt] || {};
      (rows || []).forEach((row) => {
        if (!row) return;
        const id = row.id || uuid(nt);
        out[nt][id] = {
          ...clone(row),
          id,
          type: nt,
          source: row.source || "sample",
          status: row.status || "active",
          createdAt: row.createdAt || nowIso(),
          updatedAt: row.updatedAt || nowIso(),
        };
      });
    };
    // Prefer the boot-captured snapshot so live globals (which
    // applyEntityGlobals overwrites with user-created records) don't
    // get mistaken for sample seeds. Fall back to live globals only
    // when no snapshot exists (legacy shells that don't bootstrap
    // __LW_SAMPLE_SOURCES__).
    const seedCast = (window.__LW_SAMPLE_SOURCES__?.CAST_SAMPLE && window.__LW_SAMPLE_SOURCES__.CAST_SAMPLE.length)
      ? window.__LW_SAMPLE_SOURCES__.CAST_SAMPLE
      : (window.CAST_SAMPLE || []);
    const seedSamples = (window.__LW_SAMPLE_SOURCES__?.ENTITY_SAMPLES && Object.keys(window.__LW_SAMPLE_SOURCES__.ENTITY_SAMPLES).length)
      ? window.__LW_SAMPLE_SOURCES__.ENTITY_SAMPLES
      : (window.ENTITY_SAMPLES || {});
    if (seedCast.length) add("cast", seedCast);
    Object.entries(seedSamples).forEach(([type, rows]) => add(type, rows));
    return out;
  }

  function flattenEntities(entityMap = {}) {
    return Object.values(entityMap).flatMap((byId) => Object.values(byId || {}));
  }

  function rowForEntity(entity) {
    return {
      id: entity.id,
      label: entity.name || entity.title || "Untitled",
      meta: entity.chapterRange || entity.subtitle || entity.status || "",
      queue: entity.reviewQueueCount || entity.queue || 0,
      entityType: entity.type,
    };
  }

  function applyEntityGlobals(entityMap = EntityService.listAllSync()) {
    const byType = entityMap && !Array.isArray(entityMap)
      ? entityMap
      : flattenEntities(entityMap).reduce((acc, e) => {
          const t = normaliseType(e.type);
          acc[t] = acc[t] || {};
          acc[t][e.id] = e;
          return acc;
        }, {});

    window.ENTITY_SAMPLES = window.ENTITY_SAMPLES || {};
    Object.entries(byType).forEach(([type, rowsById]) => {
      const rows = Object.values(rowsById || {});
      if (type === "cast") window.CAST_SAMPLE = rows;
      else window.ENTITY_SAMPLES[type] = rows;
    });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated", { detail: { entities: byType } }));
    return byType;
  }

  const EntityService = {
    normaliseType,

    listAllSync() {
      return StorageService.getSync(KEYS.entities, {});
    },

    listSync(type) {
      const all = this.listAllSync();
      return Object.values(all[normaliseType(type)] || {});
    },

    getSync(id, type) {
      const all = this.listAllSync();
      if (type) return (all[normaliseType(type)] || {})[id] || null;
      for (const byId of Object.values(all)) if (byId[id]) return byId[id];
      return null;
    },

    async hydrateFromStorage() {
      const stored = await StorageService.get(KEYS.entities, null);
      const map = stored && typeof stored === "object" ? stored : {};
      applyEntityGlobals(map);
      return map;
    },

    async list(type) {
      const all = await StorageService.get(KEYS.entities, {});
      return Object.values(all[normaliseType(type)] || {});
    },

    async save(type, fields = {}, opts = {}) {
      const entityType = normaliseType(type || fields.type || fields.entityType);
      const all = await StorageService.get(KEYS.entities, {});
      const byType = all[entityType] || {};
      const id = fields.id || uuid(entityType);
      const previous = byType[id] || null;
      const status = opts.status || fields.status || previous?.status || "active";
      const entity = {
        ...(previous || {}),
        ...clone(fields),
        id,
        type: entityType,
        name: fields.name || fields.title || previous?.name || "Untitled",
        glyphChar: fields.glyphChar || previous?.glyphChar || initialsFor(fields.name || fields.title || previous?.name),
        status,
        sourceMentions: fields.sourceMentions || previous?.sourceMentions || [],
        reviewQueueCount: opts.reviewQueueCount ?? fields.reviewQueueCount ?? previous?.reviewQueueCount ?? 0,
        createdAt: previous?.createdAt || fields.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      all[entityType] = { ...byType, [id]: entity };
      await StorageService.set(KEYS.entities, all);
      applyEntityGlobals(all);
      if (status === "draft") await ReviewService.add({
        id: uuid("rq"),
        entityId: id,
        entityType,
        name: entity.name,
        action: "Draft saved",
        level: "draft",
        value: 0,
        reason: "Saved as draft from Entity Editor",
        status: "pending",
        createdAt: nowIso(),
      });
      // Audit log (create vs update). Restoring a soft-deleted entity
      // (previous.status === "deleted" && new status === "active") is
      // logged as entity.restore.
      if (!opts.skipAudit) {
        try {
          const isRestore = previous && previous.status === "deleted" && status === "active";
          const isCreate = !previous;
          const action = isRestore ? "entity.restore" : (isCreate ? "entity.create" : "entity.update");
          AuditService.log({
            action,
            label: (isCreate ? "Created " : isRestore ? "Restored " : "Updated ") + (entity.name || entity.id) + " (" + entityType + ")",
            targetType: "entity",
            targetId: id,
            targetName: entity.name,
            entityType,
            before: previous,
            after: entity,
            source: "EntityService",
            sourceSurface: opts.sourceSurface || null,
          });
        } catch (_) {}
      }
      return entity;
    },

    async update(type, id, patch = {}, opts = {}) {
      const existing = this.getSync(id, type);
      return this.save(type, { ...(existing || {}), ...patch, id }, opts);
    },

    async delete(type, id, opts = {}) {
      const entity = this.getSync(id, type);
      if (!entity) return null;
      // Hard delete (sample wipe) — skip trash + skip audit.
      if (opts.hard) {
        const all = await StorageService.get(KEYS.entities, {});
        if (all[type || entity.type]) {
          delete all[type || entity.type][id];
          await StorageService.set(KEYS.entities, all);
          applyEntityGlobals(all);
        }
        return entity;
      }
      const deleted = await this.save(type || entity.type, { ...entity, status: "deleted", deletedAt: nowIso() }, { skipAudit: true });
      await TrashService.add({ ...deleted, deletedAt: nowIso() });
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "entity.delete",
            label: "Deleted " + (entity.name || id) + " (" + (entity.type || type) + ")",
            targetType: "entity",
            targetId: id,
            targetName: entity.name,
            entityType: entity.type || type,
            before: entity,
            after: null,
            source: "EntityService",
            sourceSurface: opts.sourceSurface || null,
          });
        } catch (_) {}
      }
      return deleted;
    },

    decoratePanel(panel) {
      if (!panel || !panel.entityType) return panel;
      const entityType = normaliseType(panel.entityType);
      const entities = this.listSync(entityType);
      const reviewItems = ReviewService.listSync(entityType);
      const queueCount = reviewItems.length + entities.reduce((sum, e) => sum + (e.reviewQueueCount || e.queue || 0), 0);
      // Always render the LIVE store — including the empty case. Never fall
      // back to a panel's baked-in demo rows/subtitle, or a fresh project
      // would show design mock data (Aelinor Vey, "12 entries · 3 in review").
      const noun = entityType === "cast" ? "entries" : "records";
      const subtitle = entities.length
        ? `${entities.length} ${noun}${queueCount ? ` · ${queueCount} in review` : ""}`
        : "Empty — nothing here yet";
      const next = {
        ...panel,
        rows: entities.map(rowForEntity),
        queueCount,
        subtitle,
      };
      if (entityType === "cast") next.cast = entities;
      else next.entities = entities;
      next.reviewItems = reviewItems;
      return next;
    },
  };

  const ReviewService = {
    listSync(type) {
      const all = StorageService.getSync(KEYS.reviewQueue, []);
      const t = type ? normaliseType(type) : null;
      return t ? all.filter((item) => normaliseType(item.entityType || item.type) === t && item.status !== "done") : all;
    },
    async add(item) {
      const all = await StorageService.get(KEYS.reviewQueue, []);
      const next = [{ status: "pending", createdAt: nowIso(), ...item }, ...all];
      await StorageService.set(KEYS.reviewQueue, next);
      return item;
    },
    async addMany(items = []) {
      for (const item of items) await this.add(item);
      return this.listSync();
    },
    // Drop still-pending candidates for a chapter so a re-extraction refreshes
    // them instead of duplicating. Triaged items (accepted/denied/auto-added)
    // are preserved.
    async removePendingByChapter(chapterId) {
      if (!chapterId) return;
      const all = await StorageService.get(KEYS.reviewQueue, []);
      await StorageService.set(KEYS.reviewQueue, all.filter((q) => !(q.chapterId === chapterId && q.status === "pending")));
    },
    async resolve(id, status = "done", opts = {}) {
      const all = await StorageService.get(KEYS.reviewQueue, []);
      const before = all.find((item) => item.id === id) || null;
      const next = all.map((item) => item.id === id ? { ...item, status, updatedAt: nowIso() } : item);
      await StorageService.set(KEYS.reviewQueue, next);
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      if (!opts.skipAudit && before) {
        try {
          const action = status === "accepted" ? "review.accept"
                       : status === "denied"   ? "review.deny"
                       : status === "merged"   ? "review.merge"
                       : "review.accept";
          AuditService.log({
            action,
            label: (status === "denied" ? "Denied review: " : status === "merged" ? "Merged review: " : "Accepted review: ") + (before.name || id),
            targetType: "review",
            targetId: id,
            targetName: before.name,
            entityType: before.entityType || null,
            before,
            after: next.find((item) => item.id === id) || null,
            source: "ReviewService",
            metadata: { createdEntityId: opts.createdEntityId || null, createdEntityType: opts.createdEntityType || null },
          });
        } catch (_) {}
      }
      return next;
    },
    async resolveMany(ids, status = "done", opts = {}) {
      // Bulk resolve for the review queue's batch approve/deny actions
      // (ported from legacy NarrativeReviewQueue's approveAllForChapter).
      const idSet = new Set(ids || []);
      if (!idSet.size) return this.listSync();
      const all = await StorageService.get(KEYS.reviewQueue, []);
      const beforeItems = all.filter((item) => idSet.has(item.id));
      const next = all.map((item) => idSet.has(item.id) ? { ...item, status, updatedAt: nowIso() } : item);
      await StorageService.set(KEYS.reviewQueue, next);
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
      if (!opts.skipAudit && beforeItems.length) {
        try {
          const action = status === "denied" ? "review.bulk-deny"
                       : status === "merged" ? "review.bulk-merge"
                       : "review.bulk-accept";
          AuditService.log({
            action,
            label: `Bulk ${status} ${beforeItems.length} review item(s)`,
            targetType: "review",
            targetId: null,
            source: "ReviewService",
            relatedIds: beforeItems.map((b) => b.id),
            metadata: { count: beforeItems.length, status },
            reversible: false,
          });
        } catch (_) {}
      }
      return next;
    },
  };

  const ReferencesService = {
    listSync(kind) {
      const refs = StorageService.getSync(KEYS.references, window.REFERENCES || []);
      return kind ? refs.filter((r) => r.kind === kind || r.type === kind) : refs;
    },
    async hydrateFromStorage() {
      const stored = await StorageService.get(KEYS.references, null);
      const refs = Array.isArray(stored) ? stored : [];
      window.REFERENCES = refs;
      return refs;
    },
    async save(ref = {}, opts = {}) {
      const refs = await StorageService.get(KEYS.references, []);
      const id = ref.id || uuid("ref");
      const previous = refs.find((r) => r.id === id) || null;
      const nextRef = {
        aiContext: true,
        linkedEntities: [],
        ...clone(ref),
        id,
        kind: ref.kind || ref.type || "note",
        title: ref.title || ref.name || "Untitled reference",
        createdAt: ref.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      const idx = refs.findIndex((r) => r.id === id);
      const next = idx >= 0 ? refs.map((r, i) => i === idx ? nextRef : r) : [nextRef, ...refs];
      await StorageService.set(KEYS.references, next);
      window.REFERENCES = next;
      window.dispatchEvent(new CustomEvent("lw:references-updated", { detail: { references: next } }));
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: previous ? "reference.update" : "reference.create",
            label: (previous ? "Updated reference: " : "Created reference: ") + (nextRef.title || id),
            targetType: "reference",
            targetId: id,
            targetName: nextRef.title,
            before: previous,
            after: nextRef,
            source: "ReferencesService",
          });
        } catch (_) {}
      }
      return nextRef;
    },
    async delete(id, opts = {}) {
      const refs = await StorageService.get(KEYS.references, []);
      const before = refs.find((r) => r.id === id) || null;
      if (!before) return null;
      const next = refs.filter((r) => r.id !== id);
      await StorageService.set(KEYS.references, next);
      window.REFERENCES = next;
      window.dispatchEvent(new CustomEvent("lw:references-updated", { detail: { references: next } }));
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "reference.delete",
            label: "Deleted reference: " + (before.title || id),
            targetType: "reference",
            targetId: id,
            targetName: before.title,
            before,
            after: null,
            source: "ReferencesService",
          });
        } catch (_) {}
      }
      return before;
    },
  };

  // Split pasted/uploaded manuscript text into chapters on common headers
  // ("Chapter N", markdown "#", form-feed, scene breaks). Falls back to a
  // single chapter when no markers are found.
  function splitChaptersText(text) {
    if (!text || !text.trim()) return [];
    const t = text.replace(/\r\n/g, "\n");
    const re = /^[ \t]*(?:chapter\s+[\dIVXLCM]+\b[^\n]*|#{1,6}\s+[^\n]+|\f|\*\s*\*\s*\*)\s*$/gim;
    const markers = [];
    let m;
    while ((m = re.exec(t)) !== null) { markers.push({ index: m.index, header: m[0].trim() }); if (m.index === re.lastIndex) re.lastIndex++; }
    if (!markers.length) return [{ title: "Chapter 1", text: t.trim() }];
    const out = [];
    const pre = t.slice(0, markers[0].index).trim();
    if (pre) out.push({ title: "Chapter 1", text: pre });
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : t.length;
      const nl = t.indexOf("\n", start);
      const title = markers[i].header.replace(/^#{1,6}\s*/, "").trim() || ("Chapter " + (out.length + 1));
      const body = t.slice(nl >= 0 ? nl + 1 : start, end).trim();
      out.push({ title: title.slice(0, 120), text: body });
    }
    return out.length ? out : [{ title: "Chapter 1", text: t.trim() }];
  }

  const OnboardingService = {
    loadSync(fallback = {}) {
      return StorageService.getSync(KEYS.onboarding, fallback);
    },
    async load(fallback = {}) {
      return StorageService.get(KEYS.onboarding, fallback);
    },
    async save(answers = {}, opts = {}) {
      const previous = StorageService.getSync(KEYS.onboarding, null);
      const next = { ...clone(answers), updatedAt: nowIso() };
      await StorageService.set(KEYS.onboarding, next);
      window.ONBOARDING_ANSWERS = next;
      window.dispatchEvent(new CustomEvent("lw:onboarding-updated", { detail: { answers: next } }));
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "onboarding.update",
            label: "Updated onboarding answers",
            targetType: "onboarding",
            targetId: "default",
            before: previous,
            after: next,
            source: "OnboardingService",
          });
        } catch (_) {}
      }
      return next;
    },
    statusSync() {
      return StorageService.getSync(KEYS.onboardingStatus, "pending");
    },
    async setStatus(status) {
      await StorageService.set(KEYS.onboardingStatus, status);
      window.dispatchEvent(new CustomEvent("lw:onboarding-status", { detail: { status } }));
      return status;
    },
    // "Open the door": persist the answers and seed the project from them —
    // project intelligence, cast, chapters, references, AI + extraction
    // settings — then optionally run a first extraction. Returns a summary.
    async applyCompletion(answers = {}, opts = {}) {
      const data = answers || {};
      await this.save(data, { skipAudit: opts.skipAudit });
      try { await ProjectIntelService.mergeFromOnboarding(data); } catch (_) {}
      const seeded = { cast: 0, chapters: 0, references: 0 };

      // Cast seeds → cast entities (skip names that already exist so a
      // re-run doesn't duplicate).
      const existingCastNames = new Set(EntityService.listSync("cast").map((e) => (e.name || "").toLowerCase()));
      for (const s of (data.cast && data.cast.seeds) || []) {
        if (!s || !s.name || existingCastNames.has(s.name.toLowerCase())) continue;
        const aliases = typeof s.aliases === "string"
          ? s.aliases.split(",").map((x) => x.trim()).filter(Boolean)
          : (Array.isArray(s.aliases) ? s.aliases : []);
        try {
          await EntityService.save("cast", {
            name: s.name, aliases, summary: s.personality || "",
            data: { role: s.role || "", race: s.race || "", class: s.klass || "", faction: s.faction || "", voice: s.voice || "", goals: s.goals || "", fears: s.fears || "", secrets: s.secrets || "", relationships: s.relationships || "", source: "onboarding" },
          }, { status: "active" });
          existingCastNames.add(s.name.toLowerCase());
          seeded.cast++;
        } catch (_) {}
      }

      // Manuscript → chapters. NEVER overwrite existing written chapters — a
      // re-run of onboarding must not destroy the user's manuscript.
      const m = data.manuscript || {};
      const existingMcs = (ManuscriptChapterService.loadSync && ManuscriptChapterService.loadSync()) || { chapters: [] };
      const hasExistingContent = (existingMcs.chapters || []).some((c) => c.bodyText && c.bodyText.trim());
      const chapters = [];
      const addChapter = (title, body) => chapters.push({ id: uuid("ch"), num: chapters.length + 1, title: title || ("Chapter " + (chapters.length + 1)), state: "saved", bodyText: body || "", words: (body || "").trim().split(/\s+/).filter(Boolean).length });
      const src = m.mode === "paste" ? (m.pasted || "") : (m.mode === "upload" ? ((m.uploaded && m.uploaded.content) || "") : "");
      if (src && src.trim()) {
        const parts = (m.autoDetect !== false) ? splitChaptersText(src) : [{ title: "Chapter 1", text: src.trim() }];
        parts.forEach((p) => addChapter(p.title, p.text));
      }
      if (!chapters.length) addChapter("Chapter 1", "");
      const target = (data.plot && data.plot.targetChapters) || 0;
      if (m.reserve && target > chapters.length) {
        for (let n = chapters.length + 1; n <= target; n++) chapters.push({ id: uuid("ch"), num: n, title: "", state: "reserved", bodyText: "", words: 0 });
      }
      if (!hasExistingContent) {
        const manuscripts = {};
        chapters.forEach((c) => { manuscripts[c.id] = { text: c.bodyText, html: "" }; });
        try { await ManuscriptChapterService.save({ chapters, activeChapterId: chapters[0] && chapters[0].id, manuscripts, trashedChapters: existingMcs.trashedChapters || [] }); } catch (_) {}
        seeded.chapters = chapters.filter((c) => c.state !== "reserved").length;
      }
      const seededChapters = hasExistingContent ? [] : chapters;

      // References (pasted/uploaded) → ReferencesService store, deduped.
      const existingRefs = await StorageService.get(KEYS.references, []);
      const refKey = (r) => (r.title || "").toLowerCase() + "|" + (r.content || "").slice(0, 60);
      const existingRefKeys = new Set((existingRefs || []).map(refKey));
      const newRefs = (((data.references && data.references.items) || []).filter(Boolean)).map((it) => ({
        id: it.id || uuid("ref"), title: it.title || "Reference", content: it.content || "", kind: it.kind || "pasted",
        includedInAIContext: it.context !== false, tags: it.tags || [], createdAt: nowIso(),
      })).filter((r) => !existingRefKeys.has(refKey(r)));
      if (newRefs.length) {
        try { await StorageService.set(KEYS.references, [...(existingRefs || []), ...newRefs]); window.dispatchEvent(new CustomEvent("lw:references-updated")); seeded.references = newRefs.length; } catch (_) {}
      }

      // AI provider + tier. "local" → Free tier (local providers like Ollama
      // only — free, private, no cloud), NOT a hard AI block, so the free
      // writing tools still work. byok/cloud → save key + normal tier.
      const ai = data.ai || {};
      try {
        if (ai.key && (ai.mode === "byok" || ai.mode === "cloud")) {
          await AIService.saveProviderConfig({ id: ai.provider || "anthropic", providerType: ai.provider || "anthropic", apiKey: ai.key });
        }
        await AIRoutingService.save({ mode: "balanced", tier: ai.mode === "local" ? "free" : "normal" });
      } catch (_) {}

      // Extraction preferences from the Review step.
      if (data.review) {
        try {
          const aggr = ["gentle", "balanced", "aggressive"][Math.max(0, Math.min(2, data.review.aggressiveness != null ? data.review.aggressiveness : 1))] || "balanced";
          await SettingsService.saveSection("extraction", { aggressiveness: aggr, autoAdd95: data.review.autoAddHigh !== false, showAutoAddedInReview: data.review.showAutoInQueue !== false, threshold: 50, scan: data.review.scan || {} });
        } catch (_) {}
      }

      // Custom stats the author defined → real Stats entities (deduped).
      const existingStatNames = new Set(EntityService.listSync("stats").map((e) => (e.name || "").toLowerCase()));
      for (const cs of (data.rpg && data.rpg.customStats) || []) {
        if (!cs || !cs.name || existingStatNames.has(cs.name.toLowerCase())) continue;
        try {
          await EntityService.save("stats", { name: cs.name, data: { min: cs.min, max: cs.max, default: cs.def, source: "onboarding" } }, { status: "active" });
          existingStatNames.add(cs.name.toLowerCase());
          seeded.stats = (seeded.stats || 0) + 1;
        } catch (_) {}
      }

      // Persist workspace preferences + the RPG system config so they survive
      // (startTab drives routing below; the rest is read by their own areas).
      try { if (data.workspace) await SettingsService.saveSection("workspace", { ...data.workspace }); } catch (_) {}
      try { if (data.rpg) await SettingsService.saveSection("rpg", { template: data.rpg.template, toggles: data.rpg.toggles || {}, suggestExamples: data.rpg.suggestExamples !== false }); } catch (_) {}

      await this.setStatus("complete");

      if (m.runExtraction) {
        for (const c of seededChapters.filter((ch) => ch.bodyText && ch.bodyText.trim())) {
          try { await ExtractionService.runExtraction({ chapterId: c.id, text: c.bodyText, deep: false }); } catch (_) {}
        }
      }
      const dest = data.__dest || (data.workspace && data.workspace.startTab) || "writers-room";
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      window.dispatchEvent(new CustomEvent("lw:onboarding-complete", { detail: { dest, seeded } }));
      return { dest, seeded };
    },
  };

  // Derive structured project intelligence from the onboarding answers,
  // reading the REAL schema (welcome/foundation/style/world). The previous
  // mapping read non-existent fields (onboarding.project.goals,
  // onboarding.style.tone) so only canon rules ever populated.
  function deriveIntelFromOnboarding(ob) {
    ob = ob || {};
    const w = ob.welcome || {}, f = ob.foundation || {}, st = ob.style || {}, world = ob.world || {}, voice = ob.voice || {}, plot = ob.plot || {};
    const join = (a) => (Array.isArray(a) ? a.filter(Boolean).join(", ") : (a || ""));
    const foundationParts = [];
    if (w.title) foundationParts.push("Title: " + w.title);
    if (w.genre || w.subgenre) foundationParts.push("Genre: " + [w.genre, w.subgenre].filter(Boolean).join(" / "));
    if (w.audience) foundationParts.push("Audience: " + w.audience);
    if (f.premise) foundationParts.push("Premise: " + f.premise);
    if (f.logline) foundationParts.push("Logline: " + f.logline);
    if (f.coreConflict) foundationParts.push("Core conflict: " + f.coreConflict);
    if (f.themes && f.themes.length) foundationParts.push("Themes: " + join(f.themes));
    if (f.readerExperience) foundationParts.push("Reader experience: " + f.readerExperience);
    if (f.comparables) foundationParts.push("Comparables: " + f.comparables);
    if (f.isNot) foundationParts.push("What it is NOT: " + f.isNot);
    // Planned arc — so the AI knows where the story is heading.
    const beats = Array.isArray(plot.beats) ? plot.beats.filter((b) => b && (b.title || b.summary)) : [];
    if (beats.length) foundationParts.push("Planned beats:\n" + beats.slice(0, 20).map((b, i) => `  ${i + 1}. ${b.title || ""}${b.summary ? " — " + b.summary : ""}`).join("\n"));
    const styleParts = [];
    if (st.narratorTone) styleParts.push("Narrator tone: " + st.narratorTone);
    if (f.toneWords && f.toneWords.length) styleParts.push("Tone words: " + join(f.toneWords));
    if (f.pov || f.tense) styleParts.push("POV / tense: " + [f.pov, f.tense].filter(Boolean).join(", "));
    if (st.signature) styleParts.push("Signature: " + st.signature);
    if (st.avoid) styleParts.push("Avoid: " + st.avoid);
    const vp = voice.profile;
    if (vp && vp.avgSentenceLen) styleParts.push(`Voice metrics: ${vp.register} register, ${vp.pacing} pacing, avg ${vp.avgSentenceLen}-word sentences, ${vp.lexicalDiversity}% lexical diversity, ${vp.dialogueRatio}% dialogue`);
    const canonRules = (Array.isArray(world.canonRules) ? world.canonRules : (world.canonRules ? [world.canonRules] : [])).filter(Boolean);
    return {
      projectFoundation: foundationParts.join("\n"),
      writingStyleGuide: styleParts.join("\n"),
      toneKeywords: [].concat(f.toneWords || [], st.narratorTone ? [st.narratorTone] : []).filter(Boolean).slice(0, 12),
      canonRules,
      genre: [w.genre, w.subgenre].filter(Boolean).join(" / "),
      pov: f.pov || "",
      tense: f.tense || "",
      forbidden: Array.isArray(world.forbidden) ? world.forbidden.filter(Boolean) : [],
      terminology: Array.isArray(world.terminology) ? world.terminology.filter(Boolean) : [],
    };
  }

  const ProjectIntelService = {
    defaultIntel() {
      const onboarding = OnboardingService.loadSync({});
      return {
        ...deriveIntelFromOnboarding(onboarding),
        characterSummaries: EntityService.listSync("cast").map((e) => ({ entityId: e.id, summary: e.summary || "" })),
        extractionRules: [],
        privacySettings: StorageService.getSync(KEYS.settings, {}).privacy || {},
        lastUpdated: nowIso(),
      };
    },
    loadSync() {
      return StorageService.getSync(KEYS.projectIntelligence, this.defaultIntel());
    },
    async save(intel = {}, opts = {}) {
      const previous = StorageService.getSync(KEYS.projectIntelligence, null);
      const next = { ...this.defaultIntel(), ...clone(intel), lastUpdated: nowIso() };
      await StorageService.set(KEYS.projectIntelligence, next);
      window.PROJECT_INTELLIGENCE = next;
      window.dispatchEvent(new CustomEvent("lw:project-intel-updated", { detail: { intel: next } }));
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "intel.update",
            label: "Updated project intelligence",
            targetType: "intel",
            targetId: "default",
            before: previous,
            after: next,
            source: "ProjectIntelService",
          });
        } catch (_) {}
      }
      return next;
    },
    async mergeFromOnboarding(answers) {
      const current = this.loadSync();
      const derived = deriveIntelFromOnboarding(answers);
      // Keep any existing non-empty values if the answers don't supply them.
      const merged = { ...current };
      for (const [k, v] of Object.entries(derived)) {
        const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
        if (!empty) merged[k] = v;
      }
      return this.save(merged);
    },
  };

  const SettingsService = {
    getAllSync() {
      return StorageService.getSync(KEYS.settings, {});
    },
    getSectionSync(section, fallback) {
      const all = this.getAllSync();
      const val = all[section];
      // Array sections (e.g. "authors") must round-trip as arrays — the
      // object-spread below would turn them into numeric-keyed objects.
      if (Array.isArray(val)) return clone(val);
      return val ? { ...clone(fallback || {}), ...val } : clone(fallback);
    },
    async saveSection(section, value, opts = {}) {
      const all = await StorageService.get(KEYS.settings, {});
      const previous = all[section] || null;
      const next = { ...all, [section]: clone(value), updatedAt: nowIso() };
      await StorageService.set(KEYS.settings, next);
      window.dispatchEvent(new CustomEvent("lw:settings-saved", { detail: { section, value } }));
      window.dispatchEvent(new CustomEvent("lw:settings-updated", { detail: { section } }));
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "settings.section-update",
            label: `Updated settings section: ${section}`,
            targetType: "settings",
            targetId: section,
            targetName: section,
            before: previous,
            after: clone(value),
            source: "SettingsService",
            metadata: { sectionId: section },
          });
        } catch (_) {}
      }
      return next;
    },
  };

  const bufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const base64ToBuffer = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
  const API_KEY_ROOT = "api-key-encryption-root";

  async function getCryptoKey() {
    if (!window.crypto?.subtle) throw new Error("Web Crypto is unavailable in this browser.");

    const keyringKey = await getKeyringItem(API_KEY_ROOT);
    if (keyringKey) return keyringKey;

    // Migrate any root key created by earlier localStorage-backed versions
    // into IndexedDB as a non-extractable CryptoKey, then remove the JWK.
    const legacyJwk = localMirror.get("crypto_root_key", null);
    if (legacyJwk) {
      const migrated = await crypto.subtle.importKey("jwk", legacyJwk, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      await setKeyringItem(API_KEY_ROOT, migrated);
      localMirror.remove("crypto_root_key");
      return migrated;
    }

    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const stored = await setKeyringItem(API_KEY_ROOT, key);
    if (!stored) {
      // Last-resort fallback for browsers where IndexedDB is blocked. This
      // keeps BYOK values encrypted at rest, but decryption will last only for
      // the current tab session because the root key is intentionally not
      // exported into localStorage.
      console.warn("[Loomwright] IndexedDB keyring unavailable; API keys are encrypted for this browser session only.");
    }
    return key;
  }

  const KeysService = {
    async encrypt(value) {
      if (!value) return null;
      const key = await getCryptoKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(value);
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
      return { alg: "AES-GCM", iv: bufferToBase64(iv), data: bufferToBase64(cipher), updatedAt: nowIso() };
    },
    async decrypt(record) {
      if (!record?.data || !record?.iv) return "";
      const key = await getCryptoKey();
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBuffer(record.iv) }, key, base64ToBuffer(record.data));
      return new TextDecoder().decode(plain);
    },
    async saveProvider(providerId, settings = {}) {
      const allSettings = await StorageService.get(KEYS.providerSettings, {});
      const allKeys = await StorageService.get(KEYS.apiKeys, {});
      // Strip the key out of the config blob — it only ever lives in
      // KEYS.apiKeys, encrypted. Any field named like a secret is also
      // dropped defensively so it can never land in providerSettings.
      const { apiKey, secret, token, password, bearer, credential, ...safeSettings } = settings || {};
      if (apiKey) allKeys[providerId] = await this.encrypt(apiKey);
      const prev = allSettings[providerId] || {};
      allSettings[providerId] = {
        id: providerId,
        providerType: safeSettings.providerType || prev.providerType || "openai",
        label: safeSettings.label || prev.label || providerId,
        enabled: safeSettings.enabled !== undefined ? !!safeSettings.enabled : (prev.enabled !== false),
        baseUrl: safeSettings.baseUrl || prev.baseUrl || "",
        defaultModel: safeSettings.defaultModel || safeSettings.model || prev.defaultModel || prev.model || "",
        availableModels: Array.isArray(safeSettings.availableModels) ? safeSettings.availableModels : (prev.availableModels || []),
        useCases: { ...(prev.useCases || {}), ...(safeSettings.useCases || {}) },
        headers: { ...(prev.headers || {}), ...(safeSettings.headers || {}) },
        apiKeyRef: providerId,
        ...safeSettings,
        hasKey: !!(apiKey || allKeys[providerId]),
        createdAt: prev.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      await StorageService.set(KEYS.providerSettings, allSettings);
      await StorageService.set(KEYS.apiKeys, allKeys);
      return allSettings[providerId];
    },
    loadProviderSync(providerId) {
      return StorageService.getSync(KEYS.providerSettings, {})[providerId] || null;
    },
    loadAllProviderSettingsSync() {
      return StorageService.getSync(KEYS.providerSettings, {});
    },
    async loadKey(providerId) {
      const allKeys = await StorageService.get(KEYS.apiKeys, {});
      return this.decrypt(allKeys[providerId]);
    },
    async clearProviderKey(providerId) {
      const allKeys = await StorageService.get(KEYS.apiKeys, {});
      const allSettings = await StorageService.get(KEYS.providerSettings, {});
      delete allKeys[providerId];
      if (allSettings[providerId]) allSettings[providerId] = { ...allSettings[providerId], hasKey: false, updatedAt: nowIso() };
      await StorageService.set(KEYS.apiKeys, allKeys);
      await StorageService.set(KEYS.providerSettings, allSettings);
    },
    async testProvider(providerId) {
      return AIService.testConnection(providerId);
    },
  };

  const ManuscriptService = {
    snapshotFromDom() {
      const canvas = document.querySelector("[data-ui='ManuscriptCanvas']");
      if (!canvas) return null;
      return {
        chapterId: canvas.getAttribute("data-chapter-id"),
        title: canvas.querySelector(".wr-canvas__title")?.innerText || "",
        bodyText: canvas.querySelector("[data-ui='ManuscriptBody']")?.innerText || "",
        html: canvas.querySelector("[data-ui='ManuscriptBody']")?.innerHTML || "",
        updatedAt: nowIso(),
      };
    },
    async saveCurrentDom() {
      const snap = this.snapshotFromDom();
      if (!snap?.chapterId) return null;
      const all = await StorageService.get(KEYS.manuscript, {});
      const next = { ...all, [snap.chapterId]: snap };
      await StorageService.set(KEYS.manuscript, next);
      window.dispatchEvent(new CustomEvent("lw:manuscript-saved", { detail: snap }));
      return snap;
    },
    loadChapterSync(chapterId) {
      return StorageService.getSync(KEYS.manuscript, {})[chapterId] || null;
    },
  };

  const CompositionService = {
    loadSync(fallback = {}) {
      return StorageService.getSync(KEYS.composition, fallback);
    },
    async save(state = {}) {
      const next = { ...clone(state), updatedAt: nowIso() };
      await StorageService.set(KEYS.composition, next);
      return next;
    },
  };

  // -------------------------------------------------------------------
  // TangleService — lightweight persistence for the Tangle mind-map.
  // Stores nodes and groups under KEYS.tangle. The canvas itself is
  // React-rendered; this service just keeps the data alive across reload
  // and provides the wiring for "send suggestion to tangle" and the
  // create/edit/delete tangle node callbacks.
  // -------------------------------------------------------------------

  // -------------------------------------------------------------------
  // AtlasService — thin facade over EntityService for location
  // placement, route edges, and entity-on-map links. The atlas
  // workspace edits placement and routes via these methods so the
  // edits persist across reload. Locations are still the canonical
  // entity type; AtlasService never owns them — it just patches their
  // .data fields (placed/coords/atlasMap/routes).
  // -------------------------------------------------------------------
  const AtlasService = {
    listPlacedSync() {
      const locs = EntityService.listSync("locations");
      return locs.filter((l) => l?.data?.placed === true);
    },
    listAllSync() {
      return EntityService.listSync("locations");
    },
    async placeLocation(id, coords, opts = {}) {
      const existing = EntityService.getSync(id, "locations");
      if (!existing) return null;
      const data = {
        ...(existing.data || {}),
        placed: true,
        coords: { x: Number(coords?.x) || 0, y: Number(coords?.y) || 0 },
        ...(opts.atlasMap ? { atlasMap: opts.atlasMap } : {}),
      };
      return EntityService.update("locations", id, { data });
    },
    async unplaceLocation(id) {
      const existing = EntityService.getSync(id, "locations");
      if (!existing) return null;
      return EntityService.update("locations", id, {
        data: { ...(existing.data || {}), placed: false },
      });
    },
    async updatePlacement(id, patch = {}) {
      const existing = EntityService.getSync(id, "locations");
      if (!existing) return null;
      const data = { ...(existing.data || {}) };
      if ("placed" in patch) data.placed = !!patch.placed;
      if (patch.coords) data.coords = { x: Number(patch.coords.x) || 0, y: Number(patch.coords.y) || 0 };
      if (patch.atlasMap) data.atlasMap = patch.atlasMap;
      if (Array.isArray(patch.routes)) data.routes = patch.routes.slice();
      return EntityService.update("locations", id, { data });
    },
    async setRoute(fromId, toId, kind = "road") {
      if (!fromId || !toId || fromId === toId) return null;
      const existing = EntityService.getSync(fromId, "locations");
      if (!existing) return null;
      const routes = Array.isArray(existing.data?.routes) ? existing.data.routes.slice() : [];
      const idx = routes.findIndex((r) => (typeof r === "string" ? r === toId : r?.to === toId));
      const next = { to: toId, kind };
      if (idx >= 0) routes[idx] = next;
      else routes.push(next);
      return EntityService.update("locations", fromId, {
        data: { ...(existing.data || {}), routes },
      });
    },
    async removeRoute(fromId, toId) {
      const existing = EntityService.getSync(fromId, "locations");
      if (!existing) return null;
      const routes = Array.isArray(existing.data?.routes) ? existing.data.routes : [];
      const filtered = routes.filter((r) => (typeof r === "string" ? r !== toId : r?.to !== toId));
      return EntityService.update("locations", fromId, {
        data: { ...(existing.data || {}), routes: filtered },
      });
    },
    async linkEntityToLocation(entityId, entityType, locationId) {
      // Atlas-driven binding: pin an entity (cast / item / event / etc.)
      // to a location. Stored as data.locationId on the entity AND
      // pushed onto location.data[<entityType>] for fast lookup.
      const entity = EntityService.getSync(entityId, entityType);
      if (!entity) return null;
      await EntityService.update(entityType, entityId, {
        data: { ...(entity.data || {}), locationId },
      });
      const loc = EntityService.getSync(locationId, "locations");
      if (loc) {
        const field = entityType === "cast" ? "characters" : entityType;
        const list = Array.isArray(loc.data?.[field]) ? loc.data[field].slice() : [];
        if (!list.includes(entityId)) list.push(entityId);
        await EntityService.update("locations", locationId, {
          data: { ...(loc.data || {}), [field]: list },
        });
      }
      return entity;
    },
  };

  // -------------------------------------------------------------------
  // SkillTreeService — persists tree-level state (which skill entities
  // form a tree, how they're connected, where they sit on the canvas,
  // which classes/cast they're assigned to). Individual skill records
  // still live in EntityService("skills", …). The tree object is small
  // and reference-only; we never duplicate the skill data inside it.
  // -------------------------------------------------------------------
  const SkillTreeService = {
    defaultState() {
      return { trees: [], updatedAt: nowIso() };
    },
    loadSync() {
      return StorageService.getSync(KEYS.skillTrees, this.defaultState());
    },
    async save(state) {
      const next = { ...this.loadSync(), ...clone(state), updatedAt: nowIso() };
      await StorageService.set(KEYS.skillTrees, next);
      window.dispatchEvent(new CustomEvent("lw:skill-trees-updated", { detail: next }));
      return next;
    },
    async addTree(tree) {
      const state = this.loadSync();
      const row = {
        id: tree.id || uuid("st"),
        name: tree.name || "New skill tree",
        description: tree.description || "",
        nodeIds: Array.isArray(tree.nodeIds) ? tree.nodeIds.slice() : [],
        edges: Array.isArray(tree.edges) ? tree.edges.slice() : [],
        layout: tree.layout || {},
        assignedClasses: Array.isArray(tree.assignedClasses) ? tree.assignedClasses.slice() : [],
        assignedCast: Array.isArray(tree.assignedCast) ? tree.assignedCast.slice() : [],
        createdAt: tree.createdAt || nowIso(),
      };
      await this.save({ ...state, trees: [...(state.trees || []), row] });
      return row;
    },
    async updateTree(id, patch) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t),
      });
    },
    async removeTree(id) {
      const state = this.loadSync();
      return this.save({ ...state, trees: (state.trees || []).filter((t) => t.id !== id) });
    },
    async addNode(treeId, skillEntityId, position = { x: 0, y: 0 }) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const nodeIds = t.nodeIds.includes(skillEntityId) ? t.nodeIds : [...t.nodeIds, skillEntityId];
          const layout = { ...(t.layout || {}), [skillEntityId]: { x: Number(position.x) || 0, y: Number(position.y) || 0 } };
          return { ...t, nodeIds, layout, updatedAt: nowIso() };
        }),
      });
    },
    async updateNodePosition(treeId, skillEntityId, position) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const layout = { ...(t.layout || {}), [skillEntityId]: { x: Number(position?.x) || 0, y: Number(position?.y) || 0 } };
          return { ...t, layout, updatedAt: nowIso() };
        }),
      });
    },
    async removeNode(treeId, skillEntityId) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const nodeIds = t.nodeIds.filter((n) => n !== skillEntityId);
          const layout = { ...(t.layout || {}) };
          delete layout[skillEntityId];
          const edges = t.edges.filter((e) => e.from !== skillEntityId && e.to !== skillEntityId);
          return { ...t, nodeIds, layout, edges, updatedAt: nowIso() };
        }),
      });
    },
    async connectNodes(treeId, fromSkillId, toSkillId, kind = "leads-to") {
      if (!fromSkillId || !toSkillId || fromSkillId === toSkillId) return null;
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const edges = (t.edges || []).slice();
          if (!edges.some((e) => e.from === fromSkillId && e.to === toSkillId)) {
            edges.push({ from: fromSkillId, to: toSkillId, kind });
          }
          return { ...t, edges, updatedAt: nowIso() };
        }),
      });
    },
    async disconnectNodes(treeId, fromSkillId, toSkillId) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const edges = (t.edges || []).filter((e) => !(e.from === fromSkillId && e.to === toSkillId));
          return { ...t, edges, updatedAt: nowIso() };
        }),
      });
    },
    async assignClass(treeId, classEntityId) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const set = new Set(t.assignedClasses || []);
          set.add(classEntityId);
          return { ...t, assignedClasses: [...set], updatedAt: nowIso() };
        }),
      });
    },
    async assignCast(treeId, castEntityId) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const set = new Set(t.assignedCast || []);
          set.add(castEntityId);
          return { ...t, assignedCast: [...set], updatedAt: nowIso() };
        }),
      });
    },
    // Persist a node's locked/unlocked state in the tree layout (UAT #17).
    async setNodeUnlocked(treeId, skillEntityId, unlocked) {
      const state = this.loadSync();
      return this.save({
        ...state,
        trees: (state.trees || []).map((t) => {
          if (t.id !== treeId) return t;
          const prev = (t.layout || {})[skillEntityId] || {};
          const layout = { ...(t.layout || {}), [skillEntityId]: { ...prev, unlocked: !!unlocked } };
          return { ...t, layout, updatedAt: nowIso() };
        }),
      });
    },
  };

  const TangleService = {
    defaultState() {
      return { nodes: [], groups: [], edges: [], updatedAt: nowIso() };
    },
    loadSync() {
      return StorageService.getSync(KEYS.tangle, this.defaultState());
    },
    async save(state) {
      const next = { ...this.loadSync(), ...clone(state), updatedAt: nowIso() };
      await StorageService.set(KEYS.tangle, next);
      window.dispatchEvent(new CustomEvent("lw:tangle-updated", { detail: next }));
      return next;
    },
    async addNode(node) {
      const state = this.loadSync();
      const row = { ...clone(node), id: node.id || uuid("tn"), createdAt: node.createdAt || nowIso() };
      return this.save({ ...state, nodes: [...(state.nodes || []), row] });
    },
    async updateNode(id, patch) {
      const state = this.loadSync();
      return this.save({ ...state, nodes: (state.nodes || []).map((n) => n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n) });
    },
    async removeNode(id) {
      const state = this.loadSync();
      return this.save({ ...state, nodes: (state.nodes || []).filter((n) => n.id !== id) });
    },
    async addGroup(group) {
      const state = this.loadSync();
      const row = { ...clone(group), id: group.id || uuid("tg"), createdAt: group.createdAt || nowIso() };
      return this.save({ ...state, groups: [...(state.groups || []), row] });
    },
  };

  // -------------------------------------------------------------------
  // SpeedReaderService — persistent RSVP sessions backed by
  // KEYS.speedReader. Owns session create / update / delete /
  // progress / bookmarks / notes / settings. Resolves chapter and
  // reference sources via ManuscriptChapterService / ReferencesService
  // at session-create time so a session is self-contained from then on.
  // -------------------------------------------------------------------
  const SpeedReaderService = {
    defaultState() {
      return { activeId: null, sessions: [], updatedAt: nowIso() };
    },
    loadSync() {
      const raw = StorageService.getSync(KEYS.speedReader, null);
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.sessions)) {
        return this.defaultState();
      }
      return raw;
    },
    async save(state) {
      const next = { ...this.loadSync(), ...clone(state), updatedAt: nowIso() };
      await StorageService.set(KEYS.speedReader, next);
      window.dispatchEvent(new CustomEvent("lw:speed-reader-updated", { detail: next }));
      return next;
    },
    listSessionsSync() {
      return this.loadSync().sessions || [];
    },
    getSessionSync(id) {
      if (!id) return null;
      return (this.loadSync().sessions || []).find((s) => s.id === id) || null;
    },
    getActiveSessionSync() {
      const state = this.loadSync();
      if (!state.activeId) return null;
      return (state.sessions || []).find((s) => s.id === state.activeId) || null;
    },
    /**
     * Resolve raw text for a `{ sourceType, sourceId }` pair. Returns
     * `{ rawText, sourceTitle }`. Empty string when unresolvable.
     */
    resolveSource(input = {}) {
      const sourceType = input.sourceType || "paste";
      if (sourceType === "paste" || sourceType === "passage") {
        return {
          rawText: input.rawText || input.text || "",
          sourceTitle: input.sourceTitle || input.name || (sourceType === "passage" ? "Selected passage" : "Pasted text"),
        };
      }
      if (sourceType === "chapter") {
        const mcs = ManuscriptChapterService.loadSync();
        const id = input.sourceId || mcs.activeChapterId;
        const chapter = (mcs.chapters || []).find((c) => c.id === id);
        const text = chapter?.bodyText
          || (chapter?.bodyHtml || "").replace(/<[^>]+>/g, "")
          || mcs.manuscripts?.[id]?.text
          || "";
        return {
          rawText: text,
          sourceTitle: chapter?.title || `Chapter ${chapter?.slotNumber || ""}`.trim() || "Current chapter",
        };
      }
      if (sourceType === "reference") {
        const refs = StorageService.getSync(KEYS.references, []);
        const ref = refs.find((r) => r.id === input.sourceId);
        const text = ref?.content || ref?.body || ref?.summary || ref?.notes || "";
        return {
          rawText: text,
          sourceTitle: ref?.title || ref?.label || "Reference",
        };
      }
      return { rawText: input.rawText || "", sourceTitle: input.sourceTitle || "Reading source" };
    },
    /**
     * Create a new session. Required input: `sourceType`. Source text
     * is resolved at create time so the session is self-contained.
     */
    async createSession(input = {}) {
      const resolved = this.resolveSource(input);
      if (!resolved.rawText || !resolved.rawText.trim()) {
        throw new Error("Speed Reader: source has no text to read.");
      }
      const id = input.id || uuid("sr");
      const totalWords = resolved.rawText.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
      const session = {
        id,
        name: input.name || resolved.sourceTitle,
        sourceType: input.sourceType || "paste",
        sourceId: input.sourceId || null,
        sourceTitle: resolved.sourceTitle,
        rawText: resolved.rawText,
        currentWordIndex: 0,
        totalWords,
        wpm: input.wpm || 360,
        fontSize: input.fontSize || 64,
        punctuationPause: input.punctuationPause !== false,
        sentencePause: input.sentencePause !== false,
        longWordSlow: input.longWordSlow !== false,
        focusMode: !!input.focusMode,
        bookmarks: [],
        notes: [],
        stats: { wordsRead: 0, pauses: 0, startedAt: null, lastReadAt: null, elapsedMs: 0 },
        completedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const state = this.loadSync();
      await this.save({ ...state, activeId: id, sessions: [...(state.sessions || []), session] });
      return session;
    },
    async updateSession(id, patch) {
      const state = this.loadSync();
      const sessions = (state.sessions || []).map((s) =>
        s.id === id ? { ...s, ...clone(patch), updatedAt: nowIso() } : s
      );
      await this.save({ ...state, sessions });
      return sessions.find((s) => s.id === id) || null;
    },
    async setActiveSession(id) {
      const state = this.loadSync();
      if (id && !(state.sessions || []).some((s) => s.id === id)) return null;
      await this.save({ ...state, activeId: id || null });
      return this.getActiveSessionSync();
    },
    async deleteSession(id) {
      const state = this.loadSync();
      const sessions = (state.sessions || []).filter((s) => s.id !== id);
      const activeId = state.activeId === id ? null : state.activeId;
      await this.save({ ...state, sessions, activeId });
      return { id, deleted: true };
    },
    async setProgress(id, currentWordIndex, extras = {}) {
      const sess = this.getSessionSync(id);
      if (!sess) return null;
      const stats = {
        ...(sess.stats || {}),
        ...(extras.stats || {}),
        lastReadAt: nowIso(),
      };
      return this.updateSession(id, {
        currentWordIndex: Math.max(0, Math.min(sess.totalWords || 0, currentWordIndex | 0)),
        stats,
      });
    },
    async setSettings(id, settings = {}) {
      const allowed = ["wpm", "fontSize", "punctuationPause", "sentencePause", "longWordSlow", "focusMode"];
      const patch = {};
      for (const k of allowed) if (k in settings) patch[k] = settings[k];
      if (!Object.keys(patch).length) return this.getSessionSync(id);
      return this.updateSession(id, patch);
    },
    async addBookmark(id, bookmark = {}) {
      const sess = this.getSessionSync(id);
      if (!sess) return null;
      const item = {
        id: bookmark.id || uuid("bm"),
        wordIndex: bookmark.wordIndex | 0,
        label: bookmark.label || "",
        sentence: bookmark.sentence || 0,
        note: bookmark.note || "",
        createdAt: nowIso(),
      };
      const exists = (sess.bookmarks || []).some(
        (b) => b.wordIndex === item.wordIndex && (b.label || "") === (item.label || "")
      );
      const bookmarks = exists ? sess.bookmarks : [item, ...(sess.bookmarks || [])];
      return this.updateSession(id, { bookmarks });
    },
    async removeBookmark(id, bookmarkId) {
      const sess = this.getSessionSync(id);
      if (!sess) return null;
      return this.updateSession(id, {
        bookmarks: (sess.bookmarks || []).filter((b) => b.id !== bookmarkId),
      });
    },
    async addNote(id, note = {}) {
      const sess = this.getSessionSync(id);
      if (!sess) return null;
      const item = {
        id: note.id || uuid("nt"),
        wordIndex: note.wordIndex | 0,
        kind: note.kind || "difficulty",
        body: note.body || "",
        sentence: note.sentence || "",
        createdAt: nowIso(),
      };
      return this.updateSession(id, { notes: [item, ...(sess.notes || [])] });
    },
    async removeNote(id, noteId) {
      const sess = this.getSessionSync(id);
      if (!sess) return null;
      return this.updateSession(id, {
        notes: (sess.notes || []).filter((n) => n.id !== noteId),
      });
    },
    async resetProgress(id) {
      const sess = this.getSessionSync(id);
      if (!sess) return null;
      return this.updateSession(id, {
        currentWordIndex: 0,
        completedAt: null,
        stats: { wordsRead: 0, pauses: 0, startedAt: null, lastReadAt: null, elapsedMs: 0 },
      });
    },
    async markComplete(id) {
      return this.updateSession(id, { completedAt: nowIso() });
    },
  };

  const TrashService = {
    listSync() {
      return StorageService.getSync(KEYS.trash, []);
    },
    async add(item) {
      const all = await StorageService.get(KEYS.trash, []);
      const next = [{ ...clone(item), deletedAt: item.deletedAt || nowIso() }, ...all];
      await StorageService.set(KEYS.trash, next);
      return item;
    },
    async restore(id) {
      const all = await StorageService.get(KEYS.trash, []);
      const item = all.find((t) => t.id === id);
      if (!item) return null;
      const nextTrash = all.filter((t) => t.id !== id);
      await StorageService.set(KEYS.trash, nextTrash);
      const { deletedAt, ...entity } = item;
      await EntityService.save(entity.type, { ...entity, status: "active" });
      return entity;
    },
    async purge(id) {
      const all = await StorageService.get(KEYS.trash, []);
      await StorageService.set(KEYS.trash, id ? all.filter((t) => t.id !== id) : []);
    },
  };

  const ManuscriptChapterService = {
    defaultState() {
      return {
        authors: [],
        chapters: [],
        activeChapterId: null,
        manuscripts: {},
        notes: {},
        extractions: {},
        trashedChapters: [],
        updatedAt: nowIso(),
      };
    },
    loadSync() {
      return StorageService.getSync(KEYS.manuscriptChapters, this.defaultState());
    },
    async save(state, opts = {}) {
      const next = { ...this.loadSync(), ...clone(state), updatedAt: nowIso() };
      await StorageService.set(KEYS.manuscriptChapters, next);
      window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated", { detail: next }));
      return next;
    },
    async setChapterContent(chapterId, manuscript, meta = {}, opts = {}) {
      const state = this.loadSync();
      const prevChapter = (state.chapters || []).find((c) => c.id === chapterId) || null;
      const prevManuscript = (state.manuscripts || {})[chapterId] || null;
      const chapters = (state.chapters || []).map((c) => (
        c.id === chapterId ? { ...c, ...meta, updatedAt: nowIso() } : c
      ));
      const result = await this.save({
        ...state,
        chapters: chapters.length ? chapters : state.chapters,
        manuscripts: { ...(state.manuscripts || {}), [chapterId]: manuscript },
        activeChapterId: chapterId,
      }, opts);
      if (!opts.skipAudit && prevChapter) {
        try {
          AuditService.log({
            action: "chapter.save",
            label: `Saved chapter "${prevChapter.title || chapterId}"`,
            targetType: "chapter",
            targetId: chapterId,
            targetName: prevChapter.title || null,
            before: { ..._auditSummariseChapter(prevChapter), bodyHtml: prevManuscript?.html || "", bodyText: prevManuscript?.text || "" },
            after:  _auditSummariseChapter({ ...prevChapter, ...meta, bodyHtml: manuscript?.html, bodyText: manuscript?.text }),
            source: "ManuscriptChapterService",
          });
        } catch (_) {}
      }
      return result;
    },
    async createFromComposition(payload = {}, opts = {}) {
      const state = this.loadSync();
      const id = payload.id || uuid("chapter");
      const slotNumber = (state.chapters?.length || 0) + 1;
      const title = payload.title || `Chapter ${slotNumber}`;
      const chapter = {
        id,
        slotNumber,
        title,
        status: payload.status || "draft",
        bodyHtml: payload.bodyHtml || payload.draft || "",
        bodyText: payload.bodyText || payload.draft || "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        compositionId: payload.compositionId || null,
      };
      const next = {
        ...state,
        chapters: [...(state.chapters || []), chapter],
        manuscripts: { ...(state.manuscripts || {}), [id]: { html: chapter.bodyHtml, text: chapter.bodyText } },
        activeChapterId: id,
      };
      await this.save(next, opts);
      window.dispatchEvent(new CustomEvent("lw:chapter-created", { detail: { chapter } }));
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "chapter.create",
            label: `Created chapter "${title}"`,
            targetType: "chapter",
            targetId: id,
            targetName: title,
            before: null,
            after: _auditSummariseChapter(chapter),
            source: "ManuscriptChapterService",
          });
        } catch (_) {}
      }
      return chapter;
    },
    // Delete a chapter: removes it + its manuscript, renumbers the rest,
    // and retains the removed {chapter, manuscript} in `trashedChapters`
    // so it can be restored (no silent data loss). Logged to the audit
    // trail. Not marked reversible via the generic undo path because
    // chapter restore uses restoreChapter() rather than entity undo.
    async deleteChapter(chapterId, opts = {}) {
      const state = this.loadSync();
      const chapter = (state.chapters || []).find((c) => c.id === chapterId) || null;
      if (!chapter) return null;
      const manuscript = (state.manuscripts || {})[chapterId] || null;
      const remaining = (state.chapters || [])
        .filter((c) => c.id !== chapterId)
        .map((c, i) => ({ ...c, num: i + 1 }));
      const manuscripts = { ...(state.manuscripts || {}) };
      delete manuscripts[chapterId];
      const trashedChapters = [{ chapter, manuscript, deletedAt: nowIso() }, ...(state.trashedChapters || [])].slice(0, 50);
      const nextActive = state.activeChapterId === chapterId ? (remaining[0]?.id || null) : state.activeChapterId;
      await this.save({ ...state, chapters: remaining, manuscripts, trashedChapters, activeChapterId: nextActive }, { skipAudit: true });
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "chapter.delete",
            label: `Deleted chapter "${chapter.title || chapterId}"`,
            targetType: "chapter",
            targetId: chapterId,
            targetName: chapter.title || null,
            before: _auditSummariseChapter(chapter),
            after: null,
            source: "ManuscriptChapterService",
            reversible: false,
          });
        } catch (_) {}
      }
      return { chapter, manuscript };
    },
    async restoreChapter(chapterId, opts = {}) {
      const state = this.loadSync();
      const entry = (state.trashedChapters || []).find((t) => t.chapter && t.chapter.id === chapterId);
      if (!entry) return null;
      const trashedChapters = (state.trashedChapters || []).filter((t) => !(t.chapter && t.chapter.id === chapterId));
      const chapters = [...(state.chapters || []), entry.chapter].map((c, i) => ({ ...c, num: i + 1 }));
      const manuscripts = { ...(state.manuscripts || {}) };
      if (entry.manuscript) manuscripts[chapterId] = entry.manuscript;
      return this.save({ ...state, chapters, manuscripts, trashedChapters, activeChapterId: chapterId }, opts);
    },
    // Move a chapter one slot up/down and renumber. Drag-and-drop reorder
    // is deferred; this backs the visible Move Up / Move Down controls.
    async moveChapter(chapterId, direction, opts = {}) {
      const state = this.loadSync();
      const chapters = (state.chapters || []).slice();
      const idx = chapters.findIndex((c) => c.id === chapterId);
      if (idx < 0) return state;
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= chapters.length) return state;
      const tmp = chapters[idx];
      chapters[idx] = chapters[swapWith];
      chapters[swapWith] = tmp;
      const renumbered = chapters.map((c, i) => ({ ...c, num: i + 1 }));
      const result = await this.save({ ...state, chapters: renumbered }, { skipAudit: true });
      if (!opts.skipAudit) {
        try {
          AuditService.log({
            action: "chapter.reorder",
            label: `Moved chapter "${tmp.title || chapterId}" ${direction}`,
            targetType: "chapter",
            targetId: chapterId,
            targetName: tmp.title || null,
            source: "ManuscriptChapterService",
            reversible: false,
          });
        } catch (_) {}
      }
      return result;
    },
  };

  // ManuscriptNoteService — paragraph-level notes/comments anchored to a
  // chapter + paragraph id (UAT #19). Range/selection-anchored comments are
  // future polish; a captured selection is stored as `quote` when available.
  const ManuscriptNoteService = {
    defaultState() {
      return { notes: {}, updatedAt: nowIso() };
    },
    loadSync() {
      return StorageService.getSync(KEYS.manuscriptNotes, this.defaultState());
    },
    getSync(id) {
      const s = this.loadSync();
      return (s.notes && s.notes[id]) || null;
    },
    listByChapterSync(chapterId) {
      const s = this.loadSync();
      return Object.values(s.notes || {})
        .filter((n) => n.chapterId === chapterId)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    },
    listByParagraphSync(chapterId, paragraphId) {
      return this.listByChapterSync(chapterId).filter((n) => n.paragraphId === paragraphId);
    },
    async _persist(notes) {
      const next = { notes, updatedAt: nowIso() };
      await StorageService.set(KEYS.manuscriptNotes, next);
      window.dispatchEvent(new CustomEvent("lw:manuscript-notes-updated", { detail: next }));
      return next;
    },
    async createNote(note = {}) {
      const s = this.loadSync();
      const id = note.id || uuid("note");
      const row = {
        id,
        projectId: note.projectId || null,
        chapterId: note.chapterId || null,
        paragraphId: note.paragraphId || null,
        startOffset: note.startOffset != null ? note.startOffset : null,
        endOffset: note.endOffset != null ? note.endOffset : null,
        quote: note.quote || "",
        noteText: note.noteText || "",
        authorId: note.authorId || null,
        status: note.status === "resolved" ? "resolved" : "open",
        source: note.source || "manual",
        createdAt: note.createdAt || nowIso(),
        updatedAt: nowIso(),
        resolvedAt: null,
      };
      const notes = { ...(s.notes || {}), [id]: row };
      await this._persist(notes);
      try {
        AuditService.log({
          action: "note.create",
          label: `Added paragraph note${row.quote ? ` on "${String(row.quote).slice(0, 40)}"` : ""}`,
          targetType: "note", targetId: id,
          targetName: row.noteText ? String(row.noteText).slice(0, 40) : null,
          before: null, after: row, source: "ManuscriptNoteService", reversible: false,
        });
      } catch (_) {}
      return row;
    },
    async updateNote(id, patch = {}) {
      const s = this.loadSync();
      const prev = s.notes && s.notes[id];
      if (!prev) return null;
      const row = { ...prev, ...patch, id, updatedAt: nowIso() };
      const notes = { ...(s.notes || {}), [id]: row };
      await this._persist(notes);
      return row;
    },
    async resolveNote(id, status = "resolved") {
      const s = this.loadSync();
      const prev = s.notes && s.notes[id];
      if (!prev) return null;
      const nextStatus = status === "resolved" ? "resolved" : "open";
      const row = { ...prev, status: nextStatus, resolvedAt: nextStatus === "resolved" ? nowIso() : null, updatedAt: nowIso() };
      const notes = { ...(s.notes || {}), [id]: row };
      await this._persist(notes);
      try {
        AuditService.log({
          action: "note.resolve",
          label: `${nextStatus === "resolved" ? "Resolved" : "Reopened"} paragraph note`,
          targetType: "note", targetId: id, before: prev, after: row,
          source: "ManuscriptNoteService", reversible: false,
        });
      } catch (_) {}
      return row;
    },
    async deleteNote(id) {
      const s = this.loadSync();
      const prev = s.notes && s.notes[id];
      if (!prev) return null;
      const notes = { ...(s.notes || {}) };
      delete notes[id];
      await this._persist(notes);
      try {
        AuditService.log({
          action: "note.delete",
          label: "Deleted paragraph note",
          targetType: "note", targetId: id, before: prev, after: null,
          source: "ManuscriptNoteService", reversible: false,
        });
      } catch (_) {}
      return prev;
    },
  };

  // -------------------------------------------------------------------
  // rewriteEntityRefs — when two entities are merged, rewrite every
  // reference to the source ID across the live store to point at the
  // target ID. Covers: occurrences, other entities' data fields, review
  // queue items, composition payload, references' linkedEntityIds, and
  // trash metadata. ManuscriptChapterService stores chapter-level
  // entity occurrences elsewhere (OccurrenceService is the canonical
  // store), so no chapter rewrite is needed beyond the occurrence rebind.
  // -------------------------------------------------------------------
  function deepReplaceIds(value, fromId, toId) {
    if (value == null) return value;
    if (typeof value === "string") return value === fromId ? toId : value;
    if (Array.isArray(value)) return value.map((v) => deepReplaceIds(v, fromId, toId));
    if (typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = deepReplaceIds(v, fromId, toId);
      return out;
    }
    return value;
  }

  async function rewriteEntityRefs(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    // 1. Occurrences (canonical manuscript-to-entity link).
    await OccurrenceService.rebindEntity(fromId, toId);
    // 2. Other entities' data fields.
    const all = EntityService.listAllSync();
    for (const [type, byId] of Object.entries(all)) {
      for (const e of Object.values(byId || {})) {
        if (!e.data) continue;
        const next = deepReplaceIds(e.data, fromId, toId);
        if (JSON.stringify(next) !== JSON.stringify(e.data)) {
          await EntityService.update(type, e.id, { data: next });
        }
      }
    }
    // 3. Review queue items.
    const queue = await StorageService.get(KEYS.reviewQueue, []);
    const queueNext = queue.map((item) => deepReplaceIds(item, fromId, toId));
    if (JSON.stringify(queueNext) !== JSON.stringify(queue)) {
      await StorageService.set(KEYS.reviewQueue, queueNext);
    }
    // 4. Composition payload.
    const comp = await StorageService.get(KEYS.composition, null);
    if (comp) {
      const compNext = deepReplaceIds(comp, fromId, toId);
      if (JSON.stringify(compNext) !== JSON.stringify(comp)) {
        await StorageService.set(KEYS.composition, compNext);
      }
    }
    // 5. References' linkedEntityIds and any embedded refs.
    const refs = await StorageService.get(KEYS.references, []);
    const refsNext = refs.map((r) => deepReplaceIds(r, fromId, toId));
    if (JSON.stringify(refsNext) !== JSON.stringify(refs)) {
      await StorageService.set(KEYS.references, refsNext);
    }
    // 6. Trash metadata.
    const trash = await StorageService.get(KEYS.trash, []);
    const trashNext = trash.map((t) => deepReplaceIds(t, fromId, toId));
    if (JSON.stringify(trashNext) !== JSON.stringify(trash)) {
      await StorageService.set(KEYS.trash, trashNext);
    }
    // 7. Project intelligence (entity summaries indexed by id).
    const pi = ProjectIntelService.loadSync({});
    const piNext = deepReplaceIds(pi, fromId, toId);
    if (JSON.stringify(piNext) !== JSON.stringify(pi)) {
      await ProjectIntelService.save(piNext);
    }
  }

  // -------------------------------------------------------------------
  // Relationship edges — live data source for the Relationships panel.
  // Two origins merge into one normalised edge list:
  //   1. Explicit `relationships` entities. Extraction-accepted records
  //      carry data.fromId/toId/relationshipType; editor-created records
  //      carry data.from/to (related pickers) + data.bondType.
  //   2. Synthetic edges read from cast dossier fields (family / lovers /
  //      allies / mentors / rivals / enemies) so the web is populated
  //      before any explicit record exists. Synthetic edges are read-only
  //      (recordId: null) and yield to explicit records on the same pair.
  // -------------------------------------------------------------------
  const REL_TYPE_BUCKETS = {
    friend: "friend", ally: "friend", allies: "friend", "loyal-to": "friend",
    "sworn-to": "friend", oath: "friend", trusted: "friend", saved: "friend",
    forgave: "friend", comforted: "friend", "whispered-to": "friend",
    enemy: "enemy", enemies: "enemy", foe: "enemy", betrayed: "enemy",
    struck: "enemy", abandoned: "enemy", confronted: "enemy", "shouted-at": "enemy",
    family: "family", sister: "family", brother: "family", mother: "family",
    father: "family", parent: "family", child: "family", cousin: "family",
    sibling: "family", kin: "family", "ward-of": "family", "sister-in-law": "family",
    lover: "lover", lovers: "lover", loves: "lover", spouse: "lover",
    married: "lover", kissed: "lover", embraced: "lover",
    rival: "rival", rivals: "rival",
    mentor: "mentor", mentors: "mentor", teacher: "mentor", "student-of": "mentor",
    faction: "faction",
  };
  const REL_EDGE_DEFAULTS = {
    friend:  { strength: 65, trust: 70, conflict: 15 },
    enemy:   { strength: 65, trust: 10, conflict: 75 },
    family:  { strength: 70, trust: 60, conflict: 35 },
    lover:   { strength: 80, trust: 75, conflict: 25 },
    rival:   { strength: 60, trust: 30, conflict: 65 },
    mentor:  { strength: 60, trust: 65, conflict: 20 },
    faction: { strength: 50, trust: 45, conflict: 40 },
    unknown: { strength: 45, trust: 50, conflict: 30 },
  };
  function relTypeBucket(raw) {
    const t = String(raw || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (REL_EDGE_DEFAULTS[t]) return t;
    return REL_TYPE_BUCKETS[t] || "unknown";
  }
  function relPartyId(v) {
    if (v == null) return null;
    if (Array.isArray(v)) return relPartyId(v[0]);
    if (typeof v === "string") return v || null;
    if (typeof v === "object") return v.id || null;
    return null;
  }
  function relNum(v) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && isFinite(n) ? n : null;
  }
  const relClamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

  const LinkService = {
    async patchEntity(entityId, entityType, patch) {
      return EntityService.update(entityType, entityId, patch);
    },

    listRelationshipEdgesSync() {
      const castById = {};
      for (const c of EntityService.listSync("cast")) {
        if (c && c.status !== "deleted") castById[c.id] = c;
      }
      // Chapter numbers + per-cast occurrence chapters → "Ch. n" chips and
      // shared-scene evidence quotes.
      const chapterNum = new Map();
      try {
        const chState = ManuscriptChapterService.loadSync() || {};
        (chState.chapters || []).filter((c) => !c.reserved).forEach((c, i) => chapterNum.set(c.id, c.num || i + 1));
      } catch (_) {}
      const occByEntity = new Map();
      try {
        for (const o of OccurrenceService.listAllSync() || []) {
          if (!o || !o.entityId || !castById[o.entityId]) continue;
          const list = occByEntity.get(o.entityId) || [];
          list.push(o);
          occByEntity.set(o.entityId, list);
        }
      } catch (_) {}
      const chaptersOf = (id) => {
        const set = new Set();
        for (const o of occByEntity.get(id) || []) {
          const n = chapterNum.get(o.chapterId);
          if (n != null) set.add(n);
        }
        return set;
      };
      const sharedChapters = (aId, bId) => {
        const bSet = chaptersOf(bId);
        return [...chaptersOf(aId)].filter((n) => bSet.has(n)).sort((x, y) => x - y).slice(0, 8);
      };
      const sharedQuotes = (aId, bId, chapters, max = 2) => {
        const want = new Set(chapters);
        const out = [];
        for (const o of occByEntity.get(aId) || []) {
          const n = chapterNum.get(o.chapterId);
          if (n == null || !want.has(n)) continue;
          const text = String(o.exactText || "").trim();
          if (!text) continue;
          out.push({ id: "occ-" + (o.occurrenceId || o.id || out.length), chapter: n, quote: text, strength: "uncertain" });
          if (out.length >= max) break;
        }
        return out;
      };

      const edges = [];
      const pairCovered = new Set();
      const pairKey = (a, b) => (a < b ? a + "::" + b : b + "::" + a);

      // 1. Explicit relationship records.
      for (const rec of EntityService.listSync("relationships")) {
        if (!rec || rec.status === "deleted") continue;
        const d = rec.data || {};
        const a = relPartyId(d.fromId != null ? d.fromId : d.from);
        const b = relPartyId(d.toId != null ? d.toId : d.to);
        if (!a || !b || a === b || !castById[a] || !castById[b]) continue;
        const rawType = d.bondType || d.relationshipType || d.type || "";
        const type = relTypeBucket(rawType);
        const base = REL_EDGE_DEFAULTS[type] || REL_EDGE_DEFAULTS.unknown;
        let strength = relNum(d.strength != null ? d.strength : d.intensity);
        let trust = relNum(d.trust);
        let conflict = relNum(d.conflict);
        const valence = String(d.valence || "").toLowerCase();
        if (strength == null) strength = base.strength;
        if (trust == null) {
          trust = base.trust;
          if (valence === "positive") trust += 10;
          if (valence === "negative") trust -= 20;
          if (valence === "cold") trust -= 10;
        }
        if (conflict == null) {
          conflict = base.conflict;
          if (valence === "negative") conflict += 20;
          if (valence === "heated") conflict += 25;
          if (valence === "positive") conflict -= 10;
          if (valence === "quiet") conflict -= 10;
        }
        const chapters = Array.isArray(d.chapters) && d.chapters.length
          ? d.chapters.slice(0, 8)
          : sharedChapters(a, b);
        const recChapter = chapterNum.get(rec.chapterId) || chapters[0] || "—";
        const evidence = [];
        if (d.sourceQuote) evidence.push({ id: rec.id + "-sq", chapter: recChapter, quote: String(d.sourceQuote), strength: "strong" });
        if (d.evidence) evidence.push({ id: rec.id + "-ev", chapter: recChapter, quote: String(d.evidence), strength: "strong" });
        if (evidence.length < 3) evidence.push(...sharedQuotes(a, b, chapters, 3 - evidence.length));
        edges.push({
          id: rec.id,
          recordId: rec.id,
          synthetic: false,
          a, b, type,
          rawType: String(rawType || "unknown"),
          secret: !!d.secret || !!d.hidden,
          summary: rec.summary || d.summary || "",
          chapters,
          strength: relClamp(strength),
          trust: relClamp(trust),
          conflict: relClamp(conflict),
          evidence: evidence.slice(0, 3),
        });
        pairCovered.add(pairKey(a, b));
      }

      // 2. Synthetic edges from cast dossier related-multi fields.
      const CAST_EDGE_FIELDS = [
        ["family", "family"], ["lovers", "lover"], ["allies", "friend"],
        ["mentors", "mentor"], ["rivals", "rival"], ["enemies", "enemy"],
      ];
      const SYN_LABEL = { family: "Family tie", lover: "Lovers", friend: "Allies", mentor: "Mentor", rival: "Rivals", enemy: "Enemies" };
      for (const c of Object.values(castById)) {
        const d = c.data || {};
        for (const [field, type] of CAST_EDGE_FIELDS) {
          const raw = d[field];
          const list = raw == null ? [] : (Array.isArray(raw) ? raw : [raw]);
          for (const v of list) {
            const other = relPartyId(v);
            if (!other || other === c.id || !castById[other]) continue;
            const key = pairKey(c.id, other);
            if (pairCovered.has(key)) continue;
            pairCovered.add(key);
            const chapters = sharedChapters(c.id, other);
            const base = REL_EDGE_DEFAULTS[type];
            edges.push({
              id: "syn-" + key + "-" + type,
              recordId: null,
              synthetic: true,
              a: c.id, b: other, type,
              rawType: field,
              secret: false,
              summary: (SYN_LABEL[type] || type) + " — recorded in " + (c.name || "this character") + "'s dossier.",
              chapters,
              strength: base.strength,
              trust: base.trust,
              conflict: base.conflict,
              evidence: sharedQuotes(c.id, other, chapters),
            });
          }
        }
      }
      return edges;
    },
    async linkField(entityId, entityType, field, targetId, targetType) {
      const entity = EntityService.getSync(entityId, entityType);
      if (!entity) return null;
      const data = { ...(entity.data || {}) };
      const list = Array.isArray(data[field]) ? [...data[field]] : [];
      if (!list.includes(targetId)) list.push(targetId);
      data[field] = list;
      if (targetType) data[field + "Type"] = targetType;
      return EntityService.update(entityType, entityId, { data });
    },
    async appendField(entityId, entityType, field, value) {
      // Generic field-append for onAdd<Field> callbacks. Pushes a value
      // onto entity.data[field] (creating it if absent). Avoids duplicates
      // when the value is a primitive equal to an existing entry.
      if (entityId == null || !field || value == null || value === "") return null;
      const entity = EntityService.getSync(entityId, entityType);
      if (!entity) return null;
      const data = { ...(entity.data || {}) };
      const list = Array.isArray(data[field]) ? [...data[field]] : [];
      const exists = (typeof value === "string" || typeof value === "number")
        ? list.includes(value)
        : list.some((row) => row && typeof row === "object" && row.id && value && row.id === value.id);
      if (!exists) list.push(value);
      data[field] = list;
      return EntityService.update(entityType, entityId, { data });
    },
    async setStatus(entityId, entityType, status) {
      return EntityService.update(entityType, entityId, { status });
    },
    async toggleFlag(entityId, entityType, flag) {
      const entity = EntityService.getSync(entityId, entityType);
      if (!entity) return null;
      const flags = new Set(entity.flags || []);
      if (flags.has(flag)) flags.delete(flag); else flags.add(flag);
      return EntityService.update(entityType, entityId, { flags: [...flags] });
    },
    async mergeEntities(targetId, targetType, sourceIds = []) {
      const target = EntityService.getSync(targetId, targetType);
      if (!target) return null;
      for (const sid of sourceIds) {
        if (!sid || sid === targetId) continue;
        const src = EntityService.getSync(sid, targetType);
        if (src) {
          // Global reference rewrite — every place sid is referenced now
          // points at targetId. Includes occurrences, other entities' data
          // links, review queue items, composition payload, references'
          // linkedEntityIds, and trash metadata.
          await rewriteEntityRefs(sid, targetId);
          await EntityService.delete(targetType, sid);
        }
      }
      return target;
    },
    async equipItem(itemId, ownerId) {
      const item = EntityService.getSync(itemId, "items");
      return EntityService.update("items", itemId, {
        data: { ...(item?.data || {}), ownerId, equipped: true },
      });
    },
    async unequipItem(itemId) {
      const item = EntityService.getSync(itemId, "items");
      return EntityService.update("items", itemId, {
        data: { ...(item?.data || {}), equipped: false },
      });
    },
    async assignOwner(itemId, ownerId) {
      const item = EntityService.getSync(itemId, "items");
      return EntityService.update("items", itemId, {
        data: { ...(item?.data || {}), ownerId },
      });
    },
    async setParentLocation(locationId, parentId) {
      return EntityService.update("locations", locationId, {
        data: { ...(EntityService.getSync(locationId, "locations")?.data || {}), parentId },
      });
    },
  };

  // -------------------------------------------------------------------
  // Provider defaults per adapter type. baseUrl/model only — never keys.
  // -------------------------------------------------------------------
  const PROVIDER_DEFAULTS = {
    openai:     { baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", needsKey: true },
    openrouter: { baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openrouter/auto", needsKey: true },
    anthropic:  { baseUrl: "https://api.anthropic.com", defaultModel: "claude-opus-4-7", needsKey: true },
    ollama:     { baseUrl: "http://localhost:11434", defaultModel: "llama3", needsKey: false },
    custom:     { baseUrl: "", defaultModel: "", needsKey: true },
  };

  const AIService = {
    listProvidersSync() {
      const all = KeysService.loadAllProviderSettingsSync() || {};
      // Return shallow config copies, never keys.
      return Object.values(all).map((p) => ({ ...p }));
    },
    async getProviderConfig(providerId = "openai") {
      const settings = KeysService.loadProviderSync(providerId) || {};
      const type = settings.providerType || (providerId in PROVIDER_DEFAULTS ? providerId : "openai");
      const defaults = PROVIDER_DEFAULTS[type] || PROVIDER_DEFAULTS.openai;
      return {
        providerId,
        providerType: type,
        baseUrl: settings.baseUrl || defaults.baseUrl,
        model: settings.defaultModel || settings.model || defaults.defaultModel,
        headers: settings.headers || {},
        needsKey: defaults.needsKey,
        apiKey: await KeysService.loadKey(providerId),
      };
    },
    async saveProviderConfig(config = {}) {
      const id = config.id || config.providerId || config.providerType || "openai";
      return KeysService.saveProvider(id, config);
    },
    async clearProviderKey(providerId) {
      return KeysService.clearProviderKey(providerId);
    },
    async testConnection(providerId = "openai") {
      const cfg = await this.getProviderConfig(providerId);
      if (cfg.needsKey && !cfg.apiKey) {
        return { ok: false, providerId, message: "No API key stored for this provider." };
      }
      const base = (cfg.baseUrl || "").replace(/\/$/, "");
      try {
        if (cfg.providerType === "anthropic") {
          // Anthropic has no /models GET; do a 1-token ping (no manuscript text).
          const res = await fetch(`${base}/v1/messages`, {
            method: "POST",
            headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({ model: cfg.model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
          });
          if (!res.ok) { const t = await res.text(); return { ok: false, providerId, message: `HTTP ${res.status}: ${t.slice(0, 200)}` }; }
          return { ok: true, providerId, message: "Connection successful." };
        }
        if (cfg.providerType === "ollama") {
          const res = await fetch(`${base}/api/tags`);
          if (!res.ok) { const t = await res.text(); return { ok: false, providerId, message: `HTTP ${res.status}: ${t.slice(0, 200)}` }; }
          return { ok: true, providerId, message: "Local Ollama reachable." };
        }
        // openai / openrouter / custom — GET /models.
        const res = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${cfg.apiKey}`, ...(cfg.headers || {}) },
        });
        if (!res.ok) { const t = await res.text(); return { ok: false, providerId, message: `HTTP ${res.status}: ${t.slice(0, 200)}` }; }
        return { ok: true, providerId, message: "Connection successful." };
      } catch (err) {
        return { ok: false, providerId, message: err.message || String(err) };
      }
    },
    // ----- adapters -----
    async _completeOpenAI(cfg, { messages, model, maxTokens, temperature, responseFormat }) {
      const body = {
        model: model || cfg.model,
        max_tokens: maxTokens || 1200,
        messages,
        ...(temperature != null ? { temperature } : {}),
        ...(responseFormat ? { response_format: responseFormat } : {}),
      };
      const res = await fetch(`${(cfg.baseUrl || "").replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", ...(cfg.headers || {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`AI request failed (${res.status}): ${t.slice(0, 300)}`); }
      const json = await res.json();
      return json.choices?.[0]?.message?.content || "";
    },
    async _completeAnthropic(cfg, { messages, model, maxTokens, temperature }) {
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const userMsgs = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      const body = {
        model: model || cfg.model,
        max_tokens: maxTokens || 1200,
        ...(system ? { system } : {}),
        ...(temperature != null ? { temperature } : {}),
        messages: userMsgs.length ? userMsgs : [{ role: "user", content: "" }],
      };
      const res = await fetch(`${(cfg.baseUrl || "").replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json", ...(cfg.headers || {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`AI request failed (${res.status}): ${t.slice(0, 300)}`); }
      const json = await res.json();
      return (json.content || []).map((b) => b.text || "").join("") || "";
    },
    async _completeOllama(cfg, { messages, model, temperature }) {
      const body = { model: model || cfg.model, messages, stream: false, ...(temperature != null ? { options: { temperature } } : {}) };
      const res = await fetch(`${(cfg.baseUrl || "").replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cfg.headers || {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`AI request failed (${res.status}): ${t.slice(0, 300)}`); }
      const json = await res.json();
      return json.message?.content || "";
    },
    /**
     * complete — accepts both the legacy { prompt, system } form and the
     * new { messages } form. Routes to the correct adapter by provider type.
     */
    async complete(opts = {}) {
      const providerId = opts.providerId || "openai";
      const cfg = await this.getProviderConfig(providerId);
      if (cfg.needsKey && !cfg.apiKey) throw new Error("No API key configured. Add one in Settings → AI Providers.");
      const messages = Array.isArray(opts.messages) && opts.messages.length
        ? opts.messages
        : [
            ...(opts.system ? [{ role: "system", content: opts.system }] : []),
            { role: "user", content: opts.prompt || "" },
          ];
      const params = { messages, model: opts.model, maxTokens: opts.maxTokens, temperature: opts.temperature, responseFormat: opts.responseFormat };
      if (cfg.providerType === "anthropic") return this._completeAnthropic(cfg, params);
      if (cfg.providerType === "ollama") return this._completeOllama(cfg, params);
      return this._completeOpenAI(cfg, params);
    },
    async completeJson(opts = {}) {
      const raw = await this.complete({
        ...opts,
        responseFormat: opts.responseFormat || { type: "json_object" },
        system: (opts.system || "") + "\nRespond with valid JSON only.",
      });
      const cleaned = (raw || "").replace(/^```json\s*|\s*```$/g, "").trim();
      try { return JSON.parse(cleaned); } catch (_) { return null; }
    },
    /**
     * Build a structured privacy-guard summary for a pending call.
     * Pure: does not send anything.
     */
    buildGuardSummary({ task, providerId, model, context } = {}) {
      const c = context || {};
      return {
        task: task || "ai-task",
        providerId: providerId || null,
        model: model || null,
        includesManuscript: !!c.includesManuscript,
        includesReferences: !!c.includesReferences,
        includesIntel: !!c.includesIntel,
        approxChars: c.approxChars || 0,
        reminder: "This sends the listed local content to your configured BYOK provider. No data leaves the app without this action.",
      };
    },
  };

  // -------------------------------------------------------------------
  // AIRoutingService — task → provider/model routing + privacy flags.
  // Stored under KEYS.aiRouting. References provider ids + model names
  // only; never secrets.
  // -------------------------------------------------------------------
  const AI_TASKS = [
    "quickExtraction", "deepExtraction", "writingDraft", "rewritePassage",
    "continueWriting", "projectIntelligence", "referenceSummary",
    "continuityCheck", "skillTreeGeneration", "aiHandoffAssist",
  ];
  const AIRoutingService = {
    defaultState() {
      return {
        mode: "balanced",
        tier: "normal", // free | budget | normal | extended | full
        defaultProviderId: "openai",
        taskRoutes: {},
        maxContextTokens: 8000,
        preferSummaries: true,
        confirmBeforeSendingManuscript: true,
        redactSensitiveFields: true,
        localFallbackEnabled: true,
        updatedAt: nowIso(),
      };
    },
    loadSync() {
      const raw = StorageService.getSync(KEYS.aiRouting, null);
      if (!raw || typeof raw !== "object") return this.defaultState();
      return { ...this.defaultState(), ...raw };
    },
    async save(patch = {}) {
      const next = { ...this.loadSync(), ...clone(patch), updatedAt: nowIso() };
      // taskRoutes merges rather than replaces unless explicitly set.
      if (patch.taskRoutes) next.taskRoutes = { ...this.loadSync().taskRoutes, ...patch.taskRoutes };
      await StorageService.set(KEYS.aiRouting, next);
      window.dispatchEvent(new CustomEvent("lw:ai-routing-updated", { detail: next }));
      return next;
    },
    isLocalOnly() {
      return this.loadSync().mode === "localOnly";
    },
    requiresManuscriptConfirmation() {
      return this.loadSync().confirmBeforeSendingManuscript !== false;
    },
    // A provider that runs on the user's own machine — zero token cost and
    // no text egress. Ollama, or a custom endpoint pointed at localhost.
    isLocalProviderCfg(cfg) {
      if (!cfg) return false;
      const t = cfg.providerType || "";
      if (t === "ollama") return true;
      if (t === "custom" && /(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/.test(cfg.baseUrl || "")) return true;
      return false;
    },
    // A provider usable for a real call: enabled, and either keyed or local
    // (Ollama needs no key).
    isUsableProviderCfg(cfg) {
      return !!cfg && cfg.enabled !== false && (cfg.hasKey || this.isLocalProviderCfg(cfg));
    },
    /**
     * Resolve a task to { providerId, model } or null when blocked /
     * unconfigured. Honours localOnly (no AI at all), the cost tier (the
     * "free" tier only ever routes to a local provider, so it never costs
     * the user anything), explicit task routes, and the default provider.
     */
    resolveRoute(task) {
      const state = this.loadSync();
      if (state.mode === "localOnly") return null;
      const tier = state.tier || "normal";
      const tierOk = (cfg) => tier !== "free" || this.isLocalProviderCfg(cfg);
      // 1) explicit per-task route
      const route = state.taskRoutes?.[task];
      if (route?.providerId) {
        const cfg = KeysService.loadProviderSync(route.providerId);
        if (this.isUsableProviderCfg(cfg) && tierOk(cfg)) return { providerId: route.providerId, model: route.model || cfg.defaultModel || cfg.model };
      }
      const all = KeysService.loadAllProviderSettingsSync() || {};
      // 2) default provider
      const def = state.defaultProviderId && all[state.defaultProviderId];
      if (this.isUsableProviderCfg(def) && tierOk(def)) return { providerId: state.defaultProviderId, model: def.defaultModel || def.model };
      // 3) first usable provider honouring the tier (prefers local on "free")
      const usable = Object.values(all).filter((p) => this.isUsableProviderCfg(p) && tierOk(p));
      // On the free tier, always prefer a local provider.
      const pick = usable.find((p) => this.isLocalProviderCfg(p)) || usable[0];
      if (pick) return { providerId: pick.id, model: pick.defaultModel || pick.model };
      return null;
    },
  };

  // -------------------------------------------------------------------
  // AIContextBuilder — deterministic, bounded context assembly. Pure
  // over the live store. Never includes secrets.
  // -------------------------------------------------------------------
  const AIContextBuilder = {
    build({ task, chapterId, selectedEntityIds, includeProjectIntelligence, includeReferences, detailLevel } = {}) {
      const routing = AIRoutingService.loadSync();
      const maxChars = Math.max(2000, (routing.maxContextTokens || 8000) * 4);
      const sections = [];
      let approxChars = 0;
      let includesManuscript = false, includesReferences = false, includesIntel = false;
      const push = (label, text) => {
        if (!text) return;
        const slice = String(text).slice(0, Math.max(0, maxChars - approxChars));
        if (!slice) return;
        sections.push({ label, text: slice });
        approxChars += slice.length;
      };

      // Chapter text.
      if (chapterId) {
        const mcs = ManuscriptChapterService.loadSync();
        const ch = (mcs.chapters || []).find((c) => c.id === chapterId);
        const body = ch?.bodyText || (ch?.bodyHtml || "").replace(/<[^>]+>/g, "") || mcs.manuscripts?.[chapterId]?.text || "";
        if (body) { push("Chapter: " + (ch?.title || chapterId), body); includesManuscript = true; }
      }

      // Selected entities.
      const selIds = Array.isArray(selectedEntityIds) ? selectedEntityIds : [];
      if (selIds.length) {
        const lines = [];
        for (const id of selIds) {
          const e = EntityService.getSync(id);
          if (e) lines.push(`- ${e.name} (${e.type}): ${e.data?.summary || e.data?.description || ""}`);
        }
        push("Selected entities", lines.join("\n"));
      }

      // Project Intelligence (summaries preferred).
      if (includeProjectIntelligence !== false) {
        const intel = ProjectIntelService.loadSync();
        const intelText = [intel.writingStyleGuide && ("Style: " + intel.writingStyleGuide),
          Array.isArray(intel.canonRules) ? ("Canon: " + intel.canonRules.join("; ")) : (intel.canonRules ? "Canon: " + intel.canonRules : "")]
          .filter(Boolean).join("\n");
        if (intelText) { push("Project intelligence", intelText); includesIntel = true; }
      }

      // References flagged for AI context.
      if (includeReferences !== false) {
        const refs = (StorageService.getSync(KEYS.references, []) || []).filter((r) => r.includedInAIContext || r.aiContext);
        if (refs.length) {
          const refText = refs.map((r) => `- ${r.title}: ${(r.summary || r.content || "").slice(0, 400)}`).join("\n");
          push("References", refText);
          includesReferences = true;
        }
      }

      // Known entities by type (names only — cheap grounding for extraction).
      if (task === "deepExtraction" || task === "quickExtraction") {
        const all = EntityService.listAllSync();
        const known = [];
        for (const [type, byId] of Object.entries(all)) {
          const names = Object.values(byId || {}).filter((e) => e.status !== "deleted").map((e) => e.name);
          if (names.length) known.push(`${type}: ${names.slice(0, 40).join(", ")}`);
        }
        push("Known entities", known.join("\n"));
      }

      const systemPrompt = "You are Loomwright's writing and worldbuilding assistant. Use only the provided context.";
      const userPrompt = sections.map((s) => `## ${s.label}\n${s.text}`).join("\n\n");
      return { systemPrompt, userPrompt, sections, approxChars, includesManuscript, includesReferences, includesIntel };
    },
  };

  // -------------------------------------------------------------------
  // Local mention scanner — finds case-insensitive whole-word matches of
  // a needle in haystack. Conservative on purpose: this is a fallback for
  // the no-BYOK path and a stepping stone toward proper NLP extraction.
  // -------------------------------------------------------------------
  function findRanges(haystack, needle) {
    if (!haystack || !needle || needle.length < 2) return [];
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi");
    const out = [];
    let m;
    while ((m = re.exec(haystack)) !== null) {
      out.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  // Ported from legacy entityMatchingService.js — standard DP Levenshtein
  // distance. Used by the alias-aware fuzzy match below. Cheap enough at
  // chapter scale (O(m*n) per pair). Returns 0 for identical strings.
  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const m = a.length, n = b.length;
    const prev = new Array(n + 1);
    const curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= n; j++) prev[j] = curr[j];
    }
    return prev[n];
  }

  function levenshteinSimilarity(a, b) {
    if (!a || !b) return 0;
    const longest = Math.max(a.length, b.length);
    if (!longest) return 1;
    return 1 - levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / longest;
  }

  // Chunk text with overlap so entities mentioned across boundaries
  // aren't lost. Ported from legacy chapterDataExtractionService.js
  // (5000 / 500 defaults). Returns [{ index, start, end, text }].
  function chunkText(text, size = 5000, overlap = 500) {
    if (!text) return [];
    if (text.length <= size) return [{ index: 0, start: 0, end: text.length, text }];
    const out = [];
    let start = 0;
    let index = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      out.push({ index, start, end, text: text.slice(start, end) });
      if (end >= text.length) break;
      start = end - overlap;
      index++;
    }
    return out;
  }

  // Three-tier match: exact (case-insensitive) → alias → fuzzy
  // (Levenshtein, threshold ≥ 0.85). Higher than legacy's 0.7 because
  // we're scanning raw text without an LLM filter; a low threshold
  // would produce false positives. Returns { entity, type, confidence,
  // matchType } or null. Used by the enhanced scanner below.
  function findKnownEntityMention(needle, opts = {}) {
    if (!needle) return null;
    const threshold = opts.threshold != null ? opts.threshold : 0.85;
    const lowerNeedle = String(needle).toLowerCase();
    const all = EntityService.listAllSync();
    let best = null;
    for (const [type, byId] of Object.entries(all)) {
      for (const entity of Object.values(byId || {})) {
        if (!entity) continue;
        const name = String(entity.name || "");
        if (name.toLowerCase() === lowerNeedle) {
          return { entity, type, confidence: 1.0, matchType: "exact" };
        }
        const aliases = entity.aliases || [];
        for (const alias of aliases) {
          if (String(alias).toLowerCase() === lowerNeedle) {
            return { entity, type, confidence: 0.95, matchType: "nickname" };
          }
        }
        const score = levenshteinSimilarity(needle, name);
        if (score >= threshold && (!best || score > best.confidence)) {
          best = { entity, type, confidence: score, matchType: "fuzzy" };
        }
      }
    }
    return best;
  }

  // Map a 0–1 confidence to Loomwright's existing four-band scale.
  function confidenceBand(value) {
    if (value == null) return "orange";
    const v = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(v)) return "orange";
    if (v >= 0.95) return "blue";
    if (v >= 0.75) return "green";
    if (v >= 0.5) return "orange";
    return "red";
  }

  // Diff helper for upgrade detection — returns the set of top-level
  // fields whose value would change when applying patch onto existing.
  // Ports the spirit of legacy entityMatchingService.detectUpgrade.
  function diffEntity(existing, patch) {
    if (!existing || !patch) return [];
    const changed = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
      const prev = existing[k];
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        if (JSON.stringify(prev || {}) !== JSON.stringify(v)) changed.push(k);
      } else if (Array.isArray(v)) {
        if (JSON.stringify(prev || []) !== JSON.stringify(v)) changed.push(k);
      } else if (prev !== v) {
        changed.push(k);
      }
    }
    return changed;
  }

  function scanTextForKnownEntities(text, chapterId, sessionId) {
    if (!text) return [];
    const all = EntityService.listAllSync();
    const out = [];
    Object.entries(all).forEach(([type, byId]) => {
      Object.values(byId || {}).forEach((entity) => {
        const labels = [entity.name, ...(entity.aliases || [])].filter(Boolean);
        labels.forEach((label) => {
          const ranges = findRanges(text, label);
          ranges.forEach((r) => out.push({
            entityId: entity.id,
            entityType: type,
            exactText: text.slice(r.start, r.end),
            chapterId,
            startOffset: r.start,
            endOffset: r.end,
            extractionSessionId: sessionId,
          }));
        });
      });
    });
    return out;
  }

  // -------------------------------------------------------------------
  // OccurrenceService — persisted EntityOccurrence records linking
  // manuscript spans to real entity IDs. Created by extraction or by
  // accepting a review-queue candidate. Writer's Room can use these for
  // ID-first double-click resolution (with fuzzy label match as fallback
  // only for legacy/demo content).
  // -------------------------------------------------------------------
  const OccurrenceService = {
    listAllSync() {
      return StorageService.getSync(KEYS.occurrences, []);
    },
    listByChapterSync(chapterId) {
      if (!chapterId) return [];
      return this.listAllSync().filter((o) => o.chapterId === chapterId);
    },
    listByEntitySync(entityId) {
      if (!entityId) return [];
      return this.listAllSync().filter((o) => o.entityId === entityId);
    },
    async save(occ) {
      const all = await StorageService.get(KEYS.occurrences, []);
      const id = occ.occurrenceId || uuid("occ");
      const row = {
        occurrenceId: id,
        entityId: occ.entityId || null,
        entityType: occ.entityType ? normaliseType(occ.entityType) : null,
        exactText: occ.exactText || "",
        chapterId: occ.chapterId || null,
        paragraphId: occ.paragraphId || null,
        startOffset: occ.startOffset != null ? occ.startOffset : null,
        endOffset: occ.endOffset != null ? occ.endOffset : null,
        sourceMentionId: occ.sourceMentionId || null,
        extractionSessionId: occ.extractionSessionId || null,
        candidateId: occ.candidateId || null,
        createdAt: occ.createdAt || nowIso(),
      };
      const idx = all.findIndex((o) => o.occurrenceId === id);
      const next = idx >= 0 ? all.map((o, i) => i === idx ? row : o) : [...all, row];
      await StorageService.set(KEYS.occurrences, next);
      return row;
    },
    async saveMany(list = []) {
      if (!list.length) return [];
      const all = await StorageService.get(KEYS.occurrences, []);
      const map = new Map(all.map((o) => [o.occurrenceId, o]));
      const out = [];
      for (const occ of list) {
        const id = occ.occurrenceId || uuid("occ");
        const row = { ...occ, occurrenceId: id, createdAt: occ.createdAt || nowIso() };
        map.set(id, row);
        out.push(row);
      }
      await StorageService.set(KEYS.occurrences, [...map.values()]);
      return out;
    },
    async linkCandidateToEntity(candidateId, entityId, entityType) {
      if (!candidateId || !entityId) return [];
      const all = await StorageService.get(KEYS.occurrences, []);
      const next = all.map((o) => o.candidateId === candidateId ? { ...o, entityId, entityType: entityType ? normaliseType(entityType) : o.entityType } : o);
      await StorageService.set(KEYS.occurrences, next);
      return next.filter((o) => o.candidateId === candidateId);
    },
    async deleteByCandidate(candidateId) {
      if (!candidateId) return;
      const all = await StorageService.get(KEYS.occurrences, []);
      await StorageService.set(KEYS.occurrences, all.filter((o) => o.candidateId !== candidateId));
    },
    // Remove every occurrence for a chapter — used to make re-extraction
    // idempotent (the scan re-creates them for known entities afterwards).
    async deleteByChapter(chapterId) {
      if (!chapterId) return;
      const all = await StorageService.get(KEYS.occurrences, []);
      await StorageService.set(KEYS.occurrences, all.filter((o) => o.chapterId !== chapterId));
    },
    async rebindEntity(fromId, toId) {
      if (!fromId || !toId || fromId === toId) return;
      const all = await StorageService.get(KEYS.occurrences, []);
      await StorageService.set(KEYS.occurrences, all.map((o) => o.entityId === fromId ? { ...o, entityId: toId } : o));
    },
    async markStale(occurrenceId, reason = "offset-mismatch") {
      if (!occurrenceId) return;
      const all = await StorageService.get(KEYS.occurrences, []);
      await StorageService.set(KEYS.occurrences, all.map((o) =>
        o.occurrenceId === occurrenceId ? { ...o, stale: true, staleReason: reason, staleAt: nowIso() } : o
      ));
    },
  };

  // -------------------------------------------------------------------
  // isOccurrenceStale — true when the stored exactText no longer matches
  // bodyText.slice(startOffset, endOffset). Cheap pure helper exposed on
  // the Backend so renderers can verify before highlighting and the WR
  // double-click resolver can avoid opening the wrong entity.
  // -------------------------------------------------------------------
  function isOccurrenceStale(occ, bodyText) {
    if (!occ) return true;
    if (occ.stale) return true;
    if (occ.startOffset == null || occ.endOffset == null) return true;
    if (typeof bodyText !== "string") return true;
    if (occ.endOffset > bodyText.length || occ.startOffset < 0) return true;
    return bodyText.slice(occ.startOffset, occ.endOffset) !== occ.exactText;
  }

  // -------------------------------------------------------------------
  // Extraction support helpers (Pass 1 — fixtures, local rules, candidate
  // enrichment). All functions are pure / store-aware; they don't mutate
  // entities themselves. They produce candidate objects in the
  // standardised shape and pattern-match phrases against known entities.
  // -------------------------------------------------------------------

  // Standardised candidate shape (see EXTRACTION_QUALITY_PLAN.md §D).
  // back-compat: legacy keys (`reason`, `targetEntityId`) are populated
  // alongside the new keys (`summary`, `existingEntityId`) so existing
  // review-queue consumers keep working.
  function buildCandidate(input, opts = {}) {
    const entityType = normaliseType(input.entityType || input.type || "references");
    const name = String(input.name || input.title || "").trim() || "Suggestion";
    // Match the candidate against the known store unless caller supplies
    // existingEntityId or matchType already.
    let matchType = input.matchType;
    let existingEntityId = input.existingEntityId != null ? input.existingEntityId : input.targetEntityId || null;
    let match = null;
    if (!matchType) {
      match = findKnownEntityMention(name, { threshold: opts.fuzzyThreshold || 0.85 });
      if (match && (!existingEntityId || existingEntityId === match.entity.id)) {
        matchType = match.matchType;
        existingEntityId = match.entity.id;
      } else if (input.isNew === false) {
        matchType = "ambiguous";
      } else {
        matchType = "new";
      }
    }
    const previousState = input.previousState
      || (existingEntityId ? (EntityService.getSync(existingEntityId, entityType) || null) : null);
    const baseConfidence = typeof input.confidence === "number"
      ? (input.confidence > 1 ? input.confidence / 100 : input.confidence)
      : (opts.defaultConfidence != null ? opts.defaultConfidence : 0.7);
    const confidence = match ? Math.max(baseConfidence, match.confidence) : baseConfidence;
    const suggestedChanges = input.suggestedChanges || null;
    const suggestedAction = input.suggestedAction || (
      existingEntityId
        ? (suggestedChanges && Object.keys(suggestedChanges).length ? "update"
            : (previousState && diffEntity(previousState, input.payload || input).length ? "update" : "link"))
        : "create"
    );
    const summary = input.summary || input.description || input.reason || "";
    const candidateId = input.candidateId || uuid("cand");
    const sourceQuotes = Array.isArray(input.sourceQuotes) && input.sourceQuotes.length
      ? input.sourceQuotes.slice(0, 3)
      : (input.sourceQuote ? [input.sourceQuote] : []);
    const sourceQuote = sourceQuotes[0] || "";
    return {
      id: uuid("rq"),
      // New canonical shape:
      candidateId,
      entityType,
      name,
      summary,
      suggestedAction,
      confidence,
      confidenceBand: confidenceBand(confidence),
      matchType,
      existingEntityId,
      sourceQuote,
      sourceQuotes,
      chapterId: input.chapterId || null,
      paragraphId: input.paragraphId || null,
      startOffset: input.startOffset != null ? input.startOffset : null,
      endOffset: input.endOffset != null ? input.endOffset : null,
      previousState,
      relatedEntityIds: Array.isArray(input.relatedEntityIds) ? input.relatedEntityIds.slice() : [],
      suggestedChanges,
      payload: input.payload || input,
      // Back-compat for existing review-queue UI / handlers:
      reason: summary || (opts.deep ? "Deep extract" : "Extracted from manuscript"),
      action: opts.deep ? "Deep extract" : "Extract",
      level: "suggestion",
      value: Math.round(confidence * 100),
      targetEntityId: existingEntityId,
      extractionSessionId: input.extractionSessionId || opts.extractionSessionId || null,
      status: "pending",
    };
  }

  // Trim leading/trailing whitespace and collapse internal newlines so
  // review-queue cards render cleanly. Limited to ~140 chars.
  function makeSourceQuote(text, startOffset, endOffset, before = 60, after = 80) {
    if (typeof text !== "string" || startOffset == null || endOffset == null) return "";
    const start = Math.max(0, startOffset - before);
    const end = Math.min(text.length, endOffset + after);
    return text.slice(start, end).replace(/\s+/g, " ").trim();
  }

  // Build a known-entities-by-type lookup. Each entry is
  // { id, type, name, aliases[], regex } — the regex matches the name
  // and every alias as word-bounded case-insensitive alternations.
  function knownEntityIndex() {
    const all = EntityService.listAllSync();
    const out = {};
    for (const [type, byId] of Object.entries(all)) {
      out[type] = [];
      for (const e of Object.values(byId || {})) {
        const names = [e.name, ...(e.aliases || [])].filter((n) => typeof n === "string" && n.trim().length >= 2);
        if (!names.length) continue;
        const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
        let regex = null;
        try {
          regex = new RegExp(`(?<![A-Za-z0-9])(${escaped.join("|")})(?![A-Za-z0-9])`, "gi");
        } catch (_) { regex = null; }
        out[type].push({ id: e.id, type, name: e.name, aliases: e.aliases || [], regex });
      }
    }
    return out;
  }

  // Find the first matching entity in a substring slice. Used by phrase
  // detectors to bind a verb phrase to specific known entities.
  function findEntityInSpan(text, span, index, types) {
    if (!index || !span || span.end <= span.start) return null;
    const slice = text.slice(span.start, span.end);
    for (const type of (types || Object.keys(index))) {
      for (const ent of index[type] || []) {
        if (!ent.regex) continue;
        ent.regex.lastIndex = 0;
        const m = ent.regex.exec(slice);
        if (m) return { ...ent, matchText: m[0], offset: span.start + m.index };
      }
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Phrase detectors. Each takes (text, index, chapterId, sessionId)
  // and returns an array of candidates in the standardised shape.
  // Conservative on purpose — they should err on missing real candidates
  // rather than producing wrong ones.
  // -------------------------------------------------------------------

  const ITEM_TRANSFER_VERBS = /(gave|handed|tossed|passed|sold|threw|surrendered|delivered)/i;
  const ITEM_LOSS_VERBS = /(lost|broke|shattered|left behind|dropped|abandoned|destroyed)/i;
  const TRAVEL_VERBS = /(crossed|entered|left|reached|arrived at|fled|returned to|set out for|came to|travelled to|walked to|rode to|sailed to)/i;
  const RELATIONSHIP_VERBS = /(whispered to|shouted at|confronted|kissed|embraced|struck|saved|betrayed|abandoned|forgave|comforted|trusted)/i;
  const STAT_VERBS = /(grew|hardened|weakened|broke|sharpened|dulled|surged|faltered|crumbled|swelled|kindled)/i;
  const COMMON_STATS = ["resolve", "fear", "hope", "strength", "wit", "grief", "courage", "rage", "doubt"];

  function detectItemTransfers(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    // Sliding window: find verb + nearby item + nearby actor(s).
    const verbRe = new RegExp(`(${ITEM_TRANSFER_VERBS.source.slice(1, -1)})`, "gi");
    let m;
    while ((m = verbRe.exec(text)) !== null) {
      const verbStart = m.index;
      const verbEnd = m.index + m[0].length;
      const left = { start: Math.max(0, verbStart - 80), end: verbStart };
      const right = { start: verbEnd, end: Math.min(text.length, verbEnd + 160) };
      const giver = findEntityInSpan(text, left, index, ["cast"]);
      const item = findEntityInSpan(text, right, index, ["items"]);
      const receiver = findEntityInSpan(text, right, index, ["cast"]);
      if (!item) continue;
      const sourceQuote = makeSourceQuote(text, verbStart, verbEnd);
      const suggestedChanges = {};
      if (receiver) suggestedChanges.ownerId = receiver.id;
      out.push(buildCandidate({
        entityType: "items",
        name: item.name,
        existingEntityId: item.id,
        suggestedAction: "update",
        suggestedChanges,
        confidence: 0.78,
        matchType: "exact",
        sourceQuote,
        chapterId,
        startOffset: item.offset,
        endOffset: item.offset + item.matchText.length,
        relatedEntityIds: [giver?.id, receiver?.id].filter(Boolean),
        summary: `Item ${item.name} transferred${receiver ? " to " + receiver.name : ""}${giver ? " by " + giver.name : ""}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectItemLoss(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    const verbRe = new RegExp(`(${ITEM_LOSS_VERBS.source.slice(1, -1)})`, "gi");
    let m;
    while ((m = verbRe.exec(text)) !== null) {
      const verbStart = m.index;
      const verbEnd = verbStart + m[0].length;
      const verbWord = m[0].toLowerCase();
      const right = { start: verbEnd, end: Math.min(text.length, verbEnd + 160) };
      const item = findEntityInSpan(text, right, index, ["items"]);
      if (!item) continue;
      const changes = {};
      if (/lost|left behind|dropped|abandoned/.test(verbWord)) changes.lost = true;
      if (/broke|shattered|destroyed/.test(verbWord)) changes.destroyed = true;
      out.push(buildCandidate({
        entityType: "items",
        name: item.name,
        existingEntityId: item.id,
        suggestedAction: "update",
        suggestedChanges: changes,
        confidence: 0.72,
        matchType: "exact",
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        chapterId,
        startOffset: item.offset,
        endOffset: item.offset + item.matchText.length,
        relatedEntityIds: [],
        summary: `Item ${item.name} ${changes.destroyed ? "destroyed" : "lost"}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectTravel(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    const verbRe = new RegExp(`(${TRAVEL_VERBS.source.slice(1, -1)})`, "gi");
    let m;
    while ((m = verbRe.exec(text)) !== null) {
      const verbStart = m.index;
      const verbEnd = verbStart + m[0].length;
      const left = { start: Math.max(0, verbStart - 80), end: verbStart };
      const right = { start: verbEnd, end: Math.min(text.length, verbEnd + 160) };
      const actor = findEntityInSpan(text, left, index, ["cast"]);
      const place = findEntityInSpan(text, right, index, ["locations"]);
      if (!actor || !place) continue;
      out.push(buildCandidate({
        entityType: "cast",
        name: actor.name,
        existingEntityId: actor.id,
        suggestedAction: "update",
        suggestedChanges: { location: place.id },
        confidence: 0.8,
        matchType: "exact",
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        chapterId,
        startOffset: actor.offset,
        endOffset: actor.offset + actor.matchText.length,
        relatedEntityIds: [place.id],
        summary: `${actor.name} travelled to ${place.name}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectRelationships(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    const verbRe = new RegExp(`(${RELATIONSHIP_VERBS.source.slice(1, -1)})`, "gi");
    let m;
    while ((m = verbRe.exec(text)) !== null) {
      const verbStart = m.index;
      const verbEnd = verbStart + m[0].length;
      const verbWord = m[0].toLowerCase().replace(/\s+/g, "-");
      const left = { start: Math.max(0, verbStart - 80), end: verbStart };
      const right = { start: verbEnd, end: Math.min(text.length, verbEnd + 120) };
      const subject = findEntityInSpan(text, left, index, ["cast"]);
      const object = findEntityInSpan(text, right, index, ["cast"]);
      if (!subject || !object || subject.id === object.id) continue;
      out.push(buildCandidate({
        entityType: "relationships",
        name: `${subject.name} → ${object.name}`,
        suggestedAction: "create",
        confidence: 0.74,
        matchType: "new",
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        chapterId,
        startOffset: verbStart,
        endOffset: verbEnd,
        relatedEntityIds: [subject.id, object.id],
        suggestedChanges: { fromId: subject.id, toId: object.id, relationshipType: verbWord },
        summary: `${subject.name} ${m[0]} ${object.name}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectStatChanges(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    // Pattern: <actor>'s <stat> <verb>
    const re = new RegExp(`([A-Z][A-Za-z]+)(?:'s)\\s+(${COMMON_STATS.join("|")})\\s+(${STAT_VERBS.source.slice(1, -1)})`, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      const actorName = m[1];
      const statName = m[2].toLowerCase();
      const verb = m[3].toLowerCase();
      const actorMatch = findKnownEntityMention(actorName, { threshold: 0.95 });
      if (!actorMatch) continue;
      const direction = /(grew|hardened|sharpened|surged|swelled|kindled)/.test(verb) ? "up" : "down";
      out.push(buildCandidate({
        entityType: "stats",
        name: statName,
        suggestedAction: "create",
        confidence: 0.7,
        matchType: "new",
        sourceQuote: makeSourceQuote(text, m.index, m.index + m[0].length),
        chapterId,
        startOffset: m.index,
        endOffset: m.index + m[0].length,
        relatedEntityIds: [actorMatch.entity.id],
        suggestedChanges: { actorId: actorMatch.entity.id, statName, direction, verb },
        summary: `${actorMatch.entity.name}'s ${statName} ${verb}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectQuestProgression(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    // Case-insensitive lead phrase; proper-noun stays case-sensitive so
    // we don't capture "the hunt for the rabbit" as a candidate.
    const re = /[Tt]he\s+(?:hunt|search|journey|mission|quest)\s+(?:for|to|against)\s+(?:the\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      // Updated regex captures only the proper noun in group 1.
      const subject = m[1];
      const subjectMatch = findKnownEntityMention(subject, { threshold: 0.85 });
      const start = m.index;
      const end = m.index + m[0].length;
      out.push(buildCandidate({
        entityType: "quests",
        name: m[0].replace(/^[Tt]he\s+/, "").replace(/^(hunt|search|journey|mission|quest) (for|to|against)\s+(the\s+)?/i, (s, verb) => verb[0].toUpperCase() + verb.slice(1) + " for ").trim(),
        suggestedAction: "create",
        confidence: 0.66,
        matchType: "new",
        sourceQuote: makeSourceQuote(text, start, end),
        chapterId,
        startOffset: start,
        endOffset: end,
        relatedEntityIds: subjectMatch ? [subjectMatch.entity.id] : [],
        suggestedChanges: { subject: subjectMatch?.entity?.id || subject, phase: "in-progress" },
        summary: `Quest involving ${subject}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectEvents(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    // Pattern: <Capitalised ProperNoun(s)> <event-verb>
    const re = /(?:the\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\s+(began|started|broke out|came to an end|erupted|ended)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const eventName = m[1];
      // Filter common false positives — single common-noun-like words.
      if (/^(He|She|They|It|We|You|Then|Now)$/.test(eventName)) continue;
      const start = m.index;
      const end = m.index + m[0].length;
      out.push(buildCandidate({
        entityType: "events",
        name: eventName,
        suggestedAction: "create",
        confidence: 0.7,
        matchType: "new",
        sourceQuote: makeSourceQuote(text, start, end),
        chapterId,
        startOffset: start,
        endOffset: end,
        relatedEntityIds: [],
        suggestedChanges: { eventType: "named-event", verb: m[2] },
        summary: `Event "${eventName}" ${m[2]}.`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  function detectLore(text, index, chapterId, sessionId) {
    if (!text || !index) return [];
    const out = [];
    const re = /(it was said(?: that)?|the legend (?:of|said)|centuries ago|long before|once,? long ago)\s+([^.!?\n]{8,200})/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      const phrase = m[2].trim();
      out.push(buildCandidate({
        entityType: "lore",
        name: phrase.split(/[,;]/)[0].slice(0, 80) || "Lore fragment",
        suggestedAction: "create",
        confidence: 0.62,
        matchType: "new",
        sourceQuote: makeSourceQuote(text, start, end),
        chapterId,
        startOffset: start,
        endOffset: end,
        relatedEntityIds: [],
        suggestedChanges: { scope: /centuries ago|long before|long ago/i.test(m[1]) ? "world-history" : "legend", body: phrase },
        summary: `Lore: ${phrase.slice(0, 100)}${phrase.length > 100 ? "…" : ""}`,
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId }));
    }
    return out;
  }

  // Run every detector. Returns a flat array of candidates.
  function runLocalDetectors(text, chapterId, sessionId) {
    const index = knownEntityIndex();
    const all = [];
    all.push(...detectItemTransfers(text, index, chapterId, sessionId));
    all.push(...detectItemLoss(text, index, chapterId, sessionId));
    all.push(...detectTravel(text, index, chapterId, sessionId));
    all.push(...detectRelationships(text, index, chapterId, sessionId));
    all.push(...detectStatChanges(text, index, chapterId, sessionId));
    all.push(...detectQuestProgression(text, index, chapterId, sessionId));
    all.push(...detectEvents(text, index, chapterId, sessionId));
    all.push(...detectLore(text, index, chapterId, sessionId));
    return all;
  }

  // Dedupe candidates per the rules in EXTRACTION_QUALITY_PLAN.md §C:
  // same entityType + canonical name + suggestedAction + (if both have
  // existingEntityId) same id. Up to 3 source quotes aggregated.
  function dedupeCandidates(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const byKey = new Map();
    for (const c of candidates) {
      const key = [
        c.entityType,
        String(c.name || "").toLowerCase().trim(),
        c.suggestedAction || "",
        c.existingEntityId || "",
      ].join("|");
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...c, sourceQuotes: c.sourceQuotes && c.sourceQuotes.length ? c.sourceQuotes.slice(0, 3) : (c.sourceQuote ? [c.sourceQuote] : []) });
        continue;
      }
      // Merge: keep highest confidence; union sourceQuotes (max 3);
      // union relatedEntityIds; union suggestedChanges.
      if ((c.confidence || 0) > (existing.confidence || 0)) {
        existing.confidence = c.confidence;
        existing.confidenceBand = c.confidenceBand;
      }
      const quotes = new Set([...(existing.sourceQuotes || []), ...(c.sourceQuotes || []), c.sourceQuote].filter(Boolean));
      existing.sourceQuotes = [...quotes].slice(0, 3);
      existing.sourceQuote = existing.sourceQuotes[0] || existing.sourceQuote;
      existing.relatedEntityIds = [...new Set([...(existing.relatedEntityIds || []), ...(c.relatedEntityIds || [])])];
      existing.suggestedChanges = { ...(existing.suggestedChanges || {}), ...(c.suggestedChanges || {}) };
    }
    return [...byKey.values()];
  }

  // -------------------------------------------------------------------
  // Offline NER discovery (no AI required). The phrase detectors above
  // only fire on entities that ALREADY exist; this pass discovers
  // brand-new named entities (cast / locations / items / skills) from raw
  // prose, so a fresh project's first Save & Extract is not empty.
  // Deterministic and private — no text leaves the device. Discoveries
  // are capped at 0.92 confidence so they are never silently auto-added.
  // -------------------------------------------------------------------
  const NER_STOPWORDS = new Set([
    "the","a","an","and","but","or","nor","so","yet","for","as","at","by","in","on","to","of","off","up","out",
    "if","then","now","when","where","why","how","what","who","whom","whose","which","that","this","these","those",
    "he","she","it","they","we","you","i","me","him","her","them","us","his","hers","its","their","our","my","your",
    "mine","yours","theirs","here","there","yes","no","not","never","always","once","twice","still","just","only",
    "even","also","too","very","quite","rather","perhaps","maybe","indeed","however","therefore","thus","hence",
    "meanwhile","suddenly","finally","soon","later","after","before","while","until","since","because","although",
    "though","unless","whether","despite","during","within","without","across","behind","beyond","beneath","above",
    "below","between","among","around","through","toward","towards","upon","into","onto","from","with","about",
    "against","along","amid","everything","nothing","someone","anyone","everyone","nobody","something","another",
    "chapter","part","prologue","epilogue","monday","tuesday","wednesday","thursday","friday","saturday","sunday",
    "january","february","march","april","may","june","july","august","september","october","november","december",
    "oh","ah","well","okay","hey","please","thanks","thank","again","perhaps","suddenly","eventually",
  ]);
  const NER_CONNECTORS = new Set(["of","the","de","von","van","al","da","di","del","la","le"]);
  const NER_HONORIFIC_SRC = "Lord|Lady|Ser|Sir|Dame|King|Queen|Prince|Princess|Captain|Commander|Lieutenant|Colonel|Major|Sergeant|Master|Mistress|Maester|Archon|General|Admiral|Doctor|Dr|Professor|Mr|Mrs|Ms|Miss|Father|Brother|Sister|Aunt|Uncle|Saint|St|Emperor|Empress|Duke|Duchess|Baron|Baroness|Count|Countess";
  const NER_HONORIFIC_LEAD = new RegExp(`^(?:${NER_HONORIFIC_SRC})\\.?\\s+`);
  const NER_HONORIFICS_BEFORE = new RegExp(`(?:^|\\b)(?:${NER_HONORIFIC_SRC})\\.?\\s+$`);
  const NER_DIALOGUE_VERBS = "said|asked|replied|whispered|shouted|murmured|cried|answered|muttered|growled|hissed|breathed|snapped|wondered|added|continued|exclaimed|declared|warned";
  const NER_DIALOGUE_AFTER = new RegExp(`^[,"'”’\\s]*\\b(?:${NER_DIALOGUE_VERBS})\\b`, "i");
  const NER_DIALOGUE_BEFORE = new RegExp(`\\b(?:${NER_DIALOGUE_VERBS})\\s+$`, "i");
  const NER_LOC_KINDS = "city|keep|village|town|castle|fortress|hold|port|harbour|harbor|isle|island|river|mountain|mountains|forest|gate|tower|temple|inn|tavern|kingdom|realm|land|lands|valley|peak|pass|road|sea|ocean|lake|hall|palace|citadel|abbey|monastery|province|county|shire|domain|territory|wastes|plains|desert|swamp|marsh|moor|caverns|caves|ruins|district|quarter";
  const NER_LOC_OF_BEFORE = new RegExp(`\\b(?:${NER_LOC_KINDS})\\s+of\\s+$`, "i");
  const NER_LOC_HEADNOUN_AFTER = /^\s+(?:Keep|Castle|Tower|Gate|Hold|Fortress|Citadel|Palace|Temple|Bridge|Pass|Peak|Vale|Wood|Woods|Forest|Marsh|Moor|Hall|Inn|Tavern|City|Town|Village|Harbour|Harbor|Port|Isle|Island|Mountains?|River|Lake|Sea|Plains|Desert|Wastes|Ruins)\b/;
  const NER_LOC_PREP_BEFORE = /\b(?:to|at|from|toward|towards|into|near|beyond|through|across|past|reached|entered|left|arrived\s+at|returned\s+to)\s+$/i;
  const NER_ITEM_DET_BEFORE = /\b(?:the|a|an|his|her|their|its|my|your|our)\s+$/i;
  const NER_ITEM_VERB_BEFORE = /\b(?:called|named|wielded|carried|drew|sheathed|forged|enchanted|found|holding|held|equipped|gripped|raised)\s+$/i;
  const NER_ITEM_NOUN_END = /(?:sword|blade|dagger|knife|axe|bow|spear|lance|mace|hammer|flail|club|whip|ring|amulet|crown|circlet|cloak|robe|staff|wand|rod|sceptre|scepter|shield|tome|grimoire|chalice|goblet|orb|gauntlets?|helm|helmet|pendant|necklace|locket|relic|key|crystal|gem|jewel|stone|elixir|potion|scroll|banner|horn|bell|mirror|talisman|charm|armour|armor|plate|mail|boots|gloves|belt|brooch)$/i;
  const NER_SKILL_BEFORE = /\b(?:skill|spell|ability|technique|power|talent|art|incantation|maneuver|manoeuvre)\s+(?:(?:called|named|known\s+as)\s+)?$/i;

  // Find runs of capitalised words (multi-word proper nouns), trimming
  // leading stopwords (sentence-initial "The Keep" → "Keep") and recording
  // whether each kept span sits at a sentence start. Offsets index `text`.
  function extractProperNounSpans(text) {
    if (!text || typeof text !== "string") return [];
    const tokenRe = /[A-Za-z][A-Za-z'’\-]*/g;
    const tokens = [];
    let tm;
    while ((tm = tokenRe.exec(text)) !== null) {
      tokens.push({ word: tm[0], start: tm.index, end: tm.index + tm[0].length });
    }
    const isCap = (w) => /^[A-Z]/.test(w);
    // Two tokens only belong to the same proper-noun run if the text between
    // them is plain horizontal whitespace — a period/comma/newline ends the
    // run ("Aelinor. Lord Brennan" must NOT become one span).
    const smallGap = (a, b) => /^[ \t]{1,4}$/.test(text.slice(a.end, b.start));
    const spans = [];
    let i = 0;
    while (i < tokens.length) {
      if (!isCap(tokens[i].word)) { i++; continue; }
      let last = i;
      let j = i;
      while (j + 1 < tokens.length) {
        const next = tokens[j + 1];
        if (!smallGap(tokens[j], next)) break;
        if (isCap(next.word)) { j++; last = j; continue; }
        if (NER_CONNECTORS.has(next.word.toLowerCase()) && j + 2 < tokens.length && isCap(tokens[j + 2].word) && smallGap(next, tokens[j + 2])) {
          j += 2; last = j; continue;
        }
        break;
      }
      // Sentence-start detection from the char preceding the first token.
      let k = tokens[i].start - 1;
      while (k >= 0 && /\s/.test(text[k])) k--;
      const prev = k >= 0 ? text[k] : "";
      const atStart = k < 0 || /[.!?:;"“”'‘()\[\]—–\-]/.test(prev);
      // Trim leading stopwords.
      let s = i;
      while (s <= last && NER_STOPWORDS.has(tokens[s].word.toLowerCase())) s++;
      if (s <= last) {
        const start = tokens[s].start;
        const end = tokens[last].end;
        const surface = text.slice(start, end);
        if (surface.length >= 2 && !NER_STOPWORDS.has(surface.toLowerCase())) {
          spans.push({ surface, start, end, atSentenceStart: atStart && s === i });
        }
      }
      i = last + 1;
    }
    return spans;
  }

  // Classify a proper-noun surface using lexical signals around its
  // occurrences. Returns { type, signal, confidence } or null (no signal).
  function classifyProperNoun(text, surface, occurrences) {
    if (NER_HONORIFIC_LEAD.test(surface)) return { type: "cast", signal: "honorific", confidence: 0.82 };
    let best = null;
    const consider = (c) => { if (c && (!best || c.confidence > best.confidence)) best = c; };
    if (NER_ITEM_NOUN_END.test(surface)) consider({ type: "items", signal: "item-name", confidence: 0.68 });
    for (const o of occurrences) {
      const before = text.slice(Math.max(0, o.start - 32), o.start);
      const after = text.slice(o.end, Math.min(text.length, o.end + 28));
      if (NER_HONORIFICS_BEFORE.test(before)) return { type: "cast", signal: "honorific", confidence: 0.82 };
      if (NER_DIALOGUE_AFTER.test(after) || NER_DIALOGUE_BEFORE.test(before)) consider({ type: "cast", signal: "dialogue", confidence: 0.8 });
      if (NER_LOC_OF_BEFORE.test(before)) { consider({ type: "locations", signal: "loc-cue", confidence: 0.8 }); }
      if (NER_LOC_HEADNOUN_AFTER.test(after)) consider({ type: "locations", signal: "loc-headnoun", confidence: 0.7 });
      if (NER_SKILL_BEFORE.test(before)) consider({ type: "skills", signal: "skill-cue", confidence: 0.72 });
      if (NER_ITEM_VERB_BEFORE.test(before) && NER_ITEM_NOUN_END.test(surface)) consider({ type: "items", signal: "item-cue", confidence: 0.76 });
      if (NER_ITEM_DET_BEFORE.test(before) && NER_ITEM_NOUN_END.test(surface)) consider({ type: "items", signal: "item-cue", confidence: 0.74 });
      if (NER_LOC_PREP_BEFORE.test(before)) consider({ type: "locations", signal: "loc-prep", confidence: 0.62 });
    }
    return best;
  }

  // Discover brand-new entities from prose. Returns { candidates,
  // discoveredNames }. `knownIndex` is used only to skip names that already
  // exist (those are handled by scanTextForKnownEntities); near-fuzzy hits
  // become `ambiguous` candidates so the queue can offer Merge.
  function discoverEntities(text, knownIndex, chapterId, sessionId, opts = {}) {
    const out = [];
    const discoveredNames = [];
    if (!text || typeof text !== "string") return { candidates: out, discoveredNames };
    const minRecurrence = opts.minRecurrence != null ? opts.minRecurrence : 2;
    const maxCandidates = opts.maxCandidates != null ? opts.maxCandidates : 200;
    const spans = extractProperNounSpans(text);
    const groups = new Map();
    for (const sp of spans) {
      const key = sp.surface.toLowerCase();
      if (!groups.has(key)) groups.set(key, { surface: sp.surface, occ: [] });
      const g = groups.get(key);
      g.occ.push(sp);
      if (!sp.atSentenceStart) g.surface = sp.surface; // prefer a mid-sentence form
    }
    for (const g of groups.values()) {
      if (out.length >= maxCandidates) break;
      const surface = g.surface;
      const count = g.occ.length;
      const known = findKnownEntityMention(surface, { threshold: 0.9 });
      let matchType = "new";
      if (known && (known.matchType === "exact" || known.matchType === "nickname")) continue;
      if (known) matchType = "ambiguous";
      const cls = classifyProperNoun(text, surface, g.occ);
      let type, signal, confidence;
      if (cls) {
        type = cls.type;
        signal = cls.signal;
        confidence = Math.min(cls.confidence + 0.03 * (count - 1), 0.92);
      } else {
        if (count < minRecurrence) continue; // bare single-mention proper noun: skip
        // A proper noun that ONLY ever appears at a sentence start, with no
        // lexical signal, is almost always a capitalised common word
        // ("Time", "Morning"). Require at least one mid-sentence mention.
        if (!g.occ.some((o) => !o.atSentenceStart)) continue;
        type = known ? known.type : "cast";
        signal = "recurrence";
        confidence = Math.min(0.48 + 0.05 * count, 0.6);
      }
      if (matchType === "ambiguous") confidence = Math.min(confidence, known.confidence);
      // Strip a leading honorific into an alias for a cleaner cast name.
      let name = surface;
      const aliases = [];
      if (signal === "honorific") {
        const stripped = surface.replace(NER_HONORIFIC_LEAD, "").trim();
        if (stripped.length >= 2) { aliases.push(surface); name = stripped; }
      }
      const rep = g.occ.find((o) => !o.atSentenceStart) || g.occ[0];
      const cand = buildCandidate({
        entityType: type,
        name,
        isNew: matchType === "new",
        matchType,
        existingEntityId: matchType === "ambiguous" ? known.entity.id : null,
        suggestedAction: matchType === "ambiguous" ? "merge" : "create",
        confidence,
        sourceQuote: makeSourceQuote(text, rep.start, rep.end),
        sourceQuotes: g.occ.slice(0, 3).map((o) => makeSourceQuote(text, o.start, o.end)),
        chapterId,
        startOffset: rep.start,
        endOffset: rep.end,
        suggestedChanges: aliases.length ? { aliases } : null,
        payload: { discovered: true, signal, count, detector: "ner:" + signal, aliases },
        extractionSessionId: sessionId,
      }, { extractionSessionId: sessionId });
      out.push(cand);
      if (matchType === "new") discoveredNames.push({ id: uuid("tmp"), type, name });
    }
    return { candidates: out, discoveredNames };
  }

  // Cluster near-duplicate discovery candidates of the same type (typo-level
  // Levenshtein, or token-subset like "Saren" ⊂ "Saren of Hess"). Keeps the
  // longer/more-frequent name canonical and records the rest as aliases.
  function clusterAliases(candidates) {
    if (!Array.isArray(candidates) || candidates.length < 2) return candidates || [];
    const used = new Set();
    const result = [];
    const tokens = (s) => String(s || "").toLowerCase().split(/\s+/).filter((t) => t && !NER_CONNECTORS.has(t));
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;
      const base = candidates[i];
      const aliases = [];
      const baseTok = new Set(tokens(base.name));
      for (let j = i + 1; j < candidates.length; j++) {
        if (used.has(j)) continue;
        const other = candidates[j];
        if (other.entityType !== base.entityType) continue;
        const otherTok = new Set(tokens(other.name));
        const subset = [...baseTok].every((t) => otherTok.has(t)) || [...otherTok].every((t) => baseTok.has(t));
        const near = levenshteinSimilarity(base.name, other.name) >= 0.88;
        if (!subset && !near) continue;
        used.add(j);
        const longer = base.name.length >= other.name.length ? base.name : other.name;
        const shorter = longer === base.name ? other.name : base.name;
        if (shorter && shorter !== longer && !aliases.includes(shorter)) aliases.push(shorter);
        base.name = longer;
        base.confidence = Math.max(base.confidence || 0, other.confidence || 0);
        base.confidenceBand = confidenceBand(base.confidence);
        base.sourceQuotes = [...new Set([...(base.sourceQuotes || []), ...(other.sourceQuotes || [])])].slice(0, 3);
        base.relatedEntityIds = [...new Set([...(base.relatedEntityIds || []), ...(other.relatedEntityIds || [])])];
      }
      if (aliases.length) {
        const merged = [...new Set([...((base.suggestedChanges && base.suggestedChanges.aliases) || []), ...aliases])];
        base.suggestedChanges = { ...(base.suggestedChanges || {}), aliases: merged };
        base.payload = { ...(base.payload || {}), aliasCandidates: merged };
      }
      result.push(base);
      used.add(i);
    }
    return result;
  }

  // Split text into sentence spans (crude but offset-accurate) so candidates
  // can be grouped by the sentence that produced them.
  function splitSentenceSpans(text) {
    const spans = [];
    if (!text) return spans;
    const re = /[^.!?\n]+[.!?]*(?:\s+|$)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!m[0].trim()) { if (m.index === re.lastIndex) re.lastIndex++; continue; }
      spans.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return spans;
  }

  // Stamp each candidate with the sentence it came from, so the review UI can
  // cluster the multiple entities a single sentence yields (e.g. an actor + a
  // location + a travel event from "Dave went to Scotland from England").
  function assignSentenceGroups(candidates, text, chapterId) {
    if (!Array.isArray(candidates) || !candidates.length || !text) return candidates;
    const spans = splitSentenceSpans(text);
    for (const c of candidates) {
      if (c.startOffset == null) continue;
      const span = spans.find((s) => c.startOffset >= s.start && c.startOffset < s.end);
      if (span) {
        c.sentenceId = (chapterId || "ch") + ":s:" + span.start;
        c.groupId = c.sentenceId;
      }
    }
    return candidates;
  }

  // Compact "author's rules" context assembled from onboarding answers +
  // project intelligence, injected into AI prompts so any model — including
  // free/local ones like Ollama — follows the same premise, tone, POV,
  // canon, and forbidden-terms rules. Bounded; never includes secrets.
  // Offline writing-style analysis — computes real metrics from a prose
  // sample (no AI). Feeds the onboarding "voice fingerprint" and the style
  // guide so suggestions match the author's voice.
  function analyzeWritingStyle(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const words = t.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (!wordCount) return null;
    const sentences = t.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
    const sentenceCount = sentences.length || 1;
    const avgSentenceLen = Math.round(wordCount / sentenceCount);
    const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const sentenceVariance = lens.length ? Math.round(Math.sqrt(lens.reduce((a, l) => a + Math.pow(l - avgSentenceLen, 2), 0) / lens.length)) : 0;
    const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, "")).filter(Boolean)).size;
    const lexicalDiversity = Math.round((uniqueWords / wordCount) * 100);
    const dialogueMatches = (t.match(/[“"][^”"]{1,}[”"]/g) || []).length;
    const dialogueRatio = Math.round((dialogueMatches / sentenceCount) * 100);
    const adverbs = words.filter((w) => /ly$/i.test(w) && w.replace(/[^a-z]/gi, "").length > 4).length;
    const adverbDensity = Math.round((adverbs / wordCount) * 1000) / 10; // per 100 words
    const longWords = words.filter((w) => w.replace(/[^a-z]/gi, "").length >= 7).length;
    const longWordRatio = longWords / wordCount;
    const register = longWordRatio > 0.18 ? "elevated" : (avgSentenceLen > 22 ? "literary" : "direct");
    const pacing = avgSentenceLen <= 12 ? "brisk" : (avgSentenceLen >= 24 ? "measured" : "balanced");
    return { wordCount, sentenceCount, avgSentenceLen, sentenceVariance, lexicalDiversity, dialogueRatio, adverbDensity, register, pacing };
  }

  function buildAuthorContext(opts = {}) {
    const maxChars = opts.maxChars || 1200;
    let ob = {}; try { ob = OnboardingService.loadSync({}) || {}; } catch (_) {}
    let intel = {}; try { intel = ProjectIntelService.loadSync({}) || {}; } catch (_) {}
    const w = ob.welcome || {}, f = ob.foundation || {}, st = ob.style || {}, world = ob.world || {};
    const lines = [];
    const add = (label, val) => {
      const s = Array.isArray(val) ? val.filter(Boolean).join(", ") : (val == null ? "" : String(val).trim());
      if (s) lines.push(label + ": " + s);
    };
    add("Title", w.title);
    add("Genre", [w.genre, w.subgenre].filter(Boolean).join(" / "));
    add("Audience", w.audience);
    add("Premise", f.premise || f.logline);
    add("Themes", f.themes);
    add("Tone", [].concat(f.toneWords || [], st.narratorTone || []));
    add("POV / tense", [f.pov, f.tense].filter(Boolean).join(", "));
    add("Style signature", st.signature);
    add("Avoid", st.avoid);
    add("Canon rules", world.canonRules);
    add("Forbidden terms", world.forbidden);
    add("Terminology", world.terminology);
    add("Project foundation", intel.projectFoundation);
    add("Writing style guide", intel.writingStyleGuide);
    let out = lines.join("\n");
    if (out.length > maxChars) out = out.slice(0, maxChars) + "…";
    return out;
  }

  // Auto-apply a high-confidence (blue, >=0.95) candidate: create the new
  // entity, or apply the suggested diff to an existing one. Mirrors the
  // accept path but runs inline during extraction. Returns the saved entity.
  async function autoApplyCandidate(ri) {
    if (!ri) return null;
    const type = ri.entityType || "references";
    const existingId = ri.existingEntityId || ri.targetEntityId || null;
    if (existingId && ri.suggestedChanges && Object.keys(ri.suggestedChanges).length) {
      const existing = EntityService.getSync(existingId, type);
      if (!existing) return null;
      const nextData = { ...(existing.data || {}), ...ri.suggestedChanges };
      return EntityService.update(type, existingId, { data: nextData });
    }
    if ((ri.suggestedAction || "create") === "create") {
      const fields = (ri.payload && ri.payload.name) ? { ...ri.payload } : { name: ri.name, summary: ri.summary };
      if (ri.suggestedChanges && ri.suggestedChanges.aliases) fields.aliases = ri.suggestedChanges.aliases;
      if (ri.suggestedChanges && Object.keys(ri.suggestedChanges).length) fields.data = { ...(fields.data || {}), ...ri.suggestedChanges };
      if (Array.isArray(ri.relatedEntityIds) && ri.relatedEntityIds.length) fields.data = { ...(fields.data || {}), relatedEntityIds: ri.relatedEntityIds };
      return EntityService.save(type, fields, { status: "active" });
    }
    return null;
  }

  const ExtractionService = {
    loadSessionSync() {
      return StorageService.getSync(KEYS.extractionSession, { status: "idle", items: [] });
    },
    async saveSession(session) {
      await StorageService.set(KEYS.extractionSession, { ...session, updatedAt: nowIso() });
      window.dispatchEvent(new CustomEvent("lw:extraction-updated", { detail: session }));
    },
    async runExtraction({ chapterId, text, deep = false, paragraphs = null, scope = "chapter", onProgress = null, signal = null }) {
      const sessionId = uuid("ext");
      // Optional live-progress reporting. onProgress + a window event let a
      // wizard render entities as they are found; both are no-ops for the
      // existing batch callers. All the extra params are optional.
      const report = (stage, extra = {}) => {
        const detail = { sessionId, chapterId, scope, stage, deep, ...extra };
        try { if (typeof onProgress === "function") onProgress(detail); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent("lw:extraction-progress", { detail })); } catch (_) {}
      };
      const isAborted = () => !!(signal && signal.aborted);
      report("start");
      // Idempotent re-extraction: clear this chapter's prior occurrences and
      // still-pending candidates so re-running refreshes them instead of
      // duplicating. Accepted/denied/auto-added work is preserved; known
      // entities get their occurrences re-created by the scan below.
      if (chapterId) {
        try { await OccurrenceService.deleteByChapter(chapterId); } catch (_) {}
        try { await ReviewService.removePendingByChapter(chapterId); } catch (_) {}
      }
      // Local pass: scan text for mentions of known entities and persist
      // EntityOccurrence records pointing at real entity IDs. This runs
      // regardless of AI configuration so double-click works without BYOK.
      const occurrences = scanTextForKnownEntities(text || "", chapterId, sessionId);
      if (paragraphs && occurrences.length) {
        // Annotate each occurrence with the paragraphId whose
        // [start, end) range covers the occurrence's offset, when the
        // caller supplied paragraph offsets.
        for (const occ of occurrences) {
          const p = paragraphs.find((pr) => pr.start <= occ.startOffset && pr.end >= occ.endOffset);
          if (p) occ.paragraphId = p.id;
        }
      }
      if (occurrences.length) await OccurrenceService.saveMany(occurrences);
      report("scan", { occurrenceCount: occurrences.length });

      // Local detectors (Pass 1): pattern-based phrase scans for item
      // transfer/loss, travel, relationships, stat changes, quest
      // progression, events, and lore. Run unconditionally, with no AI.
      const localCandidates = runLocalDetectors(text || "", chapterId, sessionId);

      // Extraction preferences (user-controllable in Settings; default to
      // high recall so a fresh project surfaces plenty to review).
      const exPrefs = SettingsService.getSectionSync("extraction", { aggressiveness: "balanced", autoAdd95: true, showAutoAddedInReview: true, threshold: 50, scan: {} });
      const exMinRecurrence = exPrefs.aggressiveness === "gentle" ? 3 : exPrefs.aggressiveness === "aggressive" ? 1 : 2;

      // Offline NER discovery (Pass 0): find brand-new named entities
      // (cast / locations / items / skills) so a fresh project's first
      // extraction is not empty. Deterministic, no AI, no text egress.
      const discovery = discoverEntities(text || "", knownEntityIndex(), chapterId, sessionId, { minRecurrence: exMinRecurrence });
      const discoveryCandidates = clusterAliases(discovery.candidates);
      report("detect", { candidates: [...discoveryCandidates, ...localCandidates] });

      let items = [];
      // AI is opt-in enrichment only. Resolve through the routing tier so we
      // honour Local-only mode (no AI) and the Free tier (local providers
      // like Ollama only — never a paid cloud call). The local pass above
      // already produced candidates with no AI and no text egress.
      let aiRoute = null;
      try { aiRoute = AIRoutingService.resolveRoute(deep ? "deepExtraction" : "quickExtraction"); } catch (_) { aiRoute = null; }
      const aiAvailable = !!aiRoute;
      if (aiAvailable) {
        // Chunk with overlap so entities mentioned across boundaries
        // aren't lost (ported from legacy chapterDataExtractionService).
        const chunks = chunkText(text || "", 5000, 500);
        // Inject "Known characters / Known items" context so the model can
        // return matched candidates instead of duplicates (ported from
        // legacy canonExtractionPipeline).
        const all = EntityService.listAllSync();
        const known = (type) => Object.values(all[type] || {})
          .map((e) => e.name)
          .filter(Boolean)
          .slice(0, 50)
          .join(", ");
        const authorCtx = buildAuthorContext();
        const rulesBlock = authorCtx ? `\nAuthor's project rules (respect these when naming/classifying entities):\n${authorCtx}\n` : "";
        for (const chunk of chunks) {
          if (isAborted()) break;
          report("ai", { chunkIndex: chunk.index, chunkCount: chunks.length });
          const promptHeader = deep
            ? `You are a canon extraction system for a long-form story. Analyze this chapter chunk and extract narrative elements across every domain.
${rulesBlock}
Chapter chunk ${chunk.index + 1}/${chunks.length}:
---
${chunk.text}
---

Known characters: ${known("cast") || "None"}
Known items:      ${known("items") || "None"}
Known locations:  ${known("locations") || "None"}

Extract into these categories (each item has a confidence 0-1):
1. characters: [{name, description, isNew, traits, role, confidence}]
2. items: [{name, description, isNew, type, rarity, owner, confidence}]
3. skills: [{name, description, isNew, user, action, level, confidence}]
4. relationships: [{character1, character2, type, change, strength, confidence}]
5. plots: [{title, description, status, characters, confidence}]
6. quests: [{title, description, type, status, objectives, confidence}]
7. timeline: [{event, timestamp, characters, significance, confidence}]
8. locations: [{name, type, description, significance, confidence}]
9. factions: [{name, type, members, goals, stance, confidence}]
10. lore: [{title, category, description, significance, confidence}]

Return valid JSON only.`
            : `Analyze the following chapter chunk and extract notable named entities.
${rulesBlock}
Chunk ${chunk.index + 1}/${chunks.length}:
${chunk.text}

Known characters: ${known("cast") || "None"}
Known items:      ${known("items") || "None"}

Return JSON: [{type:"cast|items|locations|quests|events", name, summary, confidence}]`;
          try {
            const raw = await AIService.complete({
              providerId: aiRoute.providerId,
              model: aiRoute.model,
              prompt: promptHeader,
              system: "Return valid JSON only. No markdown fences.",
              maxTokens: deep ? 2500 : 1200,
            });
            try {
              const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
              const chunkItems = Array.isArray(parsed)
                ? parsed
                : Object.entries(parsed).flatMap(([category, arr]) => {
                    if (!Array.isArray(arr)) return [];
                    const typeMap = { characters: "cast", items: "items", skills: "skills", locations: "locations", quests: "quests", timeline: "events", factions: "factions", lore: "lore", plots: "lore", relationships: "relationships" };
                    return arr.map((row) => ({ ...row, type: row.type || typeMap[category] || "references" }));
                  });
              items.push(...chunkItems.map((it) => ({ ...it, _chunkIndex: chunk.index, _chunkStart: chunk.start })));
              report("ai", { chunkIndex: chunk.index, chunkCount: chunks.length, names: chunkItems.map((it) => it.name).filter(Boolean) });
            } catch (_) {
              // Skip unparseable chunk
            }
          } catch (e) {
            // AI call failed on this chunk — continue with others.
          }
        }
      }

      // Convert AI items (if any) into the standardised candidate shape
      // via buildCandidate. Then merge with the local detectors' output
      // and dedupe so the queue isn't flooded with duplicates of the
      // same name from both passes.
      const aiCandidates = items.map((item) => {
        // Locate a source quote for the AI candidate by scanning the
        // original chapter text for the first whole-word match of the
        // candidate name (paragraph/offset are best-effort).
        let sourceQuote = "";
        let startOffset = null, endOffset = null, paragraphId = null;
        if (item.name) {
          const ranges = findRanges(text || "", item.name);
          if (ranges.length) {
            startOffset = ranges[0].start;
            endOffset = ranges[0].end;
            sourceQuote = makeSourceQuote(text || "", startOffset, endOffset);
            if (paragraphs) {
              const p = paragraphs.find((pr) => pr.start <= startOffset && pr.end >= endOffset);
              if (p) paragraphId = p.id;
            }
          }
        }
        return buildCandidate({
          entityType: item.type || "references",
          name: item.name,
          summary: item.summary || item.description,
          confidence: item.confidence,
          isNew: item.isNew,
          sourceQuote,
          chapterId,
          paragraphId,
          startOffset,
          endOffset,
          payload: item,
          extractionSessionId: sessionId,
        }, { deep, extractionSessionId: sessionId });
      });

      let reviewItems = dedupeCandidates([...discoveryCandidates, ...localCandidates, ...aiCandidates]);
      // Honour the user's Settings → Extraction controls: skip disabled entity
      // types and drop candidates below the confidence threshold.
      const exMinConf = (exPrefs.threshold != null ? exPrefs.threshold : 50) / 100;
      reviewItems = reviewItems.filter((c) => {
        if (exPrefs.scan && exPrefs.scan[c.entityType] === false) return false;
        const conf = typeof c.confidence === "number" ? c.confidence : 0;
        return conf >= exMinConf;
      });
      // Group candidates by the sentence that produced them (multi-entry).
      assignSentenceGroups(reviewItems, text || "", chapterId);
      // Auto-apply blue (>=0.95) candidates when the user allows it: apply now
      // but keep them in the queue (status "auto-added") so they can review or
      // undo. Local discovery is capped below blue, so this only fires for
      // AI-boosted or exact matches — never a low-confidence local guess.
      if (exPrefs.autoAdd95 !== false) {
        for (const ri of reviewItems) {
          if (ri.confidenceBand !== "blue") continue;
          try {
            const saved = await autoApplyCandidate(ri);
            if (saved && saved.id) {
              ri.status = exPrefs.showAutoAddedInReview === false ? "done" : "auto-added";
              ri.autoAddedEntityId = saved.id;
              if (ri.matchType === "new") ri.existingEntityId = saved.id;
            }
          } catch (_) {}
        }
      }
      await ReviewService.addMany(reviewItems);
      // Tag occurrences for unknown candidates (`matchType: "new"`) so
      // accept can backfill the entityId after entity creation. Known
      // entities already have occurrences from `scanTextForKnownEntities`
      // above. We avoid double-occurring known entities here.
      for (const ri of reviewItems) {
        const needle = String(ri.name || "").toLowerCase();
        if (!needle || ri.matchType !== "new") continue;
        // Skip non-named-entity candidate types — these don't map to
        // mentions in chapter text.
        if (["relationships", "stats", "lore", "quests", "events"].includes(ri.entityType) && ri.suggestedAction !== "create") continue;
        const ranges = findRanges(text || "", needle);
        if (!ranges.length) continue;
        await OccurrenceService.saveMany(ranges.map((r) => {
          const para = paragraphs ? paragraphs.find((pr) => pr.start <= r.start && pr.end >= r.end) : null;
          return {
            entityId: ri.existingEntityId || null,
            entityType: ri.entityType,
            exactText: text.slice(r.start, r.end),
            chapterId,
            paragraphId: para ? para.id : null,
            startOffset: r.start,
            endOffset: r.end,
            extractionSessionId: sessionId,
            candidateId: ri.candidateId,
          };
        }));
      }
      const session = {
        status: isAborted() ? "cancelled" : "complete",
        chapterId,
        deep,
        sessionId,
        scope,
        itemCount: items.length,
        candidateCount: reviewItems.length,
        occurrenceCount: occurrences.length,
        aiUsed: aiAvailable,
        updatedAt: nowIso(),
      };
      await this.saveSession(session);
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      report(isAborted() ? "cancelled" : "complete", { candidates: reviewItems, candidateCount: reviewItems.length, occurrenceCount: occurrences.length });
      return { session, items, occurrences, candidates: reviewItems, occurrenceCount: occurrences.length, itemCount: items.length };
    },
  };

  const SampleProjectService = {
    async loadSample() {
      const demo = window.WR_DEMO_PROJECT || {};
      // Merge sample entities into the live store rather than replacing —
      // preserves user-created records. User entities win on id conflict.
      const sampleEntities = collectDefaultEntities();
      const existing = await StorageService.get(KEYS.entities, {});
      const merged = { ...existing };
      for (const [type, byId] of Object.entries(sampleEntities)) {
        merged[type] = merged[type] || {};
        for (const [id, sampleRow] of Object.entries(byId || {})) {
          if (!merged[type][id]) merged[type][id] = sampleRow;
        }
      }
      await StorageService.set(KEYS.entities, merged);
      applyEntityGlobals(merged);
      // References: also merge by id, sample-tag each.
      const existingRefs = await StorageService.get(KEYS.references, []);
      const sampleRefs = (window.REFERENCES || []).map((r) => ({
        ...clone(r),
        id: r.id || uuid("ref"),
        source: "sample",
        createdAt: r.createdAt || nowIso(),
        updatedAt: r.updatedAt || nowIso(),
      }));
      const refIndex = new Map(existingRefs.map((r) => [r.id, r]));
      for (const r of sampleRefs) if (!refIndex.has(r.id)) refIndex.set(r.id, r);
      const refs = [...refIndex.values()];
      await StorageService.set(KEYS.references, refs);
      window.REFERENCES = refs;
      if (demo.chapters) {
        await ManuscriptChapterService.save({
          authors: demo.authors || [],
          chapters: demo.chapters,
          activeChapterId: demo.chapters.find((c) => c.active)?.id || demo.chapters[0]?.id,
          manuscripts: demo.manuscripts || {},
          notes: { default: demo.notes || [] },
          extractions: { default: demo.extractions || [] },
        });
      }
      window.PROJECT_INTELLIGENCE = await ProjectIntelService.save(ProjectIntelService.defaultIntel());
      await StorageService.set(KEYS.sampleLoaded, true);
      window.__LW_SAMPLE_LOADED__ = true;
      window.dispatchEvent(new CustomEvent("lw:project-imported", { detail: { sample: true } }));
      // Audit: relatedIds = all sample entity + reference ids so undo
      // can target exactly what we added.
      try {
        const addedIds = [];
        for (const byId of Object.values(sampleEntities)) for (const id of Object.keys(byId || {})) addedIds.push(id);
        for (const r of sampleRefs) addedIds.push(r.id);
        AuditService.log({
          action: "sample.load",
          label: "Loaded sample project",
          targetType: "project",
          targetId: "default",
          targetName: "Sample project",
          source: "SampleProjectService",
          relatedIds: addedIds,
          metadata: { entityCount: addedIds.length },
        });
      } catch (_) {}
      notify("Sample project loaded.");
      return true;
    },
    async clearSample() {
      // Remove only records tagged source === "sample". User-created records
      // are preserved. The destructive full wipe is resetProjectData below.
      const entities = EntityService.listAllSync();
      let removed = 0;
      for (const [type, byId] of Object.entries(entities)) {
        for (const e of Object.values(byId || {})) {
          if (e?.source === "sample") {
            // Hard delete — don't send sample records to trash.
            const all = await StorageService.get(KEYS.entities, {});
            const bucket = { ...(all[type] || {}) };
            delete bucket[e.id];
            await StorageService.set(KEYS.entities, { ...all, [type]: bucket });
            removed++;
          }
        }
      }
      // References tagged as sample.
      const refs = await StorageService.get(KEYS.references, []);
      const refsKept = refs.filter((r) => r?.source !== "sample");
      if (refsKept.length !== refs.length) await StorageService.set(KEYS.references, refsKept);
      // Sample chapters from the manuscript bundle (if any).
      const mcs = ManuscriptChapterService.loadSync();
      const sampleChapterIds = (mcs.chapters || []).filter((c) => c?.source === "sample").map((c) => c.id);
      if (sampleChapterIds.length) {
        const manuscripts = { ...(mcs.manuscripts || {}) };
        for (const cid of sampleChapterIds) delete manuscripts[cid];
        await ManuscriptChapterService.save({
          ...mcs,
          chapters: (mcs.chapters || []).filter((c) => !sampleChapterIds.includes(c.id)),
          manuscripts,
        });
      }
      await StorageService.set(KEYS.sampleLoaded, false);
      window.__LW_SAMPLE_LOADED__ = false;
      applyEntityGlobals();
      window.dispatchEvent(new CustomEvent("lw:project-imported", { detail: { cleared: true, scope: "sample", removed } }));
      try {
        AuditService.log({
          action: "sample.clear",
          label: `Cleared ${removed} sample record(s)`,
          targetType: "project",
          targetId: "default",
          source: "SampleProjectService",
          metadata: { removed },
          reversible: false,
        });
      } catch (_) {}
      notify(`Cleared ${removed} sample record(s); your work is untouched.`);
    },
    async resetProjectData() {
      // Destructive: wipes ALL persistent state. Caller must double-confirm.
      // We log BEFORE we wipe so the event lands in storage; the wipe
      // then erases the log too, but the post-init notify chain keeps
      // the action traceable in console.
      try {
        AuditService.log({
          action: "project.reset",
          label: "Reset ALL local project data",
          targetType: "project",
          targetId: "default",
          source: "SampleProjectService",
          reversible: false,
        });
      } catch (_) {}
      for (const key of Object.values(KEYS)) {
        await StorageService.remove(key);
      }
      clearDemoGlobals();
      window.__LW_SAMPLE_LOADED__ = false;
      await initialise();
      window.dispatchEvent(new CustomEvent("lw:project-imported", { detail: { cleared: true, scope: "all" } }));
      notify("Project data reset.");
    },
  };

  const HandoffService = {
    async savePack(pack) {
      const all = await StorageService.get(KEYS.handoffLog, []);
      const next = [{ id: pack.id || uuid("handoff"), kind: "pack", pack, createdAt: nowIso() }, ...all].slice(0, 50);
      await StorageService.set(KEYS.handoffLog, next);
      return pack;
    },
    async importResult(payload = {}) {
      const result = payload.result || {};
      const all = await StorageService.get(KEYS.handoffLog, []);
      await StorageService.set(KEYS.handoffLog, [{ id: uuid("ai-result"), kind: "result", payload, createdAt: nowIso() }, ...all].slice(0, 50));

      if (payload.mode === "review" || result.suggestedReviewItems?.length) {
        const suggestions = result.suggestedReviewItems || [{ kind: "ai-result", payload: result, reason: "Imported AI result" }];
        await ReviewService.addMany(suggestions.map((item) => ({
          id: uuid("rq"),
          entityType: item.payload?.type || item.kind || "references",
          name: item.payload?.name || item.reason || "AI suggestion",
          action: "AI import",
          level: "ai",
          value: 0,
          reason: item.reason || "Imported from AI handoff",
          payload: item.payload || item,
        })));
      }

      if (payload.mode === "updateEntities" && Array.isArray(result.entityUpdates)) {
        for (const update of result.entityUpdates) {
          if (update.id && update.type) await EntityService.update(update.type, update.id, update.patch || update);
        }
      }

      if (payload.mode === "saveReference") {
        await ReferencesService.save({
          kind: "ai-result",
          title: "AI result · " + nowIso(),
          content: payload.raw || result.prose || JSON.stringify(result, null, 2),
          aiContext: true,
        });
      }

      return payload;
    },
  };

  async function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function pickJsonFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => {
          try { resolve(JSON.parse(String(reader.result || "{}"))); }
          catch (e) { reject(e); }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      };
      input.click();
    });
  }

  // -------------------------------------------------------------------
  // ProjectArchiveService — full-project export, import, preview,
  // backup-before-replace, and entity-library selective export/import.
  // Replaces the earlier exportProject() / importProject() which leaked
  // the encrypted API-key blob on every export and offered no merge
  // mode or backup.
  // -------------------------------------------------------------------
  const PROJECT_SCHEMA = "loomwright-project-v1";
  const LIBRARY_SCHEMA = "loomwright-library-v1";
  const LEGACY_PROJECT_SCHEMAS = new Set([
    "loomwright/project-export/v2",
    "loomwright/project-export/v1",
  ]);

  // Fields that must never appear in an export (encrypted or not).
  const SECRET_FIELDS = new Set(["apiKey", "secret", "token", "password", "bearer", "credential"]);

  function redactSecrets(obj) {
    if (obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(redactSecrets);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_FIELDS.has(k)) out[k] = "[redacted]";
      else out[k] = redactSecrets(v);
    }
    return out;
  }

  const ProjectArchiveService = {
    /**
     * Build a project export payload. Returns the JSON-shaped object
     * (the caller decides whether to download or just inspect it).
     *
     * Options (all default to the safe choice):
     *   includeTrash:       false
     *   includeReviewQueue: true
     *   includeSampleData:  true   — included if `__LW_SAMPLE_LOADED__` is true; pass false to strip sample-tagged records
     *   includeSettings:    true
     *   includeApiSecrets:  false  — v1 always false. The encrypted
     *                                api_keys_encrypted blob is never
     *                                written into the file.
     */
    async buildExport(options = {}) {
      const opts = {
        includeTrash:       options.includeTrash       === true,
        includeReviewQueue: options.includeReviewQueue !== false,
        includeSampleData:  options.includeSampleData  !== false,
        includeSettings:    options.includeSettings    !== false,
        includeApiSecrets:  false, // v1: hard-coded false
      };

      // Entity store — grouped, optionally filtered to non-sample.
      const allEntities = EntityService.listAllSync();
      const entities = {};
      let createdAtBound = null, updatedAtBound = null;
      const countsByType = {};
      for (const [type, byId] of Object.entries(allEntities)) {
        const rows = Object.values(byId || {}).filter((e) => opts.includeSampleData || e?.source !== "sample");
        if (rows.length) {
          entities[type] = rows.map((r) => clone(r));
          countsByType[type] = rows.length;
          for (const r of rows) {
            if (r.createdAt && (!createdAtBound || r.createdAt < createdAtBound)) createdAtBound = r.createdAt;
            if (r.updatedAt && (!updatedAtBound || r.updatedAt > updatedAtBound)) updatedAtBound = r.updatedAt;
          }
        }
      }

      const chapters = await StorageService.get(KEYS.manuscriptChapters, ManuscriptChapterService.defaultState());
      const manuscript = await StorageService.get(KEYS.manuscript, null);
      const composition = await StorageService.get(KEYS.composition, null);
      const projectIntelligence = await StorageService.get(KEYS.projectIntelligence, null);
      const onboardingAnswers = await StorageService.get(KEYS.onboarding, null);
      const occurrences = await StorageService.get(KEYS.occurrences, []);
      const referencesCollection = await StorageService.get(KEYS.references, []);
      const filteredRefs = opts.includeSampleData ? referencesCollection : referencesCollection.filter((r) => r?.source !== "sample");
      const reviewQueueAll = await StorageService.get(KEYS.reviewQueue, []);
      const trashAll = await StorageService.get(KEYS.trash, []);
      const handoffLog = opts.includeReviewQueue ? await StorageService.get(KEYS.handoffLog, []) : [];
      const skillTrees = await StorageService.get(KEYS.skillTrees, SkillTreeService.defaultState());
      const tangle = await StorageService.get(KEYS.tangle, TangleService.defaultState());
      const speedReader = await StorageService.get(KEYS.speedReader, null);
      const extractionSession = await StorageService.get(KEYS.extractionSession, null);

      // Atlas state is derived: locations whose data.placed===true.
      const atlasPlaced = (entities.locations || []).filter((l) => l?.data?.placed === true).map((l) => ({
        id: l.id, name: l.name, coords: l.data?.coords, atlasMap: l.data?.atlasMap, routes: l.data?.routes || [],
      }));

      // Settings — redacted always; the raw blob never leaks.
      const settingsRaw = opts.includeSettings ? await StorageService.get(KEYS.settings, null) : null;
      const settings = settingsRaw ? redactSecrets(settingsRaw) : null;
      const aiProviderSettingsRaw = opts.includeSettings ? await StorageService.get(KEYS.providerSettings, null) : null;
      const aiProviderSettings = aiProviderSettingsRaw ? redactSecrets(aiProviderSettingsRaw) : null;

      const payload = {
        schemaVersion: PROJECT_SCHEMA,
        appName: "loomwright-v2",
        appVersion: "v1",
        exportedAt: nowIso(),
        project: {
          id: "default",
          name: (settingsRaw && (settingsRaw.project?.name || settingsRaw.brandName)) || "Loomwright project",
          createdAt: createdAtBound || nowIso(),
          updatedAt: updatedAtBound || nowIso(),
        },
        options: opts,
        settings,
        aiProviderSettings,
        chapters,
        manuscript,
        entities,
        skillTrees,
        atlas: { placed: atlasPlaced },
        tangle,
        occurrences,
        reviewQueue: opts.includeReviewQueue ? reviewQueueAll : [],
        handoffLog,
        references: filteredRefs,
        onboardingAnswers,
        projectIntelligence,
        composition,
        trash: opts.includeTrash ? trashAll : [],
        speedReader,
        extractionSession,
        metadata: {
          countsByType,
          chapterCount: (chapters?.chapters || []).length,
          occurrenceCount: occurrences.length,
          referenceCount: filteredRefs.length,
          reviewQueueCount: opts.includeReviewQueue ? reviewQueueAll.length : 0,
          trashCount: opts.includeTrash ? trashAll.length : 0,
          includesSampleData: !!opts.includeSampleData,
          includesTrash: opts.includeTrash,
          includesReviewQueue: opts.includeReviewQueue,
          apiKeysIncluded: false,
        },
      };
      return payload;
    },

    /** Build + download a project export. Defaults match buildExport. */
    async downloadProjectExport(options = {}) {
      const payload = await this.buildExport(options);
      const slug = "loomwright-project-export";
      const stamp = (payload.exportedAt || nowIso()).replace(/[:.]/g, "-");
      await downloadJson(`${slug}-${stamp}.json`, payload);
      return payload;
    },

    /** Create a recovery backup before a destructive replace. */
    async createBackupBeforeReplace() {
      const payload = await this.buildExport({
        includeTrash: true,
        includeReviewQueue: true,
        includeSampleData: true,
        includeSettings: true,
      });
      const stamp = (payload.exportedAt || nowIso()).replace(/[:.]/g, "-");
      await downloadJson(`loomwright-backup-${stamp}.json`, payload);
      return payload;
    },

    /** Validate an external payload. Returns {valid, schemaVersion, warnings, counts}. */
    validateExportPayload(payload) {
      const warnings = [];
      if (!payload || typeof payload !== "object") {
        return { valid: false, schemaVersion: "unknown", warnings: ["Payload is not an object."], counts: {} };
      }
      const claimed = payload.schemaVersion || payload.schema || "unknown";
      let schemaVersion = "unknown";
      if (claimed === PROJECT_SCHEMA) schemaVersion = PROJECT_SCHEMA;
      else if (LEGACY_PROJECT_SCHEMAS.has(claimed)) {
        schemaVersion = claimed;
        warnings.push(`Legacy schema (${claimed}). Importing through compatibility shim.`);
      } else {
        warnings.push(`Unknown schema version: ${claimed}. Best-effort import only.`);
      }
      if (payload?.metadata?.apiKeysIncluded) warnings.push("Payload claims to include API keys — refusing to import secrets in v1.");
      if (payload?.metadata?.includesSampleData) warnings.push("Payload includes sample-tagged records.");
      if (payload?.metadata?.includesTrash) warnings.push("Payload includes Trash records.");
      const counts = {
        entities: payload.entities ? Object.values(payload.entities).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0) : 0,
        chapters: payload.chapters?.chapters?.length || 0,
        references: Array.isArray(payload.references) ? payload.references.length : 0,
        occurrences: Array.isArray(payload.occurrences) ? payload.occurrences.length : 0,
        reviewQueue: Array.isArray(payload.reviewQueue) ? payload.reviewQueue.length : 0,
        trash: Array.isArray(payload.trash) ? payload.trash.length : 0,
      };
      const valid = schemaVersion !== "unknown" || !!payload.entities;
      return { valid, schemaVersion, warnings, counts };
    },

    /** Summarise an export payload for the import-preview UI. */
    summarizeExportPayload(payload) {
      const v = this.validateExportPayload(payload);
      return {
        valid: v.valid,
        schemaVersion: v.schemaVersion,
        warnings: v.warnings,
        projectName: payload?.project?.name || "Loomwright project",
        exportedAt: payload?.exportedAt || null,
        counts: v.counts,
        countsByType: payload?.metadata?.countsByType || {},
        includesSettings: !!payload?.settings,
        includesSampleData: !!payload?.metadata?.includesSampleData,
        includesTrash: !!payload?.metadata?.includesTrash,
        includesReviewQueue: !!payload?.metadata?.includesReviewQueue,
        apiKeysIncluded: !!payload?.metadata?.apiKeysIncluded,
      };
    },

    /**
     * Apply an import payload to the current store.
     *
     * mode: "merge" (default) — adds records; existing wins on id
     *                           conflict unless overwriteOnConflict.
     *       "replace"          — wipes current store first. Caller MUST
     *                           have invoked createBackupBeforeReplace
     *                           — this method does NOT make the backup
     *                           itself, to keep the destructive path
     *                           ergonomically explicit.
     */
    async applyImport(payload, opts = {}) {
      const mode = opts.mode === "replace" ? "replace" : "merge";
      const overwrite = mode === "replace" ? true : !!opts.overwriteOnConflict;
      const v = this.validateExportPayload(payload);
      if (!v.valid) throw new Error("Invalid project payload: " + v.warnings.join(" / "));

      if (mode === "replace") {
        await StorageService.clear();
      }

      // Entities — merge by type and id.
      const currentEntities = await StorageService.get(KEYS.entities, {});
      const nextEntities = mode === "replace" ? {} : { ...currentEntities };
      for (const [type, rows] of Object.entries(payload.entities || {})) {
        if (!Array.isArray(rows)) continue;
        nextEntities[type] = nextEntities[type] || {};
        for (const row of rows) {
          if (!row || !row.id) continue;
          const has = nextEntities[type][row.id];
          if (has && !overwrite) continue;
          nextEntities[type][row.id] = clone(row);
        }
      }
      await StorageService.set(KEYS.entities, nextEntities);

      // Chapters — id-based merge.
      const currentChapters = await StorageService.get(KEYS.manuscriptChapters, ManuscriptChapterService.defaultState());
      const incomingChapters = payload.chapters || {};
      if (mode === "replace") {
        await StorageService.set(KEYS.manuscriptChapters, { ...ManuscriptChapterService.defaultState(), ...incomingChapters });
      } else if (incomingChapters && Array.isArray(incomingChapters.chapters)) {
        const chMap = new Map((currentChapters.chapters || []).map((c) => [c.id, c]));
        for (const c of incomingChapters.chapters) {
          if (!c || !c.id) continue;
          if (chMap.has(c.id) && !overwrite) continue;
          chMap.set(c.id, c);
        }
        await StorageService.set(KEYS.manuscriptChapters, {
          ...currentChapters,
          chapters: [...chMap.values()],
          manuscripts: { ...(currentChapters.manuscripts || {}), ...(incomingChapters.manuscripts || {}) },
          activeChapterId: incomingChapters.activeChapterId || currentChapters.activeChapterId,
          authors: incomingChapters.authors?.length ? incomingChapters.authors : currentChapters.authors,
        });
      }

      // References collection — id-based merge.
      const currentRefs = await StorageService.get(KEYS.references, []);
      const incomingRefs = Array.isArray(payload.references) ? payload.references : [];
      if (mode === "replace") {
        await StorageService.set(KEYS.references, incomingRefs);
      } else {
        const refMap = new Map(currentRefs.map((r) => [r.id, r]));
        for (const r of incomingRefs) {
          if (!r || !r.id) continue;
          if (refMap.has(r.id) && !overwrite) continue;
          refMap.set(r.id, r);
        }
        await StorageService.set(KEYS.references, [...refMap.values()]);
      }

      // Occurrences — dedup by (entityId, chapterId, startOffset, endOffset).
      const currentOcc = await StorageService.get(KEYS.occurrences, []);
      const incomingOcc = Array.isArray(payload.occurrences) ? payload.occurrences : [];
      if (mode === "replace") {
        await StorageService.set(KEYS.occurrences, incomingOcc);
      } else {
        const key = (o) => `${o.entityId || ""}|${o.chapterId || ""}|${o.startOffset ?? ""}|${o.endOffset ?? ""}`;
        const seen = new Set(currentOcc.map(key));
        const next = currentOcc.slice();
        for (const o of incomingOcc) {
          if (seen.has(key(o))) continue;
          seen.add(key(o));
          next.push(o);
        }
        await StorageService.set(KEYS.occurrences, next);
      }

      // Review queue — append on merge.
      const currentQueue = await StorageService.get(KEYS.reviewQueue, []);
      const incomingQueue = Array.isArray(payload.reviewQueue) ? payload.reviewQueue : [];
      if (mode === "replace") {
        await StorageService.set(KEYS.reviewQueue, incomingQueue);
      } else if (incomingQueue.length) {
        const seenIds = new Set(currentQueue.map((q) => q.id));
        const next = currentQueue.slice();
        for (const q of incomingQueue) {
          if (q.id && seenIds.has(q.id) && !overwrite) continue;
          next.push(q);
        }
        await StorageService.set(KEYS.reviewQueue, next);
      }

      // Onboarding + Project Intelligence — shallow merge with current
      // winning on conflict on merge mode.
      if (payload.onboardingAnswers) {
        if (mode === "replace") await StorageService.set(KEYS.onboarding, payload.onboardingAnswers);
        else {
          const cur = await StorageService.get(KEYS.onboarding, {});
          await StorageService.set(KEYS.onboarding, { ...(payload.onboardingAnswers || {}), ...(cur || {}) });
        }
      }
      if (payload.projectIntelligence) {
        if (mode === "replace") await StorageService.set(KEYS.projectIntelligence, payload.projectIntelligence);
        else {
          const cur = await StorageService.get(KEYS.projectIntelligence, {});
          await StorageService.set(KEYS.projectIntelligence, { ...(payload.projectIntelligence || {}), ...(cur || {}) });
        }
      }

      // Skill trees — id-based merge.
      if (payload.skillTrees) {
        if (mode === "replace") await StorageService.set(KEYS.skillTrees, payload.skillTrees);
        else {
          const cur = await StorageService.get(KEYS.skillTrees, SkillTreeService.defaultState());
          const map = new Map((cur.trees || []).map((t) => [t.id, t]));
          for (const t of payload.skillTrees.trees || []) {
            if (map.has(t.id) && !overwrite) continue;
            map.set(t.id, t);
          }
          await StorageService.set(KEYS.skillTrees, { ...cur, trees: [...map.values()] });
        }
      }

      // Tangle — id-based merge.
      if (payload.tangle) {
        if (mode === "replace") await StorageService.set(KEYS.tangle, payload.tangle);
        else {
          const cur = await StorageService.get(KEYS.tangle, TangleService.defaultState());
          const nodeMap = new Map((cur.nodes || []).map((n) => [n.id, n]));
          for (const n of (payload.tangle.nodes || [])) {
            if (nodeMap.has(n.id) && !overwrite) continue;
            nodeMap.set(n.id, n);
          }
          const groupMap = new Map((cur.groups || []).map((g) => [g.id, g]));
          for (const g of (payload.tangle.groups || [])) {
            if (groupMap.has(g.id) && !overwrite) continue;
            groupMap.set(g.id, g);
          }
          await StorageService.set(KEYS.tangle, { ...cur, nodes: [...nodeMap.values()], groups: [...groupMap.values()] });
        }
      }

      // Composition — overwrite-on-replace, leave-current-on-merge.
      if (payload.composition && mode === "replace") {
        await StorageService.set(KEYS.composition, payload.composition);
      }

      // Settings — overwrite on replace; never overwrite on merge to
      // protect the user's local provider config.
      if (payload.settings && mode === "replace") {
        await StorageService.set(KEYS.settings, payload.settings);
      }
      if (payload.aiProviderSettings && mode === "replace") {
        await StorageService.set(KEYS.providerSettings, payload.aiProviderSettings);
      }

      // Trash — append-only on merge; replace on replace.
      if (payload.trash) {
        if (mode === "replace") await StorageService.set(KEYS.trash, payload.trash);
        else {
          const cur = await StorageService.get(KEYS.trash, []);
          await StorageService.set(KEYS.trash, [...cur, ...payload.trash]);
        }
      }

      applyEntityGlobals();
      window.dispatchEvent(new CustomEvent("lw:project-imported", {
        detail: { mode, schemaVersion: v.schemaVersion, counts: v.counts },
      }));
      return { mode, applied: true, counts: v.counts };
    },

    /**
     * Entity library — selective export of a subset of entity types
     * (plus optional references / occurrences) so the user can move a
     * reusable set between projects.
     */
    async buildEntityLibrary(options = {}) {
      const types = Array.isArray(options.types) && options.types.length
        ? options.types
        : ["cast", "items", "locations", "quests", "events", "stats", "bestiary", "skills", "classes", "races", "factions", "lore", "relationships", "timeline"];
      const includeReferences  = options.includeReferences  !== false;
      const includeOccurrences = options.includeOccurrences !== false;
      const includeSampleData  = options.includeSampleData  === true;
      const allEntities = EntityService.listAllSync();
      const entities = {};
      const countsByType = {};
      for (const type of types) {
        const rows = Object.values(allEntities[type] || {}).filter((e) => includeSampleData || e?.source !== "sample");
        if (rows.length) {
          entities[type] = rows.map(clone);
          countsByType[type] = rows.length;
        }
      }
      const refsAll = await StorageService.get(KEYS.references, []);
      const occAll = await StorageService.get(KEYS.occurrences, []);
      const includedEntityIds = new Set();
      for (const rows of Object.values(entities)) for (const r of rows) includedEntityIds.add(r.id);
      return {
        schemaVersion: LIBRARY_SCHEMA,
        exportedAt: nowIso(),
        types,
        entities,
        references: includeReferences ? refsAll.filter((r) => includeSampleData || r?.source !== "sample") : [],
        occurrences: includeOccurrences ? occAll.filter((o) => includedEntityIds.has(o.entityId)) : [],
        metadata: { countsByType, includesSampleData: !!includeSampleData },
      };
    },

    async downloadEntityLibrary(options = {}) {
      const payload = await this.buildEntityLibrary(options);
      const stamp = (payload.exportedAt || nowIso()).replace(/[:.]/g, "-");
      await downloadJson(`loomwright-library-${stamp}.json`, payload);
      return payload;
    },

    /** Apply an entity-library payload. Merge-only by default. */
    async applyEntityLibrary(payload, opts = {}) {
      if (!payload || payload.schemaVersion !== LIBRARY_SCHEMA) {
        throw new Error("Not a Loomwright entity library payload.");
      }
      const overwrite = !!opts.overwriteOnConflict;
      const includeSampleData = !!opts.includeSampleData;
      const all = await StorageService.get(KEYS.entities, {});
      for (const [type, rows] of Object.entries(payload.entities || {})) {
        all[type] = all[type] || {};
        for (const row of rows) {
          if (!row?.id) continue;
          if (!includeSampleData && row.source === "sample") continue;
          if (all[type][row.id] && !overwrite) continue;
          all[type][row.id] = clone(row);
        }
      }
      await StorageService.set(KEYS.entities, all);
      // References from the library — merge by id.
      if (Array.isArray(payload.references) && payload.references.length) {
        const cur = await StorageService.get(KEYS.references, []);
        const map = new Map(cur.map((r) => [r.id, r]));
        for (const r of payload.references) {
          if (!r?.id) continue;
          if (!includeSampleData && r.source === "sample") continue;
          if (map.has(r.id) && !overwrite) continue;
          map.set(r.id, r);
        }
        await StorageService.set(KEYS.references, [...map.values()]);
      }
      // Occurrences — dedup by composite key.
      if (Array.isArray(payload.occurrences) && payload.occurrences.length) {
        const cur = await StorageService.get(KEYS.occurrences, []);
        const key = (o) => `${o.entityId || ""}|${o.chapterId || ""}|${o.startOffset ?? ""}|${o.endOffset ?? ""}`;
        const seen = new Set(cur.map(key));
        const next = cur.slice();
        for (const o of payload.occurrences) {
          if (seen.has(key(o))) continue;
          seen.add(key(o));
          next.push(o);
        }
        await StorageService.set(KEYS.occurrences, next);
      }
      applyEntityGlobals();
      window.dispatchEvent(new CustomEvent("lw:project-imported", { detail: { mode: "library", schemaVersion: LIBRARY_SCHEMA } }));
      return { applied: true, types: payload.types || [], counts: payload.metadata?.countsByType || {} };
    },
  };

  // Back-compat thin wrappers for the older function names callers
  // (registry delegate listeners, callback registry) still reference.
  async function exportProject(options) {
    return ProjectArchiveService.downloadProjectExport(options);
  }

  async function importProject(data) {
    if (!data) data = await pickJsonFile();
    if (!data) return null;
    // Heuristic: library payloads have schemaVersion = LIBRARY_SCHEMA.
    if (data.schemaVersion === LIBRARY_SCHEMA) {
      return ProjectArchiveService.applyEntityLibrary(data, { overwriteOnConflict: false });
    }
    return ProjectArchiveService.applyImport(data, { mode: "merge" });
  }

  function notify(message) {
    try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_) {}
    // eslint-disable-next-line no-console
    console.info("[Loomwright]", message);
  }

  // -------------------------------------------------------------------
  // SearchService — local global index across entities, chapters,
  // references, review queue, project intelligence, onboarding,
  // safe settings sections, occurrences, and (opt-in) trash.
  //
  // Privacy: API keys and the encrypted keys blob are never read or
  // indexed. Settings fields whose key matches SECRET_FIELDS are
  // skipped at index time.
  // -------------------------------------------------------------------
  const SR_STOPWORDS = new Set([
    "the", "a", "an", "of", "and", "to", "in", "on", "is", "it",
    "for", "with", "by", "at", "as", "or", "but", "this", "that",
  ]);
  const SAFE_SETTINGS_SECTIONS = new Set([
    "general", "editor", "extraction", "aiProviders",
    "manuscript", "privacy", "appearance", "speedReader",
  ]);

  function srTokens(input) {
    if (input == null) return [];
    const text = (typeof input === "string" ? input : JSON.stringify(input)).toLowerCase();
    const raw = text.replace(/[^a-z0-9'\-]+/g, " ").split(/\s+/).filter(Boolean);
    return raw.filter((t) => t.length > 1 && !SR_STOPWORDS.has(t));
  }
  function srNormalise(s) {
    return (s || "").toString().trim().toLowerCase();
  }
  function srStripHtml(html) {
    return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  function srSnippet(text, query, around = 60) {
    if (!text || !query) return "";
    const ix = text.toLowerCase().indexOf(query.toLowerCase());
    if (ix < 0) return text.slice(0, around * 2);
    const start = Math.max(0, ix - around);
    const end = Math.min(text.length, ix + query.length + around);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  }

  const SearchService = {
    defaultState() {
      return { entries: [], builtAt: null };
    },
    loadSync() {
      const raw = StorageService.getSync(KEYS.searchIndex, null);
      if (!raw || !Array.isArray(raw.entries)) return this.defaultState();
      return raw;
    },
    saveCacheSync(entries) {
      // best-effort persistence; do not await
      StorageService.set(KEYS.searchIndex, { entries, builtAt: nowIso() }).catch(() => {});
    },
    getIndexStatsSync() {
      const state = this.loadSync();
      const byType = {};
      for (const e of state.entries) byType[e.type] = (byType[e.type] || 0) + 1;
      return { total: state.entries.length, byType, builtAt: state.builtAt };
    },
    async clearIndex() {
      await StorageService.set(KEYS.searchIndex, this.defaultState());
    },

    // --------- Index builders (sync, defensive) ---------
    buildEntityEntries() {
      const out = [];
      const all = EntityService.listAllSync();
      for (const [entityType, byId] of Object.entries(all || {})) {
        for (const e of Object.values(byId || {})) {
          if (!e?.id || e.status === "deleted") continue;
          const data = e.data || {};
          const summary = data.summary || data.description || data.brief || "";
          const aliases = Array.isArray(data.aliases) ? data.aliases : [];
          const tags = Array.isArray(data.tags) ? data.tags : [];
          const body = [
            summary,
            data.background, data.details, data.notes, data.bio,
            data.role, data.flavor, data.flavour,
            Array.isArray(data.traits) ? data.traits.join(" ") : "",
            Array.isArray(data.abilities) ? data.abilities.map((a) => a?.name || a).join(" ") : "",
            Array.isArray(data.sourceMentions) ? data.sourceMentions.map((m) => m?.quote || m).join(" ") : "",
          ].filter(Boolean).join(" ");
          out.push({
            id: "ent:" + entityType + ":" + e.id,
            type: "entity",
            subtype: entityType,
            title: e.name || data.title || "(unnamed)",
            subtitle: entityType.charAt(0).toUpperCase() + entityType.slice(1),
            summary: summary.slice(0, 240),
            body,
            tokens: srTokens([e.name, summary, body, aliases.join(" "), tags.join(" ")].join(" ")),
            aliases,
            tags,
            entityType, entityId: e.id,
            icon: "stack",
            updatedAt: e.updatedAt || e.createdAt || null,
            source: e.source || null,
          });
        }
      }
      return out;
    },
    buildChapterEntries() {
      const state = ManuscriptChapterService.loadSync();
      const out = [];
      for (const c of state.chapters || []) {
        const bodyText = c.bodyText || srStripHtml(c.bodyHtml) || "";
        out.push({
          id: "chap:" + c.id,
          type: "chapter",
          subtype: "manuscript",
          title: c.title || ("Chapter " + (c.slotNumber || "")),
          subtitle: "Chapter" + (c.slotNumber ? " " + c.slotNumber : ""),
          summary: bodyText.slice(0, 240),
          body: bodyText,
          tokens: srTokens([c.title, bodyText].join(" ")),
          tags: [],
          chapterId: c.id,
          icon: "book",
          updatedAt: c.updatedAt || c.createdAt || null,
        });
      }
      return out;
    },
    buildReferenceEntries() {
      const refs = StorageService.getSync(KEYS.references, []) || [];
      const out = [];
      for (const r of refs) {
        if (!r?.id) continue;
        const content = r.content || r.body || r.summary || r.notes || "";
        out.push({
          id: "ref:" + r.id,
          type: "reference",
          subtype: r.kind || r.type || "reference",
          title: r.title || r.label || "(untitled reference)",
          subtitle: (r.kind ? r.kind + " · " : "") + "Reference",
          summary: (r.summary || content || "").slice(0, 240),
          body: content,
          tokens: srTokens([r.title, r.summary, content, (r.tags || []).join(" "), r.url].join(" ")),
          tags: Array.isArray(r.tags) ? r.tags : [],
          referenceId: r.id,
          icon: "paper",
          updatedAt: r.updatedAt || r.createdAt || null,
          source: r.source || null,
        });
      }
      return out;
    },
    buildReviewQueueEntries() {
      const items = StorageService.getSync(KEYS.reviewQueue, []) || [];
      const out = [];
      for (const it of items) {
        if (!it?.id) continue;
        const p = it.payload || {};
        const sourceQuote = p.sourceQuote || it.sourceQuote || "";
        out.push({
          id: "rev:" + it.id,
          type: "review",
          subtype: it.entityType || it.kind || "review",
          title: p.name || it.name || it.title || "(review item)",
          subtitle: "Review · " + (it.entityType || "candidate"),
          summary: sourceQuote.slice(0, 240),
          body: [p.summary, sourceQuote, JSON.stringify(p.suggestedChanges || {})].filter(Boolean).join(" "),
          tokens: srTokens([p.name, p.summary, sourceQuote].join(" ")),
          tags: [],
          reviewItemId: it.id,
          entityType: it.entityType || null,
          entityId: it.entityId || null,
          icon: "bell",
          updatedAt: it.updatedAt || it.createdAt || null,
        });
      }
      return out;
    },
    buildProjectIntelEntries() {
      const intel = ProjectIntelService.loadSync() || {};
      const out = [];
      for (const [sectionId, value] of Object.entries(intel)) {
        if (sectionId === "updatedAt" || value == null) continue;
        const text = typeof value === "string" ? value : JSON.stringify(value);
        if (!text || text.length < 2) continue;
        out.push({
          id: "intel:" + sectionId,
          type: "projectIntelligence",
          subtype: sectionId,
          title: sectionId.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
          subtitle: "Project Intelligence",
          summary: text.slice(0, 240),
          body: text,
          tokens: srTokens(text),
          tags: [],
          projectIntelSectionId: sectionId,
          icon: "compass",
          updatedAt: intel.updatedAt || null,
        });
      }
      return out;
    },
    buildOnboardingEntries() {
      const ans = OnboardingService.loadSync() || {};
      const out = [];
      for (const [sectionId, value] of Object.entries(ans)) {
        if (sectionId === "updatedAt" || sectionId === "status" || value == null) continue;
        const text = typeof value === "string" ? value : JSON.stringify(value);
        if (!text || text.length < 2) continue;
        out.push({
          id: "onb:" + sectionId,
          type: "onboarding",
          subtype: sectionId,
          title: sectionId.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
          subtitle: "Onboarding",
          summary: text.slice(0, 240),
          body: text,
          tokens: srTokens(text),
          tags: [],
          onboardingSectionId: sectionId,
          icon: "compass",
          updatedAt: ans.updatedAt || null,
        });
      }
      return out;
    },
    buildSettingsEntries() {
      const all = SettingsService.getAllSync() || {};
      const out = [];
      for (const [sectionId, section] of Object.entries(all)) {
        if (!SAFE_SETTINGS_SECTIONS.has(sectionId)) continue;
        if (!section || typeof section !== "object") continue;
        // Build a redacted text body — strip any SECRET_FIELDS-named key.
        const safeText = (function walk(obj) {
          if (obj == null) return "";
          if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return String(obj);
          if (Array.isArray(obj)) return obj.map(walk).join(" ");
          const parts = [];
          for (const [k, v] of Object.entries(obj)) {
            if (SECRET_FIELDS.has(k)) continue;
            parts.push(k + " " + walk(v));
          }
          return parts.join(" ");
        })(section);
        out.push({
          id: "set:" + sectionId,
          type: "setting",
          subtype: sectionId,
          title: sectionId.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
          subtitle: "Settings",
          summary: safeText.slice(0, 240),
          body: safeText,
          tokens: srTokens(sectionId + " " + safeText),
          tags: [],
          settingsSectionId: sectionId,
          icon: "gear",
          updatedAt: null,
        });
      }
      return out;
    },
    buildOccurrenceEntries() {
      const occs = (typeof OccurrenceService !== "undefined") ? (OccurrenceService.listAllSync?.() || []) : [];
      const out = [];
      for (const o of occs) {
        if (!o?.id) continue;
        out.push({
          id: "occ:" + o.id,
          type: "occurrence",
          subtype: o.entityType || "occurrence",
          title: o.exactText || "(occurrence)",
          subtitle: "Mention",
          summary: o.exactText || "",
          body: o.exactText || "",
          tokens: srTokens(o.exactText || ""),
          tags: [],
          occurrenceId: o.id,
          entityId: o.entityId || null,
          entityType: o.entityType || null,
          chapterId: o.chapterId || null,
          icon: "mention",
          updatedAt: o.updatedAt || o.createdAt || null,
        });
      }
      return out;
    },
    buildTrashEntries() {
      const items = TrashService.listSync() || [];
      const out = [];
      for (const t of items) {
        if (!t?.id) continue;
        out.push({
          id: "trash:" + t.id,
          type: "trash",
          subtype: t.type || "entity",
          title: t.name || "(deleted)",
          subtitle: "Trash · " + (t.type || ""),
          summary: t.data?.summary || "",
          body: [t.name, t.data?.summary, JSON.stringify(t.data || {})].filter(Boolean).join(" "),
          tokens: srTokens([t.name, t.data?.summary].join(" ")),
          tags: [],
          entityType: t.type || null,
          entityId: t.id || null,
          icon: "trash",
          updatedAt: t.deletedAt || null,
        });
      }
      return out;
    },

    rebuildIndex(options = {}) {
      const includeTrash = options.includeTrash === true;
      const entries = [].concat(
        this.buildEntityEntries(),
        this.buildChapterEntries(),
        this.buildReferenceEntries(),
        this.buildReviewQueueEntries(),
        this.buildProjectIntelEntries(),
        this.buildOnboardingEntries(),
        this.buildSettingsEntries(),
        this.buildOccurrenceEntries(),
        includeTrash ? this.buildTrashEntries() : [],
      );
      this.saveCacheSync(entries);
      window.dispatchEvent(new CustomEvent("lw:search-index-updated", { detail: { total: entries.length } }));
      return entries;
    },

    _rebuildTimer: null,
    rebuildIndexAsync(options = {}) {
      if (this._rebuildTimer) clearTimeout(this._rebuildTimer);
      this._rebuildTimer = setTimeout(() => {
        try { this.rebuildIndex(options); } catch (err) { console.warn("[SearchService] rebuild failed", err); }
      }, 150);
    },

    // ----- Ranking + search -----
    _score(entry, queryRaw, opts) {
      const q = srNormalise(queryRaw);
      if (!q) return 0;
      const title = srNormalise(entry.title);
      const subtitle = srNormalise(entry.subtitle || "");
      const body = srNormalise(entry.body || "");
      let score = 0;
      let reason = null;

      if (title === q) { score += 100; reason = reason || "title exact"; }
      for (const a of (entry.aliases || [])) {
        if (srNormalise(a) === q) { score += 90; reason = reason || "alias exact"; break; }
      }
      if (!reason && title.startsWith(q)) { score += 70; reason = "title prefix"; }
      if (title.includes(q)) score += (reason ? 0 : 60);
      if (!reason && title.includes(q)) reason = "title contains";

      for (const t of (entry.tags || [])) {
        if (srNormalise(t) === q) { score += 55; reason = reason || "tag exact"; break; }
      }

      if (body.includes(q)) { score += 40; reason = reason || "body phrase"; }
      if (subtitle.includes(q)) { score += 15; reason = reason || "subtitle"; }

      // Token overlap (capped at +25).
      const qTokens = srTokens(q);
      if (qTokens.length) {
        const set = new Set(entry.tokens || []);
        let overlap = 0;
        for (const t of qTokens) if (set.has(t)) overlap += 1;
        if (overlap) {
          score += Math.min(25, overlap * 5);
          reason = reason || ("token overlap (" + overlap + "/" + qTokens.length + ")");
        }
      }

      // Boosts
      if (opts.activeChapterId && entry.chapterId === opts.activeChapterId) score += 10;
      if (entry.updatedAt) {
        const ms = Date.now() - new Date(entry.updatedAt).getTime();
        if (Number.isFinite(ms) && ms < 24 * 3600 * 1000) score += 5;
      }
      if (entry.type === "review" && opts.includeReviewQueue !== false) score += 5;

      return reason ? { score, reason } : 0;
    },
    search(queryRaw, options = {}) {
      const q = (queryRaw || "").trim();
      const opts = {
        types: options.types || null,
        entityTypes: options.entityTypes || null,
        includeTrash: options.includeTrash === true,
        includeReviewQueue: options.includeReviewQueue !== false,
        includeSettings: options.includeSettings !== false,
        limit: options.limit || 25,
        sort: options.sort || "score",
        activeChapterId: options.activeChapterId || null,
      };

      const state = this.loadSync();
      let entries = state.entries.slice();

      // Type filters
      if (opts.types) entries = entries.filter((e) => opts.types.includes(e.type));
      if (opts.entityTypes) entries = entries.filter((e) => e.type !== "entity" || opts.entityTypes.includes(e.subtype));
      if (!opts.includeTrash) entries = entries.filter((e) => e.type !== "trash");
      if (!opts.includeReviewQueue) entries = entries.filter((e) => e.type !== "review");
      if (!opts.includeSettings) entries = entries.filter((e) => e.type !== "setting");

      // Short query: return recent/favourites.
      if (q.length < 2) {
        return entries
          .filter((e) => e.updatedAt)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, opts.limit)
          .map((e) => ({ ...e, score: 0, matchReason: "recent", highlights: [] }));
      }

      // Stop-word-only query — return nothing rather than flood with body matches.
      const qWords = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (qWords.length && qWords.every((w) => SR_STOPWORDS.has(w))) {
        return [];
      }

      const ranked = [];
      for (const e of entries) {
        const r = this._score(e, q, opts);
        if (!r || r.score <= 0) continue;
        ranked.push({
          ...e,
          score: r.score,
          matchReason: r.reason,
          highlights: e.body ? [{ field: "body", snippet: srSnippet(e.body, q) }] : [],
        });
      }
      ranked.sort((a, b) => b.score - a.score);
      return ranked.slice(0, opts.limit);
    },
    searchSync(q, opts) { return this.search(q, opts); },
  };

  // -------------------------------------------------------------------
  // AuditService — persistent log of meaningful local mutations, with
  // bounded undo for safe actions. Anti-recursion: callers of undo set
  // {skipAudit:true} when invoking underlying services so the undo
  // itself emits only one `audit.undo` event.
  //
  // Privacy: every `before` / `after` snapshot passes through
  // redactSecrets. The encrypted KEYS.apiKeys blob is never the target
  // of any logged mutation.
  // -------------------------------------------------------------------
  const AUDIT_REVERSIBLE = new Set([
    "entity.create", "entity.update", "entity.delete",
    "chapter.create", "chapter.save", "chapter.delete",
    "reference.create", "reference.update", "reference.delete",
    "onboarding.update", "intel.update",
    "settings.section-update",
    "review.accept", "review.deny",
    "sample.load",
  ]);
  const AUDIT_MAX_BODY_PREVIEW = 240;

  function _auditSummariseChapter(c) {
    if (!c) return null;
    const txt = c.bodyText || (c.bodyHtml || "").replace(/<[^>]+>/g, "");
    return {
      id: c.id,
      title: c.title,
      slotNumber: c.slotNumber,
      bodyTextPreview: (txt || "").slice(0, AUDIT_MAX_BODY_PREVIEW),
      bodyTextLength: (txt || "").length,
      bodyText: c.bodyText,
      bodyHtml: c.bodyHtml,
      activeChapterId: c.activeChapterId,
    };
  }

  const AuditService = {
    defaultState() {
      return { events: [], updatedAt: null };
    },
    loadSync() {
      const raw = StorageService.getSync(KEYS.auditLog, null);
      if (!raw || !Array.isArray(raw.events)) return this.defaultState();
      return raw;
    },
    async save(state) {
      const next = { ...this.loadSync(), ...state, updatedAt: nowIso() };
      await StorageService.set(KEYS.auditLog, next);
      return next;
    },
    /**
     * Append an audit event. Returns the persisted event.
     * Caller passes redactable `before` / `after` — this method runs
     * them through redactSecrets defensively.
     */
    async log(event = {}) {
      const id = event.id || uuid("aud");
      const action = event.action || "unknown";
      const reversible = event.reversible !== undefined
        ? !!event.reversible
        : AUDIT_REVERSIBLE.has(action);
      const entry = {
        id,
        projectId: event.projectId || "default",
        action,
        label: event.label || action,
        targetType: event.targetType || null,
        targetId: event.targetId || null,
        targetName: event.targetName || null,
        entityType: event.entityType || null,
        before: event.before !== undefined ? redactSecrets(event.before) : null,
        after: event.after !== undefined ? redactSecrets(event.after) : null,
        patch: event.patch !== undefined ? redactSecrets(event.patch) : null,
        source: event.source || null,
        sourceSurface: event.sourceSurface || null,
        reversible,
        undoType: event.undoType || (reversible ? "restore-snapshot" : null),
        relatedIds: Array.isArray(event.relatedIds) ? event.relatedIds : [],
        metadata: event.metadata ? redactSecrets(event.metadata) : null,
        undone: false,
        undoneAt: null,
        undoneByEventId: null,
        createdAt: event.createdAt || nowIso(),
      };
      const state = this.loadSync();
      const events = [entry, ...(state.events || [])].slice(0, 500); // cap log size
      await this.save({ events });
      window.dispatchEvent(new CustomEvent("lw:audit-log-updated", { detail: { event: entry } }));
      return entry;
    },
    listSync(options = {}) {
      const events = this.loadSync().events || [];
      let out = events;
      if (options.action) out = out.filter((e) => e.action === options.action);
      if (options.targetType) out = out.filter((e) => e.targetType === options.targetType);
      if (options.includeUndone === false) out = out.filter((e) => !e.undone);
      const limit = options.limit || out.length;
      return out.slice(0, limit);
    },
    getSync(id) {
      return (this.loadSync().events || []).find((e) => e.id === id) || null;
    },
    getRecentSync(limit = 10) {
      return this.listSync({ limit });
    },
    listByTargetSync(targetType, targetId) {
      return this.listSync().filter((e) => e.targetType === targetType && e.targetId === targetId);
    },
    canUndo(eventId) {
      const e = this.getSync(eventId);
      if (!e) return false;
      if (e.undone) return false;
      if (e.action === "audit.undo") return false;
      if (!e.reversible) return false;
      return AUDIT_REVERSIBLE.has(e.action);
    },
    async markUndone(eventId, undoEventId) {
      const state = this.loadSync();
      const events = (state.events || []).map((e) =>
        e.id === eventId ? { ...e, undone: true, undoneAt: nowIso(), undoneByEventId: undoEventId } : e
      );
      await this.save({ events });
    },
    async undo(eventId) {
      const evt = this.getSync(eventId);
      if (!this.canUndo(eventId)) {
        throw new Error("Event is not reversible: " + eventId);
      }
      // Dispatch reversal based on action.
      let undoLabel = "Undone " + (evt.label || evt.action);
      try {
        switch (evt.action) {
          case "entity.create": {
            if (evt.entityType && evt.targetId) {
              await EntityService.delete(evt.entityType, evt.targetId, { skipAudit: true });
            }
            break;
          }
          case "entity.update": {
            if (evt.entityType && evt.targetId && evt.before) {
              await EntityService.save(evt.entityType, evt.before, { skipAudit: true });
            }
            break;
          }
          case "entity.delete": {
            if (evt.before) {
              await EntityService.save(evt.entityType || evt.before.type, { ...evt.before, status: "active" }, { skipAudit: true });
              // Also purge from trash.
              await TrashService.purge(evt.targetId).catch(() => {});
            }
            break;
          }
          case "chapter.create": {
            if (evt.targetId) {
              const state = ManuscriptChapterService.loadSync();
              await ManuscriptChapterService.save({
                ...state,
                chapters: (state.chapters || []).filter((c) => c.id !== evt.targetId),
                manuscripts: Object.fromEntries(Object.entries(state.manuscripts || {}).filter(([k]) => k !== evt.targetId)),
              }, { skipAudit: true });
            }
            break;
          }
          case "chapter.save": {
            if (evt.before && evt.targetId) {
              const state = ManuscriptChapterService.loadSync();
              const chapters = (state.chapters || []).map((c) =>
                c.id === evt.targetId ? { ...c, ...evt.before, id: evt.targetId } : c
              );
              await ManuscriptChapterService.save({
                ...state,
                chapters,
                manuscripts: { ...(state.manuscripts || {}), [evt.targetId]: { html: evt.before.bodyHtml || "", text: evt.before.bodyText || "" } },
              }, { skipAudit: true });
            }
            break;
          }
          case "chapter.delete": {
            if (evt.before) {
              const state = ManuscriptChapterService.loadSync();
              await ManuscriptChapterService.save({
                ...state,
                chapters: [...(state.chapters || []), evt.before],
                manuscripts: { ...(state.manuscripts || {}), [evt.before.id]: { html: evt.before.bodyHtml || "", text: evt.before.bodyText || "" } },
              }, { skipAudit: true });
            }
            break;
          }
          case "reference.create": {
            if (evt.targetId) {
              const refs = StorageService.getSync(KEYS.references, []);
              await StorageService.set(KEYS.references, refs.filter((r) => r.id !== evt.targetId));
            }
            break;
          }
          case "reference.update":
          case "reference.delete": {
            if (evt.before) {
              const refs = StorageService.getSync(KEYS.references, []);
              const next = refs.filter((r) => r.id !== evt.before.id).concat([evt.before]);
              await StorageService.set(KEYS.references, next);
            }
            break;
          }
          case "onboarding.update": {
            if (evt.before) await StorageService.set(KEYS.onboarding, evt.before);
            break;
          }
          case "intel.update": {
            if (evt.before) await StorageService.set(KEYS.projectIntelligence, evt.before);
            break;
          }
          case "settings.section-update": {
            if (evt.before && evt.metadata?.sectionId) {
              const all = SettingsService.getAllSync();
              await SettingsService.saveSection(evt.metadata.sectionId, evt.before, { skipAudit: true });
            }
            break;
          }
          case "review.accept":
          case "review.deny": {
            // Reopen the review item by setting status back to pending.
            if (evt.targetId) {
              const items = StorageService.getSync(KEYS.reviewQueue, []);
              const next = items.map((it) => it.id === evt.targetId ? { ...it, status: "pending", resolvedAt: null } : it);
              await StorageService.set(KEYS.reviewQueue, next);
              window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
            }
            // For review.accept that created an entity, also delete it.
            if (evt.action === "review.accept" && evt.metadata?.createdEntityId && evt.metadata?.createdEntityType) {
              await EntityService.delete(evt.metadata.createdEntityType, evt.metadata.createdEntityId, { skipAudit: true }).catch(() => {});
            }
            break;
          }
          case "sample.load": {
            // Remove records tagged source:"sample" added by this event.
            const ids = new Set(evt.relatedIds || []);
            if (ids.size) {
              const all = await StorageService.get(KEYS.entities, {});
              for (const [type, byId] of Object.entries(all)) {
                for (const id of Object.keys(byId || {})) {
                  if (ids.has(id)) delete all[type][id];
                }
              }
              await StorageService.set(KEYS.entities, all);
              applyEntityGlobals();
            }
            // Also clear sample-tagged refs.
            const refs = StorageService.getSync(KEYS.references, []);
            await StorageService.set(KEYS.references, refs.filter((r) => !ids.has(r.id)));
            break;
          }
          default: {
            throw new Error("No undo handler for action: " + evt.action);
          }
        }
      } catch (err) {
        throw new Error("Undo failed: " + (err.message || err));
      }
      // Log the undo as its own event and mark the original.
      const undoEvent = await this.log({
        action: "audit.undo",
        label: "Undid: " + (evt.label || evt.action),
        targetType: evt.targetType,
        targetId: evt.targetId,
        targetName: evt.targetName,
        entityType: evt.entityType,
        source: "AuditService",
        sourceSurface: "home",
        reversible: false,
        undoType: null,
        relatedIds: [evt.id],
        metadata: { undidAction: evt.action },
      });
      await this.markUndone(evt.id, undoEvent.id);
      window.dispatchEvent(new CustomEvent("lw:audit-undo-applied", { detail: { originalEventId: evt.id, undoEventId: undoEvent.id } }));
      return { ok: true, undoEvent };
    },
    async clear() {
      await StorageService.set(KEYS.auditLog, this.defaultState());
      window.dispatchEvent(new CustomEvent("lw:audit-log-cleared"));
    },
    exportSync() {
      const state = this.loadSync();
      return {
        schemaVersion: "loomwright-audit-v1",
        exportedAt: nowIso(),
        events: state.events,
      };
    },
  };

  function installDelegates() {
    if (window.__LW_BACKEND_DELEGATES__) return;
    window.__LW_BACKEND_DELEGATES__ = true;

    window.addEventListener("lw:ai-handoff-copy-json", (e) => HandoffService.savePack(e.detail?.pack));
    window.addEventListener("lw:ai-handoff-copy-prompt", (e) => HandoffService.savePack(e.detail?.pack));
    window.addEventListener("lw:ai-handoff-download", (e) => HandoffService.savePack(e.detail?.pack));
    window.addEventListener("lw:ai-handoff-save", (e) => HandoffService.savePack(e.detail?.pack));
    window.addEventListener("lw:ai-handoff-import", (e) => HandoffService.importResult(e.detail));
    window.addEventListener("lw:ai-handoff-save-reference", (e) => HandoffService.importResult({ ...(e.detail || {}), mode: "saveReference" }));
    window.addEventListener("lw:ai-handoff-create-review-items", (e) => HandoffService.importResult({ ...(e.detail || {}), mode: "review" }));
    window.addEventListener("lw:ai-handoff-update-entities", (e) => HandoffService.importResult({ ...(e.detail || {}), mode: "updateEntities" }));

    window.addEventListener("lw:settings-update", (e) => {
      const d = e.detail || {};
      if (!d.section) return;
      const current = SettingsService.getSectionSync(d.section, {});
      SettingsService.saveSection(d.section, { ...current, [d.key]: d.value });
    });

    // Keep search index fresh after relevant store mutations. Each
    // listener is fire-and-forget; rebuildIndexAsync debounces ~150 ms.
    const refreshIndex = () => SearchService.rebuildIndexAsync();
    window.addEventListener("lw:entity-store-updated",        refreshIndex);
    window.addEventListener("lw:manuscript-chapters-updated", refreshIndex);
    window.addEventListener("lw:references-updated",          refreshIndex);
    window.addEventListener("lw:review-queue-updated",        refreshIndex);
    window.addEventListener("lw:project-intel-updated",       refreshIndex);
    window.addEventListener("lw:onboarding-updated",          refreshIndex);
    window.addEventListener("lw:settings-updated",            refreshIndex);
    window.addEventListener("lw:project-imported",            refreshIndex);
    window.addEventListener("lw:tangle-updated",              refreshIndex);
    window.addEventListener("lw:occurrence-store-updated",    refreshIndex);
    window.addEventListener("lw:sample-cleared",              refreshIndex);
    window.addEventListener("lw:sample-loaded",               refreshIndex);

    document.addEventListener("click", async (e) => {
      const el = e.target.closest && e.target.closest("[data-callback]");
      if (!el) return;
      const cb = el.getAttribute("data-callback");
      try {
        if (cb === "onExportProjectData" || cb === "onDownloadProjectExport") {
          e.preventDefault();
          await ProjectArchiveService.downloadProjectExport();
          notify("Project export downloaded.");
        }
        if (cb === "onBackupNow" || cb === "onCreateProjectBackup") {
          e.preventDefault();
          await ProjectArchiveService.createBackupBeforeReplace();
          notify("Project backup downloaded.");
        }
        if (cb === "onImportProjectData") {
          e.preventDefault();
          const data = await pickJsonFile();
          if (!data) return;
          // Heuristic: library payload goes to entity library; project
          // payload goes through validate + confirm.
          if (data.schemaVersion === LIBRARY_SCHEMA) {
            await ProjectArchiveService.applyEntityLibrary(data, { overwriteOnConflict: false });
            notify("Entity library merged.");
            return;
          }
          const summary = ProjectArchiveService.summarizeExportPayload(data);
          if (!summary.valid) {
            notify("Import rejected: " + (summary.warnings[0] || "invalid payload"));
            return;
          }
          // Merge by default; require double-confirm to switch to replace.
          let mode = "merge";
          if (window.confirm && window.confirm(
            "Import as REPLACE? This wipes your current project.\n\nOK = REPLACE (backup will be saved first).\nCancel = MERGE (safe, additive)."
          )) {
            if (!window.confirm("Final confirm: REPLACE will overwrite your current project. A backup will be downloaded first. Continue?")) {
              mode = "merge";
            } else {
              await ProjectArchiveService.createBackupBeforeReplace();
              mode = "replace";
            }
          }
          await ProjectArchiveService.applyImport(data, { mode });
          notify(`Project imported (${mode}).`);
        }
        if (cb === "onPreviewProjectImport" || cb === "onValidateProjectImport") {
          e.preventDefault();
          const data = await pickJsonFile();
          if (!data) return;
          const summary = ProjectArchiveService.summarizeExportPayload(data);
          window.dispatchEvent(new CustomEvent("lw:project-import-preview", { detail: { summary, payload: data } }));
          notify(summary.valid
            ? `Preview: ${summary.projectName} · ${summary.counts.entities} entities · ${summary.counts.chapters} chapters`
            : ("Invalid: " + (summary.warnings[0] || "unknown payload")));
        }
        if (cb === "onConfirmProjectImport") {
          // Caller dispatches with the payload + mode already chosen.
          e.preventDefault();
          const detail = el && el.dataset ? (el.dataset.importPayload ? JSON.parse(el.dataset.importPayload) : null) : null;
          if (!detail) {
            notify("No import payload supplied.");
            return;
          }
          await ProjectArchiveService.applyImport(detail.payload, { mode: detail.mode || "merge" });
          notify("Project import applied.");
        }
        if (cb === "onExportEntityLibrary" || cb === "onDownloadEntityLibrary") {
          e.preventDefault();
          // Default: every entity type, no sample data, with refs + occurrences.
          await ProjectArchiveService.downloadEntityLibrary({});
          notify("Entity library downloaded.");
        }
        if (cb === "onImportEntityLibrary") {
          e.preventDefault();
          const data = await pickJsonFile();
          if (!data) return;
          if (data.schemaVersion !== LIBRARY_SCHEMA) {
            // Some users may try to import an old projects-as-library file. Try the project import shim instead.
            if (data.schemaVersion === PROJECT_SCHEMA || LEGACY_PROJECT_SCHEMAS.has(data.schema || "")) {
              await ProjectArchiveService.applyImport(data, { mode: "merge" });
              notify("Detected project file — merged.");
              return;
            }
            notify("Not a Loomwright entity library file.");
            return;
          }
          await ProjectArchiveService.applyEntityLibrary(data, { overwriteOnConflict: false });
          notify("Entity library merged.");
        }
        if (cb === "onCopyProjectExportJson") {
          e.preventDefault();
          const payload = await ProjectArchiveService.buildExport();
          try {
            await (navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)));
            notify("Project export JSON copied to clipboard.");
          } catch (_) { notify("Clipboard unavailable."); }
        }
        if (cb === "onExportSettingsProfile") {
          e.preventDefault();
          await downloadJson("loomwright-settings.json", {
            schema: "loomwright/settings/v2",
            settings: SettingsService.getAllSync(),
            aiProviders: KeysService.loadAllProviderSettingsSync(),
            exportedAt: nowIso(),
          });
        }
        if (cb === "onClearLocalDemoData") {
          e.preventDefault();
          // Scoped: remove only records tagged source: "sample".
          // User-created data is preserved. For a full wipe, use
          // onResetProjectData (separate, double-confirmed).
          await SampleProjectService.clearSample();
        }
        if (cb === "onResetProjectData") {
          e.preventDefault();
          if (!window.confirm) return;
          if (!window.confirm("Reset ALL local Loomwright data in this browser? This cannot be undone.")) return;
          if (!window.confirm("Are you absolutely sure? Every entity, chapter, reference, and setting will be erased.")) return;
          await SampleProjectService.resetProjectData();
        }
        if (cb === "onTestAIProviderConnection") {
          e.preventDefault();
          const providerId = el.getAttribute("data-provider-id") || "openai";
          const result = await KeysService.testProvider(providerId);
          window.dispatchEvent(new CustomEvent("lw:ai-provider-test", { detail: result }));
          notify(result.message || (result.ok ? "Connection OK." : "Connection failed."));
        }
        if (cb === "onLoadSampleProject") {
          e.preventDefault();
          if (window.confirm && !window.confirm("Load the sample demo project? This merges sample data into your local store.")) return;
          await SampleProjectService.loadSample();
        }
        if (cb === "onSave" || cb === "onSaveAndExtract" || cb === "onSaveAndDeepExtract") {
          await ManuscriptService.saveCurrentDom();
        }
        // -------- Speed Reader (real persistence-side actions) --------
        if (cb === "onCreateSpeedReaderSession") {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          try {
            const session = await SpeedReaderService.createSession(detail);
            notify(`Speed Reader: started "${session.sourceTitle}".`);
          } catch (err) {
            notify(err.message || "Speed Reader: could not start session.");
          }
        }
        if (cb === "onReadCurrentChapter") {
          e.preventDefault();
          try {
            const session = await SpeedReaderService.createSession({ sourceType: "chapter" });
            notify(`Speed Reader: reading "${session.sourceTitle}".`);
          } catch (err) {
            notify(err.message || "No active chapter to read.");
          }
        }
        if (cb === "onReadReference") {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          const sourceId = detail.referenceId || detail.id || el.getAttribute("data-reference-id");
          if (!sourceId) {
            notify("Select a reference first.");
            return;
          }
          try {
            const session = await SpeedReaderService.createSession({ sourceType: "reference", sourceId });
            notify(`Speed Reader: reading "${session.sourceTitle}".`);
          } catch (err) {
            notify(err.message || "Reference has no readable content.");
          }
        }
        if (cb === "onDeleteSpeedReaderSession") {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          const sid = detail.sessionId || detail.id || el.getAttribute("data-session-id");
          if (sid) {
            await SpeedReaderService.deleteSession(sid);
            notify("Speed Reader session deleted.");
          }
        }
        if (cb === "onResetSpeedReaderProgress") {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          const sid = detail.sessionId || detail.id || SpeedReaderService.loadSync().activeId;
          if (sid) {
            await SpeedReaderService.resetProgress(sid);
            notify("Speed Reader progress reset.");
          }
        }
        // -------- Search / Indexing --------
        if (cb === "onRebuildSearchIndex") {
          e.preventDefault();
          const entries = SearchService.rebuildIndex();
          notify(`Search index rebuilt (${entries.length} entries).`);
        }
        if (cb === "onClearSearch") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("lw:search-clear"));
        }
        if (
          cb === "onOpenSearchResult"
          || cb === "onOpenEntityFromSearch"
          || cb === "onOpenChapterFromSearch"
          || cb === "onOpenReferenceFromSearch"
          || cb === "onOpenSettingsFromSearch"
          || cb === "onOpenReviewItemFromSearch"
          || cb === "onOpenProjectIntelligenceFromSearch"
          || cb === "onOpenOnboardingFromSearch"
        ) {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          // Generic dispatcher → the shell decides where to land.
          window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail }));
        }
        // -------- Audit Log / Undo --------
        if (cb === "onUndoAuditEvent") {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          const eid = detail.eventId || detail.id || el.getAttribute("data-event-id");
          if (!eid) { notify("No audit event id supplied."); return; }
          try {
            const evt = AuditService.getSync(eid);
            await AuditService.undo(eid);
            notify("Undid: " + (evt?.label || eid));
          } catch (err) {
            notify(err.message || "Could not undo that action.");
          }
        }
        if (cb === "onOpenAuditLog") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("lw:open-audit-log"));
        }
        if (cb === "onClearAuditLog") {
          e.preventDefault();
          if (!window.confirm || !window.confirm("Clear the local audit log? This cannot be undone.")) return;
          await AuditService.clear();
          notify("Audit log cleared.");
        }
        if (cb === "onExportAuditLog") {
          e.preventDefault();
          const data = AuditService.exportSync();
          const stamp = (data.exportedAt || nowIso()).replace(/[:.]/g, "-");
          await downloadJson(`loomwright-audit-${stamp}.json`, data);
          notify("Audit log exported.");
        }
        if (cb === "onOpenRecentActivityItem") {
          e.preventDefault();
          const detail = (el?.dataset && el.dataset.payload) ? (function () { try { return JSON.parse(el.dataset.payload); } catch (_) { return {}; } })() : {};
          const eid = detail.eventId || el.getAttribute("data-event-id");
          const evt = eid ? AuditService.getSync(eid) : null;
          if (!evt) { notify("No matching activity."); return; }
          // Map the event's target to lw:open-search-result for re-use.
          window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: {
            type: evt.targetType,
            entityType: evt.entityType,
            entityId: evt.targetType === "entity" ? evt.targetId : null,
            chapterId: evt.targetType === "chapter" ? evt.targetId : null,
            referenceId: evt.targetType === "reference" ? evt.targetId : null,
            settingsSectionId: evt.targetType === "settings" ? evt.targetId : null,
            reviewItemId: evt.targetType === "review" ? evt.targetId : null,
          } }));
        }
        if (cb === "onCopyProjectContextPack" || cb === "onCopyStyleProfilePack" || cb === "onCopyCanonRulesPack" || cb === "onCopyCharacterBiblePack") {
          e.preventDefault();
          const intel = ProjectIntelService.loadSync();
          const data = cb === "onCopyStyleProfilePack" ? { writingStyleGuide: intel.writingStyleGuide, toneKeywords: intel.toneKeywords }
            : cb === "onCopyCanonRulesPack" ? { canonRules: intel.canonRules }
            : cb === "onCopyCharacterBiblePack" ? { characterSummaries: intel.characterSummaries }
            : intel;
          await navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
          notify("Copied project context JSON.");
        }
      } catch (err) {
        console.error("[Loomwright] backend delegate failed", cb, err);
      }
    });
  }

  function clearDemoGlobals() {
    // Wipe demo seeds so empty panels don't silently render sample data.
    // applyEntityGlobals will re-populate with live entities (sample or user).
    window.ENTITY_SAMPLES = {};
    window.CAST_SAMPLE = [];
  }

  async function initialise() {
    await StorageService.ready();
    const sampleLoaded = !!StorageService.getSync(KEYS.sampleLoaded, false);
    window.__LW_SAMPLE_LOADED__ = sampleLoaded;
    if (!sampleLoaded) clearDemoGlobals();
    await EntityService.hydrateFromStorage();
    await ReferencesService.hydrateFromStorage();
    const onb = await OnboardingService.load(window.ONBOARDING_ANSWERS || {});
    if (onb && Object.keys(onb).length) window.ONBOARDING_ANSWERS = onb;
    window.PROJECT_INTELLIGENCE = ProjectIntelService.loadSync();
    installDelegates();
    // Build the initial search index once the live store is hydrated.
    try { SearchService.rebuildIndex(); } catch (err) { console.warn("[SearchService] initial build failed", err); }
    window.dispatchEvent(new CustomEvent("lw:backend-ready"));
    return true;
  }

  const Backend = {
    keys: KEYS,
    nowIso,
    uuid,
    StorageService,
    EntityService,
    ReviewService,
    ReferencesService,
    OnboardingService,
    ProjectIntelService,
    SettingsService,
    KeysService,
    ManuscriptService,
    ManuscriptChapterService,
    ManuscriptNoteService,
    CompositionService,
    HandoffService,
    TrashService,
    TangleService,
    AtlasService,
    SkillTreeService,
    SpeedReaderService,
    SearchService,
    AuditService,
    ProjectArchiveService,
    LinkService,
    AIService,
    AIRoutingService,
    AIContextBuilder,
    ExtractionService,
    discoverEntities,
    extractProperNounSpans,
    buildAuthorContext,
    analyzeWritingStyle,
    autoApplyCandidate,
    OccurrenceService,
    isOccurrenceStale,
    SampleProjectService,
    exportProject,
    importProject,
    downloadJson,
    pickJsonFile,
    initialise,
  };

  window.LoomwrightBackend = Backend;
  window.StorageService = StorageService;
  window.EntityService = EntityService;
  window.ReferencesService = ReferencesService;
  window.OnboardingService = OnboardingService;
  window.ProjectIntelService = ProjectIntelService;
  window.KeysService = KeysService;

  initialise();
})();
