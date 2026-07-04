import type { EntityConfig } from './types';

const BOND_TYPES = ['family', 'ally', 'enemy', 'lover', 'rival', 'mentor', 'debt', 'oath', 'stranger', 'other'] as const;
const DIRECTIONALITIES = ['mutual', 'one-way', 'conflicted'] as const;
const VALENCES = ['positive', 'negative', 'mixed', 'cold', 'heated', 'quiet'] as const;

/** Ported from the legacy EE_RELATIONSHIP config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const relationshipsConfig: EntityConfig = {
  type: 'relationships',
  displayName: 'Relationship',
  defaultSummary:
    'An edge between two characters. Name the bond, the weight, and the current temperature.',
  sections: [
    {
      id: 'edges',
      title: 'Edges',
      fields: [
        { id: 'from', label: 'From character', kind: 'related', related: 'cast', required: true },
        { id: 'to', label: 'To character', kind: 'related', related: 'cast', required: true },
        { id: 'bondType', label: 'Bond type', kind: 'pills', options: BOND_TYPES },
        { id: 'directionality', label: 'Directionality', kind: 'pills', options: DIRECTIONALITIES },
      ],
    },
    {
      id: 'tone',
      title: 'Tone & temperature',
      fields: [
        { id: 'intensity', label: 'Intensity (0–100)', kind: 'text', placeholder: '0–100' },
        { id: 'valence', label: 'Valence', kind: 'pills', options: VALENCES },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'history', label: 'History', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'story',
      title: 'Story links',
      fields: [
        { id: 'events', label: 'Events that changed this', kind: 'related-multi', related: 'events' },
        { id: 'quests', label: 'Related quests', kind: 'related-multi', related: 'quests' },
        { id: 'evidence', label: 'Manuscript evidence', kind: 'textarea', span: 2 },
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
