// =====================================================================
// lw-storage.jsx — Async StorageService backed by window.localStorage
//
// Phase 1 of the Loomwright v2 backend integration. Exposes a tiny
// promise-based facade so call sites can swap localStorage for IndexedDB
// (e.g. localForage) without churn. All persisted values are JSON-encoded.
//
// Keys used elsewhere in the backend:
//   lw_entities        — { [entityId]: entity }
//   lw_chapters        — { chapters, manuscript, activeChapterId, ... }
//   lw_references      — Reference[]
//   lw_onboarding      — Onboarding answers object
//   lw_project_intel   — Project Intelligence object
//   lw_review_queue    — ReviewQueueItem[]
//   lw_settings        — Settings (general/theme/editor/privacy/extraction)
//   lw_author_profiles — AuthorProfile[]
//   lw_ai_keys         — { [providerId]: { iv, data } } encrypted blobs
//   lw_ai_routing      — AI provider routing prefs
//   lw_handoff_history — Recent handoff pack snapshots (capped)
// =====================================================================

(function initLwStorage(global) {
  const PREFIX = "lw:";

  const memoryFallback = new Map();
  const hasLocalStorage = (() => {
    try {
      const probe = "__lw_probe__";
      global.localStorage.setItem(probe, "1");
      global.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  function rawGet(key) {
    if (hasLocalStorage) return global.localStorage.getItem(key);
    return memoryFallback.has(key) ? memoryFallback.get(key) : null;
  }
  function rawSet(key, value) {
    if (hasLocalStorage) { global.localStorage.setItem(key, value); return; }
    memoryFallback.set(key, value);
  }
  function rawRemove(key) {
    if (hasLocalStorage) { global.localStorage.removeItem(key); return; }
    memoryFallback.delete(key);
  }
  function rawKeys() {
    if (hasLocalStorage) {
      const out = [];
      for (let i = 0; i < global.localStorage.length; i++) {
        const k = global.localStorage.key(i);
        if (k) out.push(k);
      }
      return out;
    }
    return Array.from(memoryFallback.keys());
  }

  const StorageService = {
    PREFIX,
    available: hasLocalStorage,
    async get(key) {
      const raw = rawGet(PREFIX + key);
      if (raw == null) return null;
      try { return JSON.parse(raw); }
      catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Loomwright] StorageService: corrupt JSON for", key, err);
        return null;
      }
    },
    async set(key, value) {
      try {
        rawSet(PREFIX + key, JSON.stringify(value));
        global.dispatchEvent && global.dispatchEvent(new CustomEvent("lw:storage-change", {
          detail: { key, value },
        }));
        return true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Loomwright] StorageService.set failed for", key, err);
        return false;
      }
    },
    async remove(key) {
      rawRemove(PREFIX + key);
      global.dispatchEvent && global.dispatchEvent(new CustomEvent("lw:storage-change", {
        detail: { key, value: null },
      }));
    },
    async keys() {
      return rawKeys()
        .filter((k) => k && k.startsWith(PREFIX))
        .map((k) => k.slice(PREFIX.length));
    },
    async getAll() {
      const out = {};
      const keys = await StorageService.keys();
      for (const k of keys) {
        out[k] = await StorageService.get(k);
      }
      return out;
    },
    async setAll(bundle) {
      if (!bundle || typeof bundle !== "object") return false;
      for (const [k, v] of Object.entries(bundle)) {
        await StorageService.set(k, v);
      }
      return true;
    },
    async clear() {
      const keys = await StorageService.keys();
      for (const k of keys) rawRemove(PREFIX + k);
      global.dispatchEvent && global.dispatchEvent(new CustomEvent("lw:storage-change", {
        detail: { key: "*", value: null },
      }));
    },
  };

  global.StorageService = StorageService;
  global.Loomwright = global.Loomwright || {};
  global.Loomwright.StorageService = StorageService;
})(typeof window !== "undefined" ? window : globalThis);
