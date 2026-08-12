import Dexie, { type EntityTable } from 'dexie';
import type {
  Act,
  AtlasMap,
  AuditEntry,
  KeyRow,
  Scene,
  SceneSnapshot,
  Progression,
  ChatThread,
  ChatMessage,
  RandomTable,
  SkillTree,
  TangleBoard,
  Template,
  Chapter,
  Entity,
  Link,
  IdentityRule,
  MergeReceipt,
  Occurrence,
  ParagraphNote,
  Project,
  ReviewCandidate,
  SettingsRow,
  TrashRow,
  UiStateRow,
} from './types';
// Type-only (erased at compile time), so this does not create an import cycle
// with services/ — the same pattern repos/undo.ts already uses.
import type { SuggestionRecord } from '@/services/intelligence/types';

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
  keys!: EntityTable<KeyRow, 'provider'>;
  randomTables!: EntityTable<RandomTable, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  identityRules!: EntityTable<IdentityRule, 'id'>;
  mergeReceipts!: EntityTable<MergeReceipt, 'id'>;
  suggestions!: EntityTable<SuggestionRecord, 'id'>;
  acts!: EntityTable<Act, 'id'>;
  scenes!: EntityTable<Scene, 'id'>;
  sceneSnapshots!: EntityTable<SceneSnapshot, 'id'>;
  progressions!: EntityTable<Progression, 'id'>;
  chatThreads!: EntityTable<ChatThread, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;

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
    this.version(5).stores({
      keys: 'provider',
    });
    this.version(6).stores({
      randomTables: 'id, projectId',
      templates: 'id, projectId, [projectId+kind]',
    });
    this.version(7).stores({
      identityRules:
        'id, projectId, [projectId+kind], [projectId+entityType], canonicalEntityId',
      mergeReceipts: 'id, projectId, [projectId+createdAt], targetEntityId',
    });
    // Extraction 2.0 — the persistent per-entity Suggestions inbox.
    this.version(8).stores({
      suggestions: 'id, projectId, [projectId+status], [projectId+createdAt], targetEntityId',
    });
    // Acts › Chapters › Scenes. Every existing chapter becomes exactly one
    // scene carrying its doc, so nothing moves for an author who never
    // splits anything — a book that used chapters keeps working unchanged.
    //
    // The chapter's own `doc` is deliberately left in place rather than
    // cleared: it becomes a derived rollup, and leaving the original bytes
    // there means a rollback to v8 loses no text.
    this.version(9)
      .stores({
        acts: 'id, projectId, [projectId+order]',
        scenes:
          'id, projectId, chapterId, [projectId+globalOrder], [projectId+chapterId], [chapterId+order], [projectId+status], [projectId+pov]',
        sceneSnapshots: 'id, projectId, sceneId, [projectId+sceneId], [sceneId+createdAt]',
      })
      .upgrade(async (tx) => {
        const chapters = await tx
          .table<Chapter>('chapters')
          .toArray();
        chapters.sort((a, b) => a.order - b.order);
        const now = Date.now();
        await tx.table<Scene>('scenes').bulkAdd(
          chapters.map((chapter, index) => ({
            id: `sc_${chapter.id}`,
            projectId: chapter.projectId,
            chapterId: chapter.id,
            title: chapter.title,
            order: 0,
            globalOrder: index,
            doc: chapter.doc,
            paragraphs: chapter.paragraphs ?? [],
            wordCount: chapter.wordCount ?? 0,
            summary: '',
            summaryUpdatedAt: 0,
            status: (chapter.wordCount ?? 0) > 0 ? 'draft' : 'outline',
            pov: null,
            povType: null,
            characterIds: [],
            locationId: null,
            attachedRefs: [],
            labels: [],
            targetWords: null,
            aiVisible: true,
            createdAt: chapter.createdAt ?? now,
            updatedAt: chapter.updatedAt ?? now,
          }))
        );
      });

    // A new table needs no upgrade: Dexie creates it empty, and every row
    // is written by code that did not exist before. The v8→v9 chapter split
    // is the only migration in this app that has to move data.
    this.version(10).stores({
      progressions: 'id, projectId, entityId, sceneId, [projectId+entityId]',
    });

    // Threads are listed newest-first per project; messages are always read
    // as one thread in order, so `[threadId+createdAt]` is the only compound
    // index either needs.
    this.version(11).stores({
      chatThreads: 'id, projectId, sceneId, [projectId+updatedAt]',
      chatMessages: 'id, threadId, [threadId+createdAt]',
    });
  }
}

export const db = new LoomwrightDB();
