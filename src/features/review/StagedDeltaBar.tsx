import { deltaTitle } from '@/services/intelligence/types';
import { useIntelligenceStore } from '@/stores/intelligence';
import { useUiStore } from '@/stores/ui';

/**
 * Global bar shown whenever a story-intelligence delta is staged.
 *
 * Without it the only pointer to a freshly extracted cascade was a toast that
 * self-destructs after six seconds: the board renders solely inside the Review
 * route, no nav badge reads the intelligence store, and staging a second delta
 * replaces the first outright. Miss the toast and the work was simply gone.
 *
 * This mirrors StagedBundleBar, which exists for exactly the same reason on the
 * generation side — "nothing can get stuck even on surfaces that don't
 * ghost-render". Nothing is written to Dexie until Accept on the board itself.
 */
export function StagedDeltaBar() {
  const staged = useIntelligenceStore((s) => s.staged);
  const discard = useIntelligenceStore((s) => s.discard);
  const progress = useIntelligenceStore((s) => s.progress);
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);

  if (!staged) return null;
  // The board itself is on screen — it is its own bar there.
  if (route === 'review') return null;

  const groups = staged.groups.length;

  return (
    <div
      className="lw-stagedbar"
      data-testid="staged-delta-bar"
      role="region"
      aria-label="Extracted changes waiting for review"
    >
      <span className="lw-stagedbar__label">
        <span aria-hidden>⌘</span>{' '}
        {progress
          ? `Reading section ${progress.done} of ${progress.total}…`
          : `${groups} change${groups === 1 ? '' : 's'} to review — ${deltaTitle(staged)}`}
      </span>
      <span className="lw-stagedbar__actions">
        <button
          type="button"
          className="lw-btn lw-btn--primary"
          onClick={() => setRoute('review')}
          data-testid="staged-delta-review"
        >
          Review
        </button>
        <button type="button" className="lw-btn" onClick={discard}>
          Discard
        </button>
      </span>
    </div>
  );
}
