import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { countPendingCandidates } from '@/db/repos/review';
import { configuredEntityTypes } from '@/domain/entity-configs';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META } from '@/domain/entity-types';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type RouteId } from '@/stores/ui';

type Sheet = 'browse' | 'more' | null;

const MORE_ENTRIES: { route: RouteId; label: string; glyph: string }[] = [
  { route: 'atlas', label: 'Atlas', glyph: '◇' },
  { route: 'tangle', label: 'Tangle', glyph: '✕' },
  { route: 'skill-trees', label: 'Skill Trees', glyph: '❋' },
  { route: 'random-tables', label: 'Random Tables', glyph: '⚄' },
  { route: 'speed-reader', label: 'Speed Reader', glyph: '⚡' },
  { route: 'templates', label: 'Templates', glyph: '⧉' },
  { route: 'review', label: 'Review', glyph: '☑' },
  { route: 'handoff', label: 'Import & Extract', glyph: '⇄' },
  { route: 'settings', label: 'Settings', glyph: '⚙' },
  { route: 'trash', label: 'Trash', glyph: '♺' },
];

const MORE_ROUTES = new Set<RouteId>(MORE_ENTRIES.map((e) => e.route));

/** Phone bottom nav: five fixed tabs. Browse opens the codex sheet
 * (all 16 types); More opens canvases, tools, and utilities. */
export function MobileNav() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);
  const codexType = useUiStore((s) => s.codexType);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const [sheet, setSheet] = useState<Sheet>(null);

  const reviewCount = useLiveQuery(
    async () => (projectId ? countPendingCandidates(projectId) : 0),
    [projectId],
    0
  );

  const types = ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t));

  const go = (r: RouteId) => {
    setRoute(r);
    setSheet(null);
  };

  const tab = (r: RouteId, label: string, glyph: string) => (
    <button
      type="button"
      className="lw-bottomnav__item"
      aria-current={route === r && sheet === null ? 'page' : undefined}
      onClick={() => go(r)}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </button>
  );

  return (
    <nav className="lw-bottomnav" aria-label="Workspace">
      {sheet !== null && (
        <div className="lw-sheet-backdrop" role="presentation" onClick={() => setSheet(null)} />
      )}
      {sheet === 'browse' && (
        <div className="lw-sheet" role="menu" aria-label="Browse codex" data-testid="sheet-browse">
          <div className="lw-sheet__handle" aria-hidden />
          <div className="lw-sheet__grid">
            {types.map((type) => {
              const meta = ENTITY_TYPE_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  className="lw-sheet__item"
                  aria-current={route === 'codex' && codexType === type ? 'page' : undefined}
                  onClick={() => {
                    setCodexType(type);
                    go('codex');
                  }}
                >
                  <span aria-hidden style={{ color: meta.color }}>
                    {meta.glyph}
                  </span>
                  {meta.plural}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {sheet === 'more' && (
        <div className="lw-sheet" role="menu" aria-label="More surfaces" data-testid="sheet-more">
          <div className="lw-sheet__handle" aria-hidden />
          <div className="lw-sheet__grid">
            {MORE_ENTRIES.map((entry) => (
              <button
                key={entry.route}
                type="button"
                className="lw-sheet__item"
                aria-current={route === entry.route ? 'page' : undefined}
                onClick={() => go(entry.route)}
              >
                <span aria-hidden>{entry.glyph}</span>
                {entry.label}
                {entry.route === 'review' && reviewCount > 0 ? (
                  <span className="lw-navbadge" aria-label={`${reviewCount} pending`}>
                    {reviewCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab('home', 'Home', '⌂')}
      {tab('today', 'Today', '☀')}
      {tab('writers-room', "Writer's Room", '✎')}
      <button
        type="button"
        className="lw-bottomnav__item"
        aria-expanded={sheet === 'browse'}
        aria-current={route === 'codex' ? 'page' : undefined}
        onClick={() => setSheet(sheet === 'browse' ? null : 'browse')}
      >
        <span aria-hidden>▤</span>
        Browse
      </button>
      <button
        type="button"
        className="lw-bottomnav__item"
        aria-expanded={sheet === 'more'}
        aria-current={MORE_ROUTES.has(route) ? 'page' : undefined}
        onClick={() => setSheet(sheet === 'more' ? null : 'more')}
      >
        <span aria-hidden>⋯</span>
        More
        {reviewCount > 0 && sheet !== 'more' ? <span className="lw-bottomnav__dot" aria-hidden /> : null}
      </button>
    </nav>
  );
}
