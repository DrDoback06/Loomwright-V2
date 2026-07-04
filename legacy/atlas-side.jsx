// =====================================================================
// atlas-side.jsx — Atlas side panel (map-dominant live tracker).
//
// Layout (grid, top→bottom):
//
//   toolbar          search · Map Focus · queue · editor
//   focus chips      pills of active focus entities (× to remove)
//   overlay mode     "Travel route" / "Habitat" / "Found / Used / Lost" / …
//   legend           toggleable counts (Characters 2 · Routes 2 · Items 1 …)
//   MAP              dominant surface (~60% of panel height)
//   inspector        collapsible — summarises current focus
//
// Mini-map is a small floating inset in the bottom-right of the map.
// =====================================================================

const { useState: _us_as, useMemo: _um_as, useCallback: _uc_as, useRef: _ur_as } = React;

// ---------------------------------------------------------------------
// Top toolbar — search · Map Focus button · queue · editor
// ---------------------------------------------------------------------
const AtlasSideToolbar = ({
  focusCount, onOpenFocus,
  layersOpen, onToggleLayers,
  onOpenEditor, onOpenSearch,
  queueCount, onOpenQueue,
  onJumpCurrent, currentChapterLabel,
}) => {
  const wrapRef = _ur_as(null);
  return (
  <div className="as-bar" data-ui="AtlasSideToolbar">
    <button className="as-bar__search" onClick={onOpenSearch} data-callback="onAtlasSearch">
      <Icon name="search" size={12}/>
      <span>Search the atlas…</span>
      <span className="as-bar__kbd">⌘K</span>
    </button>

    <div className="as-bar__focuswrap" ref={wrapRef}>
      <AtlasFocusButton active={focusCount} onClick={onOpenFocus}/>
    </div>

    <button className="as-bar__btn as-bar__btn--jump" onClick={onJumpCurrent}
            data-callback="onJumpAtlasCurrentChapter"
            title={"Jump to current chapter (" + currentChapterLabel + ")"}>
      <Icon name="bolt" size={11}/>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{currentChapterLabel}</span>
    </button>

    <span className="as-bar__spacer"/>

    <div className="as-bar__cluster">
      <button className={"as-bar__btn" + (layersOpen ? " is-on" : "")} onClick={onToggleLayers}
              data-callback="onToggleAtlasLayers" title="Layers">
        <Icon name="stack" size={12}/>
      </button>
      <button className="as-bar__btn as-bar__btn--queue" onClick={onOpenQueue}
              data-callback="onOpenAtlasReviewQueue" title="Atlas review queue">
        <Icon name="bell" size={12}/>
        {queueCount > 0 && <span className="as-bar__badge">{queueCount}</span>}
      </button>
    </div>

    <button className="as-bar__editor" onClick={onOpenEditor} data-callback="onOpenAtlasFullScreen">
      <Icon name="expand" size={11}/>
      <span>Editor</span>
    </button>
  </div>
  );
};

// ---------------------------------------------------------------------
// Layers popover — quick toggles (unchanged from previous build)
// ---------------------------------------------------------------------
const AtlasLayersPopover = ({ layers, layerState, onToggle, onClose }) => (
  <div className="as-layers" data-ui="AtlasLayersPopover" onClick={(e) => e.stopPropagation()}>
    <div className="as-layers__head">
      <span>Layers</span>
      <button className="as-layers__x" onClick={onClose} data-callback="onCloseAtlasLayers"><Icon name="close" size={9}/></button>
    </div>
    <div className="as-layers__list">
      {layers.map((l) => {
        const visible = layerState[l.id] !== false;
        return (
          <button key={l.id} className={"as-layers__row" + (visible ? "" : " is-off")}
                  onClick={() => onToggle(l.id)} data-callback="onToggleAtlasLayer" data-layer={l.id}>
            <span className="as-layers__sw" style={{ background: l.color }}/>
            <span className="as-layers__lbl">{l.label}</span>
            {l.count != null && <span className="as-layers__count">{l.count}</span>}
            <span className={"as-layers__eye " + (visible ? "is-on" : "is-off")}>
              <Icon name="eye" size={10}/>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

// ---------------------------------------------------------------------
// Main side panel — composes the new focus system.
// ---------------------------------------------------------------------
const AtlasSidePanel = ({
  // Data
  locations, routes, beasts, items, factions, chapters, layers, queue, quests,
  // Focus state
  focusEntities, draftFocusEntities, focusPopoverOpen, overlayMode,
  // Other state
  currentChapter, scrubChapter, layerState, legendChipsState,
  selected, inspectorCollapsed, miniMapVisible, layersPopoverOpen,
  // Display tweaks
  showIso, showGrid, showTexture, showLabels,
  // Callbacks
  onSelect, onOpenFocusSelector, onCloseFocusSelector, onChangeDraftFocus,
  onApplyFocus, onCancelFocus, onClearFocus, onRemoveFocusChip, onSearchFocus,
  onSetOverlayMode,
  onSetScrub, onJumpCurrent,
  onToggleLayer, onToggleLayerFromLegend, onToggleInspector, onToggleMiniMap, onMiniMapNavigate,
  onOpenEditor, onOpenSearch, onOpenQueue, onToggleLayersPopover,
  onOpenSourceMention, onOpenRelatedEntity, onPinFocus,
}) => {
  const locById = _um_as(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);

  // Synthesise a `context` object that AtlasMap understands from the
  // focus + overlay mode. AtlasMap reads context.show.{routeIds, beastId,
  // itemId, factionId, questId, chapterDiff, intersect}.
  const synth = _um_as(() => {
    if (!focusEntities || focusEntities.length === 0) return null;
    const show = {};
    const types = new Set(focusEntities.map((f) => f.type));

    // Cast → routes (or "appearances" if mode set to appearances)
    if (types.has("cast")) {
      const cast = focusEntities.filter((f) => f.type === "cast");
      const ids = cast.map((c) => c.id);
      show.routeIds = routes.filter((r) => ids.includes(r.characterId)).map((r) => r.id);
      // Intersection points across selected cast routes (locations visited by ≥2)
      if (cast.length >= 2) {
        const counts = {};
        for (const r of routes) {
          if (!ids.includes(r.characterId)) continue;
          for (const w of r.waypoints) counts[w.locationId] = (counts[w.locationId] || 0) + 1;
        }
        show.intersect = Object.entries(counts).filter(([_, n]) => n >= 2).map(([id]) => id);
      }
    }
    if (types.has("bestiary")) show.beastId   = focusEntities.find((f) => f.type === "bestiary").id;
    if (types.has("items"))    show.itemId    = focusEntities.find((f) => f.type === "items").id;
    if (types.has("quests"))   show.questId   = focusEntities.find((f) => f.type === "quests").id;
    if (types.has("factions")) show.factionId = focusEntities.find((f) => f.type === "factions").id;
    if (types.has("locations"))show.focusLocId= focusEntities.find((f) => f.type === "locations").id;
    if (types.has("timeline")) {
      const t = focusEntities.find((f) => f.type === "timeline");
      if (t && t.id !== "current" && t.id !== "all") show.chapterDiff = t.id;
    }
    return {
      id: "focus-synth",
      label: focusEntities.length === 1 ? focusEntities[0].label : focusEntities.length + " focused",
      source: { panel: "atlas", entityType: focusEntities[0].type, id: focusEntities[0].id, label: focusEntities[0].label },
      show,
      description: focusEntities.map((f) => f.label).join(" + "),
    };
  }, [focusEntities, routes]);

  const focusTypes = focusEntities.map((f) => f.type);

  // Build counts for legend
  const counts = _um_as(() => ({
    characters: focusEntities.filter((f) => f.type === "cast").length || (synth?.show?.routeIds?.length || 0),
    routes:     synth?.show?.routeIds?.length || 0,
    items:      focusEntities.filter((f) => f.type === "items").length,
    quests:     focusEntities.filter((f) => f.type === "quests").length,
    events:     focusEntities.filter((f) => f.type === "events").length,
    beasts:     focusEntities.filter((f) => f.type === "bestiary").length,
    factions:   focusEntities.filter((f) => f.type === "factions").length,
    warnings:   chapters.reduce((a, c) => a + (c.warnings || 0), 0),
  }), [focusEntities, synth, chapters]);

  const currentChapterLabel = chapters[currentChapter]?.label || "Ch. 1";

  return (
    <div className="atlas-side" data-ui="AtlasSidePanel">
      <div style={{ position: "relative" }}>
        <AtlasSideToolbar
          focusCount={focusEntities.length}
          onOpenFocus={onOpenFocusSelector}
          layersOpen={layersPopoverOpen}
          onToggleLayers={onToggleLayersPopover}
          queueCount={queue.length}
          onOpenQueue={onOpenQueue}
          onOpenSearch={onOpenSearch}
          onOpenEditor={onOpenEditor}
          onJumpCurrent={onJumpCurrent}
          currentChapterLabel={currentChapterLabel}
        />
        {focusPopoverOpen && (
          <AtlasFocusPopover
            open={focusPopoverOpen}
            focus={focusEntities}
            draftFocus={draftFocusEntities}
            onChangeDraft={onChangeDraftFocus}
            onApply={onApplyFocus}
            onCancel={onCancelFocus}
            onClearAll={onClearFocus}
            onSearch={onSearchFocus}
          />
        )}
      </div>

      <AtlasFocusChips
        focus={focusEntities}
        onRemove={onRemoveFocusChip}
        onClearAll={onClearFocus}
        onOpenSummary={onOpenFocusSelector}
        onOpenSelector={onOpenFocusSelector}
      />

      {focusEntities.length > 0 && (
        <AtlasOverlayModeSelector
          focusTypes={focusTypes}
          mode={overlayMode}
          onSetMode={onSetOverlayMode}
        />
      )}

      <AtlasLegendStrip
        counts={counts}
        layerState={legendChipsState}
        onToggleLayer={onToggleLayerFromLegend}
      />

      <div className="atlas-side__map">
        <AtlasMap
          locations={locations}
          routes={routes}
          beasts={beasts}
          items={items}
          factions={factions}
          chapters={chapters}
          layers={layerState}
          selectedId={selected?.id}
          context={synth}
          scrubChapter={scrubChapter}
          showLabels={showLabels}
          showIso={showIso}
          showGrid={showGrid}
          showTexture={showTexture}
          variant="side"
          onSelect={onSelect}/>

        {layersPopoverOpen && (
          <AtlasLayersPopover layers={layers} layerState={layerState}
                              onToggle={onToggleLayer} onClose={onToggleLayersPopover}/>
        )}

        <AtlasFocusMiniMap
          visible={miniMapVisible}
          onToggle={onToggleMiniMap}
          onNavigate={onMiniMapNavigate}
          viewport={{ x: 100, y: 200, w: 600, h: 320 }}
        />

        {focusEntities.length > 0 && (
          <div className="atlas-side__ctxhint">
            <Icon name="eye" size={10}/>
            <span>
              {focusEntities.length === 1
                ? focusEntities[0].label + " — " + (ATLAS_OVERLAY_MODES.find((m) => m.id === overlayMode)?.label || "overlay")
                : focusEntities.length + " entities focused"}
            </span>
          </div>
        )}
      </div>

      <AtlasFocusInspector
        focus={focusEntities}
        overlayMode={overlayMode}
        locById={locById}
        beasts={beasts}
        items={items}
        factions={factions}
        routes={routes}
        quests={quests}
        chapters={chapters}
        selected={selected}
        collapsed={inspectorCollapsed}
        onToggleCollapsed={onToggleInspector}
        onOpenEditor={onOpenEditor}
        onOpenSourceMention={onOpenSourceMention}
        onOpenRelatedEntity={onOpenRelatedEntity}
        onPinFocus={onPinFocus}
        onSelectEntity={(e) => onSelect && onSelect(locById[e.id] || e)}
      />
    </div>
  );
};

Object.assign(window, { AtlasSidePanel, AtlasSideToolbar, AtlasLayersPopover });
