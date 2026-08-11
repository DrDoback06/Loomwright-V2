import { db } from '@/db/schema';
import { getScene } from '@/db/repos/scenes';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { buildCanonFacts } from '@/services/ai/canon';
import { useFocusStore } from '@/stores/focus';

/** How much manuscript to measure the author's voice from — the same
 * budget ComposePanel uses, for the same reason. */
export const STYLE_SAMPLE_CHARS = 40_000;

export interface SceneAiContext {
  scene: { title: string; summary: string; povName: string | null; povType: string | null };
  context: string;
  facts: string[];
  subjects: Entity[];
  world: Entity[];
}

/** Everything an in-editor AI action needs to describe this scene to a
 * model: who is in it, what is true of them, and how the author writes.
 *
 * Assembled from the scene's own POV / location / characters / attached
 * refs plus whatever is in cross-panel focus — the same sources
 * ComposePanel uses. **N7 replaces this function's body with
 * `buildSceneContext()`**; beats and the rewrite bubble both call it, so
 * that is one edit rather than two. */
export async function gatherSceneContext(
  projectId: string,
  sceneId: string
): Promise<SceneAiContext> {
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

/** The author's own pages, for `analyzeStyle`.
 *
 * Reads `chapter.paragraphs`, which since N5b deliberately omits scenes and
 * sections the author has hidden from models — measuring a voice off
 * bracketed notes to self would poison the profile as surely as sending
 * them would. */
export async function manuscriptStyleSample(projectId: string): Promise<string> {
  const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
  return chapters
    .flatMap((chapter) => chapter.paragraphs.map((p) => p.text))
    .join('\n\n')
    .slice(0, STYLE_SAMPLE_CHARS);
}
