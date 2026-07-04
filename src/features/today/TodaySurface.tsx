import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { countPendingCandidates } from '@/db/repos/review';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { ensureWordsBaseline, nextQuestSteps, todayKey } from '@/services/insights';
import { useFocusStore } from '@/stores/focus';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today: what to work on now. Every card is a real door — continue the
 * latest chapter, clear the review queue, advance a quest, dust off a
 * neglected entity. */
export function TodaySurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const requestChapter = useUiStore((s) => s.requestChapter);
  const setFocus = useFocusStore((s) => s.setFocus);

  const chapters = useLiveQuery(
    async () => (projectId ? db.chapters.where('projectId').equals(projectId).toArray() : []),
    [projectId],
    null
  );
  const totalWords = chapters?.reduce((sum, c) => sum + c.wordCount, 0) ?? null;

  // Arm the daily baseline (a write, so it lives outside the live query).
  useEffect(() => {
    if (projectId && totalWords !== null) void ensureWordsBaseline(projectId, totalWords);
  }, [projectId, totalWords]);

  const wordsToday = useLiveQuery(
    async () => {
      if (!projectId || totalWords === null) return 0;
      const row = await db.uiState.get(`${projectId}:wordsBaseline`);
      const baseline = row?.value as { date: string; words: number } | undefined;
      if (!baseline || baseline.date !== todayKey()) return 0;
      return Math.max(0, totalWords - baseline.words);
    },
    [projectId, totalWords],
    0
  );

  const pendingReview = useLiveQuery(
    async () => (projectId ? countPendingCandidates(projectId) : 0),
    [projectId],
    0
  );

  const questSuggestions = useLiveQuery(
    async () => {
      if (!projectId) return [];
      const quests = await db.entities
        .where('[projectId+type]')
        .equals([projectId, 'quests'])
        .toArray();
      return nextQuestSteps(quests.filter((q) => q.status === 'active')).slice(0, 4);
    },
    [projectId],
    []
  );

  const dusty = useLiveQuery(
    async () => {
      if (!projectId) return [];
      const all = await db.entities.where('projectId').equals(projectId).toArray();
      const cutoff = Date.now() - 2 * DAY_MS;
      return all
        .filter((e) => e.status === 'active' && e.updatedAt < cutoff)
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .slice(0, 3);
    },
    [projectId],
    []
  );

  if (!projectId || chapters === null) return null;

  const latestChapter =
    chapters.length > 0
      ? chapters.reduce((best, c) => (c.updatedAt > best.updatedAt ? c : best))
      : null;

  const openEntity = (e: { id: string; type: keyof typeof ENTITY_TYPE_META; name: string }) => {
    setFocus({ id: e.id, type: e.type, name: e.name });
    setCodexType(e.type);
    setRoute('codex');
  };

  return (
    <div className="lw-page" data-testid="surface-today">
      <div>
        <h1 className="lw-page__title">Today</h1>
        <p className="lw-page__subtitle">Where the work is. Every card takes you straight there.</p>
      </div>

      <div className="lw-statrow">
        <div className="lw-card lw-stattile" data-testid="words-today">
          <span className="lw-stattile__value">{wordsToday.toLocaleString()}</span>
          <span className="lw-stattile__label">Words today</span>
        </div>
        <div className="lw-card lw-stattile">
          <span className="lw-stattile__value">{(totalWords ?? 0).toLocaleString()}</span>
          <span className="lw-stattile__label">Total words</span>
        </div>
        <button
          type="button"
          className="lw-card lw-stattile"
          onClick={() => setRoute('review')}
          data-testid="today-review"
        >
          <span className="lw-stattile__value">{pendingReview}</span>
          <span className="lw-stattile__label">Awaiting review</span>
        </button>
      </div>

      <div className="lw-card">
        <h2 className="lw-card__title">Pick up the pen</h2>
        {latestChapter ? (
          <button
            type="button"
            className="lw-suggestion"
            onClick={() => {
              requestChapter(latestChapter.id);
              setRoute('writers-room');
            }}
          >
            <span aria-hidden className="lw-suggestion__glyph">✎</span>
            <span className="lw-suggestion__text">
              <span className="lw-suggestion__title">Continue “{latestChapter.title}”</span>
              <span className="lw-suggestion__sub">
                {latestChapter.wordCount.toLocaleString()} words so far
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="lw-suggestion"
            onClick={() => setRoute('writers-room')}
          >
            <span aria-hidden className="lw-suggestion__glyph">✎</span>
            <span className="lw-suggestion__text">
              <span className="lw-suggestion__title">Start your first chapter</span>
              <span className="lw-suggestion__sub">The Writer&apos;s Room is ready.</span>
            </span>
          </button>
        )}
      </div>

      <div className="lw-card">
        <h2 className="lw-card__title">Open quest threads</h2>
        {questSuggestions.length === 0 ? (
          <p className="lw-empty__note">
            No quests with open steps. Quests you create in the codex surface their next step
            here.
          </p>
        ) : (
          <div className="lw-suggestions">
            {questSuggestions.map((s) => (
              <button
                key={s.quest.id}
                type="button"
                className="lw-suggestion"
                onClick={() => openEntity(s.quest)}
              >
                <span aria-hidden className="lw-suggestion__glyph" style={{ color: ENTITY_TYPE_META.quests.color }}>
                  {ENTITY_TYPE_META.quests.glyph}
                </span>
                <span className="lw-suggestion__text">
                  <span className="lw-suggestion__title">{s.quest.name}</span>
                  <span className="lw-suggestion__sub">
                    Step {s.stepIndex + 1}: {s.step.text}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lw-card">
        <h2 className="lw-card__title">Gathering dust</h2>
        {dusty.length === 0 ? (
          <p className="lw-empty__note">
            Everything in the codex has been touched recently. Entities left alone for a couple
            of days show up here.
          </p>
        ) : (
          <div className="lw-suggestions">
            {dusty.map((e) => (
              <button key={e.id} type="button" className="lw-suggestion" onClick={() => openEntity(e)}>
                <span
                  aria-hidden
                  className="lw-suggestion__glyph"
                  style={{ color: ENTITY_TYPE_META[e.type].color }}
                >
                  {ENTITY_TYPE_META[e.type].glyph}
                </span>
                <span className="lw-suggestion__text">
                  <span className="lw-suggestion__title">{e.name}</span>
                  <span className="lw-suggestion__sub">
                    {ENTITY_TYPE_META[e.type].label} · untouched since{' '}
                    {new Date(e.updatedAt).toLocaleDateString()}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
