import { describe, expect, it } from 'vitest';
import { deriveScene, mentionsFromDoc, paragraphsFromDoc } from '@/lib/prose';
import { overlapsTypedSpan } from '@/services/extraction/session';

/** A paragraph whose inline content is given as [text, entityId?] pairs. */
function para(pid: string, runs: [string, string?][]) {
  return {
    type: 'paragraph',
    attrs: { pid },
    content: runs.map(([text, entityId]) => ({
      type: 'text',
      text,
      ...(entityId
        ? { marks: [{ type: 'mention', attrs: { entityId, entityType: 'cast', label: text } }] }
        : {}),
    })),
  };
}

const DOC = {
  type: 'doc',
  content: [
    para('p1', [['The ferry did not come. '], ['Vex', 'e-vex'], [' waited on the stones.']]),
    para('p2', [['Marrow', 'e-marrow'], [' said nothing, and ', undefined], ['Vex', 'e-vex'], [' left.']]),
  ],
};

describe('mentionsFromDoc', () => {
  it('finds every marked run with its entity', () => {
    const mentions = mentionsFromDoc(DOC);
    expect(mentions.map((m) => `${m.pid}:${m.text}`)).toEqual([
      'p1:Vex',
      'p2:Marrow',
      'p2:Vex',
    ]);
    expect(mentions.map((m) => m.entityId)).toEqual(['e-vex', 'e-marrow', 'e-vex']);
  });

  it('reports offsets in the same coordinate space as the paragraph text', () => {
    // This is the assertion the whole feature rests on: a typed mention
    // becomes an Occurrence row, and Occurrence.start/end are relative to
    // the paragraph text `paragraphsFromDoc` produced. If these two walks
    // ever disagree, every typed highlight lands on the wrong words.
    const paragraphs = new Map(paragraphsFromDoc(DOC).map((p) => [p.id, p.text]));
    for (const mention of mentionsFromDoc(DOC)) {
      expect(paragraphs.get(mention.pid)!.slice(mention.start, mention.end)).toBe(mention.text);
    }
  });

  it('merges a run another mark split in half', () => {
    // ProseMirror splits a text node wherever any mark begins or ends, so
    // bolding one word of a two-word name would otherwise report as two
    // mentions of the same entity in the same breath.
    const split = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { pid: 'p1' },
          content: [
            { type: 'text', text: 'Aelinor', marks: [{ type: 'mention', attrs: { entityId: 'e1', entityType: 'cast' } }] },
            {
              type: 'text',
              text: ' Vance',
              marks: [
                { type: 'mention', attrs: { entityId: 'e1', entityType: 'cast' } },
                { type: 'bold' },
              ],
            },
            { type: 'text', text: ' crossed the pass.' },
          ],
        },
      ],
    };
    const mentions = mentionsFromDoc(split);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].text).toBe('Aelinor Vance');
    expect(mentions[0].end - mentions[0].start).toBe('Aelinor Vance'.length);
  });

  it('keeps two adjacent mentions of DIFFERENT entities apart', () => {
    const adjacent = {
      type: 'doc',
      content: [para('p1', [['Vex', 'e-vex'], ['Marrow', 'e-marrow']])],
    };
    expect(mentionsFromDoc(adjacent).map((m) => m.entityId)).toEqual(['e-vex', 'e-marrow']);
  });

  it('ignores a mark that is missing its entity', () => {
    const broken = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { pid: 'p1' },
          content: [{ type: 'text', text: 'Vex', marks: [{ type: 'mention', attrs: {} }] }],
        },
      ],
    };
    expect(mentionsFromDoc(broken)).toEqual([]);
  });

  it('never sees a paragraph with no pid, because nothing else can anchor to it', () => {
    const orphan = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Vex', marks: [{ type: 'mention', attrs: { entityId: 'e1', entityType: 'cast' } }] }],
        },
      ],
    };
    expect(mentionsFromDoc(orphan)).toEqual([]);
  });
});

describe('a mention inside hidden content', () => {
  const withNote = {
    type: 'doc',
    content: [
      para('open', [['The ferry did not come.']]),
      {
        type: 'section',
        attrs: { colour: 'yellow', hiddenFromAi: true, hiddenFromWordCount: true },
        content: [para('note', [['Ask ', undefined], ['Marrow', 'e-marrow'], [' about this.']])],
      },
    ],
  };

  it('is a link you can click, not an appearance in the book', () => {
    // The N5b rule, applied to mentions rather than to text: what the
    // author hid from models is not part of what the story is made of.
    expect(deriveScene(withNote).mentions).toEqual([]);
    // But it IS still in the document, so the mark renders and the words
    // are still yours to find.
    expect(mentionsFromDoc(withNote, []).map((m) => m.text)).toEqual(['Marrow']);
  });
});

describe('a typed mention wins over a detector hit on the same words', () => {
  const typed = new Map([['p1', [{ start: 18, end: 24 }]]]);

  it('drops a hit that covers the same span', () => {
    expect(overlapsTypedSpan(typed, { paragraphId: 'p1', start: 18, end: 24 })).toBe(true);
  });

  it('drops a hit that merely overlaps it', () => {
    // "Marrow's" against "Marrow" — the detector caught a longer run of the
    // same name, and two rows for one mention would double every count
    // built on them.
    expect(overlapsTypedSpan(typed, { paragraphId: 'p1', start: 18, end: 26 })).toBe(true);
    expect(overlapsTypedSpan(typed, { paragraphId: 'p1', start: 12, end: 20 })).toBe(true);
  });

  it('keeps a hit that merely abuts it', () => {
    expect(overlapsTypedSpan(typed, { paragraphId: 'p1', start: 24, end: 30 })).toBe(false);
    expect(overlapsTypedSpan(typed, { paragraphId: 'p1', start: 10, end: 18 })).toBe(false);
  });

  it('keeps a hit in a different paragraph, and one with no anchor', () => {
    expect(overlapsTypedSpan(typed, { paragraphId: 'p2', start: 18, end: 24 })).toBe(false);
    expect(overlapsTypedSpan(typed, { paragraphId: null, start: 18, end: 24 })).toBe(false);
  });
});

describe('deriveScene', () => {
  it('returns all three projections of one document', () => {
    const derived = deriveScene(DOC);
    expect(derived.paragraphs.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(derived.wordCount).toBe(10 + 6);
    expect(derived.mentions).toHaveLength(3);
  });
});
