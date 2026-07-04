import type { EntityConfig } from './types';

const RACE_CATEGORIES = ['Folk', 'Spirit', 'Beast', 'Synthetic', 'Alien', 'Undead', 'Elemental', 'Hybrid', 'Other'] as const;

/** Ported from the legacy EE_RACE config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const racesConfig: EntityConfig = {
  type: 'races',
  displayName: 'Race / Species',
  defaultSummary:
    'An ancestry, species, culture, bloodline, or kind. The shape a character is born in.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Reach-folk', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'category', label: 'Category', kind: 'pills', options: RACE_CATEGORIES },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'description', label: 'Description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'traits',
      title: 'Traits & physical features',
      fields: [
        { id: 'traits', label: 'Traits', kind: 'chips', hint: 'Short keywords. e.g. Cold-acclimated, Saltsense' },
        { id: 'physical', label: 'Physical features', kind: 'textarea' },
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'weaknesses', label: 'Weaknesses / Limits', kind: 'chips' },
      ],
    },
    {
      id: 'stats',
      title: 'Default stats & innate skills',
      fields: [
        { id: 'defaultStats', label: 'Default stats', kind: 'stat-grid' },
        { id: 'innateSkills', label: 'Innate skills', kind: 'related-multi', related: 'skills' },
      ],
    },
    {
      id: 'world',
      title: 'World position',
      fields: [
        { id: 'originLocations', label: 'Origin locations', kind: 'related-multi', related: 'locations' },
        { id: 'habitat', label: 'Habitat / Region', kind: 'text' },
        { id: 'factions', label: 'Related factions', kind: 'related-multi', related: 'factions' },
        { id: 'bestiary', label: 'Related bestiary entries', kind: 'related-multi', related: 'bestiary' },
        { id: 'culture', label: 'Culture notes', kind: 'textarea', span: 2 },
        { id: 'history', label: 'Timeline / History', kind: 'textarea', span: 2 },
      ],
    },
    {
      id: 'compatibility',
      title: 'Compatibility',
      fields: [
        { id: 'compatibleClasses', label: 'Compatible classes', kind: 'related-multi', related: 'classes' },
        { id: 'linkedCast', label: 'Linked cast', kind: 'related-multi', related: 'cast' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'firstChapter', label: 'First seen', kind: 'text' },
        { id: 'notes', label: 'Notes', kind: 'textarea', span: 2 },
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
