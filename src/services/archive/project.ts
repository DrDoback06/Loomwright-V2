import { db } from '@/db/schema';
import type {
  AtlasMap,
  Chapter,
  Entity,
  Link,
  Occurrence,
  ParagraphNote,
  Project,
  RandomTable,
  ReviewCandidate,
  SettingsRow,
  SkillTree,
  TangleBoard,
  Template,
} from '@/db/types';
import { newId } from '@/lib/id';
import { remapRefs } from '@/lib/remap';

export const PROJECT_SCHEMA_VERSION = 'loomwright-project-v2';

export interface ProjectArchive {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  exportedAt: string;
  project: Project;
  tables: {
    entities: Entity[];
    links: Link[];
    chapters: Chapter[];
    notes: ParagraphNote[];
    occurrences: Occurrence[];
    candidates: ReviewCandidate[];
    atlasMaps: AtlasMap[];
    skillTrees: SkillTree[];
    tangleBoards: TangleBoard[];
    randomTables: RandomTable[];
    templates: Template[];
    settings: SettingsRow[];
  };
  meta: Record<string, number>;
}

/** Everything project-scoped, in one JSON document. The keys table and
 * key material are NEVER read here — API keys cannot leave the device
 * in an export, by construction. Audit log, trash, and device UI state
 * stay local too. */
export async function exportProject(projectId: string): Promise<ProjectArchive> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found.');
  const byProject = <T>(table: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<T[]> } } }) =>
    table.where('projectId').equals(projectId).toArray();

  const tables: ProjectArchive['tables'] = {
    entities: await byProject<Entity>(db.entities),
    links: await byProject<Link>(db.links),
    chapters: await byProject<Chapter>(db.chapters),
    notes: await byProject<ParagraphNote>(db.notes),
    occurrences: await byProject<Occurrence>(db.occurrences),
    candidates: await byProject<ReviewCandidate>(db.candidates),
    atlasMaps: await byProject<AtlasMap>(db.atlasMaps),
    skillTrees: await byProject<SkillTree>(db.skillTrees),
    tangleBoards: await byProject<TangleBoard>(db.tangleBoards),
    randomTables: await byProject<RandomTable>(db.randomTables),
    templates: await byProject<Template>(db.templates),
    settings: (await db.settings.toArray()).filter((row) => row.key.startsWith(`${projectId}:`)),
  };

  const meta: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) meta[name] = rows.length;

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    tables,
    meta,
  };
}

export interface ImportResult {
  projectId: string;
  name: string;
  counts: Record<string, number>;
}

/** Import an archive as a NEW project. Every row gets a fresh id and
 * every cross-reference is rewritten, so importing next to the original
 * (or twice) can never collide. */
export async function importProject(raw: unknown): Promise<ImportResult> {
  const archive = raw as Partial<ProjectArchive>;
  if (!archive || archive.schemaVersion !== PROJECT_SCHEMA_VERSION || !archive.project || !archive.tables) {
    throw new Error(`Not a ${PROJECT_SCHEMA_VERSION} file.`);
  }
  const t = archive.tables;
  const projectId = newId();

  // First pass: a fresh id for every row of every table.
  const idMap = new Map<string, string>();
  const allRowLists: { id: string }[][] = [
    t.entities ?? [], t.links ?? [], t.chapters ?? [], t.notes ?? [], t.occurrences ?? [],
    t.candidates ?? [], t.atlasMaps ?? [], t.skillTrees ?? [], t.tangleBoards ?? [],
    t.randomTables ?? [], t.templates ?? [],
  ];
  for (const rows of allRowLists) {
    for (const row of rows) idMap.set(row.id, newId());
  }

  // Second pass: remap ids + refs and stamp the new projectId.
  const rebase = <R extends { id: string; projectId: string }>(rows: R[] | undefined): R[] =>
    (rows ?? []).map((row) => ({ ...remapRefs(row, idMap), projectId }));

  const entities = rebase(t.entities);
  const links = rebase(t.links);
  const chapters = rebase(t.chapters);
  const notes = rebase(t.notes).map((n) => ({ ...n, chapterId: idMap.get(n.chapterId) ?? n.chapterId }));
  const occurrences = rebase(t.occurrences).map((o) => ({
    ...o,
    entityId: o.entityId ? (idMap.get(o.entityId) ?? o.entityId) : o.entityId,
    chapterId: idMap.get(o.chapterId) ?? o.chapterId,
    candidateId: o.candidateId ? (idMap.get(o.candidateId) ?? o.candidateId) : o.candidateId,
  }));
  const candidates = rebase(t.candidates).map((c) => ({
    ...c,
    chapterId: c.chapterId ? (idMap.get(c.chapterId) ?? c.chapterId) : c.chapterId,
    existingEntityId: c.existingEntityId ? (idMap.get(c.existingEntityId) ?? c.existingEntityId) : c.existingEntityId,
    acceptedEntityId: c.acceptedEntityId ? (idMap.get(c.acceptedEntityId) ?? c.acceptedEntityId) : c.acceptedEntityId,
    relatedEntityIds: c.relatedEntityIds?.map((id) => idMap.get(id) ?? id),
  }));
  const atlasMaps = rebase(t.atlasMaps);
  const skillTrees = rebase(t.skillTrees);
  const tangleBoards = rebase(t.tangleBoards);
  const randomTables = rebase(t.randomTables);
  const templates = rebase(t.templates);
  const oldProjectId = archive.project.id;
  const settings = (t.settings ?? [])
    .filter((row) => row.key.startsWith(`${oldProjectId}:`))
    .map((row) => ({ ...row, key: `${projectId}:${row.key.slice(oldProjectId.length + 1)}` }));

  const now = Date.now();
  const project: Project = { ...archive.project, id: projectId, updatedAt: now };

  await db.transaction(
    'rw',
    [
      db.projects, db.entities, db.links, db.chapters, db.notes, db.occurrences,
      db.candidates, db.atlasMaps, db.skillTrees, db.tangleBoards, db.randomTables,
      db.templates, db.settings,
    ],
    async () => {
      await db.projects.add(project);
      await db.entities.bulkAdd(entities);
      await db.links.bulkAdd(links);
      await db.chapters.bulkAdd(chapters);
      await db.notes.bulkAdd(notes);
      await db.occurrences.bulkAdd(occurrences);
      await db.candidates.bulkAdd(candidates);
      await db.atlasMaps.bulkAdd(atlasMaps);
      await db.skillTrees.bulkAdd(skillTrees);
      await db.tangleBoards.bulkAdd(tangleBoards);
      await db.randomTables.bulkAdd(randomTables);
      await db.templates.bulkAdd(templates);
      await db.settings.bulkPut(settings);
    }
  );

  return {
    projectId,
    name: project.name,
    counts: {
      entities: entities.length,
      chapters: chapters.length,
      occurrences: occurrences.length,
      candidates: candidates.length,
    },
  };
}
