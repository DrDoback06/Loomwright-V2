import type { EntityConfig } from './types';

const FACTION_KINDS = ['house', 'order', 'guild', 'clan', 'cult', 'army', 'council', 'cabal', 'network', 'movement', 'other'] as const;

/** Ported from the legacy EE_FACTION config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const factionsConfig: EntityConfig = {
  type: 'factions',
  displayName: 'Faction',
  defaultSummary: 'A group with a name, a stake, and at least one enemy.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. The Grey Coats', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'kind', label: 'Kind', kind: 'pills', options: FACTION_KINDS },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'description', label: 'Description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'structure',
      title: 'Structure',
      fields: [
        { id: 'leader', label: 'Leader', kind: 'related', related: 'cast' },
        { id: 'members', label: 'Notable members', kind: 'related-multi', related: 'cast' },
        { id: 'size', label: 'Size / scale', kind: 'text', placeholder: 'Small · regional · imperial' },
        { id: 'structure', label: 'Internal structure', kind: 'textarea' },
        { id: 'headquarters', label: 'Headquarters', kind: 'related', related: 'locations' },
      ],
    },
    {
      id: 'world',
      title: 'World position',
      fields: [
        { id: 'goals', label: 'Goals', kind: 'chips', span: 2 },
        { id: 'methods', label: 'Methods', kind: 'chips' },
        { id: 'ideology', label: 'Ideology', kind: 'textarea' },
        { id: 'allies', label: 'Allied factions', kind: 'related-multi', related: 'factions' },
        { id: 'enemies', label: 'Enemy factions', kind: 'related-multi', related: 'factions' },
        { id: 'controlsLocations', label: 'Locations under control', kind: 'related-multi', related: 'locations' },
      ],
    },
    {
      id: 'story',
      title: 'Story links',
      fields: [
        { id: 'quests', label: 'Quests', kind: 'related-multi', related: 'quests' },
        { id: 'events', label: 'Events', kind: 'related-multi', related: 'events' },
        { id: 'lore', label: 'Lore', kind: 'related-multi', related: 'lore' },
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
