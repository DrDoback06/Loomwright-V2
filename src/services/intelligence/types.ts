import type { EntityRef, EntityType } from '@/domain/entity-types';
import type { GraphEdge, GraphNode } from '@/db/types';
import type { ConfidenceBand } from '@/services/extraction/text-utils';
import type {
  BundleChapterDraft,
  BundleEntityDraft,
  BundleLinkDraft,
  GenerationBundle,
} from '@/services/generate/types';

/** Where a delta came from. `local` is the always-available offline engine;
 * `handoff` is a mega-prompt reply pasted back; `ai` is an in-app BYOK call. */
export type DeltaSource = 'local' | 'ai' | 'handoff';

/** Every addressable thing in a delta carries a `unitId`. Groups reference
 * units, and accept takes the set of enabled unitIds — so a per-group toggle
 * on the board maps to exactly one filter at apply time. */
export interface DeltaUnit {
  unitId: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** The sentence window that justifies this unit — always shown on the board. */
  sourceQuote: string;
  /** Detector or rule that produced it, e.g. 'itemTransfer' | 'skill-learned'. */
  origin: string;
}

/** A brand-new entity the delta wants to create (or merge into an existing
 * row when `existingEntityId` is set). Same draft shape generation uses, so
 * coerce/spec/pack machinery applies unchanged. */
export interface DeltaEntityCreate extends DeltaUnit {
  draft: BundleEntityDraft;
}

/** How a patch combines with the value already on the entity. */
export type PatchMode =
  /** Overwrite — ownership flips, current location, status. */
  | 'replace'
  /** Append to an array field without duplicating — history, inventory, skills. */
  | 'append'
  /** Drop a member from an array field. Without this, an item that changes
   * hands is added to the receiver's inventory and never taken out of the
   * giver's, so after three chapters everyone owns everything. */
  | 'remove';

/** A field-level change to an EXISTING entity, with the before/after the
 * board renders as an explicit diff. This is the piece `applyBundle` never
 * had: generation only ever merged whole field bags. */
export interface DeltaPatch extends DeltaUnit {
  /** Real entity id, or a `localId` of a draft created by this same delta. */
  entityId: string;
  entityType: EntityType;
  /** For board headlines when the entity row isn't loaded. */
  entityName: string;
  /** Field id from the type's entity-config. Validated at build time. */
  fieldId: string;
  fieldLabel: string;
  before: unknown;
  after: unknown;
  mode: PatchMode;
  /** Set when recorded state disagrees with what the prose implies — the
   * board flags these and offers a one-click correction picker. Accept-all
   * still works: we take the best guess and mark it. */
  conflict?: DeltaConflict;
}

export interface DeltaConflict {
  reason: string;
  /** What the entity currently says. */
  recorded: unknown;
  /** What the prose implied it should have been. */
  expected: unknown;
  /** Candidate corrections for the picker, best first. */
  options: { label: string; value: unknown }[];
}

/** Place a skill (or any entity) onto an existing skill tree / tangle board.
 * `node.x/y` is always computed by layout.ts — never by a model. */
export interface DeltaGraphPlacement extends DeltaUnit {
  graphId: string;
  graphKind: 'skilltree' | 'tangle';
  graphName: string;
  node: GraphNode;
  /** Edges from existing node ids (or this delta's node id) to the new node. */
  edges: GraphEdge[];
  /** Branch/group the node joins, for the headline: "Serpent Path ▸ Toxins". */
  group?: string;
}

/** Nest a location under a parent. Separate from DeltaPatch because an
 * unresolved parent needs a picker rather than a diff. */
export interface DeltaHierarchyPlacement extends DeltaUnit {
  /** Real id or a localId from this delta. */
  childId: string;
  childName: string;
  /** Null when the prose named a parent we could not resolve — the board
   * shows a picker seeded with `unresolvedParentName`. */
  parentId: string | null;
  parentName: string;
  unresolvedParentName?: string;
}

export interface DeltaLink extends DeltaUnit {
  link: BundleLinkDraft;
  /** Human phrasing for the board: "Vex ▸ ally ▸ Marrow". */
  label: string;
}

export interface DeltaChapter extends DeltaUnit {
  draft: BundleChapterDraft;
}

/** What a suggestion, once accepted, actually does. Every suggestion is a
 * finished artifact — a co-DM handing you a card, never an open question. */
export type SuggestionKind =
  | 'skill-sibling' // another skill on the same branch
  | 'skill-next-tier' // the upgrade this skill grows into
  | 'quest-outcome' // how an advanced quest could resolve
  | 'story-arc' // an arc candidate from the relationship web
  | 'relationship' // a bond the web implies but nobody recorded
  | 'item-synergy' // an item that pairs with a new skill
  | 'cast-candidate'; // another character who could learn this

export interface SuggestionRecord {
  id: string;
  projectId: string;
  kind: SuggestionKind;
  /** Entity this suggestion hangs off — dossier chips read this. */
  targetRef: EntityRef | null;
  /** Flattened `targetRef.id` so Dexie can index it; '' when unattached. */
  targetEntityId: string;
  /** Ready-to-read card title, e.g. 'Venom Strike II'. */
  title: string;
  /** One concrete sentence. Never a question. */
  body: string;
  /** The delta accepting this suggestion stages. Serialisable. */
  payload: StoryDeltaPayload | null;
  source: DeltaSource;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: number;
}

/** A suggestion as it appears on the board, before it is persisted. */
export interface DeltaSuggestion extends DeltaUnit {
  kind: SuggestionKind;
  targetRef: EntityRef | null;
  title: string;
  body: string;
  payload: StoryDeltaPayload | null;
}

/** One cascade on the review board: a subject and everything that follows
 * from it. "Vex learned Venom Strike → +skill → Serpent Path ▸ Toxins →
 * 2 sibling suggestions" is one group. */
export interface DeltaGroup {
  id: string;
  /** The entity the cascade is about. `id` is a real id or a delta localId. */
  subject: { id: string; type: EntityType; name: string };
  /** Board headline, already phrased for a human. */
  headline: string;
  /** Every unit in this cascade, in the order they should render. */
  unitIds: string[];
  /** Lowest confidence in the group — drives the group's band. */
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** True when any member unit carries a conflict. */
  flagged: boolean;
}

/** The output currency of Extraction 2.0 — a superset of GenerationBundle.
 * Random / AI / Paste produce bundles; extraction, the mega-prompt round-trip
 * and Save & Extract all produce one of these. */
export interface StoryDelta {
  id: string;
  projectId: string;
  source: DeltaSource;
  /** Chapter this delta was extracted from, when it came from one. */
  chapterId?: string;
  entities: DeltaEntityCreate[];
  patches: DeltaPatch[];
  graphPlacements: DeltaGraphPlacement[];
  hierarchyPlacements: DeltaHierarchyPlacement[];
  links: DeltaLink[];
  chapters: DeltaChapter[];
  suggestions: DeltaSuggestion[];
  /** Cascades for the board. Every unit belongs to exactly one group. */
  groups: DeltaGroup[];
  /** Coercion + resolution notes surfaced in the board's warnings drawer. */
  warnings: string[];
  createdAt: number;
}

/** A delta stripped to what a suggestion payload needs to carry (no ids that
 * would go stale, no groups — those are rebuilt when it is staged). */
export type StoryDeltaPayload = Pick<
  StoryDelta,
  'entities' | 'patches' | 'graphPlacements' | 'hierarchyPlacements' | 'links'
>;

export function emptyDelta(
  id: string,
  projectId: string,
  source: DeltaSource,
  chapterId?: string
): StoryDelta {
  return {
    id,
    projectId,
    source,
    chapterId,
    entities: [],
    patches: [],
    graphPlacements: [],
    hierarchyPlacements: [],
    links: [],
    chapters: [],
    suggestions: [],
    groups: [],
    warnings: [],
    createdAt: 0,
  };
}

/** Every addressable unit in a delta, flattened — used by grouping, accept
 * filtering, and the board's toggle bookkeeping. */
export function deltaUnits(delta: StoryDelta): DeltaUnit[] {
  return [
    ...delta.entities,
    ...delta.patches,
    ...delta.graphPlacements,
    ...delta.hierarchyPlacements,
    ...delta.links,
    ...delta.chapters,
    ...delta.suggestions,
  ];
}

export function isDeltaEmpty(delta: StoryDelta): boolean {
  return deltaUnits(delta).length === 0;
}

/** The delta narrowed to a set of enabled units. Used so status messages
 * describe what will actually be applied rather than everything that was
 * found — a toast that overstates the change is a lying status. */
export function filterDelta(delta: StoryDelta, enabled: Set<string>): StoryDelta {
  const on = <T extends { unitId: string }>(u: T) => enabled.has(u.unitId);
  return {
    ...delta,
    entities: delta.entities.filter(on),
    patches: delta.patches.filter(on),
    graphPlacements: delta.graphPlacements.filter(on),
    hierarchyPlacements: delta.hierarchyPlacements.filter(on),
    links: delta.links.filter(on),
    chapters: delta.chapters.filter(on),
    suggestions: delta.suggestions.filter(on),
    groups: delta.groups
      .map((g) => ({ ...g, unitIds: g.unitIds.filter((id) => enabled.has(id)) }))
      .filter((g) => g.unitIds.length > 0),
  };
}

/** One-line summary for toasts and the accept bar. */
export function deltaTitle(delta: StoryDelta): string {
  const parts: string[] = [];
  const n = (count: number, one: string, many = `${one}s`) =>
    `${count} ${count === 1 ? one : many}`;
  if (delta.entities.length) parts.push(n(delta.entities.length, 'new entry', 'new entries'));
  if (delta.patches.length) parts.push(n(delta.patches.length, 'update'));
  if (delta.graphPlacements.length) parts.push(n(delta.graphPlacements.length, 'placement'));
  if (delta.hierarchyPlacements.length) parts.push(n(delta.hierarchyPlacements.length, 'nesting'));
  if (delta.links.length) parts.push(n(delta.links.length, 'link'));
  if (delta.chapters.length) parts.push(n(delta.chapters.length, 'chapter'));
  if (delta.suggestions.length) parts.push(n(delta.suggestions.length, 'suggestion'));
  return parts.length ? parts.join(', ') : 'nothing to apply';
}

/** Adapt a generation bundle into a delta so the cascade board can preview
 * generated content too — one board, every input. */
export function deltaFromBundle(
  bundle: GenerationBundle,
  makeUnitId: () => string
): StoryDelta {
  const unit = (confidence: number, origin: string): Omit<DeltaUnit, 'confidenceBand'> & {
    confidenceBand: ConfidenceBand;
  } => ({
    unitId: makeUnitId(),
    confidence,
    confidenceBand: confidence >= 0.85 ? 'blue' : confidence >= 0.7 ? 'green' : 'orange',
    sourceQuote: '',
    origin,
  });
  return {
    id: bundle.id,
    projectId: bundle.projectId,
    source: bundle.mode === 'random' ? 'local' : bundle.mode === 'ai' ? 'ai' : 'handoff',
    entities: bundle.entities.map((draft) => ({ ...unit(0.9, `generate:${bundle.mode}`), draft })),
    patches: [],
    graphPlacements: [],
    hierarchyPlacements: [],
    links: bundle.links.map((link) => ({
      ...unit(0.9, `generate:${bundle.mode}`),
      link,
      label: `${link.from} ▸ ${link.kind} ▸ ${link.to}`,
    })),
    chapters: bundle.chapters.map((draft) => ({ ...unit(0.9, `generate:${bundle.mode}`), draft })),
    suggestions: [],
    groups: [],
    warnings: bundle.warnings,
    createdAt: bundle.createdAt,
  };
}
