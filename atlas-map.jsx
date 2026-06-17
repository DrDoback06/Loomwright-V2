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

// Drawn-region fills by type (parchment palette). `loc.shape.style` can
// override the type key (e.g. force "waterway" tint on a polygon).
const SHAPE_STYLE_BY_TYPE = {
  world:       { fill: "rgba(160,140,90,0.10)", stroke: "rgba(74,56,28,0.50)" },
  continent:   { fill: "rgba(160,140,90,0.12)", stroke: "rgba(74,56,28,0.52)" },
  country:     { fill: "rgba(160,140,90,0.14)", stroke: "rgba(74,56,28,0.55)" },
  region:      { fill: "rgba(120,150,90,0.15)", stroke: "rgba(70,90,40,0.52)" },
  city:        { fill: "rgba(190,140,90,0.20)", stroke: "rgba(120,80,40,0.62)" },
  town:        { fill: "rgba(190,150,100,0.17)", stroke: "rgba(120,90,50,0.56)" },
  village:     { fill: "rgba(190,160,110,0.15)", stroke: "rgba(120,95,55,0.5)" },
  district:    { fill: "rgba(175,150,110,0.17)", stroke: "rgba(110,90,55,0.56)" },
  building:    { fill: "rgba(150,140,130,0.24)", stroke: "rgba(90,80,70,0.72)" },
  room:        { fill: "rgba(155,145,135,0.20)", stroke: "rgba(95,85,75,0.62)" },
  forest:      { fill: "rgba(90,140,80,0.20)",  stroke: "rgba(50,90,45,0.56)" },
  waterway:    { fill: "rgba(90,130,170,0.22)", stroke: "rgba(50,90,140,0.56)" },
  river:       { fill: "rgba(90,130,170,0.22)", stroke: "rgba(50,90,140,0.56)" },
  mountain:    { fill: "rgba(140,120,100,0.20)", stroke: "rgba(90,70,50,0.58)" },
  ruin:        { fill: "rgba(150,120,90,0.18)",  stroke: "rgba(90,70,45,0.62)" },
  battlefield: { fill: "rgba(170,90,80,0.17)",   stroke: "rgba(120,50,40,0.6)" },
  hidden:      { fill: "rgba(120,100,150,0.17)", stroke: "rgba(80,60,110,0.56)" },
  _default:    { fill: "rgba(175,150,110,0.16)", stroke: "rgba(100,80,50,0.55)" },
};

// Build the SVG geometry element spec for a drawn shape. Shape coords are
// percent (0–100); x maps to the 1200-wide plate, y to the 700-tall plate.
// Circle radius is percent-of-width so it renders as a true circle.
function _amShapeGeom(shape) {
  if (!shape || typeof shape !== "object") return null;
  const PX = (v) => (Number(v) / 100) * 1200, PY = (v) => (Number(v) / 100) * 700;
  if (shape.type === "rect")   return { tag: "rect",   props: { x: PX(shape.x), y: PY(shape.y), width: PX(shape.w), height: PY(shape.h), rx: 5 } };
  if (shape.type === "circle") return { tag: "circle", props: { cx: PX(shape.cx), cy: PY(shape.cy), r: (Number(shape.r) / 100) * 1200 } };
  if ((shape.type === "polygon" || shape.type === "freehand") && Array.isArray(shape.points) && shape.points.length >= 2) {
    const pts = shape.points.map((p) => PX(p[0]).toFixed(1) + "," + PY(p[1]).toFixed(1));
    return { tag: "path", props: { d: "M " + pts.join(" L ") + " Z" } };
  }
  return null;
}

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
// Drawn regions — user-authored shapes (rect/circle/polygon/freehand)
// for rooms / areas / lands. Filled + labelled at the centroid; clickable.
// ---------------------------------------------------------------------
const AtlasShapes = ({ locations, onSelect, focusId, ctxLocs, dimFn, layers, showLabels = true, clean = false }) => (
  <g className="atm-shapes">
    {locations.map((loc) => {
      if (!loc.shape) return null;
      if (!_pinIsVisible(loc, layers)) return null;
      const geom = _amShapeGeom(loc.shape);
      if (!geom) return null;
      const st = (loc.shape.style && SHAPE_STYLE_BY_TYPE[loc.shape.style]) || SHAPE_STYLE_BY_TYPE[loc.type] || SHAPE_STYLE_BY_TYPE._default;
      const focused = loc.id === focusId;
      const dim = (ctxLocs && !ctxLocs.has(loc.id)) || (dimFn && dimFn(loc));
      const c = _amPx(loc); // centroid (buildAtlasDataSync set coords to it)
      const Tag = geom.tag;
      return (
        <g key={loc.id} data-atm-shape={loc.id} className={"atm-shape" + (focused ? " is-focused" : "")}
           opacity={dim ? 0.3 : 1} style={{ cursor: "pointer" }}
           onClick={(e) => { e.stopPropagation(); onSelect && onSelect(loc); }}>
          <Tag {...geom.props}
               fill={clean ? st.fill.replace(/0\.\d+\)/, "0.28)") : st.fill}
               stroke={focused ? "#c98a2c" : st.stroke}
               strokeWidth={focused ? 2 : (loc.shape.type === "freehand" ? 1.6 : 1.2)}
               strokeLinejoin="round" strokeLinecap="round"
               strokeDasharray={loc.shape.type === "freehand" ? "0" : (loc.type === "region" ? "7 4" : "0")}/>
          {showLabels && (
            <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central"
                  fontFamily="var(--font-display)" fontSize="12.5" fontWeight="600"
                  fill="#3a2c12" pointerEvents="none"
                  style={{ paintOrder: "stroke", stroke: "rgba(250,242,221,0.85)", strokeWidth: 2.5 }}>{loc.name}</text>
          )}
        </g>
      );
    })}
  </g>
);

// ---------------------------------------------------------------------
// Pin — a single location marker. Renders glyph + label.
// ---------------------------------------------------------------------
const AtlasPin = ({ loc, focused, dim, onClick, scaleLabel = 1, showLabel = true, badge }) => {
  if (loc.type === "country" || loc.type === "region" || loc.type === "road") return null;
  const { x, y } = _amPx(loc);
  const conf = PIN_BY_TYPE[loc.type] || PIN_BY_TYPE.building;
  const opacity = dim ? 0.28 : 1;
  // Coarse pointers (touch) get an invisible enlarged hit circle so a
  // fingertip can land a small village pin.
  const coarse = typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(pointer: coarse)").matches;
  return (
    <g className={"atm-pin" + (focused ? " is-focused" : "")} transform={`translate(${x}, ${y})`} opacity={opacity}
       onClick={(e) => { e.stopPropagation(); onClick && onClick(loc); }} style={{ cursor: "pointer" }}>
      {coarse && <circle r={Math.max(16, conf.r + 10)} fill="transparent"/>}
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
  variant = "side", className = "", cleanStyle = false,
  // Live editing (editor variant): active tool + placement callbacks.
  tool = "select", onMapPoint = null, onMovePin = null,
}) => {
  const locById = _um_am(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);
  const ctxShow = context && context.show;
  const roads = window.ATLAS_ROADS || [];
  // Per-layer opacity (Settings ▸ atlas.layerOpacity, edited in the
  // editor's layers rail).
  const layerOp = window.ATLAS_LAYER_OPACITY || {};
  const opOf = (id) => (layerOp[id] != null ? Math.max(0.1, Math.min(1, layerOp[id] / 100)) : 1);
  const pinLayerId = (loc) => {
    if (loc.type === "country" || loc.type === "region") return "regions";
    if (loc.type === "city" || loc.type === "town" || loc.type === "village") return "settlements";
    if (loc.type === "district") return "districts";
    if (loc.type === "building" || loc.type === "room") return "buildings";
    if (loc.type === "ruin" || loc.type === "battlefield" || loc.type === "hidden") return "story";
    return "natural";
  };

  // ---- Editing interactions (click-to-place, pin dragging) ----------
  const svgRef = React.useRef(null);
  const dragRef = React.useRef(null);            // { id, moved }
  const [dragPos, setDragPos] = React.useState(null); // { id, x, y } pct override
  const toPct = (evt) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / 1200, rect.height / 700) || 1;
    const ox = (rect.width - 1200 * scale) / 2;
    const oy = (rect.height - 700 * scale) / 2;
    return {
      x: Math.max(0, Math.min(100, ((evt.clientX - rect.left - ox) / scale / 1200) * 100)),
      y: Math.max(0, Math.min(100, ((evt.clientY - rect.top - oy) / scale / 700) * 100)),
    };
  };
  const onSvgClick = (e) => {
    if (!onMapPoint) return;
    if (e.target.closest && e.target.closest("[data-atm-pin]")) return;
    onMapPoint(toPct(e), tool);
  };
  const onPinPointerDown = (e, loc) => {
    if (!onMovePin || variant !== "editor" || tool !== "select" || loc.placed === false) return;
    e.stopPropagation();
    dragRef.current = { id: loc.id, moved: false };
    svgRef.current.setPointerCapture?.(e.pointerId);
  };
  const onSvgPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    d.moved = true;
    setDragPos({ id: d.id, ...toPct(e) });
  };
  const onSvgPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.moved && dragPos && dragPos.id === d.id) onMovePin(d.id, { x: dragPos.x, y: dragPos.y });
    setDragPos(null);
  };
  const pinLoc = (loc) => (dragPos && dragPos.id === loc.id) ? { ...loc, x: dragPos.x, y: dragPos.y } : loc;

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
    <svg ref={svgRef} className={"atm__svg " + className} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet" data-variant={variant}
         data-tool={tool}
         onClick={onSvgClick} onPointerMove={onSvgPointerMove} onPointerUp={onSvgPointerUp}>
      <AtlasPlate showIso={showIso} showGrid={showGrid} showTexture={showTexture}/>

      {/* Region polygons under everything */}
      <g opacity={opOf("regions")}><AtlasRegions locations={locations} layers={layers} highlight={regionHighlight}/></g>

      {/* Drawn regions (user shapes) — above static polygons, below pins */}
      <AtlasShapes locations={locations} layers={layers} onSelect={onSelect} focusId={focusId}
                   ctxLocs={ctxLocs} dimFn={scrubFn} clean={cleanStyle}
                   showLabels={showLabels && variant === "editor"}/>

      {/* Road / connection lines between placed locations */}
      {layers.routes !== false && roads.length > 0 && (
        <g className="atm-roads" opacity={opOf("routes")}>
          {roads.map((rd) => {
            const a = locById[rd.from], b = locById[rd.to];
            if (!a || !b || a.placed === false || b.placed === false) return null;
            const pa = _amPx(pinLoc(a)), pb = _amPx(pinLoc(b));
            return <line key={rd.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                         stroke="#8a6b58" strokeWidth="1.6" strokeOpacity="0.55"
                         strokeDasharray={rd.kind === "river" ? "1 4" : "6 4"}/>;
          })}
        </g>
      )}

      {/* Faction territory overlay */}
      {emphFaction && layers.factions !== false && <AtlasFactionOverlay faction={emphFaction} locById={locById}/>}

      {/* Beast habitat */}
      {emphBeast && layers.beasts !== false && <AtlasBeastOverlay beast={emphBeast} locById={locById}/>}

      {/* Routes — emphasised first under, then non-emph dimmed */}
      {layers.routes !== false && <g opacity={opOf("characters")}>{routes.map((r) => {
        const isEmph = emphRouteIds.includes(r.id);
        const dim = isCtxActive && !isEmph;
        return <AtlasRoute key={r.id} route={r} locById={locById} dim={dim} emphasised={isEmph}
                           scrubChapter={scrubChapter == null ? null : scrubChapter + 1}
                           intersect={isEmph ? intersectIds : null}/>;
      })}</g>}

      {/* Quest steps */}
      {emphQuest && <AtlasQuestOverlay quest={emphQuest} locById={locById}/>}

      {/* Item markers */}
      {emphItem && <AtlasItemOverlay item={emphItem} locById={locById}/>}

      {/* Chapter diff */}
      {emphChapter && <AtlasChapterDiff chapter={emphChapter} locById={locById}/>}

      {/* Pins last (on top) */}
      <g>
        {locations.map((loc) => {
          if (loc.placed === false) return null;
          if (loc.shape) return null; // drawn regions render in AtlasShapes (with their own label)
          if (!_pinIsVisible(loc, layers)) return null;
          const dim = (ctxLocs && !ctxLocs.has(loc.id)) || scrubFn(loc);
          const focused = loc.id === focusId;
          // Queue badge
          const badge = loc.queue ? { text: String(loc.queue), color: loc.queueLevel === "high" ? "#5d6d4e" : "#c98a2c" } : null;
          return (
            <g key={loc.id} data-atm-pin={loc.id} opacity={opOf(pinLayerId(loc))} onPointerDown={(e) => onPinPointerDown(e, loc)}>
              <AtlasPin loc={pinLoc(loc)} focused={focused} dim={dim} badge={badge}
                        scaleLabel={variant === "side" ? 1 : 0.95}
                        showLabel={showLabels && (variant === "editor" || ["country","city","town","region"].includes(loc.type))}
                        onClick={onSelect}/>
            </g>
          );
        })}
      </g>

      {/* Empty plate prompt — no placed locations yet */}
      {locations.every((l) => l.placed === false) && (
        <g data-ui="AtlasEmptyPlate">
          <rect x="350" y="290" width="500" height="120" rx="8" fill="rgba(250,242,221,0.92)" stroke="rgba(74,56,28,0.35)" strokeWidth="1" strokeDasharray="6 4"/>
          <text x="600" y="340" textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontSize="19" fill="#4a3a22">
            {locations.length === 0 ? "No locations yet" : "Nothing placed on the map yet"}
          </text>
          <text x="600" y="368" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="12.5" fill="#76684c">
            {locations.length === 0
              ? "Create a location, or extract them from your chapters."
              : "Open the editor, pick “Add Location”, and tap the parchment."}
          </text>
        </g>
      )}
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
