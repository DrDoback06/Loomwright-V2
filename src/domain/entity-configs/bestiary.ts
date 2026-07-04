import type { EntityConfig } from './types';

const BESTIARY_TIERS = ['mundane', 'minor', 'moderate', 'major', 'apex', 'mythic', 'unique', 'unknown'] as const;
const BESTIARY_DISPOSITIONS = ['docile', 'wary', 'hostile', 'ambush', 'territorial', 'intelligent', 'unknowable', 'corrupted'] as const;
const BESTIARY_CATEGORIES = ['Beast', 'Spirit', 'Construct', 'Undead', 'Plant', 'Aberration', 'Hybrid', 'Sapient', 'Unique', 'Other'] as const;

/** Ported from the legacy EE_BESTIARY config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const bestiaryConfig: EntityConfig = {
  type: 'bestiary',
  displayName: 'Creature',
  defaultSummary:
    'A creature the story can meet. Anchor it with shape, habit, and one true sentence about how it hunts or hides.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Auger Wake', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'speciesType', label: 'Type / species', kind: 'text', placeholder: 'e.g. Spirit-beast' },
        { id: 'category', label: 'Category', kind: 'pills', options: BESTIARY_CATEGORIES },
        { id: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
        { id: 'description', label: 'Description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'threat',
      title: 'Threat & encounter',
      fields: [
        { id: 'threatLevel', label: 'Threat level', kind: 'pills', options: BESTIARY_TIERS, required: true },
        { id: 'disposition', label: 'Disposition', kind: 'pills', options: BESTIARY_DISPOSITIONS },
        { id: 'challenge', label: 'Challenge rating / notes', kind: 'text', placeholder: 'e.g. CR 8 / Apex pack' },
        { id: 'fightOrFlight', label: 'Encounter posture', kind: 'text', placeholder: 'Stalks · ambushes · negotiates · flees' },
      ],
    },
    {
      id: 'habitat',
      title: 'Habitat & range',
      fields: [
        { id: 'habitat', label: 'Habitat', kind: 'text', span: 2, placeholder: 'Salt flats, frostlight forest, brine caves.' },
        { id: 'regions', label: 'Regions', kind: 'chips', span: 2 },
        { id: 'encounterLocations', label: 'Encounter locations', kind: 'related-multi', related: 'locations', span: 2 },
        { id: 'activeTimes', label: 'Active times', kind: 'chips', hint: 'When is it active? e.g. dusk, winter, after auger-storms.' },
      ],
    },
    {
      id: 'behaviour',
      title: 'Behaviour & abilities',
      fields: [
        { id: 'behaviour', label: 'Behaviour', kind: 'textarea', span: 2 },
        { id: 'abilities', label: 'Abilities / skills', kind: 'chips', span: 2 },
        { id: 'weaknesses', label: 'Weaknesses', kind: 'chips', span: 2 },
        { id: 'diet', label: 'Diet / sustenance', kind: 'text' },
        { id: 'lifecycle', label: 'Lifecycle', kind: 'textarea' },
      ],
    },
    {
      id: 'links',
      title: 'Story links',
      fields: [
        { id: 'relatedRace', label: 'Related race / species', kind: 'related-multi', related: 'races' },
        { id: 'relatedFactions', label: 'Related factions', kind: 'related-multi', related: 'factions' },
        { id: 'relatedLocations', label: 'Related locations', kind: 'related-multi', related: 'locations' },
        { id: 'relatedQuests', label: 'Related quests', kind: 'related-multi', related: 'quests' },
        { id: 'relatedEvents', label: 'Related events', kind: 'related-multi', related: 'events' },
        { id: 'lore', label: 'Lore / canon facts', kind: 'related-multi', related: 'lore' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'chapterAppearances', label: 'Chapter appearances', kind: 'chips', placeholder: 'Ch. 2 · Ch. 7 · Ch. 9' },
        { id: 'sourceMentions', label: 'Source mentions', kind: 'textarea', span: 2 },
        { id: 'references', label: 'References', kind: 'related-multi', related: 'references' },
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
