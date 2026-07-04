import Dexie, { type EntityTable } from 'dexie';
import type {
  AtlasMap,
  AuditEntry,
  SkillTree,
  TangleBoard,
  Chapter,
  Entity,
  Link,
  Occurrence,
  ParagraphNote,
  Project,
  ReviewCandidate,
  SettingsRow,
  TrashRow,
  UiStateRow,
} from './types';

/** The single Loomwright database. Every domain table is project-scoped
 * via a `projectId` column + compound indexes. Version bumps must be
 * additive — the schema is designed complete up front so milestones
 * never force a reset. */
export class LoomwrightDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  entities!: EntityTable<Entity, 'id'>;
  links!: EntityTable<Link, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  notes!: EntityTable<ParagraphNote, 'id'>;
  occurrences!: EntityTable<Occurrence, 'id'>;
  candidates!: EntityTable<ReviewCandidate, 'id'>;
  auditLog!: EntityTable<AuditEntry, 'id'>;
  trash!: EntityTable<TrashRow, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;
  uiState!: EntityTable<UiStateRow, 'key'>;
  atlasMaps!: EntityTable<AtlasMap, 'id'>;
  skillTrees!: EntityTable<SkillTree, 'id'>;
  tangleBoards!: EntityTable<TangleBoard, 'id'>;
  // Domain-doc tables (atlas maps, skill trees, tangle boards, templates,
  // random tables, timeline snapshots) join in their milestones via
  // additive version() bumps.

  constructor() {
    super('loomwright');
    this.version(1).stores({
      projects: 'id, updatedAt',
      entities: 'id, projectId, [projectId+type], [projectId+status], [projectId+name]',
      links: 'id, projectId, [projectId+kind]',
      chapters: 'id, projectId, [projectId+order]',
      notes: 'id, projectId, [projectId+chapterId]',
      occurrences: 'id, projectId, [projectId+entityId], [projectId+chapterId]',
      candidates: 'id, projectId, [projectId+status], [projectId+createdAt]',
      auditLog: 'id, projectId, [projectId+at]',
      trash: 'id, projectId, [projectId+deletedAt]',
      settings: 'key',
      uiState: 'key',
    });
    this.version(2).stores({
      candidates:
        'id, projectId, [projectId+status], [projectId+createdAt], [projectId+chapterId]',
      occurrences: 'id, projectId, [projectId+entityId], [projectId+chapterId], candidateId',
    });
    this.version(3).stores({
      atlasMaps: 'id, projectId',
    });
    this.version(4).stores({
      skillTrees: 'id, projectId',
      tangleBoards: 'id, projectId',
    });
  }
}

export const db = new LoomwrightDB();
