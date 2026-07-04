import { TopBar } from '@/features/shell/TopBar';
import { LeftRail } from '@/features/shell/LeftRail';
import { MobileNav } from '@/features/shell/MobileNav';
import { ProjectGate } from '@/features/shell/ProjectGate';
import { Toasts } from '@/features/shell/Toasts';
import { useIsMobile } from '@/features/shell/useViewport';
import { useUiStore } from '@/stores/ui';
import { HomePage } from '@/features/home/HomePage';
import { EntityRosterSurface } from '@/features/codex/EntityRosterSurface';
import { EntityEditorDrawer } from '@/features/codex/EntityEditorDrawer';
import { TrashSurface } from '@/features/system/TrashSurface';
import { WritersRoom } from '@/features/writers-room/WritersRoom';

function MainSurface() {
  const route = useUiStore((s) => s.route);
  switch (route) {
    case 'home':
      return <HomePage />;
    case 'writers-room':
      return <WritersRoom />;
    case 'cast':
      return <EntityRosterSurface type="cast" />;
    case 'trash':
      return <TrashSurface />;
  }
}

export function App() {
  const isMobile = useIsMobile();

  return (
    <ProjectGate>
      <div className={isMobile ? 'lw-shell lw-shell--mobile' : 'lw-shell'}>
        <TopBar />
        {!isMobile && <LeftRail />}
        <main className="lw-main">
          <MainSurface />
        </main>
        {isMobile && <MobileNav />}
      </div>
      <EntityEditorDrawer />
      <Toasts />
    </ProjectGate>
  );
}
