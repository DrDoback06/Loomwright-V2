/** RSVP engine for the Speed Reader — pure functions, ported from the
 * legacy `useSpeedReader` timing rules so pacing feels identical. */

export interface Beat {
  word: string;
  sentenceIndex: number;
  endOfSentence: boolean;
  endOfClause: boolean;
}

const SENTENCE_END = /[.!?…]["'”’)]*$/;
const CLAUSE_END = /[,;:—]["'”’)]*$/;

/** Split text into display beats. Each beat knows its sentence and
 * whether it closes a sentence or clause (drives the pause multipliers). */
export function srTokenise(text: string): Beat[] {
  const words = text.split(/\s+/).filter(Boolean);
  const beats: Beat[] = [];
  let sentenceIndex = 0;
  for (const word of words) {
    const endOfSentence = SENTENCE_END.test(word);
    beats.push({
      word,
      sentenceIndex,
      endOfSentence,
      endOfClause: !endOfSentence && CLAUSE_END.test(word),
    });
    if (endOfSentence) sentenceIndex += 1;
  }
  return beats;
}

/** Optimal-recognition-point split: the pivot letter is rendered in
 * accent red at a fixed horizontal position. */
export function srSplitWord(word: string): { before: string; pivot: string; after: string } {
  const core = word.replace(/^["'“‘(]+|["'”’).,;:!?…—]+$/g, '') || word;
  const offset = word.indexOf(core);
  const len = core.length;
  const pivotIndex = offset + (len <= 1 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3);
  return {
    before: word.slice(0, pivotIndex),
    pivot: word[pivotIndex] ?? '',
    after: word.slice(pivotIndex + 1),
  };
}

export interface PaceOptions {
  punctuationPause?: boolean;
  sentencePause?: boolean;
  longWordSlowdown?: boolean;
}

/** Milliseconds to hold one beat. Base 60000/max(60,wpm), with the
 * legacy multipliers: clause ×1.6, sentence ×2.2, long word ×1.4. */
export function beatDelay(beat: Beat, wpm: number, opts: PaceOptions = {}): number {
  const { punctuationPause = true, sentencePause = true, longWordSlowdown = true } = opts;
  let ms = 60000 / Math.max(60, wpm);
  if (punctuationPause && beat.endOfClause) ms *= 1.6;
  if (sentencePause && beat.endOfSentence) ms *= 2.2;
  if (longWordSlowdown && beat.word.replace(/[^\p{L}\p{N}]/gu, '').length > 8) ms *= 1.4;
  return Math.round(ms);
}

/** The full sentence a beat belongs to (for the context line). */
export function sentenceOf(beats: Beat[], index: number): string {
  const beat = beats[index];
  if (!beat) return '';
  return beats
    .filter((b) => b.sentenceIndex === beat.sentenceIndex)
    .map((b) => b.word)
    .join(' ');
}
