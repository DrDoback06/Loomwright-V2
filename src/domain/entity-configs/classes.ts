import type { EntityConfig } from './types';

const CLASS_CATEGORIES = ['Hereditary', 'Functionary', 'Martial', 'Magical', 'Scholar', 'Itinerant', 'Spiritual', 'Criminal', 'Noble', 'Common', 'Custom'] as const;
const CLASS_ROLES = ['Lead', 'Support', 'Skirmisher', 'Defender', 'Scholar', 'Diplomat', 'Scout', 'Healer', 'Crafter', 'Other'] as const;

/** Ported from the legacy EE_CLASS config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const classesConfig: EntityConfig = {
  type: 'classes',
  displayName: 'Class',
  defaultSummary:
    'An archetype, role, or template. What a character is professionally trained to do.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Salt-bearer', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'category', label: 'Category', kind: 'pills', options: CLASS_CATEGORIES },
        { id: 'role', label: 'Typical role', kind: 'pills', options: CLASS_ROLES },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'description', label: 'Description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'stats',
      title: 'Default stats & modifiers',
      fields: [
        { id: 'defaultStats', label: 'Default stats', kind: 'stat-grid', hint: 'Stat name · default value · min · max' },
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'statMods', label: 'Stat modifiers vs baseline', kind: 'chips', hint: 'e.g. Resolve +1, Cunning −1' },
      ],
    },
    {
      id: 'skills',
      title: 'Skills',
      fields: [
        { id: 'startingSkills', label: 'Starting skills', kind: 'related-multi', related: 'skills' },
        { id: 'allowedSkills', label: 'Allowed skills', kind: 'related-multi', related: 'skills' },
        { id: 'linkedSkillTrees', label: 'Linked skill trees', kind: 'related-multi', related: 'skills' },
      ],
    },
    {
      id: 'equipment',
      title: 'Starting equipment',
      fields: [
        { id: 'startingItems', label: 'Starting items', kind: 'related-multi', related: 'items' },
        { id: 'startingSlots', label: 'Default slots filled', kind: 'chips', hint: 'e.g. Main Hand, Body, Pack' },
      ],
    },
    {
      id: 'compatibility',
      title: 'Compatibility & restrictions',
      fields: [
        { id: 'compatibleRaces', label: 'Compatible races / species', kind: 'related-multi', related: 'races' },
        { id: 'compatibleFactions', label: 'Compatible factions', kind: 'related-multi', related: 'factions' },
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'restrictions', label: 'Restrictions', kind: 'chips', hint: 'Rules the class must obey' },
        { id: 'progressionNotes', label: 'Progression notes', kind: 'textarea' },
      ],
    },
    {
      id: 'assigned',
      title: 'Assigned characters',
      fields: [
        { id: 'assignedCharacters', label: 'Assigned characters', kind: 'related-multi', related: 'cast' },
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
