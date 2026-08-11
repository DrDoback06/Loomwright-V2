import type { CandidateInterpretationKind, EntityRef, EntityType, EntityTypeSuggestion } from '@/domain/entity-types';

export interface Project {
  id: string;
  name: string;
  genre?: string;
  createdAt: number;
  updatedAt: number;
}

export type EntityStatus = 'active' | 'archived' | 'merged';

export interface Entity {
  id: string;
  projectId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  summary: string;
  status: EntityStatus;
  tags: string[];
  /** Per-type fields, shape governed by domain/entity-configs. */
  fields: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  /** Set on a source record that has been folded into another canonical entity. */
  mergedIntoId?: string;
  mergedAt?: number;
}

export interface Link {
  id: string;
  projectId: string;
  from: EntityRef;
  to: EntityRef;
  /** e.g. 'related' | field id ('allies') | tangle edge label */
  kind: string;
  note?: string;
  source: 'manual' | 'extraction' | 'merge' | 'import' | 'generate';
  createdAt: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  order: number;
  /** Optional grouping above the chapter. Null means "not in an act",
   * which is the normal state for a book that does not use them. */
  actId?: string | null;
  /** TipTap document JSON.
   *
   * Since v9 this is a DERIVED ROLLUP of the chapter's scenes, kept in
   * step by `chapterRollup()`. Everything downstream — extraction,
   * search, the world bible, the speed reader — still reads a chapter as
   * one document, so none of it had to change when scenes arrived. */
  doc: unknown;
  /** Derived on save; the extraction/occurrence substrate. */
  paragraphs: { id: string; text: string }[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Optional top level of the manuscript. A book can live in one act, or
 * in none at all — acts exist to be a planning axis, never a required
 * step between an author and a blank page. */
export interface Act {
  id: string;
  projectId: string;
  title: string;
  order: number;
  summary: string;
  /** Optional tint, used by the planning views. */
  colour?: string;
  createdAt: number;
  updatedAt: number;
}

export type SceneStatus = 'outline' | 'draft' | 'revised' | 'final';
export type ScenePovType = 'first' | 'third-limited' | 'third-omniscient' | 'second';

/** The unit the whole app turns out to need.
 *
 * A chapter is atomic prose; you cannot put it on a board, colour a grid
 * by it, or measure pacing with it. A scene carries the metadata that
 * makes all of that possible, and holds the TipTap doc that used to live
 * on the chapter. */
export interface Scene {
  id: string;
  projectId: string;
  chapterId: string;
  title: string;
  /** Order within the chapter. */
  order: number;
  /** Order across the whole manuscript — the x-axis of every planning
   * view. Recomputed by `resequenceScenes()` after any structural change,
   * so no view has to walk chapters to work out where a scene sits. */
  globalOrder: number;

  /** TipTap document JSON — the source of truth, moved down from Chapter. */
  doc: unknown;
  /** Derived on save; the extraction substrate (same contract as Chapter). */
  paragraphs: { id: string; text: string }[];
  wordCount: number;

  /* --- planning metadata: the columns every view reads --- */
  /** The long-book memory unit: `storySoFar()` assembles these rather
   * than the prose, which is how continuity survives at 150k words. */
  summary: string;
  summaryUpdatedAt: number;
  status: SceneStatus;
  /** Cast entity id of the POV character. */
  pov: string | null;
  povType: ScenePovType | null;
  /** Entities the author asserts are present. Distinct from extracted
   * mentions on purpose — the Matrix shows both and lets you promote one
   * to the other. */
  characterIds: string[];
  locationId: string | null;
  /** Entries force-included in this scene's AI context (N7). */
  attachedRefs: EntityRef[];
  /** User-defined labels; also the Matrix's colour source. */
  labels: string[];
  targetWords: number | null;
  /** Excludes the scene from every AI context when false. */
  aiVisible: boolean;

  createdAt: number;
  updatedAt: number;
}

/** Prose version history — the thing the app had none of. Overwriting a
 * chapter used to be unrecoverable: the audit log covers entities, and
 * `saveChapterDoc` deliberately writes no entry per keystroke. */
export interface SceneSnapshot {
  id: string;
  projectId: string;
  sceneId: string;
  doc: unknown;
  wordCount: number;
  label: string;
  reason: 'manual' | 'interval' | 'pre-ai' | 'pre-import';
  createdAt: number;
}

export interface ParagraphNote {
  id: string;
  projectId: string;
  chapterId: string;
  paragraphId: string;
  text: string;
  resolved: boolean;
  createdAt: number;
}

export interface Occurrence {
  id: string;
  projectId: string;
  /** null while the mention belongs to a pending discovery candidate;
   * accept backfills it. */
  entityId: string | null;
  entityType: EntityType;
  chapterId: string;
  paragraphId: string | null;
  start: number;
  end: number;
  exactText: string;
  isPronounResolution?: boolean;
  candidateId?: string;
  createdAt: number;
}

export type CandidateStatus = 'pending' | 'accepted' | 'denied' | 'merged';

/** A review-queue row — the persisted form of an ExtractionCandidate. */
export interface ReviewCandidate {
  id: string;
  projectId: string;
  chapterId?: string;
  entityType: EntityType;
  name: string;
  suggestedAction: 'create' | 'update' | 'merge';
  matchType: 'exact' | 'new' | 'ambiguous' | 'nickname' | 'fuzzy';
  existingEntityId?: string | null;
  suggestedChanges?: Record<string, unknown> | null;
  /** 0..1 */
  confidence: number;
  confidenceBand: 'blue' | 'green' | 'orange' | 'red';
  sourceQuote: string;
  sourceQuotes?: string[];
  relatedEntityIds?: string[];
  summary?: string;
  detector?: string;
  typeSuggestions?: EntityTypeSuggestion[];
  interpretation?: { kind: CandidateInterpretationKind; note: string };
  status: CandidateStatus;
  acceptedEntityId?: string;
  source: 'local' | 'ai' | 'handoff';
  createdAt: number;
}


export type IdentityRuleKind = 'same' | 'different';

/** A user-confirmed identity lesson. `same` rules teach extraction that a
 * surface form belongs to a canonical entity; `different` rules stop a
 * rejected pairing from being suggested again. */
export interface IdentityRule {
  id: string;
  projectId: string;
  entityType: EntityType;
  kind: IdentityRuleKind;
  surface: string;
  otherSurface?: string;
  canonicalEntityId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MergeReceipt {
  id: string;
  projectId: string;
  targetEntityId: string;
  targetCreated: boolean;
  targetBefore: Entity | null;
  sourceEntitiesBefore: Entity[];
  affectedEntitiesBefore: Entity[];
  linksBefore: Link[];
  occurrencesBefore: Occurrence[];
  candidatesBefore: ReviewCandidate[];
  /** New same-identity rules created by this merge. */
  identityRuleIds: string[];
  /** Existing mappings displaced by the canonical decision, restored on undo. */
  identityRulesBefore?: IdentityRule[];
  createdAt: number;
  undoneAt?: number;
}

export type AuditActor = 'user' | 'extraction' | 'ai' | 'import';

export interface AuditEntry {
  id: string;
  projectId: string;
  at: number;
  actor: AuditActor;
  /** e.g. 'entity.create', 'entity.update', 'entity.delete' */
  action: string;
  target: { table: string; id: string; label?: string };
  before: unknown | null;
  after: unknown | null;
  reversible: boolean;
}

export interface TrashRow {
  id: string; // same id as the deleted record
  projectId: string;
  table: string;
  label: string;
  payload: unknown;
  deletedAt: number;
}

export interface AtlasPin {
  id: string;
  entity: EntityRef;
  /** Map-space coordinates (0..1000 square). */
  x: number;
  y: number;
}

export interface AtlasMap {
  id: string;
  projectId: string;
  name: string;
  pins: AtlasPin[];
  /** Layer visibility flags. */
  layers: { labels: boolean; travel: boolean; grid: boolean };
  updatedAt: number;
}

export interface GraphNode {
  id: string;
  /** Bound entity (tangle entity cards / skill nodes) or free label. */
  entity?: EntityRef;
  label: string;
  x: number;
  y: number;
  /** skill trees: unlock state */
  unlocked?: boolean;
  /** skill trees: branch/group name — drives node coloring + legend. */
  group?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  directed?: boolean;
}

export interface TangleBoard {
  id: string;
  projectId: string;
  name: string;
  cards: GraphNode[];
  edges: GraphEdge[];
  updatedAt: number;
}

export interface SkillTree {
  id: string;
  projectId: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: number;
}

export interface RandomTableRow {
  text: string;
  /** Relative weight ≥ 1; weighted random pick. */
  weight: number;
}

export interface RandomTable {
  id: string;
  projectId: string;
  name: string;
  /** Suggests the entity type "Create entity" preselects (or 'none'). */
  category: EntityType | 'none';
  rows: RandomTableRow[];
  /** Set when this table started as a copy of a code-level builtin. */
  builtinSource?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EntityTemplate {
  id: string;
  projectId: string;
  kind: 'entity';
  name: string;
  entityType: EntityType;
  summary: string;
  /** Snapshot of entity.fields with identity stripped. */
  fields: Record<string, unknown>;
  createdAt: number;
}

export interface BoardTemplate {
  id: string;
  projectId: string;
  kind: 'board';
  name: string;
  /** Positions normalised so the top-left card sits at the origin. */
  cards: GraphNode[];
  edges: GraphEdge[];
  createdAt: number;
}

export type Template = EntityTemplate | BoardTemplate;

/** Encrypted API-key rows + the non-extractable root CryptoKey
 * ('__root__'). Key material NEVER appears in exports, search, or audit. */
export interface KeyRow {
  provider: string;
  /** AES-GCM ciphertext of the API key (absent on the root row). */
  iv?: number[];
  data?: number[];
  /** Root row only: the non-extractable AES key (structured-cloned). */
  cryptoKey?: CryptoKey;
}

export interface SettingsRow {
  /** `${projectId}:${section}` or `global:${section}` */
  key: string;
  value: unknown;
}

export interface UiStateRow {
  /** `${projectId}:${name}` */
  key: string;
  value: unknown;
}
