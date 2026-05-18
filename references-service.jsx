// =====================================================================
// references-service.jsx — Persistence for References / Research Library.
//
// Manages reference sources (files, URLs, notes, style samples, canon
// sources) and onboarding answers as separate stores.
//
// Public API (on window):
//   ReferencesService  — CRUD for reference items
//   OnboardingService  — load/save onboarding answers
//   ProjectIntelService — load/save the Project Intelligence brief
// =====================================================================

// ---------------------------------------------------------------------
// ReferencesService
// ---------------------------------------------------------------------
const ReferencesService = (() => {
  const STORE_KEY = "references";
  let _cache = null;

  function generateId() {
    return "ref-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  async function _load() {
    if (_cache) return _cache;
    _cache = (await StorageService.get(STORE_KEY)) || [];
    // Seed from window.REFERENCES if store is empty
    if (_cache.length === 0 && typeof REFERENCES !== "undefined" && Array.isArray(window.REFERENCES)) {
      _cache = window.REFERENCES.map((r) => ({
        ...r,
        id: r.id || generateId(),
        createdAt: r.createdAt || new Date().toISOString(),
      }));
      await _persist();
    }
    return _cache;
  }

  async function _persist() {
    await StorageService.set(STORE_KEY, _cache);
  }

  window.addEventListener("lw:storage-changed", (e) => {
    if (e.detail && (e.detail.key === STORE_KEY || e.detail.key === "*")) _cache = null;
  });

  return {
    async list(type) {
      const all = await _load();
      if (!type) return all;
      return all.filter((r) => r.type === type);
    },

    async get(id) {
      const all = await _load();
      return all.find((r) => r.id === id) || null;
    },

    async save(ref) {
      const all = await _load();
      const now = new Date().toISOString();
      const item = {
        ...ref,
        id: ref.id || generateId(),
        updatedAt: now,
        createdAt: ref.createdAt || now,
      };
      const idx = all.findIndex((r) => r.id === item.id);
      if (idx >= 0) all[idx] = item;
      else all.push(item);
      _cache = all;
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:references-changed", { detail: { item, action: idx >= 0 ? "update" : "create" } }));
      return item;
    },

    async remove(id) {
      const all = await _load();
      _cache = all.filter((r) => r.id !== id);
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:references-changed", { detail: { id, action: "delete" } }));
    },

    async addStyleSample(text) {
      return this.save({ type: "style-sample", title: "Style sample", content: text, aiContext: true });
    },

    async addCanonSource(source) {
      return this.save({ type: "canon-source", title: "Canon source", content: source, aiContext: true });
    },

    async addResearchNote(note) {
      return this.save({ type: "research-note", title: "Research note", content: note, aiContext: false });
    },

    async addUrl(url) {
      return this.save({ type: "url", title: url, content: url, aiContext: false });
    },

    async exportAll() {
      return _load();
    },

    async importAll(data) {
      _cache = Array.isArray(data) ? data : [];
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:references-changed", { detail: { action: "import" } }));
    },

    generateId,
  };
})();

// ---------------------------------------------------------------------
// OnboardingService
// ---------------------------------------------------------------------
const OnboardingService = (() => {
  const STORE_KEY = "onboarding";
  let _cache = null;

  async function _load() {
    if (_cache) return _cache;
    _cache = (await StorageService.get(STORE_KEY)) || null;
    // Seed from fallback if no stored answers
    if (!_cache && typeof ONBOARDING_ANSWERS_FALLBACK !== "undefined") {
      _cache = { ...ONBOARDING_ANSWERS_FALLBACK };
      await _persist();
    }
    return _cache;
  }

  async function _persist() {
    await StorageService.set(STORE_KEY, _cache);
  }

  window.addEventListener("lw:storage-changed", (e) => {
    if (e.detail && (e.detail.key === STORE_KEY || e.detail.key === "*")) _cache = null;
  });

  return {
    async load() {
      return _load();
    },

    async save(data) {
      _cache = { ...data, updatedAt: new Date().toISOString() };
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:onboarding-changed", { detail: { data: _cache } }));
      return _cache;
    },

    async updateSection(sectionId, fields) {
      const current = await _load() || {};
      current[sectionId] = { ...(current[sectionId] || {}), ...fields };
      return this.save(current);
    },

    async exportJson() {
      return _load();
    },

    async importJson(json) {
      return this.save(typeof json === "string" ? JSON.parse(json) : json);
    },

    async validate(json) {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      const required = ["project", "style", "world", "cast", "plot"];
      const missing = required.filter((k) => !data[k]);
      return { valid: missing.length === 0, missing };
    },
  };
})();

// ---------------------------------------------------------------------
// ProjectIntelService
// ---------------------------------------------------------------------
const ProjectIntelService = (() => {
  const STORE_KEY = "project_intel";
  let _cache = null;

  async function _load() {
    if (_cache) return _cache;
    _cache = (await StorageService.get(STORE_KEY)) || null;
    return _cache;
  }

  async function _persist() {
    await StorageService.set(STORE_KEY, _cache);
  }

  window.addEventListener("lw:storage-changed", (e) => {
    if (e.detail && (e.detail.key === STORE_KEY || e.detail.key === "*")) _cache = null;
  });

  return {
    async load() {
      const data = await _load();
      if (data) return data;
      // Build initial intel from onboarding if available
      const onboarding = await OnboardingService.load();
      if (onboarding) {
        const intel = {
          projectFoundation: onboarding.project?.title || "",
          writingStyleGuide: onboarding.style?.tone || "",
          toneKeywords: (onboarding.style?.tone || "").split(",").map((s) => s.trim()).filter(Boolean),
          canonRules: onboarding.world?.canonRules ? [onboarding.world.canonRules] : [],
          characterSummaries: [],
          extractionRules: [],
          privacySettings: onboarding.privacy || {},
          lastUpdated: new Date().toISOString(),
        };
        _cache = intel;
        await _persist();
        return intel;
      }
      return {};
    },

    async save(data) {
      _cache = { ...data, lastUpdated: new Date().toISOString() };
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:intel-changed", { detail: { data: _cache } }));
      return _cache;
    },

    async exportJson() {
      return _load();
    },

    async importJson(json) {
      return this.save(typeof json === "string" ? JSON.parse(json) : json);
    },

    async buildFromOnboarding() {
      _cache = null; // Force reload from onboarding
      const current = await StorageService.get(STORE_KEY);
      await StorageService.remove(STORE_KEY);
      _cache = null;
      return this.load(); // Re-derive
    },
  };
})();

window.ReferencesService = ReferencesService;
window.OnboardingService = OnboardingService;
window.ProjectIntelService = ProjectIntelService;
