import { useUiStore, type RouteId } from '@/stores/ui';

interface NavEntry {
  route: RouteId;
  label: string;
  glyph: string;
}

/** Only surfaces that genuinely work are listed. This grows with each
 * milestone — the rebuild renders no dead buttons, ever. */
export const NAV_ENTRIES: NavEntry[] = [{ route: 'home', label: 'Home', glyph: '⌂' }];

export function LeftRail() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);

  return (
    <nav className="lw-leftrail" aria-label="Workspace">
      <div className="lw-leftrail__group">Workspace</div>
      {NAV_ENTRIES.map((entry) => (
        <button
          key={entry.route}
          type="button"
          className="lw-navitem"
          aria-current={route === entry.route ? 'page' : undefined}
          onClick={() => setRoute(entry.route)}
        >
          <span aria-hidden>{entry.glyph}</span>
          {entry.label}
        </button>
      ))}
    </nav>
  );
}
