import type { StyleProfile } from '@/services/style-analysis';
import type { ModelTier } from './index';

/**
 * The writing brief.
 *
 * The old one was eight lines: "Write a scene — third limited, a few
 * paragraphs", a bullet per entity, and "stay consistent with the codex". A
 * frontier model fills the rest in from taste, which is exactly why the gap
 * between it and a free model showed up here worst — everything that makes
 * prose usable was left to be inferred. Tense, person, how dialogue is
 * punctuated, whether to summarise or dramatise, whether to name the chapter,
 * how long "a few paragraphs" is, and what NOT to do.
 *
 * All of that is now stated, because stating it is free and inferring it is
 * the thing small models are worst at.
 */

export interface ProseBrief {
  mode: string;
  pov: string;
  tense: 'past' | 'present';
  length: string;
  instruction: string;
  /** Entities in context, already flattened for the prompt. */
  cast: { label: string; name: string; detail: string }[];
  /** Measured from the author's own manuscript, never guessed. */
  style?: StyleProfile | null;
  /** Canon the passage must not contradict — ownership, whereabouts, bonds. */
  facts?: string[];
}

/** Rough word targets, so "a few paragraphs" means something to a model that
 * has no idea how long the author's paragraphs are. */
const WORD_TARGET: Record<string, string> = {
  'a few paragraphs': '250–400 words',
  'half a chapter': '900–1400 words',
  'a full chapter': '1800–2600 words',
};

const POV_RULES: Record<string, string> = {
  'third limited':
    'Third person, limited to ONE viewpoint character. Never state what anyone else is thinking — only what the viewpoint character can see, hear, or reasonably infer.',
  'third omniscient':
    'Third person omniscient. You may move between minds, but do it deliberately at scene or paragraph breaks, never mid-sentence.',
  'first person':
    'First person. "I" throughout. The narrator cannot know anything they were not present for.',
  'second person':
    'Second person. "You" throughout, sustained without slipping into third.',
};

/** What every draft must avoid. Concrete, because "write well" is not actionable. */
const ANTI_PATTERNS = [
  'No preamble, title, chapter heading, or "Here is the scene".',
  'No summarising what happens — dramatise it. "They argued" is a summary; the argument is the scene.',
  'No stage directions in brackets, no scene labels, no author notes.',
  'No adverb-heavy dialogue tags. "said" and "asked" carry almost everything.',
  'No describing a character by listing their attributes; reveal them through action.',
  'Do not resolve the scene neatly unless the direction asks for it.',
  'Do not introduce named characters, places, or objects that were not given to you.',
];

function styleLines(style: StyleProfile): string[] {
  const out = [
    `- Sentence length: average about ${Math.round(style.avgSentenceLength)} words. ${
      style.sentenceVariance > 40
        ? 'Vary hard — mix very short sentences with long ones.'
        : 'Keep the rhythm fairly even.'
    }`,
    `- Register: ${style.register}. Pacing: ${style.pacing}.`,
    `- Dialogue is roughly ${Math.round(style.dialogueRatio * 100)}% of the prose. Match that.`,
  ];
  if (style.adverbDensity < 0.02) {
    out.push('- The author almost never uses -ly adverbs. Do not start now.');
  }
  return out;
}

/**
 * Build the prose brief.
 *
 * `facts` is the part that makes this more than a nicer prompt: the caller
 * passes the actual recorded state of everyone in the scene — who owns what,
 * who is where, who hates whom — so the model is not left to guess at canon it
 * was never told. It is also what the draft gets checked against afterwards.
 */
export function buildProseBrief(brief: ProseBrief, options: { tier?: ModelTier } = {}): string {
  const tier = options.tier ?? 'large';
  const target = WORD_TARGET[brief.length] ?? brief.length;

  const sections: string[] = [
    'You are a fiction co-writer drafting inside an author’s existing manuscript.',
    'Write the passage described below. Your entire reply is the prose itself.',
    '',
    'FORM:',
    `- Write ${brief.mode === 'scene' ? 'a scene' : brief.mode}.`,
    `- ${POV_RULES[brief.pov] ?? `Point of view: ${brief.pov}.`}`,
    `- ${brief.tense === 'present' ? 'Present tense throughout.' : 'Past tense throughout.'}`,
    `- Length: ${target}. Stop when you get there; do not wrap the scene up early to fit.`,
    '- Standard prose formatting: dialogue in double quotes, a new paragraph per speaker.',
  ];

  if (brief.cast.length) {
    sections.push(
      '',
      'WHO AND WHAT IS IN THIS PASSAGE — use these, and only these, by name:',
      ...brief.cast.map((c) => `- ${c.label}: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
    );
  }

  if (brief.facts?.length) {
    sections.push(
      '',
      'ESTABLISHED CANON — the passage must not contradict any of this:',
      ...brief.facts.map((f) => `- ${f}`)
    );
  }

  if (brief.style) {
    sections.push('', 'MATCH THE AUTHOR’S VOICE — measured from their own pages:', ...styleLines(brief.style));
  }

  if (brief.instruction.trim()) {
    sections.push('', 'WHAT HAPPENS:', brief.instruction.trim());
  }

  sections.push(
    '',
    'DO NOT:',
    ...ANTI_PATTERNS.slice(0, tier === 'small' ? 5 : ANTI_PATTERNS.length).map((line) => `- ${line}`),
    '',
    'Begin the prose now. No heading, no preamble — the first word of your reply is the first word of the passage.'
  );

  return sections.join('\n');
}

/** The offline version: the same brief, for pasting into someone else's AI. */
export function buildProseBriefForHandoff(brief: ProseBrief): string {
  return buildProseBrief(brief, { tier: 'large' });
}
