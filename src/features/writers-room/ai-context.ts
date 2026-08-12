import { db } from '@/db/schema';
import { getScene } from '@/db/repos/scenes';
import type { Entity } from '@/db/types';
import { buildCanonFacts } from '@/services/ai/canon';
import { buildSceneContext } from '@/services/context/scene-context';
import { pinnedRefs } from '@/services/context/pinned';
import { storySoFar } from '@/services/context/story-so-far';

/** How much manuscript to measure the author's voice from — the same
 * budget ComposePanel uses, for the same reason. */
export const STYLE_SAMPLE_CHARS = 40_000;

export interface SceneAiContext {
  scene: { title: string; summary: string; povName: string | null; povType: string | null };
  context: string;
  /** Ordered summaries of every prior scene — long-book memory, assembled
   * by `storySoFar()`. Empty until the author has summarised something,
   * which is why nothing depends on it. */
  storySoFar: string;
  facts: string[];
  subjects: Entity[];
  world: Entity[];
}

/** Everything an in-editor AI action needs to describe this scene to a
 * model: who is in it, what is true of them, and how the author writes.
 *
 * **The body is now `buildSceneContext()`** — the promise this docblock has
 * carried since N5a. The return shape is unchanged on purpose: beats
 * (`useBeatExpansion`) and the rewrite bubble (`useRewrite`) read `.scene`,
 * `.context`, `.facts` and `.world`, so both converted without an edit, and
 * their specs staying green is the proof.
 *
 * `context` is now byte-identical to what the context rail's Preview shows,
 * because both come from the same call with the same inputs. That is the
 * point: a Preview that could differ from the payload would be worse than
 * no Preview at all. */
export async function gatherSceneContext(
  projectId: string,
  sceneId: string
): Promise<SceneAiContext> {
  const scene = await getScene(sceneId);
  const world = (await db.entities.where('projectId').equals(projectId).toArray()).filter(
    (e) => e.status === 'active'
  );
  const byId = new Map(world.map((e) => [e.id, e]));

  if (!scene) {
    return {
      scene: { title: '', summary: '', povName: null, povType: null },
      context: '',
      storySoFar: '',
      facts: [],
      subjects: [],
      world,
    };
  }

  const ctx = await buildSceneContext(projectId, scene, { pinned: pinnedRefs() });
  const scenes = await db.scenes.where('projectId').equals(projectId).toArray();

  // `subjects` feeds `buildCanonFacts`, which answers "what is true" rather
  // than "who is here". Anything the assembler excluded is not in the
  // prompt, so asserting canon about it would describe a cast the model was
  // never shown.
  const subjects = ctx.items
    .filter((item) => item.lane !== 'excluded')
    .map((item) => byId.get(item.ref.id))
    .filter((e): e is Entity => !!e);

  return {
    scene: {
      title: scene.title,
      summary: scene.summary,
      povName: scene.pov ? (byId.get(scene.pov)?.name ?? null) : null,
      povType: scene.povType,
    },
    context: ctx.text,
    storySoFar: storySoFar(scenes, scene.globalOrder),
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
