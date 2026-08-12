import { db } from '@/db/schema';
import type { ChatContextRef, Scene } from '@/db/types';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { isLiveEntity } from '@/services/extraction/entity-to-known';
import { fitToBudget, TIER_BUDGET, type ModelTier } from '@/services/ai/prompts';
import { buildSceneContext } from './scene-context';
import { entityDigest } from './scene-context';
import { storySoFar } from './story-so-far';
import { pinnedRefs } from './pinned';

/**
 * What a chat thread sends, assembled from the chips the author attached.
 *
 * Deliberately built from the same pieces the Writer's Room uses rather
 * than a second opinion about what matters: `buildSceneContext` for a
 * scene, `storySoFar` for the book behind it, `entityDigest` for a codex
 * entry. A chat that described entities differently from a beat would be
 * two apps sharing a database.
 *
 * Budgeted in characters, like everything else here — there is no tokeniser
 * in this repo, and a made-up token count is a number an author would act
 * on wrongly.
 */
export async function buildChatContext(
  projectId: string,
  refs: readonly ChatContextRef[],
  opts: { tier?: ModelTier } = {}
): Promise<{ text: string; trimmed: boolean }> {
  if (!refs.length) return { text: '', trimmed: false };
  const budget = TIER_BUDGET[opts.tier ?? 'large'].digestChars;

  const scenes = await db.scenes.where('projectId').equals(projectId).toArray();
  const byScene = new Map(scenes.map((s) => [s.id, s]));
  const blocks: string[] = [];

  for (const ref of refs) {
    switch (ref.kind) {
      case 'scene': {
        const scene = byScene.get(ref.id);
        if (!scene) break;
        const ctx = await buildSceneContext(projectId, scene, { pinned: pinnedRefs() });
        const prose = scene.paragraphs.map((p) => p.text).join('\n\n');
        blocks.push(
          [
            `SCENE — ${scene.title || 'Untitled'}`,
            ctx.text,
            prose ? `\nThe prose:\n${prose}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      }
      case 'story-so-far': {
        // Anchored at the thread's scene when it has one, so "the story so
        // far" means what it says rather than the whole book including the
        // ending.
        const anchor = anchorOrder(refs, byScene);
        const text = storySoFar(scenes, anchor);
        if (text) blocks.push(`THE STORY SO FAR:\n${text}`);
        break;
      }
      case 'outline': {
        const outline = scenes
          .filter((s) => s.aiVisible)
          .sort((a, b) => a.globalOrder - b.globalOrder)
          .map((s) => `${s.globalOrder + 1}. ${s.title || 'Untitled'}${s.summary ? ` — ${s.summary}` : ''}`)
          .join('\n');
        if (outline) blocks.push(`THE OUTLINE:\n${outline}`);
        break;
      }
      case 'codex-type': {
        const rows = (
          await db.entities.where('[projectId+type]').equals([projectId, ref.id]).toArray()
        ).filter(isLiveEntity);
        if (!rows.length) break;
        blocks.push(
          `${ENTITY_TYPE_META[ref.id as EntityType].plural.toUpperCase()}:\n${rows
            .map((e) => entityDigest(e, 'lean'))
            .join('\n')}`
        );
        break;
      }
      case 'entity': {
        const entity = await db.entities.get(ref.id);
        if (!entity) break;
        blocks.push(entityDigest(entity, 'full'));
        break;
      }
    }
  }

  const assembled = fitToBudget(blocks.filter(Boolean).join('\n\n'), budget);
  return { text: assembled.text, trimmed: assembled.trimmed };
}

/** Where "so far" stops: the latest scene the thread has attached, or the
 * end of the book if it has attached none. */
function anchorOrder(refs: readonly ChatContextRef[], byScene: Map<string, Scene>): number {
  const orders = refs
    .filter((r) => r.kind === 'scene')
    .map((r) => byScene.get(r.id)?.globalOrder)
    .filter((n): n is number => n !== undefined);
  return orders.length ? Math.max(...orders) : Number.MAX_SAFE_INTEGER;
}

/** One line naming what travelled, stored on the message so an author can
 * always answer "why did it know that". */
export function describeContext(refs: readonly ChatContextRef[]): string {
  return refs.length ? refs.map((r) => r.label).join(' · ') : 'nothing attached';
}
