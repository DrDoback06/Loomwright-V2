import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import {
  ensureBuiltinPrompts,
  exportPrompts,
  importPrompts,
  listPrompts,
  promptFor,
  resetPrompt,
  savePrompt,
} from '@/db/repos/prompts';
import { resolvePrompt, tokensIn } from '@/services/prompts/resolve';
import { codexScope, layerTemplate } from '@/services/prompts/apply';
import { builtinPrompts } from '@/services/prompts/builtins';
import { BEAT_SYSTEM } from '@/services/ai/prompts/beat';
import type { PromptTemplate } from '@/db/types';

const PROJECT = 'p-prompts';

const SCOPE = {
  scene: { title: 'The ferry', summary: 'Marrow takes someone across.', labels: ['night', 'setup'], pov: 'Vex' },
  selection: 'the water was flat',
  beat: 'They argue about the crossing.',
  targetWords: 400,
  context: '- Cast Marrow — A ferryman.',
  storySoFar: 'One: Vex leaves the city.',
  codexAll: '- Cast Marrow\n- Locations Pale Reach',
  codexByType: { cast: '- Cast Marrow' } as const,
  codexByName: { marrow: '- Cast Marrow — A ferryman.' },
  inputs: { genre: 'grimdark' },
};

describe('resolvePrompt', () => {
  it('substitutes the plain variables', () => {
    expect(resolvePrompt('Write {targetWords} words of {scene.title}.', SCOPE).text).toBe(
      'Write 400 words of The ferry.'
    );
    expect(resolvePrompt('Labels: {scene.labels}', SCOPE).text).toBe('Labels: night, setup');
  });

  it('is case-insensitive, because that is not a bug worth debugging', () => {
    expect(resolvePrompt('{storysofar()}', SCOPE).text).toBe('One: Vex leaves the city.');
    expect(resolvePrompt('{StorySoFar()}', SCOPE).text).toBe('One: Vex leaves the city.');
  });

  it('takes an argument, quoted or not', () => {
    expect(resolvePrompt('{codex.get("Marrow")}', SCOPE).text).toBe('- Cast Marrow — A ferryman.');
    expect(resolvePrompt('{input("genre")}', SCOPE).text).toBe('grimdark');
    expect(resolvePrompt("{input('genre')}", SCOPE).text).toBe('grimdark');
  });

  it('resolves a codex type against the app’s own type list', () => {
    expect(resolvePrompt('{codex.cast()}', SCOPE).text).toBe('- Cast Marrow');
    expect(resolvePrompt('{codex.all}', SCOPE).text).toContain('Pale Reach');
  });

  it('LEAVES an unknown variable in the text and reports it', () => {
    // A token that silently resolves to nothing is a template that quietly
    // stopped working, and the author has no way to see it.
    const result = resolvePrompt('Hello {scene.mood} there.', SCOPE);
    expect(result.text).toBe('Hello {scene.mood} there.');
    expect(result.unknown).toEqual(['{scene.mood}']);
  });

  it('resolves a missing-but-known value to nothing rather than to the token', () => {
    const result = resolvePrompt('[{selection}]', {});
    expect(result.text).toBe('[]');
    expect(result.unknown).toEqual([]);
  });

  it('cannot become a program — a nested token is left alone', () => {
    const result = resolvePrompt('{codex.get("{scene.title}")}', SCOPE);
    expect(result.text).not.toContain('A ferryman');
  });

  it('lists the tokens a template mentions', () => {
    expect(tokensIn('{beat} and {context} and plain text')).toEqual(['{beat}', '{context}']);
  });
});

function template(patch: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 't1',
    projectId: PROJECT,
    slug: 'beat',
    name: 'Scene beat',
    kind: 'beat',
    system: '',
    body: '',
    inputs: [],
    builtin: 0,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

describe('layerTemplate', () => {
  const built = { system: 'Built-in system.', prompt: 'THE BRIEF\nEverything the app assembled.' };

  it('an untouched template changes nothing — which is what makes seeding safe', () => {
    expect(layerTemplate(built, template(), SCOPE)).toEqual(built);
    expect(layerTemplate(built, null, SCOPE)).toEqual(built);
  });

  it('a system field REPLACES the built-in one', () => {
    const out = layerTemplate(built, template({ system: 'You write {scene.title} in {input("genre")}.' }), SCOPE);
    expect(out.system).toBe('You write The ferry in grimdark.');
    expect(out.prompt).toBe(built.prompt);
  });

  it('a body field is APPENDED, and the assembled prompt survives', () => {
    // The body deliberately does not replace the prompt: that prompt
    // carries the context engine, the canon and the measured style, and a
    // blank page that silently drops all three is a worse prompt with more
    // knobs on it.
    const out = layerTemplate(built, template({ body: 'Keep it under {targetWords} words.' }), SCOPE);
    expect(out.prompt).toContain('Everything the app assembled.');
    expect(out.prompt).toContain('Keep it under 400 words.');
    expect(out.system).toBe('Built-in system.');
  });
});

describe('the prompt library', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('seeds itself from the prompts the app actually sends', async () => {
    await ensureBuiltinPrompts();
    const beat = await promptFor(PROJECT, 'beat');
    // Not a second copy that can drift — the same exported constant.
    expect(beat?.system).toBe(BEAT_SYSTEM);
    expect(beat?.builtin).toBe(1);
  });

  it('seeding twice adds nothing twice', async () => {
    await ensureBuiltinPrompts();
    await ensureBuiltinPrompts();
    expect(await db.promptTemplates.count()).toBe(builtinPrompts().length);
  });

  it('editing a builtin is copy-on-write — the shipped row survives', async () => {
    await ensureBuiltinPrompts();
    const original = (await promptFor(PROJECT, 'beat'))!;
    const saved = await savePrompt(PROJECT, original, { system: 'Mine now.' });

    expect(saved.builtin).toBe(0);
    expect(saved.projectId).toBe(PROJECT);
    expect((await db.promptTemplates.get(original.id))!.system).toBe(BEAT_SYSTEM);
    // And it is the copy that is now in force.
    expect((await promptFor(PROJECT, 'beat'))!.system).toBe('Mine now.');
  });

  it('a project override does not leak into another project', async () => {
    await ensureBuiltinPrompts();
    const original = (await promptFor(PROJECT, 'beat'))!;
    await savePrompt(PROJECT, original, { system: 'Mine now.' });
    expect((await promptFor('other-project', 'beat'))!.system).toBe(BEAT_SYSTEM);
  });

  it('reset puts the shipped prompt back in force', async () => {
    await ensureBuiltinPrompts();
    const original = (await promptFor(PROJECT, 'beat'))!;
    await savePrompt(PROJECT, original, { system: 'Mine now.' });
    await resetPrompt(PROJECT, 'beat');
    expect((await promptFor(PROJECT, 'beat'))!.system).toBe(BEAT_SYSTEM);
  });

  it('lists an override instead of the builtin it replaced, never both', async () => {
    await ensureBuiltinPrompts();
    const original = (await promptFor(PROJECT, 'beat'))!;
    await savePrompt(PROJECT, original, { name: 'My beat' });
    const rows = await listPrompts(PROJECT);
    const beats = rows.filter((p) => p.kind === 'beat');
    expect(beats).toHaveLength(1);
    expect(beats[0].name).toBe('My beat');
  });

  it('round-trips through the clipboard', async () => {
    await ensureBuiltinPrompts();
    const original = (await promptFor(PROJECT, 'beat'))!;
    await savePrompt(PROJECT, original, { system: 'Shared prompt.' });

    const json = exportPrompts(await listPrompts(PROJECT));
    const result = await importPrompts('other-project', json);
    expect('error' in result).toBe(false);
    expect((await promptFor('other-project', 'beat'))!.system).toBe('Shared prompt.');
  });

  it('accepts a fenced paste, because that is what a model hands you', async () => {
    const json = exportPrompts([template({ system: 'Fenced.' })]);
    const result = await importPrompts(PROJECT, '```json\n' + json + '\n```');
    expect(result).toMatchObject({ imported: 1 });
    expect((await promptFor(PROJECT, 'beat'))!.system).toBe('Fenced.');
  });

  it('skips a kind the app does not have, and names it', async () => {
    const result = await importPrompts(
      PROJECT,
      JSON.stringify({
        format: 'loomwright-prompts-v1',
        prompts: [{ slug: 'x', name: 'From another app', kind: 'screenplay', system: 'x', body: '', inputs: [] }],
      })
    );
    expect(result).toMatchObject({ imported: 0, skipped: ['From another app'] });
    expect(await db.promptTemplates.where('kind').equals('screenplay').count()).toBe(0);
  });

  it('says so plainly when the paste was not JSON', async () => {
    expect(await importPrompts(PROJECT, 'here are my prompts!')).toHaveProperty('error');
  });
});

describe('codexScope', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('builds the blocks a template reaches with {codex.…}', async () => {
    await createEntity({ projectId: PROJECT, type: 'cast', name: 'Marrow', summary: 'A ferryman.' });
    await createEntity({ projectId: PROJECT, type: 'locations', name: 'Pale Reach' });
    const scope = await codexScope(PROJECT);

    expect(scope.codexByType?.cast).toContain('Marrow');
    expect(scope.codexByType?.cast).not.toContain('Pale Reach');
    expect(scope.codexAll).toContain('Pale Reach');
    expect(scope.codexByName?.marrow).toContain('A ferryman.');
  });
});
