import type { EntityConfig } from './types';

const STAT_VALUE_TYPES = ['number', 'percentage', 'scale', 'label', 'boolean', 'text', 'custom'] as const;

/** Ported from the legacy EE_STAT config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const statsConfig: EntityConfig = {
  type: 'stats',
  displayName: 'Stat',
  defaultSummary:
    'A trackable value or trait. Used by extraction to record changes the manuscript implies.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Resolve', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', hint: 'Other words the manuscript uses for this stat', span: 2 },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'valueType', label: 'Value type', kind: 'pills', options: STAT_VALUE_TYPES, required: true },
        { id: 'displayFormat', label: 'Display format', kind: 'text', placeholder: "e.g. 'N / 20' or 'High / Med / Low'" },
      ],
    },
    {
      id: 'range',
      title: 'Range & defaults',
      fields: [
        { id: 'defaultValue', label: 'Default value', kind: 'text' },
        { id: 'min', label: 'Minimum', kind: 'number' },
        { id: 'max', label: 'Maximum', kind: 'number' },
      ],
    },
    {
      id: 'scope',
      title: 'Applies to',
      fields: [
        { id: 'appliesTo', label: 'Applies to entity types', kind: 'multiselect', options: ['Cast', 'Bestiary', 'Items', 'Classes', 'Races', 'Factions', 'Quests', 'Events', 'Custom'] },
      ],
    },
    {
      id: 'rules',
      title: 'Extraction phrase rules',
      fields: [
        { id: 'extractionRules', label: 'Phrase rules', kind: 'row-list', hint: 'Phrases that signal this stat in prose — extraction scans for them (and the stat name).' },
        { id: 'testPhrase', label: 'Test a phrase', kind: 'phrase-tester', hint: 'Paste a sample sentence to see whether the rules above catch it.', span: 2 },
      ],
    },
    {
      id: 'links',
      title: 'Linked entities',
      fields: [
        { id: 'relatedSkills', label: 'Related skills', kind: 'related-multi', related: 'skills' },
        { id: 'relatedItems', label: 'Related items', kind: 'related-multi', related: 'items' },
        { id: 'relatedClasses', label: 'Related classes', kind: 'related-multi', related: 'classes' },
        { id: 'relatedRaces', label: 'Related races', kind: 'related-multi', related: 'races' },
        { id: 'assignedEntities', label: 'Assigned to', kind: 'related-multi', related: 'cast' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'changeHistory', label: 'Change history', kind: 'textarea', hint: 'Chronological — when did the stat change and why. JSON array preferred.', span: 2 },
        { id: 'sourceMentions', label: 'Source mentions', kind: 'textarea', hint: 'Quotes / passages where this stat is mentioned.', span: 2 },
        { id: 'notes', label: 'Notes', kind: 'textarea', span: 2 },
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
