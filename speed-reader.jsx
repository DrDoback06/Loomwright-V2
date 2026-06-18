// =====================================================================
// speed-reader.jsx — Speed Reader (RSVP) side panel + full workspace.
//
// Provides two surfaces:
//   • <SpeedReaderPanelBody/>      — compact side-panel companion
//   • <SpeedReaderWorkspaceFull/>  — full-screen reading workspace
//
// Both share the same `useSpeedReader` hook which implements a real
// (lightweight) RSVP timing loop:
//   - WPM controls base interval
//   - Punctuation pause: ,;: → ×1.6   .!?  → ×2.2
//   - Sentence pause:    extra hold at sentence boundary
//   - Long-word slowdown: words > 8 chars take ×1.4
//
// Designed to be useful WITHOUT real backend wiring — pasted-text source
// type is fully functional. Other source types ("current chapter",
// "selected passage") populate from sample data and post a CustomEvent
// so the host can swap the text in.
//
// Public callbacks (all optional, dispatched via window CustomEvents too):
//   onSpeedReaderSelectDocument          — switched source
//   onSpeedReaderAddSource               — Add Reading Source clicked
//   onSpeedReaderPasteText               — pasted new source text
//   onSpeedReaderReadCurrentChapter
//   onSpeedReaderReadSelectedPassage
//   onSpeedReaderPlay / Pause / Restart
//   onSpeedReaderPreviousWord / NextWord
//   onSpeedReaderPreviousSentence / NextSentence
//   onSpeedReaderChangeWpm / ChangeFontSize
//   onSpeedReaderTogglePunctuationPause / ToggleSentencePause
//   onSpeedReaderBookmark
//   onSpeedReaderSaveSession
//   onSpeedReaderSendSentenceToWriterRoom
//   onSpeedReaderExportSession
//   onOpenSpeedReaderWorkspace / onExitSpeedReaderWorkspace
// =====================================================================

const { useState: _sr_us, useEffect: _sr_ue, useRef: _sr_ur, useMemo: _sr_um, useCallback: _sr_uc } = React;

// ---------------------------------------------------------------------
// Sample sources — these align with the existing Writer's Room demo data.
// ---------------------------------------------------------------------
const SR_SAMPLE_SOURCES = [
  {
    id: "ch7",
    label: "Ch.7 — Ash & Auger",
    kind: "chapter",
    text: "The light over Pale Reach was the colour of cooled tin when Aelinor Vey came through the stockade gate. Snow had been falling all morning, and the wind off the salt flats turned each flake into a small, deliberate cut. She carried the Auger of Hess in a felt-lined case slung across her back, and even wrapped, even quiet, it pressed against her like a second pulse. She had not slept since Brec's letter, and three nights of refusing the dreams had given her hands a fine, undignified tremor.",
  },
  {
    id: "ch1",
    label: "Ch.1 — The Hollow Crown",
    kind: "chapter",
    text: "The crown was a hollow thing, beaten thin from a single sheet of brittle silver, and Saren held it as one would hold a wasp. It had survived three burnings and two abdications. It had survived him, too.",
  },
  {
    id: "ch2",
    label: "Ch.2 — Pale Reach",
    kind: "chapter",
    text: "Pale Reach was not a town so much as a confession. Built on salt, kept by accident, every house leaned away from the wind as if embarrassed to be there at all.",
  },
  {
    id: "ch3",
    label: "Ch.3 — Saren's Bargain",
    kind: "chapter",
    text: "Saren of Hess kept three letters in the lining of his coat: one for his sister, one for the crown, and one for himself. He had not opened any of them in seven years.",
  },
  {
    id: "ch9",
    label: "Ch.9 — The Auger's Door",
    kind: "chapter",
    text: "There was a door in Hess that no one had named, and the Auger turned, slowly, toward it. Aelinor felt the case at her back grow warm in a way that did not depend on weather.",
  },
  {
    id: "passage",
    label: "Selected passage (Ch.7 §2)",
    kind: "passage",
    text: "She set the case on the table. The wood under it gave the smallest, indignant sigh. \"Then you'll want to see what Saren of Hess sent me to bring.\"",
  },
];

const SR_DEFAULTS = {
  wpm: 360,
  fontSize: 64,
  punctuationPause: true,
  sentencePause: true,
  longWordSlow: true,
  focusMode: false,
};

// ---------------------------------------------------------------------
// Tokenise a passage into an RSVP-ready list of word "beats" with
// metadata describing the pause that should follow.
// ---------------------------------------------------------------------
function srTokenise(text) {
  if (!text) return [];
  const raw = text.replace(/\s+/g, " ").trim().split(" ");
  let sentenceIdx = 0;
  const out = [];
  raw.forEach((w, i) => {
    if (!w) return;
    const last = w[w.length - 1];
    const isSentenceEnd = /[.!?…]/.test(last);
    const isClause = /[,;:—–]/.test(last);
    out.push({
      idx: i,
      word: w,
      sentence: sentenceIdx,
      sentenceEnd: isSentenceEnd,
      clauseEnd: !isSentenceEnd && isClause,
      length: w.length,
    });
    if (isSentenceEnd) sentenceIdx += 1;
  });
  return out;
}

// Compute the pause multiplier for a beat under current settings.
function srPauseMultiplier(beat, opts) {
  if (!beat) return 1;
  let m = 1;
  if (opts.longWordSlow && beat.length > 8) m *= 1.4;
  if (opts.punctuationPause && beat.clauseEnd) m *= 1.6;
  if (opts.sentencePause && beat.sentenceEnd) m *= 2.2;
  return m;
}

// Compute the "pivot" letter index (ORP) and split the word into thirds
// so the centre red letter can be rendered.
// Entity-aware reading: a live name→type/colour lookup so known entities
// tint as they flash past (worldbuilding eyes catch their own names).
// Capitalised tokens only, min 3 letters, full names + name parts.
function srUseEntityLookup() {
  const [tick, setTick] = _sr_us(0);
  _sr_ue(() => {
    const bump = () => setTick((t) => t + 1);
    const evs = ["lw:entity-store-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  return _sr_um(() => {
    const map = new Map();
    const B = window.LoomwrightBackend;
    for (const t of ["cast", "locations", "items", "factions", "bestiary"]) {
      const meta = (typeof ENTITY_TYPES !== "undefined" && ENTITY_TYPES[t]) || {};
      for (const e of (B?.EntityService?.listSync?.(t) || [])) {
        if (!e || e.status === "deleted" || !e.name) continue;
        const entry = { type: t, color: meta.color, glyph: meta.glyph, name: e.name };
        for (const token of [e.name, ...String(e.name).split(/\s+/)]) {
          const k = String(token).toLowerCase().replace(/[^a-z'’-]/gi, "");
          if (k.length >= 3 && !map.has(k)) map.set(k, entry);
        }
      }
    }
    return map;
  }, [tick]);
}
function srEntityFor(map, word) {
  if (!map || !word || !/^[A-Z]/.test(String(word))) return null;
  return map.get(String(word).toLowerCase().replace(/[^a-z'’-]/gi, "")) || null;
}

function srSplitWord(word) {
  if (!word) return { before: "", pivot: "", after: "" };
  const len = word.length;
  let p = 0;
  if (len <= 1)      p = 0;
  else if (len <= 4) p = 1;
  else if (len <= 6) p = 2;
  else if (len <= 9) p = 3;
  else if (len <= 13) p = 4;
  else                p = 5;
  return {
    before: word.slice(0, p),
    pivot:  word[p] || "",
    after:  word.slice(p + 1),
  };
}

// ---------------------------------------------------------------------
// useSpeedReader — the shared engine. Both surfaces consume this.
//
// Persistence: when a source is a persisted SpeedReaderService session
// (sourceId begins with "sr-"), every state change is mirrored back to
// the service. On mount we hydrate from `getActiveSessionSync()` if
// available, so reload restores progress/WPM/bookmarks/notes.
// ---------------------------------------------------------------------
function _sr_backend() {
  return (typeof window !== "undefined") ? window.LoomwrightBackend : null;
}
function _sr_isPersistedSession(id) {
  return typeof id === "string" && id.startsWith("sr-");
}
function _sr_buildSourceFromSession(s) {
  return {
    id: s.id,
    label: s.name || s.sourceTitle || "Reading session",
    kind: s.sourceType || "paste",
    text: s.rawText || "",
    sessionId: s.id,
  };
}

function useSpeedReader(initialSourceId = "ch7") {
  // Hydrate persisted sessions + sample fallbacks once on mount.
  const persistedAtMount = _sr_um(() => {
    const B = _sr_backend();
    if (!B?.SpeedReaderService) return { sessions: [], activeId: null };
    return {
      sessions: B.SpeedReaderService.listSessionsSync(),
      activeId: B.SpeedReaderService.loadSync().activeId,
    };
  }, []);

  const initialSources = _sr_um(() => {
    const live = (persistedAtMount.sessions || []).map(_sr_buildSourceFromSession);
    if (live.length) return live;
    // No live sessions: fall back to the manuscript's own chapters so the
    // reader always reads YOUR book. Sample passages appear only when the
    // user explicitly loaded the sample project.
    const chapters = (() => {
      try {
        const st = _sr_backend()?.ManuscriptChapterService?.loadSync() || {};
        const ms = st.manuscripts || {};
        return (st.chapters || [])
          .filter((c) => !c.reserved)
          .map((c, i) => ({
            id: "chapter-" + c.id,
            label: (c.num ? "Ch." + c.num + " — " : "") + (c.title || "Chapter " + (i + 1)),
            kind: "chapter",
            text: (ms[c.id] && (ms[c.id].text || "")) || "",
          }))
          .filter((s) => s.text.trim());
      } catch (_) { return []; }
    })();
    if (chapters.length) return chapters;
    return window.__LW_SAMPLE_LOADED__ ? SR_SAMPLE_SOURCES : [];
  }, [persistedAtMount.sessions]);

  const activeSessionAtMount = _sr_um(() =>
    (persistedAtMount.sessions || []).find((s) => s.id === persistedAtMount.activeId) || null,
  [persistedAtMount.activeId, persistedAtMount.sessions]);

  const initialIdx = activeSessionAtMount ? (activeSessionAtMount.currentWordIndex | 0) : 0;
  const initialWpm = activeSessionAtMount?.wpm || SR_DEFAULTS.wpm;
  const initialFont = activeSessionAtMount?.fontSize || SR_DEFAULTS.fontSize;
  const initialResolvedSourceId =
    persistedAtMount.activeId
    || (initialSources[0] ? initialSources[0].id : initialSourceId);

  const [sources, setSources] = _sr_us(initialSources);
  const [sourceId, setSourceId] = _sr_us(initialResolvedSourceId);
  const [idx, setIdx] = _sr_us(initialIdx);
  const [playing, setPlaying] = _sr_us(false);
  const [wpm, setWpm] = _sr_us(initialWpm);
  const [fontSize, setFontSize] = _sr_us(initialFont);
  const [punctuationPause, setPunctuationPause] = _sr_us(activeSessionAtMount?.punctuationPause ?? SR_DEFAULTS.punctuationPause);
  const [sentencePause, setSentencePause] = _sr_us(activeSessionAtMount?.sentencePause ?? SR_DEFAULTS.sentencePause);
  const [longWordSlow, setLongWordSlow] = _sr_us(activeSessionAtMount?.longWordSlow ?? SR_DEFAULTS.longWordSlow);
  const [focusMode, setFocusMode] = _sr_us(activeSessionAtMount?.focusMode ?? SR_DEFAULTS.focusMode);
  const [bookmarks, setBookmarks] = _sr_us(activeSessionAtMount?.bookmarks || []);
  const [notes, setNotes] = _sr_us(activeSessionAtMount?.notes || []);
  const [session, setSession] = _sr_us({ startedAt: null, wordsRead: 0, pauses: 0 });

  const source = _sr_um(() => sources.find((s) => s.id === sourceId) || sources[0], [sources, sourceId]);
  const beats  = _sr_um(() => srTokenise(source ? source.text : ""), [source]);
  const beat   = beats[Math.min(idx, beats.length - 1)];
  const fraction = beats.length ? (idx + 1) / beats.length : 0;

  // Reset to start when source changes — unless the new source is a
  // persisted session, in which case hydrate from it.
  _sr_ue(() => {
    if (_sr_isPersistedSession(sourceId)) {
      const B = _sr_backend();
      const sess = B?.SpeedReaderService?.getSessionSync(sourceId);
      if (sess) {
        setIdx(sess.currentWordIndex | 0);
        setWpm(sess.wpm || SR_DEFAULTS.wpm);
        setFontSize(sess.fontSize || SR_DEFAULTS.fontSize);
        setPunctuationPause(sess.punctuationPause !== false);
        setSentencePause(sess.sentencePause !== false);
        setLongWordSlow(sess.longWordSlow !== false);
        setFocusMode(!!sess.focusMode);
        setBookmarks(sess.bookmarks || []);
        setNotes(sess.notes || []);
        B.SpeedReaderService.setActiveSession(sess.id).catch(() => {});
        return;
      }
    }
    setIdx(0);
  }, [sourceId]);

  // Persist progress + settings whenever they change for a persisted session.
  // Coalesce with a short timeout so the RSVP loop doesn't write on every word.
  _sr_ue(() => {
    if (!_sr_isPersistedSession(sourceId)) return;
    const B = _sr_backend();
    if (!B?.SpeedReaderService) return;
    const t = setTimeout(() => {
      B.SpeedReaderService.updateSession(sourceId, {
        currentWordIndex: idx,
        wpm, fontSize,
        punctuationPause, sentencePause, longWordSlow, focusMode,
        bookmarks, notes,
        stats: { ...(session || {}), lastReadAt: new Date().toISOString() },
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [sourceId, idx, wpm, fontSize, punctuationPause, sentencePause, longWordSlow, focusMode, bookmarks, notes, session]);

  // RSVP timing loop.
  _sr_ue(() => {
    if (!playing) return;
    if (!beats.length) return;
    if (idx >= beats.length - 1) {
      setPlaying(false);
      return;
    }
    const baseMs = 60000 / Math.max(60, wpm);
    const mult = srPauseMultiplier(beats[idx], { punctuationPause, sentencePause, longWordSlow });
    const ms = Math.max(40, baseMs * mult);
    const t = setTimeout(() => {
      setIdx((i) => i + 1);
      setSession((s) => ({
        startedAt: s.startedAt || Date.now(),
        wordsRead: s.wordsRead + 1,
        pauses: s.pauses + (mult > 1 ? 1 : 0),
      }));
    }, ms);
    return () => clearTimeout(t);
  }, [playing, idx, wpm, beats, punctuationPause, sentencePause, longWordSlow]);

  // ----- Sentence navigation helpers
  const sentenceBoundaries = _sr_um(() => {
    const arr = [0];
    beats.forEach((b, i) => { if (b.sentenceEnd && i < beats.length - 1) arr.push(i + 1); });
    return arr;
  }, [beats]);

  const seek = _sr_uc((newIdx) => {
    setIdx(Math.max(0, Math.min(beats.length - 1, newIdx)));
  }, [beats.length]);

  const previousWord = _sr_uc(() => seek(idx - 1), [idx, seek]);
  const nextWord     = _sr_uc(() => seek(idx + 1), [idx, seek]);

  const previousSentence = _sr_uc(() => {
    const before = sentenceBoundaries.filter((b) => b < idx).pop();
    seek(before == null ? 0 : before);
  }, [idx, sentenceBoundaries, seek]);

  const nextSentence = _sr_uc(() => {
    const after = sentenceBoundaries.find((b) => b > idx);
    seek(after == null ? beats.length - 1 : after);
  }, [idx, sentenceBoundaries, beats.length, seek]);

  const restart = _sr_uc(() => { seek(0); setPlaying(false); setSession({ startedAt: null, wordsRead: 0, pauses: 0 }); }, [seek]);

  // ----- Bookmark / note helpers
  const bookmark = _sr_uc((label) => {
    const b = beats[idx];
    const item = {
      id: "bm-" + Date.now(),
      idx, label: label || (b ? b.word : ""),
      sourceId, sentence: b ? b.sentence : 0,
      ts: Date.now(),
    };
    setBookmarks((arr) => [item, ...arr]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lw:speed-reader-bookmark", { detail: item }));
    }
    return item;
  }, [idx, beats, sourceId]);

  const noteCurrentSentence = _sr_uc((kind, body) => {
    const b = beats[idx];
    if (!b) return;
    // Build the sentence around current idx
    let start = idx, end = idx;
    while (start > 0 && !beats[start - 1].sentenceEnd) start -= 1;
    while (end < beats.length - 1 && !beats[end].sentenceEnd) end += 1;
    const sentence = beats.slice(start, end + 1).map((bb) => bb.word).join(" ");
    const note = {
      id: "nt-" + Date.now(),
      kind: kind || "difficulty",
      body: body || "",
      sentence,
      sourceId,
      idx,
      ts: Date.now(),
    };
    setNotes((arr) => [note, ...arr]);
    return note;
  }, [idx, beats, sourceId]);

  // ----- Add a pasted source (persisted via SpeedReaderService when available)
  const addPastedSource = _sr_uc((text, label) => {
    const B = _sr_backend();
    if (B?.SpeedReaderService && text && text.trim()) {
      // Fire-and-forget; we still update local state synchronously so
      // the UI can switch immediately.
      const create = B.SpeedReaderService.createSession({
        sourceType: "paste",
        rawText: text,
        name: label || "Pasted text",
        sourceTitle: label || "Pasted text",
        wpm, fontSize, punctuationPause, sentencePause, longWordSlow, focusMode,
      });
      // Promise resolves with the session — but we want immediate UI feedback.
      Promise.resolve(create).then((s) => {
        if (!s) return;
        setSources((arr) => [_sr_buildSourceFromSession(s), ...arr.filter((x) => x.id !== s.id)]);
        setSourceId(s.id);
      }).catch(() => {});
      // Provisional local source so the UI does not stall.
      const provisionalId = "paste-" + Date.now();
      const provisional = { id: provisionalId, label: label || "Pasted text", kind: "paste", text };
      setSources((arr) => [provisional, ...arr]);
      setSourceId(provisionalId);
      return provisional;
    }
    const id = "paste-" + Date.now();
    const s = { id, label: label || "Pasted text", kind: "paste", text };
    setSources((arr) => [s, ...arr]);
    setSourceId(id);
    return s;
  }, [wpm, fontSize, punctuationPause, sentencePause, longWordSlow, focusMode]);

  // ----- Read current Writer's Room chapter
  const readCurrentChapter = _sr_uc(async () => {
    const B = _sr_backend();
    if (!B?.SpeedReaderService) return null;
    try {
      const s = await B.SpeedReaderService.createSession({ sourceType: "chapter" });
      setSources((arr) => [_sr_buildSourceFromSession(s), ...arr.filter((x) => x.id !== s.id)]);
      setSourceId(s.id);
      return s;
    } catch (_) { return null; }
  }, []);

  // ----- Read a reference by id
  const readReference = _sr_uc(async (referenceId) => {
    const B = _sr_backend();
    if (!B?.SpeedReaderService || !referenceId) return null;
    try {
      const s = await B.SpeedReaderService.createSession({ sourceType: "reference", sourceId: referenceId });
      setSources((arr) => [_sr_buildSourceFromSession(s), ...arr.filter((x) => x.id !== s.id)]);
      setSourceId(s.id);
      return s;
    } catch (_) { return null; }
  }, []);

  // ----- Delete a persisted session
  const deletePersistedSession = _sr_uc(async (sessionId) => {
    const B = _sr_backend();
    if (!B?.SpeedReaderService || !sessionId) return;
    await B.SpeedReaderService.deleteSession(sessionId);
    setSources((arr) => arr.filter((x) => x.id !== sessionId));
    if (sourceId === sessionId) {
      const next = sources.find((x) => x.id !== sessionId);
      setSourceId(next ? next.id : (SR_SAMPLE_SOURCES[0]?.id || ""));
    }
  }, [sourceId, sources]);

  // ----- Reset progress on the active persisted session
  const resetPersistedProgress = _sr_uc(async () => {
    const B = _sr_backend();
    if (!_sr_isPersistedSession(sourceId)) { setIdx(0); return; }
    if (!B?.SpeedReaderService) return;
    await B.SpeedReaderService.resetProgress(sourceId);
    setIdx(0);
  }, [sourceId]);

  return {
    // state
    sources, source, sourceId, beats, beat, idx, fraction, playing,
    wpm, fontSize, punctuationPause, sentencePause, longWordSlow, focusMode,
    bookmarks, notes, session,
    // setters
    setSourceId, setPlaying, setWpm, setFontSize,
    setPunctuationPause, setSentencePause, setLongWordSlow, setFocusMode,
    // actions
    seek, previousWord, nextWord, previousSentence, nextSentence, restart,
    bookmark, noteCurrentSentence, addPastedSource,
    readCurrentChapter, readReference, deletePersistedSession, resetPersistedProgress,
  };
}

// ---------------------------------------------------------------------
// SpeedReaderPanelBody — compact side-panel companion.
// ---------------------------------------------------------------------
const SpeedReaderPanelBody = ({ panel }) => {
  const sr = useSpeedReader("ch7");
  // On the phone the panel is a full-screen sheet, so the word can use the
  // reader's true font-size; the narrow desktop side-panel still caps at 44.
  const srMobile = typeof useIsMobile !== "undefined" ? useIsMobile() : false;
  const split = srSplitWord(sr.beat ? sr.beat.word : "—");
  const srEntityMap = srUseEntityLookup();
  const entityHit = srEntityFor(srEntityMap, sr.beat ? sr.beat.word : "");
  const wordsLeft = Math.max(0, sr.beats.length - (sr.idx + 1));
  const secsLeft  = Math.ceil(wordsLeft / Math.max(60, sr.wpm) * 60);

  const onOpen = () => {
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "speed-reader", panelKind: "speedReader", sourcePanel: "p-speedReader" } }));
  };
  const onAddSource = () => {
    window.dispatchEvent(new CustomEvent("lw:speed-reader-add", { detail: { sourcePanel: "p-speedReader" } }));
  };
  const onPaste = () => {
    const text = typeof window !== "undefined" ? window.prompt("Paste text to read:") : "";
    if (text && text.trim()) sr.addPastedSource(text.trim(), "Pasted (panel)");
  };

  if (sr.sources.length === 0) {
    return (
      <div className="sr-panel" data-ui="SpeedReaderPanelBody">
        <EmptyState icon="eye" title="Nothing to read yet"
          body="Write a chapter in the Writer's Room, or paste any text to speed-read it."
          action={<Btn variant="primary" size="sm" icon="paper" data-callback="onSpeedReaderPasteText" onClick={onPaste}>Paste text</Btn>}/>
      </div>
    );
  }

  return (
    <div className="sr-panel" data-ui="SpeedReaderPanelBody">
      <div className="sr-panel__source">
        <select
          className="sr-panel__select"
          value={sr.sourceId}
          onChange={(e) => sr.setSourceId(e.target.value)}
          data-callback="onSpeedReaderSelectDocument"
        >
          {sr.sources.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button className="sr-panel__icon-btn" title="Flag this sentence as difficult — it resurfaces on Today"
          data-callback="onSpeedReaderNoteDifficulty"
          onClick={() => { sr.noteCurrentSentence("difficulty", ""); window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Flagged — it'll appear on Today under Writing prompts." } })); }}>
          <Icon name="alert" size={11}/>
        </button>
        <button className="sr-panel__icon-btn" title="Paste text"
          onClick={onPaste}
          data-callback="onSpeedReaderPasteText">
          <Icon name="paper" size={11}/>
        </button>
      </div>

      <div className={"sr-panel__stage " + (sr.focusMode ? "is-focus" : "")}>
        <div className={"sr-panel__word" + (entityHit ? " is-entity" : "")}
          data-ui="SpeedReaderWord" data-testid="sr-word"
          data-entity-type={entityHit ? entityHit.type : undefined}
          title={entityHit ? entityHit.name + " — known " + entityHit.type : undefined}
          style={{ fontSize: srMobile ? sr.fontSize : Math.min(sr.fontSize, 44), "--ec": entityHit ? entityHit.color : undefined }}>
          <span className="sr-panel__word-side">{split.before}</span>
          <span className="sr-panel__word-pivot" data-testid="sr-pivot">{split.pivot}</span>
          <span className="sr-panel__word-side">{split.after}</span>
          {entityHit && <span className="sr-entity-glyph" aria-hidden>{entityHit.glyph}</span>}
        </div>
        <div className="sr-panel__progress">
          <div className="sr-panel__progress-fill" style={{ width: (sr.fraction * 100) + "%" }}/>
        </div>
        <div className="sr-panel__meta">
          <span>word {sr.idx + 1} / {sr.beats.length}</span>
          <span>·</span>
          <span>~{secsLeft}s left</span>
        </div>
      </div>

      <div className="sr-panel__transport">
        <button className="sr-panel__t-btn" onClick={sr.previousSentence} title="Previous sentence" data-callback="onSpeedReaderPreviousSentence">⟪</button>
        <button className="sr-panel__t-btn" onClick={sr.previousWord} title="Previous word" data-callback="onSpeedReaderPreviousWord">‹</button>
        <button className="sr-panel__t-btn sr-panel__t-btn--play"
          onClick={() => sr.setPlaying((p) => !p)}
          data-callback={sr.playing ? "onSpeedReaderPause" : "onSpeedReaderPlay"}
          title={sr.playing ? "Pause" : "Play"}>
          {sr.playing ? "⏸" : "▶"}
        </button>
        <button className="sr-panel__t-btn" onClick={sr.nextWord} title="Next word" data-callback="onSpeedReaderNextWord">›</button>
        <button className="sr-panel__t-btn" onClick={sr.nextSentence} title="Next sentence" data-callback="onSpeedReaderNextSentence">⟫</button>
      </div>

      <div className="sr-panel__sliders">
        <label className="sr-panel__slider">
          <span>WPM</span>
          <input type="range" min="120" max="900" step="20"
            value={sr.wpm}
            onChange={(e) => sr.setWpm(Number(e.target.value))}
            data-callback="onSpeedReaderChangeWpm"/>
          <b>{sr.wpm}</b>
        </label>
        <label className="sr-panel__slider">
          <span>Size</span>
          <input type="range" min="28" max="80" step="2"
            value={sr.fontSize}
            onChange={(e) => sr.setFontSize(Number(e.target.value))}
            data-callback="onSpeedReaderChangeFontSize"/>
          <b>{sr.fontSize}px</b>
        </label>
      </div>

      <div className="sr-panel__toggles">
        <label className="sr-panel__chk">
          <input type="checkbox" checked={sr.punctuationPause}
            onChange={(e) => sr.setPunctuationPause(e.target.checked)}
            data-callback="onSpeedReaderTogglePunctuationPause"/>
          Punctuation pause
        </label>
        <label className="sr-panel__chk">
          <input type="checkbox" checked={sr.sentencePause}
            onChange={(e) => sr.setSentencePause(e.target.checked)}
            data-callback="onSpeedReaderToggleSentencePause"/>
          Sentence pause
        </label>
        <label className="sr-panel__chk">
          <input type="checkbox" checked={sr.focusMode}
            onChange={(e) => sr.setFocusMode(e.target.checked)}/>
          Focus mode
        </label>
      </div>

      <div className="sr-panel__actions">
        <button className="sr-panel__btn" onClick={() => sr.bookmark()} data-callback="onSpeedReaderBookmark">
          <Icon name="bookmark" size={11}/> Bookmark
        </button>
        <button className="sr-panel__btn" onClick={() => sr.readCurrentChapter()} data-callback="onReadCurrentChapter">
          <Icon name="paper" size={11}/> Read chapter
        </button>
        <button className="sr-panel__btn" onClick={onAddSource} data-callback="onSpeedReaderAddSource">
          <Icon name="plus" size={11}/> Add source
        </button>
        <button className="sr-panel__btn sr-panel__btn--primary" onClick={onOpen} data-callback="onOpenSpeedReaderWorkspace">
          <Icon name="eye" size={11}/> Open Reader
        </button>
      </div>

      <div className="sr-panel__session">
        <span><b>{sr.session.wordsRead}</b> words read</span>
        <span><b>{sr.bookmarks.length}</b> bookmark{sr.bookmarks.length === 1 ? "" : "s"}</span>
        <span><b>{sr.notes.length}</b> note{sr.notes.length === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SpeedReaderWorkspaceFull — full-bleed reading workspace.
// Layout: left (sources + bookmarks) · centre (reader stage) · right
// (settings + session stats + notes + actions). Bottom strip: progress
// scrubber + bookmark strip.
// ---------------------------------------------------------------------
const SpeedReaderWorkspaceFull = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const sr = useSpeedReader("ch7");
  const [pasteOpen, setPasteOpen] = _sr_us(false);
  const [pasteText, setPasteText] = _sr_us("");
  const [pasteLabel, setPasteLabel] = _sr_us("");

  const split = srSplitWord(sr.beat ? sr.beat.word : "—");
  const srEntityMap = srUseEntityLookup();
  const entityHit = srEntityFor(srEntityMap, sr.beat ? sr.beat.word : "");

  // Current sentence + neighbour context lines
  const ctx = _sr_um(() => {
    if (!sr.beats.length) return { before: "", current: "", after: "" };
    let start = sr.idx, end = sr.idx;
    while (start > 0 && !sr.beats[start - 1].sentenceEnd) start -= 1;
    while (end < sr.beats.length - 1 && !sr.beats[end].sentenceEnd) end += 1;
    const current = sr.beats.slice(start, end + 1).map((b) => b.word).join(" ");
    // Previous sentence
    let pStart = start - 1, pEnd = start - 1;
    if (pStart >= 0) {
      pEnd = pStart;
      while (pStart > 0 && !sr.beats[pStart - 1].sentenceEnd) pStart -= 1;
    }
    const before = pStart >= 0 ? sr.beats.slice(pStart, pEnd + 1).map((b) => b.word).join(" ") : "";
    // Next sentence
    let nStart = end + 1, nEnd = end + 1;
    if (nStart < sr.beats.length) {
      while (nEnd < sr.beats.length - 1 && !sr.beats[nEnd].sentenceEnd) nEnd += 1;
    }
    const after = nStart < sr.beats.length ? sr.beats.slice(nStart, nEnd + 1).map((b) => b.word).join(" ") : "";
    return { before, current, after };
  }, [sr.beats, sr.idx]);

  const onSendToWritersRoom = () => {
    const note = sr.noteCurrentSentence("send-to-writers-room", ctx.current);
    window.dispatchEvent(new CustomEvent("lw:speed-reader-send-sentence", { detail: { ...note } }));
  };
  const onExportSession = () => {
    const pack = {
      type: "speed-reader-session",
      sourceId: sr.sourceId,
      session: sr.session,
      bookmarks: sr.bookmarks,
      notes: sr.notes,
      ts: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("lw:speed-reader-export-session", { detail: pack }));
    try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(pack, null, 2)); } catch (e) {}
  };
  const onSaveSession = () => {
    window.dispatchEvent(new CustomEvent("lw:speed-reader-save-session", {
      detail: { sourceId: sr.sourceId, session: sr.session, bookmarks: sr.bookmarks, notes: sr.notes },
    }));
  };
  const onPasteCommit = () => {
    if (pasteText.trim()) {
      sr.addPastedSource(pasteText.trim(), pasteLabel.trim() || "Pasted text");
      setPasteText(""); setPasteLabel(""); setPasteOpen(false);
    }
  };

  return (
    <WorkspaceShell
      icon="eye"
      eyebrow="Tools" title="Speed Reader"
      subtitle="Read the manuscript at pace. Bookmark, flag, send to Writer's Room."
      createLabel="Add reading source"
      onCreate={() => setPasteOpen(true)}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      extraActions={
        <>
          <button type="button" className="fws-topbar__exit" onClick={() => sr.setPlaying((p) => !p)} data-callback={sr.playing ? "onSpeedReaderPause" : "onSpeedReaderPlay"}>
            <Icon name={sr.playing ? "close" : "bolt"} size={11}/> {sr.playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="fws-topbar__exit" onClick={sr.restart} data-callback="onSpeedReaderRestart">
            <Icon name="refresh" size={11}/> Restart
          </button>
          <button type="button" className="fws-topbar__exit" onClick={() => sr.bookmark()} data-callback="onSpeedReaderBookmark">
            <Icon name="bookmark" size={11}/> Bookmark
          </button>
        </>
      }
      left={
        <>
          <div className="fws-section"><span className="fws-section__title">Reading sources</span></div>
          <div className="fws-settings-nav">
            {sr.sources.map((s) => (
              <button key={s.id}
                className={"fws-settings-nav__row " + (sr.sourceId === s.id ? "is-on" : "")}
                onClick={() => sr.setSourceId(s.id)}
                data-callback="onSpeedReaderSelectDocument">
                <Icon name={s.kind === "paste" ? "code" : (s.kind === "passage" ? "bookmark" : "paper")} size={11}/>
                <span style={{ flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 9, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.kind}</span>
              </button>
            ))}
            <button className="fws-settings-nav__row" onClick={() => sr.readCurrentChapter()} data-callback="onReadCurrentChapter">
              <Icon name="paper" size={11}/> Read current chapter
            </button>
            <button className="fws-settings-nav__row" onClick={() => setPasteOpen(true)} data-callback="onSpeedReaderAddSource">
              <Icon name="plus" size={11}/> Add reading source…
            </button>
          </div>

          {pasteOpen && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line-1)" }}>
              <div className="fws-section__title" style={{ marginBottom: 6 }}>Paste text</div>
              <input type="text" value={pasteLabel} onChange={(e) => setPasteLabel(e.target.value)}
                placeholder='Label (e.g. "Editor note")'
                style={{ width: "100%", padding: "4px 6px", marginBottom: 6, border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontSize: 11 }}/>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your text here. Punctuation drives the pause weights." rows={4}
                style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontFamily: "var(--font-serif)", fontSize: 12, resize: "vertical" }}/>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button className="fws-section__action" onClick={() => { setPasteOpen(false); setPasteText(""); }}>Cancel</button>
                <button className="fws-section__action" style={{ background: "var(--accent-soft)", color: "var(--accent-deep)" }} onClick={onPasteCommit} data-callback="onSpeedReaderPasteText">Use this text</button>
              </div>
            </div>
          )}

          <div className="fws-section" style={{ marginTop: 12 }}><span className="fws-section__title">Bookmarks ({sr.bookmarks.length})</span></div>
          {sr.bookmarks.length === 0 ? (
            <div className="fws-empty" style={{ padding: 16, fontSize: 11, fontStyle: "italic" }}>No bookmarks yet. Press <b>Bookmark</b> while reading to mark a point.</div>
          ) : (
            <div className="fws-settings-nav">
              {sr.bookmarks.map((b) => (
                <button key={b.id} className="fws-settings-nav__row" onClick={() => sr.seek(b.idx)}>
                  <Icon name="bookmark" size={11}/>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{b.label}"</span>
                  <span style={{ fontSize: 9, color: "var(--ink-4)" }}>#{b.idx + 1}</span>
                </button>
              ))}
            </div>
          )}
        </>
      }
      main={
        <>
          <div className={"fws-reader-stage " + (sr.focusMode ? "sr-focus" : "")}>
            {/* Context line above (previous sentence) */}
            <div className="sr-context sr-context--before">{ctx.before}</div>

            {/* The word */}
            <div className={"fws-reader-word sr-stage-word" + (entityHit ? " is-entity" : "")}
              data-ui="SpeedReaderWord" data-testid="sr-word-stage"
              data-entity-type={entityHit ? entityHit.type : undefined}
              title={entityHit ? entityHit.name + " — known " + entityHit.type : undefined}
              style={{ fontSize: sr.fontSize, "--ec": entityHit ? entityHit.color : undefined }}>
              <span className="sr-side">{split.before}</span>
              <span className="fws-reader-word__pivot" data-testid="sr-pivot-stage">{split.pivot}</span>
              <span className="sr-side">{split.after}</span>
              {entityHit && <span className="sr-entity-glyph" aria-hidden>{entityHit.glyph}</span>}
            </div>

            {/* Sentence under the word */}
            <div className="sr-context sr-context--current">
              <span style={{ opacity: 0.5 }}>{ctx.current.slice(0, ctx.current.indexOf(sr.beat ? sr.beat.word : ""))}</span>
              <b style={{ color: "var(--accent-deep)" }}>{sr.beat ? sr.beat.word : ""}</b>
              <span style={{ opacity: 0.5 }}>{ctx.current.slice(ctx.current.indexOf(sr.beat ? sr.beat.word : "") + (sr.beat ? sr.beat.word.length : 0))}</span>
            </div>

            {/* Next-sentence ghost */}
            <div className="sr-context sr-context--after">{ctx.after}</div>

            {/* Transport controls */}
            <div className="fws-reader-ctrls">
              <button className="fws-section__action" onClick={sr.previousSentence} data-callback="onSpeedReaderPreviousSentence">⟪ Prev sentence</button>
              <button className="fws-section__action" onClick={sr.previousWord} data-callback="onSpeedReaderPreviousWord">‹ Prev word</button>
              <button className="fws-topbar__primary"
                onClick={() => sr.setPlaying((p) => !p)}
                data-callback={sr.playing ? "onSpeedReaderPause" : "onSpeedReaderPlay"}>
                <Icon name={sr.playing ? "close" : "bolt"} size={11}/> {sr.playing ? "Pause" : "Play"}
              </button>
              <button className="fws-section__action" onClick={sr.nextWord} data-callback="onSpeedReaderNextWord">Next word ›</button>
              <button className="fws-section__action" onClick={sr.nextSentence} data-callback="onSpeedReaderNextSentence">Next sentence ⟫</button>
            </div>

            {/* Progress + bookmark strip */}
            <div className="sr-scrubber">
              <input type="range" min="0" max={Math.max(0, sr.beats.length - 1)} step="1"
                value={sr.idx}
                onChange={(e) => sr.seek(Number(e.target.value))}
                className="sr-scrubber__range"/>
              <div className="sr-scrubber__bookmarks">
                {sr.bookmarks.map((b) => (
                  <span key={b.id} className="sr-scrubber__bm"
                    title={b.label + " — #" + (b.idx + 1)}
                    style={{ left: (sr.beats.length ? (b.idx / Math.max(1, sr.beats.length - 1)) * 100 : 0) + "%" }}/>
                ))}
              </div>
              <div className="sr-scrubber__meta">
                <span>word {sr.idx + 1} of {sr.beats.length}</span>
                <span>·</span>
                <span>sentence {(sr.beat ? sr.beat.sentence : 0) + 1}</span>
                <span>·</span>
                <span>{sr.wpm} wpm</span>
              </div>
            </div>
          </div>
        </>
      }
      right={
        <>
          <div className="fws-section"><span className="fws-section__title">Reader settings</span></div>
          <div className="fws-tab-body">
            <div className="sr-side-slider">
              <label>WPM <b>{sr.wpm}</b></label>
              <input type="range" min="120" max="900" step="20" value={sr.wpm}
                onChange={(e) => sr.setWpm(Number(e.target.value))}
                data-callback="onSpeedReaderChangeWpm"/>
            </div>
            <div className="sr-side-slider">
              <label>Font size <b>{sr.fontSize}px</b></label>
              <input type="range" min="32" max="140" step="4" value={sr.fontSize}
                onChange={(e) => sr.setFontSize(Number(e.target.value))}
                data-callback="onSpeedReaderChangeFontSize"/>
            </div>
            <label className="sr-chk">
              <input type="checkbox" checked={sr.punctuationPause} onChange={(e) => sr.setPunctuationPause(e.target.checked)} data-callback="onSpeedReaderTogglePunctuationPause"/>
              Punctuation pause <span className="sr-chk__hint">×1.6 on , ; : —</span>
            </label>
            <label className="sr-chk">
              <input type="checkbox" checked={sr.sentencePause} onChange={(e) => sr.setSentencePause(e.target.checked)} data-callback="onSpeedReaderToggleSentencePause"/>
              Sentence pause <span className="sr-chk__hint">×2.2 on . ! ?</span>
            </label>
            <label className="sr-chk">
              <input type="checkbox" checked={sr.longWordSlow} onChange={(e) => sr.setLongWordSlow(e.target.checked)}/>
              Long-word slowdown <span className="sr-chk__hint">words &gt; 8 chars ×1.4</span>
            </label>
            <label className="sr-chk">
              <input type="checkbox" checked={sr.focusMode} onChange={(e) => sr.setFocusMode(e.target.checked)}/>
              Focus mode <span className="sr-chk__hint">dim the rest</span>
            </label>

            <hr className="hr" style={{ margin: "12px 0" }}/>

            <div className="fws-section__title" style={{ marginBottom: 6 }}>Session</div>
            <div className="sr-stats">
              <div><span>Words read</span><b>{sr.session.wordsRead}</b></div>
              <div><span>Pauses</span><b>{sr.session.pauses}</b></div>
              <div><span>Elapsed</span><b>{sr.session.startedAt ? Math.floor((Date.now() - sr.session.startedAt) / 1000) + "s" : "—"}</b></div>
              <div><span>Bookmarks</span><b>{sr.bookmarks.length}</b></div>
              <div><span>Notes</span><b>{sr.notes.length}</b></div>
            </div>

            <hr className="hr" style={{ margin: "12px 0" }}/>

            <div className="fws-section__title" style={{ marginBottom: 6 }}>Current sentence</div>
            <div className="sr-cur-sentence">"{ctx.current || "—"}"</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              <button className="fws-section__action" onClick={() => sr.noteCurrentSentence("difficulty", "")} data-callback="onSpeedReaderNoteDifficulty">
                <Icon name="alert" size={11}/> Flag as difficult
              </button>
              <button className="fws-section__action" onClick={onSendToWritersRoom} data-callback="onSpeedReaderSendSentenceToWriterRoom">
                <Icon name="quill" size={11}/> Send to Writer's Room
              </button>
              <button className="fws-section__action" onClick={() => {
                  try { navigator.clipboard && navigator.clipboard.writeText(ctx.current); } catch (e) {}
                }} data-callback="onSpeedReaderCopyExcerpt">
                <Icon name="copy" size={11}/> Copy excerpt
              </button>
              <button className="fws-section__action" onClick={() => onRequest && onRequest.openPanel("writers-room")} data-callback="onSpeedReaderOpenSourceChapter">
                <Icon name="paper" size={11}/> Open source chapter
              </button>
            </div>

            {sr.notes.length > 0 && (
              <>
                <hr className="hr" style={{ margin: "12px 0" }}/>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Difficult sentences ({sr.notes.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sr.notes.map((n) => (
                    <div key={n.id} className="sr-note">
                      <div className="sr-note__kind">{n.kind === "send-to-writers-room" ? "→ Writer's Room" : "Difficulty"}</div>
                      <div className="sr-note__body">"{n.sentence}"</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <hr className="hr" style={{ margin: "12px 0" }}/>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button className="fws-section__action" onClick={onSaveSession} data-callback="onSpeedReaderSaveSession">
                <Icon name="bookmark" size={11}/> Save reading session
              </button>
              <button className="fws-section__action" onClick={onExportSession} data-callback="onSpeedReaderExportSession">
                <Icon name="download" size={11}/> Export session (JSON)
              </button>
            </div>
          </div>
        </>
      }
    />
  );
};

// ---------------------------------------------------------------------
// Replace the existing basic SpeedReaderWorkspace registration.
// (workspaces-system.jsx registers the basic one first; this file loads
//  after it and overwrites the entry.)
// ---------------------------------------------------------------------
if (typeof window !== "undefined") {
  window.WORKSPACE_COMPONENTS = window.WORKSPACE_COMPONENTS || {};
  window.WORKSPACE_COMPONENTS["speed-reader"] = SpeedReaderWorkspaceFull;
}

Object.assign(window, {
  SpeedReaderPanelBody,
  SpeedReaderWorkspaceFull,
  useSpeedReader,
  srTokenise, srSplitWord,
});
