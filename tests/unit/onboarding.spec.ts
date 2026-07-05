import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { buildChapterDoc, splitManuscript } from '@/services/manuscript-import';
import { analyzeStyle } from '@/services/style-analysis';
import { applyOnboarding, EMPTY_ANSWERS } from '@/services/onboarding';
import { createSampleProject, SAMPLE_PROJECT_NAME } from '@/services/sample-project';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('manuscript import', () => {
  it('splits on Chapter lines and markdown headings; body text is preserved', () => {
    const out = splitManuscript(
      [
        'Chapter One — The Short Peal',
        '',
        'Aelinor reached the city.',
        '',
        '# The Drovers’ Road',
        'They took the old road.',
        'It was cold.',
      ].join('\n')
    );
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('Chapter One — The Short Peal');
    expect(out[0].text).toBe('Aelinor reached the city.');
    expect(out[1].title).toBe('The Drovers’ Road');
    expect(out[1].text).toContain('old road');
  });

  it('headingless text becomes a single chapter; blank input none', () => {
    expect(splitManuscript('Just prose, no headings.')).toEqual([
      { title: 'Chapter 1', text: 'Just prose, no headings.' },
    ]);
    expect(splitManuscript('   ')).toEqual([]);
  });

  it('buildChapterDoc derives pid-stable paragraphs and word count', () => {
    const built = buildChapterDoc('First block line one.\nStill first block.\n\nSecond block.');
    expect(built.paragraphs).toHaveLength(2);
    expect(built.paragraphs[0].text).toBe('First block line one. Still first block.');
    expect(built.wordCount).toBe(9);
    const doc = built.doc as { content: { attrs: { pid: string } }[] };
    expect(doc.content[0].attrs.pid).toBe(built.paragraphs[0].id);
  });
});

describe('style analysis', () => {
  it('produces real metrics and readable notes', () => {
    const profile = analyzeStyle(
      '"You should not be here," he said. She did not answer him at once. ' +
        'The harbour bells rang the short peal that meant a ship had failed to come home, ' +
        'and the tar-smell sat over the water like a lid.'
    )!;
    expect(profile.wordCount).toBeGreaterThan(20);
    expect(profile.avgSentenceLength).toBeGreaterThan(5);
    expect(profile.dialogueRatio).toBeGreaterThan(0);
    expect(profile.notes.length).toBeGreaterThanOrEqual(4);
    expect(['terse', 'balanced', 'expansive']).toContain(profile.register);
  });

  it('refuses tiny samples', () => {
    expect(analyzeStyle('Too short.')).toBeNull();
    expect(analyzeStyle('')).toBeNull();
  });
});

describe('applyOnboarding', () => {
  it('seeds project, cast, places, references, chapters, and the review queue', async () => {
    const result = await applyOnboarding({
      ...EMPTY_ANSWERS,
      name: 'The Hollow Crown',
      genre: ['Fantasy', 'Romance'],
      premise: 'A queen in exile returns for the succession.',
      themes: ['loyalty', 'debt'],
      tone: ['Grounded', 'Epic'],
      pov: 'Third limited',
      tense: 'Past',
      cast: [{ name: 'Aelinor Vael', role: 'Protagonist', note: 'Queen in exile.' }],
      places: [{ name: 'Pale Reach', kind: 'Port' }],
      manuscript: 'Chapter One\n\nAelinor Vael reached Pale Reach. Captain Brec met her with the Blackwork Blade.',
      runExtraction: true,
      aiMode: 'local-only',
      privacyAsk: true,
    });

    expect(result.castCreated).toBe(1);
    expect(result.placesCreated).toBe(1);
    expect(result.chaptersCreated).toBe(1);
    expect(result.referencesCreated).toBeGreaterThanOrEqual(2); // foundation + brief
    expect(result.candidatesFound).toBeGreaterThan(0);

    const projectId = result.projectId;
    // Multi-select genres join into the project + brief.
    const project = await db.projects.get(projectId);
    expect(project?.genre).toBe('Fantasy, Romance');
    const cast = await db.entities.where('[projectId+type]').equals([projectId, 'cast']).toArray();
    expect(cast.map((e) => e.name)).toContain('Aelinor Vael');
    expect(cast[0].fields.role).toBe('Protagonist');
    const refs = await db.entities.where('[projectId+type]').equals([projectId, 'references']).toArray();
    expect(refs.map((r) => r.name)).toEqual(
      expect.arrayContaining(['Story foundation', 'Project brief (AI context)'])
    );
    const brief = refs.find((r) => r.name === 'Project brief (AI context)');
    expect(brief?.fields.body).toContain('Fantasy, Romance');
    const foundation = refs.find((r) => r.name === 'Story foundation');
    expect(foundation?.fields.body).toContain('Tone: Grounded, Epic');
    const pending = await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray();
    expect(pending.length).toBeGreaterThan(0);
    const aiRow = await db.settings.get(`${projectId}:ai`);
    expect(aiRow?.value).toMatchObject({ mode: 'local-only', privacy: 'ask' });
    // The full manuscript is not duplicated into settings.
    const ob = await db.settings.get(`${projectId}:onboarding`);
    expect((ob?.value as { manuscript?: string }).manuscript).toBeUndefined();
  });
});

describe('sample project', () => {
  it('creates a coherent explorable world with a populated review queue', async () => {
    const projectId = await createSampleProject();
    const project = await db.projects.get(projectId);
    expect(project?.name).toBe(SAMPLE_PROJECT_NAME);
    expect(await db.entities.where('projectId').equals(projectId).count()).toBeGreaterThanOrEqual(8);
    expect(await db.chapters.where('projectId').equals(projectId).count()).toBe(2);
    expect(
      await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).count()
    ).toBeGreaterThan(0);
    const maps = await db.atlasMaps.where('projectId').equals(projectId).toArray();
    expect(maps[0].pins).toHaveLength(2);
    const boards = await db.tangleBoards.where('projectId').equals(projectId).toArray();
    expect(boards[0].cards.length).toBeGreaterThanOrEqual(2);
  });
});
