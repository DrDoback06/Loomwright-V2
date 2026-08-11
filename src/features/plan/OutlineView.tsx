import { moveScene, renameScene } from '@/db/repos/scenes';
import { moveChapter } from '@/db/repos/chapters';
import type { PlanData } from './usePlanData';
import { STATUS_META } from '@/features/writers-room/SceneStrip';

/** The shape of the book, top to bottom, with word counts at every level.
 *
 * Reordering is by explicit move buttons rather than drag alone: they work
 * with a keyboard, they work on a phone, and they are the only version a
 * screen reader can operate. Nothing here is a copy of the manuscript —
 * every row writes straight back through the scenes repo. */
export function OutlineView({ data, onOpenScene }: { data: PlanData; onOpenScene: (id: string) => void }) {
  const { chapters, scenesByChapter, totals } = data;

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

  return (
    <div className="lw-outline" data-testid="plan-outline">
      <p className="lw-outline__total">
        {chapters.length} chapter{chapters.length === 1 ? '' : 's'} · {totals.scenes} scene
        {totals.scenes === 1 ? '' : 's'} · {totals.words.toLocaleString()} words
      </p>

      {chapters.map((chapter, chapterIndex) => {
        const scenes = scenesByChapter.get(chapter.id) ?? [];
        return (
          <section key={chapter.id} className="lw-outline__chapter">
            <header className="lw-outline__chapterhead">
              <span className="lw-outline__num" aria-hidden>
                {String(chapterIndex + 1).padStart(2, '0')}
              </span>
              <h3 className="lw-outline__title">{chapter.title}</h3>
              <span className="lw-outline__words">{chapter.wordCount.toLocaleString()}w</span>
              <button
                type="button"
                className="lw-iconbtn"
                aria-label={`Move ${chapter.title} earlier`}
                disabled={chapterIndex === 0}
                onClick={() => void moveChapter(chapter.id, 'up')}
              >
                ↑
              </button>
              <button
                type="button"
                className="lw-iconbtn"
                aria-label={`Move ${chapter.title} later`}
                disabled={chapterIndex === chapters.length - 1}
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
    </div>
  );
}
