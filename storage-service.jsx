// =====================================================================
// storage-service.jsx — Persistent storage abstraction.
//
// Wraps IndexedDB (via localForage loaded from CDN) with a clean
// async API. Falls back to localStorage if localForage is unavailable.
//
// All Loomwright persistence flows through this single service so
// storage backend can be swapped without touching feature code.
//
// Public API (on window.StorageService):
//   .get(key)           → Promise<any>
//   .set(key, value)    → Promise<void>
//   .remove(key)        → Promise<void>
//   .keys()             → Promise<string[]>
//   .clear()            → Promise<void>
//   .getAll()           → Promise<Record<string, any>>
//   .setAll(data)       → Promise<void>
//   .isReady            → boolean
// =====================================================================

const StorageService = (() => {
  const PREFIX = "lw_";
  let backend = null;
  let ready = false;

  // Detect localForage (loaded from CDN before this script)
  const lf = typeof localforage !== "undefined" ? localforage : null;

  if (lf) {
    backend = lf.createInstance({
      name: "loomwright",
      storeName: "lw_store",
      description: "Loomwright v2 persistent data",
    });
    ready = true;
  } else {
    // localStorage fallback — synchronous but wrapped in Promises for
    // a consistent API surface.
    backend = {
      async getItem(key) {
        try {
          const raw = localStorage.getItem(PREFIX + key);
          return raw === null ? null : JSON.parse(raw);
        } catch { return null; }
      },
      async setItem(key, value) {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      },
      async removeItem(key) {
        localStorage.removeItem(PREFIX + key);
      },
      async keys() {
        const out = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
        }
        return out;
      },
      async clear() {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX)) toRemove.push(k);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      },
    };
    ready = true;
  }

  return {
    get isReady() { return ready; },

    async get(key) {
      return backend.getItem(key);
    },

    async set(key, value) {
      await backend.setItem(key, value);
      window.dispatchEvent(new CustomEvent("lw:storage-changed", { detail: { key, value } }));
    },

    async remove(key) {
      await backend.removeItem(key);
      window.dispatchEvent(new CustomEvent("lw:storage-changed", { detail: { key, value: null } }));
    },

    async keys() {
      return backend.keys();
    },

    async clear() {
      await backend.clear();
      window.dispatchEvent(new CustomEvent("lw:storage-changed", { detail: { key: "*", value: null } }));
    },

    async getAll() {
      const allKeys = await this.keys();
      const result = {};
      for (const k of allKeys) {
        result[k] = await this.get(k);
      }
      return result;
    },

    async setAll(data) {
      for (const [k, v] of Object.entries(data)) {
        await this.set(k, v);
      }
    },
  };
})();

window.StorageService = StorageService;
