import { createAct, deleteAct, moveAct, moveScene, renameAct, renameScene, setChapterAct } from '@/db/repos/scenes';
import { moveChapter } from '@/db/repos/chapters';
import type { Act, Chapter } from '@/db/types';
import type { PlanData } from './usePlanData';
import { STATUS_META } from '@/features/writers-room/SceneStrip';

/** The shape of the book, top to bottom, with word counts at every level.
 *
 * Reordering is by explicit move buttons rather than drag alone: they work
 * with a keyboard, they work on a phone, and they are the only version a
 * screen reader can operate. Nothing here is a copy of the manuscript —
 * every row writes straight back through the scenes repo. */
export function OutlineView({
  data,
  onOpenScene,
}: {
  data: PlanData;
  onOpenScene: (id: string) => void;
}) {
  const { acts, chapters, chaptersByAct, totals } = data;

  if (chapters.length === 0) {
    return (
      <div className="lw-empty lw-empty--center">
        <p className="lw-empty__title">Nothing to outline yet.</p>
        <p className="lw-empty__note">
          Chapters and scenes you create in the Writer&rsquo;s Room appear here, with their
          shape and their word counts.
        </p>
      </div>
    );
  }

  const unassigned = chaptersByAct.get('') ?? [];

  return (
    <div className="lw-outline" data-testid="plan-outline">
      <div className="lw-outline__head">
        <p className="lw-outline__total">
          {acts.length ? `${acts.length} act${acts.length === 1 ? '' : 's'} · ` : ''}
          {chapters.length} chapter{chapters.length === 1 ? '' : 's'} · {totals.scenes} scene
          {totals.scenes === 1 ? '' : 's'} · {totals.words.toLocaleString()} words
        </p>
        {/* Acts are optional and stay out of the way until asked for: a
            book can live in one act or in none, and nothing else in the app
            requires one to exist. */}
        <button
          type="button"
          className="lw-btn lw-btn--sm"
          onClick={() => void createAct(chapters[0].projectId)}
        >
          + Act
        </button>
      </div>

      {acts.map((act, actIndex) => (
        <section key={act.id} className="lw-outline__act" data-testid="outline-act">
          <header className="lw-outline__acthead">
            <span className="lw-outline__eyebrow" aria-hidden>
              Act {actIndex + 1}
            </span>
            <input
              className="lw-outline__acttitle"
              aria-label={`Act title: ${act.title}`}
              defaultValue={act.title}
              onBlur={(e) => void renameAct(act.id, e.target.value)}
            />
            <span className="lw-outline__words">{actWords(chaptersByAct.get(act.id))}w</span>
            <button
              type="button"
              className="lw-iconbtn"
              aria-label={`Move ${act.title} earlier`}
              disabled={actIndex === 0}
              onClick={() => void moveAct(act.id, 'up')}
            >
              ↑
            </button>
            <button
              type="button"
              className="lw-iconbtn"
              aria-label={`Move ${act.title} later`}
              disabled={actIndex === acts.length - 1}
              onClick={() => void moveAct(act.id, 'down')}
            >
              ↓
            </button>
            {/* Deleting an act never deletes prose — its chapters simply
                stop belonging to one, which is why this needs no
                confirmation and no trash row. */}
            <button
              type="button"
              className="lw-btn lw-btn--sm"
              aria-label={`Delete ${act.title}`}
              onClick={() => void deleteAct(act.id)}
            >
              Delete act
            </button>
          </header>
          <ChapterList
            chapters={chaptersByAct.get(act.id) ?? []}
            allChapters={chapters}
            acts={acts}
            data={data}
            onOpenScene={onOpenScene}
            emptyNote="No chapters in this act yet — set a chapter's act below."
          />
        </section>
      ))}

      {acts.length > 0 && unassigned.length > 0 ? (
        <section className="lw-outline__act lw-outline__act--none">
          <header className="lw-outline__acthead">
            <span className="lw-outline__eyebrow">Not in an act</span>
          </header>
          <ChapterList
            chapters={unassigned}
            allChapters={chapters}
            acts={acts}
            data={data}
            onOpenScene={onOpenScene}
          />
        </section>
      ) : null}

      {acts.length === 0 ? (
        <ChapterList
          chapters={chapters}
          allChapters={chapters}
          acts={acts}
          data={data}
          onOpenScene={onOpenScene}
        />
      ) : null}
    </div>
  );
}

function actWords(chapters: Chapter[] | undefined): string {
  return (chapters ?? []).reduce((sum, c) => sum + c.wordCount, 0).toLocaleString();
}

/** Chapters and their scenes. Rendered once per act, or once flat when the
 * book has no acts — the rows themselves are identical either way, so the
 * act grouping cannot drift from the ungrouped view. */
function ChapterList({
  chapters,
  allChapters,
  acts,
  data,
  onOpenScene,
  emptyNote,
}: {
  chapters: Chapter[];
  /** Move up/down is a position in the whole manuscript, not in this act. */
  allChapters: Chapter[];
  acts: Act[];
  data: PlanData;
  onOpenScene: (id: string) => void;
  emptyNote?: string;
}) {
  if (chapters.length === 0) {
    return emptyNote ? <p className="lw-outline__emptyact">{emptyNote}</p> : null;
  }

  return (
    <>
      {chapters.map((chapter) => {
        const scenes = data.scenesByChapter.get(chapter.id) ?? [];
        const globalIndex = allChapters.findIndex((c) => c.id === chapter.id);
        return (
          <section key={chapter.id} className="lw-outline__chapter">
            <header className="lw-outline__chapterhead">
              <span className="lw-outline__num" aria-hidden>
                {String(globalIndex + 1).padStart(2, '0')}
              </span>
              <h3 className="lw-outline__title">{chapter.title}</h3>
              {acts.length > 0 ? (
                <label className="lw-outline__actpick">
                  <span className="lw-visually-hidden">Act for {chapter.title}</span>
                  <select
                    className="lw-input lw-input--sm"
                    value={chapter.actId ?? ''}
                    onChange={(e) => void setChapterAct(chapter.id, e.target.value || null)}
                  >
                    <option value="">No act</option>
                    {acts.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <span className="lw-outline__words">{chapter.wordCount.toLocaleString()}w</span>
              <button
                type="button"
                className="lw-iconbtn"
                aria-label={`Move ${chapter.title} earlier`}
                disabled={globalIndex === 0}
                onClick={() => void moveChapter(chapter.id, 'up')}
              >
                ↑
              </button>
              <button
                type="button"
                className="lw-iconbtn"
                aria-label={`Move ${chapter.title} later`}
                disabled={globalIndex === allChapters.length - 1}
                onClick={() => void moveChapter(chapter.id, 'down')}
              >
                ↓
              </button>
            </header>

            <ul className="lw-outline__scenes">
              {scenes.map((scene, sceneIndex) => (
                <li key={scene.id} className="lw-outline__scene">
                  <span
                    className="lw-outline__status"
                    title={STATUS_META[scene.status].label}
                    aria-label={STATUS_META[scene.status].label}
                  >
                    {STATUS_META[scene.status].glyph}
                  </span>
                  <input
                    className="lw-outline__scenetitle"
                    aria-label={`Scene title: ${scene.title}`}
                    defaultValue={scene.title}
                    onBlur={(e) => void renameScene(scene.id, e.target.value)}
                  />
                  <span className="lw-outline__summary">{scene.summary || '—'}</span>
                  <span className="lw-outline__words">
                    {scene.wordCount > 0 ? `${scene.wordCount.toLocaleString()}w` : '—'}
                  </span>
                  <button
                    type="button"
                    className="lw-iconbtn"
                    aria-label={`Move ${scene.title} earlier`}
                    disabled={sceneIndex === 0}
                    onClick={() => void moveScene(scene.id, chapter.id, sceneIndex - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="lw-iconbtn"
                    aria-label={`Move ${scene.title} later`}
                    disabled={sceneIndex === scenes.length - 1}
                    onClick={() => void moveScene(scene.id, chapter.id, sceneIndex + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={() => onOpenScene(scene.id)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
