import { db } from '@/db/schema';
import { getScene, snapshotScene } from '@/db/repos/scenes';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { completeDetailed } from '@/services/ai/providers';
import { resolveProvider } from '@/services/ai/settings';
import { tierForModel } from '@/services/ai/prompts';
import { buildBeatPrompt, PRECEDING_PROSE_CHARS, type BeatMode } from '@/services/ai/prompts/beat';
import { buildCanonFacts, checkDraftAgainstCanon, type CanonIssue } from '@/services/ai/canon';
import { analyzeStyle } from '@/services/style-analysis';
import { useFocusStore } from '@/stores/focus';

/** How much manuscript to measure the author's voice from — the same
 * budget ComposePanel uses, for the same reason. */
const STYLE_SAMPLE_CHARS = 40_000;

export interface BeatDraft {
  prose: string;
  issues: CanonIssue[];
  truncated: boolean;
}

/** Everything the beat needs to describe itself to a model.
 *
 * Context is assembled here from the scene's own POV/location/characters
 * plus whatever is in cross-panel focus — the same sources ComposePanel
 * uses today. N7 replaces this function's body with
 * `buildSceneContext()`; nothing above it changes. */
async function gatherContext(
  projectId: string,
  sceneId: string
): Promise<{
  scene: { title: string; summary: string; povName: string | null; povType: string | null };
  context: string;
  facts: string[];
  subjects: Entity[];
  world: Entity[];
}> {
  const scene = await getScene(sceneId);
  const world = (await db.entities.where('projectId').equals(projectId).toArray()).filter(
    (e) => e.status === 'active'
  );
  const byId = new Map(world.map((e) => [e.id, e]));

  const ids = new Set<string>();
  if (scene?.pov) ids.add(scene.pov);
  if (scene?.locationId) ids.add(scene.locationId);
  for (const id of scene?.characterIds ?? []) ids.add(id);
  for (const ref of scene?.attachedRefs ?? []) ids.add(ref.id);
  for (const ref of Object.values(useFocusStore.getState().focusedByType)) {
    if (ref) ids.add(ref.id);
  }

  const subjects = [...ids].map((id) => byId.get(id)).filter((e): e is Entity => !!e);

  const context = subjects
    .map((entity) => {
      const bits = [entity.summary].filter(Boolean);
      const persona = typeof entity.fields.personality === 'string' ? entity.fields.personality : '';
      const voice = typeof entity.fields.speechStyle === 'string' ? entity.fields.speechStyle : '';
      if (persona) bits.push(`personality: ${persona}`);
      if (voice) bits.push(`voice: ${voice.split('\n')[0]}`);
      return `- ${ENTITY_TYPE_META[entity.type].label} ${entity.name}${
        bits.length ? ` — ${bits.join('; ')}` : ''
      }`;
    })
    .join('\n');

  return {
    scene: {
      title: scene?.title ?? '',
      summary: scene?.summary ?? '',
      povName: scene?.pov ? (byId.get(scene.pov)?.name ?? null) : null,
      povType: scene?.povType ?? null,
    },
    context,
    facts: buildCanonFacts(subjects, world),
    subjects,
    world,
  };
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
  const gathered = await gatherContext(input.projectId, input.sceneId);

  const manuscript = (await db.chapters.where('projectId').equals(input.projectId).toArray())
    .flatMap((chapter) => chapter.paragraphs.map((p) => p.text))
    .join('\n\n')
    .slice(0, STYLE_SAMPLE_CHARS);

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
