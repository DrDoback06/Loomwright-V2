/** Text utilities ported from the legacy extraction engine
 * (legacy/backend-services.jsx). Behaviour is pinned by
 * tests/fixtures/extraction — change deliberately or not at all. */

/** Word-bounded ranges of `needle` in `haystack`.
 *
 * Case-**in**sensitive by default, and that default is load-bearing: two
 * callers pass a lowercased needle against original-cased prose
 * (`extraction/engine.ts:180`, which recovers the casing by re-slicing, and
 * the phrase tester at `FieldInput.tsx:517`). A sensitive default would make
 * both silently match nothing. Opt in per call, never by changing this. */
export function findRanges(
  haystack: string,
  needle: string,
  opts: { caseSensitive?: boolean } = {}
): { start: number; end: number }[] {
  if (!haystack || !needle || needle.length < 2) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, opts.caseSensitive ? 'g' : 'gi');
  const out: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** True when the match at [start, end) sits inside one of `exclusions`.
 *
 * An exclusion is a phrase in the author's prose, not a label on the entity:
 * "the Reach" excluded from an entity named Reach means *that* occurrence is
 * not a mention, while "Reach the stone" still is. Filtering the entity's own
 * name list could not express this — the name is exactly what is matching.
 *
 * Windowed to the phrase length either side of the hit, so it costs nothing
 * per match and never scans the whole chapter. */
export function isExcludedAt(
  text: string,
  start: number,
  end: number,
  exclusions: readonly string[] | undefined,
  caseSensitive = false
): boolean {
  if (!exclusions?.length) return false;
  for (const phrase of exclusions) {
    if (typeof phrase !== 'string' || phrase.length < 2) continue;
    // A phrase can only swallow the hit if it reaches at least as far in both
    // directions, so a window of its own length either side is sufficient.
    const from = Math.max(0, start - phrase.length);
    const window = text.slice(from, Math.min(text.length, end + phrase.length));
    for (const r of findRanges(window, phrase, { caseSensitive })) {
      if (from + r.start <= start && from + r.end >= end) return true;
    }
  }
  return false;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / longest;
}

/** Chunk text with overlap (5000/500 defaults) for AI passes. */
export function chunkText(
  text: string,
  size = 5000,
  overlap = 500
): { index: number; start: number; end: number; text: string }[] {
  if (!text) return [];
  if (text.length <= size) return [{ index: 0, start: 0, end: text.length, text }];
  const out: { index: number; start: number; end: number; text: string }[] = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    out.push({ index, start, end, text: text.slice(start, end) });
    if (end >= text.length) break;
    start = end - overlap;
    index++;
  }
  return out;
}

export function makeSourceQuote(
  text: string,
  startOffset: number,
  endOffset: number,
  before = 60,
  after = 80
): string {
  if (typeof text !== 'string' || startOffset == null || endOffset == null) return '';
  const start = Math.max(0, startOffset - before);
  const end = Math.min(text.length, endOffset + after);
  return text
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();
}

export type ConfidenceBand = 'blue' | 'green' | 'orange' | 'red';

export function confidenceBand(value: number | null | undefined): ConfidenceBand {
  if (value == null || Number.isNaN(value)) return 'orange';
  if (value >= 0.95) return 'blue';
  if (value >= 0.75) return 'green';
  if (value >= 0.5) return 'orange';
  return 'red';
}

/** Crude but offset-accurate sentence spans. */
export function splitSentenceSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  if (!text) return spans;
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return spans;
}
