import { useLiveQuery } from 'dexie-react-hooks';
import { HomePage } from '@/features/home/HomePage';
import { TodaySurface } from '@/features/today/TodaySurface';
import { ReviewSurface } from '@/features/review/ReviewSurface';
import { countPendingCandidates } from '@/db/repos/review';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type InsightsView } from '@/stores/ui';

const VIEWS: { id: InsightsView; label: string; glyph: string }[] = [
  { id: 'overview', label: 'Overview', glyph: '⌂' },
  { id: 'today', label: 'Today', glyph: '☀' },
  { id: 'review', label: 'Review', glyph: '☑' },
];

/** Everything the app knows *about* your project, as opposed to the
 * project itself: the dashboard, what to work on now, and the extraction
 * queue. Story health, nudges and momentum join this switcher in
 * N11–N13 — this is the shape they slot into. */
export function InsightsSurface() {
  const view = useUiStore((s) => s.insightsView);
  const setView = useUiStore((s) => s.setInsightsView);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const reviewCount = useLiveQuery(
    async () => (projectId ? countPendingCandidates(projectId) : 0),
    [projectId],
    0
  );

  return (
    <div className="lw-dest" data-testid="surface-insights">
      <div className="lw-subnav" role="tablist" aria-label="Insights views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            className={v.id === view ? 'lw-subnav__tab lw-subnav__tab--active' : 'lw-subnav__tab'}
            aria-selected={v.id === view}
            onClick={() => setView(v.id)}
          >
            <span aria-hidden>{v.glyph}</span>
            {v.label}
            {v.id === 'review' && reviewCount > 0 ? (
              <span className="lw-navbadge" aria-label={`${reviewCount} pending`}>
                {reviewCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="lw-dest__body">
        {view === 'overview' && <HomePage />}
        {view === 'today' && <TodaySurface />}
        {view === 'review' && <ReviewSurface />}
      </div>
    </div>
  );
}
