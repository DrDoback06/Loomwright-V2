// =====================================================================
// app.jsx — AppShell + main App, wires all parts together
// =====================================================================

const { useState: _us_a, useEffect: _ue_a, useCallback: _uc_a, useRef: _ur_a } = React;

// ---------------------------------------------------------------------
// Tweaks defaults — persisted via __edit_mode_set_keys (host rewrites file)
// ---------------------------------------------------------------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandName": "Loomwright",
  "brandShort": "LW",
  "brandTagline": "Shape the book. Track the world.",
  "logoMark": "wax-seal",
  "theme": "parchment-light",
  "accent": "#9a7b3a",
  "typeset": "literary",
  "density": "balanced",
  "leftRailDefault": "expanded",
  "panelBehavior": "stack-right",
  "demoState": "default"
}/*EDITMODE-END*/;

// ---------------------------------------------------------------------
// Single source of truth for panel definitions.
//
// One stable id per panelKind. INITIAL_PANELS and any "open this kind"
// callsite share these definitions so we can never create a duplicate
// Cast / Atlas / Items / … panel.
// ---------------------------------------------------------------------
const PANEL_PRESETS = {
  // Utility / system panels
  review:        { id: "p-review",        kind: "system", icon: "bell",     title: "Review Queue",       subtitle: "Pending decisions",         state: "review" },
  today:         { id: "p-today",         kind: "system", icon: "sparkle",  title: "Today",              subtitle: "Suggestions for today",     state: "suggestion" },
  recent:        { id: "p-recent",        kind: "system", icon: "clock",    title: "Recent entities",    subtitle: "Last 24 hours",             state: "overview", rows: [
    { id: "r1", label: "Aelinor Vey",   meta: "2m ago" },
    { id: "r2", label: "Pale Reach",    meta: "11m ago" },
    { id: "r3", label: "Auger of Hess", meta: "1h ago" },
  ]},
  refs:          { id: "p-refs",          kind: "system", icon: "paper",    title: "Active references",  subtitle: "Linked sources",            state: "empty" },
  trash:         { id: "p-trash",         kind: "system", icon: "trash",    title: "Trash",              subtitle: "30-day retention",          state: "empty" },
  notifs:        { id: "p-notifs",        kind: "system", icon: "warn",     title: "Notifications",      subtitle: "Warnings & alerts",         state: "empty" },
  settings:      { id: "p-settings",      kind: "system", icon: "gear",     title: "Settings",           subtitle: "Project & workspace",       state: "empty" },
  tangle:        { id: "p-tangle",        kind: "system", icon: "knot",     title: "Tangle",             subtitle: "Plot-thread graph (soon)",  state: "empty" },
  speedReader:   { id: "p-speedReader",   kind: "system", icon: "eye",      title: "Speed Reader",       subtitle: "Skim the manuscript",       state: "empty" },
  aiWriter:      { id: "p-aiWriter",      kind: "system", icon: "sparkle",  title: "AI Writer",          subtitle: "Drafting assistant",        state: "overview" },

  // Entity panels — render through CastPanelBody / AtlasPanelBody /
  // EntityFrameworkPanelBody depending on entityType. Each picks up its
  // bespoke detail renderer from window.RPG_DETAIL_RENDERERS automatically.
  cast:          { id: "p-cast",          kind: "entity", entityType: "cast",          title: "Cast",          subtitle: "12 entries · 3 in review",  state: "overview", rows: [
    { id: "c1", label: "Aelinor Vey",   meta: "Ch.1–7", selected: true },
    { id: "c2", label: "Saren of Hess", meta: "Ch.3–7", queue: 1 },
    { id: "c3", label: "Captain Brec",  meta: "Ch.2–5" },
    { id: "c4", label: "The Auger",     meta: "Ch.7" },
    { id: "c5", label: "Mara of Hess",  meta: "Ch.4" },
    { id: "c6", label: "Dav the Quiet", meta: "Ch.6", queue: 1 },
  ], selected: { label: "Aelinor Vey" } },
  atlas:         { id: "p-atlas",         kind: "entity", entityType: "atlas",         title: "Atlas",         subtitle: "Live tracker · 11 places",  state: "overview", expanded: true },
  bestiary:      { id: "p-bestiary",      kind: "entity", entityType: "bestiary",      title: "Bestiary",      subtitle: "3 creatures",                state: "overview" },
  locations:     { id: "p-locations",     kind: "entity", entityType: "locations",     title: "Locations",     subtitle: "Atlas index",                state: "overview" },
  items:         { id: "p-items",         kind: "entity", entityType: "items",         title: "Items",         subtitle: "4 catalogued · 1 in review", state: "overview" },
  classes:       { id: "p-classes",       kind: "entity", entityType: "classes",       title: "Classes",       subtitle: "3 defined",                  state: "overview" },
  races:         { id: "p-races",         kind: "entity", entityType: "races",         title: "Races",         subtitle: "2 defined",                  state: "overview" },
  stats:         { id: "p-stats",         kind: "entity", entityType: "stats",         title: "Stats",         subtitle: "4 stats · rules wired",      state: "overview" },
  abilities:     { id: "p-abilities",     kind: "entity", entityType: "abilities",     title: "Abilities",     subtitle: "3 defined · 1 in review",    state: "overview" },
  skillTrees:    { id: "p-skillTrees",    kind: "entity", entityType: "skills",        title: "Skill Trees",   subtitle: "2 trees",                    state: "overview" },
  relationships: { id: "p-relationships", kind: "entity", entityType: "relationships", title: "Relationships", subtitle: "2 active",                   state: "overview" },
  quests:        { id: "p-quests",        kind: "entity", entityType: "quests",        title: "Quests",        subtitle: "2 active",                   state: "overview" },
  events:        { id: "p-events",        kind: "entity", entityType: "events",        title: "Events",        subtitle: "2 logged",                   state: "overview" },
  timeline:      { id: "p-timeline",      kind: "entity", entityType: "timeline",      title: "Timeline",      subtitle: "Days, eras, hours",          state: "overview", rows: [
    { id: "t1", label: "The Auger Wake", meta: "Last week" },
    { id: "t2", label: "Brec's letter",  meta: "3 nights ago" },
  ]},
  lore:          { id: "p-lore",          kind: "entity", entityType: "lore",          title: "Lore / Canon",  subtitle: "2 entries",                  state: "overview" },
  references:    { id: "p-references",    kind: "entity", entityType: "references",    title: "References",    subtitle: "2 sources",                  state: "overview" },

  // Workspace demo placeholder (used by Workspace's "Open demo panel" cta).
  demo:          { id: "p-demo",          kind: "entity", entityType: "locations",     title: "Locations",     subtitle: "Demo panel from workspace",  state: "loading" },
};

// Reverse lookup: id → panelKind. Built once so the LeftRail can ask
// "is the panel with this kind open?" without scanning the table on
// every render.
const PANELKIND_BY_ID = Object.fromEntries(
  Object.entries(PANEL_PRESETS).map(([k, p]) => [p.id, k])
);

// First-paint open panels — read straight from PANEL_PRESETS so we
// never define a phantom panel that doesn't match the rail's lookup.
// Showcase the v2 upgraded panels alongside Atlas so the user sees
// the new work immediately.
const INITIAL_PANELS = [
  { ...PANEL_PRESETS.locations, pinned: false, expanded: false, collapsed: false, fullScreen: false, dockMode: "docked", order: 1 },
  { ...PANEL_PRESETS.quests,    pinned: false, expanded: false, collapsed: false, fullScreen: false, dockMode: "docked", order: 2 },
  { ...PANEL_PRESETS.tangle,    pinned: false, expanded: false, collapsed: false, fullScreen: false, dockMode: "docked", order: 3 },
];

// ---------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------
const AppShell = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [layout, setLayout] = useLayoutState();

  // Brand object derived from tweaks (ALL naming sources from here)
  const brand = {
    ...BRAND,
    name: tweaks.brandName,
    shortName: tweaks.brandShort,
    tagline: tweaks.brandTagline,
    logoMark: tweaks.logoMark,
    theme: tweaks.theme,
    colors: { ...BRAND.colors, accent: tweaks.accent },
  };

  // Apply theme + density + typeset to <html>
  _ue_a(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", tweaks.theme);
    html.setAttribute("data-density", tweaks.density);
    html.setAttribute("data-typeset", tweaks.typeset);
    // Accent override
    html.style.setProperty("--accent", tweaks.accent);
    // Derive deep & soft from accent (basic adjust)
    html.style.setProperty("--accent-deep", shadeColor(tweaks.accent, -0.35));
    html.style.setProperty("--accent-soft", shadeColor(tweaks.accent, 0.55));
  }, [tweaks.theme, tweaks.density, tweaks.typeset, tweaks.accent]);

  // App view: shell or design system
  const [view, setView] = _us_a("shell");

  // Routing — only true full-screen routes live here.
  // Valid: home, today, writers-room, settings.
  const [routeId, setRouteId] = _us_a("writers-room");

  // Left rail expansion (the only rail now)
  const [leftExpanded, setLeftExpanded] = _us_a(tweaks.leftRailDefault === "expanded");
  _ue_a(() => setLeftExpanded(tweaks.leftRailDefault === "expanded"), [tweaks.leftRailDefault]);


  // Status / chips
  const [privacyMode, setPrivacyMode] = _us_a("local");
  const [syncState, setSyncState] = _us_a("saved");

  // Panels (docked side-panel stack)
  const [panels, setPanels] = _us_a(INITIAL_PANELS);
  const [dataVersion, setDataVersion] = _us_a(0);
  const [lastRailClick, setLastRailClick] = _us_a(null);

  // Cross-panel focus map: { [entityType]: { id, label, ts } }
  // Each panel sees focuses for OTHER types and renders a filter chip.
  const [focusedByType, setFocusedByType] = _us_a({});

  // Command palette
  const [paletteOpen, setPaletteOpen] = _us_a(false);

  // Adaptive wheel
  const [wheel, setWheel] = _us_a({ open: false, x: 0, y: 0, contextLabel: "Workspace" });

  // Overlay demo state — lets the Tweaks panel preview palette/wheel states.
  // "ready" | "loading" | "error" | "empty-source"
  const [paletteState, setPaletteState] = _us_a("ready");
  // wheelState: "ready" | "loading" | "error" | "slot-loading" | "slot-error" | "selected"
  const [wheelDemoState, setWheelDemoState] = _us_a("ready");

  // Demo state for empty/loading/error
  const [demoState, setDemoState] = _us_a(tweaks.demoState);
  _ue_a(() => setDemoState(tweaks.demoState), [tweaks.demoState]);

  // Drag target glow demo (cycles for the visual)
  const [dropTargetId, setDropTargetId] = _us_a(null);

  // ----- Entity Editor (right-docked, 75% width) -----
  const [editor, setEditor] = _us_a({ open: false, type: null, initial: null, mode: null, promoteFrom: null });
  const openEntityEditor = _uc_a((opts = {}) => {
    setEditor({
      open: true,
      type: opts.type || opts.entityType || "generic",
      initial: opts.initial || null,
      mode: opts.mode || "full",
      promoteFrom: opts.promoteFrom || null,
    });
  }, []);
  const closeEntityEditor = _uc_a(() => setEditor((s) => ({ ...s, open: false })), []);

  // ----- Full-screen panel workspace -----
  // Stack-discipline: only one full workspace is active at a time.
  // Opening a different workspace REPLACES the current one (the per-tab
  // exit/restore behaviour preserves panel state regardless because we
  // never destroy panels when entering/leaving a workspace).
  const [panelWorkspace, setPanelWorkspace] = _us_a({ open: false, id: null, panelKind: null, sourcePanel: null, name: null });
  const openPanelWorkspace = _uc_a((opts = {}) => {
    const { workspaceId, panelKind, sourcePanel } = opts;
    if (!workspaceId) return;
    // Lookup the access entry to get the workspace display name
    const access = (typeof PANEL_ACCESS !== "undefined") ? PANEL_ACCESS[panelKind] || PANEL_ACCESS[sourcePanel] : null;
    // "existing" workspaces (atlas-editor / skill-tree-editor / abilities)
    // are owned by the panel body — we just bring the panel to front and
    // ask it to enter its in-body full-screen via a custom event.
    if (access && access.workspaceMode === "existing") {
      // Make sure the panel is open + bring to front.
      const railKind = panelKind === "atlas" ? "atlas"
        : (panelKind === "skills" || panelKind === "abilities") ? "skillTrees"
        : panelKind;
      onOpenPanel(railKind);
      // Defer the dispatch by one frame so the panel body has mounted and
      // registered its `lw:open-existing-fullscreen` listener before we fire.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", {
          detail: { panelKind, workspaceId, sourcePanel },
        }));
      }, 60);
      return;
    }
    setPanelWorkspace({
      open: true,
      id: workspaceId,
      panelKind,
      sourcePanel,
      name: access ? access.workspaceName : workspaceId,
    });
  }, []);
  const exitPanelWorkspace = _uc_a(() => setPanelWorkspace((s) => ({ ...s, open: false })), []);

  // ----- Writer's Room Composition Overlay -----
  const [overlay, setOverlay] = _us_a(() => {
    const persisted = window.LoomwrightBackend?.CompositionService?.loadSync(null);
    return persisted || {
      open: false, minimised: false, pinned: false,
      entities: [], instructions: "",
      settings: { mode: "new-scene", pov: "Match current", length: "Medium (400–800)", tone: "Match manuscript voice" },
      contextOptions: { currentChapter: true, projectIntel: true, obeyCanon: true, preserveVoices: true, avoidContradictions: true },
    };
  });
  const openCompositionOverlay = _uc_a(() => setOverlay((s) => ({ ...s, open: true, minimised: false })), []);
  const closeCompositionOverlay = _uc_a(() => setOverlay((s) => ({ ...s, open: false })), []);
  const minimiseCompositionOverlay = _uc_a(() => setOverlay((s) => ({ ...s, minimised: !s.minimised })), []);
  const pinCompositionOverlay = _uc_a(() => setOverlay((s) => ({ ...s, pinned: !s.pinned })), []);
  const dropEntityIntoComposition = _uc_a((payload) => {
    setOverlay((s) => {
      const exists = s.entities.find((e) => e.id === payload.id && e.entityType === payload.entityType);
      if (exists) return { ...s, open: true, minimised: false };
      const next = [...s.entities, {
        ...payload,
        role: (window.CO_DEFAULT_ROLES_BY_TYPE || {})[payload.entityType] || "referenced",
      }];
      return { ...s, open: true, minimised: false, entities: next };
    });
  }, []);
  const removeEntityFromComposition = _uc_a((idx) => {
    setOverlay((s) => ({ ...s, entities: s.entities.filter((_, i) => i !== idx) }));
  }, []);
  const updateCompositionRole = _uc_a((idx, role) => {
    setOverlay((s) => ({ ...s, entities: s.entities.map((e, i) => i === idx ? { ...e, role } : e) }));
  }, []);
  const updateCompositionInstructions = _uc_a((text) => setOverlay((s) => ({ ...s, instructions: text })), []);
  const setCompositionSetting = _uc_a((key, value) => setOverlay((s) => ({ ...s, settings: { ...s.settings, [key]: value } })), []);
  const toggleCompositionContext = _uc_a((key) => setOverlay((s) => ({ ...s, contextOptions: { ...s.contextOptions, [key]: !s.contextOptions[key] } })), []);
  const clearCompositionAll = _uc_a(() => setOverlay((s) => ({ ...s, entities: [], instructions: "" })), []);

  _ue_a(() => {
    window.LoomwrightBackend?.CompositionService?.save(overlay);
  }, [overlay]);

  const decoratePanelWithLiveData = _uc_a((panel) => (
    window.LoomwrightBackend?.EntityService?.decoratePanel(panel) || panel
  ), []);

  const refreshPersistentData = _uc_a(() => {
    setDataVersion(Date.now());
    setPanels((curr) => curr.map((p) => decoratePanelWithLiveData(p)));
  }, [decoratePanelWithLiveData]);

  _ue_a(() => {
    const refresh = () => refreshPersistentData();
    window.addEventListener("lw:backend-ready", refresh);
    window.addEventListener("lw:entity-store-updated", refresh);
    window.addEventListener("lw:references-updated", refresh);
    window.addEventListener("lw:project-imported", refresh);
    refresh();
    return () => {
      window.removeEventListener("lw:backend-ready", refresh);
      window.removeEventListener("lw:entity-store-updated", refresh);
      window.removeEventListener("lw:references-updated", refresh);
      window.removeEventListener("lw:project-imported", refresh);
    };
  }, [refreshPersistentData]);

  _ue_a(() => {
    // Restore the last explicitly saved Writer's Room title/body snapshot.
    // The manuscript body is still demo-rendered React content; we restore
    // only user-edited text surfaces after mount to avoid redesigning it.
    const restore = () => {
      const canvas = document.querySelector("[data-ui='ManuscriptCanvas']");
      const chapterId = canvas?.getAttribute("data-chapter-id");
      if (!chapterId) return;
      const saved = window.LoomwrightBackend?.ManuscriptService?.loadChapterSync(chapterId);
      if (!saved) return;
      const title = canvas.querySelector(".wr-canvas__title");
      if (title && saved.title && title.innerText !== saved.title) title.innerText = saved.title;
    };
    const t = setTimeout(restore, 120);
    window.addEventListener("lw:manuscript-saved", restore);
    return () => {
      clearTimeout(t);
      window.removeEventListener("lw:manuscript-saved", restore);
    };
  }, [routeId, dataVersion]);

  // Listen for global "lw:open-entity-editor" / "lw:open-panel" events from
  // any panel that wants to launch the editor without prop-drilling.
  _ue_a(() => {
    const onOpenEd = (e) => openEntityEditor(e.detail || {});
    const onOpenPan = (e) => {
      if (e.detail && e.detail.kind) onOpenPanel(e.detail.kind);
    };
    const onDropToComp = (e) => dropEntityIntoComposition(e.detail || {});
    const onOpenWs = (e) => openPanelWorkspace(e.detail || {});
    const onExitWs = () => exitPanelWorkspace();
    const onRefAdd = (e) => {
      // Reference-flavoured create. Default = open generic reference editor.
      // Sub-actions can route differently in the future.
      openEntityEditor({ type: "references", mode: "full", initial: { kind: e?.detail?.actionId } });
    };
    const onSettingsAdd = (e) => {
      // Settings add — route the user into the Control Centre on the
      // matching section. If the workspace isn't open, open it.
      const actionId = e?.detail?.actionId;
      openPanelWorkspace({ workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" });
      // Toast or noop — sections are addressable inside the workspace UI.
      // (The Control Centre listens for this event to scroll to the right section.)
      window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId } }));
    };
    window.addEventListener("lw:open-entity-editor", onOpenEd);
    window.addEventListener("lw:open-panel", onOpenPan);
    window.addEventListener("lw:drop-to-composition", onDropToComp);
    window.addEventListener("lw:open-panel-workspace", onOpenWs);
    window.addEventListener("lw:exit-panel-workspace", onExitWs);
    window.addEventListener("lw:reference-add", onRefAdd);
    window.addEventListener("lw:settings-add", onSettingsAdd);
    return () => {
      window.removeEventListener("lw:open-entity-editor", onOpenEd);
      window.removeEventListener("lw:open-panel", onOpenPan);
      window.removeEventListener("lw:drop-to-composition", onDropToComp);
      window.removeEventListener("lw:open-panel-workspace", onOpenWs);
      window.removeEventListener("lw:exit-panel-workspace", onExitWs);
      window.removeEventListener("lw:reference-add", onRefAdd);
      window.removeEventListener("lw:settings-add", onSettingsAdd);
    };
  }, [openEntityEditor, openPanelWorkspace, exitPanelWorkspace]);

  // ----- callbacks -----
  const onToggleLeftRail = _uc_a(() => setLeftExpanded((v) => !v), []);
  const onTogglePrivacyMode = _uc_a(() => setPrivacyMode((m) => m === "local" ? "cloud" : m === "cloud" ? "ai" : "local"), []);
  const onOpenCommandPalette = _uc_a(() => setPaletteOpen(true), []);
  const onCloseCommandPalette = _uc_a(() => setPaletteOpen(false), []);

  // Open a panel. If a panel for this kind already exists, bring it to front
  // (newest order = right-most position in the unpinned stack).
  const onOpenPanel = _uc_a((kind, ctx = {}) => {
    setPanels((curr) => {
      const preset = PANEL_PRESETS[kind];
      if (!preset) return curr;
      const existing = curr.find((p) => p.id === preset.id);
      const maxOrder = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
      if (existing) {
        // Already open — bring to front and uncollapse.
        return curr.map((p) => p.id === preset.id ? { ...p, order: maxOrder + 1, collapsed: false } : p);
      }
      return [...curr, { ...preset, pinned: !!ctx.pinned, expanded: false, collapsed: false, order: maxOrder + 1 }];
    });
  }, []);

  // Left-rail click protocol (per panel rules brief):
  //   * closed panel        → open it
  //   * already-open panel  → bring to front + uncollapse (NEVER close)
  //   * cmd/ctrl + closed   → open AND pin
  //   * cmd/ctrl + open     → toggle pinned state
  // Panels only close via the panel's own close button or the adaptive wheel.
  const activatePanelFromRail = _uc_a((panelKind, ctx = {}) => {
    setPanels((curr) => {
      const preset = PANEL_PRESETS[panelKind];
      if (!preset) {
        // Diagnostic placeholder — missing preset must surface visibly, not silently.
        // eslint-disable-next-line no-console
        console.warn("[Loomwright] No PANEL_PRESETS entry for panelKind", panelKind);
        const maxOrder = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
        return [...curr, {
          id: "missing-" + panelKind, kind: "system", icon: "warn",
          title: "Missing preset: " + panelKind,
          subtitle: "Wire one up in app.jsx → PANEL_PRESETS.",
          state: "error",
          pinned: false, expanded: false, collapsed: false, fullScreen: false, dockMode: "docked",
          order: maxOrder + 1,
        }];
      }
      const existing = curr.find((p) => p.id === preset.id);
      const maxOrder = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
      if (existing) {
        if (ctx.meta) {
          // cmd-click on an open panel → toggle pinned state.
          return curr.map((p) => p.id === preset.id ? { ...p, pinned: !p.pinned, collapsed: false } : p);
        }
        // Plain click → bring to front, uncollapse. NEVER close.
        return curr.map((p) => p.id === preset.id ? { ...p, order: maxOrder + 1, collapsed: false } : p);
      }
      // Closed → open. Cmd-click opens AND pins. Honor preset's expanded/collapsed.
      return [...curr, {
        ...preset,
        pinned: !!ctx.meta || !!preset.pinned,
        expanded: preset.expanded ?? false,
        collapsed: false,
        fullScreen: false,
        dockMode: "docked",
        order: maxOrder + 1,
      }];
    });
    setLastRailClick({ panelKind, ctx, ts: Date.now() });
  }, []);
  // Legacy alias used in other call sites — preserved for compat.
  const onTogglePanel = activatePanelFromRail;
  const onClosePanel = _uc_a((id) => setPanels((curr) => curr.filter((p) => p.id !== id)), []);
  // Pinning moves the panel into the anchor zone (closest to manuscript).
  // When pinning we put it at the END of the pinned group (highest order among pinned).
  const onPinPanel = _uc_a((id) => setPanels((curr) => {
    const max = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
    return curr.map((p) => p.id === id ? { ...p, pinned: !p.pinned, collapsed: false, order: max + 1 } : p);
  }), []);
  const onExpandPanel = _uc_a((id) => setPanels((curr) => curr.map((p) => p.id === id ? { ...p, expanded: !p.expanded } : p)), []);
  // Restore a collapsed/overflow panel — bring to front, uncollapse.
  const onRestorePanel = _uc_a((id) => setPanels((curr) => {
    const max = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
    return curr.map((p) => p.id === id ? { ...p, collapsed: false, order: max + 1 } : p);
  }), []);
  const onBringPanelToFront = _uc_a((id) => setPanels((curr) => {
    const max = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
    return curr.map((p) => p.id === id ? { ...p, order: max + 1 } : p);
  }), []);
  const onReorderPanels = _uc_a((draggedId, targetId) => setPanels((curr) => {
    const dragged = curr.find((p) => p.id === draggedId);
    const target  = curr.find((p) => p.id === targetId);
    if (!dragged || !target) return curr;
    const sorted = [...curr].sort((a, b) => (a.order || 0) - (b.order || 0));
    const filtered = sorted.filter((p) => p.id !== draggedId);
    const idx = filtered.findIndex((p) => p.id === targetId);
    filtered.splice(idx, 0, dragged);
    return filtered.map((p, i) => ({ ...p, order: i }));
  }), []);
  const onApplyWorkspacePreset = _uc_a((presetId, panelKinds) => {
    if (presetId === "clear") { setPanels([]); return; }
    setPanels(() => {
      const next = (panelKinds || []).map((k, i) => {
        const preset = PANEL_PRESETS[k];
        if (!preset) return null;
        return { ...preset, pinned: false, expanded: false, collapsed: false, fullScreen: false, dockMode: "docked", order: i };
      }).filter(Boolean);
      return next;
    });
  }, []);
  // Selecting an entity in a panel:
  //  1. updates that panel's selection state
  //  2. broadcasts the selection into focusedByType so OTHER panels can filter by it
  const onSelectEntity = _uc_a((row, panel) => {
    setPanels((curr) => curr.map((p) => p.id === (panel && panel.id) || (!panel && (p.rows || []).find((r) => r.id === row.id))
      ? { ...p, rows: (p.rows || []).map((r) => ({ ...r, selected: r.id === row.id })), selected: row, state: "selected" }
      : p));
    const type = (panel && panel.entityType) || row.entityType;
    if (type) {
      setFocusedByType((m) => ({ ...m, [type]: { id: row.id, label: row.label, ts: Date.now() } }));
      window.__LW_LAST_SELECTION__ = { entityId: row.id, entityType: type, label: row.label };
    }
  }, []);
  const onClearPanelFilter = _uc_a((panelId) => {
    // Clear ALL focuses except this panel's own type — i.e. clear other-panel filters.
    setPanels((curr) => {
      const me = curr.find((p) => p.id === panelId);
      if (!me) return curr;
      setFocusedByType((m) => {
        const next = {};
        for (const k of Object.keys(m)) if (k === me.entityType) next[k] = m[k];
        return next;
      });
      return curr;
    });
  }, []);
  const onOpenReviewQueue = _uc_a(() => onOpenPanel("review"), [onOpenPanel]);

  // Settings opens the Control Centre as a full-screen workspace OVER the
  // current route (Writer's Room, Home, Today) — it must never route to the
  // generic Workspace placeholder. The current route is preserved so the
  // workspace's Exit button returns the user exactly where they were.
  const onOpenSettings = _uc_a(() => {
    openPanelWorkspace({
      workspaceId: "control-centre",
      panelKind:   "settings",
      sourcePanel: "p-settings",
    });
  }, [openPanelWorkspace]);

  // Map entity types (used in manuscript marks + extraction) to the panelKind
  // we should open / focus. Plural and singular aliases are both honoured.
  // factions has no top-level panel — it lives inside Lore. Skills and
  // Abilities both route to the Skill Trees panel.
  const ENTITY_TYPE_TO_PANEL_KIND = {
    cast: "cast", character: "cast", actor: "cast", characters: "cast",
    locations: "locations", location: "locations",
    atlas: "atlas",
    items: "items", item: "items",
    classes: "classes", class: "classes",
    races: "races", race: "races", species: "races",
    stats: "stats", stat: "stats",
    skills: "skillTrees", skill: "skillTrees", skilltree: "skillTrees", skilltrees: "skillTrees",
    abilities: "skillTrees", ability: "skillTrees",
    quests: "quests", quest: "quests",
    events: "events", event: "events",
    timeline: "timeline",
    bestiary: "bestiary", creature: "bestiary", creatures: "bestiary",
    factions: "lore", faction: "lore",
    lore: "lore", canon: "lore",
    references: "references", reference: "references",
    relationships: "relationships", relationship: "relationships",
  };

  // Double-click an entity mention in the Writer's Room manuscript →
  //   1. Open the relevant panel (or bring it to front if already open).
  //   2. Broadcast focus into focusedByType so the panel filters/highlights
  //      the right entity.
  //   3. Demo niceness: fuzzy-match the manuscript label against the panel's
  //      mock rows and mark the best match as selected so the user sees the
  //      panel actually highlight a row (panels keep their own row schema,
  //      so this is best-effort, not a contract — Claude Code will replace
  //      this with real id-based selection once entity state is unified).
  //   4. Do NOT open the full workspace; Writer's Room stays anchored.
  const onOpenEntityFromManuscript = _uc_a((detail) => {
    if (!detail || !detail.type) return;
    const panelKind = ENTITY_TYPE_TO_PANEL_KIND[detail.type] || detail.type;
    if (!PANEL_PRESETS[panelKind]) {
      // eslint-disable-next-line no-console
      console.warn("[Loomwright] No panel registered for entity type", detail.type, "→", panelKind);
      return;
    }
    const preset = PANEL_PRESETS[panelKind];
    const canonicalType = preset.entityType || detail.type;

    // Single combined panel update: open-or-front-front + try to select the
    // best-matching row by label. Keeps the demo feeling wired even though
    // there's no shared entity store.
    setPanels((curr) => {
      const existing = curr.find((p) => p.id === preset.id);
      const maxOrder = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);

      const selectMatchingRow = (panel) => {
        const rows = panel.rows || [];
        if (rows.length === 0) return panel;
        const backend = window.LoomwrightBackend?.EntityService;
        let match = null;
        if (detail.id && backend) {
          const entity = backend.getSync(detail.id, canonicalType);
          if (entity) {
            match = rows.find((r) => r.id === entity.id)
              || rows.find((r) => (r.label || "").toLowerCase() === (entity.name || "").toLowerCase());
          }
        }
        if (!match && detail.id) match = rows.find((r) => r.id === detail.id);
        if (!match) {
          const target = (detail.label || "").toLowerCase().trim();
          if (!target) return panel;
          const norm = (s) => (s || "").toLowerCase().trim();
          match = rows.find((r) => norm(r.label) === target)
               || rows.find((r) => norm(r.label).includes(target) || target.includes(norm(r.label)));
          if (!match) {
            const firstWord = target.split(/\s+/)[0];
            if (firstWord && firstWord.length >= 3) {
              match = rows.find((r) => norm(r.label).split(/\s+/).includes(firstWord));
            }
          }
        }
        if (!match) return panel;
        return {
          ...panel,
          rows: rows.map((r) => ({ ...r, selected: r.id === match.id })),
          selected: match,
          state: "selected",
        };
      };

      if (existing) {
        return curr.map((p) => p.id === preset.id
          ? selectMatchingRow({ ...p, order: maxOrder + 1, collapsed: false })
          : p);
      }
      const newPanel = {
        ...preset,
        pinned: !!preset.pinned,
        expanded: preset.expanded ?? false,
        collapsed: false,
        fullScreen: false,
        dockMode: "docked",
        order: maxOrder + 1,
      };
      return [...curr, selectMatchingRow(newPanel)];
    });

    // Broadcast focus so OTHER panels can react (cross-panel filter chips).
    // We write under BOTH the panel's canonical type and the manuscript's
    // mark type so detail renderers find it regardless of which key they read.
    setFocusedByType((m) => ({
      ...m,
      [canonicalType]: { id: detail.id, label: detail.label || detail.text, ts: Date.now() },
      [detail.type]:    { id: detail.id, label: detail.label || detail.text, ts: Date.now() },
    }));
  }, []);

  const saveEntityFromEditor = _uc_a((payload, opts = {}) => {
    const backend = window.LoomwrightBackend;
    const entityType = payload?.entityType || "generic";
    const fields = payload?.payload || {};
    const mode = opts.mode || "active";
    const status = mode === "draft" ? "draft" : "active";

    if (!backend?.EntityService) {
      if (mode === "compose") {
        dropEntityIntoComposition({
          entityType,
          id: fields.id || ("new-" + Date.now()),
          name: fields.name || fields.title || "Untitled",
          summary: fields.summary,
        });
      }
      return;
    }

    backend.EntityService.save(entityType, fields, { status }).then((entity) => {
      if (backend.EntityService.normaliseType(entityType) === "references") {
        backend.ReferencesService?.save({
          id: entity.id,
          kind: entity.kind || fields.kind || "note",
          title: entity.title || entity.name,
          content: entity.content || entity.summary || "",
          aiContext: entity.aiContext ?? true,
          style: entity.style,
          canon: entity.canon,
          linkedEntities: entity.linkedEntities || [],
        });
      }

      if (mode === "compose") {
        dropEntityIntoComposition({
          entityType: entity.type,
          id: entity.id,
          name: entity.name || entity.title || "Untitled",
          summary: entity.summary,
        });
      }

      const panelKind = ENTITY_TYPE_TO_PANEL_KIND[entity.type] || entity.type;
      if (PANEL_PRESETS[panelKind]) onOpenPanel(panelKind);
      refreshPersistentData();
      setSyncState("saved");
    }).catch((err) => {
      console.error("[Loomwright] Failed to save entity", err);
      setSyncState("error");
    });
  }, [dropEntityIntoComposition, onOpenPanel, refreshPersistentData]);

  const onOpenProfile = _uc_a(() => {}, []);
  const onSelectProject = _uc_a(() => {}, []);
  const onSelectBook = _uc_a(() => {}, []);

  const onOpenAdaptiveWheel = _uc_a((opts) => setWheel({ open: true, ...opts }), []);
  const onCloseAdaptiveWheel = _uc_a(() => setWheel((w) => ({ ...w, open: false })), []);
  const onRunWheelAction = _uc_a((id) => {
    setWheel((w) => ({ ...w, open: false }));
    if (id === "review")  onOpenPanel("review");
    if (id === "create")  onOpenPanel("demo");
    if (id === "extract") setSyncState("syncing");
  }, [onOpenPanel]);

  // Global keyboard
  _ue_a(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (meta && (e.key === "k" || e.key === "K")) {
        // ⌘K-hold to open wheel — we treat single press as open at center
        e.preventDefault();
        const r = document.querySelector("[data-ui='Workspace']")?.getBoundingClientRect();
        if (r) onOpenAdaptiveWheel({ x: r.left + r.width / 2, y: r.top + r.height / 2, contextLabel: "Workspace" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenAdaptiveWheel]);

  // Drop-target glow is wired up via dropTargetId; no demo cycle.

  // Compute global queue count
  const globalQueueCount = NAV_ITEMS.reduce((acc, n) => acc + (n.queue || 0), 0);

  const livePanels = panels.map((p) => decoratePanelWithLiveData(p));

  // Selected entity for top bar (first selected row in any panel)
  const selectedEntity = (() => {
    for (const p of livePanels) {
      const r = (p.rows || []).find((x) => x.selected);
      if (r) return { type: p.entityType || "cast", label: r.label };
    }
    return null;
  })();

  return (
    <>
      <div
        className="app-shell"
        data-ui="AppShell"
        data-leftrail={leftExpanded ? "expanded" : "collapsed"}
      >
        <div className="app-topbar">
          <TopBar
            brand={brand}
            project={brand.project}
            view={view}
            onSetView={setView}
            leftRailExpanded={leftExpanded}
            onToggleLeftRail={onToggleLeftRail}
            privacyMode={privacyMode}
            onTogglePrivacyMode={onTogglePrivacyMode}
            syncState={syncState}
            globalQueueCount={globalQueueCount}
            selectedEntity={selectedEntity}
            onOpenCommandPalette={onOpenCommandPalette}
            onOpenSettings={onOpenSettings}
            onOpenProfile={onOpenProfile}
            onOpenReviewQueue={onOpenReviewQueue}
            onSelectProject={onSelectProject}
            onSelectBook={onSelectBook}
          />
        </div>

        <div className="app-left">
          <LeftRail
            items={NAV_ITEMS}
            activeRouteId={routeId}
            expanded={leftExpanded}
            dropTargetId={dropTargetId}
            openPanelKinds={new Set(panels.map((p) => PANELKIND_BY_ID[p.id]).filter(Boolean))}
            pinnedPanelKinds={new Set(panels.filter((p) => p.pinned).map((p) => PANELKIND_BY_ID[p.id]).filter(Boolean))}
            onActivateItem={(item, ctx) => {
              if (item.kind === "route") {
                // Settings is a system route that must open the Control
                // Centre workspace, not the generic Workspace placeholder.
                // Writer's Room / Home / Today / etc. stay as real routes.
                if (item.id === "settings") {
                  setLastRailClick({ route: "settings", ctx, ts: Date.now() });
                  onOpenSettings();
                  return;
                }
                setRouteId(item.id);
                setLastRailClick({ route: item.id, ctx, ts: Date.now() });
                return;
              }
              const k = item.panelKind || item.entity || item.id;
              activatePanelFromRail(k, ctx);
            }}
            onTabContextMenu={(item, pt) => onOpenAdaptiveWheel({ x: pt.x, y: pt.y, contextLabel: item.label })}
          />
        </div>

        <div className="app-work">
          {view === "shell" ? (
            routeId === "writers-room" ? (
              <WritersRoomScreen
                onOpenAdaptiveWheel={onOpenAdaptiveWheel}
                onOpenPanel={onOpenPanel}
                onOpenEntityFromManuscript={onOpenEntityFromManuscript}
                onOpenReviewQueue={onOpenReviewQueue}
                onSetSyncState={setSyncState}
                syncState={syncState}
                layout={layout}
                setLayout={setLayout}
                onApplyWorkspacePreset={onApplyWorkspacePreset}
                onOpenEntityEditor={openEntityEditor}
                onOpenCompositionOverlay={openCompositionOverlay}
                onDropEntityIntoComposition={dropEntityIntoComposition}
                compositionOverlayOpen={overlay.open && !overlay.minimised}
              />
            ) : routeId === "today" && typeof TodayScreen !== "undefined" ? (
              <TodayScreen onSelectEntity={(row) => {
                // Open the appropriate entity panel and broadcast focus
                if (row?.type) onOpenPanel(row.type);
              }}/>
            ) : routeId === "home" && typeof HomeScreen !== "undefined" ? (
              <HomeScreen
                onOpenPanel={onOpenPanel}
                onSetRoute={(r) => setRouteId(r)}
                onOpenReviewQueue={onOpenReviewQueue}
                onOpenProjectIntelligence={() => onOpenPanel("references")}
                onOpenContinuityWarning={(w) => onOpenPanel(w?.link?.type)}
                onOpenRecentEntity={(row) => onOpenPanel(row?.link?.type)}
                onOpenImportFlow={() => openEntityEditor({ type: "locations", mode: "json" })}
              />
            ) : (
              <Workspace
                routeId={routeId}
                demoState={demoState}
                onOpenAdaptiveWheel={onOpenAdaptiveWheel}
                onOpenPanel={onOpenPanel}
                onCreateEntity={() => openEntityEditor({ type: routeId === "writers-room" ? "locations" : routeId })}
              />
            )
          ) : (
            <div style={{ height: "100%", overflow: "auto" }}><Specimen/></div>
          )}

          {/* Stacked panels — Concept A: pinned anchor + unpinned stack + collapsed rail */}
          {view === "shell" && panels.length > 0 && (
            <PanelStack
              panels={livePanels}
              focusedByType={focusedByType}
              onClosePanel={onClosePanel}
              onPinPanel={onPinPanel}
              onExpandPanel={onExpandPanel}
              onBringPanelToFront={onBringPanelToFront}
              onReorderPanels={onReorderPanels}
              onRestorePanel={onRestorePanel}
              onOpenReviewQueue={onOpenReviewQueue}
              onSelectEntity={(row) => {
                // Find the panel that owns this row
                const owner = livePanels.find((p) => (p.rows || []).some((r) => r.id === row.id));
                onSelectEntity(row, owner);
              }}
              onClearPanelFilter={onClearPanelFilter}
            />
          )}

          {/* Full-screen panel workspace overlay */}
          {view === "shell" && panelWorkspace.open && typeof FullWorkspaceHost !== "undefined" && (
            <FullWorkspaceHost
              workspace={panelWorkspace}
              onExit={exitPanelWorkspace}
              onOpenEntityEditor={openEntityEditor}
              onOpenPanel={onOpenPanel}
              onDropEntityIntoComposition={dropEntityIntoComposition}
              onSwitchWorkspaceRequest={(newId) => openPanelWorkspace({ workspaceId: newId, panelKind: panelWorkspace.panelKind, sourcePanel: panelWorkspace.sourcePanel })}
            />
          )}
        </div>

        <div className="app-status">
          <BottomStatusStrip
            mode={ROUTE_META[routeId]?.title || "Workspace"}
            lastSavedAt="2 min ago"
            isLocal={privacyMode === "local"}
            wordCount={31482}
            reviewQueueCount={globalQueueCount}
            activeAuthor={brand.project.author}
            extractionState={syncState === "syncing" ? "running" : "idle"}
            canvasZoom={routeId === "tangle" ? 1 : null}
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        state={paletteState}
        errorMessage="Local index didn't respond. Your manuscript is safe."
        onClose={onCloseCommandPalette}
        onScopeChange={() => {}}
        onRetry={() => setPaletteState("ready")}
        onRunCommand={(cmd) => {
          if (cmd.id === "s3") {
            const r = document.querySelector("[data-ui='Workspace']")?.getBoundingClientRect();
            if (r) onOpenAdaptiveWheel({ x: r.left + r.width / 2, y: r.top + r.height / 2, contextLabel: "Workspace" });
          }
          if (cmd.id === "t1") setRouteId("writers-room");
          if (cmd.id === "t2") setRouteId("atlas");
          if (cmd.id === "t3") setRouteId("quests");
        }}
      />

      <AdaptiveWheelHost
        open={wheel.open}
        x={wheel.x}
        y={wheel.y}
        contextLabel={wheel.contextLabel}
        state={wheelDemoState === "loading" || wheelDemoState === "error" ? wheelDemoState : "ready"}
        busySlotId={wheelDemoState === "slot-loading" ? "extract" : null}
        errorSlotId={wheelDemoState === "slot-error" ? "merge" : null}
        errorMessage={wheelDemoState === "error" ? "Extraction couldn't reach the model." : null}
        activeSlotId={wheelDemoState === "selected" ? "create" : null}
        onClose={onCloseAdaptiveWheel}
        onRunWheelAction={onRunWheelAction}
        onPinSlot={() => {}}
        onRetry={() => setWheelDemoState("ready")}
      />

      <EntityEditor
        open={editor.open}
        type={editor.type}
        initial={editor.initial}
        mode={editor.mode}
        promoteFrom={editor.promoteFrom}
        onClose={closeEntityEditor}
        onSave={saveEntityFromEditor}
      />

      {/* Writer's Room Composition Overlay — only over the manuscript. */}
      {view === "shell" && routeId === "writers-room" && (
        <CompositionOverlay
          open={overlay.open}
          minimised={overlay.minimised}
          pinned={overlay.pinned}
          droppedEntities={overlay.entities}
          instructions={overlay.instructions}
          settings={overlay.settings}
          contextOptions={overlay.contextOptions}
          onClose={closeCompositionOverlay}
          onMinimise={minimiseCompositionOverlay}
          onTogglePin={pinCompositionOverlay}
          onDropEntity={dropEntityIntoComposition}
          onRemoveEntity={removeEntityFromComposition}
          onUpdateRole={updateCompositionRole}
          onUpdateInstructions={updateCompositionInstructions}
          onSetMode={(v) => setCompositionSetting("mode", v)}
          onSetPOV={(v) => setCompositionSetting("pov", v)}
          onSetLength={(v) => setCompositionSetting("length", v)}
          onSetTone={(v) => setCompositionSetting("tone", v)}
          onSetChapterTarget={(v) => setCompositionSetting("chapterTarget", v)}
          onToggleContext={toggleCompositionContext}
          onGenerateDraft={() => { /* host-wired AI */ }}
          onInsertDraft={() => { /* host-wired */ }}
          onCreateChapter={() => { /* host-wired */ }}
          onCopyPrompt={() => { /* host-wired */ }}
          onSavePreset={() => { /* host-wired */ }}
          onClearAll={clearCompositionAll}
        />
      )}

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title="Brand" subtitle="All naming flows from this object">
          <TweakText label="Name" value={tweaks.brandName} onChange={(v) => setTweak("brandName", v)}/>
          <TweakText label="Short" value={tweaks.brandShort} onChange={(v) => setTweak("brandShort", v)}/>
          <TweakText label="Tagline" value={tweaks.brandTagline} onChange={(v) => setTweak("brandTagline", v)}/>
          <TweakSelect label="Logo mark" value={tweaks.logoMark} options={["wax-seal", "loom-glyph", "quill-thread", "letter-mark"]} onChange={(v) => setTweak("logoMark", v)}/>
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio label="Theme" value={tweaks.theme} options={["parchment-light", "midnight-ink"]} onChange={(v) => setTweak("theme", v)}/>
          <TweakColor label="Accent" value={tweaks.accent} options={["#b08a3e", "#9a7b3a", "#c9a24a", "#8a6a2a"]} onChange={(v) => setTweak("accent", v)}/>
        </TweakSection>
        <TweakSection title="Type">
          <TweakRadio label="Type set" value={tweaks.typeset} options={["literary", "archive", "workhorse"]} onChange={(v) => setTweak("typeset", v)}/>
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio label="Density" value={tweaks.density} options={["spacious", "balanced", "compact"]} onChange={(v) => setTweak("density", v)}/>
          <TweakRadio label="Left rail" value={tweaks.leftRailDefault} options={["collapsed", "expanded"]} onChange={(v) => setTweak("leftRailDefault", v)}/>
        </TweakSection>
        <TweakSection title="Demo">
          <TweakSelect label="Workspace state" value={demoState} options={["default", "empty", "loading", "error", "partial"]} onChange={(v) => { setDemoState(v); setTweak("demoState", v); }}/>
          <TweakButton onClick={onOpenCommandPalette}>Open Command Palette (⌘P)</TweakButton>
          <TweakButton onClick={() => {
            const r = document.querySelector("[data-ui='Workspace']")?.getBoundingClientRect();
            if (r) onOpenAdaptiveWheel({ x: r.left + r.width / 2, y: r.top + r.height / 2, contextLabel: "Workspace" });
          }}>Open Adaptive Wheel</TweakButton>
        </TweakSection>
        <TweakSection title="Debug" subtitle="Live state — for verification only">
          <div style={{
            fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-2)",
            background: "var(--bg-paper-2)", border: "1px solid var(--line-2)",
            borderRadius: 4, padding: 8, lineHeight: 1.5,
          }}>
            <div><b>activeRoute:</b> {routeId}</div>
            <div><b>panels.length:</b> {panels.length}</div>
            <div style={{ marginTop: 4 }}><b>openPanels:</b></div>
            {panels.length === 0 && <div style={{ paddingLeft: 8, color: "var(--ink-4)" }}>— none —</div>}
            {[...panels].sort((a, b) => (b.order || 0) - (a.order || 0)).map((p) => (
              <div key={p.id} style={{ paddingLeft: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: "var(--accent-deep)" }}>{p.id}</span>
                <span>kind:{p.entityType || p.kind}</span>
                <span>z:{p.order ?? 0}</span>
                {p.pinned && <span style={{ color: "#9a7b3a" }}>pinned</span>}
                {p.collapsed && <span style={{ color: "#8a6b58" }}>collapsed</span>}
                {p.expanded && <span style={{ color: "#5a8a4a" }}>expanded</span>}
                {p.state && p.state !== "overview" && <span>state:{p.state}</span>}
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <b>front panel:</b>{" "}
              {(() => {
                const front = [...panels].sort((a, b) => (b.order || 0) - (a.order || 0))[0];
                return front ? front.id : "—";
              })()}
            </div>
            <div><b>last rail click:</b> {lastRailClick
              ? (lastRailClick.panelKind || lastRailClick.route || "?") +
                (lastRailClick.ctx?.meta ? " (meta)" : "")
              : "—"}</div>
            <div><b>missing presets:</b>{" "}
              {panels.filter((p) => p.id.startsWith("missing-")).map((p) => p.id.replace("missing-", "")).join(", ") || "none"}
            </div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--line-1)" }}>
              <b>focusedByType:</b>
            </div>
            {Object.keys(focusedByType).length === 0 && <div style={{ paddingLeft: 8, color: "var(--ink-4)" }}>— none —</div>}
            {Object.entries(focusedByType).map(([t, f]) => (
              <div key={t} style={{ paddingLeft: 8 }}>
                <span style={{ color: "var(--accent-deep)" }}>{t}:</span> {f.label} <span style={{ color: "var(--ink-4)" }}>(id:{f.id})</span>
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--line-1)" }}>
              <b>Atlas:</b> see in-panel debug (Atlas open → Debug tab)
            </div>
            <div><b>Skill Trees:</b> {(window.SKILL_TREES || []).length} trees · {(window.SKILL_ORPHANS || []).length} orphans · {(window.SKILL_REVIEW || []).length} review</div>
            <div><b>Relationships:</b> {(window.RELATIONSHIPS || []).length} rels · {(window.REL_CHANGES || []).length} changes · {(window.REL_REVIEW || []).length} review</div>
            <div><b>Timeline:</b> {(window.TL_EVENTS || []).length} events · {(window.TL_ERAS || []).length} eras · {(window.TL_REVIEW || []).length} review</div>
            <div><b>Lore:</b> {(window.CANON_FACTS || []).length} facts · {(window.CANON_CONTRADICTIONS || []).length} contras · {(window.CANON_AI_INSTRUCTIONS || []).length} AI rules</div>
            <div><b>References:</b> {(window.REFERENCES || []).length} refs · {(window.REFERENCES || []).filter((r) => r.aiContext).length} in AI context</div>
          </div>
        </TweakSection>
        <TweakSection title="Overlay states" subtitle="Preview state coverage on palette + wheel">
          <TweakSelect
            label="Palette state"
            value={paletteState}
            options={["ready", "loading", "error", "empty-source"]}
            onChange={(v) => { setPaletteState(v); if (!paletteOpen) onOpenCommandPalette(); }}
          />
          <TweakSelect
            label="Wheel state"
            value={wheelDemoState}
            options={["ready", "loading", "error", "slot-loading", "slot-error", "selected"]}
            onChange={(v) => {
              setWheelDemoState(v);
              if (!wheel.open) {
                const r = document.querySelector("[data-ui='Workspace']")?.getBoundingClientRect();
                if (r) onOpenAdaptiveWheel({ x: r.left + r.width / 2, y: r.top + r.height / 2, contextLabel: "Workspace" });
              }
            }}
          />
        </TweakSection>
      </TweaksPanel>

      <div className="mobile-note">📱 On mobile: rails collapse to drawer/bottom nav. See specimen page.</div>
    </>
  );
};

// Helper: shade a hex color toward black (negative) or white (positive) by amount [-1..1]
function shadeColor(hex, amt) {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const adj = (c) => {
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return Math.round((t - c) * p + c);
  };
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return "#" + toHex(adj(r)) + toHex(adj(g)) + toHex(adj(b));
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(<AppShell/>);
