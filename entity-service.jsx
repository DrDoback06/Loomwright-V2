// =====================================================================
// entity-service.jsx — Entity persistence layer.
//
// Normalised store: one flat object keyed by entity id.
// On first load, seeds from ENTITY_SAMPLES if the store is empty.
//
// Public API (on window.EntityService):
//   .init()                           → Promise<void>
//   .list(type?)                      → Promise<Entity[]>
//   .get(id)                          → Promise<Entity|null>
//   .save(entity)                     → Promise<Entity>
//   .saveDraft(type, fields)          → Promise<Entity>
//   .saveActive(type, fields)         → Promise<Entity>
//   .delete(id)                       → Promise<void>
//   .softDelete(id)                   → Promise<Entity>
//   .restore(id)                      → Promise<Entity>
//   .permanentlyDelete(id)            → Promise<void>
//   .search(query, type?)             → Promise<Entity[]>
//   .getReviewQueue(type?)            → Promise<Entity[]>
//   .counts()                         → Promise<Record<string, number>>
//   .exportAll()                      → Promise<object>
//   .importAll(data)                  → Promise<void>
//
// Storage key: "entities"
// =====================================================================

const EntityService = (() => {
  const STORE_KEY = "entities";
  const REVIEW_KEY = "review_queue";
  let _cache = null;
  let _reviewCache = null;

  function generateId() {
    return "e-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function timestamp() {
    return new Date().toISOString();
  }

  async function _load() {
    if (_cache) return _cache;
    _cache = (await StorageService.get(STORE_KEY)) || {};
    return _cache;
  }

  async function _persist() {
    await StorageService.set(STORE_KEY, _cache);
  }

  async function _loadReview() {
    if (_reviewCache) return _reviewCache;
    _reviewCache = (await StorageService.get(REVIEW_KEY)) || [];
    return _reviewCache;
  }

  async function _persistReview() {
    await StorageService.set(REVIEW_KEY, _reviewCache);
  }

  function _seedFromSamples() {
    const samples = typeof ENTITY_SAMPLES !== "undefined" ? ENTITY_SAMPLES : {};
    const now = timestamp();
    const seeded = {};
    for (const [type, entries] of Object.entries(samples)) {
      for (const entry of entries) {
        const entity = {
          ...entry,
          type: entry.type || type,
          status: entry.status || "active",
          createdAt: entry.createdAt || now,
          updatedAt: entry.updatedAt || now,
        };
        seeded[entity.id] = entity;
      }
    }
    return seeded;
  }

  // Listen for external storage changes (e.g. import) to invalidate cache
  window.addEventListener("lw:storage-changed", (e) => {
    if (e.detail && (e.detail.key === STORE_KEY || e.detail.key === "*")) {
      _cache = null;
    }
    if (e.detail && (e.detail.key === REVIEW_KEY || e.detail.key === "*")) {
      _reviewCache = null;
    }
  });

  return {
    async init() {
      const store = await _load();
      if (Object.keys(store).length === 0) {
        _cache = _seedFromSamples();
        await _persist();
      }
    },

    async list(type) {
      const store = await _load();
      const all = Object.values(store);
      if (!type) return all.filter((e) => e.status !== "deleted");
      return all.filter((e) => e.type === type && e.status !== "deleted");
    },

    async get(id) {
      const store = await _load();
      return store[id] || null;
    },

    async save(entity) {
      const store = await _load();
      const now = timestamp();
      const existing = store[entity.id];
      const merged = {
        ...existing,
        ...entity,
        id: entity.id || generateId(),
        updatedAt: now,
        createdAt: existing ? existing.createdAt : (entity.createdAt || now),
      };
      store[merged.id] = merged;
      _cache = store;
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:entity-changed", { detail: { entity: merged, action: existing ? "update" : "create" } }));
      return merged;
    },

    async saveDraft(type, fields) {
      const entity = {
        ...fields,
        id: fields.id || generateId(),
        type,
        status: "draft",
      };
      return this.save(entity);
    },

    async saveActive(type, fields) {
      const entity = {
        ...fields,
        id: fields.id || generateId(),
        type,
        status: "active",
      };
      return this.save(entity);
    },

    async delete(id) {
      return this.softDelete(id);
    },

    async softDelete(id) {
      const store = await _load();
      if (!store[id]) return null;
      store[id] = { ...store[id], status: "deleted", deletedAt: timestamp(), updatedAt: timestamp() };
      _cache = store;
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:entity-changed", { detail: { entity: store[id], action: "delete" } }));
      return store[id];
    },

    async restore(id) {
      const store = await _load();
      if (!store[id]) return null;
      const prev = store[id].previousStatus || "active";
      store[id] = { ...store[id], status: prev, deletedAt: null, updatedAt: timestamp() };
      delete store[id].previousStatus;
      _cache = store;
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:entity-changed", { detail: { entity: store[id], action: "restore" } }));
      return store[id];
    },

    async permanentlyDelete(id) {
      const store = await _load();
      const entity = store[id];
      delete store[id];
      _cache = store;
      await _persist();
      window.dispatchEvent(new CustomEvent("lw:entity-changed", { detail: { entity, action: "permanent-delete" } }));
    },

    async search(query, type) {
      const all = await this.list(type);
      if (!query) return all;
      const q = query.toLowerCase();
      return all.filter((e) =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.summary && e.summary.toLowerCase().includes(q)) ||
        (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(q)))
      );
    },

    async getDeleted() {
      const store = await _load();
      return Object.values(store).filter((e) => e.status === "deleted");
    },

    async getReviewQueue(type) {
      const items = await _loadReview();
      if (!type) return items;
      return items.filter((item) => item.entityType === type);
    },

    async addReviewItem(item) {
      const items = await _loadReview();
      items.push({
        ...item,
        id: item.id || generateId(),
        createdAt: timestamp(),
        reviewStatus: item.reviewStatus || "pending",
      });
      _reviewCache = items;
      await _persistReview();
      window.dispatchEvent(new CustomEvent("lw:review-changed", { detail: { action: "add", item } }));
      return items;
    },

    async resolveReviewItem(id, action) {
      const items = await _loadReview();
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], reviewStatus: action, resolvedAt: timestamp() };
        _reviewCache = items;
        await _persistReview();
      }
      return items;
    },

    async counts() {
      const store = await _load();
      const result = {};
      for (const e of Object.values(store)) {
        if (e.status === "deleted") continue;
        result[e.type] = (result[e.type] || 0) + 1;
      }
      return result;
    },

    async exportAll() {
      const store = await _load();
      const review = await _loadReview();
      return { entities: store, reviewQueue: review };
    },

    async importAll(data) {
      if (data.entities) {
        _cache = data.entities;
        await _persist();
      }
      if (data.reviewQueue) {
        _reviewCache = data.reviewQueue;
        await _persistReview();
      }
      window.dispatchEvent(new CustomEvent("lw:entity-changed", { detail: { action: "import" } }));
    },

    generateId,
  };
})();

window.EntityService = EntityService;
