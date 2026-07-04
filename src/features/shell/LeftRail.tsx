import { useUiStore, type RouteId } from '@/stores/ui';

interface NavEntry {
  route: RouteId;
  label: string;
  glyph: string;
  group: 'workspace' | 'panels' | 'utilities';
}

/** Only surfaces that genuinely work are listed. This grows with each
 * milestone — the rebuild renders no dead buttons, ever. */
export const NAV_ENTRIES: NavEntry[] = [
  { route: 'home', label: 'Home', glyph: '⌂', group: 'workspace' },
  { route: 'writers-room', label: "Writer's Room", glyph: '✎', group: 'workspace' },
  { route: 'cast', label: 'Cast', glyph: '◐', group: 'panels' },
  { route: 'trash', label: 'Trash', glyph: '♺', group: 'utilities' },
];

const GROUP_LABELS: Record<NavEntry['group'], string> = {
  workspace: 'Workspace',
  panels: 'Codex',
  utilities: 'Utilities',
};

export function LeftRail() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);
  const groups: NavEntry['group'][] = ['workspace', 'panels', 'utilities'];

  return (
    <nav className="lw-leftrail" aria-label="Workspace">
      {groups.map((group) => {
        const entries = NAV_ENTRIES.filter((e) => e.group === group);
        if (entries.length === 0) return null;
        return (
          <div key={group}>
            <div className="lw-leftrail__group">{GROUP_LABELS[group]}</div>
            {entries.map((entry) => (
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
          </div>
        );
      })}
    </nav>
  );
}
