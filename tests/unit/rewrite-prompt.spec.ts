import { describe, expect, it } from 'vitest';
import {
  buildRewritePrompt,
  countSelectionWords,
  rewriteTarget,
  MIN_REWRITE_WORDS,
} from '@/services/ai/prompts/rewrite';
import { lostProperNouns } from '@/features/writers-room/useRewrite';

const SELECTION = 'Vex crossed the ford at Marrow Bridge and did not look back.';

function prompt(overrides: Partial<Parameters<typeof buildRewritePrompt>[0]> = {}) {
  return buildRewritePrompt({
    selection: SELECTION,
    op: 'rephrase',
    tweaks: {},
    scene: {
      title: 'The crossing',
      summary: 'Vex reaches the ford at dusk.',
      povName: 'Vex',
      povType: 'third limited',
    },
    precedingProse: 'The water ran black under the last of the light.',
    context: '- Character Vex — a knife-thin courier',
    style: null,
    facts: ['The blade is recorded as belonging to Marrow.'],
    tier: 'large',
    ...overrides,
  }).prompt;
}

describe('rewrite prompt', () => {
  it('says plainly that the passage already exists', () => {
    const text = prompt();
    expect(text).toContain('THIS IS A REWRITE, NOT NEW PROSE');
    expect(text).toMatch(/Do NOT continue past the end/);
    expect(text).toContain(SELECTION);
  });

  it('demands every proper noun and every fact survive', () => {
    // The most common way an inline rewrite ruins a page is by quietly
    // renaming someone, so this is stated rather than hoped for.
    const text = prompt();
    expect(text).toMatch(/Every proper noun/);
    expect(text).toMatch(/spelled exactly as written/);
    expect(text).toMatch(/Every fact stated in the original must remain true/);
  });

  it('states a length contract computed from the selection', () => {
    // 12 words. "Expand" means nothing numeric to a model looking at a
    // sentence; a range does, and a range rather than a number because an
    // exact target makes models pad.
    expect(countSelectionWords(SELECTION)).toBe(12);
    expect(prompt({ op: 'expand' })).toContain('18–24 words');
    expect(prompt({ op: 'shorten' })).toContain('6–8 words');
    expect(prompt()).toContain('11–14 words');
  });

  it('scales the target off the selection, never off a fixed number', () => {
    expect(rewriteTarget('expand', 100)).toEqual([150, 200]);
    expect(rewriteTarget('shorten', 100)).toEqual([50, 70]);
    // Never asks for a zero-word rewrite of a tiny selection.
    expect(rewriteTarget('shorten', MIN_REWRITE_WORDS)[0]).toBeGreaterThan(0);
  });

  it('changes its instructions with the operation', () => {
    expect(prompt({ op: 'expand' })).toMatch(/Do NOT add new events/);
    expect(prompt({ op: 'shorten' })).toMatch(/every event in the original must survive/);
    expect(prompt()).toMatch(/the same content and the same length/);
  });

  it('carries the rephrase tweaks, and only for a rephrase', () => {
    const tweaks = { pov: 'first person' as const, tense: 'present' as const, toDialogue: true };
    const rephrased = prompt({ tweaks });
    expect(rephrased).toContain('Rewrite in first person.');
    expect(rephrased).toContain('Rewrite in present tense.');
    expect(rephrased).toMatch(/Convert narrated content into spoken dialogue/);

    // Expand does not take them — a POV change is not an expansion.
    expect(prompt({ op: 'expand', tweaks })).not.toContain('Rewrite in first person.');
  });

  it('passes the preceding prose as context and marks it not-to-be-rewritten', () => {
    const text = prompt();
    expect(text).toContain('The water ran black under the last of the light.');
    expect(text).toMatch(/Do NOT rewrite it/);
  });

  it('restates the output contract at the tail', () => {
    // Here, losing the contract means a preamble is pasted into the book.
    expect(prompt().slice(-300)).toMatch(/Return ONLY the rewritten passage/);
  });
});

describe('the names a rewrite dropped', () => {
  it('reports a name the original had and the rewrite lost', () => {
    expect(lostProperNouns(SELECTION, 'She crossed the ford and did not look back.')).toEqual([
      'Marrow',
      'Bridge',
    ]);
  });

  it('says nothing when every name survived', () => {
    expect(
      lostProperNouns(SELECTION, 'At Marrow Bridge, Vex crossed the ford without looking back.')
    ).toEqual([]);
  });

  it('does not report a sentence-initial word as a name', () => {
    // "Vex" opens the original, so it is not counted there either — this
    // over- and under-reports by design, which is why a miss is a warning
    // to read rather than a block on Apply.
    expect(lostProperNouns('Vex went home.', 'She went home.')).toEqual([]);
  });
});
