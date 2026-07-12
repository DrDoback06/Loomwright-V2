import { useLiveQuery } from 'dexie-react-hooks';
import { countIdentityDecisions } from '@/services/identity-resolution';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { ProjectSwitcher } from './ProjectSwitcher';
import icon from '/icons/loomwright.svg';

export function TopBar() {
  const projectId = useProjectStore((state) => state.currentProjectId);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setPalettePurpose = useUiStore((state) => state.setPalettePurpose);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const setRoute = useUiStore((state) => state.setRoute);
  const leftRailExpanded = useUiStore((state) => state.leftRailExpanded);
  const toggleLeftRail = useUiStore((state) => state.toggleLeftRail);
  const dark = theme === 'midnight-ink';
  const reviewCount = useLiveQuery(
    async () => (projectId ? countIdentityDecisions(projectId) : 0),
    [projectId],
    0
  );

  return (
    <header className="lw-topbar">
      <button
        type="button"
        className="lw-iconbtn lw-topbar__railtoggle"
        onClick={toggleLeftRail}
        aria-label={leftRailExpanded ? 'Collapse left navigation' : 'Expand left navigation'}
        title={leftRailExpanded ? 'Collapse left navigation' : 'Expand left navigation'}
      >
        {leftRailExpanded ? '‹' : '›'}
      </button>
      <div className="lw-brand">
        <img className="lw-brand__seal" src={icon} alt="" />
        <span className="lw-brand__name">Loomwright</span>
        <span className="lw-brand__tag">Shape the book. Track the world.</span>
      </div>
      <ProjectSwitcher />
      <div className="lw-topbar__spacer" />
      <button
        type="button"
        className={reviewCount > 0 ? 'lw-topbar__review lw-topbar__review--pending' : 'lw-topbar__review'}
        onClick={() => setRoute('review')}
        aria-label={`Open review queue${reviewCount > 0 ? `, ${reviewCount} pending` : ''}`}
        title="Open the Review Queue"
      >
        <span aria-hidden>☑</span>
        <span>Review</span>
        {reviewCount > 0 ? <span className="lw-navbadge">{reviewCount}</span> : null}
      </button>
      <button
        type="button"
        className="lw-iconbtn"
        onClick={() => {
          setPalettePurpose('search');
          setPaletteOpen(true);
        }}
        aria-label="Search (Ctrl+K)"
        title="Search everything (Ctrl+K)"
      >
        ⌕
      </button>
      <button
        type="button"
        className="lw-iconbtn"
        onClick={() => setHelpOpen(true)}
        aria-label="Help for this surface"
        title="Help for this surface"
      >
        ?
      </button>
      <button
        type="button"
        className="lw-iconbtn"
        onClick={toggleTheme}
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {dark ? '☀' : '☾'}
      </button>
    </header>
  );
}
