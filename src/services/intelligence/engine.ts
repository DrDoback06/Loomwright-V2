import { newId } from '@/lib/id';
import type { Entity, SkillTree } from '@/db/types';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { ExtractionCandidate } from '@/services/extraction/detectors';
import type { KnownEntity } from '@/services/extraction/known-index';
import { isLiveEntity, toKnownEntity } from '@/services/extraction/entity-to-known';
import { chunkText } from '@/services/extraction/text-utils';
import { runPropagation, type RuleContext } from './rules';
import { DEFAULT_VOLUME, type SuggestionVolume } from './suggestions';
import { emptyDelta, type DeltaSource, type StoryDelta } from './types';

export interface BuildDeltaInput {
  projectId: string;
  text: string;
  /** Every live entity in the project — rules read current state from here. */
  entities: Entity[];
  trees: SkillTree[];
  chapterId?: string;
  source?: DeltaSource;
  aggressiveness?: 'gentle' | 'balanced' | 'aggressive';
  confidenceOverrides?: Record<string, number>;
  /** Suggestions volume — quiet / balanced / abundant. */
  volume?: SuggestionVolume;
  /** Reported per chunk so a whole-book paste can show real progress. */
  onProgress?: (done: number, total: number) => void;
}

/** Chapters above this many characters are chunked. Matches the window the
 * legacy engine used, with an overlap wide enough that a detector's ±160-char
 * span never straddles a boundary. */
const CHUNK_SIZE = 5000;
const CHUNK_OVERLAP = 500;

/**
 * Turn prose into a StoryDelta — the one engine behind every input.
 *
 * Whether the text came from the Writer's Room, a pasted chapter, or a whole
 * book, this is the path: extract → propagate → group. Entirely offline and
 * deterministic; AI enrichment layers on top of the result, never underneath.
 */
export function buildStoryDelta(input: BuildDeltaInput): StoryDelta {
  const {
    projectId,
    text,
    entities,
    trees,
    chapterId,
    source = 'local',
    aggressiveness,
    confidenceOverrides,
    volume = DEFAULT_VOLUME,
    onProgress,
  } = input;

  // Was hand-rolled, and read `fields.statPhrases` — a key the stats config
  // has never written. Whole-book intake had therefore never seen an
  // author-defined phrase rule.
  const known: KnownEntity[] = entities.filter(isLiveEntity).map((e) => toKnownEntity(e));

  // Whole-book intake: chunk, extract per chunk, then merge. Offsets are
  // rebased so quotes and spans stay meaningful in the merged result.
  const chunks = text.length > CHUNK_SIZE ? chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP) : [{ text, start: 0 }];
  const candidates: ExtractionCandidate[] = [];
  chunks.forEach((chunk, i) => {
    const { candidates: found } = runLocalExtraction({
      text: chunk.text,
      entities: known,
      aggressiveness,
      confidenceOverrides,
    });
    for (const c of found) {
      candidates.push({
        ...c,
        start: c.start != null ? c.start + chunk.start : undefined,
        end: c.end != null ? c.end + chunk.start : undefined,
      });
    }
    onProgress?.(i + 1, chunks.length);
  });

  const deduped = dedupeAcrossChunks(candidates);

  const ctx: RuleContext = {
    projectId,
    entities,
    trees,
    volume,
    newUnitId: () => newId(),
    newLocalId: () => newId(),
  };
  const propagated = runPropagation(deduped, ctx);

  const delta: StoryDelta = {
    ...emptyDelta(newId(), projectId, source, chapterId),
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
  return delta;
}

/**
 * Overlapping chunks re-detect the same event at the seam. Collapse by the
 * signal's identity rather than the candidate's name, because the same event
 * can surface under slightly different surface forms on either side of a cut.
 */
function dedupeAcrossChunks(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  const seen = new Map<string, ExtractionCandidate>();
  const out: ExtractionCandidate[] = [];
  for (const c of candidates) {
    if (!c.signal) {
      out.push(c);
      continue;
    }
    const key = signalKey(c);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
      out.push(c);
      continue;
    }
    if (c.confidence > existing.confidence) {
      out[out.indexOf(existing)] = c;
      seen.set(key, c);
    }
  }
  return out;
}

function signalKey(c: ExtractionCandidate): string {
  const s = c.signal!;
  switch (s.kind) {
    case 'item-transfer':
      return `item-transfer|${s.itemId}|${s.fromId ?? ''}|${s.toId ?? ''}`;
    case 'item-loss':
      return `item-loss|${s.itemId}|${s.destroyed}`;
    case 'travel':
      return `travel|${s.actorId}|${s.placeId ?? s.placeName.toLowerCase()}`;
    case 'skill-learned':
      return `skill-learned|${s.actorId ?? ''}|${s.skillId ?? s.skillName.toLowerCase()}`;
    case 'relationship':
      return `relationship|${s.fromId}|${s.toId}|${s.bond}`;
    case 'quest-progress':
      return `quest-progress|${s.questId ?? s.questName.toLowerCase()}|${s.phase}|${s.step ?? ''}`;
  }
}
