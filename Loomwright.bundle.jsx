// === Loomwright bundled (single compile unit) ===

// ----- brand.jsx -----
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
const NAV_ITEMS = [
  // Routes — full-screen workspace views
  { id: "home",          label: "Home",          icon: "home",     group: "routes", kind: "route" },
  { id: "today",         label: "Today",         icon: "sun",      group: "routes", kind: "route", queue: 4 },
  { id: "writers-room",  label: "Writer's Room", icon: "feather",  group: "routes", kind: "route", queue: 12 },

  // Panels — entity tabs that dock into the stack
  { id: "cast",          label: "Cast",          icon: "user",     group: "entities", kind: "panel", entity: "cast",          panelKind: "cast",          queue: 3 },
  { id: "bestiary",      label: "Bestiary",      icon: "claw",     group: "entities", kind: "panel", entity: "bestiary",      panelKind: "bestiary",      queue: 1 },
  { id: "atlas",         label: "Atlas",         icon: "compass",  group: "entities", kind: "panel", entity: "atlas",         panelKind: "atlas" },
  { id: "locations",     label: "Locations",     icon: "pin",      group: "entities", kind: "panel", entity: "locations",     panelKind: "locations",     queue: 2 },
  { id: "items",         label: "Items",         icon: "gem",      group: "entities", kind: "panel", entity: "items",         panelKind: "items" },
  { id: "classes",       label: "Classes",       icon: "shield",   group: "entities", kind: "panel", entity: "classes",       panelKind: "classes" },
  { id: "races",         label: "Races",         icon: "branch",   group: "entities", kind: "panel", entity: "races",         panelKind: "races" },
  { id: "stats",         label: "Stats",         icon: "bars",     group: "entities", kind: "panel", entity: "stats",         panelKind: "stats" },
  { id: "abilities",     label: "Abilities",     icon: "spark",    group: "entities", kind: "panel", entity: "abilities",     panelKind: "abilities",     queue: 5 },
  { id: "skillTrees",    label: "Skill Trees",   icon: "tree",     group: "entities", kind: "panel", entity: "skillTrees",    panelKind: "skillTrees" },
  { id: "relationships", label: "Relationships", icon: "link",     group: "entities", kind: "panel", entity: "relationships", panelKind: "relationships" },
  { id: "quests",        label: "Quests",        icon: "scroll",   group: "entities", kind: "panel", entity: "quests",        panelKind: "quests",        queue: 2 },
  { id: "events",        label: "Events",        icon: "bolt",     group: "entities", kind: "panel", entity: "events",        panelKind: "events" },
  { id: "timeline",      label: "Timeline",      icon: "clock",    group: "entities", kind: "panel", entity: "timeline",      panelKind: "timeline" },
  { id: "lore",          label: "Lore / Canon",  icon: "book",     group: "entities", kind: "panel", entity: "lore",          panelKind: "lore",          queue: 7 },

  // Tools — also panels, separate group for clarity
  { id: "tangle",        label: "Tangle",        icon: "knot",     group: "tools",    kind: "panel", panelKind: "tangle", soon: true },
  { id: "speedReader",   label: "Speed Reader",  icon: "eye",      group: "tools",    kind: "panel", panelKind: "speedReader" },
  { id: "references",    label: "References",    icon: "paper",    group: "tools",    kind: "panel", entity: "references", panelKind: "references" },

  // Utilities — review queue & friends, demoted at bottom
  { id: "review",        label: "Review Queue",     icon: "bell",    group: "utilities", kind: "utility", panelKind: "review" },
  { id: "today-pulse",   label: "Today Suggestions",icon: "sparkle", group: "utilities", kind: "utility", panelKind: "today",  queue: 4 },
  { id: "recent",        label: "Recent",           icon: "clock",   group: "utilities", kind: "utility", panelKind: "recent" },
  { id: "refs",          label: "Active References",icon: "paper",   group: "utilities", kind: "utility", panelKind: "refs" },
  { id: "notifs",        label: "Notifications",    icon: "warn",    group: "utilities", kind: "utility", panelKind: "notifs" },
  { id: "trash",         label: "Trash",            icon: "trash",   group: "utilities", kind: "utility", panelKind: "trash" },

  // System — true routes (settings is a route, not a panel)
  { id: "settings",      label: "Settings",      icon: "gear",     group: "system",   kind: "route" },
];

Object.assign(window, { BRAND, ENTITY_TYPES, CONFIDENCE, NAV_ITEMS });


// ----- icons.jsx -----
// =====================================================================
// icons.jsx — Tiny stroke-based icon set (16px viewBox).
// All icons accept size + className. Stroke uses currentColor.
// =====================================================================

const Icon = ({ name, size = 16, className = "", strokeWidth = 1.5, ...rest }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 16 16",
    fill: "none", stroke: "currentColor",
    strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
    className: "icon-svg " + className,
    ...rest,
  };
  switch (name) {
    case "home":     return <svg {...props}><path d="M2.5 7.5 8 2.5l5.5 5M3.5 7v6.5h9V7"/><path d="M6.5 13.5V10h3v3.5"/></svg>;
    case "sun":      return <svg {...props}><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M3.3 12.7l1-1M11.7 4.3l1-1"/></svg>;
    case "feather":  return <svg {...props}><path d="M13 2c-3 0-7 2-9 5-1.5 2.3-1 5 0 6 1 1 3.7 1.5 6-.5 3-2 5-6 5-9l-1 1c-1.5 0-3.5.5-5 2s-2.5 3-2.5 4.5"/><path d="M3 13l4-4"/></svg>;
    case "user":     return <svg {...props}><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c.5-2.5 2.5-4 5-4s4.5 1.5 5 4"/></svg>;
    case "claw":     return <svg {...props}><path d="M3 3c1.5 4 4 7 8 8M5 3c.5 3.5 3 6.5 7 7.5M7 3c0 3 2 5.5 5 6.5"/><path d="M2 13.5l3-1.5M2.5 11l2.5-1"/></svg>;
    case "compass":  return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="m10.5 5.5-3 1.5-1 3 3-1.5 1-3z"/></svg>;
    case "pin":      return <svg {...props}><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.5"/></svg>;
    case "gem":      return <svg {...props}><path d="m8 2 4 3.5-4 8.5-4-8.5L8 2z"/><path d="M4 5.5h8M8 2v12"/></svg>;
    case "shield":   return <svg {...props}><path d="M8 1.5 3 3.5v4c0 3 2.2 5.5 5 7 2.8-1.5 5-4 5-7v-4L8 1.5z"/></svg>;
    case "branch":   return <svg {...props}><path d="M8 14V4M8 4 5 1.5M8 4l3-2.5M8 8 5 6M8 10l3-2"/></svg>;
    case "bars":     return <svg {...props}><path d="M3 13V9M7 13V5M11 13V7"/></svg>;
    case "spark":    return <svg {...props}><path d="M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2.5 2.5M9.5 9.5 12 12M4 12l2.5-2.5M9.5 6.5 12 4"/></svg>;
    case "tree":     return <svg {...props}><circle cx="8" cy="3" r="1.5"/><circle cx="3.5" cy="8" r="1.5"/><circle cx="12.5" cy="8" r="1.5"/><circle cx="6" cy="13" r="1.5"/><circle cx="10" cy="13" r="1.5"/><path d="M8 4.5v3M8 7.5l-3 .5M8 7.5l3 .5M5 9.5l1 2M11 9.5l-1 2"/></svg>;
    case "link":     return <svg {...props}><path d="M6.5 9.5 4.5 11.5a2.1 2.1 0 1 1-3-3l2-2M9.5 6.5l2-2a2.1 2.1 0 1 1 3 3l-2 2M6 10l4-4"/></svg>;
    case "scroll":   return <svg {...props}><path d="M3 3.5h7.5v9c0 .8-.7 1.5-1.5 1.5H4M10.5 3.5c.8 0 1.5.7 1.5 1.5v1H3"/><path d="M5.5 6.5h3M5.5 9h3"/></svg>;
    case "bolt":     return <svg {...props}><path d="M9 1.5 3.5 9h4l-1 5.5L12 7H8l1-5.5z"/></svg>;
    case "clock":    return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>;
    case "book":     return <svg {...props}><path d="M3 3.5C5 3 7 3 8 4c1-1 3-1 5-.5v9c-2-.5-4-.5-5 .5-1-1-3-1-5-.5v-9z"/><path d="M8 4v9"/></svg>;
    case "knot":     return <svg {...props}><path d="M3 5c2 0 3 2 5 2s3-2 5-2-1 5-3 5-3-3-5-3-5 5-3 5 3-5 5-5 3 5 5 5"/></svg>;
    case "eye":      return <svg {...props}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>;
    case "paper":    return <svg {...props}><path d="M4 1.5h5l3 3v10H4v-13z"/><path d="M9 1.5v3h3M6 7.5h4M6 10h4M6 12.5h2.5"/></svg>;
    case "trash":    return <svg {...props}><path d="M3 4.5h10M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-9"/><path d="M7 7v5M9 7v5"/></svg>;
    case "gear":     return <svg {...props}><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6 3.4 3.4"/></svg>;
    case "search":   return <svg {...props}><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>;
    case "filter":   return <svg {...props}><path d="M2.5 3.5h11l-4 5v4l-3 1.5v-5.5l-4-5z"/></svg>;
    case "sort":     return <svg {...props}><path d="M4 3v10M4 13l-2-2M4 13l2-2M12 13V3M12 3l-2 2M12 3l2 2"/></svg>;
    case "pin-tack": return <svg {...props}><path d="M9 1.5 14.5 7l-2 1-1.5 1.5-1 4.5-3-3-3.5 3.5L4 14l3.5-3.5-3-3 4.5-1L10.5 5l1-2-2.5-1.5z"/></svg>;
    case "expand":   return <svg {...props}><path d="M3 6.5V3h3.5M13 6.5V3H9.5M3 9.5V13h3.5M13 9.5V13H9.5"/></svg>;
    case "close":    return <svg {...props}><path d="m4 4 8 8M12 4l-8 8"/></svg>;
    case "more":     return <svg {...props}><circle cx="3.5" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="12.5" cy="8" r=".8"/></svg>;
    case "menu":     return <svg {...props}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/></svg>;
    case "panel-left":return <svg {...props}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M6 3v10"/></svg>;
    case "panel-right":return <svg {...props}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M10 3v10"/></svg>;
    case "chevron-r":return <svg {...props}><path d="m6 3 4 5-4 5"/></svg>;
    case "chevron-d":return <svg {...props}><path d="m3 6 5 4 5-4"/></svg>;
    case "chevron-up":return <svg {...props}><path d="m3 10 5-4 5 4"/></svg>;
    case "plus":     return <svg {...props}><path d="M8 3v10M3 8h10"/></svg>;
    case "check":    return <svg {...props}><path d="m3 8 3.5 3.5L13 5"/></svg>;
    case "command":  return <svg {...props}><path d="M5 3.5h6v6h-6v-6z"/><path d="M5 3.5a1.5 1.5 0 1 0-1.5 1.5H5M11 3.5a1.5 1.5 0 1 1 1.5 1.5H11M5 9.5a1.5 1.5 0 1 1-1.5 1.5V9.5h1.5zM11 9.5a1.5 1.5 0 1 0 1.5 1.5V9.5H11z"/></svg>;
    case "lock":     return <svg {...props}><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>;
    case "cloud":    return <svg {...props}><path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .3-5.6 4 4 0 0 0-7.7-.4 2.6 2.6 0 0 0 .2 6z"/></svg>;
    case "sparkle":  return <svg {...props}><path d="M5 2.5v3M3.5 4h3M11 9.5v4M9 11.5h4M8 1.5l1.5 4.5L14 7.5l-4.5 1.5L8 13.5l-1.5-4.5L2 7.5l4.5-1.5L8 1.5z"/></svg>;
    case "warn":     return <svg {...props}><path d="M8 2 14.5 13.5h-13L8 2z"/><path d="M8 6.5v3M8 11.5v.5"/></svg>;
    case "bell":     return <svg {...props}><path d="M8 2c-2.5 0-4 1.8-4 4.5 0 3-1.5 4-1.5 4h11s-1.5-1-1.5-4c0-2.7-1.5-4.5-4-4.5z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></svg>;
    case "stack":    return <svg {...props}><path d="m2 5 6-3 6 3-6 3-6-3z"/><path d="m2 8 6 3 6-3M2 11l6 3 6-3"/></svg>;
    case "bookmark": return <svg {...props}><path d="M4 2.5h8v11l-4-2.5-4 2.5v-11z"/></svg>;
    case "drop":     return <svg {...props}><path d="M8 2c2 3 4 5 4 7.5a4 4 0 1 1-8 0C4 7 6 5 8 2z"/></svg>;
    case "wheel":    return <svg {...props}><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/><path d="M8 2v4M8 10v4M2 8h4M10 8h4"/></svg>;
    case "grip":     return <svg {...props}><circle cx="6" cy="4" r="0.9"/><circle cx="10" cy="4" r="0.9"/><circle cx="6" cy="8" r="0.9"/><circle cx="10" cy="8" r="0.9"/><circle cx="6" cy="12" r="0.9"/><circle cx="10" cy="12" r="0.9"/></svg>;
    default:         return <svg {...props}><rect x="3" y="3" width="10" height="10" rx="2"/></svg>;
  }
};

window.Icon = Icon;


// ----- primitives.jsx -----
// =====================================================================
// primitives.jsx — Reusable atoms: BrandMark, badges, chips, buttons,
// EmptyState, LoadingState, ErrorState, ConfirmModal, Tooltip.
// =====================================================================

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ---------------------------------------------------------------------
// BrandMark — swappable logo glyph driven by brand.logoMark
// ---------------------------------------------------------------------
const BrandMark = ({ variant = BRAND.logoMark, size = 28, className = "", short = BRAND.shortName }) => {
  const s = size;
  return (
    <span className={"brand-mark brand-mark--" + variant + " " + className} data-ui="BrandMark" style={{ width: s, height: s }} aria-hidden>
      {variant === "wax-seal" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <defs>
            <radialGradient id="wax" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="var(--accent-soft)"/>
              <stop offset="60%" stopColor="var(--accent)"/>
              <stop offset="100%" stopColor="var(--accent-deep)"/>
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="url(#wax)"/>
          <circle cx="16" cy="16" r="14" fill="none" stroke="var(--accent-deep)" strokeOpacity="0.6"/>
          <circle cx="16" cy="16" r="11" fill="none" stroke="var(--accent-deep)" strokeOpacity="0.45" strokeDasharray="1 2"/>
          <text x="16" y="20" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" fontSize="12" fill="var(--ink-on-accent)">{short}</text>
        </svg>
      )}
      {variant === "loom-glyph" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--accent)"/>
          <path d="M8 9h16M8 16h16M8 23h16M11 6v20M21 6v20" stroke="var(--ink-on-accent)" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )}
      {variant === "quill-thread" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--accent-deep)"/>
          <path d="M22 8c-6 0-12 4-14 10 4 0 10-2 14-10z" fill="var(--accent-soft)" stroke="var(--accent-soft)"/>
          <path d="M8 24c4-2 8-6 14-12" stroke="var(--accent-soft)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      )}
      {variant === "letter-mark" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--accent)"/>
          <text x="16" y="22" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" fontSize="18" fill="var(--ink-on-accent)">{short}</text>
        </svg>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------
// EntityTypeBadge
// ---------------------------------------------------------------------
const EntityTypeBadge = ({ type, size = "sm", showLabel = true, className = "", ...rest }) => {
  const t = ENTITY_TYPES[type];
  if (!t) return null;
  return (
    <span
      className={"e-badge e-badge--" + size + " " + className}
      data-ui="EntityTypeBadge"
      data-entity={type}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
      {...rest}
    >
      <span className="e-badge__dot" aria-hidden>{t.glyph}</span>
      {showLabel && <span className="e-badge__label">{t.label}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------
// ConfidenceBadge — used in review queues only
// ---------------------------------------------------------------------
const ConfidenceBadge = ({ level, value, showRange = false, className = "" }) => {
  const c = CONFIDENCE[level];
  if (!c) return null;
  return (
    <span
      className={"c-badge c-badge--" + level + " " + className}
      data-ui="ConfidenceBadge"
      style={{ "--cc": c.color, "--cs": c.soft, "--cd": c.deep }}
    >
      <span className="c-badge__dot" aria-hidden/>
      <span className="c-badge__label">{value != null ? value + "%" : c.label}</span>
      {showRange && <span className="c-badge__range">{c.range}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------
// ReviewCountBadge
// ---------------------------------------------------------------------
const ReviewCountBadge = ({ count, tone = "default", className = "" }) => {
  if (!count) return null;
  return (
    <span className={"q-badge q-badge--" + tone + " " + className} data-ui="ReviewCountBadge">{count > 99 ? "99+" : count}</span>
  );
};

// ---------------------------------------------------------------------
// PrivacyModeChip — Local Only / Cloud Sync / AI Enabled
// ---------------------------------------------------------------------
const PRIVACY_MODES = {
  local:  { label: "Local Only",  icon: "lock",   tone: "neutral" },
  cloud:  { label: "Cloud Sync",  icon: "cloud",  tone: "info" },
  ai:     { label: "AI Enabled",  icon: "sparkle", tone: "accent" },
};
const PrivacyModeChip = ({ mode = "local", onClick, className = "" }) => {
  const m = PRIVACY_MODES[mode] || PRIVACY_MODES.local;
  return (
    <button
      type="button"
      className={"chip chip--" + m.tone + " " + className}
      data-ui="PrivacyModeChip"
      data-callback="onTogglePrivacyMode"
      data-testid="topbar-privacy-chip"
      onClick={onClick}
      title={"Privacy mode: " + m.label}
    >
      <Icon name={m.icon} size={12}/><span>{m.label}</span>
    </button>
  );
};

// ---------------------------------------------------------------------
// SyncStateChip — Saved / Unsaved / Offline / Syncing / Error
// ---------------------------------------------------------------------
const SYNC_STATES = {
  saved:   { label: "Saved",   tone: "ok",      dot: "static" },
  unsaved: { label: "Unsaved", tone: "warn",    dot: "static" },
  syncing: { label: "Syncing", tone: "info",    dot: "pulse" },
  offline: { label: "Offline", tone: "neutral", dot: "static" },
  error:   { label: "Error",   tone: "danger",  dot: "static" },
};
const SyncStateChip = ({ state = "saved", className = "" }) => {
  const s = SYNC_STATES[state] || SYNC_STATES.saved;
  return (
    <span className={"chip chip--" + s.tone + " " + className} data-ui="SyncStateChip" data-testid="topbar-sync-chip">
      <span className={"chip__dot chip__dot--" + s.dot} aria-hidden/>
      <span>{s.label}</span>
    </span>
  );
};

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------
const Btn = ({ variant = "ghost", size = "md", icon, iconRight, children, className = "", ...rest }) => (
  <button
    type="button"
    className={`btn btn--${variant} btn--${size} ${icon && !children ? "btn--icon" : ""} ${className}`}
    {...rest}
  >
    {icon && <Icon name={icon} size={size === "sm" ? 12 : 14}/>}
    {children && <span className="btn__lbl">{children}</span>}
    {iconRight && <Icon name={iconRight} size={size === "sm" ? 12 : 14}/>}
  </button>
);

// ---------------------------------------------------------------------
// Kbd
// ---------------------------------------------------------------------
const Kbd = ({ children, className = "" }) => <kbd className={"kbd " + className}>{children}</kbd>;

// ---------------------------------------------------------------------
// EmptyState / LoadingState / ErrorState
// ---------------------------------------------------------------------
const EmptyState = ({ icon = "paper", title = "Nothing here yet", body, action, className = "" }) => (
  <div className={"state state--empty " + className} data-ui="EmptyState" role="status">
    <div className="state__icon"><Icon name={icon} size={22}/></div>
    <div className="state__title">{title}</div>
    {body && <div className="state__body">{body}</div>}
    {action && <div className="state__action">{action}</div>}
  </div>
);

const LoadingState = ({ title = "Loading…", lines = 3, className = "" }) => (
  <div className={"state state--loading " + className} data-ui="LoadingState" role="status" aria-live="polite">
    <div className="state__title state__title--muted">{title}</div>
    <div className="skeleton-stack">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: (90 - i * 12) + "%" }}/>
      ))}
    </div>
  </div>
);

const ErrorState = ({ title = "Something didn't load", body, onRetry, className = "" }) => (
  <div className={"state state--error " + className} data-ui="ErrorState" role="alert">
    <div className="state__icon state__icon--danger"><Icon name="warn" size={22}/></div>
    <div className="state__title">{title}</div>
    {body && <div className="state__body">{body}</div>}
    {onRetry && (
      <div className="state__action">
        <Btn variant="ghost" size="sm" icon="bolt" onClick={onRetry} data-callback="onRetry">Try again</Btn>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------
// ConfirmModal — light shell only
// ---------------------------------------------------------------------
const ConfirmModal = ({ open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" data-ui="ConfirmModal" role="dialog" aria-modal="true">
      <div className={"modal modal--" + tone}>
        <div className="modal__title">{title}</div>
        {body && <div className="modal__body">{body}</div>}
        <div className="modal__actions">
          <Btn variant="ghost" onClick={onCancel} data-callback="onCancel">{cancelLabel}</Btn>
          <Btn variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} data-callback="onConfirm">{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  BrandMark, EntityTypeBadge, ConfidenceBadge, ReviewCountBadge,
  PrivacyModeChip, SyncStateChip, Btn, Kbd,
  EmptyState, LoadingState, ErrorState, ConfirmModal,
  PRIVACY_MODES, SYNC_STATES,
});


// ----- tweaks-panel.jsx -----

// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', noDeckControls = false, children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  // Auto-inject a rail toggle when a <deck-stage> is on the page. The
  // toggle drives the deck's per-viewer _railVisible via window message;
  // state is mirrored from the same localStorage key the deck reads so
  // the control reflects reality across reloads. The mechanism is the
  // message — authors who want custom placement can post it directly
  // and pass noDeckControls to suppress this one.
  const hasDeckStage = React.useMemo(
    () => typeof document !== 'undefined' && !!document.querySelector('deck-stage'),
    [],
  );
  // Hide the toggle until the host has actually enabled the rail (the
  // __omelette_rail_enabled window message, posted only when the
  // omelette_deck_rail_enabled flag is on for this user). The initial read
  // covers TweaksPanel mounting after the message already arrived; the
  // listener covers the common case of mounting first.
  const [railEnabled, setRailEnabled] = React.useState(
    () => hasDeckStage && !!document.querySelector('deck-stage')?._railEnabled,
  );
  React.useEffect(() => {
    if (!hasDeckStage || railEnabled) return undefined;
    const onMsg = (e) => {
      if (e.data && e.data.type === '__omelette_rail_enabled') setRailEnabled(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hasDeckStage, railEnabled]);
  const [railVisible, setRailVisible] = React.useState(() => {
    try { return localStorage.getItem('deck-stage.railVisible') !== '0'; } catch (e) { return true; }
  });
  const toggleRail = (on) => {
    setRailVisible(on);
    window.postMessage({ type: '__deck_rail_visible', on }, '*');
  };
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-noncommentable=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
          {hasDeckStage && railEnabled && !noDeckControls && (
            <TweakSection label="Deck">
              <TweakToggle label="Thumbnail rail" value={railVisible} onChange={toggleRail} />
            </TweakSection>
          )}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});


// ----- layout-state.jsx -----
// =====================================================================
// layout-state.jsx — shared layout state hooks and presets
// localStorage-backed; survives reload until Claude Code wires real settings
// =====================================================================

const LAYOUT_STORAGE_KEY = "loomwright.layout.v1";

const LAYOUT_DEFAULTS = {
  // Writer's Room column widths
  leftMarginWidth: 280,
  rightMarginWidth: 320,
  // Margin collapse
  leftMarginCollapsed: false,
  rightMarginCollapsed: false,
  leftMarginPinned: true,
  rightMarginPinned: true,
  leftMarginAutoHide: false,
  rightMarginAutoHide: false,
  // Writing layout mode
  writingLayoutMode: "full",      // full | manuscript-focus | clean | review | notes
  // Workspace layout preset (panels + margins)
  workspaceLayoutPreset: "writing-only",
  // Right-side panel system
  panelsDockMode: "docked",       // docked | floating
};

const LAYOUT_CONSTRAINTS = {
  leftMarginMin: 220,
  leftMarginMax: 420,
  rightMarginMin: 260,
  rightMarginMax: 460,
  manuscriptMin: 520,
};

const WRITING_LAYOUT_MODES = [
  { id: "full",              label: "Full Workspace",   sub: "Margins, manuscript, all visible.", icon: "panel-right" },
  { id: "manuscript-focus",  label: "Manuscript Focus", sub: "Margins collapsed to side rails.",  icon: "feather" },
  { id: "clean",             label: "Clean Writing",    sub: "Hide everything but the page.",     icon: "eye" },
  { id: "review",            label: "Review Mode",      sub: "Manuscript + right review margin.", icon: "bell" },
  { id: "notes",             label: "Notes Mode",       sub: "Manuscript + left notes margin.",   icon: "paper" },
];

const WORKSPACE_LAYOUT_PRESETS = [
  { id: "writing-only",         label: "Writing Only",            panels: [] },
  { id: "writing-reviews",      label: "Writing + Reviews",       panels: ["review"] },
  { id: "writing-cast",         label: "Writing + Cast",          panels: ["cast"] },
  { id: "writing-cast-map",     label: "Writing + Cast + Map",    panels: ["cast", "atlas"] },
  { id: "writing-references",   label: "Writing + References",    panels: ["refs"] },
  { id: "writing-timeline",     label: "Writing + Timeline",      panels: ["timeline"] },
  { id: "custom",               label: "Custom Layout",           panels: null },
];

function readLayout() {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return { ...LAYOUT_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...LAYOUT_DEFAULTS, ...parsed };
  } catch (e) {
    return { ...LAYOUT_DEFAULTS };
  }
}

function writeLayout(state) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* noop */ }
}

const useLayoutState = () => {
  const [state, setState] = React.useState(() => readLayout());

  const setLayout = React.useCallback((patch) => {
    setState((prev) => {
      const next = (typeof patch === "function") ? patch(prev) : { ...prev, ...patch };
      writeLayout(next);
      return next;
    });
  }, []);

  const resetLayout = React.useCallback(() => {
    writeLayout(LAYOUT_DEFAULTS);
    setState({ ...LAYOUT_DEFAULTS });
  }, []);

  return [state, setLayout, resetLayout];
};

Object.assign(window, {
  LAYOUT_DEFAULTS,
  LAYOUT_CONSTRAINTS,
  LAYOUT_STORAGE_KEY,
  WRITING_LAYOUT_MODES,
  WORKSPACE_LAYOUT_PRESETS,
  useLayoutState,
});


// ----- layout-controls.jsx -----
// =====================================================================
// layout-controls.jsx — WritingLayoutMenu + WorkspaceLayoutMenu
// Two compact dropdowns for the writers-room toolbar
// =====================================================================

const { useState: _lc_us, useEffect: _lc_ue, useRef: _lc_ur } = React;

// Generic outside-click closer
function useOutsideClose(ref, onClose) {
  _lc_ue(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, onClose]);
}

// ---------------------------------------------------------------------
// WritingLayoutMenu — picks among full / manuscript-focus / clean / review / notes
// ---------------------------------------------------------------------
const WritingLayoutMenu = ({ value, onChange }) => {
  const [open, setOpen] = _lc_us(false);
  const ref = _lc_ur(null);
  useOutsideClose(ref, () => setOpen(false));
  const current = WRITING_LAYOUT_MODES.find((m) => m.id === value) || WRITING_LAYOUT_MODES[0];
  return (
    <div className="wr-layout-menu" ref={ref} data-ui="WritingLayoutMenu">
      <button
        className="wr-layout-menu__btn"
        onClick={() => setOpen((v) => !v)}
        title="Writing layout"
        data-callback="onChangeWritingLayout"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name={current.icon} size={12}/>
        <span>{current.label}</span>
        <Icon name="chevron-d" size={10}/>
      </button>
      {open && (
        <div className="wr-layout-menu__pop" role="menu">
          <div className="wr-layout-menu__head">Writing layout</div>
          {WRITING_LAYOUT_MODES.map((m) => (
            <button
              key={m.id}
              className={"wr-layout-menu__row " + (m.id === value ? "is-active" : "")}
              onClick={() => { onChange(m.id); setOpen(false); }}
              role="menuitemradio"
              aria-checked={m.id === value}
            >
              <Icon name={m.icon} size={14}/>
              <span style={{ flex: 1 }}>
                <span className="wr-layout-menu__row__title">{m.label}</span>
                <span className="wr-layout-menu__row__sub">{m.sub}</span>
              </span>
              {m.id === value && <Icon name="check" size={12}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// WorkspaceLayoutMenu — preset that opens/closes panels
// ---------------------------------------------------------------------
const WorkspaceLayoutMenu = ({ value, onChange }) => {
  const [open, setOpen] = _lc_us(false);
  const ref = _lc_ur(null);
  useOutsideClose(ref, () => setOpen(false));
  const current = WORKSPACE_LAYOUT_PRESETS.find((p) => p.id === value) || WORKSPACE_LAYOUT_PRESETS[0];
  return (
    <div className="wr-layout-menu" ref={ref} data-ui="WorkspaceLayoutMenu">
      <button
        className="wr-layout-menu__btn"
        onClick={() => setOpen((v) => !v)}
        title="Workspace layout"
        data-callback="onChangeWorkspaceLayout"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="panel-right" size={12}/>
        <span>{current.label}</span>
        <Icon name="chevron-d" size={10}/>
      </button>
      {open && (
        <div className="wr-layout-menu__pop" role="menu" style={{ minWidth: 220 }}>
          <div className="wr-layout-menu__head">Workspace presets</div>
          {WORKSPACE_LAYOUT_PRESETS.map((p) => (
            <button
              key={p.id}
              className={"wr-layout-menu__row " + (p.id === value ? "is-active" : "")}
              onClick={() => { onChange(p.id, p.panels); setOpen(false); }}
              role="menuitemradio"
              aria-checked={p.id === value}
            >
              <Icon name="stack" size={14}/>
              <span style={{ flex: 1 }}>
                <span className="wr-layout-menu__row__title">{p.label}</span>
              </span>
              {p.id === value && <Icon name="check" size={12}/>}
            </button>
          ))}
          <div className="wr-layout-menu__sep"/>
          <button
            className="wr-layout-menu__row"
            onClick={() => { onChange("clear", []); setOpen(false); }}
          >
            <Icon name="close" size={14}/>
            <span style={{ flex: 1 }}>
              <span className="wr-layout-menu__row__title">Close all panels</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// MarginResizer — thin draggable handle for column resize
// ---------------------------------------------------------------------
const MarginResizer = ({ side, value, min, max, onChange }) => {
  const startRef = _lc_ur({ x: 0, w: value });
  const onDown = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, w: value };
    const onMove = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const next = side === "left"
        ? Math.max(min, Math.min(max, startRef.current.w + dx))
        : Math.max(min, Math.min(max, startRef.current.w - dx));
      onChange(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <div
      className="wr-resize"
      data-ui="MarginResizer"
      data-side={side}
      onMouseDown={onDown}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize"
    />
  );
};

// ---------------------------------------------------------------------
// MarginEdgeTab — vertical tab to expand a collapsed margin
// ---------------------------------------------------------------------
const MarginEdgeTab = ({ side, label, count, onClick }) => (
  <button
    className={"wr-margin-tab " + (side === "right" ? "wr-margin-tab--right" : "")}
    onClick={onClick}
    title={label + " — click to expand"}
    data-callback="onExpandMargin"
  >
    {label}{count ? " (" + count + ")" : ""}
  </button>
);

Object.assign(window, { WritingLayoutMenu, WorkspaceLayoutMenu, MarginResizer, MarginEdgeTab });


// ----- shell-parts.jsx -----
// =====================================================================
// shell-parts.jsx — TopBar, LeftRail, RightUtilityRail, BottomStatusStrip
// =====================================================================

const { useState: _useState_sp, useEffect: _useEffect_sp, useRef: _useRef_sp } = React;

// ---------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------
const TopBar = ({
  brand, project, book, view, onSetView, leftRailExpanded, onToggleLeftRail,
  privacyMode, onTogglePrivacyMode,
  syncState,
  globalQueueCount,
  selectedEntity,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenProfile,
  onOpenReviewQueue,
  onSelectProject,
  onSelectBook,
}) => {
  return (
    <header className="topbar" data-ui="TopBar">
      <button
        className="btn btn--ghost btn--icon btn--sm"
        title={leftRailExpanded ? "Collapse rail" : "Expand rail"}
        data-callback="onToggleLeftRail"
        data-testid="topbar-toggle-leftrail"
        onClick={onToggleLeftRail}
      ><Icon name={leftRailExpanded ? "panel-left" : "menu"} size={14}/></button>

      <div className="topbar__brand" title={brand.name + " — " + brand.tagline}>
        <BrandMark variant={brand.logoMark} size={26} short={brand.shortName}/>
        <div className="topbar__brand-text">
          <div className="topbar__brand-name">{brand.name}</div>
          <div className="topbar__brand-tag">{brand.tagline}</div>
        </div>
      </div>

      <div className="topbar__divider"/>

      <button className="topbar__selector" data-callback="onSelectProject" onClick={onSelectProject} title="Switch project">
        <Icon name="stack" size={13}/>
        <span>{project.name}</span>
        <Icon name="chevron-d" size={11}/>
      </button>
      <button className="topbar__selector" data-callback="onSelectBook" onClick={onSelectBook} title="Switch manuscript">
        <Icon name="book" size={13}/>
        <span>{project.book}<span className="topbar__selector__sub"> · MS</span></span>
        <Icon name="chevron-d" size={11}/>
      </button>

      <div className="topbar__spacer"/>

      <button
        className="topbar__search"
        data-callback="onOpenCommandPalette"
        data-testid="topbar-search"
        onClick={onOpenCommandPalette}
        title="Open command palette"
      >
        <Icon name="search" size={13}/>
        <span className="topbar__search__lbl">Search entities, chapters, commands…</span>
        <span style={{ display: "flex", gap: 3 }}><Kbd>⌘</Kbd><Kbd>P</Kbd></span>
      </button>

      <div className="topbar__spacer"/>

      <div className="view-tabs" role="tablist" aria-label="View">
        <button className={"view-tabs__btn " + (view === "shell" ? "is-active" : "")} onClick={() => onSetView("shell")} role="tab">Shell</button>
        <button className={"view-tabs__btn " + (view === "system" ? "is-active" : "")} onClick={() => onSetView("system")} role="tab">Design System</button>
      </div>

      <div className="topbar__right">
        {selectedEntity && (
          <div className="topbar__entity-context" title="Current selected entity">
            <EntityTypeBadge type={selectedEntity.type} size="xs" showLabel={false}/>
            <span>{selectedEntity.label}</span>
          </div>
        )}
        <PrivacyModeChip mode={privacyMode} onClick={onTogglePrivacyMode}/>
        <SyncStateChip state={syncState}/>
        <button
          className="topbar__queue-pill"
          data-callback="onOpenReviewQueue"
          data-testid="topbar-review-queue"
          onClick={onOpenReviewQueue}
          title="Global review queue"
        >
          <Icon name="bell" size={12}/>
          <span>Queue</span>
          {globalQueueCount > 0 && <ReviewCountBadge count={globalQueueCount}/>}
        </button>
        <Btn variant="ghost" size="sm" icon="gear" onClick={onOpenSettings} data-callback="onOpenSettings" data-testid="topbar-settings" title="Settings"/>
        <button
          className="topbar__avatar"
          data-callback="onOpenProfile"
          data-testid="topbar-profile"
          onClick={onOpenProfile}
          title={brand.project?.author || "Author"}
        >EM</button>
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------
// LeftRailItem
//
// Three kinds of items:
//   - route   : navigates the workspace (full screen). Active when routeId matches.
//   - panel   : toggles a side panel. "Open" indicator + pinned indicator.
//   - utility : same as panel, demoted styling.
//
// Click rules:
//   - route:  single-click navigates
//   - panel:  single-click toggles open/close; cmd-click pins
//   - utility: same as panel
// ---------------------------------------------------------------------
const LeftRailItem = ({
  item, expanded, active, open, pinned, dropTarget,
  onActivate, onShowTooltip, onHideTooltip, onContextMenu,
}) => {
  const queue = item.queue || 0;
  const disabled = !!item.soon;
  const isRoute = item.kind === "route";
  const className = [
    "leftrail__item",
    "leftrail__item--" + (item.kind || "route"),
    active && "is-active",
    open && !active && "is-open",
    pinned && "is-pinned",
    disabled && "is-disabled",
    dropTarget && "is-drop-target",
  ].filter(Boolean).join(" ");

  const ref = _useRef_sp(null);

  const handleEnter = () => {
    if (expanded) return;
    if (!ref.current || !onShowTooltip) return;
    const r = ref.current.getBoundingClientRect();
    onShowTooltip({ x: r.right + 8, y: r.top + r.height / 2, label: item.label, queue, kind: item.kind, open, pinned });
  };

  return (
    <div
      ref={ref}
      className={className}
      data-ui="LeftRailItem"
      data-callback="onActivateTab"
      data-testid={"leftrail-" + item.id}
      data-tab={item.id}
      data-kind={item.kind}
      role="tab"
      aria-selected={active || open}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => {
        if (disabled) return;
        onActivate && onActivate(item, { meta: e.metaKey || e.ctrlKey });
      }}
      onContextMenu={(e) => {
        if (disabled) return;
        e.preventDefault();
        onContextMenu && onContextMenu(item, { x: e.clientX, y: e.clientY });
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={onHideTooltip}
      onFocus={handleEnter}
      onBlur={onHideTooltip}
    >
      <span className="leftrail__item__icon">
        {item.entity
          ? <span className="e-dot" style={{ "--ec": ENTITY_TYPES[item.entity]?.color }}/>
          : <Icon name={item.icon} size={14}/>}
      </span>
      <span className="leftrail__item__lbl">{item.label}</span>
      {!isRoute && open && expanded && (
        <span className="leftrail__item__open" title={pinned ? "Pinned panel" : "Open panel"} aria-label="Open">
          {pinned ? <Icon name="pin-tack" size={10}/> : <span className="leftrail__item__opendot"/>}
        </span>
      )}
      {item.soon && expanded && <span className="leftrail__soon">Soon</span>}
      {!item.soon && queue > 0 && expanded && <ReviewCountBadge count={queue}/>}
      {!item.soon && queue > 0 && !expanded && (
        <span className="leftrail__item__queue-collapsed">{queue > 9 ? "9+" : queue}</span>
      )}
      {!isRoute && open && !expanded && (
        <span className="leftrail__item__opendot leftrail__item__opendot--collapsed" data-pinned={pinned ? "true" : "false"}/>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// LeftRail
//
// Three sections, visually distinct:
//   1. Routes — Home, Today, Writer's Room (full-screen workspaces)
//   2. Panels — Entities + Tools (open as docked side-panels)
//   3. Utilities — Review queue, Today suggestions, Recent, etc. (also panels,
//                  but demoted to a quieter footer area)
//
// `openPanelKinds` is a Set of panelKind strings currently open in the stack.
// `pinnedPanelKinds` is a Set of panelKind strings currently pinned.
// `activeRouteId` is the current full-screen route.
// ---------------------------------------------------------------------
const LeftRail = ({
  items, activeRouteId, expanded, dropTargetId,
  openPanelKinds, pinnedPanelKinds,
  onActivateItem, onTabContextMenu,
}) => {
  const [tooltip, setTooltip] = _useState_sp(null);

  // Three section meta — "Tools" rolls into the Panels section visually,
  // separated by a thin divider, so users see "everything you can dock"
  // as one functional group.
  const sections = [
    { id: "routes",    label: "Workspace",  className: "leftrail__sec--routes" },
    { id: "panels",    label: "Panels",     className: "leftrail__sec--panels", subgroups: [
      { id: "entities", label: null },
      { id: "tools",    label: "Tools" },
    ] },
    { id: "utilities", label: "Utilities",  className: "leftrail__sec--utilities" },
    { id: "system",    label: null,         className: "leftrail__sec--system" },
  ];

  const renderItem = (item) => (
    <LeftRailItem
      key={item.id}
      item={item}
      expanded={expanded}
      active={item.kind === "route" && activeRouteId === item.id}
      open={item.kind !== "route" && openPanelKinds && openPanelKinds.has(item.panelKind || item.id)}
      pinned={item.kind !== "route" && pinnedPanelKinds && pinnedPanelKinds.has(item.panelKind || item.id)}
      dropTarget={dropTargetId === item.id}
      onActivate={onActivateItem}
      onContextMenu={onTabContextMenu}
      onShowTooltip={setTooltip}
      onHideTooltip={() => setTooltip(null)}
    />
  );

  return (
    <nav className="leftrail" data-ui="LeftRail" aria-label="Primary">
      {sections.map((sec) => {
        let groupItems;
        if (sec.id === "panels") {
          // Panels section spans entities + tools subgroups
          const ents  = items.filter((i) => i.group === "entities");
          const tools = items.filter((i) => i.group === "tools");
          if (!ents.length && !tools.length) return null;
          return (
            <div key={sec.id} className={"leftrail__group " + sec.className}>
              {sec.label && expanded && <div className="leftrail__group-label">{sec.label}</div>}
              {ents.map(renderItem)}
              {tools.length > 0 && (
                <>
                  {expanded && <div className="leftrail__subgroup-label">Tools</div>}
                  {!expanded && <div className="leftrail__divider"/>}
                  {tools.map(renderItem)}
                </>
              )}
            </div>
          );
        }
        groupItems = items.filter((i) => i.group === sec.id);
        if (!groupItems.length) return null;
        const isFooter = sec.id === "system" || sec.id === "utilities";
        return (
          <div key={sec.id} className={"leftrail__group " + sec.className + (isFooter ? " leftrail__footer-group" : "")}>
            {sec.label && expanded && <div className="leftrail__group-label">{sec.label}</div>}
            {groupItems.map(renderItem)}
          </div>
        );
      })}
      {tooltip && !expanded && (
        <div
          className="lr-tooltip"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translateY(-50%)" }}
        >
          <span>{tooltip.label}</span>
          {tooltip.kind && tooltip.kind !== "route" && tooltip.open && (
            <span className="lr-tooltip__chip">{tooltip.pinned ? "Pinned" : "Open"}</span>
          )}
          {tooltip.queue > 0 && <ReviewCountBadge count={tooltip.queue}/>}
        </div>
      )}
    </nav>
  );
};

// ---------------------------------------------------------------------
// RightUtilityRail — DEPRECATED. Utilities now live in the LeftRail
// "Utilities" section. Kept as a no-op for backwards compat.
// ---------------------------------------------------------------------
const RightUtilityRail_DEPRECATED = ({ expanded, queues, onOpenPanel, onOpenReviewQueue, onToggleExpanded }) => {
  const buttons = [
    { id: "review",     icon: "bell",     label: "Review Queues",      badge: queues.review,   panel: "review" },
    { id: "today",      icon: "sparkle",  label: "Today Suggestions",  badge: queues.today,    panel: "today" },
    { id: "recent",     icon: "clock",    label: "Recent Entities",    panel: "recent" },
    { id: "refs",       icon: "paper",    label: "Active References", panel: "refs" },
    { id: "trash",      icon: "trash",    label: "Trash",              panel: "trash" },
    { id: "notifs",     icon: "warn",     label: "Notifications",      badge: queues.notifs,   panel: "notifs" },
  ];

  if (!expanded) {
    return (
      <aside className="rightrail" data-ui="RightUtilityRail" aria-label="Utilities">
        <button
          className="rightrail__btn"
          title="Expand utilities"
          onClick={onToggleExpanded}
          data-testid="rightrail-expand"
        ><Icon name="panel-right" size={14}/></button>
        {buttons.map((b) => (
          <button
            key={b.id}
            className="rightrail__btn"
            title={b.label}
            onClick={() => onOpenPanel(b.panel, { from: "rightrail" })}
            data-callback="onOpenPanel"
            data-testid={"rightrail-" + b.id}
          >
            <Icon name={b.icon} size={15}/>
            {b.badge > 0 && <span className="rightrail__btn__badge">{b.badge > 9 ? "9+" : b.badge}</span>}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="rightrail" data-ui="RightUtilityRail" aria-label="Utilities">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "var(--fs-3xs)", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-4)", fontWeight: 600 }}>Utilities</span>
        <button className="rightrail__btn" style={{ width: 24, height: 24 }} title="Collapse" onClick={onToggleExpanded}><Icon name="close" size={12}/></button>
      </div>
      <div className="rightrail__cards">
        <div className="rightrail__card">
          <div className="rightrail__card__head">
            <Icon name="bell" size={12}/> Review Queue
            <ReviewCountBadge count={queues.review}/>
          </div>
          <div className="rightrail__card__row">
            <ConfidenceBadge level="strong" value={88}/>
            <span style={{ fontSize: "var(--fs-xs)" }}>New character: Saren</span>
          </div>
          <div className="rightrail__card__row">
            <ConfidenceBadge level="uncertain" value={62}/>
            <span style={{ fontSize: "var(--fs-xs)" }}>Location merge?</span>
          </div>
          <div className="rightrail__card__row">
            <ConfidenceBadge level="weak" value={42}/>
            <span style={{ fontSize: "var(--fs-xs)" }}>Quest tag review</span>
          </div>
        </div>
        <div className="rightrail__card">
          <div className="rightrail__card__head"><Icon name="sparkle" size={12}/> Today</div>
          <div className="rightrail__card__row" style={{ fontSize: "var(--fs-xs)" }}>3 chapters drafted</div>
          <div className="rightrail__card__row" style={{ fontSize: "var(--fs-xs)" }}>1 unresolved thread</div>
        </div>
        <div className="rightrail__card">
          <div className="rightrail__card__head"><Icon name="clock" size={12}/> Recent</div>
          <div className="rightrail__card__row"><EntityTypeBadge type="cast" size="xs"/><span style={{ fontSize: "var(--fs-xs)" }}>Aelinor Vey</span></div>
          <div className="rightrail__card__row"><EntityTypeBadge type="locations" size="xs"/><span style={{ fontSize: "var(--fs-xs)" }}>Pale Reach</span></div>
          <div className="rightrail__card__row"><EntityTypeBadge type="items" size="xs"/><span style={{ fontSize: "var(--fs-xs)" }}>Auger of Hess</span></div>
        </div>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// BottomStatusStrip
// ---------------------------------------------------------------------
const BottomStatusStrip = ({
  mode = "Manuscript",
  lastSavedAt = "just now",
  isLocal = false,
  wordCount = 0,
  reviewQueueCount = 0,
  activeAuthor = "E. Marlowe",
  extractionState = "idle",
  canvasZoom = null,
}) => {
  const extractionLabels = { idle: "Idle", running: "Extracting…", deep: "Deep extract…", error: "Error" };
  const extractionTone = { idle: "var(--ink-3)", running: "#3e6db5", deep: "#7a6aa3", error: "#a84a3a" };
  return (
    <footer className="statusbar" data-ui="BottomStatusStrip" role="contentinfo">
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">MODE</span>
        <span className="statusbar__seg__val">{mode}</span>
      </div>
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">SAVED</span>
        <span className="statusbar__seg__val">{lastSavedAt}</span>
      </div>
      <div className="statusbar__seg" style={{ color: isLocal ? "#5e3415" : "#2c5a2a" }}>
        <span className="statusbar__seg__dot"/>
        <span className="statusbar__seg__val">{isLocal ? "Offline" : "Online"}</span>
      </div>
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">WORDS</span>
        <span className="statusbar__seg__val">{wordCount.toLocaleString()}</span>
      </div>
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">QUEUE</span>
        <span className="statusbar__seg__val">{reviewQueueCount}</span>
      </div>
      <div className="statusbar__spacer"/>
      <div className="statusbar__seg" style={{ color: extractionTone[extractionState] }}>
        <span className="statusbar__seg__dot"/>
        <span className="statusbar__seg__val">{extractionLabels[extractionState] || "—"}</span>
      </div>
      {canvasZoom != null && (
        <div className="statusbar__seg">
          <span className="statusbar__seg__lbl">ZOOM</span>
          <span className="statusbar__seg__val">{Math.round(canvasZoom * 100)}%</span>
        </div>
      )}
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">AUTHOR</span>
        <span className="statusbar__seg__val">{activeAuthor}</span>
      </div>
    </footer>
  );
};

// Backwards-compat shim: export a no-op RightUtilityRail so existing imports don't crash.
const RightUtilityRail = () => null;

Object.assign(window, { TopBar, LeftRail, LeftRailItem, RightUtilityRail, BottomStatusStrip });


// ----- entity-data.jsx -----
// =====================================================================
// entity-data.jsx — sample entities used by panels for non-cast tabs.
// Realistic placeholder data only; mirrors the entity object shape
// documented in ENTITY_FRAMEWORK_HOOKUP.md.
// =====================================================================

const ENTITY_SAMPLES = {
  bestiary: [
    { id: "b1", type: "bestiary", name: "Salt-wraith", glyphChar: "Sw", status: "active",
      subtitle: "Wind-borne predator of the Reach",
      summary: "A pale, ribbon-bodied predator that rides salt squalls down off the Auger Cliffs.",
      aliases: ["the white ribbon"], chapterRange: "Ch. 2–6",
      mentionsByChapter: [0, 4, 2, 0, 3, 6, 0, 0, 0, 0, 0, 0],
      fields: [{ k: "Habitat", v: "Pale Reach littoral" }, { k: "Diet", v: "Carrion, gulls" }, { k: "Threat", v: "Solitary; lethal in fog" }],
      related: [{ id:"a1", type:"locations", name:"Pale Reach" }, { id:"l1", type:"lore", name:"Auger Wake" }],
      mentions: [
        { id: "m1", excerpt: "It came in on the salt — a long pale thing the gulls would not call to.", cite: "Ch. 2, p. 41" },
        { id: "m2", excerpt: "The Salt-wraith took the second auger-bearer before he made the cliff path.", cite: "Ch. 6, p. 162" },
      ],
      warnings: ["Mentioned in Ch. 6 but not yet keyed to Atlas"],
      recent: [{ when: "Today", what: "Notes edited" }],
    },
    { id: "b2", type: "bestiary", name: "Vraska boar", glyphChar: "Vb", status: "active",
      subtitle: "Pass-dwelling tusker", chapterRange: "Ch. 4–4", queue: 1,
      mentionsByChapter: [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0], summary: "Reclusive winter boar of the Vraska Pass." },
    { id: "b3", type: "bestiary", name: "Hess gull", glyphChar: "Hg", status: "archived",
      subtitle: "Common shore gull", chapterRange: "Ch. 1–7",
      mentionsByChapter: [3,2,1,2,1,4,2,0,0,0,0,0], summary: "Plentiful; mostly background fauna." },
  ],
  locations: [
    { id: "a1", type: "locations", name: "Pale Reach", glyphChar: "PR", status: "active",
      subtitle: "Coastal queendom",
      summary: "A salt-bleached coastal kingdom; seat of House Vey. Frames Acts I–III.",
      chapterRange: "Ch. 1–7", queue: 2,
      mentionsByChapter: [12, 8, 5, 9, 4, 11, 7, 0, 0, 0, 0, 0],
      fields: [{ k: "Region", v: "Northern coast" }, { k: "Climate", v: "Salt-cold, fogged" }, { k: "Ruler", v: "Aelinor Vey" }],
      related: [{ id:"c1", type:"cast", name:"Aelinor Vey" }, { id:"f1", type:"factions", name:"House Vey" }, { id:"a2", type:"locations", name:"Vraska Pass" }],
      mentions: [
        { id:"m3", excerpt: "Pale Reach taught patience the way the sea taught salt.", cite:"Ch. 1, p. 14" },
        { id:"m4", excerpt: "From the Reach the Pass looked like a ledger half-closed.", cite:"Ch. 4, p. 91" },
      ],
      linkedChapters: [{ id:"ch1", label:"Ch. 1 — The Auger Wake" }, { id:"ch4", label:"Ch. 4 — Pass" }, { id:"ch7", label:"Ch. 7 — Salt" }],
      notes: "Consider whether the Reach's eastern beaches need their own sub-entry by Act III.",
    },
    { id: "a2", type: "locations", name: "Vraska Pass", glyphChar: "Vp", status: "active",
      subtitle: "Mountain pass between houses", chapterRange: "Ch. 4–6",
      mentionsByChapter: [0,0,0,5,2,3,0,0,0,0,0,0] },
    { id: "a3", type: "locations", name: "Glass Court", glyphChar: "Gc", status: "active",
      subtitle: "Hess audience hall", chapterRange: "Ch. 3–7", queue: 1,
      mentionsByChapter: [0,0,2,1,0,1,3,0,0,0,0,0] },
  ],
  items: [
    { id: "i1", type: "items", name: "Bone Auger", glyphChar: "Ba", status: "active",
      subtitle: "Inherited regalia weapon",
      summary: "A drilling-blade tool turned heirloom; central to the Ch. 1 wake and Ch. 7 break.",
      chapterRange: "Ch. 1–7", queue: 1,
      mentionsByChapter: [4,2,0,1,0,1,3,0,0,0,0,0],
      fields: [{ k: "Origin", v: "Pre-Vey" }, { k: "Material", v: "Whale-bone, salt-iron" }],
      related: [{ id:"c1", type:"cast", name:"Aelinor Vey" }, { id:"l2", type:"lore", name:"Auger rite" }],
      mentions: [{ id:"m5", excerpt:"\"Bring me the auger,\" Aelinor said, \"and the man who carries it.\"", cite:"Ch. 7, p. 188" }],
    },
    { id: "i2", type: "items", name: "Vey Signet", glyphChar: "Vs", status: "active",
      subtitle: "Worn since coronation", chapterRange: "Ch. 1–7",
      mentionsByChapter: [3,1,2,1,1,2,2,0,0,0,0,0] },
  ],
  classes: [
    { id: "cl1", type: "classes", name: "Salt-bearer", glyphChar: "Sb", status: "active",
      subtitle: "Pale Reach functionary class",
      summary: "Officials trained to walk the salted causeways without harm.",
      chapterRange: "Ch. 2–7", mentionsByChapter: [0,3,1,0,2,1,2,0,0,0,0,0] },
    { id: "cl2", type: "classes", name: "Auger-keeper", glyphChar: "Ak", status: "active",
      subtitle: "Bears the Bone Auger", chapterRange: "Ch. 1–7", queue: 1,
      mentionsByChapter: [2,0,0,0,0,0,2,0,0,0,0,0] },
  ],
  races: [
    { id: "r1", type: "races", name: "Reach-folk", glyphChar: "Rf", status: "active",
      subtitle: "Salt-cold coastal people",
      summary: "Hardy people of the Pale Reach; weather-tested, plain-spoken.",
      chapterRange: "Ch. 1–7", mentionsByChapter: [3,1,2,1,1,2,1,0,0,0,0,0] },
    { id: "r2", type: "races", name: "Hess-born", glyphChar: "Hb", status: "active",
      subtitle: "Of House Hess and the Glass Court", chapterRange: "Ch. 3–7",
      mentionsByChapter: [0,0,2,0,0,0,2,0,0,0,0,0] },
  ],
  stats: [
    { id: "s1", type: "stats", name: "Resolve", glyphChar: "Re", status: "active",
      subtitle: "How long a will holds in the cold", chapterRange: "Ch. 1–7",
      summary: "Used in Cast and Faction sheets; gates several Ch. 7 outcomes." },
    { id: "s2", type: "stats", name: "Cunning", glyphChar: "Cu", status: "active",
      subtitle: "Reading the room before it is read", chapterRange: "Ch. 1–7" },
    { id: "s3", type: "stats", name: "Compassion", glyphChar: "Co", status: "active",
      subtitle: "Choosing kindness when costly", chapterRange: "Ch. 1–7" },
  ],
  abilities: [
    { id: "ab1", type: "abilities", name: "Court tongue", glyphChar: "Ct", status: "active",
      subtitle: "Read a room before a room knows it is read",
      summary: "A learned ability; assigned to several House-trained characters.",
      chapterRange: "Ch. 1, 3, 7" },
    { id: "ab2", type: "abilities", name: "Letter-locking", glyphChar: "Ll", status: "active",
      subtitle: "Folds papers no eye but the recipient may open whole", chapterRange: "Ch. 5", queue: 1 },
  ],
  skills: [
    { id: "sk1", type: "skills", name: "Diplomacy tree", glyphChar: "Di", status: "active",
      subtitle: "Listen → Hold the floor → Bind a treaty",
      summary: "Used by Aelinor; partial overlap with Statecraft.", chapterRange: "Ch. 1–7" },
    { id: "sk2", type: "skills", name: "Statecraft tree", glyphChar: "St", status: "active",
      subtitle: "Read the ledger → Spend the granary", chapterRange: "Ch. 2–7" },
  ],
  quests: [
    { id: "q1", type: "quests", name: "The Auger Wake", glyphChar: "Aw", status: "active",
      subtitle: "Active — Acts I–III",
      summary: "The funeral-rite that opens the manuscript and seeds every later break.",
      chapterRange: "Ch. 1–7", queue: 2,
      mentionsByChapter: [6,1,0,1,0,2,4,0,0,0,0,0] },
    { id: "q2", type: "quests", name: "Brec's Letter", glyphChar: "Bl", status: "active",
      subtitle: "Resolved — Ch. 5", chapterRange: "Ch. 2–5",
      mentionsByChapter: [0,2,1,1,3,0,0,0,0,0,0,0] },
  ],
  events: [
    { id: "e1", type: "events", name: "Hess negotiation", glyphChar: "Hn", status: "active",
      subtitle: "Opens Ch. 3, breaks Ch. 7",
      summary: "Two-sided negotiation that frames Acts II–III.",
      chapterRange: "Ch. 3–7", mentionsByChapter: [0,0,4,2,1,2,5,0,0,0,0,0] },
    { id: "e2", type: "events", name: "First salt-storm", glyphChar: "Fs", status: "active",
      subtitle: "Ch. 2 set-piece", chapterRange: "Ch. 2", mentionsByChapter: [0,5,0,0,0,0,0,0,0,0,0,0] },
  ],
  factions: [
    { id: "f1", type: "factions", name: "House Vey", glyphChar: "Hv", status: "active",
      subtitle: "Reigning house of the Pale Reach",
      summary: "Old salt-coast house; protagonist's seat. In tension with Hess.",
      chapterRange: "Ch. 1–7", queue: 1,
      mentionsByChapter: [4,2,1,2,1,3,3,0,0,0,0,0],
      related: [{ id:"c1", type:"cast", name:"Aelinor Vey" }, { id:"a1", type:"locations", name:"Pale Reach" }] },
    { id: "f2", type: "factions", name: "House Hess", glyphChar: "Hh", status: "active",
      subtitle: "Rival mercantile house", chapterRange: "Ch. 3–7",
      mentionsByChapter: [0,0,3,1,1,1,3,0,0,0,0,0] },
  ],
  lore: [
    { id: "l1", type: "lore", name: "The Auger Wake", glyphChar: "Aw", status: "active",
      subtitle: "Funeral-rite of the Reach",
      summary: "Multi-day rite performed for fallen Salt-bearers; described first in Ch. 1.",
      chapterRange: "Ch. 1, 7", mentionsByChapter: [4,0,0,0,0,0,3,0,0,0,0,0] },
    { id: "l2", type: "lore", name: "Salt-cold", glyphChar: "Sc", status: "active",
      subtitle: "Reach climate doctrine", chapterRange: "Ch. 1–7" },
  ],
  relationships: [
    { id: "rel1", type: "relationships", name: "Aelinor ↔ Saren", glyphChar: "AS", status: "active",
      subtitle: "Rivals; uneasy negotiators",
      summary: "Strained from Ch. 3; broken in Ch. 7.", chapterRange: "Ch. 3–7", queue: 1 },
    { id: "rel2", type: "relationships", name: "Aelinor ↔ Brec", glyphChar: "AB", status: "active",
      subtitle: "Loyal-to; mutual trust", chapterRange: "Ch. 1–7" },
  ],
  timeline: [
    { id: "t1", type: "timeline", name: "The Auger Wake", glyphChar: "Aw", status: "active",
      subtitle: "Last week (in-world)", chapterRange: "Ch. 1" },
    { id: "t2", type: "timeline", name: "Brec's letter", glyphChar: "Bl", status: "active",
      subtitle: "Three nights ago (in-world)", chapterRange: "Ch. 5" },
    { id: "t3", type: "timeline", name: "Hess break", glyphChar: "Hb", status: "active",
      subtitle: "Tonight (in-world)", chapterRange: "Ch. 7", queue: 1 },
  ],
  references: [
    { id: "rf1", type: "references", name: "Auger glossary draft", glyphChar: "Ag", status: "active",
      subtitle: "Author note · 4pp",
      summary: "Glossary draft pasted into the references panel; not yet promoted to Lore." },
    { id: "rf2", type: "references", name: "House Hess sketch", glyphChar: "Hs", status: "active",
      subtitle: "Author note · 1p" },
  ],
};

const ENTITY_REVIEW_SAMPLES = {
  bestiary: [
    { id:"rq1", name:"Hess wolfhound", action:"New entry", level:"strong", value:84,
      excerpt:"A grey hound at the door of the Glass Court — Hess-trained, by the look of the collar.",
      cite:"Ch. 3, p. 76", reason:"Detected as new bestiary entry" },
  ],
  locations: [
    { id:"rq2", name:"The Auger Cliffs", action:"New entry", level:"high", value:96,
      excerpt:"From the Auger Cliffs the Pass looked like a ledger half-closed.", cite:"Ch. 4, p. 91",
      reason:"Auto-added — appears in 3 chapters" },
    { id:"rq3", name:"Glass Court ↔ Hess Hall", action:"Merge?", level:"uncertain", value:62,
      excerpt:"They sat in the Glass Court — the same hall the Hess called their Hall of Hours.", cite:"Ch. 3, p. 78",
      reason:"Possible duplicate of \"Glass Court\"" },
  ],
  items: [
    { id:"rq4", name:"Salt cloak (Brec)", action:"New entry", level:"weak", value:38,
      excerpt:"He had pulled the salt cloak around himself — but it was not his cloak.", cite:"Ch. 5, p. 122",
      reason:"Low confidence — vague reference" },
  ],
};

const ENTITY_SUGGESTION_SAMPLES = {
  locations: [
    { id:"sg1", level:"strong", value:81, lbl:"Promote 'eastern beach' to a sub-entry of Pale Reach", excerpt:"They walked the eastern beach until the salt let them speak." },
    { id:"sg2", level:"uncertain", value:59, lbl:"Add coordinates to Vraska Pass" },
  ],
  bestiary: [
    { id:"sg3", level:"high", value:96, lbl:"Auto-add 'Hess wolfhound' from Ch. 3", excerpt:"A grey hound at the door of the Glass Court." },
  ],
  factions: [
    { id:"sg4", level:"strong", value:79, lbl:"Add neutrality stance to House Hess" },
  ],
};

window.ENTITY_SAMPLES = ENTITY_SAMPLES;
window.ENTITY_REVIEW_SAMPLES = ENTITY_REVIEW_SAMPLES;
window.ENTITY_SUGGESTION_SAMPLES = ENTITY_SUGGESTION_SAMPLES;


// ----- entity-framework.jsx -----
// =====================================================================
// entity-framework.jsx — Shared Entity Tab Framework.
//
// Plugged into DockedPanel for any entityType !== "cast". Provides:
//
//   - EntityTabShell      — top-level dispatcher across all 10 modes
//   - EntityRoster        — list/grid with search, filter, sort, view, group
//   - EntityRosterCard    — single roster row (list) and grid card
//   - EntityDetailHeader  — hero with portrait, name, aliases, badges
//   - EntityDetailSection — labelled block with action slot
//   - EntityContextPanel  — right-side rail (review, suggestions, etc.)
//   - RelatedEntityStrip  — pill row of related entities (cross-type)
//   - SourceMentionList   — bordered quote list with cite line
//   - EntityCreateButton  — primary "+ Add" CTA
//   - EntityImportButton  — outline import CTA
//   - EntityMergeModal    — destructive merge confirmation modal
//   - EntityDragChip      — drag-preview pill for dragging an entity
//   - EntityDropZone      — drop target with hover visuals
//   - EntityTabReviewQueue— in-tab queue list
//
// All callbacks named per the global protocol — see hook-up notes md.
// =====================================================================

const { useState: _ef_us, useMemo: _ef_um, useCallback: _ef_uc, useEffect: _ef_ue, useRef: _ef_ur } = React;

// ---------------------------------------------------------------------
// EntitySpark — tiny mention sparkline
// ---------------------------------------------------------------------
const EntitySpark = ({ data }) => {
  const safe = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...safe);
  return (
    <div className="ent-row__spark" aria-hidden>
      {safe.map((v, i) => (
        <div key={i} className="ent-row__spark__bar"
          style={{ height: Math.max(2, (v / max) * 14) + "px", opacity: v === 0 ? 0.25 : 1 }}/>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityRosterCard — single row (list view) OR grid card
// ---------------------------------------------------------------------
const EntityRosterCard = ({
  entity, view = "list",
  isSelected, isMulti, multiMode, dragSource,
  onSelectEntity, onToggleMulti, onEnterMultiMode, onDragStartEntity, onDropEntity,
}) => {
  const initials = entity.glyphChar || (entity.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
  const status = entity.status || "active";
  const onClick = (e) => {
    if (multiMode) { onToggleMulti && onToggleMulti(entity); return; }
    if (e.metaKey || e.ctrlKey) {
      if (onEnterMultiMode) onEnterMultiMode();
      onToggleMulti && onToggleMulti(entity);
      return;
    }
    onSelectEntity && onSelectEntity(entity);
  };
  const onDragStart = (e) => {
    e.dataTransfer.setData("text/loomwright-entity",
      JSON.stringify({ id: entity.id, name: entity.name, type: entity.type }));
    e.dataTransfer.effectAllowed = "copyMove";
    onDragStartEntity && onDragStartEntity(entity);
  };

  if (view === "grid") {
    return (
      <div
        className={"ent-card" + (isSelected ? " is-selected" : "")}
        data-ui="EntityRosterCard"
        data-callback="onSelectEntity"
        data-testid={"ent-card-" + entity.id}
        data-entity-id={entity.id}
        onClick={onClick}
        draggable
        onDragStart={onDragStart}
      >
        <div className="ent-card__monogram">{initials}</div>
        <div className="ent-card__name">{entity.name}</div>
        {entity.subtitle && <div className="ent-card__sub">{entity.subtitle}</div>}
        {entity.queue ? <span className="ent-card__queue"><ReviewCountBadge count={entity.queue}/></span> : null}
      </div>
    );
  }

  return (
    <div
      className={"ent-row" + (isSelected ? " is-selected" : "") + (isMulti ? " is-multi" : "") + (dragSource ? " is-drag-source" : "")}
      data-ui="EntityRosterCard"
      data-callback="onSelectEntity"
      data-testid={"ent-row-" + entity.id}
      data-entity-id={entity.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
    >
      <div className="ent-row__check" aria-hidden>{isMulti && <Icon name="check" size={10}/>}</div>
      <div className={"ent-row__monogram" + (status === "unknown" ? " ent-row__monogram--unknown" : "")}>
        {initials}
        <span className={"ent-row__monogram__status ent-row__monogram__status--" + status}/>
      </div>
      <div className="ent-row__identity">
        <span className="ent-row__name">{entity.name}</span>
        <span className="ent-row__status">{ENTITY_STATUS_LABEL[status] || status}</span>
      </div>
      <div className="ent-row__subline">{entity.subtitle || entity.summary}</div>
      <div className="ent-row__meta">
        <span className="ent-row__chapters">{entity.chapterRange}</span>
        <EntitySpark data={entity.mentionsByChapter}/>
        <div className="ent-row__badges">
          {entity.queue ? <ReviewCountBadge count={entity.queue}/> : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityCreateButton / EntityImportButton — small wrappers for testability
// ---------------------------------------------------------------------
const EntityCreateButton = ({ entityType, onCreateEntity, label = "Add" }) => (
  <Btn variant="primary" size="sm" icon="plus"
    onClick={() => onCreateEntity && onCreateEntity({ entityType })}
    data-callback="onCreateEntity" data-testid="ent-create" data-entity={entityType}
  >{label}</Btn>
);
const EntityImportButton = ({ entityType, onImportEntity }) => (
  <Btn variant="outline" size="sm" icon="paper"
    onClick={() => onImportEntity && onImportEntity({ entityType })}
    data-callback="onImportEntity" data-testid="ent-import" data-entity={entityType}
  >Import</Btn>
);

// ---------------------------------------------------------------------
// EntityDragChip — visible affordance for dragging an entity
// ---------------------------------------------------------------------
const EntityDragChip = ({ entity, onDragStartEntity }) => {
  const initials = entity.glyphChar || (entity.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="ent-drag-chip" draggable data-ui="EntityDragChip"
      onDragStart={(e) => {
        e.dataTransfer.setData("text/loomwright-entity",
          JSON.stringify({ id: entity.id, name: entity.name, type: entity.type }));
        onDragStartEntity && onDragStartEntity(entity);
      }}>
      <span className="ent-drag-chip__avatar">{initials}</span>
      <span>{entity.name}</span>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityDropZone — accepts dragged entities
// ---------------------------------------------------------------------
const EntityDropZone = ({ children = "Drop entity here", onDropEntity, accept }) => {
  const [over, setOver] = _ef_us(false);
  return (
    <div
      className={"ent-drop" + (over ? " is-over" : "")}
      data-ui="EntityDropZone"
      data-callback="onDropEntity"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const raw = e.dataTransfer.getData("text/loomwright-entity");
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (accept && !accept.includes(data.type)) return;
          onDropEntity && onDropEntity(data);
        } catch (_) {}
      }}
    >{children}</div>
  );
};

// ---------------------------------------------------------------------
// SourceMentionList
// ---------------------------------------------------------------------
const SourceMentionList = ({ mentions = [], onOpenSourceMention }) => (
  <div className="ent-mention-list" data-ui="SourceMentionList">
    {mentions.map((m) => (
      <div key={m.id} className="ent-mention"
        data-callback="onOpenSourceMention"
        onClick={() => onOpenSourceMention && onOpenSourceMention(m)}>
        "{m.excerpt}"
        <span className="ent-mention__cite">{m.cite}</span>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// RelatedEntityStrip
// ---------------------------------------------------------------------
const RelatedEntityStrip = ({ related = [], onSelectEntity, onOpenRelatedTab }) => (
  <div className="ent-related-strip" data-ui="RelatedEntityStrip">
    {related.map((r) => {
      const t = ENTITY_TYPES[r.type];
      const initials = r.initials || (r.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
      const style = t ? { "--rt-color": t.color, "--rt-soft": t.soft, "--rt-deep": t.deep } : {};
      return (
        <button key={r.id + "-" + r.type} className="ent-related"
          style={style}
          data-callback="onSelectEntity"
          onClick={(e) => {
            if (e.shiftKey && onOpenRelatedTab) { onOpenRelatedTab(r); return; }
            onSelectEntity && onSelectEntity(r);
          }}>
          <span className="ent-related__avatar">{initials}</span>
          <span className="ent-related__name">{r.name}</span>
          {r.kind && <span className="ent-related__kind">{r.kind}</span>}
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------
// EntityDetailSection — generic labelled block
// ---------------------------------------------------------------------
const EntityDetailSection = ({ title, action, actionCallback = "onEntitySectionAction", children }) => (
  <div className="ent-section" data-ui="EntityDetailSection" data-section-title={title}>
    <div className="ent-section__head">
      <span className="ent-section__title">{title}</span>
      {action && (
        <button className="ent-section__action"
          onClick={action.onClick}
          data-callback={action.callback || actionCallback}>
          {action.label}
        </button>
      )}
    </div>
    <div className="ent-section__body">{children}</div>
  </div>
);

// ---------------------------------------------------------------------
// EntityDetailHeader
// ---------------------------------------------------------------------
const EntityDetailHeader = ({ entity, onBack, onEditEntity, onOpenRelatedTab }) => {
  const initials = entity.glyphChar || (entity.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
  const totalMentions = (entity.mentionsByChapter || []).reduce((a,b) => a + b, 0);
  return (
    <>
      <button className="ent-detail__back" onClick={onBack} data-callback="onBackToOverview">
        <Icon name="close" size={9}/> Back to all {ENTITY_TYPES[entity.type]?.plural?.toLowerCase() || "entries"}
      </button>
      <div className="ent-detail__hero" data-ui="EntityDetailHeader">
        <div className="ent-detail__portrait">{initials}</div>
        <div className="ent-detail__hero__body">
          <div className="ent-detail__name">{entity.name}</div>
          {entity.aliases && entity.aliases.length > 0 && (
            <div className="ent-detail__aliases">also: {entity.aliases.join(" · ")}</div>
          )}
          {entity.subtitle && <div className="ent-detail__sub">{entity.subtitle}</div>}
          <div className="ent-detail__meta-row">
            <EntityTypeBadge type={entity.type} size="xs"/>
            {entity.chapterRange && <span className="chip chip--neutral">{entity.chapterRange}</span>}
            {totalMentions > 0 && <span className="chip chip--neutral">{totalMentions} mentions</span>}
            {entity.queue ? <ReviewCountBadge count={entity.queue}/> : null}
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------
// EntityContextPanel — right-rail style block (reused inside the panel
// body for the moment; in expanded mode it can sit beside detail)
// ---------------------------------------------------------------------
const EntityContextPanel = ({
  entity,
  reviewItems = [], suggestions = [], related = [],
  warnings = [], recent = [], mentions = [],
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onSelectEntity, onOpenRelatedTab, onOpenSourceMention, onOpenEntityReviewQueue,
  onRunEntitySuggestion,
}) => (
  <aside className="ent-ctx" data-ui="EntityContextPanel">
    {warnings.length > 0 && (
      <div>
        <div className="ent-ctx__title">Warnings</div>
        {warnings.map((w, i) => (
          <div key={i} className="ent-ctx__warn">
            <Icon name="warn" size={12}/><span>{w}</span>
          </div>
        ))}
      </div>
    )}

    {reviewItems.length > 0 && (
      <div>
        <div className="ent-ctx__title" style={{ display:"flex", justifyContent:"space-between" }}>
          <span>Review queue</span>
          <button className="ent-section__action"
            onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue(entity)}
            data-callback="onOpenEntityReviewQueue">All →</button>
        </div>
        <EntityTabReviewQueue
          items={reviewItems.slice(0, 2)}
          compact
          onAcceptQueueItem={onAcceptQueueItem}
          onEditQueueItem={onEditQueueItem}
          onMergeQueueItem={onMergeQueueItem}
          onDenyQueueItem={onDenyQueueItem}
        />
      </div>
    )}

    {suggestions.length > 0 && (
      <div>
        <div className="ent-ctx__title">Suggestions</div>
        {suggestions.slice(0, 3).map((s) => (
          <div key={s.id} style={{ display:"flex", flexDirection:"column", gap:4, padding:"6px 0", borderBottom:"1px dashed var(--line-2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <ConfidenceBadge level={s.level} value={s.value}/>
              <span style={{ flex:1, fontSize:"var(--fs-2xs)", color:"var(--ink-2)" }}>{s.lbl}</span>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              <Btn variant="primary" size="sm" data-callback="onRunEntitySuggestion"
                onClick={() => onRunEntitySuggestion && onRunEntitySuggestion(s)}>Run</Btn>
              <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
            </div>
          </div>
        ))}
      </div>
    )}

    {related.length > 0 && (
      <div>
        <div className="ent-ctx__title">Related</div>
        <RelatedEntityStrip
          related={related.slice(0, 6)}
          onSelectEntity={onSelectEntity}
          onOpenRelatedTab={onOpenRelatedTab}
        />
      </div>
    )}

    {mentions.length > 0 && (
      <div>
        <div className="ent-ctx__title">Source snippets</div>
        <SourceMentionList mentions={mentions.slice(0, 3)} onOpenSourceMention={onOpenSourceMention}/>
      </div>
    )}

    {recent.length > 0 && (
      <div>
        <div className="ent-ctx__title">Recent changes</div>
        <div className="ent-ctx__recent">
          {recent.map((r, i) => (
            <div key={i} className="ent-ctx__recent-item">
              <span>{r.when}</span><span style={{ color:"var(--ink-2)" }}>{r.what}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </aside>
);

// ---------------------------------------------------------------------
// EntityTabReviewQueue
// ---------------------------------------------------------------------
const EntityTabReviewQueue = ({
  items = [], compact = false, entityType,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
}) => {
  if (!items.length) {
    return (
      <div className="ent-empty" data-ui="EntityTabReviewQueueEmpty">
        <div className="ent-empty__seal">✓</div>
        <div className="ent-empty__title">Nothing to review</div>
        <div className="ent-empty__body">Every {ENTITY_TYPES[entityType]?.plural?.toLowerCase() || "entry"} is confirmed. New extractions will surface here.</div>
      </div>
    );
  }
  return (
    <div className="ent-review" data-ui="EntityTabReviewQueue">
      {!compact && (
        <div className="ent-review__head-note">
          Detected from the manuscript. Nothing here has been added yet.
        </div>
      )}
      {items.map((it) => (
        <div key={it.id} className="ent-review__card" data-testid={"ent-rq-" + it.id}>
          <div className="ent-review__head">
            <div className="ent-row__monogram ent-row__monogram--unknown" style={{ width:28, height:28, fontSize:"var(--fs-3xs)" }}>
              {(it.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div className="ent-review__name">{it.name}</div>
            {it.action && <span className="ent-review__action-tag">{it.action}</span>}
            <ConfidenceBadge level={it.level} value={it.value}/>
          </div>
          <div className="ent-review__excerpt" dangerouslySetInnerHTML={{ __html: '"' + it.excerpt + '"' }}/>
          <div className="ent-review__meta">
            <Icon name="paper" size={10}/> {it.cite}
            <span style={{ flex:1 }}/>
            <span>{it.reason}</span>
          </div>
          <div className="ent-review__actions">
            <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem"
              onClick={() => onAcceptQueueItem && onAcceptQueueItem(it)}>Accept</Btn>
            <Btn variant="outline" size="sm" data-callback="onEditQueueItem"
              onClick={() => onEditQueueItem && onEditQueueItem(it)}>Edit</Btn>
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem"
              onClick={() => onMergeQueueItem && onMergeQueueItem(it)}>Merge…</Btn>
            <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem"
              onClick={() => onDenyQueueItem && onDenyQueueItem(it)}>Deny</Btn>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityMergeModal — destructive, opens over the panel
// ---------------------------------------------------------------------
const EntityMergeModal = ({ open, sources = [], target, onCancel, onMergeEntity }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" data-ui="EntityMergeModal" role="dialog" aria-modal="true">
      <div className="modal modal--default" style={{ maxWidth: 460 }}>
        <div className="modal__title">Merge {sources.length} {sources.length === 1 ? "entry" : "entries"}</div>
        <div className="modal__body">
          <div style={{ marginBottom: 8, fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>
            The following will be merged into{" "}
            <strong style={{ color: "var(--ink-1)" }}>{target?.name || sources[0]?.name}</strong>.
            Merged entries become aliases; their source mentions are reassigned.
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 18px", fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>
            {sources.map((s) => <li key={s.id}>{s.name}</li>)}
          </ul>
        </div>
        <div className="modal__actions">
          <Btn variant="ghost" onClick={onCancel} data-callback="onCancel">Cancel</Btn>
          <Btn variant="primary" data-callback="onMergeEntity"
            onClick={() => onMergeEntity && onMergeEntity({ sources, target })}>Merge</Btn>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  EntitySpark, EntityRosterCard,
  EntityCreateButton, EntityImportButton,
  EntityDragChip, EntityDropZone,
  SourceMentionList, RelatedEntityStrip,
  EntityDetailSection, EntityDetailHeader,
  EntityContextPanel, EntityTabReviewQueue,
  EntityMergeModal,
});


// ----- entity-framework-shell.jsx -----
// =====================================================================
// entity-framework-shell.jsx — EntityRoster + EntityTabShell.
//
// EntityTabShell is the dispatcher across the 10 universal entity tab
// modes (overview, selected, multi, review, suggestive, empty, loading,
// error, edit, compare). It composes the small components from
// entity-framework.jsx into a coherent layout: roster on the left,
// detail centre, context panel right.
//
// Used by panels.jsx for any panel where entityType is one of the
// supported types and entityType !== "cast" (Cast keeps its bespoke
// panel for now). EntityTabShell never hard-codes per-type fields —
// type-specific detail bodies plug in via the `detailRender` slot.
// =====================================================================

const { useState: _ets_us, useMemo: _ets_um } = React;

// ---------------------------------------------------------------------
// EntityRoster — search + filter + sort + view + group + create + import
// + bulk action bar. Renders EntityRosterCards (list or grid).
// ---------------------------------------------------------------------
const EntityRoster = ({
  entityType,
  entities = [], queueCount = 0,
  selectedId, multiIds = [], multiMode,
  search, filters = [], sortKeys = [], view = "list", groupBy,
  onSearchChange, onFilterChange, onSortChange, onViewChange, onGroupByChange,
  onSelectEntity, onToggleMulti, onEnterMultiMode, onExitMultiMode,
  onCreateEntity, onImportEntity, onOpenEntityReviewQueue,
  onMergeEntity, onDeleteEntityRequest, onCompareEntities,
  onDragStartEntity, onDropEntity,
}) => {
  const t = ENTITY_TYPES[entityType] || {};
  const [activeFilters, setActiveFilters] = _ets_us(new Set());
  const [sortKey, setSortKey] = _ets_us(sortKeys[0] || "name");
  const [filterMenuOpen, setFilterMenuOpen] = _ets_us(false);
  const [sortMenuOpen, setSortMenuOpen] = _ets_us(false);

  const toggleFilter = (k) => {
    const next = new Set(activeFilters);
    next.has(k) ? next.delete(k) : next.add(k);
    setActiveFilters(next);
    onFilterChange && onFilterChange(Array.from(next));
  };

  const isGrid = view === "grid";
  const groups = _ets_um(() => {
    if (!groupBy || groupBy === "none") return [{ key: null, label: null, items: entities }];
    const m = new Map();
    for (const e of entities) {
      const g = e[groupBy] || "—";
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(e);
    }
    return Array.from(m.entries()).map(([k, items]) => ({ key: k, label: k, items }));
  }, [entities, groupBy]);

  return (
    <div className={"ent-roster " + (multiMode ? "is-multi-mode" : "")}
      data-ui="EntityRoster" data-entity={entityType}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
    >
      {/* Toolbar row 1 — search + view */}
      <div className="ent-roster__toolbar">
        <div className="ent-roster__search">
          <Icon name="search" size={12}/>
          <input
            value={search || ""}
            placeholder={"Search " + (t.plural || entityType).toLowerCase() + "…"}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            data-callback="onSearchChange"
            data-testid="ent-search"
          />
          {search && (
            <button className="ent-roster__search__clear"
              onClick={() => onSearchChange && onSearchChange("")}
              aria-label="Clear search"><Icon name="close" size={9}/></button>
          )}
        </div>
        <div className="ent-roster__view">
          <button className={"ent-roster__view__btn" + (view === "list" ? " is-on" : "")}
            onClick={() => onViewChange && onViewChange("list")}
            data-callback="onViewChange" title="List view">
            <Icon name="list" size={11}/>
          </button>
          <button className={"ent-roster__view__btn" + (view === "grid" ? " is-on" : "")}
            onClick={() => onViewChange && onViewChange("grid")}
            data-callback="onViewChange" title="Grid view">
            <Icon name="grid" size={11}/>
          </button>
        </div>
      </div>

      {/* Toolbar row 2 — filters / sort / queue / create / import */}
      <div className="ent-roster__toolbar ent-roster__toolbar--compact">
        <div className="ent-roster__filters">
          <button className={"ent-roster__chip" + (filterMenuOpen ? " is-on" : "")}
            onClick={() => { setFilterMenuOpen((v) => !v); setSortMenuOpen(false); }}
            data-callback="onOpenFilterMenu">
            <Icon name="filter" size={10}/> Filter
            {activeFilters.size > 0 && <span className="ent-roster__chip__count">{activeFilters.size}</span>}
          </button>
          <button className={"ent-roster__chip" + (sortMenuOpen ? " is-on" : "")}
            onClick={() => { setSortMenuOpen((v) => !v); setFilterMenuOpen(false); }}
            data-callback="onOpenSortMenu">
            <Icon name="sort" size={10}/> Sort: {sortKey}
          </button>
          {groupBy !== undefined && (
            <button className="ent-roster__chip"
              onClick={() => onGroupByChange && onGroupByChange(groupBy === "none" ? "status" : "none")}
              data-callback="onGroupByChange">
              <Icon name="stack" size={10}/> {groupBy === "none" ? "Group" : "Ungroup"}
            </button>
          )}
          {queueCount > 0 && (
            <button className="ent-roster__chip ent-roster__chip--queue"
              onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue({ entityType })}
              data-callback="onOpenEntityReviewQueue">
              <Icon name="bell" size={10}/> Review <ReviewCountBadge count={queueCount}/>
            </button>
          )}
        </div>
        <div className="ent-roster__cta">
          <EntityImportButton entityType={entityType} onImportEntity={onImportEntity}/>
          <EntityCreateButton entityType={entityType} onCreateEntity={onCreateEntity}/>
        </div>
      </div>

      {/* Filter dropdown */}
      {filterMenuOpen && (
        <div className="ent-roster__menu" data-ui="EntityRosterFilterMenu">
          {(filters.length ? filters : [
            { key: "status:active", label: "Status: Active" },
            { key: "status:archived", label: "Status: Archived" },
            { key: "queue:hasReview", label: "Has review items" },
            { key: "chapters:current", label: "In current chapter" },
          ]).map((f) => (
            <button key={f.key} className={"ent-roster__menu__row" + (activeFilters.has(f.key) ? " is-on" : "")}
              onClick={() => toggleFilter(f.key)}>
              <span className="ent-roster__menu__check">{activeFilters.has(f.key) ? <Icon name="check" size={10}/> : null}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sort dropdown */}
      {sortMenuOpen && (
        <div className="ent-roster__menu" data-ui="EntityRosterSortMenu">
          {(sortKeys.length ? sortKeys : ["name", "first seen", "mentions", "recently edited"]).map((k) => (
            <button key={k} className={"ent-roster__menu__row" + (sortKey === k ? " is-on" : "")}
              onClick={() => { setSortKey(k); setSortMenuOpen(false); onSortChange && onSortChange(k); }}>
              <span className="ent-roster__menu__check">{sortKey === k ? <Icon name="check" size={10}/> : null}</span>
              <span>{k}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar (multi-select) */}
      {multiMode && (
        <div className="ent-roster__bulk" data-ui="EntityBulkActionBar">
          <span className="ent-roster__bulk__count">{multiIds.length} selected</span>
          <div className="ent-roster__bulk__actions">
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeEntity"
              onClick={() => onMergeEntity && onMergeEntity({ entityType, ids: multiIds })}>Merge</Btn>
            <Btn variant="outline" size="sm" icon="bookmark" data-callback="onCompareEntities"
              onClick={() => onCompareEntities && onCompareEntities({ entityType, ids: multiIds })}>Compare</Btn>
            <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntityRequest"
              onClick={() => onDeleteEntityRequest && onDeleteEntityRequest({ entityType, ids: multiIds })}>Delete</Btn>
            <span style={{ flex:1 }}/>
            <Btn variant="ghost" size="sm" data-callback="onExitMultiMode" onClick={onExitMultiMode}>Done</Btn>
          </div>
        </div>
      )}

      {/* Body */}
      <div className={"ent-roster__body " + (isGrid ? "is-grid" : "is-list")}>
        {groups.map((g) => (
          <div key={g.key || "all"} className="ent-roster__group">
            {g.label && (
              <div className="ent-roster__group__head">
                <span>{g.label}</span><span className="ent-roster__group__count">{g.items.length}</span>
              </div>
            )}
            {isGrid ? (
              <div className="ent-roster__grid">
                {g.items.map((e) => (
                  <EntityRosterCard key={e.id} entity={e} view="grid"
                    isSelected={selectedId === e.id}
                    isMulti={multiIds.includes(e.id)} multiMode={multiMode}
                    onSelectEntity={onSelectEntity} onToggleMulti={onToggleMulti}
                    onEnterMultiMode={onEnterMultiMode}
                    onDragStartEntity={onDragStartEntity} onDropEntity={onDropEntity}
                  />
                ))}
              </div>
            ) : (
              <div className="ent-roster__list">
                {g.items.map((e) => (
                  <EntityRosterCard key={e.id} entity={e} view="list"
                    isSelected={selectedId === e.id}
                    isMulti={multiIds.includes(e.id)} multiMode={multiMode}
                    onSelectEntity={onSelectEntity} onToggleMulti={onToggleMulti}
                    onEnterMultiMode={onEnterMultiMode}
                    onDragStartEntity={onDragStartEntity} onDropEntity={onDropEntity}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityCompareView — side-by-side fields view used by Compare mode
// ---------------------------------------------------------------------
const EntityCompareView = ({ entities = [], onMergeEntity, onSelectEntity, onExitCompare }) => {
  const fields = ["subtitle", "chapterRange", "status", "summary"];
  return (
    <div className="ent-compare" data-ui="EntityCompareView">
      <div className="ent-compare__head">
        <span>Comparing {entities.length} entries</span>
        <Btn variant="ghost" size="sm" data-callback="onExitCompare" onClick={onExitCompare}>Close</Btn>
      </div>
      <div className="ent-compare__grid" style={{ gridTemplateColumns: "120px " + entities.map(() => "1fr").join(" ") }}>
        <div className="ent-compare__cell ent-compare__cell--label">Entry</div>
        {entities.map((e) => (
          <div key={e.id} className="ent-compare__cell ent-compare__cell--head">
            <button className="ent-compare__title" data-callback="onSelectEntity"
              onClick={() => onSelectEntity && onSelectEntity(e)}>{e.name}</button>
          </div>
        ))}
        {fields.map((f) => (
          <React.Fragment key={f}>
            <div className="ent-compare__cell ent-compare__cell--label">{f}</div>
            {entities.map((e) => (
              <div key={e.id + f} className="ent-compare__cell">{e[f] || <span style={{ color:"var(--ink-4)" }}>—</span>}</div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="ent-compare__footer">
        <Btn variant="primary" size="sm" icon="link" data-callback="onMergeEntity"
          onClick={() => onMergeEntity && onMergeEntity({ ids: entities.map((e) => e.id) })}>Merge these</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityTabShell — orchestrates everything per panel
// ---------------------------------------------------------------------
const EntityTabShell = ({
  panel, mode: modeProp,
  entities, selectedEntity, multiEntities = [], compareEntities = [],
  reviewItems = [], suggestions = [],
  detailRender, // (entity) => ReactNode for type-specific detail body
  // Roster state
  search, filters, sortKeys, view = "list", groupBy = "none",
  onSearchChange, onFilterChange, onSortChange, onViewChange, onGroupByChange,
  // Selection
  onSelectEntity, onBackToOverview, onToggleMulti, onEnterMultiMode, onExitMultiMode,
  // CRUD
  onCreateEntity, onImportEntity, onEditEntity, onDeleteEntityRequest, onMergeEntity,
  onDropEntity, onDragStartEntity,
  // Cross-tab + queue
  onOpenRelatedTab, onOpenSourceMention,
  onOpenEntityReviewQueue, onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onRunEntitySuggestion, onCompareEntities, onExitCompare,
  onRetry,
  mergeModalOpen, mergeModalSources = [], mergeModalTarget, onCancelMerge,
}) => {
  const entityType = panel?.entityType || "lore";
  const t = ENTITY_TYPES[entityType] || {};
  const queueCount = (panel?.queueCount ?? reviewItems.length) || 0;

  // Auto-derive mode from props if not provided
  const derivedMode = modeProp
    || (panel?.state === "loading" ? "loading"
      : panel?.state === "error" ? "error"
      : panel?.state === "empty" ? "empty"
      : panel?.state === "review" ? "review"
      : panel?.state === "suggestion" ? "suggestive"
      : panel?.state === "edit" ? "edit"
      : panel?.state === "compare" ? "compare"
      : compareEntities.length >= 2 ? "compare"
      : multiEntities.length > 0 ? "multi"
      : selectedEntity ? "selected"
      : (entities && entities.length === 0) ? "empty"
      : "overview");

  const showRoster = ["overview","selected","multi","review","suggestive","compare"].includes(derivedMode);

  return (
    <div className="ent-shell" data-ui="EntityTabShell" data-mode={derivedMode}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
    >
      {/* LOADING */}
      {derivedMode === "loading" && (
        <div className="ent-shell__center">
          <LoadingState title={"Loading " + (t.plural || "entries").toLowerCase() + "…"} lines={4}/>
        </div>
      )}

      {/* ERROR */}
      {derivedMode === "error" && (
        <div className="ent-shell__center">
          <ErrorState
            title="Couldn't load this tab"
            body="Local index unreachable. Your manuscript and entries are safe — try again in a moment."
            onRetry={onRetry || (() => {})}
          />
        </div>
      )}

      {/* EMPTY (whole tab) */}
      {derivedMode === "empty" && (
        <div className="ent-shell__center">
          <div className="ent-shell__empty" data-ui="EntityTabEmpty">
            <div className="ent-empty__seal" style={{ background: "var(--es)", color: "var(--ed)" }}>
              <Icon name={panel?.icon || "paper"} size={20}/>
            </div>
            <div className="ent-empty__title">{"No " + (t.plural || "entries").toLowerCase() + " yet"}</div>
            <div className="ent-empty__body">
              Add your first {(t.singular || "entry").toLowerCase()} by hand, import from a file,
              or have <strong>{brand.name}</strong> extract from the manuscript.
            </div>
            <div className="ent-empty__actions">
              <EntityCreateButton entityType={entityType} onCreateEntity={onCreateEntity}
                label={"Add " + (t.singular || "entry").toLowerCase()}/>
              <EntityImportButton entityType={entityType} onImportEntity={onImportEntity}/>
              <Btn variant="ghost" size="sm" icon="sparkle" data-callback="onSaveAndExtract">
                Extract from manuscript
              </Btn>
            </div>
            <div className="ent-shell__mobile-note">
              On mobile, this tab opens as a full-screen sheet; bulk-action bar collapses to a bottom card.
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT — roster + body */}
      {showRoster && (
        <div className="ent-shell__main">
          <EntityRoster
            entityType={entityType}
            entities={entities || []}
            queueCount={queueCount}
            selectedId={selectedEntity?.id}
            multiIds={multiEntities.map((e) => e.id)}
            multiMode={multiEntities.length > 0 || derivedMode === "multi"}
            search={search} filters={filters} sortKeys={sortKeys}
            view={view} groupBy={groupBy}
            onSearchChange={onSearchChange} onFilterChange={onFilterChange}
            onSortChange={onSortChange} onViewChange={onViewChange} onGroupByChange={onGroupByChange}
            onSelectEntity={onSelectEntity}
            onToggleMulti={onToggleMulti} onEnterMultiMode={onEnterMultiMode} onExitMultiMode={onExitMultiMode}
            onCreateEntity={onCreateEntity} onImportEntity={onImportEntity}
            onOpenEntityReviewQueue={onOpenEntityReviewQueue}
            onMergeEntity={onMergeEntity}
            onDeleteEntityRequest={onDeleteEntityRequest}
            onCompareEntities={onCompareEntities}
            onDragStartEntity={onDragStartEntity}
            onDropEntity={onDropEntity}
          />

          <div className="ent-shell__body">
            {/* OVERVIEW */}
            {derivedMode === "overview" && (
              <div className="ent-shell__overview" data-ui="EntityTabOverview">
                <div className="ent-shell__overview__head">
                  <div>
                    <div className="ent-shell__overview__eyebrow">{t.plural || "Entries"}</div>
                    <div className="ent-shell__overview__title">{(entities || []).length} entries</div>
                    <div className="ent-shell__overview__sub">
                      Pick one on the left, or drop an entity here to link.
                    </div>
                  </div>
                  {queueCount > 0 && (
                    <button className="ent-shell__queue-card"
                      onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue({ entityType })}
                      data-callback="onOpenEntityReviewQueue">
                      <ReviewCountBadge count={queueCount}/>
                      <span>in review</span>
                    </button>
                  )}
                </div>
                <EntityDropZone onDropEntity={onDropEntity}>
                  Drop a {(t.singular || "entry").toLowerCase()} chip here to link
                </EntityDropZone>
                {suggestions.length > 0 && (
                  <EntityDetailSection title="Suggestions for this tab">
                    {suggestions.slice(0, 3).map((s) => (
                      <div key={s.id} className="ent-shell__sugg">
                        <ConfidenceBadge level={s.level} value={s.value}/>
                        <span style={{ flex:1 }}>{s.lbl}</span>
                        <Btn variant="primary" size="sm" data-callback="onRunEntitySuggestion"
                          onClick={() => onRunEntitySuggestion && onRunEntitySuggestion(s)}>Run</Btn>
                        <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
                      </div>
                    ))}
                  </EntityDetailSection>
                )}
                <div className="ent-shell__partial-note">
                  <Icon name="info" size={11}/>
                  Showing {(entities || []).length} of {(entities || []).length}. Some chapters not yet indexed —
                  re-extract to refresh counts.
                </div>
              </div>
            )}

            {/* SELECTED */}
            {derivedMode === "selected" && selectedEntity && (
              <div className="ent-shell__detail" data-ui="EntityTabSelected">
                <EntityDetailHeader entity={selectedEntity}
                  onBack={onBackToOverview} onEditEntity={onEditEntity}
                  onOpenRelatedTab={onOpenRelatedTab}/>
                <div className="ent-shell__detail__actions">
                  <Btn variant="primary" size="sm" icon="edit" data-callback="onEditEntity"
                    onClick={() => onEditEntity && onEditEntity(selectedEntity)}>Edit</Btn>
                  <Btn variant="outline" size="sm" icon="link" data-callback="onMergeEntity"
                    onClick={() => onMergeEntity && onMergeEntity({ ids: [selectedEntity.id] })}>Merge…</Btn>
                  <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenRelatedTab"
                    onClick={() => onOpenRelatedTab && onOpenRelatedTab({ type: entityType, id: selectedEntity.id })}>
                    Open related tab
                  </Btn>
                  <span style={{ flex:1 }}/>
                  <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntityRequest"
                    onClick={() => onDeleteEntityRequest && onDeleteEntityRequest(selectedEntity)}>Delete</Btn>
                </div>

                {/* Type-specific body OR generic fallback */}
                {detailRender ? detailRender(selectedEntity) : (
                  <>
                    {selectedEntity.summary && (
                      <EntityDetailSection title="Summary">
                        <p style={{ margin:0, fontFamily:"var(--font-serif)", fontSize:"var(--fs-md)", color:"var(--ink-1)", lineHeight:1.6 }}>
                          {selectedEntity.summary}
                        </p>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.fields && selectedEntity.fields.length > 0 && (
                      <EntityDetailSection title="Fields">
                        <div className="ent-fields">
                          {selectedEntity.fields.map((f) => (
                            <React.Fragment key={f.k}>
                              <div className="ent-fields__k">{f.k}</div>
                              <div className="ent-fields__v">{f.v}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.linkedChapters?.length > 0 && (
                      <EntityDetailSection title="Linked chapters">
                        <div className="ent-chip-row">
                          {selectedEntity.linkedChapters.map((c) => (
                            <button key={c.id} className="ent-chip" data-callback="onSelectChapter"
                              onClick={() => onOpenSourceMention && onOpenSourceMention(c)}>
                              <Icon name="paper" size={10}/> {c.label}
                            </button>
                          ))}
                        </div>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.related?.length > 0 && (
                      <EntityDetailSection title="Related entities"
                        action={{ label: "Open related tab →", callback: "onOpenRelatedTab",
                          onClick: () => onOpenRelatedTab && onOpenRelatedTab({ type: entityType, id: selectedEntity.id }) }}>
                        <RelatedEntityStrip related={selectedEntity.related}
                          onSelectEntity={onSelectEntity} onOpenRelatedTab={onOpenRelatedTab}/>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.mentions?.length > 0 && (
                      <EntityDetailSection title="Source mentions"
                        action={{ label: "Show all", callback: "onOpenSourceMention",
                          onClick: () => onOpenSourceMention && onOpenSourceMention({ entityId: selectedEntity.id }) }}>
                        <SourceMentionList mentions={selectedEntity.mentions}
                          onOpenSourceMention={onOpenSourceMention}/>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.notes && (
                      <EntityDetailSection title="Notes">
                        <p style={{ margin:0, fontFamily:"var(--font-serif)", fontStyle:"italic", color:"var(--ink-2)", lineHeight:1.55 }}>
                          {selectedEntity.notes}
                        </p>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.references?.length > 0 && (
                      <EntityDetailSection title="References">
                        <ul className="ent-ref-list">
                          {selectedEntity.references.map((r, i) => (
                            <li key={i}><Icon name="paper" size={10}/> {r}</li>
                          ))}
                        </ul>
                      </EntityDetailSection>
                    )}
                  </>
                )}

                <button className="ent-shell__more"
                  onClick={() => onOpenRelatedTab && onOpenRelatedTab({ type: entityType, id: selectedEntity.id })}
                  data-callback="onOpenRelatedTab">
                  Show more in {(t.plural || "entries")} → <Icon name="caret-right" size={9}/>
                </button>
              </div>
            )}

            {/* MULTI */}
            {derivedMode === "multi" && (
              <div className="ent-shell__multi" data-ui="EntityTabMulti">
                <div className="ent-shell__multi__head">
                  <div className="ent-shell__multi__count">{multiEntities.length} selected</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn variant="primary" size="sm" icon="link" data-callback="onMergeEntity"
                      onClick={() => onMergeEntity && onMergeEntity({ ids: multiEntities.map((e) => e.id) })}>Merge</Btn>
                    <Btn variant="outline" size="sm" data-callback="onCompareEntities"
                      onClick={() => onCompareEntities && onCompareEntities({ ids: multiEntities.map((e) => e.id) })}>Compare</Btn>
                    <Btn variant="outline" size="sm" icon="bookmark" data-callback="onTagEntities">Tag</Btn>
                    <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntityRequest"
                      onClick={() => onDeleteEntityRequest && onDeleteEntityRequest({ ids: multiEntities.map((e) => e.id) })}>Delete</Btn>
                  </div>
                </div>
                <EntityDetailSection title="Selected entries">
                  <div className="ent-shell__multi__list">
                    {multiEntities.map((e) => (
                      <EntityRosterCard key={e.id} entity={e} view="list"
                        isSelected isMulti multiMode
                        onSelectEntity={onSelectEntity} onToggleMulti={onToggleMulti}/>
                    ))}
                  </div>
                </EntityDetailSection>
                <EntityDetailSection title="Combined source mentions">
                  <SourceMentionList
                    mentions={multiEntities.flatMap((e) => e.mentions || []).slice(0, 4)}
                    onOpenSourceMention={onOpenSourceMention}/>
                </EntityDetailSection>
              </div>
            )}

            {/* COMPARE */}
            {derivedMode === "compare" && (
              <EntityCompareView entities={compareEntities.length ? compareEntities : multiEntities}
                onMergeEntity={onMergeEntity} onSelectEntity={onSelectEntity}
                onExitCompare={onExitCompare}/>
            )}

            {/* REVIEW */}
            {derivedMode === "review" && (
              <div className="ent-shell__review" data-ui="EntityTabReview">
                <div className="ent-shell__review__head">
                  <div>
                    <div className="ent-shell__overview__eyebrow">Review queue</div>
                    <div className="ent-shell__overview__title">{reviewItems.length} pending</div>
                  </div>
                  <Btn variant="ghost" size="sm" data-callback="onBackToOverview" onClick={onBackToOverview}>Back</Btn>
                </div>
                <EntityTabReviewQueue items={reviewItems} entityType={entityType}
                  onAcceptQueueItem={onAcceptQueueItem}
                  onEditQueueItem={onEditQueueItem}
                  onMergeQueueItem={onMergeQueueItem}
                  onDenyQueueItem={onDenyQueueItem}/>
              </div>
            )}

            {/* SUGGESTIVE */}
            {derivedMode === "suggestive" && (
              <div className="ent-shell__sugg-mode" data-ui="EntityTabSuggestive">
                <div className="ent-shell__overview__eyebrow">Suggested for {t.plural?.toLowerCase()}</div>
                <div className="ent-shell__overview__title">{suggestions.length} ideas</div>
                <div className="ent-shell__sugg-list">
                  {suggestions.map((s) => (
                    <div key={s.id} className="ent-shell__sugg-card">
                      <div className="ent-shell__sugg-card__head">
                        <ConfidenceBadge level={s.level} value={s.value}/>
                        <span style={{ flex:1, fontSize:"var(--fs-sm)", color:"var(--ink-1)" }}>{s.lbl}</span>
                      </div>
                      {s.excerpt && <div className="ent-shell__sugg-card__ex">"{s.excerpt}"</div>}
                      <div className="ent-shell__sugg-card__actions">
                        <Btn variant="primary" size="sm" data-callback="onRunEntitySuggestion"
                          onClick={() => onRunEntitySuggestion && onRunEntitySuggestion(s)}>Run</Btn>
                        <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit first…</Btn>
                        <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EDIT */}
            {derivedMode === "edit" && selectedEntity && (
              <div className="ent-shell__edit" data-ui="EntityTabEdit">
                <button className="ent-detail__back" onClick={onBackToOverview} data-callback="onCancelEdit">
                  <Icon name="close" size={9}/> Cancel edit
                </button>
                <div className="ent-shell__overview__title">Edit {selectedEntity.name || (t.singular?.toLowerCase())}</div>
                <div className="ent-fields-form">
                  {(selectedEntity.editFields || [
                    { k: "Name", v: selectedEntity.name },
                    { k: "Aliases", v: (selectedEntity.aliases || []).join(", ") },
                    { k: "Subtitle", v: selectedEntity.subtitle },
                    { k: "Status", v: selectedEntity.status },
                    { k: "Summary", v: selectedEntity.summary, multi: true },
                    { k: "Notes", v: selectedEntity.notes, multi: true },
                  ]).map((f) => (
                    <label key={f.k}>
                      <span>{f.k}</span>
                      {f.multi
                        ? <textarea defaultValue={f.v || ""} rows={3}/>
                        : <input defaultValue={f.v || ""}/>}
                    </label>
                  ))}
                </div>
                <div className="ent-shell__edit__actions">
                  <Btn variant="primary" size="sm" data-callback="onSave"
                    onClick={() => onEditEntity && onEditEntity({ id: selectedEntity.id, save: true })}>Save</Btn>
                  <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract</Btn>
                  <Btn variant="outline" size="sm" icon="bolt" data-callback="onSaveAndDeepExtract">Save + Deep Extract</Btn>
                  <span style={{ flex:1 }}/>
                  <Btn variant="ghost" size="sm" data-callback="onCancelEdit" onClick={onBackToOverview}>Cancel</Btn>
                </div>
              </div>
            )}
          </div>

          {/* CONTEXT PANEL — only when there's a selection or queue */}
          {(selectedEntity || reviewItems.length > 0 || suggestions.length > 0) && derivedMode !== "compare" && (
            <EntityContextPanel
              entity={selectedEntity}
              reviewItems={reviewItems}
              suggestions={suggestions}
              related={selectedEntity?.related || []}
              warnings={selectedEntity?.warnings || []}
              recent={selectedEntity?.recent || []}
              mentions={selectedEntity?.mentions || []}
              onAcceptQueueItem={onAcceptQueueItem}
              onEditQueueItem={onEditQueueItem}
              onMergeQueueItem={onMergeQueueItem}
              onDenyQueueItem={onDenyQueueItem}
              onSelectEntity={onSelectEntity}
              onOpenRelatedTab={onOpenRelatedTab}
              onOpenSourceMention={onOpenSourceMention}
              onOpenEntityReviewQueue={onOpenEntityReviewQueue}
              onRunEntitySuggestion={onRunEntitySuggestion}
            />
          )}
        </div>
      )}

      <EntityMergeModal
        open={!!mergeModalOpen}
        sources={mergeModalSources}
        target={mergeModalTarget}
        onCancel={onCancelMerge}
        onMergeEntity={onMergeEntity}
      />
    </div>
  );
};

Object.assign(window, { EntityRoster, EntityTabShell, EntityCompareView });


// ----- entity-framework-host.jsx -----
// =====================================================================
// entity-framework-host.jsx
// EntityFrameworkPanelBody — wrapper that holds the local panel-side
// state (search/view/multi/edit/review/merge) and renders EntityTabShell.
// Designed to be dropped into the DockedPanel body the same way
// CastPanelBody is — siblings of the PanelHeader/toolbar/body markup.
// =====================================================================

const { useState: _useState_efh, useMemo: _useMemo_efh } = React;

const FRAMEWORK_ENTITY_TYPES = new Set([
  "bestiary","locations","items","classes","races","stats","abilities",
  "skills","quests","events","factions","lore","relationships",
  "timeline","references"
]);

const EntityFrameworkPanelBody = ({ panel, onSelectEntity, ...frameworkCallbacks }) => {
  const { entityType } = panel;

  const [search, setSearch]   = _useState_efh("");
  const [view, setView]       = _useState_efh("list");
  const [groupBy, setGroupBy] = _useState_efh("none");
  const [selectedId, setSelectedId] = _useState_efh(null);
  const [multiIds, setMultiIds]     = _useState_efh([]);
  const [multiMode, setMultiMode]   = _useState_efh(false);
  const [editing, setEditing]       = _useState_efh(false);
  const [reviewMode, setReviewMode] = _useState_efh(false);
  const [mergeOpen, setMergeOpen]   = _useState_efh(false);

  const entities    = panel.entities    || (window.ENTITY_SAMPLES?.[entityType])            || [];
  const reviewItems = panel.reviewItems || (window.ENTITY_REVIEW_SAMPLES?.[entityType])     || [];
  const suggestions = panel.suggestions || (window.ENTITY_SUGGESTION_SAMPLES?.[entityType]) || [];
  const queueCount  = panel.queueCount ?? reviewItems.length;

  const filtered = _useMemo_efh(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter((e) =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.subtitle || "").toLowerCase().includes(q));
  }, [entities, search]);

  const selectedEntity = entities.find((e) => e.id === selectedId);
  const multiEntities  = entities.filter((e) => multiIds.includes(e.id));

  // panel.state can override the auto-derived mode (loading/error/empty/review/etc)
  const mode = panel.state === "loading"     ? "loading"
            : panel.state === "error"        ? "error"
            : panel.state === "empty"        ? "empty"
            : panel.state === "review"       ? "review"
            : panel.state === "suggestion"   ? "suggestive"
            : panel.state === "edit"         ? "edit"
            : panel.state === "compare"      ? "compare"
            : reviewMode                      ? "review"
            : editing && selectedEntity       ? "edit"
            : multiMode && multiIds.length    ? "multi"
            : selectedEntity                  ? "selected"
            : "overview";

  return (
    <EntityTabShell
      panel={{ ...panel, queueCount }}
      mode={mode}
      entities={filtered}
      selectedEntity={selectedEntity}
      multiEntities={multiEntities}
      reviewItems={reviewItems}
      suggestions={suggestions}
      search={search}
      view={view}
      groupBy={groupBy}
      onSearchChange={setSearch}
      onViewChange={setView}
      onGroupByChange={setGroupBy}
      onSortChange={() => {}}
      onFilterChange={() => {}}
      onSelectEntity={(e) => { setSelectedId(e.id); setEditing(false); setReviewMode(false); onSelectEntity && onSelectEntity(e); }}
      onBackToOverview={() => { setSelectedId(null); setEditing(false); setReviewMode(false); }}
      onToggleMulti={(e) => setMultiIds((ids) => ids.includes(e.id) ? ids.filter((x) => x !== e.id) : ids.concat(e.id))}
      onEnterMultiMode={() => setMultiMode(true)}
      onExitMultiMode={() => { setMultiMode(false); setMultiIds([]); }}
      onCreateEntity={frameworkCallbacks.onCreateEntity || (() => {})}
      onImportEntity={frameworkCallbacks.onImportEntity || (() => {})}
      onEditEntity={(e) => {
        if (e?.save) { setEditing(false); }
        else { setEditing(true); if (e?.id) setSelectedId(e.id); }
        frameworkCallbacks.onEditEntity && frameworkCallbacks.onEditEntity(e);
      }}
      onDeleteEntityRequest={frameworkCallbacks.onDeleteEntityRequest || (() => {})}
      onMergeEntity={(p) => { setMergeOpen(true); frameworkCallbacks.onMergeEntity && frameworkCallbacks.onMergeEntity(p); }}
      mergeModalOpen={mergeOpen}
      mergeModalSources={multiEntities.length ? multiEntities : (selectedEntity ? [selectedEntity] : [])}
      mergeModalTarget={(multiEntities[0] || selectedEntity)}
      onCancelMerge={() => setMergeOpen(false)}
      onDropEntity={frameworkCallbacks.onDropEntity || (() => {})}
      onDragStartEntity={frameworkCallbacks.onDragStartEntity || (() => {})}
      onOpenRelatedTab={frameworkCallbacks.onOpenRelatedTab || (() => {})}
      onOpenSourceMention={frameworkCallbacks.onOpenSourceMention || (() => {})}
      onOpenEntityReviewQueue={() => { setReviewMode(true); setSelectedId(null); }}
      onAcceptQueueItem={frameworkCallbacks.onAcceptQueueItem || (() => {})}
      onEditQueueItem={frameworkCallbacks.onEditQueueItem || (() => {})}
      onMergeQueueItem={frameworkCallbacks.onMergeQueueItem || (() => {})}
      onDenyQueueItem={frameworkCallbacks.onDenyQueueItem || (() => {})}
      onRunEntitySuggestion={frameworkCallbacks.onRunEntitySuggestion || (() => {})}
      onCompareEntities={frameworkCallbacks.onCompareEntities || (() => {})}
      onExitCompare={() => { setMultiIds([]); setMultiMode(false); }}
      onRetry={() => {}}
    />
  );
};

Object.assign(window, { EntityFrameworkPanelBody, FRAMEWORK_ENTITY_TYPES });


// ----- panels.jsx -----
// =====================================================================
// panels.jsx — SlidingPanel + PanelHeader + panel state demos
// =====================================================================

const { useState: _useState_p, useMemo: _useMemo_p } = React;

// ---------------------------------------------------------------------
// PanelHeader
// ---------------------------------------------------------------------
const PanelHeader = ({
  entityType, icon = "stack",
  title, subtitle,
  pinned, expanded,
  onPinPanel, onExpandPanel, onClosePanel, onMore,
}) => {
  const t = entityType ? ENTITY_TYPES[entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};
  return (
    <div className="panel__head" data-ui="PanelHeader" style={style}>
      <div className="panel__head__entity">
        <div className="panel__head__entity-icon">
          {t ? <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>{t.glyph}</span> : <Icon name={icon} size={14}/>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="panel__head__title">{title}</div>
          {subtitle && <div className="panel__head__sub">{subtitle}</div>}
        </div>
      </div>
      <div className="panel__head__actions">
        <Btn variant="ghost" size="sm" icon="pin-tack" aria-pressed={pinned}
          className={pinned ? "is-active" : ""}
          onClick={onPinPanel} data-callback="onPinPanel" title="Pin panel"/>
        <Btn variant="ghost" size="sm" icon="expand" aria-pressed={expanded}
          className={expanded ? "is-active" : ""}
          onClick={onExpandPanel} data-callback="onExpandPanel" title="Expand"/>
        <Btn variant="ghost" size="sm" icon="more" onClick={onMore} data-callback="onMorePanel" title="More"/>
        <Btn variant="ghost" size="sm" icon="close" onClick={onClosePanel} data-callback="onClosePanel" title="Close"/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SlidingPanel — dispatcher. For supported entity types (everything
// except "cast", which has its own bespoke panel), defers to
// EntityTabShell from the shared entity framework.
// ---------------------------------------------------------------------
const FRAMEWORK_TYPES = new Set(["bestiary","locations","items","classes","races","stats","abilities","skills","quests","events","factions","lore","relationships","timeline","references"]);

const SlidingPanel = ({
  panel, onClosePanel, onPinPanel, onExpandPanel, onOpenReviewQueue, onSelectEntity,
  ...frameworkCallbacks
}) => {
  const { id, entityType, title, subtitle, state = "overview", pinned, expanded } = panel;
  const useAtlas = entityType === "atlas";
  const useFramework = !useAtlas && entityType && FRAMEWORK_TYPES.has(entityType);

  // ---- Framework-mode local state (search/view/multi/edit) ----
  const [search, setSearch]   = _useState_p("");
  const [view, setView]       = _useState_p("list");
  const [groupBy, setGroupBy] = _useState_p("none");
  const [selectedId, setSelectedId] = _useState_p(null);
  const [multiIds, setMultiIds]     = _useState_p([]);
  const [multiMode, setMultiMode]   = _useState_p(false);
  const [editing, setEditing]       = _useState_p(false);
  const [reviewMode, setReviewMode] = _useState_p(false);
  const [mergeOpen, setMergeOpen]   = _useState_p(false);

  const entities = useFramework ? (panel.entities || (window.ENTITY_SAMPLES?.[entityType]) || []) : [];
  const reviewItems = useFramework ? (panel.reviewItems || (window.ENTITY_REVIEW_SAMPLES?.[entityType]) || []) : [];
  const suggestions = useFramework ? (panel.suggestions || (window.ENTITY_SUGGESTION_SAMPLES?.[entityType]) || []) : [];
  const queueCount = panel.queueCount ?? reviewItems.length;

  const filtered = _useMemo_p(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter((e) =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.subtitle || "").toLowerCase().includes(q));
  }, [entities, search]);

  const selectedEntity = useFramework ? entities.find((e) => e.id === selectedId) : null;
  const multiEntities = useFramework ? entities.filter((e) => multiIds.includes(e.id)) : [];

  // Allow panel.state to force a mode for demos (loading/error/empty/review/etc)
  const modeOverride = useFramework
    ? (state === "loading" ? "loading"
      : state === "error" ? "error"
      : state === "empty" ? "empty"
      : state === "review" ? "review"
      : state === "suggestion" ? "suggestive"
      : state === "edit" ? "edit"
      : state === "compare" ? "compare"
      : reviewMode ? "review"
      : editing && selectedEntity ? "edit"
      : multiMode && multiIds.length > 0 ? "multi"
      : selectedEntity ? "selected"
      : (filtered.length === 0 && !search) ? "overview"
      : "overview")
    : null;

  return (
    <section
      className={"panel " + (expanded ? "is-expanded" : "")}
      data-ui="SlidingPanel"
      data-panel-id={id}
      data-state={state}
      role="dialog"
      aria-label={title}
    >
      <PanelHeader
        entityType={entityType}
        icon={panel.icon}
        title={title}
        subtitle={subtitle}
        pinned={pinned}
        expanded={expanded}
        onPinPanel={() => onPinPanel(id)}
        onExpandPanel={() => onExpandPanel(id)}
        onClosePanel={() => onClosePanel(id)}
      />

      <div className="panel__body">
        {useAtlas ? (
          <AtlasPanelBody panel={panel}/>
        ) : useFramework ? (
          <EntityTabShell
            panel={{ ...panel, queueCount }}
            mode={modeOverride}
            entities={filtered}
            selectedEntity={selectedEntity}
            multiEntities={multiEntities}
            reviewItems={reviewItems}
            suggestions={suggestions}
            search={search}
            view={view}
            groupBy={groupBy}
            onSearchChange={setSearch}
            onViewChange={setView}
            onGroupByChange={setGroupBy}
            onSortChange={() => {}}
            onFilterChange={() => {}}
            onSelectEntity={(e) => { setSelectedId(e.id); setEditing(false); setReviewMode(false); onSelectEntity && onSelectEntity(e); }}
            onBackToOverview={() => { setSelectedId(null); setEditing(false); setReviewMode(false); }}
            onToggleMulti={(e) => setMultiIds((ids) => ids.includes(e.id) ? ids.filter((x) => x !== e.id) : ids.concat(e.id))}
            onEnterMultiMode={() => setMultiMode(true)}
            onExitMultiMode={() => { setMultiMode(false); setMultiIds([]); }}
            onCreateEntity={frameworkCallbacks.onCreateEntity || (() => {})}
            onImportEntity={frameworkCallbacks.onImportEntity || (() => {})}
            onEditEntity={(e) => { if (e?.save) { setEditing(false); } else { setEditing(true); if (e?.id) setSelectedId(e.id); } frameworkCallbacks.onEditEntity && frameworkCallbacks.onEditEntity(e); }}
            onDeleteEntityRequest={frameworkCallbacks.onDeleteEntityRequest || (() => {})}
            onMergeEntity={(p) => { setMergeOpen(true); frameworkCallbacks.onMergeEntity && frameworkCallbacks.onMergeEntity(p); }}
            mergeModalOpen={mergeOpen}
            mergeModalSources={multiEntities.length ? multiEntities : (selectedEntity ? [selectedEntity] : [])}
            mergeModalTarget={(multiEntities[0] || selectedEntity)}
            onCancelMerge={() => setMergeOpen(false)}
            onDropEntity={frameworkCallbacks.onDropEntity || (() => {})}
            onDragStartEntity={frameworkCallbacks.onDragStartEntity || (() => {})}
            onOpenRelatedTab={frameworkCallbacks.onOpenRelatedTab || (() => {})}
            onOpenSourceMention={frameworkCallbacks.onOpenSourceMention || (() => {})}
            onOpenEntityReviewQueue={() => { setReviewMode(true); setSelectedId(null); }}
            onAcceptQueueItem={frameworkCallbacks.onAcceptQueueItem || (() => {})}
            onEditQueueItem={frameworkCallbacks.onEditQueueItem || (() => {})}
            onMergeQueueItem={frameworkCallbacks.onMergeQueueItem || (() => {})}
            onDenyQueueItem={frameworkCallbacks.onDenyQueueItem || (() => {})}
            onRunEntitySuggestion={frameworkCallbacks.onRunEntitySuggestion || (() => {})}
            onCompareEntities={frameworkCallbacks.onCompareEntities || (() => {})}
            onExitCompare={() => { setMultiIds([]); setMultiMode(false); }}
            onRetry={() => {}}
          />
        ) : (
          <>
            <div className="panel__toolbar">
              <div className="panel__search">
                <Icon name="search" size={12}/>
                <span style={{ flex: 1 }}>Search in {title.toLowerCase()}…</span>
              </div>
              <Btn variant="ghost" size="sm" icon="filter" title="Filter" data-callback="onFilterPanel"/>
              <Btn variant="ghost" size="sm" icon="sort" title="Sort" data-callback="onSortPanel"/>
              <Btn variant="ghost" size="sm" icon="bell" title="Review queue"
                onClick={onOpenReviewQueue} data-callback="onOpenReviewQueue"/>
            </div>
            {state === "overview"   && <PanelOverview panel={panel} onSelectEntity={onSelectEntity}/>}
            {state === "selected"   && <PanelSelected panel={panel}/>}
            {state === "multi"      && <PanelMulti panel={panel}/>}
            {state === "empty"      && <EmptyState icon={panel.icon || "paper"} title={"No " + title.toLowerCase() + " yet"} body="Create your first entry, or extract from the manuscript." action={<Btn variant="primary" size="sm" icon="plus" data-callback="onCreateEntity">Create</Btn>}/>}
            {state === "loading"    && <LoadingState title={"Loading " + title.toLowerCase() + "…"} lines={4}/>}
            {state === "error"      && <ErrorState title="Couldn't load panel" body="Local index unreachable. Your data is safe." onRetry={() => {}}/>}
            {state === "review"     && <PanelReview panel={panel}/>}
            {state === "edit"       && <PanelEdit panel={panel}/>}
            {state === "suggestion" && <PanelSuggestion panel={panel}/>}
          </>
        )}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// Panel state contents (presentational placeholders)
// ---------------------------------------------------------------------
const PanelOverview = ({ panel, onSelectEntity }) => {
  const rows = panel.rows || [];
  if (!rows.length) return <EmptyState icon={panel.icon} title="Empty" body="Create or extract entries to populate this panel."/>;
  return (
    <div className="panel__list">
      {rows.map((r) => (
        <div
          key={r.id}
          className={"panel__list-row " + (r.selected ? "is-selected" : "")}
          data-callback="onSelectEntity"
          onClick={() => onSelectEntity && onSelectEntity(r)}
        >
          {panel.entityType && <EntityTypeBadge type={panel.entityType} size="xs" showLabel={false}/>}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          {r.queue && <ReviewCountBadge count={r.queue}/>}
          <span className="panel__list-row__sub">{r.meta}</span>
        </div>
      ))}
    </div>
  );
};

const PanelSelected = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", color: "var(--ink-1)" }}>{panel.selected?.label || "Aelinor Vey"}</div>
    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)" }}>"…the small dark queen of the Pale Reach."</div>
    <div className="hr"/>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <EntityTypeBadge type={panel.entityType || "cast"} size="xs"/>
      <span className="chip chip--neutral">12 mentions</span>
      <span className="chip chip--neutral">Ch. 1–7</span>
    </div>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
      Detail body placeholder — fields, relationships, mentions list, and timeline plug in here.
    </div>
  </div>
);

const PanelMulti = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>3 entities selected</div>
    <div className="hr"/>
    <div className="panel__list">
      {["Aelinor Vey", "Saren of Hess", "Captain Brec"].map((n) => (
        <div key={n} className="panel__list-row is-selected">
          <EntityTypeBadge type="cast" size="xs" showLabel={false}/>
          <span style={{ flex: 1 }}>{n}</span>
          <Icon name="check" size={12}/>
        </div>
      ))}
    </div>
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <Btn variant="outline" size="sm" icon="link" data-callback="onMergeEntity">Merge</Btn>
      <Btn variant="outline" size="sm" icon="bookmark" data-callback="onTagEntities">Tag</Btn>
      <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntities">Delete</Btn>
    </div>
  </div>
);

const PanelReview = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {[
      { lvl: "high",      v: 96, lbl: "Auto-added: Captain Brec (Cast)" },
      { lvl: "strong",    v: 84, lbl: "Suggest: Pale Reach (Location)" },
      { lvl: "uncertain", v: 61, lbl: "Merge: Saren ↔ Saren of Hess?" },
      { lvl: "weak",      v: 38, lbl: "New item: Bone Auger?" },
    ].map((r, i) => (
      <div key={i} className="rightrail__card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConfidenceBadge level={r.lvl} value={r.v}/>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>{r.lbl}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
          <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
          <Btn variant="outline" size="sm" data-callback="onMergeQueueItem">Merge</Btn>
          <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Deny</Btn>
        </div>
      </div>
    ))}
  </div>
);

const PanelEdit = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {[
      ["Name", "Aelinor Vey"],
      ["Title", "Queen of the Pale Reach"],
      ["First seen", "Ch. 1, p. 12"],
      ["Affiliation", "House Vey"],
    ].map(([k, v]) => (
      <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", fontWeight: 600 }}>{k}</span>
        <input defaultValue={v} style={{
          padding: "8px 10px",
          background: "var(--bg-paper)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-2)",
          fontFamily: "var(--font-serif)",
          fontSize: "var(--fs-md)",
          color: "var(--ink-1)",
        }}/>
      </label>
    ))}
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <Btn variant="primary" size="sm" data-callback="onSave">Save</Btn>
      <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract</Btn>
      <Btn variant="ghost" size="sm" data-callback="onCancelEdit">Cancel</Btn>
    </div>
  </div>
);

const PanelSuggestion = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>Suggested from this chapter:</div>
    {[
      { type: "cast",      lvl: "strong",    v: 81, lbl: "Saren of Hess" },
      { type: "locations", lvl: "uncertain", v: 58, lbl: "The Glass Court" },
      { type: "items",     lvl: "weak",      v: 31, lbl: "Auger of Hess" },
    ].map((s, i) => (
      <div key={i} className="rightrail__card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <EntityTypeBadge type={s.type} size="xs"/>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>{s.lbl}</span>
          <ConfidenceBadge level={s.lvl} value={s.v}/>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
          <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
          <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Deny</Btn>
        </div>
      </div>
    ))}
  </div>
);

Object.assign(window, { SlidingPanel, PanelHeader });


// ----- cast.jsx -----
// =====================================================================
// cast.jsx — Cast panel body. Plugged into SlidingPanel/DockedPanel
// when entityType === "cast". Renders all cast UX modes:
//   - browse list (with filters, group-by, mention sparkline)
//   - detail (selected character: hero, identity, traits,
//     relationships, mention timeline, quotes)
//   - multi-select (bulk merge / tag / delete)
//   - edit form
//   - review queue (extraction-detected cast suggestions)
//   - suggestion strip
//   - empty / loading / error
// =====================================================================

const { useState: _us_cast, useMemo: _um_cast, useCallback: _uc_cast } = React;

// ---------------------------------------------------------------------
// Sample cast records — used only when panel.cast is undefined so the
// panel has something rich to show on first paint. App can override by
// setting panel.cast = [...].
// ---------------------------------------------------------------------
const CAST_SAMPLE = [
  {
    id: "c1", name: "Aelinor Vey", initials: "AV",
    role: "protagonist", status: "alive", queue: 0,
    title: "Queen of the Pale Reach",
    epithet: "the small dark queen of the Pale Reach",
    affiliation: "House Vey", origin: "Pale Reach",
    firstSeen: "Ch. 1, p. 12", lastSeen: "Ch. 7, p. 188",
    chapterRange: "Ch. 1–7",
    age: "twenty-nine winters", pronouns: "she/her",
    traits: [
      { label: "watchful", tone: "positive" },
      { label: "patient", tone: "positive" },
      { label: "secret-keeping", tone: "negative" },
      { label: "dry-witted" },
    ],
    relationships: [
      { id: "c2", name: "Saren of Hess", initials: "SH", kind: "rival", strength: 4 },
      { id: "c3", name: "Captain Brec", initials: "CB", kind: "loyal-to", strength: 3 },
      { id: "c5", name: "Mara of Hess", initials: "MH", kind: "sister-in-law", strength: 2 },
    ],
    mentionsByChapter: [12, 8, 4, 7, 3, 9, 14, 6, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "She had learned to wait. Pale Reach taught patience the way the sea taught salt.", cite: "Ch. 1, p. 14" },
      { text: "\"Bring me the auger,\" Aelinor said, \"and the man who carries it.\"", cite: "Ch. 7, p. 188" },
    ],
    summary: "Reigning queen of the Pale Reach. Inherits the Auger crisis from her father; opens negotiations with House Hess in Ch. 3 and breaks them in Ch. 7.",
    stats: [
      { k: "Resolve",   v: 9, max: 10 },
      { k: "Cunning",   v: 8, max: 10 },
      { k: "Compassion",v: 5, max: 10 },
      { k: "Martial",   v: 4, max: 10 },
    ],
    abilities: [
      { name: "Court tongue", desc: "Reads a room before a room knows it is read.", source: "Established Ch. 1" },
      { name: "Salt-bearing", desc: "Endures the Reach's winter without complaint.", source: "Implied Ch. 2" },
      { name: "Letter-locking", desc: "Can fold a paper such that no eye but the recipient's may open it whole.", source: "Ch. 5" },
    ],
    skillTree: {
      branches: [
        { name: "Diplomacy",  nodes: [
          { name: "Listen",       state: "mastered" },
          { name: "Hold the floor",state: "mastered" },
          { name: "Bind a treaty",state: "earned"   },
          { name: "Break a treaty",state: "emerging"},
        ]},
        { name: "Statecraft", nodes: [
          { name: "Read the ledger", state: "mastered" },
          { name: "Spend the granary",state: "earned" },
          { name: "Coin a new house", state: "locked" },
        ]},
      ],
    },
    inventory: [
      { name: "The Vey signet",     kind: "regalia",  notable: true,  note: "Worn since the coronation. Unbroken." },
      { name: "Father's bone-knife",kind: "weapon",   notable: true,  note: "Carried since Ch. 1. Drawn once, in Ch. 7." },
      { name: "Saren's first letter",kind: "document", notable: false, note: "Kept in the inner desk." },
      { name: "Salt cloak",          kind: "garment",  notable: false, note: null },
    ],
    relatedAtlas: [{ id: "a1", label: "Pale Reach" }, { id: "a2", label: "Vraska Pass" }],
    relatedTimeline: [{ id: "t2", label: "Brec's letter" }],
  },
  {
    id: "c2", name: "Saren of Hess", initials: "SH",
    role: "antagonist", status: "alive", queue: 1,
    title: "Heir of Hess",
    epithet: "all teeth and tallow-smile",
    affiliation: "House Hess", origin: "Hess",
    firstSeen: "Ch. 3, p. 67", lastSeen: "Ch. 7, p. 192",
    chapterRange: "Ch. 3–7",
    age: "thirty-four", pronouns: "he/him",
    traits: [
      { label: "ambitious", tone: "negative" },
      { label: "well-spoken", tone: "positive" },
      { label: "resentful", tone: "negative" },
    ],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "rival", strength: 4 },
      { id: "c5", name: "Mara of Hess", initials: "MH", kind: "sister", strength: 3 },
    ],
    mentionsByChapter: [0, 0, 6, 11, 5, 8, 9, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "\"The Reach has had its years,\" he told the auger. \"Now Hess takes the next.\"", cite: "Ch. 4, p. 102" },
    ],
    summary: "Heir to House Hess; gambit-runner. Suspected source of the leaked auger letters in Ch. 6.",
    stats: [
      { k: "Resolve",   v: 6, max: 10 },
      { k: "Cunning",   v: 9, max: 10 },
      { k: "Compassion",v: 2, max: 10 },
      { k: "Martial",   v: 7, max: 10 },
    ],
    abilities: [
      { name: "Tallow-smile", desc: "Disarms a stranger inside three sentences.", source: "Ch. 3" },
      { name: "Letter-cracking", desc: "Opens what was meant to be sealed; leaves no obvious mark.", source: "Ch. 6" },
    ],
    skillTree: {
      branches: [
        { name: "Court", nodes: [
          { name: "Charm",     state: "mastered" },
          { name: "Goad",      state: "mastered" },
          { name: "Conspire",  state: "earned" },
        ]},
        { name: "Blade", nodes: [
          { name: "Train",     state: "earned" },
          { name: "Best a peer",state: "emerging" },
        ]},
      ],
    },
    inventory: [
      { name: "Hess sigil-ring", kind: "regalia", notable: true, note: "Twin to Mara's." },
      { name: "Pale Reach map",  kind: "document", notable: true, note: "Annotated. How did he come by it?" },
      { name: "Slim dagger",      kind: "weapon", notable: false, note: null },
    ],
    relatedAtlas: [{ id: "a3", label: "Hess" }],
    relatedTimeline: [],
  },
  {
    id: "c3", name: "Captain Brec", initials: "CB",
    role: "supporting", status: "alive", queue: 0,
    title: "Captain of the Reach Watch",
    epithet: "broad as a barn-door, soft as wet rope",
    affiliation: "Pale Reach", origin: "Vraska Pass",
    firstSeen: "Ch. 2, p. 41", lastSeen: "Ch. 5, p. 144",
    chapterRange: "Ch. 2–5",
    age: "forty-one", pronouns: "he/him",
    traits: [
      { label: "loyal", tone: "positive" },
      { label: "homesick", tone: "negative" },
      { label: "blunt", tone: "positive" },
    ],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "sworn-to", strength: 4 },
    ],
    mentionsByChapter: [0, 4, 6, 5, 7, 0, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "Brec said nothing for a long while. Then: \"I'll go. I won't like it.\"", cite: "Ch. 5, p. 144" },
    ],
    summary: "Captain of the Reach Watch; Aelinor's right hand. Carries the Ch. 5 letter to Hess at personal cost.",
  },
  {
    id: "c4", name: "The Auger", initials: "TA",
    role: "minor", status: "unknown", queue: 0,
    title: null,
    epithet: "the man who reads the bone",
    affiliation: null, origin: null,
    firstSeen: "Ch. 7, p. 184", lastSeen: "Ch. 7, p. 199",
    chapterRange: "Ch. 7",
    age: "uncertain", pronouns: "they/them",
    traits: [{ label: "ominous" }, { label: "ambiguous" }],
    relationships: [],
    mentionsByChapter: [0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "The auger did not look at the queen. The auger did not look at anything one could name.", cite: "Ch. 7, p. 186" },
    ],
    summary: "Bone-reader summoned in Ch. 7. Identity, faction, and motive all unconfirmed.",
  },
  {
    id: "c5", name: "Mara of Hess", initials: "MH",
    role: "supporting", status: "alive", queue: 0,
    title: "Lady of the Hess",
    epithet: "kinder than her brother by half",
    affiliation: "House Hess", origin: "Hess",
    firstSeen: "Ch. 4, p. 91", lastSeen: "Ch. 4, p. 96",
    chapterRange: "Ch. 4",
    age: "twenty-six", pronouns: "she/her",
    traits: [{ label: "warm", tone: "positive" }, { label: "torn" }],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "sister-in-law", strength: 2 },
      { id: "c2", name: "Saren of Hess", initials: "SH", kind: "sister", strength: 3 },
    ],
    mentionsByChapter: [0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [],
    summary: "Saren's younger sister. Possible bridge between the Houses; underused so far.",
  },
  {
    id: "c6", name: "Dav the Quiet", initials: "DQ",
    role: "minor", status: "dead", queue: 1,
    title: null,
    epithet: "the boy who carried letters",
    affiliation: "Pale Reach", origin: "Reach docks",
    firstSeen: "Ch. 6, p. 162", lastSeen: "Ch. 6, p. 171",
    chapterRange: "Ch. 6",
    age: "fifteen", pronouns: "he/him",
    traits: [{ label: "small" }, { label: "watchful", tone: "positive" }],
    relationships: [{ id: "c3", name: "Captain Brec", initials: "CB", kind: "ward-of", strength: 2 }],
    mentionsByChapter: [0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [{ text: "Dav the Quiet was found at the dock-foot, the letter still in his collar.", cite: "Ch. 6, p. 171" }],
    summary: "Letter-runner. Killed in Ch. 6; the letter triggers Brec's ride.",
  },
];

// Suggestion items (extraction-detected cast not yet confirmed)
const CAST_SUGGESTIONS_SAMPLE = [
  { id: "s1", name: "The Auger of Hess", level: "uncertain", value: 61,
    excerpt: "She remembered now — the boy had spoken of <mark>the Auger of Hess</mark>, his eyes wide as plates.",
    cite: "Ch. 7, p. 191", reason: "Compound-name match with existing 'The Auger'. Possible merge." },
  { id: "s2", name: "Sister Vell", level: "strong", value: 84,
    excerpt: "<mark>Sister Vell</mark> brought tea and waited, hands folded in the way of the Order.",
    cite: "Ch. 5, p. 138", reason: "New named figure; appears once but addressed by title." },
  { id: "s3", name: "the bone-cutter", level: "weak", value: 31,
    excerpt: "Brec had once known <mark>the bone-cutter</mark> from his Vraska days, a man of small jokes.",
    cite: "Ch. 5, p. 142", reason: "Definite article + role; may be a referent rather than a person." },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const ROLE_ORDER = ["protagonist", "antagonist", "supporting", "minor"];
const ROLE_LABEL = {
  protagonist: "Protagonist",
  antagonist:  "Antagonist",
  supporting:  "Supporting",
  minor:       "Minor",
};
const REL_KIND_LABEL = {
  "rival":         "Rival",
  "loyal-to":      "Loyal to",
  "sworn-to":      "Sworn to",
  "sister":        "Sister",
  "sister-in-law": "Sister-in-law",
  "ward-of":       "Ward of",
};

// Sparkline (12 chapters)
const CastSpark = ({ data, current }) => {
  const max = Math.max(1, ...data);
  return (
    <div className="cast-row__spark" aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          className="cast-row__spark__bar"
          style={{ height: Math.max(2, (v / max) * 14) + "px", opacity: v === 0 ? 0.25 : 1 }}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastRow — single character row in the browse list
// ---------------------------------------------------------------------
const CastRow = ({ c, isSelected, isMulti, multiMode, onSelect, onToggleMulti }) => {
  const onClick = (e) => {
    if (multiMode) { onToggleMulti && onToggleMulti(c); return; }
    if (e.metaKey || e.ctrlKey) { onToggleMulti && onToggleMulti(c, true); return; }
    onSelect && onSelect(c);
  };
  return (
    <div
      className={"cast-row" + (isSelected ? " is-selected" : "") + (isMulti ? " is-multi" : "")}
      data-ui="CastRow"
      data-cast-id={c.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      <div className="cast-row__check" aria-hidden>{isMulti && <Icon name="check" size={10}/>}</div>
      <div className={"cast-row__monogram" + (c.status === "unknown" ? " cast-row__monogram--unknown" : "")}>
        {c.initials || "?"}
        <span className={"cast-row__monogram__status cast-row__monogram__status--" + c.status}/>
      </div>
      <div className="cast-row__identity">
        <span className="cast-row__name">{c.name}</span>
        <span className={"cast-row__role cast-row__role--" + c.role}>{ROLE_LABEL[c.role] || c.role}</span>
      </div>
      <div className="cast-row__subline">{c.epithet || c.title || c.summary}</div>
      <div className="cast-row__meta">
        <span className="cast-row__chapters">{c.chapterRange}</span>
        <CastSpark data={c.mentionsByChapter || []} current={c.currentChapter}/>
        <div className="cast-row__badges">
          {c.queue ? <ReviewCountBadge count={c.queue}/> : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastBrowse — the list with filters + group-by-role + multi-select bar
// ---------------------------------------------------------------------
const CastBrowse = ({ cast, selectedId, multiSelected, multiMode, onSelect, onToggleMulti, onClearMulti, onMergeMulti, onTagMulti, onDeleteMulti, onCreate, onEnterMultiMode }) => {
  const [tab, setTab] = _us_cast("browse"); // browse | review | suggestions
  const [statusFilter, setStatusFilter] = _us_cast("all"); // all | alive | dead | missing | unknown
  const [groupBy, setGroupBy] = _us_cast("role"); // role | none | status

  const filtered = _um_cast(() => {
    if (statusFilter === "all") return cast;
    return cast.filter((c) => c.status === statusFilter);
  }, [cast, statusFilter]);

  const grouped = _um_cast(() => {
    if (groupBy === "none") return [{ key: "all", label: null, items: filtered }];
    if (groupBy === "status") {
      const order = ["alive", "missing", "unknown", "dead"];
      const lbl = { alive: "Living", missing: "Missing", unknown: "Unconfirmed", dead: "Dead" };
      return order.map((k) => ({ key: k, label: lbl[k], items: filtered.filter((c) => c.status === k) }))
                  .filter((g) => g.items.length);
    }
    return ROLE_ORDER.map((r) => ({ key: r, label: ROLE_LABEL[r], items: filtered.filter((c) => c.role === r) }))
                     .filter((g) => g.items.length);
  }, [filtered, groupBy]);

  const reviewCount = cast.reduce((a, c) => a + (c.queue || 0), 0);
  const suggestionCount = CAST_SUGGESTIONS_SAMPLE.length;

  return (
    <div className={"cast" + (multiMode ? " is-multi-mode" : "")}>
      {/* Sub-tabs */}
      <div className="cast__subtabs" role="tablist">
        <button className={"cast__subtab" + (tab === "browse" ? " is-active" : "")} onClick={() => setTab("browse")}>
          Browse <span className="cast__subtab__count">{cast.length}</span>
        </button>
        <button className={"cast__subtab" + (tab === "review" ? " is-active" : "")} onClick={() => setTab("review")}>
          Review {reviewCount ? <span className="cast__subtab__count">{reviewCount}</span> : null}
        </button>
        <button className={"cast__subtab" + (tab === "suggestions" ? " is-active" : "")} onClick={() => setTab("suggestions")}>
          Suggested <span className="cast__subtab__count">{suggestionCount}</span>
        </button>
      </div>

      {tab === "browse" && (
        <>
          {/* Filter bar */}
          <div className="cast__filterbar">
            <span className="cast__filterbar__lbl">Status</span>
            {["all", "alive", "missing", "unknown", "dead"].map((s) => (
              <button key={s}
                className={"cast__filter-chip" + (statusFilter === s ? " is-active" : "")}
                onClick={() => setStatusFilter(s)}
              >{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>
            ))}
            <span style={{ flex: 1 }}/>
            <span className="cast__filterbar__lbl">Group</span>
            {[["role","Role"], ["status","Status"], ["none","Flat"]].map(([k, l]) => (
              <button key={k}
                className={"cast__filter-chip" + (groupBy === k ? " is-active" : "")}
                onClick={() => setGroupBy(k)}
              >{l}</button>
            ))}
          </div>

          {/* Groups & rows */}
          {grouped.map((g) => (
            <div key={g.key}>
              {g.label && (
                <div className="cast__group-label">
                  <span>{g.label}</span>
                  <span className="cast__group-label__count">{g.items.length}</span>
                  <span className="cast__group-label__rule"/>
                </div>
              )}
              <div className="cast__list">
                {g.items.map((c) => (
                  <CastRow key={c.id} c={c}
                    isSelected={c.id === selectedId}
                    isMulti={multiSelected && multiSelected.has(c.id)}
                    multiMode={multiMode}
                    onSelect={onSelect}
                    onToggleMulti={(c, enterMulti) => {
                      if (enterMulti && !multiMode) onEnterMultiMode && onEnterMultiMode();
                      onToggleMulti && onToggleMulti(c);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Multi-select sticky action bar */}
          {multiMode && multiSelected && multiSelected.size > 0 && (
            <div className="cast-multibar" data-ui="CastMultiBar">
              <div className="cast-multibar__count"><strong>{multiSelected.size}</strong> selected</div>
              <Btn variant="outline" size="sm" icon="link" onClick={onMergeMulti} data-callback="onMergeEntity">Merge</Btn>
              <Btn variant="outline" size="sm" icon="bookmark" onClick={onTagMulti} data-callback="onTagEntities">Tag</Btn>
              <Btn variant="ghost" size="sm" icon="trash" onClick={onDeleteMulti} data-callback="onDeleteEntities">Delete</Btn>
              <Btn variant="ghost" size="sm" icon="close" onClick={onClearMulti} title="Cancel multi-select"/>
            </div>
          )}
        </>
      )}

      {tab === "review" && <CastReviewList cast={cast.filter((c) => c.queue)}/>}
      {tab === "suggestions" && <CastSuggestionList items={CAST_SUGGESTIONS_SAMPLE}/>}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastDetail — selected character page
// ---------------------------------------------------------------------
const CastDetail = ({ c, onBack, onEdit }) => {
  if (!c) return null;
  return (
    <div className="cast cast-detail" data-ui="CastDetail" data-cast-id={c.id}>
      <button className="cast-detail__back" onClick={onBack} data-callback="onBackToList">
        <Icon name="close" size={9}/> Back to all cast
      </button>

      {/* Hero */}
      <div className="cast-detail__hero">
        <div className="cast-detail__portrait">{c.initials}</div>
        <div className="cast-detail__hero__body">
          <div className="cast-detail__name">{c.name}</div>
          <div className="cast-detail__title-line">{c.epithet || c.title}</div>
          <div className="cast-detail__meta-row">
            <span className={"cast-row__role cast-row__role--" + c.role}>{ROLE_LABEL[c.role]}</span>
            <span className="chip chip--neutral">{c.chapterRange}</span>
            <span className="chip chip--neutral">{(c.mentionsByChapter || []).reduce((a, b) => a + b, 0)} mentions</span>
            {c.queue ? <ReviewCountBadge count={c.queue}/> : null}
          </div>
        </div>
      </div>

      {/* Summary */}
      {c.summary && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Summary</span>
            <button className="cast-section__action" onClick={onEdit} data-callback="onEditEntity">Edit</button>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
            {c.summary}
          </div>
        </div>
      )}

      {/* Identity facts */}
      <div className="cast-section">
        <div className="cast-section__head">
          <span className="cast-section__title">Identity</span>
        </div>
        <div className="cast-fields">
          {c.title       && (<><div className="cast-fields__k">Title</div><div className="cast-fields__v">{c.title}</div></>)}
          {c.affiliation && (<><div className="cast-fields__k">Affiliation</div><div className="cast-fields__v">{c.affiliation}</div></>)}
          {c.origin      && (<><div className="cast-fields__k">Origin</div><div className="cast-fields__v">{c.origin}</div></>)}
          {c.age         && (<><div className="cast-fields__k">Age</div><div className="cast-fields__v">{c.age}</div></>)}
          {c.pronouns    && (<><div className="cast-fields__k">Pronouns</div><div className="cast-fields__v">{c.pronouns}</div></>)}
          <div className="cast-fields__k">First seen</div><div className="cast-fields__v">{c.firstSeen}</div>
          <div className="cast-fields__k">Last seen</div><div className="cast-fields__v">{c.lastSeen}</div>
        </div>
      </div>

      {/* Traits */}
      {c.traits && c.traits.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Traits</span>
            <button className="cast-section__action" data-callback="onAddTrait">+ Add</button>
          </div>
          <div className="cast-traits">
            {c.traits.map((t, i) => (
              <span key={i} className={"cast-trait" + (t.tone ? " cast-trait--" + t.tone : "")}>{t.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {c.relationships && c.relationships.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Relationships</span>
            <button className="cast-section__action" data-callback="onAddRelationship">+ Link</button>
          </div>
          <div className="cast-rels">
            {c.relationships.map((r) => (
              <div key={r.id} className="cast-rel" data-callback="onSelectRelated">
                <div className="cast-rel__avatar">{r.initials}</div>
                <div className="cast-rel__lbl">
                  <span className="cast-rel__name">{r.name}</span>
                  <span className="cast-rel__kind">{REL_KIND_LABEL[r.kind] || r.kind}</span>
                </div>
                <div className="cast-rel__strength" title={"Strength " + r.strength + "/4"}>
                  {[1,2,3,4].map((i) => (
                    <span key={i} className={"cast-rel__strength__pip" + (i <= r.strength ? " is-on" : "")}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mention timeline */}
      {c.mentionsByChapter && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Mentions across the manuscript</span>
            <button className="cast-section__action" data-callback="onJumpManuscript">Jump to first</button>
          </div>
          <div className="cast-mentions">
            <div className="cast-mentions__strip">
              {c.mentionsByChapter.map((v, i) => {
                const max = Math.max(1, ...c.mentionsByChapter);
                const h = v === 0 ? 8 : Math.max(8, (v / max) * 28);
                return (
                  <div key={i}
                    className={"cast-mentions__bar" + (v === 0 ? " is-empty" : "") + ((i + 1) === c.currentChapter ? " is-current" : "")}
                    style={{ height: h + "px" }}
                    title={"Ch. " + (i + 1) + " — " + v + " mention" + (v === 1 ? "" : "s")}
                  />
                );
              })}
            </div>
            <div className="cast-mentions__axis">
              <span>Ch. 1</span>
              <span>Ch. {c.mentionsByChapter.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quotes */}
      {c.quotes && c.quotes.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Selected lines</span>
            <button className="cast-section__action" data-callback="onShowAllQuotes">All ({c.quotes.length})</button>
          </div>
          <div className="cast-quotes">
            {c.quotes.map((q, i) => (
              <div key={i} className="cast-quote" data-callback="onJumpQuote">
                "{q.text}"
                <span className="cast-quote__cite">{q.cite}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {c.stats && c.stats.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Stats</span>
            <button className="cast-section__action" data-callback="onEditStats">Edit</button>
          </div>
          <CastStats stats={c.stats}/>
        </div>
      )}

      {/* Abilities */}
      {c.abilities && c.abilities.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Abilities</span>
            <button className="cast-section__action" data-callback="onAddAbility">+ Add</button>
          </div>
          <CastShowMore threshold={2}>
            {c.abilities.map((a, i) => (
              <CastAbilities key={i} items={[a]}/>
            ))}
          </CastShowMore>
        </div>
      )}

      {/* Skill tree */}
      {c.skillTree && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Skill tree</span>
            <button className="cast-section__action" data-callback="onOpenSkillTree">Open full tree →</button>
          </div>
          <CastSkillTree tree={c.skillTree}/>
        </div>
      )}

      {/* Inventory */}
      {c.inventory && c.inventory.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Inventory</span>
            <button className="cast-section__action" data-callback="onOpenItemsTab">Open in Items →</button>
          </div>
          <CastShowMore threshold={3}>
            {c.inventory.map((it, i) => (
              <CastInventory key={i} items={[it]}/>
            ))}
          </CastShowMore>
        </div>
      )}

      {/* Open related tab links */}
      {((c.relatedAtlas && c.relatedAtlas.length) || (c.relatedTimeline && c.relatedTimeline.length)) && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Open related tab</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.relatedAtlas && c.relatedAtlas.map((r) => (
              <Btn key={"a-"+r.id} variant="outline" size="sm" icon="map" data-callback="onOpenAtlasFor">{r.label} in Atlas →</Btn>
            ))}
            {c.relatedTimeline && c.relatedTimeline.map((r) => (
              <Btn key={"t-"+r.id} variant="outline" size="sm" icon="clock" data-callback="onOpenTimelineFor">{r.label} on Timeline →</Btn>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: "flex", gap: 6, paddingTop: "var(--sp-4)", borderTop: "1px dashed var(--line-2)" }}>
        <Btn variant="primary" size="sm" icon="paper" data-callback="onJumpManuscript">Open in manuscript</Btn>
        <Btn variant="outline" size="sm" icon="link" data-callback="onLinkEntity">Link…</Btn>
        <Btn variant="ghost" size="sm" icon="more" data-callback="onCastMore" title="More"/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastEdit — edit form for a character
// ---------------------------------------------------------------------
const CastEdit = ({ c, onCancel, onSave }) => {
  const [form, setForm] = _us_cast({
    name:        c?.name        || "",
    title:       c?.title       || "",
    epithet:     c?.epithet     || "",
    role:        c?.role        || "supporting",
    status:      c?.status      || "alive",
    affiliation: c?.affiliation || "",
    origin:      c?.origin      || "",
    pronouns:    c?.pronouns    || "",
    summary:     c?.summary     || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="cast cast-edit" data-ui="CastEdit">
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Name<span className="cast-edit__lbl__req">*</span></label>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="As they appear in the manuscript"/>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Title</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Queen of the Pale Reach"/>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Pronouns</label>
          <input value={form.pronouns} onChange={(e) => set("pronouns", e.target.value)} placeholder="she/her"/>
        </div>
      </div>
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Epithet</label>
        <input value={form.epithet} onChange={(e) => set("epithet", e.target.value)} placeholder="A line that captures them"/>
        <span className="cast-edit__hint">Shown as the italic subline in lists.</span>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Role</label>
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="protagonist">Protagonist</option>
            <option value="antagonist">Antagonist</option>
            <option value="supporting">Supporting</option>
            <option value="minor">Minor</option>
          </select>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Status</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="alive">Alive</option>
            <option value="missing">Missing</option>
            <option value="unknown">Unconfirmed</option>
            <option value="dead">Dead</option>
          </select>
        </div>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Affiliation</label>
          <input value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} placeholder="House, faction, order…"/>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Origin</label>
          <input value={form.origin} onChange={(e) => set("origin", e.target.value)}/>
        </div>
      </div>
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Summary</label>
        <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Two sentences. Who they are; what they want."/>
      </div>
      <div className="cast-edit__actions">
        <Btn variant="ghost" size="sm" onClick={onCancel} data-callback="onCancelEdit">Cancel</Btn>
        <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract more</Btn>
        <Btn variant="primary" size="sm" onClick={() => onSave && onSave(form)} data-callback="onSave">Save</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastReviewList — items already created but flagged for review
// ---------------------------------------------------------------------
const CastReviewList = ({ cast }) => {
  if (!cast || !cast.length) {
    return (
      <div className="cast-empty">
        <div className="cast-empty__seal">✓</div>
        <div className="cast-empty__title">Nothing to review</div>
        <div className="cast-empty__body">Every cast member is confirmed. New extractions will surface here.</div>
      </div>
    );
  }
  return (
    <div className="cast-review">
      {cast.map((c) => (
        <div key={c.id} className="cast-review__card">
          <div className="cast-review__head">
            <div className="cast-row__monogram">{c.initials}</div>
            <div className="cast-review__name">{c.name}</div>
            <ConfidenceBadge level="uncertain" value={62}/>
          </div>
          <div className="cast-review__excerpt" dangerouslySetInnerHTML={{
            __html: '"' + (c.epithet || c.summary).replace(c.name, '<mark>' + c.name + '</mark>') + '"'
          }}/>
          <div className="cast-review__meta">
            <Icon name="paper" size={10}/> {c.firstSeen}
            <span style={{ flex: 1 }}/>
            <span>queued by extractor · 2m ago</span>
          </div>
          <div className="cast-review__actions">
            <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
            <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem">Merge…</Btn>
            <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Deny</Btn>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastSuggestionList — extraction-only suggestions, never committed
// ---------------------------------------------------------------------
const CastSuggestionList = ({ items }) => (
  <div className="cast-review">
    <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-3)", fontStyle: "italic", marginBottom: 4 }}>
      Detected in the current chapter. Nothing here has been added to your cast yet.
    </div>
    {items.map((s) => (
      <div key={s.id} className="cast-review__card">
        <div className="cast-review__head">
          <div className="cast-row__monogram cast-row__monogram--unknown">{s.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
          <div className="cast-review__name">{s.name}</div>
          <ConfidenceBadge level={s.level} value={s.value}/>
        </div>
        <div className="cast-review__excerpt" dangerouslySetInnerHTML={{ __html: '"' + s.excerpt + '"' }}/>
        <div className="cast-review__meta">
          <Icon name="paper" size={10}/> {s.cite}
          <span style={{ flex: 1 }}/>
          <span>{s.reason}</span>
        </div>
        <div className="cast-review__actions">
          <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Add to Cast</Btn>
          <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem">Merge…</Btn>
          <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// CastEmpty — no cast at all yet
// ---------------------------------------------------------------------
const CastEmpty = ({ onCreate, onExtract }) => (
  <div className="cast-empty" data-ui="CastEmpty">
    <div className="cast-empty__seal">◐</div>
    <div className="cast-empty__title">No cast yet</div>
    <div className="cast-empty__body">Add the people who walk through your story — or run extraction over the manuscript and let Loomwright find them.</div>
    <div className="cast-empty__actions">
      <Btn variant="primary" size="sm" icon="plus" onClick={onCreate} data-callback="onCreateEntity">Add a character</Btn>
      <Btn variant="outline" size="sm" icon="sparkle" onClick={onExtract} data-callback="onExtractCast">Extract from manuscript</Btn>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// CastPanelBody — top-level dispatcher. Replaces the generic state
// switch when entityType === "cast".
// ---------------------------------------------------------------------
const CastPanelBody = ({ panel, onSelectEntity }) => {
  const cast = (panel && panel.cast) || CAST_SAMPLE;
  const incomingState = panel?.state || "overview";

  // Local UI state for the panel (selection, multi-select, edit view).
  const [view, setView] = _us_cast(incomingState); // overview | selected | edit | empty | loading | error | review | suggestion | multi
  const [selectedId, setSelectedId] = _us_cast(panel?.selected?.id || cast.find((c) => c.role === "protagonist")?.id || cast[0]?.id);
  const [multi, setMulti] = _us_cast(() => new Set());

  // If host changes panel.state (e.g. via demo controls), follow.
  React.useEffect(() => { setView(incomingState); }, [incomingState]);

  const selected = _um_cast(() => cast.find((c) => c.id === selectedId), [cast, selectedId]);

  const onSelect = (c) => {
    setSelectedId(c.id);
    setView("selected");
    onSelectEntity && onSelectEntity({ id: c.id, label: c.name, entityType: "cast" });
  };
  const onToggleMulti = (c) => {
    setMulti((s) => {
      const n = new Set(s);
      if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
      return n;
    });
    setView("multi");
  };

  // Routing — special states first, then default to browse list
  if (view === "loading") return <LoadingState title="Reading the cast register…" lines={5}/>;
  if (view === "error")   return <ErrorState title="Couldn't load cast" body="Local index unreachable. Your characters are safe." onRetry={() => setView("overview")}/>;
  if (view === "empty")   return <CastEmpty onCreate={() => setView("edit")} onExtract={() => setView("loading")}/>;
  if (view === "edit")    return <CastEdit c={selected} onCancel={() => setView("selected")} onSave={() => setView("selected")}/>;
  if (view === "review")    return <div className="cast"><CastReviewList cast={cast.filter((c) => c.queue)}/></div>;
  if (view === "suggestion")return <div className="cast"><CastSuggestionList items={CAST_SUGGESTIONS_SAMPLE}/></div>;
  if (view === "selected" && selected) {
    return <CastDetail c={selected} onBack={() => setView("overview")} onEdit={() => setView("edit")}/>;
  }
  // Default: browse with optional multi-select
  return (
    <CastBrowse
      cast={cast}
      selectedId={selectedId}
      multiSelected={multi}
      multiMode={view === "multi"}
      onEnterMultiMode={() => setView("multi")}
      onSelect={onSelect}
      onToggleMulti={onToggleMulti}
      onClearMulti={() => { setMulti(new Set()); setView("overview"); }}
      onMergeMulti={() => {}}
      onTagMulti={() => {}}
      onDeleteMulti={() => {}}
      onCreate={() => setView("edit")}
    />
  );
};

// ---------------------------------------------------------------------
// Small dossier sub-components
// ---------------------------------------------------------------------
const CastStats = ({ stats }) => (
  <div className="cast-stats">
    {stats.map((s) => (
      <div key={s.k} className="cast-stat">
        <span className="cast-stat__k">{s.k}</span>
        <div className="cast-stat__bar"><div className="cast-stat__bar__fill" style={{ width: ((s.v / s.max) * 100) + "%" }}/></div>
        <span className="cast-stat__v">{s.v}<span className="cast-stat__max">/{s.max}</span></span>
      </div>
    ))}
  </div>
);

const CastAbilities = ({ items }) => (
  <div className="cast-abilities">
    {items.map((a, i) => (
      <div key={i} className="cast-ability">
        <div className="cast-ability__head">
          <span className="cast-ability__name">{a.name}</span>
          <span className="cast-ability__src">{a.source}</span>
        </div>
        <div className="cast-ability__desc">{a.desc}</div>
      </div>
    ))}
  </div>
);

const CastSkillTree = ({ tree }) => (
  <div className="cast-tree">
    {tree.branches.map((b) => (
      <div key={b.name} className="cast-tree__branch">
        <div className="cast-tree__branch-name">{b.name}</div>
        <div className="cast-tree__nodes">
          {b.nodes.map((n, i) => (
            <React.Fragment key={n.name}>
              <div className={"cast-tree__node cast-tree__node--" + n.state} title={n.state}>
                <span className="cast-tree__node__pip"/>
                <span className="cast-tree__node__lbl">{n.name}</span>
              </div>
              {i < b.nodes.length - 1 && <span className="cast-tree__link"/>}
            </React.Fragment>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const CastInventory = ({ items }) => (
  <div className="cast-inv">
    {items.map((it, i) => (
      <div key={i} className={"cast-inv__item" + (it.notable ? " is-notable" : "")}>
        <span className={"cast-inv__kind cast-inv__kind--" + it.kind} title={it.kind}/>
        <div className="cast-inv__body">
          <div className="cast-inv__name">{it.name}{it.notable && <span className="cast-inv__star" title="Plot-significant">★</span>}</div>
          {it.note && <div className="cast-inv__note">{it.note}</div>}
        </div>
        <span className="cast-inv__kind-lbl">{it.kind}</span>
      </div>
    ))}
  </div>
);

// Section wrapper with optional Show More collapse
const CastShowMore = ({ children, threshold = 3, more = "Show all", less = "Show less" }) => {
  const [open, setOpen] = _us_cast(false);
  const arr = React.Children.toArray(children);
  if (arr.length <= threshold) return <>{children}</>;
  return (
    <>
      {open ? arr : arr.slice(0, threshold)}
      <button className="cast-section__action" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setOpen(!open)}>
        {open ? less : (more + " (" + arr.length + ")")}
      </button>
    </>
  );
};

Object.assign(window, {
  CastPanelBody, CastBrowse, CastDetail, CastEdit, CastReviewList, CastSuggestionList, CastEmpty,
  CastStats, CastAbilities, CastSkillTree, CastInventory, CastShowMore,
  CAST_SAMPLE, CAST_SUGGESTIONS_SAMPLE,
});


// ----- atlas-data.jsx -----
// =====================================================================
// atlas-data.jsx — sample atlas world (Pale Reach / Hess setting).
// Pure presentational placeholder data; mirrors the shapes documented
// at the bottom of atlas.jsx.
// =====================================================================

// Hierarchy: world > continent > country > region > city > town > village > district > building > room > other

const ATLAS_LOCATIONS = [
  // Regional polygons (translucent fills)
  { id: "north",      type: "country",   name: "Pale Reach",        x: 24, y: 30, parent: "world",     entityKind: "locations",
    polygon: "M 60 110 L 280 80 L 360 200 L 320 360 L 100 380 L 50 260 Z" },
  { id: "vraska",     type: "region",    name: "Vraska Pass",       x: 47, y: 45, parent: "north",     entityKind: "locations",
    polygon: "M 380 280 L 600 240 L 680 360 L 540 460 L 380 420 Z" },
  { id: "hess",       type: "country",   name: "Hessmark",          x: 78, y: 38, parent: "world",     entityKind: "locations",
    polygon: "M 760 200 L 1100 180 L 1140 420 L 880 480 L 740 360 Z" },
  // Cities & towns
  { id: "pr",         type: "city",      name: "Pale Reach Hold",   x: 17, y: 40, parent: "north",     entityKind: "locations",
    chapters: [1, 2, 3, 7], characters: ["aelinor", "brec"], queue: 2, queueLevel: "high",
    summary: "Salt-bleached coastal queendom; seat of House Vey. The story opens here.",
    fields: [["Type", "City · Capital"], ["Parent", "Pale Reach"], ["Population", "~12,000"], ["First seen", "Ch. 1, p. 12"]] },
  { id: "sw",         type: "town",      name: "Salt Watch",        x: 12, y: 56, parent: "north",     entityKind: "locations",
    chapters: [2, 5],          characters: ["aelinor"],            queue: 0,
    summary: "Watchtower town on the southern stockades.", fields: [["Type", "Town"], ["Parent", "Pale Reach"]] },
  { id: "ac",         type: "region",    name: "Auger Cliffs",      x: 26, y: 18, parent: "north",     entityKind: "locations",
    chapters: [3, 6],          characters: ["aelinor"],            queue: 1, queueLevel: "uncertain",
    summary: "Wind-cut cliff line; salt-wraith hunting ground.", fields: [["Type", "Region"], ["Parent", "Pale Reach"]] },
  { id: "vp",         type: "city",      name: "Vraska Town",       x: 43, y: 51, parent: "vraska",    entityKind: "locations",
    chapters: [4, 5],          characters: ["aelinor", "saren"],   queue: 0,
    summary: "Mountain market settlement at the head of the pass.", fields: [["Type", "Town"], ["Parent", "Vraska Pass"]] },
  { id: "bw",         type: "region",    name: "Brittlewood",       x: 58, y: 70, parent: "world",     entityKind: "locations",
    chapters: [5],             characters: ["aelinor"],            queue: 0,
    summary: "Thin pine forest east of the pass.", fields: [["Type", "Forest"], ["Parent", "—"]] },
  { id: "gc",         type: "city",      name: "Glass Court",       x: 78, y: 28, parent: "hess",      entityKind: "locations",
    chapters: [3, 4, 6, 7],    characters: ["saren", "aelinor"],   queue: 1, queueLevel: "strong",
    summary: "Hess audience hall and seat of the Glass Throne.",
    fields: [["Type", "City · Capital"], ["Parent", "Hessmark"], ["Population", "~38,000"]] },
  { id: "hh",         type: "city",      name: "Hess Harbour",      x: 89, y: 52, parent: "hess",      entityKind: "locations",
    chapters: [6, 7],          characters: ["saren"],              queue: 0,
    summary: "Working port of Hessmark; whaler and grain trade.", fields: [["Type", "City"], ["Parent", "Hessmark"]] },
  { id: "kr",         type: "village",   name: "Kelp Run",          x: 7,  y: 64, parent: "north",     entityKind: "locations",
    chapters: [],              characters: [],                     queue: 0,
    summary: "Tiny coastal hamlet; absent from the manuscript so far.", fields: [["Type", "Village"]] },
  { id: "wd",         type: "building",  name: "Watchhouse",        x: 16, y: 35, parent: "pr",        entityKind: "locations",
    chapters: [1, 7],          characters: ["brec"],               queue: 0,
    summary: "Vey watchhouse on the stockade gate.", fields: [["Type", "Building"], ["Parent", "Pale Reach Hold"]] },
];

// Travel routes — characters + waypoints (locationId references)
const ATLAS_ROUTES = [
  {
    id: "r-aelinor",
    characterId: "aelinor",
    characterName: "Aelinor Vey",
    color: "#7a6aa3", // cast (muted violet)
    initials: "AV",
    summary: "Ch. 1–7: Pale Reach → Vraska → Glass Court",
    waypoints: [
      { locationId: "pr", chapter: 1, kind: "depart",  label: "Departs the Hold",       confirmed: true  },
      { locationId: "sw", chapter: 2, kind: "stop",    label: "Stops at Salt Watch",    confirmed: true  },
      { locationId: "ac", chapter: 3, kind: "stop",    label: "Walks the Cliffs",       confirmed: false },
      { locationId: "vp", chapter: 4, kind: "stop",    label: "Vraska Pass",            confirmed: true  },
      { locationId: "bw", chapter: 5, kind: "stop",    label: "Through Brittlewood",    confirmed: true  },
      { locationId: "gc", chapter: 7, kind: "arrive",  label: "Arrives at Glass Court", confirmed: true  },
    ],
  },
  {
    id: "r-saren",
    characterId: "saren",
    characterName: "Saren of Hess",
    color: "#a8553f", // bestiary rust — repurposed for second character (rust suits Saren)
    initials: "SH",
    summary: "Ch. 3–7: Glass Court → Vraska → Glass Court",
    waypoints: [
      { locationId: "gc", chapter: 3, kind: "depart",  label: "Leaves the Court",       confirmed: true  },
      { locationId: "vp", chapter: 4, kind: "stop",    label: "Meets Aelinor",          confirmed: true  },
      { locationId: "gc", chapter: 7, kind: "arrive",  label: "Returns",                confirmed: true  },
    ],
  },
];

const ATLAS_CHAPTERS = [
  { id: "ch1", label: "Ch. 1",  title: "The Auger Wake",     events: 1, locations: ["pr", "wd"] },
  { id: "ch2", label: "Ch. 2",  title: "Salt Watch",         events: 0, locations: ["pr", "sw"] },
  { id: "ch3", label: "Ch. 3",  title: "Cliffs",             events: 2, locations: ["pr", "ac", "gc"] },
  { id: "ch4", label: "Ch. 4",  title: "Pass",               events: 1, locations: ["vp", "gc"] },
  { id: "ch5", label: "Ch. 5",  title: "Brittlewood",        events: 0, locations: ["vp", "bw", "sw"] },
  { id: "ch6", label: "Ch. 6",  title: "Wraiths",            events: 1, locations: ["ac", "gc", "hh"] },
  { id: "ch7", label: "Ch. 7",  title: "Ash & Auger",        events: 2, locations: ["pr", "gc", "wd", "hh"] },
  { id: "ch8", label: "Ch. 8",  title: "Reserved",           events: 0, locations: [],            reserved: true },
  { id: "ch9", label: "Ch. 9",  title: "Reserved",           events: 0, locations: [],            reserved: true },
];

const ATLAS_QUESTS = [
  { id: "q1", name: "The Auger's Walk",    type: "quests",  locationId: "ac", chapter: 6, status: "active" },
  { id: "q2", name: "The Glass Audience",  type: "quests",  locationId: "gc", chapter: 7, status: "active" },
  { id: "e1", name: "Salt-wraith attack",  type: "events",  locationId: "ac", chapter: 6, status: "past"   },
  { id: "e2", name: "Treaty of Brittlewood", type: "events", locationId: "bw", chapter: 5, status: "past"  },
];

const ATLAS_QUEUE = [
  { id: "qa1", name: "The Glass Court", level: "uncertain", value: 58, action: "Place on map?", excerpt: "...the Glass Court rose on a hill the colour of bone...", cite: "Ch. 3, p. 76", reason: "Found in prose; no atlas placement." },
  { id: "qa2", name: "Auger Cliffs",    level: "strong",    value: 84, action: "Add as Region",  excerpt: "...up where the Auger Cliffs cut the sky open like a knife...",  cite: "Ch. 3, p. 88", reason: "New region candidate; parent: Pale Reach." },
  { id: "qa3", name: "Salt Watch",      level: "high",      value: 96, action: "Auto-added",     excerpt: "...the watch at Salt was already lit when she came down...", cite: "Ch. 2, p. 41", reason: "High-confidence; auto-added, still reviewable." },
  { id: "qa4", name: "Hess Tunnel?",    level: "weak",      value: 31, action: "Reject?",        excerpt: "...the rumour of a tunnel under Hess never quite died...", cite: "Ch. 4, p. 102", reason: "Hearsay; weak evidence for a real location." },
];

// Layers shown in the layer panel
const ATLAS_LAYERS = [
  { id: "regions",     label: "Regions",        kind: "geo", color: "#6b8a4a", count: 3, visible: true },
  { id: "cities",      label: "Cities & Towns", kind: "geo", color: "#324a1f", count: 5, visible: true },
  { id: "buildings",   label: "Buildings",      kind: "geo", color: "#76684c", count: 1, visible: true },
  { id: "routes",      label: "Travel routes",  kind: "ovl", color: "#7a6aa3", count: 2, visible: true },
  { id: "characters",  label: "Characters",     kind: "ovl", color: "#a8553f", count: 4, visible: true },
  { id: "quests",      label: "Quests & events",kind: "ovl", color: "#8a3a4f", count: 4, visible: true },
  { id: "labels",      label: "Place labels",   kind: "art", color: "#2a2218", count: null, visible: true },
  { id: "grid",        label: "Lat/Lon grid",   kind: "art", color: "#9a8c6e", count: null, visible: false },
  { id: "isolines",    label: "Contours",       kind: "art", color: "#9a8c6e", count: null, visible: true },
  { id: "texture",     label: "Parchment grain",kind: "art", color: "#9a8c6e", count: null, visible: true },
];

// Cast available for atlas overlay (drag onto map / toggle journey)
const ATLAS_CAST = [
  { id: "aelinor", name: "Aelinor Vey",   initials: "AV", color: "#7a6aa3", role: "protagonist" },
  { id: "saren",   name: "Saren of Hess", initials: "SH", color: "#a8553f", role: "antagonist"  },
  { id: "brec",    name: "Captain Brec",  initials: "CB", color: "#5d6d4e", role: "supporting"  },
  { id: "mara",    name: "Mara of Hess",  initials: "MH", color: "#b78a52", role: "supporting"  },
  { id: "auger",   name: "The Auger",     initials: "TA", color: "#6b6f7a", role: "minor"       },
  { id: "dav",     name: "Dav the Quiet", initials: "DQ", color: "#8a6b58", role: "minor"       },
];

Object.assign(window, { ATLAS_LOCATIONS, ATLAS_ROUTES, ATLAS_CHAPTERS, ATLAS_QUESTS, ATLAS_QUEUE, ATLAS_LAYERS, ATLAS_CAST });


// ----- atlas.jsx -----
// =====================================================================
// atlas.jsx — Atlas canvas: parchment map board, floating chrome,
// pins, beaded travel routes, inspector, mini-map, chapter scrubber.
// All presentational. Plugs into SlidingPanel as a bespoke body for
// entityType === "atlas" (and "locations" when tab=atlas).
// =====================================================================

const { useState: _us_at, useMemo: _um_at, useCallback: _uc_at, useEffect: _ue_at, useRef: _ur_at } = React;

// Brand seam — read entity colours from window.ENTITY_TYPES if present.
const _atlasEC = (k) => (window.ENTITY_TYPES && window.ENTITY_TYPES[k]) || null;

// =====================================================================
// MAP PLATE — SVG cartography (regions, isolines, water, grid)
// =====================================================================
const AtlasMapPlate = ({ locations, layers, selectedId }) => {
  const showRegions  = layers.regions !== false;
  const showLabels   = layers.labels  !== false;
  const showGrid     = layers.grid    === true;
  const showIso      = layers.isolines !== false;

  return (
    <svg className="atlas__svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id="atlas-water-hatch" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(38)">
          <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(80, 100, 120, 0.18)" strokeWidth="0.6"/>
        </pattern>
        <radialGradient id="atlas-land-grad" cx="50%" cy="50%" r="65%">
          <stop offset="0%"  stopColor="#fbf2d6" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#ebdcb4" stopOpacity="0.0"/>
        </radialGradient>
        <filter id="atlas-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.5"/>
        </filter>
      </defs>

      {/* Sea / bleed */}
      <rect x="0" y="0" width="1200" height="700" fill="url(#atlas-water-hatch)" opacity="0.55"/>

      {/* Coastline contour */}
      <path d="M 30 130 C 60 90, 280 70, 360 200 S 400 380, 320 420 S 100 460, 60 320 Z
               M 380 290 C 460 260, 620 230, 690 360 S 540 480, 380 420 Z
               M 740 200 C 820 170, 1100 170, 1140 320 S 980 510, 880 480 S 720 360, 740 200 Z"
        fill="url(#atlas-land-grad)"
        stroke="rgba(74, 56, 28, 0.55)"
        strokeWidth="1.5"
        opacity={showRegions ? 1 : 0.55}
      />

      {/* Iso-lines (rolling contour rings, faint) */}
      {showIso && (
        <g stroke="rgba(120, 96, 60, 0.30)" strokeWidth="0.6" fill="none" filter="url(#atlas-soft)">
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

      {/* Optional lat/lon grid */}
      {showGrid && (
        <g stroke="rgba(120, 96, 60, 0.18)" strokeWidth="0.5">
          {Array.from({ length: 12 }).map((_, i) => <line key={"v"+i} x1={(i+1)*100} y1="0" x2={(i+1)*100} y2="700"/>)}
          {Array.from({ length: 7  }).map((_, i) => <line key={"h"+i} x1="0" y1={(i+1)*100} x2="1200" y2={(i+1)*100}/>)}
        </g>
      )}

      {/* Compass rose (top-right) */}
      <g transform="translate(1090, 90)" opacity="0.55">
        <circle r="32" fill="none" stroke="var(--atlas-coast, #4a381c)" strokeWidth="0.7"/>
        <circle r="22" fill="none" stroke="var(--atlas-coast, #4a381c)" strokeWidth="0.4" strokeDasharray="2 4"/>
        <path d="M 0 -30 L 4 0 L 0 30 L -4 0 Z" fill="rgba(74, 56, 28, 0.55)"/>
        <path d="M -30 0 L 0 4 L 30 0 L 0 -4 Z" fill="rgba(74, 56, 28, 0.30)"/>
        <text x="0" y="-36" textAnchor="middle" fontFamily="var(--font-display)" fontSize="11" fill="rgba(74, 56, 28, 0.75)">N</text>
      </g>

      {/* Scale bar (bottom-right) */}
      <g transform="translate(1010, 660)" opacity="0.6">
        <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(74, 56, 28, 0.7)" strokeWidth="0.8"/>
        <line x1="0"   y1="-3" x2="0"   y2="3" stroke="rgba(74, 56, 28, 0.7)" strokeWidth="0.8"/>
        <line x1="60"  y1="-2" x2="60"  y2="2" stroke="rgba(74, 56, 28, 0.5)" strokeWidth="0.6"/>
        <line x1="120" y1="-3" x2="120" y2="3" stroke="rgba(74, 56, 28, 0.7)" strokeWidth="0.8"/>
        <text x="60" y="-6" textAnchor="middle" fontFamily="var(--font-sans)" fontSize="8.5" fill="rgba(74, 56, 28, 0.8)" letterSpacing="0.15em">100 LEAGUES</text>
      </g>
    </svg>
  );
};

// =====================================================================
// TRAVEL ROUTES — beaded path drawn in SVG, with arrival/depart glyphs
// =====================================================================
const AtlasTravelRouteSvg = ({ routes, locations, selectedRouteId, scrubChapter }) => {
  const locById = _um_at(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  const pct = (v, max) => (v / max) * 100;
  return (
    <svg className="atlas__svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none", zIndex: 2 }}>
      {routes.map((r) => {
        const isSel = !selectedRouteId || selectedRouteId === r.id;
        const opacity = isSel ? 1 : 0.25;
        return (
          <g key={r.id} style={{ "--route-color": r.color }} opacity={opacity}>
            {/* Connecting curves between consecutive waypoints */}
            {r.waypoints.slice(1).map((wp, i) => {
              const a = locById[r.waypoints[i].locationId];
              const b = locById[wp.locationId];
              if (!a || !b) return null;
              const ax = (a.x / 100) * 1200, ay = (a.y / 100) * 700;
              const bx = (b.x / 100) * 1200, by = (b.y / 100) * 700;
              const cx = (ax + bx) / 2 + (by - ay) * 0.18;
              const cy = (ay + by) / 2 - (bx - ax) * 0.08;
              const unknown = !wp.confirmed;
              const reached = scrubChapter == null || wp.chapter <= scrubChapter;
              return (
                <g key={i} opacity={reached ? 1 : 0.20}>
                  {/* main path */}
                  <path
                    d={`M ${ax} ${ay} Q ${cx} ${cy}, ${bx} ${by}`}
                    className={"route__path" + (unknown ? " route__path--unknown" : "")}
                    style={{ stroke: r.color }}
                  />
                  {/* beads along path */}
                  {Array.from({ length: 7 }).map((_, j) => {
                    const t = (j + 1) / 8;
                    const it = 1 - t;
                    const x = it * it * ax + 2 * it * t * cx + t * t * bx;
                    const y = it * it * ay + 2 * it * t * cy + t * t * by;
                    return <circle key={j} cx={x} cy={y} r="2" className="route__bead" style={{ stroke: r.color }}/>;
                  })}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

// =====================================================================
// PINS (DOM)
// =====================================================================
const AtlasLocationPin = ({ loc, selected, onSelect }) => {
  const ec = _atlasEC("locations");
  const color = ec?.color || "#6b8a4a";
  const glyph = loc.type[0].toUpperCase();
  const isPolygon = (loc.type === "country" || loc.type === "region");
  if (isPolygon) {
    return (
      <div
        className={"region-label" + (loc.type === "country" ? " region-label--country" : "")}
        style={{ left: loc.x + "%", top: loc.y + "%" }}
      >
        {loc.name}
      </div>
    );
  }
  return (
    <div
      className={"pin pin--" + loc.type + (selected ? " is-selected" : "")}
      style={{ left: loc.x + "%", top: loc.y + "%", "--pin-color": color }}
      data-ui="AtlasLocationPin"
      data-location-id={loc.id}
      data-callback="onSelectAtlasNode"
      onClick={() => onSelect && onSelect(loc)}
      role="button" tabIndex={0}
    >
      <div className="pin__stamp">
        <span className="pin__glyph">{glyph}</span>
        {(loc.queue > 0) && (
          <div className="pin__badge-stack">
            <span className="pin__badge pin__badge--review">{loc.queue}</span>
          </div>
        )}
      </div>
      <div className="pin__shadow"/>
      <div className="pin__label">
        {loc.name}
        <span className="pin__label__type">{loc.type}</span>
      </div>
    </div>
  );
};

// =====================================================================
// FLOATING CHROME
// =====================================================================

const AtlasToolbar = ({ tool, onPickTool, onZoomIn, onZoomOut, onFitView, onFullScreen, fullscreen, onExitFullScreen }) => {
  const Btnish = ({ id, icon, title, active, onClick, disabled }) => (
    <button
      className={"atoolbar__btn" + (active ? " is-active" : "") + (disabled ? " is-disabled" : "")}
      onClick={onClick}
      data-callback={"onPickTool:" + id}
      title={title}
      disabled={disabled}
    >
      <Icon name={icon} size={14}/>
      <span className="atoolbar__tip">{title}</span>
    </button>
  );
  return (
    <div className="atlas-chrome atoolbar" data-ui="AtlasToolbar">
      <div className="atoolbar__group">
        <Btnish id="select"   icon="cursor"  title="Select"          active={tool === "select"}   onClick={() => onPickTool("select")}/>
        <Btnish id="pan"      icon="hand"    title="Pan"             active={tool === "pan"}      onClick={() => onPickTool("pan")}/>
      </div>
      <div className="atoolbar__group">
        <Btnish id="add-loc"  icon="pin"      title="Add location"   active={tool === "add-loc"}  onClick={() => onPickTool("add-loc")}/>
        <Btnish id="region"   icon="region"   title="Draw region"    active={tool === "region"}   onClick={() => onPickTool("region")}/>
        <Btnish id="route"    icon="route"    title="Add travel route" active={tool === "route"}  onClick={() => onPickTool("route")}/>
        <Btnish id="connect"  icon="link"     title="Connect locations" active={tool === "connect"} onClick={() => onPickTool("connect")}/>
        <Btnish id="label"    icon="label"    title="Add label"       active={tool === "label"}    onClick={() => onPickTool("label")}/>
        <Btnish id="building" icon="building" title="Add building"    active={tool === "building"} onClick={() => onPickTool("building")}/>
        <Btnish id="floor"    icon="floor"    title="Add floorplan"   active={tool === "floor"}    onClick={() => onPickTool("floor")}/>
      </div>
      <div className="atoolbar__group">
        <Btnish id="zoom-in"  icon="plus"    title="Zoom in"         onClick={onZoomIn}/>
        <Btnish id="zoom-out" icon="minus"   title="Zoom out"        onClick={onZoomOut}/>
        <Btnish id="fit"      icon="fit"     title="Fit view"        onClick={onFitView}/>
      </div>
      <div className="atoolbar__group">
        <Btnish id={fullscreen ? "exit" : "full"} icon={fullscreen ? "close" : "expand"} title={fullscreen ? "Exit full-screen" : "Full-screen mode"}
                onClick={fullscreen ? onExitFullScreen : onFullScreen}/>
      </div>
    </div>
  );
};

const AtlasLayerPanel = ({ layers, onToggleLayer }) => {
  const groups = [
    { key: "geo",  label: "Geography" },
    { key: "ovl",  label: "Overlays" },
    { key: "art",  label: "Cartography" },
  ];
  return (
    <div className="atlas-chrome atlas-chrome__card alayers" data-ui="AtlasLayerPanel">
      <div className="atlas-chrome__head">
        <Icon name="layers" size={12}/>
        <span className="atlas-chrome__head__lbl">Layers</span>
        <span className="atlas-chrome__head__count">{layers.filter(l => l.visible).length}/{layers.length}</span>
      </div>
      <div className="atlas-chrome__body">
        {groups.map(g => {
          const items = layers.filter(l => l.kind === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key}>
              <div className="alayers__group-label">{g.label}</div>
              {items.map(l => (
                <div
                  key={l.id}
                  className={"alayers__row" + (l.visible ? "" : " is-off")}
                  data-callback="onToggleAtlasLayer"
                  onClick={() => onToggleLayer(l.id)}
                >
                  <span className="alayers__row__sw" style={{ "--swatch": l.color }}/>
                  <span className="alayers__row__lbl">{l.label}</span>
                  {l.count != null && <span className="alayers__row__count">{l.count}</span>}
                  <span className="alayers__row__eye"><Icon name={l.visible ? "eye" : "eye-off"} size={11}/></span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AtlasEntityTray = ({ locations, placedIds, onDragStart, onDrop, filter, onFilter }) => {
  const filtered = locations.filter(l => filter === "all" || l.type === filter);
  return (
    <div className="atlas-chrome atlas-chrome__card atray" data-ui="AtlasEntityTray">
      <div className="atlas-chrome__head">
        <Icon name="stack" size={12}/>
        <span className="atlas-chrome__head__lbl">Entity tray</span>
        <span className="atlas-chrome__head__count">{filtered.length}</span>
      </div>
      <div className="atray__filter">
        {["all","city","town","village","region","building"].map(t => (
          <button key={t}
            className={"atray__chip" + (filter === t ? " is-active" : "")}
            onClick={() => onFilter(t)}
          >{t === "all" ? "All" : (t[0].toUpperCase() + t.slice(1))}</button>
        ))}
      </div>
      <div className="atray__list">
        {filtered.map(l => {
          const placed = placedIds.has(l.id);
          return (
            <div
              key={l.id}
              className={"atray__row" + (placed ? " is-on-canvas" : "")}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); onDragStart && onDragStart(l); }}
              data-callback="onDropEntityOnAtlas"
            >
              <span className="atray__row__dot"/>
              <span className="atray__row__lbl">{l.name}</span>
              <span className="atray__row__sub">{l.type}</span>
              <span className="atray__row__drag">⋮⋮</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AtlasInspector = ({ loc, parentName, onOpenLocation, onCreateRoute, onAddChild, onMerge, onClose }) => {
  if (!loc) return null;
  const ec = _atlasEC("locations");
  return (
    <div className="atlas-chrome atlas-chrome__card ainspect" data-ui="AtlasInspector" style={{ "--ec": ec?.color }}>
      <div className="ainspect__hero">
        <div className="ainspect__type"><span className="ainspect__type__dot"/>{loc.type} · location</div>
        <div className="ainspect__name">{loc.name}</div>
        {loc.summary && <div className="ainspect__sub">{loc.summary}</div>}
        <div className="ainspect__chips">
          {parentName && <span className="ainspect__chip">in {parentName}</span>}
          {loc.chapters?.length ? <span className="ainspect__chip">Ch. {loc.chapters[0]}–{loc.chapters[loc.chapters.length-1]}</span> : null}
          {loc.queue ? <span className="ainspect__chip ainspect__chip--queue">{loc.queue} review</span> : null}
        </div>
      </div>
      <div className="ainspect__body">
        {loc.fields && (
          <div>
            <div className="ainspect__section-title">Identity</div>
            <div className="ainspect__fields">
              {loc.fields.map(([k, v]) => (
                <React.Fragment key={k}>
                  <div className="ainspect__fields__k">{k}</div>
                  <div className="ainspect__fields__v">{v}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        {loc.chapters && loc.chapters.length > 0 && (
          <div>
            <div className="ainspect__section-title">Chapter appearances</div>
            <div className="ainspect__chapters">
              {Array.from({ length: 9 }).map((_, i) => {
                const n = i + 1;
                const has = loc.chapters.includes(n);
                return <span key={n} className={"ainspect__ch" + (has ? " is-current" : "")} style={{ opacity: has ? 1 : 0.35 }}>Ch. {n}</span>;
              })}
            </div>
          </div>
        )}
        {loc.characters && loc.characters.length > 0 && (
          <div>
            <div className="ainspect__section-title">Characters seen here</div>
            <div className="ainspect__chips">
              {loc.characters.map((c) => <span key={c} className="ainspect__chip">{c[0].toUpperCase() + c.slice(1)}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="ainspect__actions">
        <Btn variant="primary" size="sm" icon="paper" data-callback="onOpenLocation" onClick={onOpenLocation}>Open dossier</Btn>
        <Btn variant="outline" size="sm" icon="route" data-callback="onCreateTravelRoute" onClick={onCreateRoute}>Add route</Btn>
        <Btn variant="outline" size="sm" icon="plus"  data-callback="onAddChildLocation"  onClick={onAddChild}>Add child</Btn>
        <Btn variant="ghost"   size="sm" icon="link"  data-callback="onMergeEntity"       onClick={onMerge}>Merge</Btn>
        <Btn variant="ghost"   size="sm" icon="close" onClick={onClose}/>
      </div>
    </div>
  );
};

const AtlasMiniMap = ({ locations, selectedId, viewportRect }) => (
  <div className="atlas-chrome atlas-chrome__card amini" data-ui="AtlasMiniMap">
    <div className="atlas-chrome__head">
      <Icon name="map" size={11}/>
      <span className="atlas-chrome__head__lbl">Mini-map</span>
    </div>
    <div className="atlas-chrome__body">
      <div className="amini__view">
        {locations.map(l => (
          <div key={l.id}
            className={"amini__pin" + (l.id === selectedId ? " is-selected" : "")}
            style={{ left: l.x + "%", top: l.y + "%" }}
          />
        ))}
        <div className="amini__viewport" style={viewportRect || { left: "10%", top: "12%", width: "55%", height: "60%" }}/>
      </div>
      <div className="amini__legend">
        <span>Hessmark</span><span>{locations.length} pins</span>
      </div>
    </div>
  </div>
);

const AtlasChapterScrubber = ({ chapters, current, onSelectChapter, routes }) => {
  const max = Math.max(...chapters.map(c => parseInt(c.id.replace(/\D/g, "")) || 0));
  const cur = parseInt(String(current).replace(/\D/g, "")) || 1;
  const pct = ((cur - 1) / Math.max(1, max - 1)) * 100;
  return (
    <div className="atlas-chrome atlas-chrome__card ascrub" data-ui="AtlasChapterScrubber" style={{ "--scrub-pct": pct + "%" }}>
      <div className="ascrub__head">
        <span className="ascrub__head__title">Chapter scrubber</span>
        <span className="ascrub__head__sub">
          {chapters.find(c => c.id === current)?.title || "—"} ·
          showing world state at end of {chapters.find(c => c.id === current)?.label || ""}
        </span>
        <div className="ascrub__head__nav">
          <button title="Previous chapter" data-callback="onSelectChapterOnAtlas">‹</button>
          <span className="ascrub__head__nav__lbl">{chapters.find(c => c.id === current)?.label || "—"}</span>
          <button title="Next chapter" data-callback="onSelectChapterOnAtlas">›</button>
        </div>
      </div>
      <div className="ascrub__track">
        <div className="ascrub__rail"><div className="ascrub__rail__fill"/></div>
        {chapters.map((c, i) => {
          const p = (i / Math.max(1, chapters.length - 1)) * 100;
          const isActive = c.id === current;
          return (
            <div key={c.id}
              className={"ascrub__tick" + (isActive ? " is-active" : "") + (c.events ? " has-events" : "") + (c.reserved ? " is-reserved" : "")}
              style={{ left: p + "%" }}
              onClick={() => onSelectChapter && onSelectChapter(c.id)}
              data-callback="onSelectChapterOnAtlas"
            >
              <span className="ascrub__tick__dot"/>
              <span className="ascrub__tick__lbl">{c.label}</span>
              {isActive && <span className="ascrub__tick__title">{c.title}</span>}
            </div>
          );
        })}
        <div className="ascrub__playhead"/>
      </div>
      <div className="ascrub__legend">
        {routes.map(r => (
          <span key={r.id} className="ascrub__legend__chip">
            <span className="ascrub__legend__chip__sw" style={{ background: r.color }}/>
            {r.characterName}
          </span>
        ))}
        <span className="ascrub__legend__chip">
          <span className="ascrub__legend__chip__sw" style={{ background: "oklch(0.78 0.13 65)" }}/>
          Event-bearing chapter
        </span>
      </div>
    </div>
  );
};

// =====================================================================
// Route waypoint glyphs (over canvas)
// =====================================================================
const AtlasRouteWaypointGlyphs = ({ routes, locations, scrubChapter, selectedRouteId }) => {
  const locById = _um_at(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  return (
    <>
      {routes.map(r => {
        if (selectedRouteId && r.id !== selectedRouteId) return null;
        // Avatar at the most recent reached waypoint
        const reached = r.waypoints.filter(w => scrubChapter == null || w.chapter <= scrubChapter);
        const head = reached[reached.length - 1] || r.waypoints[0];
        const headLoc = locById[head?.locationId];
        return (
          <React.Fragment key={r.id}>
            {r.waypoints.map((wp, i) => {
              const l = locById[wp.locationId];
              if (!l) return null;
              const dim = scrubChapter != null && wp.chapter > scrubChapter;
              return (
                <div key={i}
                  className={"route__waypoint route__waypoint--" + wp.kind}
                  style={{ left: l.x + "%", top: l.y + "%", "--route-color": r.color, opacity: dim ? 0.25 : 1, marginTop: "-22px" }}
                  data-callback="onSelectAtlasWaypoint"
                >
                  <div className="route__waypoint__dot">{wp.chapter}</div>
                  {(wp.kind === "arrive" || wp.kind === "depart") && (
                    <div className="route__waypoint__lbl">{wp.kind === "arrive" ? "▼ " + wp.label : "▲ " + wp.label}</div>
                  )}
                </div>
              );
            })}
            {headLoc && (
              <div className="route__avatar"
                   style={{ left: headLoc.x + "%", top: (headLoc.y - 6) + "%", "--route-color": r.color }}
                   data-callback="onSelectRoute">
                <span className="route__avatar__chip">{r.initials}</span>
                {r.characterName}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// =====================================================================
// REVIEW QUEUE OVERLAY
// =====================================================================
const AtlasReviewQueue = ({ items, onClose }) => (
  <aside className="areview" data-ui="AtlasReviewQueue">
    <div className="areview__head">
      <Icon name="bell" size={14}/>
      <span className="areview__head__title">Atlas review queue</span>
      <span className="areview__head__count">{items.length}</span>
      <Btn variant="ghost" size="sm" icon="close" onClick={onClose}/>
    </div>
    <div className="areview__list">
      {items.map(it => (
        <div key={it.id} className="areview__card">
          <div className="areview__card__head">
            <ConfidenceBadge level={it.level} value={it.value}/>
            <span className="areview__card__name">{it.name}</span>
            <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{it.action}</span>
          </div>
          <div className="areview__card__excerpt">"…{it.excerpt}…"</div>
          <div className="areview__card__meta">
            <Icon name="paper" size={10}/>{it.cite}
            <span style={{ flex: 1 }}/>
            <span>{it.reason}</span>
          </div>
          <div className="areview__card__actions">
            <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
            <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem">Merge…</Btn>
            <Btn variant="ghost"   size="sm" data-callback="onDenyQueueItem">Deny</Btn>
          </div>
        </div>
      ))}
    </div>
  </aside>
);

// =====================================================================
// STATE OVERLAYS — empty / loading / error / partial
// =====================================================================
const AtlasStateOverlay = ({ state, onRetry, onCreate, onExtract, onDismiss }) => {
  if (state === "ok") return null;
  if (state === "loading") {
    return (
      <>
        <svg className="atlas-skeleton-svg" viewBox="0 0 1200 700">
          <path d="M 60 130 C 90 90, 280 70, 360 200 S 400 380, 320 420 S 100 460, 60 320 Z" fill="rgba(120, 96, 60, 0.22)"/>
          <path d="M 380 290 C 460 260, 620 230, 690 360 S 540 480, 380 420 Z" fill="rgba(120, 96, 60, 0.18)"/>
          <path d="M 740 200 C 820 170, 1100 170, 1140 320 S 980 510, 880 480 Z" fill="rgba(120, 96, 60, 0.22)"/>
        </svg>
        <div className="atlas-state">
          <div className="atlas-state__card">
            <div className="atlas-state__seal">◐</div>
            <div className="atlas-state__title">Drawing the world…</div>
            <div className="atlas-state__body">Loading 11 places, 2 routes, 9 chapters of travel.</div>
          </div>
        </div>
      </>
    );
  }
  if (state === "error") {
    return (
      <div className="atlas-state">
        <div className="atlas-state__card">
          <div className="atlas-state__seal">!</div>
          <div className="atlas-state__title">The plate slipped</div>
          <div className="atlas-state__body">Atlas tiles couldn't be drawn. Your locations are safe — only the canvas failed to render.</div>
          <div className="atlas-state__actions">
            <Btn variant="primary" size="sm" icon="reload" onClick={onRetry} data-callback="onRetryAtlas">Try again</Btn>
            <Btn variant="ghost"   size="sm" onClick={onDismiss}>Dismiss</Btn>
          </div>
        </div>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="atlas-state">
        <div className="atlas-state__card">
          <div className="atlas-state__seal">◯</div>
          <div className="atlas-state__title">No map yet</div>
          <div className="atlas-state__body">Drop a location from the tray, place a pin by hand, or run extraction on the manuscript to find places.</div>
          <div className="atlas-state__actions">
            <Btn variant="primary" size="sm" icon="pin" onClick={onCreate} data-callback="onCreateLocation">Place a pin</Btn>
            <Btn variant="outline" size="sm" icon="sparkle" onClick={onExtract} data-callback="onExtractLocations">Extract from manuscript</Btn>
          </div>
        </div>
      </div>
    );
  }
  if (state === "partial") {
    return (
      <div className="atlas__hint">
        4 locations exist — but none have map placements. Drag from the tray to begin.
      </div>
    );
  }
  return null;
};

// =====================================================================
// STATE SWITCHER (demo control inside atlas)
// =====================================================================
const ATLAS_STATES = [
  { id: "default",    label: "Populated" },
  { id: "selected",   label: "Selected" },
  { id: "travel",     label: "Travel" },
  { id: "quest",      label: "Quest" },
  { id: "scrub",      label: "Scrubbing" },
  { id: "review",     label: "Review queue" },
  { id: "fullscreen", label: "Full-screen" },
  { id: "partial",    label: "No placement" },
  { id: "loading",    label: "Loading" },
  { id: "error",      label: "Error" },
  { id: "empty",      label: "Empty" },
];
const AtlasStateSwitcher = ({ state, onPick }) => (
  <div className="atlas-stateswitch" data-ui="AtlasStateSwitcher">
    <span className="atlas-stateswitch__lbl">State</span>
    {ATLAS_STATES.map(s => (
      <button key={s.id}
        className={"atlas-stateswitch__btn" + (state === s.id ? " is-active" : "")}
        onClick={() => onPick(s.id)}
      >{s.label}</button>
    ))}
  </div>
);

// =====================================================================
// MAIN — AtlasPanelBody (the dispatcher used by SlidingPanel)
// =====================================================================
const AtlasPanelBody = ({ panel }) => {
  const locations = (panel && panel.atlas?.locations) || (window.ATLAS_LOCATIONS || []);
  const routes    = (panel && panel.atlas?.routes)    || (window.ATLAS_ROUTES || []);
  const chapters  = (panel && panel.atlas?.chapters)  || (window.ATLAS_CHAPTERS || []);
  const queue     = (panel && panel.atlas?.queue)     || (window.ATLAS_QUEUE || []);
  const initialLayers = (window.ATLAS_LAYERS || []);

  const [demo, setDemo]               = _us_at(panel?.atlasDemo || "default");
  const [tool, setTool]               = _us_at("select");
  const [selectedId, setSelectedId]   = _us_at("pr");
  const [selectedRouteId, setRouteId] = _us_at(null);
  const [scrubCh, setScrubCh]         = _us_at("ch7");
  const [layers, setLayers]           = _us_at(() => initialLayers.reduce((a, l) => (a[l.id] = l.visible, a), {}));
  const [layerList, setLayerList]     = _us_at(initialLayers);
  const [reviewOpen, setReviewOpen]   = _us_at(false);
  const [fullscreen, setFullscreen]   = _us_at(false);
  const [trayFilter, setTrayFilter]   = _us_at("all");
  const [grain, setGrain]             = _us_at(true);

  // Apply state preset
  _ue_at(() => {
    if (demo === "selected")   { setSelectedId("gc"); setRouteId(null); }
    if (demo === "travel")     { setSelectedId("ac"); setRouteId("r-aelinor"); }
    if (demo === "quest")      { setSelectedId("ac"); setRouteId(null); }
    if (demo === "scrub")      { setScrubCh("ch4"); setSelectedId("vp"); setRouteId("r-aelinor"); }
    if (demo === "review")     { setReviewOpen(true); }
    if (demo === "fullscreen") { setFullscreen(true); }
    if (demo === "default")    { setSelectedId("pr"); setRouteId("r-aelinor"); setScrubCh("ch7"); setReviewOpen(false); setFullscreen(false); }
    if (demo === "partial")    { setSelectedId(null); setRouteId(null); setReviewOpen(false); }
  }, [demo]);

  const selected   = locations.find(l => l.id === selectedId);
  const parentName = selected ? (locations.find(l => l.id === selected.parent)?.name) : null;
  const placedIds  = _um_at(() => new Set(locations.map(l => l.id)), [locations]);

  // Visible locations honour the layers panel
  const visibleLocations = _um_at(() => {
    return locations.filter(l => {
      if (l.type === "country" || l.type === "region") return layers.regions !== false || layers.cities !== false;
      if (l.type === "building") return layers.buildings !== false;
      return layers.cities !== false;
    });
  }, [locations, layers]);

  const visibleRoutes = layers.routes !== false ? routes : [];

  const onToggleLayer = (id) => {
    setLayers((l) => ({ ...l, [id]: !l[id] }));
    setLayerList((ll) => ll.map(x => x.id === id ? { ...x, visible: !x.visible } : x));
  };

  const wantOverlay =
    demo === "loading" ? "loading"
    : demo === "error"  ? "error"
    : demo === "empty"  ? "empty"
    : demo === "partial" ? "partial"
    : "ok";

  // Active cast journeys (toggled in tray / cast tray)
  const [activeCastIds, setActiveCastIds] = _us_at(["aelinor"]);
  const onToggleCast = (id) => setActiveCastIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : xs.concat(id));
  const [fsRailOpen, setFsRailOpen] = _us_at("cast"); // cast | layers | tray | inspect | minimap | review | null

  // ---- DOCKED MODE (default): render compact AtlasQuickPanel ----
  if (!fullscreen) {
    const cast = (window.ATLAS_CAST || []);
    return (
      <div className="atlas" data-ui="AtlasPanelBody" data-fullscreen="false">
        {window.AtlasQuickPanel ? (
          <window.AtlasQuickPanel
            locations={visibleLocations}
            routes={visibleRoutes}
            chapters={chapters}
            cast={cast}
            queue={queue}
            selectedId={selectedId}
            onSelectLocation={setSelectedId}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setRouteId}
            scrubChId={scrubCh}
            onSelectChapter={setScrubCh}
            activeCastIds={activeCastIds}
            onToggleCast={onToggleCast}
            tool={tool}
            onPickTool={setTool}
            onOpenFs={() => setFullscreen(true)}
            fullscreen={false}
            onExitFs={() => setFullscreen(false)}
            onOpenReview={() => setReviewOpen(true)}
            grain={grain}
            onToggleGrain={() => setGrain((g) => !g)}
          />
        ) : null}
        {reviewOpen && window.AtlasReviewQueue && (
          <window.AtlasReviewQueue queue={queue} onClose={() => setReviewOpen(false)}/>
        )}
      </div>
    );
  }

  // ---- FULLSCREEN MODE: existing canvas + right-edge rail + cast dock ----
  return (
    <div className="atlas" data-ui="AtlasPanelBody" data-fullscreen="true">
      {/* Sub-strip header — matches the entity-tab framework cap */}
      <div className="atlas__substrip">
        <div className="atlas__substrip__seg">
          <button className="is-active"><Icon name="map" size={11}/> Atlas canvas</button>
          <button title="Roster (out of scope here)" data-callback="onSwitchAtlasMode"><Icon name="list" size={11}/> Roster</button>
        </div>
        <div style={{ flex: 1 }}/>
        <div>
          <div className="atlas__substrip__title">{(window.brand?.name) || "Loomwright"} Atlas</div>
          <div className="atlas__substrip__sub">{visibleLocations.length} places · {visibleRoutes.length} routes · {chapters.length} chapters</div>
        </div>
        <div style={{ flex: 1 }}/>
        <Btn variant="ghost"   size="sm" icon="grain"   onClick={() => setGrain(g => !g)} title="Toggle parchment grain" data-callback="onToggleAtlasLayer">Grain</Btn>
        <Btn variant="ghost"   size="sm" icon="bell"    onClick={() => setReviewOpen(true)} data-callback="onOpenLocationReviewQueue">Review {queue.length ? <span style={{ marginLeft: 4, fontSize: 10, color: "var(--accent-deep)" }}>·{queue.length}</span> : null}</Btn>
        <Btn variant="outline" size="sm" icon={fullscreen ? "close" : "expand"}
             onClick={() => setFullscreen(f => !f)}
             data-callback={fullscreen ? "onExitAtlasFullScreen" : "onOpenAtlasFullScreen"}>
          {fullscreen ? "Exit full-screen" : "Open in full-screen"}
        </Btn>
      </div>

      {/* Canvas */}
      <div className="atlas__canvas" data-grain={grain ? "on" : "off"}>
        <AtlasStateSwitcher state={demo} onPick={setDemo}/>

        {wantOverlay === "ok" && (
          <>
            <div className="atlas__plate">
              <AtlasMapPlate locations={visibleLocations} layers={layers} selectedId={selectedId}/>
              <AtlasTravelRouteSvg
                routes={visibleRoutes}
                locations={locations}
                selectedRouteId={demo === "travel" || demo === "scrub" ? "r-aelinor" : selectedRouteId}
                scrubChapter={demo === "scrub" ? parseInt(scrubCh.replace(/\D/g,"")) : null}
              />
            </div>

            {/* DOM overlay layer (pins, labels, route waypoints, quest pins) */}
            <div className="atlas__overlay">
              {visibleLocations.map(l => (
                <AtlasLocationPin key={l.id}
                  loc={l}
                  selected={l.id === selectedId}
                  onSelect={(loc) => setSelectedId(loc.id)}
                />
              ))}
              {visibleRoutes.length > 0 && (
                <AtlasRouteWaypointGlyphs
                  routes={visibleRoutes}
                  locations={locations}
                  scrubChapter={demo === "scrub" ? parseInt(scrubCh.replace(/\D/g,"")) : null}
                  selectedRouteId={demo === "travel" || demo === "scrub" ? "r-aelinor" : selectedRouteId}
                />
              )}
              {demo === "quest" && (window.ATLAS_QUESTS || []).map(q => {
                const l = locations.find(x => x.id === q.locationId); if (!l) return null;
                const ec = _atlasEC(q.type);
                return (
                  <div key={q.id}
                    className="route__avatar"
                    style={{ left: (l.x + 4) + "%", top: (l.y + 4) + "%", "--route-color": ec?.color || "#8a3a4f" }}
                    data-callback="onSelectAtlasQuest"
                  >
                    <span className="route__avatar__chip">{q.type === "events" ? "E" : "Q"}</span>
                    {q.name} <span style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>· Ch.{q.chapter}</span>
                  </div>
                );
              })}
            </div>

            {/* Chrome */}
            <AtlasToolbar
              tool={tool} onPickTool={setTool}
              onZoomIn={()=>{}} onZoomOut={()=>{}} onFitView={()=>{}}
              fullscreen={fullscreen}
              onFullScreen={() => setFullscreen(true)}
              onExitFullScreen={() => setFullscreen(false)}
            />
            <AtlasLayerPanel layers={layerList} onToggleLayer={onToggleLayer}/>
            <AtlasEntityTray
              locations={locations}
              placedIds={placedIds}
              filter={trayFilter}
              onFilter={setTrayFilter}
              onDragStart={() => {}}
              onDrop={() => {}}
            />
            {selected && (
              <AtlasInspector
                loc={selected}
                parentName={parentName}
                onOpenLocation={() => {}}
                onCreateRoute={() => {}}
                onAddChild={() => {}}
                onMerge={() => {}}
                onClose={() => setSelectedId(null)}
              />
            )}
            <AtlasMiniMap locations={locations} selectedId={selectedId}/>
            <AtlasChapterScrubber
              chapters={chapters}
              current={scrubCh}
              onSelectChapter={setScrubCh}
              routes={routes}
            />

            {reviewOpen && <AtlasReviewQueue items={queue} onClose={() => setReviewOpen(false)}/>}

            {/* Right-edge collapsible rail + Cast journey dock (fullscreen only) */}
            {window.AtlasFsRail && (
              <window.AtlasFsRail
                open={fsRailOpen}
                onOpen={(id) => { setFsRailOpen(id); if (id === "review") setReviewOpen(true); }}
                badges={{ review: queue.length, cast: activeCastIds.length }}
              />
            )}
            {fsRailOpen === "cast" && window.AtlasCastDock && (
              <window.AtlasCastDock
                cast={(window.ATLAS_CAST || [])}
                routes={routes}
                chapters={chapters}
                locations={locations}
                activeIds={activeCastIds}
                onToggleCast={onToggleCast}
                onSelectRoute={(id) => setRouteId(id)}
                onClose={() => setFsRailOpen(null)}
              />
            )}
          </>
        )}

        <AtlasStateOverlay
          state={wantOverlay}
          onRetry={() => setDemo("default")}
          onCreate={() => setDemo("default")}
          onExtract={() => setDemo("loading")}
          onDismiss={() => setDemo("default")}
        />
      </div>
    </div>
  );
};

Object.assign(window, {
  AtlasPanelBody,
  AtlasMapPlate, AtlasLocationPin, AtlasTravelRouteSvg, AtlasRouteWaypointGlyphs,
  AtlasToolbar, AtlasLayerPanel, AtlasEntityTray, AtlasInspector,
  AtlasMiniMap, AtlasChapterScrubber, AtlasReviewQueue, AtlasStateSwitcher,
});

/* =====================================================================
HOOK-UP NOTES
=====================================================================
location object shape:
  { id, type: "world|continent|country|region|city|town|village|district|building|room|other",
    name, parent, x: %, y: %, polygon?: SVG path string,
    chapters: [int], characters: [id], queue: int, queueLevel: "high|strong|uncertain|weak",
    summary, fields: [[k,v], …], entityKind: "locations" }

atlas node shape (when persisted):
  { id, locationId, x, y, w?, h?, rotation?, label?, layerId, createdAt, createdBy }

route object shape:
  { id, characterId, characterName, color, initials, summary,
    waypoints: [
      { locationId, chapter: int, kind: "depart|stop|arrive", label, confirmed: bool }
    ] }

chapter scrubber state shape:
  { currentChapterId, range: [firstId, lastId],
    showRouteIds: [id], showQuestIds: [id], showCharacterIds: [id],
    onSelectChapter(id), onSelectChapterOnAtlas(id) }

Required callbacks (all wired through SlidingPanel/AtlasPanelBody):
  onCreateLocation, onEditLocation, onSelectLocation, onSetParentLocation,
  onAddChildLocation, onDragLocationToAtlas, onOpenInAtlas,
  onCreateAtlasNode, onMoveAtlasNode, onConnectAtlasNodes,
  onCreateTravelRoute, onSelectChapterOnAtlas, onToggleAtlasLayer,
  onOpenAtlasFullScreen, onExitAtlasFullScreen, onDropEntityOnAtlas,
  onOpenLocationReviewQueue
===================================================================== */


// ----- atlas-quick.jsx -----
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


// ----- panel-stack.jsx -----
// =====================================================================
// panel-stack.jsx — Concept A: Pinned Anchor + Stacked Column
//
// Layout (from Writer's Room outward):
//
//   [ Writer's Room ]  [ pinned panels (anchor zone) ]  [ unpinned stack ]  [ collapsed rail ]
//
// Behavior:
//   - Pinned panels dock immediately right of the manuscript so the
//     writer's reference material stays closest to where they're writing.
//   - Unpinned panels stack to the right of pinned, in order of opening
//     (newest on top / right-most).
//   - Visible cap: MAX_VISIBLE_UNPINNED. Oldest-opened unpinned panel
//     collapses to a vertical tab in the right-edge rail when the cap is
//     exceeded. Clicking a collapsed tab restores it to the stack.
//   - Pinned panels never collapse and never count against the cap.
//   - Cross-panel filter: when a panel emits a focused entity, every
//     other open panel shows a filter chip in its header indicating
//     "Filtered by <Entity>". Per-type focus is preserved so users can
//     focus a Cast member AND a Location simultaneously.
//
// Panel header controls (Concept A — minimal):
//   - Pin / Unpin
//   - Expand width
//   - Close
//   - (Full-screen kept only for canvas-style panels: atlas, skillTrees,
//     tangle — toggled via context menu, not a header button.)
// =====================================================================

const { useState: _ps_us, useCallback: _ps_uc, useRef: _ps_ur, useEffect: _ps_ue, useMemo: _ps_um } = React;

const MAX_VISIBLE_UNPINNED = 4;

// ---------------------------------------------------------------------
// FilterChip — shown in panel header when this panel is being filtered
// by another panel's focused entity (cross-panel focus propagation).
// ---------------------------------------------------------------------
const PanelFilterChip = ({ focus, onClear }) => {
  if (!focus) return null;
  const t = ENTITY_TYPES[focus.type];
  return (
    <button
      className="pstk__filter-chip"
      title={"Filtered by " + focus.label + ". Click to clear."}
      onClick={(e) => { e.stopPropagation(); onClear && onClear(); }}
      style={t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {}}
      data-callback="onClearPanelFilter"
    >
      <span className="pstk__filter-chip__dot"/>
      <span className="pstk__filter-chip__lbl">Filtered by {focus.label}</span>
      <Icon name="close" size={9}/>
    </button>
  );
};

// ---------------------------------------------------------------------
// PanelChrome — header. Pin / Expand / Close. (No dock/float/full-screen.)
// ---------------------------------------------------------------------
const PanelChrome = ({
  panel, isFront, panelFilter,
  onPinPanel, onExpandPanel, onClosePanel, onBringPanelToFront, onClearPanelFilter,
}) => {
  const t = panel.entityType ? ENTITY_TYPES[panel.entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};
  return (
    <div
      className="pstk__head"
      data-ui="PanelHeader"
      style={style}
      onMouseDown={() => onBringPanelToFront && onBringPanelToFront(panel.id)}
    >
      <div className="pstk__head__entity">
        <div className="pstk__head__entity-icon">
          {t
            ? <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>{t.glyph}</span>
            : <Icon name={panel.icon || "stack"} size={14}/>}
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div className="pstk__head__title">{panel.title}</div>
          <div className="pstk__head__meta">
            {panel.subtitle && <span className="pstk__head__sub">{panel.subtitle}</span>}
            <PanelFilterChip focus={panelFilter} onClear={() => onClearPanelFilter && onClearPanelFilter(panel.id)}/>
          </div>
        </div>
      </div>
      <div className="pstk__head__actions">
        <button
          className={"pstk__btn " + (panel.pinned ? "is-active" : "")}
          onClick={(e) => { e.stopPropagation(); onPinPanel && onPinPanel(panel.id); }}
          data-callback="onPinPanel"
          title={panel.pinned ? "Unpin (release from anchor zone)" : "Pin (anchor next to manuscript)"}
        >
          <Icon name="pin-tack" size={12}/>
        </button>
        <button
          className={"pstk__btn " + (panel.expanded ? "is-active" : "")}
          onClick={(e) => { e.stopPropagation(); onExpandPanel && onExpandPanel(panel.id); }}
          data-callback="onExpandPanel"
          title={panel.expanded ? "Narrow" : "Widen"}
        >
          <Icon name="expand" size={12}/>
        </button>
        <button
          className="pstk__btn pstk__btn--close"
          onClick={(e) => { e.stopPropagation(); onClosePanel && onClosePanel(panel.id); }}
          data-callback="onClosePanel"
          title="Close"
        >
          <Icon name="close" size={12}/>
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CollapsedPanelTab — vertical tab handle for overflow / collapsed panels
// ---------------------------------------------------------------------
const CollapsedPanelTab = ({ panel, onRestorePanel, onClosePanel }) => {
  const t = panel.entityType ? ENTITY_TYPES[panel.entityType] : null;
  return (
    <div
      className="pstk-collapsed"
      data-ui="CollapsedPanelTab"
      title={panel.title + " — click to restore"}
      onClick={() => onRestorePanel && onRestorePanel(panel.id)}
      style={t ? { "--ec": t.color } : {}}
    >
      <span className="pstk-collapsed__icon">
        {t
          ? <span style={{ fontFamily: "var(--font-display)", fontSize: 11 }}>{t.glyph}</span>
          : <Icon name={panel.icon || "stack"} size={12}/>}
      </span>
      <span className="pstk-collapsed__title">{panel.title}</span>
      {panel.pinned && <Icon name="pin-tack" size={10}/>}
      <button
        className="pstk-collapsed__close"
        onClick={(e) => { e.stopPropagation(); onClosePanel && onClosePanel(panel.id); }}
        title="Close"
      ><Icon name="close" size={10}/></button>
    </div>
  );
};

// ---------------------------------------------------------------------
// DockedPanel — single panel body
// ---------------------------------------------------------------------
const DockedPanel = ({
  panel, isFront, panelFilter,
  onClosePanel, onPinPanel, onExpandPanel,
  onBringPanelToFront, onReorderPanels,
  onOpenReviewQueue, onSelectEntity, onClearPanelFilter,
  zoneClass = "",
}) => {
  const dragRef = _ps_ur(null);
  const onDragStart = (e) => {
    e.dataTransfer.setData("text/loomwright-panel-id", panel.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/loomwright-panel-id");
    if (!draggedId || draggedId === panel.id) return;
    onReorderPanels && onReorderPanels(draggedId, panel.id);
  };

  const cls = [
    "pstk__panel",
    zoneClass,
    panel.expanded && "is-expanded",
    isFront && "is-front",
    panel.pinned && "is-pinned",
  ].filter(Boolean).join(" ");

  return (
    <section
      ref={dragRef}
      className={cls}
      data-ui="SlidingPanel"
      data-panel-id={panel.id}
      data-state={panel.state}
      data-pinned={panel.pinned ? "true" : "false"}
      role="dialog"
      aria-label={panel.title}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={() => onBringPanelToFront && onBringPanelToFront(panel.id)}
    >
      <PanelChrome
        panel={panel}
        isFront={isFront}
        panelFilter={panelFilter}
        onPinPanel={onPinPanel}
        onExpandPanel={onExpandPanel}
        onClosePanel={onClosePanel}
        onBringPanelToFront={onBringPanelToFront}
        onClearPanelFilter={onClearPanelFilter}
      />

      <div className="panel__toolbar">
        <div className="panel__search">
          <Icon name="search" size={12}/>
          <span style={{ flex: 1 }}>Search in {panel.title.toLowerCase()}…</span>
        </div>
        <Btn variant="ghost" size="sm" icon="filter" title="Filter" data-callback="onFilterPanel"/>
        <Btn variant="ghost" size="sm" icon="sort" title="Sort" data-callback="onSortPanel"/>
        <Btn variant="ghost" size="sm" icon="bell" title="Review queue" onClick={onOpenReviewQueue} data-callback="onOpenReviewQueue"/>
      </div>

      <div className="panel__body">
        {panel.entityType === "atlas" && typeof AtlasPanelBody !== "undefined" ? (
          <AtlasPanelBody panel={panel}/>
        ) : panel.entityType === "cast" && typeof CastPanelBody !== "undefined" && !["loading","error","empty"].includes(panel.state) ? (
          <CastPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : (typeof FRAMEWORK_ENTITY_TYPES !== "undefined"
              && FRAMEWORK_ENTITY_TYPES.has(panel.entityType)
              && typeof EntityFrameworkPanelBody !== "undefined") ? (
          <EntityFrameworkPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : (<>
        {panel.state === "overview"   && <PanelOverview panel={panel} onSelectEntity={onSelectEntity}/>}
        {panel.state === "selected"   && <PanelSelected panel={panel}/>}
        {panel.state === "multi"      && <PanelMulti panel={panel}/>}
        {panel.state === "empty"      && <EmptyState icon={panel.icon || "paper"} title={"No " + panel.title.toLowerCase() + " yet"} body="Create your first entry, or extract from the manuscript." action={<Btn variant="primary" size="sm" icon="plus" data-callback="onCreateEntity">Create</Btn>}/>}
        {panel.state === "loading"    && <LoadingState title={"Loading " + panel.title.toLowerCase() + "…"} lines={4}/>}
        {panel.state === "error"      && <ErrorState title="Couldn't load panel" body="Local index unreachable. Your data is safe." onRetry={() => {}}/>}
        {panel.state === "review"     && <PanelReview panel={panel}/>}
        {panel.state === "edit"       && <PanelEdit panel={panel}/>}
        {panel.state === "suggestion" && <PanelSuggestion panel={panel}/>}
        </>)}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// PanelStack — orchestrator (Concept A)
//
// Props:
//   panels            — array of panel objects.
//   focusedByType     — { [entityType]: { id, label } } — per-type focus map.
//                       Each panel sees the focus that ISN'T its own type.
//   onClearPanelFilter(panelId) — clears the focus filter for that panel.
// ---------------------------------------------------------------------
const PanelStack = ({
  panels, focusedByType,
  onClosePanel, onPinPanel, onExpandPanel,
  onBringPanelToFront, onReorderPanels, onRestorePanel,
  onOpenReviewQueue, onSelectEntity, onClearPanelFilter,
}) => {
  if (!panels || panels.length === 0) return null;

  // Sort by 'order' for deterministic render
  const sorted = [...panels].sort((a, b) => (a.order || 0) - (b.order || 0));

  const pinned       = sorted.filter((p) => p.pinned && !p.collapsed);
  const unpinnedAll  = sorted.filter((p) => !p.pinned && !p.collapsed);
  const userCollapsed = sorted.filter((p) => p.collapsed);

  // Cap visible unpinned at MAX_VISIBLE_UNPINNED. Oldest (lowest order) overflows.
  const overflow = unpinnedAll.slice(0, Math.max(0, unpinnedAll.length - MAX_VISIBLE_UNPINNED));
  const visible  = unpinnedAll.slice(Math.max(0, unpinnedAll.length - MAX_VISIBLE_UNPINNED));

  const railTabs = [...overflow, ...userCollapsed];

  const frontId = sorted.length ? sorted[sorted.length - 1].id : null;

  // Compute the cross-panel filter for a given panel:
  // It's the most-recently-focused entity that is NOT of this panel's type
  // (so a Cast panel doesn't filter itself by its own selection).
  const filterFor = (panel) => {
    if (!focusedByType) return null;
    const entries = Object.entries(focusedByType).filter(([type, f]) => f && type !== panel.entityType);
    if (!entries.length) return null;
    // Return the most recent one (highest ts)
    entries.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    const [type, f] = entries[0];
    return { type, label: f.label, id: f.id };
  };

  const renderPanel = (p, zoneClass) => (
    <DockedPanel
      key={p.id}
      panel={p}
      isFront={p.id === frontId}
      panelFilter={filterFor(p)}
      onClosePanel={onClosePanel}
      onPinPanel={onPinPanel}
      onExpandPanel={onExpandPanel}
      onBringPanelToFront={onBringPanelToFront}
      onReorderPanels={onReorderPanels}
      onOpenReviewQueue={onOpenReviewQueue}
      onSelectEntity={onSelectEntity}
      onClearPanelFilter={onClearPanelFilter}
      zoneClass={zoneClass}
    />
  );

  return (
    <div className="pstk pstk--concept-a" data-ui="PanelStack" data-count={panels.length}>
      {/* Pinned anchor zone — closest to Writer's Room */}
      {pinned.length > 0 && (
        <div className="pstk__zone pstk__zone--pinned" data-ui="PanelStackPinned" aria-label="Pinned panels">
          {pinned.map((p) => renderPanel(p, "pstk__panel--pinned"))}
        </div>
      )}

      {/* Unpinned visible stack */}
      {visible.length > 0 && (
        <div className="pstk__zone pstk__zone--stack" data-ui="PanelStackStack" aria-label="Open panels">
          {visible.map((p) => renderPanel(p, "pstk__panel--stack"))}
        </div>
      )}

      {/* Collapsed / overflow rail (vertical tabs) */}
      {railTabs.length > 0 && (
        <div className="pstk__rail" data-ui="PanelStackRail" aria-label="Collapsed panels">
          {railTabs.map((p) => (
            <CollapsedPanelTab
              key={p.id}
              panel={p}
              onRestorePanel={onRestorePanel || onBringPanelToFront}
              onClosePanel={onClosePanel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { PanelStack, DockedPanel, CollapsedPanelTab, PanelChrome, MAX_VISIBLE_UNPINNED });


// ----- overlays.jsx -----
// =====================================================================
// overlays.jsx — CommandPalette + AdaptiveWheelHost
//
// State coverage:
//   - empty, loading, error, partial, hover, focus, selected, disabled
//   - review-queue badges where relevant (palette rows + wheel slots)
//   - mobile collapse note baked into footer hints
//
// Strict callback / data-attr coverage on every interactive element.
// All callback names mirror the global namespace (onRunCommand,
// onClosePalette, onScopeChange, onRunWheelAction, onCloseWheel,
// onPinSlot, onOpenPanel, etc.).
// =====================================================================

const { useState: _us_cp, useEffect: _ue_cp, useRef: _ur_cp, useMemo: _um_cp, useCallback: _uc_cp } = React;

// ---------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------
const PALETTE_DATA = {
  recent: [
    { id: "r1", icon: "feather", title: "Open Writer's Room",  sub: "Recent",        kbd: ["⌘", "1"] },
    { id: "r2", icon: "user",    title: "Aelinor Vey",          sub: "Cast • Recent", entity: "cast",   queue: 2 },
    { id: "r3", icon: "scroll",  title: "Quest: The Glass Vow", sub: "Quests",        entity: "quests", queue: 1 },
  ],
  suggested: [
    { id: "s1", icon: "plus",     title: "Create new chapter",            sub: "Action",        kbd: ["⌘", "⇧", "N"] },
    { id: "s2", icon: "sparkle",  title: "Run extraction on chapter 7",   sub: "AI Action",     kbd: ["⌘", "E"] },
    { id: "s3", icon: "wheel",    title: "Open Adaptive Wheel here",      sub: "Action",        kbd: ["␣"] },
    { id: "s4", icon: "lock",     title: "Toggle privacy mode",            sub: "AI Action",     kbd: ["⌘", "⇧", "P"], disabled: true, reason: "Cloud sync unavailable offline" },
  ],
  entities: [
    { id: "e1", icon: "user",  entity: "cast",      title: "Saren of Hess",          sub: "Cast" },
    { id: "e2", icon: "pin",   entity: "locations", title: "Pale Reach, the",        sub: "Locations", queue: 1 },
    { id: "e3", icon: "gem",   entity: "items",     title: "Auger of Hess",          sub: "Items" },
    { id: "e4", icon: "book",  entity: "lore",      title: "The Hollowing (canon)",  sub: "Lore",   queue: 3 },
  ],
  chapters: [
    { id: "c1", icon: "book", title: "Ch. 1 — A small dark queen",  sub: "Manuscript" },
    { id: "c2", icon: "book", title: "Ch. 7 — Glass and bone",       sub: "Manuscript", queue: 5 },
    { id: "c3", icon: "book", title: "Ch. 9 — (reserved)",            sub: "Manuscript", disabled: true, reason: "Reserved by another author" },
  ],
  tabs: [
    { id: "t1", icon: "feather", title: "Go to Writer's Room", sub: "Tab", kbd: ["G", "W"] },
    { id: "t2", icon: "compass", title: "Go to Atlas",         sub: "Tab", kbd: ["G", "A"] },
    { id: "t3", icon: "scroll",  title: "Go to Quests",        sub: "Tab", kbd: ["G", "Q"] },
  ],
};

const PALETTE_SCOPES = [
  { id: "all",      label: "All",      icon: "search" },
  { id: "entities", label: "Entities", icon: "stack" },
  { id: "chapters", label: "Chapters", icon: "book" },
  { id: "actions",  label: "Actions",  icon: "bolt" },
];

const CommandPalette = ({
  open,
  state = "ready",          // "ready" | "loading" | "error" | "empty-source" | "partial"
  errorMessage,
  onClose,
  onRunCommand,
  onScopeChange,
  onRetry,
}) => {
  const [q, setQ] = _us_cp("");
  const [sel, setSel] = _us_cp(0);
  const [scope, setScope] = _us_cp("all");
  const inputRef = _ur_cp(null);

  _ue_cp(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const filtered = _um_cp(() => {
    const ql = q.trim().toLowerCase();
    const filterRows = (rows) => !ql ? rows : rows.filter((r) => r.title.toLowerCase().includes(ql) || (r.sub || "").toLowerCase().includes(ql));
    const groups = [
      { id: "recent",    label: "Recent",            rows: filterRows(PALETTE_DATA.recent) },
      { id: "suggested", label: "Suggested actions", rows: filterRows(PALETTE_DATA.suggested) },
      { id: "entities",  label: "Entities",          rows: filterRows(PALETTE_DATA.entities) },
      { id: "chapters",  label: "Chapters",          rows: filterRows(PALETTE_DATA.chapters) },
      { id: "tabs",      label: "Tabs & navigation", rows: filterRows(PALETTE_DATA.tabs) },
    ];
    // Scope filter
    const byScope = (g) => {
      if (scope === "all") return true;
      if (scope === "entities") return g.id === "entities" || g.id === "recent";
      if (scope === "chapters") return g.id === "chapters";
      if (scope === "actions")  return g.id === "suggested" || g.id === "tabs";
      return true;
    };
    return groups.filter((g) => g.rows.length && byScope(g));
  }, [q, scope]);

  const flat = _um_cp(() => filtered.flatMap((g) => g.rows.map((r) => ({ ...r, group: g.id }))), [filtered]);

  const handleScope = _uc_cp((id) => { setScope(id); setSel(0); onScopeChange && onScopeChange(id); }, [onScopeChange]);

  // Skip disabled rows when navigating with keyboard
  _ue_cp(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); }
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => {
          let next = s;
          for (let i = 0; i < flat.length; i++) {
            next = Math.min(flat.length - 1, next + 1);
            if (!flat[next]?.disabled) break;
          }
          return next;
        });
      }
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => {
          let next = s;
          for (let i = 0; i < flat.length; i++) {
            next = Math.max(0, next - 1);
            if (!flat[next]?.disabled) break;
          }
          return next;
        });
      }
      else if (e.key === "Enter") {
        e.preventDefault();
        const row = flat[sel];
        if (row && !row.disabled) { onRunCommand && onRunCommand(row); onClose && onClose(); }
      }
      else if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        handleScope(PALETTE_SCOPES[parseInt(e.key, 10) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, sel, onClose, onRunCommand, handleScope]);

  if (!open) return null;

  // ----- body renderers per state -----
  const renderBody = () => {
    if (state === "loading") {
      return (
        <div className="palette__state">
          <LoadingState title="Searching index…" lines={4}/>
        </div>
      );
    }
    if (state === "error") {
      return (
        <div className="palette__state">
          <ErrorState
            title="Search index didn't respond"
            body={errorMessage || "Your manuscript is safe. Try again, or work offline."}
            onRetry={onRetry}
          />
        </div>
      );
    }
    if (state === "empty-source") {
      return (
        <div className="palette__state">
          <EmptyState
            icon="search"
            title="No history yet"
            body="Recent commands and entities will appear here as you work."
          />
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="palette__state">
          <EmptyState
            icon="search"
            title="No matches"
            body={"Nothing for \u201c" + q + "\u201d in this scope. Try a chapter name, entity, or another scope."}
            action={
              <Btn
                variant="ghost" size="sm" icon="stack"
                data-callback="onScopeChange" data-testid="palette-empty-broaden"
                onClick={() => handleScope("all")}
              >
                Search all
              </Btn>
            }
          />
        </div>
      );
    }

    let runningIdx = -1;
    return filtered.map((g) => (
      <div key={g.id} className="palette__group" data-ui="CommandPaletteGroup" data-group={g.id}>
        <div className="palette__group-lbl">{g.label}</div>
        {g.rows.map((r) => {
          runningIdx += 1;
          const idx = runningIdx;
          const isSel = idx === sel;
          const cls = [
            "palette__row",
            isSel && !r.disabled ? "is-selected" : "",
            r.disabled ? "is-disabled" : "",
          ].filter(Boolean).join(" ");
          return (
            <div
              key={r.id}
              className={cls}
              data-ui="CommandPaletteRow"
              data-callback="onRunCommand"
              data-testid={"palette-row-" + r.id}
              data-disabled={r.disabled || undefined}
              role="option"
              aria-disabled={r.disabled || undefined}
              aria-selected={isSel || undefined}
              tabIndex={r.disabled ? -1 : 0}
              onMouseEnter={() => !r.disabled && setSel(idx)}
              onClick={() => { if (r.disabled) return; onRunCommand && onRunCommand(r); onClose && onClose(); }}
              title={r.disabled ? r.reason : undefined}
            >
              <span className="palette__row__icon">
                {r.entity ? <span className="e-dot" style={{ "--ec": ENTITY_TYPES[r.entity]?.color }}/> : <Icon name={r.icon} size={14}/>}
              </span>
              <span className="palette__row__title">{r.title}</span>
              {r.queue ? <ReviewCountBadge count={r.queue} tone="warn"/> : null}
              {r.disabled && <span className="palette__row__lock"><Icon name="lock" size={11}/></span>}
              <span className="palette__row__sub">{r.disabled ? (r.reason || "Disabled") : r.sub}</span>
              {r.kbd && !r.disabled && (
                <span className="palette__row__kbd">{r.kbd.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span>
              )}
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <div
      className="palette-backdrop"
      data-ui="CommandPalette"
      data-state={state}
      data-testid="command-palette"
      onClick={onClose}
    >
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        aria-busy={state === "loading" || undefined}
      >
        <div className="palette__input">
          <Icon name="search" size={16}/>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Search entities, chapters, commands…"
            data-ui="CommandPaletteInput"
            data-callback="onQueryChange"
            data-testid="palette-input"
            aria-label="Search command palette"
            disabled={state === "loading"}
          />
          {q && state !== "loading" && (
            <button
              type="button"
              className="palette__input__clear"
              data-ui="CommandPaletteClear"
              data-callback="onQueryChange"
              data-testid="palette-clear"
              aria-label="Clear search"
              onClick={() => { setQ(""); inputRef.current?.focus(); }}
            >
              <Icon name="close" size={11}/>
            </button>
          )}
          <Kbd>esc</Kbd>
          <button
            type="button"
            className="palette__input__close"
            data-ui="CommandPaletteClose"
            data-callback="onClosePalette"
            data-testid="palette-close"
            aria-label="Close palette"
            onClick={onClose}
          >
            <Icon name="close" size={12}/>
          </button>
        </div>

        <div className="palette__scopes" role="tablist" aria-label="Search scope">
          {PALETTE_SCOPES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              className={"palette__scope " + (scope === s.id ? "is-active" : "")}
              data-ui="CommandPaletteScope"
              data-callback="onScopeChange"
              data-testid={"palette-scope-" + s.id}
              onClick={() => handleScope(s.id)}
            >
              <Icon name={s.icon} size={11}/>
              <span>{s.label}</span>
              <Kbd>{"⌘" + (i + 1)}</Kbd>
            </button>
          ))}
        </div>

        <div className="palette__body" data-state={state}>
          {renderBody()}
        </div>

        <div className="palette__footer">
          <span className="palette__footer__hint"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="palette__footer__hint"><Kbd>↵</Kbd> open</span>
          <span className="palette__footer__hint"><Kbd>esc</Kbd> close</span>
          <span className="palette__footer__spacer"/>
          <span className="palette__footer__brand">{BRAND.name} · {BRAND.tagline}</span>
        </div>

        {/* Mobile: palette becomes a full-screen sheet anchored to the bottom; scope chips scroll horizontally; footer hints collapse. */}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// AdaptiveWheelHost
//
// Slot states:
//   - default
//   - hover           (CSS)
//   - focus           (CSS, keyboard)
//   - selected        (active === slot.id)
//   - disabled        (slot.disabled, with optional .reason)
//   - loading         (busySlotId === slot.id, ring spinner)
//   - error           (errorSlotId === slot.id, red ring)
//   - queue badge     (slot.queue count > 0)
// ---------------------------------------------------------------------
const DEFAULT_WHEEL_SLOTS = [
  { id: "extract", icon: "sparkle", lbl: "Extract" },
  { id: "create",  icon: "plus",    lbl: "Create" },
  { id: "tag",     icon: "bookmark",lbl: "Tag" },
  { id: "merge",   icon: "link",    lbl: "Merge" },
  { id: "review",  icon: "bell",    lbl: "Review",  queue: 12 },
  { id: "speed",   icon: "eye",     lbl: "Speed" },
  { id: "tangle",  icon: "knot",    lbl: "Tangle",  disabled: true, reason: "Coming soon" },
  { id: "more",    icon: "more",    lbl: "More…" },
];

const AdaptiveWheelHost = ({
  open,
  x,
  y,
  contextLabel = "Workspace",
  slots = DEFAULT_WHEEL_SLOTS,
  state = "ready",          // "ready" | "loading" | "error"
  busySlotId,               // which slot is mid-action
  errorSlotId,              // which slot just failed
  errorMessage,
  activeSlotId,             // primary action for current context (selected ring)
  onClose,
  onRunWheelAction,
  onPinSlot,
  onRetry,
}) => {
  const [focusIdx, setFocusIdx] = _us_cp(0);
  const ref = _ur_cp(null);

  // Reset focus when opening
  _ue_cp(() => { if (open) setFocusIdx(0); }, [open]);

  // Keyboard nav inside the wheel
  _ue_cp(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => {
          let n = i;
          for (let k = 0; k < slots.length; k++) {
            n = (n + 1) % slots.length;
            if (!slots[n].disabled) break;
          }
          return n;
        });
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => {
          let n = i;
          for (let k = 0; k < slots.length; k++) {
            n = (n - 1 + slots.length) % slots.length;
            if (!slots[n].disabled) break;
          }
          return n;
        });
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const s = slots[focusIdx];
        if (s && !s.disabled) onRunWheelAction && onRunWheelAction(s.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slots, focusIdx, onClose, onRunWheelAction]);

  if (!open) return null;
  // Wheel sizing — ring diameter + slot orbit radius are tuned so labels
  // sit OUTSIDE the ring, not inside it, and never collide with the hub.
  const wheelSize = 360;            // outer hit area
  const ringDiameter = 220;         // visible parchment ring
  const orbitRadius = 150;          // distance from center to slot center
  // Position the wheel so it stays on screen no matter where x/y land.
  const margin = wheelSize / 2 + 16;
  const vw = (typeof window !== "undefined") ? window.innerWidth : 1280;
  const vh = (typeof window !== "undefined") ? window.innerHeight : 800;
  const cx = Math.max(margin, Math.min(vw - margin, x));
  const cy = Math.max(margin, Math.min(vh - margin, y));

  return (
    <div
      ref={ref}
      className="wheel-overlay"
      data-ui="AdaptiveWheelHost"
      data-state={state}
      data-testid="adaptive-wheel"
      style={{ "--wx": cx + "px", "--wy": cy + "px", "--wheel-size": wheelSize + "px", "--wheel-ring": ringDiameter + "px" }}
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose && onClose(); }}
      role="dialog"
      aria-label={"Adaptive wheel for " + contextLabel}
    >
      <div className="wheel-overlay__bg"/>
      <div className="wheel" onClick={(e) => e.stopPropagation()}>
        <div className="wheel__ring"/>
        <div className="wheel__ring-inner"/>

        {state === "loading" && (
          <div className="wheel__overlay-state" data-ui="AdaptiveWheelLoading">
            <div className="wheel__spinner" aria-hidden/>
            <div className="wheel__overlay-state__lbl">Working…</div>
          </div>
        )}

        {state === "error" && (
          <div className="wheel__overlay-state wheel__overlay-state--error" data-ui="AdaptiveWheelError">
            <Icon name="warn" size={16}/>
            <div className="wheel__overlay-state__lbl">{errorMessage || "Action failed"}</div>
            <button
              type="button"
              className="wheel__overlay-state__retry"
              data-ui="AdaptiveWheelRetry"
              data-callback="onRetry"
              data-testid="wheel-retry"
              onClick={(e) => { e.stopPropagation(); onRetry && onRetry(); }}
            >
              Try again
            </button>
          </div>
        )}

        {slots.map((s, i) => {
          const angle = (i / slots.length) * Math.PI * 2 - Math.PI / 2;
          const sx = Math.cos(angle) * orbitRadius;
          const sy = Math.sin(angle) * orbitRadius;
          const isBusy   = busySlotId  === s.id;
          const isError  = errorSlotId === s.id;
          const isActive = activeSlotId === s.id;
          const isFocus  = focusIdx === i;
          const cls = [
            "wheel__slot",
            isBusy   ? "is-loading"  : "",
            isError  ? "is-error"    : "",
            isActive ? "is-selected" : "",
            isFocus  ? "is-focus"    : "",
            s.disabled ? "is-disabled" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={s.id}
              type="button"
              className={cls}
              style={{ left: "calc(50% + " + sx + "px)", top: "calc(50% + " + sy + "px)", transform: "translate(-50%, -50%)" }}
              onClick={(e) => {
                if (s.disabled) return;
                if (e.shiftKey && onPinSlot) { onPinSlot(s.id); return; }
                onRunWheelAction && onRunWheelAction(s.id);
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!s.disabled && onPinSlot) onPinSlot(s.id); }}
              onFocus={() => setFocusIdx(i)}
              onMouseEnter={() => !s.disabled && setFocusIdx(i)}
              data-ui="AdaptiveWheelSlot"
              data-callback="onRunWheelAction"
              data-testid={"wheel-" + s.id}
              data-slot={s.id}
              data-disabled={s.disabled || undefined}
              data-busy={isBusy || undefined}
              aria-disabled={s.disabled || undefined}
              aria-pressed={isActive || undefined}
              tabIndex={s.disabled ? -1 : 0}
              title={s.disabled ? s.reason : s.lbl}
            >
              <span className="wheel__slot__pill">
                {isBusy
                  ? <span className="wheel__slot__spinner" aria-hidden/>
                  : <Icon name={s.icon} size={16}/>}
                {s.queue ? (
                  <span className="wheel__slot__queue" aria-label={s.queue + " items in queue"}>
                    {s.queue > 99 ? "99+" : s.queue}
                  </span>
                ) : null}
                {s.disabled && <span className="wheel__slot__lock" aria-hidden><Icon name="lock" size={9}/></span>}
              </span>
              <span className="wheel__slot__lbl">{s.lbl}</span>
            </button>
          );
        })}

        <div
          className="wheel__hub"
          data-ui="AdaptiveWheelHub"
          data-callback="onCloseWheel"
          data-testid="wheel-hub"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose && onClose(); } }}
          title="Close wheel"
        >
          <div className="wheel__hub__lbl">Adaptive</div>
          <div className="wheel__hub__ctx">{contextLabel}</div>
        </div>

        <div className="wheel__hint">Right-click · long-press · ⌘K-hold · Shift-click to pin</div>
      </div>

      {/* Mobile: wheel opens via long-press at touch point; slot labels stay visible; hub doubles as cancel; arrow-key nav becomes swipe. */}
    </div>
  );
};

Object.assign(window, { CommandPalette, AdaptiveWheelHost, PALETTE_SCOPES, DEFAULT_WHEEL_SLOTS });


// ----- workspace.jsx -----
// =====================================================================
// workspace.jsx — Route-aware demo workspace placeholder
// =====================================================================

const ROUTE_META = {
  "home":         { eyebrow: "Workspace",        title: "Welcome back",                 sub: "Your manuscript, archive, and review queue, all in one paper-and-ink workspace.", icon: "home" },
  "today":        { eyebrow: "Today",            title: "What needs you today",         sub: "A daily plan: chapters to draft, items to review, and threads still loose.",       icon: "sun" },
  "writers-room": { eyebrow: "Manuscript",       title: "Writer's Room",                sub: "Chapter editor, margin reviews, and live extraction live here.",                  icon: "feather" },
  "cast":         { eyebrow: "Entities · Cast",  title: "Cast",                         sub: "Characters, voices, dossiers. Color-coded violet across the manuscript.",         entity: "cast" },
  "bestiary":     { eyebrow: "Entities",         title: "Bestiary",                     sub: "Creatures, monsters, fauna. Rust-red across mentions.",                           entity: "bestiary" },
  "atlas":        { eyebrow: "Entities",         title: "Atlas",                        sub: "Maps, regions, and the bones of geography.",                                      entity: "atlas" },
  "locations":    { eyebrow: "Entities",         title: "Locations",                    sub: "Specific places — castles, taverns, glades. Moss-green across mentions.",         entity: "locations" },
  "items":        { eyebrow: "Entities",         title: "Items",                        sub: "Artefacts, weapons, relics. Gold across mentions.",                               entity: "items" },
  "classes":      { eyebrow: "Entities",         title: "Classes",                      sub: "Archetypes, professions, schools.",                                               entity: "classes" },
  "races":        { eyebrow: "Entities",         title: "Races",                        sub: "Peoples, species, lineages.",                                                     entity: "races" },
  "stats":        { eyebrow: "Entities",         title: "Stats",                        sub: "Quantities the world tracks — for characters, items, factions.",                  entity: "stats" },
  "abilities":    { eyebrow: "Entities",         title: "Abilities",                    sub: "Powers, signature moves, gifts.",                                                 entity: "abilities" },
  "skillTrees":   { eyebrow: "Entities",         title: "Skill Trees",                  sub: "Progressions and branchings of ability.",                                          entity: "skillTrees" },
  "relationships":{ eyebrow: "Entities",         title: "Relationships",                sub: "Bonds, rivalries, debts — the graph between Cast.",                                entity: "relationships" },
  "quests":       { eyebrow: "Entities",         title: "Quests",                       sub: "Goals, arcs, threads in motion.",                                                  entity: "quests" },
  "events":       { eyebrow: "Entities",         title: "Events",                       sub: "Discrete things that happened — battles, meetings, deaths.",                       entity: "events" },
  "timeline":     { eyebrow: "Entities",         title: "Timeline",                     sub: "Time, ordered. Eras, days, hours.",                                                entity: "timeline" },
  "lore":         { eyebrow: "Entities",         title: "Lore / Canon",                 sub: "Facts you've ratified about the world.",                                          entity: "lore" },
  "tangle":       { eyebrow: "Tools",            title: "Tangle",                       sub: "A canvas for non-linear thinking.",                                               icon: "knot",  soon: true },
  "speedReader":  { eyebrow: "Tools",            title: "Speed Reader",                 sub: "Read your manuscript at pace; flag inconsistencies.",                              icon: "eye" },
  "references":   { eyebrow: "Tools",            title: "References",                   sub: "External sources, mood boards, archive uploads.",                                  entity: "references" },
  "trash":        { eyebrow: "System",           title: "Trash",                        sub: "Deleted entities sit here for 30 days before they vanish.",                        icon: "trash" },
  "settings":     { eyebrow: "System",           title: "Settings",                     sub: "Workspace, privacy, AI behaviour, theme.",                                          icon: "gear" },
};

const Workspace = ({ routeId, demoState, onOpenAdaptiveWheel, onOpenPanel, onCreateEntity }) => {
  const m = ROUTE_META[routeId] || ROUTE_META.home;
  const t = m.entity ? ENTITY_TYPES[m.entity] : null;

  const handleContextMenu = (e) => {
    e.preventDefault();
    onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: m.title });
  };

  // Long-press support
  const longPressRef = React.useRef(null);
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const x = e.clientX, y = e.clientY;
    longPressRef.current = setTimeout(() => {
      onOpenAdaptiveWheel({ x, y, contextLabel: m.title });
    }, 480);
  };
  const cancelLongPress = () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };

  const renderBody = () => {
    if (demoState === "empty") {
      return (
        <EmptyState
          icon={m.icon || (t ? "stack" : "paper")}
          title={"No " + (m.title.toLowerCase()) + " yet"}
          body="This panel will fill once you draft, extract, or import."
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" size="sm" icon="plus" onClick={() => onCreateEntity && onCreateEntity(m.entity)} data-callback="onCreateEntity">Create</Btn>
              <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Extract</Btn>
            </div>
          }
        />
      );
    }
    if (demoState === "loading") return <LoadingState title="Drawing the page…" lines={5}/>;
    if (demoState === "error")   return <ErrorState title="Couldn't open this room" body="Local index didn't respond. Your manuscript is safe."/>;
    if (demoState === "partial") {
      return (
        <div className="workspace__placeholders">
          <div className="placeholder-card">
            <div className="placeholder-card__title">In progress</div>
            <div className="placeholder-card__body">Some data has loaded. Other shelves are still arriving.</div>
            <div className="placeholder-card__meta">
              {t && <EntityTypeBadge type={m.entity} size="xs"/>}
              <span className="chip chip--info"><span className="chip__dot chip__dot--pulse"/>Loading 3 of 12</span>
            </div>
          </div>
          <LoadingState title="" lines={4}/>
        </div>
      );
    }
    return (
      <div className="workspace__placeholders">
        <div className="placeholder-card">
          <div className="placeholder-card__title">{m.entity ? "List" : "Overview"} placeholder</div>
          <div className="placeholder-card__body">
            This route's primary surface plugs in here. The shell, header, panels, status strip, and command palette already work.
          </div>
          <div className="placeholder-card__meta">
            {t && <EntityTypeBadge type={m.entity} size="xs"/>}
            <span className="chip chip--neutral">Hook: onOpenPanel</span>
          </div>
        </div>
        <div className="placeholder-card">
          <div className="placeholder-card__title">Detail placeholder</div>
          <div className="placeholder-card__body">
            Selecting a row from the list opens a SlidingPanel from the right. Multiple panels stack as overlapping archive cards.
          </div>
          <div className="placeholder-card__meta">
            <span className="chip chip--neutral">Hook: onSelectEntity</span>
            <Btn variant="outline" size="sm" icon="panel-right" data-callback="onOpenPanel" onClick={() => onOpenPanel && onOpenPanel("demo", { from: "workspace" })}>Open panel</Btn>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="workspace paper-grain"
      data-ui="Workspace"
      data-route={routeId}
      onContextMenu={handleContextMenu}
      onPointerDown={onPointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
    >
      <div className="workspace__inner">
        <article className="workspace__paper">
          <div className="workspace__crumb">
            <span>{BRAND.project.name}</span>
            <span className="workspace__crumb__sep">/</span>
            <span>{m.eyebrow}</span>
            {t && (<><span className="workspace__crumb__sep">/</span><EntityTypeBadge type={m.entity} size="xs"/></>)}
            {m.soon && <><span className="workspace__crumb__sep">/</span><span className="leftrail__soon">Coming soon</span></>}
          </div>
          <h1 className="workspace__title">{m.title}</h1>
          <p className="workspace__sub">{m.sub}</p>
          <div className="workspace__hr">
            <span className="workspace__hr__line"/>
            <span className="workspace__hr__glyph">❦</span>
            <span className="workspace__hr__line"/>
          </div>
          {renderBody()}
        </article>
      </div>
    </div>
  );
};

window.Workspace = Workspace;
window.ROUTE_META = ROUTE_META;


// ----- extraction-data.jsx -----
// =====================================================================
// extraction-data.jsx — All placeholder data for extraction & review UI.
// Every record is tagged _mock: true so it can be stripped in one pass.
// Replace with backend data; the UI shapes are documented at file end.
// =====================================================================

// ---------------------------------------------------------------------
// Extraction stages — order matters; the UI walks this list.
// ---------------------------------------------------------------------
const EXTRACTION_STAGES = [
  { id: "snapshot",   label: "Saving manuscript snapshot",  hint: "Freezing the page state…" },
  { id: "scan",       label: "Scanning known entities",     hint: "Re-confirming names you've already approved." },
  { id: "detect",     label: "Detecting new entities",      hint: "Looking for unfamiliar proper nouns and concepts." },
  { id: "alias",      label: "Matching aliases",            hint: "Reconciling nicknames, titles, and short-forms." },
  { id: "rel",        label: "Checking relationships",      hint: "Tracing who-knows-whom and how." },
  { id: "loc",        label: "Checking locations / travel", hint: "Following characters across the atlas." },
  { id: "items",      label: "Checking items / inventory",  hint: "Tracking artefacts, gear, and possessions." },
  { id: "stats",      label: "Checking stats & abilities",  hint: "Picking up combat lines and skill use." },
  { id: "quests",     label: "Checking quests & events",    hint: "Aligning beats against your structure." },
  { id: "queues",     label: "Building review queues",      hint: "Routing candidates to the right tabs." },
  { id: "complete",   label: "Complete",                    hint: "Ready for review." },
];

// ---------------------------------------------------------------------
// Mock review queue items.
// Shape: see __SHAPES__ at end.
// ---------------------------------------------------------------------
const MOCK_QUEUE_ITEMS = [
  // ----- CAST -----
  { _mock: true, id: "q-cast-1", entityType: "cast", confidence: { band: "high", value: 96 }, status: "auto-added",
    suggestion: "create",
    candidate: { name: "Captain Brec", aliases: ["Brec", "the Captain"], summary: "Watch captain at Pale Reach. Four winters' service. Familiar to Aelinor." },
    mention: "He looked the same as he had four winters ago, except for the way the cold had settled into his face.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" },
    sourceParagraph: "p3",
    matched: null,
    conflict: null,
    rationale: "Speaker tag 'said Captain Brec' + dialogue attribution + 7 prior mentions in Bk I.",
    sessionId: "ses-2026-05-06-0917",
    extractedAt: "2m ago",
  },
  { _mock: true, id: "q-cast-2", entityType: "cast", confidence: { band: "strong", value: 84 },  status: "pending",
    suggestion: "enrich",
    candidate: { name: "Aelinor Vey", aliases: ["the small dark queen"], summary: "Add new attribute: 'salt-air tremor'. Confirms long sleeplessness." },
    mention: "three nights of refusing the dreams had given her hands a fine, undignified tremor.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p2",
    matched: { id: "e-aelinor", name: "Aelinor Vey", confidence: 99 },
    conflict: null,
    rationale: "Subject pronoun chain resolves to Aelinor; new physical detail.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
  { _mock: true, id: "q-cast-3", entityType: "cast", confidence: { band: "uncertain", value: 61 }, status: "pending",
    suggestion: "merge",
    candidate: { name: "Saren", aliases: ["Saren of Hess"], summary: "Possibly the same as 'Saren of Hess' from Ch. 3." },
    mention: "what Saren of Hess sent me to bring.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p6",
    matched: { id: "e-saren-hess", name: "Saren of Hess", confidence: 78 },
    conflict: { kind: "alias-collision", note: "Bk I has 'Saren the Quiet'. Three Sarens now." },
    rationale: "String-similarity 0.82 + locative phrase 'of Hess' shared.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
  { _mock: true, id: "q-cast-4", entityType: "cast", confidence: { band: "weak", value: 38 }, status: "pending",
    suggestion: "create",
    candidate: { name: "the lieutenant", aliases: [], summary: "Possible new background character. Mentioned only by role." },
    mention: "the brazier had been pulled close to the lieutenant's table.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p4",
    matched: null,
    conflict: { kind: "common-noun", note: "Could be a role, not a person." },
    rationale: "Definite article + occupation. No prior naming.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- LOCATIONS -----
  { _mock: true, id: "q-loc-1", entityType: "locations", confidence: { band: "high", value: 94 }, status: "auto-added",
    suggestion: "enrich",
    candidate: { name: "Pale Reach", aliases: ["the Pale Reach"], summary: "New attribute: salt flats and tin-coloured winter light." },
    mention: "The light over Pale Reach was the colour of cooled tin.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p1",
    matched: { id: "e-pale-reach", name: "Pale Reach", confidence: 100 },
    conflict: null,
    rationale: "Exact-match existing canonical name; one new descriptor.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
  { _mock: true, id: "q-loc-2", entityType: "locations", confidence: { band: "weak", value: 41 }, status: "pending",
    suggestion: "merge",
    candidate: { name: "Vraska Pass", aliases: [], summary: "Possibly 'the Vraska' road from Ch. 2." },
    mention: "the road through the Vraska Pass is still walkable.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p7",
    matched: { id: "e-vraska", name: "the Vraska", confidence: 52 },
    conflict: { kind: "low-similarity", note: "Possessive form 'the Vraska' vs 'Vraska Pass'." },
    rationale: "Shared root 'Vraska' + travel verb; low surface match.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- ITEMS -----
  { _mock: true, id: "q-item-1", entityType: "items", confidence: { band: "strong", value: 88 }, status: "pending",
    suggestion: "update state",
    candidate: { name: "Auger of Hess", aliases: [], summary: "State change: in Saren's keeping → carried by Aelinor." },
    mention: "She carried the Auger of Hess in a felt-lined case slung across her back.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p2",
    matched: { id: "e-auger", name: "Auger of Hess", confidence: 100 },
    conflict: null,
    rationale: "Possession verb + carrier change vs last-known location.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- EVENTS -----
  { _mock: true, id: "q-evt-1", entityType: "events", confidence: { band: "uncertain", value: 67 }, status: "pending",
    suggestion: "create",
    candidate: { name: "The Auger Wake", aliases: [], summary: "Recent event. Two casualties + livestock at Pale Reach. ~ a week ago." },
    mention: "The Auger Wake came through here last week. Took two of mine, and a goat.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p5",
    matched: null,
    conflict: null,
    rationale: "Capitalised noun phrase + temporal anchor + casualty count.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- FACTIONS -----
  { _mock: true, id: "q-fac-1", entityType: "factions", confidence: { band: "uncertain", value: 58 }, status: "pending",
    suggestion: "enrich",
    candidate: { name: "The Grey Coats", aliases: [], summary: "Canon-shift: lowered banner. Bk I established 'never lower'." },
    mention: "The Grey Coats had left only the one banner.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p4",
    matched: { id: "e-greycoats", name: "The Grey Coats", confidence: 100 },
    conflict: { kind: "canon-shift", note: "Bk I §14: 'they would never lower it.'" },
    rationale: "Canonical fact contradiction; flag for author confirmation.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- LORE -----
  { _mock: true, id: "q-lore-1", entityType: "lore", confidence: { band: "strong", value: 79 }, status: "pending",
    suggestion: "create",
    candidate: { name: "The Hollowing", aliases: [], summary: "Implied event/condition. Possibly canonical." },
    mention: "We're not pretending anymore.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p5",
    matched: null,
    conflict: null,
    rationale: "Speaker tone shift + admission language; aligns with Bk I lore tag 'Hollowing'.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- BESTIARY -----
  { _mock: true, id: "q-best-1", entityType: "bestiary", confidence: { band: "weak", value: 44 }, status: "pending",
    suggestion: "create",
    candidate: { name: "Auger Wake (creature?)", aliases: [], summary: "Unclear if creature, weather, or event. Disambiguate." },
    mention: "The Auger Wake came through here last week.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p5",
    matched: null,
    conflict: { kind: "ambiguous-type", note: "May overlap with Events queue (q-evt-1)." },
    rationale: "Verb 'came through' suggests entity with motion.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- ABILITIES -----
  { _mock: true, id: "q-abil-1", entityType: "abilities", confidence: { band: "high", value: 95 }, status: "auto-added",
    suggestion: "link",
    candidate: { name: "Salt-Reading", aliases: [], summary: "Re-uses ability already in dossier; mention adds chapter to mention list." },
    mention: "she could feel the flats before she could see them.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p1",
    matched: { id: "e-saltread", name: "Salt-Reading", confidence: 100 },
    conflict: null,
    rationale: "Pattern-match against ability description.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- RELATIONSHIPS -----
  { _mock: true, id: "q-rel-1", entityType: "relationships", confidence: { band: "strong", value: 81 }, status: "pending",
    suggestion: "create",
    candidate: { name: "Aelinor ⇄ Brec (familiarity)", aliases: [], summary: "Long-standing acquaintance; warm-cold tone." },
    mention: "He looked the same as he had four winters ago.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p3",
    matched: null,
    conflict: null,
    rationale: "Temporal anchor + recognition cue.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- TIMELINE -----
  { _mock: true, id: "q-tl-1", entityType: "timeline", confidence: { band: "high", value: 92 }, status: "auto-added",
    suggestion: "create",
    candidate: { name: "Brec's letter (3 nights ago)", aliases: [], summary: "Anchor event preceding chapter open." },
    mention: "She had not slept since Brec's letter.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p2",
    matched: null,
    conflict: null,
    rationale: "Possessive anchor + duration cue.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
];

// ---------------------------------------------------------------------
// Extraction sessions (history)
// ---------------------------------------------------------------------
const MOCK_SESSIONS = [
  { _mock: true,
    id: "ses-2026-05-06-0917", chapterId: "c7", chapterLabel: "Ch. 7 — Ash & Auger",
    mode: "deep", privacy: "local",
    startedAt: "9:17 AM", completedAt: "9:18 AM", duration: "1m 12s",
    totals: { candidates: 14, accepted: 0, merged: 0, denied: 0, autoAdded: 4, failed: 0 },
    note: "Most recent run.",
    state: "complete",
  },
  { _mock: true,
    id: "ses-2026-05-04-1432", chapterId: "c3", chapterLabel: "Ch. 3 — Saren's Bargain",
    mode: "quick", privacy: "local",
    startedAt: "May 4 · 2:32 PM", completedAt: "May 4 · 2:32 PM", duration: "18s",
    totals: { candidates: 6, accepted: 5, merged: 1, denied: 0, autoAdded: 2, failed: 0 },
    note: "Routine sweep; clean pass.",
    state: "complete",
  },
  { _mock: true,
    id: "ses-2026-05-02-1108", chapterId: "c2", chapterLabel: "Ch. 2 — Pale Reach",
    mode: "deep", privacy: "ai",
    startedAt: "May 2 · 11:08 AM", completedAt: "May 2 · 11:11 AM", duration: "2m 47s",
    totals: { candidates: 22, accepted: 18, merged: 3, denied: 1, autoAdded: 6, failed: 0 },
    note: "Heavy lore session.",
    state: "complete",
  },
];

// ---------------------------------------------------------------------
// Auto-added (blue) history items (already in canon, still reviewable)
// ---------------------------------------------------------------------
const MOCK_AUTOADDED = [
  { _mock: true, id: "a1", entityType: "cast",      name: "Captain Brec",        addedAt: "2m ago",  confidence: 96, sessionId: "ses-2026-05-06-0917" },
  { _mock: true, id: "a2", entityType: "locations", name: "Pale Reach",          addedAt: "2m ago",  confidence: 94, sessionId: "ses-2026-05-06-0917" },
  { _mock: true, id: "a3", entityType: "abilities", name: "Salt-Reading",        addedAt: "2m ago",  confidence: 95, sessionId: "ses-2026-05-06-0917" },
  { _mock: true, id: "a4", entityType: "timeline",  name: "Brec's letter",       addedAt: "2m ago",  confidence: 92, sessionId: "ses-2026-05-06-0917" },
];

// ---------------------------------------------------------------------
// Per-entity queue counts (for Global Review Overview cards)
// ---------------------------------------------------------------------
const MOCK_OVERVIEW_COUNTS = {
  cast:          { pending: 4,  high: 1, strong: 1, uncertain: 1, weak: 1, autoAdded: 1, lastUpdated: "2m ago" },
  bestiary:      { pending: 1,  high: 0, strong: 0, uncertain: 0, weak: 1, autoAdded: 0, lastUpdated: "2m ago" },
  locations:     { pending: 2,  high: 1, strong: 0, uncertain: 0, weak: 1, autoAdded: 1, lastUpdated: "2m ago" },
  items:         { pending: 1,  high: 0, strong: 1, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  classes:       { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  races:         { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  stats:         { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  abilities:     { pending: 1,  high: 1, strong: 0, uncertain: 0, weak: 0, autoAdded: 1, lastUpdated: "2m ago" },
  skillTrees:    { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  quests:        { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "yest." },
  events:        { pending: 1,  high: 0, strong: 0, uncertain: 1, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  factions:      { pending: 1,  high: 0, strong: 0, uncertain: 1, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  lore:          { pending: 1,  high: 0, strong: 1, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  relationships: { pending: 1,  high: 0, strong: 1, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  timeline:      { pending: 1,  high: 1, strong: 0, uncertain: 0, weak: 0, autoAdded: 1, lastUpdated: "2m ago" },
  references:    { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
};

// ---------------------------------------------------------------------
// __SHAPES__ (for Claude Code hookup — duplicated in handoff notes)
// ---------------------------------------------------------------------
//
// QueueItem {
//   id: string,
//   entityType: keyof ENTITY_TYPES,
//   confidence: { band: "high"|"strong"|"uncertain"|"weak", value: number /* 0-100 */ },
//   status: "pending"|"auto-added"|"accepted"|"edited"|"merged"|"denied"|"needs-attention",
//   suggestion: "create"|"enrich"|"link"|"merge"|"update state",
//   candidate: { name: string, aliases: string[], summary: string },
//   mention: string,                  // raw extracted span
//   sourceChapter: { id, num, title },
//   sourceParagraph: string,          // anchor id
//   matched: null | { id, name, confidence },
//   conflict: null | { kind, note },
//   rationale: string,                // "why detected"
//   sessionId: string,
//   extractedAt: string,
// }
//
// ExtractionSession {
//   id, chapterId, chapterLabel, mode: "quick"|"deep", privacy: "local"|"cloud"|"ai",
//   startedAt, completedAt, duration,
//   totals: { candidates, accepted, merged, denied, autoAdded, failed },
//   state: "running"|"complete"|"error"|"cancelled",
//   note, error?,
// }
//

Object.assign(window, {
  EXTRACTION_STAGES,
  MOCK_QUEUE_ITEMS,
  MOCK_SESSIONS,
  MOCK_AUTOADDED,
  MOCK_OVERVIEW_COUNTS,
});


// ----- extraction-progress.jsx -----
// =====================================================================
// extraction-progress.jsx — ExtractionProgressModal + failed/running states
// All visual; emits callbacks for hookup. No real extraction logic.
// =====================================================================

const { useState: _epUS, useEffect: _epUE, useMemo: _epUM } = React;

// ---------------------------------------------------------------------
// Helper — format type-count grid using ENTITY_TYPES order
// ---------------------------------------------------------------------
const EXM_COUNT_KEYS = ["cast", "bestiary", "locations", "items", "events", "factions", "abilities", "lore", "relationships", "timeline"];

// ---------------------------------------------------------------------
// ExtractionProgressModal
//
// props:
//   open: boolean
//   mode: "quick" | "deep"
//   privacy: "local" | "cloud" | "ai"
//   chapterLabel: string
//   sessionId: string
//   stageIndex: number     -- which stage is currently active
//   counts: { [entityType]: number }
//   state: "running" | "complete" | "error" | "cancelled"
//   error?: { title, body, detail }
//   onCancel, onContinueInBackground, onOpenSession, onClose, onRetry
// ---------------------------------------------------------------------
const ExtractionProgressModal = ({
  open,
  mode = "quick",
  privacy = "local",
  chapterLabel = "Chapter",
  sessionId = "ses-…",
  stageIndex = 0,
  counts = {},
  state = "running",
  error,
  onCancelExtraction,
  onContinueExtractionInBackground,
  onOpenExtractionSession,
  onClose,
  onRerunExtraction,
}) => {
  if (!open) return null;

  const stages = EXTRACTION_STAGES;
  const total = stages.length;
  const pct = state === "complete" ? 100
    : state === "error"   ? Math.max(8, (stageIndex / total) * 100)
    : Math.max(4, ((stageIndex + 0.5) / total) * 100);

  const totalDetected = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="exm-backdrop" data-ui="ExtractionProgressModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="exm-title">
      <div className="exm" data-ui="ExtractionProgressModal" data-state={state} data-testid="extraction-progress">
        <div className="exm__head">
          <div className="exm__sigil" aria-hidden>
            <Icon name={state === "error" ? "warn" : state === "complete" ? "check" : "sparkle"} size={18}/>
          </div>
          <div className="exm__title-stack">
            <div className="exm__eyebrow">
              {state === "running"   && (mode === "deep" ? "Deep extraction" : "Quick extraction")}
              {state === "complete"  && "Extraction complete"}
              {state === "error"     && "Extraction failed"}
              {state === "cancelled" && "Extraction cancelled"}
            </div>
            <div className="exm__title" id="exm-title">
              {state === "complete"
                ? "The page has been read."
                : state === "error"
                ? "Couldn't finish reading the page."
                : "Reading the page…"}
            </div>
            <div className="exm__title-meta">
              <span>{chapterLabel}</span>
              <span>·</span>
              <span className="chip">{mode === "deep" ? "DEEP" : "QUICK"}</span>
              <span className="chip">{privacy === "local" ? "LOCAL" : privacy === "ai" ? "AI" : "CLOUD"}</span>
            </div>
          </div>
          <div className="exm__head-actions">
            <Btn variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="Close" data-callback="onCloseExtractionModal"/>
          </div>
        </div>

        <div className="exm__bar" aria-hidden>
          <div className="exm__bar__fill" style={{ width: pct + "%" }}/>
        </div>

        {state === "error" ? (
          <div className="exm__failed">
            <div className="exm__failed__icon"><Icon name="warn" size={26}/></div>
            <div className="exm__failed__title">{error?.title || "Extraction failed"}</div>
            <div className="exm__failed__body">{error?.body || "Your draft is safe. The local model couldn't reach the manuscript index — try again, or continue without extraction."}</div>
            {error?.detail && (
              <pre className="exm__failed__detail">{error.detail}</pre>
            )}
          </div>
        ) : (
          <div className="exm__body">
            <div className="exm__stages" role="list">
              <div className="exm__col-title">Stages</div>
              {stages.map((s, i) => {
                const st = state === "complete" ? "done"
                  : state === "cancelled" && i > stageIndex ? "pending"
                  : i < stageIndex ? "done"
                  : i === stageIndex ? "active"
                  : "pending";
                return (
                  <div key={s.id} className="exm__stage" data-state={st} role="listitem">
                    <div className="exm__stage__dot" aria-hidden>
                      {st === "done" && <Icon name="check" size={11}/>}
                      {st === "pending" && <span style={{ width: 4, height: 4, borderRadius: 99, background: "currentColor" }}/>}
                    </div>
                    <div className="exm__stage__txt">
                      <div className="exm__stage__lbl">{s.label}</div>
                      <div className="exm__stage__hint">{s.hint}</div>
                    </div>
                    {st !== "pending" && counts[s.id] != null && (
                      <span className="exm__stage__count">+{counts[s.id]}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="exm__counts">
              <div className="exm__col-title">Detected so far · {totalDetected}</div>
              <div className="exm__count-grid">
                {EXM_COUNT_KEYS.map((k) => {
                  const t = ENTITY_TYPES[k];
                  if (!t) return null;
                  const v = counts[k] || 0;
                  return (
                    <div key={k} className="exm__count-row" data-zero={v === 0}>
                      <EntityTypeBadge type={k} size="xs" showLabel={false}/>
                      <span className="exm__count-row__lbl">{t.label}</span>
                      <span className="exm__count-row__val">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="exm__foot">
          <div className="exm__foot__hint">
            {state === "running"   && <>Session <span className="mono">{sessionId}</span> · <em>You can keep writing — this runs in the background.</em></>}
            {state === "complete"  && <>Found {totalDetected} candidates across {Object.keys(counts).filter((k) => counts[k]).length} entity types.</>}
            {state === "error"     && <>Session <span className="mono">{sessionId}</span></>}
            {state === "cancelled" && <>No changes were saved to your dossiers.</>}
          </div>
          <div className="exm__foot__actions">
            {state === "running" && (
              <>
                <Btn variant="ghost" size="sm" data-callback="onCancelExtraction" data-testid="extraction-cancel" onClick={onCancelExtraction}>Cancel</Btn>
                <Btn variant="outline" size="sm" icon="clock" data-callback="onContinueExtractionInBackground" data-testid="extraction-bg" onClick={onContinueExtractionInBackground}>Continue in background</Btn>
                <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Session details</Btn>
              </>
            )}
            {state === "complete" && (
              <>
                <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Session details</Btn>
                <Btn variant="primary" size="sm" icon="bell" data-callback="onOpenGlobalReview" onClick={onClose}>Review {totalDetected} candidates</Btn>
              </>
            )}
            {state === "error" && (
              <>
                <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
                <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Open logs</Btn>
                <Btn variant="primary" size="sm" icon="bolt" data-callback="onRerunExtraction" data-testid="extraction-retry" onClick={onRerunExtraction}>Retry</Btn>
              </>
            )}
            {state === "cancelled" && (
              <Btn variant="primary" size="sm" onClick={onClose}>Dismiss</Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ExtractionProgressModal, EXM_COUNT_KEYS });


// ----- extraction-session.jsx -----
// =====================================================================
// extraction-session.jsx — ExtractionSessionDrawer
// Right-side full-height drawer summarizing one extraction run.
// =====================================================================

const { useState: _esUS } = React;

// ---------------------------------------------------------------------
// ExtractionSessionDrawer
//
// props:
//   open: boolean
//   session: ExtractionSession | null
//   history: ExtractionSession[]    -- previous runs to switch between
//   onClose, onRerunExtraction, onOpenSourceChapter, onCompareWithPrevious
// ---------------------------------------------------------------------
const ExtractionSessionDrawer = ({
  open,
  session,
  history = [],
  onClose,
  onRerunExtraction,
  onOpenSourceChapter,
  onCompareWithPrevious,
  onSelectSession,
}) => {
  if (!open) return null;
  const [activeId, setActiveId] = _esUS(session?.id);

  const active = history.find((s) => s.id === activeId) || session;
  if (!active) return null;
  const t = active.totals || {};

  return (
    <>
      <div className="esd-backdrop" onClick={onClose} aria-hidden/>
      <aside className="esd" data-ui="ExtractionSessionDrawer" role="complementary" aria-label="Extraction session" data-testid="extraction-session-drawer">
        <div className="esd__head">
          <div>
            <div className="esd__eyebrow">Extraction Session</div>
            <div className="esd__title">{active.chapterLabel}</div>
            <div className="esd__id">ID · {active.id}</div>
          </div>
          <Btn variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="Close drawer" data-callback="onClosePanel"/>
        </div>

        <div className="esd__body">
          {/* Meta */}
          <section>
            <div className="esd__sec-title">Run details</div>
            <div className="esd__meta-grid">
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Mode</div>
                <div className="esd__meta-row__val">{active.mode === "deep" ? "Deep extraction" : "Quick extraction"}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Privacy</div>
                <div className="esd__meta-row__val">
                  {active.privacy === "local" ? "Local model" : active.privacy === "ai" ? "AI cloud" : "Cloud"}
                </div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Started</div>
                <div className="esd__meta-row__val esd__meta-row__val--mono">{active.startedAt}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Completed</div>
                <div className="esd__meta-row__val esd__meta-row__val--mono">{active.completedAt || "—"}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Duration</div>
                <div className="esd__meta-row__val esd__meta-row__val--mono">{active.duration || "—"}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">State</div>
                <div className="esd__meta-row__val">
                  <span className="chip">{(active.state || "complete").toUpperCase()}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Totals */}
          <section>
            <div className="esd__sec-title">Outcome</div>
            <div className="esd__totals">
              <div className="esd__total" data-tone="info">
                <div className="esd__total__val">{t.candidates ?? 0}</div>
                <div className="esd__total__lbl">Candidates</div>
              </div>
              <div className="esd__total" data-tone="info">
                <div className="esd__total__val">{t.autoAdded ?? 0}</div>
                <div className="esd__total__lbl">Auto-added</div>
              </div>
              <div className="esd__total" data-tone="ok">
                <div className="esd__total__val">{t.accepted ?? 0}</div>
                <div className="esd__total__lbl">Accepted</div>
              </div>
              <div className="esd__total" data-tone="ok">
                <div className="esd__total__val">{t.merged ?? 0}</div>
                <div className="esd__total__lbl">Merged</div>
              </div>
              <div className="esd__total" data-tone="warn">
                <div className="esd__total__val">{t.denied ?? 0}</div>
                <div className="esd__total__lbl">Denied</div>
              </div>
              <div className="esd__total" data-tone="danger">
                <div className="esd__total__val">{t.failed ?? 0}</div>
                <div className="esd__total__lbl">Failed</div>
              </div>
            </div>
            {active.note && (
              <div style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--ink-3)", fontStyle: "italic" }}>
                {active.note}
              </div>
            )}
          </section>

          {/* Previous sessions */}
          {history.length > 1 && (
            <section>
              <div className="esd__sec-title">Previous runs · {history.length}</div>
              <div className="esd__history">
                {history.map((s) => (
                  <div
                    key={s.id}
                    className={"esd__history__row " + (s.id === active.id ? "is-active" : "")}
                    onClick={() => { setActiveId(s.id); onSelectSession && onSelectSession(s.id); }}
                    data-callback="onSelectSession"
                  >
                    <div className="esd__history__row-top">
                      <span className="chip">{s.mode === "deep" ? "DEEP" : "QUICK"}</span>
                      <span style={{ flex: 1, color: "var(--ink-1)" }}>{s.chapterLabel}</span>
                      <span style={{ color: "var(--ink-4)" }}>{s.startedAt}</span>
                    </div>
                    <div className="esd__history__row-bot">
                      <span>{s.totals?.candidates ?? 0} cand.</span>
                      <span>{s.totals?.accepted ?? 0} acc.</span>
                      <span>{s.totals?.denied ?? 0} den.</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="esd__foot">
          <div style={{ display: "flex", gap: "var(--sp-3)" }}>
            <Btn variant="ghost" size="sm" icon="feather" data-callback="onOpenSourceChapter" onClick={onOpenSourceChapter}>Open chapter</Btn>
            <Btn variant="ghost" size="sm" icon="link" data-callback="onCompareWithPrevious" onClick={onCompareWithPrevious}>Compare</Btn>
          </div>
          <Btn variant="primary" size="sm" icon="bolt" data-callback="onRerunExtraction" onClick={onRerunExtraction}>Re-run</Btn>
        </div>
      </aside>
    </>
  );
};

Object.assign(window, { ExtractionSessionDrawer });


// ----- review-overview.jsx -----
// =====================================================================
// review-overview.jsx — GlobalReviewOverview
// Renders a grid of per-entity review cards. Lives inside SlidingPanel.
// =====================================================================

const { useMemo: _roUM } = React;

// Order matches brand spec; cast/bestiary/locations/items first.
const GRO_ENTITY_ORDER = [
  "cast", "bestiary", "locations", "items",
  "classes", "races", "stats", "abilities",
  "skillTrees", "quests", "events", "factions",
  "lore", "relationships", "timeline", "references",
];

// ---------------------------------------------------------------------
// GroCard — one entity tile
// ---------------------------------------------------------------------
const GroCard = ({ entityType, counts, onOpenEntityReviewQueue }) => {
  const t = ENTITY_TYPES[entityType];
  if (!t) return null;
  const total = counts?.pending ?? 0;
  const empty = total === 0 && (counts?.autoAdded ?? 0) === 0;
  const urgent = (counts?.weak ?? 0) > 0;

  // Build segmented bar — only includes bands with count > 0
  const segs = [
    { key: "high",      v: counts?.high ?? 0,      lbl: "Auto" },
    { key: "strong",    v: counts?.strong ?? 0,    lbl: "Strong" },
    { key: "uncertain", v: counts?.uncertain ?? 0, lbl: "Uncertain" },
    { key: "weak",      v: counts?.weak ?? 0,      lbl: "Weak" },
  ];
  const sum = segs.reduce((a, s) => a + s.v, 0);

  return (
    <div
      className="gro__card"
      data-ui="GroCard"
      data-callback="onOpenEntityReviewQueue"
      data-testid={"gro-card-" + entityType}
      data-empty={empty}
      data-urgent={urgent}
      tabIndex={0}
      role="button"
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
      onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue(entityType)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEntityReviewQueue && onOpenEntityReviewQueue(entityType); } }}
    >
      <div className="gro__card__head">
        <div className="gro__card__name">
          <span className="gro__card__glyph" aria-hidden>{t.glyph}</span>
          {t.label}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="gro__card__total">{total}</div>
          <div className="gro__card__total-lbl">Pending</div>
        </div>
      </div>

      <div className="gro__bar" aria-hidden>
        {sum > 0 ? segs.map((s) => s.v > 0 && (
          <span
            key={s.key}
            className={"gro__bar__seg gro__bar__seg--" + s.key}
            style={{ width: ((s.v / sum) * 100) + "%" }}
            title={s.lbl + ": " + s.v}
          />
        )) : (
          <span style={{ width: "100%", background: "var(--line-1)" }}/>
        )}
      </div>

      <div className="gro__card__counts">
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#2e5fa8" }}/>{counts?.high ?? 0}</span>
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#4f8045" }}/>{counts?.strong ?? 0}</span>
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#d68a2e" }}/>{counts?.uncertain ?? 0}</span>
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#9c3a2e" }}/>{counts?.weak ?? 0}</span>
      </div>

      <div className="gro__card__foot">
        <span>Auto-added · {counts?.autoAdded ?? 0}</span>
        <span className="gro__card__foot__last">{counts?.lastUpdated || "—"}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// GlobalReviewOverview
// ---------------------------------------------------------------------
const GlobalReviewOverview = ({
  countsByType = {},
  state = "default", // default | empty | loading | error | partial
  onOpenEntityReviewQueue,
  onOpenExtractionSession,
}) => {
  if (state === "loading") {
    return (
      <div className="gro" data-ui="GlobalReviewOverview" data-state="loading">
        <LoadingState title="Counting candidates…" lines={4}/>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="gro" data-ui="GlobalReviewOverview" data-state="error">
        <ErrorState title="Couldn't load review counts" body="Your queues are safe — the index just didn't respond. Try again."/>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="gro" data-ui="GlobalReviewOverview" data-state="empty">
        <EmptyState
          icon="bell"
          title="The queues are clear"
          body="No candidates are waiting. Run an extraction on a chapter to surface new entities."
        />
      </div>
    );
  }

  const totalPending = Object.values(countsByType).reduce((a, c) => a + (c?.pending || 0), 0);

  return (
    <div className="gro" data-ui="GlobalReviewOverview" data-state={state}>
      <div className="gro__intro">
        <div className="gro__intro__title">{totalPending} candidate{totalPending === 1 ? "" : "s"} across the queues</div>
        <div className="gro__intro__sub">
          Review lives inside each entity tab. Pick a queue to triage, or open the latest <a onClick={onOpenExtractionSession} style={{ color: "var(--accent-deep)", cursor: "pointer", textDecoration: "underline" }} data-callback="onOpenExtractionSession">extraction session</a>.
        </div>
      </div>

      <div className="gro__legend" aria-label="Confidence legend">
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#2e5fa8" }}/>Auto-added (95%+)</span>
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#4f8045" }}/>Strong (75–94%)</span>
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#d68a2e" }}/>Uncertain (50–74%)</span>
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#9c3a2e" }}/>Weak (&lt;50%)</span>
      </div>

      <div className="gro__grid">
        {GRO_ENTITY_ORDER.map((k) => (
          <GroCard
            key={k}
            entityType={k}
            counts={countsByType[k]}
            onOpenEntityReviewQueue={onOpenEntityReviewQueue}
          />
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { GlobalReviewOverview, GroCard, GRO_ENTITY_ORDER });


// ----- review-queue.jsx -----
// =====================================================================
// review-queue.jsx — EntityReviewQueue + ReviewQueueCard + filter bar
// + bulk actions + auto-added collapsible.
// All presentational; emits hook-ready callbacks.
// =====================================================================

const { useState: _rqUS, useMemo: _rqUM } = React;

// ---------------------------------------------------------------------
// Suggestion label helper
// ---------------------------------------------------------------------
const SUGGESTION_LABELS = {
  "create":       "Create new",
  "enrich":       "Enrich existing",
  "link":         "Link mention",
  "merge":        "Merge with existing",
  "update state": "Update state",
};

// ---------------------------------------------------------------------
// QueueFilterBar
// ---------------------------------------------------------------------
const QueueFilterBar = ({
  query, onQuery,
  confidence, onConfidence,
  status, onStatus,
  chapter, onChapter,
  session, onSession,
  sortBy, onSortBy,
  view, onView,
  chapters = [],
  sessions = [],
}) => {
  return (
    <div className="qfb" data-ui="QueueFilterBar">
      <div className="qfb__row">
        <label className="qfb__search">
          <Icon name="search" size={12}/>
          <input
            value={query || ""}
            onChange={(e) => onQuery && onQuery(e.target.value)}
            placeholder="Search candidates, mentions, quotes…"
            data-callback="onSearchQueue"
            data-testid="queue-search"
          />
        </label>
        <div className="qfb__seg" role="group" aria-label="Confidence filter">
          {[
            { k: "all",       l: "All",    c: null },
            { k: "high",      l: "Auto",   c: "#2e5fa8" },
            { k: "strong",    l: "Strong", c: "#4f8045" },
            { k: "uncertain", l: "Unc.",   c: "#d68a2e" },
            { k: "weak",      l: "Weak",   c: "#9c3a2e" },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              className={"qfb__seg__btn " + (confidence === f.k ? "is-active" : "")}
              onClick={() => onConfidence && onConfidence(f.k)}
              data-callback="onFilterConfidence"
            >
              {f.c && <span className="qfb__seg__dot" style={{ background: f.c }}/>}
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="qfb__row">
        <select className="qfb__select" value={status || "all"} onChange={(e) => onStatus && onStatus(e.target.value)} data-callback="onFilterStatus">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="auto-added">Auto-added</option>
          <option value="needs-attention">Needs attention</option>
          <option value="accepted">Accepted</option>
          <option value="edited">Edited</option>
          <option value="merged">Merged</option>
          <option value="denied">Denied</option>
        </select>
        <select className="qfb__select" value={chapter || "all"} onChange={(e) => onChapter && onChapter(e.target.value)} data-callback="onFilterChapter">
          <option value="all">All chapters</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>Ch. {c.num} — {c.title || "Untitled"}</option>)}
        </select>
        <select className="qfb__select" value={session || "all"} onChange={(e) => onSession && onSession(e.target.value)} data-callback="onFilterSession">
          <option value="all">All sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
        </select>
        <span style={{ flex: 1 }}/>
        <select className="qfb__select" value={sortBy || "confidence"} onChange={(e) => onSortBy && onSortBy(e.target.value)} data-callback="onSortQueue">
          <option value="confidence">Sort: Confidence</option>
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="qfb__seg" role="group" aria-label="View toggle">
          <button type="button" className={"qfb__seg__btn " + (view === "list" ? "is-active" : "")} onClick={() => onView && onView("list")} title="List" data-callback="onToggleQueueView">
            <Icon name="bars" size={11}/>List
          </button>
          <button type="button" className={"qfb__seg__btn " + (view === "grid" ? "is-active" : "")} onClick={() => onView && onView("grid")} title="Grid" data-callback="onToggleQueueView">
            <Icon name="grip" size={11}/>Grid
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// QueueBulkActions
// ---------------------------------------------------------------------
const QueueBulkActions = ({ count, onBulkAccept, onBulkDeny, onBulkMerge, onClearSelection }) => {
  if (!count) return null;
  return (
    <div className="qba" data-ui="QueueBulkActions" role="region" aria-label="Bulk queue actions">
      <span className="qba__lbl"><strong>{count}</strong> selected</span>
      <Btn variant="ghost" size="sm" icon="check" data-callback="onBulkAcceptQueueItems" onClick={onBulkAccept}>Accept all</Btn>
      <Btn variant="ghost" size="sm" icon="link" data-callback="onBulkMergeQueueItems" onClick={onBulkMerge}>Merge all</Btn>
      <Btn variant="ghost" size="sm" icon="close" data-callback="onBulkDenyQueueItems" onClick={onBulkDeny}>Deny all</Btn>
      <span className="qba__spacer"/>
      <Btn variant="ghost" size="sm" onClick={onClearSelection}>Clear</Btn>
    </div>
  );
};

// ---------------------------------------------------------------------
// ConfidenceStrip — coloured left edge w/ percentage chip in card head
// ---------------------------------------------------------------------
const ConfidenceStrip = ({ band }) => <div className="rqc__strip" data-ui="ConfidenceStrip" data-band={band} aria-hidden/>;

// ---------------------------------------------------------------------
// ConfidenceBandBadge — text label per band
// ---------------------------------------------------------------------
const CONFIDENCE_LABELS = {
  high:      "Auto-added · still reviewable",
  strong:    "Strong suggestion",
  uncertain: "Needs review",
  weak:      "Weak match · manual confirmation",
};
const ConfidenceBandBadge = ({ band }) => (
  <span className="rqc__head__band" data-ui="ConfidenceBandBadge"><span>{CONFIDENCE_LABELS[band] || band}</span></span>
);

// ---------------------------------------------------------------------
// ReviewQueueCard
// ---------------------------------------------------------------------
const ReviewQueueCard = ({
  item, selected, expanded: expandedProp,
  onToggleSelect,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onOpenSourceInManuscript, onOpenRelatedTab,
  onKeepAutoAddedItem, onRemoveAutoAddedItem,
}) => {
  const [expanded, setExpanded] = _rqUS(!!expandedProp);
  const c = CONFIDENCE[item.confidence?.band] || CONFIDENCE.uncertain;
  const t = ENTITY_TYPES[item.entityType];
  const isAuto = item.status === "auto-added";

  return (
    <article
      className={"rqc " + (selected ? "is-selected " : "")}
      data-ui="ReviewQueueCard"
      data-testid={"rqc-" + item.id}
      data-status={item.status}
      data-band={item.confidence?.band}
      style={{
        "--cc": c.color, "--cs": c.soft, "--cd": c.deep,
        "--ec": t?.color, "--es": t?.soft, "--ed": t?.deep,
      }}
    >
      <ConfidenceStrip band={item.confidence?.band}/>
      <div className="rqc__main">
        <div className="rqc__head">
          <EntityTypeBadge type={item.entityType} size="xs"/>
          <ConfidenceBadge level={item.confidence?.band} value={item.confidence?.value}/>
          <span className="rqc__head__suggestion">· {SUGGESTION_LABELS[item.suggestion] || item.suggestion}</span>
          <ConfidenceBandBadge band={item.confidence?.band}/>
        </div>

        <div className="rqc__name">
          <span>{item.candidate?.name}</span>
          {item.matched && (
            <span className="rqc__name__match">
              <span className="rqc__name__match__arrow">↦</span>
              <span className="rqc__name__match__hit">{item.matched.name}</span>
              <span style={{ color: "var(--ink-4)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", marginLeft: 4 }}>· {item.matched.confidence}% match</span>
            </span>
          )}
        </div>

        <div className="rqc__summary">{item.candidate?.summary}</div>

        <div className="rqc__mention">
          <em>"{item.mention}"</em>
        </div>

        {item.conflict && (
          <div className="rqc__conflict">
            <span className="rqc__conflict__kind">{item.conflict.kind}</span>
            <span>{item.conflict.note}</span>
          </div>
        )}

        <div className="rqc__meta">
          <a data-callback="onOpenSourceInManuscript" onClick={() => onOpenSourceInManuscript && onOpenSourceInManuscript(item)}>↳ Ch. {item.sourceChapter?.num} · {item.sourceParagraph}</a>
          <span>·</span>
          <span>{item.extractedAt}</span>
          {item.candidate?.aliases?.length > 0 && (
            <>
              <span>·</span>
              <span>aliases: {item.candidate.aliases.join(", ")}</span>
            </>
          )}
        </div>

        {expanded && (
          <div className="rqc__detail">
            <div className="rqc__detail__sec">
              <div className="rqc__detail__sec__lbl">Source quote</div>
              <div className="rqc__detail__quote">"{item.mention}"</div>
            </div>
            <div className="rqc__detail__sec">
              <div className="rqc__detail__sec__lbl">Why this was detected</div>
              <div>{item.rationale}</div>
            </div>
            {item.candidate?.aliases?.length > 0 && (
              <div className="rqc__detail__sec">
                <div className="rqc__detail__sec__lbl">Aliases</div>
                <div className="mono" style={{ fontSize: "var(--fs-xs)" }}>{item.candidate.aliases.join(" · ")}</div>
              </div>
            )}
            <div className="rqc__detail__sec">
              <div className="rqc__detail__sec__lbl">Extraction session</div>
              <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>{item.sessionId}</div>
            </div>
          </div>
        )}

        <div className="rqc__actions">
          {isAuto ? (
            <>
              <Btn variant="primary" size="sm" icon="check" className="rqc__primary" data-callback="onKeepAutoAddedItem" data-testid={"rqc-keep-" + item.id} onClick={() => onKeepAutoAddedItem && onKeepAutoAddedItem(item)}>Keep</Btn>
              <Btn variant="ghost" size="sm" icon="more" data-callback="onEditQueueItem" onClick={() => onEditQueueItem && onEditQueueItem(item)}>Edit</Btn>
              <Btn variant="ghost" size="sm" icon="link" data-callback="onMergeQueueItem" onClick={() => onMergeQueueItem && onMergeQueueItem(item)}>Merge</Btn>
              <Btn variant="ghost" size="sm" icon="trash" data-callback="onRemoveAutoAddedItem" onClick={() => onRemoveAutoAddedItem && onRemoveAutoAddedItem(item)}>Remove</Btn>
            </>
          ) : (
            <>
              <Btn variant="primary" size="sm" icon="check" className="rqc__primary" data-callback="onAcceptQueueItem" data-testid={"rqc-accept-" + item.id} onClick={() => onAcceptQueueItem && onAcceptQueueItem(item)}>Accept</Btn>
              <Btn variant="outline" size="sm" icon="more" data-callback="onEditQueueItem" data-testid={"rqc-edit-" + item.id} onClick={() => onEditQueueItem && onEditQueueItem(item)}>Edit</Btn>
              <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem" data-testid={"rqc-merge-" + item.id} onClick={() => onMergeQueueItem && onMergeQueueItem(item)}>Merge</Btn>
              <Btn variant="ghost" size="sm" icon="close" data-callback="onDenyQueueItem" data-testid={"rqc-deny-" + item.id} onClick={() => onDenyQueueItem && onDenyQueueItem(item)}>Deny</Btn>
            </>
          )}
          <span className="rqc__actions__spacer"/>
          <Btn variant="ghost" size="sm" icon="feather" data-callback="onOpenSourceInManuscript" onClick={() => onOpenSourceInManuscript && onOpenSourceInManuscript(item)} aria-label="Open source"/>
          <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenRelatedTab" onClick={() => onOpenRelatedTab && onOpenRelatedTab(item)} aria-label="Open dossier"/>
          <button className="rqc__expand" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse" : "Expand"}>
            <Icon name={expanded ? "chevron-up" : "chevron-d"} size={11}/>
            {expanded ? "Less" : "Why?"}
          </button>
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------
// AutoAddedHistoryCard — slim row for blue items in collapsible section
// ---------------------------------------------------------------------
const AutoAddedHistoryCard = ({ item, onKeepAutoAddedItem, onRemoveAutoAddedItem, onEditQueueItem, onOpenRelatedTab }) => {
  const t = ENTITY_TYPES[item.entityType];
  return (
    <div className="aahc" data-ui="AutoAddedHistoryCard" data-testid={"aahc-" + item.id}>
      <div className="aahc__strip" aria-hidden/>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <EntityTypeBadge type={item.entityType} size="xs"/>
          <span className="aahc__name">{item.name}</span>
        </div>
        <div className="aahc__meta">
          <span>{item.confidence}%</span>
          <span>·</span>
          <span>{item.addedAt}</span>
          <span>·</span>
          <span style={{ color: "var(--ink-3)" }}>{t?.label}</span>
        </div>
      </div>
      <div className="aahc__actions">
        <Btn variant="ghost" size="sm" icon="check" data-callback="onKeepAutoAddedItem" onClick={() => onKeepAutoAddedItem && onKeepAutoAddedItem(item)} aria-label="Keep"/>
        <Btn variant="ghost" size="sm" icon="more" data-callback="onEditQueueItem" onClick={() => onEditQueueItem && onEditQueueItem(item)} aria-label="Edit"/>
        <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenRelatedTab" onClick={() => onOpenRelatedTab && onOpenRelatedTab(item)} aria-label="Open dossier"/>
        <Btn variant="ghost" size="sm" icon="trash" data-callback="onRemoveAutoAddedItem" onClick={() => onRemoveAutoAddedItem && onRemoveAutoAddedItem(item)} aria-label="Remove"/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityReviewQueue — full per-entity queue (lives in panel body)
// ---------------------------------------------------------------------
const EntityReviewQueue = ({
  entityType,
  items = [],
  autoAdded = [],
  chapters = [],
  sessions = [],
  state = "default",       // default | empty | loading | error
  filters = {},
  setFilters,
  selectedIds = [],
  setSelectedIds,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onBulkAcceptQueueItems, onBulkDenyQueueItems, onBulkMergeQueueItems,
  onOpenSourceInManuscript, onOpenRelatedTab,
  onKeepAutoAddedItem, onRemoveAutoAddedItem,
}) => {
  const t = ENTITY_TYPES[entityType] || ENTITY_TYPES.cast;
  const [autoOpen, setAutoOpen] = _rqUS(false);

  const set = (k, v) => setFilters && setFilters({ ...filters, [k]: v });
  const view = filters.view || "list";

  const filtered = _rqUM(() => {
    let out = items;
    if (filters.confidence && filters.confidence !== "all") out = out.filter((x) => x.confidence?.band === filters.confidence);
    if (filters.status && filters.status !== "all")     out = out.filter((x) => x.status === filters.status);
    if (filters.chapter && filters.chapter !== "all")   out = out.filter((x) => x.sourceChapter?.id === filters.chapter);
    if (filters.session && filters.session !== "all")   out = out.filter((x) => x.sessionId === filters.session);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      out = out.filter((x) =>
        (x.candidate?.name || "").toLowerCase().includes(q) ||
        (x.candidate?.summary || "").toLowerCase().includes(q) ||
        (x.mention || "").toLowerCase().includes(q));
    }
    const sortBy = filters.sortBy || "confidence";
    out = [...out].sort((a, b) => {
      if (sortBy === "name") return (a.candidate?.name || "").localeCompare(b.candidate?.name || "");
      if (sortBy === "date") return (b.extractedAt || "").localeCompare(a.extractedAt || "");
      return (b.confidence?.value || 0) - (a.confidence?.value || 0);
    });
    return out;
  }, [items, filters]);

  // Filter out auto-added from main list — they live in the bottom collapsible
  const main = filtered.filter((x) => x.status !== "auto-added");

  return (
    <div className="rqp" data-ui="EntityReviewQueue" data-entity={entityType} data-state={state} data-testid={"rqp-" + entityType}>
      <header className="rqp__head">
        <div className="rqp__head-row">
          <EntityTypeBadge type={entityType} size="sm"/>
          <div className="rqp__title-stack">
            <div className="rqp__eyebrow">Review queue</div>
            <div className="rqp__title">{t.label}</div>
          </div>
          <div className="rqp__count">
            <strong>{main.length}</strong> pending
            {autoAdded.length > 0 && <> · {autoAdded.length} auto-added</>}
          </div>
        </div>

        <QueueFilterBar
          query={filters.query}      onQuery={(v) => set("query", v)}
          confidence={filters.confidence || "all"} onConfidence={(v) => set("confidence", v)}
          status={filters.status}    onStatus={(v) => set("status", v)}
          chapter={filters.chapter}  onChapter={(v) => set("chapter", v)}
          session={filters.session}  onSession={(v) => set("session", v)}
          sortBy={filters.sortBy}    onSortBy={(v) => set("sortBy", v)}
          view={view}                onView={(v) => set("view", v)}
          chapters={chapters}        sessions={sessions}
        />

        <QueueBulkActions
          count={selectedIds.length}
          onBulkAccept={() => { onBulkAcceptQueueItems && onBulkAcceptQueueItems(selectedIds); setSelectedIds && setSelectedIds([]); }}
          onBulkDeny={()   => { onBulkDenyQueueItems   && onBulkDenyQueueItems(selectedIds);   setSelectedIds && setSelectedIds([]); }}
          onBulkMerge={()  => { onBulkMergeQueueItems  && onBulkMergeQueueItems(selectedIds);  setSelectedIds && setSelectedIds([]); }}
          onClearSelection={() => setSelectedIds && setSelectedIds([])}
        />
      </header>

      <div className="rqp__body" data-grid={view === "grid"}>
        {state === "loading" && <LoadingState title={"Reading the " + t.label.toLowerCase() + " queue…"} lines={4}/>}
        {state === "error"   && <ErrorState title="Couldn't load this queue" body="The local index didn't respond. Your candidates are safe."/>}
        {state === "default" && main.length === 0 && (
          <EmptyState icon="bell" title={"No " + t.label.toLowerCase() + " candidates"} body="Run an extraction to surface new entries here."/>
        )}
        {state === "default" && main.map((x) => (
          <ReviewQueueCard
            key={x.id}
            item={x}
            selected={selectedIds.includes(x.id)}
            onAcceptQueueItem={onAcceptQueueItem}
            onEditQueueItem={onEditQueueItem}
            onMergeQueueItem={onMergeQueueItem}
            onDenyQueueItem={onDenyQueueItem}
            onOpenSourceInManuscript={onOpenSourceInManuscript}
            onOpenRelatedTab={onOpenRelatedTab}
            onKeepAutoAddedItem={onKeepAutoAddedItem}
            onRemoveAutoAddedItem={onRemoveAutoAddedItem}
          />
        ))}

        {/* Auto-added collapsible at bottom */}
        {autoAdded.length > 0 && state === "default" && (
          <div className="rqp__autoadded">
            <button className="rqp__autoadded__head" onClick={() => setAutoOpen((v) => !v)} aria-expanded={autoOpen}>
              <span className="rqp__autoadded__title">
                <span className="rqp__autoadded__title-dot"/>
                Auto-added · still reviewable
              </span>
              <span className="rqp__autoadded__count">{autoAdded.length}</span>
              <Icon name={autoOpen ? "chevron-up" : "chevron-d"} size={11}/>
            </button>
            {autoOpen && (
              <div className="rqp__autoadded__list">
                {autoAdded.map((a) => (
                  <AutoAddedHistoryCard
                    key={a.id} item={a}
                    onKeepAutoAddedItem={onKeepAutoAddedItem}
                    onRemoveAutoAddedItem={onRemoveAutoAddedItem}
                    onEditQueueItem={onEditQueueItem}
                    onOpenRelatedTab={onOpenRelatedTab}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, {
  EntityReviewQueue, ReviewQueueCard, AutoAddedHistoryCard,
  ConfidenceStrip, ConfidenceBandBadge,
  QueueFilterBar, QueueBulkActions,
  SUGGESTION_LABELS, CONFIDENCE_LABELS,
});


// ----- review-modals.jsx -----
// =====================================================================
// review-modals.jsx — MergeCandidateModal + EditCandidateModal + DenyConfirm
// =====================================================================

const { useState: _rmUS } = React;

// ---------------------------------------------------------------------
// MergeCandidateModal — three-pane comparison
// ---------------------------------------------------------------------
const MergeCandidateModal = ({
  open,
  candidate,                // QueueItem
  alternatives = [],        // [{ id, name, confidence, summary, aliases, fields:{...} }]
  selectedAltId,
  onSelectAlternative,
  onConfirmMerge,
  onCreateNewInstead,
  onCancel,
}) => {
  if (!open || !candidate) return null;
  const [altId, setAltId] = _rmUS(selectedAltId || alternatives[0]?.id);
  const alt = alternatives.find((a) => a.id === altId) || alternatives[0];
  const t = ENTITY_TYPES[candidate.entityType];

  const conflictFields = candidate.conflict ? [candidate.conflict.kind] : [];

  return (
    <div className="mc-backdrop" role="dialog" aria-modal="true" aria-labelledby="mc-title">
      <div className="mc" data-ui="MergeCandidateModal" data-testid="merge-candidate-modal">
        <div className="mc__head">
          <div>
            <div className="mc__title" id="mc-title">Merge candidate?</div>
            <div className="mc__sub">Decide whether the extracted mention is a new entry or refers to an existing one.</div>
          </div>
          <Btn variant="ghost" size="sm" icon="close" onClick={onCancel} aria-label="Close" data-callback="onClosePanel"/>
        </div>

        <div className="mc__body">
          {/* LEFT — extracted candidate */}
          <div className="mc__col mc__col--left">
            <div className="mc__col__eyebrow">
              <span>Extracted</span>
              <ConfidenceBadge level={candidate.confidence?.band} value={candidate.confidence?.value}/>
            </div>
            <div className="mc__col__name-row">
              <EntityTypeBadge type={candidate.entityType} size="sm"/>
              <div className="mc__col__title">{candidate.candidate?.name}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Aliases</div>
              <div className="mc__field__val">{candidate.candidate?.aliases?.join(", ") || "—"}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Summary</div>
              <div className="mc__field__val">{candidate.candidate?.summary}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Mention</div>
              <div className="mc__field__val" style={{ fontStyle: "italic" }}>"{candidate.mention}"</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Source</div>
              <div className="mc__field__val mc__field__val--mono">Ch. {candidate.sourceChapter?.num} · {candidate.sourceParagraph}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Why</div>
              <div className="mc__field__val">{candidate.rationale}</div>
            </div>
          </div>

          {/* SEPARATOR */}
          <div className="mc__sep">
            <div className="mc__sep__line" aria-hidden/>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-4)", position: "relative" }}>
              <span className="mc__sep__chip">SIMILARITY</span>
              <span className="mc__similarity">{alt?.confidence ?? "—"}<span style={{ fontSize: "var(--fs-md)", color: "var(--ink-3)" }}>%</span></span>
              {candidate.matched && candidate.matched.id === alt?.id && (
                <span className="mc__sep__chip" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent-deep)" }}>
                  <Icon name="check" size={10}/>Alias match
                </span>
              )}
            </div>
          </div>

          {/* RIGHT — existing entity candidates */}
          <div className="mc__col mc__col--right">
            <div className="mc__col__eyebrow">
              <span>Existing entries · {alternatives.length}</span>
            </div>
            <div className="mc__alts">
              {alternatives.map((a) => (
                <div key={a.id} className={"mc__alt-row " + (a.id === altId ? "is-selected" : "")} onClick={() => { setAltId(a.id); onSelectAlternative && onSelectAlternative(a.id); }} data-callback="onSelectMergeAlternative">
                  <EntityTypeBadge type={candidate.entityType} size="xs"/>
                  <span className="mc__alt-row__name">{a.name}</span>
                  <span className="mc__alt-row__sim">{a.confidence}%</span>
                </div>
              ))}
              {alternatives.length === 0 && (
                <EmptyState icon="search" title="No close matches" body="No existing entries look similar enough. Create a new entry instead."/>
              )}
            </div>

            {alt && (
              <>
                <div className="mc__col__name-row" style={{ marginTop: "var(--sp-5)" }}>
                  <EntityTypeBadge type={candidate.entityType} size="sm"/>
                  <div className="mc__col__title">{alt.name}</div>
                </div>
                <div className="mc__field mc__field--match">
                  <div className="mc__field__lbl">Aliases</div>
                  <div className="mc__field__val">{alt.aliases?.join(", ") || "—"}</div>
                </div>
                <div className="mc__field mc__field--match">
                  <div className="mc__field__lbl">Summary</div>
                  <div className="mc__field__val">{alt.summary || "(existing dossier)"}</div>
                </div>
                {candidate.conflict && (
                  <div className="mc__field mc__field--conflict">
                    <div className="mc__field__lbl">Conflict</div>
                    <div className="mc__field__val">{candidate.conflict.note}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mc__foot">
          <div className="mc__foot__hint">
            {candidate.conflict
              ? <><Icon name="warn" size={12}/>{conflictFields.join(", ")} conflict — review before merging.</>
              : <><Icon name="link" size={12}/>Merging will fold the extracted mention into the existing dossier.</>}
          </div>
          <div className="mc__foot__actions">
            <Btn variant="ghost"   size="sm" onClick={onCancel} data-callback="onCancelMerge">Cancel</Btn>
            <Btn variant="outline" size="sm" icon="plus" onClick={onCreateNewInstead} data-callback="onCreateNewInstead" data-testid="merge-create-new">Create new instead</Btn>
            <Btn variant="primary" size="sm" icon="link" onClick={() => onConfirmMerge && onConfirmMerge(altId)} data-callback="onMergeQueueItem" data-testid="merge-confirm">Confirm merge</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EditCandidateModal
// ---------------------------------------------------------------------
const EditCandidateModal = ({
  open,
  candidate,
  targetTabs = [],          // [{ id, label }]
  onSave, onAcceptEdited, onCancel,
}) => {
  if (!open || !candidate) return null;
  const c = candidate;
  const [name, setName]       = _rmUS(c.candidate?.name || "");
  const [type, setType]       = _rmUS(c.entityType);
  const [aliases, setAliases] = _rmUS((c.candidate?.aliases || []).join(", "));
  const [summary, setSummary] = _rmUS(c.candidate?.summary || "");
  const [notes, setNotes]     = _rmUS("");
  const [confidence, setConf] = _rmUS(c.confidence?.band || "uncertain");
  const [target, setTarget]   = _rmUS(c.entityType);

  const buildEdited = () => ({
    ...c,
    entityType: type,
    candidate: { ...c.candidate, name, aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean), summary },
    confidence: { ...c.confidence, band: confidence },
    targetTab: target,
    notes,
    status: "edited",
  });

  return (
    <div className="ec-backdrop" role="dialog" aria-modal="true" aria-labelledby="ec-title">
      <div className="ec" data-ui="EditCandidateModal" data-testid="edit-candidate-modal">
        <div className="ec__head">
          <div>
            <div className="ec__title" id="ec-title">Edit candidate</div>
            <div className="ec__sub">Tune the extracted record before adding it to the dossier.</div>
          </div>
          <Btn variant="ghost" size="sm" icon="close" onClick={onCancel} aria-label="Close" data-callback="onClosePanel"/>
        </div>

        <div className="ec__body">
          <div className="ec__field--row">
            <div className="ec__field">
              <div className="ec__field__lbl">Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} data-testid="edit-name"/>
            </div>
            <div className="ec__field">
              <div className="ec__field__lbl">Type</div>
              <select value={type} onChange={(e) => setType(e.target.value)} data-testid="edit-type">
                {Object.values(ENTITY_TYPES).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Aliases (comma-separated)</div>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)}/>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Summary</div>
            <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)}/>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Source quote</div>
            <div className="ec__quote">"{c.mention}"</div>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Notes (private)</div>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for your dossier"/>
          </div>

          <div className="ec__field--row">
            <div className="ec__field">
              <div className="ec__field__lbl">Confidence band</div>
              <select value={confidence} onChange={(e) => setConf(e.target.value)}>
                {Object.values(CONFIDENCE).map((b) => <option key={b.id} value={b.id}>{b.label} · {b.range}</option>)}
              </select>
            </div>
            <div className="ec__field">
              <div className="ec__field__lbl">Target tab</div>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                {(targetTabs.length ? targetTabs : Object.values(ENTITY_TYPES).map((t) => ({ id: t.id, label: t.label })))
                  .map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="ec__foot">
          <div className="ec__foot__hint"><Icon name="paper" size={12}/>Edits stay attached to the source extraction.</div>
          <div className="ec__foot__actions">
            <Btn variant="ghost"   size="sm" onClick={onCancel} data-callback="onCancelEdit">Cancel</Btn>
            <Btn variant="outline" size="sm" icon="check" onClick={() => onSave && onSave(buildEdited())} data-callback="onSaveEdit" data-testid="edit-save">Save changes</Btn>
            <Btn variant="primary" size="sm" icon="bolt"  onClick={() => onAcceptEdited && onAcceptEdited(buildEdited())} data-callback="onAcceptEdited" data-testid="edit-accept">Accept edited version</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// DenyConfirmation — wraps ConfirmModal with candidate context
// ---------------------------------------------------------------------
const DenyConfirmation = ({ open, candidate, onConfirm, onCancel }) => {
  if (!open || !candidate) return null;
  return (
    <ConfirmModal
      open={open}
      title={"Deny \"" + (candidate.candidate?.name || "this candidate") + "\"?"}
      tone="danger"
      confirmLabel="Deny candidate"
      cancelLabel="Keep in queue"
      onConfirm={onConfirm}
      onCancel={onCancel}
      body={
        <>
          <p>This will remove the suggestion from the {ENTITY_TYPES[candidate.entityType]?.label || "review"} queue. The mention itself stays in your manuscript.</p>
          <div className="dc-context">
            "{candidate.mention}"
          </div>
          <p style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>
            Denied items appear in extraction history. You can recover them within 30 days.
          </p>
        </>
      }
    />
  );
};

Object.assign(window, { MergeCandidateModal, EditCandidateModal, DenyConfirmation });


// ----- writers-room.jsx -----
// =====================================================================
// writers-room.jsx — Complete Writer's Room screen
// Hook-ready presentational UI for chapter editing, margins, extraction.
// =====================================================================

const { useState: _wrUS, useEffect: _wrUE, useRef: _wrUR, useCallback: _wrUC, useMemo: _wrUM } = React;

// ---------------------------------------------------------------------
// Demo data — Claude Code replaces these with real backend data.
// ---------------------------------------------------------------------
const WR_AUTHORS = [
  { id: "em",  name: "E. Marlowe",      initials: "EM", color: "#9a7b3a" },
  { id: "ann", name: "Ann (co-writer)", initials: "AN", color: "#7a6aa3" },
  { id: "ai",  name: "Loomwright AI",   initials: "LW", color: "#3e6db5" },
];

const WR_CHAPTERS = [
  { id: "c1", num: 1, title: "The Hollow Crown",    state: "saved",     queue: 0, words: 4220, author: "em" },
  { id: "c2", num: 2, title: "Pale Reach",          state: "extracted", queue: 1, words: 3810, author: "em" },
  { id: "c3", num: 3, title: "Saren's Bargain",     state: "saved",     queue: 0, words: 5102, author: "em" },
  { id: "c4", num: 4, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c5", num: 5, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c6", num: 6, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c7", num: 7, title: "Ash & Auger",         state: "unsaved",   queue: 4, words: 3214, author: "em", active: true },
  { id: "c8", num: 8, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c9", num: 9, title: "The Auger's Door",    state: "extracting", queue: 12, words: 6118, author: "em" },
];

// Manuscript content for active chapter — paragraphs as renderable structures
const WR_MANUSCRIPT = [
  { id: "p1", author: "em", attr: "EM", parts: [
    { text: "The light over " },
    { mark: "locations", id: "e-pale-reach", text: "Pale Reach" },
    { text: " was the colour of cooled tin when " },
    { mark: "cast", id: "e-aelinor", text: "Aelinor Vey" },
    { text: " came through the stockade gate. Snow had been falling all morning, and the wind off the salt flats turned each flake into a small, deliberate cut." },
  ]},
  { id: "p2", author: "em", attr: "EM", parts: [
    { text: "She carried the " },
    { mark: "items", id: "e-auger", text: "Auger of Hess" },
    { text: " in a felt-lined case slung across her back, and even wrapped, even quiet, it pressed against her like a second pulse. " },
    { cmt: "1", text: "She had not slept since Brec's letter" },
    { text: ", and three nights of refusing the dreams had given her hands a fine, undignified tremor." },
  ]},
  { id: "p3", author: "em", attr: "EM", parts: [
    { text: "\"You're the wrong shape for this weather,\" said " },
    { mark: "cast", id: "e-brec", text: "Captain Brec" },
    { text: " from the watchhouse step. He looked the same as he had four winters ago, except for the way the cold had settled into his face — not as colour but as architecture." },
  ]},
  { sceneBreak: true },
  { id: "p4", author: "ann", attr: "AN", parts: [
    { text: "Inside, the watchhouse smelled of pitch and coriander, and the brazier had been pulled close to the lieutenant's table. " },
    { mark: "factions", id: "e-greycoats", text: "The Grey Coats" },
    { text: " had left only the one banner — a small concession Aelinor noticed because Brec had told her, once, that they would never lower it." },
  ]},
  { id: "p5", author: "em", attr: "EM", parts: [
    { text: "\"It's not a courtesy,\" he said, pouring her something dark from a clay carafe. \"It's an apology. The " },
    { mark: "events", id: "e-augerwake", text: "Auger Wake" },
    { text: " came through here last week. Took two of mine, and a goat. We're not pretending anymore.\"" },
  ]},
  { id: "p6", author: "em", attr: "EM", parts: [
    { text: "She set the case on the table. The wood under it gave the smallest, indignant sigh. \"Then you'll want to see what " },
    { mark: "cast", id: "e-saren", text: "Saren of Hess" },
    { text: " sent me to bring.\"" },
  ]},
  { id: "p7", author: "ai", attr: "LW", parts: [
    { text: "Brec did not look at the case. He looked, instead, at the door, and the wind beyond it. \"Tell me first,\" he said, \"whether the road through " },
    { mark: "atlas", id: "e-vraska", text: "the Vraska Pass" },
    { text: " is still walkable. I have a child to send south, and I would prefer to send her alive.\"" },
  ]},
];

// Margin notes (left column)
const WR_NOTES = [
  { id: "n1", type: "Scene note",  authorId: "em",  ts: "9:42",   anchor: "p1", body: "Open cold — make the cold a character. Lean into 'architecture' of the face later when Brec's grief lands." },
  { id: "n2", type: "Comment",     authorId: "ann", ts: "11:08",  anchor: "p2", body: "Do we need to call out that this is the same Auger from Bk I? Maybe a one-line callback." },
  { id: "n3", type: "Revision",    authorId: "em",  ts: "12:17",  anchor: "p3", body: "Brec's voice still drifts toward arch. Tighten." },
  { id: "n4", type: "Structure",   authorId: "em",  ts: "Ch.7 §",          body: "This chapter wants three scenes: arrival, table, descent. Right now we're 1.5.", collapsed: true },
  { id: "n5", type: "Resolved",    authorId: "ann", ts: "Yest.", anchor: "p4", body: "Confirm the Grey Coats lowered the banner — maps page 11.", resolved: true },
];

// Right margin extraction cards
const WR_EXTRACTIONS = [
  { id: "x1", type: "cast",         conf: "high",      pct: 96, name: "Aelinor Vey",          summary: "Established cast member; verified across Ch. 1–7. Mention re-confirmed.", quote: "…when Aelinor Vey came through the stockade gate.", anchor: "p1" },
  { id: "x2", type: "locations",    conf: "high",      pct: 94, name: "Pale Reach",            summary: "Existing location. New attribute: \"salt flats\". Add to dossier?", quote: "The light over Pale Reach was the colour of cooled tin…", anchor: "p1" },
  { id: "x3", type: "items",        conf: "strong",    pct: 88, name: "Auger of Hess",         summary: "Tracked artefact. Possessed by Aelinor in this chapter — update STATE → carried.", quote: "the Auger of Hess in a felt-lined case…", anchor: "p2" },
  { id: "x4", type: "cast",         conf: "strong",    pct: 84, name: "Captain Brec",          summary: "Existing cast. New trait surfacing: \"the cold had settled into his face\". Lifestyle/age hint.", quote: "He looked the same as he had four winters ago…", anchor: "p3" },
  { id: "x5", type: "events",       conf: "uncertain", pct: 67, name: "The Auger Wake",        summary: "New event candidate. Last week, two casualties + livestock. Suggest creating Event entity.", quote: "The Auger Wake came through here last week.", anchor: "p5" },
  { id: "x6", type: "factions",     conf: "uncertain", pct: 58, name: "The Grey Coats",        summary: "Already exists (Bk I). New canon: lowered banner — \"never\" rule broken. Flag canon-shift.", quote: "The Grey Coats had left only the one banner…", anchor: "p4" },
  { id: "x7", type: "atlas",        conf: "weak",      pct: 41, name: "Vraska Pass",           summary: "New geography. Could be 'the Vraska' from Ch. 2 — possible merge candidate.", quote: "the road through the Vraska Pass is still walkable.", anchor: "p7", merge: true },
];

// ---------------------------------------------------------------------
// ChapterNode
// ---------------------------------------------------------------------
const ChapterNode = ({
  chapter, active, onSelect, onOpenAdaptiveWheel, onOpenContext,
}) => {
  const reserved = !!chapter.reserved;
  const className = [
    "wr-node",
    active && "is-active",
    reserved && "is-reserved",
  ].filter(Boolean).join(" ");

  const handleContext = (e) => {
    e.preventDefault();
    onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: "Chapter " + chapter.num + (chapter.title ? " — " + chapter.title : "") });
  };

  return (
    <div
      className={className}
      data-ui="ChapterNode"
      data-callback="onSelectChapter"
      data-testid={"wr-chapter-" + chapter.id}
      role="tab"
      aria-selected={active}
      tabIndex={reserved ? -1 : 0}
      onClick={() => !reserved && onSelect && onSelect(chapter.id)}
      onContextMenu={handleContext}
      draggable={!reserved}
    >
      {reserved ? (
        <>
          <div className="wr-node__top">
            <span className="wr-node__num">CH. {String(chapter.num).padStart(2, "0")}</span>
            <span className="wr-node__grip" aria-hidden><Icon name="grip" size={10}/></span>
          </div>
          <div className="wr-node__reserved-mark">∅</div>
          <div className="wr-node__meta">
            <span style={{ fontStyle: "italic", fontSize: "var(--fs-3xs)", color: "var(--ink-4)" }}>Reserved</span>
          </div>
        </>
      ) : (
        <>
          <div className="wr-node__top">
            <span className="wr-node__num">CH. {String(chapter.num).padStart(2, "0")}</span>
            <span className="wr-node__grip" aria-hidden><Icon name="grip" size={10}/></span>
          </div>
          <div className="wr-node__title">{chapter.title || "Untitled"}</div>
          <div className="wr-node__meta">
            {chapter.state === "unsaved"    && <span className="wr-node__dot wr-node__dot--unsaved"    title="Unsaved changes"/>}
            {chapter.state === "extracting" && <span className="wr-node__dot wr-node__dot--extracting" title="Extracting…"/>}
            {chapter.state === "extracted"  && <span className="wr-node__dot wr-node__dot--extracted"  title="Extracted"/>}
            {chapter.state === "error"      && <span className="wr-node__dot wr-node__dot--error"      title="Error"/>}
            {chapter.queue > 0 && <span className="wr-node__queue" title={chapter.queue + " in review queue"}>{chapter.queue > 9 ? "9+" : chapter.queue}</span>}
            <span className="wr-node__words">{(chapter.words || 0).toLocaleString()}w</span>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// ChapterNodeStrip
// ---------------------------------------------------------------------
const ChapterNodeStrip = ({
  chapters, activeId,
  onSelectChapter, onCreateChapter, onReserveChapter, onReorderChapter,
  onOpenAdaptiveWheel,
}) => {
  return (
    <div className="wr-strip" data-ui="ChapterNodeStrip" role="tablist" aria-label="Chapters">
      <div className="wr-strip__lead">
        <div>
          <div className="wr-strip__lead-eyebrow">Manuscript</div>
          <div className="wr-strip__lead-title">{BRAND.project.book}</div>
        </div>
      </div>
      <div className="wr-strip__rail">
        {chapters.map((c) => (
          <ChapterNode
            key={c.id}
            chapter={c}
            active={c.id === activeId}
            onSelect={onSelectChapter}
            onOpenAdaptiveWheel={onOpenAdaptiveWheel}
          />
        ))}
        <button
          className="wr-strip__add"
          data-callback="onCreateChapter"
          data-testid="wr-create-chapter"
          onClick={onCreateChapter}
          title="Append a new chapter"
        ><Icon name="plus" size={11}/>Add chapter</button>
        <button
          className="wr-strip__add"
          data-callback="onReserveChapter"
          data-testid="wr-reserve-chapter"
          onClick={onReserveChapter}
          title="Reserve a future chapter slot"
          style={{ marginLeft: 4 }}
        ><Icon name="bookmark" size={11}/>Reserve</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityBrushHighlight (inline span for entity mention)
// ---------------------------------------------------------------------
const EntityBrushHighlight = ({ type, id, children, onClick, onMouseEnter, onMouseLeave }) => {
  const t = ENTITY_TYPES[type];
  if (!t) return <span>{children}</span>;
  return (
    <span
      className="wr-mark"
      data-ui="EntityBrushHighlight"
      data-callback="onOpenEntity"
      data-entity={type}
      data-entity-id={id}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >{children}</span>
  );
};

// ---------------------------------------------------------------------
// ManuscriptParagraph
// ---------------------------------------------------------------------
const ManuscriptParagraph = ({
  para, onEntityHover, onCommentClick,
}) => {
  if (para.sceneBreak) {
    return (
      <div className="wr-scene-break" data-ui="ManuscriptParagraph" data-kind="scene-break">
        <span className="wr-scene-break__line"/>
        <span aria-hidden>※   ※   ※</span>
        <span className="wr-scene-break__line"/>
      </div>
    );
  }
  return (
    <p
      className="wr-p"
      data-ui="ManuscriptParagraph"
      data-author={para.author}
      data-paragraph-id={para.id}
    >
      <span className="wr-p__handle" aria-hidden><Icon name="grip" size={12}/></span>
      {para.parts.map((part, i) => {
        if (part.mark) {
          return (
            <EntityBrushHighlight
              key={i}
              type={part.mark}
              id={part.id}
              onMouseEnter={(e) => onEntityHover && onEntityHover({ type: part.mark, id: part.id, text: part.text, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => onEntityHover && onEntityHover(null)}
            >{part.text}</EntityBrushHighlight>
          );
        }
        if (part.cmt) {
          return (
            <span key={i} className="wr-cmt" data-count={part.cmt} onClick={() => onCommentClick && onCommentClick(part.cmt)}>{part.text}</span>
          );
        }
        return <React.Fragment key={i}>{part.text}</React.Fragment>;
      })}
      <span className="wr-p__attr" title={para.author}>{para.attr}</span>
    </p>
  );
};

// ---------------------------------------------------------------------
// ManuscriptToolbar
// ---------------------------------------------------------------------
const ManuscriptToolbar = ({
  onAction,
  spellcheck = true, grammar = true, voice = false, style = false, revision = false,
  attribution = true, focusMode = false,
  onToggleFocusMode, onToggleAttribution, onToggleSpellcheck, onToggleGrammar, onToggleStyle, onToggleVoice, onToggleRevision,
}) => {
  const TB = ({ icon, label, active, onClick, children, className = "" }) => (
    <button
      type="button"
      className={"wr-toolbar__btn " + className + (active ? " is-active" : "")}
      title={label}
      aria-label={label}
      onClick={onClick}
    >{icon ? <Icon name={icon} size={13}/> : children}</button>
  );

  return (
    <div className="wr-toolbar" data-ui="ManuscriptToolbar" role="toolbar" aria-label="Manuscript formatting">
      <div className="wr-toolbar__group">
        <TB label="Bold (⌘B)"           className="wr-toolbar__btn--text"      onClick={() => onAction("bold")}><b>B</b></TB>
        <TB label="Italic (⌘I)"         className="wr-toolbar__btn--text wr-toolbar__btn--italic" onClick={() => onAction("italic")}><i>I</i></TB>
        <TB label="Underline (⌘U)"      className="wr-toolbar__btn--text wr-toolbar__btn--underline" onClick={() => onAction("underline")}>U</TB>
        <TB label="Strikethrough"       className="wr-toolbar__btn--text wr-toolbar__btn--strike" onClick={() => onAction("strike")}>S</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Heading"             className="wr-toolbar__btn--text" onClick={() => onAction("heading")}>H</TB>
        <TB label="Scene break"         icon="bars" onClick={() => onAction("scene-break")}/>
        <TB label="Quote"               className="wr-toolbar__btn--text" onClick={() => onAction("quote")}>"</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Inline note"         icon="paper" onClick={() => onAction("inline-note")}/>
        <TB label="Comment"             icon="bell" onClick={() => onAction("comment")}/>
        <TB label="Highlight"           icon="drop" onClick={() => onAction("highlight")}/>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Link to entity"      icon="link" onClick={() => onAction("link-entity")}/>
        <TB label="Create entity from selection" icon="plus" onClick={() => onAction("create-entity")}/>
        <TB label="Insert reference"    icon="bookmark" onClick={() => onAction("insert-ref")}/>
        <TB label="Insert footnote"     icon="paper" onClick={() => onAction("footnote")}/>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Find / replace (⌘F)" icon="search" onClick={() => onAction("find")}/>
        <TB label="Spellcheck"   active={spellcheck} className="wr-toolbar__btn--small" onClick={onToggleSpellcheck}>SP</TB>
        <TB label="Grammar"      active={grammar}    className="wr-toolbar__btn--small" onClick={onToggleGrammar}>GR</TB>
        <TB label="Style"        active={style}      className="wr-toolbar__btn--small" onClick={onToggleStyle}>ST</TB>
        <TB label="Voice consistency" active={voice} className="wr-toolbar__btn--small" onClick={onToggleVoice}>VO</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Thesaurus"           icon="book" onClick={() => onAction("thesaurus")}/>
        <TB label="Revision mode"       active={revision}    className="wr-toolbar__btn--small" onClick={onToggleRevision}>REV</TB>
        <TB label="Author attribution"  active={attribution} className="wr-toolbar__btn--small" onClick={onToggleAttribution}>AUT</TB>
        <TB label="Focus mode"          active={focusMode}   icon="eye" onClick={onToggleFocusMode}/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SaveModeControls
// ---------------------------------------------------------------------
const SaveModeControls = ({ onSave, onSaveAndExtract, onSaveAndDeepExtract, syncing }) => {
  return (
    <div className="wr-save" data-ui="SaveModeControls" role="group" aria-label="Save controls">
      <button
        className="wr-save__btn"
        data-callback="onSave"
        data-testid="wr-save"
        onClick={onSave}
        title="Saves manuscript text and author edits only."
        disabled={syncing}
      ><Icon name="check" size={12}/>Save</button>
      <button
        className="wr-save__btn"
        data-callback="onSaveAndExtract"
        data-testid="wr-save-extract"
        onClick={onSaveAndExtract}
        title="Saves and runs a quick entity sweep."
        disabled={syncing}
      ><Icon name="sparkle" size={12}/>+ Extract</button>
      <button
        className="wr-save__btn"
        data-callback="onSaveAndDeepExtract"
        data-testid="wr-save-deep"
        onClick={onSaveAndDeepExtract}
        title="Saves and runs the deepest available scan."
        disabled={syncing}
      ><Icon name="bolt" size={12}/>+ Deep</button>
    </div>
  );
};

// ---------------------------------------------------------------------
// AuthorSelector
// ---------------------------------------------------------------------
const AuthorSelector = ({ authors, activeId, onSelectAuthor }) => {
  const a = authors.find((x) => x.id === activeId) || authors[0];
  return (
    <button
      className="wr-author-sel"
      data-ui="AuthorSelector"
      data-callback="onSelectAuthor"
      data-testid="wr-author-selector"
      onClick={() => {
        const i = authors.findIndex((x) => x.id === activeId);
        const next = authors[(i + 1) % authors.length];
        onSelectAuthor && onSelectAuthor(next.id);
      }}
      title="Switch active author"
    >
      <span className="wr-author-sel__chip" style={{ "--ac": a.color }}>{a.initials}</span>
      <span>{a.name}</span>
      <Icon name="chevron-d" size={11}/>
    </button>
  );
};

// ---------------------------------------------------------------------
// FloatingSelectionToolbar
// ---------------------------------------------------------------------
const FloatingSelectionToolbar = ({ x, y, onAction, onCreateEntityFromSelection, onLinkEntity }) => {
  return (
    <div className="wr-fst" style={{ left: x, top: y }} data-ui="FloatingSelectionToolbar">
      <button className="wr-fst__btn" title="Bold" onClick={() => onAction("bold")}><b>B</b></button>
      <button className="wr-fst__btn" title="Italic" onClick={() => onAction("italic")}><i>I</i></button>
      <button className="wr-fst__btn" title="Underline" onClick={() => onAction("underline")}>U</button>
      <span className="wr-fst__sep"/>
      <button className="wr-fst__btn" title="Highlight" onClick={() => onAction("highlight")}><Icon name="drop" size={13}/></button>
      <button className="wr-fst__btn" title="Comment" onClick={() => onAction("comment")}><Icon name="bell" size={13}/></button>
      <span className="wr-fst__sep"/>
      <button className="wr-fst__btn" data-callback="onLinkEntity" title="Link to entity" onClick={onLinkEntity}><Icon name="link" size={13}/></button>
      <button className="wr-fst__btn wr-fst__btn--strong" data-callback="onCreateEntityFromSelection" title="Create entity from selection" onClick={onCreateEntityFromSelection}>
        <Icon name="plus" size={11}/>New entity
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------
// FloatingEntityChip — entity hover/click chip
// ---------------------------------------------------------------------
const FloatingEntityChip = ({ entity, x, y, onOpenEntity, onShowMentions, onOpenAdaptiveWheel }) => {
  if (!entity) return null;
  const t = ENTITY_TYPES[entity.type];
  return (
    <div className="wr-chip" style={{ left: x, top: y + 14 }} data-ui="FloatingEntityChip">
      <div className="wr-chip__head">
        <EntityTypeBadge type={entity.type} size="xs" showLabel={false}/>
        <div className="wr-chip__name">{entity.text}</div>
      </div>
      <div className="wr-chip__sub">{t?.label} · 7 mentions across 4 chapters</div>
      <div className="wr-chip__row">
        <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenEntity" onClick={() => onOpenEntity && onOpenEntity(entity)}>Dossier</Btn>
        <Btn variant="ghost" size="sm" icon="search" data-callback="onShowMentions" onClick={() => onShowMentions && onShowMentions(entity)}>Mentions</Btn>
        <Btn variant="ghost" size="sm" icon="wheel" data-callback="onOpenAdaptiveWheel" onClick={(e) => onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: entity.text })}>Wheel</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// MarginNoteCard
// ---------------------------------------------------------------------
const MarginNoteCard = ({ note, authors, onResolve, onEdit, onDelete }) => {
  const a = authors.find((x) => x.id === note.authorId);
  const [collapsed, setCollapsed] = _wrUS(!!note.collapsed);
  return (
    <div className={"wr-note " + (note.resolved ? "is-resolved " : "")} data-ui="MarginNoteCard" style={{ "--ac": a?.color }}>
      <div className="wr-note__head">
        <span className="wr-note__author">
          <span className="wr-note__author-dot"/>{a?.name || "Unknown"}
        </span>
        <span className="wr-note__type">{note.type}</span>
        <span className="wr-note__time">{note.ts}</span>
      </div>
      {note.anchor && <span className="wr-note__anchor">↳ {note.anchor}</span>}
      <div className={"wr-note__body " + (collapsed ? "wr-note__body--collapsed" : "")}>{note.body}</div>
      <div className="wr-note__actions">
        <Btn variant="ghost" size="sm" icon={collapsed ? "chevron-d" : "chevron-up"} onClick={() => setCollapsed((v) => !v)}>{collapsed ? "Expand" : "Collapse"}</Btn>
        {!note.resolved && <Btn variant="ghost" size="sm" icon="check" onClick={() => onResolve && onResolve(note.id)}>Resolve</Btn>}
        <Btn variant="ghost" size="sm" icon="more" onClick={() => onEdit && onEdit(note.id)}>Edit</Btn>
        <Btn variant="ghost" size="sm" icon="trash" onClick={() => onDelete && onDelete(note.id)}/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// MarginExtractionCard
// ---------------------------------------------------------------------
const MarginExtractionCard = ({
  ext, selected,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem, onOpenFullReview,
}) => {
  const c = CONFIDENCE[ext.conf];
  return (
    <div className={"wr-ext " + (selected ? "is-selected " : "")} data-ui="MarginExtractionCard"
      style={{ "--cc": c?.color, "--cs": c?.soft, "--cd": c?.deep }}
    >
      <div className="wr-ext__head">
        <EntityTypeBadge type={ext.type} size="xs"/>
        <ConfidenceBadge level={ext.conf} value={ext.pct}/>
      </div>
      <div className="wr-ext__name">{ext.name}</div>
      <div className="wr-ext__sum">{ext.summary}</div>
      <blockquote className="wr-ext__quote">"{ext.quote}"</blockquote>
      <span className="wr-ext__anchor">↳ paragraph {ext.anchor}</span>
      <div className="wr-ext__actions">
        <button className="wr-ext__btn wr-ext__btn--accept" data-callback="onAcceptQueueItem" onClick={() => onAcceptQueueItem && onAcceptQueueItem(ext.id)}>
          <Icon name="check" size={11}/>Accept
        </button>
        <button className="wr-ext__btn" data-callback="onEditQueueItem" onClick={() => onEditQueueItem && onEditQueueItem(ext.id)}>
          <Icon name="more" size={11}/>Edit
        </button>
        {ext.merge && (
          <button className="wr-ext__btn" data-callback="onMergeQueueItem" onClick={() => onMergeQueueItem && onMergeQueueItem(ext.id)}>
            <Icon name="link" size={11}/>Merge
          </button>
        )}
        <button className="wr-ext__btn wr-ext__btn--deny" data-callback="onDenyQueueItem" onClick={() => onDenyQueueItem && onDenyQueueItem(ext.id)}>
          <Icon name="close" size={11}/>Deny
        </button>
      </div>
      <button className="wr-ext__more" onClick={() => onOpenFullReview && onOpenFullReview(ext.id)}>Open full review →</button>
    </div>
  );
};

// ---------------------------------------------------------------------
// LeftMargin
// ---------------------------------------------------------------------
const LeftMargin = ({ notes, authors, onResolve, onEdit, onDelete, onCreate, filter, setFilter, pinned, onTogglePin, onCollapse }) => {
  const visible = notes.filter((n) => {
    if (filter === "open") return !n.resolved;
    if (filter === "resolved") return n.resolved;
    if (filter === "mine") return n.authorId === "em";
    return true;
  });
  return (
    <aside className="wr-margin" data-side="left" data-ui="LeftMargin" aria-label="Author notes & comments">
      <div className="wr-margin__head">
        <span className="wr-margin__head-title">Notes &amp; Comments</span>
        <span className="wr-margin__head-count">{visible.length}</span>
        <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreate" onClick={onCreate} title="Add note"/>
        <button className={"wr-margin__head__pin " + (pinned ? "is-active" : "")} onClick={onTogglePin} data-callback="onTogglePin" title={pinned ? "Unpin margin" : "Pin margin"}><Icon name="pin-tack" size={11}/></button>
        <button className="wr-margin__head__collapse" onClick={onCollapse} data-callback="onCollapseMargin" title="Collapse to tab"><Icon name="chevron-r" size={11}/></button>
      </div>
      <div className="wr-margin__filters">
        {[["all", "All"], ["open", "Open"], ["resolved", "Resolved"], ["mine", "Mine"]].map(([k, l]) => (
          <button
            key={k}
            className={"wr-margin__filter " + (filter === k ? "is-active" : "")}
            onClick={() => setFilter(k)}
          >{l}</button>
        ))}
      </div>
      <div className="wr-margin__list">
        {visible.length === 0 ? (
          <EmptyState icon="paper" title="No notes here" body="Highlight a passage and choose Inline Note to drop one."/>
        ) : visible.map((n) => (
          <MarginNoteCard
            key={n.id} note={n} authors={authors}
            onResolve={onResolve} onEdit={onEdit} onDelete={onDelete}
          />
        ))}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// RightMargin
// ---------------------------------------------------------------------
const RightMargin = ({
  extractions, selectedId,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem, onOpenFullReview,
  onOpenReviewQueue,
  filter, setFilter, extractionState,
  pinned, onTogglePin, onCollapse,
}) => {
  const visible = extractions.filter((x) => {
    if (filter === "queue") return x.conf !== "high";
    if (filter === "auto") return x.conf === "high";
    if (filter === "warn") return x.conf === "uncertain" || x.conf === "weak";
    return true;
  });

  return (
    <aside className="wr-margin" data-side="right" data-ui="RightMargin" aria-label="Extractions & suggestions">
      <div className="wr-margin__head">
        <span className="wr-margin__head-title">Extracted</span>
        <span className="wr-margin__head-count">{visible.length}</span>
        <Btn variant="ghost" size="sm" icon="bell" onClick={onOpenReviewQueue} title="Open full review queue"/>
        <button className={"wr-margin__head__pin " + (pinned ? "is-active" : "")} onClick={onTogglePin} data-callback="onTogglePin" title={pinned ? "Unpin margin" : "Pin margin"}><Icon name="pin-tack" size={11}/></button>
        <button className="wr-margin__head__collapse" onClick={onCollapse} data-callback="onCollapseMargin" title="Collapse to tab"><Icon name="chevron-r" size={11}/></button>
      </div>
      <div className="wr-margin__filters">
        {[["all", "All"], ["queue", "In review"], ["auto", "Auto"], ["warn", "Uncertain"]].map(([k, l]) => (
          <button
            key={k}
            className={"wr-margin__filter " + (filter === k ? "is-active" : "")}
            onClick={() => setFilter(k)}
          >{l}</button>
        ))}
      </div>
      <div className="wr-margin__list">
        {extractionState === "running" && (
          <div className="wr-ext wr-ai">
            <div className="wr-ai__title"><Icon name="sparkle" size={13}/>Extracting Ch. 7…</div>
            <LoadingState title="Reading the page" lines={3}/>
          </div>
        )}
        {extractionState === "error" && (
          <div className="wr-ext" style={{ "--cc": "#a84a3a" }}>
            <div className="wr-ext__head"><EntityTypeBadge type="cast" size="xs" showLabel={false}/><ConfidenceBadge level="weak" value={0}/></div>
            <div className="wr-ext__name">Extraction failed</div>
            <div className="wr-ext__sum">Local model couldn't reach the manuscript index. Your draft is safe.</div>
            <div className="wr-ext__actions">
              <button className="wr-ext__btn">Retry</button>
              <button className="wr-ext__btn">Open logs</button>
            </div>
          </div>
        )}
        {visible.length === 0 && extractionState !== "running" ? (
          <EmptyState icon="sparkle" title="No suggestions yet" body="Save & Extract to scan this chapter for new entities, relationships, and continuity warnings."/>
        ) : visible.map((x) => (
          <MarginExtractionCard
            key={x.id} ext={x}
            selected={selectedId === x.id}
            onAcceptQueueItem={onAcceptQueueItem}
            onEditQueueItem={onEditQueueItem}
            onMergeQueueItem={onMergeQueueItem}
            onDenyQueueItem={onDenyQueueItem}
            onOpenFullReview={onOpenFullReview}
          />
        ))}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// ChapterDeleteConfirmModal
// ---------------------------------------------------------------------
const ChapterDeleteConfirmModal = ({ open, chapter, onCancel, onConfirm }) => {
  if (!open || !chapter) return null;
  return (
    <ConfirmModal
      open={open}
      title={"Delete Chapter " + chapter.num + "?"}
      body={
        <>
          <p>This will move <b>{chapter.title || "this chapter"}</b> to Trash, where it will sit for 30 days before deletion.</p>
          <p style={{ color: "var(--ink-3)", fontSize: "var(--fs-xs)", marginTop: 8 }}>
            Linked entity mentions stay attached to the manuscript object — restoring the chapter restores them.
          </p>
        </>
      }
      confirmLabel="Move to Trash"
      cancelLabel="Keep chapter"
      tone="danger"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

// ---------------------------------------------------------------------
// ManuscriptCanvas
// ---------------------------------------------------------------------
const ManuscriptCanvas = ({
  chapter, paragraphs, state,
  onEntityHover, onCommentClick,
  onCreateChapter, onSaveAndExtract,
}) => {
  if (!chapter) {
    return (
      <div className="wr-canvas wr-canvas--empty" data-ui="ManuscriptCanvas" data-state="no-chapter">
        <div className="wr-empty-card">
          <Icon name="feather" size={28}/>
          <div className="wr-empty-card__title">No chapter selected</div>
          <div className="wr-empty-card__body">Pick a chapter from the strip above, or start a new one.</div>
          <div className="wr-empty-card__actions">
            <Btn variant="primary" size="sm" icon="plus" onClick={onCreateChapter} data-callback="onCreateChapter">New chapter</Btn>
          </div>
        </div>
      </div>
    );
  }
  if (state === "loading") {
    return (
      <div className="wr-canvas wr-canvas--loading" data-ui="ManuscriptCanvas" data-state="loading">
        <LoadingState title="Drawing the page…" lines={5}/>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="wr-canvas wr-canvas--error" data-ui="ManuscriptCanvas" data-state="error">
        <ErrorState title="Couldn't open this chapter" body="Local manuscript index didn't respond. Your draft is safe — try again in a moment."/>
      </div>
    );
  }
  if (state === "empty" || !paragraphs || paragraphs.length === 0) {
    return (
      <div className="wr-canvas wr-canvas--empty" data-ui="ManuscriptCanvas" data-state="empty">
        <div className="wr-empty-card">
          <Icon name="feather" size={28}/>
          <div className="wr-empty-card__title">Empty page, full ink</div>
          <div className="wr-empty-card__body">Start writing here. Highlight any name to link it, or run extraction to surface candidates.</div>
          <div className="wr-empty-card__actions">
            <Btn variant="primary" size="sm" icon="feather">Start writing</Btn>
            <Btn variant="outline" size="sm" icon="sparkle" onClick={onSaveAndExtract}>Run extraction</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="wr-canvas" data-ui="ManuscriptCanvas" data-state={state} data-chapter-id={chapter.id}>
      <header className="wr-canvas__head">
        <div className="wr-canvas__eyebrow">Chapter {chapter.num}</div>
        <h1 className="wr-canvas__title" contentEditable suppressContentEditableWarning data-callback="onManuscriptChange">
          {chapter.title || "Untitled"}
        </h1>
        <div className="wr-canvas__sub">{(chapter.words || 0).toLocaleString()} words · drafted {chapter.author === "em" ? "by E. Marlowe" : ""}</div>
      </header>
      <div data-ui="ManuscriptBody" data-callback="onManuscriptChange">
        {paragraphs.map((p, i) => (
          <ManuscriptParagraph
            key={p.id || ("sb" + i)}
            para={p}
            onEntityHover={onEntityHover}
            onCommentClick={onCommentClick}
          />
        ))}
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------
// WritersRoomScreen
// ---------------------------------------------------------------------
const WritersRoomScreen = ({
  onOpenAdaptiveWheel,
  onOpenPanel,
  onOpenReviewQueue,
  onSetSyncState,
  syncState,
  layout, setLayout,
  onApplyWorkspacePreset,
}) => {
  // Layout state — falls back to local if no shared layout passed
  const [_localLayout, _setLocalLayout] = useLayoutState();
  const L = layout || _localLayout;
  const setL = setLayout || _setLocalLayout;

  // Chapters
  const [chapters, setChapters] = _wrUS(WR_CHAPTERS);
  const [activeId, setActiveId] = _wrUS(WR_CHAPTERS.find((c) => c.active)?.id || "c7");
  const activeChapter = chapters.find((c) => c.id === activeId);

  // Manuscript state
  const [canvasState, setCanvasState] = _wrUS("writing"); // writing | empty | loading | error | saving | saved | offline
  const paragraphs = activeChapter && !activeChapter.reserved ? WR_MANUSCRIPT : [];

  // Authors
  const [activeAuthorId, setActiveAuthorId] = _wrUS("em");

  // Toolbar toggles
  const [spellcheck, setSpellcheck] = _wrUS(true);
  const [grammar, setGrammar] = _wrUS(true);
  const [voice, setVoice] = _wrUS(false);
  const [styleS, setStyleS] = _wrUS(false);
  const [revision, setRevision] = _wrUS(false);
  const [attribution, setAttribution] = _wrUS(true);
  // Derive focus/margins from layout mode
  const focusMode = L.writingLayoutMode === "clean";
  const marginsHidden = L.writingLayoutMode === "clean" || L.writingLayoutMode === "manuscript-focus";
  const leftMarginVisible  = !L.leftMarginCollapsed  && (L.writingLayoutMode === "full" || L.writingLayoutMode === "notes");
  const rightMarginVisible = !L.rightMarginCollapsed && (L.writingLayoutMode === "full" || L.writingLayoutMode === "review");
  const [typewriter, setTypewriter] = _wrUS(false);

  // Margins state
  const [noteFilter, setNoteFilter] = _wrUS("open");
  const [extFilter, setExtFilter] = _wrUS("all");
  const [notes, setNotes] = _wrUS(WR_NOTES);
  const [extractions, setExtractions] = _wrUS(WR_EXTRACTIONS);
  const [selectedExtId, setSelectedExtId] = _wrUS("x5");
  const [extractionState, setExtractionState] = _wrUS("idle"); // idle | running | complete | error

  // Extraction modal flow
  const [progressOpen, setProgressOpen] = _wrUS(false);
  const [progressStage, setProgressStage] = _wrUS(0);
  const [progressMode, setProgressMode] = _wrUS("quick"); // quick | deep
  const [progressFailed, setProgressFailed] = _wrUS(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = _wrUS(false);
  const [activeSession, setActiveSession] = _wrUS(null);

  // Review modals
  const [mergeItem, setMergeItem] = _wrUS(null);
  const [editItem, setEditItem] = _wrUS(null);
  const [denyItem, setDenyItem] = _wrUS(null);

  // Walk progress stages
  _wrUE(() => {
    if (!progressOpen || progressFailed) return;
    if (progressStage >= EXTRACTION_STAGES.length - 1) return;
    const t = setTimeout(() => setProgressStage((s) => s + 1), progressMode === "deep" ? 700 : 380);
    return () => clearTimeout(t);
  }, [progressOpen, progressStage, progressFailed, progressMode]);

  // Floating UI
  const [hoverEntity, setHoverEntity] = _wrUS(null);
  const [selToolbar, setSelToolbar] = _wrUS({ x: 380, y: 220, visible: true }); // demo: visible by default

  // Delete confirm modal
  const [deletingChapter, setDeletingChapter] = _wrUS(null);

  // ----- callbacks -----
  const onSelectChapter = _wrUC((id) => setActiveId(id), []);
  const onCreateChapter = _wrUC(() => {
    const next = chapters.length + 1;
    setChapters((curr) => [...curr, { id: "c" + next, num: next, title: "New chapter", state: "unsaved", queue: 0, words: 0, author: activeAuthorId }]);
  }, [chapters.length, activeAuthorId]);
  const onReserveChapter = _wrUC(() => {
    const next = chapters.length + 1;
    setChapters((curr) => [...curr, { id: "c" + next, num: next, title: "", state: "reserved", reserved: true, queue: 0, words: 0 }]);
  }, [chapters.length]);
  const onRenameChapter = _wrUC(() => {}, []);
  const onDeleteChapterRequest = _wrUC(() => {
    setDeletingChapter(activeChapter);
  }, [activeChapter]);
  const onConfirmDeleteChapter = _wrUC(() => {
    if (!deletingChapter) return;
    setChapters((curr) => curr.filter((c) => c.id !== deletingChapter.id));
    setDeletingChapter(null);
  }, [deletingChapter]);
  const onReorderChapter = _wrUC(() => {}, []);

  const onSave = _wrUC(() => {
    setCanvasState("saving");
    onSetSyncState && onSetSyncState("syncing");
    setTimeout(() => { setCanvasState("writing"); onSetSyncState && onSetSyncState("saved"); }, 700);
  }, [onSetSyncState]);
  const onSaveAndExtract = _wrUC(() => {
    setExtractionState("running");
    setProgressMode("quick"); setProgressStage(0); setProgressFailed(false); setProgressOpen(true);
    onSetSyncState && onSetSyncState("syncing");
  }, [onSetSyncState]);
  const onSaveAndDeepExtract = _wrUC(() => {
    setExtractionState("running");
    setProgressMode("deep"); setProgressStage(0); setProgressFailed(false); setProgressOpen(true);
    onSetSyncState && onSetSyncState("syncing");
  }, [onSetSyncState]);
  const onCloseProgress = _wrUC(() => {
    setProgressOpen(false);
    setExtractionState("complete");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState]);
  const onCancelExtraction = _wrUC(() => {
    setProgressOpen(false);
    setExtractionState("idle");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState]);
  const onRetryExtraction = _wrUC(() => { setProgressFailed(false); setProgressStage(0); }, []);
  const onOpenSessionDrawer = _wrUC(() => {
    const s = (typeof MOCK_SESSIONS !== "undefined" && MOCK_SESSIONS[0]) || null;
    setActiveSession(s); setSessionDrawerOpen(true);
  }, []);
  const onCloseSessionDrawer = _wrUC(() => setSessionDrawerOpen(false), []);

  const onManuscriptChange = _wrUC(() => {
    if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
  }, [canvasState, onSetSyncState]);
  const onSelectText = _wrUC(() => {}, []);
  const onCreateEntityFromSelection = _wrUC(() => onOpenPanel && onOpenPanel("demo"), [onOpenPanel]);
  const onLinkEntity = _wrUC(() => onOpenPanel && onOpenPanel("recent"), [onOpenPanel]);
  const onOpenEntity = _wrUC(() => onOpenPanel && onOpenPanel("demo"), [onOpenPanel]);
  const onShowMentions = _wrUC(() => {}, []);
  const onAcceptQueueItem = _wrUC((idOrItem) => {
    const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
    setExtractions((curr) => curr.filter((x) => x.id !== id));
  }, []);
  const onEditQueueItem = _wrUC((item) => {
    // accept margin-card shape too
    const normalized = item?.candidate ? item : {
      id: item?.id, entityType: item?.type, mention: item?.quote, sourceChapter: { num: 7 },
      candidate: { name: item?.name, summary: item?.summary, aliases: [] },
      confidence: { band: item?.conf, value: item?.pct }, status: "pending",
    };
    setEditItem(normalized);
  }, []);
  const onMergeQueueItem = _wrUC((item) => {
    const normalized = item?.candidate ? item : {
      id: item?.id, entityType: item?.type, mention: item?.quote, sourceChapter: { num: 7 },
      candidate: { name: item?.name, summary: item?.summary, aliases: [] },
      confidence: { band: item?.conf, value: item?.pct }, status: "pending",
      conflict: item?.merge ? { kind: "alias", note: "Possibly the same as 'the Vraska' from Ch. 2." } : null,
    };
    setMergeItem(normalized);
  }, []);
  const onDenyQueueItem = _wrUC((item) => {
    const normalized = item?.candidate ? item : {
      id: item?.id, entityType: item?.type, mention: item?.quote,
      candidate: { name: item?.name }, confidence: { band: item?.conf, value: item?.pct },
    };
    setDenyItem(normalized);
  }, []);
  const onConfirmDeny = _wrUC(() => {
    if (denyItem) setExtractions((curr) => curr.filter((x) => x.id !== denyItem.id));
    setDenyItem(null);
  }, [denyItem]);
  const onOpenFullReview = _wrUC(() => onOpenReviewQueue && onOpenReviewQueue(), [onOpenReviewQueue]);
  const onResolveNote = _wrUC((id) => setNotes((curr) => curr.map((n) => n.id === id ? { ...n, resolved: true } : n)), []);

  const onToolbarAction = _wrUC((action) => {
    if (action === "create-entity") onCreateEntityFromSelection();
    if (action === "link-entity")   onLinkEntity();
  }, [onCreateEntityFromSelection, onLinkEntity]);

  const onToggleFocusMode  = _wrUC(() => setL((p) => ({ ...p, writingLayoutMode: p.writingLayoutMode === "clean" ? "full" : "clean" })), [setL]);
  const onSelectAuthor     = _wrUC((id) => setActiveAuthorId(id), []);

  const handleEntityHover = _wrUC((e) => setHoverEntity(e), []);

  // Optional context menu / long-press for chapter strip handled inside ChapterNode.
  const wrContext = (e) => {
    e.preventDefault();
    onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: "Manuscript" });
  };

  return (
    <div
      className="wr"
      data-ui="WritersRoomScreen"
      data-route="writers-room"
      data-focus={focusMode ? "true" : "false"}
      data-margins={marginsHidden ? "hidden" : "shown"}
      data-margins-left={leftMarginVisible ? "shown" : "collapsed"}
      data-margins-right={rightMarginVisible ? "shown" : "collapsed"}
      data-writing-layout={L.writingLayoutMode}
      data-attribution={attribution ? "true" : "false"}
      data-typewriter={typewriter ? "true" : "false"}
      onContextMenu={wrContext}
      style={{
        "--wr-left-w":  (leftMarginVisible  ? L.leftMarginWidth  : 0) + "px",
        "--wr-right-w": (rightMarginVisible ? L.rightMarginWidth : 0) + "px",
      }}
    >
      <ChapterNodeStrip
        chapters={chapters}
        activeId={activeId}
        onSelectChapter={onSelectChapter}
        onCreateChapter={onCreateChapter}
        onReserveChapter={onReserveChapter}
        onReorderChapter={onReorderChapter}
        onOpenAdaptiveWheel={onOpenAdaptiveWheel}
      />

      <div className="wr-stage" style={{
        gridTemplateColumns:
          (leftMarginVisible  ? L.leftMarginWidth  + "px" : "0") + " " +
          "minmax(0,1fr) " +
          (rightMarginVisible ? L.rightMarginWidth + "px" : "0"),
      }}>
        {leftMarginVisible && <div className="wr-stage__col wr-stage__col--left">
          <LeftMargin
          notes={notes}
          authors={WR_AUTHORS}
          filter={noteFilter}
          setFilter={setNoteFilter}
          onResolve={onResolveNote}
          onEdit={() => {}}
          onDelete={(id) => setNotes((curr) => curr.filter((n) => n.id !== id))}
          onCreate={() => {}}
          pinned={L.leftMarginPinned}
          onTogglePin={() => setL({ leftMarginPinned: !L.leftMarginPinned })}
          onCollapse={() => setL({ leftMarginCollapsed: true })}
        />
          <MarginResizer side="left" value={L.leftMarginWidth} min={LAYOUT_CONSTRAINTS.leftMarginMin} max={LAYOUT_CONSTRAINTS.leftMarginMax} onChange={(v) => setL({ leftMarginWidth: v })}/>
        </div>}
        {!leftMarginVisible && L.writingLayoutMode !== "clean" && L.writingLayoutMode !== "manuscript-focus" && (
          <MarginEdgeTab side="left" label="Notes" count={notes.filter((n) => !n.resolved).length} onClick={() => setL({ leftMarginCollapsed: false })}/>
        )}

        <div className="wr-canvas-wrap">
          <ManuscriptToolbar
            spellcheck={spellcheck} grammar={grammar} voice={voice} style={styleS} revision={revision}
            attribution={attribution} focusMode={focusMode}
            onAction={onToolbarAction}
            onToggleSpellcheck={() => setSpellcheck((v) => !v)}
            onToggleGrammar={() => setGrammar((v) => !v)}
            onToggleStyle={() => setStyleS((v) => !v)}
            onToggleVoice={() => setVoice((v) => !v)}
            onToggleRevision={() => setRevision((v) => !v)}
            onToggleAttribution={() => setAttribution((v) => !v)}
            onToggleFocusMode={onToggleFocusMode}
          />

          <div className="wr-canvasbar">
            <div className="wr-canvasbar__crumb">
              <span>{BRAND.project.name}</span>
              <span className="wr-canvasbar__crumb__sep">/</span>
              <span>{BRAND.project.book}</span>
              <span className="wr-canvasbar__crumb__sep">/</span>
              <span>Chapter {activeChapter?.num || "—"}</span>
            </div>
            <div className="wr-canvasbar__chips">
              <AuthorSelector authors={WR_AUTHORS} activeId={activeAuthorId} onSelectAuthor={onSelectAuthor}/>
              <WritingLayoutMenu value={L.writingLayoutMode} onChange={(v) => setL({ writingLayoutMode: v })}/>
              <WorkspaceLayoutMenu value={L.workspaceLayoutPreset} onChange={(presetId, panelKinds) => {
                setL({ workspaceLayoutPreset: presetId === "clear" ? "writing-only" : presetId });
                if (onApplyWorkspacePreset) onApplyWorkspacePreset(presetId, panelKinds);
              }}/>
              <Btn variant="ghost" size="sm" icon="trash" onClick={onDeleteChapterRequest} data-callback="onDeleteChapterRequest" title="Delete chapter"/>
              <SaveModeControls
                onSave={onSave}
                onSaveAndExtract={onSaveAndExtract}
                onSaveAndDeepExtract={onSaveAndDeepExtract}
                syncing={canvasState === "saving" || extractionState === "running"}
              />
            </div>
          </div>

          <ManuscriptCanvas
            chapter={activeChapter}
            paragraphs={paragraphs}
            state={canvasState}
            onEntityHover={handleEntityHover}
            onCommentClick={() => {}}
            onCreateChapter={onCreateChapter}
            onSaveAndExtract={onSaveAndExtract}
          />

          {activeChapter && !activeChapter.reserved && (
            <div className="wr-ai-row" data-ui="AIWriterEntries">
              <span className="wr-ai-row__lbl">AI Writer</span>
              <Btn variant="outline" size="sm" icon="sparkle" data-callback="onAIRevise">Revise passage</Btn>
              <Btn variant="outline" size="sm" icon="feather" data-callback="onAIContinue">Continue writing</Btn>
              <Btn variant="outline" size="sm" icon="book"    data-callback="onAIWriteChapter">Write chapter</Btn>
              <Btn variant="outline" size="sm" icon="paper"   data-callback="onAIWriteParagraphs">Write paragraphs</Btn>
              <Btn variant="ghost"   size="sm" icon="plus"    data-callback="onAIAddIn">Write add-in</Btn>
            </div>
          )}

          <div className="wr-mobile-note">📱 On mobile: margins collapse to bottom sheets. Adaptive wheel via long-press.</div>

          {/* Floating selection toolbar (demo: shown above an example paragraph) */}
          {selToolbar.visible && !focusMode && activeChapter && !activeChapter.reserved && (
            <div style={{ position: "relative" }}>
              <FloatingSelectionToolbar
                x={selToolbar.x}
                y={selToolbar.y}
                onAction={onToolbarAction}
                onCreateEntityFromSelection={onCreateEntityFromSelection}
                onLinkEntity={onLinkEntity}
              />
            </div>
          )}
        </div>

        {!rightMarginVisible && L.writingLayoutMode !== "clean" && L.writingLayoutMode !== "manuscript-focus" && (
          <MarginEdgeTab side="right" label="Reviews" count={extractions.length} onClick={() => setL({ rightMarginCollapsed: false })}/>
        )}
        {rightMarginVisible && <div className="wr-stage__col wr-stage__col--right">
          <MarginResizer side="right" value={L.rightMarginWidth} min={LAYOUT_CONSTRAINTS.rightMarginMin} max={LAYOUT_CONSTRAINTS.rightMarginMax} onChange={(v) => setL({ rightMarginWidth: v })}/>
          <RightMargin
          extractions={extractions}
          selectedId={selectedExtId}
          filter={extFilter}
          setFilter={setExtFilter}
          extractionState={extractionState}
          onAcceptQueueItem={onAcceptQueueItem}
          onEditQueueItem={onEditQueueItem}
          onMergeQueueItem={onMergeQueueItem}
          onDenyQueueItem={onDenyQueueItem}
          onOpenFullReview={onOpenFullReview}
          onOpenReviewQueue={onOpenReviewQueue}
          pinned={L.rightMarginPinned}
          onTogglePin={() => setL({ rightMarginPinned: !L.rightMarginPinned })}
          onCollapse={() => setL({ rightMarginCollapsed: true })}
        />
        </div>}
      </div>

      {hoverEntity && (
        <FloatingEntityChip
          entity={hoverEntity}
          x={hoverEntity.x}
          y={hoverEntity.y}
          onOpenEntity={onOpenEntity}
          onShowMentions={onShowMentions}
          onOpenAdaptiveWheel={onOpenAdaptiveWheel}
        />
      )}

      <ChapterDeleteConfirmModal
        open={!!deletingChapter}
        chapter={deletingChapter}
        onCancel={() => setDeletingChapter(null)}
        onConfirm={onConfirmDeleteChapter}
      />

      {progressOpen && !progressFailed && (
        <ExtractionProgressModal
          open={progressOpen}
          mode={progressMode}
          stages={EXTRACTION_STAGES}
          currentStage={progressStage}
          chapterLabel={"Ch. " + (activeChapter?.num || "—") + " — " + (activeChapter?.title || "Untitled")}
          onCancel={onCancelExtraction}
          onClose={onCloseProgress}
          onOpenReviewQueue={onOpenReviewQueue}
        />
      )}
      {progressOpen && progressFailed && (
        <ExtractionFailedState
          open={progressOpen}
          message="The local model couldn't reach the manuscript index."
          onRetry={onRetryExtraction}
          onClose={onCancelExtraction}
        />
      )}

      <ExtractionSessionDrawer
        open={sessionDrawerOpen}
        session={activeSession}
        onClose={onCloseSessionDrawer}
        onOpenReviewQueue={onOpenReviewQueue}
      />

      <MergeCandidateModal
        open={!!mergeItem}
        candidate={mergeItem}
        alternatives={mergeItem ? [
          { id: "alt1", name: "the Vraska", confidence: 84, summary: "Mountain pass, Bk I Ch. 4.", aliases: ["Vraska"] },
          { id: "alt2", name: "Vraska Hold", confidence: 41, summary: "Fortress in Bk I.", aliases: ["the Hold"] },
        ] : []}
        onConfirmMerge={() => { if (mergeItem) setExtractions((c) => c.filter((x) => x.id !== mergeItem.id)); setMergeItem(null); }}
        onCreateNewInstead={() => { if (mergeItem) setExtractions((c) => c.filter((x) => x.id !== mergeItem.id)); setMergeItem(null); }}
        onCancel={() => setMergeItem(null)}
      />
      <EditCandidateModal
        open={!!editItem}
        candidate={editItem}
        targetTabs={Object.values(ENTITY_TYPES).map((t) => ({ id: t.id, label: t.label }))}
        onSave={() => setEditItem(null)}
        onAcceptEdited={() => { if (editItem) setExtractions((c) => c.filter((x) => x.id !== editItem.id)); setEditItem(null); }}
        onCancel={() => setEditItem(null)}
      />
      <DenyConfirmation
        open={!!denyItem}
        candidate={denyItem}
        onConfirm={onConfirmDeny}
        onCancel={() => setDenyItem(null)}
      />
    </div>
  );
};

Object.assign(window, {
  WritersRoomScreen,
  ChapterNodeStrip, ChapterNode,
  ManuscriptToolbar, ManuscriptCanvas, ManuscriptParagraph,
  EntityBrushHighlight, FloatingEntityChip, FloatingSelectionToolbar,
  LeftMargin, RightMargin, MarginNoteCard, MarginExtractionCard,
  SaveModeControls, AuthorSelector, ChapterDeleteConfirmModal,
});


// ----- specimen.jsx -----
// =====================================================================
// specimen.jsx — Design system specimen / spec page
// =====================================================================

const Specimen = () => {
  const tokenSwatches = [
    { name: "bg-app",     v: "var(--bg-app)" },
    { name: "bg-paper",   v: "var(--bg-paper)" },
    { name: "bg-paper-2", v: "var(--bg-paper-2)" },
    { name: "bg-elev",    v: "var(--bg-elev)" },
    { name: "bg-sunken",  v: "var(--bg-sunken)" },
    { name: "ink-1",      v: "var(--ink-1)" },
    { name: "ink-2",      v: "var(--ink-2)" },
    { name: "ink-3",      v: "var(--ink-3)" },
    { name: "ink-4",      v: "var(--ink-4)" },
    { name: "accent",     v: "var(--accent)" },
    { name: "accent-deep",v: "var(--accent-deep)" },
    { name: "accent-soft",v: "var(--accent-soft)" },
  ];

  return (
    <div className="specimen" data-ui="Specimen">
      <div className="specimen__inner">
        <div className="specimen__hero">
          <div className="specimen__eyebrow">{BRAND.name} · Design System</div>
          <h1 className="specimen__title">Parchment, ink, and a quiet archive.</h1>
          <p className="specimen__lede">A premium writing workspace stitched from parchment surfaces, antique-gold accents, and a disciplined system of entity colours. Nothing neon. Nothing fantasy-clone.</p>
        </div>

        {/* Brand */}
        <section className="specimen__section">
          <h2>Brand namespace</h2>
          <p className="specimen__section__sub">All naming, taglines, and brand colours come from <code>brand</code>. Swap <code>brand.name</code> and the whole product renames.</p>
          <div className="specimen__grid specimen__grid--3">
            <div className="specimen-card">
              <div className="specimen-card__lbl">Logo marks</div>
              <div className="specimen-card__row" style={{ gap: 16 }}>
                {["wax-seal", "loom-glyph", "quill-thread", "letter-mark"].map((v) => (
                  <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <BrandMark variant={v} size={36}/>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--ink-3)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Identity</div>
              <div className="specimen-card__title" style={{ fontSize: "var(--fs-2xl)" }}>{BRAND.name}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)" }}>{BRAND.tagline}</div>
              <div className="specimen-card__code">brand.shortName = "{BRAND.shortName}"</div>
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Theme</div>
              <div className="specimen-card__row">
                <span className="chip chip--accent">{BRAND.theme}</span>
                <span className="chip chip--neutral">midnight-ink</span>
              </div>
              <div className="specimen-card__code">data-theme on &lt;html&gt;</div>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="specimen__section">
          <h2>Surfaces &amp; ink</h2>
          <p className="specimen__section__sub">Warm ivory paper, deep ink. Tokens carry across light and midnight themes.</p>
          <div className="specimen__grid specimen__grid--4">
            {tokenSwatches.map((s) => (
              <div key={s.name} className="swatch">
                <div className="swatch__chip" style={{ background: s.v }}/>
                <div className="swatch__meta">
                  <span className="swatch__name">{s.name}</span>
                  <span className="swatch__val">--{s.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Entity palette */}
        <section className="specimen__section">
          <h2>Entity palette</h2>
          <p className="specimen__section__sub">Each entity type has one colour used inside the manuscript (brush-stroke highlight) and across all entity UI. <strong>Never mixed with confidence colours.</strong></p>
          <div className="specimen__grid specimen__grid--3">
            {Object.values(ENTITY_TYPES).map((e) => (
              <div key={e.id} className="specimen-card">
                <div className="specimen-card__row">
                  <EntityTypeBadge type={e.id} size="md"/>
                  <span className="specimen-card__code">{e.color}</span>
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-md)", color: "var(--ink-2)", lineHeight: 1.55 }}>
                  …and at the gate stood{" "}
                  <span className="entity-mark" style={{ "--ec": e.color }}>{e.label === "Cast" ? "Aelinor" : e.label === "Locations" || e.label === "Atlas" ? "the Pale Reach" : e.label === "Items" ? "the Auger" : e.label === "Bestiary" ? "a hollow-thing" : e.label}</span>
                  , quiet as paper.
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Confidence palette */}
        <section className="specimen__section">
          <h2>Confidence palette</h2>
          <p className="specimen__section__sub">Used <em>only</em> in review queues, extraction cards, and margin reviews. Never inside manuscript prose.</p>
          <div className="specimen__grid specimen__grid--4">
            {Object.values(CONFIDENCE).map((c) => (
              <div key={c.id} className="specimen-card">
                <ConfidenceBadge level={c.id} value={c.id === "high" ? 96 : c.id === "strong" ? 84 : c.id === "uncertain" ? 62 : 38} showRange/>
                <div className="specimen-card__title" style={{ fontSize: "var(--fs-md)" }}>{c.label}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>Range: {c.range}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Type */}
        <section className="specimen__section">
          <h2>Type</h2>
          <p className="specimen__section__sub">Display serif for chapter titles and brand. Text serif for body and quoted prose. Sans for UI. Mono for metadata.</p>
          <div className="specimen-card">
            <div className="type-row">
              <div className="type-row__meta">display / 5xl / 500</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-5xl)", lineHeight: 1.05 }}>A small dark queen</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">display / 3xl / 500</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-3xl)" }}>Chapter the seventh</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">serif / xl / italic</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-xl)" }}>"Quiet as paper, the city held its breath."</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">serif / md</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-md)" }}>Body prose runs in a literary serif. The eye should slow, not strain.</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">sans / md / 500</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-md)", fontWeight: 500 }}>UI text — buttons, labels, panels, navigation.</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">mono / xs</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>ch.07 · saved 14:02 · 1,832 words</div>
            </div>
          </div>
        </section>

        {/* Buttons + chips */}
        <section className="specimen__section">
          <h2>Buttons, chips &amp; badges</h2>
          <div className="specimen__grid specimen__grid--2">
            <div className="specimen-card">
              <div className="specimen-card__lbl">Buttons</div>
              <div className="specimen-card__row">
                <Btn variant="primary" icon="check">Save</Btn>
                <Btn variant="primary" icon="sparkle">Save + Extract</Btn>
                <Btn variant="outline" icon="plus">New chapter</Btn>
                <Btn variant="ghost" icon="more">More</Btn>
                <Btn variant="danger" icon="trash">Delete</Btn>
                <Btn disabled icon="lock">Locked</Btn>
              </div>
              <div className="specimen-card__row">
                <Btn variant="ghost" size="sm" icon="filter">Filter</Btn>
                <Btn variant="outline" size="sm" icon="sort">Sort</Btn>
                <Btn variant="ghost" size="sm" icon="bell">Queue</Btn>
              </div>
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Chips</div>
              <div className="specimen-card__row">
                <PrivacyModeChip mode="local"/>
                <PrivacyModeChip mode="cloud"/>
                <PrivacyModeChip mode="ai"/>
              </div>
              <div className="specimen-card__row">
                <SyncStateChip state="saved"/>
                <SyncStateChip state="unsaved"/>
                <SyncStateChip state="syncing"/>
                <SyncStateChip state="offline"/>
                <SyncStateChip state="error"/>
              </div>
              <div className="specimen-card__row">
                <ReviewCountBadge count={3}/>
                <ReviewCountBadge count={42}/>
                <ReviewCountBadge count={120}/>
              </div>
            </div>
          </div>
        </section>

        {/* States */}
        <section className="specimen__section">
          <h2>Empty · Loading · Error states</h2>
          <p className="specimen__section__sub">Reusable across every screen and panel.</p>
          <div className="specimen__grid specimen__grid--3">
            <div className="specimen-card" style={{ padding: 0, overflow: "hidden" }}>
              <EmptyState icon="paper" title="No quests yet" body="Create your first thread or run extraction on chapter 1." action={<Btn variant="primary" size="sm" icon="plus">Create</Btn>}/>
            </div>
            <div className="specimen-card" style={{ padding: 0, overflow: "hidden" }}>
              <LoadingState title="Loading cast…" lines={4}/>
            </div>
            <div className="specimen-card" style={{ padding: 0, overflow: "hidden" }}>
              <ErrorState title="Couldn't reach the archive" body="Local index didn't respond. Your manuscript is safe." onRetry={() => {}}/>
            </div>
          </div>
        </section>

        {/* Spacing & radii */}
        <section className="specimen__section">
          <h2>Spacing &amp; radii</h2>
          <div className="specimen__grid specimen__grid--2">
            <div className="specimen-card">
              <div className="specimen-card__lbl">Spacing</div>
              {[2, 4, 8, 12, 16, 24, 32, 48].map((px) => (
                <div key={px} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--ink-3)", width: 30 }}>{px}px</span>
                  <span style={{ height: 8, width: px, background: "var(--accent)", borderRadius: 2 }}/>
                </div>
              ))}
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Radii</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {[2, 4, 6, 8, 14].map((r) => (
                  <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 44, height: 44, background: "var(--accent-soft)", border: "1px solid var(--line-2)", borderRadius: r }}/>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--ink-3)" }}>{r}px</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mobile collapse notes */}
        <section className="specimen__section">
          <h2>Mobile collapse notes</h2>
          <div className="specimen-card">
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: "var(--fs-sm)", lineHeight: 1.65 }}>
              <li>Left rail collapses to a bottom nav with the four most-used routes; the rest live behind a drawer.</li>
              <li>Right utility rail folds into the bottom-sheet stack — Review, Today, Recent each open as full-screen sheets.</li>
              <li>Sliding panels become full-screen sheets, dismissed by swipe-down. Stacking is replaced with breadcrumbed back navigation.</li>
              <li>Margins (review chips beside paragraphs) collapse into bottom cards beneath the active paragraph.</li>
              <li>Adaptive Wheel is invoked by long-press anywhere; right-click and ⌘K-hold are desktop-only.</li>
              <li>Top bar shrinks: brand + project selector + search expand to a single row; chips move into a Settings sheet.</li>
            </ul>
          </div>
        </section>

        {/* Hook-up notes */}
        <section className="specimen__section">
          <h2>Hook-up notes for Claude Code</h2>
          <div className="specimen-card" style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>Every interactive element exposes a <code>data-callback</code> attribute for stable wiring. Components are pure presentational — wire <code>onSave</code>, <code>onSaveAndExtract</code>, etc. into your store or service layer.</p>
            <p style={{ margin: "0 0 8px" }}><strong>AppShell props:</strong> <code>brand, route, leftRailExpanded, rightRailExpanded, onSelectTab, onToggleLeftRail, onToggleRightRail, panels, onOpenPanel, onClosePanel, onPinPanel, onExpandPanel, onOpenCommandPalette, onOpenAdaptiveWheel, onRunWheelAction, onCloseAdaptiveWheel, onOpenReviewQueue, onOpenSettings, onSelectProject, onSelectBook, onTogglePrivacyMode, onUpdateBrandConfig</code></p>
            <p style={{ margin: "0 0 8px" }}><strong>LeftRail:</strong> <code>items, activeId, expanded, dropTargetId, onSelectTab</code>. Items: <code>{`{id, label, icon, group, entity?, queue?, soon?}`}</code>. Drag-target glow via <code>dropTargetId</code>; emits <code>onDropEntity(itemId, payload)</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>TopBar:</strong> <code>brand, project, view, onSetView, leftRailExpanded, onToggleLeftRail, privacyMode, onTogglePrivacyMode, syncState, globalQueueCount, selectedEntity, onOpenCommandPalette, onOpenSettings, onOpenProfile, onOpenReviewQueue, onSelectProject, onSelectBook</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>SlidingPanel:</strong> <code>panel, onClosePanel, onPinPanel, onExpandPanel, onOpenReviewQueue, onSelectEntity</code>. Panel object: <code>{`{id, kind, entityType, title, subtitle, state, pinned, expanded, rows?, selected?}`}</code>. State: <code>overview | selected | multi | empty | loading | error | review | edit | suggestion</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>RightUtilityRail:</strong> <code>expanded, queues, onOpenPanel, onOpenReviewQueue, onToggleExpanded</code>. Built-in slots: review, today, recent, refs, trash, notifs.</p>
            <p style={{ margin: "0 0 8px" }}><strong>BottomStatusStrip:</strong> <code>mode, lastSavedAt, isLocal, wordCount, reviewQueueCount, activeAuthor, extractionState, canvasZoom</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>CommandPalette:</strong> <code>open, onClose, onRunCommand</code>. Trigger: ⌘P / Ctrl+P.</p>
            <p style={{ margin: "0 0 8px" }}><strong>AdaptiveWheelHost:</strong> <code>open, x, y, contextLabel, onClose, onRunWheelAction</code>. Triggers (all wired): right-click, long-press (480ms), ⌘K-hold.</p>
            <p style={{ margin: "0 0 8px" }}><strong>EntityTypeBadge / ConfidenceBadge / ReviewCountBadge / PrivacyModeChip / SyncStateChip</strong> — props on the source files, all driven by the central <code>ENTITY_TYPES</code> / <code>CONFIDENCE</code> tables in <code>brand.jsx</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>Future callbacks reserved:</strong> <code>onSaveAndDeepExtract, onCreateChapter, onReserveChapter, onDeleteChapterRequest, onConfirmDeleteChapter, onReorderChapter, onCreateCanvasNode, onConnectCanvasNodes, onUploadReference, onOpenRelatedTab</code>.</p>
          </div>
        </section>

      </div>
    </div>
  );
};

window.Specimen = Specimen;


// ----- app.jsx -----
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
// Initial demo panels (so the panel system is visible on first paint)
// ---------------------------------------------------------------------
const INITIAL_PANELS = [
  {
    id: "p-cast",
    kind: "entity",
    entityType: "cast",
    title: "Cast",
    subtitle: "12 entries · 3 in review",
    state: "overview",
    pinned: false,
    expanded: false,
    collapsed: false,
    fullScreen: false,
    dockMode: "docked",
    order: 1,
    rows: [
      { id: "c1", label: "Aelinor Vey",   meta: "Ch.1–7",   selected: true },
      { id: "c2", label: "Saren of Hess", meta: "Ch.3–7", queue: 1 },
      { id: "c3", label: "Captain Brec",  meta: "Ch.2–5" },
      { id: "c4", label: "The Auger",     meta: "Ch.7" },
      { id: "c5", label: "Mara of Hess",  meta: "Ch.4" },
      { id: "c6", label: "Dav the Quiet", meta: "Ch.6", queue: 1 },
    ],
    selected: { label: "Aelinor Vey" },
  },
];

const PANEL_PRESETS = {
  review:   { id: "p-review",   kind: "system", icon: "bell",     title: "Review Queue",      subtitle: "Pending decisions",     state: "review" },
  today:    { id: "p-today",    kind: "system", icon: "sparkle",  title: "Today",             subtitle: "Suggestions for today", state: "suggestion" },
  recent:   { id: "p-recent",   kind: "system", icon: "clock",    title: "Recent entities",   subtitle: "Last 24 hours",          state: "overview", rows: [
    { id: "r1", label: "Aelinor Vey",   meta: "2m ago" },
    { id: "r2", label: "Pale Reach",    meta: "11m ago" },
    { id: "r3", label: "Auger of Hess", meta: "1h ago" },
  ]},
  refs:     { id: "p-refs",     kind: "system", icon: "paper",    title: "Active references", subtitle: "Linked sources",         state: "empty" },
  trash:    { id: "p-trash",    kind: "system", icon: "trash",    title: "Trash",              subtitle: "30-day retention",      state: "empty" },
  notifs:   { id: "p-notifs",   kind: "system", icon: "warn",     title: "Notifications",     subtitle: "Warnings & alerts",     state: "empty" },
  demo:     { id: "p-demo",     kind: "entity", entityType: "locations", title: "Locations", subtitle: "Demo panel from workspace", state: "loading" },
  cast:     { id: "p-cast2",    kind: "entity", entityType: "cast",      title: "Cast",      subtitle: "12 entries",                state: "overview", rows: [
    { id: "c1", label: "Aelinor Vey",   meta: "Ch.1–7", selected: true },
    { id: "c2", label: "Saren of Hess", meta: "Ch.3–7" },
    { id: "c3", label: "Captain Brec",  meta: "Ch.2–5" },
  ]},
  atlas:    { id: "p-atlas",    kind: "entity", entityType: "atlas",     title: "Atlas",     subtitle: "4 regions, 11 places",       state: "overview", rows: [
    { id: "a1", label: "Pale Reach",    meta: "Region" },
    { id: "a2", label: "Vraska Pass",   meta: "Pass" },
  ]},
  timeline: { id: "p-timeline", kind: "entity", entityType: "timeline",  title: "Timeline",  subtitle: "Days, eras, hours",          state: "overview", rows: [
    { id: "t1", label: "The Auger Wake", meta: "Last week" },
    { id: "t2", label: "Brec's letter",  meta: "3 nights ago" },
  ]},
};

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

  // Toggle a panel: open it if closed, close it if already open. Cmd-click pins.
  const onTogglePanel = _uc_a((kind, ctx = {}) => {
    setPanels((curr) => {
      const preset = PANEL_PRESETS[kind];
      if (!preset) return curr;
      const existing = curr.find((p) => p.id === preset.id);
      const maxOrder = curr.reduce((a, p) => Math.max(a, p.order || 0), 0);
      if (existing) {
        if (ctx.meta) {
          // cmd-click on an open panel toggles its pinned state
          return curr.map((p) => p.id === preset.id ? { ...p, pinned: !p.pinned, collapsed: false } : p);
        }
        // Plain click closes
        return curr.filter((p) => p.id !== preset.id);
      }
      // Not open — open it. Cmd-click opens AND pins.
      return [...curr, { ...preset, pinned: !!ctx.meta, expanded: false, collapsed: false, order: maxOrder + 1 }];
    });
  }, []);
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
  const onOpenSettings = _uc_a(() => setRouteId("settings"), []);
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

  // Selected entity for top bar (first selected row in any panel)
  const selectedEntity = (() => {
    for (const p of panels) {
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
            openPanelKinds={new Set(panels.map((p) => {
              // Reverse-lookup: find the panelKind whose preset id matches
              for (const [k, preset] of Object.entries(PANEL_PRESETS)) {
                if (preset.id === p.id) return k;
              }
              return null;
            }).filter(Boolean))}
            pinnedPanelKinds={new Set(panels.filter((p) => p.pinned).map((p) => {
              for (const [k, preset] of Object.entries(PANEL_PRESETS)) {
                if (preset.id === p.id) return k;
              }
              return null;
            }).filter(Boolean))}
            onActivateItem={(item, ctx) => {
              if (item.kind === "route") {
                setRouteId(item.id);
                return;
              }
              const k = item.panelKind || item.entity || item.id;
              onTogglePanel(k, ctx);
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
                onOpenReviewQueue={onOpenReviewQueue}
                onSetSyncState={setSyncState}
                syncState={syncState}
                layout={layout}
                setLayout={setLayout}
                onApplyWorkspacePreset={onApplyWorkspacePreset}
              />
            ) : (
              <Workspace
                routeId={routeId}
                demoState={demoState}
                onOpenAdaptiveWheel={onOpenAdaptiveWheel}
                onOpenPanel={onOpenPanel}
                onCreateEntity={() => onOpenPanel("demo")}
              />
            )
          ) : (
            <div style={{ height: "100%", overflow: "auto" }}><Specimen/></div>
          )}

          {/* Stacked panels — Concept A: pinned anchor + unpinned stack + collapsed rail */}
          {view === "shell" && panels.length > 0 && (
            <PanelStack
              panels={panels}
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
                const owner = panels.find((p) => (p.rows || []).some((r) => r.id === row.id));
                onSelectEntity(row, owner);
              }}
              onClearPanelFilter={onClearPanelFilter}
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

