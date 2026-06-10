// =====================================================================
// atlas.jsx — Atlas dispatcher.
//
// Hosts AtlasSidePanel inside the docked SlidingPanel body. When the
// user opens the editor (toolbar button or pin), AtlasEditor renders
// as a fixed full-viewport overlay so Writer's Room stays mounted.
//
// Owns all Atlas state — focus entities (multi-type / multi-entity),
// overlay mode, draft selection (while picker is open), scrub chapter,
// layer visibility, legend chip filters, inspector / mini-map chrome,
// and full-screen toggle.
//
// The legacy ATLAS_CONTEXT_PRESETS table is now a fallback only — the
// Tweaks panel still surfaces it for quick preview, but the real
// driver is the focus list (translated to context.show.* by the side
// panel).
// =====================================================================

const { useState: _us_atx, useMemo: _um_atx, useCallback: _uc_atx, useEffect: _ue_atx } = React;

// ---------------------------------------------------------------------
// Build initial layer + legend state from the data definitions.
// ---------------------------------------------------------------------
const _initLayerState = () => (window.ATLAS_LAYERS || []).reduce(
  (acc, l) => (acc[l.id] = l.visible !== false, acc), {});
const _initLegendState = () => ({
  characters: true, routes: true, quests: true, events: true,
  beasts: true, items: true, factions: true, warnings: true,
});

// ---------------------------------------------------------------------
// AtlasPanelBody — invoked by SlidingPanel when entityKind === "atlas".
// Hosts the side panel + editor overlay + tweaks panel together.
// ---------------------------------------------------------------------
const AtlasPanelBody = ({ panel }) => {
  // -------- Live data ------------------------------------------------
  // AtlasService.buildAtlasDataSync() produces the exact shapes the
  // designed Atlas components consume, from the live stores. The result
  // is mirrored onto the window.ATLAS_* globals the sub-components read
  // directly (focus picker, editor tray, quick panel), so one snapshot
  // drives every surface.
  const [storeVersion, setStoreVersion] = _us_atx(0);
  _ue_atx(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated", "lw:occurrences-updated",
                 "lw:manuscript-chapters-updated", "lw:backend-ready", "lw:project-imported",
                 "lw:settings-updated"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const live = _um_atx(() => {
    const B = window.LoomwrightBackend;
    const data = B?.AtlasService?.buildAtlasDataSync?.()
      || { locations: [], routes: [], roads: [], chapters: [], quests: [], beasts: [], items: [], factions: [], cast: [], queue: [], counts: {} };
    // Layer defs keep their designed structure; counts come live.
    const layerDefs = (window.ATLAS_LAYER_DEFS || []).map((l) => ({
      ...l,
      count: l.count === null ? null : (data.counts[l.id] ?? 0),
      warnings: (l.id === "warnings" || l.id === "extracts") ? data.queue.length : l.warnings,
    }));
    const payload = { ...data, layers: layerDefs };
    // Persisted per-layer opacity (Settings ▸ atlas.layerOpacity) — read
    // by AtlasMap's render groups.
    try {
      window.ATLAS_LAYER_OPACITY = (B?.SettingsService?.getSectionSync?.("atlas", {}) || {}).layerOpacity || {};
    } catch (_e) { window.ATLAS_LAYER_OPACITY = {}; }
    Object.assign(window, {
      ATLAS_LOCATIONS: payload.locations,
      ATLAS_ROUTES: payload.routes,
      ATLAS_ROADS: payload.roads || [],
      ATLAS_CHAPTERS: payload.chapters,
      ATLAS_QUESTS: payload.quests,
      ATLAS_BEASTS: payload.beasts,
      ATLAS_ITEMS: payload.items,
      ATLAS_FACTIONS: payload.factions,
      ATLAS_CAST: payload.cast,
      ATLAS_QUEUE: payload.queue,
      ATLAS_LAYERS: payload.layers,
    });
    return payload;
  }, [storeVersion]);

  const locations = live.locations;
  const routes    = live.routes;
  const chapters  = live.chapters;
  const layers    = live.layers;
  const beasts    = live.beasts;
  const items     = live.items;
  const factions  = live.factions;
  const queue     = live.queue;
  const cast      = live.cast;
  const quests    = live.quests;

  // Cross-panel context presets, generated from the live world so the
  // Tweaks preview always references real entities.
  const presets = _um_atx(() => {
    const out = [{ id: "free", label: "Free", source: null, description: "Nothing selected. Atlas shows the world plate." }];
    for (const r of routes.slice(0, 2)) {
      out.push({
        id: "char-" + r.characterId, label: "Cast: " + (r.characterName || "").split(" ")[0],
        source: { panel: "Cast", entityType: "cast", id: r.characterId, label: r.characterName },
        show: { routeIds: [r.id], focusLocId: r.waypoints[0]?.locationId },
        description: "Cast → Atlas: " + r.characterName + "'s route across the chapters.",
      });
    }
    if (routes.length >= 2) {
      out.push({
        id: "char-pair", label: "Cast: pair",
        source: { panel: "Cast", entityType: "cast", id: "pair", label: routes[0].characterName + " + " + routes[1].characterName },
        show: { routeIds: [routes[0].id, routes[1].id], focusLocId: routes[0].waypoints[0]?.locationId },
        description: "Two characters: intersecting route segments and meeting points.",
      });
    }
    if (beasts[0]) out.push({ id: "beast-0", label: "Bestiary: " + beasts[0].name, source: { panel: "Bestiary", entityType: "bestiary", id: beasts[0].id, label: beasts[0].name }, show: { beastId: beasts[0].id, focusLocId: beasts[0].habitat[0] }, description: "Bestiary → Atlas: habitat highlight." });
    if (items[0]) out.push({ id: "item-0", label: "Items: " + items[0].name, source: { panel: "Items", entityType: "items", id: items[0].id, label: items[0].name }, show: { itemId: items[0].id, focusLocId: items[0].found?.locationId }, description: "Items → Atlas: found / used / lost." });
    if (factions[0]) out.push({ id: "fac-0", label: "Factions: " + factions[0].name, source: { panel: "Factions", entityType: "factions", id: factions[0].id, label: factions[0].name }, show: { factionId: factions[0].id, focusLocId: factions[0].hq }, description: "Factions → Atlas: controlled territory." });
    const firstQuest = quests.find((q) => q.type === "quests" && (q.steps || []).length);
    if (firstQuest) out.push({ id: "quest-0", label: "Quests: " + firstQuest.name, source: { panel: "Quests", entityType: "quests", id: firstQuest.id, label: firstQuest.name }, show: { questId: firstQuest.id, focusLocId: firstQuest.steps[0]?.locationId }, description: "Quests → Atlas: step locations in order." });
    return out;
  }, [routes, beasts, items, factions, quests]);

  // -------- Focus / overlay state ------------------------------------
  // Seed: the protagonist (or first cast member) so the panel opens focused.
  const [focusEntities, setFocusEntities] = _us_atx(() => {
    const lead = cast.find((c) => /^protagonist/i.test(c.role || "")) || null;
    return lead ? [{ type: "cast", id: lead.id, label: lead.name, color: lead.color, sub: lead.role, kind: "character" }] : [];
  });
  const [draftFocusEntities, setDraftFocusEntities] = _us_atx(focusEntities);
  const [focusPopoverOpen,   setFocusPopoverOpen]   = _us_atx(false);
  const [overlayMode,        setOverlayMode]        = _us_atx("travel");
  const [lastFocusChange,    setLastFocusChange]    = _us_atx({ at: Date.now(), via: "init" });

  // Seed the focus once the live cast arrives (the panel can mount
  // before the backend hydrates), and prune chips whose entity is gone.
  const seededRef = React.useRef(false);
  _ue_atx(() => {
    if (focusEntities.length) { seededRef.current = true; }
    const valid = focusEntities.filter((f) => f.type !== "cast" || cast.some((c) => c.id === f.id));
    if (valid.length !== focusEntities.length) { setFocusEntities(valid); return; }
    if (!seededRef.current && cast.length) {
      const lead = cast.find((c) => /^protagonist/i.test(c.role || ""));
      if (lead) {
        seededRef.current = true;
        setFocusEntities([{ type: "cast", id: lead.id, label: lead.name, color: lead.color, sub: lead.role, kind: "character" }]);
      }
    }
  }, [cast]);

  // -------- Cross-panel context preset --------------------------------
  // Current chapter = the manuscript's active chapter (index into the
  // live chapter list); the scrubber overrides it transiently.
  const currentChapter = _um_atx(() => {
    try {
      const st = window.LoomwrightBackend?.ManuscriptChapterService?.loadSync?.() || {};
      const ix = chapters.findIndex((c) => c.id === st.activeChapterId);
      if (ix >= 0) return ix;
    } catch (_e) {}
    return Math.max(0, chapters.length - 1);
  }, [chapters]);
  const [presetId, setPresetId] = _us_atx("free");
  const context = _um_atx(() => presets.find((p) => p.id === presetId) || presets[0],
                         [presetId, presets]);

  // Selected location (click a pin or row).
  const [selected, setSelected] = _us_atx(null);

  // Scrub chapter — null means "use currentChapter".
  const [scrubChapter, setScrubChapter] = _us_atx(null);

  // Layer visibility / legend filters
  const [layerState,  setLayerState]  = _us_atx(_initLayerState);
  const [legendState, setLegendState] = _us_atx(_initLegendState);

  // Side panel chrome
  const [layersPopoverOpen, setLayersPopoverOpen] = _us_atx(false);
  const [inspectorCollapsed, setInspectorCollapsed] = _us_atx(false);
  const [miniMapVisible, setMiniMapVisible] = _us_atx(true);

  // Editor chrome
  const [fullScreen,        setFullScreen]        = _us_atx(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = _us_atx(false);
  const [rightRailCollapsed,setRightRailCollapsed]= _us_atx(false);
  const [leftTab,           setLeftTab]           = _us_atx("registry");
  const [rightTab,          setRightTab]          = _us_atx("inspector");

  // Cartography toggles
  const [showIso,     setShowIso]     = _us_atx(true);
  const [showGrid,    setShowGrid]    = _us_atx(false);
  const [showTexture, setShowTexture] = _us_atx(true);
  const [showLabels,  setShowLabels]  = _us_atx(true);

  // -------- Focus selector handlers ---------------------------------
  const onOpenFocusSelector = _uc_atx(() => {
    setDraftFocusEntities(focusEntities);
    setFocusPopoverOpen(true);
  }, [focusEntities]);

  const onCloseFocusSelector = _uc_atx(() => setFocusPopoverOpen(false), []);

  const onChangeDraftFocus = _uc_atx((next) => setDraftFocusEntities(next), []);

  const onApplyFocus = _uc_atx(() => {
    setFocusEntities(draftFocusEntities);
    setFocusPopoverOpen(false);
    setLastFocusChange({ at: Date.now(), via: "apply", n: draftFocusEntities.length });
    // Auto-pick a sensible overlay mode for the new selection types
    const types = new Set(draftFocusEntities.map((f) => f.type));
    if (types.has("cast") && draftFocusEntities.filter((f) => f.type === "cast").length >= 2) setOverlayMode("intersect");
    else if (types.has("cast"))      setOverlayMode("travel");
    else if (types.has("items"))     setOverlayMode("ful");
    else if (types.has("bestiary"))  setOverlayMode("habitat");
    else if (types.has("factions"))  setOverlayMode("territory");
    else if (types.has("quests"))    setOverlayMode("steps");
    else if (types.has("timeline"))  setOverlayMode("snapshot");
  }, [draftFocusEntities]);

  const onCancelFocus = _uc_atx(() => {
    setDraftFocusEntities(focusEntities);
    setFocusPopoverOpen(false);
  }, [focusEntities]);

  const onClearFocus = _uc_atx(() => {
    if (focusPopoverOpen) setDraftFocusEntities([]);
    else {
      setFocusEntities([]);
      setLastFocusChange({ at: Date.now(), via: "clear" });
    }
  }, [focusPopoverOpen]);

  const onRemoveFocusChip = _uc_atx((entity) => {
    setFocusEntities((curr) => curr.filter((f) => !(f.type === entity.type && f.id === entity.id)));
    setLastFocusChange({ at: Date.now(), via: "remove-chip", entity: entity.label });
  }, []);

  const onSearchFocus = _uc_atx((q) => {
    setLastFocusChange({ at: Date.now(), via: "search", query: q });
  }, []);

  const onSetOverlayMode = _uc_atx((mode) => setOverlayMode(mode), []);

  // -------- Selection / map handlers --------------------------------
  const onSelect = _uc_atx((loc) => setSelected(loc), []);

  // External request: a panel selects an entity → push it into focus
  const onSelectEntity = _uc_atx((entity) => {
    // Cast / Bestiary / Items / Quests / Factions etc — replace focus
    // with that one entity (single-select from cross-panel context).
    if (!entity || !entity.type) return;
    const colorByType = {
      cast:      (e) => (cast.find((c) => c.id === e.id) || {}).color || "#7a6aa3",
      bestiary:  (e) => (beasts.find((b) => b.id === e.id) || {}).color || "#8a3a4f",
      items:     (e) => (items.find((i) => i.id === e.id) || {}).color || "#b78a52",
      quests:    () => "#8a3a4f",
      factions:  (e) => (factions.find((f) => f.id === e.id) || {}).color || "#324a1f",
      locations: () => "#6b8a4a",
    };
    const colour = (colorByType[entity.type] || (() => "#7a6aa3"))(entity);
    setFocusEntities([{ type: entity.type, id: entity.id, label: entity.label || entity.name, color: colour }]);
    setLastFocusChange({ at: Date.now(), via: "cross-panel", entity: entity.label });
  }, [cast, beasts, items, factions]);

  const onSetScrub      = _uc_atx((i) => setScrubChapter(i), []);
  const onJumpCurrent   = _uc_atx(() => setScrubChapter(null), []);
  const onToggleLayer   = _uc_atx((id) => setLayerState((s) => ({ ...s, [id]: !(s[id] !== false) })), []);
  const onToggleLayerFromLegend = _uc_atx((id) => setLegendState((s) => ({ ...s, [id]: !(s[id] !== false) })), []);
  const onToggleInspector = _uc_atx(() => setInspectorCollapsed((c) => !c), []);
  const onToggleMiniMap   = _uc_atx(() => setMiniMapVisible((v) => !v), []);
  const onMiniMapNavigate = _uc_atx(() => {}, []);
  const onToggleLayersPopover = _uc_atx(() => setLayersPopoverOpen((o) => !o), []);
  const onOpenEditor    = _uc_atx(() => setFullScreen(true), []);
  const onExitEditor    = _uc_atx(() => setFullScreen(false), []);

  // Listen for global "Open Atlas Editor" trigger from panel header
  // (PanelHeaderActions dispatches lw:open-panel-workspace which app.jsx
  // forwards to lw:open-existing-fullscreen for atlas + skill trees).
  React.useEffect(() => {
    const onOpen = (e) => {
      if (e?.detail?.panelKind === "atlas" || e?.detail?.workspaceId === "atlas-editor") {
        setFullScreen(true);
      }
    };
    window.addEventListener("lw:open-existing-fullscreen", onOpen);
    return () => window.removeEventListener("lw:open-existing-fullscreen", onOpen);
  }, []);
  const onOpenSearch    = _uc_atx(() => {}, []);
  const onOpenQueue     = _uc_atx(() => { setFullScreen(true); setRightTab("queue"); }, []);
  const onOpenSourceMention = _uc_atx(() => { setFullScreen(true); setRightTab("source"); }, []);
  const onOpenRelatedEntity = _uc_atx(() => { setFullScreen(true); setRightTab("related"); }, []);
  const onPinFocus = _uc_atx(() => {}, []);

  // -------- Render --------------------------------------------------
  return (
    <div className="atlas-host" data-ui="AtlasPanelBody">
      <AtlasSidePanel
        locations={locations}
        routes={routes}
        beasts={beasts}
        items={items}
        factions={factions}
        chapters={chapters}
        layers={layers}
        queue={queue}
        quests={quests}
        focusEntities={focusEntities}
        draftFocusEntities={draftFocusEntities}
        focusPopoverOpen={focusPopoverOpen}
        overlayMode={overlayMode}
        currentChapter={currentChapter}
        scrubChapter={scrubChapter}
        layerState={layerState}
        legendChipsState={legendState}
        selected={selected}
        inspectorCollapsed={inspectorCollapsed}
        miniMapVisible={miniMapVisible}
        layersPopoverOpen={layersPopoverOpen}
        showIso={showIso}
        showGrid={showGrid}
        showTexture={showTexture}
        showLabels={showLabels}
        onSelect={onSelect}
        onOpenFocusSelector={onOpenFocusSelector}
        onCloseFocusSelector={onCloseFocusSelector}
        onChangeDraftFocus={onChangeDraftFocus}
        onApplyFocus={onApplyFocus}
        onCancelFocus={onCancelFocus}
        onClearFocus={onClearFocus}
        onRemoveFocusChip={onRemoveFocusChip}
        onSearchFocus={onSearchFocus}
        onSetOverlayMode={onSetOverlayMode}
        onSetScrub={onSetScrub}
        onJumpCurrent={onJumpCurrent}
        onToggleLayer={onToggleLayer}
        onToggleLayerFromLegend={onToggleLayerFromLegend}
        onToggleInspector={onToggleInspector}
        onToggleMiniMap={onToggleMiniMap}
        onMiniMapNavigate={onMiniMapNavigate}
        onOpenEditor={onOpenEditor}
        onOpenSearch={onOpenSearch}
        onOpenQueue={onOpenQueue}
        onToggleLayersPopover={onToggleLayersPopover}
        onOpenSourceMention={onOpenSourceMention}
        onOpenRelatedEntity={onOpenRelatedEntity}
        onPinFocus={onPinFocus}
      />

      {fullScreen && (
        <div className="atlas-fs-overlay" data-ui="AtlasFullScreenOverlay">
          <AtlasEditor
            locations={locations}
            routes={routes}
            beasts={beasts}
            items={items}
            factions={factions}
            chapters={chapters}
            layers={layers}
            queue={queue}
            cast={cast}
            context={context}
            scrubChapter={scrubChapter}
            currentChapter={currentChapter}
            layerState={layerState}
            legendChipsState={legendState}
            selected={selected}
            leftRailCollapsed={leftRailCollapsed}
            rightRailCollapsed={rightRailCollapsed}
            leftTab={leftTab}
            rightTab={rightTab}
            showIso={showIso}
            showGrid={showGrid}
            showTexture={showTexture}
            showLabels={showLabels}
            miniMapVisible={miniMapVisible}
            onSelect={onSelect}
            onClearContext={() => setPresetId("free")}
            onSetScrub={onSetScrub}
            onJumpCurrent={onJumpCurrent}
            onToggleLayer={onToggleLayer}
            onToggleLegend={(id) => setLegendState((s) => ({ ...s, [id]: !(s[id] !== false) }))}
            onToggleLeftRail={() => setLeftRailCollapsed((c) => !c)}
            onToggleRightRail={() => setRightRailCollapsed((c) => !c)}
            onSetLeftTab={setLeftTab}
            onSetRightTab={setRightTab}
            onSelectEntity={onSelectEntity}
            onExitFs={onExitEditor}
          />
        </div>
      )}

      <AtlasTweaksPanel
        focusEntities={focusEntities}
        overlayMode={overlayMode}
        lastFocusChange={lastFocusChange}
        presetId={presetId} onSetPreset={(id) => {
          // Cycling a preset for demo — translate into focus entities.
          setPresetId(id);
          const preset = presets.find((p) => p.id === id);
          if (!preset || id === "free") { setFocusEntities([]); return; }
          // Build focus entities from preset.show
          const f = [];
          const show = preset.show || {};
          if (show.routeIds) {
            for (const rid of show.routeIds) {
              const r = routes.find((x) => x.id === rid);
              if (r) f.push({ type: "cast", id: r.characterId, label: r.characterName, color: r.color });
            }
          }
          if (show.beastId) {
            const b = beasts.find((x) => x.id === show.beastId);
            if (b) f.push({ type: "bestiary", id: b.id, label: b.name, color: b.color });
          }
          if (show.itemId) {
            const i = items.find((x) => x.id === show.itemId);
            if (i) f.push({ type: "items", id: i.id, label: i.name, color: i.color });
          }
          if (show.factionId) {
            const fa = factions.find((x) => x.id === show.factionId);
            if (fa) f.push({ type: "factions", id: fa.id, label: fa.name, color: fa.color });
          }
          if (show.questId) {
            const q = quests.find((x) => x.id === show.questId);
            if (q) f.push({ type: "quests", id: q.id, label: q.name, color: "#8a3a4f" });
          }
          setFocusEntities(f);
          setLastFocusChange({ at: Date.now(), via: "preset", preset: preset.label });
        }} presets={presets}
        inspectorCollapsed={inspectorCollapsed} onToggleInspector={onToggleInspector}
        layerState={layerState} onToggleLayer={onToggleLayer}
        showIso={showIso} setShowIso={setShowIso}
        showGrid={showGrid} setShowGrid={setShowGrid}
        showTexture={showTexture} setShowTexture={setShowTexture}
        miniMapVisible={miniMapVisible} setMiniMapVisible={setMiniMapVisible}
        fullScreen={fullScreen} onToggleFullScreen={() => setFullScreen((f) => !f)}/>
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasTweaksPanel — debug + demo controls. Shows full state surface.
// ---------------------------------------------------------------------
const AtlasTweaksPanel = ({
  focusEntities, overlayMode, lastFocusChange,
  presetId, onSetPreset, presets,
  inspectorCollapsed, onToggleInspector,
  layerState, onToggleLayer,
  showIso, setShowIso, showGrid, setShowGrid, showTexture, setShowTexture,
  miniMapVisible, setMiniMapVisible,
  fullScreen, onToggleFullScreen,
}) => {
  const [open, setOpen] = _us_atx(true);
  const [tab,  setTab]  = _us_atx("debug");
  const focusTypes = Array.from(new Set(focusEntities.map((f) => f.type)));
  return (
    <div className={"atlas-tweaks" + (open ? " is-open" : " is-closed")} data-ui="AtlasTweaksPanel">
      <button className="atlas-tweaks__handle" onClick={() => setOpen((o) => !o)} data-callback="onToggleAtlasTweaks">
        <Icon name="sparkle" size={11}/>
        <span>{open ? "Hide debug" : "Debug"}</span>
        <Icon name={open ? "chevron-d" : "chevron-r"} size={9}/>
      </button>
      {open && (
        <div className="atlas-tweaks__body">
          <div className="atlas-tweaks__tabs">
            <button className={tab === "debug"   ? "is-on" : ""} onClick={() => setTab("debug")}>Debug</button>
            <button className={tab === "compare" ? "is-on" : ""} onClick={() => setTab("compare")}>Preset</button>
            <button className={tab === "layout"  ? "is-on" : ""} onClick={() => setTab("layout")}>Layout</button>
            <button className={tab === "carto"   ? "is-on" : ""} onClick={() => setTab("carto")}>Cartography</button>
          </div>

          {tab === "debug" && (
            <div className="atlas-tweaks__debug">
              <Row k="activeAtlasFocusEntities" v={focusEntities.length ? focusEntities.map((f) => f.type + ":" + f.id).join(", ") : "—"}/>
              <Row k="activeAtlasFocusTypes" v={focusTypes.join(", ") || "—"}/>
              <Row k="activeOverlayMode" v={overlayMode}/>
              <Row k="activeAtlasChapter" v={(window.ATLAS_CHAPTERS || []).length ? ((window.ATLAS_CHAPTERS || [])[(window.ATLAS_CHAPTERS || []).length - 1].label + " (latest)") : "—"}/>
              <Row k="visibleAtlasLayers" v={Object.entries(layerState).filter(([_, v]) => v).map(([k]) => k).join(", ")}/>
              <Row k="miniMapVisible" v={miniMapVisible ? "true" : "false"}/>
              <Row k="inspectorCollapsed" v={inspectorCollapsed ? "true" : "false"}/>
              <Row k="lastAtlasFocusChange" v={lastFocusChange.via + (lastFocusChange.entity ? " · " + lastFocusChange.entity : "") + (lastFocusChange.preset ? " · " + lastFocusChange.preset : "")}/>
            </div>
          )}

          {tab === "compare" && (
            <div className="atlas-tweaks__grp">
              <div className="atlas-tweaks__lbl">Cycle a demo preset (replaces current focus):</div>
              <div className="atlas-tweaks__chips">
                {presets.map((p) => (
                  <button key={p.id} className={"atlas-tweaks__chip" + (presetId === p.id ? " is-on" : "")}
                          onClick={() => onSetPreset(p.id)} data-callback="onSetAtlasPreset" data-preset={p.id}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="atlas-tweaks__desc">{(presets.find((p) => p.id === presetId) || {}).description}</p>
            </div>
          )}

          {tab === "layout" && (
            <div className="atlas-tweaks__grp">
              <label className="atlas-tweaks__row">
                <input type="checkbox" checked={!!fullScreen} onChange={onToggleFullScreen}/>
                <span>Show full-screen editor</span>
              </label>
              <label className="atlas-tweaks__row">
                <input type="checkbox" checked={!!inspectorCollapsed} onChange={onToggleInspector}/>
                <span>Collapse inspector</span>
              </label>
              <label className="atlas-tweaks__row">
                <input type="checkbox" checked={!!miniMapVisible} onChange={() => setMiniMapVisible((v) => !v)}/>
                <span>Show floating mini-map</span>
              </label>
            </div>
          )}

          {tab === "carto" && (
            <div className="atlas-tweaks__grp">
              <label className="atlas-tweaks__row">
                <input type="checkbox" checked={!!showIso} onChange={() => setShowIso((v) => !v)}/>
                <span>Contour lines</span>
              </label>
              <label className="atlas-tweaks__row">
                <input type="checkbox" checked={!!showGrid} onChange={() => setShowGrid((v) => !v)}/>
                <span>Lat/Lon grid</span>
              </label>
              <label className="atlas-tweaks__row">
                <input type="checkbox" checked={!!showTexture} onChange={() => setShowTexture((v) => !v)}/>
                <span>Parchment grain</span>
              </label>
              <div className="atlas-tweaks__lbl" style={{ marginTop: 8 }}>Layer visibility</div>
              <div className="atlas-tweaks__chips">
                {(window.ATLAS_LAYERS || []).map((l) => {
                  const on = layerState[l.id] !== false;
                  return (
                    <button key={l.id} className={"atlas-tweaks__chip" + (on ? " is-on" : "")}
                            onClick={() => onToggleLayer(l.id)}>
                      <span className="atlas-tweaks__sw" style={{ background: l.color }}/>
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Tiny KV row for the debug surface
const Row = ({ k, v }) => (
  <div className="atlas-tweaks__kv">
    <span className="atlas-tweaks__kv-k">{k}</span>
    <span className="atlas-tweaks__kv-v">{v || "—"}</span>
  </div>
);

Object.assign(window, { AtlasPanelBody, AtlasTweaksPanel });
