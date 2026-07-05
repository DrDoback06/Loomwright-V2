import type { EntityConfig } from './types';

const LORE_KINDS = ['fact', 'rule', 'prohibition', 'historical event', 'cosmology', 'cultural belief', 'prophecy', 'language fact', 'custom', 'other'] as const;
const LORE_BANDS = ['canon', 'provisional', 'contradicted', 'retconned', 'working theory'] as const;

/** Ported from the legacy EE_LORE config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const loreConfig: EntityConfig = {
  type: 'lore',
  displayName: 'Lore / Canon',
  defaultSummary:
    'A ratified fact about your world. Phrase it as a sentence the narrator could quote.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'title', label: 'Title / statement', kind: 'text', required: true, span: 2 },
        { id: 'kind', label: 'Kind', kind: 'pills', options: LORE_KINDS },
        { id: 'band', label: 'Confidence band', kind: 'pills', options: LORE_BANDS },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'body', label: 'Full statement', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'scope',
      title: 'Scope & subject',
      fields: [
        { id: 'subjects', label: 'Subjects', kind: 'chips' },
        { id: 'appliesTo', label: 'Applies to', kind: 'chips', hint: 'e.g. The Pale Reach · Hess Court · Augers' },
        { id: 'relatedEntities', label: 'Related entities', kind: 'related-multi', related: 'any', hint: 'Link entries of any codex type.' },
      ],
    },
    {
      id: 'sources',
      title: 'Sources',
      fields: [
        { id: 'sourceQuotes', label: 'Source quotes', kind: 'textarea', span: 2 },
        { id: 'chapters', label: 'Established in chapters', kind: 'chips' },
        { id: 'references', label: 'References', kind: 'related-multi', related: 'references' },
      ],
    },
    {
      id: 'contradictions',
      title: 'Contradictions / review',
      fields: [
        { id: 'contradictedBy', label: 'Contradicted by', kind: 'textarea', span: 2 },
        { id: 'ratifiedAt', label: 'Ratified at', kind: 'text', placeholder: 'Ch. 3 / Author note' },
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
