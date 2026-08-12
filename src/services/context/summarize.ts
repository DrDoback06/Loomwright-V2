import type { Scene } from '@/db/types';
import { completeDetailed } from '@/services/ai/providers';
import { fitToBudget } from '@/services/ai/prompts';
import { resolveProvider } from '@/services/ai/settings';
import { splitSentenceSpans } from '@/services/extraction/text-utils';

export type SummaryLength = 80 | 120 | 300;

export interface SceneSummary {
  text: string;
  /** Which path produced it — the panel says so, because a sentence the
   * author wrote and a sentence a model wrote are not the same claim. */
  source: 'local' | 'ai';
  /** The model's reply stopped mid-sentence. Never silently hidden. */
  truncated?: boolean;
}

/** How much prose a summary prompt carries. Generous — a summary of the
 * first half of a scene is a lie about the scene. */
const SOURCE_CHARS = 12_000;

/** Words that carry a scene rather than decorate it. Deliberately small and
 * hand-checked: a big list starts scoring on topic, and a summary should be
 * about what changed, not about which nouns were common. */
const SIGNAL = [
  'but', 'because', 'until', 'finally', 'suddenly', 'instead', 'never', 'now',
  'killed', 'died', 'dead', 'left', 'leaves', 'took', 'takes', 'gave', 'gives',
  'found', 'finds', 'told', 'tells', 'asked', 'asks', 'refused', 'refuses',
  'agreed', 'agrees', 'discovered', 'discovers', 'learned', 'learns',
  'realised', 'realized', 'decided', 'decides', 'promised', 'promises',
  'betrayed', 'betrays', 'arrived', 'arrives', 'escaped', 'escapes',
];

function sentences(text: string): string[] {
  return splitSentenceSpans(text)
    .map((span) => text.slice(span.start, span.end).trim())
    .filter((s) => s.length > 20);
}

/**
 * Score a sentence for how much of the scene it carries.
 *
 * Not `assessCandidateQuality` — that scores whether a *name* is worth
 * proposing as an entity, which is a different question with a different
 * answer shape. This is position (openings and closings carry the turn),
 * plus named subjects, plus verbs of consequence, minus the two shapes that
 * summarise badly: pure dialogue and pure description.
 */
function salience(sentence: string, index: number, total: number): number {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const position = index === 0 ? 1.6 : index >= total - 2 ? 1.3 : 1;
  const lower = sentence.toLowerCase();
  const signal = SIGNAL.reduce(
    (sum, word) => sum + (new RegExp(`\\b${word}\\b`).test(lower) ? 1 : 0),
    0
  );
  // Proper nouns that are not sentence-initial: who this is about.
  const named = words.slice(1).filter((w) => /^[A-Z][a-z]/.test(w)).length;
  // A line of dialogue on its own says who spoke, not what happened.
  const dialogue = /^["“']/.test(sentence) ? -1.2 : 0;
  // Very long sentences are usually description; very short ones are beats.
  const length = words.length >= 8 && words.length <= 34 ? 0.5 : 0;
  return position * (1 + signal * 0.8 + Math.min(named, 3) * 0.4 + length) + dialogue;
}

/**
 * A summary built from the scene's own sentences, with no provider at all.
 *
 * Extractive rather than abstractive, and that is a feature: every word in
 * the result is a word the author wrote, so it can be wrong about emphasis
 * but it cannot invent an event. It is also instant, free, and identical on
 * every machine.
 *
 * This is the default path, not the fallback. The AI summariser is the
 * option.
 */
export function summarizeSceneLocally(scene: Scene, words: number = 120): string {
  const text = scene.paragraphs.map((p) => p.text).join(' ');
  const all = sentences(text);
  if (!all.length) return '';

  const ranked = all
    .map((sentence, index) => ({ sentence, index, score: salience(sentence, index, all.length) }))
    .sort((a, b) => b.score - a.score);

  const kept: { sentence: string; index: number }[] = [];
  let count = 0;
  for (const candidate of ranked) {
    const length = candidate.sentence.split(/\s+/).filter(Boolean).length;
    if (count && count + length > words) continue;
    kept.push(candidate);
    count += length;
    if (count >= words) break;
  }
  // Back into reading order — a summary whose sentences are in relevance
  // order reads as three unrelated facts rather than as a scene.
  return kept.sort((a, b) => a.index - b.index).map((k) => k.sentence).join(' ');
}

export function buildSummaryPrompt(scene: Scene, words: SummaryLength): string {
  const prose = fitToBudget(scene.paragraphs.map((p) => p.text).join('\n\n'), SOURCE_CHARS);
  return [
    `Summarise this scene in about ${words} words.`,
    '',
    'RULES:',
    '- Past tense, third person, plain declarative sentences.',
    '- Say what HAPPENS and what CHANGES: decisions, revelations, arrivals, losses.',
    '- Name the characters, places and objects that matter. Use the names in the text.',
    '- No interpretation, no theme, no praise, no "in this scene".',
    '- Your entire reply is the summary itself.',
    '',
    `SCENE${scene.title ? `: ${scene.title}` : ''}`,
    prose.text,
  ].join('\n');
}

/**
 * Summarise a scene — with a model if one is configured, from its own
 * sentences if not.
 *
 * Never a dead button and never a required key: the offline path is always
 * available and always returns something usable, so the control is worth
 * pressing in a project that has never seen an API key.
 */
export async function summarizeScene(
  projectId: string,
  scene: Scene,
  words: SummaryLength = 120,
  opts: { forceLocal?: boolean } = {}
): Promise<SceneSummary> {
  const local = () => ({ text: summarizeSceneLocally(scene, words), source: 'local' as const });
  if (opts.forceLocal) return local();

  const config = await resolveProvider(projectId);
  if (!config) return local();

  try {
    const result = await completeDetailed(config, {
      system: 'You summarise fiction accurately and without embellishment.',
      prompt: buildSummaryPrompt(scene, words),
      temperature: 0,
      maxTokens: Math.max(200, words * 3),
    });
    const text = result.text.trim();
    // An empty or refused reply must not cost the author a summary they
    // could have had for free.
    if (!text) return local();
    return { text, source: 'ai', truncated: result.truncated };
  } catch {
    return local();
  }
}

/**
 * True when the prose moved on after the summary was written.
 *
 * Compared against a timestamp rather than a flag, because there is no
 * moment anything could set a flag at: the prose changes through autosave,
 * a snapshot restore, an import and a beat insertion, and a staleness rule
 * that four writers have to remember to maintain is a rule that will be
 * wrong within a milestone.
 */
export function isSummaryStale(scene: Scene): boolean {
  if (!scene.summary.trim()) return false;
  if (!scene.summaryUpdatedAt) return false;
  // Against `proseUpdatedAt`, never `updatedAt`: the second moves when a
  // label is added or a status flipped, and a summary is not made stale by
  // changing a dropdown. A scene saved before N8 has no prose stamp, and
  // reports fresh rather than guessing.
  return (scene.proseUpdatedAt ?? 0) > scene.summaryUpdatedAt;
}
