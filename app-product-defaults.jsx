// =====================================================================
// app-product-defaults.jsx — final product defaults applied after app.jsx.
//
// React 18 schedules the root render after the current script turn, so clearing
// the shared INITIAL_PANELS array here makes AppShell's existing useState path
// start empty without introducing a second panel store. The DOM fallback closes
// legacy first-paint panels through their existing controls if a synchronous
// renderer or cached shell has already mounted them.
// =====================================================================

(function () {
  try {
    if (typeof INITIAL_PANELS !== "undefined" && Array.isArray(INITIAL_PANELS)) {
      INITIAL_PANELS.splice(0, INITIAL_PANELS.length);
    }
  } catch (_) {}

  const clearLegacyFirstPaintPanels = () => {
    const panels = [...document.querySelectorAll("[data-ui='SlidingPanel']")];
    if (!panels.length) return;
    // Only clear the old automatic trio. User-opened panels are never touched.
    const legacyIds = new Set(["p-locations", "p-quests", "p-tangle"]);
    panels.forEach((panel) => {
      const id = panel.getAttribute("data-panel-id");
      if (!legacyIds.has(id)) return;
      panel.querySelector("[data-callback='onClosePanel']")?.click();
    });
  };

  // Fallback for any runtime where root rendering commits synchronously.
  queueMicrotask(clearLegacyFirstPaintPanels);
  window.addEventListener("lw:backend-ready", () => setTimeout(clearLegacyFirstPaintPanels, 0), { once: true });
})();
