// =====================================================================
// lw-services.jsx — Domain services on top of StorageService.
//
// Phase 2: EntityService (canonical entity store).
// Phase 6: ReferencesService.
// Phase 7: ProjectIntelService.
// Phase 8: OnboardingService.
//
// All services are attached to `window` so the babel-standalone scripts can
// reach them without ES modules. Each service mirrors a REST-ish surface
// (`list`, `get`, `save`, `delete`) so swapping in a real backend later only
// touches the service body.
// =====================================================================

(function initLwServices(global) {
  const Storage = global.StorageService;
  if (!Storage) {
    // eslint-disable-next-line no-console
    console.error("[Loomwright] lw-services.jsx loaded before lw-storage.jsx");
    return;
  }

  // ===================================================================
  // Helpers
  // ===================================================================
  function nowIso() { return new Date().toISOString(); }

  function newId(prefix) {
    // Short, sortable, human-friendly id. Not collision-proof at scale; fine
    // for a single-user local app.
    const rand = Math.random().toString(36).slice(2, 8);
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + rand;
  }

  function clone(v) {
    if (v === null || v === undefined) return v;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function emit(name, detail) {
    if (global.dispatchEvent) {
      global.dispatchEvent(new CustomEvent(name, { detail }));
    }
  }

  // ===================================================================
  // EntityService (Phase 2)
  // -------------------------------------------------------------------
  // Storage layout (key "entities"):
  //   { [entityId]: Entity }
  //
  // An Entity has at minimum: { id, type, name, status, createdAt, updatedAt }.
  // ===================================================================
  const ENTITIES_KEY = "entities";

  async function _readAll() {
    return (await Storage.get(ENTITIES_KEY)) || {};
  }
  async function _writeAll(map) {
    await Storage.set(ENTITIES_KEY, map);
    return map;
  }

  const EntityService = {
    KEY: ENTITIES_KEY,

    /** Seed the store from `window.ENTITY_SAMPLES` if no entities exist yet. */
    async ensureSeeded() {
      const existing = await _readAll();
      if (existing && Object.keys(existing).length > 0) return existing;
      const samples = global.ENTITY_SAMPLES || {};
      const seeded = {};
      const ts = nowIso();
      for (const type of Object.keys(samples)) {
        for (const raw of samples[type]) {
          const id = raw.id || newId(type);
          seeded[id] = Object.assign(
            {
              aliases: [],
              tags: [],
              flags: [],
              sourceMentions: [],
              reviewQueueCount: 0,
              status: raw.status || "active",
              createdAt: ts,
              updatedAt: ts,
            },
            raw,
            { id, type: raw.type || type },
          );
        }
      }
      await _writeAll(seeded);
      emit("lw:entities-changed", { reason: "seed" });
      return seeded;
    },

    /** List entities of a given type (or all entities if type is omitted). */
    async list(type) {
      const all = await _readAll();
      const arr = Object.values(all);
      if (!type) return arr;
      return arr.filter((e) => e.type === type);
    },

    /** Snapshot of the entire entity map keyed by id. */
    async getMap() { return await _readAll(); },

    /** Look up a single entity by id. */
    async get(id) {
      if (!id) return null;
      const all = await _readAll();
      return all[id] || null;
    },

    /** Save or update an entity. Returns the persisted entity. */
    async save(entity) {
      if (!entity || !entity.type) {
        throw new Error("EntityService.save: entity.type is required");
      }
      const all = await _readAll();
      const id = entity.id || newId(entity.type);
      const prev = all[id];
      const merged = Object.assign({}, prev || {}, entity, {
        id,
        type: entity.type,
        createdAt: (prev && prev.createdAt) || entity.createdAt || nowIso(),
        updatedAt: nowIso(),
      });
      all[id] = merged;
      await _writeAll(all);
      emit("lw:entities-changed", { reason: prev ? "update" : "create", id, entity: merged });
      return merged;
    },

    /** Soft-delete: marks status="deleted" and increments reviewQueueCount. */
    async softDelete(id) {
      const all = await _readAll();
      if (!all[id]) return null;
      all[id] = Object.assign({}, all[id], { status: "deleted", updatedAt: nowIso() });
      await _writeAll(all);
      emit("lw:entities-changed", { reason: "soft-delete", id });
      return all[id];
    },

    /** Permanent delete. */
    async delete(id) {
      const all = await _readAll();
      if (!all[id]) return false;
      delete all[id];
      await _writeAll(all);
      emit("lw:entities-changed", { reason: "delete", id });
      return true;
    },

    /** Append a sourceMention to an entity (chapter/paragraph/quote). */
    async addSourceMention(id, mention) {
      const all = await _readAll();
      if (!all[id]) return null;
      const entity = all[id];
      const existing = Array.isArray(entity.sourceMentions) ? entity.sourceMentions.slice() : [];
      existing.push(Object.assign({ ts: nowIso() }, mention));
      all[id] = Object.assign({}, entity, { sourceMentions: existing, updatedAt: nowIso() });
      await _writeAll(all);
      emit("lw:entities-changed", { reason: "mention", id });
      return all[id];
    },

    /** Fuzzy-look-up an entity by name (used while we don't have stable ids). */
    async findByLabel(label, opts) {
      const all = await _readAll();
      const target = (label || "").toLowerCase().trim();
      if (!target) return null;
      const candidates = Object.values(all).filter((e) => {
        if (opts && opts.type && e.type !== opts.type) return false;
        return true;
      });
      const norm = (s) => (s || "").toLowerCase().trim();
      let match = candidates.find((e) => norm(e.name) === target);
      if (match) return match;
      match = candidates.find((e) => norm(e.name).includes(target) || target.includes(norm(e.name)));
      if (match) return match;
      const firstWord = target.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 3) {
        match = candidates.find((e) => norm(e.name).split(/\s+/).includes(firstWord));
      }
      return match || null;
    },

    /** Replace the entire entity store. Used by import/restore. */
    async replaceAll(map) {
      await _writeAll(map || {});
      emit("lw:entities-changed", { reason: "replace" });
    },

    _utils: { newId, nowIso, clone },
  };

  // ===================================================================
  // ReferencesService (Phase 6)
  // -------------------------------------------------------------------
  // Storage layout (key "references"): Reference[]
  // Reference: { id, type, title, content?, url?, linkedEntities[], aiIncluded, ... }
  // ===================================================================
  const REFERENCES_KEY = "references";

  const ReferencesService = {
    KEY: REFERENCES_KEY,

    async list(filter) {
      const arr = (await Storage.get(REFERENCES_KEY)) || [];
      if (!filter) return arr;
      if (typeof filter === "string") return arr.filter((r) => r.type === filter);
      if (filter && filter.type) return arr.filter((r) => r.type === filter.type);
      return arr;
    },

    async get(id) {
      const arr = (await Storage.get(REFERENCES_KEY)) || [];
      return arr.find((r) => r.id === id) || null;
    },

    async save(ref) {
      if (!ref) throw new Error("ReferencesService.save: ref required");
      const arr = (await Storage.get(REFERENCES_KEY)) || [];
      const id = ref.id || newId("ref");
      const idx = arr.findIndex((r) => r.id === id);
      const ts = nowIso();
      const next = Object.assign(
        { type: "note", aiIncluded: true, linkedEntities: [], createdAt: ts },
        idx >= 0 ? arr[idx] : {},
        ref,
        { id, updatedAt: ts },
      );
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      await Storage.set(REFERENCES_KEY, arr);
      emit("lw:references-changed", { reason: idx >= 0 ? "update" : "create", id, ref: next });
      return next;
    },

    async delete(id) {
      const arr = (await Storage.get(REFERENCES_KEY)) || [];
      const next = arr.filter((r) => r.id !== id);
      if (next.length === arr.length) return false;
      await Storage.set(REFERENCES_KEY, next);
      emit("lw:references-changed", { reason: "delete", id });
      return true;
    },

    /** Convenience for common UI flows. */
    async addNote(text, extra) {
      return await ReferencesService.save(Object.assign({ type: "note", content: text }, extra || {}));
    },
    async addUrl(url, extra) {
      return await ReferencesService.save(Object.assign({ type: "url", url, title: url }, extra || {}));
    },
    async addStyleSample(text, extra) {
      return await ReferencesService.save(Object.assign({ type: "style", content: text }, extra || {}));
    },
    async addCanonSource(text, extra) {
      return await ReferencesService.save(Object.assign({ type: "canon", content: text }, extra || {}));
    },
    async addResearchNote(text, extra) {
      return await ReferencesService.save(Object.assign({ type: "research", content: text }, extra || {}));
    },
    async addFile(file, extra) {
      // Stores file metadata only; the binary itself is read into base64 so
      // tiny attachments survive a refresh without IndexedDB.
      if (!file) return null;
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return await ReferencesService.save(Object.assign({
        type: "file",
        title: file.name,
        size: file.size,
        mime: file.type,
        content: dataUrl,
      }, extra || {}));
    },
    async importJson(json) {
      if (!Array.isArray(json)) return [];
      const results = [];
      for (const ref of json) results.push(await ReferencesService.save(ref));
      return results;
    },

    async replaceAll(arr) {
      await Storage.set(REFERENCES_KEY, Array.isArray(arr) ? arr : []);
      emit("lw:references-changed", { reason: "replace" });
    },
  };

  // ===================================================================
  // OnboardingService (Phase 8)
  // ===================================================================
  const ONBOARDING_KEY = "onboarding";

  const OnboardingService = {
    KEY: ONBOARDING_KEY,

    async load() {
      return (await Storage.get(ONBOARDING_KEY)) || {
        foundation: "",
        genre: "",
        audience: "",
        goals: "",
        worldHighlights: "",
        keyCharacters: "",
        plotOutlines: "",
        styleSamples: "",
        aiInstructions: "",
        privacyChoices: "",
      };
    },

    async save(answers) {
      const next = Object.assign({}, await OnboardingService.load(), answers || {}, {
        updatedAt: nowIso(),
      });
      await Storage.set(ONBOARDING_KEY, next);
      emit("lw:onboarding-changed", { answers: next });
      return next;
    },

    async validate(json) {
      const errors = [];
      if (!json || typeof json !== "object") {
        errors.push("Onboarding payload must be an object.");
        return { valid: false, errors };
      }
      const allowed = new Set([
        "foundation", "genre", "audience", "goals",
        "worldHighlights", "keyCharacters", "plotOutlines",
        "styleSamples", "aiInstructions", "privacyChoices",
        "updatedAt",
      ]);
      for (const k of Object.keys(json)) {
        if (!allowed.has(k)) errors.push("Unknown field: " + k);
      }
      return { valid: errors.length === 0, errors };
    },

    async applyImport(json) {
      const v = await OnboardingService.validate(json);
      if (!v.valid) return { ok: false, errors: v.errors };
      const saved = await OnboardingService.save(json);
      return { ok: true, answers: saved };
    },

    async replaceAll(json) {
      await Storage.set(ONBOARDING_KEY, json || {});
      emit("lw:onboarding-changed", { answers: json || {} });
    },
  };

  // ===================================================================
  // ProjectIntelService (Phase 7)
  // ===================================================================
  const PROJECT_INTEL_KEY = "project_intel";

  const ProjectIntelService = {
    KEY: PROJECT_INTEL_KEY,

    async load() {
      return (await Storage.get(PROJECT_INTEL_KEY)) || {
        projectFoundation: "",
        writingStyleGuide: "",
        toneKeywords: [],
        canonRules: [],
        characterSummaries: [],
        extractionRules: [],
        privacySettings: {},
        lastUpdated: null,
      };
    },

    async save(intel) {
      const prev = await ProjectIntelService.load();
      const next = Object.assign({}, prev, intel || {}, { lastUpdated: nowIso() });
      await Storage.set(PROJECT_INTEL_KEY, next);
      emit("lw:project-intel-changed", { intel: next });
      return next;
    },

    async copyJson() {
      const intel = await ProjectIntelService.load();
      const text = JSON.stringify(intel, null, 2);
      if (global.navigator && global.navigator.clipboard) {
        try { await global.navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
      }
      return text;
    },

    async importJson(json) {
      if (!json || typeof json !== "object") return { ok: false, errors: ["Not an object"] };
      const saved = await ProjectIntelService.save(json);
      return { ok: true, intel: saved };
    },

    /** Pulls onboarding answers into the project intelligence shape. */
    async syncFromOnboarding() {
      const ob = await OnboardingService.load();
      return await ProjectIntelService.save({
        projectFoundation: ob.foundation || "",
        writingStyleGuide: ob.styleSamples || "",
        toneKeywords: ob.aiInstructions ? [ob.aiInstructions] : [],
      });
    },

    async replaceAll(json) {
      await Storage.set(PROJECT_INTEL_KEY, json || {});
      emit("lw:project-intel-changed", { intel: json || {} });
    },
  };

  // ===================================================================
  // Review queue (Phase 5 placeholder hook-up)
  // ===================================================================
  const REVIEW_QUEUE_KEY = "review_queue";

  const ReviewQueueService = {
    KEY: REVIEW_QUEUE_KEY,
    async list() { return (await Storage.get(REVIEW_QUEUE_KEY)) || []; },
    async add(item) {
      const arr = (await Storage.get(REVIEW_QUEUE_KEY)) || [];
      const next = Object.assign({ id: newId("rq"), status: "pending", createdAt: nowIso() }, item || {});
      arr.push(next);
      await Storage.set(REVIEW_QUEUE_KEY, arr);
      emit("lw:review-queue-changed", { reason: "add", item: next });
      return next;
    },
    async resolve(id, status) {
      const arr = (await Storage.get(REVIEW_QUEUE_KEY)) || [];
      const next = arr.map((it) => it.id === id ? Object.assign({}, it, { status: status || "resolved", updatedAt: nowIso() }) : it);
      await Storage.set(REVIEW_QUEUE_KEY, next);
      emit("lw:review-queue-changed", { reason: "resolve", id });
      return true;
    },
    async remove(id) {
      const arr = (await Storage.get(REVIEW_QUEUE_KEY)) || [];
      const next = arr.filter((it) => it.id !== id);
      await Storage.set(REVIEW_QUEUE_KEY, next);
      emit("lw:review-queue-changed", { reason: "remove", id });
    },
    async replaceAll(arr) {
      await Storage.set(REVIEW_QUEUE_KEY, Array.isArray(arr) ? arr : []);
      emit("lw:review-queue-changed", { reason: "replace" });
    },
  };

  // ===================================================================
  // Chapters / Manuscript persistence (Phase 3)
  // ===================================================================
  const CHAPTERS_KEY = "chapters";

  const ChaptersService = {
    KEY: CHAPTERS_KEY,

    async load() {
      return (await Storage.get(CHAPTERS_KEY)) || null;
    },

    async ensureSeeded(seed) {
      const existing = await ChaptersService.load();
      if (existing) return existing;
      const baseline = seed || {
        activeChapterId: null,
        chapters: [],
        manuscript: {},
      };
      await Storage.set(CHAPTERS_KEY, baseline);
      return baseline;
    },

    async save(payload) {
      const next = Object.assign({}, await ChaptersService.load() || {}, payload || {}, {
        updatedAt: nowIso(),
      });
      await Storage.set(CHAPTERS_KEY, next);
      emit("lw:chapters-changed", { chapters: next });
      return next;
    },

    async setActiveChapter(id) {
      const prev = await ChaptersService.load() || { chapters: [], manuscript: {} };
      const next = Object.assign({}, prev, { activeChapterId: id, updatedAt: nowIso() });
      await Storage.set(CHAPTERS_KEY, next);
      emit("lw:chapters-changed", { chapters: next });
      return next;
    },

    async updateManuscript(chapterId, content) {
      const prev = await ChaptersService.load() || { chapters: [], manuscript: {} };
      const manuscript = Object.assign({}, prev.manuscript || {}, { [chapterId]: content });
      const next = Object.assign({}, prev, { manuscript, updatedAt: nowIso() });
      await Storage.set(CHAPTERS_KEY, next);
      emit("lw:chapters-changed", { chapters: next });
      return next;
    },

    async replaceAll(payload) {
      await Storage.set(CHAPTERS_KEY, payload || null);
      emit("lw:chapters-changed", { chapters: payload || null });
    },
  };

  // ===================================================================
  // SettingsService (Phase 10 host)
  // ===================================================================
  const SETTINGS_KEY = "settings";

  const SettingsService = {
    KEY: SETTINGS_KEY,

    async load() {
      return (await Storage.get(SETTINGS_KEY)) || {
        project: {},
        theme: {},
        editor: {},
        privacy: { mode: "local", aiAllowed: false },
        extraction: {},
        reviewQueue: {},
        aiRouting: {},
        aiProviders: {},
      };
    },

    async save(patch) {
      const prev = await SettingsService.load();
      const next = Object.assign({}, prev, patch || {});
      await Storage.set(SETTINGS_KEY, next);
      emit("lw:settings-changed", { settings: next });
      return next;
    },

    async setSection(section, value) {
      const prev = await SettingsService.load();
      const next = Object.assign({}, prev, { [section]: Object.assign({}, prev[section] || {}, value || {}) });
      await Storage.set(SETTINGS_KEY, next);
      emit("lw:settings-changed", { settings: next, section });
      return next;
    },

    async replaceAll(payload) {
      await Storage.set(SETTINGS_KEY, payload || {});
      emit("lw:settings-changed", { settings: payload || {} });
    },
  };

  // ===================================================================
  // AuthorProfilesService (Settings — author profiles)
  // ===================================================================
  const AUTHOR_PROFILES_KEY = "author_profiles";

  const AuthorProfilesService = {
    KEY: AUTHOR_PROFILES_KEY,
    async list() { return (await Storage.get(AUTHOR_PROFILES_KEY)) || []; },
    async save(profile) {
      const arr = await AuthorProfilesService.list();
      const id = profile.id || newId("author");
      const idx = arr.findIndex((p) => p.id === id);
      const next = Object.assign({}, idx >= 0 ? arr[idx] : {}, profile, { id, updatedAt: nowIso() });
      if (idx >= 0) arr[idx] = next; else arr.push(next);
      await Storage.set(AUTHOR_PROFILES_KEY, arr);
      emit("lw:authors-changed", { profiles: arr });
      return next;
    },
    async delete(id) {
      const arr = await AuthorProfilesService.list();
      const next = arr.filter((p) => p.id !== id);
      await Storage.set(AUTHOR_PROFILES_KEY, next);
      emit("lw:authors-changed", { profiles: next });
      return true;
    },
    async replaceAll(arr) {
      await Storage.set(AUTHOR_PROFILES_KEY, Array.isArray(arr) ? arr : []);
      emit("lw:authors-changed", { profiles: Array.isArray(arr) ? arr : [] });
    },
  };

  // ===================================================================
  // Export to globals + namespace.
  // ===================================================================
  Object.assign(global, {
    EntityService,
    ReferencesService,
    OnboardingService,
    ProjectIntelService,
    ReviewQueueService,
    ChaptersService,
    SettingsService,
    AuthorProfilesService,
  });

  global.Loomwright = Object.assign(global.Loomwright || {}, {
    EntityService,
    ReferencesService,
    OnboardingService,
    ProjectIntelService,
    ReviewQueueService,
    ChaptersService,
    SettingsService,
    AuthorProfilesService,
  });

  // Hydrate the entity store with the demo samples once the rest of the
  // app has loaded (entity-data.jsx attaches ENTITY_SAMPLES later in the
  // script order). The `load` event fires after every `type="text/babel"`
  // script has been compiled + executed.
  function _kickoffBootstrap() {
    EntityService.ensureSeeded().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[Loomwright] EntityService.ensureSeeded failed:", err);
    });
    emit("lw:services-ready", { ts: Date.now() });
  }
  if (global.document && global.document.readyState === "complete") {
    setTimeout(_kickoffBootstrap, 0);
  } else if (global.addEventListener) {
    global.addEventListener("load", _kickoffBootstrap, { once: true });
  } else {
    setTimeout(_kickoffBootstrap, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
