import { db } from '@/db/schema';
import { snapshotScene } from '@/db/repos/scenes';
import type { Entity } from '@/db/types';
import { completeDetailed } from '@/services/ai/providers';
import { resolveProvider } from '@/services/ai/settings';
import { tierForModel } from '@/services/ai/prompts';
import { buildBeatPrompt, PRECEDING_PROSE_CHARS, type BeatMode } from '@/services/ai/prompts/beat';
import { checkDraftAgainstCanon, type CanonIssue } from '@/services/ai/canon';
import { analyzeStyle } from '@/services/style-analysis';
import { gatherSceneContext, manuscriptStyleSample } from './ai-context';

export interface BeatDraft {
  prose: string;
  issues: CanonIssue[];
  truncated: boolean;
}

/** Build the prompt a beat would send. Used by both the in-app path and
 * the offline copy-to-clipboard path, so what an external model is asked
 * is exactly what ours would have been asked. */
export async function buildBeatRequest(input: {
  projectId: string;
  sceneId: string;
  beat: string;
  mode: BeatMode;
  targetWords: number;
  precedingProse: string;
  tier?: 'small' | 'large';
}): Promise<{ system: string; prompt: string; world: Entity[] }> {
  const gathered = await gatherSceneContext(input.projectId, input.sceneId);
  const manuscript = await manuscriptStyleSample(input.projectId);

  const built = buildBeatPrompt({
    beat: input.beat,
    mode: input.mode,
    targetWords: input.targetWords,
    scene: gathered.scene,
    precedingProse: input.precedingProse.slice(-PRECEDING_PROSE_CHARS),
    context: gathered.context,
    style: manuscript.trim() ? analyzeStyle(manuscript) : null,
    facts: gathered.facts,
    tier: input.tier ?? 'large',
  });

  return { ...built, world: gathered.world };
}

/** Expand a beat with the configured provider.
 *
 * Snapshots the scene as `pre-ai` FIRST — that snapshot is never pruned,
 * so however badly a generation goes the author can get their page back
 * from the Scene panel. Then reads the draft back with the same offline
 * engine that reads the manuscript, before anyone is offered an Apply
 * button. */
export async function expandBeat(input: {
  projectId: string;
  sceneId: string;
  beat: string;
  mode: BeatMode;
  targetWords: number;
  precedingProse: string;
  /** Writes anything sitting in the autosave debounce before we snapshot. */
  flush: () => Promise<void>;
}): Promise<BeatDraft> {
  const config = await resolveProvider(input.projectId);
  if (!config) throw new Error('No AI provider configured.');

  // Order matters more than it looks. `snapshotScene` reads `scene.doc`
  // from Dexie, so without flushing first the "Before AI wrote" snapshot
  // silently omits whatever was typed inside the 600ms debounce window —
  // and restoring it would then eat those words. Flush, then snapshot.
  await input.flush();
  await snapshotScene(input.sceneId, 'pre-ai');

  const { system, prompt, world } = await buildBeatRequest({
    ...input,
    tier: tierForModel(config),
  });

  const result = await completeDetailed(config, {
    system,
    prompt,
    // Prose is the one place a high temperature is right; everything else
    // in this app runs at 0.
    temperature: 0.85,
    maxTokens: Math.min(2000, Math.max(600, Math.round(input.targetWords * 2.2))),
  });

  const prose = result.text.trim();
  return {
    prose,
    issues: checkDraftAgainstCanon(prose, world),
    // `complete()` cannot tell you this, which is why beats use
    // `completeDetailed`: a beat cut off mid-sentence is common on small
    // models and must never be inserted as though it were finished.
    truncated: result.truncated,
  };
}

/** The offline path: check a pasted reply the same way, so a beat written
 * on someone else's ChatGPT subscription gets the identical canon read-back
 * that an in-app one does. */
export async function checkPastedBeat(projectId: string, prose: string): Promise<CanonIssue[]> {
  const world = (await db.entities.where('projectId').equals(projectId).toArray()).filter(
    (e) => e.status === 'active'
  );
  return checkDraftAgainstCanon(prose.trim(), world);
}

/** Split generated prose into paragraph nodes the editor can insert. */
export function proseToParagraphs(prose: string) {
  return prose
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }));
}
