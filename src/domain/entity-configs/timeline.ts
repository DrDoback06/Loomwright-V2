import type { EntityConfig } from './types';

/** Ported from the legacy EE_TIMELINE config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const timelineConfig: EntityConfig = {
  type: 'timeline',
  displayName: 'Timeline event',
  defaultSummary: 'A dated beat on the project timeline.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
        { id: 'dateLabel', label: 'Date / time label', kind: 'text', placeholder: 'Spring of the Third Reach · 1142 GS · Day 7' },
        { id: 'absoluteDate', label: 'Absolute date (optional)', kind: 'text', placeholder: 'ISO or in-world date' },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'body', label: 'Description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'links',
      title: 'Linked entities',
      fields: [
        { id: 'event', label: 'Linked event', kind: 'related', related: 'events' },
        { id: 'characters', label: 'Characters involved', kind: 'related-multi', related: 'cast' },
        { id: 'locations', label: 'Locations', kind: 'related-multi', related: 'locations' },
        { id: 'quests', label: 'Quests', kind: 'related-multi', related: 'quests' },
      ],
    },
    {
      id: 'placement',
      title: 'Placement',
      fields: [
        { id: 'chapter', label: 'Chapter', kind: 'text' },
        { id: 'track', label: 'Timeline track', kind: 'text', placeholder: 'Main · Court · Auger' },
        { id: 'isMilestone', label: 'Milestone', kind: 'toggle' },
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
