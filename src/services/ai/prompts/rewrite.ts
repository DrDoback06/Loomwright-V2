import type { StyleProfile } from '@/services/style-analysis';
import type { ModelTier } from './index';
import { buildProseBrief } from './prose';

/**
 * The rewrite brief.
 *
 * A rewrite is not a beat. A beat is given an instruction and asked to
 * invent; a rewrite is given prose the author already wrote and asked to
 * return the same passage differently. That difference produces three
 * constraints a beat does not have, and every one of them is a failure mode
 * seen in the wild:
 *
 *   1. **Return only the replacement.** The output is substituted for a
 *      selection, so a preamble is not untidy — it lands in the manuscript.
 *   2. **Preserve every proper noun and every fact.** A rephrase that
 *      renames a character or moves a scene is not a rephrase. This is the
 *      single most common way an inline rewrite ruins a page.
 *   3. **An explicit length contract.** "Expand" and "shorten" mean nothing
 *      numeric to a model looking at forty words, so the target is computed
 *      from the selection and stated as a range.
 */

export type RewriteOp = 'expand' | 'rephrase' | 'shorten';

export const REWRITE_OPS: { id: RewriteOp; label: string; hint: string }[] = [
  { id: 'expand', label: 'Expand', hint: 'Same events, more fully rendered' },
  { id: 'rephrase', label: 'Rephrase', hint: 'Same length, different words' },
  { id: 'shorten', label: 'Shorten', hint: 'Same events, fewer words' },
];

/** The shortest selection worth sending. Below this there is not enough
 * context for a model to preserve a voice, and the bubble would fire on
 * every double-click. */
export const MIN_REWRITE_WORDS = 4;

/** Multipliers on the selection's own length. A range, not a number: an
 * exact word count makes models pad or truncate to hit it. */
const LENGTH_FACTOR: Record<RewriteOp, [number, number]> = {
  expand: [1.5, 2.0],
  rephrase: [0.9, 1.15],
  shorten: [0.5, 0.7],
};

const OP_RULES: Record<RewriteOp, string> = {
  expand:
    'Render the SAME events more fully: more of what the viewpoint character notices, feels and does. Do NOT add new events, new people, or new places.',
  rephrase:
    'Say the SAME thing differently — different sentence shapes, different word choices, the same content and the same length.',
  shorten:
    'Say the SAME thing in fewer words. Cut hedges, repetition and throat-clearing before you cut content; every event in the original must survive.',
};

export interface RewriteTweaks {
  /** Rephrase only — the three transformations worth naming. */
  pov?: string | null;
  tense?: 'past' | 'present' | null;
  toDialogue?: boolean;
}

export interface RewriteBriefInput {
  /** The selected prose, verbatim. */
  selection: string;
  op: RewriteOp;
  tweaks: RewriteTweaks;
  scene: { title: string; summary: string; povName: string | null; povType: string | null };
  /** The prose immediately before the selection, for voice. Never rewritten. */
  precedingProse: string;
  /** Entity digests. N7's `buildSceneContext()` replaces the SOURCE without
   * changing this signature — same arrangement `beat.ts` has. */
  context: string;
  style: StyleProfile | null;
  facts: string[];
  tier: ModelTier;
}

export function countSelectionWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** The word range a rewrite should land in, from the selection's own length. */
export function rewriteTarget(op: RewriteOp, selectionWords: number): [number, number] {
  const [low, high] = LENGTH_FACTOR[op];
  return [Math.max(3, Math.round(selectionWords * low)), Math.max(6, Math.round(selectionWords * high))];
}

export function buildRewritePrompt(input: RewriteBriefInput): { system: string; prompt: string } {
  const words = countSelectionWords(input.selection);
  const [low, high] = rewriteTarget(input.op, words);
  const tense = input.tweaks.tense ?? 'past';
  const pov = input.tweaks.pov ?? input.scene.povType ?? 'third limited';

  const base = buildProseBrief(
    {
      mode: input.op,
      pov,
      tense,
      length: 'a few paragraphs',
      instruction: OP_RULES[input.op],
      context: input.context,
      style: input.style,
      facts: input.facts,
    },
    { tier: input.tier }
  );

  const lines: string[] = [base, '', '--- THIS IS A REWRITE, NOT NEW PROSE ---'];

  lines.push(
    'You are given a passage the author has already written. Return the SAME passage, rewritten.',
    `Target length: ${low}–${high} words (the original is ${words}).`,
    'Every proper noun in the original — every character, place, object and title — must appear in your version, spelled exactly as written.',
    'Every fact stated in the original must remain true in your version. Change nothing that happened.',
    'Do NOT continue past the end of the passage. Do NOT add a new opening or a new closing.'
  );

  lines.push('', `What to change: ${OP_RULES[input.op]}`);

  if (input.op === 'rephrase') {
    const asked: string[] = [];
    if (input.tweaks.pov) asked.push(`Rewrite in ${input.tweaks.pov}.`);
    if (input.tweaks.tense) asked.push(`Rewrite in ${input.tweaks.tense} tense.`);
    if (input.tweaks.toDialogue) {
      asked.push(
        'Convert narrated content into spoken dialogue where it can carry it, keeping attribution minimal.'
      );
    }
    if (asked.length) lines.push('', 'ALSO:', ...asked.map((a) => `- ${a}`));
  }

  if (input.scene.summary.trim()) lines.push('', `Scene so far: ${input.scene.summary.trim()}`);
  if (input.scene.povName) lines.push(`Viewpoint character: ${input.scene.povName}.`);

  if (input.precedingProse.trim()) {
    lines.push(
      '',
      'THE PROSE BEFORE THE PASSAGE — for voice and continuity only. Do NOT rewrite it',
      'and do NOT repeat it:',
      '"""',
      input.precedingProse.trim().slice(-800),
      '"""'
    );
  }

  lines.push('', 'THE PASSAGE TO REWRITE:', '"""', input.selection.trim(), '"""');

  // Restated at the tail: this contract is what a small model loses first,
  // and here losing it means a preamble is pasted into the manuscript.
  lines.push(
    '',
    'Return ONLY the rewritten passage. No preamble, no heading, no notes, no',
    'explanation of what you changed, and no quotation marks around it.'
  );

  return {
    system:
      'You are a fiction editor rewriting a passage in place. Preserve every fact and every ' +
      'proper noun. Return only the rewritten passage.',
    prompt: lines.join('\n'),
  };
}
