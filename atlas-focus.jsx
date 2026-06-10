// =====================================================================
// atlas-focus.jsx — Map Focus / Entity Overlay Selector for Atlas.
//
// Replaces the old single-preset context dropdown with a structured
// multi-entity, multi-type selector. Composes:
//
//   AtlasFocusButton          toolbar entry — opens the popover.
//   AtlasFocusPopover         tabbed entity picker with search / multi-select.
//   AtlasFocusChips           active focus chips strip (entity colour + ×).
//   AtlasOverlayModeSelector  pill that picks how the overlay renders.
//   AtlasLegendStrip          compact active-layer chips that toggle.
//   AtlasMiniMap              floating corner inset for the side-panel map.
//
// The focus model is intentionally light — { type, id, label, color, icon,
// kind }. The Atlas owner (atlas.jsx) converts a list of focus entries
// into the shape AtlasMap already understands (context.show.*).
// =====================================================================

const { useState: _af_us, useMemo: _af_um, useCallback: _af_uc, useRef: _af_ur, useEffect: _af_ue } = React;

// ---------------------------------------------------------------------
// Entity-type catalogue for the Map Focus picker.
// Each tab has: a label, a colour (from ENTITY_TYPES where possible),
// an empty-state message, and a `loader` that returns the entity list.
// ---------------------------------------------------------------------
const AF_TABS = [
  { id: "cast",      label: "Cast",       icon: "user",     hint: "Show characters and their travel."     },
  { id: "bestiary",  label: "Bestiary",   icon: "claw",     hint: "Habitats and encounter pins."          },
  { id: "items",     label: "Items",      icon: "gem",      hint: "Found / used / lost markers."          },
  { id: "quests",    label: "Quests",     icon: "scroll",   hint: "Step locations in order."              },
  { id: "events",    label: "Events",     icon: "bolt",     hint: "Single-point events on the map."       },
  { id: "factions",  label: "Factions",   icon: "banner",   hint: "Territory and controlled regions."     },
  { id: "locations", label: "Locations",  icon: "pin",      hint: "Single places to focus the map on."    },
  { id: "timeline",  label: "Timeline",   icon: "clock",    hint: "Show the map at a chapter or range."   },
  { id: "lore",      label: "Lore",       icon: "book",     hint: "Hard canon, contradictions, history."  },
];

// ---------------------------------------------------------------------
// AtlasFocusButton — toolbar pill that opens the popover. Shows count
// of currently active focus entries as a small badge.
// ---------------------------------------------------------------------
const AtlasFocusButton = ({ active = 0, onClick }) => (
  <button
    className={"af-btn" + (active ? " is-on" : "")}
    onClick={onClick}
    data-callback="onOpenAtlasFocusSelector"
    title="Map Focus — choose which entities overlay the map"
  >
    <Icon name="bolt" size={11}/>
    <span className="af-btn__lbl">Map Focus</span>
    {active > 0 && <span className="af-btn__n">{active}</span>}
    <Icon name="chevron-d" size={9}/>
  </button>
);

// ---------------------------------------------------------------------
// AtlasFocusRow — one entity row inside a tab. Renders a coloured chip,
// label, short context (e.g. role / habitat), and an optional count.
// ---------------------------------------------------------------------
const AtlasFocusRow = ({ entity, selected, onToggle }) => (
  <button
    className={"af-row" + (selected ? " is-on" : "")}
    onClick={() => onToggle(entity)}
    data-callback={selected ? "onDeselectAtlasFocusEntity" : "onSelectAtlasFocusEntity"}
    data-entity-type={entity.type}
    data-entity-id={entity.id}
    style={{ "--c": entity.color || "var(--atl-ink-3)" }}
  >
    <span className="af-row__chk" aria-hidden>
      {selected ? <Icon name="check" size={10}/> : <span className="af-row__chk-empty"/>}
    </span>
    <span className="af-row__sw"/>
    <span className="af-row__main">
      <span className="af-row__name">{entity.label}</span>
      {entity.sub && <span className="af-row__sub">{entity.sub}</span>}
    </span>
    {entity.count != null && <span className="af-row__count">{entity.count}</span>}
  </button>
);

// ---------------------------------------------------------------------
// AtlasFocusPopover — full popover. Tabs left, list right.
//
// Props:
//   open                      bool
//   focus                     array of active focus entries
//   draftFocus                local working copy that diverges from `focus`
//                             until the user clicks Apply / Cancel
//   onChangeDraft(focus[])    setter
//   onApply / onCancel / onClearAll
// ---------------------------------------------------------------------
const AtlasFocusPopover = ({
  open, anchor, focus, draftFocus, onChangeDraft,
  onApply, onCancel, onClearAll, onSearch,
}) => {
  const [activeTab, setActiveTab] = _af_us("cast");
  const [query, setQuery] = _af_us("");
  if (!open) return null;

  // Pull the lists from globals; each tab maps to a known data source.
  const allFor = (tabId) => {
    if (tabId === "cast")     return (window.ATLAS_CAST || []).map((c) => ({
      type: "cast", id: c.id, label: c.name, color: c.color, sub: c.role, kind: "character",
    }));
    if (tabId === "bestiary") return (window.ATLAS_BEASTS || []).map((b) => ({
      type: "bestiary", id: b.id, label: b.name, color: b.color, sub: b.summary,
      count: b.habitat?.length, kind: "habitat",
    }));
    if (tabId === "items")    return (window.ATLAS_ITEMS || []).map((i) => ({
      type: "items", id: i.id, label: i.name, color: i.color, sub: i.summary, kind: "trace",
    }));
    if (tabId === "quests")   return (window.ATLAS_QUESTS || []).filter((q) => q.type === "quests").map((q) => ({
      type: "quests", id: q.id, label: q.name, color: "#8a3a4f", sub: q.status,
      count: q.steps?.length, kind: "route",
    }));
    if (tabId === "events")   return (window.ATLAS_QUESTS || []).filter((q) => q.type === "events").map((q) => ({
      type: "events", id: q.id, label: q.name, color: "#c79545", sub: "Ch. " + (q.chapter || "?"),
      kind: "point",
    }));
    if (tabId === "factions") return (window.ATLAS_FACTIONS || []).map((f) => ({
      type: "factions", id: f.id, label: f.name, color: f.color, sub: f.summary,
      count: f.territory?.length, kind: "territory",
    }));
    if (tabId === "locations")return (window.ATLAS_LOCATIONS || []).filter((l) => l.type === "city" || l.type === "town" || l.type === "region" || l.type === "country").map((l) => ({
      type: "locations", id: l.id, label: l.name, color: "#6b8a4a", sub: l.type, kind: "focus",
    }));
    if (tabId === "timeline") return (window.ATLAS_CHAPTERS || []).map((c, i) => ({
      type: "timeline", id: c.id, label: c.label + " — " + c.title, color: "#6a7a8a",
      sub: c.events ? c.events + " events" : "—", chapterIndex: i, kind: "snapshot",
    })).concat([
      { type: "timeline", id: "current", label: "Current chapter", color: "#6a7a8a", sub: "Tracks WR position", kind: "snapshot" },
      { type: "timeline", id: "all",     label: "All chapters",    color: "#6a7a8a", sub: "Full timespan",      kind: "snapshot" },
    ]);
    if (tabId === "lore")     return [
      { type: "lore", id: "hard-canon",   label: "Hard canon locations",     color: "#7a5a3a", sub: "Confirmed in source",       kind: "filter" },
      { type: "lore", id: "soft-canon",   label: "Soft canon locations",     color: "#7a5a3a", sub: "Implied, not confirmed",    kind: "filter" },
      { type: "lore", id: "contradiction",label: "Contradictions",           color: "#a8553f", sub: "Source disagrees with map", kind: "filter" },
      { type: "lore", id: "historical",   label: "Historical / past-tense",  color: "#7a5a3a", sub: "Pre-story locations",       kind: "filter" },
    ];
    return [];
  };

  const items = _af_um(() => {
    const list = allFor(activeTab);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((e) =>
      e.label.toLowerCase().includes(q) ||
      (e.sub && String(e.sub).toLowerCase().includes(q)));
  }, [activeTab, query]);

  const selectedIds = new Set(draftFocus.map((f) => f.type + ":" + f.id));
  const onToggle = (entity) => {
    const key = entity.type + ":" + entity.id;
    if (selectedIds.has(key)) {
      onChangeDraft(draftFocus.filter((f) => (f.type + ":" + f.id) !== key));
    } else {
      onChangeDraft([...draftFocus, entity]);
    }
  };

  // Count selected per tab for tab badges
  const countByTab = _af_um(() => {
    const out = {};
    for (const f of draftFocus) out[f.type] = (out[f.type] || 0) + 1;
    return out;
  }, [draftFocus]);

  const activeTabMeta = AF_TABS.find((t) => t.id === activeTab) || AF_TABS[0];
  const changed = JSON.stringify(focus.map((f) => f.type + ":" + f.id).sort()) !==
                  JSON.stringify(draftFocus.map((f) => f.type + ":" + f.id).sort());

  return (
    <div className="af-pop" data-ui="AtlasFocusPopover" role="dialog" aria-label="Map Focus">
      <div className="af-pop__top">
        <div className="af-pop__search">
          <Icon name="search" size={11}/>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearch && onSearch(e.target.value); }}
            placeholder="Search entities…"
            data-callback="onSearchAtlasFocusEntities"
            autoFocus
          />
        </div>
        <button className="af-pop__clear" onClick={onClearAll} data-callback="onClearAtlasFocus"
                disabled={draftFocus.length === 0}>
          Clear all
        </button>
      </div>

      <div className="af-pop__body">
        <div className="af-pop__tabs" role="tablist">
          {AF_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={"af-pop__tab" + (activeTab === t.id ? " is-on" : "")}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon name={t.icon} size={11}/>
              <span>{t.label}</span>
              {countByTab[t.id] > 0 && <span className="af-pop__tab-n">{countByTab[t.id]}</span>}
            </button>
          ))}
        </div>

        <div className="af-pop__list">
          <div className="af-pop__hint">
            <Icon name={activeTabMeta.icon} size={10}/>
            <span>{activeTabMeta.hint}</span>
          </div>
          {items.length === 0 ? (
            <div className="af-pop__empty">
              <Icon name="search" size={16}/>
              <p>No {activeTabMeta.label.toLowerCase()} match "{query}".</p>
            </div>
          ) : items.map((e) => (
            <AtlasFocusRow
              key={e.type + ":" + e.id}
              entity={e}
              selected={selectedIds.has(e.type + ":" + e.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>

      <div className="af-pop__foot">
        <span className="af-pop__count">{draftFocus.length} selected</span>
        <button className="af-pop__cancel" onClick={onCancel} data-callback="onCancelAtlasFocus">Cancel</button>
        <button className={"af-pop__apply" + (changed ? " is-changed" : "")}
                onClick={onApply} data-callback="onApplyAtlasFocus">
          Apply
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasFocusChips — strip of active focus entities at top of the map.
// Auto-collapses past 3 with a "+N more" affordance that re-opens the
// selector.
// ---------------------------------------------------------------------
const AtlasFocusChips = ({ focus, onRemove, onClearAll, onOpenSummary, onOpenSelector, max = 3 }) => {
  if (!focus || focus.length === 0) return null;
  const shown = focus.slice(0, max);
  const overflow = Math.max(0, focus.length - max);
  return (
    <div className="af-chips" data-ui="AtlasFocusChips">
      {shown.map((f) => (
        <span
          key={f.type + ":" + f.id}
          className="af-chip"
          style={{ "--c": f.color }}
          title={f.label + " — " + (AF_TABS.find((t) => t.id === f.type)?.hint || "")}
        >
          <span className="af-chip__sw"/>
          <span className="af-chip__type">{ (ENTITY_TYPES[f.type]?.label || f.type) }</span>
          <span className="af-chip__lbl">{f.label}</span>
          <button
            className="af-chip__x"
            onClick={(e) => { e.stopPropagation(); onRemove && onRemove(f); }}
            data-callback="onRemoveAtlasFocusChip"
            title="Remove this focus"
          ><Icon name="close" size={9}/></button>
        </span>
      ))}
      {overflow > 0 && (
        <button
          className="af-chip af-chip--more"
          onClick={onOpenSummary}
          data-callback="onOpenAtlasFocusSummary"
          title={overflow + " more — click to expand"}
        >+{overflow} more</button>
      )}
      <button
        className="af-chip af-chip--clear"
        onClick={onClearAll}
        data-callback="onClearAtlasFocus"
        title="Clear all focus entities"
      >Clear</button>
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasOverlayModeSelector — small pill cluster that picks how the
// overlay renders. The available modes are derived from the active
// focus entity types.
// ---------------------------------------------------------------------
const ATLAS_OVERLAY_MODES = [
  { id: "current",       label: "Current",       icon: "pin",      supports: ["cast", "items"] },
  { id: "travel",        label: "Travel route",  icon: "branch",   supports: ["cast"] },
  { id: "appearances",   label: "Appearances",   icon: "eye",      supports: ["cast", "items", "factions"] },
  { id: "ful",           label: "Found/Used/Lost",icon: "gem",     supports: ["items"] },
  { id: "habitat",       label: "Habitat",       icon: "claw",     supports: ["bestiary"] },
  { id: "territory",     label: "Territory",     icon: "shield",   supports: ["factions"] },
  { id: "steps",         label: "Quest steps",   icon: "scroll",   supports: ["quests"] },
  { id: "snapshot",      label: "Timeline state",icon: "clock",    supports: ["timeline"] },
  { id: "intersect",     label: "Intersections", icon: "link",     supports: ["cast"] },
  { id: "warnings",      label: "Warnings",      icon: "warn",     supports: ["lore"] },
];

const AtlasOverlayModeSelector = ({ focusTypes = [], mode, onSetMode, compact = false }) => {
  const supported = ATLAS_OVERLAY_MODES.filter((m) =>
    m.supports.length === 0 || m.supports.some((t) => focusTypes.includes(t)));
  // Always allow "current" as a fallback
  const list = supported.length === 0
    ? ATLAS_OVERLAY_MODES.filter((m) => m.id === "current")
    : supported;
  if (compact) {
    return (
      <select
        className="af-mode af-mode--compact"
        value={mode}
        onChange={(e) => onSetMode(e.target.value)}
        data-callback="onSetAtlasOverlayMode"
      >
        {list.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    );
  }
  return (
    <div className="af-mode" data-ui="AtlasOverlayModeSelector">
      {list.map((m) => (
        <button
          key={m.id}
          className={"af-mode__b" + (mode === m.id ? " is-on" : "")}
          onClick={() => onSetMode(m.id)}
          data-callback="onSetAtlasOverlayMode"
          data-mode={m.id}
          title={m.label}
        >
          <Icon name={m.icon} size={10}/>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasLegendStrip — compact active-layer chips. Each toggleable.
// Built from the current focus + which entity-kind layers are visible.
// ---------------------------------------------------------------------
const AtlasLegendStrip = ({ counts, layerState, onToggleLayer }) => {
  const items = [
    { id: "characters", label: "Characters", color: "#7a6aa3", count: counts.characters },
    { id: "routes",     label: "Routes",     color: "#7a6aa3", count: counts.routes },
    { id: "items",      label: "Items",      color: "#b78a52", count: counts.items },
    { id: "quests",     label: "Quests",     color: "#8a3a4f", count: counts.quests },
    { id: "events",     label: "Events",     color: "#c79545", count: counts.events },
    { id: "beasts",     label: "Beasts",     color: "#8a3a4f", count: counts.beasts },
    { id: "factions",   label: "Factions",   color: "#324a1f", count: counts.factions },
    { id: "warnings",   label: "Warnings",   color: "#c98a2c", count: counts.warnings },
  ].filter((i) => (i.count || 0) > 0);

  if (items.length === 0) return null;
  return (
    <div className="af-legend" data-ui="AtlasLegendStrip">
      {items.map((it) => {
        const on = layerState[it.id] !== false;
        return (
          <button
            key={it.id}
            className={"af-legend__chip" + (on ? " is-on" : "")}
            onClick={() => onToggleLayer(it.id)}
            data-callback="onToggleAtlasLayerFromLegend"
            data-layer={it.id}
            title={(on ? "Hide " : "Show ") + it.label}
          >
            <span className="af-legend__sw" style={{ background: it.color }}/>
            <span>{it.label}</span>
            <span className="af-legend__n">{it.count}</span>
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasMiniMap — small floating inset (corner overlay only). Shows a
// stylised silhouette of the world plate + a viewport rectangle the
// user can drag.
//
// `viewport` is a {x, y, w, h} rect in canvas coords (1200×700).
// ---------------------------------------------------------------------
const AtlasFocusMiniMap = ({
  visible, onToggle, onNavigate, viewport,
  corner = "bottom-right", scale = 1,
}) => {
  if (!visible) {
    return (
      <button
        className="af-mini af-mini--collapsed"
        data-ui="AtlasMiniMap"
        data-corner={corner}
        onClick={onToggle}
        data-callback="onToggleAtlasMiniMap"
        title="Show mini-map"
      ><Icon name="compass" size={11}/></button>
    );
  }
  const W = 1200, H = 700;
  const vp = viewport || { x: 0, y: 0, w: W, h: H };
  return (
    <div className="af-mini" data-ui="AtlasMiniMap" data-corner={corner}>
      <div className="af-mini__head">
        <Icon name="compass" size={9}/>
        <span>Overview</span>
        <button className="af-mini__x" onClick={onToggle} data-callback="onToggleAtlasMiniMap"
                title="Hide mini-map">
          <Icon name="close" size={9}/>
        </button>
      </div>
      <div className="af-mini__body">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
             onClick={(e) => {
               const rect = e.currentTarget.getBoundingClientRect();
               const x = ((e.clientX - rect.left) / rect.width) * W;
               const y = ((e.clientY - rect.top)  / rect.height) * H;
               onNavigate && onNavigate({ x, y });
             }}>
          <rect x="0" y="0" width={W} height={H} fill="#ebdcb4" opacity="0.4"/>
          <path d="M 30 130 C 60 90, 280 70, 360 200 S 400 380, 320 420 S 100 460, 60 320 Z
                   M 380 290 C 460 260, 620 230, 690 360 S 540 480, 380 420 Z
                   M 740 200 C 820 170, 1100 170, 1140 320 S 980 510, 880 480 S 720 360, 740 200 Z"
            fill="#d4c089" stroke="#4a381c" strokeWidth="2"/>
          {/* Major region labels — the live world's top-level regions */}
          {(window.ATLAS_LOCATIONS || [])
            .filter((l) => (l.type === "country" || l.type === "continent" || l.type === "region") && l.placed !== false && (l.parent === "world" || !l.parent))
            .slice(0, 3)
            .map((l, i) => (
              <text key={l.id} x={[180, 540, 940][i]} y={[260, 360, 340][i]}
                    fontFamily="var(--font-display)" fontSize={i === 1 ? 34 : 40}
                    fill="rgba(74,56,28,0.55)" textAnchor="middle" fontWeight="600">{l.name}</text>
            ))}
          {/* Viewport rectangle */}
          <rect x={vp.x} y={vp.y} width={vp.w} height={vp.h}
                fill="rgba(201,138,44,0.18)" stroke="#c98a2c" strokeWidth="6"/>
        </svg>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasFocusInspector — replaces the old AtlasInspector. Summarises the
// current focus selection across all entity types.
// ---------------------------------------------------------------------
const AtlasFocusInspector = ({
  focus, overlayMode, locById, beasts, items, factions, routes, quests, chapters,
  selected, collapsed, onToggleCollapsed, onOpenEditor, onOpenSourceMention,
  onOpenRelatedEntity, onPinFocus, onSelectEntity,
}) => {
  // Title + summary derive from the focus shape.
  const summary = _af_um(() => {
    if (!focus || focus.length === 0) {
      return selected && locById[selected.id]
        ? { title: locById[selected.id].name, subtitle: locById[selected.id].type, kind: "location",
            body: locById[selected.id].summary }
        : { title: "No focus", subtitle: "Open Map Focus", kind: "empty",
            body: "Pick a character, item, faction, beast or quest to overlay on the map. Multiple selections show how they relate spatially." };
    }
    if (focus.length === 1) {
      const f = focus[0];
      if (f.type === "cast") {
        const route = routes.find((r) => r.characterId === f.id);
        return { title: f.label + " — Route", subtitle: "Cast · single character", kind: "cast", focus: f,
                 body: route ? route.summary : "No travel recorded yet for this character.",
                 stops: route?.waypoints || [] };
      }
      if (f.type === "items") {
        const item = items.find((i) => i.id === f.id);
        return { title: f.label + " — Location History", subtitle: "Items · trace", kind: "items", focus: f,
                 body: item?.summary,
                 trace: item ? [
                   item.found && { label: "Found", at: locById[item.found.locationId]?.name, ch: item.found.chapter },
                   item.used  && { label: "Used",  at: locById[item.used.locationId]?.name,  ch: item.used.chapter },
                   item.lost  && { label: "Lost",  at: locById[item.lost.locationId]?.name,  ch: item.lost.chapter },
                 ].filter(Boolean) : [] };
      }
      if (f.type === "bestiary") {
        const b = beasts.find((x) => x.id === f.id);
        return { title: f.label + " — Habitat", subtitle: "Bestiary · region", kind: "bestiary", focus: f,
                 body: b?.summary,
                 habitats: b ? b.habitat.map((id) => locById[id]).filter(Boolean) : [] };
      }
      if (f.type === "factions") {
        const fa = factions.find((x) => x.id === f.id);
        return { title: f.label + " — Territory", subtitle: "Factions · controlled regions", kind: "factions", focus: f,
                 body: fa?.summary,
                 territory: fa ? fa.territory.map((id) => locById[id]).filter(Boolean) : [] };
      }
      if (f.type === "quests") {
        const q = quests.find((x) => x.id === f.id);
        return { title: f.label + " — Quest Route", subtitle: "Quests · step locations", kind: "quests", focus: f,
                 body: q ? (q.status === "active" ? "Currently active quest." : "Status: " + q.status) : "",
                 steps: q ? q.steps.map((s) => ({ ...s, at: locById[s.locationId]?.name })) : [] };
      }
      if (f.type === "timeline") {
        return { title: "Map state · " + f.label, subtitle: "Timeline · snapshot", kind: "timeline", focus: f,
                 body: "All overlays now reflect the state of the map at this point in the story." };
      }
      return { title: f.label, subtitle: ENTITY_TYPES[f.type]?.label || f.type, kind: f.type, focus: f, body: f.sub || "" };
    }
    // 2+ entities — comparison summary
    const types = Array.from(new Set(focus.map((f) => f.type)));
    if (types.length === 1 && types[0] === "cast") {
      // Cast intersection
      const ids = focus.map((f) => f.id);
      const rs = routes.filter((r) => ids.includes(r.characterId));
      const allStops = rs.flatMap((r) => r.waypoints.map((w) => w.locationId));
      const shared = [...new Set(allStops.filter((l, i) => allStops.indexOf(l) !== i))];
      return { title: focus.length + " Cast Routes", subtitle: focus.map((f) => f.label).join(" + "), kind: "compare-cast",
               body: shared.length
                 ? "Routes cross at " + shared.map((id) => locById[id]?.name).filter(Boolean).slice(0, 3).join(", ") + (shared.length > 3 ? "…" : "") + "."
                 : "No directly shared waypoints.",
               sharedLocations: shared.map((id) => locById[id]).filter(Boolean),
               routes: rs };
    }
    return { title: focus.length + " items focused", subtitle: types.map((t) => ENTITY_TYPES[t]?.label || t).join(" · "),
             kind: "compare-mixed",
             body: "Overlays for " + focus.length + " entities across " + types.length + " types are visible on the map." };
  }, [focus, routes, items, beasts, factions, quests, locById, selected]);

  return (
    <div className={"af-insp" + (collapsed ? " is-collapsed" : "")} data-ui="AtlasFocusInspector">
      <div className="af-insp__bar">
        <button className="af-insp__bar-toggle"
                onClick={onToggleCollapsed} data-callback="onToggleAtlasInspector"
                title={collapsed ? "Expand inspector" : "Collapse inspector"}>
          <Icon name={collapsed ? "chevron-up" : "chevron-d"} size={10}/>
          <span className="af-insp__bar-title">{summary.title}</span>
          <span className="af-insp__bar-kind">{summary.subtitle}</span>
        </button>
        {!collapsed && (
          <button className="af-insp__pin" onClick={() => onPinFocus && onPinFocus(focus)}
                  data-callback="onAtlasInspectorPinFocus" title="Pin this focus"><Icon name="pin-tack" size={10}/></button>
        )}
      </div>
      {!collapsed && (
        <div className="af-insp__body">
          {summary.body && <p className="af-insp__sum">{summary.body}</p>}

          {summary.kind === "cast" && summary.stops && summary.stops.length > 0 && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Route</div>
              <ol className="af-insp__list">
                {summary.stops.map((w, i) => (
                  <li key={i} className="af-insp__stop">
                    <span className="af-insp__stop-n">{i + 1}</span>
                    <button className="af-insp__stop-loc" onClick={() => onSelectEntity && onSelectEntity({ type: "locations", id: w.locationId, label: locById[w.locationId]?.name })}
                            data-callback="onAtlasInspectorOpenRelatedEntity">
                      {locById[w.locationId]?.name || w.locationId}
                    </button>
                    <span className="af-insp__stop-meta">{w.label}{w.chapter ? " · Ch. " + w.chapter : ""}</span>
                    {!w.confirmed && <span className="af-insp__stop-warn" title="Implied — not directly stated">~</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {summary.kind === "items" && summary.trace && summary.trace.length > 0 && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Found / Used / Lost</div>
              <div className="af-insp__trace">
                {summary.trace.map((t, i) => (
                  <div key={i} className="af-insp__trace-row">
                    <span className="af-insp__trace-k">{t.label}</span>
                    <span className="af-insp__trace-v">{t.at || "—"}{t.ch ? " · Ch. " + t.ch : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.kind === "bestiary" && summary.habitats && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Habitat regions</div>
              <div className="af-insp__chips">
                {summary.habitats.map((h) => (
                  <button key={h.id} className="af-insp__chip" onClick={() => onSelectEntity && onSelectEntity({ type: "locations", id: h.id, label: h.name })}>
                    <span className="af-insp__chip__sw" style={{ background: "#8a3a4f" }}/>{h.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {summary.kind === "factions" && summary.territory && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Controlled locations</div>
              <div className="af-insp__chips">
                {summary.territory.map((h) => (
                  <button key={h.id} className="af-insp__chip" onClick={() => onSelectEntity && onSelectEntity({ type: "locations", id: h.id, label: h.name })}>
                    <span className="af-insp__chip__sw" style={{ background: "#324a1f" }}/>{h.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {summary.kind === "quests" && summary.steps && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Steps</div>
              <ol className="af-insp__list">
                {summary.steps.map((s, i) => (
                  <li key={i} className="af-insp__stop">
                    <span className="af-insp__stop-n">{i + 1}</span>
                    <button className="af-insp__stop-loc">{s.at || s.locationId}</button>
                    <span className="af-insp__stop-meta">{s.label}{s.chapter ? " · Ch. " + s.chapter : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {summary.kind === "compare-cast" && summary.sharedLocations && summary.sharedLocations.length > 0 && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Possible meeting points</div>
              <div className="af-insp__chips">
                {summary.sharedLocations.map((l) => (
                  <button key={l.id} className="af-insp__chip" onClick={() => onSelectEntity && onSelectEntity({ type: "locations", id: l.id, label: l.name })}>
                    <span className="af-insp__chip__sw" style={{ background: "#c98a2c" }}/>{l.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {summary.kind === "compare-cast" && summary.routes && (
            <div className="af-insp__sec">
              <div className="af-insp__sech">Individual routes</div>
              <div className="af-insp__chips">
                {summary.routes.map((r) => (
                  <span key={r.id} className="af-insp__chip" style={{ borderLeftColor: r.color }}>
                    <span className="af-insp__chip__sw" style={{ background: r.color }}/>
                    {r.characterName} · {r.waypoints.length} stops
                  </span>
                ))}
              </div>
            </div>
          )}

          {focus && focus.length > 0 && (
            <div className="af-insp__actions">
              <button className="af-insp__a" onClick={onOpenEditor} data-callback="onOpenAtlasFullScreen">
                Open in Atlas Editor
              </button>
              <button className="af-insp__a" onClick={() => onOpenSourceMention && onOpenSourceMention(focus[0])}
                      data-callback="onAtlasInspectorOpenSource">
                Open source mentions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  AtlasFocusButton, AtlasFocusPopover, AtlasFocusChips,
  AtlasOverlayModeSelector, AtlasLegendStrip,
  AtlasFocusMiniMap, AtlasFocusInspector,
  AF_TABS, ATLAS_OVERLAY_MODES,
});
