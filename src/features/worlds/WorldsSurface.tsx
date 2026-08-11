import { AtlasSurface } from '@/features/atlas/AtlasSurface';
import { TangleSurface } from '@/features/tangle/TangleSurface';
import { SkillTreesSurface } from '@/features/skill-trees/SkillTreesSurface';
import { useUiStore, type WorldsView } from '@/stores/ui';

const VIEWS: { id: WorldsView; label: string; glyph: string }[] = [
  { id: 'atlas', label: 'Atlas', glyph: '◇' },
  { id: 'tangle', label: 'Tangle', glyph: '✕' },
  { id: 'trees', label: 'Skill Trees', glyph: '❋' },
];

/** The three worldbuilding canvases behind one destination. They were
 * three rail slots competing with the manuscript for attention; they are
 * one place you go when you are building the world rather than writing
 * it. Each view is the original surface, unchanged. */
export function WorldsSurface() {
  const view = useUiStore((s) => s.worldsView);
  const setView = useUiStore((s) => s.setWorldsView);

  return (
    <div className="lw-dest" data-testid="surface-worlds">
      <div className="lw-subnav" role="tablist" aria-label="Worlds views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            className={v.id === view ? 'lw-subnav__tab lw-subnav__tab--active' : 'lw-subnav__tab'}
            aria-selected={v.id === view}
            onClick={() => setView(v.id)}
          >
            <span aria-hidden>{v.glyph}</span>
            {v.label}
          </button>
        ))}
      </div>
      <div className="lw-dest__body">
        {view === 'atlas' && <AtlasSurface />}
        {view === 'tangle' && <TangleSurface />}
        {view === 'trees' && <SkillTreesSurface />}
      </div>
    </div>
  );
}
