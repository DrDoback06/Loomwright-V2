import { db } from '@/db/schema';
import type { Chapter, Entity, SkillTree } from '@/db/types';
import { buildStoryDelta } from './engine';
import type { DeltaSource, StoryDelta } from './types';

/** Join a chapter's paragraphs the same way the extraction session does, so
 * detector windows never straddle a paragraph join. */
export function chapterText(chapter: Chapter): string {
  return chapter.paragraphs.map((p) => p.text).join('\n\n');
}

async function loadWorld(projectId: string): Promise<{ entities: Entity[]; trees: SkillTree[] }> {
  const [entities, trees] = await Promise.all([
    db.entities.where('projectId').equals(projectId).toArray(),
    db.skillTrees.where('projectId').equals(projectId).toArray(),
  ]);
  return {
    // Merged-away rows would resolve to stale targets; skip them.
    entities: entities.filter((e) => e.status !== 'deleted' && !e.mergedIntoId),
    trees,
  };
}

/**
 * Turn one chapter into a StoryDelta. This is the Writer's Room's
 * "Save & Extract" path — identical to what a paste produces, because the
 * product promise is one engine behind every input.
 */
export async function extractChapterToDelta(
  chapter: Chapter,
  onProgress?: (done: number, total: number) => void
): Promise<StoryDelta> {
  const { entities, trees } = await loadWorld(chapter.projectId);
  return buildStoryDelta({
    projectId: chapter.projectId,
    text: chapterText(chapter),
    entities,
    trees,
    chapterId: chapter.id,
    source: 'local',
    onProgress,
  });
}

/**
 * Turn pasted text — up to a whole book — into one merged StoryDelta.
 * Chunking, cross-chunk dedupe and progress live in the engine, so this is
 * just the world-loading wrapper.
 */
export async function extractTextToDelta(
  projectId: string,
  text: string,
  options: { source?: DeltaSource; onProgress?: (done: number, total: number) => void } = {}
): Promise<StoryDelta> {
  const { entities, trees } = await loadWorld(projectId);
  return buildStoryDelta({
    projectId,
    text,
    entities,
    trees,
    source: options.source ?? 'local',
    onProgress: options.onProgress,
  });
}
