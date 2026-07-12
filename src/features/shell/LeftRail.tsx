import { useLiveQuery } from 'dexie-react-hooks';
import { countIdentityDecisions } from '@/services/identity-resolution';
import { configuredEntityTypes } from '@/domain/entity-configs';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META } from '@/domain/entity-types';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type RouteId } from '@/stores/ui';

interface NavEntry {
  route: RouteId;
  label: string;
  glyph: string;
  group: 'workspace' | 'panels' | 'tools' | 'utilities';
}

/** Only surfaces that genuinely work are listed. This grows with each
 * milestone — the rebuild renders no dead buttons, ever. */
export const NAV_ENTRIES: NavEntry[] = [
  { route: 'home', label: 'Home', glyph: '⌂', group: 'workspace' },
  { route: 'today', label: 'Today', glyph: '☀', group: 'workspace' },
  { route: 'writers-room', label: "Writer's Room", glyph: '✎', group: 'workspace' },
  { route: 'atlas', label: 'Atlas', glyph: '◇', group: 'workspace' },
  { route: 'tangle', label: 'Tangle', glyph: '✕', group: 'workspace' },
  { route: 'skill-trees', label: 'Skill Trees', glyph: '❋', group: 'workspace' },
  { route: 'random-tables', label: 'Random Tables', glyph: '⚄', group: 'tools' },
  { route: 'speed-reader', label: 'Speed Reader', glyph: '⚡', group: 'tools' },
  { route: 'templates', label: 'Templates', glyph: '⧉', group: 'tools' },
  { route: 'review', label: 'Review', glyph: '☑', group: 'utilities' },
  { route: 'handoff', label: 'AI Handoff', glyph: '⇄', group: 'utilities' },
  { route: 'settings', label: 'Settings', glyph: '⚙', group: 'utilities' },
  { route: 'trash', label: 'Trash', glyph: '♺', group: 'utilities' },
];

const GROUP_LABELS: Record<NavEntry['group'], string> = {
  workspace: 'Workspace',
  panels: 'Codex',
  tools: 'Tools',
  utilities: 'Utilities',
};

export function LeftRail() {
  const route = useUiStore((s) => s.route);
  const setRoute = useUiStore((s) => s.setRoute);
  const codexType = useUiStore((s) => s.codexType);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const expanded = useUiStore((s) => s.leftRailExpanded);
  const toggleLeftRail = useUiStore((s) => s.toggleLeftRail);
  const reviewCount = useLiveQuery(
    async () => (projectId ? countIdentityDecisions(projectId) : 0),
    [projectId],
    0
  );
  const groups: NavEntry['group'][] = ['workspace', 'panels', 'tools', 'utilities'];

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
      {groups.map((group) => {
        if (group === 'panels') {
          const types = ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t));
          return (
            <div key={group}>
              {expanded ? <div className="lw-leftrail__group">{GROUP_LABELS[group]}</div> : null}
              {types.map((type) => {
                const meta = ENTITY_TYPE_META[type];
                const current = route === 'codex' && codexType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className="lw-navitem"
                    title={meta.plural}
                    aria-label={meta.plural}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      setCodexType(type);
                      setRoute('codex');
                    }}
                  >
                    <span aria-hidden style={{ color: meta.color }}>
                      {meta.glyph}
                    </span>
                    {expanded ? <span className="lw-navitem__label">{meta.plural}</span> : null}
                  </button>
                );
              })}
            </div>
          );
        }
        const entries = NAV_ENTRIES.filter((e) => e.group === group);
        if (entries.length === 0) return null;
        return (
          <div key={group}>
            {expanded ? <div className="lw-leftrail__group">{GROUP_LABELS[group]}</div> : null}
            {entries.map((entry) => (
              <button
                key={entry.route}
                type="button"
                className="lw-navitem"
                title={entry.label}
                aria-label={entry.label}
                aria-current={route === entry.route ? 'page' : undefined}
                onClick={() => setRoute(entry.route)}
              >
                <span aria-hidden>{entry.glyph}</span>
                {expanded ? <span className="lw-navitem__label">{entry.label}</span> : null}
                {entry.route === 'review' && reviewCount > 0 ? (
                  <span className="lw-navbadge" aria-label={`${reviewCount} pending`}>
                    {reviewCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
