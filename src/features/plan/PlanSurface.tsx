import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { TimelineView } from '@/features/codex/TimelineView';
import { useFocusStore } from '@/stores/focus';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type PlanView } from '@/stores/ui';
import { usePlanData } from './usePlanData';
import { OutlineView } from './OutlineView';
import { BoardView } from './BoardView';
import { MatrixView } from './MatrixView';

const VIEWS: { id: PlanView; label: string; glyph: string }[] = [
  { id: 'outline', label: 'Outline', glyph: '☰' },
  { id: 'board', label: 'Board', glyph: '▤' },
  { id: 'matrix', label: 'Matrix', glyph: '▦' },
  { id: 'timeline', label: 'Timeline', glyph: '↔' },
];

/** Four projections of one set of scenes.
 *
 * Every view reads `usePlanData` and writes back through the scenes repo,
 * so there is no second copy of the manuscript to fall out of step — the
 * failure mode of every plan-alongside-prose tool. */
export function PlanSurface() {
  const view = useUiStore((s) => s.planView);
  const setView = useUiStore((s) => s.setPlanView);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const requestChapter = useUiStore((s) => s.requestChapter);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setFocus = useFocusStore((s) => s.setFocus);
  const data = usePlanData();

  // The Writer's Room opens by chapter; a scene resolves to the chapter
  // that holds it, and the strip then adopts the chapter's first scene.
  const openScene = (sceneId: string) => {
    const chapter = data.chapterOf.get(sceneId);
    if (chapter) requestChapter(chapter.id);
    setRoute('writers-room');
  };

  const timelineEntities = useLiveQuery(
    async () =>
      projectId
        ? (await db.entities.where('[projectId+type]').equals([projectId, 'timeline']).toArray())
            .filter((e) => e.status === 'active')
        : [],
    [projectId],
    []
  );

  return (
    <div className="lw-dest" data-testid="surface-plan">
      <div className="lw-subnav" role="tablist" aria-label="Plan views">
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

      <div className="lw-dest__body lw-plan__body">
        {data.loading ? null : view === 'outline' ? (
          <OutlineView data={data} onOpenScene={openScene} />
        ) : view === 'board' ? (
          <BoardView data={data} onOpenScene={openScene} />
        ) : view === 'matrix' ? (
          <MatrixView data={data} onOpenScene={openScene} />
        ) : (
          <div className="lw-plan__timeline" data-testid="plan-timeline">
            <TimelineView
              type="timeline"
              entities={timelineEntities}
              onSelect={(id) => {
                const entity = timelineEntities.find((e) => e.id === id);
                if (entity) setFocus({ id: entity.id, type: 'timeline', name: entity.name });
                setCodexType('timeline');
                setRoute('codex');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
