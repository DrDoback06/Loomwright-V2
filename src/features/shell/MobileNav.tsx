import { useLiveQuery } from 'dexie-react-hooks';
import { countPendingCandidates } from '@/db/repos/review';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type RouteId } from '@/stores/ui';
import { NAV_ENTRIES } from '@/features/shell/LeftRail';

/** Phone bottom nav. The same destinations as the rail plus a palette
 * tab — no Browse/More sheets any more, because there is nothing left to
 * hide behind them: codex types live in the Codex filter strip and the
 * canvases live in Worlds. */
export function MobileNav() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setPalettePurpose = useUiStore((s) => s.setPalettePurpose);
  const projectId = useProjectStore((s) => s.currentProjectId);

  const reviewCount = useLiveQuery(
    async () => (projectId ? countPendingCandidates(projectId) : 0),
    [projectId],
    0
  );

  const tab = (r: RouteId, label: string, glyph: string, badge = 0) => (
    <button
      key={r}
      type="button"
      className="lw-bottomnav__item"
      aria-label={label}
      aria-current={route === r ? 'page' : undefined}
      onClick={() => setRoute(r)}
    >
      <span aria-hidden>{glyph}</span>
      {label}
      {badge > 0 ? (
        <span className="lw-navbadge" aria-label={`${badge} pending`}>
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <nav className="lw-bottomnav" aria-label="Workspace">
      {NAV_ENTRIES.map((entry) =>
        tab(entry.route, entry.label, entry.glyph, entry.route === 'insights' ? reviewCount : 0)
      )}
      <button
        type="button"
        className="lw-bottomnav__item"
        aria-label="More"
        onClick={() => {
          setPalettePurpose('search');
          setPaletteOpen(true);
        }}
      >
        <span aria-hidden>⌘</span>
        More
      </button>
    </nav>
  );
}
