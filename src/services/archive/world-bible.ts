import { db } from '@/db/schema';
import type { Entity } from '@/db/types';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META } from '@/domain/entity-types';

/** Render a project's codex + manuscript outline as a world bible.
 * Markdown is the source shape; HTML wraps the same content for
 * one-click sharing. Key material can't appear — it is never read. */
export async function renderWorldBible(projectId: string): Promise<{ markdown: string; html: string }> {
  const project = await db.projects.get(projectId);
  const entities = await db.entities.where('projectId').equals(projectId).toArray();
  const chapters = (await db.chapters.where('projectId').equals(projectId).toArray()).sort(
    (a, b) => a.order - b.order
  );

  const lines: string[] = [`# ${project?.name ?? 'Loomwright project'} — World Bible`, ''];
  const totalWords = chapters.reduce((s, c) => s + c.wordCount, 0);
  lines.push(
    `*Exported ${new Date().toLocaleDateString()} · ${entities.length} codex entries · ` +
      `${chapters.length} chapters · ${totalWords.toLocaleString()} words*`,
    ''
  );

  if (chapters.length > 0) {
    lines.push('## Manuscript', '');
    for (const c of chapters) {
      lines.push(`- **${c.title}** — ${c.wordCount.toLocaleString()} words`);
    }
    lines.push('');
  }

  for (const type of ALL_ENTITY_TYPES) {
    const group = entities
      .filter((e) => e.type === type && e.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name));
    if (group.length === 0) continue;
    lines.push(`## ${ENTITY_TYPE_META[type].plural}`, '');
    for (const e of group) {
      lines.push(`### ${e.name}`, '');
      if (e.aliases.length) lines.push(`*Also known as: ${e.aliases.join(', ')}*`, '');
      if (e.summary) lines.push(e.summary, '');
      const fieldLines = renderFields(e);
      if (fieldLines.length) lines.push(...fieldLines, '');
      if (e.tags.length) lines.push(`Tags: ${e.tags.join(', ')}`, '');
    }
  }

  const markdown = lines.join('\n');
  return { markdown, html: toHtml(project?.name ?? 'World Bible', markdown) };
}

function renderFields(entity: Entity): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(entity.fields)) {
    const rendered = renderValue(value);
    if (rendered) out.push(`- **${labelise(key)}:** ${rendered}`);
  }
  return out;
}

function renderValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'yes' : '';
  if (Array.isArray(value)) {
    return value.map(renderValue).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // Entity ref → its name; quest step → text + status.
    if (typeof v.name === 'string') return v.name;
    if (typeof v.text === 'string') {
      return typeof v.status === 'string' ? `${v.text} (${v.status})` : v.text;
    }
    return '';
  }
  return '';
}

function labelise(fieldId: string): string {
  const spaced = fieldId.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Minimal, dependency-free Markdown → HTML for the shapes we emit
 * (headings, list items, emphasis, paragraphs). */
function toHtml(title: string, markdown: string): string {
  const body = markdown
    .split('\n')
    .map((raw) => {
      const line = escapeHtml(raw);
      if (line.startsWith('### ')) return `<h3>${inline(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${inline(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${inline(line.slice(2))}</h1>`;
      if (line.startsWith('- ')) return `<li>${inline(line.slice(2))}</li>`;
      if (line.trim() === '') return '';
      return `<p>${inline(line)}</p>`;
    })
    .join('\n')
    // Wrap runs of <li> in <ul>.
    .replace(/(<li>[\s\S]*?<\/li>)(?!\n<li>)/g, '<ul>$1</ul>')
    .replace(/<\/li>\n<li>/g, '</li><li>');
  return [
    '<!doctype html>',
    `<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)} — World Bible</title>`,
    '<style>body{font-family:Georgia,serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#2a2118;background:#f8f1de}h1,h2,h3{font-weight:600}h2{border-bottom:1px solid #cdbf9f;padding-bottom:.25rem;margin-top:2rem}</style>',
    `</head><body>`,
    body,
    '</body></html>',
  ].join('\n');
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
