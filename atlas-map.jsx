// =====================================================================
// atlas-map.jsx — shared parchment-map canvas. Renders SVG cartography,
// region polygons, location pins, travel routes, and overlay layers
// (beasts/items/factions/quests/chapter-diff). Used by both the
// AtlasSidePanel (compact) and AtlasEditor (full-screen).
// =====================================================================

const { useMemo: _um_am, useCallback: _uc_am, useRef: _ur_am, useState: _us_am, useEffect: _ue_am } = React;

// ---------------------------------------------------------------------
// Geometry helpers — locations carry (x, y) in % of map canvas (1200×700).
// ---------------------------------------------------------------------
const _amPx  = (loc) => ({ x: (loc.x / 100) * 1200, y: (loc.y / 100) * 700 });
const _amPct = (loc) => ({ x: loc.x, y: loc.y });

// Type → pin glyph + visual size
const PIN_BY_TYPE = {
  city:        { r: 7,   icon: "★",  weight: 700 },
  town:        { r: 5.5, icon: "●",  weight: 600 },
  village:     { r: 4,   icon: "·",  weight: 500 },
  district:    { r: 4.5, icon: "◆",  weight: 500 },
  building:    { r: 4,   icon: "▲",  weight: 500 },
  room:        { r: 3,   icon: "·",  weight: 500 },
  region:      { r: 0,   icon: "",   weight: 600 },
  country:     { r: 0,   icon: "",   weight: 700 },
  ruin:        { r: 5,   icon: "ᛏ",  weight: 600 },
  battlefield: { r: 5,   icon: "✕",  weight: 600 },
  hidden:      { r: 4.5, icon: "?",  weight: 600 },
  road:        { r: 0,   icon: "",   weight: 500 },
};

// ---------------------------------------------------------------------
// Background plate — sea / coast / contours / compass / scale
// ---------------------------------------------------------------------
const AtlasPlate = ({ showIso, showGrid, showTexture }) => (
  <g aria-hidden>
    <defs>
      <pattern id="atm-water" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(80,100,120,0.18)" strokeWidth="0.6"/>
      </pattern>
      <pattern id="atm-grain" patternUnits="userSpaceOnUse" width="3" height="3">
        <circle cx="1.5" cy="1.5" r="0.4" fill="rgba(120, 96, 60, 0.10)"/>
      </pattern>
      <radialGradient id="atm-land" cx="50%" cy="50%" r="65%">
        <stop offset="0%"  stopColor="#fbf2d6" stopOpacity="0.92"/>
        <stop offset="100%" stopColor="#ebdcb4" stopOpacity="0.0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="1200" height="700" fill="url(#atm-water)" opacity="0.55"/>
    <path d="M 30 130 C 60 90, 280 70, 360 200 S 400 380, 320 420 S 100 460, 60 320 Z
             M 380 290 C 460 260, 620 230, 690 360 S 540 480, 380 420 Z
             M 740 200 C 820 170, 1100 170, 1140 320 S 980 510, 880 480 S 720 360, 740 200 Z"
      fill="url(#atm-land)" stroke="rgba(74,56,28,0.55)" strokeWidth="1.5"/>
    {showTexture && <rect x="0" y="0" width="1200" height="700" fill="url(#atm-grain)" opacity="0.4"/>}
    {showIso && (
      <g stroke="rgba(120,96,60,0.30)" strokeWidth="0.6" fill="none">
        <ellipse cx="180" cy="260" rx="120" ry="80"/>
        <ellipse cx="180" cy="260" rx="80"  ry="55"/>
        <ellipse cx="180" cy="260" rx="40"  ry="28"/>
        <ellipse cx="540" cy="360" rx="140" ry="80" transform="rotate(-12 540 360)"/>
        <ellipse cx="540" cy="360" rx="90"  ry="50" transform="rotate(-12 540 360)"/>
        <ellipse cx="940" cy="320" rx="160" ry="120"/>
        <ellipse cx="940" cy="320" rx="110" ry="80"/>
        <ellipse cx="940" cy="320" rx="60"  ry="40"/>
      </g>
    )}
    {showGrid && (
      <g stroke="rgba(120,96,60,0.18)" strokeWidth="0.5">
        {Array.from({ length: 12 }).map((_, i) => <line key={"v"+i} x1={(i+1)*100} y1="0" x2={(i+1)*100} y2="700"/>)}
        {Array.from({ length: 7  }).map((_, i) => <line key={"h"+i} x1="0" y1={(i+1)*100} x2="1200" y2={(i+1)*100}/>)}
      </g>
    )}
    <g transform="translate(1090, 90)" opacity="0.55">
      <circle r="32" fill="none" stroke="#4a381c" strokeWidth="0.7"/>
      <circle r="22" fill="none" stroke="#4a381c" strokeWidth="0.4" strokeDasharray="2 4"/>
      <path d="M 0 -30 L 4 0 L 0 30 L -4 0 Z" fill="rgba(74,56,28,0.55)"/>
      <path d="M -30 0 L 0 4 L 30 0 L 0 -4 Z" fill="rgba(74,56,28,0.30)"/>
      <text x="0" y="-36" textAnchor="middle" fontFamily="var(--font-display)" fontSize="11" fill="rgba(74,56,28,0.75)">N</text>
    </g>
    <g transform="translate(1010, 660)" opacity="0.6">
      <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(74,56,28,0.7)" strokeWidth="0.8"/>
      <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(74,56,28,0.7)" strokeWidth="0.8"/>
      <line x1="60" y1="-2" x2="60" y2="2" stroke="rgba(74,56,28,0.5)" strokeWidth="0.6"/>
      <line x1="120" y1="-3" x2="120" y2="3" stroke="rgba(74,56,28,0.7)" strokeWidth="0.8"/>
      <text x="60" y="-6" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="8.5" fill="rgba(74,56,28,0.8)" letterSpacing="0.15em">100 LEAGUES</text>
    </g>
  </g>
);

// ---------------------------------------------------------------------
// Region polygons (countries + named regions). Highlight is a per-id
// highlight color when context wants that region called out.
// ---------------------------------------------------------------------
const AtlasRegions = ({ locations, layers, highlight }) => {
  const polys = locations.filter((l) => l.polygon && (
    (l.type === "country" && layers.regions !== false) ||
    (l.type === "region"  && layers.regions !== false)
  ));
  return (
    <g>
      {polys.map((l) => {
        const hi = highlight && highlight[l.id];
        return (
          <g key={l.id} className="atm-region" data-id={l.id}>
            <path d={l.polygon}
              fill={hi ? hi.fill : "rgba(180, 150, 90, 0.10)"}
              stroke={hi ? hi.stroke : "rgba(74, 56, 28, 0.40)"}
              strokeWidth={hi ? 1.6 : 0.8}
              strokeDasharray={l.type === "country" ? "0" : "6 4"}/>
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------
// Pin — a single location marker. Renders glyph + label.
// ---------------------------------------------------------------------
const AtlasPin = ({ loc, focused, dim, onClick, scaleLabel = 1, showLabel = true, badge }) => {
  if (loc.type === "country" || loc.type === "region" || loc.type === "road") return null;
  const { x, y } = _amPx(loc);
  const conf = PIN_BY_TYPE[loc.type] || PIN_BY_TYPE.building;
  const opacity = dim ? 0.28 : 1;
  return (
    <g className={"atm-pin" + (focused ? " is-focused" : "")} transform={`translate(${x}, ${y})`} opacity={opacity}
       onClick={(e) => { e.stopPropagation(); onClick && onClick(loc); }} style={{ cursor: "pointer" }}>
      {focused && (
        <g>
          <circle r={conf.r + 8} fill="rgba(255, 200, 80, 0.18)"/>
          <circle r={conf.r + 5} fill="none" stroke="#c98a2c" strokeWidth="1.2"/>
        </g>
      )}
      <circle r={conf.r + 1} fill="rgba(255, 248, 230, 0.95)" stroke="rgba(74,56,28,0.7)" strokeWidth="0.8"/>
      {conf.icon && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={conf.r * 1.6} fontWeight={conf.weight}
              fill="#3a2c12" fontFamily="var(--font-display)">{conf.icon}</text>
      )}
      {showLabel && (
        <text x={conf.r + 4} y={3} fontSize={11 * scaleLabel} fill="#2a2218" fontFamily="var(--font-display)" fontWeight="600">
          {loc.name}
        </text>
      )}
      {badge && (
        <g transform={`translate(${-(conf.r + 4)}, ${-(conf.r + 4)})`}>
          <circle r="6" fill={badge.color || "#c98a2c"} stroke="#fff" strokeWidth="1"/>
          <text textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="700" fill="#fff">{badge.text}</text>
        </g>
      )}
    </g>
  );
};

// ---------------------------------------------------------------------
// Travel route — beaded path drawn between waypoint locations.
// ---------------------------------------------------------------------
const AtlasRoute = ({ route, locById, dim, emphasised, scrubChapter, intersect }) => {
  const wps = route.waypoints.filter((w) => locById[w.locationId]);
  if (wps.length < 2) return null;
  const points = wps.map((w) => _amPx(locById[w.locationId]));
  // Build a smooth polyline path.
  const d = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    return acc + ` Q ${prev.x} ${prev.y} ${mx} ${my} T ${p.x} ${p.y}`;
  }, "");
  const op = dim ? 0.18 : (emphasised ? 1 : 0.65);
  const wdMain = emphasised ? 3.2 : 1.8;
  return (
    <g className="atm-route" data-id={route.id} opacity={op}>
      <path d={d} fill="none" stroke={route.color} strokeWidth={wdMain + 1.6} strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/>
      <path d={d} fill="none" stroke={route.color} strokeWidth={wdMain} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4"/>
      {wps.map((w, i) => {
        const p = points[i];
        const past = scrubChapter != null ? w.chapter <= scrubChapter : true;
        return (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={emphasised ? 5 : 3.5} fill={past ? route.color : "#fff"} stroke={route.color} strokeWidth="1.4"/>
            {!w.confirmed && <circle r={emphasised ? 7.5 : 5.5} fill="none" stroke={route.color} strokeWidth="0.8" strokeDasharray="1 2"/>}
          </g>
        );
      })}
      {/* Intersection halos */}
      {emphasised && intersect && intersect.map((locId, i) => {
        const loc = locById[locId];
        if (!loc) return null;
        const p = _amPx(loc);
        return <circle key={"x"+i} cx={p.x} cy={p.y} r="14" fill="none" stroke="#c98a2c" strokeWidth="1.5" strokeDasharray="3 3"/>;
      })}
    </g>
  );
};

// ---------------------------------------------------------------------
// Beast habitat overlay — soft polygon + claw glyph.
// ---------------------------------------------------------------------
const AtlasBeastOverlay = ({ beast, locById }) => {
  const habs = beast.habitat.map((id) => locById[id]).filter(Boolean);
  return (
    <g className="atm-beast">
      {habs.map((loc) => {
        if (loc.polygon) {
          return <path key={"hp"+loc.id} d={loc.polygon} fill={beast.color + "22"} stroke={beast.color} strokeWidth="1.4" strokeDasharray="2 4"/>;
        }
        const p = _amPx(loc);
        return (
          <g key={"hp"+loc.id} transform={`translate(${p.x}, ${p.y})`}>
            <circle r="20" fill={beast.color + "22"} stroke={beast.color} strokeWidth="1.2" strokeDasharray="2 3"/>
          </g>
        );
      })}
      {habs.map((loc) => {
        const p = _amPx(loc);
        return (
          <g key={"hg"+loc.id} transform={`translate(${p.x - 12}, ${p.y - 12})`}>
            <circle r="8" fill={beast.color} opacity="0.9"/>
            <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="#fff">⚔</text>
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------
// Item overlay — markers for found / used / lost.
// ---------------------------------------------------------------------
const AtlasItemOverlay = ({ item, locById }) => {
  const points = [];
  if (item.found) points.push({ kind: "Found", chapter: item.found.chapter, loc: locById[item.found.locationId] });
  if (item.used)  points.push({ kind: "Used",  chapter: item.used.chapter,  loc: locById[item.used.locationId] });
  if (item.lost)  points.push({ kind: "Lost",  chapter: item.lost.chapter,  loc: locById[item.lost.locationId] });
  const pts = points.filter((p) => p.loc).map((p) => ({ ...p, x: _amPx(p.loc).x, y: _amPx(p.loc).y }));
  return (
    <g className="atm-item">
      {pts.length >= 2 && (() => {
        const d = pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : acc + ` L ${p.x} ${p.y}`, "");
        return <path d={d} fill="none" stroke={item.color} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.7"/>;
      })()}
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y})`}>
          <circle r="14" fill="rgba(255,248,230,0.95)" stroke={item.color} strokeWidth="1.4"/>
          <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={item.color}>
            {p.kind === "Found" ? "F" : p.kind === "Used" ? "U" : "L"}
          </text>
          <text x="0" y="22" textAnchor="middle" fontSize="9" fontFamily="var(--font-display)" fontWeight="600" fill="#3a2c12">
            {p.kind}{p.chapter ? ` · Ch. ${p.chapter}` : ""}
          </text>
        </g>
      ))}
    </g>
  );
};

// ---------------------------------------------------------------------
// Quest overlay — numbered step markers + arrows between them.
// ---------------------------------------------------------------------
const AtlasQuestOverlay = ({ quest, locById }) => {
  const steps = (quest.steps || []).map((s) => ({ ...s, loc: locById[s.locationId] })).filter((s) => s.loc);
  const pts = steps.map((s) => ({ ...s, x: _amPx(s.loc).x, y: _amPx(s.loc).y }));
  return (
    <g className="atm-quest">
      {pts.length >= 2 && (() => {
        const d = pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : acc + ` L ${p.x} ${p.y}`, "");
        return <path d={d} fill="none" stroke="#8a3a4f" strokeWidth="1.6" opacity="0.7"/>;
      })()}
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y})`}>
          <circle r="11" fill="#8a3a4f" stroke="#fff" strokeWidth="1.5"/>
          <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="#fff">{i + 1}</text>
        </g>
      ))}
    </g>
  );
};

// ---------------------------------------------------------------------
// Faction overlay — territory polygons combined.
// ---------------------------------------------------------------------
const AtlasFactionOverlay = ({ faction, locById }) => {
  const terr = faction.territory.map((id) => locById[id]).filter(Boolean);
  return (
    <g className="atm-faction">
      {terr.map((loc) => {
        if (loc.polygon) return <path key={"f"+loc.id} d={loc.polygon} fill={faction.color + "26"} stroke={faction.color} strokeWidth="1.4"/>;
        const p = _amPx(loc);
        return <circle key={"f"+loc.id} cx={p.x} cy={p.y} r="14" fill={faction.color + "33"} stroke={faction.color} strokeWidth="1"/>;
      })}
      {(() => {
        const hq = locById[faction.hq];
        if (!hq) return null;
        const p = _amPx(hq);
        return (
          <g transform={`translate(${p.x}, ${p.y - 18})`}>
            <rect x="-26" y="-9" width="52" height="16" rx="2" fill={faction.color}/>
            <text x="0" y="2" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" letterSpacing="0.12em">HQ</text>
          </g>
        );
      })()}
    </g>
  );
};

// ---------------------------------------------------------------------
// Chapter-diff overlay — highlights what's added/changed in a chapter.
// ---------------------------------------------------------------------
const AtlasChapterDiff = ({ chapter, locById }) => {
  const added = (chapter.added || []).map((id) => locById[id]).filter(Boolean);
  const present = (chapter.locations || []).map((id) => locById[id]).filter(Boolean);
  return (
    <g className="atm-diff">
      {present.map((loc) => {
        const p = _amPx(loc);
        return <circle key={"p"+loc.id} cx={p.x} cy={p.y} r="11" fill="none" stroke="#7a6aa3" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>;
      })}
      {added.map((loc) => {
        const p = _amPx(loc);
        return (
          <g key={"a"+loc.id} transform={`translate(${p.x}, ${p.y})`}>
            <circle r="16" fill="rgba(120,180,90,0.20)" stroke="#5d6d4e" strokeWidth="1.6"/>
            <text x="0" y="-22" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5d6d4e" letterSpacing="0.1em">+ NEW</text>
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------
// MAIN — composes everything.
// ---------------------------------------------------------------------
const AtlasMap = ({
  locations, routes, beasts = [], items = [], factions = [], chapters = [],
  layers = {}, selectedId, onSelect, onPan,
  context = null, scrubChapter = null,
  showLabels = true, showIso = true, showGrid = false, showTexture = true,
  variant = "side", className = "",
}) => {
  const locById = _um_am(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);
  const ctxShow = context && context.show;

  // Determine which routes/items to emphasise
  const emphRouteIds = ctxShow && ctxShow.routeIds || [];
  const intersectIds = ctxShow && ctxShow.intersect || [];
  const emphBeast    = ctxShow && ctxShow.beastId   ? beasts.find((b) => b.id === ctxShow.beastId)     : null;
  const emphItem     = ctxShow && ctxShow.itemId    ? items.find((i)  => i.id === ctxShow.itemId)      : null;
  const emphQuest    = ctxShow && ctxShow.questId   ? (window.ATLAS_QUESTS || []).find((q) => q.id === ctxShow.questId) : null;
  const emphFaction  = ctxShow && ctxShow.factionId ? factions.find((f) => f.id === ctxShow.factionId) : null;
  const emphChapter  = ctxShow && ctxShow.chapterDiff ? chapters.find((c) => c.id === ctxShow.chapterDiff) : null;
  const focusId      = (ctxShow && ctxShow.focusLocId) || selectedId;

  // Pin dimming when something is highlighted in context
  const isCtxActive = !!(emphRouteIds.length || emphBeast || emphItem || emphQuest || emphFaction || emphChapter);
  const ctxLocs = _um_am(() => {
    if (!isCtxActive) return null;
    const set = new Set();
    if (emphRouteIds.length) {
      routes.filter((r) => emphRouteIds.includes(r.id)).forEach((r) => r.waypoints.forEach((w) => set.add(w.locationId)));
    }
    if (emphBeast)   emphBeast.habitat.forEach((id) => set.add(id));
    if (emphItem)    [emphItem.found, emphItem.used, emphItem.lost].forEach((p) => p && set.add(p.locationId));
    if (emphQuest)   (emphQuest.steps || []).forEach((s) => set.add(s.locationId));
    if (emphFaction) emphFaction.territory.forEach((id) => set.add(id));
    if (emphChapter) (emphChapter.locations || []).forEach((id) => set.add(id));
    if (focusId) set.add(focusId);
    return set;
  }, [isCtxActive, emphRouteIds, emphBeast, emphItem, emphQuest, emphFaction, emphChapter, focusId, routes]);

  // Scrub-by-chapter: only show locations whose chapters intersect.
  const scrubFn = (loc) => {
    if (scrubChapter == null) return false;
    if (!loc.chapters || !loc.chapters.length) return false;
    return !loc.chapters.includes(scrubChapter + 1); // chapters are 1-indexed
  };

  // Region highlight tint per faction / context
  const regionHighlight = _um_am(() => {
    const out = {};
    if (emphFaction) emphFaction.territory.forEach((id) => { out[id] = { fill: emphFaction.color + "33", stroke: emphFaction.color }; });
    return out;
  }, [emphFaction]);

  return (
    <svg className={"atm__svg " + className} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet" data-variant={variant}>
      <AtlasPlate showIso={showIso} showGrid={showGrid} showTexture={showTexture}/>

      {/* Region polygons under everything */}
      <AtlasRegions locations={locations} layers={layers} highlight={regionHighlight}/>

      {/* Faction territory overlay */}
      {emphFaction && layers.factions !== false && <AtlasFactionOverlay faction={emphFaction} locById={locById}/>}

      {/* Beast habitat */}
      {emphBeast && layers.beasts !== false && <AtlasBeastOverlay beast={emphBeast} locById={locById}/>}

      {/* Routes — emphasised first under, then non-emph dimmed */}
      {layers.routes !== false && routes.map((r) => {
        const isEmph = emphRouteIds.includes(r.id);
        const dim = isCtxActive && !isEmph;
        return <AtlasRoute key={r.id} route={r} locById={locById} dim={dim} emphasised={isEmph}
                           scrubChapter={scrubChapter == null ? null : scrubChapter + 1}
                           intersect={isEmph ? intersectIds : null}/>;
      })}

      {/* Quest steps */}
      {emphQuest && <AtlasQuestOverlay quest={emphQuest} locById={locById}/>}

      {/* Item markers */}
      {emphItem && <AtlasItemOverlay item={emphItem} locById={locById}/>}

      {/* Chapter diff */}
      {emphChapter && <AtlasChapterDiff chapter={emphChapter} locById={locById}/>}

      {/* Pins last (on top) */}
      <g>
        {locations.map((loc) => {
          if (!_pinIsVisible(loc, layers)) return null;
          const dim = (ctxLocs && !ctxLocs.has(loc.id)) || scrubFn(loc);
          const focused = loc.id === focusId;
          // Queue badge
          const badge = loc.queue ? { text: String(loc.queue), color: loc.queueLevel === "high" ? "#5d6d4e" : "#c98a2c" } : null;
          return (
            <AtlasPin key={loc.id} loc={loc} focused={focused} dim={dim} badge={badge}
                      scaleLabel={variant === "side" ? 1 : 0.95}
                      showLabel={showLabels && (variant === "editor" || ["country","city","town","region"].includes(loc.type))}
                      onClick={onSelect}/>
          );
        })}
      </g>
    </svg>
  );
};

// Visibility per layer
const _pinIsVisible = (loc, layers) => {
  if (loc.type === "country" || loc.type === "region")          return layers.regions    !== false;
  if (loc.type === "city" || loc.type === "town" || loc.type === "village") return layers.cities !== false;
  if (loc.type === "district")                                  return layers.districts  === true || layers.districts === undefined ? true : false;
  if (loc.type === "building" || loc.type === "room")           return layers.buildings  !== false;
  if (loc.type === "ruin" || loc.type === "battlefield" || loc.type === "hidden") return layers.story !== false;
  return true;
};

Object.assign(window, { AtlasMap, AtlasPin, AtlasPlate, AtlasRoute, _amPx });
