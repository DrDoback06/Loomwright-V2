import { useEffect } from 'react';
import { TopBar } from '@/features/shell/TopBar';
import { LeftRail } from '@/features/shell/LeftRail';
import { MobileNav } from '@/features/shell/MobileNav';
import { PanelDock } from '@/features/shell/PanelDock';
import { ProjectGate } from '@/features/shell/ProjectGate';
import { Toasts } from '@/features/shell/Toasts';
import { useIsMobile } from '@/features/shell/useViewport';
import { useUiStore } from '@/stores/ui';
import { HomePage } from '@/features/home/HomePage';
import { TodaySurface } from '@/features/today/TodaySurface';
import { CommandPalette } from '@/features/search/CommandPalette';
import { HelpDialog } from '@/features/help/HelpDialog';
import { EntityRosterSurface } from '@/features/codex/EntityRosterSurface';
import { EntityEditorDrawer } from '@/features/codex/EntityEditorDrawer';
import { CreateAnythingDialog } from '@/features/generate/CreateAnythingDialog';
import { StagedBundleBar } from '@/features/generate/StagedBundleBar';
import { TrashSurface } from '@/features/system/TrashSurface';
import { ReviewSurface } from '@/features/review/ReviewSurface';
import { MergePreviewDialog } from '@/features/review/MergePreviewDialog';
import { WritersRoom } from '@/features/writers-room/WritersRoom';
import { AtlasSurface } from '@/features/atlas/AtlasSurface';
import { TangleSurface } from '@/features/tangle/TangleSurface';
import { SkillTreesSurface } from '@/features/skill-trees/SkillTreesSurface';
import { SettingsSurface } from '@/features/settings/SettingsSurface';
import { HandoffSurface } from '@/features/handoff/HandoffSurface';
import { RandomTablesSurface } from '@/features/tools/RandomTablesSurface';
import { SpeedReaderSurface } from '@/features/tools/SpeedReaderSurface';
import { TemplatesSurface } from '@/features/tools/TemplatesSurface';

function MainSurface() {
  const route = useUiStore((s) => s.route);
  const codexType = useUiStore((s) => s.codexType);
  switch (route) {
    case 'home':
      return <HomePage />;
    case 'today':
      return <TodaySurface />;
    case 'writers-room':
      return <WritersRoom />;
    case 'codex':
      return <EntityRosterSurface type={codexType} />;
    case 'atlas':
      return <AtlasSurface />;
    case 'tangle':
      return <TangleSurface />;
    case 'skill-trees':
      return <SkillTreesSurface />;
    case 'review':
      return <ReviewSurface />;
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

  // Global Ctrl/Cmd+K opens the command palette anywhere.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalettePurpose('search');
        setPaletteOpen(!useUiStore.getState().paletteOpen);
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
