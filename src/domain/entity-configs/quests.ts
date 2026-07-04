import type { EntityConfig } from './types';

const QUEST_TYPES = ['Main quest', 'Side quest', 'Promise', 'Mystery', 'Investigation', 'Challenge', 'Character goal', 'Faction objective', 'Task', 'Arc', 'Unresolved thread'] as const;
const QUEST_STATUSES = ['Not started', 'Active', 'Completed', 'Failed', 'Hidden', 'Future', 'Abandoned', 'Optional', 'Recurring', 'Unknown'] as const;

/** Ported from the legacy EE_QUEST config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const questsConfig: EntityConfig = {
  type: 'quests',
  displayName: 'Quest',
  defaultSummary:
    'An ongoing thread the story has not yet closed. A promise the manuscript made.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'title', label: 'Title', kind: 'text', required: true, placeholder: "e.g. Brec's Letter", span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'questType', label: 'Type', kind: 'pills', options: QUEST_TYPES },
        { id: 'status', label: 'Status', kind: 'pills', options: QUEST_STATUSES },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'goal', label: 'Goal', kind: 'textarea', span: 2, hint: "What 'success' looks like" },
      ],
    },
    {
      id: 'participants',
      title: 'Participants',
      fields: [
        { id: 'owner', label: 'Primary actor / owner', kind: 'related', related: 'cast' },
        { id: 'participants', label: 'Participants', kind: 'related-multi', related: 'cast' },
        { id: 'factions', label: 'Factions involved', kind: 'related-multi', related: 'factions' },
      ],
    },
    {
      id: 'structure',
      title: 'Steps & branches',
      fields: [
        { id: 'steps', label: 'Steps', kind: 'step-list', hint: 'Sequential beats — advance them as the story moves.' },
        // TODO(M5): legacy kind 'branch-list' — restore structured branch rows.
        { id: 'branches', label: 'Branches', kind: 'chips', hint: 'Optional / divergent paths' },
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'conditions', label: 'Required conditions', kind: 'chips' },
      ],
    },
    {
      id: 'outcomes',
      title: 'Outcomes & consequences',
      fields: [
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'outcomes', label: 'Possible outcomes', kind: 'chips' },
        { id: 'rewards', label: 'Rewards / consequences', kind: 'textarea' },
        { id: 'relatedEvents', label: 'Related events', kind: 'related-multi', related: 'events' },
      ],
    },
    {
      id: 'world',
      title: 'World links',
      fields: [
        { id: 'locations', label: 'Locations', kind: 'related-multi', related: 'locations' },
        { id: 'items', label: 'Items involved', kind: 'related-multi', related: 'items' },
        { id: 'atlasRoute', label: 'Atlas route nodes (in order)', kind: 'related-multi', related: 'locations', hint: 'Travel order' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'startChapter', label: 'Start chapter', kind: 'text' },
        { id: 'completionChapter', label: 'Completion chapter', kind: 'text' },
        { id: 'timelinePosition', label: 'Timeline placement', kind: 'text', placeholder: 'e.g. Year 3 / Spring' },
        { id: 'sourceMentions', label: 'Source mentions', kind: 'textarea', hint: 'Quotes / passages where the quest is referenced.', span: 2 },
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
