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
import { db } from '@/db/schema';
import { extractChapter } from '@/services/extraction/session';
import { useProjectStore } from '@/stores/project';
import { useFocusStore } from '@/stores/focus';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';
import { UniqueParagraphId, countWords, paragraphsFromDoc } from './paragraph-id';
import { MentionHighlights } from './mention-highlights';
import { Toolbar } from './Toolbar';
import { NotesMargin } from './NotesMargin';

export function WritersRoom() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setFocus = useFocusStore((s) => s.setFocus);
  const chapters = useLiveQuery(
    async () => (projectId ? listChapters(projectId) : ([] as Chapter[])),
    [projectId],
    null
  );

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle'>('idle');
  // Monotonic count of COMPLETED saves — a deterministic signal for tests
  // and future sync features ("has everything since X been written?").
  const [saveSeq, setSaveSeq] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  // The notes rail overlays the canvas on phones — start closed there.
  const [notesOpen, setNotesOpen] = useState(
    () => !window.matchMedia('(max-width: 720px)').matches
  );
  const [extracting, setExtracting] = useState(false);
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
        saveTimer.current = null;
        void saveChapterDoc(chapterId, doc, paragraphs, words).then(() => {
          setWordCount(words);
          // Only report "saved" if no newer edit re-armed the debounce —
          // an in-flight save must not mask a pending one.
          if (!saveTimer.current) setSaveState('saved');
          setSaveSeq((n) => n + 1);
        });
      }, 600);
    },
    []
  );

  const flushSave = useCallback(async (editor: Editor, chapterId: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const doc = editor.getJSON();
    const paragraphs = paragraphsFromDoc(doc);
    const words = countWords(paragraphs);
    await saveChapterDoc(chapterId, doc, paragraphs, words);
    setWordCount(words);
    setSaveState('saved');
    setSaveSeq((n) => n + 1);
  }, []);

  const editor = useEditor({
    extensions: [StarterKit, UniqueParagraphId, MentionHighlights],
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

  // Load the active chapter's document into the editor. Owns
  // loadedChapterRef exclusively; flushes the outgoing chapter's pending
  // save before content swaps so no keystroke is ever dropped.
  useEffect(() => {
    if (!editor || !activeChapterId) return;
    if (loadedChapterRef.current === activeChapterId) return;
    let cancelled = false;
    void (async () => {
      const outgoing = loadedChapterRef.current;
      if (outgoing && saveTimer.current) {
        await flushSave(editor, outgoing);
      }
      const chapter = await getChapter(activeChapterId);
      if (cancelled || !chapter || !editor || editor.isDestroyed) return;
      loadedChapterRef.current = activeChapterId;
      editor.commands.setContent((chapter.doc as Content) ?? '');
      setWordCount(chapter.wordCount);
      setSaveState(chapter.doc ? 'saved' : 'idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, activeChapterId, flushSave]);

  // Flush pending save when leaving — and on tab hide/close, so a
  // reload or phone app-switch inside the debounce window never loses
  // typed text.
  const editorRef = useRef<Editor | null>(null);
  const activeChapterRef = useRef<string | null>(null);
  useEffect(() => {
    const flushNow = () => {
      if (saveTimer.current && editorRef.current && activeChapterRef.current) {
        void flushSave(editorRef.current, activeChapterRef.current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      flushNow();
    };
  }, [flushSave]);

  // Live entity-mention highlights from persisted occurrences.
  const occurrences = useLiveQuery(
    async () =>
      projectId && activeChapterId
        ? db.occurrences
            .where('[projectId+chapterId]')
            .equals([projectId, activeChapterId])
            .toArray()
        : [],
    [projectId, activeChapterId],
    []
  );
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const storage = (editor.storage as unknown as {
      mentionHighlights: { occurrences: unknown };
    }).mentionHighlights;
    storage.occurrences = occurrences;
    editor.view.dispatch(editor.state.tr.setMeta('mentions:refresh', true));
  }, [editor, occurrences]);

  const runExtraction = useCallback(async () => {
    if (!editor || !activeChapterId) return;
    setExtracting(true);
    try {
      await flushSave(editor, activeChapterId);
      const chapter = await getChapter(activeChapterId);
      if (!chapter) return;
      const summary = await extractChapter(chapter);
      const known = summary.knownMentions
        .slice(0, 3)
        .map((k) => `${k.name} ×${k.count}`)
        .join(', ');
      toast(
        summary.candidateCount > 0
          ? `Found ${summary.candidateCount} candidate${summary.candidateCount === 1 ? '' : 's'} to review` +
              (known ? ` · re-confirmed ${known}` : '')
          : summary.occurrenceCount > 0
            ? `No new candidates · re-confirmed ${known || summary.occurrenceCount + ' mentions'}`
            : 'Nothing recognisable yet — extraction learns as your codex grows.',
        summary.candidateCount > 0
          ? { kind: 'success', action: { label: 'Review', run: () => setRoute('review') } }
          : {}
      );
    } finally {
      setExtracting(false);
    }
  }, [editor, activeChapterId, flushSave, setRoute]);

  // Clicking a highlighted mention opens its entity.
  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest?.('.lw-mention');
      if (!target) return;
      const entityId = target.getAttribute('data-entity-id');
      const entityType = target.getAttribute('data-entity-type');
      if (!entityId || !entityType) return;
      void db.entities.get(entityId).then((entity) => {
        if (!entity) return;
        setFocus({ id: entity.id, type: entity.type, name: entity.name });
        if (entity.type === 'cast') setRoute('cast');
      });
    },
    [setFocus, setRoute]
  );

  editorRef.current = editor;
  activeChapterRef.current = activeChapterId;

  if (!projectId || chapters === null) return null;

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null;
  const activeIndex = activeChapter ? chapters.indexOf(activeChapter) : -1;

  const addChapter = async () => {
    const chapter = await createChapter(projectId);
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
            onClick={() => setActiveChapterId(chapter.id)}
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
                    toast(`“${activeChapter.title}” moved to trash.`);
                  }}
                />
                <button
                  type="button"
                  className="lw-btn lw-btn--primary"
                  disabled={extracting}
                  onClick={() => void runExtraction()}
                >
                  {extracting ? 'Extracting…' : 'Save & Extract'}
                </button>
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
            {/* Delegated click-to-open for mention highlights; keyboard
                users reach entities via the codex surfaces. */}
            <div className="lw-wroom__canvas" onClick={onCanvasClick}>
              <EditorContent editor={editor} />
            </div>

            <div
              className="lw-wroom__status"
              aria-live="polite"
              data-testid="save-state"
              data-save-state={saveState}
              data-save-seq={saveSeq}
            >
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
