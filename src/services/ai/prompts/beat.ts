import type { StyleProfile } from '@/services/style-analysis';
import type { ModelTier } from './index';
import { buildProseBrief } from './prose';

/**
 * The beat brief.
 *
 * A beat is not a scene. It is one moment — roughly 400 words — written to
 * land in the middle of prose that already exists, in a voice that has
 * already been established. So this reuses the whole of `buildProseBrief`
 * (POV discipline, tense, the author's measured style, the anti-patterns,
 * the canon block) and adds the three things a beat needs that a
 * whole-scene brief does not:
 *
 *   1. the prose immediately before it, so the continuation actually
 *      continues rather than restarting;
 *   2. a hard instruction not to conclude, because a beat is followed by
 *      another beat;
 *   3. bracketed stage directions pulled out and labelled, so the model
 *      stops rendering "[she is lying]" as dialogue.
 */

export type BeatMode = 'prose' | 'dialogue' | 'description' | 'action' | 'transition';

export const BEAT_MODES: { id: BeatMode; label: string }[] = [
  { id: 'prose', label: 'Prose' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'description', label: 'Description' },
  { id: 'action', label: 'Action' },
  { id: 'transition', label: 'Transition' },
];

const MODE_RULES: Record<BeatMode, string> = {
  prose: 'Ordinary narrative prose: action, interiority and dialogue as the moment needs.',
  dialogue:
    'Dialogue-led. The exchange carries the moment; keep description to what a speaker would notice mid-conversation. Attribute sparingly — "said" is invisible and almost always right.',
  description:
    'Description-led. Ground the reader in place and sensation through the viewpoint character’s attention. No new plot events.',
  action:
    'Action-led. Short sentences, concrete verbs, physical cause and effect. Interiority only where it does not slow the beat.',
  transition:
    'A bridge. Move time, place or focus with the fewest words that keep the reader oriented. This beat may be shorter than the target.',
};

/** How long the prose before a beat can be before it stops helping. Enough
 * to carry voice and the immediate situation; not so much that a small
 * model spends its whole budget re-reading. */
export const PRECEDING_PROSE_CHARS = 1200;

/** Exported so the prompt library can seed its builtin from the prompt the
 * app actually sends, rather than from a second copy that drifts. */
export const BEAT_SYSTEM =
  'You are a fiction co-writer continuing a scene mid-flow. Write polished prose that ' +
  'follows the brief exactly. Return only the prose.';

export interface BeatBriefInput {
  /** The author's instruction, verbatim. */
  beat: string;
  mode: BeatMode;
  targetWords: number;
  scene: {
    title: string;
    summary: string;
    povName: string | null;
    povType: string | null;
  };
  /** The last stretch of prose before the beat. */
  precedingProse: string;
  /** Entity digests. N7's `buildSceneContext()` replaces the SOURCE of this
   * string without changing this signature. */
  context: string;
  /** Ordered summaries of every prior scene. Optional: a project with no
   * summaries sends nothing rather than an empty heading. */
  storySoFar?: string;
  style: StyleProfile | null;
  /** From `buildCanonFacts` — ownership, whereabouts, bonds. */
  facts: string[];
  tier: ModelTier;
}

/** Pull `[bracketed]` spans out of the instruction and label them.
 * Left inline, a model renders them as text — as dialogue, most often.
 * They are directions ABOUT the moment, not part of it. */
export function splitStageDirections(beat: string): { instruction: string; directions: string[] } {
  const directions: string[] = [];
  const instruction = beat
    .replace(/\[([^\]]+)\]/g, (_match, inner: string) => {
      const text = inner.trim();
      if (text) directions.push(text);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { instruction, directions };
}

export function buildBeatPrompt(input: BeatBriefInput): { system: string; prompt: string } {
  const { instruction, directions } = splitStageDirections(input.beat);

  const povLabel = input.scene.povType ?? 'third limited';

  // Reuse the whole prose brief rather than re-deriving voice, POV and
  // anti-patterns — the free-tier parity work lives in there.
  const base = buildProseBrief(
    {
      mode: input.mode,
      pov: povLabel,
      tense: 'past',
      length: 'a few paragraphs',
      instruction: instruction || 'Continue the scene.',
      context: input.context,
      storySoFar: input.storySoFar,
      style: input.style,
      facts: input.facts,
    },
    { tier: input.tier }
  );

  const lines: string[] = [base, '', '--- THIS IS A BEAT, NOT A SCENE ---'];

  lines.push(
    `Write approximately ${input.targetWords} words. This is ONE moment inside a longer scene.`,
    'Do NOT open with a scene-setting establishing paragraph — the scene is already underway.',
    'Do NOT resolve, conclude, or round the moment off. Another beat follows this one.',
    'Do NOT restate anything from the prose below; continue from where it stops.'
  );

  lines.push('', `Beat style: ${MODE_RULES[input.mode]}`);

  if (directions.length) {
    lines.push(
      '',
      'STAGE DIRECTIONS — these tell you how to handle the moment. They are',
      'instructions to you, not events, and must never appear in the prose:',
      ...directions.map((d) => `- ${d}`)
    );
  }

  if (input.scene.summary.trim()) {
    lines.push('', `Scene so far: ${input.scene.summary.trim()}`);
  }
  if (input.scene.povName) {
    lines.push(`Viewpoint character: ${input.scene.povName}.`);
  }

  if (input.precedingProse.trim()) {
    lines.push(
      '',
      'THE PROSE IMMEDIATELY BEFORE THIS BEAT — match its voice, rhythm and tense,',
      'and continue directly from its final sentence:',
      '"""',
      input.precedingProse.trim().slice(-PRECEDING_PROSE_CHARS),
      '"""'
    );
  }

  // Restated at the tail on purpose: the output contract is the thing a
  // small model most often loses track of over a long prompt.
  lines.push(
    '',
    'Return ONLY the prose for this beat. No preamble, no heading, no notes,',
    'no bracketed asides, and no summary of what you wrote.'
  );

  return { system: BEAT_SYSTEM, prompt: lines.join('\n') };
}
