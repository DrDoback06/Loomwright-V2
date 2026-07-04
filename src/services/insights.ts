import { db } from '@/db/schema';
import type { Entity } from '@/db/types';

/** Local calendar day, e.g. "2026-07-04". */
export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface WordsBaseline {
  date: string;
  words: number;
}

/** Arm today's word-count baseline: the first total we see each calendar
 * day becomes the zero line, so "words today" = current total − baseline.
 * Idempotent; call from any surface that shows the number. */
export async function ensureWordsBaseline(projectId: string, currentTotal: number): Promise<void> {
  const key = `${projectId}:wordsBaseline`;
  const row = await db.uiState.get(key);
  const baseline = row?.value as WordsBaseline | undefined;
  if (!baseline || baseline.date !== todayKey()) {
    await db.uiState.put({ key, value: { date: todayKey(), words: currentTotal } });
  }
}

/** Words written today (never negative — deleting prose doesn't count
 * against you). Returns 0 until the baseline is armed. */
export async function getWordsToday(projectId: string, currentTotal: number): Promise<number> {
  const row = await db.uiState.get(`${projectId}:wordsBaseline`);
  const baseline = row?.value as WordsBaseline | undefined;
  if (!baseline || baseline.date !== todayKey()) return 0;
  return Math.max(0, currentTotal - baseline.words);
}

export interface QuestStepRow {
  text: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
}

export interface QuestSuggestion {
  quest: Entity;
  step: QuestStepRow;
  stepIndex: number;
}

/** The next actionable step per quest: the first 'active' step, else the
 * first 'pending' one. Fully-done quests produce nothing. */
export function nextQuestSteps(quests: Entity[]): QuestSuggestion[] {
  const out: QuestSuggestion[] = [];
  for (const quest of quests) {
    const steps = (quest.fields.steps as QuestStepRow[] | undefined) ?? [];
    let pick = steps.findIndex((s) => s.status === 'active');
    if (pick === -1) pick = steps.findIndex((s) => s.status === 'pending');
    if (pick !== -1) out.push({ quest, step: steps[pick], stepIndex: pick });
  }
  return out;
}
