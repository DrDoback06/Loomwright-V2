import type { EntityConfig } from './types';

const SKILL_TYPES = ['active', 'passive', 'triggered', 'one-time', 'temporary', 'innate', 'item-granted', 'class-granted', 'race-granted', 'custom'] as const;

/** Ported from the legacy EE_SKILL config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. Legacy routed `abilities` to this same config;
 * the registry in index.ts keeps that aliasing. */
export const skillsConfig: EntityConfig = {
  type: 'skills',
  displayName: 'Skill',
  defaultSummary:
    "A reusable action, trait, power, talent, technique, spell, or learned ability. Anything a character does that's worth tracking.",
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Court tongue', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'skillType', label: 'Skill type', kind: 'pills', options: SKILL_TYPES, required: true },
        { id: 'cost', label: 'Cost', kind: 'text', placeholder: '—, mana, charge, page…' },
        { id: 'cooldown', label: 'Cooldown', kind: 'text', placeholder: 'None / per scene / per chapter' },
        { id: 'limit', label: 'Limit', kind: 'text' },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'description', label: 'Description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'requirements',
      title: 'Requirements',
      fields: [
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'requirements', label: 'Requirements', kind: 'chips' },
      ],
    },
    {
      id: 'effects',
      title: 'Effects',
      fields: [
        // TODO(M5): legacy kind 'effects-list' — restore structured effect rows.
        { id: 'effects', label: 'Effects', kind: 'chips' },
      ],
    },
    {
      id: 'progression',
      title: 'Upgrade / progression',
      fields: [
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'upgradePath', label: 'Upgrade path', kind: 'chips', hint: 'Tier / name / effect' },
      ],
    },
    {
      id: 'links',
      title: 'Linked entities',
      fields: [
        { id: 'linkedStats', label: 'Linked stats', kind: 'related-multi', related: 'stats' },
        { id: 'linkedClasses', label: 'Linked classes', kind: 'related-multi', related: 'classes' },
        { id: 'linkedRaces', label: 'Linked races', kind: 'related-multi', related: 'races' },
        { id: 'linkedItems', label: 'Linked items', kind: 'related-multi', related: 'items' },
        { id: 'assignedCast', label: 'Assigned characters', kind: 'related-multi', related: 'cast' },
        { id: 'skillTreeNodes', label: 'Skill tree nodes', kind: 'chips', hint: 'Tree name + node label' },
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
