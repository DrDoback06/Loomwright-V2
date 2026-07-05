import type { EntityConfig } from './types';

const PRONOUNS = ['she/her', 'he/him', 'they/them', 'xe/xem', 'ze/zir', 'it/its', 'other', 'unknown'] as const;
const AGE_RANGES = ['child', 'teen', 'young adult', 'adult', 'middle-aged', 'elderly', 'ancient', 'timeless', 'unknown'] as const;
const ROLES = ['Protagonist', 'Co-protagonist', 'Antagonist', 'Deuteragonist', 'Mentor', 'Foil', 'Ally', 'Rival', 'Love interest', 'Family', 'Background', 'Walk-on', 'Narrator', 'Unknown'] as const;
const VOICES = ['terse', 'lyrical', 'blunt', 'wry', 'formal', 'colloquial', 'archaic', 'performative', 'clipped', 'quiet', 'over-precise', 'stream-of-consciousness'] as const;
const PRESENCE = ['on-stage', 'off-stage', 'mentioned only', 'absent', 'dead', 'missing'] as const;

/** Ported from the legacy EE_CAST config (entity-editor-configs-extended.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const castConfig: EntityConfig = {
  type: 'cast',
  displayName: 'Character',
  defaultSummary:
    'A person the story walks beside. Start with name + role + one sentence of who they are right now.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Aelinor Vey', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', hint: 'Nicknames, titles, code names.', span: 2 },
        { id: 'summary', label: 'Summary', kind: 'textarea', placeholder: 'One-line who-and-why.', span: 2 },
        { id: 'description', label: 'Biographical description', kind: 'longtext', span: 2 },
      ],
    },
    {
      id: 'identity',
      title: 'Identity',
      fields: [
        { id: 'role', label: 'Role in story', kind: 'pills', options: ROLES, span: 2 },
        { id: 'pronouns', label: 'Pronouns', kind: 'pills', options: PRONOUNS },
        { id: 'ageRange', label: 'Age range', kind: 'pills', options: AGE_RANGES },
        { id: 'age', label: 'Age (number)', kind: 'text', placeholder: '31' },
        // id must not be 'title' — the editor treats name/title as the
        // identity column and would have silently dropped this field on save.
        { id: 'honorific', label: 'Title / honorific', kind: 'text', placeholder: 'Lady, Captain, Apprentice…' },
        { id: 'species', label: 'Species / race', kind: 'related', related: 'races' },
        { id: 'class', label: 'Class / archetype', kind: 'related', related: 'classes' },
        { id: 'faction', label: 'Faction', kind: 'related', related: 'factions' },
        { id: 'occupation', label: 'Occupation / profession', kind: 'text' },
      ],
    },
    {
      id: 'appearance',
      title: 'Appearance',
      fields: [
        { id: 'portrait', label: 'Portrait', kind: 'image', hint: 'Upload or paste a reference image.' },
        { id: 'physicalDescription', label: 'Physical description', kind: 'longtext', span: 2 },
        { id: 'clothing', label: 'Clothing / equipment visual notes', kind: 'textarea', span: 2 },
        { id: 'distinguishingMarks', label: 'Distinguishing marks', kind: 'chips' },
      ],
    },
    {
      id: 'voice',
      title: 'Voice',
      fields: [
        { id: 'voiceProfile', label: 'Voice profile', kind: 'pills', options: VOICES, span: 2 },
        { id: 'speechStyle', label: 'Speech style', kind: 'textarea', placeholder: 'Sentence rhythm. Vocabulary. Do they swear, hedge, evade?', span: 2 },
        { id: 'verbalTics', label: 'Verbal tics / repeated phrases', kind: 'chips' },
        { id: 'languages', label: 'Languages spoken', kind: 'chips' },
      ],
    },
    {
      id: 'psychology',
      title: 'Psychology',
      fields: [
        { id: 'personality', label: 'Personality', kind: 'textarea', span: 2 },
        { id: 'goals', label: 'Goals', kind: 'chips', hint: 'What they want — short, declarative.', span: 2 },
        { id: 'fears', label: 'Fears', kind: 'chips', span: 2 },
        { id: 'secrets', label: 'Secrets', kind: 'textarea', hint: 'Reader-facing AND character-facing.', span: 2 },
        { id: 'flaws', label: 'Flaws', kind: 'chips' },
        { id: 'strengths', label: 'Strengths', kind: 'chips' },
        { id: 'moralCompass', label: 'Moral compass', kind: 'text', placeholder: 'Where do they draw lines?' },
      ],
    },
    {
      id: 'story-role',
      title: 'Story role',
      fields: [
        { id: 'arcSummary', label: 'Arc summary', kind: 'longtext', placeholder: 'Where do they start? Where do they end?', span: 2 },
        { id: 'backstory', label: 'Backstory', kind: 'longtext', span: 2 },
        { id: 'currentStatus', label: 'Current status in narrative', kind: 'textarea', span: 2 },
        { id: 'presence', label: 'Presence', kind: 'pills', options: PRESENCE },
      ],
    },
    {
      id: 'rpg',
      title: 'RPG systems',
      fields: [
        { id: 'stats', label: 'Stats', kind: 'stat-grid', hint: 'Stat name · value · min · max' },
        { id: 'skills', label: 'Skills', kind: 'related-multi', related: 'skills' },
        { id: 'abilities', label: 'Special abilities', kind: 'chips' },
        { id: 'statusEffects', label: 'Status effects', kind: 'chips' },
      ],
    },
    {
      id: 'equipment',
      title: 'Equipment',
      fields: [
        { id: 'inventory', label: 'Inventory', kind: 'related-multi', related: 'items' },
        { id: 'equippedItems', label: 'Equipped items', kind: 'related-multi', related: 'items' },
        { id: 'wealth', label: 'Wealth / coin', kind: 'text' },
        { id: 'carryingNotes', label: 'Carrying notes', kind: 'textarea' },
      ],
    },
    {
      id: 'relationships',
      title: 'Relationships',
      fields: [
        { id: 'family', label: 'Family', kind: 'related-multi', related: 'cast' },
        { id: 'allies', label: 'Allies', kind: 'related-multi', related: 'cast' },
        { id: 'enemies', label: 'Enemies', kind: 'related-multi', related: 'cast' },
        { id: 'lovers', label: 'Lovers / romantic interests', kind: 'related-multi', related: 'cast' },
        { id: 'rivals', label: 'Rivals', kind: 'related-multi', related: 'cast' },
        { id: 'mentors', label: 'Mentors / mentees', kind: 'related-multi', related: 'cast' },
        { id: 'relationshipNotes', label: 'Relationship notes', kind: 'textarea', span: 2 },
      ],
    },
    {
      id: 'timeline-locations',
      title: 'Timeline / Locations',
      fields: [
        { id: 'currentLocation', label: 'Current location', kind: 'related', related: 'locations' },
        { id: 'homeLocation', label: 'Home location', kind: 'related', related: 'locations' },
        { id: 'travelHistory', label: 'Travel history', kind: 'related-multi', related: 'locations' },
        { id: 'firstAppearance', label: 'First appearance (chapter)', kind: 'text', placeholder: 'Ch. 1, p. 4' },
        { id: 'lastAppearance', label: 'Last appearance', kind: 'text' },
        { id: 'timelineEvents', label: 'Timeline events', kind: 'related-multi', related: 'events' },
        { id: 'quests', label: 'Quests involved in', kind: 'related-multi', related: 'quests' },
      ],
    },
    {
      id: 'ai-profile',
      title: 'AI profile',
      fields: [
        { id: 'writingInstructions', label: 'Writing instructions for AI', kind: 'longtext', placeholder: 'How should AI handle this character? POV rules, voice notes, things to avoid.', span: 2 },
        { id: 'aiInterview', label: 'AI interview / dossier', kind: 'longtext', placeholder: 'Free-form Q&A or character bible.', span: 2 },
        { id: 'avoidTropes', label: 'Avoid these tropes', kind: 'chips' },
        { id: 'preferredScenes', label: 'Scenes that work well for them', kind: 'chips' },
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
