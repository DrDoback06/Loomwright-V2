import type { EntityRef, EntityType } from '@/domain/entity-types';
import type { GraphEdge, GraphNode } from '@/db/types';

/** How a bundle came to be. Manual creation never produces a bundle —
 * it goes straight through the editor drawer. */
export type GenerationMode = 'random' | 'ai' | 'paste';

export type GenTargetKind =
  | 'entity' // one entity of request.entityType
  | 'entity-batch' // N entities of one type
  | 'skilltree' // tree doc + nodes + edges + backing skill entities
  | 'skilltree-branch' // extend an existing tree (targetGraphId required)
  | 'tangle' // board (or additions to targetGraphId) + optional entities
  | 'relationship-set' // multiple relationship entities among existing cast
  | 'questline' // linked quests + events
  | 'chapter'; // chapter scaffold (+ opt-in prose)

export interface GenerationRequest {
  kind: GenTargetKind;
  entityType?: EntityType;
  /** Theme/pack id, e.g. 'high-fantasy' | 'grimdark' | 'science-fiction'. */
  theme?: string;
  /** Free-text tailoring: "a poison skill tree for my assassin". */
  hint?: string;
  count?: number;
  options?: { branches?: number; includeProse?: boolean; attachNodeId?: string };
  /** skilltree-branch / add-to-board target. */
  targetGraphId?: string;
  /** Existing entities to build around (relationship sets, questline cast). */
  contextRefs?: EntityRef[];
}

/** A not-yet-created entity. `localId` is bundle-scoped and remapped to a
 * real id on accept; related fields may hold EntityRefs whose id is either
 * a real entity id or another draft's localId. */
export interface BundleEntityDraft {
  localId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  summary: string;
  tags: string[];
  /** Editor-shaped values keyed by FieldDef.id (post-coercion). */
  fields: Record<string, unknown>;
  /** Set when the draft name-matched an existing entity — accept merges
   * fields into that row instead of creating a duplicate. */
  existingEntityId?: string;
}

/** A skill tree or tangle board draft. Node ids are bundle-local; edges
 * reference local node ids; node.entity?.id may be a draft localId. */
export interface BundleGraphDraft {
  localId: string;
  kind: 'skilltree' | 'tangle';
  /** Present → append nodes+edges to this existing graph instead of
   * creating a new one. */
  targetGraphId?: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BundleChapterDraft {
  localId: string;
  title: string;
  summary: string;
  /** Beat outline — becomes scaffold paragraphs. */
  beats: string[];
  /** Opt-in generated prose paragraphs (AI / paste modes). */
  prose?: string[];
  linkedEntityLocalIds: string[];
}

/** A link between two drafts (localIds) or existing entities (real ids). */
export interface BundleLinkDraft {
  from: string;
  to: string;
  kind: string;
}

/** The single output currency of Random / AI / Paste generation. Staged
 * in memory (stores/generation) and written to Dexie only on accept. */
export interface GenerationBundle {
  id: string;
  projectId: string;
  request: GenerationRequest;
  mode: GenerationMode;
  /** Random mode: RNG seed for exact reroll reproducibility. */
  seed?: number;
  entities: BundleEntityDraft[];
  graphs: BundleGraphDraft[];
  chapters: BundleChapterDraft[];
  links: BundleLinkDraft[];
  /** Coercion notes: dropped fields, unmatched refs, renames. */
  warnings: string[];
  createdAt: number;
}

/** One-line description of what a bundle contains, for bars and toasts. */
export function bundleTitle(bundle: GenerationBundle): string {
  const named =
    bundle.graphs[0]?.name || bundle.chapters[0]?.title || bundle.entities[0]?.name || 'Untitled';
  const parts: string[] = [];
  if (bundle.entities.length) {
    parts.push(`${bundle.entities.length} ${bundle.entities.length === 1 ? 'entry' : 'entries'}`);
  }
  if (bundle.graphs.length) {
    const trees = bundle.graphs.filter((g) => g.kind === 'skilltree').length;
    const boards = bundle.graphs.length - trees;
    if (trees) parts.push(`${trees} ${trees === 1 ? 'tree' : 'trees'}`);
    if (boards) parts.push(`${boards} ${boards === 1 ? 'board' : 'boards'}`);
  }
  if (bundle.chapters.length) parts.push(`${bundle.chapters.length} chapter${bundle.chapters.length === 1 ? '' : 's'}`);
  if (bundle.links.length) parts.push(`${bundle.links.length} link${bundle.links.length === 1 ? '' : 's'}`);
  return `${named} — ${parts.join(', ')}`;
}

/** True when the bundle needs staged in-surface preview (anything beyond
 * a single plain entity, which flows through the editor drawer instead). */
export function needsStaging(bundle: GenerationBundle): boolean {
  return (
    bundle.graphs.length > 0 ||
    bundle.chapters.length > 0 ||
    bundle.entities.length > 1 ||
    bundle.links.length > 0
  );
}
