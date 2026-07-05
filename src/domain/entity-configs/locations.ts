import type { EntityConfig } from './types';

const LOCATION_TYPES = [
  'World', 'Realm', 'Continent', 'Country', 'Region', 'Capital City', 'City', 'Town', 'Village', 'District', 'Fortress', 'Port',
  'Forest', 'Jungle', 'Desert', 'Mountain', 'Mountain Pass', 'Hill', 'Valley', 'River', 'Lake', 'Swamp', 'Cave', 'Coast', 'Island', 'Glacier', 'Volcano', 'Plain', 'Steppe', 'Ruins', 'Battlefield', 'Graveyard',
  'Building', 'Room', 'Tavern / Inn', 'Temple / Shrine', 'Palace', 'Barracks', 'Prison', 'Library', 'Workshop', 'Shop', 'House', 'Farm', 'Mine', 'Sewer', 'Dungeon', 'Laboratory', 'School', 'Arena', 'Bridge', 'Gate', 'Road', 'Tunnel',
  'Landmark', 'Portal', 'Secret', 'Quest Location', 'Event Site', 'Character Home', 'Faction HQ', 'Other',
] as const;
const DANGER_LEVELS = ['safe', 'watched', 'risky', 'dangerous', 'forbidden'] as const;
const ATLAS_MAPS = ['Main map (default)', 'Region detail', 'City detail'] as const;

/** Ported from the legacy EE_LOCATION config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const locationsConfig: EntityConfig = {
  type: 'locations',
  displayName: 'Location',
  defaultSummary:
    'A place. Walls, gates, a name people have come to use without thinking. Begin with what a stranger would see first.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Vraska Pass', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', hint: 'Other names this place is called by.', span: 2 },
        { id: 'kind', label: 'Type', kind: 'select', options: LOCATION_TYPES, required: true },
        { id: 'customKind', label: 'Custom type', kind: 'text', placeholder: "If 'Other' / refine the type", hint: 'Optional override' },
        // Hierarchy via the standard related picker (legacy parent-picker equivalent).
        { id: 'parentId', label: 'Parent location', kind: 'related', related: 'locations', hint: 'Sits inside…', span: 2 },
        { id: 'summary', label: 'Summary', kind: 'textarea', placeholder: 'One paragraph the wiki opens with.', span: 2 },
      ],
    },
    {
      id: 'world',
      title: 'World context',
      fields: [
        { id: 'description', label: 'Description', kind: 'longtext', placeholder: "Sight, sound, smell. What's it like to enter?", span: 2 },
        { id: 'history', label: 'History', kind: 'textarea', span: 2 },
        { id: 'culture', label: 'Culture / Inhabitants', kind: 'textarea' },
        { id: 'climate', label: 'Climate / Terrain', kind: 'textarea' },
        { id: 'danger', label: 'Danger level', kind: 'pills', options: DANGER_LEVELS },
        { id: 'currentStatus', label: 'Current status', kind: 'text', placeholder: 'e.g. Held by Grey Coats, under quarantine' },
      ],
    },
    {
      id: 'placement',
      title: 'Atlas placement',
      fields: [
        { id: 'placed', label: 'Placed on Atlas', kind: 'toggle', hint: 'Toggle on if pinned to a map.' },
        { id: 'coords', label: 'Coordinates', kind: 'dual-number', hint: 'X / Y on the Atlas grid (decimals)' },
        { id: 'atlasMap', label: 'On which Atlas map?', kind: 'select', options: ATLAS_MAPS },
        { id: 'routes', label: 'Routes / Roads / Connections', kind: 'chips', hint: 'Other location names this place connects to' },
      ],
    },
    {
      id: 'links',
      title: 'Linked entities',
      fields: [
        { id: 'characters', label: 'Characters seen here', kind: 'related-multi', related: 'cast' },
        { id: 'bestiary', label: 'Bestiary / Creatures here', kind: 'related-multi', related: 'bestiary' },
        { id: 'items', label: 'Items found here', kind: 'related-multi', related: 'items' },
        { id: 'quests', label: 'Quests located here', kind: 'related-multi', related: 'quests' },
        { id: 'events', label: 'Events that happened here', kind: 'related-multi', related: 'events' },
        { id: 'factions', label: 'Factions present', kind: 'related-multi', related: 'factions' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'firstChapter', label: 'First seen chapter', kind: 'text', placeholder: 'Ch. 1, p. 12' },
        { id: 'lastChapter', label: 'Last seen chapter', kind: 'text', placeholder: 'Ch. 7, p. 188' },
        { id: 'sourceMentions', label: 'Source mentions', kind: 'textarea', hint: 'Quotes / passages where this location appears.', span: 2 },
        { id: 'childLocationIds', label: 'Child locations', kind: 'related-multi', related: 'locations' },
        { id: 'notes', label: 'Notes (private)', kind: 'textarea', span: 2 },
        { id: 'references', label: 'References', kind: 'related-multi', related: 'references', span: 2 },
      ],
    },
    {
      id: 'review-save',
      title: 'Tags',
      fields: [
        { id: 'tags', label: 'Tags', kind: 'chips', span: 2 },
      ],
    },
  ],
};
