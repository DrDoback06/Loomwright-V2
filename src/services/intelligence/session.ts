import { db } from '@/db/schema';
import type { Chapter, Entity, SkillTree } from '@/db/types';
import { newId } from '@/lib/id';
import type { ExtractionCandidate } from '@/services/extraction/detectors';
import { runPropagation, type RuleContext } from './rules';
import { emptyDelta } from './types';
import { buildStoryDelta } from './engine';
import { DEFAULT_VOLUME, type SuggestionVolume } from './suggestions';
import type { DeltaSource, StoryDelta } from './types';

/** Join a chapter's paragraphs the same way the extraction session does, so
 * detector windows never straddle a paragraph join. */
export function chapterText(chapter: Chapter): string {
  return chapter.paragraphs.map((p) => p.text).join('\n\n');
}

interface World {
  entities: Entity[];
  trees: SkillTree[];
  volume: SuggestionVolume;
  confidenceOverrides: Record<string, number>;
}

async function loadWorld(projectId: string): Promise<World> {
  const [entities, trees, settings] = await Promise.all([
    db.entities.where('projectId').equals(projectId).toArray(),
    db.skillTrees.where('projectId').equals(projectId).toArray(),
    db.settings.get(`${projectId}:extraction`),
  ]);
  const tuning = (settings?.value ?? {}) as {
    suggestionVolume?: SuggestionVolume;
    detectorConfidence?: Record<string, number>;
  };
  return {
    // Merged-away rows would resolve to stale targets; skip them.
    entities: entities.filter((e) => e.status !== 'merged' && !e.mergedIntoId),
    trees,
    volume: tuning.suggestionVolume ?? DEFAULT_VOLUME,
    confidenceOverrides: tuning.detectorConfidence ?? {},
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
  const { entities, trees, volume, confidenceOverrides } = await loadWorld(chapter.projectId);
  return buildStoryDelta({
    projectId: chapter.projectId,
    text: chapterText(chapter),
    entities,
    trees,
    volume,
    confidenceOverrides,
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
  const { entities, trees, volume, confidenceOverrides } = await loadWorld(projectId);
  return buildStoryDelta({
    projectId,
    text,
    entities,
    trees,
    volume,
    confidenceOverrides,
    source: options.source ?? 'local',
    onProgress: options.onProgress,
  });
}


/**
 * Build a delta from candidates an extraction pass ALREADY produced.
 *
 * Save & Extract used to run the whole offline scan twice — once through
 * extractChapter to persist occurrences and candidates, then again through
 * buildStoryDelta to propagate. Both passes are synchronous and identical, so
 * on a novel-length chapter against a large codex that was seconds of frozen
 * UI for no extra information. The scan happens once now and both halves read
 * its output.
 */
export async function deltaFromCandidates(
  projectId: string,
  candidates: ExtractionCandidate[],
  chapterId?: string,
  sceneId?: string
): Promise<StoryDelta> {
  const { entities, trees, volume } = await loadWorld(projectId);
  const ctx: RuleContext = {
    projectId,
    entities,
    trees,
    volume,
    newUnitId: () => newId(),
    newLocalId: () => newId(),
  };
  const propagated = runPropagation(candidates, ctx);
  return {
    ...emptyDelta(newId(), projectId, 'local', chapterId, sceneId),
    entities: propagated.entities,
    patches: propagated.patches,
    graphPlacements: propagated.graphPlacements,
    hierarchyPlacements: propagated.hierarchyPlacements,
    links: propagated.links,
    suggestions: propagated.suggestions,
    groups: propagated.groups,
    warnings: propagated.warnings,
    createdAt: Date.now(),
  };
}
