import { parseJsonObject } from '@/services/ai/ai-candidates';
import { fromSet, str, strList as strListBase } from '@/services/generate/coerce';
import type { CastSeed, OnboardingAnswers, PlaceSeed } from '@/services/onboarding';

/** The prompt a user copies into any external chat AI (ChatGPT, Claude,
 * a local model). They add their story idea (or paste an excerpt); the
 * AI returns a JSON object that fills the whole onboarding interview.
 * The mirror of the AI Handoff pack, but for setup rather than
 * extraction. */
export function buildOnboardingPrompt(): string {
  return [
    'You are helping an author set up a new writing project in Loomwright.',
    '',
    'Below the line I will describe my story (a logline, a synopsis, or a pasted',
    'excerpt). Interview that idea and fill out the project setup for me.',
    '',
    'Return ONLY a single JSON object with this exact shape — omit anything you',
    'genuinely cannot infer, and never invent a plot I did not describe:',
    '',
    '{',
    '  "name": "the project/book title",',
    '  "genre": ["one or more of: Fantasy, Science fiction, Historical, Mystery, Romance, Thriller, Literary, Horror"],',
    '  "tone": ["one or more of: Dark, Grounded, Hopeful, Whimsical, Epic, Intimate"],',
    '  "premise": "2-4 sentences: who wants what, and what stands in the way",',
    '  "themes": ["short theme keywords, e.g. loyalty, debt, exile"],',
    '  "comparables": "it is like X meets Y",',
    '  "isNot": "what this story is deliberately NOT",',
    '  "pov": "one of: First person, Third limited, Third omniscient, Multiple POV",',
    '  "tense": "one of: Past, Present",',
    '  "cast": [{ "name": "", "role": "one of: Protagonist, Antagonist, Ally, Mentor, Rival, Love interest, Unknown", "note": "one line about them" }],',
    '  "places": [{ "name": "", "kind": "e.g. City, Port, Fortress, Forest, Mountain Pass, Ruins, Building, Other" }]',
    '}',
    '',
    'Do not write the manuscript — that is my job. Keep it faithful to my idea.',
    '',
    '--- MY STORY ---',
    '(describe your story here, then send)',
  ].join('\n');
}

const GENRE_SET = new Set(['Fantasy', 'Science fiction', 'Historical', 'Mystery', 'Romance', 'Thriller', 'Literary', 'Horror']);
const TONE_SET = new Set(['Dark', 'Grounded', 'Hopeful', 'Whimsical', 'Epic', 'Intimate']);

/** Onboarding lists stay short: ≤20 items, ≤60 chars each. Shared
 * coercion helpers live in services/generate/coerce. */
function strList(v: unknown): string[] {
  return strListBase(v, 20, 60);
}

/** Parse an external AI's reply into a partial set of onboarding answers
 * to merge into the wizard. Tolerant of prose/fences; returns null when
 * nothing usable parses. */
export function parseOnboardingReply(text: string): Partial<OnboardingAnswers> | null {
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const r = parsed as Record<string, unknown>;
  const out: Partial<OnboardingAnswers> = {};

  const name = str(r.name, 120);
  if (name) out.name = name;
  const premise = str(r.premise);
  if (premise) out.premise = premise;
  const comparables = str(r.comparables, 240);
  if (comparables) out.comparables = comparables;
  const isNot = str(r.isNot, 240);
  if (isNot) out.isNot = isNot;

  const genre = fromSet(strList(r.genre), GENRE_SET);
  if (genre.length) out.genre = genre;
  const tone = fromSet(strList(r.tone), TONE_SET);
  if (tone.length) out.tone = tone;
  const themes = strList(r.themes);
  if (themes.length) out.themes = themes;

  const pov = str(r.pov, 40);
  if (pov) out.pov = pov;
  const tense = str(r.tense, 20);
  if (tense) out.tense = tense;

  if (Array.isArray(r.cast)) {
    const cast: CastSeed[] = [];
    for (const row of r.cast.slice(0, 24)) {
      if (!row || typeof row !== 'object') continue;
      const c = row as Record<string, unknown>;
      const cname = str(c.name, 80);
      if (!cname) continue;
      cast.push({ name: cname, role: str(c.role, 40) ?? '', note: str(c.note, 200) ?? '' });
    }
    if (cast.length) out.cast = cast;
  }

  if (Array.isArray(r.places)) {
    const places: PlaceSeed[] = [];
    for (const row of r.places.slice(0, 24)) {
      if (!row || typeof row !== 'object') continue;
      const p = row as Record<string, unknown>;
      const pname = str(p.name, 80);
      if (!pname) continue;
      places.push({ name: pname, kind: str(p.kind, 40) ?? '' });
    }
    if (places.length) out.places = places;
  }

  return Object.keys(out).length ? out : null;
}
