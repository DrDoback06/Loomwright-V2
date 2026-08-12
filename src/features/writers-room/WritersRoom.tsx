import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { Content } from '@tiptap/core';
import type { Chapter, Scene } from '@/db/types';
import StarterKit from '@tiptap/starter-kit';
import {
  createChapter,
  deleteChapterToTrash,
  getChapter,
  listChapters,
  moveChapter,
  refreshChapterLabels,
  renameChapter,
} from '@/db/repos/chapters';
import { createScene, getScene, listScenesInChapter, saveSceneDoc } from '@/db/repos/scenes';
import { db } from '@/db/schema';
import { extractChapter } from '@/services/extraction/session';
import { deltaFromCandidates } from '@/services/intelligence/session';
import { useIntelligenceStore } from '@/stores/intelligence';
import { loadKnownProjectEntities } from '@/services/extraction/project-known';
import { describeDeepExtraction, runDeepExtraction } from '@/services/ai/deep-extraction';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';
import { UniqueParagraphId } from './paragraph-id';
import { deriveScene } from '@/lib/prose';
import { MentionHighlights } from './mention-highlights';
import { SceneBeat } from './scene-beat';
import { Section } from './section';
import { SlashProgress } from './slash-progress';
import { Toolbar } from './Toolbar';
import { NotesMargin } from './NotesMargin';
import { ComposePanel } from './ComposePanel';
import { SceneHead, SceneStrip } from './SceneStrip';
import { ScenePanel } from './ScenePanel';
import { ContextRail } from './ContextRail';
import { RewriteBubble } from './RewriteBubble';
import { FocusDim } from './focus-dim';
import { useFocusMode } from './useFocusMode';
import { Mention } from './mention';
import { MentionSuggest as MentionSuggestExtension } from './mention-suggest';
import { MentionSuggest } from './MentionSuggest';
import { MentionPreview, type MentionTarget } from './MentionPreview';
import type { EntityType } from '@/domain/entity-types';

/** Hard ceiling on how long typed text may sit unwritten. The 600ms debounce
 * still governs the common case (a pause commits immediately); this only binds
 * when someone types steadily enough to keep resetting it. */
const MAX_UNSAVED_MS = 3000;

export function WritersRoom() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const pendingChapterId = useUiStore((s) => s.pendingChapterId);
  const chapters = useLiveQuery(
    async () => (projectId ? listChapters(projectId) : ([] as Chapter[])),
    [projectId],
    null
  );

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const scenes = useLiveQuery(
    async () => (activeChapterId ? listScenesInChapter(activeChapterId) : ([] as Scene[])),
    [activeChapterId],
    null
  );
  const activeScene = scenes?.find((s) => s.id === activeSceneId) ?? null;
  const [metaOpen, setMetaOpen] = useState(false);
  /** Bumped by `/progress` so the panel focuses its composer — a token
   * rather than a boolean, because typing the slash twice must focus
   * twice even though the panel never closed. */
  const [progressFocus, setProgressFocus] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle' | 'error'>('idle');
  // Monotonic count of COMPLETED saves — a deterministic signal for tests
  // and future sync features ("has everything since X been written?").
  const [saveSeq, setSaveSeq] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  // The notes rail overlays the canvas on phones — start closed there.
  const [notesOpen, setNotesOpen] = useState(
    () => !window.matchMedia('(max-width: 720px)').matches
  );
  const [extracting, setExtracting] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<MentionTarget | null>(null);
  const stageDelta = useIntelligenceStore((s) => s.stage);
  const [composeOpen, setComposeOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [deepConfirming, setDeepConfirming] = useState(false);
  useEffect(() => {
    if (projectId) void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedSceneRef = useRef<string | null>(null);
  /** Bumped when the active scene's prose is replaced from outside the
   * editor (a snapshot restore today; AI insertion in N5). */
  const [reloadToken, setReloadToken] = useState(0);
  const loadedTokenRef = useRef(0);
  /** When the current unsaved burst started. A debounce that re-arms on every
   * keystroke never fires while someone is actually typing, so this is the
   * ceiling that guarantees a write. */
  const burstStartedAt = useRef<number | null>(null);

  // Adopt the first chapter (or clear) when the list changes. A pending
  // request from the palette / Today (consume-once) wins over the default.
  useEffect(() => {
    if (!chapters) return;
    if (chapters.length === 0) {
      setActiveChapterId(null);
      return;
    }
    const requested = useUiStore.getState().consumePendingChapter();
    if (requested && chapters.some((c) => c.id === requested)) {
      setActiveChapterId(requested);
      return;
    }
    if (!activeChapterId || !chapters.some((c) => c.id === activeChapterId)) {
      setActiveChapterId(chapters[0].id);
    }
  }, [chapters, activeChapterId, pendingChapterId]);

  // Let go of the scene the instant the chapter changes.
  //
  // `useLiveQuery` returns its PREVIOUS value while re-running, so for a
  // moment after switching chapters the scene list still describes the old
  // chapter — and the old scene id is legitimately in it. Without this,
  // the editor stayed pointed at the previous chapter's scene and anything
  // typed in that window was written into it. Clearing here means the
  // adoption effect below is the only thing that ever chooses a scene.
  useEffect(() => {
    setActiveSceneId(null);
  }, [activeChapterId]);

  // Adopt the first scene of the chapter. A chapter always has at least
  // one — `createChapter` makes it and `ensureScenesForProject` backfills
  // anything older — so this never leaves the editor with nowhere to write.
  useEffect(() => {
    if (!scenes || !activeChapterId) return;
    // Ignore a list that still belongs to the chapter we just left.
    if (scenes.length && scenes[0].chapterId !== activeChapterId) return;
    if (scenes.length === 0) return;
    if (!activeSceneId || !scenes.some((s) => s.id === activeSceneId)) {
      setActiveSceneId(scenes[0].id);
    }
  }, [scenes, activeSceneId, activeChapterId]);

  const persist = useCallback(
    (editor: Editor, sceneId: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      if (burstStartedAt.current == null) burstStartedAt.current = Date.now();
      // Steady typing resets a 600ms debounce before it can ever fire, so an
      // uninterrupted writing burst would otherwise reach IndexedDB exactly
      // never. Cap the wait: after MAX_UNSAVED_MS the next keystroke commits.
      const elapsed = Date.now() - burstStartedAt.current;
      const delay = elapsed >= MAX_UNSAVED_MS ? 0 : Math.min(600, MAX_UNSAVED_MS - elapsed);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        burstStartedAt.current = null;
        // The document is read HERE, 600ms after the keystroke that armed the
        // timer, but `sceneId` was captured back then. If the editor has been
        // re-pointed at another scene in between, writing now would stamp the
        // new scene's text onto the old scene's row — and while snapshots make
        // that recoverable, they only fire once per interval, so it could still
        // cost real work. Drop the write instead; the scene-load effect already
        // flushed anything genuinely pending.
        if (loadedSceneRef.current !== sceneId) {
          setSaveState('saved');
          return;
        }
        const doc = editor.getJSON();
        // Two filters over one document — see `deriveScene`. A hidden
        // section is out of `paragraphs`, out of `wordCount`, or out of
        // both, depending on which switch the author threw.
        const { paragraphs, wordCount: words } = deriveScene(doc);
        void saveSceneDoc(sceneId, doc, paragraphs, words).then(
          () => {
            setWordCount(words);
            // Only report "saved" if no newer edit re-armed the debounce —
            // an in-flight save must not mask a pending one.
            if (!saveTimer.current) setSaveState('saved');
            setSaveSeq((n) => n + 1);
          },
          (err: unknown) => {
            // A rejected write (quota exhausted on a novel-length manuscript
            // is the realistic case) previously left the badge on "Saving…"
            // forever with the rejection unhandled. Say so, loudly, while the
            // text is still in the editor and can be copied out.
            setSaveState('error');
            toast(
              `Could not save this scene: ${
                err instanceof Error ? err.message : 'the browser refused the write'
              }. Your text is still on screen — copy it somewhere safe.`,
              { kind: 'error' }
            );
          }
        );
      }, delay);
    },
    []
  );

  const flushSave = useCallback(async (editor: Editor, sceneId: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    burstStartedAt.current = null;
    // Same identity guard as persist. Callers pass `activeSceneId`, which
    // changes the instant a tab is clicked — while the editor still holds the
    // previous scene's document until the async load completes. Writing then
    // stamps the wrong (or, on a fresh mount, an empty) doc onto a real scene.
    if (loadedSceneRef.current !== sceneId) return;
    const doc = editor.getJSON();
    const { paragraphs, wordCount: words } = deriveScene(doc);
    try {
      await saveSceneDoc(sceneId, doc, paragraphs, words);
    } catch (err) {
      // Callers include tab-hide and pagehide handlers that fire this with
      // `void`, so an uncaught rejection here loses the text in silence.
      setSaveState('error');
      toast(
        `Could not save this scene: ${
          err instanceof Error ? err.message : 'the browser refused the write'
        }. Your text is still on screen — copy it somewhere safe.`,
        { kind: 'error' }
      );
      return;
    }
    setWordCount(words);
    setSaveState('saved');
    setSaveSeq((n) => n + 1);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UniqueParagraphId,
      MentionHighlights,
      SceneBeat,
      Section,
      SlashProgress,
      FocusDim,
      Mention,
      MentionSuggestExtension,
    ],
    editorProps: {
      attributes: {
        class: 'lw-manuscript',
        'aria-label': 'Manuscript body',
      },
    },
    onUpdate: ({ editor }) => {
      if (loadedSceneRef.current) persist(editor, loadedSceneRef.current);
    },
  });

  // Load the active SCENE's document into the editor. Owns loadedSceneRef
  // exclusively; flushes the outgoing scene's pending save before content
  // swaps so no keystroke is ever dropped.
  useEffect(() => {
    if (!editor) return;
    if (!activeSceneId) {
      // Between chapters. Drop the pointer so `onUpdate` cannot persist
      // into the scene we have just navigated away from.
      loadedSceneRef.current = null;
      return;
    }
    // A reload token forces a re-read of the SAME scene. Restoring a
    // snapshot replaces the row underneath the editor; without this the
    // editor kept showing the newer text and the next keystroke wrote it
    // straight back, quietly undoing the restore.
    if (loadedSceneRef.current === activeSceneId && loadedTokenRef.current === reloadToken) return;
    // Was this a move to a different scene, or the same scene being
    // replaced underneath us? The two need opposite treatment, and getting
    // it wrong silently loses work either way.
    const sameScene = loadedSceneRef.current === activeSceneId;
    loadedTokenRef.current = reloadToken;

    if (sameScene && saveTimer.current) {
      // The database has just been deliberately overwritten — a snapshot
      // restore. Flushing here would write the pre-restore editor content
      // straight back over it, and letting the pending timer fire later
      // would do the same a moment afterwards. Both undo the restore. The
      // DB is authoritative by definition when the token moves, so drop
      // the pending write.
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      burstStartedAt.current = null;
    }

    let cancelled = false;
    void (async () => {
      const outgoing = loadedSceneRef.current;
      // Only when genuinely leaving a scene: there, the editor is the
      // authority and anything unsaved must reach disk first.
      if (!sameScene && outgoing && saveTimer.current) {
        await flushSave(editor, outgoing);
      }
      const scene = await getScene(activeSceneId);
      if (cancelled || !scene || !editor || editor.isDestroyed) return;
      loadedSceneRef.current = activeSceneId;
      editor.commands.setContent((scene.doc as Content) ?? '');
      setWordCount(scene.wordCount);
      setSaveState(scene.doc ? 'saved' : 'idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, activeSceneId, reloadToken, flushSave]);

  // Flush pending save when leaving — and on tab hide/close, so a
  // reload or phone app-switch inside the debounce window never loses
  // typed text.
  const editorRef = useRef<Editor | null>(null);
  const activeSceneRef = useRef<string | null>(null);
  /** The scroll container the rewrite bubble positions against — and, in
   * the next step, the one typewriter scrolling moves. Not the window. */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const flushNow = () => {
      if (saveTimer.current && editorRef.current && activeSceneRef.current) {
        void flushSave(editorRef.current, activeSceneRef.current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    // A reload or tab close inside the debounce window would otherwise drop
    // the burst silently: pagehide fires too late to await an IndexedDB write.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!saveTimer.current) return;
      flushNow();
      event.preventDefault();
      event.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', onBeforeUnload);
      flushNow();
    };
  }, [flushSave]);

  /** Write anything sitting in the autosave debounce, right now. Read
   * through refs at call time so it can never act on a stale closure — the
   * class of bug that cost a red run in N3. Shared by the beat node view
   * and the rewrite bubble, both of which snapshot before they generate. */
  const flushEditorNow = useCallback(async () => {
    const id = loadedSceneRef.current;
    if (editorRef.current && id) await flushSave(editorRef.current, id);
  }, [flushSave]);

  // Publish what a beat node view needs to act: which scene it is in, and
  // how to flush before snapshotting.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const storage = editor.storage.sceneBeat;
    storage.projectId = projectId;
    storage.sceneId = activeSceneId;
    storage.flush = flushEditorNow;
  }, [editor, projectId, activeSceneId, flushEditorNow]);

  // `/progress ` opens the scene panel's composer rather than leaving a
  // node in the prose — a progression is a row about the story, not part
  // of it.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.storage.slashProgress.onProgress = () => {
      setMetaOpen(true);
      setProgressFocus((n) => n + 1);
    };
  }, [editor]);

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
    // The editor may still be showing the previous chapter while the async
    // load runs. Extracting now would scan the wrong text, and flushSave
    // correctly refuses to write — so say so rather than act on stale prose.
    if (!activeSceneId || loadedSceneRef.current !== activeSceneId) {
      toast('Still loading that chapter — try again in a moment.', {});
      return;
    }
    setExtracting(true);
    try {
      await flushSave(editor, activeSceneId);
      const chapter = await getChapter(activeChapterId);
      if (!chapter) return;
      const summary = await extractChapter(chapter);

      // Same chapter, second reading: what do these events MEAN for the rest
      // of the codex? The delta is staged in memory and rendered as cascades
      // on the review board; nothing is written until the author accepts.
      // Propagate from the candidates that pass already produced — scanning
      // the same prose a second time was seconds of frozen UI on a real
      // chapter and produced nothing extra.
      // The scene is what a progression anchors to. Extraction still runs
        // against the whole chapter — this only records where the author was.
        const delta = await deltaFromCandidates(
          chapter.projectId,
          summary.candidates,
          chapter.id,
          activeSceneId ?? undefined
        );
      if (delta.groups.length) stageDelta(delta);

      const known = summary.knownMentions
        .slice(0, 3)
        .map((k) => `${k.name} ×${k.count}`)
        .join(', ');
      const cascades = delta.groups.length;
      toast(
        cascades > 0
          ? `${cascades} change${cascades === 1 ? '' : 's'} to review` +
              (known ? ` · re-confirmed ${known}` : '')
          : summary.candidateCount > 0
            ? `Found ${summary.candidateCount} candidate${summary.candidateCount === 1 ? '' : 's'} to review` +
                (known ? ` · re-confirmed ${known}` : '')
            : summary.occurrenceCount > 0
              ? `No new candidates · re-confirmed ${known || summary.occurrenceCount + ' mentions'}`
              : 'Nothing recognisable yet — extraction learns as your codex grows.',
        cascades > 0 || summary.candidateCount > 0
          ? { kind: 'success', action: { label: 'Review', run: () => setRoute('review') } }
          : {}
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Extraction failed.', { kind: 'error' });
    } finally {
      setExtracting(false);
    }
  }, [editor, activeChapterId, activeSceneId, flushSave, setRoute, stageDelta]);

  const runDeep = useCallback(async () => {
    if (!editor || !activeChapterId || !projectId) return;
    if (!activeSceneId || loadedSceneRef.current !== activeSceneId) {
      toast('Still loading that chapter — try again in a moment.', {});
      return;
    }
    setDeepConfirming(false);
    setExtracting(true);
    try {
      await flushSave(editor, activeSceneId);
      const chapter = await getChapter(activeChapterId);
      const config = await resolveProvider(projectId);
      if (!chapter || !config) return;
      const known = await loadKnownProjectEntities(projectId);
      const result = await runDeepExtraction(chapter, config, known);
      // Report what actually happened. A truncated or unreadable reply used to
      // be indistinguishable from a model that genuinely found nothing, which
      // is the difference between "your chapter is thin" and "ask for less".
      toast(
        describeDeepExtraction(result),
        result.added > 0
          ? { kind: 'success', action: { label: 'Review', run: () => setRoute('review') } }
          : result.failedChunks || result.truncatedChunks
            ? { kind: 'error' }
            : {}
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Deep extraction failed.', { kind: 'error' });
    } finally {
      setExtracting(false);
    }
  }, [editor, activeChapterId, activeSceneId, projectId, flushSave, setRoute]);

  const deepClick = useCallback(async () => {
    if (!projectId) return;
    const settings = await getAiSettings(projectId);
    if (settings.privacy === 'ask') setDeepConfirming(true);
    else await runDeep();
  }, [projectId, runDeep]);

  /** Clicking a mention opens a preview card rather than jumping.
   *
   * The question a mention raises is "who is this again?", and the old
   * behaviour answered it by navigating away from the sentence that asked.
   * The card answers it in place and still offers the trip. Delegated from
   * the canvas because extraction-derived mentions are decorations with no
   * React component of their own. */
  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.('.lw-mention') as HTMLElement | null;
      const canvas = canvasRef.current;
      if (!el || !canvas) {
        setMentionTarget(null);
        return;
      }
      const entityId = el.getAttribute('data-entity-id');
      const entityType = el.getAttribute('data-entity-type') as EntityType | null;
      if (!entityId || !entityType) return;
      const rect = el.getBoundingClientRect();
      const box = canvas.getBoundingClientRect();
      // A typed mention is a mark and can be unlinked; an extracted one is
      // a decoration with nothing to remove, so the card omits Unlink.
      const pos = el.classList.contains('lw-mention--typed')
        ? (editorRef.current?.view.posAtDOM(el, 0) ?? undefined)
        : undefined;
      setMentionTarget({
        entityId,
        entityType,
        pos,
        top: rect.bottom - box.top + canvas.scrollTop,
        left: Math.min(Math.max(rect.left - box.left, 8), Math.max(8, box.width - 300)),
      });
    },
    []
  );

  // Dimming, the chrome fade and typewriter scrolling, all from the one
  // Tweaks setting. Called before the early return below so the hook order
  // is stable.
  const focus = useFocusMode(editor, canvasRef);

  editorRef.current = editor;
  activeSceneRef.current = activeSceneId;

  if (!projectId || chapters === null) return null;

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null;
  const activeIndex = activeChapter ? chapters.indexOf(activeChapter) : -1;

  const addChapter = async (afterChapterId?: string | null) => {
    const chapter = await createChapter(projectId, undefined, afterChapterId);
    setActiveChapterId(chapter.id);
    toast(
      afterChapterId
        ? `Inserted “${chapter.title}”. Linked entity histories were re-indexed locally.`
        : `Created “${chapter.title}”.`,
      { kind: 'success' }
    );
  };

  return (
    <div
      className="lw-wroom"
      data-testid="surface-writers-room"
      data-focus={focus.mode}
      data-typing={focus.typing ? 'true' : undefined}
    >
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
        <button type="button" className="lw-chaptertab lw-chaptertab--new" onClick={() => void addChapter()}>
          + New chapter
        </button>
      </div>

      {activeChapter && scenes && scenes.length > 0 ? (
        <SceneStrip
          projectId={projectId}
          chapterId={activeChapter.id}
          scenes={scenes}
          activeSceneId={activeSceneId}
          onSelect={setActiveSceneId}
        />
      ) : null}

      {activeChapter && editor ? (
        <div className="lw-wroom__body">
          <div className="lw-wroom__editorcol">
            {activeScene && scenes ? (
              <SceneHead
                scene={activeScene}
                index={scenes.findIndex((s) => s.id === activeScene.id)}
                sceneCount={scenes.length}
                onAddAfter={() => {
                  void createScene(projectId, activeChapter.id, undefined, activeScene.id).then(
                    (scene) => setActiveSceneId(scene.id)
                  );
                }}
                onDeleted={() => setActiveSceneId(null)}
              />
            ) : null}
            <div className="lw-wroom__chapterhead">
              <input
                className="lw-wroom__title"
                aria-label="Chapter title"
                value={activeChapter.title}
                onChange={(e) => void renameChapter(activeChapter.id, e.target.value)}
                onBlur={() => void refreshChapterLabels(projectId)}
              />
              <div className="lw-wroom__chapteractions">
                <button
                  type="button"
                  className="lw-btn"
                  title="Insert a chapter immediately after this one and re-index linked story data"
                  onClick={() => void addChapter(activeChapter.id)}
                >
                  + Insert after
                </button>
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
                {aiReady && !deepConfirming && (
                  <button
                    type="button"
                    className="lw-btn"
                    disabled={extracting}
                    onClick={() => void deepClick()}
                  >
                    Deep Extract (AI)
                  </button>
                )}
                {deepConfirming && (
                  <span className="lw-confirm" data-testid="deep-privacy-guard">
                    <button type="button" className="lw-btn lw-btn--primary" onClick={() => void runDeep()}>
                      Send chapter to provider
                    </button>
                    <button type="button" className="lw-btn" onClick={() => setDeepConfirming(false)}>
                      Cancel
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  className="lw-btn"
                  aria-pressed={composeOpen}
                  onClick={() => setComposeOpen((o) => !o)}
                >
                  Compose
                </button>
                <button
                  type="button"
                  className="lw-btn"
                  aria-pressed={metaOpen}
                  onClick={() => setMetaOpen((o) => !o)}
                >
                  Scene
                </button>
                <button
                  type="button"
                  className="lw-btn"
                  aria-pressed={notesOpen}
                  onClick={() => setNotesOpen((o) => !o)}
                >
                  Notes
                </button>
                <button
                  type="button"
                  className="lw-btn"
                  aria-pressed={contextOpen}
                  onClick={() => setContextOpen((o) => !o)}
                >
                  Context
                </button>
              </div>
            </div>

            <Toolbar editor={editor} />
            {/* Delegated click-to-open for mention highlights; keyboard
                users reach entities via the codex surfaces. */}
            <div className="lw-wroom__canvas" ref={canvasRef} onClick={onCanvasClick}>
              <EditorContent editor={editor} />
              {/* A sibling of the editor rather than a ProseMirror plugin:
                  it positions itself off the selection and must not fight
                  the editor for the scroll container. */}
              <RewriteBubble
                editor={editor}
                projectId={projectId}
                sceneId={activeSceneId}
                canvasRef={canvasRef}
                flush={flushEditorNow}
              />
              <MentionSuggest editor={editor} projectId={projectId} canvasRef={canvasRef} />
              {mentionTarget ? (
                <MentionPreview
                  target={mentionTarget}
                  editor={editor}
                  onClose={() => setMentionTarget(null)}
                />
              ) : null}
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
                  : saveState === 'error'
                    ? '⚠ Not saved — copy your text'
                    : saveState === 'saved'
                      ? `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Start writing — saves automatically'}
              </span>
              <span className="lw-wroom__local">Local only</span>
            </div>
          </div>

          {composeOpen && activeScene && (
            <ComposePanel
              scene={activeScene}
              onClose={() => setComposeOpen(false)}
              onInsertProse={(prose) => {
                editor
                  .chain()
                  .focus('end')
                  .insertContent(
                    prose
                      .split(/\n{2,}/)
                      .filter((p) => p.trim())
                      .map((p) => ({
                        type: 'paragraph',
                        content: [{ type: 'text', text: p.replace(/\s*\n\s*/g, ' ').trim() }],
                      }))
                  )
                  .run();
                setComposeOpen(false);
              }}
              onInsert={(brief) => {
                editor
                  .chain()
                  .focus('end')
                  .insertContent({
                    type: 'blockquote',
                    content: brief.split('\n').map((line) => ({
                      type: 'paragraph',
                      content: line ? [{ type: 'text', text: line }] : [],
                    })),
                  })
                  .run();
                setComposeOpen(false);
              }}
            />
          )}
          {metaOpen && activeScene && (
            <ScenePanel
              scene={activeScene}
              onClose={() => setMetaOpen(false)}
              focusProgressions={progressFocus}
              onProseReplaced={() => setReloadToken((n) => n + 1)}
            />
          )}
          {notesOpen && (
            <NotesMargin projectId={projectId} chapterId={activeChapter.id} editor={editor} />
          )}
          {contextOpen && activeScene && (
            <ContextRail scene={activeScene} onClose={() => setContextOpen(false)} />
          )}
        </div>
      ) : (
        /* The first thing a new reader sees. It leads with the paste path
           because that is the thing no competitor can do: the codex builds
           itself out of the prose, with no account and no API key. Every
           rival makes you enter a key before anything works at all. */
        <div className="lw-empty lw-empty--center" data-testid="write-empty">
          <p className="lw-empty__title">Nothing written yet.</p>
          <p className="lw-empty__note">
            Already have a draft? Paste it and Loomwright builds the codex for you — cast,
            places, items, who owns what and who went where. No AI key needed.
          </p>
          <div className="lw-empty__actions">
            <button
              type="button"
              className="lw-btn lw-btn--primary"
              onClick={() => setRoute('handoff')}
            >
              Paste a chapter →
            </button>
            <button type="button" className="lw-btn" onClick={() => void addChapter()}>
              + Start from blank
            </button>
          </div>
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
