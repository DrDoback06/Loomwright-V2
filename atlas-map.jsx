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

// Stroke weight by scale (architectural line hierarchy) + which types read as
// "organic" (hand-inked, get the rough filter) vs crisp architectural.
const SHAPE_LINEW = { world: 2.4, continent: 2.2, country: 2, region: 1.8, city: 1.5, town: 1.3, village: 1.1, district: 1.3, building: 1.7, room: 1.3, road: 0 };
const SHAPE_ORGANIC = new Set(["world", "continent", "country", "region", "forest", "waterway", "river", "mountain", "ruin", "battlefield", "hidden"]);
const SHAPE_TEXTURE = { forest: "atm-stipple", waterway: "atm-water", river: "atm-water", mountain: "atm-chevron" };
const SHAPE_BIGLABEL = new Set(["world", "continent", "country", "region", "waterway"]);

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
  if (shape.type === "path" && Array.isArray(shape.points) && shape.points.length >= 2) {
    const pts = shape.points.map((p) => PX(p[0]).toFixed(1) + "," + PY(p[1]).toFixed(1));
    return { tag: "path", props: { d: "M " + pts.join(" L ") }, open: true }; // open stroke (river/road)
  }
  return null;
}

// Build a shape from a drag (start → current), in percent coords. Circle
// radius is measured in plate pixels then expressed as percent-of-width so
// it renders true-round.
const _AM_DRAW_TOOLS = new Set(["draw-rect", "draw-circle", "draw-freehand", "draw-path"]);
function _amDraftShape(tool, sx, sy, x, y) {
  if (tool === "draw-rect") return { type: "rect", x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
  if (tool === "draw-circle") {
    const rpx = Math.hypot(((x - sx) / 100) * 1200, ((y - sy) / 100) * 700);
    return { type: "circle", cx: sx, cy: sy, r: (rpx / 1200) * 100 };
  }
  return null;
}
// Distance-thin a freehand point stream so we don't persist hundreds of points.
function _amDecimate(points, minDist = 1.1) {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  const out = [points[0]]; let last = points[0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) { out.push(p); last = p; }
  }
  const tail = points[points.length - 1];
  if (out[out.length - 1] !== tail) out.push(tail);
  return out;
}

// Reshape an existing shape: move the whole thing (dx,dy in %), drag a rect
// corner (opposite corner fixed), grow a circle's radius, or move a polygon
// vertex — all returning a fresh shape.
function _amReshape(orig, mode, index, dx, dy, p) {
  if (!orig) return orig;
  const clamp = (v) => Math.max(0, Math.min(100, v));
  if (mode === "move") {
    if (orig.type === "rect")   return { ...orig, x: clamp(orig.x + dx), y: clamp(orig.y + dy) };
    if (orig.type === "circle") return { ...orig, cx: clamp(orig.cx + dx), cy: clamp(orig.cy + dy) };
    return { ...orig, points: orig.points.map(([x, y]) => [clamp(x + dx), clamp(y + dy)]) };
  }
  if (mode === "rect-corner" && orig.type === "rect") {
    const corners = [[orig.x, orig.y], [orig.x + orig.w, orig.y], [orig.x + orig.w, orig.y + orig.h], [orig.x, orig.y + orig.h]];
    const opp = corners[(index + 2) % 4];
    return { ...orig, x: clamp(Math.min(opp[0], p.x)), y: clamp(Math.min(opp[1], p.y)), w: Math.max(0.5, Math.abs(opp[0] - p.x)), h: Math.max(0.5, Math.abs(opp[1] - p.y)) };
  }
  if (mode === "circle-radius" && orig.type === "circle") {
    const rpx = Math.hypot(((p.x - orig.cx) / 100) * 1200, ((p.y - orig.cy) / 100) * 700);
    return { ...orig, r: Math.max(0.5, (rpx / 1200) * 100) };
  }
  if (mode === "vertex" && (orig.type === "polygon" || orig.type === "freehand" || orig.type === "path")) {
    return { ...orig, points: orig.points.map((pt, i) => (i === index ? [clamp(p.x), clamp(p.y)] : pt)) };
  }
  return orig;
}

// =====================================================================
// Pre-made map-object stamps — a Heroes-of-Might-&-Magic-flavoured
// catalogue of inked objects (castles, towns, mountains, forests, mines,
// fountains, dungeons, …) the user can drop onto the map and resize,
// instead of drawing every shape by hand. Each motif is authored centred
// on (0,0) inside a SYMBOL_BOX-unit box; the renderer scales it by
// data.symbolSize and anchors it at data.coords.
// =====================================================================
const SYMBOL_BOX = 60;     // authoring box (units == plate px at symbolSize 1)
const _SYK = "#3a2c12";    // ink outline shared by every motif
const _SY = {
  wallL: "#e7dcc1", wall: "#cdbd9c", wallD: "#a89072",
  roof: "#a9573b", roofD: "#7f3e28",
  wood: "#9a7a4f", woodD: "#664a2c",
  grnL: "#84aa5d", grn: "#5d8343", grnD: "#3d5d2e",
  watL: "#a9cce1", wat: "#79a8c8", watD: "#4f7f9d",
  rockL: "#bdaf94", rock: "#9a8c71", rockD: "#6d6150",
  snow: "#f4efe3", gold: "#d8b24a",
  flame: "#e07c2f", flameD: "#bf5019", smoke: "#bdb4a6",
  flag: "#b23b3b", dark: "#241d28", door: "#5a4329", glow: "#6a4a8c",
};
// Every motif renders inside one inked group (shared stroke style).
const _symG = (children) => (
  <g stroke={_SYK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">{children}</g>
);
// Battlemented block (3 merlons across the top) — castles / forts / towers.
const _symBattle = (x, y, w, h, fill) => {
  const m = w / 5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill}/>
      <rect x={x} y={y - 4.5} width={m} height="5" fill={fill}/>
      <rect x={x + 2 * m} y={y - 4.5} width={m} height="5" fill={fill}/>
      <rect x={x + 4 * m} y={y - 4.5} width={m} height="5" fill={fill}/>
    </g>
  );
};
const _symRoofHouse = (cx, baseY, w, h, wallFill, roofFill) => {
  const x = cx - w / 2, ry = baseY - h;
  return (
    <g>
      <rect x={x} y={ry} width={w} height={h} fill={wallFill}/>
      <path d={`M ${x - 2.5} ${ry} L ${cx} ${ry - w * 0.62} L ${x + w + 2.5} ${ry} Z`} fill={roofFill}/>
    </g>
  );
};
const _symPine = (cx, baseY, sc) => {
  const w = 13 * sc, h = 27 * sc;
  return (
    <g>
      <rect x={cx - 1.7} y={baseY - 6} width="3.4" height="7" fill={_SY.woodD}/>
      <path d={`M ${cx} ${baseY - h} L ${cx - w * 0.5} ${baseY - h * 0.46} L ${cx - w * 0.3} ${baseY - h * 0.46}
                L ${cx - w * 0.64} ${baseY - 4} L ${cx + w * 0.64} ${baseY - 4}
                L ${cx + w * 0.3} ${baseY - h * 0.46} L ${cx + w * 0.5} ${baseY - h * 0.46} Z`} fill={_SY.grn}/>
    </g>
  );
};
const _symTree = (cx, baseY, sc) => {
  const r = 12 * sc;
  return (
    <g>
      <rect x={cx - 2} y={baseY - 9} width="4" height="11" fill={_SY.woodD}/>
      <circle cx={cx} cy={baseY - 9 - r * 0.7} r={r} fill={_SY.grn}/>
      <circle cx={cx - r * 0.5} cy={baseY - 8 - r * 0.4} r={r * 0.6} fill={_SY.grnL}/>
    </g>
  );
};

function _amSymbolMotif(id) {
  const C = _SY;
  switch (id) {
    case "castle": return _symG(<g>
      {_symBattle(-27, 0, 14, 24, C.wall)}
      {_symBattle(13, 0, 14, 24, C.wall)}
      {_symBattle(-10, -8, 20, 32, C.wallL)}
      <rect x="-5" y="10" width="10" height="14" rx="5" fill={C.door}/>
      <rect x="-2.4" y="-4" width="4.8" height="6" fill={C.dark} stroke="none"/>
      <line x1="3" y1="-8" x2="3" y2="-22"/>
      <path d="M3 -22 L 16 -19 L 3 -15 Z" fill={C.flag} stroke="none"/>
    </g>);
    case "town": return _symG(<g>
      {_symRoofHouse(-12, 24, 16, 12, C.wall, C.roof)}
      {_symRoofHouse(12, 24, 15, 11, C.wallL, C.roofD)}
      {_symRoofHouse(0, 19, 18, 14, C.wall, C.roof)}
      <rect x="-3" y="15" width="6" height="4" fill={C.door}/>
    </g>);
    case "village": return _symG(<g>
      {_symRoofHouse(-8, 22, 15, 11, C.wall, C.roof)}
      {_symRoofHouse(10, 24, 13, 9, C.wallL, C.roofD)}
    </g>);
    case "fort": return _symG(<g>
      {_symBattle(-24, 4, 12, 20, C.wallD)}
      {_symBattle(12, 4, 12, 20, C.wallD)}
      {_symBattle(-16, -4, 32, 28, C.wall)}
      <rect x="-5" y="12" width="10" height="12" rx="1" fill={C.dark}/>
    </g>);
    case "tower": return _symG(<g>
      <rect x="-9" y="-10" width="18" height="34" fill={C.wall}/>
      <path d="M-12 -10 L0 -28 L12 -10 Z" fill={C.roof}/>
      <rect x="-3.5" y="6" width="7" height="9" fill={C.dark}/>
      <circle cx="0" cy="-4" r="2.6" fill={C.dark}/>
    </g>);
    case "lighthouse": return _symG(<g>
      <path d="M-8 24 L-5 -10 L5 -10 L8 24 Z" fill={C.wallL}/>
      <line x1="-6.2" y1="8" x2="6.2" y2="8"/><line x1="-7" y1="17" x2="7" y2="17"/>
      <rect x="-6" y="-18" width="12" height="9" fill={C.wall}/>
      <path d="M-7 -18 L0 -25 L7 -18 Z" fill={C.roof}/>
      <rect x="-4" y="-17" width="8" height="7" fill={C.gold}/>
      <g stroke={C.gold} strokeWidth="1.6"><line x1="7" y1="-13" x2="17" y2="-16"/><line x1="7" y1="-13" x2="17" y2="-10"/></g>
    </g>);
    case "dungeon": return _symG(<g>
      <path d="M-26 24 Q-22 2 -8 0 Q0 -6 8 0 Q22 2 26 24 Z" fill={C.rockD}/>
      <path d="M-9 24 L-9 8 Q0 0 9 8 L9 24 Z" fill={C.dark}/>
      <rect x="-13" y="19" width="6" height="6" fill={C.rock}/>
      <rect x="7" y="19" width="6" height="6" fill={C.rock}/>
    </g>);
    case "cave": return _symG(<g>
      <path d="M-24 24 Q-20 4 0 2 Q20 4 24 24 Z" fill={C.rock}/>
      <path d="M-8 24 Q-8 10 0 8 Q8 10 8 24 Z" fill={C.dark}/>
    </g>);
    case "mine": return _symG(<g>
      <path d="M-24 24 L-3 -4 Q0 -7 3 -4 L24 24 Z" fill={C.rockD}/>
      <rect x="-9" y="9" width="18" height="15" fill={C.dark}/>
      <rect x="-12" y="7" width="4" height="17" fill={C.wood}/>
      <rect x="8" y="7" width="4" height="17" fill={C.wood}/>
      <rect x="-13" y="4.5" width="26" height="4" fill={C.wood}/>
      <path d="M0 -20 L6 -13 L0 -6 L-6 -13 Z" fill={C.watL}/>
    </g>);
    case "windmill": return _symG(<g>
      <path d="M-9 24 L-6 -6 L6 -6 L9 24 Z" fill={C.wallL}/>
      <path d="M-7 -6 L0 -14 L7 -6 Z" fill={C.roofD}/>
      <rect x="-4" y="12" width="8" height="12" fill={C.door}/>
      <g stroke={C.woodD} strokeWidth="2.2">
        <line x1="0" y1="-9" x2="-16" y2="-25"/><line x1="0" y1="-9" x2="16" y2="-25"/>
        <line x1="0" y1="-9" x2="-16" y2="7"/><line x1="0" y1="-9" x2="16" y2="7"/>
      </g>
      <circle cx="0" cy="-9" r="2.6" fill={C.wood}/>
    </g>);
    case "watermill": return _symG(<g>
      {_symRoofHouse(-4, 22, 22, 16, C.wall, C.roof)}
      <circle cx="14" cy="14" r="10" fill={C.wallL}/>
      <circle cx="14" cy="14" r="3" fill={C.woodD}/>
      <g stroke={_SYK} strokeWidth="1.5"><line x1="14" y1="4" x2="14" y2="24"/><line x1="4" y1="14" x2="24" y2="14"/><line x1="7" y1="7" x2="21" y2="21"/><line x1="21" y1="7" x2="7" y2="21"/></g>
      <path d="M3 24 Q12 28 26 25" stroke={C.watD} fill="none"/>
    </g>);
    case "tavern": return _symG(<g>
      {_symRoofHouse(-2, 24, 24, 16, C.wall, C.roofD)}
      <rect x="-10" y="12" width="9" height="12" fill={C.door}/>
      <line x1="12" y1="2" x2="12" y2="12"/><line x1="12" y1="6" x2="20.5" y2="6"/>
      <rect x="16" y="6" width="9" height="8" rx="1" fill={C.wallL}/>
      <path d="M18 8 h3.4 v4 h-3.4 Z" fill={C.gold} stroke="none"/>
    </g>);
    case "temple": return _symG(<g>
      <path d="M-22 2 L0 -16 L22 2 Z" fill={C.wallL}/>
      <rect x="-20" y="2" width="40" height="4" fill={C.wall}/>
      <rect x="-18" y="6" width="5" height="18" fill={C.wallL}/>
      <rect x="-8" y="6" width="5" height="18" fill={C.wallL}/>
      <rect x="3" y="6" width="5" height="18" fill={C.wallL}/>
      <rect x="13" y="6" width="5" height="18" fill={C.wallL}/>
      <rect x="-20" y="24" width="40" height="3" fill={C.wall}/>
    </g>);
    case "shrine": return _symG(<g>
      <path d="M-12 24 L-12 2 Q0 -10 12 2 L12 24 Z" fill={C.wall}/>
      <path d="M-6 24 L-6 8 Q0 0 6 8 L6 24 Z" fill={C.dark}/>
      <line x1="0" y1="-6" x2="0" y2="-14"/>
      <circle cx="0" cy="-16" r="3" fill={C.gold}/>
    </g>);
    case "obelisk": return _symG(<g>
      <path d="M-4 22 L-2.6 -22 L0 -26 L2.6 -22 L4 22 Z" fill={C.rockL}/>
      <rect x="-8" y="22" width="16" height="5" fill={C.rock}/>
      <line x1="-2" y1="-10" x2="2" y2="-10"/><line x1="-2.4" y1="2" x2="2.4" y2="2"/>
    </g>);
    case "well": return _symG(<g>
      <path d="M-12 24 L-10 8 L10 8 L12 24 Z" fill={C.wall}/>
      <ellipse cx="0" cy="8" rx="10" ry="3.4" fill={C.dark}/>
      <rect x="-11" y="-2" width="3" height="10" fill={C.wood}/>
      <rect x="8" y="-2" width="3" height="10" fill={C.wood}/>
      <path d="M-13 -2 L0 -12 L13 -2 Z" fill={C.roofD}/>
    </g>);
    case "fountain": return _symG(<g>
      <path d="M-20 24 Q0 30 20 24 L17 16 L-17 16 Z" fill={C.wat}/>
      <ellipse cx="0" cy="16" rx="17" ry="4" fill={C.watL}/>
      <rect x="-3" y="2" width="6" height="14" fill={C.wall}/>
      <ellipse cx="0" cy="2" rx="9" ry="3" fill={C.watL}/>
      <rect x="-1.6" y="-8" width="3.2" height="10" fill={C.wall}/>
      <g stroke={C.watD} fill="none" strokeWidth="1.6">
        <path d="M0 -8 Q-7 -14 -10 -4"/><path d="M0 -8 Q7 -14 10 -4"/><path d="M0 -10 V-16"/>
      </g>
      <circle cx="0" cy="-17" r="2" fill={C.watL}/>
    </g>);
    case "bridge": return _symG(<g>
      <g stroke={C.watD} strokeWidth="1.6" fill="none" opacity="0.85"><path d="M-26 24 q8 -3 16 0 t16 0 t16 0"/><path d="M-26 20 q8 -3 16 0 t16 0 t16 0"/></g>
      <path d="M-22 6 L22 6 L22 11 L-22 11 Z" fill={C.wall}/>
      <path d="M-14 11 Q0 -2 14 11 Z" fill={C.dark}/>
      <line x1="-22" y1="6" x2="-22" y2="16"/><line x1="22" y1="6" x2="22" y2="16"/>
      <rect x="-22" y="3" width="44" height="3" fill={C.wallL}/>
    </g>);
    case "signpost": return _symG(<g>
      <rect x="-2" y="-14" width="4" height="38" fill={C.woodD}/>
      <path d="M-2 -12 L-20 -12 L-24 -7 L-20 -2 L-2 -2 Z" fill={C.wood}/>
      <path d="M2 2 L20 2 L24 7 L20 12 L2 12 Z" fill={C.wall}/>
    </g>);
    case "camp": return _symG(<g>
      <path d="M-18 24 L0 -8 L18 24 Z" fill={C.wallL}/>
      <line x1="0" y1="-8" x2="0" y2="24"/>
      <path d="M-6 24 L0 10 L6 24 Z" fill={C.dark}/>
      <line x1="0" y1="-8" x2="0" y2="-22"/>
      <path d="M0 -22 L12 -19 L0 -15 Z" fill={C.flag} stroke="none"/>
    </g>);
    case "ruins": return _symG(<g>
      <rect x="-20" y="22" width="40" height="3" fill={C.rock}/>
      <rect x="-18" y="2" width="6" height="20" fill={C.rockL}/>
      <rect x="-6" y="-4" width="6" height="26" fill={C.rockL}/>
      <path d="M-18 2 L-6 -4" stroke={_SYK} fill="none"/>
      <rect x="6" y="8" width="6" height="14" fill={C.rockL}/>
      <rect x="14" y="14" width="6" height="8" fill={C.rock}/>
    </g>);
    case "portal": return _symG(<g>
      <path d="M-15 24 L-15 2 Q-15 -10 0 -10 Q15 -10 15 2 L15 24 L7 24 L7 4 Q7 -3 0 -3 Q-7 -3 -7 4 L-7 24 Z" fill={C.rockD}/>
      <path d="M-7 24 L-7 4 Q-7 -3 0 -3 Q7 -3 7 4 L7 24 Z" fill={C.glow}/>
      <g stroke={C.watL} fill="none" strokeWidth="1.3" opacity="0.85"><path d="M0 4 Q4 12 0 20"/><path d="M0 2 Q-4 12 0 22"/></g>
    </g>);
    case "mountain": return _symG(<g>
      <path d="M-26 24 L-4 -18 Q0 -23 4 -18 L26 24 Z" fill={C.rock}/>
      <path d="M2 -16 L26 24 L7 24 Z" fill={C.rockD} opacity="0.5" stroke="none"/>
      <path d="M-9 -2 L-2 -13 Q0 -16 2 -13 L9 -2 Q4 -6 0 -3 Q-4 -6 -9 -2 Z" fill={C.snow}/>
    </g>);
    case "mountains": return _symG(<g>
      <path d="M-28 24 L-12 -6 L2 24 Z" fill={C.rockD}/>
      <path d="M10 24 L24 -2 L30 24 Z" fill={C.rockD}/>
      <path d="M-14 24 L4 -16 L22 24 Z" fill={C.rock}/>
      <path d="M-2 -6 L4 -16 L10 -6 Q4 -9 -2 -6 Z" fill={C.snow}/>
    </g>);
    case "hill": return _symG(<g>
      <path d="M-26 24 Q-14 4 -2 24 Z" fill={C.grnD}/>
      <path d="M-2 24 Q14 -2 28 24 Z" fill={C.grn}/>
      <path d="M6 18 Q14 8 22 18" stroke={C.grnD} fill="none" strokeWidth="1.3"/>
    </g>);
    case "volcano": return _symG(<g>
      <path d="M-26 24 L-10 -8 L10 -8 L26 24 Z" fill={C.rockD}/>
      <path d="M-7 -3 Q0 -6 7 -3 L12 24 L-12 24 Z" fill={C.flameD} opacity="0.5" stroke="none"/>
      <path d="M-10 -8 L10 -8 L7 -3 Q0 -6 -7 -3 Z" fill={C.flame}/>
      <g stroke={C.flameD} strokeWidth="2.4" strokeLinecap="round"><path d="M-3 -8 L-5 -16"/><path d="M3 -8 L6 -15"/></g>
      <path d="M0 -14 Q-6 -20 0 -26 Q6 -30 0 -36" stroke={C.smoke} fill="none" opacity="0.8"/>
    </g>);
    case "forest": return _symG(<g>
      {_symTree(-12, 24, 1)}{_symTree(12, 24, 0.9)}{_symTree(0, 20, 1.15)}
    </g>);
    case "pineforest": return _symG(<g>
      {_symPine(-12, 24, 0.9)}{_symPine(12, 24, 0.85)}{_symPine(0, 21, 1.1)}
    </g>);
    case "tree": return _symG(<g>{_symTree(0, 24, 1.5)}</g>);
    case "rocks": return _symG(<g>
      <path d="M-22 24 Q-26 8 -12 6 Q-2 4 2 14 Q4 24 2 24 Z" fill={C.rock}/>
      <path d="M-2 24 Q-2 10 12 8 Q24 8 24 24 Z" fill={C.rockL}/>
      <path d="M2 16 Q8 12 16 14" stroke={C.rockD} fill="none" strokeWidth="1.3"/>
    </g>);
    case "swamp": return _symG(<g>
      <path d="M-24 14 Q-12 8 0 14 Q12 20 24 14 L24 24 L-24 24 Z" fill={C.watD}/>
      <g stroke={C.grnD} strokeWidth="1.6" fill="none"><path d="M8 24 Q8 10 6 6"/><path d="M14 24 Q14 12 16 6"/><path d="M11 24 Q11 14 11 8"/></g>
      <ellipse cx="11" cy="6" rx="2.4" ry="1.4" fill={C.grn} stroke="none"/>
      <g stroke={C.watL} strokeWidth="1.2" fill="none" opacity="0.8"><path d="M-20 19 q4 -2 8 0"/><path d="M-18 23 q4 -2 8 0"/></g>
    </g>);
    case "lake": return _symG(<g>
      <path d="M-24 6 Q-10 -4 6 2 Q26 -2 24 14 Q26 26 4 24 Q-14 28 -22 18 Q-30 10 -24 6 Z" fill={C.wat}/>
      <g stroke={C.watL} strokeWidth="1.4" fill="none" opacity="0.85"><path d="M-12 8 q5 -3 10 0"/><path d="M2 14 q5 -3 10 0"/><path d="M-8 18 q5 -3 10 0"/></g>
    </g>);
    case "pond": return _symG(<g>
      <ellipse cx="0" cy="14" rx="20" ry="11" fill={C.wat}/>
      <ellipse cx="-4" cy="12" rx="11" ry="5" fill={C.watL} stroke="none" opacity="0.7"/>
      <g stroke={C.grnD} strokeWidth="1.6" fill="none"><path d="M14 22 Q14 8 12 4"/><path d="M18 22 Q18 10 20 5"/></g>
      <ellipse cx="12" cy="4" rx="2" ry="1.2" fill={C.grn} stroke="none"/>
    </g>);
    case "waterfall": return _symG(<g>
      <path d="M-22 24 L-22 -4 L-6 -4 L-6 24 Z" fill={C.rock}/>
      <path d="M6 24 L6 -4 L22 -4 L22 24 Z" fill={C.rock}/>
      <rect x="-6" y="-4" width="12" height="6" fill={C.watL}/>
      <g fill={C.wat} stroke="none"><rect x="-5" y="2" width="3.5" height="22"/><rect x="1.5" y="2" width="3.5" height="22"/></g>
      <path d="M-7 24 Q0 30 7 24" fill={C.watL} stroke="none"/>
    </g>);
    case "whirlpool": return _symG(<g>
      <ellipse cx="0" cy="13" rx="24" ry="13" fill={C.wat}/>
      <path d="M0 13 Q8 13 8 7 Q8 0 0 0 Q-12 0 -12 11 Q-12 24 4 24 Q22 24 22 9" fill="none" stroke={C.watL} strokeWidth="2"/>
      <path d="M0 13 Q4 13 4 9" fill="none" stroke={C.watD} strokeWidth="1.6"/>
    </g>);
    default: return _symG(<g>
      <path d="M0 -16 L14 0 L0 22 L-14 0 Z" fill={C.wallL}/>
      <circle cx="0" cy="2" r="4" fill={C.roof}/>
    </g>);
  }
}

// Catalogue (ordered, grouped) + lookup helpers, exposed for the editor's
// stamp palette and the place flow.
const _AM_SYMBOLS = [
  { id: "castle",     label: "Castle",     cat: "settlement", kind: "building" },
  { id: "town",       label: "Town",       cat: "settlement", kind: "town" },
  { id: "village",    label: "Village",    cat: "settlement", kind: "village" },
  { id: "fort",       label: "Fort",       cat: "settlement", kind: "building" },
  { id: "tower",      label: "Tower",      cat: "settlement", kind: "building" },
  { id: "lighthouse", label: "Lighthouse", cat: "settlement", kind: "building" },
  { id: "dungeon",    label: "Dungeon",    cat: "structure",  kind: "ruin" },
  { id: "cave",       label: "Cave",       cat: "structure",  kind: "ruin" },
  { id: "mine",       label: "Mine",       cat: "structure",  kind: "ruin" },
  { id: "windmill",   label: "Windmill",   cat: "structure",  kind: "building" },
  { id: "watermill",  label: "Watermill",  cat: "structure",  kind: "building" },
  { id: "tavern",     label: "Tavern",     cat: "structure",  kind: "building" },
  { id: "temple",     label: "Temple",     cat: "structure",  kind: "building" },
  { id: "shrine",     label: "Shrine",     cat: "structure",  kind: "building" },
  { id: "obelisk",    label: "Obelisk",    cat: "structure",  kind: "ruin" },
  { id: "well",       label: "Well",       cat: "structure",  kind: "building" },
  { id: "fountain",   label: "Fountain",   cat: "structure",  kind: "building" },
  { id: "bridge",     label: "Bridge",     cat: "structure",  kind: "building" },
  { id: "signpost",   label: "Signpost",   cat: "structure",  kind: "building" },
  { id: "camp",       label: "Camp",       cat: "structure",  kind: "building" },
  { id: "ruins",      label: "Ruins",      cat: "structure",  kind: "ruin" },
  { id: "portal",     label: "Portal",     cat: "structure",  kind: "hidden" },
  { id: "mountain",   label: "Mountain",   cat: "terrain",    kind: "mountain" },
  { id: "mountains",  label: "Mountains",  cat: "terrain",    kind: "mountain" },
  { id: "hill",       label: "Hills",      cat: "terrain",    kind: "mountain" },
  { id: "volcano",    label: "Volcano",    cat: "terrain",    kind: "mountain" },
  { id: "forest",     label: "Forest",     cat: "terrain",    kind: "forest" },
  { id: "pineforest", label: "Pinewood",   cat: "terrain",    kind: "forest" },
  { id: "tree",       label: "Tree",       cat: "terrain",    kind: "forest" },
  { id: "rocks",      label: "Rocks",      cat: "terrain",    kind: "mountain" },
  { id: "swamp",      label: "Swamp",      cat: "water",      kind: "waterway" },
  { id: "lake",       label: "Lake",       cat: "water",      kind: "waterway" },
  { id: "pond",       label: "Pond",       cat: "water",      kind: "waterway" },
  { id: "waterfall",  label: "Waterfall",  cat: "water",      kind: "waterway" },
  { id: "whirlpool",  label: "Whirlpool",  cat: "water",      kind: "waterway" },
];
const _AM_SYMBOL_CATS = [
  { id: "settlement", label: "Settlements" },
  { id: "structure",  label: "Structures" },
  { id: "terrain",    label: "Terrain" },
  { id: "water",      label: "Water" },
];
const _AM_SYMBOL_BY_ID = Object.fromEntries(_AM_SYMBOLS.map((s) => [s.id, s]));
const AtlasSymbolLib = {
  list: _AM_SYMBOLS,
  cats: _AM_SYMBOL_CATS,
  has: (id) => Object.prototype.hasOwnProperty.call(_AM_SYMBOL_BY_ID, id),
  label: (id) => (_AM_SYMBOL_BY_ID[id] && _AM_SYMBOL_BY_ID[id].label) || "Object",
  kind: (id) => (_AM_SYMBOL_BY_ID[id] && _AM_SYMBOL_BY_ID[id].kind) || "building",
  motif: _amSymbolMotif,
};

// ---------------------------------------------------------------------
// Shared SVG defs — patterns + filters that give the map its premium,
// antique-cartography × architectural-drafting feel. Rendered once.
// ---------------------------------------------------------------------
const AtlasDefs = () => (
  <defs>
    <pattern id="atm-water" patternUnits="userSpaceOnUse" width="13" height="13" patternTransform="rotate(38)">
      <line x1="0" y1="0" x2="0" y2="13" stroke="rgba(70,98,124,0.16)" strokeWidth="0.6"/>
    </pattern>
    <pattern id="atm-grain" patternUnits="userSpaceOnUse" width="3" height="3">
      <circle cx="1.5" cy="1.5" r="0.4" fill="rgba(120,96,60,0.10)"/>
    </pattern>
    <pattern id="atm-stipple" patternUnits="userSpaceOnUse" width="9" height="9">
      <circle cx="2" cy="2.4" r="0.7" fill="rgba(58,92,46,0.5)"/>
      <circle cx="6.4" cy="6.2" r="0.6" fill="rgba(58,92,46,0.42)"/>
    </pattern>
    <pattern id="atm-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(74,56,28,0.16)" strokeWidth="0.55"/>
    </pattern>
    <pattern id="atm-floor" patternUnits="userSpaceOnUse" width="44" height="44">
      <path d="M44 0H0V44" fill="none" stroke="rgba(74,56,28,0.15)" strokeWidth="0.7"/>
      <path d="M22 0V44 M0 22H44" fill="none" stroke="rgba(74,56,28,0.07)" strokeWidth="0.5"/>
    </pattern>
    <pattern id="atm-chevron" patternUnits="userSpaceOnUse" width="17" height="13" patternTransform="rotate(-2)">
      <path d="M2 10 L8.5 3 L15 10" fill="none" stroke="rgba(94,72,48,0.42)" strokeWidth="0.85" strokeLinejoin="round" strokeLinecap="round"/>
    </pattern>
    <radialGradient id="atm-land" cx="50%" cy="47%" r="62%">
      <stop offset="0%" stopColor="#fcf4da" stopOpacity="0.95"/>
      <stop offset="100%" stopColor="#e9d8af" stopOpacity="0"/>
    </radialGradient>
    <radialGradient id="atm-vign" cx="50%" cy="45%" r="74%">
      <stop offset="56%" stopColor="rgba(46,32,14,0)"/>
      <stop offset="100%" stopColor="rgba(46,32,14,0.22)"/>
    </radialGradient>
    <linearGradient id="atm-floor-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#f7f0da"/>
      <stop offset="100%" stopColor="#eee3c6"/>
    </linearGradient>
    <filter id="atm-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(46,32,14,0.32)"/>
    </filter>
    <filter id="atm-rough">
      <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1"/>
    </filter>
  </defs>
);

const _ATM_LAND_D = "M 30 130 C 60 90, 280 70, 360 200 S 400 380, 320 420 S 100 460, 60 320 Z " +
  "M 380 290 C 460 260, 620 230, 690 360 S 540 480, 380 420 Z " +
  "M 740 200 C 820 170, 1100 170, 1140 320 S 980 510, 880 480 S 720 360, 740 200 Z";

// Engraved title nameplate (cartouche) — names the current map sheet,
// like the title block on an antique chart.
const AtlasCartouche = ({ title }) => {
  if (!title) return null;
  const label = String(title).toUpperCase();
  const W = Math.max(150, 42 + label.length * 11.5);
  return (
    <g transform="translate(36, 620)" pointerEvents="none">
      <rect x="0" y="-21" width={W} height="42" rx="5" fill="rgba(250,242,221,0.9)" stroke="rgba(74,56,28,0.58)" strokeWidth="1.6"/>
      <rect x="5" y="-16" width={W - 10} height="32" rx="2.5" fill="none" stroke="rgba(74,56,28,0.4)" strokeWidth="0.7"/>
      <g stroke="rgba(74,56,28,0.5)" strokeWidth="1" fill="none">
        <path d="M10 -21 q-7 0 -7 7"/><path d={`M${W - 10} -21 q7 0 7 7`}/>
        <path d="M10 21 q-7 0 -7 -7"/><path d={`M${W - 10} 21 q7 0 7 -7`}/>
      </g>
      <text x={W / 2} y="-1.5" textAnchor="middle" dominantBaseline="middle"
            fontFamily="var(--font-display)" fontSize="16" fontWeight="700" letterSpacing="0.14em" fill="#3a2c12">{label}</text>
      <line x1={W / 2 - W * 0.3} y1="11" x2={W / 2 + W * 0.3} y2="11" stroke="rgba(74,56,28,0.32)" strokeWidth="0.7"/>
    </g>
  );
};

// ---------------------------------------------------------------------
// Background plate — antique sea/coast (world) or a drafting floor grid
// (interior), framed like an engraved map sheet.
// ---------------------------------------------------------------------
const AtlasPlate = ({ showIso, showGrid, showTexture, interior = false, title = null }) => (
  <g aria-hidden>
    <AtlasDefs/>
    {interior ? (
      <g>
        <rect x="0" y="0" width="1200" height="700" fill="url(#atm-floor-bg)"/>
        <rect x="0" y="0" width="1200" height="700" fill="url(#atm-floor)"/>
        {showTexture && <rect x="0" y="0" width="1200" height="700" fill="url(#atm-grain)" opacity="0.3"/>}
      </g>
    ) : (
      <g>
        <rect x="0" y="0" width="1200" height="700" fill="#eaddbb"/>
        <rect x="0" y="0" width="1200" height="700" fill="url(#atm-water)" opacity="0.6"/>
        {/* land: a soft coastline band beneath a crisp inked, hand-wobbled edge */}
        <path d={_ATM_LAND_D} fill="url(#atm-land)" stroke="rgba(74,56,28,0.16)" strokeWidth="7" filter="url(#atm-rough)"/>
        <path d={_ATM_LAND_D} fill="none" stroke="rgba(74,56,28,0.62)" strokeWidth="1.5" filter="url(#atm-rough)"/>
        {showTexture && <rect x="0" y="0" width="1200" height="700" fill="url(#atm-grain)" opacity="0.4"/>}
        {showIso && (
          <g stroke="rgba(120,96,60,0.26)" strokeWidth="0.6" fill="none">
            <ellipse cx="180" cy="260" rx="120" ry="80"/><ellipse cx="180" cy="260" rx="80" ry="55"/><ellipse cx="180" cy="260" rx="40" ry="28"/>
            <ellipse cx="540" cy="360" rx="140" ry="80" transform="rotate(-12 540 360)"/><ellipse cx="540" cy="360" rx="90" ry="50" transform="rotate(-12 540 360)"/>
            <ellipse cx="940" cy="320" rx="160" ry="120"/><ellipse cx="940" cy="320" rx="110" ry="80"/><ellipse cx="940" cy="320" rx="60" ry="40"/>
          </g>
        )}
      </g>
    )}
    {showGrid && !interior && (
      <g stroke="rgba(120,96,60,0.16)" strokeWidth="0.5">
        {Array.from({ length: 11 }).map((_, i) => <line key={"v" + i} x1={(i + 1) * 100} y1="0" x2={(i + 1) * 100} y2="700"/>)}
        {Array.from({ length: 6 }).map((_, i) => <line key={"h" + i} x1="0" y1={(i + 1) * 100} x2="1200" y2={(i + 1) * 100}/>)}
      </g>
    )}
    {/* Compass rose */}
    <g transform="translate(1092, 92)" opacity="0.6">
      <circle r="33" fill="rgba(250,242,221,0.35)" stroke="#4a381c" strokeWidth="0.8"/>
      <circle r="22" fill="none" stroke="#4a381c" strokeWidth="0.4" strokeDasharray="2 4"/>
      <path d="M 0 -31 L 5 0 L 0 31 L -5 0 Z" fill="rgba(74,56,28,0.62)"/>
      <path d="M -31 0 L 0 5 L 31 0 L 0 -5 Z" fill="rgba(74,56,28,0.30)"/>
      <text x="0" y="-37" textAnchor="middle" fontFamily="var(--font-display)" fontSize="11" fill="rgba(74,56,28,0.8)">N</text>
    </g>
    {/* Scale bar (world) */}
    {!interior && (
      <g transform="translate(1006, 662)" opacity="0.62">
        <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(74,56,28,0.72)" strokeWidth="0.9"/>
        <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(74,56,28,0.72)" strokeWidth="0.9"/>
        <line x1="60" y1="-2" x2="60" y2="2" stroke="rgba(74,56,28,0.5)" strokeWidth="0.6"/>
        <line x1="120" y1="-3" x2="120" y2="3" stroke="rgba(74,56,28,0.72)" strokeWidth="0.9"/>
        <text x="60" y="-6" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="8.5" fill="rgba(74,56,28,0.82)" letterSpacing="0.15em">100 LEAGUES</text>
      </g>
    )}
    {/* Aged vignette + engraved double-frame with corner ticks */}
    <rect x="0" y="0" width="1200" height="700" fill="url(#atm-vign)" pointerEvents="none"/>
    <g fill="none" stroke="rgba(74,56,28,0.5)" pointerEvents="none">
      <rect x="13" y="13" width="1174" height="674" rx="3" strokeWidth="1.6"/>
      <rect x="19.5" y="19.5" width="1161" height="661" rx="2" strokeWidth="0.7" opacity="0.55"/>
      {[[13, 13, 1, 1], [1187, 13, -1, 1], [13, 687, 1, -1], [1187, 687, -1, -1]].map(([x, y, sx, sy], i) => (
        <path key={i} d={`M ${x} ${y + sy * 26} L ${x} ${y} L ${x + sx * 26} ${y}`} strokeWidth="2.2"/>
      ))}
    </g>
    {/* Engraved title nameplate */}
    <AtlasCartouche title={title}/>
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
const AtlasShapes = ({ locations, onSelect, focusId, selectedSet, ctxLocs, dimFn, layers, showLabels = true, clean = false, shapeOf, onShapePointerDown, onDoubleClick }) => (
  <g className="atm-shapes">
    {locations.map((loc) => {
      const shape = shapeOf ? shapeOf(loc) : loc.shape;
      if (!shape) return null;
      if (!_pinIsVisible(loc, layers)) return null;
      const geom = _amShapeGeom(shape);
      if (!geom) return null;
      const st = (shape.style && SHAPE_STYLE_BY_TYPE[shape.style]) || SHAPE_STYLE_BY_TYPE[loc.type] || SHAPE_STYLE_BY_TYPE._default;
      const focused = loc.id === focusId;
      const msel = selectedSet && selectedSet.has(loc.id);
      const dim = (ctxLocs && !ctxLocs.has(loc.id)) || (dimFn && dimFn(loc));
      const c = _amPx(loc); // centroid (buildAtlasDataSync set coords to it)
      const Tag = geom.tag;
      const isPath = !!geom.open;
      const organic = !isPath && SHAPE_ORGANIC.has(loc.type);
      const baseW = SHAPE_LINEW[loc.type] != null ? SHAPE_LINEW[loc.type] : 1.4;
      const sw = focused ? baseW + 1.2 : (isPath ? 3.2 : baseW);
      const texId = !isPath && SHAPE_TEXTURE[loc.type];
      const big = SHAPE_BIGLABEL.has(loc.type);
      const isRoad = loc.type === "road";
      const casing = isPath ? (isRoad ? "rgba(150,120,70,0.5)" : "rgba(80,120,160,0.4)") : null; // river/road underlay
      return (
        <g key={loc.id} data-atm-shape={loc.id} className={"atm-shape" + (focused ? " is-focused" : "")}
           opacity={dim ? 0.32 : 1} style={{ cursor: focused ? "move" : "pointer" }}
           onPointerDown={(e) => onShapePointerDown && onShapePointerDown(e, loc)}
           onDoubleClick={(e) => { if (onDoubleClick) { e.stopPropagation(); onDoubleClick(loc); } }}
           onClick={(e) => { e.stopPropagation(); onSelect && onSelect(loc, e); }}>
          <g filter="url(#atm-shadow)">
            {casing && <Tag {...geom.props} fill="none" stroke={casing} strokeWidth={sw + 4} strokeLinejoin="round" strokeLinecap="round"/>}
            <Tag {...geom.props}
                 fill={isPath ? "none" : (clean ? st.fill.replace(/0?\.\d+\)/, "0.30)") : st.fill)}
                 stroke={focused ? "#c98a2c" : st.stroke}
                 strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
                 strokeDasharray={isPath ? (isRoad ? "10 6" : "0") : (loc.type === "region" ? "8 5" : "0")}
                 filter={organic && !clean ? "url(#atm-rough)" : undefined}/>
            {texId && <Tag {...geom.props} fill={`url(#${texId})`} stroke="none" opacity={0.7} pointerEvents="none"/>}
          </g>
          {msel && !focused && <Tag {...geom.props} fill="none" stroke="#c98a2c" strokeWidth={sw + 1.5} strokeDasharray="5 3" pointerEvents="none"/>}
          {showLabels && (
            <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central"
                  fontFamily="var(--font-display)" fontSize={big ? 13 : 12} fontWeight="600"
                  letterSpacing={big ? "0.2em" : "0.01em"} fill="#3a2c12" pointerEvents="none"
                  style={{ paintOrder: "stroke", stroke: "rgba(250,242,221,0.9)", strokeWidth: 3, strokeLinejoin: "round" }}>
              {big ? (loc.name || "").toUpperCase() : loc.name}
            </text>
          )}
        </g>
      );
    })}
  </g>
);

// Resize/vertex handles for the selected drawn region (editor, select tool).
const AtlasShapeHandles = ({ loc, shape, onHandleDown }) => {
  if (!shape) return null;
  const PX = (v) => (Number(v) / 100) * 1200, PY = (v) => (Number(v) / 100) * 700;
  const H = (cx, cy, key, mode, index) => (
    <circle key={key} cx={cx} cy={cy} r={5.5} fill="#fffaf0" stroke="#c98a2c" strokeWidth="1.6"
            style={{ cursor: "grab" }} data-atm-handle={mode}
            onPointerDown={(e) => onHandleDown(e, loc, mode, index)}/>
  );
  if (shape.type === "rect") {
    const x = PX(shape.x), y = PY(shape.y), w = PX(shape.w), h = PY(shape.h);
    return <g>{[[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map((c, i) => H(c[0], c[1], "c" + i, "rect-corner", i))}</g>;
  }
  if (shape.type === "circle") {
    const cx = PX(shape.cx), cy = PY(shape.cy), r = (Number(shape.r) / 100) * 1200;
    return <g>{H(cx + r, cy, "r", "circle-radius", 0)}</g>;
  }
  if (shape.type === "polygon" || shape.type === "freehand" || shape.type === "path") {
    return <g>{shape.points.map((p, i) => H(PX(p[0]), PY(p[1]), "v" + i, "vertex", i))}</g>;
  }
  return null;
};

// ---------------------------------------------------------------------
// Object stamps — pre-made map symbols (data.symbol) placed at a point,
// scaled by data.symbolSize. Drop-shadowed + labelled + clickable; in
// the editor they drag to move, drill on double-click, and show a corner
// handle to resize.
// ---------------------------------------------------------------------
const AtlasSymbols = ({
  locations, layers, focusId, selectedSet, onSelect, onSymbolDown, onDoubleClick,
  onSizeDown, sizeOf, posOf, showLabels = true, ctxLocs, dimFn, editorSelect = false,
}) => (
  <g className="atm-symbols">
    {locations.map((loc) => {
      if (!loc.symbol) return null;
      if (!_pinIsVisible(loc, layers)) return null;
      const motif = _amSymbolMotif(loc.symbol);
      if (!motif) return null;
      const p = _amPx(posOf ? posOf(loc) : loc);
      const size = Math.max(0.4, sizeOf ? sizeOf(loc) : (loc.symbolSize || 1));
      const focused = loc.id === focusId;
      const msel = selectedSet && selectedSet.has(loc.id);
      const dim = (ctxLocs && !ctxLocs.has(loc.id)) || (dimFn && dimFn(loc));
      const half = (SYMBOL_BOX / 2) * size;
      // Selective labels keep dense clusters legible: always label the
      // focused stamp, settlements, and sized-up landmarks; hide minor
      // props (wells, signposts, small structures) until they're selected.
      const meta = _AM_SYMBOL_BY_ID[loc.symbol];
      const labelThis = showLabels && loc.name && (focused || (meta && meta.cat === "settlement") || size >= 1.2);
      return (
        <g key={loc.id} data-atm-symbol={loc.id} className={"atm-symbol" + (focused ? " is-focused" : "")}
           opacity={dim ? 0.34 : 1} transform={`translate(${p.x}, ${p.y})`}
           style={{ cursor: editorSelect ? (focused ? "move" : "pointer") : "pointer" }}
           onPointerDown={(e) => onSymbolDown && onSymbolDown(e, loc)}
           onDoubleClick={(e) => { if (onDoubleClick) { e.stopPropagation(); onDoubleClick(loc); } }}
           onClick={(e) => { e.stopPropagation(); onSelect && onSelect(loc, e); }}>
          {(focused || msel) && <circle r={half + 7} fill="rgba(255,200,80,0.16)" stroke="#c98a2c" strokeWidth="1.4" strokeDasharray="5 4"/>}
          <g transform={`scale(${size})`} filter="url(#atm-shadow)">{motif}</g>
          {labelThis && (
            <text x="0" y={half + 13} textAnchor="middle" fontFamily="var(--font-display)" fontSize="11.5" fontWeight="600"
                  fill="#2a2218" pointerEvents="none"
                  style={{ paintOrder: "stroke", stroke: "rgba(250,242,221,0.92)", strokeWidth: 3, strokeLinejoin: "round" }}>
              {loc.name}
            </text>
          )}
          {focused && editorSelect && onSizeDown && (
            <circle data-atm-handle="symbol-size" cx={half} cy={-half} r={5.5} fill="#fffaf0" stroke="#c98a2c" strokeWidth="1.6"
                    style={{ cursor: "nwse-resize" }} onPointerDown={(e) => onSizeDown(e, loc)}/>
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
       onClick={(e) => { e.stopPropagation(); onClick && onClick(loc, e); }} style={{ cursor: "pointer" }}>
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
  variant = "side", className = "", cleanStyle = false, interior = false, title = null,
  // Live editing (editor variant): active tool + placement callbacks.
  tool = "select", onMapPoint = null, onMovePin = null, onDrawShape = null, onReshape = null,
  onResizeSymbol = null,
  view = null, onViewChange = null, onDrillDown = null, onSeedDemo = null,
  onMultiMove = null, onMultiDelete = null, onMultiDuplicate = null,
}) => {
  const vt = view || { z: 1, x: 0, y: 0 };
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
  // ---- Marquee multi-select (editor, select tool): rubber-band select a
  // group, drag to move them together, copy / paste / delete many at once.
  const [selIds, setSelIds] = React.useState(() => new Set()); // multi-selection
  const [marquee, setMarquee] = React.useState(null); // live rubber-band { x0,y0,x1,y1 } pct
  const [groupMove, setGroupMove] = React.useState(null); // live { ids:Set, dx, dy }
  const marqueeRef = React.useRef(null); // { x0, y0, additive, pointerId, dragging }
  const groupRef = React.useRef(null);   // { ids:Set, startPct, pointerId, pending }
  const clipRef = React.useRef(null);    // copied source ids
  const multiEnabled = variant === "editor" && tool === "select" && !!(onMultiMove || onMultiDelete || onMultiDuplicate);
  const _clampPct = (v) => Math.max(0, Math.min(100, v));
  // Screen → svg user units (accounting for preserveAspectRatio letterbox).
  const toUser = (evt) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / 1200, rect.height / 700) || 1;
    const ox = (rect.width - 1200 * scale) / 2;
    const oy = (rect.height - 700 * scale) / 2;
    return { ux: (evt.clientX - rect.left - ox) / scale, uy: (evt.clientY - rect.top - oy) / scale };
  };
  // Screen → percent, inverting the zoom/pan transform too.
  const toPct = (evt) => {
    const { ux, uy } = toUser(evt);
    return {
      x: Math.max(0, Math.min(100, (((ux - vt.x) / vt.z) / 1200) * 100)),
      y: Math.max(0, Math.min(100, (((uy - vt.y) / vt.z) / 700) * 100)),
    };
  };
  const panRef = React.useRef(null);
  const onWheel = (e) => {
    if (!onViewChange) return;
    e.preventDefault();
    const { ux, uy } = toUser(e);
    const nz = Math.max(1, Math.min(8, vt.z * (e.deltaY < 0 ? 1.12 : 0.892)));
    onViewChange({ z: nz, x: ux - ((ux - vt.x) / vt.z) * nz, y: uy - ((uy - vt.y) / vt.z) * nz });
  };
  // ---- Drawing interactions (rect/circle/freehand drag, polygon clicks) --
  const drawRef = React.useRef(null);              // { tool, sx, sy } | { tool:"draw-freehand", points }
  const draftRef = React.useRef(null);             // the committed-on-release shape (decoupled from render)
  const [draft, setDraft] = React.useState(null);  // live preview shape
  const [polyPts, setPolyPts] = React.useState([]); // polygon vertices (%)
  const isDrawTool = _AM_DRAW_TOOLS.has(tool);
  // ---- Reshape interactions (move / resize / vertex-drag a drawn region) --
  const reshapeRef = React.useRef(null);  // { locId, mode, index, orig, startPct }
  const editShapeRef = React.useRef(null);
  const [editShape, setEditShape] = React.useState(null); // { locId, shape } live override
  const shapeOf = (loc) => {
    let s = (editShape && editShape.locId === loc.id) ? editShape.shape : loc.shape;
    if (s && groupMove && groupMove.ids.has(loc.id)) s = _amReshape(s, "move", 0, groupMove.dx, groupMove.dy);
    return s;
  };
  // ---- Object-stamp interactions (move a symbol's anchor / resize it) ----
  const symMoveRef = React.useRef(null);   // { locId, startPct, orig:{x,y}, pointerId, pending }
  const symSizeRef = React.useRef(null);   // { locId, center:{x,y}px }
  const editSymRef = React.useRef(null);
  const [editSym, setEditSym] = React.useState(null); // { locId, size } live override
  const symbolSizeOf = (loc) => (editSym && editSym.locId === loc.id) ? editSym.size : (loc.symbolSize || 1);
  // Reset any in-progress draft / multi-selection when the tool changes.
  _ue_am(() => { setDraft(null); setPolyPts([]); drawRef.current = null; draftRef.current = null; setSelIds(new Set()); setMarquee(null); }, [tool]);
  // Element click: shift/ctrl/cmd toggles multi-selection; a plain click
  // selects one and drops any marquee selection.
  const onPickInternal = (loc, e) => {
    if (loc && e && (e.shiftKey || e.metaKey || e.ctrlKey) && multiEnabled) {
      setSelIds((prev) => { const n = new Set(prev); n.has(loc.id) ? n.delete(loc.id) : n.add(loc.id); return n; });
      return;
    }
    if (selIds.size) setSelIds(new Set());
    onSelect && onSelect(loc);
  };
  // If the pressed element belongs to a multi-selection, a drag moves the
  // whole group rather than the single item.
  const startGroupIfSelected = (e, loc) => {
    if (!multiEnabled || !onMultiMove || !(selIds.size > 1 && selIds.has(loc.id))) return false;
    groupRef.current = { ids: new Set(selIds), startPct: toPct(e), pointerId: e.pointerId, pending: true };
    return true;
  };
  // Escape cancels an in-progress polygon/draft.
  _ue_am(() => {
    if (variant !== "editor") return;
    const onKey = (e) => { if (e.key === "Escape") { setDraft(null); setPolyPts([]); drawRef.current = null; } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const onSvgClick = (e) => {
    if (e.target.closest && e.target.closest("[data-atm-pin]")) return;
    // Polygon: click to drop vertices; click near the first to close.
    if (tool === "draw-polygon" && onDrawShape && variant === "editor") {
      const p = toPct(e);
      setPolyPts((pts) => {
        if (pts.length >= 3) {
          const f = pts[0];
          const d = Math.hypot(((p.x - f[0]) / 100) * 1200, ((p.y - f[1]) / 100) * 700);
          if (d < 18) { onDrawShape({ type: "polygon", points: pts }); return []; }
        }
        return [...pts, [p.x, p.y]];
      });
      return;
    }
    if (!onMapPoint) return;
    onMapPoint(toPct(e), tool);
  };
  const onSvgDoubleClick = (e) => {
    if (tool !== "draw-polygon" || !onDrawShape) return;
    e.preventDefault();
    setPolyPts((pts) => { if (pts.length >= 3) onDrawShape({ type: "polygon", points: pts }); return []; });
  };
  const onSvgPointerDown = (e) => {
    // Pan tool: drag the canvas.
    if (tool === "pan" && onViewChange && variant === "editor") {
      e.stopPropagation();
      try { svgRef.current.setPointerCapture?.(e.pointerId); } catch (_e) {}
      panRef.current = { sx: e.clientX, sy: e.clientY, ox: vt.x, oy: vt.y };
      return;
    }
    // Marquee select: drag on empty parchment with the Select tool. Driven
    // off window mouse events — a background drag inside the SVG otherwise
    // gets pointercancel after the first move (the browser claims the
    // gesture), which a captured SVG pointer can't reliably hold.
    if (multiEnabled && tool === "select") {
      const onEl = e.target.closest && e.target.closest("[data-atm-pin],[data-atm-shape],[data-atm-symbol],[data-atm-handle],[data-ui='AtlasSeedDemo']");
      if (!onEl) {
        e.stopPropagation();
        const start = toPct(e);
        const mq = { x0: start.x, y0: start.y, additive: e.shiftKey, dragging: false };
        marqueeRef.current = mq;
        const onWinMove = (ev) => {
          const p = toPct(ev);
          if (!mq.dragging) {
            const moved = Math.hypot(((p.x - mq.x0) / 100) * 1200, ((p.y - mq.y0) / 100) * 700);
            if (moved < 4) return;
            mq.dragging = true;
          }
          mq.x1 = p.x; mq.y1 = p.y;
          setMarquee({ x0: mq.x0, y0: mq.y0, x1: p.x, y1: p.y });
        };
        const onWinDrag = (ev) => ev.preventDefault(); // kill any native drag (ancestor draggable) so mouse events keep flowing
        const onWinUp = () => {
          window.removeEventListener("mousemove", onWinMove);
          window.removeEventListener("mouseup", onWinUp);
          window.removeEventListener("dragstart", onWinDrag, true);
          marqueeRef.current = null;
          setMarquee(null);
          if (mq.dragging && mq.x1 != null) {
            const xlo = Math.min(mq.x0, mq.x1), xhi = Math.max(mq.x0, mq.x1);
            const ylo = Math.min(mq.y0, mq.y1), yhi = Math.max(mq.y0, mq.y1);
            const hits = locations.filter((l) => l.placed !== false && isFinite(l.x) && isFinite(l.y)
              && l.x >= xlo && l.x <= xhi && l.y >= ylo && l.y <= yhi).map((l) => l.id);
            setSelIds((prev) => { const n = mq.additive ? new Set(prev) : new Set(); hits.forEach((id) => n.add(id)); return n; });
            if (hits.length && onSelect) onSelect(null);
          } else {
            setSelIds(new Set());
          }
        };
        window.addEventListener("mousemove", onWinMove);
        window.addEventListener("mouseup", onWinUp);
        window.addEventListener("dragstart", onWinDrag, true);
        return;
      }
    }
    if (!onDrawShape || variant !== "editor" || !isDrawTool) return;
    if (e.target.closest && e.target.closest("[data-atm-pin]")) return;
    e.stopPropagation();
    const p = toPct(e);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_e) {}
    if (tool === "draw-freehand" || tool === "draw-path") { const t = tool === "draw-path" ? "path" : "freehand"; drawRef.current = { tool, points: [[p.x, p.y]] }; draftRef.current = { type: t, points: [[p.x, p.y]] }; setDraft(draftRef.current); }
    else { drawRef.current = { tool, sx: p.x, sy: p.y }; draftRef.current = _amDraftShape(tool, p.x, p.y, p.x, p.y); setDraft(draftRef.current); }
  };
  const onPinPointerDown = (e, loc) => {
    if (variant !== "editor" || tool !== "select") return;
    if (startGroupIfSelected(e, loc)) { e.stopPropagation(); return; }
    if (!onMovePin || loc.placed === false) return;
    e.stopPropagation();
    dragRef.current = { id: loc.id, moved: false };
    svgRef.current.setPointerCapture?.(e.pointerId);
  };
  // Drag the body of the SELECTED region to move it (select tool only). Armed
  // as "pending" — it only becomes a move once the pointer travels far enough,
  // so a plain click still selects and a double-click can drill down.
  const onShapePointerDown = (e, loc) => {
    if (variant !== "editor" || tool !== "select") return;
    if (startGroupIfSelected(e, loc)) return;
    if (!onReshape || loc.id !== focusId) return; // first click selects; once selected, drag moves
    reshapeRef.current = { locId: loc.id, mode: "move", orig: loc.shape, startPct: toPct(e), pointerId: e.pointerId, pending: true };
  };
  // Drag a resize/vertex handle.
  const onHandlePointerDown = (e, loc, mode, index) => {
    if (variant !== "editor" || !onReshape) return;
    e.stopPropagation();
    try { svgRef.current.setPointerCapture?.(e.pointerId); } catch (_e) {}
    reshapeRef.current = { locId: loc.id, mode, index, orig: loc.shape, startPct: toPct(e) };
  };
  // Drag a placed stamp to move its anchor (pending until it travels >4px,
  // so a click still selects and a double-click still drills in).
  const onSymbolPointerDown = (e, loc) => {
    if (variant !== "editor" || tool !== "select") return;
    if (startGroupIfSelected(e, loc)) return;
    if (!onMovePin) return;
    symMoveRef.current = { locId: loc.id, startPct: toPct(e), orig: { x: loc.x, y: loc.y }, pointerId: e.pointerId, pending: true };
  };
  // Drag the corner handle to resize a selected stamp.
  const onSymbolSizeDown = (e, loc) => {
    if (variant !== "editor" || !onResizeSymbol) return;
    e.stopPropagation();
    try { svgRef.current.setPointerCapture?.(e.pointerId); } catch (_e) {}
    symSizeRef.current = { locId: loc.id, center: _amPx(loc) };
  };
  const onSvgPointerMove = (e) => {
    const pan = panRef.current;
    if (pan) {
      const rect = svgRef.current.getBoundingClientRect();
      const scale = Math.min(rect.width / 1200, rect.height / 700) || 1;
      onViewChange({ z: vt.z, x: pan.ox + (e.clientX - pan.sx) / scale, y: pan.oy + (e.clientY - pan.sy) / scale });
      return;
    }
    const gr = groupRef.current;
    if (gr) {
      const p = toPct(e);
      if (gr.pending) {
        const moved = Math.hypot(((p.x - gr.startPct.x) / 100) * 1200, ((p.y - gr.startPct.y) / 100) * 700);
        if (moved < 4) return;
        gr.pending = false;
        try { svgRef.current.setPointerCapture?.(gr.pointerId); } catch (_e) {}
      }
      gr.dx = p.x - gr.startPct.x; gr.dy = p.y - gr.startPct.y;
      setGroupMove({ ids: gr.ids, dx: gr.dx, dy: gr.dy });
      return;
    }
    const rs = reshapeRef.current;
    if (rs) {
      const p = toPct(e);
      if (rs.pending) {
        const moved = Math.hypot(((p.x - rs.startPct.x) / 100) * 1200, ((p.y - rs.startPct.y) / 100) * 700);
        if (moved < 4) return; // still a click/double-click, not a drag
        rs.pending = false;
        try { svgRef.current.setPointerCapture?.(rs.pointerId); } catch (_e) {}
      }
      const next = _amReshape(rs.orig, rs.mode, rs.index, p.x - rs.startPct.x, p.y - rs.startPct.y, p);
      editShapeRef.current = { locId: rs.locId, shape: next };
      setEditShape(editShapeRef.current);
      return;
    }
    const ssz = symSizeRef.current;
    if (ssz) {
      const p = toPct(e);
      const px = (p.x / 100) * 1200, py = (p.y / 100) * 700;
      const reach = Math.max(Math.abs(px - ssz.center.x), Math.abs(py - ssz.center.y));
      editSymRef.current = { locId: ssz.locId, size: Math.max(0.4, Math.min(5, reach / (SYMBOL_BOX / 2))) };
      setEditSym(editSymRef.current);
      return;
    }
    const smv = symMoveRef.current;
    if (smv) {
      const p = toPct(e);
      if (smv.pending) {
        const moved = Math.hypot(((p.x - smv.startPct.x) / 100) * 1200, ((p.y - smv.startPct.y) / 100) * 700);
        if (moved < 4) return; // still a click/double-click, not a drag
        smv.pending = false;
        try { svgRef.current.setPointerCapture?.(smv.pointerId); } catch (_e) {}
      }
      const nx = Math.max(0, Math.min(100, smv.orig.x + (p.x - smv.startPct.x)));
      const ny = Math.max(0, Math.min(100, smv.orig.y + (p.y - smv.startPct.y)));
      setDragPos({ id: smv.locId, x: nx, y: ny });
      return;
    }
    const d = dragRef.current;
    if (d) { d.moved = true; setDragPos({ id: d.id, ...toPct(e) }); return; }
    const dr = drawRef.current;
    if (!dr) return;
    const p = toPct(e);
    if (dr.tool === "draw-freehand" || dr.tool === "draw-path") { dr.points.push([p.x, p.y]); draftRef.current = { type: dr.tool === "draw-path" ? "path" : "freehand", points: dr.points.slice() }; setDraft(draftRef.current); }
    else { draftRef.current = _amDraftShape(dr.tool, dr.sx, dr.sy, p.x, p.y); setDraft(draftRef.current); }
  };
  const finishDraw = () => {
    const dr = drawRef.current;
    if (!dr) return;
    drawRef.current = null;
    const d = draftRef.current; draftRef.current = null;
    setDraft(null);
    let shape = null;
    if (dr.tool === "draw-freehand" || dr.tool === "draw-path") {
      const min = dr.tool === "draw-path" ? 2 : 3;
      if (d && d.points && d.points.length >= min) shape = { type: dr.tool === "draw-path" ? "path" : "freehand", points: _amDecimate(d.points) };
    } else if (d && ((d.type === "rect" && d.w > 0.8 && d.h > 0.8) || (d.type === "circle" && d.r > 0.4))) shape = d;
    if (shape && onDrawShape) onDrawShape(shape);
  };
  const onSvgPointerUp = () => {
    if (panRef.current) { panRef.current = null; return; }
    const gr = groupRef.current;
    if (gr) {
      groupRef.current = null;
      setGroupMove(null);
      if (!gr.pending && (gr.dx || gr.dy) && onMultiMove) onMultiMove([...gr.ids], gr.dx, gr.dy);
      return;
    }
    const rs = reshapeRef.current;
    if (rs) {
      reshapeRef.current = null;
      const es = editShapeRef.current; editShapeRef.current = null;
      setEditShape(null);
      // Only commit a real drag; a "pending" (no-movement) press was just a click.
      if (!rs.pending && es && es.locId === rs.locId && onReshape) onReshape(rs.locId, es.shape);
      return;
    }
    const ssz = symSizeRef.current;
    if (ssz) {
      symSizeRef.current = null;
      const es = editSymRef.current; editSymRef.current = null;
      setEditSym(null);
      if (es && es.locId === ssz.locId && onResizeSymbol) onResizeSymbol(ssz.locId, es.size);
      return;
    }
    const smv = symMoveRef.current;
    if (smv) {
      symMoveRef.current = null;
      const dp = dragPos;
      setDragPos(null);
      if (!smv.pending && dp && dp.id === smv.locId && onMovePin) onMovePin(smv.locId, { x: dp.x, y: dp.y });
      return;
    }
    const d = dragRef.current;
    if (d) {
      dragRef.current = null;
      if (d.moved && dragPos && dragPos.id === d.id) onMovePin(d.id, { x: dragPos.x, y: dragPos.y });
      setDragPos(null);
      return;
    }
    finishDraw();
  };
  const pinLoc = (loc) => {
    let l = (dragPos && dragPos.id === loc.id) ? { ...loc, x: dragPos.x, y: dragPos.y } : loc;
    if (groupMove && groupMove.ids.has(loc.id)) l = { ...l, x: _clampPct(l.x + groupMove.dx), y: _clampPct(l.y + groupMove.dy) };
    return l;
  };

  // Determine which routes/items to emphasise
  const emphRouteIds = ctxShow && ctxShow.routeIds || [];
  const intersectIds = ctxShow && ctxShow.intersect || [];
  const emphBeast    = ctxShow && ctxShow.beastId   ? beasts.find((b) => b.id === ctxShow.beastId)     : null;
  const emphItem     = ctxShow && ctxShow.itemId    ? items.find((i)  => i.id === ctxShow.itemId)      : null;
  const emphQuest    = ctxShow && ctxShow.questId   ? (window.ATLAS_QUESTS || []).find((q) => q.id === ctxShow.questId) : null;
  const emphFaction  = ctxShow && ctxShow.factionId ? factions.find((f) => f.id === ctxShow.factionId) : null;
  const emphChapter  = ctxShow && ctxShow.chapterDiff ? chapters.find((c) => c.id === ctxShow.chapterDiff) : null;
  const focusId      = (ctxShow && ctxShow.focusLocId) || selectedId;

  // Keyboard: Delete removes the selection, Ctrl/Cmd+C / +V copy/paste it,
  // Escape clears it. Ignored while typing in a field.
  _ue_am(() => {
    if (variant !== "editor") return;
    const onKey = (e) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
      const ids = selIds.size ? [...selIds] : (focusId ? [focusId] : []);
      if ((e.key === "Delete" || e.key === "Backspace") && ids.length && onMultiDelete) {
        e.preventDefault(); onMultiDelete(ids); setSelIds(new Set());
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C") && ids.length) {
        clipRef.current = ids.slice();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V") && clipRef.current && clipRef.current.length && onMultiDuplicate) {
        e.preventDefault();
        Promise.resolve(onMultiDuplicate(clipRef.current, 4, 4)).then((newIds) => {
          if (Array.isArray(newIds) && newIds.length) { setSelIds(new Set(newIds)); clipRef.current = newIds.slice(); }
        });
      } else if (e.key === "Escape") {
        setSelIds(new Set()); setMarquee(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, selIds, focusId, onMultiDelete, onMultiDuplicate]);

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
         style={{ cursor: (isDrawTool || tool === "draw-polygon" || tool === "stamp") ? "crosshair" : (tool === "pan" ? "grab" : undefined),
                  touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
         onClick={onSvgClick} onDoubleClick={onSvgDoubleClick} onWheel={onViewChange ? onWheel : undefined}
         onDragStart={(ev) => ev.preventDefault()} draggable={false}
         onPointerDown={onSvgPointerDown} onPointerMove={onSvgPointerMove}
         onPointerUp={onSvgPointerUp} onPointerCancel={onSvgPointerUp}>
      <g transform={`translate(${vt.x},${vt.y}) scale(${vt.z})`}>
      <AtlasPlate showIso={showIso} showGrid={showGrid} showTexture={showTexture} interior={interior} title={title}/>

      {/* Region polygons under everything */}
      <g opacity={opOf("regions")}><AtlasRegions locations={locations} layers={layers} highlight={regionHighlight}/></g>

      {/* Drawn regions (user shapes) — above static polygons, below pins */}
      <AtlasShapes locations={locations} layers={layers} onSelect={onPickInternal} focusId={focusId} selectedSet={selIds}
                   ctxLocs={ctxLocs} dimFn={scrubFn} clean={cleanStyle}
                   showLabels={showLabels && variant === "editor"}
                   shapeOf={shapeOf} onShapePointerDown={onReshape ? onShapePointerDown : null}
                   onDoubleClick={onDrillDown}/>

      {/* Resize/vertex handles for the selected region */}
      {variant === "editor" && onReshape && tool === "select" && (() => {
        const loc = locations.find((l) => l.id === focusId && l.shape);
        if (!loc) return null;
        return <AtlasShapeHandles loc={loc} shape={shapeOf(loc)} onHandleDown={onHandlePointerDown}/>;
      })()}

      {/* Object stamps (pre-made map symbols) — above regions, below pins */}
      <AtlasSymbols locations={locations} layers={layers} focusId={focusId} selectedSet={selIds}
                    onSelect={onPickInternal} onSymbolDown={onSymbolPointerDown}
                    onDoubleClick={onDrillDown} onSizeDown={onResizeSymbol ? onSymbolSizeDown : null}
                    sizeOf={symbolSizeOf} posOf={pinLoc}
                    showLabels={showLabels && variant === "editor"}
                    ctxLocs={ctxLocs} dimFn={scrubFn}
                    editorSelect={variant === "editor" && tool === "select"}/>

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
          if (loc.symbol) return null; // object stamps render in AtlasSymbols
          if (!_pinIsVisible(loc, layers)) return null;
          const dim = (ctxLocs && !ctxLocs.has(loc.id)) || scrubFn(loc);
          const focused = loc.id === focusId;
          // Queue badge
          const badge = loc.queue ? { text: String(loc.queue), color: loc.queueLevel === "high" ? "#5d6d4e" : "#c98a2c" } : null;
          const msel = selIds.has(loc.id);
          const pp = _amPx(pinLoc(loc));
          return (
            <g key={loc.id} data-atm-pin={loc.id} opacity={opOf(pinLayerId(loc))} onPointerDown={(e) => onPinPointerDown(e, loc)}
               onDoubleClick={(e) => { if (onDrillDown) { e.stopPropagation(); onDrillDown(loc); } }}>
              {msel && <circle cx={pp.x} cy={pp.y} r="13" fill="rgba(201,138,44,0.16)" stroke="#c98a2c" strokeWidth="1.4" strokeDasharray="4 3"/>}
              <AtlasPin loc={pinLoc(loc)} focused={focused} dim={dim} badge={badge}
                        scaleLabel={variant === "side" ? 1 : 0.95}
                        showLabel={showLabels && (variant === "editor" || ["country","city","town","region"].includes(loc.type))}
                        onClick={onPickInternal}/>
            </g>
          );
        })}
      </g>

      {/* Live drawing preview (rect/circle/freehand draft + polygon vertices) */}
      {draft && (() => {
        const g = _amShapeGeom(draft);
        if (!g) return null;
        const T = g.tag;
        return <T {...g.props} fill={g.open ? "none" : "rgba(201,138,44,0.16)"} stroke="#c98a2c" strokeWidth="1.8"
                  strokeDasharray="6 3" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none"/>;
      })()}
      {/* Marquee selection rectangle */}
      {marquee && (() => {
        const xlo = Math.min(marquee.x0, marquee.x1), xhi = Math.max(marquee.x0, marquee.x1);
        const ylo = Math.min(marquee.y0, marquee.y1), yhi = Math.max(marquee.y0, marquee.y1);
        return <rect x={(xlo / 100) * 1200} y={(ylo / 100) * 700} width={((xhi - xlo) / 100) * 1200} height={((yhi - ylo) / 100) * 700}
                     fill="rgba(201,138,44,0.10)" stroke="#c98a2c" strokeWidth="1.2" strokeDasharray="5 3" pointerEvents="none"/>;
      })()}
      {polyPts.length > 0 && (
        <g pointerEvents="none">
          <polyline points={polyPts.map((p) => ((p[0] / 100) * 1200).toFixed(1) + "," + ((p[1] / 100) * 700).toFixed(1)).join(" ")}
                    fill="rgba(201,138,44,0.12)" stroke="#c98a2c" strokeWidth="1.8" strokeDasharray="6 3"/>
          {polyPts.map((p, i) => (
            <circle key={i} cx={(p[0] / 100) * 1200} cy={(p[1] / 100) * 700} r={i === 0 ? 5.5 : 3.5}
                    fill={i === 0 ? "#c98a2c" : "#fffaf0"} stroke="#c98a2c" strokeWidth="1.3"/>
          ))}
          <text x={(polyPts[0][0] / 100) * 1200} y={(polyPts[0][1] / 100) * 700 - 10} textAnchor="middle"
                fontFamily="var(--font-sans)" fontSize="10" fill="#8a5a1c">
            {polyPts.length >= 3 ? "click the first dot to finish" : "click to add corners"}
          </text>
        </g>
      )}

      {/* Empty plate prompt — no placed locations yet */}
      {locations.every((l) => l.placed === false) && (
        <g data-ui="AtlasEmptyPlate">
          <rect x="350" y="278" width="500" height={onSeedDemo ? 172 : 120} rx="8" fill="rgba(250,242,221,0.92)" stroke="rgba(74,56,28,0.35)" strokeWidth="1" strokeDasharray="6 4"/>
          <text x="600" y="326" textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontSize="19" fill="#4a3a22">
            {locations.length === 0 ? "No locations yet" : "Nothing placed on the map yet"}
          </text>
          <text x="600" y="354" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="12.5" fill="#76684c">
            {locations.length === 0
              ? "Create a location, or extract them from your chapters."
              : "Open the editor, pick “Add Location”, and tap the parchment."}
          </text>
          {onSeedDemo && (
            <g data-ui="AtlasSeedDemo" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onSeedDemo(); }}>
              <rect x="476" y="378" width="248" height="38" rx="19" fill="#c98a2c" stroke="#9a6a1c" strokeWidth="1"/>
              <text x="600" y="402" textAnchor="middle" fontFamily="var(--font-display)" fontSize="14" fontWeight="700" fill="#fff8ea" letterSpacing="0.03em">✦ Conjure a demo world</text>
              <text x="600" y="436" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="10.5" fill="#8a7657" fontStyle="italic">a full example world you can explore and edit</text>
            </g>
          )}
        </g>
      )}
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

Object.assign(window, { AtlasMap, AtlasPin, AtlasPlate, AtlasRoute, AtlasSymbols, AtlasSymbolLib, _amPx });
