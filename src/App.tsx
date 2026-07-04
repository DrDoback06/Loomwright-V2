import { TopBar } from '@/features/shell/TopBar';
import { LeftRail } from '@/features/shell/LeftRail';
import { MobileNav } from '@/features/shell/MobileNav';
import { useIsMobile } from '@/features/shell/useViewport';
import { useUiStore } from '@/stores/ui';
import { HomePage } from '@/features/home/HomePage';

function MainSurface() {
  const route = useUiStore((s) => s.route);
  switch (route) {
    case 'home':
      return <HomePage />;
  }
}

export function App() {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? 'lw-shell lw-shell--mobile' : 'lw-shell'}>
      <TopBar />
      {!isMobile && <LeftRail />}
      <main className="lw-main">
        <MainSurface />
      </main>
      {isMobile && <MobileNav />}
    </div>
  );
}
