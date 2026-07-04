import { useUiStore } from '@/stores/ui';
import { NAV_ENTRIES } from './LeftRail';
import { configuredEntityTypes } from '@/domain/entity-configs';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META } from '@/domain/entity-types';

/** Phone bottom nav: horizontally scrollable, every surface reachable.
 * M11 replaces the tail with Browse/More sheets. */
export function MobileNav() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);
  const codexType = useUiStore((s) => s.codexType);
  const setCodexType = useUiStore((s) => s.setCodexType);

  const workspace = NAV_ENTRIES.filter((e) => e.group === 'workspace');
  const utilities = NAV_ENTRIES.filter((e) => e.group === 'utilities');
  const types = ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t));

  return (
    <nav className="lw-bottomnav" aria-label="Workspace">
      {workspace.map((entry) => (
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
      {types.map((type) => {
        const meta = ENTITY_TYPE_META[type];
        const current = route === 'codex' && codexType === type;
        return (
          <button
            key={type}
            type="button"
            className="lw-bottomnav__item"
            aria-current={current ? 'page' : undefined}
            onClick={() => {
              setCodexType(type);
              setRoute('codex');
            }}
          >
            <span aria-hidden>{meta.glyph}</span>
            {meta.plural}
          </button>
        );
      })}
      {utilities.map((entry) => (
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
