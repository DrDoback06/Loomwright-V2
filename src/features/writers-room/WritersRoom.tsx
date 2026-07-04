import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { Content } from '@tiptap/core';
import type { Chapter } from '@/db/types';
import StarterKit from '@tiptap/starter-kit';
import {
  createChapter,
  deleteChapterToTrash,
  getChapter,
  listChapters,
  moveChapter,
  renameChapter,
  saveChapterDoc,
} from '@/db/repos/chapters';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';
import { UniqueParagraphId, countWords, paragraphsFromDoc } from './paragraph-id';
import { Toolbar } from './Toolbar';
import { NotesMargin } from './NotesMargin';

export function WritersRoom() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const chapters = useLiveQuery(
    async () => (projectId ? listChapters(projectId) : ([] as Chapter[])),
    [projectId],
    null
  );

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [wordCount, setWordCount] = useState(0);
  // The notes rail overlays the canvas on phones — start closed there.
  const [notesOpen, setNotesOpen] = useState(
    () => !window.matchMedia('(max-width: 720px)').matches
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedChapterRef = useRef<string | null>(null);

  // Adopt the first chapter (or clear) when the list changes.
  useEffect(() => {
    if (!chapters) return;
    if (chapters.length === 0) {
      setActiveChapterId(null);
      return;
    }
    if (!activeChapterId || !chapters.some((c) => c.id === activeChapterId)) {
      setActiveChapterId(chapters[0].id);
    }
  }, [chapters, activeChapterId]);

  const persist = useCallback(
    (editor: Editor, chapterId: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(() => {
        const doc = editor.getJSON();
        const paragraphs = paragraphsFromDoc(doc);
        const words = countWords(paragraphs);
        void saveChapterDoc(chapterId, doc, paragraphs, words).then(() => {
          setWordCount(words);
          setSaveState('saved');
        });
      }, 600);
    },
    []
  );

  const editor = useEditor({
    extensions: [StarterKit, UniqueParagraphId],
    editorProps: {
      attributes: {
        class: 'lw-manuscript',
        'aria-label': 'Manuscript body',
      },
    },
    onUpdate: ({ editor }) => {
      if (loadedChapterRef.current) persist(editor, loadedChapterRef.current);
    },
  });

  // Load the active chapter's document into the editor.
  useEffect(() => {
    if (!editor || !activeChapterId) return;
    if (loadedChapterRef.current === activeChapterId) return;
    let cancelled = false;
    void getChapter(activeChapterId).then((chapter) => {
      if (cancelled || !chapter || !editor || editor.isDestroyed) return;
      loadedChapterRef.current = activeChapterId;
      editor.commands.setContent((chapter.doc as Content) ?? '');
      setWordCount(chapter.wordCount);
      setSaveState(chapter.doc ? 'saved' : 'idle');
    });
    return () => {
      cancelled = true;
    };
  }, [editor, activeChapterId]);

  // Flush pending save when leaving.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!projectId || chapters === null) return null;

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null;
  const activeIndex = activeChapter ? chapters.indexOf(activeChapter) : -1;

  const addChapter = async () => {
    const chapter = await createChapter(projectId);
    loadedChapterRef.current = null;
    setActiveChapterId(chapter.id);
  };

  return (
    <div className="lw-wroom" data-testid="surface-writers-room">
      <div className="lw-wroom__chapters" role="tablist" aria-label="Chapters">
        {chapters.map((chapter, i) => (
          <button
            key={chapter.id}
            type="button"
            role="tab"
            aria-selected={chapter.id === activeChapterId}
            className="lw-chaptertab"
            onClick={() => {
              loadedChapterRef.current = null;
              setActiveChapterId(chapter.id);
            }}
          >
            <span className="lw-chaptertab__num">CH. {String(i + 1).padStart(2, '0')}</span>
            <span className="lw-chaptertab__title">{chapter.title}</span>
            <span className="lw-chaptertab__words">
              {chapter.wordCount > 0 ? `${chapter.wordCount.toLocaleString()}w` : '—'}
            </span>
          </button>
        ))}
        <button type="button" className="lw-chaptertab lw-chaptertab--new" onClick={addChapter}>
          + New chapter
        </button>
      </div>

      {activeChapter && editor ? (
        <div className="lw-wroom__body">
          <div className="lw-wroom__editorcol">
            <div className="lw-wroom__chapterhead">
              <input
                className="lw-wroom__title"
                aria-label="Chapter title"
                value={activeChapter.title}
                onChange={(e) => void renameChapter(activeChapter.id, e.target.value)}
              />
              <div className="lw-wroom__chapteractions">
                <button
                  type="button"
                  className="lw-iconbtn"
                  aria-label="Move chapter earlier"
                  disabled={activeIndex <= 0}
                  onClick={() => void moveChapter(activeChapter.id, 'up')}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="lw-iconbtn"
                  aria-label="Move chapter later"
                  disabled={activeIndex >= chapters.length - 1}
                  onClick={() => void moveChapter(activeChapter.id, 'down')}
                >
                  →
                </button>
                <DeleteChapterButton
                  onDelete={async () => {
                    await deleteChapterToTrash(activeChapter.id);
                    loadedChapterRef.current = null;
                    toast(`“${activeChapter.title}” moved to trash.`);
                  }}
                />
                <button
                  type="button"
                  className="lw-btn"
                  aria-pressed={notesOpen}
                  onClick={() => setNotesOpen((o) => !o)}
                >
                  Notes
                </button>
              </div>
            </div>

            <Toolbar editor={editor} />
            <EditorContent editor={editor} className="lw-wroom__canvas" />

            <div className="lw-wroom__status" aria-live="polite">
              <span>{wordCount.toLocaleString()} words</span>
              <span>
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'saved'
                    ? `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Start writing — saves automatically'}
              </span>
              <span className="lw-wroom__local">Local only</span>
            </div>
          </div>

          {notesOpen && (
            <NotesMargin projectId={projectId} chapterId={activeChapter.id} editor={editor} />
          )}
        </div>
      ) : (
        <div className="lw-empty lw-empty--center">
          <p className="lw-empty__title">No chapters yet.</p>
          <p className="lw-empty__note">Create your first chapter to start writing.</p>
          <button type="button" className="lw-btn lw-btn--primary" onClick={addChapter}>
            + New chapter
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteChapterButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="lw-confirm">
        <button type="button" className="lw-btn lw-btn--danger" onClick={() => void onDelete()}>
          Move to trash
        </button>
        <button type="button" className="lw-btn" onClick={() => setConfirming(false)}>
          Keep
        </button>
      </span>
    );
  }
  return (
    <button type="button" className="lw-btn" onClick={() => setConfirming(true)}>
      Delete
    </button>
  );
}
