import { useEffect } from 'react';
import { TopBar } from '@/features/shell/TopBar';
import { LeftRail, NAV_ENTRIES } from '@/features/shell/LeftRail';
import { MobileNav } from '@/features/shell/MobileNav';
import { PanelDock } from '@/features/shell/PanelDock';
import { ProjectGate } from '@/features/shell/ProjectGate';
import { Toasts } from '@/features/shell/Toasts';
import { useIsMobile } from '@/features/shell/useViewport';
import { useUiStore } from '@/stores/ui';
import { CommandPalette } from '@/features/search/CommandPalette';
import { HelpDialog } from '@/features/help/HelpDialog';
import { CodexSurface } from '@/features/codex/CodexSurface';
import { InsightsSurface } from '@/features/insights/InsightsSurface';
import { WorldsSurface } from '@/features/worlds/WorldsSurface';
import { EntityEditorDrawer } from '@/features/codex/EntityEditorDrawer';
import { CreateAnythingDialog } from '@/features/generate/CreateAnythingDialog';
import { StagedBundleBar } from '@/features/generate/StagedBundleBar';
import { StagedDeltaBar } from '@/features/review/StagedDeltaBar';
import { TrashSurface } from '@/features/system/TrashSurface';
import { MergePreviewDialog } from '@/features/review/MergePreviewDialog';
import { WritersRoom } from '@/features/writers-room/WritersRoom';
import { SettingsSurface } from '@/features/settings/SettingsSurface';
import { HandoffSurface } from '@/features/handoff/HandoffSurface';
import { RandomTablesSurface } from '@/features/tools/RandomTablesSurface';
import { SpeedReaderSurface } from '@/features/tools/SpeedReaderSurface';
import { TemplatesSurface } from '@/features/tools/TemplatesSurface';

/** `setRoute` has already resolved any legacy id to its destination, so
 * the aliased cases below are unreachable in practice — they stay as a
 * belt-and-braces fallback and to keep the switch exhaustive over
 * `RouteId`, which is what makes adding a route a compile error until it
 * is handled. */
function MainSurface() {
  const route = useUiStore((s) => s.route);
  switch (route) {
    case 'write':
    case 'writers-room':
      return <WritersRoom />;
    case 'codex':
      return <CodexSurface />;
    case 'insights':
    case 'home':
    case 'today':
    case 'review':
      return <InsightsSurface />;
    case 'worlds':
    case 'atlas':
    case 'tangle':
    case 'skill-trees':
      return <WorldsSurface />;
    case 'handoff':
      return <HandoffSurface />;
    case 'settings':
      return <SettingsSurface />;
    case 'trash':
      return <TrashSurface />;
    case 'random-tables':
      return <RandomTablesSurface />;
    case 'speed-reader':
      return <SpeedReaderSurface />;
    case 'templates':
      return <TemplatesSurface />;
  }
}

export function App() {
  const isMobile = useIsMobile();
  const paletteOpen = useUiStore((s) => s.paletteOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const helpOpen = useUiStore((s) => s.helpOpen);
  const leftRailExpanded = useUiStore((s) => s.leftRailExpanded);
  const rightDockExpanded = useUiStore((s) => s.rightDockExpanded);
  const setPalettePurpose = useUiStore((s) => s.setPalettePurpose);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);

  // Global Ctrl/Cmd+K opens the command palette anywhere; Alt+1..4 jump
  // straight to a destination. Alt+digit is safe to bind globally — it
  // produces no text in an editor, so it does not need to be gated on
  // focus the way a bare letter accelerator would.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalettePurpose('search');
        setPaletteOpen(!useUiStore.getState().paletteOpen);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const entry = NAV_ENTRIES[Number(e.key) - 1];
        if (entry) {
          e.preventDefault();
          useUiStore.getState().setRoute(entry.route);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setPaletteOpen, setPalettePurpose]);

  return (
    <>
      <ProjectGate>
        <div
          className={
            isMobile
              ? 'lw-shell lw-shell--mobile'
              : [
                  'lw-shell',
                  'lw-shell--docked',
                  leftRailExpanded ? 'lw-shell--left-expanded' : 'lw-shell--left-collapsed',
                  rightDockExpanded ? 'lw-shell--right-expanded' : 'lw-shell--right-collapsed',
                ].join(' ')
          }
        >
          <TopBar />
          {!isMobile && <LeftRail />}
          <main className="lw-main">
            <MainSurface />
          </main>
          {!isMobile && <PanelDock />}
          {isMobile && <MobileNav />}
        </div>
        <EntityEditorDrawer />
        <CreateAnythingDialog />
        <StagedBundleBar />
        <StagedDeltaBar />
        <MergePreviewDialog />
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      </ProjectGate>
      {/* Toasts live outside the gate so the welcome/onboarding flows
          can report progress before any project exists. */}
      <Toasts />
    </>
  );
}
