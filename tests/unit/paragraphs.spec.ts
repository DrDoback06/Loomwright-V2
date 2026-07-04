import { describe, expect, it } from 'vitest';
import { countWords, paragraphsFromDoc } from '@/features/writers-room/paragraph-id';

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
