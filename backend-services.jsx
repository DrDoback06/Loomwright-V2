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
  };

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
          status: row.status || "active",
          createdAt: row.createdAt || nowIso(),
          updatedAt: row.updatedAt || nowIso(),
        };
      });
    };
    if (window.CAST_SAMPLE) add("cast", window.CAST_SAMPLE);
    Object.entries(window.ENTITY_SAMPLES || {}).forEach(([type, rows]) => add(type, rows));
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
      return StorageService.getSync(KEYS.entities, collectDefaultEntities());
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

    async seedDefaultsIfEmpty() {
      const stored = await StorageService.get(KEYS.entities, null);
      if (stored && Object.keys(stored).length) {
        applyEntityGlobals(stored);
        return stored;
      }
      const defaults = collectDefaultEntities();
      await StorageService.set(KEYS.entities, defaults);
      applyEntityGlobals(defaults);
      return defaults;
    },

    async list(type) {
      const all = await StorageService.get(KEYS.entities, collectDefaultEntities());
      return Object.values(all[normaliseType(type)] || {});
    },

    async save(type, fields = {}, opts = {}) {
      const entityType = normaliseType(type || fields.type || fields.entityType);
      const all = await StorageService.get(KEYS.entities, collectDefaultEntities());
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
  };

  const ReferencesService = {
    listSync(kind) {
      const refs = StorageService.getSync(KEYS.references, window.REFERENCES || []);
      return kind ? refs.filter((r) => r.kind === kind || r.type === kind) : refs;
    },
    async seedDefaultsIfEmpty() {
      const stored = await StorageService.get(KEYS.references, null);
      if (stored && stored.length) {
        window.REFERENCES = stored;
        return stored;
      }
      const defaults = (window.REFERENCES || []).map((r) => ({
        ...clone(r),
        id: r.id || uuid("ref"),
        createdAt: r.createdAt || nowIso(),
        updatedAt: r.updatedAt || nowIso(),
      }));
      await StorageService.set(KEYS.references, defaults);
      window.REFERENCES = defaults;
      return defaults;
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
      const settings = this.loadProviderSync(providerId);
      return {
        ok: true,
        providerId,
        mode: "mock",
        message: "Mock connection OK. No network request was made.",
        hasKey: !!settings?.hasKey,
      };
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
          if (window.confirm && !window.confirm("Clear all local Loomwright data in this browser?")) return;
          await StorageService.clear();
          await initialise();
          notify("Local Loomwright data cleared.");
        }
        if (cb === "onTestAIProviderConnection") {
          e.preventDefault();
          notify("Mock provider connection OK. No network request was made.");
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

  async function initialise() {
    await StorageService.ready();
    await EntityService.seedDefaultsIfEmpty();
    await ReferencesService.seedDefaultsIfEmpty();
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
    CompositionService,
    HandoffService,
    TrashService,
    exportProject,
    importProject,
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
