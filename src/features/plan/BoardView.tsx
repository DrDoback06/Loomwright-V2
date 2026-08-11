import { useState } from 'react';
import { updateSceneMeta } from '@/db/repos/scenes';
import type { Chapter, Scene, SceneStatus } from '@/db/types';
import { STATUS_META } from '@/features/writers-room/SceneStrip';
import type { PlanData } from './usePlanData';

type GroupBy = 'status' | 'act' | 'chapter' | 'pov';

const STATUSES: SceneStatus[] = ['outline', 'draft', 'revised', 'final'];

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'act', label: 'Act' },
  { id: 'chapter', label: 'Chapter' },
  { id: 'pov', label: 'POV' },
];

/** Scenes as cards in columns.
 *
 * Status is the default grouping because it is the one where moving a card
 * genuinely changes something: dropping a scene into "Final" writes the
 * status. Grouping by chapter or POV is a lens, not an editor, so those
 * columns do not accept drops — a card that looks draggable and silently
 * does nothing is worse than one that does not. */
export function BoardView({ data, onOpenScene }: { data: PlanData; onOpenScene: (id: string) => void }) {
  const [chosen, setChosen] = useState<GroupBy>('status');
  const [dragging, setDragging] = useState<string | null>(null);

  const { acts, scenes, chapters, entityById } = data;
  // Deleting the last act while grouped by it would leave the board on a
  // grouping whose pill is no longer rendered — one column, no way back.
  const groupBy: GroupBy = chosen === 'act' && acts.length === 0 ? 'status' : chosen;

  const columns: { key: string; label: string; scenes: Scene[] }[] =
    groupBy === 'status'
      ? STATUSES.map((status) => ({
          key: status,
          label: STATUS_META[status].label,
          scenes: scenes.filter((s) => s.status === status),
        }))
      : groupBy === 'act'
        ? actColumns(data)
        : groupBy === 'chapter'
          ? chapters.map((chapter) => ({
              key: chapter.id,
              label: chapter.title,
              scenes: scenes.filter((s) => s.chapterId === chapter.id),
            }))
          : povColumns(scenes, entityById);

  return (
    <div className="lw-board" data-testid="plan-board">
      <div className="lw-board__controls">
        <span className="lw-tweak__label" id="board-group">
          Group by
        </span>
        <div className="lw-tweak__options" role="group" aria-labelledby="board-group">
          {/* Act only appears once the book has one. A grouping that can
              only ever produce a single "No act" column is a control that
              does nothing, which this repo does not ship. */}
          {GROUPS.filter((g) => g.id !== 'act' || acts.length > 0).map((group) => (
            <button
              key={group.id}
              type="button"
              className={group.id === groupBy ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={group.id === groupBy}
              onClick={() => setChosen(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
        {groupBy === 'status' ? (
          <p className="lw-fieldnote">Drag a card between columns to change its status.</p>
        ) : (
          <p className="lw-fieldnote">A lens on the same scenes — drag to reorder is off here.</p>
        )}
      </div>

      <div className="lw-board__columns">
        {columns.map((column) => (
          <section
            key={column.key}
            className="lw-boardcol"
            aria-label={column.label}
            onDragOver={(e) => {
              if (groupBy !== 'status' || !dragging) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              if (groupBy !== 'status' || !dragging) return;
              e.preventDefault();
              void updateSceneMeta(dragging, { status: column.key as SceneStatus });
              setDragging(null);
            }}
          >
            <header className="lw-boardcol__head">
              <span>{column.label}</span>
              <span className="lw-boardcol__count">{column.scenes.length}</span>
            </header>
            <div className="lw-boardcol__cards">
              {column.scenes.map((scene) => (
                <article
                  key={scene.id}
                  className="lw-scenecard"
                  draggable={groupBy === 'status'}
                  onDragStart={() => setDragging(scene.id)}
                  onDragEnd={() => setDragging(null)}
                >
                  <button
                    type="button"
                    className="lw-scenecard__open"
                    onClick={() => onOpenScene(scene.id)}
                  >
                    {scene.title}
                  </button>
                  {scene.summary ? (
                    <p className="lw-scenecard__summary">{scene.summary}</p>
                  ) : null}
                  <footer className="lw-scenecard__meta">
                    {scene.pov ? (
                      <span className="lw-chip lw-chip--static">
                        {entityById.get(scene.pov)?.name ?? 'Unknown POV'}
                      </span>
                    ) : null}
                    {scene.labels.map((label) => (
                      <span key={label} className="lw-chip lw-chip--static">
                        {label}
                      </span>
                    ))}
                    <span className="lw-scenecard__words">
                      {scene.wordCount.toLocaleString()}w
                      {scene.targetWords ? ` / ${scene.targetWords.toLocaleString()}` : ''}
                    </span>
                  </footer>
                  {/* Keyboard and touch path for the same move — a drag
                      handle alone would put this column out of reach. */}
                  {groupBy === 'status' ? (
                    <label className="lw-scenecard__status">
                      <span className="lw-visually-hidden">Status for {scene.title}</span>
                      <select
                        className="lw-input lw-input--sm"
                        value={scene.status}
                        onChange={(e) =>
                          void updateSceneMeta(scene.id, {
                            status: e.target.value as SceneStatus,
                          })
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_META[status].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </article>
              ))}
              {column.scenes.length === 0 ? (
                <p className="lw-boardcol__empty">Nothing here.</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** One column per act, in act order, plus a trailing column for chapters
 * that belong to none. A scene's act is its chapter's act — acts group
 * chapters, so this is a two-hop lookup rather than a field on the row. */
function actColumns(data: PlanData) {
  const columns = data.acts.map((act) => ({
    key: act.id,
    label: act.title,
    scenes: scenesOfChapters(data, data.chaptersByAct.get(act.id) ?? []),
  }));
  const loose = scenesOfChapters(data, data.chaptersByAct.get('') ?? []);
  if (loose.length) columns.push({ key: 'none', label: 'Not in an act', scenes: loose });
  return columns;
}

function scenesOfChapters(data: PlanData, chapters: Chapter[]): Scene[] {
  return chapters.flatMap((chapter) => data.scenesByChapter.get(chapter.id) ?? []);
}

function povColumns(scenes: Scene[], entityById: PlanData['entityById']) {
  const byPov = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const key = scene.pov ?? '';
    const list = byPov.get(key) ?? [];
    list.push(scene);
    byPov.set(key, list);
  }
  return [...byPov.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, list]) => ({
      key: id || 'none',
      label: id ? (entityById.get(id)?.name ?? 'Unknown') : 'No POV set',
      scenes: list,
    }));
}
