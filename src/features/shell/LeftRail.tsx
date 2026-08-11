import { useLiveQuery } from 'dexie-react-hooks';
import { countPendingCandidates } from '@/db/repos/review';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type RouteId } from '@/stores/ui';

interface NavEntry {
  route: RouteId;
  label: string;
  glyph: string;
  hint: string;
}

/** Four destinations, not twenty-nine rail slots.
 *
 * Nothing was removed — the sixteen codex types became a filter strip
 * inside Codex, the three canvases became sub-views of Worlds, and the
 * dashboard, Today and the review queue became sub-views of Insights.
 * Settings, Trash, Import & Extract and the three tools are reached from
 * the command palette and Settings ▸ Tools: deferred, never hidden.
 *
 * A rail entry appears when its surface genuinely works, and not before. */
export const NAV_ENTRIES: NavEntry[] = [
  { route: 'write', label: 'Write', glyph: '✎', hint: 'The manuscript' },
  { route: 'plan', label: 'Plan', glyph: '▦', hint: 'Outline, Board, Matrix, Timeline' },
  { route: 'codex', label: 'Codex', glyph: '◈', hint: 'Everything your story knows' },
  { route: 'insights', label: 'Insights', glyph: '◔', hint: 'Overview, Today, Review' },
  { route: 'worlds', label: 'Worlds', glyph: '◇', hint: 'Atlas, Tangle, Skill Trees' },
];

export function LeftRail() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const expanded = useUiStore((s) => s.leftRailExpanded);
  const toggleLeftRail = useUiStore((s) => s.toggleLeftRail);
  const reviewCount = useLiveQuery(
    async () => (projectId ? countPendingCandidates(projectId) : 0),
    [projectId],
    0
  );

  return (
    <nav
      className={expanded ? 'lw-leftrail lw-leftrail--expanded' : 'lw-leftrail lw-leftrail--collapsed'}
      aria-label="Workspace"
    >
      <div className="lw-leftrail__head">
        {expanded ? <strong>Navigate</strong> : <span aria-hidden>LW</span>}
        <button
          type="button"
          className="lw-iconbtn"
          onClick={toggleLeftRail}
          aria-label={expanded ? 'Collapse left navigation' : 'Expand left navigation'}
          title={expanded ? 'Collapse left navigation' : 'Expand left navigation'}
        >
          {expanded ? '‹' : '›'}
        </button>
      </div>

      {NAV_ENTRIES.map((entry) => (
        <button
          key={entry.route}
          type="button"
          className="lw-navitem lw-navitem--dest"
          title={`${entry.label} — ${entry.hint}`}
          aria-label={entry.label}
          aria-current={route === entry.route ? 'page' : undefined}
          onClick={() => setRoute(entry.route)}
        >
          <span aria-hidden>{entry.glyph}</span>
          {expanded ? <span className="lw-navitem__label">{entry.label}</span> : null}
          {entry.route === 'insights' && reviewCount > 0 ? (
            <span className="lw-navbadge" aria-label={`${reviewCount} pending`}>
              {reviewCount}
            </span>
          ) : null}
        </button>
      ))}

      <div className="lw-leftrail__spacer" />

      <button
        type="button"
        className="lw-navitem"
        title="Everything else — Ctrl+K"
        aria-label="More"
        onClick={() => {
          useUiStore.getState().setPalettePurpose('search');
          useUiStore.getState().setPaletteOpen(true);
        }}
      >
        <span aria-hidden>⌘</span>
        {expanded ? <span className="lw-navitem__label">More…</span> : null}
      </button>
      <button
        type="button"
        className="lw-navitem"
        title="Settings"
        aria-label="Settings"
        aria-current={route === 'settings' ? 'page' : undefined}
        onClick={() => setRoute('settings')}
      >
        <span aria-hidden>⚙</span>
        {expanded ? <span className="lw-navitem__label">Settings</span> : null}
      </button>
    </nav>
  );
}
