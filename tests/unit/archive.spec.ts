import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { createChapter, saveChapterDoc, appendParagraphToChapter } from '@/db/repos/chapters';
import { exportProject, importProject } from '@/services/archive/project';
import { renderWorldBible } from '@/services/archive/world-bible';
import { saveApiKey } from '@/services/crypto/keys';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function seedProject() {
  const projectId = 'p1';
  await db.projects.add({ id: projectId, name: 'The Hollow Crown', createdAt: 1, updatedAt: 1 });
  const aelinor = await createEntity({
    projectId,
    type: 'cast',
    name: 'Aelinor',
    aliases: ['Ael'],
    summary: 'Queen in exile.',
    tags: ['royal'],
    fields: {},
  });
  const pass = await createEntity({
    projectId,
    type: 'locations',
    name: 'Vraska Pass',
    aliases: [],
    summary: 'A cold road.',
    tags: [],
    fields: { linkedCast: [{ id: aelinor.id, type: 'cast', name: 'Aelinor' }] },
  });
  const chapter = await createChapter(projectId, 'Chapter 1');
  await saveChapterDoc(
    chapter.id,
    { type: 'doc', content: [{ type: 'paragraph', attrs: { pid: 'pp1' }, content: [{ type: 'text', text: 'Aelinor crossed Vraska Pass.' }] }] },
    [{ id: 'pp1', text: 'Aelinor crossed Vraska Pass.' }],
    4
  );
  await db.occurrences.add({
    id: 'occ1', projectId, entityId: aelinor.id, entityType: 'cast', chapterId: chapter.id,
    paragraphId: 'pp1', start: 0, end: 7, exactText: 'Aelinor', createdAt: 1,
  });
  await db.settings.put({ key: `${projectId}:extraction`, value: { detectorConfidence: { ownership: 0.9 } } });
  return { projectId, aelinorId: aelinor.id, passId: pass.id, chapterId: chapter.id };
}

describe('project export/import v2', () => {
  it('round-trips a project with a full id remap and rewritten refs', async () => {
    const { projectId, aelinorId } = await seedProject();
    const archive = await exportProject(projectId);
    expect(archive.schemaVersion).toBe('loomwright-project-v2');
    expect(archive.meta.entities).toBe(2);

    const result = await importProject(JSON.parse(JSON.stringify(archive)));
    expect(result.projectId).not.toBe(projectId);
    expect(result.counts).toMatchObject({ entities: 2, chapters: 1, occurrences: 1 });

    // Fresh ids everywhere; the field ref follows the remapped entity.
    const imported = await db.entities.where('projectId').equals(result.projectId).toArray();
    const newAelinor = imported.find((e) => e.name === 'Aelinor')!;
    const newPass = imported.find((e) => e.name === 'Vraska Pass')!;
    expect(newAelinor.id).not.toBe(aelinorId);
    const linked = (newPass.fields.linkedCast as { id: string }[])[0];
    expect(linked.id).toBe(newAelinor.id);

    // Occurrence follows both the entity and the chapter remap.
    const occ = (await db.occurrences.where('projectId').equals(result.projectId).toArray())[0];
    expect(occ.entityId).toBe(newAelinor.id);
    const chapters = await db.chapters.where('projectId').equals(result.projectId).toArray();
    expect(occ.chapterId).toBe(chapters[0].id);

    // Settings key prefix rewritten.
    const setting = await db.settings.get(`${result.projectId}:extraction`);
    expect(setting?.value).toEqual({ detectorConfidence: { ownership: 0.9 } });

    // Importing the same file twice can't collide.
    const second = await importProject(JSON.parse(JSON.stringify(archive)));
    expect(second.projectId).not.toBe(result.projectId);
    expect(await db.projects.count()).toBe(3);
  });

  it('NEVER exports key material, and rejects foreign files', async () => {
    const { projectId } = await seedProject();
    await saveApiKey('anthropic', 'sk-ant-super-secret-123');
    const archive = await exportProject(projectId);
    const blob = JSON.stringify(archive);
    expect(blob).not.toContain('sk-ant-super-secret-123');
    expect(blob).not.toContain('cryptoKey');
    expect(Object.keys(archive.tables)).not.toContain('keys');

    await expect(importProject({ schemaVersion: 'something-else' })).rejects.toThrow(/v2/);
  });
});

describe('world bible', () => {
  it('renders the codex grouped by type with refs by name, in md + html', async () => {
    const { projectId } = await seedProject();
    const { markdown, html } = await renderWorldBible(projectId);
    expect(markdown).toContain('# The Hollow Crown — World Bible');
    expect(markdown).toContain('## Cast');
    expect(markdown).toContain('### Aelinor');
    expect(markdown).toContain('*Also known as: Ael*');
    expect(markdown).toContain('## Locations');
    expect(markdown).toContain('- **Linked cast:** Aelinor');
    expect(markdown).toContain('**Chapter 1** — 4 words');
    expect(html).toContain('<h3>Aelinor</h3>');
    expect(html).toContain('<title>The Hollow Crown — World Bible</title>');
  });
});

describe('appendParagraphToChapter', () => {
  it('appends a block the editor can adopt, updating derived state', async () => {
    const { chapterId } = await seedProject();
    await appendParagraphToChapter(chapterId, 'A brass compass that points elsewhere.');
    const chapter = (await db.chapters.get(chapterId))!;
    expect(chapter.paragraphs).toHaveLength(2);
    expect(chapter.paragraphs[1].text).toBe('A brass compass that points elsewhere.');
    expect(chapter.wordCount).toBe(4 + 6);
    const doc = chapter.doc as { content: { attrs?: { pid?: string } }[] };
    expect(doc.content).toHaveLength(2);
    expect(doc.content[1].attrs?.pid).toBe(chapter.paragraphs[1].id);
  });
});
