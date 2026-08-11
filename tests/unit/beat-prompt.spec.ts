import { describe, expect, it } from 'vitest';
import { buildBeatPrompt, splitStageDirections } from '@/services/ai/prompts/beat';
import { paragraphsFromDoc, countWords } from '@/lib/prose';

const SCENE = {
  title: 'The crossing',
  summary: 'Vex reaches the ford at dusk.',
  povName: 'Vex',
  povType: 'third limited',
};

function prompt(overrides: Partial<Parameters<typeof buildBeatPrompt>[0]> = {}) {
  return buildBeatPrompt({
    beat: 'Vex confronts Marrow about the blade.',
    mode: 'prose',
    targetWords: 400,
    scene: SCENE,
    precedingProse: 'The water ran black under the last of the light.',
    context: '- Character Vex — a knife-thin courier',
    style: null,
    facts: ['The blade is recorded as belonging to Marrow.'],
    tier: 'large',
    ...overrides,
  });
}

describe('beat prompt', () => {
  it('says plainly that this is a fragment, not a scene', () => {
    const { prompt: text } = prompt();
    // The failure mode without this is a model that opens with weather and
    // closes with a resolution, every single beat.
    expect(text).toContain('THIS IS A BEAT, NOT A SCENE');
    expect(text).toContain('400 words');
    expect(text).toMatch(/Do NOT resolve, conclude/);
    expect(text).toMatch(/scene is already underway/);
  });

  it('carries the prose before it, so the continuation continues', () => {
    const { prompt: text } = prompt();
    expect(text).toContain('The water ran black under the last of the light.');
    expect(text).toMatch(/match its voice, rhythm and tense/);
  });

  it('restates the output contract at the tail', () => {
    const { prompt: text } = prompt();
    // Small models lose the contract over a long prompt; the tail is the
    // part they reliably still have in view.
    expect(text.slice(-400)).toMatch(/Return ONLY the prose/);
  });

  it('inherits the scene POV, and falls back rather than guessing wrong', () => {
    expect(prompt().prompt).toContain('Viewpoint character: Vex.');
    const noPov = prompt({ scene: { ...SCENE, povName: null, povType: null } }).prompt;
    expect(noPov).not.toContain('Viewpoint character:');
  });

  it('passes the canon block through from buildProseBrief', () => {
    expect(prompt().prompt).toContain('The blade is recorded as belonging to Marrow.');
  });

  it('changes its instructions with the beat style', () => {
    expect(prompt({ mode: 'dialogue' }).prompt).toMatch(/Dialogue-led/);
    expect(prompt({ mode: 'action' }).prompt).toMatch(/Action-led/);
    expect(prompt({ mode: 'transition' }).prompt).toMatch(/may be shorter/);
  });
});

describe('stage directions', () => {
  it('lifts [bracketed] spans out of the instruction and labels them', () => {
    const { instruction, directions } = splitStageDirections(
      'Marrow denies it [he is lying] and Vex lets it go [for now].'
    );
    expect(instruction).toBe('Marrow denies it and Vex lets it go .');
    expect(directions).toEqual(['he is lying', 'for now']);
  });

  it('leaves an instruction without brackets alone', () => {
    const { instruction, directions } = splitStageDirections('They argue at the ford.');
    expect(instruction).toBe('They argue at the ford.');
    expect(directions).toEqual([]);
  });

  it('tells the model directions are instructions, not events', () => {
    const text = prompt({ beat: 'Marrow denies it [he is lying].' }).prompt;
    expect(text).toContain('STAGE DIRECTIONS');
    expect(text).toMatch(/must never appear in the prose/);
    expect(text).toContain('- he is lying');
  });
});

describe('a beat is not manuscript', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { pid: 'p1' },
        content: [{ type: 'text', text: 'The water ran black.' }],
      },
      {
        type: 'sceneBeat',
        attrs: { beatId: 'b1', mode: 'prose', words: 400, state: 'pending' },
        content: [{ type: 'text', text: 'Vex confronts Marrow about the blade at length.' }],
      },
      {
        type: 'paragraph',
        attrs: { pid: 'p2' },
        content: [{ type: 'text', text: 'Marrow said nothing.' }],
      },
    ],
  };

  it('never reaches the paragraph substrate', () => {
    const paragraphs = paragraphsFromDoc(doc);
    expect(paragraphs.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(paragraphs.map((p) => p.text).join(' ')).not.toContain('confronts Marrow');
  });

  it('is not counted as words the author wrote', () => {
    // 4 + 3. The beat's eight words are scaffolding, not the book — this
    // one assertion is what keeps word count, extraction and every export
    // honest, because they all read the same derived array.
    expect(countWords(paragraphsFromDoc(doc))).toBe(7);
  });
});
