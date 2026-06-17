// =====================================================================
// writers-room.jsx — Complete Writer's Room screen
// Hook-ready presentational UI for chapter editing, margins, extraction.
// =====================================================================

const { useState: _wrUS, useEffect: _wrUE, useRef: _wrUR, useCallback: _wrUC, useMemo: _wrUM } = React;

// ---------------------------------------------------------------------
// Demo data — Claude Code replaces these with real backend data.
// ---------------------------------------------------------------------
const WR_AUTHORS = [
  { id: "em",  name: "E. Marlowe",      initials: "EM", color: "#9a7b3a" },
  { id: "ann", name: "Ann (co-writer)", initials: "AN", color: "#7a6aa3" },
  { id: "ai",  name: "Loomwright AI",   initials: "LW", color: "#3e6db5" },
];

const WR_CHAPTERS = [
  { id: "c1", num: 1, title: "The Hollow Crown",    state: "saved",     queue: 0, words: 4220, author: "em" },
  { id: "c2", num: 2, title: "Pale Reach",          state: "extracted", queue: 1, words: 3810, author: "em" },
  { id: "c3", num: 3, title: "Saren's Bargain",     state: "saved",     queue: 0, words: 5102, author: "em" },
  { id: "c4", num: 4, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c5", num: 5, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c6", num: 6, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c7", num: 7, title: "Ash & Auger",         state: "unsaved",   queue: 4, words: 3214, author: "em", active: true },
  { id: "c8", num: 8, title: "",                    state: "reserved",  queue: 0, words: 0,    reserved: true },
  { id: "c9", num: 9, title: "The Auger's Door",    state: "extracting", queue: 12, words: 6118, author: "em" },
];

// Manuscript content for active chapter — paragraphs as renderable structures
const WR_MANUSCRIPT = [
  { id: "p1", author: "em", attr: "EM", parts: [
    { text: "The light over " },
    { mark: "locations", id: "e-pale-reach", text: "Pale Reach" },
    { text: " was the colour of cooled tin when " },
    { mark: "cast", id: "e-aelinor", text: "Aelinor Vey" },
    { text: " came through the stockade gate. Snow had been falling all morning, and the wind off the salt flats turned each flake into a small, deliberate cut." },
  ]},
  { id: "p2", author: "em", attr: "EM", parts: [
    { text: "She carried the " },
    { mark: "items", id: "e-auger", text: "Auger of Hess" },
    { text: " in a felt-lined case slung across her back, and even wrapped, even quiet, it pressed against her like a second pulse. " },
    { cmt: "1", text: "She had not slept since Brec's letter" },
    { text: ", and three nights of refusing the dreams had given her hands a fine, undignified tremor." },
  ]},
  { id: "p3", author: "em", attr: "EM", parts: [
    { text: "\"You're the wrong shape for this weather,\" said " },
    { mark: "cast", id: "e-brec", text: "Captain Brec" },
    { text: " from the watchhouse step. He looked the same as he had four winters ago, except for the way the cold had settled into his face — not as colour but as architecture." },
  ]},
  { sceneBreak: true },
  { id: "p4", author: "ann", attr: "AN", parts: [
    { text: "Inside, the watchhouse smelled of pitch and coriander, and the brazier had been pulled close to the lieutenant's table. " },
    { mark: "factions", id: "e-greycoats", text: "The Grey Coats" },
    { text: " had left only the one banner — a small concession Aelinor noticed because Brec had told her, once, that they would never lower it." },
  ]},
  { id: "p5", author: "em", attr: "EM", parts: [
    { text: "\"It's not a courtesy,\" he said, pouring her something dark from a clay carafe. \"It's an apology. The " },
    { mark: "events", id: "e-augerwake", text: "Auger Wake" },
    { text: " came through here last week. Took two of mine, and a goat. We're not pretending anymore.\"" },
  ]},
  { id: "p6", author: "em", attr: "EM", parts: [
    { text: "She set the case on the table. The wood under it gave the smallest, indignant sigh. \"Then you'll want to see what " },
    { mark: "cast", id: "e-saren", text: "Saren of Hess" },
    { text: " sent me to bring.\"" },
  ]},
  { id: "p7", author: "ai", attr: "LW", parts: [
    { text: "Brec did not look at the case. He looked, instead, at the door, and the wind beyond it. \"Tell me first,\" he said, \"whether the road through " },
    { mark: "atlas", id: "e-vraska", text: "the Vraska Pass" },
    { text: " is still walkable. I have a child to send south, and I would prefer to send her alive.\"" },
  ]},
];

// Margin notes (left column)
const WR_NOTES = [
  { id: "n1", type: "Scene note",  authorId: "em",  ts: "9:42",   anchor: "p1", body: "Open cold — make the cold a character. Lean into 'architecture' of the face later when Brec's grief lands." },
  { id: "n2", type: "Comment",     authorId: "ann", ts: "11:08",  anchor: "p2", body: "Do we need to call out that this is the same Auger from Bk I? Maybe a one-line callback." },
  { id: "n3", type: "Revision",    authorId: "em",  ts: "12:17",  anchor: "p3", body: "Brec's voice still drifts toward arch. Tighten." },
  { id: "n4", type: "Structure",   authorId: "em",  ts: "Ch.7 §",          body: "This chapter wants three scenes: arrival, table, descent. Right now we're 1.5.", collapsed: true },
  { id: "n5", type: "Resolved",    authorId: "ann", ts: "Yest.", anchor: "p4", body: "Confirm the Grey Coats lowered the banner — maps page 11.", resolved: true },
];

// Right margin extraction cards
const WR_EXTRACTIONS = [
  { id: "x1", type: "cast",         conf: "high",      pct: 96, name: "Aelinor Vey",          summary: "Established cast member; verified across Ch. 1–7. Mention re-confirmed.", quote: "…when Aelinor Vey came through the stockade gate.", anchor: "p1" },
  { id: "x2", type: "locations",    conf: "high",      pct: 94, name: "Pale Reach",            summary: "Existing location. New attribute: \"salt flats\". Add to dossier?", quote: "The light over Pale Reach was the colour of cooled tin…", anchor: "p1" },
  { id: "x3", type: "items",        conf: "strong",    pct: 88, name: "Auger of Hess",         summary: "Tracked artefact. Possessed by Aelinor in this chapter — update STATE → carried.", quote: "the Auger of Hess in a felt-lined case…", anchor: "p2" },
  { id: "x4", type: "cast",         conf: "strong",    pct: 84, name: "Captain Brec",          summary: "Existing cast. New trait surfacing: \"the cold had settled into his face\". Lifestyle/age hint.", quote: "He looked the same as he had four winters ago…", anchor: "p3" },
  { id: "x5", type: "events",       conf: "uncertain", pct: 67, name: "The Auger Wake",        summary: "New event candidate. Last week, two casualties + livestock. Suggest creating Event entity.", quote: "The Auger Wake came through here last week.", anchor: "p5" },
  { id: "x6", type: "factions",     conf: "uncertain", pct: 58, name: "The Grey Coats",        summary: "Already exists (Bk I). New canon: lowered banner — \"never\" rule broken. Flag canon-shift.", quote: "The Grey Coats had left only the one banner…", anchor: "p4" },
  { id: "x7", type: "atlas",        conf: "weak",      pct: 41, name: "Vraska Pass",           summary: "New geography. Could be 'the Vraska' from Ch. 2 — possible merge candidate.", quote: "the road through the Vraska Pass is still walkable.", anchor: "p7", merge: true },
];

// ---------------------------------------------------------------------
// ChapterNode
// ---------------------------------------------------------------------
const ChapterNode = ({
  chapter, active, onSelect, onOpenAdaptiveWheel, onOpenContext,
}) => {
  const reserved = !!chapter.reserved;
  const className = [
    "wr-node",
    active && "is-active",
    reserved && "is-reserved",
    !reserved && chapter.complete && "is-complete",
  ].filter(Boolean).join(" ");

  const handleContext = (e) => {
    e.preventDefault();
    onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: "Chapter " + chapter.num + (chapter.title ? " — " + chapter.title : "") });
  };

  return (
    <div
      className={className}
      data-ui="ChapterNode"
      data-callback="onSelectChapter"
      data-testid={"wr-chapter-" + chapter.id}
      role="tab"
      aria-selected={active}
      tabIndex={reserved ? -1 : 0}
      onClick={() => !reserved && onSelect && onSelect(chapter.id)}
      onContextMenu={handleContext}
    >
      {reserved ? (
        <>
          <div className="wr-node__top">
            <span className="wr-node__num">CH. {String(chapter.num).padStart(2, "0")}</span>
          </div>
          <div className="wr-node__reserved-mark">∅</div>
          <div className="wr-node__meta">
            <span style={{ fontStyle: "italic", fontSize: "var(--fs-3xs)", color: "var(--ink-4)" }}>Reserved</span>
          </div>
        </>
      ) : (
        <>
          <div className="wr-node__top">
            <span className="wr-node__num">CH. {String(chapter.num).padStart(2, "0")}</span>
          </div>
          <div className="wr-node__title">{chapter.title || "Untitled"}</div>
          <div className="wr-node__meta">
            {chapter.complete && <span title="Marked complete" style={{ color: "var(--ok, #4a7a4a)", fontWeight: 700 }}>✓</span>}
            {chapter.state === "unsaved"    && <span className="wr-node__dot wr-node__dot--unsaved"    title="Unsaved changes"/>}
            {chapter.state === "extracting" && <span className="wr-node__dot wr-node__dot--extracting" title="Extracting…"/>}
            {chapter.state === "extracted"  && <span className="wr-node__dot wr-node__dot--extracted"  title="Extracted"/>}
            {chapter.state === "error"      && <span className="wr-node__dot wr-node__dot--error"      title="Error"/>}
            {chapter.queue > 0 && <span className="wr-node__queue" title={chapter.queue + " in review queue"}>{chapter.queue > 9 ? "9+" : chapter.queue}</span>}
            <span className="wr-node__words">{(chapter.words || 0).toLocaleString()}w</span>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// ChapterNodeStrip
// ---------------------------------------------------------------------
const ChapterNodeStrip = ({
  chapters, activeId,
  onSelectChapter, onCreateChapter, onReserveChapter, onReorderChapter,
  onOpenAdaptiveWheel,
}) => {
  return (
    <div className="wr-strip" data-ui="ChapterNodeStrip" role="tablist" aria-label="Chapters">
      <div className="wr-strip__lead">
        <div>
          <div className="wr-strip__lead-eyebrow">Manuscript</div>
          <div className="wr-strip__lead-title">{BRAND.project.book}</div>
        </div>
      </div>
      <div className="wr-strip__rail">
        {chapters.map((c) => (
          <ChapterNode
            key={c.id}
            chapter={c}
            active={c.id === activeId}
            onSelect={onSelectChapter}
            onOpenAdaptiveWheel={onOpenAdaptiveWheel}
          />
        ))}
        <button
          className="wr-strip__add"
          data-callback="onCreateChapter"
          data-testid="wr-create-chapter"
          onClick={onCreateChapter}
          title="Append a new chapter"
        ><Icon name="plus" size={11}/>Add chapter</button>
        <button
          className="wr-strip__add"
          data-callback="onReserveChapter"
          data-testid="wr-reserve-chapter"
          onClick={onReserveChapter}
          title="Reserve a future chapter slot"
          style={{ marginLeft: 4 }}
        ><Icon name="bookmark" size={11}/>Reserve</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityBrushHighlight (inline span for entity mention)
//
// Click contract:
//   - hover           → onMouseEnter / onMouseLeave (snapshot chip)
//   - single click    → onClick (kept for legacy "open dossier" path)
//   - double click    → onDoubleClick: opens / focuses the relevant entity
//                       panel WITHOUT replacing the Writer's Room route.
//                       Browser default (select word) is suppressed by the
//                       wrapping ManuscriptParagraph so the user's reading
//                       flow isn't broken by an accidental word-select.
// ---------------------------------------------------------------------
const EntityBrushHighlight = ({ type, id, occurrenceId, children, onClick, onDoubleClick, onMouseEnter, onMouseLeave }) => {
  const t = ENTITY_TYPES[type];
  if (!t) return <span>{children}</span>;
  const extraAttrs = occurrenceId ? { "data-occurrence-id": occurrenceId, "data-source": "occurrence" } : {};
  return (
    <span
      className="wr-mark"
      data-ui="EntityBrushHighlight"
      data-callback="onOpenEntityFromManuscript"
      data-entity={type}
      data-entity-type={type}
      data-entity-id={id}
      {...extraAttrs}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >{children}</span>
  );
};

// ---------------------------------------------------------------------
// Occurrence overlay helpers
//
// Persisted EntityOccurrence records (from Save & Extract / Accept Queue)
// are overlaid on plain text within paragraphs. Each occurrence carries a
// real entityId/entityType/occurrenceId, so double-click resolves by ID.
//
// Strategy (per the approved plan):
//   - Demo marks remain where no persisted occurrence covers the same text.
//   - Persisted occurrences are preferred over demo marks: if an occurrence's
//     exactText matches a demo-marked part, the part's `id` is replaced with
//     the occurrence's entityId (so demo placeholder IDs don't leak through).
//   - Plain-text parts are split into [text, highlight, text, …] sequences
//     wherever an occurrence's exactText appears.
//   - No double-highlight: each character range is owned by exactly one span.
// ---------------------------------------------------------------------
function buildOccurrenceLookup(occurrences) {
  // Group occurrences by lowercased exactText for fast paragraph scanning.
  const byText = new Map();
  for (const occ of occurrences || []) {
    if (!occ || occ.stale) continue;
    // Resolved pronouns feed the dossiers/atlas, but wrapping every
    // "she"/"he" in a highlight would drown the prose — skip them here.
    if (occ.isPronounResolution) continue;
    if (!occ.entityId || !occ.exactText) continue;
    const key = String(occ.exactText).toLowerCase();
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(occ);
  }
  return byText;
}

function findFirstOccurrenceMatch(textSlice, lookup) {
  // Return the earliest occurrence-driven match inside textSlice (case-
  // insensitive). Returns { start, end, occ } or null.
  if (!textSlice || !lookup || !lookup.size) return null;
  const lower = textSlice.toLowerCase();
  let best = null;
  for (const [needle, occs] of lookup) {
    if (needle.length < 2) continue;
    const idx = lower.indexOf(needle);
    if (idx < 0) continue;
    if (!best || idx < best.start) best = { start: idx, end: idx + needle.length, occ: occs[0] };
  }
  return best;
}

function splitByOccurrences(text, lookup) {
  // Produce a sequence of plain/highlight chunks for a single text run.
  // Each chunk is either { text } (plain) or { text, occ } (highlight).
  if (!text || !lookup || !lookup.size) return [{ text }];
  const out = [];
  let cursor = 0;
  while (cursor < text.length) {
    const slice = text.slice(cursor);
    const hit = findFirstOccurrenceMatch(slice, lookup);
    if (!hit) {
      out.push({ text: slice });
      break;
    }
    if (hit.start > 0) out.push({ text: slice.slice(0, hit.start) });
    out.push({ text: slice.slice(hit.start, hit.end), occ: hit.occ });
    cursor += hit.end;
  }
  return out;
}

// ---------------------------------------------------------------------
// ManuscriptParagraph
// ---------------------------------------------------------------------
const ManuscriptParagraph = ({
  para, occurrenceLookup, onEntityHover, onCommentClick, onEntityDoubleClick,
}) => {
  if (para.sceneBreak) {
    return (
      <div className="wr-scene-break" data-ui="ManuscriptParagraph" data-kind="scene-break">
        <span className="wr-scene-break__line"/>
        <span aria-hidden>※   ※   ※</span>
        <span className="wr-scene-break__line"/>
      </div>
    );
  }
  const renderHighlight = (key, type, id, occurrenceId, text) => (
    <EntityBrushHighlight
      key={key}
      type={type}
      id={id}
      occurrenceId={occurrenceId}
      onMouseEnter={(e) => onEntityHover && onEntityHover({ type, id, text, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onEntityHover && onEntityHover(null)}
      onDoubleClick={(e) => {
        if (e && e.preventDefault) e.preventDefault();
        try { const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges(); } catch (_err) {}
        onEntityDoubleClick && onEntityDoubleClick({ type, id, occurrenceId, label: text });
        onEntityHover && onEntityHover(null);
      }}
    >{text}</EntityBrushHighlight>
  );
  return (
    <p
      className="wr-p"
      data-ui="ManuscriptParagraph"
      data-author={para.author}
      data-paragraph-id={para.id}
    >
      <span className="wr-p__handle" aria-hidden><Icon name="grip" size={12}/></span>
      {para.parts.map((part, i) => {
        if (part.mark) {
          // Demo mark: prefer a persisted occurrence covering the same text
          // (occurrence entityId is the canonical record).
          let occ = null;
          if (occurrenceLookup) {
            const hits = occurrenceLookup.get(String(part.text || "").toLowerCase());
            if (hits && hits.length) occ = hits[0];
          }
          const effectiveType = occ?.entityType || part.mark;
          const effectiveId = occ?.entityId || part.id;
          const occurrenceId = occ?.occurrenceId || null;
          return renderHighlight(i, effectiveType, effectiveId, occurrenceId, part.text);
        }
        if (part.cmt) {
          return (
            <span key={i} className="wr-cmt" data-count={part.cmt} onClick={() => onCommentClick && onCommentClick(part.cmt)}>{part.text}</span>
          );
        }
        // Plain text: scan for any occurrence whose exactText appears here
        // and split the run into a series of plain + highlight spans.
        const chunks = splitByOccurrences(part.text || "", occurrenceLookup);
        if (chunks.length === 1 && !chunks[0].occ) {
          return <React.Fragment key={i}>{part.text}</React.Fragment>;
        }
        return (
          <React.Fragment key={i}>
            {chunks.map((c, ci) => (
              c.occ
                ? renderHighlight(`${i}-${ci}`, c.occ.entityType, c.occ.entityId, c.occ.occurrenceId, c.text)
                : <React.Fragment key={`${i}-${ci}`}>{c.text}</React.Fragment>
            ))}
          </React.Fragment>
        );
      })}
      <span className="wr-p__attr" title={para.author}>{para.attr}</span>
    </p>
  );
};

// ---------------------------------------------------------------------
// ManuscriptToolbar
// ---------------------------------------------------------------------
const ManuscriptToolbar = ({
  onAction,
  spellcheck = true, grammar = true, voice = false, style = false, revision = false,
  attribution = true, focusMode = false,
  onToggleFocusMode, onToggleAttribution, onToggleSpellcheck, onToggleGrammar, onToggleStyle, onToggleVoice, onToggleRevision,
}) => {
  // disabled buttons stay visible but are clearly non-interactive with a
  // reason in the tooltip (UAT #7 — no fake controls left clickable).
  const TB = ({ icon, label, active, onClick, children, className = "", disabled = false, testid }) => (
    <button
      type="button"
      className={"wr-toolbar__btn " + className + (active ? " is-active" : "")}
      title={disabled ? label + " — not available in this beta" : label}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
    >{icon ? <Icon name={icon} size={13}/> : children}</button>
  );

  return (
    <div className="wr-toolbar" data-ui="ManuscriptToolbar" role="toolbar" aria-label="Manuscript formatting">
      <div className="wr-toolbar__group">
        <TB label="Bold (⌘B)"           testid="wr-tb-bold"      className="wr-toolbar__btn--text"      onClick={() => onAction("bold")}><b>B</b></TB>
        <TB label="Italic (⌘I)"         testid="wr-tb-italic"    className="wr-toolbar__btn--text wr-toolbar__btn--italic" onClick={() => onAction("italic")}><i>I</i></TB>
        <TB label="Underline (⌘U)"      testid="wr-tb-underline" className="wr-toolbar__btn--text wr-toolbar__btn--underline" onClick={() => onAction("underline")}>U</TB>
        <TB label="Strikethrough"       testid="wr-tb-strike"    className="wr-toolbar__btn--text wr-toolbar__btn--strike" onClick={() => onAction("strike")}>S</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Heading"     testid="wr-tb-heading"    className="wr-toolbar__btn--text" onClick={() => onAction("heading")}>H</TB>
        <TB label="Scene break" testid="wr-tb-scenebreak" icon="bars" onClick={() => onAction("scene-break")}/>
        <TB label="Quote"       testid="wr-tb-quote"      className="wr-toolbar__btn--text" onClick={() => onAction("quote")}>"</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Add paragraph note"  testid="wr-tb-note" icon="paper" onClick={() => onAction("inline-note")}/>
        <TB label="Add paragraph note (comment)" icon="bell" onClick={() => onAction("comment")}/>
        <TB label="Highlight"           disabled icon="drop"/>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Link to entity"      icon="link" onClick={() => onAction("link-entity")}/>
        <TB label="Create entity from selection" icon="plus" onClick={() => onAction("create-entity")}/>
        <TB label="Insert reference"    disabled icon="bookmark"/>
        <TB label="Insert footnote"     disabled icon="paper"/>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Find / replace"      testid="wr-tb-find" icon="search" onClick={() => onAction("find")}/>
        <TB label="Spellcheck"   active={spellcheck} className="wr-toolbar__btn--small" onClick={onToggleSpellcheck}>SP</TB>
        <TB label="Grammar (preference)"      active={grammar}    className="wr-toolbar__btn--small" onClick={onToggleGrammar}>GR</TB>
        <TB label="Style (preference)"        active={style}      className="wr-toolbar__btn--small" onClick={onToggleStyle}>ST</TB>
        <TB label="Voice consistency (preference)" active={voice} className="wr-toolbar__btn--small" onClick={onToggleVoice}>VO</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Thesaurus"           disabled icon="book"/>
        <TB label="Revision mode (preference)"       active={revision}    className="wr-toolbar__btn--small" onClick={onToggleRevision}>REV</TB>
        <TB label="Author attribution"  active={attribution} className="wr-toolbar__btn--small" onClick={onToggleAttribution}>AUT</TB>
        <TB label="Focus mode"          active={focusMode}   icon="eye" onClick={onToggleFocusMode}/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SaveModeControls
// ---------------------------------------------------------------------
const SaveModeControls = ({ onSave, syncing }) => {
  return (
    <div className="wr-save" data-ui="SaveModeControls" role="group" aria-label="Save controls">
      <button
        className="wr-save__btn"
        data-callback="onSave"
        data-testid="wr-save"
        onClick={onSave}
        title="Saves manuscript text and author edits. Extract via right-click / long-press."
        disabled={syncing}
      ><Icon name="check" size={12}/>Save</button>
    </div>
  );
};

// ---------------------------------------------------------------------
// AuthorSelector
// ---------------------------------------------------------------------
const AuthorSelector = ({ authors, activeId, onSelectAuthor }) => {
  const list = (authors && authors.length) ? authors : [{ id: "you", name: "You", initials: "Y", color: "var(--accent)" }];
  const a = list.find((x) => x.id === activeId) || list[0];
  const [open, setOpen] = _wrUS(false);
  const ref = _wrUR(null);
  _wrUE(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const initials = (x) => x.initials || (x.name || "?").slice(0, 2).toUpperCase();
  return (
    <div className="wr-author-sel-wrap" ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="wr-author-sel"
        data-ui="AuthorSelector"
        data-testid="wr-author-selector"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Active author"
      >
        <span className="wr-author-sel__chip" style={{ "--ac": a.color }}>{initials(a)}</span>
        <span>{a.name}</span>
        <Icon name="chevron-d" size={11}/>
      </button>
      {open && (
        <div className="wr-author-pop" data-ui="AuthorSelectorPopover" role="listbox">
          {list.map((x) => (
            <button
              key={x.id}
              type="button"
              role="option"
              aria-selected={x.id === a.id}
              className={"wr-author-pop__item " + (x.id === a.id ? "is-active" : "")}
              data-testid={"wr-author-option-" + x.id}
              onClick={() => { onSelectAuthor && onSelectAuthor(x.id); setOpen(false); }}
            >
              <span className="wr-author-sel__chip" style={{ "--ac": x.color }}>{initials(x)}</span>
              <span>{x.name}</span>
            </button>
          ))}
          <div className="wr-author-pop__hint">Manage authors in Settings → Authors.</div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// FloatingSelectionToolbar
// ---------------------------------------------------------------------
const FloatingSelectionToolbar = ({ x, y, onAction, onCreateEntityFromSelection, onLinkEntity, onExtractSelection }) => {
  return (
    <div className="wr-fst" style={{ left: x, top: y, position: "fixed" }} data-ui="FloatingSelectionToolbar" onMouseDown={(e) => e.preventDefault()}>
      <button className="wr-fst__btn" title="Bold" onClick={() => onAction("bold")}><b>B</b></button>
      <button className="wr-fst__btn" title="Italic" onClick={() => onAction("italic")}><i>I</i></button>
      <button className="wr-fst__btn" title="Underline" onClick={() => onAction("underline")}>U</button>
      <span className="wr-fst__sep"/>
      <button className="wr-fst__btn" title="Add paragraph note" onClick={() => onAction("comment")}><Icon name="bell" size={13}/></button>
      <span className="wr-fst__sep"/>
      <button className="wr-fst__btn" data-callback="onLinkEntity" title="Link to entity" onClick={onLinkEntity}><Icon name="link" size={13}/></button>
      <button className="wr-fst__btn" data-callback="onExtractSelection" data-testid="wr-fst-extract"
        title="Scan just this selection for entities" onClick={onExtractSelection}>
        <Icon name="sparkle" size={12}/>Extract
      </button>
      <button className="wr-fst__btn wr-fst__btn--strong" data-callback="onCreateEntityFromSelection" title="Create entity from selection" onClick={onCreateEntityFromSelection}>
        <Icon name="plus" size={11}/>New entity
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------
// FloatingEntityChip — entity hover/click chip
// ---------------------------------------------------------------------
const FloatingEntityChip = ({ entity, x, y, onOpenEntity, onShowMentions, onOpenAdaptiveWheel }) => {
  if (!entity) return null;
  const t = ENTITY_TYPES[entity.type];
  return (
    <div className="wr-chip" style={{ left: x, top: y + 14 }} data-ui="FloatingEntityChip">
      <div className="wr-chip__head">
        <EntityTypeBadge type={entity.type} size="xs" showLabel={false}/>
        <div className="wr-chip__name">{entity.text}</div>
      </div>
      <div className="wr-chip__sub">{t?.label}{(() => {
        try {
          const n = window.LoomwrightBackend?.OccurrenceService?.listByEntitySync?.(entity.id)?.length;
          return n ? ` · ${n} mention${n === 1 ? "" : "s"}` : "";
        } catch (_e) { return ""; }
      })()}</div>
      <div className="wr-chip__row">
        <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenEntity" onClick={() => onOpenEntity && onOpenEntity(entity)}>Dossier</Btn>
        <Btn variant="ghost" size="sm" icon="search" data-callback="onShowMentions" onClick={() => onShowMentions && onShowMentions(entity)}>Mentions</Btn>
        <Btn variant="ghost" size="sm" icon="wheel" data-callback="onOpenAdaptiveWheel" onClick={(e) => onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: entity.text })}>Wheel</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// MarginNoteCard
// ---------------------------------------------------------------------
const MarginNoteCard = ({ note, authors, editing, onEdit, onSaveText, onCancelEdit, onResolve, onDelete, onFocus }) => {
  const a = (authors || []).find((x) => x.id === note.authorId);
  const [draft, setDraft] = _wrUS(note.noteText || "");
  _wrUE(() => { setDraft(note.noteText || ""); }, [note.id, editing]);
  const resolved = note.status === "resolved";
  return (
    <div className={"wr-note " + (resolved ? "is-resolved " : "")} data-ui="MarginNoteCard" data-testid={"wr-note-" + note.id} style={{ "--ac": a?.color || "var(--accent)" }}>
      <div className="wr-note__head">
        <span className="wr-note__author"><span className="wr-note__author-dot"/>{a?.name || "You"}</span>
        <span className="wr-note__type">{note.source === "selection" ? "Quote note" : "Paragraph note"}</span>
        {resolved && <span className="wr-note__type">Resolved</span>}
      </div>
      {note.quote ? (
        <blockquote className="wr-note__quote" onClick={() => onFocus && onFocus(note)} title="Go to paragraph">“{note.quote}”</blockquote>
      ) : null}
      {editing ? (
        <div className="wr-note__edit">
          <textarea
            className="wr-note__textarea"
            data-testid={"wr-note-text-" + note.id}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note about this paragraph…"
          />
          <div className="wr-note__actions">
            <Btn variant="primary" size="sm" icon="check" data-testid={"wr-note-save-" + note.id} onClick={() => onSaveText && onSaveText(note.id, draft)}>Save</Btn>
            <Btn variant="ghost" size="sm" onClick={() => onCancelEdit && onCancelEdit()}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="wr-note__body" onClick={() => onFocus && onFocus(note)}>
            {note.noteText ? note.noteText : <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Empty note — click Edit to add text.</span>}
          </div>
          <div className="wr-note__actions">
            <Btn variant="ghost" size="sm" icon="search" data-testid={"wr-note-focus-" + note.id} onClick={() => onFocus && onFocus(note)}>Go to ¶</Btn>
            {!resolved
              ? <Btn variant="ghost" size="sm" icon="check" data-testid={"wr-note-resolve-" + note.id} onClick={() => onResolve && onResolve(note.id, "resolved")}>Resolve</Btn>
              : <Btn variant="ghost" size="sm" icon="check" onClick={() => onResolve && onResolve(note.id, "open")}>Reopen</Btn>}
            <Btn variant="ghost" size="sm" icon="more" data-testid={"wr-note-edit-" + note.id} onClick={() => onEdit && onEdit(note.id)}>Edit</Btn>
            <Btn variant="ghost" size="sm" icon="trash" data-testid={"wr-note-delete-" + note.id} onClick={() => onDelete && onDelete(note.id)}/>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// MarginExtractionCard
// ---------------------------------------------------------------------
const MarginExtractionCard = ({
  ext, selected,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem, onOpenFullReview,
}) => {
  const c = CONFIDENCE[ext.conf];
  return (
    <div className={"wr-ext " + (selected ? "is-selected " : "")} data-ui="MarginExtractionCard"
      style={{ "--cc": c?.color, "--cs": c?.soft, "--cd": c?.deep }}
    >
      <div className="wr-ext__head">
        <EntityTypeBadge type={ext.type} size="xs"/>
        <ConfidenceBadge level={ext.conf} value={ext.pct}/>
      </div>
      <div className="wr-ext__name">{ext.name}</div>
      <div className="wr-ext__sum">{ext.summary}</div>
      <blockquote className="wr-ext__quote">"{ext.quote}"</blockquote>
      <span className="wr-ext__anchor">↳ paragraph {ext.anchor}</span>
      <div className="wr-ext__actions">
        <button className="wr-ext__btn wr-ext__btn--accept" data-callback="onAcceptQueueItem" onClick={() => onAcceptQueueItem && onAcceptQueueItem(ext.id)}>
          <Icon name="check" size={11}/>Accept
        </button>
        <button className="wr-ext__btn" data-callback="onEditQueueItem" onClick={() => onEditQueueItem && onEditQueueItem(ext.id)}>
          <Icon name="more" size={11}/>Edit
        </button>
        {ext.merge && (
          <button className="wr-ext__btn" data-callback="onMergeQueueItem" onClick={() => onMergeQueueItem && onMergeQueueItem(ext.id)}>
            <Icon name="link" size={11}/>Merge
          </button>
        )}
        <button className="wr-ext__btn wr-ext__btn--deny" data-callback="onDenyQueueItem" onClick={() => onDenyQueueItem && onDenyQueueItem(ext.id)}>
          <Icon name="close" size={11}/>Deny
        </button>
      </div>
      <button className="wr-ext__more" onClick={() => onOpenFullReview && onOpenFullReview(ext.id)}>Open full review →</button>
    </div>
  );
};

// ---------------------------------------------------------------------
// LeftMargin
// ---------------------------------------------------------------------
const LeftMargin = ({ notes, authors, editingNoteId, onAdd, onEdit, onSaveText, onCancelEdit, onResolve, onDelete, onFocus, filter, setFilter, pinned, onTogglePin, onCollapse }) => {
  const visible = (notes || []).filter((n) => {
    if (filter === "open") return n.status !== "resolved";
    if (filter === "resolved") return n.status === "resolved";
    return true;
  });
  return (
    <aside className="wr-margin" data-side="left" data-ui="LeftMargin" aria-label="Paragraph notes & comments">
      <div className="wr-margin__head">
        <span className="wr-margin__head-title">Notes &amp; Comments</span>
        <span className="wr-margin__head-count">{visible.length}</span>
        <Btn variant="ghost" size="sm" icon="plus" data-testid="wr-add-note" onClick={onAdd} title="Add a note to the current paragraph">Add paragraph note</Btn>
        <button className={"wr-margin__head__pin " + (pinned ? "is-active" : "")} onClick={onTogglePin} data-callback="onTogglePin" title={pinned ? "Unpin margin" : "Pin margin"}><Icon name="pin-tack" size={11}/></button>
        <button className="wr-margin__head__collapse" onClick={onCollapse} data-callback="onCollapseMargin" title="Collapse to tab"><Icon name="chevron-r" size={11}/></button>
      </div>
      <div className="wr-margin__filters">
        {[["all", "All"], ["open", "Open"], ["resolved", "Resolved"]].map(([k, l]) => (
          <button
            key={k}
            className={"wr-margin__filter " + (filter === k ? "is-active" : "")}
            onClick={() => setFilter(k)}
          >{l}</button>
        ))}
      </div>
      <div className="wr-margin__list">
        {visible.length === 0 ? (
          <EmptyState icon="paper" title="No notes here" body="Place the cursor in a paragraph (or select text), then choose “Add paragraph note”."/>
        ) : visible.map((n) => (
          <MarginNoteCard
            key={n.id} note={n} authors={authors} editing={editingNoteId === n.id}
            onEdit={onEdit} onSaveText={onSaveText} onCancelEdit={onCancelEdit}
            onResolve={onResolve} onDelete={onDelete} onFocus={onFocus}
          />
        ))}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// RightMargin
// ---------------------------------------------------------------------
const RightMargin = ({
  extractions, selectedId,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem, onOpenFullReview,
  onOpenReviewQueue,
  filter, setFilter, extractionState,
  pinned, onTogglePin, onCollapse,
}) => {
  const visible = extractions.filter((x) => {
    if (filter === "queue") return x.conf !== "high";
    if (filter === "auto") return x.conf === "high";
    if (filter === "warn") return x.conf === "uncertain" || x.conf === "weak";
    return true;
  });

  return (
    <aside className="wr-margin" data-side="right" data-ui="RightMargin" aria-label="Extractions & suggestions">
      <div className="wr-margin__head">
        <span className="wr-margin__head-title">Extracted</span>
        <span className="wr-margin__head-count">{visible.length}</span>
        <Btn variant="ghost" size="sm" icon="bell" onClick={onOpenReviewQueue} title="Open full review queue"/>
        <button className={"wr-margin__head__pin " + (pinned ? "is-active" : "")} onClick={onTogglePin} data-callback="onTogglePin" title={pinned ? "Unpin margin" : "Pin margin"}><Icon name="pin-tack" size={11}/></button>
        <button className="wr-margin__head__collapse" onClick={onCollapse} data-callback="onCollapseMargin" title="Collapse to tab"><Icon name="chevron-r" size={11}/></button>
      </div>
      <div className="wr-margin__filters">
        {[["all", "All"], ["queue", "In review"], ["auto", "Auto"], ["warn", "Uncertain"]].map(([k, l]) => (
          <button
            key={k}
            className={"wr-margin__filter " + (filter === k ? "is-active" : "")}
            onClick={() => setFilter(k)}
          >{l}</button>
        ))}
      </div>
      <div className="wr-margin__list">
        {extractionState === "running" && (
          <div className="wr-ext wr-ai">
            <div className="wr-ai__title"><Icon name="sparkle" size={13}/>Extracting Ch. 7…</div>
            <LoadingState title="Reading the page" lines={3}/>
          </div>
        )}
        {extractionState === "error" && (
          <div className="wr-ext" style={{ "--cc": "#a84a3a" }}>
            <div className="wr-ext__head"><EntityTypeBadge type="cast" size="xs" showLabel={false}/><ConfidenceBadge level="weak" value={0}/></div>
            <div className="wr-ext__name">Extraction failed</div>
            <div className="wr-ext__sum">Local model couldn't reach the manuscript index. Your draft is safe.</div>
            <div className="wr-ext__actions">
              <button className="wr-ext__btn">Retry</button>
              <button className="wr-ext__btn">Open logs</button>
            </div>
          </div>
        )}
        {visible.length === 0 && extractionState !== "running" ? (
          <EmptyState icon="sparkle" title="No suggestions yet" body="Save & Extract to scan this chapter for new entities, relationships, and continuity warnings."/>
        ) : visible.map((x) => (
          <MarginExtractionCard
            key={x.id} ext={x}
            selected={selectedId === x.id}
            onAcceptQueueItem={onAcceptQueueItem}
            onEditQueueItem={onEditQueueItem}
            onMergeQueueItem={onMergeQueueItem}
            onDenyQueueItem={onDenyQueueItem}
            onOpenFullReview={onOpenFullReview}
          />
        ))}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// CurrentChapterContext (UAT #22) — live, chapter-scoped context surface:
// entities mentioned in this chapter (from occurrences), references linked
// to them, and pending review items. Self-contained: reads the live store
// and refreshes on store events / chapter change.
// ---------------------------------------------------------------------
const CurrentChapterContext = ({ chapterId, onOpenEntity, onOpenPanel, onOpenReviewQueue }) => {
  const [data, setData] = _wrUS({ entities: [], references: [], reviews: [] });
  const compute = _wrUC(() => {
    const B = window.LoomwrightBackend;
    if (!B || !chapterId) { setData({ entities: [], references: [], reviews: [] }); return; }
    let occ = [];
    try { occ = B.OccurrenceService?.listByChapterSync?.(chapterId) || []; } catch (_e) {}
    const seen = new Set();
    const entities = [];
    for (const o of occ) {
      if (!o.entityId || seen.has(o.entityId)) continue;
      seen.add(o.entityId);
      let ent = null;
      try { ent = B.EntityService?.getSync?.(o.entityId, o.entityType); } catch (_e) {}
      entities.push({
        id: o.entityId, type: o.entityType,
        name: (ent && ent.name) || o.exactText || "Unknown",
        count: occ.filter((x) => x.entityId === o.entityId).length,
      });
    }
    let references = [];
    try {
      references = (B.ReferencesService?.listSync?.() || []).filter((r) =>
        Array.isArray(r.linkedEntities) && r.linkedEntities.some((id) => seen.has(id)));
    } catch (_e) {}
    let reviews = [];
    try {
      reviews = (B.ReviewService?.listSync?.() || []).filter((q) =>
        q.status === "pending" && (q.chapterId === chapterId || (seen.size && seen.has(q.entityId))));
    } catch (_e) {}
    setData({ entities, references, reviews });
  }, [chapterId]);
  _wrUE(() => {
    compute();
    const evs = ["lw:entity-store-updated", "lw:extraction-updated", "lw:references-updated", "lw:review-queue-updated", "lw:manuscript-chapters-updated"];
    evs.forEach((e) => window.addEventListener(e, compute));
    return () => evs.forEach((e) => window.removeEventListener(e, compute));
  }, [compute]);
  const { entities, references, reviews } = data;
  const empty = !entities.length && !references.length && !reviews.length;
  return (
    <section className="wr-ctx" data-ui="CurrentChapterContext" data-testid="wr-current-context" aria-label="Current chapter context">
      <div className="wr-ctx__head"><Icon name="book" size={12}/> Current Chapter Context</div>
      {empty ? (
        <div className="wr-ctx__empty" data-testid="wr-ctx-empty">Entities mentioned in this chapter, their linked references, and pending review items appear here after you write and run Save &amp; Extract.</div>
      ) : (
        <>
          {entities.length > 0 && (
            <div className="wr-ctx__group">
              <div className="wr-ctx__group-title">Entities mentioned ({entities.length})</div>
              {entities.map((e) => (
                <button key={e.id} type="button" className="wr-ctx__row" data-testid={"wr-ctx-entity-" + e.id} onClick={() => onOpenEntity && onOpenEntity(e)} title="Open entity">
                  <EntityTypeBadge type={e.type} size="xs" showLabel={false}/>
                  <span className="wr-ctx__row-name">{e.name}</span>
                  <span className="wr-ctx__row-meta">{e.count}×</span>
                </button>
              ))}
            </div>
          )}
          {references.length > 0 && (
            <div className="wr-ctx__group">
              <div className="wr-ctx__group-title">Linked references ({references.length})</div>
              {references.map((r) => (
                <button key={r.id} type="button" className="wr-ctx__row" data-testid={"wr-ctx-ref-" + r.id} onClick={() => onOpenPanel && onOpenPanel("references")} title="Open in References">
                  <Icon name="bookmark" size={11}/>
                  <span className="wr-ctx__row-name">{r.title || r.name || "Reference"}</span>
                </button>
              ))}
            </div>
          )}
          {reviews.length > 0 && (
            <div className="wr-ctx__group">
              <div className="wr-ctx__group-title">From this chapter · pending review ({reviews.length})</div>
              {reviews.map((q) => {
                const card = window.candidateToCardItem ? window.candidateToCardItem(q) : null;
                const name = (card && card.candidate && card.candidate.name) || q.name;
                const triage = (cb) => { window.LoomwrightDispatchCallback && window.LoomwrightDispatchCallback(cb, { detail: { id: q.id } }); };
                return (
                  <div key={q.id} className="wr-ctx__row" data-testid={"wr-ctx-review-" + q.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <EntityTypeBadge type={q.entityType} size="xs" showLabel={false}/>
                    <span className="wr-ctx__row-name" style={{ flex: 1 }}>{name}</span>
                    <Btn variant="ghost" size="sm" icon="check" aria-label="Accept" onClick={() => triage("onAcceptQueueItem")}/>
                    <Btn variant="ghost" size="sm" icon="more" aria-label="Edit" onClick={() => triage("onEditQueueItem")}/>
                    <Btn variant="ghost" size="sm" icon="link" aria-label="Merge" onClick={() => triage("onMergeQueueItem")}/>
                    <Btn variant="ghost" size="sm" icon="close" aria-label="Deny" onClick={() => triage("onDenyQueueItem")}/>
                  </div>
                );
              })}
              <button type="button" className="wr-ctx__row" data-testid="wr-ctx-open-review" onClick={() => onOpenReviewQueue && onOpenReviewQueue()} title="Open review queue">
                <Icon name="bell" size={11}/>
                <span className="wr-ctx__row-name">Open full review queue</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------
// ChapterDeleteConfirmModal
// ---------------------------------------------------------------------
const ChapterDeleteConfirmModal = ({ open, chapter, onCancel, onConfirm }) => {
  if (!open || !chapter) return null;
  return (
    <ConfirmModal
      open={open}
      title={"Delete Chapter " + chapter.num + "?"}
      body={
        <>
          <p>This removes <b>{chapter.title || "this chapter"}</b> and its text from the manuscript and renumbers the remaining chapters.</p>
          <p style={{ color: "var(--ink-3)", fontSize: "var(--fs-xs)", marginTop: 8 }}>
            The deletion is recorded in the project history, and the chapter and its text are retained so it can be restored.
          </p>
        </>
      }
      confirmLabel="Delete chapter"
      cancelLabel="Keep chapter"
      tone="danger"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

// ---------------------------------------------------------------------
// Editable manuscript body — helpers + uncontrolled contentEditable
//
// The body is an UNCONTROLLED contentEditable region: React never renders
// children into it (so it never reconciles typed text → no caret jump).
// innerHTML is written imperatively only when the chapter or `bodyEpoch`
// changes (chapter switch / after Save & Extract). Save snapshots the DOM.
// ---------------------------------------------------------------------
function _wrEscapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function _wrGenId(prefix) {
  return (prefix || "p") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}
function _wrCountWords(t) {
  const m = String(t || "").match(/\S+/g);
  return m ? m.length : 0;
}
function _wrParagraphText(p) {
  if (p == null) return "";
  if (typeof p === "string") return p;
  if (p.sceneBreak) return "";
  if (typeof p.text === "string") return p.text;
  if (Array.isArray(p.parts)) return p.parts.map((part) => (part && part.text != null ? part.text : "")).join("");
  return "";
}
function _wrNormalizeManuscript(m) {
  if (!m) return { paragraphs: [] };
  if (Array.isArray(m)) return { paragraphs: m };
  if (Array.isArray(m.paragraphs)) return { paragraphs: m.paragraphs };
  if (typeof m.text === "string" && m.text.trim()) {
    const parts = m.text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    return { paragraphs: parts.map((text) => ({ id: _wrGenId("p"), text })) };
  }
  if (typeof m.html === "string" && m.html.trim()) return { paragraphs: [], html: m.html };
  return { paragraphs: [] };
}
function _wrHighlightHtml(text, lookup) {
  const chunks = splitByOccurrences(text || "", lookup);
  return chunks.map((c) => {
    if (c.occ) {
      const occ = c.occ;
      const t = (typeof ENTITY_TYPES !== "undefined" && ENTITY_TYPES[occ.entityType]) || {};
      const label = t.label || occ.entityType || "entity";
      const style = `--ec:${t.color || "#8a7a52"};--es:${t.soft || "#efe9da"};--ed:${t.deep || "#5a4d2e"}`;
      const title = `${label}: ${occ.exactText || c.text} — double-click to open`;
      return `<span class="wr-mark" data-ui="EntityBrushHighlight" data-entity="${_wrEscapeHtml(occ.entityType)}" data-entity-type="${_wrEscapeHtml(occ.entityType)}" data-entity-id="${_wrEscapeHtml(occ.entityId)}" data-occurrence-id="${_wrEscapeHtml(occ.occurrenceId || "")}" contenteditable="false" style="${style}" title="${_wrEscapeHtml(title)}" aria-label="${_wrEscapeHtml(title)}">${_wrEscapeHtml(c.text)}</span>`;
    }
    return _wrEscapeHtml(c.text);
  }).join("");
}
function _wrBuildBodyHtml(paragraphs, lookup) {
  if (!paragraphs || !paragraphs.length) return "";
  return paragraphs.map((p) => {
    const id = (p && p.id) || _wrGenId("p");
    if (p && p.sceneBreak) {
      return `<div class="wr-scene-break" data-kind="scene-break" data-paragraph-id="${_wrEscapeHtml(id)}" contenteditable="false"><span class="wr-scene-break__line"></span><span aria-hidden="true">※   ※   ※</span><span class="wr-scene-break__line"></span></div>`;
    }
    const text = _wrParagraphText(p);
    const inner = _wrHighlightHtml(text, lookup) || "<br>";
    const author = p && p.author ? ` data-author="${_wrEscapeHtml(p.author)}"` : "";
    if (p && p.kind === "heading") return `<h2 class="wr-h" data-paragraph-id="${_wrEscapeHtml(id)}"${author}>${inner}</h2>`;
    if (p && p.kind === "quote") return `<blockquote class="wr-q" data-paragraph-id="${_wrEscapeHtml(id)}"${author}>${inner}</blockquote>`;
    return `<p class="wr-p" data-paragraph-id="${_wrEscapeHtml(id)}"${author}>${inner}</p>`;
  }).join("");
}
// Snapshot the editable DOM into a persistable manuscript object.
function _wrSnapshotBody(bodyEl) {
  if (!bodyEl) return { paragraphs: [], text: "", html: "", words: 0 };
  const out = [];
  const kids = Array.from(bodyEl.children).filter((el) => el && el.nodeType === 1);
  if (kids.length) {
    kids.forEach((el) => {
      if (el.getAttribute("data-kind") === "scene-break" || el.classList.contains("wr-scene-break")) {
        out.push({ id: el.getAttribute("data-paragraph-id") || _wrGenId("sb"), sceneBreak: true });
        return;
      }
      let id = el.getAttribute("data-paragraph-id");
      if (!id) { id = _wrGenId("p"); try { el.setAttribute("data-paragraph-id", id); } catch (_e) {} }
      const text = (el.textContent || "").replace(/ /g, " ");
      const tag = el.tagName;
      if (tag === "H1" || tag === "H2" || tag === "H3") { out.push({ id, text, kind: "heading" }); return; }
      if (tag === "BLOCKQUOTE") { out.push({ id, text, kind: "quote" }); return; }
      out.push({ id, text });
    });
  } else {
    const raw = bodyEl.innerText || bodyEl.textContent || "";
    raw.split(/\n{2,}/).map((s) => s.replace(/ /g, " ").trim()).filter(Boolean)
      .forEach((text) => out.push({ id: _wrGenId("p"), text }));
  }
  const text = out.filter((p) => !p.sceneBreak).map((p) => p.text || "").join("\n\n");
  return { paragraphs: out, text, html: bodyEl.innerHTML, words: _wrCountWords(text) };
}

// Toolbar block-format helpers over the uncontrolled contentEditable. The
// snapshot maps the resulting <h2>/<blockquote>/scene-break back to a
// paragraph `kind` so block formatting survives save + reload.
function _wrCurrentBlockTag(body) {
  const sel = window.getSelection && window.getSelection();
  let n = sel && sel.anchorNode;
  while (n && n !== body) {
    if (n.nodeType === 1 && /^(H1|H2|H3|BLOCKQUOTE|P)$/.test(n.tagName)) return n.tagName;
    n = n.parentNode;
  }
  return "";
}
function _wrInsertSceneBreak(body) {
  if (!body) return;
  const sel = window.getSelection && window.getSelection();
  let p = sel && sel.anchorNode;
  while (p && p.parentNode !== body) p = p.parentNode;
  const sb = document.createElement("div");
  sb.className = "wr-scene-break";
  sb.setAttribute("data-kind", "scene-break");
  sb.setAttribute("data-paragraph-id", _wrGenId("sb"));
  sb.setAttribute("contenteditable", "false");
  sb.innerHTML = '<span class="wr-scene-break__line"></span><span aria-hidden="true">※   ※   ※</span><span class="wr-scene-break__line"></span>';
  const after = document.createElement("p");
  after.className = "wr-p";
  after.setAttribute("data-paragraph-id", _wrGenId("p"));
  after.innerHTML = "<br>";
  if (p && p.parentNode === body) {
    body.insertBefore(sb, p.nextSibling);
    body.insertBefore(after, sb.nextSibling);
  } else {
    body.appendChild(sb);
    body.appendChild(after);
  }
  try {
    const range = document.createRange();
    range.setStart(after, 0); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
  } catch (_e) {}
}

// Find & Replace — uses the CSS Custom Highlight API so matches are painted
// WITHOUT mutating the contentEditable DOM (the snapshot stays clean). Replace
// edits text-node data directly. Skips atomic spans (contenteditable=false).
function _wrEscapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function _wrFindTextNodes(root) {
  const nodes = [];
  if (!root) return nodes;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      let p = node.parentNode;
      while (p && p !== root) {
        if (p.getAttribute && p.getAttribute("contenteditable") === "false") return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n; while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}
function _wrCollectFindRanges(root, query, caseSensitive) {
  const ranges = [];
  if (!root || !query) return ranges;
  const q = caseSensitive ? query : query.toLowerCase();
  for (const node of _wrFindTextNodes(root)) {
    const hay = caseSensitive ? node.nodeValue : node.nodeValue.toLowerCase();
    let idx = 0;
    while ((idx = hay.indexOf(q, idx)) !== -1) {
      try { const r = document.createRange(); r.setStart(node, idx); r.setEnd(node, idx + query.length); ranges.push(r); } catch (_e) {}
      idx += query.length;
    }
  }
  return ranges;
}
function _wrSetHL(name, ranges) {
  try {
    if (typeof Highlight === "undefined" || typeof CSS === "undefined" || !CSS.highlights) return;
    if (!ranges || !ranges.length) { CSS.highlights.delete(name); return; }
    CSS.highlights.set(name, new Highlight(...ranges));
  } catch (_e) {}
}
function _wrScrollRangeIntoView(range) {
  try {
    let el = range && range.startContainer;
    if (el && el.nodeType === 3) el = el.parentNode;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (_e) {}
}

const FindReplaceBar = ({ query, replace, count, caseSensitive, onQuery, onReplace, onToggleCase, onNext, onPrev, onReplaceOne, onReplaceAll, onClose }) => {
  const inputRef = _wrUR(null);
  _wrUE(() => { try { inputRef.current && inputRef.current.focus(); inputRef.current && inputRef.current.select(); } catch (_e) {} }, []);
  return (
    <div className="wr-find" data-ui="FindReplaceBar" role="search" aria-label="Find and replace">
      <div className="wr-find__row">
        <input ref={inputRef} className="wr-find__input" data-testid="wr-find-input" placeholder="Find in chapter…" value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); } if (e.key === "Escape") { e.preventDefault(); onClose(); } }}/>
        <span className="wr-find__count" data-testid="wr-find-count">{count.total ? `${count.index}/${count.total}` : "0/0"}</span>
        <button type="button" className="wr-find__btn" data-testid="wr-find-prev" title="Previous (Shift+Enter)" onClick={onPrev} disabled={!count.total}><Icon name="chevron-up" size={12}/></button>
        <button type="button" className="wr-find__btn" data-testid="wr-find-next" title="Next (Enter)" onClick={onNext} disabled={!count.total}><Icon name="chevron-d" size={12}/></button>
        <button type="button" className={"wr-find__btn wr-find__btn--toggle" + (caseSensitive ? " is-active" : "")} title="Match case" aria-pressed={caseSensitive} onClick={onToggleCase}>Aa</button>
        <button type="button" className="wr-find__btn" data-testid="wr-find-close" title="Close (Esc)" onClick={onClose}><Icon name="close" size={12}/></button>
      </div>
      <div className="wr-find__row">
        <input className="wr-find__input" data-testid="wr-find-replace" placeholder="Replace with…" value={replace}
          onChange={(e) => onReplace(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onReplaceOne(); } if (e.key === "Escape") { e.preventDefault(); onClose(); } }}/>
        <button type="button" className="wr-find__btn wr-find__btn--text" data-testid="wr-find-replace-one" onClick={onReplaceOne} disabled={!count.total}>Replace</button>
        <button type="button" className="wr-find__btn wr-find__btn--text" data-testid="wr-find-replace-all" onClick={onReplaceAll} disabled={!count.total}>All</button>
      </div>
    </div>
  );
};

const EditableManuscriptBody = ({ bodyRef, chapterId, bodyEpoch, html, spellCheck, onInput, onDoubleClick, onMouseOver, onMouseOut }) => {
  const localRef = _wrUR(null);
  const htmlRef = _wrUR(html);
  htmlRef.current = html;
  const assign = (el) => { localRef.current = el; if (bodyRef) bodyRef.current = el; };
  // Write innerHTML ONLY on chapter switch / explicit epoch bump — never on
  // keystroke. The JSX has no children, so React never touches typed nodes.
  _wrUE(() => {
    const el = localRef.current;
    if (!el) return;
    el.innerHTML = htmlRef.current || "";
    try { if (document.execCommand) document.execCommand("defaultParagraphSeparator", false, "p"); } catch (_e) {}
  }, [chapterId, bodyEpoch]);
  return (
    <div
      ref={assign}
      className="wr-canvas__body wr-body--editable"
      data-ui="ManuscriptBody"
      data-testid="wr-manuscript-body"
      contentEditable
      suppressContentEditableWarning
      spellCheck={spellCheck !== false}
      role="textbox"
      aria-multiline="true"
      aria-label="Manuscript body — start writing"
      data-placeholder="Start writing…"
      onInput={onInput}
      onDoubleClick={onDoubleClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    />
  );
};

// ---------------------------------------------------------------------
// ManuscriptCanvas
// ---------------------------------------------------------------------
// Persisted workspace.* prefs (onboarding "Workspace" step / Settings ▸
// Editor) applied as CSS vars on the canvas: width, font, margins.
const useWorkspacePrefs = () => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const bump = (e) => {
      if (e?.detail?.section && e.detail.section !== "workspace") return;
      setTick((t) => t + 1);
    };
    window.addEventListener("lw:settings-updated", bump);
    window.addEventListener("lw:backend-ready", bump);
    return () => {
      window.removeEventListener("lw:settings-updated", bump);
      window.removeEventListener("lw:backend-ready", bump);
    };
  }, []);
  return React.useMemo(() => {
    const w = window.LoomwrightBackend?.SettingsService?.getSectionSync?.("workspace", {}) || {};
    const style = {};
    const width = Number(w.editorWidth);
    if (width >= 400 && width <= 1400) style["--wr-editor-max"] = width + "px";
    if (typeof w.font === "string" && w.font.trim()) style["--wr-editor-font"] = '"' + w.font.trim() + '", var(--font-serif)';
    if (w.margins === false) style["--wr-editor-pad"] = "var(--sp-8)";
    return style;
  }, [tick]);
};

const ManuscriptCanvas = ({
  chapter, manuscript, state, bodyRef, titleRef, bodyEpoch, spellCheck,
  onBodyInput, onStartWriting,
  onEntityHoverDelegated, onEntityDoubleClickDelegated,
  onCreateChapter, onSaveAndExtract,
}) => {
  const prefStyle = useWorkspacePrefs();
  // Load persisted EntityOccurrences for this chapter and rebuild the
  // lookup whenever the entity store updates (accept queue, merge, etc).
  const [occurrences, setOccurrences] = React.useState(() => {
    if (!chapter?.id) return [];
    return window.LoomwrightBackend?.OccurrenceService?.listByChapterSync?.(chapter.id) || [];
  });
  React.useEffect(() => {
    if (!chapter?.id) { setOccurrences([]); return; }
    const refresh = () => {
      const list = window.LoomwrightBackend?.OccurrenceService?.listByChapterSync?.(chapter.id) || [];
      setOccurrences(list);
    };
    refresh();
    window.addEventListener("lw:entity-store-updated", refresh);
    window.addEventListener("lw:extraction-updated", refresh);
    return () => {
      window.removeEventListener("lw:entity-store-updated", refresh);
      window.removeEventListener("lw:extraction-updated", refresh);
    };
  }, [chapter?.id]);
  const occurrenceLookup = React.useMemo(() => buildOccurrenceLookup(occurrences), [occurrences]);
  const norm = React.useMemo(() => _wrNormalizeManuscript(manuscript), [manuscript]);
  const bodyHtml = React.useMemo(() => (
    (norm.html != null && !(norm.paragraphs && norm.paragraphs.length))
      ? norm.html
      : _wrBuildBodyHtml(norm.paragraphs, occurrenceLookup)
  ), [norm, occurrenceLookup]);
  const isEmptyBody = !bodyHtml || !bodyHtml.trim();
  const [hintDismissed, setHintDismissed] = _wrUS(false);
  _wrUE(() => { setHintDismissed(false); }, [chapter && chapter.id]);
  _wrUE(() => {
    if (titleRef && titleRef.current && chapter) titleRef.current.textContent = chapter.title || "Untitled";
  }, [chapter && chapter.id]);
  if (!chapter) {
    return (
      <div className="wr-canvas wr-canvas--empty" data-ui="ManuscriptCanvas" data-state="no-chapter">
        <div className="wr-empty-card">
          <Icon name="feather" size={28}/>
          <div className="wr-empty-card__title">No chapter selected</div>
          <div className="wr-empty-card__body">Pick a chapter from the strip above, or start a new one.</div>
          <div className="wr-empty-card__actions">
            <Btn variant="primary" size="sm" icon="plus" onClick={onCreateChapter} data-callback="onCreateChapter">New chapter</Btn>
          </div>
        </div>
      </div>
    );
  }
  if (state === "loading") {
    return (
      <div className="wr-canvas wr-canvas--loading" data-ui="ManuscriptCanvas" data-state="loading">
        <LoadingState title="Drawing the page…" lines={5}/>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="wr-canvas wr-canvas--error" data-ui="ManuscriptCanvas" data-state="error">
        <ErrorState title="Couldn't open this chapter" body="Local manuscript index didn't respond. Your draft is safe — try again in a moment."/>
      </div>
    );
  }
  const showHint = !hintDismissed && isEmptyBody;
  return (
    <article className="wr-canvas" data-ui="ManuscriptCanvas" data-state={state} data-chapter-id={chapter.id} style={prefStyle}>
      <header className="wr-canvas__head">
        <div className="wr-canvas__eyebrow">Chapter {chapter.num}</div>
        <h1
          className="wr-canvas__title"
          data-ui="ManuscriptTitle"
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          aria-label="Chapter title"
          onInput={onBodyInput}
        />
        <div className="wr-canvas__sub">{(chapter.words || 0).toLocaleString()} words</div>
        <label
          data-ui="ChapterCompleteToggle"
          title="Mark this chapter complete — shows on the Home story snapshot"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: "var(--fs-2xs, 12px)", color: chapter.complete ? "var(--ok, #4a7a4a)" : "var(--ink-3, #8a7a5a)", cursor: "pointer", userSelect: "none" }}
        >
          <input
            type="checkbox"
            checked={!!chapter.complete}
            data-testid="wr-chapter-complete"
            onChange={() => window.dispatchEvent(new CustomEvent("lw:toggle-chapter-complete", { detail: { chapterId: chapter.id } }))}
            style={{ cursor: "pointer" }}
          />
          <span>{chapter.complete ? "Chapter complete" : "Mark chapter complete"}</span>
        </label>
      </header>
      <div className="wr-canvas__bodywrap" style={{ position: "relative" }}>
        <EditableManuscriptBody
          bodyRef={bodyRef}
          chapterId={chapter.id}
          bodyEpoch={bodyEpoch}
          html={bodyHtml}
          spellCheck={spellCheck}
          onInput={(e) => { setHintDismissed(true); onBodyInput && onBodyInput(e); }}
          onDoubleClick={onEntityDoubleClickDelegated}
          onMouseOver={onEntityHoverDelegated}
          onMouseOut={(e) => onEntityHoverDelegated && onEntityHoverDelegated(e, true)}
        />
        {showHint && (
          <div className="wr-empty-card wr-empty-card--inline" data-ui="ManuscriptEmptyHint">
            <Icon name="feather" size={24}/>
            <div className="wr-empty-card__title">Empty page, full ink</div>
            <div className="wr-empty-card__body">Start writing here. Run extraction later to surface entity candidates.</div>
            <div className="wr-empty-card__actions">
              <Btn variant="primary" size="sm" icon="feather" data-testid="wr-start-writing" onClick={() => { setHintDismissed(true); onStartWriting && onStartWriting(); }}>Start writing</Btn>
              <Btn variant="outline" size="sm" icon="sparkle" onClick={onSaveAndExtract}>Run extraction</Btn>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------
// WritersRoomScreen
// ---------------------------------------------------------------------
const WritersRoomScreen = ({
  onOpenAdaptiveWheel,
  onOpenPanel,
  onOpenEntityFromManuscript,
  onOpenReviewQueue,
  onSetSyncState,
  syncState,
  layout, setLayout,
  onApplyWorkspacePreset,
  onOpenEntityEditor,
  onOpenCompositionOverlay,
  onDropEntityIntoComposition,
  compositionOverlayOpen,
}) => {
  // Layout state — falls back to local if no shared layout passed
  const [_localLayout, _setLocalLayout] = useLayoutState();
  const L = layout || _localLayout;
  const setL = setLayout || _setLocalLayout;

  const loadStored = () => {
    const svc = window.LoomwrightBackend?.ManuscriptChapterService;
    if (!svc) return null;
    const s = svc.loadSync();
    if (s?.chapters?.length) return s;
    return null;
  };

  const storedInit = loadStored();
  const defaultChapters = storedInit?.chapters?.length
    ? storedInit.chapters
    : [{ id: "c1", num: 1, title: "Chapter 1", state: "unsaved", queue: 0, words: 0, author: "em", active: true }];
  const defaultActiveId = storedInit?.activeChapterId || defaultChapters.find((c) => c.active)?.id || defaultChapters[0]?.id;

  // Chapters
  const [chapters, setChapters] = _wrUS(defaultChapters);
  const [activeId, setActiveId] = _wrUS(defaultActiveId);
  const [manuscriptsByChapter, setManuscriptsByChapter] = _wrUS(storedInit?.manuscripts || {});
  const activeChapter = chapters.find((c) => c.id === activeId);

  // Manuscript state
  const [canvasState, setCanvasState] = _wrUS("writing"); // writing | empty | loading | error | saving | saved | offline
  const bodyRef = _wrUR(null);
  const titleRef = _wrUR(null);
  const [bodyEpoch, setBodyEpoch] = _wrUS(0);
  const activeManuscript = activeChapter && !activeChapter.reserved ? manuscriptsByChapter[activeId] : null;

  // Authors — live profiles from Settings (UAT #6). Falls back to a single
  // "You" author when none are configured, so notes/attribution never show
  // demo author names on a fresh project.
  const loadAuthors = () => {
    try {
      // NB: read the raw array via getAllSync — getSectionSync object-spreads
      // its result, which mangles array sections like "authors".
      const list = window.LoomwrightBackend?.SettingsService?.getAllSync?.()?.authors;
      if (Array.isArray(list) && list.length) return list;
    } catch (_e) {}
    return [{ id: "you", name: "You", initials: "Y", color: "var(--accent)" }];
  };
  const [authorList, setAuthorList] = _wrUS(loadAuthors);
  const [activeAuthorId, setActiveAuthorId] = _wrUS(() => {
    const list = loadAuthors();
    try {
      const saved = window.LoomwrightBackend?.SettingsService?.getSectionSync?.("writersRoom", {})?.activeAuthorId;
      if (saved && list.some((a) => a.id === saved)) return saved;
    } catch (_e) {}
    return (list[0] && list[0].id) || "you";
  });
  _wrUE(() => {
    const refresh = () => setAuthorList(loadAuthors());
    window.addEventListener("lw:settings-saved", refresh);
    window.addEventListener("lw:settings-updated", refresh);
    window.addEventListener("lw:backend-ready", refresh);
    window.addEventListener("lw:project-imported", refresh);
    return () => {
      window.removeEventListener("lw:settings-saved", refresh);
      window.removeEventListener("lw:settings-updated", refresh);
      window.removeEventListener("lw:backend-ready", refresh);
      window.removeEventListener("lw:project-imported", refresh);
    };
  }, []);

  // Toolbar toggles
  const [spellcheck, setSpellcheck] = _wrUS(true);
  const [grammar, setGrammar] = _wrUS(true);
  const [voice, setVoice] = _wrUS(false);
  const [styleS, setStyleS] = _wrUS(false);
  const [revision, setRevision] = _wrUS(false);
  const [attribution, setAttribution] = _wrUS(true);
  // Find & Replace
  const [findOpen, setFindOpen] = _wrUS(false);
  const [findQuery, setFindQuery] = _wrUS("");
  const [findReplace, setFindReplace] = _wrUS("");
  const [findCount, setFindCount] = _wrUS({ total: 0, index: 0 });
  const [findCase, setFindCase] = _wrUS(false);
  const findRangesRef = _wrUR([]);
  // Derive focus/margins from layout mode
  const focusMode = L.writingLayoutMode === "clean";
  const marginsHidden = L.writingLayoutMode === "clean" || L.writingLayoutMode === "manuscript-focus";
  const leftMarginVisible  = !L.leftMarginCollapsed  && (L.writingLayoutMode === "full" || L.writingLayoutMode === "notes");
  const rightMarginVisible = !L.rightMarginCollapsed && (L.writingLayoutMode === "full" || L.writingLayoutMode === "review");
  const [typewriter, setTypewriter] = _wrUS(false);

  // Mobile / compact layout — side margins become bottom-sheet drawers and the
  // toolbar wraps. Driven by viewport width OR the onboarding `workspace.mobileCompact` pref.
  const _wrCompactPref = () => { try { return !!window.LoomwrightBackend?.SettingsService?.getSectionSync?.("workspace", {})?.mobileCompact; } catch (_e) { return false; } };
  const [isMobile, setIsMobile] = _wrUS(() => {
    try {
      if (_wrCompactPref()) return true;
      return typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 860px)").matches : false;
    } catch (_e) { return false; }
  });
  const [mobileDrawer, setMobileDrawer] = _wrUS(null); // null | "left" | "right"
  _wrUE(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setIsMobile(mq.matches || _wrCompactPref());
    apply();
    try { mq.addEventListener("change", apply); } catch (_e) { mq.addListener && mq.addListener(apply); }
    window.addEventListener("lw:settings-saved", apply);
    window.addEventListener("lw:settings-updated", apply);
    return () => {
      try { mq.removeEventListener("change", apply); } catch (_e) { mq.removeListener && mq.removeListener(apply); }
      window.removeEventListener("lw:settings-saved", apply);
      window.removeEventListener("lw:settings-updated", apply);
    };
  }, []);
  _wrUE(() => { if (!isMobile && mobileDrawer) setMobileDrawer(null); }, [isMobile, mobileDrawer]);
  const showLeftMargin  = isMobile ? (mobileDrawer === "left")  : leftMarginVisible;
  const showRightMargin = isMobile ? (mobileDrawer === "right") : rightMarginVisible;

  // Margins state
  const [noteFilter, setNoteFilter] = _wrUS("open");
  const [extFilter, setExtFilter] = _wrUS("all");
  const [notes, setNotes] = _wrUS([]);
  const [editingNoteId, setEditingNoteId] = _wrUS(null);
  const loadReviewExtractions = () => {
    const items = window.LoomwrightBackend?.ReviewService?.listSync() || [];
    return items.filter((i) => i.status === "pending").map((i) => {
      // Normalise the backend candidate to the card shape so the margin shows
      // the real name / band / source quote (not a generic reason/level).
      const card = window.candidateToCardItem ? window.candidateToCardItem(i) : null;
      return {
        id: i.id,
        type: i.entityType,
        name: (card && card.candidate && card.candidate.name) || i.name,
        quote: (card && card.mention) || i.sourceQuote || "",
        conf: (card && card.confidence && card.confidence.band) || "uncertain",
        pct: (card && card.confidence && card.confidence.value != null) ? card.confidence.value : (i.value || 70),
        summary: i.summary || "",
        merge: i.matchType === "ambiguous",
      };
    });
  };
  const [extractions, setExtractions] = _wrUS(() => loadReviewExtractions());
  const [selectedExtId, setSelectedExtId] = _wrUS("x5");

  // Paragraph notes (UAT #19) — source of truth is ManuscriptNoteService,
  // scoped to the active chapter and refreshed on store updates.
  const refreshNotes = _wrUC(() => {
    const svc = window.LoomwrightBackend?.ManuscriptNoteService;
    setNotes(svc && activeId ? svc.listByChapterSync(activeId) : []);
  }, [activeId]);
  _wrUE(() => {
    refreshNotes();
    window.addEventListener("lw:manuscript-notes-updated", refreshNotes);
    window.addEventListener("lw:backend-ready", refreshNotes);
    window.addEventListener("lw:project-imported", refreshNotes);
    return () => {
      window.removeEventListener("lw:manuscript-notes-updated", refreshNotes);
      window.removeEventListener("lw:backend-ready", refreshNotes);
      window.removeEventListener("lw:project-imported", refreshNotes);
    };
  }, [refreshNotes]);

  const persistChapters = _wrUC((nextChapters, nextManuscripts, nextActiveId, nextNotes, nextExtractions) => {
    const svc = window.LoomwrightBackend?.ManuscriptChapterService;
    if (!svc) return;
    svc.save({
      chapters: nextChapters ?? chapters,
      activeChapterId: nextActiveId ?? activeId,
      manuscripts: nextManuscripts ?? manuscriptsByChapter,
      notes: { default: nextNotes ?? notes },
      extractions: { default: nextExtractions ?? extractions },
      authors: authorList,
    });
  }, [activeId, chapters, manuscriptsByChapter, notes, extractions, authorList]);

  _wrUE(() => {
    const onReady = () => {
      const s = loadStored();
      if (s?.chapters?.length) {
        setChapters(s.chapters);
        setActiveId(s.activeChapterId || s.chapters[0]?.id);
        setManuscriptsByChapter(s.manuscripts || {});
        if (s.extractions?.default) setExtractions(s.extractions.default);
        else {
          const rq = loadReviewExtractions();
          if (rq.length) setExtractions(rq);
        }
      } else {
        const rq = loadReviewExtractions();
        if (rq.length) setExtractions(rq);
      }
    };
    window.addEventListener("lw:backend-ready", onReady);
    window.addEventListener("lw:manuscript-chapters-updated", onReady);
    window.addEventListener("lw:project-imported", onReady);
    window.addEventListener("lw:entity-store-updated", onReady);
    if (window.LoomwrightBackend) onReady();
    return () => {
      window.removeEventListener("lw:backend-ready", onReady);
      window.removeEventListener("lw:manuscript-chapters-updated", onReady);
      window.removeEventListener("lw:project-imported", onReady);
      window.removeEventListener("lw:entity-store-updated", onReady);
    };
  }, []);

  const [extractionState, setExtractionState] = _wrUS("idle"); // idle | running | complete | error

  // Extraction modal flow. The progress modal drives itself from live
  // `lw:extraction-progress` engine events (real stages + a streamed
  // snapshot of every find) — no fake timers here.
  const [progressOpen, setProgressOpen] = _wrUS(false);
  const [progressMode, setProgressMode] = _wrUS("quick"); // quick | deep
  const [progressFailed, setProgressFailed] = _wrUS(false);
  const extractAbortRef = _wrUR(null);
  const [sessionDrawerOpen, setSessionDrawerOpen] = _wrUS(false);
  const [activeSession, setActiveSession] = _wrUS(null);

  // Floating UI
  const [hoverEntity, setHoverEntity] = _wrUS(null);
  // Floating selection toolbar — hidden until the user actually selects text
  // inside the editable body (UAT #7: no fake always-on toolbar).
  const [selToolbar, setSelToolbar] = _wrUS({ x: 0, y: 0, visible: false });
  _wrUE(() => {
    const onSel = () => {
      try {
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed && bodyRef.current && bodyRef.current.contains(sel.anchorNode) && String(sel.toString()).trim()) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          setSelToolbar({ x: Math.max(8, rect.left), y: Math.max(8, rect.top - 46), visible: true });
        } else {
          setSelToolbar((p) => (p.visible ? { ...p, visible: false } : p));
        }
      } catch (_e) {}
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  // Delete confirm modal
  const [deletingChapter, setDeletingChapter] = _wrUS(null);

  // ----- callbacks -----
  const onSelectChapter = _wrUC((id) => {
    setActiveId(id);
    persistChapters(chapters, manuscriptsByChapter, id);
  }, [chapters, manuscriptsByChapter, persistChapters]);
  const onCreateChapter = _wrUC(() => {
    const n = chapters.length + 1;
    const id = _wrGenId("ch");
    const nextChapters = [...chapters, { id, num: n, title: "New chapter", state: "unsaved", queue: 0, words: 0, author: activeAuthorId }];
    setChapters(nextChapters);
    setActiveId(id);
    persistChapters(nextChapters, manuscriptsByChapter, id);
  }, [chapters, manuscriptsByChapter, activeAuthorId, persistChapters]);
  const onReserveChapter = _wrUC(() => {
    const n = chapters.length + 1;
    const id = _wrGenId("ch");
    const nextChapters = [...chapters, { id, num: n, title: "", state: "reserved", reserved: true, queue: 0, words: 0 }];
    setChapters(nextChapters);
    persistChapters(nextChapters, manuscriptsByChapter, activeId);
  }, [chapters, manuscriptsByChapter, activeId, persistChapters]);
  const onRenameChapter = _wrUC(() => {}, []);
  const onDeleteChapterRequest = _wrUC(() => {
    setDeletingChapter(activeChapter);
  }, [activeChapter]);
  const onConfirmDeleteChapter = _wrUC(async () => {
    if (!deletingChapter) return;
    const svc = window.LoomwrightBackend?.ManuscriptChapterService;
    if (svc) {
      await svc.deleteChapter(deletingChapter.id);
      const s = svc.loadSync();
      setChapters(s.chapters || []);
      setActiveId(s.activeChapterId || (s.chapters && s.chapters[0] && s.chapters[0].id) || null);
      setManuscriptsByChapter(s.manuscripts || {});
    } else {
      setChapters((curr) => curr.filter((c) => c.id !== deletingChapter.id));
    }
    setDeletingChapter(null);
  }, [deletingChapter]);
  const onMoveChapter = _wrUC(async (direction) => {
    if (!activeChapter) return;
    const svc = window.LoomwrightBackend?.ManuscriptChapterService;
    if (!svc) return;
    await svc.moveChapter(activeChapter.id, direction);
    const s = svc.loadSync();
    setChapters(s.chapters || []);
  }, [activeChapter]);

  const onSave = _wrUC(async () => {
    setCanvasState("saving");
    onSetSyncState && onSetSyncState("syncing");
    const snap = _wrSnapshotBody(bodyRef.current);
    const title = ((titleRef.current && titleRef.current.innerText) || (activeChapter && activeChapter.title) || "").trim();
    const next = { ...manuscriptsByChapter, [activeId]: snap };
    const nextChapters = chapters.map((c) => c.id === activeId ? { ...c, title: title || c.title, words: snap.words, state: "saved" } : c);
    setManuscriptsByChapter(next);
    setChapters(nextChapters);
    persistChapters(nextChapters, next, activeId);
    try { await window.LoomwrightBackend?.ManuscriptService?.saveCurrentDom(); } catch (_e) {}
    setCanvasState("writing");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState, chapters, manuscriptsByChapter, activeId, persistChapters, activeChapter]);
  const runExtractionFlow = _wrUC(async (deep) => {
    const snap = _wrSnapshotBody(bodyRef.current);
    const nextManuscripts = { ...manuscriptsByChapter, [activeId]: snap };
    const extractingChapters = chapters.map((c) => c.id === activeId ? { ...c, words: snap.words, state: "extracting" } : c);
    setManuscriptsByChapter(nextManuscripts);
    setChapters(extractingChapters);
    persistChapters(extractingChapters, nextManuscripts, activeId);
    try { await window.LoomwrightBackend?.ManuscriptService?.saveCurrentDom(); } catch (_e) {}
    setExtractionState("running");
    setProgressMode(deep ? "deep" : "quick"); setProgressFailed(false); setProgressOpen(true);
    onSetSyncState && onSetSyncState("syncing");
    const ctrl = new AbortController();
    extractAbortRef.current = ctrl;
    // Paragraph offset map so each occurrence can be attributed to a paragraph id.
    const offsets = []; let cursor = 0;
    (snap.paragraphs || []).forEach((p) => {
      if (p.sceneBreak) return;
      const t = p.text || "";
      offsets.push({ id: p.id, start: cursor, end: cursor + t.length });
      cursor += t.length + 2;
    });
    try {
      await window.LoomwrightBackend?.ExtractionService?.runExtraction({ chapterId: activeId, text: snap.text, deep, paragraphs: offsets, signal: ctrl.signal });
    } catch (_e) {
      setProgressFailed(true);
    }
    extractAbortRef.current = null;
    setExtractions(loadReviewExtractions());
    setChapters((curr) => curr.map((c) => c.id === activeId ? { ...c, state: "extracted" } : c));
    // Ensure the canvas re-pulls occurrences, then force a one-time body
    // re-highlight from the freshly-saved content (safe: just saved).
    try { window.dispatchEvent(new CustomEvent("lw:entity-store-updated")); } catch (_e) {}
    setBodyEpoch((v) => v + 1);
    onSetSyncState && onSetSyncState("saved");
  }, [activeId, chapters, manuscriptsByChapter, persistChapters, onSetSyncState]);
  const onSaveAndExtract = _wrUC(() => runExtractionFlow(false), [runExtractionFlow]);
  const onCloseProgress = _wrUC(() => {
    setProgressOpen(false);
    setExtractionState("complete");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState]);
  const onCancelExtraction = _wrUC(() => {
    // Abort the live run (AI chunks check the signal) — anything already
    // found stays in the review queue.
    if (extractAbortRef.current) { try { extractAbortRef.current.abort(); } catch (_e) {} }
    setProgressOpen(false);
    setExtractionState("idle");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState]);
  const onRetryExtraction = _wrUC(() => { setProgressFailed(false); runExtractionFlow(progressMode === "deep"); }, [runExtractionFlow, progressMode]);
  const onOpenSessionDrawer = _wrUC(() => {
    const s = (typeof MOCK_SESSIONS !== "undefined" && MOCK_SESSIONS[0]) || null;
    setActiveSession(s); setSessionDrawerOpen(true);
  }, []);
  const onCloseSessionDrawer = _wrUC(() => setSessionDrawerOpen(false), []);

  const onManuscriptChange = _wrUC(() => {
    if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
  }, [canvasState, onSetSyncState]);
  const onStartWriting = _wrUC(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (!el.textContent || !el.textContent.trim()) {
      el.innerHTML = '<p class="wr-p" data-paragraph-id="' + _wrGenId("p") + '"><br></p>';
    }
    el.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      const first = el.querySelector("[data-paragraph-id]") || el;
      range.selectNodeContents(first);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_e) {}
    if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
  }, [canvasState, onSetSyncState]);
  const onSelectText = _wrUC(() => {}, []);
  // Current selection inside the editable body (collapsed → "").
  const _wrSelectionText = _wrUC(() => {
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed && bodyRef.current && bodyRef.current.contains(sel.anchorNode)) {
        return String(sel.toString()).replace(/\s+/g, " ").trim();
      }
    } catch (_e) {}
    return "";
  }, []);
  const onCreateEntityFromSelection = _wrUC(() => {
    const text = _wrSelectionText();
    onOpenEntityEditor && onOpenEntityEditor({ type: "cast", initial: { name: text.slice(0, 60) } });
  }, [onOpenEntityEditor, _wrSelectionText]);
  const onLinkEntity = _wrUC(() => {
    const text = _wrSelectionText();
    if (!text) return;
    const B = window.LoomwrightBackend;
    const known = B && B.findKnownEntityMention ? B.findKnownEntityMention(text, { threshold: 0.75 }) : null;
    if (known && known.entity && known.entity.id) {
      window.dispatchEvent(new CustomEvent("lw:open-search-result", {
        detail: { type: "entity", entityId: known.entity.id, entityType: known.type },
      }));
    } else {
      window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "No entity matches “" + text.slice(0, 40) + "” yet — use New entity to create it." } }));
    }
  }, [_wrSelectionText]);
  const onExtractSelection = _wrUC(() => {
    const text = _wrSelectionText();
    if (!text) return;
    window.__LW_WIZARD_SELECTION__ = { text, chapterId: activeId };
    window.dispatchEvent(new CustomEvent("lw:open-extraction-wizard", { detail: { scope: "selection", chapterId: activeId } }));
  }, [activeId, _wrSelectionText]);
  const onOpenEntity = _wrUC(() => onOpenPanel && onOpenPanel("cast"), [onOpenPanel]);
  const onShowMentions = _wrUC(() => {}, []);
  const onAcceptQueueItem = _wrUC(async (idOrItem) => {
    const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
    if (window.LoomwrightDispatchCallback) await window.LoomwrightDispatchCallback("onAcceptQueueItem", { detail: { id } });
    setExtractions((curr) => curr.filter((x) => x.id !== id));
  }, []);
  // Edit / Merge / Deny all delegate to the same registry callbacks the
  // Review Queue uses, so the margin behaves identically (Edit opens the
  // global edit-candidate modal; Merge opens the real merge modal; Deny
  // resolves + removes any auto-added entity). No demo modals here.
  const onEditQueueItem = _wrUC((idOrItem) => {
    const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
    window.LoomwrightDispatchCallback && window.LoomwrightDispatchCallback("onEditQueueItem", { detail: { id } });
  }, []);
  const onMergeQueueItem = _wrUC((idOrItem) => {
    const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
    window.LoomwrightDispatchCallback && window.LoomwrightDispatchCallback("onMergeQueueItem", { detail: { id } });
  }, []);
  const onDenyQueueItem = _wrUC(async (idOrItem) => {
    const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
    if (window.LoomwrightDispatchCallback) await window.LoomwrightDispatchCallback("onDenyQueueItem", { detail: { id } });
    setExtractions((curr) => curr.filter((x) => x.id !== id));
  }, []);
  const onOpenFullReview = _wrUC(() => onOpenReviewQueue && onOpenReviewQueue(), [onOpenReviewQueue]);
  // ----- paragraph note handlers (UAT #19) -----
  const _wrCurrentParagraphId = _wrUC(() => {
    const body = bodyRef.current;
    if (!body) return null;
    try {
      const sel = window.getSelection && window.getSelection();
      const node = sel && sel.anchorNode;
      if (node && body.contains(node)) {
        const el = node.nodeType === 1 ? node : node.parentElement;
        const p = el && el.closest && el.closest("[data-paragraph-id]");
        if (p) return p.getAttribute("data-paragraph-id");
      }
    } catch (_e) {}
    const first = body.querySelector("[data-paragraph-id]");
    return first ? first.getAttribute("data-paragraph-id") : null;
  }, []);
  const _wrSelectionQuote = _wrUC(() => {
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed && bodyRef.current && bodyRef.current.contains(sel.anchorNode)) {
        return String(sel.toString()).replace(/\s+/g, " ").trim().slice(0, 280);
      }
    } catch (_e) {}
    return "";
  }, []);
  const onAddNote = _wrUC(async () => {
    if (!activeId) return;
    const svc = window.LoomwrightBackend?.ManuscriptNoteService;
    if (!svc) return;
    const paragraphId = _wrCurrentParagraphId();
    const quote = _wrSelectionQuote();
    setL((p) => ({ ...p, leftMarginCollapsed: false, writingLayoutMode: (p.writingLayoutMode === "full" || p.writingLayoutMode === "notes") ? p.writingLayoutMode : "full" }));
    const note = await svc.createNote({ chapterId: activeId, paragraphId, quote, noteText: "", authorId: activeAuthorId, source: quote ? "selection" : "manual" });
    setEditingNoteId(note.id);
  }, [activeId, activeAuthorId, setL, _wrCurrentParagraphId, _wrSelectionQuote]);
  const onEditNote = _wrUC((id) => setEditingNoteId(id), []);
  const onCancelEditNote = _wrUC(() => setEditingNoteId(null), []);
  const onSaveNoteText = _wrUC(async (id, text) => {
    await window.LoomwrightBackend?.ManuscriptNoteService?.updateNote(id, { noteText: text });
    setEditingNoteId(null);
  }, []);
  const onResolveNote = _wrUC(async (id, status) => {
    await window.LoomwrightBackend?.ManuscriptNoteService?.resolveNote(id, status === "open" ? "open" : "resolved");
  }, []);
  const onDeleteNote = _wrUC(async (id) => {
    await window.LoomwrightBackend?.ManuscriptNoteService?.deleteNote(id);
    setEditingNoteId((cur) => (cur === id ? null : cur));
  }, []);
  const onFocusNoteParagraph = _wrUC((note) => {
    const body = bodyRef.current;
    if (!body || !note) return;
    let el = null;
    try {
      el = note.paragraphId
        ? body.querySelector('[data-paragraph-id="' + ((window.CSS && CSS.escape) ? CSS.escape(note.paragraphId) : note.paragraphId) + '"]')
        : null;
    } catch (_e) {}
    if (!el) el = body.querySelector("[data-paragraph-id]");
    if (el) {
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_e) {}
      el.classList.add("wr-p--flash");
      setTimeout(() => { try { el.classList.remove("wr-p--flash"); } catch (_e) {} }, 1200);
    }
  }, []);

  // ---- Find & Replace handlers (CSS Highlight API; find never mutates DOM) ----
  const runFind = _wrUC((query, opts = {}) => {
    const body = bodyRef.current;
    const q = query != null ? query : "";
    const cs = opts.caseSensitive != null ? opts.caseSensitive : findCase;
    if (!body || !q) {
      findRangesRef.current = [];
      _wrSetHL("wr-find", []); _wrSetHL("wr-find-current", []);
      setFindCount({ total: 0, index: 0 });
      return;
    }
    const ranges = _wrCollectFindRanges(body, q, cs);
    findRangesRef.current = ranges;
    _wrSetHL("wr-find", ranges);
    if (ranges.length) { _wrSetHL("wr-find-current", [ranges[0]]); _wrScrollRangeIntoView(ranges[0]); setFindCount({ total: ranges.length, index: 1 }); }
    else { _wrSetHL("wr-find-current", []); setFindCount({ total: 0, index: 0 }); }
  }, [findCase]);
  const gotoMatch = _wrUC((dir) => {
    const ranges = findRangesRef.current || [];
    if (!ranges.length) return;
    setFindCount((c) => {
      let i = (c.index || 1) + dir;
      if (i < 1) i = ranges.length;
      if (i > ranges.length) i = 1;
      _wrSetHL("wr-find-current", [ranges[i - 1]]);
      _wrScrollRangeIntoView(ranges[i - 1]);
      return { total: ranges.length, index: i };
    });
  }, []);
  const replaceOne = _wrUC(() => {
    const ranges = findRangesRef.current || [];
    const r = ranges[(findCount.index || 1) - 1];
    if (r) {
      try {
        const node = r.startContainer;
        if (node && node.nodeType === 3) node.nodeValue = node.nodeValue.slice(0, r.startOffset) + findReplace + node.nodeValue.slice(r.endOffset);
      } catch (_e) {}
      if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
    }
    runFind(findQuery, { caseSensitive: findCase });
  }, [findCount, findReplace, findQuery, findCase, canvasState, onSetSyncState, runFind]);
  const replaceAllFind = _wrUC(() => {
    const body = bodyRef.current;
    if (!body || !findQuery) return;
    const re = new RegExp(_wrEscapeRegExp(findQuery), findCase ? "g" : "gi");
    let count = 0;
    for (const node of _wrFindTextNodes(body)) {
      if (re.test(node.nodeValue)) { re.lastIndex = 0; node.nodeValue = node.nodeValue.replace(re, () => { count++; return findReplace; }); }
    }
    if (count && canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
    runFind(findQuery, { caseSensitive: findCase });
  }, [findQuery, findReplace, findCase, canvasState, onSetSyncState, runFind]);
  const closeFind = _wrUC(() => {
    setFindOpen(false);
    _wrSetHL("wr-find", []); _wrSetHL("wr-find-current", []);
    findRangesRef.current = [];
    setFindCount({ total: 0, index: 0 });
  }, []);
  // Cmd/Ctrl+F opens Find when the focus is inside the Writer's Room.
  _wrUE(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        const inWR = e.target && e.target.closest && e.target.closest(".wr");
        if (inWR) { e.preventDefault(); setFindOpen(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onToolbarAction = _wrUC((action) => {
    if (action === "create-entity") { onCreateEntityFromSelection(); return; }
    if (action === "link-entity") { onLinkEntity(); return; }
    if (action === "find") { setFindOpen(true); return; }
    if (action === "inline-note" || action === "comment") { onAddNote(); return; }
    if (action === "bold" || action === "italic" || action === "underline" || action === "strike") {
      const cmd = action === "strike" ? "strikeThrough" : action;
      try { if (bodyRef.current) bodyRef.current.focus(); if (document.execCommand) document.execCommand(cmd, false, null); } catch (_e) {}
      if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
      return;
    }
    if (action === "heading" || action === "quote") {
      const body = bodyRef.current;
      if (body) {
        try {
          body.focus();
          const want = action === "heading" ? "H2" : "BLOCKQUOTE";
          const cur = _wrCurrentBlockTag(body);
          const tag = (cur === want) ? "p" : (action === "heading" ? "h2" : "blockquote");
          if (document.execCommand) document.execCommand("formatBlock", false, tag);
        } catch (_e) {}
      }
      if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
      return;
    }
    if (action === "scene-break") {
      const body = bodyRef.current;
      if (body) { try { body.focus(); _wrInsertSceneBreak(body); } catch (_e) {} }
      if (canvasState === "writing") onSetSyncState && onSetSyncState("unsaved");
      return;
    }
  }, [onCreateEntityFromSelection, onLinkEntity, onAddNote, canvasState, onSetSyncState]);

  const onToggleFocusMode  = _wrUC(() => setL((p) => ({ ...p, writingLayoutMode: p.writingLayoutMode === "clean" ? "full" : "clean" })), [setL]);
  const onSelectAuthor     = _wrUC((id) => {
    setActiveAuthorId(id);
    try {
      const svc = window.LoomwrightBackend?.SettingsService;
      if (svc) {
        const cur = svc.getSectionSync("writersRoom", {}) || {};
        svc.saveSection("writersRoom", { ...cur, activeAuthorId: id });
      }
    } catch (_e) {}
  }, []);

  // Escape exits focus mode (clear, discoverable exit affordance).
  _wrUE(() => {
    if (!focusMode) return;
    const onKey = (e) => { if (e.key === "Escape") setL((p) => ({ ...p, writingLayoutMode: "full" })); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, setL]);

  const handleEntityHover = _wrUC((e) => setHoverEntity(e), []);

  // Double-click an entity span in the manuscript → open/focus the entity
  // panel via the host. Falls back to the legacy single-click "open dossier"
  // flow if the host hasn't wired the prop yet (so nothing breaks in
  // isolation/specimen renders).
  const handleEntityDoubleClick = _wrUC((detail) => {
    if (!detail) return;
    if (onOpenEntityFromManuscript) {
      onOpenEntityFromManuscript(detail);
      return;
    }
    // Legacy fallback: at least open the matching panel by entity type.
    const FALLBACK_MAP = {
      cast: "cast", character: "cast",
      locations: "locations", location: "locations", atlas: "atlas",
      items: "items", item: "items",
      classes: "classes", races: "races", species: "races",
      stats: "stats", skills: "skillTrees", skilltrees: "skillTrees",
      abilities: "skillTrees", ability: "skillTrees",
      quests: "quests", quest: "quests",
      events: "events", event: "events",
      timeline: "timeline",
      bestiary: "bestiary", creature: "bestiary",
      factions: "lore", faction: "lore",
      lore: "lore", canon: "lore",
      references: "references", reference: "references",
      relationships: "relationships",
    };
    const kind = FALLBACK_MAP[detail.type] || detail.type;
    onOpenPanel && onOpenPanel(kind);
  }, [onOpenEntityFromManuscript, onOpenPanel]);

  // Delegated handlers for the editable body's atomic occurrence spans
  // (contenteditable=false). Double-click opens the entity; hover shows the
  // floating chip. Delegation survives innerHTML rewrites.
  const onEntityDoubleClickDelegated = _wrUC((e) => {
    const span = e.target && e.target.closest && e.target.closest("[data-entity-id]");
    if (!span) return;
    if (e.preventDefault) e.preventDefault();
    try { const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges(); } catch (_e) {}
    handleEntityDoubleClick({
      type: span.getAttribute("data-entity-type"),
      id: span.getAttribute("data-entity-id"),
      occurrenceId: span.getAttribute("data-occurrence-id") || null,
      label: span.textContent,
    });
  }, [handleEntityDoubleClick]);
  const onEntityHoverDelegated = _wrUC((e, leaving) => {
    if (leaving) { setHoverEntity(null); return; }
    const span = e.target && e.target.closest && e.target.closest("[data-entity-id]");
    if (!span) return;
    setHoverEntity({
      type: span.getAttribute("data-entity-type"),
      id: span.getAttribute("data-entity-id"),
      text: span.textContent,
      x: e.clientX, y: e.clientY,
    });
  }, []);

  // Context-aware adaptive wheel — the standard surface for AI + extraction.
  // Right-click (desktop) and long-press (touch) over the manuscript open the
  // wheel with selection / chapter / entity context so the right actions show.
  const openContextWheel = _wrUC((clientX, clientY, target) => {
    let selectionText = "";
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed && bodyRef.current && bodyRef.current.contains(sel.anchorNode)) {
        selectionText = String(sel.toString()).replace(/\s+/g, " ").trim();
      }
    } catch (_e) {}
    let entity = null;
    try {
      const span = target && target.closest && target.closest("[data-entity-id]");
      if (span) entity = { id: span.getAttribute("data-entity-id"), type: span.getAttribute("data-entity-type"), label: span.textContent };
    } catch (_e) {}
    const inBody = !!(bodyRef.current && target && bodyRef.current.contains(target));
    let context = null, contextLabel = "Manuscript";
    if (entity) { context = { kind: "entity", entityId: entity.id, entityType: entity.type, label: entity.label }; contextLabel = entity.label || "Entity"; }
    else if (selectionText) { window.__LW_WIZARD_SELECTION__ = { text: selectionText, chapterId: activeId }; context = { kind: "selection", selectionText, chapterId: activeId }; contextLabel = "Selection"; }
    else if (inBody && activeId) { context = { kind: "chapter", chapterId: activeId }; contextLabel = "Chapter"; }
    onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: clientX, y: clientY, contextLabel, context });
  }, [activeId, onOpenAdaptiveWheel]);

  const _wrLongPress = _wrUR({ timer: null, x: 0, y: 0, fired: false, t: 0, lastType: "mouse" });
  const wrContext = _wrUC((e) => {
    // Touch long-press inside editable text fires a synthetic contextmenu;
    // preventDefault there would kill the native selection handles. Let
    // the browser own it — the wheel is reachable from the selection
    // toolbar and outside the page.
    const isTouch = _wrLongPress.current.lastType !== "mouse";
    if (isTouch && e.target && e.target.closest && e.target.closest("[contenteditable='true']")) return;
    e.preventDefault();
    // Don't re-open on the synthetic contextmenu a long-press may emit.
    if (_wrLongPress.current.fired && (Date.now() - _wrLongPress.current.t) < 800) { _wrLongPress.current.fired = false; return; }
    openContextWheel(e.clientX, e.clientY, e.target);
  }, [openContextWheel]);
  const wrPointerDown = _wrUC((e) => {
    _wrLongPress.current.lastType = e.pointerType || "mouse";
    if (e.pointerType === "mouse") return; // right-click is handled by onContextMenu
    // Inside editable text, long-press belongs to NATIVE selection — a
    // wheel here would make highlighting impossible on a phone. Select
    // text and use the floating toolbar's Wheel button, or long-press
    // outside the page (margins / chapter strip) for the chapter wheel.
    if (e.target && e.target.closest && e.target.closest("[contenteditable='true']")) return;
    const lp = _wrLongPress.current;
    lp.x = e.clientX; lp.y = e.clientY; lp.fired = false;
    if (lp.timer) clearTimeout(lp.timer);
    const target = e.target;
    lp.timer = setTimeout(() => {
      lp.fired = true; lp.t = Date.now(); lp.timer = null;
      openContextWheel(lp.x, lp.y, target);
    }, 520);
  }, [openContextWheel]);
  const wrPointerMove = _wrUC((e) => {
    const lp = _wrLongPress.current;
    if (lp.timer && (Math.abs(e.clientX - lp.x) > 10 || Math.abs(e.clientY - lp.y) > 10)) { clearTimeout(lp.timer); lp.timer = null; }
  }, []);
  const wrPointerEnd = _wrUC(() => {
    const lp = _wrLongPress.current;
    if (lp.timer) { clearTimeout(lp.timer); lp.timer = null; }
  }, []);

  // Chapter extraction triggered from the adaptive wheel ("Extract chapter").
  _wrUE(() => {
    const onWheelExtract = (e) => { runExtractionFlow(!!(e && e.detail && e.detail.deep)); };
    window.addEventListener("lw:wr-extract-chapter", onWheelExtract);
    return () => window.removeEventListener("lw:wr-extract-chapter", onWheelExtract);
  }, [runExtractionFlow]);

  return (
    <div
      className="wr"
      data-ui="WritersRoomScreen"
      data-route="writers-room"
      data-focus={focusMode ? "true" : "false"}
      data-margins={marginsHidden ? "hidden" : "shown"}
      data-margins-left={leftMarginVisible ? "shown" : "collapsed"}
      data-margins-right={rightMarginVisible ? "shown" : "collapsed"}
      data-writing-layout={L.writingLayoutMode}
      data-attribution={attribution ? "true" : "false"}
      data-typewriter={typewriter ? "true" : "false"}
      data-mobile={isMobile ? "true" : "false"}
      data-drawer={mobileDrawer || "none"}
      onContextMenu={wrContext}
      onPointerDown={wrPointerDown}
      onPointerMove={wrPointerMove}
      onPointerUp={wrPointerEnd}
      onPointerCancel={wrPointerEnd}
      style={{
        "--wr-left-w":  (leftMarginVisible  ? L.leftMarginWidth  : 0) + "px",
        "--wr-right-w": (rightMarginVisible ? L.rightMarginWidth : 0) + "px",
      }}
    >
      {focusMode && (
        <button
          type="button"
          className="wr-focus-exit"
          data-ui="ExitFocusMode"
          data-testid="wr-exit-focus"
          onClick={onToggleFocusMode}
          title="Exit focus mode (Esc)"
          style={{
            position: "absolute", top: 12, right: 16, zIndex: 50,
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: "var(--r-2, 6px)",
            border: "1px solid var(--line-2, #ccc)", background: "var(--surface-1, #fff)",
            color: "var(--ink-1, #222)", cursor: "pointer", fontSize: 12,
          }}
        >
          <Icon name="close" size={12}/> Exit focus mode
        </button>
      )}
      <ChapterNodeStrip
        chapters={chapters}
        activeId={activeId}
        onSelectChapter={onSelectChapter}
        onCreateChapter={onCreateChapter}
        onReserveChapter={onReserveChapter}
        onOpenAdaptiveWheel={onOpenAdaptiveWheel}
      />

      <div className="wr-stage" style={{
        gridTemplateColumns: isMobile
          ? "minmax(0,1fr)"
          : (leftMarginVisible  ? L.leftMarginWidth  + "px" : "0") + " " +
            "minmax(0,1fr) " +
            (rightMarginVisible ? L.rightMarginWidth + "px" : "0"),
      }}>
        {isMobile && mobileDrawer && (
          <div className="wr-drawer-backdrop" data-ui="WrDrawerBackdrop" onClick={() => setMobileDrawer(null)}/>
        )}
        {showLeftMargin && <div className="wr-stage__col wr-stage__col--left">
          <LeftMargin
          notes={notes}
          authors={authorList}
          editingNoteId={editingNoteId}
          filter={noteFilter}
          setFilter={setNoteFilter}
          onAdd={onAddNote}
          onEdit={onEditNote}
          onSaveText={onSaveNoteText}
          onCancelEdit={onCancelEditNote}
          onResolve={onResolveNote}
          onDelete={onDeleteNote}
          onFocus={onFocusNoteParagraph}
          pinned={L.leftMarginPinned}
          onTogglePin={() => setL({ leftMarginPinned: !L.leftMarginPinned })}
          onCollapse={() => setL({ leftMarginCollapsed: true })}
        />
          <MarginResizer side="left" value={L.leftMarginWidth} min={LAYOUT_CONSTRAINTS.leftMarginMin} max={LAYOUT_CONSTRAINTS.leftMarginMax} onChange={(v) => setL({ leftMarginWidth: v })}/>
        </div>}
        {!isMobile && !leftMarginVisible && L.writingLayoutMode !== "clean" && L.writingLayoutMode !== "manuscript-focus" && (
          <MarginEdgeTab side="left" label="Notes" count={notes.filter((n) => n.status !== "resolved").length} onClick={() => setL({ leftMarginCollapsed: false })}/>
        )}

        <div className="wr-canvas-wrap"
          data-ent-drop="writer-room"
          onDragOver={(e) => {
            try {
              const types = e.dataTransfer.types;
              if (types && (Array.from(types).includes("application/x-loom-entity") ||
                            Array.from(types).includes("text/loomwright-entity"))) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            } catch (_err) {}
          }}
          onDrop={(e) => {
            e.preventDefault();
            let payload = null;
            try {
              const raw = e.dataTransfer.getData("application/x-loom-entity");
              if (raw) payload = JSON.parse(raw);
            } catch (_err) {}
            if (!payload) {
              try {
                const raw = e.dataTransfer.getData("text/loomwright-entity");
                if (raw) {
                  const legacy = JSON.parse(raw);
                  payload = { entityType: legacy.type, id: legacy.id, name: legacy.name };
                }
              } catch (_err) {}
            }
            if (payload && onDropEntityIntoComposition) onDropEntityIntoComposition(payload);
          }}
        >
          <ManuscriptToolbar
            spellcheck={spellcheck} grammar={grammar} voice={voice} style={styleS} revision={revision}
            attribution={attribution} focusMode={focusMode}
            onAction={onToolbarAction}
            onToggleSpellcheck={() => setSpellcheck((v) => !v)}
            onToggleGrammar={() => setGrammar((v) => !v)}
            onToggleStyle={() => setStyleS((v) => !v)}
            onToggleVoice={() => setVoice((v) => !v)}
            onToggleRevision={() => setRevision((v) => !v)}
            onToggleAttribution={() => setAttribution((v) => !v)}
            onToggleFocusMode={onToggleFocusMode}
          />

          {findOpen && (
            <FindReplaceBar
              query={findQuery} replace={findReplace} count={findCount} caseSensitive={findCase}
              onQuery={(v) => { setFindQuery(v); runFind(v, { caseSensitive: findCase }); }}
              onReplace={setFindReplace}
              onToggleCase={() => { const nc = !findCase; setFindCase(nc); runFind(findQuery, { caseSensitive: nc }); }}
              onNext={() => gotoMatch(1)} onPrev={() => gotoMatch(-1)}
              onReplaceOne={replaceOne} onReplaceAll={replaceAllFind}
              onClose={closeFind}
            />
          )}

          <div className="wr-canvasbar">
            <div className="wr-canvasbar__crumb">
              <span>{BRAND.project.name}</span>
              <span className="wr-canvasbar__crumb__sep">/</span>
              <span>{BRAND.project.book}</span>
              <span className="wr-canvasbar__crumb__sep">/</span>
              <span>Chapter {activeChapter?.num || "—"}</span>
            </div>
            <div className="wr-canvasbar__chips">
              {isMobile && (
                <>
                  <Btn variant={mobileDrawer === "left" ? "primary" : "outline"} size="sm" icon="bell"
                    data-testid="wr-mobile-notes"
                    onClick={() => setMobileDrawer((d) => d === "left" ? null : "left")}
                    title="Notes & comments">
                    Notes
                  </Btn>
                  <Btn variant={mobileDrawer === "right" ? "primary" : "outline"} size="sm" icon="sparkle"
                    data-testid="wr-mobile-reviews"
                    onClick={() => setMobileDrawer((d) => d === "right" ? null : "right")}
                    title="Extractions & reviews">
                    Reviews
                  </Btn>
                </>
              )}
              <AuthorSelector authors={authorList} activeId={activeAuthorId} onSelectAuthor={onSelectAuthor}/>
              <Btn variant={compositionOverlayOpen ? "primary" : "outline"} size="sm" icon="sparkle"
                onClick={onOpenCompositionOverlay}
                data-callback="onOpenEntityCompositionOverlay"
                title="Drag entities here to compose a scene with AI">
                Compose
              </Btn>
              <Btn variant="ghost" size="sm" icon="plus"
                onClick={() => onOpenEntityEditor && onOpenEntityEditor({ type: "locations" })}
                data-callback="onCreateEntity"
                title="Create a new entity from scratch">
                New entity
              </Btn>
              <WritingLayoutMenu value={L.writingLayoutMode} onChange={(v) => setL({ writingLayoutMode: v })}/>
              <WorkspaceLayoutMenu value={L.workspaceLayoutPreset} onChange={(presetId, panelKinds) => {
                setL({ workspaceLayoutPreset: presetId === "clear" ? "writing-only" : presetId });
                if (onApplyWorkspacePreset) onApplyWorkspacePreset(presetId, panelKinds);
              }}/>
              <Btn variant="ghost" size="sm" icon="chevron-up" data-testid="wr-move-up" onClick={() => onMoveChapter("up")} title="Move chapter earlier" disabled={!activeChapter || activeChapter.num <= 1}/>
              <Btn variant="ghost" size="sm" icon="chevron-d" data-testid="wr-move-down" onClick={() => onMoveChapter("down")} title="Move chapter later" disabled={!activeChapter || activeChapter.num >= chapters.length}/>
              <Btn variant="ghost" size="sm" icon="trash" onClick={onDeleteChapterRequest} data-callback="onDeleteChapterRequest" title="Delete chapter"/>
              <Btn variant="primary" size="sm" icon="sparkle"
                data-testid="wr-extract-chapter"
                data-callback="onRunChapterExtraction"
                onClick={onSaveAndExtract}
                disabled={!activeChapter || extractionState === "running"}
                title="Save this chapter and scan it for characters, places, items, and events — results land in the review queue.">
                {extractionState === "running" ? "Extracting…" : "Extract"}
              </Btn>
              <SaveModeControls
                onSave={onSave}
                syncing={canvasState === "saving" || extractionState === "running"}
              />
            </div>
          </div>

          <ManuscriptCanvas
            chapter={activeChapter}
            manuscript={activeManuscript}
            state={canvasState}
            bodyRef={bodyRef}
            titleRef={titleRef}
            bodyEpoch={bodyEpoch}
            spellCheck={spellcheck}
            onBodyInput={onManuscriptChange}
            onStartWriting={onStartWriting}
            onEntityHoverDelegated={onEntityHoverDelegated}
            onEntityDoubleClickDelegated={onEntityDoubleClickDelegated}
            onCreateChapter={onCreateChapter}
            onSaveAndExtract={onSaveAndExtract}
          />

          {activeChapter && !activeChapter.reserved && (
            <div className="wr-ai-row" data-ui="AIWriterEntries">
              <span className="wr-ai-row__lbl">AI Writer</span>
              <Btn variant="outline" size="sm" icon="sparkle" data-callback="onAIRevise">Revise passage</Btn>
              <Btn variant="outline" size="sm" icon="feather" data-callback="onAIContinue">Continue writing</Btn>
              <Btn variant="outline" size="sm" icon="book"    data-callback="onAIWriteChapter">Write chapter</Btn>
              <Btn variant="outline" size="sm" icon="paper"   data-callback="onAIWriteParagraphs">Write paragraphs</Btn>
              <Btn variant="ghost"   size="sm" icon="plus"    data-callback="onAIAddIn">Write add-in</Btn>
            </div>
          )}

          {/* Floating selection toolbar (demo: shown above an example paragraph) */}
          {selToolbar.visible && !focusMode && activeChapter && !activeChapter.reserved && (
            <div style={{ position: "relative" }}>
              <FloatingSelectionToolbar
                x={selToolbar.x}
                y={selToolbar.y}
                onAction={onToolbarAction}
                onCreateEntityFromSelection={onCreateEntityFromSelection}
                onLinkEntity={onLinkEntity}
                onExtractSelection={onExtractSelection}
              />
            </div>
          )}
        </div>

        {!isMobile && !rightMarginVisible && L.writingLayoutMode !== "clean" && L.writingLayoutMode !== "manuscript-focus" && (
          <MarginEdgeTab side="right" label="Reviews" count={extractions.length} onClick={() => setL({ rightMarginCollapsed: false })}/>
        )}
        {showRightMargin && <div className="wr-stage__col wr-stage__col--right">
          <MarginResizer side="right" value={L.rightMarginWidth} min={LAYOUT_CONSTRAINTS.rightMarginMin} max={LAYOUT_CONSTRAINTS.rightMarginMax} onChange={(v) => setL({ rightMarginWidth: v })}/>
          <CurrentChapterContext
            chapterId={activeId}
            onOpenEntity={(e) => handleEntityDoubleClick({ type: e.type, id: e.id, label: e.name })}
            onOpenPanel={onOpenPanel}
            onOpenReviewQueue={onOpenReviewQueue}
          />
          <RightMargin
          extractions={extractions}
          selectedId={selectedExtId}
          filter={extFilter}
          setFilter={setExtFilter}
          extractionState={extractionState}
          onAcceptQueueItem={onAcceptQueueItem}
          onEditQueueItem={onEditQueueItem}
          onMergeQueueItem={onMergeQueueItem}
          onDenyQueueItem={onDenyQueueItem}
          onOpenFullReview={onOpenFullReview}
          onOpenReviewQueue={onOpenReviewQueue}
          pinned={L.rightMarginPinned}
          onTogglePin={() => setL({ rightMarginPinned: !L.rightMarginPinned })}
          onCollapse={() => setL({ rightMarginCollapsed: true })}
        />
        </div>}
      </div>

      {hoverEntity && (
        <FloatingEntityChip
          entity={hoverEntity}
          x={hoverEntity.x}
          y={hoverEntity.y}
          onOpenEntity={onOpenEntity}
          onShowMentions={onShowMentions}
          onOpenAdaptiveWheel={onOpenAdaptiveWheel}
        />
      )}

      <ChapterDeleteConfirmModal
        open={!!deletingChapter}
        chapter={deletingChapter}
        onCancel={() => setDeletingChapter(null)}
        onConfirm={onConfirmDeleteChapter}
      />

      {progressOpen && !progressFailed && (
        <ExtractionProgressModal
          open={progressOpen}
          mode={progressMode}
          chapterLabel={"Ch. " + (activeChapter?.num || "—") + " — " + (activeChapter?.title || "Untitled")}
          onCancelExtraction={onCancelExtraction}
          onContinueExtractionInBackground={onCloseProgress}
          onOpenExtractionSession={onOpenSessionDrawer}
          onClose={onCloseProgress}
          onOpenReview={() => { onCloseProgress(); onOpenReviewQueue && onOpenReviewQueue(); }}
        />
      )}
      {progressOpen && progressFailed && (
        <ExtractionFailedState
          open={progressOpen}
          message="The local model couldn't reach the manuscript index."
          onRetry={onRetryExtraction}
          onClose={onCancelExtraction}
        />
      )}

      <ExtractionSessionDrawer
        open={sessionDrawerOpen}
        session={activeSession}
        onClose={onCloseSessionDrawer}
        onOpenReviewQueue={onOpenReviewQueue}
      />

      {/* Edit / Merge / Deny are handled by the global modals in app.jsx
          (shared with the Review Queue); the margin dispatches the same
          registry callbacks, so behaviour is identical everywhere. */}
    </div>
  );
};

Object.assign(window, {
  WritersRoomScreen,
  ChapterNodeStrip, ChapterNode,
  ManuscriptToolbar, ManuscriptCanvas, ManuscriptParagraph,
  EntityBrushHighlight, FloatingEntityChip, FloatingSelectionToolbar,
  LeftMargin, RightMargin, MarginNoteCard, MarginExtractionCard,
  SaveModeControls, AuthorSelector, ChapterDeleteConfirmModal,
  WR_DEMO_PROJECT: {
    authors: WR_AUTHORS,
    chapters: WR_CHAPTERS,
    manuscripts: { c7: WR_MANUSCRIPT },
    notes: WR_NOTES,
    extractions: WR_EXTRACTIONS,
  },
});
