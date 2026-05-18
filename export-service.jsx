// =====================================================================
// export-service.jsx — Whole-project import/export and backup.
//
// Gathers all persistent stores into one JSON blob for download,
// and can restore from such a blob. Also provides partial exports
// (entity library, settings profile, etc.).
//
// Public API (on window.ExportService):
//   .exportProject()                 → Promise<void>  (triggers download)
//   .importProject(file|json)        → Promise<void>
//   .exportEntityLibrary()           → Promise<void>
//   .importEntityLibrary(file|json)  → Promise<void>
//   .exportSettingsProfile()         → Promise<void>
//   .importSettingsProfile(file|json)→ Promise<void>
//   .backupNow()                     → Promise<void>
//   .getProjectDataBlob()            → Promise<object>
// =====================================================================

const ExportService = (() => {

  function _triggerDownload(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function _readFileOrJson(input) {
    if (typeof input === "string") return JSON.parse(input);
    if (input && typeof input === "object" && !(input instanceof File)) return input;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result)); }
        catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(input);
    });
  }

  return {
    async getProjectDataBlob() {
      const entityData = await EntityService.exportAll();
      const references = await ReferencesService.exportAll();
      const onboarding = await OnboardingService.load();
      const intel = await ProjectIntelService.load();
      const settings = await StorageService.get("settings");
      const authors = await StorageService.get("authors");

      return {
        _loomwright: true,
        _version: "2.0",
        _exportedAt: new Date().toISOString(),
        entities: entityData.entities,
        reviewQueue: entityData.reviewQueue,
        references,
        onboarding,
        projectIntelligence: intel,
        settings,
        authors,
      };
    },

    async exportProject() {
      const data = await this.getProjectDataBlob();
      _triggerDownload(data, "loomwright-project-" + new Date().toISOString().slice(0, 10) + ".json");
    },

    async importProject(input) {
      const data = await _readFileOrJson(input);
      if (!data._loomwright) {
        throw new Error("Not a valid Loomwright project export.");
      }
      if (data.entities || data.reviewQueue) {
        await EntityService.importAll({ entities: data.entities, reviewQueue: data.reviewQueue });
      }
      if (data.references) {
        await ReferencesService.importAll(data.references);
      }
      if (data.onboarding) {
        await OnboardingService.save(data.onboarding);
      }
      if (data.projectIntelligence) {
        await ProjectIntelService.save(data.projectIntelligence);
      }
      if (data.settings) {
        await StorageService.set("settings", data.settings);
      }
      if (data.authors) {
        await StorageService.set("authors", data.authors);
      }
      window.dispatchEvent(new CustomEvent("lw:project-imported"));
    },

    async exportEntityLibrary() {
      const entityData = await EntityService.exportAll();
      _triggerDownload({
        _loomwright: true,
        _type: "entity-library",
        _exportedAt: new Date().toISOString(),
        entities: entityData.entities,
        reviewQueue: entityData.reviewQueue,
      }, "loomwright-entities-" + new Date().toISOString().slice(0, 10) + ".json");
    },

    async importEntityLibrary(input) {
      const data = await _readFileOrJson(input);
      if (data.entities) {
        await EntityService.importAll({ entities: data.entities, reviewQueue: data.reviewQueue || [] });
      }
    },

    async exportSettingsProfile() {
      const settings = await StorageService.get("settings");
      const authors = await StorageService.get("authors");
      _triggerDownload({
        _loomwright: true,
        _type: "settings-profile",
        _exportedAt: new Date().toISOString(),
        settings,
        authors,
      }, "loomwright-settings-" + new Date().toISOString().slice(0, 10) + ".json");
    },

    async importSettingsProfile(input) {
      const data = await _readFileOrJson(input);
      if (data.settings) await StorageService.set("settings", data.settings);
      if (data.authors) await StorageService.set("authors", data.authors);
      window.dispatchEvent(new CustomEvent("lw:settings-imported"));
    },

    async backupNow() {
      return this.exportProject();
    },
  };
})();

window.ExportService = ExportService;
