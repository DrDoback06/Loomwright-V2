/** Offline writing-style analysis for onboarding's Voice step — real
 * metrics, no AI (legacy `analyzeWritingStyle` parity in spirit). */

export interface StyleProfile {
  wordCount: number;
  avgSentenceLength: number;
  sentenceVariance: number;
  dialogueRatio: number;
  adverbDensity: number;
  lexicalDiversity: number;
  register: 'terse' | 'balanced' | 'expansive';
  pacing: 'brisk' | 'measured' | 'unhurried';
  /** Human-readable one-liners for the wizard and the AI brief. */
  notes: string[];
}

export function analyzeStyle(text: string): StyleProfile | null {
  const clean = text.trim();
  if (!clean) return null;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 20) return null;

  const sentences = clean
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lengths = sentences.map((s) => s.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const variance =
    lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, lengths.length);

  const dialogueChars = (clean.match(/["“”][^"“”]*["“”]/g) ?? []).join('').length;
  const dialogueRatio = dialogueChars / clean.length;

  const adverbs = words.filter((w) => /ly[.,!?;:'"’”]*$/i.test(w) && w.length > 4).length;
  const adverbDensity = adverbs / words.length;

  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''))).size;
  const lexicalDiversity = unique / words.length;

  const register: StyleProfile['register'] = avg < 11 ? 'terse' : avg <= 19 ? 'balanced' : 'expansive';
  const pacing: StyleProfile['pacing'] =
    dialogueRatio > 0.3 || avg < 10 ? 'brisk' : avg <= 18 ? 'measured' : 'unhurried';

  const notes = [
    `Sentences average ${avg.toFixed(1)} words (${register} register).`,
    variance > 40
      ? 'Strong sentence-length variation — rhythmic prose.'
      : 'Even sentence lengths — steady cadence.',
    dialogueRatio > 0.25
      ? `Dialogue-forward (${Math.round(dialogueRatio * 100)}% of the text is inside quotes).`
      : `Narration-led (${Math.round(dialogueRatio * 100)}% dialogue).`,
    adverbDensity > 0.03
      ? 'Leans on -ly adverbs — flag for revision passes.'
      : 'Light adverb use.',
    `Lexical diversity ${Math.round(lexicalDiversity * 100)}%.`,
  ];

  return {
    wordCount: words.length,
    avgSentenceLength: round1(avg),
    sentenceVariance: round1(variance),
    dialogueRatio: round1(dialogueRatio),
    adverbDensity: round1(adverbDensity),
    lexicalDiversity: round1(lexicalDiversity),
    register,
    pacing,
    notes,
  };
}

function round1(n: number): number {
  return Math.round(n * 100) / 100;
}
