/** The sixteen entity types of the Loomwright codex.
 * `abilities` routes to the skills editor (legacy parity) but remains a
 * distinct stored type so imported worlds keep their categorisation. */
export type EntityType =
  | 'cast'
  | 'bestiary'
  | 'locations'
  | 'items'
  | 'classes'
  | 'races'
  | 'stats'
  | 'abilities'
  | 'skills'
  | 'quests'
  | 'events'
  | 'factions'
  | 'lore'
  | 'relationships'
  | 'timeline'
  | 'references';

export interface EntityTypeMeta {
  id: EntityType;
  label: string;
  plural: string;
  /** Small decorative glyph used in rosters and chips. */
  glyph: string;
  /** Accent color trio from the parchment design system. */
  color: string;
  soft: string;
  deep: string;
}

/** Ported from the legacy design system (brand.jsx ENTITY_TYPES). */
export const ENTITY_TYPE_META: Record<EntityType, EntityTypeMeta> = {
  cast: { id: 'cast', label: 'Cast', plural: 'Cast', glyph: '◐', color: '#7a6aa3', soft: '#e7e1f1', deep: '#3e335c' },
  bestiary: { id: 'bestiary', label: 'Bestiary', plural: 'Bestiary', glyph: '✦', color: '#a8553f', soft: '#f1dccf', deep: '#5d2a1c' },
  locations: { id: 'locations', label: 'Location', plural: 'Locations', glyph: '▲', color: '#6b8a4a', soft: '#dde6cc', deep: '#324a1f' },
  items: { id: 'items', label: 'Item', plural: 'Items', glyph: '✧', color: '#b08a3e', soft: '#ecdfbe', deep: '#5e451a' },
  classes: { id: 'classes', label: 'Class', plural: 'Classes', glyph: '◊', color: '#5d7896', soft: '#d8e1ec', deep: '#283a52' },
  races: { id: 'races', label: 'Race', plural: 'Races', glyph: '◑', color: '#8a8a4a', soft: '#e6e3c8', deep: '#444422' },
  stats: { id: 'stats', label: 'Stat', plural: 'Stats', glyph: '◐', color: '#3f8a8a', soft: '#cde3e3', deep: '#1a4444' },
  abilities: { id: 'abilities', label: 'Ability', plural: 'Abilities', glyph: '✺', color: '#c97a3a', soft: '#f3dcc3', deep: '#5e3415' },
  skills: { id: 'skills', label: 'Skill', plural: 'Skills', glyph: '❋', color: '#3e6db5', soft: '#cdd9ee', deep: '#1a3258' },
  quests: { id: 'quests', label: 'Quest', plural: 'Quests', glyph: '✦', color: '#8a3a4f', soft: '#ecccd3', deep: '#481a26' },
  events: { id: 'events', label: 'Event', plural: 'Events', glyph: '◈', color: '#c79545', soft: '#f1e1c2', deep: '#5e4317' },
  factions: { id: 'factions', label: 'Faction', plural: 'Factions', glyph: '▣', color: '#3d3a78', soft: '#cfcde2', deep: '#1c1a3a' },
  lore: { id: 'lore', label: 'Lore', plural: 'Lore / Canon', glyph: '◉', color: '#7a5a3a', soft: '#e6d8c3', deep: '#3d2c1a' },
  relationships: { id: 'relationships', label: 'Relationship', plural: 'Relationships', glyph: '∞', color: '#b86a82', soft: '#efd4dc', deep: '#5e2c3a' },
  timeline: { id: 'timeline', label: 'Timeline entry', plural: 'Timeline', glyph: '↔', color: '#6a7a8a', soft: '#dadfe5', deep: '#2c3640' },
  references: { id: 'references', label: 'Reference', plural: 'References', glyph: '❍', color: '#998f78', soft: '#e6e1d3', deep: '#46402f' },
};

export const ALL_ENTITY_TYPES = Object.keys(ENTITY_TYPE_META) as EntityType[];

export interface EntityRef {
  id: string;
  type: EntityType;
  name: string;
}
