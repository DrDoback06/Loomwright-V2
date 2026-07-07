import type { EntityRef } from '@/domain/entity-types';
import type {
  BundleChapterDraft,
  BundleEntityDraft,
  BundleGraphDraft,
  BundleLinkDraft,
  EntityFieldPatch,
} from '@/services/generate/types';

export type { EntityFieldPatch };

export type DeltaSource = 'local' | 'ai' | 'handoff';

/** A forward-thinking, ready-to-accept suggestion — a finished artifact
 * (a sibling skill, a story arc, a quest outcome), not an open question.
 * `payload` is a StoryDelta staged when the suggestion is accepted. */
export interface SuggestionDraft {
  /** The entity this is about (dossier chips render for their entity). */
  targetRef?: EntityRef;
  kind: string;
  title: string;
  detail?: string;
  payload?: StoryDelta;
  source: DeltaSource;
  confidence: number;
}

/** The output currency of Story Intelligence — a superset of a
 * GenerationBundle. Beyond entity **creates** it carries field **patches**
 * to existing entities (ownership handed over, current location moved,
 * history appended), graph/hierarchy placements, links, and forward-looking
 * suggestions. Accepting a delta applies its FACTS (creates + patches +
 * graphs + chapters + links) as one transaction with one Undo; suggestions
 * ride their own inbox lane. */
export interface StoryDelta {
  id: string;
  projectId: string;
  source: DeltaSource;
  entities: BundleEntityDraft[];
  patches: EntityFieldPatch[];
  graphs: BundleGraphDraft[];
  chapters: BundleChapterDraft[];
  links: BundleLinkDraft[];
  suggestions: SuggestionDraft[];
  warnings: string[];
  createdAt: number;
}

/** A fresh, empty delta to accumulate propagation results into. */
export function emptyDelta(
  id: string,
  projectId: string,
  source: DeltaSource,
  createdAt: number
): StoryDelta {
  return {
    id,
    projectId,
    source,
    entities: [],
    patches: [],
    graphs: [],
    chapters: [],
    links: [],
    suggestions: [],
    warnings: [],
    createdAt,
  };
}

/** True when a delta has any facts worth accepting (suggestions alone don't
 * count — those go straight to the inbox). */
export function deltaHasFacts(delta: StoryDelta): boolean {
  return (
    delta.entities.length > 0 ||
    delta.patches.length > 0 ||
    delta.graphs.length > 0 ||
    delta.chapters.length > 0 ||
    delta.links.length > 0
  );
}
