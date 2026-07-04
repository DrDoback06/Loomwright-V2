import type { EntityRef, EntityType } from '@/domain/entity-types';

export interface Project {
  id: string;
  name: string;
  genre?: string;
  createdAt: number;
  updatedAt: number;
}

export type EntityStatus = 'active' | 'archived';

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
}

export interface Link {
  id: string;
  projectId: string;
  from: EntityRef;
  to: EntityRef;
  /** e.g. 'related' | field id ('allies') | tangle edge label */
  kind: string;
  note?: string;
  source: 'manual' | 'extraction' | 'merge' | 'import';
  createdAt: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  order: number;
  /** TipTap document JSON — the formatted source of truth. */
  doc: unknown;
  /** Derived on save; the extraction/occurrence substrate. */
  paragraphs: { id: string; text: string }[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
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
  status: CandidateStatus;
  acceptedEntityId?: string;
  source: 'local' | 'ai' | 'handoff';
  createdAt: number;
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
