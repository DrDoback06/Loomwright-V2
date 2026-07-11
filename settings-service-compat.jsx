// =====================================================================
// settings-service-compat.jsx — compatibility for early extension scripts.
//
// SettingsService's canonical write method is saveSection(). Some prototype
// integrations used setSection(). Keep that alias so older project scripts and
// extensions continue to work while all writes still flow through the same
// audited SettingsService implementation.
// =====================================================================

(function () {
  const settings = window.LoomwrightBackend?.SettingsService;
  if (!settings || settings.setSection || typeof settings.saveSection !== "function") return;
  settings.setSection = settings.saveSection.bind(settings);
})();
