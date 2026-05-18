// =====================================================================
// atlas-data.jsx — sample atlas world (Pale Reach / Hess setting).
// Pure presentational placeholder data; mirrors the shapes documented
// at the bottom of atlas.jsx.
//
// Hierarchy (up to 6 levels):
//   world > continent > country > region > city > town > village
//                                              > district > building > room
//
// Plus story-specific location subtypes: forest, mountain pass, road,
// river, ruin, battlefield, hidden, item-site, faction-hq, waterway.
// =====================================================================

// ---------------------------------------------------------------------
// LOCATIONS — 30 entries across 6 hierarchy levels.
// Each carries: id, type, name, parent, x/y (% of map canvas — anchor),
//   chapters[], characters[], queue, summary, fields, optional polygon
//   (SVG path string in canvas px) and optional `kind` for story types.
// ---------------------------------------------------------------------
const ATLAS_LOCATIONS = [
  // ── Continents / countries (regional polygons) ───────────────────
  { id: "north",      type: "country",   name: "Pale Reach",        parent: "world",  x: 24, y: 30, entityKind: "locations",
    polygon: "M 60 110 L 280 80 L 360 200 L 320 360 L 100 380 L 50 260 Z",
    chapters: [1,2,3,5,6,7], queue: 1,
    summary: "Salt-bleached coastal queendom. House Vey. The opening setting.",
    fields: [["Type","Country"],["Climate","Cold maritime"],["Capital","Pale Reach Hold"]] },
  { id: "hess",       type: "country",   name: "Hessmark",          parent: "world",  x: 78, y: 38, entityKind: "locations",
    polygon: "M 760 200 L 1100 180 L 1140 420 L 880 480 L 740 360 Z",
    chapters: [3,4,6,7], queue: 1,
    summary: "Inland kingdom and seat of the Glass Throne. Larger, drier, older.",
    fields: [["Type","Country"],["Climate","Continental"],["Capital","Glass Court"]] },
  { id: "ow",         type: "region",    name: "Open Sea",          parent: "world",  x: 95, y: 78, entityKind: "locations",
    polygon: "M 1000 540 L 1180 520 L 1180 690 L 980 690 Z",
    chapters: [6], queue: 0, kind: "waterway",
    summary: "The unmapped water beyond Hess Harbour.",
    fields: [["Type","Sea"]] },

  // ── Regions inside Pale Reach ────────────────────────────────────
  { id: "ac",         type: "region",    name: "Auger Cliffs",      parent: "north",  x: 26, y: 18, entityKind: "locations",
    polygon: "M 80 60 L 320 80 L 300 180 L 90 170 Z",
    chapters: [3,6], characters: ["aelinor"], queue: 1, queueLevel: "uncertain",
    summary: "Wind-cut cliff line; salt-wraith hunting ground.",
    fields: [["Type","Region · Coastal cliffs"],["Parent","Pale Reach"]] },
  { id: "as",         type: "region",    name: "Auger Strait",      parent: "north",  x: 36, y: 6, entityKind: "locations", kind: "waterway",
    chapters: [6], queue: 0,
    summary: "Narrow channel between the cliffs and the open sea.",
    fields: [["Type","Strait"],["Parent","Pale Reach"]] },

  // ── Cities / towns / villages ────────────────────────────────────
  { id: "pr",         type: "city",      name: "Pale Reach Hold",   parent: "north",  x: 17, y: 40, entityKind: "locations",
    chapters: [1,2,3,7], characters: ["aelinor","brec"], queue: 2, queueLevel: "high",
    summary: "Capital of the Reach; seat of House Vey. The story opens here.",
    fields: [["Type","City · Capital"],["Parent","Pale Reach"],["Population","~12,000"],["First seen","Ch. 1, p. 12"]] },
  { id: "sw",         type: "town",      name: "Salt Watch",        parent: "north",  x: 12, y: 56, entityKind: "locations",
    chapters: [2,5], characters: ["aelinor"], queue: 0,
    summary: "Watchtower town on the southern stockades.",
    fields: [["Type","Town"],["Parent","Pale Reach"]] },
  { id: "kr",         type: "village",   name: "Kelp Run",          parent: "north",  x: 7,  y: 64, entityKind: "locations",
    chapters: [], queue: 0,
    summary: "Tiny coastal hamlet; absent from the manuscript so far.",
    fields: [["Type","Village"],["Parent","Pale Reach"]] },

  // ── Pale Reach Hold — districts / buildings / rooms ──────────────
  { id: "pr-sea",     type: "district",  name: "Sea Gate",          parent: "pr",     x: 14, y: 38, entityKind: "locations",
    chapters: [1], queue: 0,
    summary: "The harbour-facing gate quarter of the Hold.",
    fields: [["Type","District"],["Parent","Pale Reach Hold"]] },
  { id: "pr-old",     type: "district",  name: "Old Quarter",       parent: "pr",     x: 18, y: 41, entityKind: "locations",
    chapters: [1,7], queue: 1, queueLevel: "uncertain",
    summary: "Inland warren; old stone, narrow lanes, House Vey watch posts.",
    fields: [["Type","District"],["Parent","Pale Reach Hold"]] },
  { id: "wd",         type: "building",  name: "Watchhouse",        parent: "pr-old", x: 17, y: 42, entityKind: "locations",
    chapters: [1,7], characters: ["brec"], queue: 0,
    summary: "Vey watchhouse on the Old Quarter gate.",
    fields: [["Type","Building"],["Parent","Old Quarter"]] },
  { id: "wd-cap",     type: "room",      name: "Captain's Room",    parent: "wd",     x: 17, y: 43, entityKind: "locations",
    chapters: [1], characters: ["brec"], queue: 0,
    summary: "Brec's room above the watchhouse; the cipher table.",
    fields: [["Type","Room"],["Parent","Watchhouse"]] },
  { id: "rk",         type: "building",  name: "Reachstone Keep",   parent: "pr-old", x: 19, y: 39, entityKind: "locations",
    chapters: [1,7], characters: ["aelinor"], queue: 0,
    summary: "House Vey's seat — black basalt walls cored with chalk.",
    fields: [["Type","Building · Keep"],["Parent","Old Quarter"]] },

  // ── Auger Cliffs — story sites ───────────────────────────────────
  { id: "ao",         type: "ruin",      name: "Old Auger Stone",   parent: "ac",     x: 24, y: 14, entityKind: "locations", kind: "item-site",
    chapters: [3,6], queue: 0,
    summary: "Standing stone on the cliff. Where the Auger Stone is found.",
    fields: [["Type","Ruin"],["Parent","Auger Cliffs"]] },
  { id: "wh",         type: "hidden",    name: "Wraith Hollow",     parent: "ac",     x: 28, y: 13, entityKind: "locations", kind: "hidden",
    chapters: [6], queue: 1, queueLevel: "strong",
    summary: "Hidden gully; the wraiths' den. Only Aelinor finds it.",
    fields: [["Type","Hidden"],["Parent","Auger Cliffs"]] },

  // ── Vraska Pass and surrounds ────────────────────────────────────
  { id: "vraska",     type: "region",    name: "Vraska Pass",       parent: "world",  x: 47, y: 45, entityKind: "locations",
    polygon: "M 380 280 L 600 240 L 680 360 L 540 460 L 380 420 Z",
    chapters: [4,5], queue: 0,
    summary: "The high pass between the Reach and Hess.",
    fields: [["Type","Mountain pass"]] },
  { id: "vp",         type: "city",      name: "Vraska Town",       parent: "vraska", x: 43, y: 51, entityKind: "locations",
    chapters: [4,5], characters: ["aelinor","saren"], queue: 0,
    summary: "Mountain market settlement at the head of the pass.",
    fields: [["Type","Town"],["Parent","Vraska Pass"]] },
  { id: "bw",         type: "region",    name: "Brittlewood",       parent: "vraska", x: 52, y: 60, entityKind: "locations", kind: "forest",
    polygon: "M 540 380 L 700 380 L 740 520 L 540 520 Z",
    chapters: [5], characters: ["aelinor"], queue: 0,
    summary: "Thin pine forest east of the pass.",
    fields: [["Type","Forest"],["Parent","Vraska Pass"]] },
  { id: "tg",         type: "battlefield", name: "Treaty Glade",    parent: "bw",     x: 49, y: 64, entityKind: "locations", kind: "battlefield",
    chapters: [5], queue: 0,
    summary: "Where the Treaty of Brittlewood was signed (and broken).",
    fields: [["Type","Battlefield"],["Parent","Brittlewood"]] },
  { id: "pr-road",    type: "road",      name: "Pass Road",         parent: "vraska", x: 50, y: 47, entityKind: "locations", kind: "road",
    chapters: [4,5], queue: 0,
    summary: "Old road threading Vraska — Pale Reach to Hess.",
    fields: [["Type","Road"],["Parent","Vraska Pass"]] },

  // ── Hessmark interior ────────────────────────────────────────────
  { id: "gc",         type: "city",      name: "Glass Court",       parent: "hess",   x: 78, y: 28, entityKind: "locations",
    chapters: [3,4,6,7], characters: ["saren","aelinor","mara"], queue: 1, queueLevel: "strong",
    summary: "Hess audience hall and seat of the Glass Throne.",
    fields: [["Type","City · Capital"],["Parent","Hessmark"],["Population","~38,000"]] },
  { id: "gc-throne",  type: "building",  name: "Throne Hall",       parent: "gc",     x: 79, y: 27, entityKind: "locations",
    chapters: [7], characters: ["saren","mara"], queue: 0,
    summary: "The hall of the Glass Throne itself.",
    fields: [["Type","Building"],["Parent","Glass Court"]] },
  { id: "gc-gard",    type: "district",  name: "Court Gardens",     parent: "gc",     x: 76, y: 30, entityKind: "locations",
    chapters: [3,7], characters: ["aelinor"], queue: 0,
    summary: "Walled gardens beside the Court — diplomatic ground.",
    fields: [["Type","District"],["Parent","Glass Court"]] },
  { id: "hh",         type: "city",      name: "Hess Harbour",      parent: "hess",   x: 89, y: 52, entityKind: "locations",
    chapters: [6,7], characters: ["saren"], queue: 0,
    summary: "Working port of Hessmark; whaler and grain trade.",
    fields: [["Type","City"],["Parent","Hessmark"]] },
  { id: "hh-docks",   type: "district",  name: "Harbour Docks",     parent: "hh",     x: 90, y: 53, entityKind: "locations",
    chapters: [6], queue: 0,
    summary: "Dock-side warehouses and brokers.",
    fields: [["Type","District"],["Parent","Hess Harbour"]] },
  { id: "bm",         type: "region",    name: "Black Marsh",       parent: "hess",   x: 70, y: 56, entityKind: "locations",
    polygon: "M 740 400 L 880 380 L 880 520 L 740 520 Z",
    chapters: [4,6], queue: 0,
    summary: "Sour wetland between Hess and the pass; marshwight territory.",
    fields: [["Type","Marsh"],["Parent","Hessmark"]] },
  { id: "ht",         type: "hidden",    name: "Hess Tunnel",       parent: "bm",     x: 73, y: 54, entityKind: "locations", kind: "hidden",
    chapters: [], queue: 1, queueLevel: "weak",
    summary: "Rumoured tunnel under Hess. Hearsay only — Atlas review pending.",
    fields: [["Type","Hidden · Rumour"],["Parent","Black Marsh"]] },
  { id: "ms-road",    type: "road",      name: "Marsh Road",        parent: "bm",     x: 73, y: 50, entityKind: "locations", kind: "road",
    chapters: [4], queue: 0,
    summary: "Plank causeway through Black Marsh.",
    fields: [["Type","Road"],["Parent","Black Marsh"]] },

  // ── Faction headquarters & natural sites ─────────────────────────
  { id: "salt-hq",    type: "building",  name: "Salt-Order Hall",   parent: "sw",     x: 13, y: 57, entityKind: "locations", kind: "faction-hq",
    chapters: [2], queue: 0,
    summary: "Headquarters of the Order of Salt.",
    fields: [["Type","Faction HQ"],["Parent","Salt Watch"]] },
];

// ---------------------------------------------------------------------
// TRAVEL ROUTES — characters + waypoints (locationId references)
// ---------------------------------------------------------------------
const ATLAS_ROUTES = [
  {
    id: "r-aelinor", characterId: "aelinor", characterName: "Aelinor Vey",
    color: "#7a6aa3", initials: "AV",
    summary: "Ch. 1–7: Pale Reach → Vraska → Glass Court",
    waypoints: [
      { locationId: "pr", chapter: 1, kind: "depart",  label: "Departs the Hold",       confirmed: true  },
      { locationId: "sw", chapter: 2, kind: "stop",    label: "Stops at Salt Watch",    confirmed: true  },
      { locationId: "ac", chapter: 3, kind: "stop",    label: "Walks the Cliffs",       confirmed: false },
      { locationId: "vp", chapter: 4, kind: "stop",    label: "Vraska Pass",            confirmed: true  },
      { locationId: "bw", chapter: 5, kind: "stop",    label: "Through Brittlewood",    confirmed: true  },
      { locationId: "wh", chapter: 6, kind: "stop",    label: "Finds Wraith Hollow",    confirmed: false },
      { locationId: "gc", chapter: 7, kind: "arrive",  label: "Arrives at Glass Court", confirmed: true  },
    ],
  },
  {
    id: "r-saren", characterId: "saren", characterName: "Saren of Hess",
    color: "#a8553f", initials: "SH",
    summary: "Ch. 3–7: Glass Court → Vraska → Glass Court",
    waypoints: [
      { locationId: "gc", chapter: 3, kind: "depart",  label: "Leaves the Court",       confirmed: true  },
      { locationId: "ms-road", chapter: 4, kind: "stop", label: "Marsh Road",           confirmed: true  },
      { locationId: "vp", chapter: 4, kind: "stop",    label: "Meets Aelinor",          confirmed: true  },
      { locationId: "bw", chapter: 5, kind: "stop",    label: "Treaty Glade",           confirmed: true  },
      { locationId: "gc", chapter: 7, kind: "arrive",  label: "Returns",                confirmed: true  },
    ],
  },
  {
    id: "r-brec", characterId: "brec", characterName: "Captain Brec",
    color: "#5d6d4e", initials: "CB",
    summary: "Ch. 1–7: Watchhouse stationed",
    waypoints: [
      { locationId: "wd", chapter: 1, kind: "stop",    label: "On watch",               confirmed: true  },
      { locationId: "ac", chapter: 6, kind: "stop",    label: "Investigates cliffs",    confirmed: false },
      { locationId: "wd", chapter: 7, kind: "arrive",  label: "Returns to post",        confirmed: true  },
    ],
  },
];

// ---------------------------------------------------------------------
// CHAPTERS — manuscript timeline anchors with diff data per chapter.
// ---------------------------------------------------------------------
const ATLAS_CHAPTERS = [
  { id: "ch1", label: "Ch. 1", title: "The Auger Wake",      events: 1, locations: ["pr","wd","wd-cap","rk","pr-sea","pr-old"],   added: ["wd-cap"],  warnings: 0 },
  { id: "ch2", label: "Ch. 2", title: "Salt Watch",          events: 0, locations: ["pr","sw","salt-hq"],                          added: ["salt-hq"], warnings: 0 },
  { id: "ch3", label: "Ch. 3", title: "Cliffs",              events: 2, locations: ["pr","ac","ao","gc","gc-gard"],                added: ["ao"],      warnings: 1 },
  { id: "ch4", label: "Ch. 4", title: "Pass",                events: 1, locations: ["vp","gc","ms-road","pr-road"],                added: ["pr-road","ms-road"], warnings: 0 },
  { id: "ch5", label: "Ch. 5", title: "Brittlewood",         events: 0, locations: ["vp","bw","tg","sw"],                          added: ["tg"],      warnings: 0 },
  { id: "ch6", label: "Ch. 6", title: "Wraiths",             events: 1, locations: ["ac","wh","gc","hh","hh-docks","ow","as"],     added: ["wh","hh-docks"], warnings: 2 },
  { id: "ch7", label: "Ch. 7", title: "Ash & Auger",         events: 2, locations: ["pr","gc","gc-throne","wd","hh"],              added: ["gc-throne"], warnings: 0 },
  { id: "ch8", label: "Ch. 8", title: "Reserved",            events: 0, locations: [], reserved: true, warnings: 0 },
  { id: "ch9", label: "Ch. 9", title: "Reserved",            events: 0, locations: [], reserved: true, warnings: 0 },
];

// ---------------------------------------------------------------------
// QUESTS / EVENTS — each binds a step-list of locationIds.
// ---------------------------------------------------------------------
const ATLAS_QUESTS = [
  { id: "q1", name: "The Auger's Walk",    type: "quests",  status: "active",
    steps: [ {locationId:"pr",chapter:3,label:"Plan"}, {locationId:"ac",chapter:3,label:"Reach the cliffs"}, {locationId:"ao",chapter:3,label:"The Stone"}, {locationId:"wh",chapter:6,label:"Wraith Hollow"} ],
  },
  { id: "q2", name: "The Glass Audience",  type: "quests",  status: "active",
    steps: [ {locationId:"pr",chapter:3,label:"Summons"}, {locationId:"vp",chapter:4,label:"Cross the pass"}, {locationId:"gc-gard",chapter:7,label:"Garden parley"}, {locationId:"gc-throne",chapter:7,label:"Audience"} ],
  },
  { id: "q3", name: "The Hess Tunnel Rumour", type: "quests", status: "stalled",
    steps: [ {locationId:"hh",chapter:6,label:"First whisper"}, {locationId:"hh-docks",chapter:6,label:"Broker's hint"}, {locationId:"ht",chapter:null,label:"Find the entrance"} ],
  },
  { id: "e1", name: "Salt-wraith attack",     type: "events",  status: "past", locationId: "ac", chapter: 6 },
  { id: "e2", name: "Treaty of Brittlewood",  type: "events",  status: "past", locationId: "tg", chapter: 5 },
  { id: "e3", name: "Stag Hunt",              type: "events",  status: "past", locationId: "bw", chapter: 5 },
];

// ---------------------------------------------------------------------
// BESTIARY — habitat by locationIds (for region overlay).
// ---------------------------------------------------------------------
const ATLAS_BEASTS = [
  { id: "b-saltwraith", name: "Salt-wraith",  habitat: ["ac","ow","as"],   chapters: [3,6], color: "#8a3a4f", icon: "claw",
    summary: "Salt-borne shade. Hunts the Auger Cliffs at neap tides." },
  { id: "b-stag",       name: "Brittle-stag", habitat: ["bw","tg"],        chapters: [5],   color: "#6b8a4a", icon: "claw",
    summary: "Pale, antlered prey of the pass woods." },
  { id: "b-augerfish",  name: "Auger-fish",   habitat: ["as","ow","ac"],   chapters: [6],   color: "#7a6aa3", icon: "drop",
    summary: "Spiral-bodied fish; said to mark wraith waters." },
  { id: "b-marshwight", name: "Marshwight",   habitat: ["bm","ht"],        chapters: [4],   color: "#4a5a3a", icon: "drop",
    summary: "Pale figure under the Black Marsh; rumour-only." },
];

// ---------------------------------------------------------------------
// ITEMS — found / used / lost locations per item (story object).
// ---------------------------------------------------------------------
const ATLAS_ITEMS = [
  { id: "i-augerstone", name: "Auger Stone",          icon: "gem",  color: "#b78a52",
    found: { locationId: "ao", chapter: 3 },
    used:  { locationId: "wh", chapter: 6 },
    lost:  { locationId: "ow", chapter: 6 },
    summary: "Spiral-cut stone — pried from the Old Auger." },
  { id: "i-glassrel",   name: "Glass Reliquary",      icon: "gem",  color: "#7a6aa3",
    found: { locationId: "gc-throne", chapter: 7 },
    used:  null, lost: null,
    summary: "Hess relic. Held only at audience." },
  { id: "i-kelpknot",   name: "Kelp-Knot Pendant",    icon: "knot", color: "#5d6d4e",
    found: { locationId: "kr", chapter: null },
    used:  null, lost: null,
    summary: "Worn by Reach fisherfolk — never seen on stage yet." },
  { id: "i-veysig",     name: "Vey Signet Ring",      icon: "shield", color: "#324a1f",
    found: { locationId: "rk", chapter: 1 },
    used:  { locationId: "gc-gard", chapter: 7 },
    lost:  null,
    summary: "Aelinor's signet. Used to seal the parley." },
];

// ---------------------------------------------------------------------
// FACTIONS — territory by locationIds (overlay polygon stack).
// ---------------------------------------------------------------------
const ATLAS_FACTIONS = [
  { id: "f-vey",     name: "House Vey",           color: "#324a1f", territory: ["north","pr","wd","rk","sw","kr"], hq: "rk",
    summary: "Ruling house of the Reach." },
  { id: "f-glass",   name: "The Glass Throne",    color: "#7a6aa3", territory: ["hess","gc","gc-throne","gc-gard","hh","hh-docks","bm"], hq: "gc-throne",
    summary: "Hess monarchy and court." },
  { id: "f-salt",    name: "The Order of Salt",   color: "#a8553f", territory: ["sw","salt-hq","ac","ao"], hq: "salt-hq",
    summary: "Coastal religious order; cliff-keepers." },
  { id: "f-wraith",  name: "Wraith-Cult",         color: "#5b4a55", territory: ["ac","wh","ht"], hq: "wh",
    summary: "Cult around the wraiths. Quiet, scattered." },
];

// ---------------------------------------------------------------------
// LAYERS — toggle visibility groups
// ---------------------------------------------------------------------
const ATLAS_LAYERS = [
  // Geo (place layers)
  { id: "base",        label: "Base map",            kind: "geo", color: "#9a8c6e", count: null, visible: true,  locked: true },
  { id: "regions",     label: "Continents / Countries / Regions", kind: "geo", color: "#6b8a4a", count: 6,  visible: true },
  { id: "settlements", label: "Settlements",         kind: "geo", color: "#324a1f", count: 6,  visible: true },
  { id: "buildings",   label: "Buildings / Rooms",   kind: "geo", color: "#76684c", count: 7,  visible: true },
  { id: "natural",     label: "Natural locations",   kind: "geo", color: "#5d6d4e", count: 5,  visible: true },
  { id: "districts",   label: "Districts",           kind: "geo", color: "#8a6b58", count: 5,  visible: false },
  { id: "story",       label: "Story-specific sites",kind: "geo", color: "#a8553f", count: 5,  visible: true, warnings: 1 },
  // Overlays (entity layers)
  { id: "routes",      label: "Routes / Roads",      kind: "ovl", color: "#7a6aa3", count: 3,  visible: true },
  { id: "characters",  label: "Character travel",    kind: "ovl", color: "#7a6aa3", count: 6,  visible: true },
  { id: "beasts",      label: "Bestiary habitats",   kind: "ovl", color: "#8a3a4f", count: 4,  visible: false },
  { id: "items",       label: "Items",               kind: "ovl", color: "#b78a52", count: 4,  visible: false },
  { id: "quests",      label: "Quests",              kind: "ovl", color: "#8a3a4f", count: 4,  visible: true },
  { id: "events",      label: "Events",              kind: "ovl", color: "#8a3a4f", count: 2,  visible: true },
  { id: "factions",    label: "Factions / Territories", kind: "ovl", color: "#324a1f", count: 4, visible: false },
  // Annotations
  { id: "notes",       label: "Notes",               kind: "ann", color: "#b08a3e", count: 3,  visible: true },
  { id: "mentions",    label: "Manuscript mentions", kind: "ann", color: "#9a7b3a", count: 24, visible: false },
  { id: "extracts",    label: "Extraction suggestions", kind: "ann", color: "#c98a2c", count: 6, visible: true,  warnings: 6 },
  { id: "warnings",    label: "Review warnings",     kind: "ann", color: "#c98a2c", count: 4,  visible: true,  warnings: 4 },
  { id: "diff",        label: "Timeline changes",    kind: "ann", color: "#7a6aa3", count: 2,  visible: false },
  // Art (cartography toggles)
  { id: "labels",      label: "Place labels",        kind: "art", color: "#2a2218", count: null, visible: true },
  { id: "grid",        label: "Lat/Lon grid",        kind: "art", color: "#9a8c6e", count: null, visible: false },
  { id: "isolines",    label: "Contours",            kind: "art", color: "#9a8c6e", count: null, visible: true },
  { id: "texture",     label: "Parchment grain",     kind: "art", color: "#9a8c6e", count: null, visible: true },
];

// ---------------------------------------------------------------------
// CAST — characters available for atlas overlay
// ---------------------------------------------------------------------
const ATLAS_CAST = [
  { id: "aelinor", name: "Aelinor Vey",   initials: "AV", color: "#7a6aa3", role: "protagonist" },
  { id: "saren",   name: "Saren of Hess", initials: "SH", color: "#a8553f", role: "antagonist"  },
  { id: "brec",    name: "Captain Brec",  initials: "CB", color: "#5d6d4e", role: "supporting"  },
  { id: "mara",    name: "Mara of Hess",  initials: "MH", color: "#b78a52", role: "supporting"  },
  { id: "auger",   name: "The Auger",     initials: "TA", color: "#6b6f7a", role: "minor"       },
  { id: "dav",     name: "Dav the Quiet", initials: "DQ", color: "#8a6b58", role: "minor"       },
];

// ---------------------------------------------------------------------
// REVIEW QUEUE — Atlas-specific extraction candidates.
// ---------------------------------------------------------------------
const ATLAS_QUEUE = [
  { id: "qa1", name: "The Glass Court",    level: "uncertain", value: 58, action: "Place on map?", excerpt: "...the Glass Court rose on a hill the colour of bone...",      cite: "Ch. 3, p. 76",  reason: "Found in prose; no atlas placement.",                  relatedEntity: "House Hess (Faction)" },
  { id: "qa2", name: "Auger Cliffs",       level: "strong",    value: 84, action: "Add as Region",  excerpt: "...up where the Auger Cliffs cut the sky open like a knife...", cite: "Ch. 3, p. 88",  reason: "New region candidate; parent: Pale Reach.",            relatedEntity: "Salt-wraith (Bestiary)" },
  { id: "qa3", name: "Salt Watch",         level: "high",      value: 96, action: "Auto-added",     excerpt: "...the watch at Salt was already lit when she came down...",   cite: "Ch. 2, p. 41",  reason: "High-confidence; auto-added, still reviewable.",       relatedEntity: "Order of Salt (Faction)" },
  { id: "qa4", name: "Hess Tunnel?",       level: "weak",      value: 31, action: "Reject?",        excerpt: "...the rumour of a tunnel under Hess never quite died...",     cite: "Ch. 4, p. 102", reason: "Hearsay; weak evidence for a real location.",          relatedEntity: null },
  { id: "qa5", name: "Wraith Hollow",      level: "strong",    value: 79, action: "Place under Auger Cliffs", excerpt: "...the hollow opened where no map showed it...",       cite: "Ch. 6, p. 188", reason: "New hidden site; parent: Auger Cliffs.",               relatedEntity: "Aelinor Vey (Cast)" },
  { id: "qa6", name: "Pale Reach Hold conflict", level: "uncertain", value: 52, action: "Resolve",  excerpt: "...two pages disagree on whether the Hold sits on the cliff or the inlet...", cite: "Ch. 1 vs Ch. 7", reason: "Contradiction in source. Pick canonical placement.", relatedEntity: "Pale Reach Hold (Location)" },
  { id: "qa7", name: "Aelinor → Brittlewood",  level: "high", value: 91, action: "Add travel route", excerpt: "...she walked the Brittlewood road three nights running...", cite: "Ch. 5, p. 134", reason: "Character travel implied between known locations.",        relatedEntity: "Aelinor Vey (Cast)" },
  { id: "qa8", name: "Hess Negotiation site", level: "strong", value: 73, action: "Place event",   excerpt: "...the table at the Court was set for both crowns...",         cite: "Ch. 3, p. 80",  reason: "Event needs a map location.",                          relatedEntity: "Hess Negotiation (Event)" },
];

// ---------------------------------------------------------------------
// COMPARISON / CONTEXT PRESETS — drives the Atlas's "show selected"
// demo states. The Tweaks panel cycles these so the user can see how
// the Atlas reacts when other panels select an entity.
// ---------------------------------------------------------------------
const ATLAS_CONTEXT_PRESETS = [
  { id: "free",       label: "Free",                source: null,
    description: "Nothing selected. Atlas shows the world plate." },
  { id: "char-aeli",  label: "Cast: Aelinor",       source: { panel: "Cast", entityType: "cast", id: "aelinor", label: "Aelinor Vey" },
    show: { routeIds: ["r-aelinor"], focusLocId: "vp" },
    description: "Cast → Atlas: shows Aelinor's route across all chapters." },
  { id: "char-saren", label: "Cast: Saren",         source: { panel: "Cast", entityType: "cast", id: "saren", label: "Saren of Hess" },
    show: { routeIds: ["r-saren"], focusLocId: "gc" },
    description: "Cast → Atlas: Saren's route." },
  { id: "char-pair",  label: "Cast: Aelinor + Saren", source: { panel: "Cast", entityType: "cast", id: "pair", label: "Aelinor + Saren" },
    show: { routeIds: ["r-aelinor","r-saren"], focusLocId: "vp", intersect: ["vp","gc","bw"] },
    description: "Two characters: shows intersecting route segments and meeting points." },
  { id: "beast-wraith", label: "Bestiary: Salt-wraith", source: { panel: "Bestiary", entityType: "bestiary", id: "b-saltwraith", label: "Salt-wraith" },
    show: { beastId: "b-saltwraith", focusLocId: "ac" },
    description: "Bestiary → Atlas: highlights Salt-wraith habitat polygons." },
  { id: "item-stone", label: "Items: Auger Stone",  source: { panel: "Items", entityType: "items", id: "i-augerstone", label: "Auger Stone" },
    show: { itemId: "i-augerstone", focusLocId: "ao" },
    description: "Items → Atlas: shows where the Auger Stone is found, used, lost." },
  { id: "quest-walk", label: "Quests: Auger's Walk",source: { panel: "Quests", entityType: "quests", id: "q1", label: "The Auger's Walk" },
    show: { questId: "q1", focusLocId: "ac" },
    description: "Quests → Atlas: shows step locations in order." },
  { id: "fac-glass",  label: "Factions: Glass Throne", source: { panel: "Factions", entityType: "factions", id: "f-glass", label: "The Glass Throne" },
    show: { factionId: "f-glass", focusLocId: "gc" },
    description: "Factions → Atlas: shows controlled territory." },
  { id: "ch-diff",    label: "Chapter diff: Ch. 6", source: { panel: "Manuscript", entityType: "chapter", id: "ch6", label: "Ch. 6 — Wraiths" },
    show: { chapterDiff: "ch6", focusLocId: "wh" },
    description: "Manuscript → Atlas: highlights what changed in this chapter." },
];

// ---------------------------------------------------------------------
// TOOLBAR DEFINITIONS — core (always-visible) + flyout groups
// ---------------------------------------------------------------------
const ATLAS_CORE_TOOLS = [
  { id: "select",   icon: "pin-tack",   label: "Select",        kbd: "V" },
  { id: "pan",      icon: "grip",       label: "Pan",           kbd: "H" },
  { id: "addLoc",   icon: "plus",       label: "Add Location",  kbd: "L" },
  { id: "addRoute", icon: "branch",     label: "Add Route",     kbd: "R" },
  { id: "layers",   icon: "stack",      label: "Layers",        kbd: "Y" },
  { id: "chapter",  icon: "book",       label: "Chapter",       kbd: "C" },
  { id: "tray",     icon: "menu",       label: "Entity Tray",   kbd: "T" },
  { id: "queue",    icon: "bell",       label: "Review Queue",  kbd: "Q" },
];
const ATLAS_FLYOUT_GROUPS = [
  { id: "shape", label: "Region / Boundary",  tools: [
    { id: "shape-region",   icon: "drop",     label: "Region polygon" },
    { id: "shape-boundary", icon: "branch",   label: "Boundary line" },
    { id: "shape-territory",icon: "shield",   label: "Faction territory" },
  ]},
  { id: "path", label: "Road / River / Route", tools: [
    { id: "path-road",  icon: "branch", label: "Road" },
    { id: "path-river", icon: "drop",   label: "River" },
    { id: "path-route", icon: "branch", label: "Travel route" },
  ]},
  { id: "label", label: "Label / Note / Marker", tools: [
    { id: "label-place", icon: "scroll", label: "Place label" },
    { id: "label-note",  icon: "paper",  label: "Sticky note" },
    { id: "label-mark",  icon: "pin",    label: "Marker pin" },
  ]},
  { id: "edit",  label: "Edit / Lock / Duplicate", tools: [
    { id: "edit-edit",   icon: "feather", label: "Edit" },
    { id: "edit-lock",   icon: "lock",    label: "Lock" },
    { id: "edit-dup",    icon: "stack",   label: "Duplicate" },
    { id: "edit-del",    icon: "trash",   label: "Delete" },
  ]},
  { id: "view", label: "View toggles", tools: [
    { id: "view-iso",    icon: "knot",  label: "Contours" },
    { id: "view-grid",   icon: "menu",  label: "Lat/Lon grid" },
    { id: "view-tex",    icon: "drop",  label: "Parchment" },
  ]},
  { id: "io",   label: "Import / Extraction", tools: [
    { id: "io-extract",  icon: "sparkle", label: "Extract from manuscript" },
    { id: "io-import",   icon: "cloud",   label: "Import map image" },
    { id: "io-export",   icon: "expand",  label: "Export atlas" },
  ]},
];

Object.assign(window, {
  ATLAS_LOCATIONS, ATLAS_ROUTES, ATLAS_CHAPTERS, ATLAS_QUESTS, ATLAS_QUEUE,
  ATLAS_LAYERS, ATLAS_CAST, ATLAS_BEASTS, ATLAS_ITEMS, ATLAS_FACTIONS,
  ATLAS_CONTEXT_PRESETS, ATLAS_CORE_TOOLS, ATLAS_FLYOUT_GROUPS,
});
