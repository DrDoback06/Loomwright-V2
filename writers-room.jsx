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
  const TB = ({ icon, label, active, onClick, children, className = "" }) => (
    <button
      type="button"
      className={"wr-toolbar__btn " + className + (active ? " is-active" : "")}
      title={label}
      aria-label={label}
      onClick={onClick}
    >{icon ? <Icon name={icon} size={13}/> : children}</button>
  );

  return (
    <div className="wr-toolbar" data-ui="ManuscriptToolbar" role="toolbar" aria-label="Manuscript formatting">
      <div className="wr-toolbar__group">
        <TB label="Bold (⌘B)"           className="wr-toolbar__btn--text"      onClick={() => onAction("bold")}><b>B</b></TB>
        <TB label="Italic (⌘I)"         className="wr-toolbar__btn--text wr-toolbar__btn--italic" onClick={() => onAction("italic")}><i>I</i></TB>
        <TB label="Underline (⌘U)"      className="wr-toolbar__btn--text wr-toolbar__btn--underline" onClick={() => onAction("underline")}>U</TB>
        <TB label="Strikethrough"       className="wr-toolbar__btn--text wr-toolbar__btn--strike" onClick={() => onAction("strike")}>S</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Heading"             className="wr-toolbar__btn--text" onClick={() => onAction("heading")}>H</TB>
        <TB label="Scene break"         icon="bars" onClick={() => onAction("scene-break")}/>
        <TB label="Quote"               className="wr-toolbar__btn--text" onClick={() => onAction("quote")}>"</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Inline note"         icon="paper" onClick={() => onAction("inline-note")}/>
        <TB label="Comment"             icon="bell" onClick={() => onAction("comment")}/>
        <TB label="Highlight"           icon="drop" onClick={() => onAction("highlight")}/>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Link to entity"      icon="link" onClick={() => onAction("link-entity")}/>
        <TB label="Create entity from selection" icon="plus" onClick={() => onAction("create-entity")}/>
        <TB label="Insert reference"    icon="bookmark" onClick={() => onAction("insert-ref")}/>
        <TB label="Insert footnote"     icon="paper" onClick={() => onAction("footnote")}/>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Find / replace (⌘F)" icon="search" onClick={() => onAction("find")}/>
        <TB label="Spellcheck"   active={spellcheck} className="wr-toolbar__btn--small" onClick={onToggleSpellcheck}>SP</TB>
        <TB label="Grammar"      active={grammar}    className="wr-toolbar__btn--small" onClick={onToggleGrammar}>GR</TB>
        <TB label="Style"        active={style}      className="wr-toolbar__btn--small" onClick={onToggleStyle}>ST</TB>
        <TB label="Voice consistency" active={voice} className="wr-toolbar__btn--small" onClick={onToggleVoice}>VO</TB>
      </div>
      <div className="wr-toolbar__group">
        <TB label="Thesaurus"           icon="book" onClick={() => onAction("thesaurus")}/>
        <TB label="Revision mode"       active={revision}    className="wr-toolbar__btn--small" onClick={onToggleRevision}>REV</TB>
        <TB label="Author attribution"  active={attribution} className="wr-toolbar__btn--small" onClick={onToggleAttribution}>AUT</TB>
        <TB label="Focus mode"          active={focusMode}   icon="eye" onClick={onToggleFocusMode}/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SaveModeControls
// ---------------------------------------------------------------------
const SaveModeControls = ({ onSave, onSaveAndExtract, onSaveAndDeepExtract, syncing }) => {
  return (
    <div className="wr-save" data-ui="SaveModeControls" role="group" aria-label="Save controls">
      <button
        className="wr-save__btn"
        data-callback="onSave"
        data-testid="wr-save"
        onClick={onSave}
        title="Saves manuscript text and author edits only."
        disabled={syncing}
      ><Icon name="check" size={12}/>Save</button>
      <button
        className="wr-save__btn"
        data-callback="onSaveAndExtract"
        data-testid="wr-save-extract"
        onClick={onSaveAndExtract}
        title="Saves and runs a quick entity sweep."
        disabled={syncing}
      ><Icon name="sparkle" size={12}/>+ Extract</button>
      <button
        className="wr-save__btn"
        data-callback="onSaveAndDeepExtract"
        data-testid="wr-save-deep"
        onClick={onSaveAndDeepExtract}
        title="Saves and runs the deepest available scan."
        disabled={syncing}
      ><Icon name="bolt" size={12}/>+ Deep</button>
    </div>
  );
};

// ---------------------------------------------------------------------
// AuthorSelector
// ---------------------------------------------------------------------
const AuthorSelector = ({ authors, activeId, onSelectAuthor }) => {
  const a = authors.find((x) => x.id === activeId) || authors[0];
  return (
    <button
      className="wr-author-sel"
      data-ui="AuthorSelector"
      data-callback="onSelectAuthor"
      data-testid="wr-author-selector"
      onClick={() => {
        const i = authors.findIndex((x) => x.id === activeId);
        const next = authors[(i + 1) % authors.length];
        onSelectAuthor && onSelectAuthor(next.id);
      }}
      title="Switch active author"
    >
      <span className="wr-author-sel__chip" style={{ "--ac": a.color }}>{a.initials}</span>
      <span>{a.name}</span>
      <Icon name="chevron-d" size={11}/>
    </button>
  );
};

// ---------------------------------------------------------------------
// FloatingSelectionToolbar
// ---------------------------------------------------------------------
const FloatingSelectionToolbar = ({ x, y, onAction, onCreateEntityFromSelection, onLinkEntity }) => {
  return (
    <div className="wr-fst" style={{ left: x, top: y }} data-ui="FloatingSelectionToolbar">
      <button className="wr-fst__btn" title="Bold" onClick={() => onAction("bold")}><b>B</b></button>
      <button className="wr-fst__btn" title="Italic" onClick={() => onAction("italic")}><i>I</i></button>
      <button className="wr-fst__btn" title="Underline" onClick={() => onAction("underline")}>U</button>
      <span className="wr-fst__sep"/>
      <button className="wr-fst__btn" title="Highlight" onClick={() => onAction("highlight")}><Icon name="drop" size={13}/></button>
      <button className="wr-fst__btn" title="Comment" onClick={() => onAction("comment")}><Icon name="bell" size={13}/></button>
      <span className="wr-fst__sep"/>
      <button className="wr-fst__btn" data-callback="onLinkEntity" title="Link to entity" onClick={onLinkEntity}><Icon name="link" size={13}/></button>
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
      <div className="wr-chip__sub">{t?.label} · 7 mentions across 4 chapters</div>
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
const MarginNoteCard = ({ note, authors, onResolve, onEdit, onDelete }) => {
  const a = authors.find((x) => x.id === note.authorId);
  const [collapsed, setCollapsed] = _wrUS(!!note.collapsed);
  return (
    <div className={"wr-note " + (note.resolved ? "is-resolved " : "")} data-ui="MarginNoteCard" style={{ "--ac": a?.color }}>
      <div className="wr-note__head">
        <span className="wr-note__author">
          <span className="wr-note__author-dot"/>{a?.name || "Unknown"}
        </span>
        <span className="wr-note__type">{note.type}</span>
        <span className="wr-note__time">{note.ts}</span>
      </div>
      {note.anchor && <span className="wr-note__anchor">↳ {note.anchor}</span>}
      <div className={"wr-note__body " + (collapsed ? "wr-note__body--collapsed" : "")}>{note.body}</div>
      <div className="wr-note__actions">
        <Btn variant="ghost" size="sm" icon={collapsed ? "chevron-d" : "chevron-up"} onClick={() => setCollapsed((v) => !v)}>{collapsed ? "Expand" : "Collapse"}</Btn>
        {!note.resolved && <Btn variant="ghost" size="sm" icon="check" onClick={() => onResolve && onResolve(note.id)}>Resolve</Btn>}
        <Btn variant="ghost" size="sm" icon="more" onClick={() => onEdit && onEdit(note.id)}>Edit</Btn>
        <Btn variant="ghost" size="sm" icon="trash" onClick={() => onDelete && onDelete(note.id)}/>
      </div>
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
const LeftMargin = ({ notes, authors, onResolve, onEdit, onDelete, onCreate, filter, setFilter, pinned, onTogglePin, onCollapse }) => {
  const visible = notes.filter((n) => {
    if (filter === "open") return !n.resolved;
    if (filter === "resolved") return n.resolved;
    if (filter === "mine") return n.authorId === "em";
    return true;
  });
  return (
    <aside className="wr-margin" data-side="left" data-ui="LeftMargin" aria-label="Author notes & comments">
      <div className="wr-margin__head">
        <span className="wr-margin__head-title">Notes &amp; Comments</span>
        <span className="wr-margin__head-count">{visible.length}</span>
        <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreate" onClick={onCreate} title="Add note"/>
        <button className={"wr-margin__head__pin " + (pinned ? "is-active" : "")} onClick={onTogglePin} data-callback="onTogglePin" title={pinned ? "Unpin margin" : "Pin margin"}><Icon name="pin-tack" size={11}/></button>
        <button className="wr-margin__head__collapse" onClick={onCollapse} data-callback="onCollapseMargin" title="Collapse to tab"><Icon name="chevron-r" size={11}/></button>
      </div>
      <div className="wr-margin__filters">
        {[["all", "All"], ["open", "Open"], ["resolved", "Resolved"], ["mine", "Mine"]].map(([k, l]) => (
          <button
            key={k}
            className={"wr-margin__filter " + (filter === k ? "is-active" : "")}
            onClick={() => setFilter(k)}
          >{l}</button>
        ))}
      </div>
      <div className="wr-margin__list">
        {visible.length === 0 ? (
          <EmptyState icon="paper" title="No notes here" body="Highlight a passage and choose Inline Note to drop one."/>
        ) : visible.map((n) => (
          <MarginNoteCard
            key={n.id} note={n} authors={authors}
            onResolve={onResolve} onEdit={onEdit} onDelete={onDelete}
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

const EditableManuscriptBody = ({ bodyRef, chapterId, bodyEpoch, html, onInput, onDoubleClick, onMouseOver, onMouseOut }) => {
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
const ManuscriptCanvas = ({
  chapter, manuscript, state, bodyRef, titleRef, bodyEpoch,
  onBodyInput, onStartWriting,
  onEntityHoverDelegated, onEntityDoubleClickDelegated,
  onCreateChapter, onSaveAndExtract,
}) => {
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
    <article className="wr-canvas" data-ui="ManuscriptCanvas" data-state={state} data-chapter-id={chapter.id}>
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
      </header>
      <div className="wr-canvas__bodywrap" style={{ position: "relative" }}>
        <EditableManuscriptBody
          bodyRef={bodyRef}
          chapterId={chapter.id}
          bodyEpoch={bodyEpoch}
          html={bodyHtml}
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

  // Authors
  const [activeAuthorId, setActiveAuthorId] = _wrUS("em");

  // Toolbar toggles
  const [spellcheck, setSpellcheck] = _wrUS(true);
  const [grammar, setGrammar] = _wrUS(true);
  const [voice, setVoice] = _wrUS(false);
  const [styleS, setStyleS] = _wrUS(false);
  const [revision, setRevision] = _wrUS(false);
  const [attribution, setAttribution] = _wrUS(true);
  // Derive focus/margins from layout mode
  const focusMode = L.writingLayoutMode === "clean";
  const marginsHidden = L.writingLayoutMode === "clean" || L.writingLayoutMode === "manuscript-focus";
  const leftMarginVisible  = !L.leftMarginCollapsed  && (L.writingLayoutMode === "full" || L.writingLayoutMode === "notes");
  const rightMarginVisible = !L.rightMarginCollapsed && (L.writingLayoutMode === "full" || L.writingLayoutMode === "review");
  const [typewriter, setTypewriter] = _wrUS(false);

  // Margins state
  const [noteFilter, setNoteFilter] = _wrUS("open");
  const [extFilter, setExtFilter] = _wrUS("all");
  const [notes, setNotes] = _wrUS([]);
  const loadReviewExtractions = () => {
    const items = window.LoomwrightBackend?.ReviewService?.listSync() || [];
    return items.filter((i) => i.status === "pending").map((i) => ({
      id: i.id,
      type: i.entityType,
      name: i.name,
      quote: i.reason || "",
      conf: i.level || "med",
      pct: i.value || 70,
      summary: i.reason,
    }));
  };
  const [extractions, setExtractions] = _wrUS(() => loadReviewExtractions());
  const [selectedExtId, setSelectedExtId] = _wrUS("x5");

  const persistChapters = _wrUC((nextChapters, nextManuscripts, nextActiveId, nextNotes, nextExtractions) => {
    const svc = window.LoomwrightBackend?.ManuscriptChapterService;
    if (!svc) return;
    svc.save({
      chapters: nextChapters ?? chapters,
      activeChapterId: nextActiveId ?? activeId,
      manuscripts: nextManuscripts ?? manuscriptsByChapter,
      notes: { default: nextNotes ?? notes },
      extractions: { default: nextExtractions ?? extractions },
      authors: WR_AUTHORS,
    });
  }, [activeId, chapters, manuscriptsByChapter, notes, extractions]);

  _wrUE(() => {
    const onReady = () => {
      const s = loadStored();
      if (s?.chapters?.length) {
        setChapters(s.chapters);
        setActiveId(s.activeChapterId || s.chapters[0]?.id);
        setManuscriptsByChapter(s.manuscripts || {});
        if (s.notes?.default) setNotes(s.notes.default);
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

  // Extraction modal flow
  const [progressOpen, setProgressOpen] = _wrUS(false);
  const [progressStage, setProgressStage] = _wrUS(0);
  const [progressMode, setProgressMode] = _wrUS("quick"); // quick | deep
  const [progressFailed, setProgressFailed] = _wrUS(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = _wrUS(false);
  const [activeSession, setActiveSession] = _wrUS(null);

  // Review modals
  const [mergeItem, setMergeItem] = _wrUS(null);
  const [editItem, setEditItem] = _wrUS(null);
  const [denyItem, setDenyItem] = _wrUS(null);

  // Walk progress stages
  _wrUE(() => {
    if (!progressOpen || progressFailed) return;
    if (progressStage >= EXTRACTION_STAGES.length - 1) return;
    const t = setTimeout(() => setProgressStage((s) => s + 1), progressMode === "deep" ? 700 : 380);
    return () => clearTimeout(t);
  }, [progressOpen, progressStage, progressFailed, progressMode]);

  // Floating UI
  const [hoverEntity, setHoverEntity] = _wrUS(null);
  const [selToolbar, setSelToolbar] = _wrUS({ x: 380, y: 220, visible: true }); // demo: visible by default

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
    setProgressMode(deep ? "deep" : "quick"); setProgressStage(0); setProgressFailed(false); setProgressOpen(true);
    onSetSyncState && onSetSyncState("syncing");
    // Paragraph offset map so each occurrence can be attributed to a paragraph id.
    const offsets = []; let cursor = 0;
    (snap.paragraphs || []).forEach((p) => {
      if (p.sceneBreak) return;
      const t = p.text || "";
      offsets.push({ id: p.id, start: cursor, end: cursor + t.length });
      cursor += t.length + 2;
    });
    try {
      await window.LoomwrightBackend?.ExtractionService?.runExtraction({ chapterId: activeId, text: snap.text, deep, paragraphs: offsets });
    } catch (_e) {
      setProgressFailed(true);
    }
    setExtractions(loadReviewExtractions());
    setChapters((curr) => curr.map((c) => c.id === activeId ? { ...c, state: "extracted" } : c));
    // Ensure the canvas re-pulls occurrences, then force a one-time body
    // re-highlight from the freshly-saved content (safe: just saved).
    try { window.dispatchEvent(new CustomEvent("lw:entity-store-updated")); } catch (_e) {}
    setBodyEpoch((v) => v + 1);
    onSetSyncState && onSetSyncState("saved");
  }, [activeId, chapters, manuscriptsByChapter, persistChapters, onSetSyncState]);
  const onSaveAndExtract = _wrUC(() => runExtractionFlow(false), [runExtractionFlow]);
  const onSaveAndDeepExtract = _wrUC(() => runExtractionFlow(true), [runExtractionFlow]);
  const onCloseProgress = _wrUC(() => {
    setProgressOpen(false);
    setExtractionState("complete");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState]);
  const onCancelExtraction = _wrUC(() => {
    setProgressOpen(false);
    setExtractionState("idle");
    onSetSyncState && onSetSyncState("saved");
  }, [onSetSyncState]);
  const onRetryExtraction = _wrUC(() => { setProgressFailed(false); setProgressStage(0); }, []);
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
  const onCreateEntityFromSelection = _wrUC(() => onOpenPanel && onOpenPanel("demo"), [onOpenPanel]);
  const onLinkEntity = _wrUC(() => onOpenPanel && onOpenPanel("recent"), [onOpenPanel]);
  const onOpenEntity = _wrUC(() => onOpenPanel && onOpenPanel("demo"), [onOpenPanel]);
  const onShowMentions = _wrUC(() => {}, []);
  const onAcceptQueueItem = _wrUC(async (idOrItem) => {
    const id = typeof idOrItem === "string" ? idOrItem : idOrItem?.id;
    if (window.LoomwrightDispatchCallback) await window.LoomwrightDispatchCallback("onAcceptQueueItem", { detail: { id } });
    setExtractions((curr) => curr.filter((x) => x.id !== id));
  }, []);
  const onEditQueueItem = _wrUC((item) => {
    // accept margin-card shape too
    const normalized = item?.candidate ? item : {
      id: item?.id, entityType: item?.type, mention: item?.quote, sourceChapter: { num: 7 },
      candidate: { name: item?.name, summary: item?.summary, aliases: [] },
      confidence: { band: item?.conf, value: item?.pct }, status: "pending",
    };
    setEditItem(normalized);
  }, []);
  const onMergeQueueItem = _wrUC((item) => {
    const normalized = item?.candidate ? item : {
      id: item?.id, entityType: item?.type, mention: item?.quote, sourceChapter: { num: 7 },
      candidate: { name: item?.name, summary: item?.summary, aliases: [] },
      confidence: { band: item?.conf, value: item?.pct }, status: "pending",
      conflict: item?.merge ? { kind: "alias", note: "Possibly the same as 'the Vraska' from Ch. 2." } : null,
    };
    setMergeItem(normalized);
  }, []);
  const onDenyQueueItem = _wrUC((item) => {
    const normalized = item?.candidate ? item : {
      id: item?.id, entityType: item?.type, mention: item?.quote,
      candidate: { name: item?.name }, confidence: { band: item?.conf, value: item?.pct },
    };
    setDenyItem(normalized);
  }, []);
  const onConfirmDeny = _wrUC(() => {
    if (denyItem) setExtractions((curr) => curr.filter((x) => x.id !== denyItem.id));
    setDenyItem(null);
  }, [denyItem]);
  const onOpenFullReview = _wrUC(() => onOpenReviewQueue && onOpenReviewQueue(), [onOpenReviewQueue]);
  const onResolveNote = _wrUC((id) => setNotes((curr) => curr.map((n) => n.id === id ? { ...n, resolved: true } : n)), []);

  const onToolbarAction = _wrUC((action) => {
    if (action === "create-entity") onCreateEntityFromSelection();
    if (action === "link-entity")   onLinkEntity();
  }, [onCreateEntityFromSelection, onLinkEntity]);

  const onToggleFocusMode  = _wrUC(() => setL((p) => ({ ...p, writingLayoutMode: p.writingLayoutMode === "clean" ? "full" : "clean" })), [setL]);
  const onSelectAuthor     = _wrUC((id) => setActiveAuthorId(id), []);

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

  // Optional context menu / long-press for chapter strip handled inside ChapterNode.
  const wrContext = (e) => {
    e.preventDefault();
    onOpenAdaptiveWheel && onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: "Manuscript" });
  };

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
      onContextMenu={wrContext}
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
        gridTemplateColumns:
          (leftMarginVisible  ? L.leftMarginWidth  + "px" : "0") + " " +
          "minmax(0,1fr) " +
          (rightMarginVisible ? L.rightMarginWidth + "px" : "0"),
      }}>
        {leftMarginVisible && <div className="wr-stage__col wr-stage__col--left">
          <LeftMargin
          notes={notes}
          authors={WR_AUTHORS}
          filter={noteFilter}
          setFilter={setNoteFilter}
          onResolve={onResolveNote}
          onEdit={() => {}}
          onDelete={(id) => setNotes((curr) => curr.filter((n) => n.id !== id))}
          onCreate={() => {}}
          pinned={L.leftMarginPinned}
          onTogglePin={() => setL({ leftMarginPinned: !L.leftMarginPinned })}
          onCollapse={() => setL({ leftMarginCollapsed: true })}
        />
          <MarginResizer side="left" value={L.leftMarginWidth} min={LAYOUT_CONSTRAINTS.leftMarginMin} max={LAYOUT_CONSTRAINTS.leftMarginMax} onChange={(v) => setL({ leftMarginWidth: v })}/>
        </div>}
        {!leftMarginVisible && L.writingLayoutMode !== "clean" && L.writingLayoutMode !== "manuscript-focus" && (
          <MarginEdgeTab side="left" label="Notes" count={notes.filter((n) => !n.resolved).length} onClick={() => setL({ leftMarginCollapsed: false })}/>
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

          <div className="wr-canvasbar">
            <div className="wr-canvasbar__crumb">
              <span>{BRAND.project.name}</span>
              <span className="wr-canvasbar__crumb__sep">/</span>
              <span>{BRAND.project.book}</span>
              <span className="wr-canvasbar__crumb__sep">/</span>
              <span>Chapter {activeChapter?.num || "—"}</span>
            </div>
            <div className="wr-canvasbar__chips">
              <AuthorSelector authors={WR_AUTHORS} activeId={activeAuthorId} onSelectAuthor={onSelectAuthor}/>
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
              <SaveModeControls
                onSave={onSave}
                onSaveAndExtract={onSaveAndExtract}
                onSaveAndDeepExtract={onSaveAndDeepExtract}
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

          <div className="wr-mobile-note">📱 On mobile: margins collapse to bottom sheets. Adaptive wheel via long-press.</div>

          {/* Floating selection toolbar (demo: shown above an example paragraph) */}
          {selToolbar.visible && !focusMode && activeChapter && !activeChapter.reserved && (
            <div style={{ position: "relative" }}>
              <FloatingSelectionToolbar
                x={selToolbar.x}
                y={selToolbar.y}
                onAction={onToolbarAction}
                onCreateEntityFromSelection={onCreateEntityFromSelection}
                onLinkEntity={onLinkEntity}
              />
            </div>
          )}
        </div>

        {!rightMarginVisible && L.writingLayoutMode !== "clean" && L.writingLayoutMode !== "manuscript-focus" && (
          <MarginEdgeTab side="right" label="Reviews" count={extractions.length} onClick={() => setL({ rightMarginCollapsed: false })}/>
        )}
        {rightMarginVisible && <div className="wr-stage__col wr-stage__col--right">
          <MarginResizer side="right" value={L.rightMarginWidth} min={LAYOUT_CONSTRAINTS.rightMarginMin} max={LAYOUT_CONSTRAINTS.rightMarginMax} onChange={(v) => setL({ rightMarginWidth: v })}/>
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
          stages={EXTRACTION_STAGES}
          currentStage={progressStage}
          chapterLabel={"Ch. " + (activeChapter?.num || "—") + " — " + (activeChapter?.title || "Untitled")}
          onCancel={onCancelExtraction}
          onClose={onCloseProgress}
          onOpenReviewQueue={onOpenReviewQueue}
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

      <MergeCandidateModal
        open={!!mergeItem}
        candidate={mergeItem}
        alternatives={mergeItem ? [
          { id: "alt1", name: "the Vraska", confidence: 84, summary: "Mountain pass, Bk I Ch. 4.", aliases: ["Vraska"] },
          { id: "alt2", name: "Vraska Hold", confidence: 41, summary: "Fortress in Bk I.", aliases: ["the Hold"] },
        ] : []}
        onConfirmMerge={() => { if (mergeItem) setExtractions((c) => c.filter((x) => x.id !== mergeItem.id)); setMergeItem(null); }}
        onCreateNewInstead={() => { if (mergeItem) setExtractions((c) => c.filter((x) => x.id !== mergeItem.id)); setMergeItem(null); }}
        onCancel={() => setMergeItem(null)}
      />
      <EditCandidateModal
        open={!!editItem}
        candidate={editItem}
        targetTabs={Object.values(ENTITY_TYPES).map((t) => ({ id: t.id, label: t.label }))}
        onSave={() => setEditItem(null)}
        onAcceptEdited={() => { if (editItem) setExtractions((c) => c.filter((x) => x.id !== editItem.id)); setEditItem(null); }}
        onCancel={() => setEditItem(null)}
      />
      <DenyConfirmation
        open={!!denyItem}
        candidate={denyItem}
        onConfirm={onConfirmDeny}
        onCancel={() => setDenyItem(null)}
      />
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
