import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import {
  BUILTIN_TABLES,
  createTable,
  deleteTable,
  duplicateTable,
  listTables,
  rollTable,
} from '@/services/random-tables';
import { beatDelay, sentenceOf, srSplitWord, srTokenise } from '@/services/speed-reader';
import {
  BUILTIN_ENTITY_TEMPLATES,
  entityInitialFrom,
  instantiateBoardTemplate,
  saveBoardTemplate,
  saveEntityTemplate,
} from '@/services/templates';
import type { Entity, RandomTable } from '@/db/types';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('random tables', () => {
  const table: RandomTable = {
    id: 't1',
    projectId: 'p1',
    name: 'Test',
    category: 'none',
    rows: [
      { text: 'common', weight: 8 },
      { text: 'rare', weight: 1 },
      { text: 'mid', weight: 1 },
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  it('rolls deterministically with an injected rng, honouring weights', () => {
    // total weight 10: 0.0–0.8 → common, 0.8–0.9 → rare, 0.9–1.0 → mid
    expect(rollTable(table, { rng: () => 0.5 })).toEqual(['common']);
    expect(rollTable(table, { rng: () => 0.85 })).toEqual(['rare']);
    expect(rollTable(table, { rng: () => 0.95 })).toEqual(['mid']);
  });

  it('unique rolls never repeat and stop when the pool drains', () => {
    const out = rollTable(table, { count: 5, unique: true, rng: () => 0 });
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });

  it('builtins merge with user tables; duplicate is copy-on-write; builtins survive delete', async () => {
    const before = await listTables('p1');
    expect(before.length).toBe(BUILTIN_TABLES.length);

    const copy = await duplicateTable('p1', BUILTIN_TABLES[0]);
    expect(copy.builtinSource).toBe(BUILTIN_TABLES[0].id);
    expect(copy.rows).toEqual(BUILTIN_TABLES[0].rows);

    const mine = await createTable('p1', { name: 'Tavern names', category: 'locations' });
    const all = await listTables('p1');
    expect(all.map((t) => t.name)).toContain('Tavern names');
    expect(all.length).toBe(BUILTIN_TABLES.length + 2);

    await deleteTable(BUILTIN_TABLES[0].id); // no-op by design
    await deleteTable(mine.id);
    const after = await listTables('p1');
    expect(after.length).toBe(BUILTIN_TABLES.length + 1);
  });
});

describe('speed reader engine', () => {
  const text = 'The wind rose, hard and cold. Maren waited.';

  it('tokenises with sentence and clause flags', () => {
    const beats = srTokenise(text);
    expect(beats.map((b) => b.word)).toHaveLength(8);
    expect(beats[2]).toMatchObject({ word: 'rose,', endOfClause: true, endOfSentence: false });
    expect(beats[5]).toMatchObject({ word: 'cold.', endOfSentence: true, sentenceIndex: 0 });
    expect(beats[6]).toMatchObject({ word: 'Maren', sentenceIndex: 1 });
    expect(sentenceOf(beats, 7)).toBe('Maren waited.');
  });

  it('applies the legacy pause multipliers to the base 60000/wpm beat', () => {
    const beats = srTokenise(text);
    // 300 wpm → 200ms base.
    expect(beatDelay(beats[0], 300)).toBe(200);
    expect(beatDelay(beats[2], 300)).toBe(320); // clause ×1.6
    expect(beatDelay(beats[5], 300)).toBe(440); // sentence ×2.2
    expect(beatDelay(beats[5], 300, { sentencePause: false })).toBe(200);
    // Floor at 60 wpm.
    expect(beatDelay(beats[0], 10)).toBe(1000);
    // Long word ×1.4 (letters only, punctuation stripped).
    expect(beatDelay({ word: 'extraordinary', sentenceIndex: 0, endOfSentence: false, endOfClause: false }, 300)).toBe(280);
  });

  it('splits words around a stable pivot letter', () => {
    expect(srSplitWord('a')).toEqual({ before: '', pivot: 'a', after: '' });
    expect(srSplitWord('wind')).toEqual({ before: 'w', pivot: 'i', after: 'nd' });
    expect(srSplitWord('“cold.”')).toEqual({ before: '“c', pivot: 'o', after: 'ld.”' });
  });
});

describe('templates', () => {
  function entity(): Entity {
    const now = Date.now();
    return {
      id: 'e1',
      projectId: 'p1',
      type: 'classes',
      name: 'Plague-surgeon',
      aliases: ['leech'],
      summary: 'Feared healer.',
      status: 'active',
      tags: ['guild'],
      fields: {
        category: 'Functionary',
        role: 'Healer',
        restrictions: ['Enter any afflicted house'],
        firstChapter: 'Ch 3',
        notes: 'Private scribble',
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  it('entity template strips identity + tracking; prefill is flat', async () => {
    const t = await saveEntityTemplate('p1', entity());
    expect(t.entityType).toBe('classes');
    expect(t.fields).toEqual({
      category: 'Functionary',
      role: 'Healer',
      restrictions: ['Enter any afflicted house'],
    });
    const initial = entityInitialFrom(t);
    expect(initial).toMatchObject({ summary: 'Feared healer.', role: 'Healer' });
    expect(initial).not.toHaveProperty('name');
    expect(initial).not.toHaveProperty('firstChapter');
  });

  it('builtin genre starters cover 3 genres × class/race/skill', () => {
    expect(BUILTIN_ENTITY_TEMPLATES).toHaveLength(9);
    const types = new Set(BUILTIN_ENTITY_TEMPLATES.map((t) => t.entityType));
    expect([...types].sort()).toEqual(['classes', 'races', 'skills']);
  });

  it('board template normalises to origin and stamps with remapped ids', async () => {
    const t = await saveBoardTemplate('p1', 'Mystery cluster', [
      { id: 'a', label: 'Victim', x: 100, y: 50 },
      { id: 'b', label: 'Suspect', x: 300, y: 250 },
    ], [{ id: 'x', from: 'a', to: 'b', label: 'accuses', directed: true }]);
    expect(t.cards[0]).toMatchObject({ x: 0, y: 0 });
    expect(t.cards[1]).toMatchObject({ x: 200, y: 200 });

    const stamped = instantiateBoardTemplate(t, { x: 1000, y: 500 });
    expect(stamped.cards[0]).toMatchObject({ label: 'Victim', x: 1000, y: 500 });
    expect(stamped.cards[1]).toMatchObject({ x: 1200, y: 700 });
    // Fresh ids, edges rewired to them.
    expect(stamped.cards[0].id).not.toBe('a');
    expect(stamped.edges[0].from).toBe(stamped.cards[0].id);
    expect(stamped.edges[0].to).toBe(stamped.cards[1].id);
    // Stamping again yields different ids (no collisions).
    const again = instantiateBoardTemplate(t, { x: 0, y: 0 });
    expect(again.cards[0].id).not.toBe(stamped.cards[0].id);
  });
});
