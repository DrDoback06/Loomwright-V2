import { TopBar } from '@/features/shell/TopBar';
import { LeftRail } from '@/features/shell/LeftRail';
import { MobileNav } from '@/features/shell/MobileNav';
import { PanelDock } from '@/features/shell/PanelDock';
import { ProjectGate } from '@/features/shell/ProjectGate';
import { Toasts } from '@/features/shell/Toasts';
import { useIsMobile } from '@/features/shell/useViewport';
import { useUiStore } from '@/stores/ui';
import { HomePage } from '@/features/home/HomePage';
import { EntityRosterSurface } from '@/features/codex/EntityRosterSurface';
import { EntityEditorDrawer } from '@/features/codex/EntityEditorDrawer';
import { TrashSurface } from '@/features/system/TrashSurface';
import { ReviewSurface } from '@/features/review/ReviewSurface';
import { WritersRoom } from '@/features/writers-room/WritersRoom';
import { AtlasSurface } from '@/features/atlas/AtlasSurface';
import { TangleSurface } from '@/features/tangle/TangleSurface';
import { SkillTreesSurface } from '@/features/skill-trees/SkillTreesSurface';
import { SettingsSurface } from '@/features/settings/SettingsSurface';
import { HandoffSurface } from '@/features/handoff/HandoffSurface';

function MainSurface() {
  const route = useUiStore((s) => s.route);
  const codexType = useUiStore((s) => s.codexType);
  switch (route) {
    case 'home':
      return <HomePage />;
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
  }
}

export function App() {
  const isMobile = useIsMobile();

  return (
    <ProjectGate>
      <div className={isMobile ? 'lw-shell lw-shell--mobile' : 'lw-shell lw-shell--docked'}>
        <TopBar />
        {!isMobile && <LeftRail />}
        <main className="lw-main">
          <MainSurface />
        </main>
        {!isMobile && <PanelDock />}
        {isMobile && <MobileNav />}
      </div>
      <EntityEditorDrawer />
      <Toasts />
    </ProjectGate>
  );
}
