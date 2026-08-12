import { db } from '@/db/schema';
import { snapshotScene } from '@/db/repos/scenes';
import type { Entity } from '@/db/types';
import { completeDetailed } from '@/services/ai/providers';
import { resolveProvider } from '@/services/ai/settings';
import { tierForModel } from '@/services/ai/prompts';
import {
  buildRewritePrompt,
  countSelectionWords,
  rewriteTarget,
  type RewriteOp,
  type RewriteTweaks,
} from '@/services/ai/prompts/rewrite';
import { checkDraftAgainstCanon, type CanonIssue } from '@/services/ai/canon';
import { analyzeStyle } from '@/services/style-analysis';
import { gatherSceneContext, manuscriptStyleSample } from './ai-context';

export interface RewriteDraft {
  prose: string;
  issues: CanonIssue[];
  truncated: boolean;
  /** Proper nouns present in the original and missing from the rewrite.
   * The one failure this feature has that a beat does not. */
  lostNames: string[];
}

export interface RewriteInput {
  projectId: string;
  sceneId: string;
  selection: string;
  op: RewriteOp;
  tweaks: RewriteTweaks;
  precedingProse: string;
  tier?: 'small' | 'large';
}

/** Build the prompt a rewrite would send — used by the in-app path and the
 * offline copy path alike, so an outside model is asked exactly what ours
 * would have been. */
export async function buildRewriteRequest(
  input: RewriteInput
): Promise<{ system: string; prompt: string; world: Entity[] }> {
  const gathered = await gatherSceneContext(input.projectId, input.sceneId);
  const manuscript = await manuscriptStyleSample(input.projectId);

  const built = buildRewritePrompt({
    selection: input.selection,
    op: input.op,
    tweaks: input.tweaks,
    scene: gathered.scene,
    precedingProse: input.precedingProse.slice(-800),
    context: gathered.context,
    storySoFar: gathered.storySoFar,
    style: manuscript.trim() ? analyzeStyle(manuscript) : null,
    facts: gathered.facts,
    tier: input.tier ?? 'large',
  });

  return { ...built, world: gathered.world };
}

/** Capitalised words that are not sentence-initial: a cheap, offline proxy
 * for "the names in this passage". It over-reports at a sentence start and
 * under-reports a lowercase name — which is why a miss is reported as a
 * warning to read rather than a reason to block the Apply. */
function properNouns(text: string): Set<string> {
  const out = new Set<string>();
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    for (const [index, raw] of words.entries()) {
      const word = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      if (index === 0 || word.length < 3) continue;
      if (/^\p{Lu}/u.test(word)) out.add(word);
    }
  }
  return out;
}

/** Names the original had and the rewrite does not. */
export function lostProperNouns(original: string, rewritten: string): string[] {
  const after = properNouns(rewritten);
  return [...properNouns(original)].filter((name) => !after.has(name));
}

/** Rewrite a selection with the configured provider.
 *
 * Snapshots as `pre-ai` first, after flushing the autosave debounce — the
 * same ordering beats use, and for the same reason: `snapshotScene` reads
 * the row from Dexie, so an unflushed keystroke would be missing from the
 * one snapshot the author would reach for. */
export async function runRewrite(
  input: RewriteInput & { flush: () => Promise<void> }
): Promise<RewriteDraft> {
  const config = await resolveProvider(input.projectId);
  if (!config) throw new Error('No AI provider configured.');

  await input.flush();
  await snapshotScene(input.sceneId, 'pre-ai');

  const { system, prompt, world } = await buildRewriteRequest({
    ...input,
    tier: tierForModel(config),
  });

  const words = countSelectionWords(input.selection);
  const [, high] = rewriteTarget(input.op, words);
  const result = await completeDetailed(config, {
    system,
    prompt,
    // A rewrite is closer to editing than to invention, so it runs cooler
    // than a beat's 0.85 — but not at 0, which produces the same sentence
    // back with two synonyms swapped.
    temperature: 0.6,
    maxTokens: Math.min(2000, Math.max(300, Math.round(high * 2.4))),
  });

  const prose = result.text.trim();
  return {
    prose,
    issues: checkDraftAgainstCanon(prose, world),
    truncated: result.truncated,
    lostNames: lostProperNouns(input.selection, prose),
  };
}

/** Check pasted prose the same way, so a rewrite done on someone else's
 * subscription gets the identical read-back an in-app one does. */
export async function checkPastedRewrite(
  projectId: string,
  original: string,
  prose: string
): Promise<RewriteDraft> {
  const world = (await db.entities.where('projectId').equals(projectId).toArray()).filter(
    (e) => e.status === 'active'
  );
  const text = prose.trim();
  return {
    prose: text,
    issues: checkDraftAgainstCanon(text, world),
    truncated: false,
    lostNames: lostProperNouns(original, text),
  };
}
