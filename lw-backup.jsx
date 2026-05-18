// =====================================================================
// lw-backup.jsx — Project import / export backup (Phase 11).
//
// Bundles every Loomwright service's storage into a single JSON document
// the user can download, then accepts the same shape on restore. The
// envelope is versioned so future migrations have something to match on.
// =====================================================================

(function initLwBackup(global) {
  const Storage = global.StorageService;
  if (!Storage) {
    // eslint-disable-next-line no-console
    console.error("[Loomwright] lw-backup.jsx loaded before lw-storage.jsx");
    return;
  }

  const BACKUP_VERSION = 1;
  // Whitelist of storage slices we round-trip. Keeping this explicit avoids
  // accidentally exporting ephemeral debug state and forces forward-thinking
  // when new services land.
  const BACKUP_SLICES = [
    "entities", "chapters", "references", "onboarding", "project_intel",
    "review_queue", "settings", "author_profiles", "ai_routing",
    "handoff_history", "ai_keys", "byok_passphrase", "byok_salt",
  ];

  async function exportBundle() {
    const data = {};
    for (const key of BACKUP_SLICES) {
      data[key] = (await Storage.get(key)) ?? null;
    }
    return {
      schema: "loomwright/backup/v" + BACKUP_VERSION,
      generatedAt: new Date().toISOString(),
      data,
    };
  }

  async function downloadBundle(filename) {
    const bundle = await exportBundle();
    const json = JSON.stringify(bundle, null, 2);
    if (!global.document || !global.URL) return json;
    const blob = new Blob([json], { type: "application/json" });
    const url = global.URL.createObjectURL(blob);
    const a = global.document.createElement("a");
    a.href = url;
    a.download = filename || ("loomwright-export-" + Date.now() + ".json");
    global.document.body.appendChild(a);
    a.click();
    setTimeout(() => { global.URL.revokeObjectURL(url); a.remove(); }, 250);
    return json;
  }

  async function importBundle(bundle) {
    if (!bundle || typeof bundle !== "object") {
      throw new Error("Import payload must be an object");
    }
    const payload = bundle.data && typeof bundle.data === "object" ? bundle.data : bundle;
    const applied = [];
    for (const key of BACKUP_SLICES) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        await Storage.set(key, payload[key]);
        applied.push(key);
      }
    }
    global.dispatchEvent(new CustomEvent("lw:backup-imported", { detail: { applied } }));
    return { applied };
  }

  async function importFromFile(file) {
    if (!file) throw new Error("No file selected");
    const text = await file.text();
    const parsed = JSON.parse(text);
    return await importBundle(parsed);
  }

  async function clearProject() {
    await Storage.clear();
    global.dispatchEvent(new CustomEvent("lw:backup-cleared"));
  }

  const BackupService = {
    BACKUP_VERSION,
    BACKUP_SLICES,
    exportBundle,
    downloadBundle,
    importBundle,
    importFromFile,
    clearProject,
  };

  global.BackupService = BackupService;
  global.Loomwright = Object.assign(global.Loomwright || {}, { BackupService });
})(typeof window !== "undefined" ? window : globalThis);
