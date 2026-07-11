// =====================================================================
// live-tangle-panel-bridge.jsx — inserts the canonical Tangle mount host into
// the actual routed p-tangle placeholder used by the panel stack and owns the
// stable pointer lifecycle for freeform node movement.
// =====================================================================

(function () {
  if (window.__LW_LIVE_TANGLE_PANEL_BRIDGE__) return;
  window.__LW_LIVE_TANGLE_PANEL_BRIDGE__ = true;

  const service = window.LoomwrightBackend?.LiveTangleService;

  function nodeIdFromElement(node) {
    const testId = node?.getAttribute?.("data-testid") || "";
    return testId.startsWith("live-tangle-node-") ? testId.slice("live-tangle-node-".length) : null;
  }

  function bindDragNode(node) {
    if (!node || node.dataset.liveTangleDragBound) return;
    const nodeId = nodeIdFromElement(node);
    if (!nodeId) return;
    node.dataset.liveTangleDragBound = "true";

    node.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.("button,input,textarea,select,a,[contenteditable='true']")) return;
      const activeService = window.LoomwrightBackend?.LiveTangleService || service;
      const stored = activeService?.loadStateSync?.().nodes?.find((row) => row.id === nodeId);
      if (!stored) return;

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startX = Number(stored.x) || 0;
      const startY = Number(stored.y) || 0;
      let nextX = startX;
      let nextY = startY;
      let moved = false;

      // Keep React's original drag handler from becoming a second owner of the
      // same mouse sequence. The later click event is left untouched, so normal
      // node selection still works when the pointer is not moved.
      event.preventDefault();
      event.stopImmediatePropagation();

      const move = (moveEvent) => {
        const dx = moveEvent.clientX - startClientX;
        const dy = moveEvent.clientY - startClientY;
        if (!moved && Math.hypot(dx, dy) < 3) return;
        moved = true;
        nextX = startX + dx;
        nextY = startY + dy;
        const current = document.querySelector(`[data-testid="live-tangle-node-${CSS.escape(nodeId)}"]`) || node;
        current.style.left = `${nextX}px`;
        current.style.top = `${nextY}px`;
        current.classList.add("is-dragging");
      };

      const finish = async () => {
        document.removeEventListener("mousemove", move, true);
        document.removeEventListener("mouseup", finish, true);
        const current = document.querySelector(`[data-testid="live-tangle-node-${CSS.escape(nodeId)}"]`) || node;
        current.classList.remove("is-dragging");
        if (!moved) return;
        try {
          await activeService.moveNode(nodeId, nextX, nextY);
        } catch (error) {
          current.style.left = `${startX}px`;
          current.style.top = `${startY}px`;
          console.warn("[LiveTangle] Could not persist node movement", error);
        }
      };

      document.addEventListener("mousemove", move, true);
      document.addEventListener("mouseup", finish, true);
    }, true);
  }

  function bindDragNodes(root = document) {
    if (root.matches?.("[data-testid^='live-tangle-node-']")) bindDragNode(root);
    root.querySelectorAll?.("[data-testid^='live-tangle-node-']").forEach(bindDragNode);
  }

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
    bindDragNodes(root);
    if (root !== document) bindDragNodes(document);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes?.forEach((node) => {
      if (node.nodeType === 1) bind(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("lw:open-panel", () => setTimeout(() => bind(document), 0));
  window.addEventListener("lw:backend-ready", () => setTimeout(() => bind(document), 0));
  window.addEventListener("lw:live-tangle-updated", () => setTimeout(() => bindDragNodes(document), 0));
  bind(document);
})();
