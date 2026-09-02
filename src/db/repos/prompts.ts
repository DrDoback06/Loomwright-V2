import { db } from '../schema';
import { newId } from '@/lib/id';
import { logAudit } from './audit';
import type { PromptKind, PromptTemplate } from '../types';
import { builtinPrompts } from '@/services/prompts/builtins';

/**
 * Put the shipped set in the database if it is not there.
 *
 * Idempotent and keyed on `slug`, so a later release can add a template
 * without touching one the author has edited. Builtins are project-less
 * (`projectId: null`): they are the app's opinion, and every project sees
 * the same one until it overrides it.
 */
export async function ensureBuiltinPrompts(): Promise<void> {
  const existing = new Set(
    (await db.promptTemplates.where('builtin').equals(1).toArray()).map((p) => p.slug)
  );
  const now = Date.now();
  const missing = builtinPrompts()
    .filter((b) => !existing.has(b.slug))
    .map<PromptTemplate>((b) => ({
      id: newId(),
      projectId: null,
      slug: b.slug,
      name: b.name,
      kind: b.kind,
      system: b.system,
      body: b.body,
      inputs: b.inputs,
      builtin: 1,
      createdAt: now,
      updatedAt: now,
    }));
  if (missing.length) await db.promptTemplates.bulkAdd(missing);
}

/** Everything this project can choose from: its own overrides plus the
 * builtins it has not overridden.
 *
 * A pure read: seeding lives in `ProjectGate`, because writing from inside
 * a `useLiveQuery` re-triggers the query that did the writing. */
export async function listPrompts(projectId: string): Promise<PromptTemplate[]> {
  const all = await db.promptTemplates.toArray();
  const mine = all.filter((p) => p.projectId === projectId);
  const overridden = new Set(mine.map((p) => p.slug));
  return [...mine, ...all.filter((p) => p.builtin === 1 && !overridden.has(p.slug))].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  );
}

/**
 * The template a given AI path should use right now.
 *
 * A project override wins; otherwise the builtin; otherwise null, which
 * every caller reads as "use the code's own prompt". That last case is
 * what keeps the library optional rather than load-bearing — a project
 * whose templates table failed to seed still writes.
 */
export async function promptFor(
  projectId: string,
  kind: PromptKind
): Promise<PromptTemplate | null> {
  const all = await db.promptTemplates.where('kind').equals(kind).toArray();
  return all.find((p) => p.projectId === projectId) ?? all.find((p) => p.builtin === 1) ?? null;
}

/**
 * Save an edit — **copy-on-write**.
 *
 * Editing a builtin writes a project-scoped copy and leaves the shipped
 * row untouched, so "reset to default" is always a real option rather than
 * a promise the app cannot keep.
 */
export async function savePrompt(
  projectId: string,
  template: PromptTemplate,
  patch: Partial<Pick<PromptTemplate, 'name' | 'system' | 'body' | 'inputs'>>
): Promise<PromptTemplate> {
  const now = Date.now();
  if (template.builtin === 1) {
    const copy: PromptTemplate = {
      ...template,
      ...patch,
      id: newId(),
      projectId,
      builtin: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.promptTemplates.add(copy);
    await logAudit({
      projectId,
      action: 'prompt.override',
      target: { table: 'promptTemplates', id: copy.id, label: copy.name },
      after: copy,
      reversible: true,
    });
    return copy;
  }
  const next = { ...template, ...patch, updatedAt: now };
  await db.promptTemplates.put(next);
  await logAudit({
    projectId,
    action: 'prompt.update',
    target: { table: 'promptTemplates', id: next.id, label: next.name },
    before: template,
    after: next,
    reversible: true,
  });
  return next;
}

/** Drop the project's override so the shipped prompt is in force again. */
export async function resetPrompt(projectId: string, slug: string): Promise<void> {
  const mine = (await db.promptTemplates.where('slug').equals(slug).toArray()).filter(
    (p) => p.projectId === projectId
  );
  for (const row of mine) {
    await db.promptTemplates.delete(row.id);
    await logAudit({
      projectId,
      action: 'prompt.reset',
      target: { table: 'promptTemplates', id: row.id, label: row.name },
      before: row,
      reversible: true,
    });
  }
}

export interface PromptExport {
  format: 'loomwright-prompts-v1';
  prompts: Pick<PromptTemplate, 'slug' | 'name' | 'kind' | 'system' | 'body' | 'inputs'>[];
}

export function exportPrompts(templates: readonly PromptTemplate[]): string {
  const payload: PromptExport = {
    format: 'loomwright-prompts-v1',
    prompts: templates.map((p) => ({
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      system: p.system,
      body: p.body,
      inputs: p.inputs,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Take a pasted export and make it this project's overrides.
 *
 * Tolerant of what a person actually pastes — a fenced block, a single
 * template rather than an export — and strict about the one thing that
 * matters: a `kind` the app does not have is skipped and named, never
 * stored, because a template for a path that does not exist is a row
 * nothing will ever read.
 */
export async function importPrompts(
  projectId: string,
  text: string
): Promise<{ imported: number; skipped: string[] } | { error: string }> {
  let parsed: unknown;
  try {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text.trim());
    parsed = JSON.parse(fenced ? fenced[1] : text.trim());
  } catch {
    return { error: 'That was not JSON. Paste the whole export, including the braces.' };
  }
  const body = parsed as Partial<PromptExport> & { kind?: string };
  const list = Array.isArray(body.prompts) ? body.prompts : body.kind ? [body as never] : [];
  if (!list.length) return { error: 'No prompts in that export.' };

  const kinds = new Set(builtinPrompts().map((b) => b.kind));
  const skipped: string[] = [];
  let imported = 0;
  const now = Date.now();

  for (const raw of list) {
    const entry = raw as Partial<PromptTemplate>;
    if (!entry.kind || !kinds.has(entry.kind as PromptKind)) {
      skipped.push(String(entry.name ?? entry.kind ?? 'an unnamed prompt'));
      continue;
    }
    const slug = entry.slug || String(entry.kind);
    await resetPrompt(projectId, slug);
    await db.promptTemplates.add({
      id: newId(),
      projectId,
      slug,
      name: entry.name || String(entry.kind),
      kind: entry.kind as PromptKind,
      system: typeof entry.system === 'string' ? entry.system : '',
      body: typeof entry.body === 'string' ? entry.body : '',
      inputs: Array.isArray(entry.inputs) ? entry.inputs : [],
      builtin: 0,
      createdAt: now,
      updatedAt: now,
    });
    imported += 1;
  }
  return { imported, skipped };
}
