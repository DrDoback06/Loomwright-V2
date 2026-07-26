import type { ProviderConfig } from '../providers';

/**
 * One prompt library, written so a small model gets the same answer a large
 * one does.
 *
 * The premise the app is built on is that an author should be able to point it
 * at a free key — Gemini's free tier, a `:free` model on OpenRouter, Groq,
 * something local under Ollama — and get work back that is worth keeping. The
 * gap between those and a frontier model is almost never reasoning about
 * fiction. It is compliance: a big model reads "return only JSON" as a hard
 * constraint and infers the rest of the contract from context; a small one
 * reads it as a suggestion and guesses at everything unstated.
 *
 * So nothing is left unstated. Every prompt built here carries:
 *
 *  1. a role line, so the model knows what job it is doing;
 *  2. a hard output contract, restated at the end where recency helps most;
 *  3. the field list, derived from the entity configs rather than written by
 *     hand, so the schema can never drift from the editor;
 *  4. ONE worked example with real content — the single highest-value thing
 *     you can give a small model, and the thing every prompt here was missing;
 *  5. a negative example, because "don't add commentary" is abstract and
 *     "don't do this: ⟨example⟩" is not;
 *  6. an explicit omission rule, since a model with nothing to say will
 *     invent something rather than return an empty list.
 *
 * Tiering then trims scope rather than quality: a small model is asked for
 * less per call, not for something worse.
 */

/** How much a model can be trusted to hold at once. */
export type ModelTier = 'small' | 'large';

/**
 * Model ids that mean "small". Deliberately a substring list rather than an
 * allowlist: authors type their own model names, providers add models weekly,
 * and guessing large by default would send an 8B model a 32k-character world
 * digest and blame the model for what came back.
 */
const SMALL_MARKERS = [
  ':free',
  'free',
  'mini',
  'small',
  'tiny',
  'nano',
  'lite',
  'flash',
  'haiku',
  'instant',
  '1b',
  '2b',
  '3b',
  '4b',
  '7b',
  '8b',
  '9b',
  '12b',
  '13b',
  '14b',
  'gemma',
  'phi',
  'qwen2',
  'mistral-small',
];

const LARGE_MARKERS = ['opus', 'sonnet', 'gpt-4o', 'gpt-4.1', 'gpt-5', 'o1', 'o3', '70b', '405b', 'pro'];

/**
 * Which tier a configured provider is on.
 *
 * Ollama defaults to small because a model someone runs on their own laptop
 * usually is, and being wrong in that direction costs a little verbosity,
 * while being wrong the other way costs the whole reply.
 */
export function tierForModel(config: ProviderConfig): ModelTier {
  const model = (config.model ?? '').toLowerCase();
  if (!model) return config.provider === 'ollama' ? 'small' : 'large';
  // Small markers are checked FIRST because they are the more specific claim:
  // "gpt-4o-mini" contains "gpt-4o", and it is the "mini" that matters.
  if (SMALL_MARKERS.some((marker) => model.includes(marker))) return 'small';
  if (LARGE_MARKERS.some((marker) => model.includes(marker))) return 'large';
  return config.provider === 'ollama' ? 'small' : 'large';
}

/** Per-tier budgets. Small models get fewer, smaller bites of the same job. */
export interface TierBudget {
  /** Characters of manuscript per request. */
  chunkChars: number;
  /** Characters of world digest allowed alongside it. */
  digestChars: number;
  /** Known names listed per entity type. */
  namesPerType: number;
  /** Output tokens to ask for. */
  maxTokens: number;
}

export const TIER_BUDGET: Record<ModelTier, TierBudget> = {
  small: { chunkChars: 2500, digestChars: 4000, namesPerType: 20, maxTokens: 2000 },
  large: { chunkChars: 6000, digestChars: 16000, namesPerType: 60, maxTokens: 4000 },
};

/**
 * The output contract, stated in the imperative and repeated at the end of
 * every prompt. Recency matters more than elegance here: the last thing in
 * the context is the thing a small model is most likely to still be obeying.
 */
export function outputContract(): string {
  return [
    'OUTPUT RULES — these override anything else:',
    '1. Reply with exactly ONE JSON object.',
    '2. No text before it. No text after it. No markdown code fence.',
    '3. No explanation, no apology, no summary of what you did.',
    '4. If you have nothing to report, reply with the object and empty arrays.',
  ].join('\n');
}

/** The rule that stops a model filling silence with plausible fiction. */
export function omissionRule(): string {
  return [
    'ACCURACY RULES:',
    '- Report only what the text states or plainly implies. Do not infer backstory.',
    '- If a field is not established by the text, leave it out entirely.',
    '- An empty array is a correct answer. Inventing an entry to avoid one is not.',
    '- Use names exactly as the text spells them, including capitalisation.',
  ].join('\n');
}

/** A short reminder pinned to the very end. Cheap, and it works. */
export function tailReminder(): string {
  return 'Remember: one JSON object, nothing else.';
}

/**
 * A worked example, framed so the model reads it as a demonstration rather
 * than as content to summarise. The wrapping matters — small models will
 * happily extract entities from the example itself if it is not fenced off.
 */
export function workedExample(input: string, output: string): string {
  return [
    '--- WORKED EXAMPLE (illustration only — do NOT extract from this) ---',
    'If the passage were:',
    `"${input}"`,
    '',
    'the correct reply would be exactly:',
    output,
    '--- END WORKED EXAMPLE ---',
  ].join('\n');
}

/** What a wrong reply looks like. Concrete beats abstract. */
export function negativeExample(): string {
  return [
    'WRONG — never reply like any of these:',
    '  Sure! Here is the JSON you asked for:',
    '  ```json',
    '  { … }',
    '  ```',
    '  I found 3 characters. Let me know if you need more detail!',
  ].join('\n');
}

/** Trim text to a tier budget on a sentence boundary where possible. */
export function fitToBudget(text: string, budget: number): { text: string; trimmed: boolean } {
  if (text.length <= budget) return { text, trimmed: false };
  const cut = text.slice(0, budget);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  // Cutting mid-sentence is worse than losing a little text, but not worth
  // losing most of it — take the boundary only if it keeps a third of the cut.
  return { text: lastStop > budget * 0.35 ? cut.slice(0, lastStop + 1) : cut, trimmed: true };
}
