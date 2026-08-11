import { describe, expect, it } from 'vitest';
import { sentenceAround } from '@/features/writers-room/focus-dim';
import { DEFAULT_TWEAKS, loadTweaks } from '@/lib/tweaks';

const TEXT = 'The ferry did not come. Vex waited. The water ran black under the light.';

describe('the sentence the caret is in', () => {
  function span(offset: number): string {
    const [start, end] = sentenceAround(TEXT, offset);
    return TEXT.slice(start, end);
  }

  it('finds the first, middle and last sentence', () => {
    expect(span(3)).toBe('The ferry did not come. ');
    expect(span(30)).toBe('Vex waited. ');
    expect(span(50)).toBe('The water ran black under the light.');
  });

  it('keeps the caret at a boundary inside the sentence it just finished', () => {
    // Typing the space after a full stop must not black out the sentence
    // you are still looking at.
    expect(span(23)).toBe('The ferry did not come. ');
  });

  it('treats a passage with no full stop as one sentence', () => {
    expect(sentenceAround('a fragment with no stop', 4)).toEqual([0, 23]);
  });

  it('handles an empty block without dividing by nothing', () => {
    expect(sentenceAround('', 0)).toEqual([0, 0]);
  });

  it('carries a closing quote with the sentence it closes', () => {
    const quoted = '"Not tonight." She turned away.';
    const [, end] = sentenceAround(quoted, 2);
    expect(quoted.slice(0, end)).toBe('"Not tonight." ');
  });
});

describe('the retired focus setting', () => {
  // The unit suite runs without a DOM; tweaks are the one thing in `lib/`
  // that reads localStorage, so it gets the smallest possible stand-in.
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true });

  it('loads a stored "line" as "sentence" rather than as nothing', () => {
    // N1 shipped four options; two of them could only ever have behaved
    // identically. Anyone who chose the one that went gets the one that
    // meant the same thing.
    localStorage.setItem('lw:tweaks', JSON.stringify({ ...DEFAULT_TWEAKS, focus: 'line' }));
    expect(loadTweaks().focus).toBe('sentence');

    localStorage.setItem('lw:tweaks', JSON.stringify({ ...DEFAULT_TWEAKS, focus: 'paragraph' }));
    expect(loadTweaks().focus).toBe('paragraph');

    localStorage.setItem('lw:tweaks', JSON.stringify({ ...DEFAULT_TWEAKS, focus: 'nonsense' }));
    expect(loadTweaks().focus).toBe('off');
    localStorage.clear();
  });
});
