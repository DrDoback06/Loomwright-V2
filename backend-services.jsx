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
    const seedCast = (window.CAST_SAMPLE && window.CAST_SAMPLE.length) ? window.CAST_SAMPLE : (window.__LW_SAMPLE_SOURCES__?.CAST_SAMPLE || []);
    const seedSamples = (window.ENTITY_SAMPLES && Object.keys(window.ENTITY_SAMPLES).length) ? window.ENTITY_SAMPLES : (window.__LW_SAMPLE_SOURCES__?.ENTITY_SAMPLES || {});
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
      const previous = byType[id] || {};
      const status = opts.status || fields.status || previous.status || "active";
      const entity = {
        ...previous,
        ...clone(fields),
        id,
        type: entityType,
        name: fields.name || fields.title || previous.name || "Untitled",
        glyphChar: fields.glyphChar || previous.glyphChar || initialsFor(fields.name || fields.title || previous.name),
        status,
        sourceMentions: fields.sourceMentions || previous.sourceMentions || [],
        reviewQueueCount: opts.reviewQueueCount ?? fields.reviewQueueCount ?? previous.reviewQueueCount ?? 0,
        createdAt: previous.createdAt || fields.createdAt || nowIso(),
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
      return entity;
    },

    async update(type, id, patch = {}) {
      const existing = this.getSync(id, type);
      return this.save(type, { ...(existing || {}), ...patch, id });
    },

    async delete(type, id) {
      const entity = this.getSync(id, type);
      if (!entity) return null;
      const deleted = await this.save(type || entity.type, { ...entity, status: "deleted", deletedAt: nowIso() });
      await TrashService.add({ ...deleted, deletedAt: nowIso() });
      return deleted;
    },

    decoratePanel(panel) {
      if (!panel || !panel.entityType) return panel;
      const entityType = normaliseType(panel.entityType);
      const entities = this.listSync(entityType);
      if (!entities.length) return panel;
      const reviewItems = ReviewService.listSync(entityType);
      const queueCount = reviewItems.length + entities.reduce((sum, e) => sum + (e.reviewQueueCount || e.queue || 0), 0);
      const next = {
        ...panel,
        rows: entities.map(rowForEntity),
        queueCount,
        subtitle: panel.subtitle,
      };
      if (entityType === "cast") next.cast = entities;
      else next.entities = entities;
      if (reviewItems.length) next.reviewItems = reviewItems;
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
    async resolve(id, status = "done") {
      const all = await StorageService.get(KEYS.reviewQueue, []);
      const next = all.map((item) => item.id === id ? { ...item, status, updatedAt: nowIso() } : item);
      await StorageService.set(KEYS.reviewQueue, next);
      return next;
    },
    async resolveMany(ids, status = "done") {
      // Bulk resolve for the review queue's batch approve/deny actions
      // (ported from legacy NarrativeReviewQueue's approveAllForChapter).
      const idSet = new Set(ids || []);
      if (!idSet.size) return this.listSync();
      const all = await StorageService.get(KEYS.reviewQueue, []);
      const next = all.map((item) => idSet.has(item.id) ? { ...item, status, updatedAt: nowIso() } : item);
      await StorageService.set(KEYS.reviewQueue, next);
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
    async save(ref = {}) {
      const refs = await StorageService.get(KEYS.references, []);
      const id = ref.id || uuid("ref");
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
      return nextRef;
    },
  };

  const OnboardingService = {
    loadSync(fallback = {}) {
      return StorageService.getSync(KEYS.onboarding, fallback);
    },
    async load(fallback = {}) {
      return StorageService.get(KEYS.onboarding, fallback);
    },
    async save(answers = {}) {
      const next = { ...clone(answers), updatedAt: nowIso() };
      await StorageService.set(KEYS.onboarding, next);
      window.ONBOARDING_ANSWERS = next;
      window.dispatchEvent(new CustomEvent("lw:onboarding-updated", { detail: { answers: next } }));
      return next;
    },
  };

  const ProjectIntelService = {
    defaultIntel() {
      const onboarding = OnboardingService.loadSync({});
      return {
        projectFoundation: onboarding.project?.goals || "",
        writingStyleGuide: onboarding.style?.tone || "",
        toneKeywords: (onboarding.style?.tone || "").split(/[,.]/).map((s) => s.trim()).filter(Boolean).slice(0, 8),
        canonRules: [onboarding.world?.canonRules].filter(Boolean),
        characterSummaries: EntityService.listSync("cast").map((e) => ({ entityId: e.id, summary: e.summary || "" })),
        extractionRules: [],
        privacySettings: StorageService.getSync(KEYS.settings, {}).privacy || {},
        lastUpdated: nowIso(),
      };
    },
    loadSync() {
      return StorageService.getSync(KEYS.projectIntelligence, this.defaultIntel());
    },
    async save(intel = {}) {
      const next = { ...this.defaultIntel(), ...clone(intel), lastUpdated: nowIso() };
      await StorageService.set(KEYS.projectIntelligence, next);
      window.PROJECT_INTELLIGENCE = next;
      return next;
    },
    async mergeFromOnboarding(answers) {
      const current = this.loadSync();
      return this.save({
        ...current,
        projectFoundation: answers?.project?.goals || current.projectFoundation,
        writingStyleGuide: answers?.style?.tone || current.writingStyleGuide,
        canonRules: [answers?.world?.canonRules].filter(Boolean),
      });
    },
  };

  const SettingsService = {
    getAllSync() {
      return StorageService.getSync(KEYS.settings, {});
    },
    getSectionSync(section, fallback) {
      const all = this.getAllSync();
      return all[section] ? { ...clone(fallback || {}), ...all[section] } : clone(fallback);
    },
    async saveSection(section, value) {
      const all = await StorageService.get(KEYS.settings, {});
      const next = { ...all, [section]: clone(value), updatedAt: nowIso() };
      await StorageService.set(KEYS.settings, next);
      window.dispatchEvent(new CustomEvent("lw:settings-saved", { detail: { section, value } }));
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
      const { apiKey, ...safeSettings } = settings || {};
      if (apiKey) allKeys[providerId] = await this.encrypt(apiKey);
      allSettings[providerId] = { ...(allSettings[providerId] || {}), ...safeSettings, hasKey: !!(apiKey || allKeys[providerId]), updatedAt: nowIso() };
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
  const TangleService = {
    defaultState() {
      return { nodes: [], groups: [], updatedAt: nowIso() };
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
        updatedAt: nowIso(),
      };
    },
    loadSync() {
      return StorageService.getSync(KEYS.manuscriptChapters, this.defaultState());
    },
    async save(state) {
      const next = { ...this.loadSync(), ...clone(state), updatedAt: nowIso() };
      await StorageService.set(KEYS.manuscriptChapters, next);
      window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated", { detail: next }));
      return next;
    },
    async setChapterContent(chapterId, manuscript, meta = {}) {
      const state = this.loadSync();
      const chapters = (state.chapters || []).map((c) => (
        c.id === chapterId ? { ...c, ...meta, updatedAt: nowIso() } : c
      ));
      return this.save({
        ...state,
        chapters: chapters.length ? chapters : state.chapters,
        manuscripts: { ...(state.manuscripts || {}), [chapterId]: manuscript },
        activeChapterId: chapterId,
      });
    },
    async createFromComposition(payload = {}) {
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
      await this.save(next);
      window.dispatchEvent(new CustomEvent("lw:chapter-created", { detail: { chapter } }));
      return chapter;
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

  const LinkService = {
    async patchEntity(entityId, entityType, patch) {
      return EntityService.update(entityType, entityId, patch);
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

  const AIService = {
    async getProviderConfig(providerId = "openai") {
      const settings = KeysService.loadProviderSync(providerId) || {};
      return {
        providerId,
        baseUrl: settings.baseUrl || "https://api.openai.com/v1",
        model: settings.model || "gpt-4o-mini",
        apiKey: await KeysService.loadKey(providerId),
      };
    },
    async testConnection(providerId = "openai") {
      const cfg = await this.getProviderConfig(providerId);
      if (!cfg.apiKey) {
        return { ok: false, providerId, message: "No API key stored for this provider." };
      }
      try {
        const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/models`, {
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
        });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, providerId, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
        }
        return { ok: true, providerId, message: "Connection successful." };
      } catch (err) {
        return { ok: false, providerId, message: err.message || String(err) };
      }
    },
    async complete({ prompt, providerId = "openai", system, maxTokens = 1200 }) {
      const cfg = await this.getProviderConfig(providerId);
      if (!cfg.apiKey) throw new Error("No API key configured. Add one in Settings → AI Providers.");
      const body = {
        model: cfg.model,
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
      };
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
      }
      const json = await res.json();
      return json.choices?.[0]?.message?.content || "";
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

  const ExtractionService = {
    loadSessionSync() {
      return StorageService.getSync(KEYS.extractionSession, { status: "idle", items: [] });
    },
    async saveSession(session) {
      await StorageService.set(KEYS.extractionSession, { ...session, updatedAt: nowIso() });
      window.dispatchEvent(new CustomEvent("lw:extraction-updated", { detail: session }));
    },
    async runExtraction({ chapterId, text, deep = false }) {
      const sessionId = uuid("ext");
      // Local pass: scan text for mentions of known entities and persist
      // EntityOccurrence records pointing at real entity IDs. This runs
      // regardless of AI configuration so double-click works without BYOK.
      const occurrences = scanTextForKnownEntities(text || "", chapterId, sessionId);
      if (occurrences.length) await OccurrenceService.saveMany(occurrences);

      let items = [];
      // Only invoke AI when a provider is configured. Otherwise the local
      // pass alone produces useful occurrences without leaking text.
      const aiAvailable = !!(await AIService.getProviderConfig().catch(() => null))?.apiKey;
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
        for (const chunk of chunks) {
          const promptHeader = deep
            ? `You are a canon extraction system for a long-form story. Analyze this chapter chunk and extract narrative elements across every domain.

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

Chunk ${chunk.index + 1}/${chunks.length}:
${chunk.text}

Known characters: ${known("cast") || "None"}
Known items:      ${known("items") || "None"}

Return JSON: [{type:"cast|items|locations|quests|events", name, summary, confidence}]`;
          try {
            const raw = await AIService.complete({
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
            } catch (_) {
              // Skip unparseable chunk
            }
          } catch (e) {
            // AI call failed on this chunk — continue with others.
          }
        }
      }

      // Enrich each candidate with matchType (exact/nickname/fuzzy/new),
      // sourceQuote (chapter snippet around the candidate), previousState
      // (existing entity snapshot when matched), and confidenceBand.
      // Ports legacy entityMatchingService's three-tier matcher behaviour.
      const reviewItems = items.map((item) => {
        const candidateName = item.name || "";
        const entityType = normaliseType(item.type || "references");
        const match = findKnownEntityMention(candidateName, { threshold: 0.85 });
        const matchType = match
          ? match.matchType
          : (item.isNew === false ? "ambiguous" : "new");
        const baseConfidence = typeof item.confidence === "number"
          ? (item.confidence > 1 ? item.confidence / 100 : item.confidence)
          : 0.7;
        const confidence = match ? Math.max(baseConfidence, match.confidence) : baseConfidence;
        // Locate the source quote: a ~140-char window around the first
        // text match of the candidate name in the chapter.
        let sourceQuote = "";
        if (candidateName) {
          const ranges = findRanges(text || "", candidateName);
          if (ranges.length) {
            const start = Math.max(0, ranges[0].start - 60);
            const end = Math.min((text || "").length, ranges[0].end + 80);
            sourceQuote = (text || "").slice(start, end).trim();
          }
        }
        const previousState = match ? { ...match.entity } : null;
        const suggestedAction = match
          ? (diffEntity(match.entity, item).length ? "update" : "link")
          : "create";
        return {
          id: uuid("rq"),
          entityType,
          name: candidateName || "Suggestion",
          action: deep ? "Deep extract" : "Extract",
          level: "suggestion",
          value: Math.round(confidence * 100),
          confidence,
          confidenceBand: confidenceBand(confidence),
          matchType,
          suggestedAction,
          sourceQuote,
          previousState,
          reason: item.summary || item.description || "Extracted from manuscript",
          payload: item,
          targetEntityId: match?.entity?.id || null,
          chapterId,
          extractionSessionId: sessionId,
          candidateId: uuid("cand"),
          status: "pending",
        };
      });
      await ReviewService.addMany(reviewItems);
      // Tag local-pass occurrences for unknown candidates so accept can
      // backfill the entityId after entity creation.
      for (const ri of reviewItems) {
        const needle = (ri.payload?.name || "").toLowerCase();
        if (!needle) continue;
        const ranges = findRanges(text || "", needle);
        if (!ranges.length) continue;
        await OccurrenceService.saveMany(ranges.map((r) => ({
          entityId: ri.targetEntityId || null,
          entityType: ri.entityType,
          exactText: text.slice(r.start, r.end),
          chapterId,
          startOffset: r.start,
          endOffset: r.end,
          extractionSessionId: sessionId,
          candidateId: ri.candidateId,
        })));
      }
      const session = {
        status: "complete",
        chapterId,
        deep,
        sessionId,
        itemCount: items.length,
        occurrenceCount: occurrences.length,
        aiUsed: aiAvailable,
        updatedAt: nowIso(),
      };
      await this.saveSession(session);
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      return { session, items, occurrences };
    },
  };

  const SampleProjectService = {
    async loadSample() {
      const demo = window.WR_DEMO_PROJECT || {};
      const entities = collectDefaultEntities();
      await StorageService.set(KEYS.entities, entities);
      applyEntityGlobals(entities);
      const refs = (window.REFERENCES || []).map((r) => ({
        ...clone(r),
        id: r.id || uuid("ref"),
        createdAt: r.createdAt || nowIso(),
        updatedAt: r.updatedAt || nowIso(),
      }));
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
      notify(`Cleared ${removed} sample record(s); your work is untouched.`);
    },
    async resetProjectData() {
      // Destructive: wipes ALL persistent state. Caller must double-confirm.
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

  async function exportProject() {
    const data = await StorageService.getAll();
    data.schema = "loomwright/project-export/v2";
    data.exportedAt = nowIso();
    await downloadJson("loomwright-project-export.json", data);
    return data;
  }

  async function importProject(data) {
    if (!data) data = await pickJsonFile();
    if (!data) return null;
    const payload = data.schema ? Object.fromEntries(Object.entries(data).filter(([k]) => Object.values(KEYS).includes(k))) : data;
    await StorageService.setAll(payload);
    await initialise();
    window.dispatchEvent(new CustomEvent("lw:project-imported", { detail: payload }));
    return payload;
  }

  function notify(message) {
    try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_) {}
    // eslint-disable-next-line no-console
    console.info("[Loomwright]", message);
  }

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

    document.addEventListener("click", async (e) => {
      const el = e.target.closest && e.target.closest("[data-callback]");
      if (!el) return;
      const cb = el.getAttribute("data-callback");
      try {
        if (cb === "onExportProjectData" || cb === "onBackupNow") {
          e.preventDefault();
          await exportProject();
          notify("Project export downloaded.");
        }
        if (cb === "onImportProjectData") {
          e.preventDefault();
          await importProject();
          notify("Project import applied.");
        }
        if (cb === "onExportEntityLibrary") {
          e.preventDefault();
          await downloadJson("loomwright-entities.json", { schema: "loomwright/entities/v2", entities: EntityService.listAllSync(), exportedAt: nowIso() });
        }
        if (cb === "onImportEntityLibrary") {
          e.preventDefault();
          const data = await pickJsonFile();
          if (data?.entities) {
            await StorageService.set(KEYS.entities, data.entities);
            applyEntityGlobals(data.entities);
          }
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
    CompositionService,
    HandoffService,
    TrashService,
    TangleService,
    LinkService,
    AIService,
    ExtractionService,
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
