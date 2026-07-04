import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { ensureWordsBaseline, getWordsToday, nextQuestSteps, todayKey } from '@/services/insights';
import type { Entity } from '@/db/types';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

function quest(name: string, steps: { text: string; status: string }[]): Entity {
  const now = Date.now();
  return {
    id: name,
    projectId: 'p1',
    type: 'quests',
    name,
    aliases: [],
    summary: '',
    status: 'active',
    tags: [],
    fields: { steps },
    createdAt: now,
    updatedAt: now,
  };
}

describe('words-today baseline', () => {
  it('arms once per day and measures growth from that point', async () => {
    await ensureWordsBaseline('p1', 1000);
    expect(await getWordsToday('p1', 1000)).toBe(0);
    expect(await getWordsToday('p1', 1420)).toBe(420);
    // Re-arming the same day must not move the zero line.
    await ensureWordsBaseline('p1', 1420);
    expect(await getWordsToday('p1', 1420)).toBe(420);
    // Deleting prose never goes negative.
    expect(await getWordsToday('p1', 900)).toBe(0);
  });

  it('a stale baseline from another day reads as zero until re-armed', async () => {
    await db.uiState.put({ key: 'p1:wordsBaseline', value: { date: '2001-01-01', words: 50 } });
    expect(await getWordsToday('p1', 5000)).toBe(0);
    await ensureWordsBaseline('p1', 5000);
    const row = await db.uiState.get('p1:wordsBaseline');
    expect(row?.value).toEqual({ date: todayKey(), words: 5000 });
  });
});

describe('nextQuestSteps', () => {
  it('prefers the active step, falls back to first pending, skips finished quests', () => {
    const out = nextQuestSteps([
      quest('Find the auger', [
        { text: 'Reach the coast', status: 'done' },
        { text: 'Bribe the ferryman', status: 'active' },
        { text: 'Cross at night', status: 'pending' },
      ]),
      quest('Crown the heir', [
        { text: 'Gather the banners', status: 'pending' },
        { text: 'March on the keep', status: 'pending' },
      ]),
      quest('Old business', [{ text: 'All wrapped up', status: 'done' }]),
      quest('No steps yet', []),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ stepIndex: 1, step: { text: 'Bribe the ferryman' } });
    expect(out[1]).toMatchObject({ stepIndex: 0, step: { text: 'Gather the banners' } });
  });
});
