// =====================================================================
// brand.jsx — Central brand namespace + design tokens
// All app naming, taglines, colors live here. Swap brand.name to rename.
// =====================================================================

const BRAND = {
  name: "Loomwright",
  shortName: "LW",
  tagline: "Shape the book. Track the world.",
  theme: "parchment-light", // or "midnight-ink"
  // logoMark is a string id; the BrandMark component renders the SVG.
  logoMark: "wax-seal", // "wax-seal" | "loom-glyph" | "quill-thread" | "letter-mark"
  // Brand colors override token defaults when present.
  colors: {
    accent: "#9a7b3a",      // antique gold (medium)
    accentInk: "#5a4520",   // deep gold for text on light
    accentSoft: "#e7d9b5",  // soft gold tint
  },
  // Project metadata for the demo shell
  project: {
    name: "The Hollow Crown",
    book: "Book II — Ash & Auger",
    author: "E. Marlowe",
  },
};

// ---------------------------------------------------------------------
// ENTITY TYPES — single source of truth for entity colour rules.
// These are used inside the manuscript (brush-stroke highlights) and
// across all entity UI (badges, panel chrome, list dots, etc).
// ---------------------------------------------------------------------
const ENTITY_TYPES = {
  cast:        { id: "cast",        label: "Cast",          plural: "Cast",          color: "#7a6aa3", soft: "#e7e1f1", deep: "#3e335c", glyph: "◐", icon: "user" },
  bestiary:    { id: "bestiary",    label: "Bestiary",      plural: "Bestiary",      color: "#a8553f", soft: "#f1dccf", deep: "#5d2a1c", glyph: "✦", icon: "claw" },
  atlas:       { id: "atlas",       label: "Atlas",         plural: "Atlas",         color: "#6b8a4a", soft: "#dde6cc", deep: "#324a1f", glyph: "◇", icon: "compass" },
  locations:   { id: "locations",   label: "Locations",     plural: "Locations",     color: "#6b8a4a", soft: "#dde6cc", deep: "#324a1f", glyph: "▲", icon: "pin" },
  items:       { id: "items",       label: "Items",         plural: "Items",         color: "#b08a3e", soft: "#ecdfbe", deep: "#5e451a", glyph: "✧", icon: "gem" },
  classes:     { id: "classes",     label: "Classes",       plural: "Classes",       color: "#5d7896", soft: "#d8e1ec", deep: "#283a52", glyph: "◊", icon: "shield" },
  races:       { id: "races",       label: "Races",         plural: "Races",         color: "#8a8a4a", soft: "#e6e3c8", deep: "#444422", glyph: "◑", icon: "branch" },
  stats:       { id: "stats",       label: "Stats",         plural: "Stats",         color: "#3f8a8a", soft: "#cde3e3", deep: "#1a4444", glyph: "◐", icon: "bars" },
  abilities:   { id: "abilities",   label: "Abilities",     plural: "Abilities",     color: "#c97a3a", soft: "#f3dcc3", deep: "#5e3415", glyph: "✺", icon: "spark" },
  skillTrees:  { id: "skillTrees",  label: "Skill Trees",   plural: "Skill Trees",   color: "#3e6db5", soft: "#cdd9ee", deep: "#1a3258", glyph: "❋", icon: "tree" },
  quests:      { id: "quests",      label: "Quests",        plural: "Quests",        color: "#8a3a4f", soft: "#ecccd3", deep: "#481a26", glyph: "✦", icon: "scroll" },
  events:      { id: "events",      label: "Events",        plural: "Events",        color: "#c79545", soft: "#f1e1c2", deep: "#5e4317", glyph: "◈", icon: "bolt" },
  factions:    { id: "factions",    label: "Factions",      plural: "Factions",      color: "#3d3a78", soft: "#cfcde2", deep: "#1c1a3a", glyph: "▣", icon: "banner" },
  lore:        { id: "lore",        label: "Lore",          plural: "Lore / Canon",  color: "#7a5a3a", soft: "#e6d8c3", deep: "#3d2c1a", glyph: "◉", icon: "book" },
  relationships:{id: "relationships",label: "Relationships",plural: "Relationships", color: "#b86a82", soft: "#efd4dc", deep: "#5e2c3a", glyph: "∞", icon: "link" },
  timeline:    { id: "timeline",    label: "Timeline",      plural: "Timelines",     color: "#6a7a8a", soft: "#dadfe5", deep: "#2c3640", glyph: "↔", icon: "clock" },
  references:  { id: "references",  label: "References",    plural: "References",    color: "#998f78", soft: "#e6e1d3", deep: "#46402f", glyph: "❍", icon: "paper" },
};

// ---------------------------------------------------------------------
// CONFIDENCE colors — ONLY for review queues / extraction cards / margins.
// Never used inside manuscript prose.
// ---------------------------------------------------------------------
const CONFIDENCE = {
  high:    { id: "high",    label: "Auto-added",   range: "95%+",     color: "#2e5fa8", soft: "#d3deec", deep: "#142a4f" },
  strong:  { id: "strong",  label: "Strong",       range: "75–94%",   color: "#4f8045", soft: "#d2dfc8", deep: "#22381c" },
  uncertain:{id: "uncertain",label: "Uncertain",   range: "50–74%",   color: "#d68a2e", soft: "#f6e0c2", deep: "#6b3f12" },
  weak:    { id: "weak",    label: "Weak",         range: "<50%",     color: "#9c3a2e", soft: "#e9c8c2", deep: "#46140e" },
};

// ---------------------------------------------------------------------
// LEFT RAIL nav structure
//
// Three kinds of nav items, each behaves differently when clicked:
//
//   kind: "route"   → navigates the main workspace (full-screen view).
//                     Only Home, Today, Writer's Room are routes.
//   kind: "panel"   → toggles a side panel in the panel stack. Single
//                     click open/close; cmd-click pins. Carries an
//                     entity colour where applicable.
//   kind: "utility" → also a panel, but for cross-cutting utilities
//                     (review queue, today suggestions, recent, refs,
//                     trash, notifs). Visually demoted in the rail.
//
// `panelKind` is the key into PANEL_PRESETS that the rail uses when
// opening / closing the panel — defaults to the item's `id`.
// ---------------------------------------------------------------------
// NOTE: nav items carry NO hardcoded `queue` counts. The live review-queue
// badge per item is injected at render time in app.jsx from ReviewService,
// so a fresh project shows no badges and counts always reflect the store.
const NAV_ITEMS = [
  // Routes — full-screen workspace views
  { id: "home",          label: "Home",          icon: "home",     group: "routes", kind: "route" },
  { id: "today",         label: "Today",         icon: "sun",      group: "routes", kind: "route" },
  { id: "writers-room",  label: "Writer's Room", icon: "feather",  group: "routes", kind: "route" },

  // Panels — entity tabs that dock into the stack
  { id: "cast",          label: "Cast",          icon: "user",     group: "entities", kind: "panel", entity: "cast",          panelKind: "cast" },
  { id: "bestiary",      label: "Bestiary",      icon: "claw",     group: "entities", kind: "panel", entity: "bestiary",      panelKind: "bestiary" },
  { id: "atlas",         label: "Atlas",         icon: "compass",  group: "entities", kind: "panel", entity: "atlas",         panelKind: "atlas" },
  { id: "locations",     label: "Locations",     icon: "pin",      group: "entities", kind: "panel", entity: "locations",     panelKind: "locations" },
  { id: "items",         label: "Items",         icon: "gem",      group: "entities", kind: "panel", entity: "items",         panelKind: "items" },
  { id: "classes",       label: "Classes",       icon: "shield",   group: "entities", kind: "panel", entity: "classes",       panelKind: "classes" },
  { id: "races",         label: "Races",         icon: "branch",   group: "entities", kind: "panel", entity: "races",         panelKind: "races" },
  { id: "stats",         label: "Stats",         icon: "bars",     group: "entities", kind: "panel", entity: "stats",         panelKind: "stats" },
  { id: "abilities",     label: "Abilities",     icon: "spark",    group: "entities", kind: "panel", entity: "abilities",     panelKind: "abilities" },
  { id: "skillTrees",    label: "Skill Trees",   icon: "tree",     group: "entities", kind: "panel", entity: "skillTrees",    panelKind: "skillTrees" },
  { id: "relationships", label: "Relationships", icon: "link",     group: "entities", kind: "panel", entity: "relationships", panelKind: "relationships" },
  { id: "quests",        label: "Quests",        icon: "scroll",   group: "entities", kind: "panel", entity: "quests",        panelKind: "quests" },
  { id: "events",        label: "Events",        icon: "bolt",     group: "entities", kind: "panel", entity: "events",        panelKind: "events" },
  { id: "timeline",      label: "Timeline",      icon: "clock",    group: "entities", kind: "panel", entity: "timeline",      panelKind: "timeline" },
  { id: "lore",          label: "Lore / Canon",  icon: "book",     group: "entities", kind: "panel", entity: "lore",          panelKind: "lore" },

  // Tools — also panels, separate group for clarity
  { id: "tangle",        label: "Tangle",        icon: "knot",     group: "tools",    kind: "panel", panelKind: "tangle" },
  { id: "speedReader",   label: "Speed Reader",  icon: "eye",      group: "tools",    kind: "panel", panelKind: "speedReader" },
  { id: "references",    label: "References",    icon: "paper",    group: "tools",    kind: "panel", entity: "references", panelKind: "references" },

  // Utilities — review queue & friends, demoted at bottom
  { id: "review",        label: "Review Queue",     icon: "bell",    group: "utilities", kind: "utility", panelKind: "review" },
  { id: "today-pulse",   label: "Today Suggestions",icon: "sparkle", group: "utilities", kind: "utility", panelKind: "today" },
  { id: "recent",        label: "Recent",           icon: "clock",   group: "utilities", kind: "utility", panelKind: "recent" },
  { id: "refs",          label: "Active References",icon: "paper",   group: "utilities", kind: "utility", panelKind: "refs" },
  { id: "notifs",        label: "Notifications",    icon: "warn",    group: "utilities", kind: "utility", panelKind: "notifs" },
  { id: "trash",         label: "Trash",            icon: "trash",   group: "utilities", kind: "utility", panelKind: "trash" },

  // System — true routes (settings is a route, not a panel)
  { id: "settings",      label: "Settings",      icon: "gear",     group: "system",   kind: "route" },
];

Object.assign(window, { BRAND, ENTITY_TYPES, CONFIDENCE, NAV_ITEMS });
