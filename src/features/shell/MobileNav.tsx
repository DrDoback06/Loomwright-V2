import { useUiStore } from '@/stores/ui';
import { NAV_ENTRIES } from './LeftRail';

export function MobileNav() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);

  return (
    <nav className="lw-bottomnav" aria-label="Workspace">
      {NAV_ENTRIES.map((entry) => (
        <button
          key={entry.route}
          type="button"
          className="lw-bottomnav__item"
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
