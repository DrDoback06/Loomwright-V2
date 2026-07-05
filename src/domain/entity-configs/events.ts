import type { EntityConfig } from './types';

const EVENT_TYPES = ['Battle', 'Meeting', 'Discovery', 'Death', 'Betrayal', 'Travel', 'Trade', 'Duel', 'Ritual', 'Accident', 'Reveal', 'Promise', 'Challenge', 'Conflict', 'Celebration', 'Disaster', 'Other'] as const;

/** Ported from the legacy EE_EVENT config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const eventsConfig: EntityConfig = {
  type: 'events',
  displayName: 'Event',
  defaultSummary:
    'A single happening at a specific time and place. The kind of thing the timeline pins.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'title', label: 'Title', kind: 'text', required: true, placeholder: 'e.g. The Auger Wake', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'eventType', label: 'Type', kind: 'pills', options: EVENT_TYPES },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
      ],
    },
    {
      id: 'when',
      title: 'When + where',
      fields: [
        { id: 'chapter', label: 'Chapter / Date / Time', kind: 'text', placeholder: 'Ch. 5 — last week' },
        { id: 'timelinePosition', label: 'Timeline placement', kind: 'text', placeholder: 'Year 3 / Spring / Day 12' },
        { id: 'location', label: 'Location', kind: 'related', related: 'locations' },
        { id: 'atlasPlacement', label: 'Atlas placement', kind: 'text', placeholder: 'Pinned to map?' },
      ],
    },
    {
      id: 'chain',
      title: 'Cause → Event → Consequence',
      fields: [
        { id: 'cause', label: 'Cause', kind: 'textarea', hint: 'What made it happen?' },
        { id: 'immediateOutcome', label: 'Immediate outcome', kind: 'textarea' },
        { id: 'longTermConsequence', label: 'Long-term consequence', kind: 'textarea' },
      ],
    },
    {
      id: 'participants',
      title: 'Participants',
      fields: [
        { id: 'participants', label: 'Cast involved', kind: 'related-multi', related: 'cast' },
        { id: 'factions', label: 'Factions involved', kind: 'related-multi', related: 'factions' },
      ],
    },
    {
      id: 'changes',
      title: 'State changes',
      fields: [
        { id: 'relationshipChanges', label: 'Relationship changes', kind: 'row-list', hint: 'A ↔ B / type / delta' },
        { id: 'characterStateChanges', label: 'Character state changes', kind: 'row-list' },
        { id: 'itemStateChanges', label: 'Item state changes', kind: 'row-list' },
        { id: 'locationChanges', label: 'Location changes', kind: 'row-list' },
        { id: 'statChanges', label: 'Stat changes', kind: 'row-list' },
      ],
    },
    {
      id: 'links',
      title: 'Story links',
      fields: [
        { id: 'relatedQuests', label: 'Related quests', kind: 'related-multi', related: 'quests' },
        { id: 'relatedItems', label: 'Related items', kind: 'related-multi', related: 'items' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'sourceMentions', label: 'Source mentions', kind: 'textarea', hint: 'Manuscript passages where this event surfaces.', span: 2 },
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
