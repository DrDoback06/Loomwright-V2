// =====================================================================
// live-tangle-panel-bridge.jsx — inserts the canonical Tangle mount host into
// the actual routed p-tangle placeholder used by the panel stack.
// =====================================================================

(function () {
  if (window.__LW_LIVE_TANGLE_PANEL_BRIDGE__) return;
  window.__LW_LIVE_TANGLE_PANEL_BRIDGE__ = true;

  function install(panel) {
    if (!panel) return;
    const body = panel.querySelector(":scope > .panel__body") || panel.querySelector(".panel__body");
    if (!body || body.querySelector("[data-live-tangle-route-host='true']")) return;
    Array.from(body.children).forEach((child) => {
      child.hidden = true;
      child.setAttribute("aria-hidden", "true");
      child.dataset.liveTangleRouteLegacy = "true";
    });
    const host = document.createElement("div");
    host.className = "tan-side";
    host.setAttribute("data-ui", "TanglePanelBody");
    host.setAttribute("data-live-tangle-route-host", "true");
    body.appendChild(host);
  }

  function bind(root = document) {
    const panels = [];
    if (root.matches?.("[data-panel-id='p-tangle']")) panels.push(root);
    root.querySelectorAll?.("[data-panel-id='p-tangle']").forEach((panel) => panels.push(panel));
    document.querySelectorAll("[data-panel-id='p-tangle']").forEach((panel) => panels.push(panel));
    [...new Set(panels)].forEach(install);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes?.forEach((node) => {
      if (node.nodeType === 1) bind(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("lw:open-panel", () => setTimeout(() => bind(document), 0));
  window.addEventListener("lw:backend-ready", () => setTimeout(() => bind(document), 0));
  bind(document);
})();
