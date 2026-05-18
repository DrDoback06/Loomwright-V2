// =====================================================================
// atlas-quick.jsx — In-tab Atlas quick view + fullscreen extras.
//
// Components:
//   - AtlasMiniToolbar     persistent ring of icon buttons (header)
//   - AtlasQuickPanel      compact dossier-style atlas: map + roster +
//                          cast tray + scrubber + chapter-fade default
//   - AtlasQuickRing       long-press radial quick-action menu
//   - AtlasFsRail          right-edge collapsible icon rail (fullscreen)
//   - AtlasCastDock        cast journey panel for fullscreen with full
//                          per-cast depth (timeline strip, pacing heat,
//                          co-presence, mood tags, spider links)
// =====================================================================

const { useState: _us_aq, useMemo: _um_aq, useRef: _ur_aq, useEffect: _ue_aq } = React;

// ---------------------------------------------------------------------
// Mini-toolbar — persistent in the docked tab header. Hover hints.
// ---------------------------------------------------------------------
const AQ_TOOLS = [
  { id: "select", icon: "cursor",  label: "Select",        kbd: "V" },
  { id: "pan",    icon: "hand",    label: "Pan",           kbd: "H" },
  { id: "add",    icon: "plus",    label: "Add location",  kbd: "L" },
  { id: "route",  icon: "route",   label: "Add route",     kbd: "R" },
  { id: "label",  icon: "type",    label: "Add label",     kbd: "T" },
];
const AQ_VIEW = [
  { id: "fit",    icon: "compress", label: "Fit view",      kbd: "F" },
  { id: "zoomin", icon: "zoom-in",  label: "Zoom in",       kbd: "+" },
  { id: "zoomout",icon: "zoom-out", label: "Zoom out",      kbd: "-" },
];

const AtlasMiniToolbar = ({ tool = "select", onPickTool, onZoomIn, onZoomOut, onFitView, onOpenFs, fullscreen, onExitFs }) => (
  <div className="aq-mini" data-ui="AtlasMiniToolbar" role="toolbar" aria-label="Atlas mini toolbar">
    <div className="aq-mini__group">
      {AQ_TOOLS.map((t) => (
        <button key={t.id}
          className={"aq-mini__btn" + (tool === t.id ? " is-active" : "")}
          onClick={() => onPickTool && onPickTool(t.id)}
          data-callback="onPickAtlasTool"
          aria-pressed={tool === t.id}
          title={t.label + " (" + t.kbd + ")"}
        >
          <Icon name={t.icon} size={12}/>
          <span className="aq-mini__tip">{t.label}<span className="aq-mini__kbd">{t.kbd}</span></span>
        </button>
      ))}
    </div>
    <span className="aq-mini__rule"/>
    <div className="aq-mini__group">
      <button className="aq-mini__btn" onClick={onZoomOut} title="Zoom out (-)" data-callback="onZoomOut">
        <Icon name="zoom-out" size={12}/><span className="aq-mini__tip">Zoom out<span className="aq-mini__kbd">-</span></span>
      </button>
      <button className="aq-mini__btn" onClick={onFitView} title="Fit view (F)" data-callback="onFitView">
        <Icon name="compress" size={12}/><span className="aq-mini__tip">Fit view<span className="aq-mini__kbd">F</span></span>
      </button>
      <button className="aq-mini__btn" onClick={onZoomIn} title="Zoom in (+)" data-callback="onZoomIn">
        <Icon name="zoom-in" size={12}/><span className="aq-mini__tip">Zoom in<span className="aq-mini__kbd">+</span></span>
      </button>
    </div>
    <span className="aq-mini__rule"/>
    <div className="aq-mini__group">
      <button className="aq-mini__btn"
        onClick={fullscreen ? onExitFs : onOpenFs}
        title={fullscreen ? "Exit full-screen" : "Open full-screen editor"}
        data-callback={fullscreen ? "onExitAtlasFullScreen" : "onOpenAtlasFullScreen"}>
        <Icon name={fullscreen ? "close" : "expand"} size={12}/>
        <span className="aq-mini__tip">
          {fullscreen ? "Exit full-screen" : "Open editor"}<span className="aq-mini__kbd">⌘E</span>
        </span>
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// Quick-action ring — opens on long-press anywhere on the map.
// ---------------------------------------------------------------------
const RING_ITEMS = [
  { id: "addloc",  icon: "plus",     label: "Add here" },
  { id: "label",   icon: "type",     label: "Label" },
  { id: "route",   icon: "route",    label: "Route" },
  { id: "drop",    icon: "stack",    label: "Drop entity" },
  { id: "measure", icon: "ruler",    label: "Measure" },
  { id: "focus",   icon: "compress", label: "Zoom here" },
];
const AtlasQuickRing = ({ x, y, onPick, onDismiss }) => {
  const radius = 56;
  return (
    <>
      <div className="aq-ring__scrim" onClick={onDismiss} role="presentation"/>
      <div className="aq-ring" style={{ left: x, top: y }} data-ui="AtlasQuickRing">
        <div className="aq-ring__hub"/>
        {RING_ITEMS.map((it, i) => {
          const angle = (i / RING_ITEMS.length) * Math.PI * 2 - Math.PI / 2;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;
          return (
            <button key={it.id}
              className="aq-ring__wedge"
              style={{
                transform: "translate(" + (dx - 18) + "px, " + (dy - 18) + "px)",
                animationDelay: (i * 25) + "ms",
              }}
              onClick={() => { onPick && onPick(it.id); onDismiss && onDismiss(); }}
              data-callback={"onRing_" + it.id}
              title={it.label}
            >
              <Icon name={it.icon} size={14}/>
              <span className="aq-ring__wedge__lbl">{it.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------
// Helper — mention count per chapter for a location (used in roster)
// ---------------------------------------------------------------------
function locationsThisChapter(locations, chapters, scrubChIdx) {
  if (scrubChIdx == null || !chapters[scrubChIdx]) return new Set();
  return new Set(chapters[scrubChIdx].locations || []);
}

// ---------------------------------------------------------------------
// AtlasQuickPanel — the in-tab compact view
// ---------------------------------------------------------------------
const AtlasQuickPanel = ({
  locations, routes, chapters, cast, queue,
  selectedId, onSelectLocation,
  selectedRouteId, onSelectRoute,
  scrubChId, onSelectChapter,
  activeCastIds = [], onToggleCast,
  tool, onPickTool,
  onOpenFs, fullscreen, onExitFs,
  onOpenReview,
  grain = true, onToggleGrain,
}) => {
  const [search, setSearch]       = _us_aq("");
  const [typeFilter, setTypeFilter] = _us_aq("all");
  const [ring, setRing]           = _us_aq(null); // {x, y}
  const longPressRef              = _ur_aq(null);
  const mapRef                    = _ur_aq(null);

  const selected = locations.find((l) => l.id === selectedId) || null;
  const chapterIdx = chapters.findIndex((c) => c.id === scrubChId);
  const here = locationsThisChapter(locations, chapters, chapterIdx);
  const fade1 = locationsThisChapter(locations, chapters, chapterIdx - 1);
  const fade2 = locationsThisChapter(locations, chapters, chapterIdx - 2);

  const filtered = _um_aq(() => {
    let xs = locations;
    if (typeFilter !== "all") xs = xs.filter((l) => l.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((l) => (l.name || "").toLowerCase().includes(q));
    }
    return xs;
  }, [locations, typeFilter, search]);

  // Stats
  const stats = _um_aq(() => {
    const placed = locations.filter((l) => l.type !== "world").length;
    return [
      { k: "Locations",  v: placed,                 sub: locations.length + " total" },
      { k: "On map now", v: here.size,              sub: chapters[chapterIdx]?.label || "—" },
      { k: "Routes",     v: routes.length,          sub: routes.reduce((a, r) => a + r.waypoints.length, 0) + " stops" },
      { k: "Review",     v: queue.length,           sub: "in queue" },
    ];
  }, [locations, routes, here, queue, chapterIdx, chapters]);

  // --- Long-press → open quick-ring ---
  const onMapPointerDown = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList?.contains("atlas__svg")) return;
    if (e.target.closest && e.target.closest(".aq-pin, .aq__selcard, .aq-ring, .aq-region")) return;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    longPressRef.current = setTimeout(() => {
      setRing({ x, y });
    }, 380);
  };
  const cancelLongPress = () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };
  _ue_aq(() => () => cancelLongPress(), []);

  // Keyboard: ⌘E opens fullscreen
  _ue_aq(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        fullscreen ? onExitFs && onExitFs() : onOpenFs && onOpenFs();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, onOpenFs, onExitFs]);

  // Pin tier helper
  const pinTier = (id) => {
    if (here.has(id)) return "now";
    if (fade1.has(id)) return "fade";
    if (fade2.has(id)) return "ghost";
    return "ghost";
  };

  // Active cast routes
  const activeRoutes = routes.filter((r) => activeCastIds.includes(r.characterId));

  return (
    <div className="aq" data-ui="AtlasQuickPanel" data-state="quick">
      {/* HEADER */}
      <div className="aq__head">
        <div className="aq__head__title">
          <Icon name="map" size={14}/> Atlas
          <em>· quick view</em>
        </div>
        <AtlasMiniToolbar
          tool={tool} onPickTool={onPickTool}
          onZoomIn={() => {}} onZoomOut={() => {}} onFitView={() => {}}
          fullscreen={fullscreen} onOpenFs={onOpenFs} onExitFs={onExitFs}
        />
      </div>

      {/* STATS STRIP */}
      <div className="aq-stats">
        {stats.map((s) => (
          <div key={s.k} className="aq-stats__cell">
            <div className="aq-stats__k">{s.k}</div>
            <div className="aq-stats__v">{s.v}</div>
            <div className="aq-stats__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* SPLIT */}
      <div className="aq__split">
        {/* MAP COLUMN */}
        <div className="aq__main">
          <div
            className={"aq-map" + (grain ? " aq-map--grain" : "")}
            ref={mapRef}
            onMouseDown={onMapPointerDown}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={onMapPointerDown}
            onTouchEnd={cancelLongPress}
            data-callback="onMapPointer"
          >
            {/* Cartography svg from atlas.jsx */}
            {window.AtlasMapPlate && (
              <window.AtlasMapPlate
                locations={locations}
                layers={{ regions: true, cities: true, buildings: true, labels: true, isolines: true, grid: false, texture: grain }}
                selectedId={selectedId}
              />
            )}

            {/* Routes (active cast only) — beaded paths */}
            {window.AtlasTravelRouteSvg && (
              <window.AtlasTravelRouteSvg
                routes={activeRoutes}
                locations={locations}
                selectedRouteId={selectedRouteId}
                scrubChapter={null}
              />
            )}

            {/* Region labels */}
            {locations.filter((l) => l.type === "region" || l.type === "country" || l.type === "continent").map((l) => {
              const tier = pinTier(l.id);
              return (
                <div key={l.id}
                  className={"aq-region aq-region--" + l.type + " aq-region--" + tier + (selectedId === l.id ? " is-selected" : "")}
                  style={{ left: l.x + "%", top: l.y + "%" }}
                >
                  {l.name}
                </div>
              );
            })}

            {/* Pins */}
            <div className="aq-map__overlay">
              {locations.filter((l) => l.type !== "region" && l.type !== "country" && l.type !== "continent" && l.type !== "world").map((l) => {
                const tier = pinTier(l.id);
                const queued = queue.some((q) => q.name?.toLowerCase().includes(l.name.toLowerCase()));
                return (
                  <button
                    key={l.id}
                    className={"aq-pin aq-pin--" + l.type + " aq-pin--" + tier + (selectedId === l.id ? " is-selected" : "")}
                    style={{ left: l.x + "%", top: l.y + "%" }}
                    onClick={(e) => { e.stopPropagation(); onSelectLocation && onSelectLocation(l.id); }}
                    data-callback="onSelectLocation"
                    data-loc-id={l.id}
                    title={l.name + " · " + l.type}
                  >
                    <span className="aq-pin__dot"/>
                    <span>{l.name}</span>
                    {queued && <span className="aq-pin__dot" style={{ background: "oklch(0.55 0.18 60)" }}/>}
                  </button>
                );
              })}
            </div>

            {/* Compass */}
            <div className="aq-map__compass" aria-hidden>
              <span className="aq-map__compass__n">N</span>
            </div>

            {/* Selected card */}
            {selected && (
              <div className="aq__selcard" data-ui="AtlasQuickSelectedCard">
                <div className="aq__selcard__name">{selected.name}</div>
                <div className="aq__selcard__sub">{selected.epithet || selected.summary || (selected.type + " · " + (selected.parent || "—"))}</div>
                <div className="aq__selcard__chips">
                  <span className="aq__selcard__chip">{selected.type}</span>
                  {selected.chapterRange && <span className="aq__selcard__chip">{selected.chapterRange}</span>}
                  {selected.parent && <span className="aq__selcard__chip">in {selected.parent}</span>}
                  {selected.queue ? <span className="aq__selcard__chip is-queue">{selected.queue} review</span> : null}
                </div>
                <div className="aq__selcard__actions">
                  <button className="aq__selcard__btn aq__selcard__btn--primary" onClick={onOpenFs} data-callback="onOpenAtlasFullScreen">
                    Open in editor
                  </button>
                  <button className="aq__selcard__btn" data-callback="onOpenLocationDossier">Dossier</button>
                  <button className="aq__selcard__btn aq__selcard__btn--ghost" data-callback="onJumpManuscript" title="Jump to first mention">
                    <Icon name="paper" size={11}/>
                  </button>
                </div>
              </div>
            )}

            {/* Quick-action ring */}
            {ring && <AtlasQuickRing x={ring.x} y={ring.y} onPick={() => {}} onDismiss={() => setRing(null)}/>}
          </div>
        </div>

        {/* SIDE — roster + cast tray */}
        <div className="aq__side">
          <div className="aq-roster">
            <div className="aq-roster__head">
              <span className="aq-roster__title">Locations</span>
              <span className="aq-roster__count">{filtered.length} of {locations.length}</span>
            </div>
            <div className="aq-roster__search">
              <Icon name="search" size={11}/>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a place…" data-callback="onSearchLocation"/>
            </div>
            <div className="aq-roster__filter">
              {["all", "country", "region", "city", "town", "village", "building"].map((t) => (
                <button key={t}
                  className={"aq-roster__chip" + (typeFilter === t ? " is-active" : "")}
                  onClick={() => setTypeFilter(t)}
                  data-callback="onFilterLocationType"
                >{t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
            <div className="aq-roster__list">
              {filtered.length === 0 ? (
                <div className="aq-roster__empty">No locations match.</div>
              ) : filtered.map((l) => {
                const isHere = here.has(l.id);
                return (
                  <div key={l.id}
                    className={"aq-roster__row" + (selectedId === l.id ? " is-selected" : "") + (isHere ? " is-here" : "")}
                    onClick={() => onSelectLocation && onSelectLocation(l.id)}
                    role="button" tabIndex={0}
                    data-callback="onSelectLocation"
                    draggable
                    onDragStart={(e) => e.dataTransfer?.setData("text/loomwright-loc", l.id)}
                    title="Drag onto the map to place"
                  >
                    <span className={"aq-roster__row__bullet aq-roster__row__bullet--" + l.type}/>
                    <span className="aq-roster__row__name">{l.name}</span>
                    <span className="aq-roster__row__type">{l.type}</span>
                    <span className="aq-roster__row__here" title={isHere ? "On map this chapter" : ""}>{isHere ? "•" : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="aq-roster__hint">Drag a row onto the map to place it.</div>
          </div>

          <div className="aq-cast">
            <div className="aq-cast__head">
              <span className="aq-cast__title">Cast on map</span>
              <span className="aq-cast__count">{activeCastIds.length}/{cast.length}</span>
              <span style={{ flex: 1 }}/>
              <button className="aq-cast__more" onClick={onOpenFs} data-callback="onOpenAtlasFullScreen">More in editor →</button>
            </div>
            <div className="aq-cast__row">
              {cast.map((c) => {
                const on = activeCastIds.includes(c.id);
                return (
                  <button key={c.id}
                    className={"aq-cast__chip" + (on ? " is-on" : "")}
                    style={{ "--cc": c.color }}
                    onClick={() => onToggleCast && onToggleCast(c.id)}
                    data-callback="onToggleCastJourney"
                    draggable
                    onDragStart={(e) => e.dataTransfer?.setData("text/loomwright-cast", c.id)}
                    title={c.name + " — toggle journey"}
                  >
                    <span className="aq-cast__chip__avatar">{c.initials}</span>
                    <span className="aq-cast__chip__name">{c.name.split(" ")[0]}</span>
                    {on && <span className="aq-cast__chip__on" aria-hidden/>}
                  </button>
                );
              })}
              <button className="aq-cast__add" data-callback="onAddCastToAtlas">+ add</button>
            </div>
            <div className="aq-cast__legend">Toggle to show their travel; drag onto the map to add a stop.</div>
          </div>
        </div>
      </div>

      {/* SCRUBBER */}
      <div className="aq-scrub">
        <div className="aq-scrub__head">
          <span className="aq-scrub__title">Chapter scrubber</span>
          <span className="aq-scrub__sub">
            {chapters[chapterIdx]?.title || "—"} · earlier chapters fade behind
          </span>
        </div>
        <div className="aq-scrub__rail">
          {chapters.map((c, i) => {
            const cls =
              i === chapterIdx     ? "aq-scrub__pip aq-scrub__pip--now" :
              i === chapterIdx - 1 ? "aq-scrub__pip aq-scrub__pip--fade fade-1" :
              i === chapterIdx - 2 ? "aq-scrub__pip aq-scrub__pip--fade fade-2" :
              i <  chapterIdx      ? "aq-scrub__pip aq-scrub__pip--past" :
                                     "aq-scrub__pip aq-scrub__pip--future";
            return (
              <button key={c.id} className={cls}
                onClick={() => onSelectChapter && onSelectChapter(c.id)}
                data-callback="onSelectChapterOnAtlas"
                title={c.title}
              >
                <span className="aq-scrub__pip__lbl">{c.label.replace("Ch. ", "")}</span>
                {c.events ? <span className="aq-scrub__pip__dot"/> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// AtlasFsRail — collapsible right-edge icon rail (fullscreen only)
// ---------------------------------------------------------------------
const FS_RAIL_ITEMS = [
  { id: "layers",  icon: "stack",  label: "Layers" },
  { id: "tray",    icon: "drag",   label: "Entity tray" },
  { id: "cast",    icon: "users",  label: "Cast journeys" },
  { id: "inspect", icon: "info",   label: "Inspector" },
  { id: "minimap", icon: "map",    label: "Mini-map" },
  { id: "review",  icon: "bell",   label: "Review", badge: 4 },
];
const AtlasFsRail = ({ open = "cast", onOpen, badges = {} }) => (
  <div className="atlas-fs-rail" data-ui="AtlasFsRail">
    {FS_RAIL_ITEMS.map((it) => (
      <button key={it.id}
        className={"atlas-fs-rail__btn" + (open === it.id ? " is-open" : "")}
        onClick={() => onOpen && onOpen(open === it.id ? null : it.id)}
        title={it.label}
        data-callback="onToggleAtlasFsPanel"
      >
        <Icon name={it.icon} size={13}/>
        {(badges[it.id] || it.badge) ? <span className="atlas-fs-rail__btn__badge">{badges[it.id] || it.badge}</span> : null}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// AtlasCastDock — full per-cast journey panel (fullscreen overlay)
// ---------------------------------------------------------------------
const MOOD_BY_CHAPTER = {
  aelinor: { 1: ["watchful"], 2: ["restless"], 3: ["resolute"], 4: ["wary"], 5: ["torn"], 6: ["grim"], 7: ["decided"] },
  saren:   { 3: ["scheming"], 4: ["charming"], 5: [], 6: ["covert"], 7: ["cornered"] },
  brec:    { 2: ["loyal"],   3: ["watchful"], 4: ["weary"], 5: ["resolute"] },
};
const QUEST_BY_CHAPTER = {
  aelinor: { 6: "Auger's Walk", 7: "Glass Audience" },
  saren:   { 7: "Glass Audience" },
};

function pacingForCast(route, chapters) {
  // length spent at each chapter — derived from waypoint kind: arrive|stop|depart
  return chapters.map((c, i) => {
    const ch = i + 1;
    const w = route.waypoints.find((w) => w.chapter === ch);
    if (!w) return 0;
    if (w.kind === "stop")    return 1;
    if (w.kind === "arrive")  return 0.7;
    if (w.kind === "depart")  return 0.4;
    return 0.3;
  });
}

const AtlasCastDock = ({ cast, routes, chapters, locations, activeIds = [], onToggleCast, onSelectRoute, onClose }) => {
  const active = cast.filter((c) => activeIds.includes(c.id));
  // Co-presence: chapters where 2+ active casts are at same location
  const copresence = _um_aq(() => {
    const out = []; // {a, b, locId, chapter}
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const ra = routes.find((r) => r.characterId === active[i].id);
        const rb = routes.find((r) => r.characterId === active[j].id);
        if (!ra || !rb) continue;
        ra.waypoints.forEach((wa) => {
          rb.waypoints.forEach((wb) => {
            if (wa.locationId === wb.locationId && wa.chapter === wb.chapter) {
              out.push({ a: active[i], b: active[j], locId: wa.locationId, chapter: wa.chapter });
            }
          });
        });
      }
    }
    return out;
  }, [active, routes]);

  return (
    <div className="acast-dock" data-ui="AtlasCastDock">
      <div className="acast-dock__head">
        <Icon name="users" size={12}/>
        <span>Cast journeys</span>
        <span className="acast-dock__head__count">{active.length} active</span>
        <span style={{ flex: 1 }}/>
        <button className="aq-mini__btn" onClick={onClose} title="Collapse" data-callback="onClosePanel">
          <Icon name="close" size={11}/>
        </button>
      </div>

      <div className="acast-dock__roster">
        {cast.map((c) => {
          const on = activeIds.includes(c.id);
          return (
            <div key={c.id}
              className={"acast-dock__row" + (on ? " is-on" : "")}
              style={{ "--cc": c.color }}
              onClick={() => onToggleCast && onToggleCast(c.id)}
              role="switch" aria-checked={on}
              data-callback="onToggleCastJourney"
            >
              <div className="acast-dock__row__avatar">{c.initials}</div>
              <div>
                <div className="acast-dock__row__name">{c.name}</div>
                <div className="acast-dock__row__role">{c.role}</div>
              </div>
              <div className="acast-dock__row__toggle"/>
            </div>
          );
        })}
      </div>

      <div className="acast-dock__depth">
        {active.length === 0 ? (
          <div className="acast-dock__depth__empty">
            Toggle a cast member above to see their journey, pacing, mood, and crossings.
          </div>
        ) : active.map((c) => {
          const route = routes.find((r) => r.characterId === c.id);
          if (!route) return (
            <div key={c.id} className="acast-dock__sec" style={{ "--cc": c.color }}>
              <div className="acast-dock__sec__title">{c.name}</div>
              <div className="acast-dock__depth__empty">No journey logged.</div>
            </div>
          );
          const pacing = pacingForCast(route, chapters);
          const moods = MOOD_BY_CHAPTER[c.id] || {};
          const quests = QUEST_BY_CHAPTER[c.id] || {};
          const cross = copresence.filter((x) => x.a.id === c.id || x.b.id === c.id);
          return (
            <div key={c.id} style={{ "--cc": c.color, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Header for this cast */}
              <div className="acast-dock__sec">
                <div className="acast-dock__sec__title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color, display: "inline-block" }}/>
                  {c.name}
                  <span style={{ flex: 1 }}/>
                  <button className="aq-cast__more" onClick={() => onSelectRoute && onSelectRoute(route.id)} data-callback="onSelectAtlasRoute">
                    Focus →
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>{route.summary}</div>
              </div>

              {/* Chapter timeline strip */}
              <div className="acast-dock__sec">
                <div className="acast-dock__sec__title">Chapter strip</div>
                <div className="acast-dock__chstrip">
                  {chapters.map((ch, i) => {
                    const w = route.waypoints.find((w) => w.chapter === (i + 1));
                    const loc = w && locations.find((l) => l.id === w.locationId);
                    return (
                      <div key={ch.id}
                        className={"acast-dock__ch" + (w ? " is-here" : "")}
                        title={loc ? (ch.label + " · " + loc.name + " · " + (w.kind || "stop")) : ch.label}
                      >
                        {ch.label.replace("Ch. ", "")}
                        {loc && <span className="acast-dock__ch__sub">{loc.name.length > 8 ? loc.name.slice(0, 7) + "…" : loc.name}</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ height: 12 }}/>
              </div>

              {/* Pacing heat */}
              <div className="acast-dock__sec">
                <div className="acast-dock__sec__title">Pacing heat</div>
                <div className="acast-dock__pacing">
                  {pacing.map((v, i) => (
                    <div key={i} className="acast-dock__pacing__cell" style={{ "--heat": v }} title={"Ch. " + (i + 1) + " · " + (v ? Math.round(v * 100) + "%" : "—")}/>
                  ))}
                </div>
              </div>

              {/* Quests */}
              {Object.keys(quests).length > 0 && (
                <div className="acast-dock__sec">
                  <div className="acast-dock__sec__title">Quests / events</div>
                  <div className="acast-dock__moods">
                    {Object.entries(quests).map(([ch, q]) => (
                      <span key={ch} className="acast-dock__mood">Ch.{ch} · {q}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mood tags */}
              {Object.keys(moods).length > 0 && (
                <div className="acast-dock__sec">
                  <div className="acast-dock__sec__title">Mood at each stop</div>
                  <div className="acast-dock__moods">
                    {Object.entries(moods).map(([ch, ms]) => (
                      ms.length ? <span key={ch} className="acast-dock__mood">Ch.{ch} · {ms.join(", ")}</span> : null
                    ))}
                  </div>
                </div>
              )}

              {/* Co-presence (spider) */}
              {cross.length > 0 && (
                <div className="acast-dock__sec">
                  <div className="acast-dock__sec__title">Crosses paths with</div>
                  <div className="acast-dock__copres">
                    {cross.map((x, i) => {
                      const other = x.a.id === c.id ? x.b : x.a;
                      const loc = locations.find((l) => l.id === x.locId);
                      return (
                        <button key={i} className="acast-dock__copres__chip" style={{ "--occ": other.color }} data-callback="onSelectCoPresence">
                          <span className="acast-dock__copres__dot"/>
                          {other.name.split(" ")[0]} · Ch.{x.chapter} · {loc?.name || "—"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="acast-dock__spider">
                    <div className="acast-dock__spider__legend">
                      Tap a crossing to peek that scene · faint links on the map show the same.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "var(--line-2)", opacity: 0.6 }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
};

Object.assign(window, {
  AtlasMiniToolbar, AtlasQuickPanel, AtlasQuickRing, AtlasFsRail, AtlasCastDock,
});
