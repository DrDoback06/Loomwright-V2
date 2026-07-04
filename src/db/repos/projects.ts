import { db } from '../schema';
import { newId } from '@/lib/id';
import type { Project } from '../types';

const LAST_PROJECT_KEY = 'lw:lastProjectId';

export async function listProjects(): Promise<Project[]> {
  const all = await db.projects.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function createProject(name: string, genre?: string): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: newId(),
    name: name.trim() || 'Untitled project',
    genre,
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.add(project);
  rememberLastProject(project.id);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  await db.projects.update(id, { name: name.trim() || 'Untitled project', updatedAt: Date.now() });
}

export async function touchProject(id: string): Promise<void> {
  await db.projects.update(id, { updatedAt: Date.now() });
}

/** Deletes a project AND all of its rows across every table. Irreversible;
 * the UI must double-confirm and offer export first. */
export async function deleteProjectDeep(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.entities, db.links, db.chapters, db.notes, db.occurrences, db.candidates, db.auditLog, db.trash],
    async () => {
      await Promise.all([
        db.entities.where('projectId').equals(id).delete(),
        db.links.where('projectId').equals(id).delete(),
        db.chapters.where('projectId').equals(id).delete(),
        db.notes.where('projectId').equals(id).delete(),
        db.occurrences.where('projectId').equals(id).delete(),
        db.candidates.where('projectId').equals(id).delete(),
        db.auditLog.where('projectId').equals(id).delete(),
        db.trash.where('projectId').equals(id).delete(),
      ]);
      await db.projects.delete(id);
    }
  );
  if (getLastProjectId() === id) rememberLastProject(null);
}

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function rememberLastProject(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_PROJECT_KEY, id);
    else localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* ignore */
  }
}
