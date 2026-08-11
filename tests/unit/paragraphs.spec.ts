import { describe, expect, it } from 'vitest';
import { countWords, paragraphsFromDoc } from '@/features/writers-room/paragraph-id';
import { HIDDEN_FROM_AI, HIDDEN_FROM_COUNT, deriveScene } from '@/lib/prose';

const doc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { pid: 'p1' },
      content: [
        { type: 'text', text: 'The light over ' },
        { type: 'text', text: 'Pale Reach', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' was the colour of old coin.' },
      ],
    },
    { type: 'horizontalRule' },
    {
      type: 'blockquote',
      attrs: { pid: 'q1' },
      content: [
        {
          type: 'paragraph',
          attrs: { pid: 'p2' },
          content: [{ type: 'text', text: 'Letters left under the third bridge stay.' }],
        },
      ],
    },
    { type: 'paragraph', attrs: { pid: 'p3' } },
  ],
};

describe('paragraphsFromDoc', () => {
  it('extracts ordered pid/text pairs across marks and nesting', () => {
    const paragraphs = paragraphsFromDoc(doc);
    expect(paragraphs.map((p) => p.id)).toEqual(['p1', 'q1', 'p3']);
    expect(paragraphs[0].text).toBe('The light over Pale Reach was the colour of old coin.');
    expect(paragraphs[1].text).toBe('Letters left under the third bridge stay.');
    expect(paragraphs[2].text).toBe('');
  });

  it('counts words ignoring empty paragraphs', () => {
    expect(countWords(paragraphsFromDoc(doc))).toBe(11 + 7);
  });
});

/** Sections carry two independent booleans, so the substrate a model reads
 * and the count of what the author wrote are two different filters over one
 * document. These assert they really did diverge, rather than both quietly
 * following one flag — which is the only way this feature can be wrong. */
describe('sections: the two filters', () => {
  function section(
    text: string,
    attrs: { hiddenFromAi?: boolean; hiddenFromWordCount?: boolean },
    pid: string
  ) {
    return {
      type: 'section',
      attrs: { colour: 'yellow', ...attrs },
      content: [{ type: 'paragraph', attrs: { pid }, content: [{ type: 'text', text }] }],
    };
  }

  const page = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { pid: 'open' },
        content: [{ type: 'text', text: 'The ferry did not come.' }],
      },
      // A note to self: in neither list.
      section('Marrow is the traitor here.', { hiddenFromAi: true, hiddenFromWordCount: true }, 'note'),
      // An alternate take: real writing, counted, but not fed back at you.
      section('She turned and said nothing.', { hiddenFromAi: true }, 'take'),
      // Research pasted in: send it to the model, do not call it your words.
      section('Ferries ran on the hour until 1912.', { hiddenFromWordCount: true }, 'research'),
    ],
  };

  it('keeps a note out of both', () => {
    const { paragraphs, wordCount } = deriveScene(page);
    expect(paragraphs.map((p) => p.id)).not.toContain('note');
    expect(paragraphs.map((p) => p.text).join(' ')).not.toContain('traitor');
    // The open prose (5) plus the alternate take (5). The note and the
    // pasted research are both out of the count, for different reasons.
    expect(wordCount).toBe(5 + 5);
  });

  it('lets a block be counted but never sent', () => {
    const aiSees = paragraphsFromDoc(page, HIDDEN_FROM_AI).map((p) => p.id);
    const counted = paragraphsFromDoc(page, HIDDEN_FROM_COUNT).map((p) => p.id);
    expect(aiSees).not.toContain('take');
    expect(counted).toContain('take');
  });

  it('lets a block be sent but never counted', () => {
    const aiSees = paragraphsFromDoc(page, HIDDEN_FROM_AI).map((p) => p.id);
    const counted = paragraphsFromDoc(page, HIDDEN_FROM_COUNT).map((p) => p.id);
    expect(aiSees).toContain('research');
    expect(counted).not.toContain('research');
  });

  it('leaves every paragraph reachable when nothing is filtered', () => {
    // This is what `reanchorOccurrences` and the Matrix's paragraph→scene
    // map read. They want ids, not text: filtering here would orphan an
    // occurrence inside a hidden section for good.
    expect(paragraphsFromDoc(page).map((p) => p.id)).toEqual([
      'open',
      'note',
      'take',
      'research',
    ]);
  });

  it('still walks into an ordinary section', () => {
    const plain = { type: 'doc', content: [section('Two words.', {}, 'plain')] };
    const { paragraphs, wordCount } = deriveScene(plain);
    expect(paragraphs.map((p) => p.id)).toEqual(['plain']);
    expect(wordCount).toBe(2);
  });
});
