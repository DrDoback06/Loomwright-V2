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
  entityId: string;
  chapterId: string;
  paragraphId: string;
  start: number;
  end: number;
  exactText: string;
  detector: string;
  createdAt: number;
}

export type CandidateKind =
  | 'new-entity'
  | 'alias'
  | 'field-change'
  | 'relationship'
  | 'stat-change'
  | 'quest-progress'
  | 'event';

export type CandidateStatus = 'pending' | 'accepted' | 'denied' | 'merged';

export interface CandidateEvidence {
  chapterId: string;
  paragraphId: string;
  excerpt: string;
  start: number;
  end: number;
}

export interface ReviewCandidate {
  id: string;
  projectId: string;
  kind: CandidateKind;
  entityType: EntityType;
  proposed: { name: string } & Record<string, unknown>;
  evidence: CandidateEvidence[];
  /** 0..1 */
  confidence: number;
  status: CandidateStatus;
  mergedIntoId?: string;
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
