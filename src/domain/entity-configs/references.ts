import type { EntityConfig } from './types';

const REFERENCE_KINDS = ['website', 'document', 'image', 'video', 'audio', 'manuscript excerpt', 'style sample', 'canon source', 'research note', 'onboarding answer', 'AI instruction', 'other'] as const;

/** Ported from the legacy EE_REFERENCE config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const referencesConfig: EntityConfig = {
  type: 'references',
  displayName: 'Reference',
  defaultSummary:
    'External source material — research, style sample, canon source, or onboarding answer.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
        { id: 'kind', label: 'Kind', kind: 'pills', options: REFERENCE_KINDS },
        { id: 'url', label: 'URL', kind: 'text', placeholder: 'https://…', span: 2 },
        { id: 'author', label: 'Author / source name', kind: 'text' },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'body', label: 'Body / excerpt', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'use',
      title: 'Use in project',
      fields: [
        { id: 'useFor', label: 'Use for', kind: 'chips', hint: 'e.g. style, canon, world, research' },
        { id: 'includeInAI', label: 'Include in AI context', kind: 'toggle' },
        { id: 'isStyleSample', label: 'Style sample', kind: 'toggle' },
        { id: 'isCanonSource', label: 'Canon source', kind: 'toggle' },
        { id: 'isResearchNote', label: 'Research note', kind: 'toggle', hint: "Source the manuscript draws on but doesn't have to obey." },
        { id: 'isOnboardingAnswer', label: 'Onboarding answer', kind: 'toggle' },
      ],
    },
    {
      id: 'links',
      title: 'Links',
      fields: [
        // TODO(M5): legacy kind 'related-multi' with related:'any' — restore a
        // cross-type entity picker; until then, free-text entity names.
        { id: 'relatedEntities', label: 'Related entities', kind: 'chips', hint: 'Names of related entries of any type.' },
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
