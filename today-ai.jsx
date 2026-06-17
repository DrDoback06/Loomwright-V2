// =====================================================================
// today-ai.jsx — Today dashboard panel + AI Writer panel
//
// Today: a side-panel dashboard of suggestions (writing prompts,
// dangling threads, characters not seen, etc.) with filter chips.
// AI Writer: tabbed modes (Revise / Continue / Write Chapter / etc.)
// with bespoke layouts per mode. Generation is provider-gated and
// routed through the callback registry; previews render the live
// completion (or the configure-provider notice path).
// =====================================================================

const { useState: _td_us, useMemo: _td_um, useCallback: _td_uc, useEffect: _td_ue } = React;

// Build Today suggestions from the LIVE project store. Returns [] for a
// fresh/empty project (the UI then shows an empty state) — never the
// static demo prompts. Sections: prompts / quests / threads / untouched.
function buildTodaySuggestions() {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  if (!B?.EntityService) return [];
  const out = [];
  const push = (o) => out.push({ confidence: "strong", related: [], chapter: "—", action: "Open", ...o });

  // Quests with unfinished steps.
  for (const q of B.EntityService.listSync("quests")) {
    const steps = (q.data?.steps || []);
    const open = steps.filter((s) => s && s.status !== "done" && s.status !== "complete");
    if (steps.length && open.length) {
      push({ id: "td-q-" + q.id, section: "quests", title: `${q.name}: ${open.length} step(s) open`,
        why: `${steps.length - open.length}/${steps.length} steps done.`,
        related: [{ id: q.id, type: "quests", label: q.name }], action: "Open in Quests panel" });
    }
  }
  // Pending review items → things needing attention.
  const pending = (B.ReviewService?.listSync() || []).filter((r) => r.status !== "done").slice(0, 6);
  for (const r of pending) {
    push({ id: "td-r-" + r.id, section: "untouched", title: `Review: ${r.name || r.payload?.name || "candidate"}`,
      why: r.payload?.sourceQuote || r.reason || "Pending in the review queue.",
      related: r.entityId && r.entityType ? [{ id: r.entityId, type: r.entityType, label: r.name || "entity" }] : [],
      action: "Open Review Queue", confidence: "high" });
  }
  // Chapters → continue the story, or go back and finish an old one.
  // Completeness-aware: the latest unfinished chapter is "continue";
  // earlier drafted-but-not-complete chapters are "finish".
  const realChapters = (B.ManuscriptChapterService?.loadSync()?.chapters || []).filter((c) => !c.reserved);
  const lastCh = realChapters[realChapters.length - 1];
  if (lastCh && !lastCh.complete) {
    push({ id: "td-continue-" + lastCh.id, section: "prompts", title: `Continue "${lastCh.title || "the latest chapter"}"`,
      why: "Pick up the draft where you left off.",
      related: [], action: "Open Writer's Room", chapter: lastCh.title || "—", confidence: "strong" });
  }
  let _finish = 0;
  for (const c of realChapters) {
    if (lastCh && c.id === lastCh.id) continue;
    if (!c.complete && (c.words || 0) >= 150 && _finish < 3) {
      _finish += 1;
      push({ id: "td-finish-" + c.id, section: "prompts", title: `Finish "${c.title || "chapter"}"`,
        why: `${(c.words || 0).toLocaleString()} words drafted, not yet marked complete.`,
        related: [], action: "Open Writer's Room", chapter: c.title || "—", confidence: "uncertain" });
    }
  }

  // Code-first insight engine — staleness / incomplete / orphans / broken
  // links / stalled threads / contradictions, all zero-token. Fills the
  // sections that used to be placeholders (threads, callbacks, intel,
  // continuity beyond the AI check).
  const INSIGHT_SECTION = {
    "stalled-thread": "threads",
    "contradiction": "continuity",
    "broken-link": "continuity",
    "staleness": "callbacks",
    "incomplete": "intel",
    "orphan": "untouched",
    "absence-gap": "callbacks",
    "relationship-thread": "threads",
    "promise-payoff": "callbacks",
  };
  const INSIGHT_ACTION = {
    "stalled-thread": "Open in Quests panel",
    "contradiction": "Open in manuscript",
    "broken-link": "Open editor",
    "staleness": "Open editor",
    "incomplete": "Open editor",
    "orphan": "Open editor",
    "absence-gap": "Open in manuscript",
    "relationship-thread": "Open editor",
    "promise-payoff": "Open editor",
  };
  const conf = { high: "high", warn: "strong", info: "uncertain" };
  try {
    const { insights } = B.InsightService?.computeInsights?.() || { insights: [] };
    for (const ins of insights) {
      push({
        id: ins.id,
        kind: ins.kind,
        relatedIds: ins.relatedIds || [],
        section: INSIGHT_SECTION[ins.kind] || "untouched",
        title: ins.title,
        why: ins.body + (ins.evidence?.length ? ` — e.g. Ch. ${ins.evidence[0].chapter}: "${ins.evidence[0].quote}"` : ""),
        related: ins.entityRef ? [{ id: ins.entityRef.id, type: ins.entityRef.type, label: ins.entityRef.label, sectionId: ins.sectionId }] : [],
        action: INSIGHT_ACTION[ins.kind] || "Open",
        confidence: conf[ins.severity] || "uncertain",
        chapter: ins.evidence?.[0]?.chapter != null ? "Ch. " + ins.evidence[0].chapter : "—",
      });
    }
  } catch (_) {}

  // Speed Reader difficulty flags → revision prompts (the reader marked
  // these sentences as stumbling points mid-read).
  try {
    const srState = B.SpeedReaderService?.loadSync?.() || { sessions: [] };
    let srCount = 0;
    for (const sess of srState.sessions || []) {
      for (const n of sess.notes || []) {
        if (!n || n.kind !== "difficulty" || !n.sentence || srCount >= 4) continue;
        srCount += 1;
        push({
          id: "td-sr-" + n.id,
          section: "prompts",
          title: "Smooth a sentence you flagged while speed-reading",
          why: "“" + String(n.sentence).slice(0, 140) + (String(n.sentence).length > 140 ? "…" : "") + "”" + (sess.label ? " — " + sess.label : ""),
          action: "Open Speed Reader",
          confidence: "uncertain",
        });
      }
    }
  } catch (_) {}

  // Project-intelligence gaps: nudge when the core intel sections are empty.
  try {
    const intel = B.ProjectIntelService?.loadSync?.() || {};
    if (out.length > 0 && !intel.writingStyleGuide && !intel.styleDials) {
      push({ id: "td-intel-style", section: "intel", title: "No writing style profile yet",
        why: "Capture your voice in Onboarding or Settings ▸ Project Intelligence so AI drafts (and the style critique) match your prose.",
        action: "Open Control Centre", confidence: "uncertain" });
    }
  } catch (_) {}
  return out;
}

// ---------------------------------------------------------------------
// Today data
// ---------------------------------------------------------------------

const TODAY_SECTIONS = [
  { id: "prompts",   title: "Writing prompts",    sub: "Where the page wants to go next." },
  { id: "quests",    title: "Unfinished quests",  sub: "Active threads with open steps." },
  { id: "threads",   title: "Dangling threads",   sub: "Open questions still on the page." },
  { id: "untouched", title: "Untouched material", sub: "Characters, items, places introduced but unused." },
  { id: "continuity",title: "Continuity warnings",sub: "Possible breaks in canon." },
  { id: "callbacks", title: "Callbacks & motifs", sub: "Things worth pulling back through the prose." },
  { id: "queue",     title: "Review queue reminders", sub: "Triage before drafting more." },
  { id: "intel",     title: "Project Intelligence gaps", sub: "Missing pieces in the project intelligence file." },
];

// ---------------------------------------------------------------------
// TodayPanelBody — side panel version (lightweight)
// ---------------------------------------------------------------------
// Shared hook: live Today suggestions that refresh on store mutations.
function useTodaySuggestions() {
  const [tick, setTick] = _td_us(0);
  _td_ue(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("lw:entity-store-updated", bump);
    window.addEventListener("lw:review-queue-updated", bump);
    window.addEventListener("lw:manuscript-chapters-updated", bump);
    window.addEventListener("lw:occurrences-updated", bump);
    window.addEventListener("lw:backend-ready", bump);
    return () => {
      window.removeEventListener("lw:entity-store-updated", bump);
      window.removeEventListener("lw:review-queue-updated", bump);
      window.removeEventListener("lw:manuscript-chapters-updated", bump);
      window.removeEventListener("lw:occurrences-updated", bump);
      window.removeEventListener("lw:backend-ready", bump);
    };
  }, []);
  return _td_um(() => buildTodaySuggestions(), [tick]);
}

const TODAY_DISMISSED_KEY = "lw:v2:today_dismissed";
const _tdLoadDismissed = () => {
  try { return new Set(JSON.parse(window.localStorage.getItem(TODAY_DISMISSED_KEY) || "[]")); } catch (_) { return new Set(); }
};
const _tdSaveDismissed = (set) => {
  try { window.localStorage.setItem(TODAY_DISMISSED_KEY, JSON.stringify([...set].slice(-200))); } catch (_) {}
};

// Run a suggestion's primary action: open the most relevant surface. The card
// button's label IS the action ("Open in Quests panel", "Open Writer's Room",
// "Open editor"…); navigate accordingly, preferring the related entity.
function _tdRunAction(s, onSelectEntity) {
  if (!s) return;
  const a = (s.action || "").toLowerCase();
  const rel = (s.related && s.related[0]) || null;
  if (a.includes("editor") && rel) { window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: rel.type, initial: { id: rel.id }, mode: "full" } })); return; }
  if (rel && onSelectEntity) { onSelectEntity(rel); return; }
  if (a.includes("review")) { window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "review" } })); return; }
  if (a.includes("quest")) { window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "quests" } })); return; }
  // "Open Writer's Room" / "Open in manuscript" / fallback → the manuscript.
  window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
}
// Send a suggestion to Tangle as a sticky note (persists via TangleService).
function _tdSendToTangle(s) {
  if (!s) return;
  window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onSendSuggestionToTangle", detail: { title: s.title, text: s.why || "" } } }));
}

const TodayPanelBody = ({ panel, onSelectEntity }) => {
  const [filter, setFilter] = _td_us("all");
  const [dismissed, setDismissed] = _td_us(_tdLoadDismissed);
  const onDismiss = (id) => setDismissed((s) => { const n = new Set(s); n.add(id); _tdSaveDismissed(n); return n; });
  const suggestions = useTodaySuggestions().filter((s) => !dismissed.has(s.id));
  const filtered = filter === "all" ? suggestions : suggestions.filter((s) => s.section === filter);

  return (
    <div className="loc-body" data-ui="TodayPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__filters" style={{ flexWrap: "wrap" }}>
          <button className={"today__filter" + (filter === "all" ? " is-active" : "")} onClick={() => setFilter("all")}>All</button>
          {TODAY_SECTIONS.map((s) => (
            <button key={s.id} className={"today__filter" + (filter === s.id ? " is-active" : "")} onClick={() => setFilter(s.id)}>
              {s.title.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && (
          <div className="today__empty" style={{ padding: 16, color: "var(--ink-4)", fontStyle: "italic" }}>
            Nothing for today yet. Write a chapter, run extraction, or create quests — suggestions appear from your live project.
          </div>
        )}
        {filtered.map((s) => (
          <TodayCardCompact key={s.id} s={s} onSelectEntity={onSelectEntity} onDismiss={() => onDismiss(s.id)}/>
        ))}
      </div>
    </div>
  );
};

const TodayCardCompact = ({ s, onSelectEntity, onDismiss }) => (
  <div className="today__card" style={{ padding: 12 }}>
    <div className="today__card-head">
      <ConfidenceBadge level={s.confidence} value={s.confidence === "high" ? 95 : s.confidence === "strong" ? 78 : 56}/>
      {s.chapter && s.chapter !== "—" && <span style={{ marginLeft: "auto" }}>{s.chapter}</span>}
      {onDismiss && (
        <button
          className="today__card-dismiss"
          style={{ marginLeft: s.chapter && s.chapter !== "—" ? 6 : "auto", border: 0, background: "transparent", color: "var(--ink-4)", cursor: "pointer", padding: 2 }}
          title="Dismiss this suggestion"
          data-callback="onDismissTodaySuggestion"
          onClick={onDismiss}
        >
          <Icon name="close" size={9}/>
        </button>
      )}
    </div>
    <div className="today__card-title" style={{ fontSize: "var(--fs-lg)" }}>{s.title}</div>
    <div className="today__card-why">{s.why}</div>
    {s.related.length > 0 && (
      <div className="today__card-chips">
        {s.related.map((r) => (
          <button
            key={r.id}
            className="rpg-chip"
            data-callback="onOpenRelatedTab"
            onClick={() => onSelectEntity && onSelectEntity(r)}
          >
            {(ENTITY_TYPES[r.type]?.glyph || "·")} {r.label}
          </button>
        ))}
      </div>
    )}
    <div className="today__card-actions">
      <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onOpenRelatedTab" onClick={() => _tdRunAction(s, onSelectEntity)}>{s.action}</button>
      <button className="rpg-btn rpg-btn--small" data-callback="onSendSuggestionToTangle" onClick={() => _tdSendToTangle(s)}>→ Tangle</button>
      {onDismiss && <button className="rpg-btn rpg-btn--small rpg-btn--ghost" onClick={onDismiss}>Dismiss</button>}
    </div>
  </div>
);

// ---------------------------------------------------------------------
// ForesightReel — the "bold co-author" hub at the top of Today: a
// rotating, ranked feed of the engine's foresight (continuity risks,
// dangling threads, callbacks, relationship & payoff nudges). Reads the
// same live suggestions but shows only insight-derived items (id "ins-…").
// "Run on" scopes the reel to one character (computeForEntity-equivalent).
// ---------------------------------------------------------------------
const REEL_KIND_LABELS = {
  "contradiction": "Continuity risk",
  "broken-link": "Continuity risk",
  "stalled-thread": "Dangling thread",
  "relationship-thread": "Relationship",
  "absence-gap": "Absent character",
  "promise-payoff": "Setup & payoff",
  "staleness": "Gone quiet",
  "incomplete": "Thin record",
  "orphan": "Unconnected",
};
const reelKindLabel = (s) => REEL_KIND_LABELS[s && s.kind] || "Insight";

const ForesightReel = ({ suggestions, onSelectEntity, onDismiss }) => {
  const B = () => (typeof window !== "undefined") && window.LoomwrightBackend;
  const [idx, setIdx] = _td_us(0);
  const [paused, setPaused] = _td_us(false);
  const [focusId, setFocusId] = _td_us("");

  const cast = _td_um(() => {
    try { return (B()?.EntityService?.listSync("cast") || []).filter((c) => c && c.status !== "deleted"); }
    catch (_) { return []; }
  }, [suggestions]);

  const foresightAll = _td_um(() => suggestions.filter((s) => String(s.id).startsWith("ins-")), [suggestions]);
  const items = _td_um(() => {
    if (!focusId) return foresightAll;
    return foresightAll.filter((s) => (s.related || []).some((r) => r.id === focusId) || (s.relatedIds || []).includes(focusId));
  }, [foresightAll, focusId]);

  _td_ue(() => { if (idx >= items.length && items.length) setIdx(0); }, [items.length, idx]);
  _td_ue(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  // Empty project (no foresight and no characters to scope to): render nothing.
  if (!foresightAll.length && !cast.length) return null;

  const cur = items[idx] || null;
  const tone = cur ? (cur.confidence === "high" ? "high" : cur.confidence === "strong" ? "warn" : "info") : "info";
  const focusName = focusId ? (cast.find((c) => c.id === focusId)?.name || "this character") : null;

  return (
    <section className={"foresight-reel foresight-reel--" + tone} data-ui="ForesightReel">
      <div className="foresight-reel__bar">
        <span className="foresight-reel__eyebrow">⚡ Foresight</span>
        <span className="foresight-reel__lede">Your co-author's read on where the story stands.</span>
        <span style={{ flex: 1 }}/>
        <label className="foresight-reel__focus">
          Run on
          <select value={focusId} onChange={(e) => { setFocusId(e.target.value); setIdx(0); }}>
            <option value="">the whole story</option>
            {cast.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {!cur ? (
        <div className="foresight-reel__empty">
          {focusName
            ? `Nothing flags for ${focusName} right now — their thread is holding.`
            : "No continuity risks or loose threads right now. The story's holding together — keep writing."}
        </div>
      ) : (
        <div className="foresight-reel__stage">
          <button className="foresight-reel__nav" title="Previous" disabled={items.length <= 1}
            onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}>‹</button>
          <div className="foresight-reel__card" key={cur.id}>
            <div className="foresight-reel__card-head">
              <span className="foresight-reel__kind">{reelKindLabel(cur)}</span>
              <ConfidenceBadge level={cur.confidence} value={cur.confidence === "high" ? 95 : cur.confidence === "strong" ? 78 : 56}/>
              {cur.chapter && cur.chapter !== "—" && <span className="foresight-reel__chapter">{cur.chapter}</span>}
            </div>
            <div className="foresight-reel__title">{cur.title}</div>
            <div className="foresight-reel__why">{cur.why}</div>
            {(cur.related || []).length > 0 && (
              <div className="foresight-reel__chips">
                {cur.related.map((r) => (
                  <button key={r.id} className="rpg-chip" data-callback="onOpenRelatedTab"
                    onClick={() => onSelectEntity && onSelectEntity(r)}>
                    {(ENTITY_TYPES[r.type]?.glyph || "·")} {r.label}
                  </button>
                ))}
              </div>
            )}
            <div className="foresight-reel__actions">
              <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onOpenRelatedTab" onClick={() => _tdRunAction(cur, onSelectEntity)}>{cur.action}</button>
              <button className="rpg-btn rpg-btn--small" data-callback="onSendSuggestionToTangle" onClick={() => _tdSendToTangle(cur)}>→ Tangle</button>
              <button className="rpg-btn rpg-btn--small rpg-btn--ghost"
                onClick={() => onDismiss && onDismiss(cur.id)}>Dismiss</button>
            </div>
          </div>
          <button className="foresight-reel__nav" title="Next" disabled={items.length <= 1}
            onClick={() => setIdx((i) => (i + 1) % items.length)}>›</button>
        </div>
      )}

      {items.length > 0 && (
        <div className="foresight-reel__foot">
          <button className="foresight-reel__play" onClick={() => setPaused((p) => !p)}
            title={paused ? "Resume rotation" : "Pause rotation"}>{paused ? "▶ Play" : "⏸ Pause"}</button>
          <div className="foresight-reel__dots">
            {items.slice(0, 14).map((s, i) => (
              <button key={s.id} className={"foresight-reel__dot" + (i === idx ? " is-on" : "")}
                title={s.title} onClick={() => setIdx(i)}/>
            ))}
          </div>
          <span className="foresight-reel__count">{idx + 1} / {items.length}</span>
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------
// TodayScreen — full-width route (when routeId === "today")
// ---------------------------------------------------------------------
const TodayScreen = ({ onSelectEntity }) => {
  const [filter, setFilter] = _td_us("all");
  const [dismissed, setDismissed] = _td_us(_tdLoadDismissed);
  const onDismiss = (id) => setDismissed((s) => { const n = new Set(s); n.add(id); _tdSaveDismissed(n); return n; });
  const suggestions = useTodaySuggestions().filter((s) => !dismissed.has(s.id));
  const filtered = filter === "all" ? suggestions : suggestions.filter((s) => s.section === filter);
  const bySection = _td_um(() => {
    const m = {};
    for (const s of filtered) (m[s.section] = m[s.section] || []).push(s);
    return m;
  }, [filtered]);

  return (
    <div className="today" data-ui="TodayScreen">
      <div className="today__inner">
        <header className="today__head">
          <div className="today__greet-eyebrow">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="today__greet-title">What the page wants from you.</h1>
          <p className="today__greet-sub">Suggestions are read-only — accept what's useful, dismiss the rest. Nothing in here writes for you.</p>
          <div className="today__filters">
            <button className={"today__filter" + (filter === "all" ? " is-active" : "")} onClick={() => setFilter("all")}>All</button>
            {TODAY_SECTIONS.map((sec) => (
              <button key={sec.id} className={"today__filter" + (filter === sec.id ? " is-active" : "")} onClick={() => setFilter(sec.id)}>
                {sec.title}
              </button>
            ))}
            <span style={{ flex: 1 }}/>
            <button className="today__filter" data-callback="onGenerateTodayPrompts">Refresh prompts</button>
          </div>
        </header>

        <ForesightReel suggestions={suggestions} onSelectEntity={onSelectEntity} onDismiss={onDismiss}/>

        {filtered.length === 0 && (
          <section className="today__section" data-ui="TodayEmpty">
            <div className="today__section-head">
              <h2 className="today__section-title">Nothing for today yet</h2>
              <span className="today__section-sub">Suggestions are derived from your live project — write a chapter, run extraction, or add quests and they'll appear here. Nothing is invented.</span>
            </div>
          </section>
        )}

        {TODAY_SECTIONS.filter((s) => filter === "all" || filter === s.id).map((sec) => {
          const items = bySection[sec.id] || [];
          if (items.length === 0) return null;
          return (
            <section key={sec.id} className="today__section">
              <div className="today__section-head">
                <h2 className="today__section-title">{sec.title}</h2>
                <span className="today__section-sub">{sec.sub}</span>
              </div>
              <div className="today__cards">
                {items.map((s) => <TodayCardCompact key={s.id} s={s} onSelectEntity={onSelectEntity} onDismiss={() => onDismiss(s.id)}/>)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

// =====================================================================
// AI Writer
// =====================================================================

// Static prose previews per mode — in the Pale Reach voice.

const AI_MODES = [
  "Revise Passage",
  "Continue Writing",
  "Write Chapter",
  "Write Paragraphs",
  "Write Add-In",
  "Style Match",
  "Tone Shift",
  "Dialogue Polish",
  "Continuity Check",
];

// Stub entity drop zone — shows chips dropped in
const AiEntityDropZone = ({ chips, onDropEntity }) => (
  <div className="aiw__drop"
       data-callback="onDropEntityIntoAIWriter"
       onDragOver={(e) => e.preventDefault()}
       onDrop={(e) => onDropEntity && onDropEntity(e)}>
    {chips.length === 0 ? (
      <div className="aiw__drop-empty">⤓  Drag entities here to give the writer context</div>
    ) : (
      <div className="aiw__drop-chips">
        {chips.map((c) => (
          <span key={c.id} className="rpg-chip" style={{ "--ec": ENTITY_TYPES[c.type]?.color }}>
            {ENTITY_TYPES[c.type]?.glyph || "·"} {c.label}
          </span>
        ))}
      </div>
    )}
  </div>
);

const AiWriterPanelBody = ({ panel }) => {
  const B = () => window.LoomwrightBackend;
  const [mode, setMode] = _td_us("Write Chapter");
  const [chips, setChips] = _td_us([]);
  const [instruction, setInstruction] = _td_us("");
  const [style, setStyle]   = _td_us("Project voice");
  const [pov, setPov]       = _td_us("Close third");
  const [length, setLength] = _td_us("Short chapter (~1,400w)");
  const [beats, setBeats]   = _td_us([]);
  const [avoid, setAvoid]   = _td_us("");
  const [generated, setGenerated] = _td_us(null); // null | { text, mode }
  const [conflicts, setConflicts] = _td_us(null); // continuity results

  // Live context: active chapter + the manuscript's current selection.
  const [storeVersion, setStoreVersion] = _td_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:manuscript-chapters-updated", "lw:set-active-chapter", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    const onDraft = (e) => { if (e?.detail?.text) setGenerated({ text: e.detail.text, mode: "live" }); };
    const onConflicts = (e) => setConflicts(e?.detail?.conflicts || []);
    // Writer's Room AI toolbar buttons land here with a target mode.
    const onSetMode = (e) => { if (e?.detail?.mode) setMode(e.detail.mode); };
    window.addEventListener("lw:composition-draft-generated", onDraft);
    window.addEventListener("lw:continuity-check", onConflicts);
    window.addEventListener("lw:aiwriter-set-mode", onSetMode);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      window.removeEventListener("lw:composition-draft-generated", onDraft);
      window.removeEventListener("lw:continuity-check", onConflicts);
      window.removeEventListener("lw:aiwriter-set-mode", onSetMode);
    };
  }, []);
  const live = _td_um(() => {
    const Bk = window.LoomwrightBackend;
    const out = { chapterId: null, chapterNum: null, excerpt: "", styleRefs: [], castNames: [] };
    if (!Bk) return out;
    try {
      const st = Bk.ManuscriptChapterService?.loadSync?.() || {};
      const chapters = (st.chapters || []).filter((c) => !c.reserved);
      const ix = chapters.findIndex((c) => c.id === st.activeChapterId);
      const active = ix >= 0 ? chapters[ix] : chapters[chapters.length - 1];
      if (active) {
        out.chapterId = active.id;
        out.chapterNum = active.num || (ix >= 0 ? ix + 1 : chapters.length);
        const text = ((st.manuscripts || {})[active.id]?.text || active.bodyText || "").trim();
        if (text) {
          const tail = text.replace(/\s+/g, " ").slice(-160);
          out.excerpt = "…" + tail;
        }
      }
      out.styleRefs = (Bk.ReferencesService?.listSync?.() || [])
        .filter((r) => r.styleSource || r.isStyleInfluence)
        .map((r) => r.title);
      out.castNames = (Bk.EntityService?.listSync?.("cast") || [])
        .filter((e) => e.status !== "deleted")
        .map((e) => e.name);
    } catch (_e) {}
    return out;
  }, [storeVersion]);

  // Drag-in entities from any panel (application/x-loom-entity payloads).
  const onDropEntity = (e) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/x-loom-entity");
      if (!raw) return;
      const p = JSON.parse(raw);
      const id = p.id || p.entityId;
      if (!id) return;
      const type = p.entityType || p.type || "cast";
      const label = p.name || p.label || (B()?.EntityService?.getSync?.(id, type)?.name) || "Entity";
      setChips((curr) => curr.some((c) => c.id === id) ? curr : [...curr, { id, type, label }]);
    } catch (_e) {}
  };

  // Reset preview content when mode changes
  React.useEffect(() => { setGenerated(null); setConflicts(null); }, [mode]);

  // Compose the full instruction the registry's provider-gated branch
  // sends to the model (it appends the bounded project context).
  const composePrompt = () => {
    const parts = [];
    parts.push("Task: " + mode + ".");
    if (instruction.trim()) parts.push(instruction.trim());
    if (chips.length) parts.push("Entities in focus: " + chips.map((c) => c.label).join(", ") + ".");
    if (mode === "Write Chapter") {
      parts.push("Style: " + style + ". POV: " + pov + ". Length: " + length + ".");
      if (beats.length) parts.push("Required beats, in order:\n" + beats.map((b, i) => (i + 1) + ". " + b).join("\n"));
      if (avoid.trim()) parts.push("Avoid: " + avoid.trim());
    }
    return parts.join("\n\n");
  };
  // No-provider fallback: a deterministic "draft brief" assembled from the
  // exact context the model WOULD receive (AIContextBuilder sections, the
  // composed instruction, entity dossiers). Never a dead end — the brief is
  // useful on its own and copyable into any external assistant.
  const buildLocalBrief = () => {
    const Bk = window.LoomwrightBackend;
    const lines = [];
    lines.push("DRAFT BRIEF (assembled locally — no AI provider configured)");
    lines.push("");
    lines.push(composePrompt());
    try {
      const ctx = Bk?.AIContextBuilder?.build?.({ task: "writingDraft", chapterId: live.chapterId, selectedEntityIds: chips.map((c) => c.id) });
      for (const s of (ctx?.sections || [])) {
        lines.push("");
        lines.push("— " + s.label + " —");
        lines.push(String(s.text).slice(0, 900));
      }
    } catch (_e) {}
    lines.push("");
    lines.push("Next: write the scene from the beats above, or configure an AI provider in Settings ▸ AI & Privacy to generate it here.");
    return lines.join("\n");
  };

  const onGenerate = () => {
    if (mode === "Continuity Check") {
      window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onRunContinuityCheck" } }));
      return;
    }
    // Provider-less path: render the local brief AND make it the Copy/Accept
    // target (set the global the registry handlers read), then still fire the
    // provider-gated notice so the author knows why it's a brief, not a draft.
    const route = window.LoomwrightBackend?.AIRoutingService?.resolveRoute?.("writingDraft");
    if (!route) {
      const brief = buildLocalBrief();
      try { window.__LW_LAST_GENERATED_DRAFT__ = brief; } catch (_e) {}
      setGenerated({ text: brief, mode: "local-brief" });
      window.dispatchEvent(new CustomEvent("lw:dispatch-callback", {
        detail: { name: "onGenerateAIWriterDraft", detail: { prompt: composePrompt(), chapterId: live.chapterId, entityIds: chips.map((c) => c.id) } },
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent("lw:dispatch-callback", {
      detail: { name: "onGenerateAIWriterDraft", detail: { prompt: composePrompt(), chapterId: live.chapterId, entityIds: chips.map((c) => c.id) } },
    }));
  };

  const previewText = generated ? generated.text : "";

  return (
    <div className="aiw" data-ui="AiWriterPanelBody">
      {/* Mode tabs */}
      <div className="aiw__modes">
        {AI_MODES.map((m) => (
          <button key={m}
                  className={"aiw__mode" + (m === mode ? " is-active" : "")}
                  data-callback="onOpenAIWriterMode"
                  onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>

      <div className="aiw__body">
        {/* Selected context */}
        <div>
          <div className="aiw__section-title">Selected context</div>
          <div className="aiw__context">
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {live.chapterNum == null ? "No chapter yet" :
               mode === "Write Chapter" ? "Append after Ch. " + live.chapterNum :
               mode === "Continue Writing" ? "Cursor · end of Ch. " + live.chapterNum :
               "Manuscript · Ch. " + live.chapterNum}
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-sm)", color: "var(--ink-2)", marginTop: 4 }}>
              {live.excerpt
                ? '"' + live.excerpt + '"'
                : "Nothing written yet — the writer will start from your project intelligence alone."}
            </div>
          </div>
        </div>

        {/* Entity drop zone */}
        <div>
          <div className="aiw__section-title">Entities in context</div>
          <AiEntityDropZone chips={chips} onDropEntity={onDropEntity}/>
          {chips.length > 0 && (
            <button className="rpg-btn rpg-btn--small" style={{ marginTop: 4 }} onClick={() => setChips([])}>Clear entities</button>
          )}
        </div>

        {/* Instruction */}
        <div>
          <div className="aiw__section-title">Instruction</div>
          <textarea
            className="aiw__textarea"
            value={instruction}
            data-callback="onEditAIWriterInstruction"
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="What should the writer do?"
          />
        </div>

        {/* Write Chapter — extra fields */}
        {mode === "Write Chapter" && (
          <>
            <div className="aiw__controls">
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="aiw__section-title">Style</span>
                <select className="loc-body__filter" value={style} onChange={(e) => setStyle(e.target.value)}>
                  <option>Project voice</option>
                  {live.styleRefs.map((t) => <option key={t}>{t}</option>)}
                  <option>Plain workhorse</option>
                  <option>Bleak / cold</option>
                  <option>Court formal</option>
                  <option>Folk-tale</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="aiw__section-title">POV</span>
                <select className="loc-body__filter" value={pov} onChange={(e) => setPov(e.target.value)}>
                  {live.castNames.map((n) => <option key={n}>{n + " — close third"}</option>)}
                  <option>Close third</option>
                  <option>Distant third</option>
                  <option>First (specify)</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="aiw__section-title">Length</span>
                <select className="loc-body__filter" value={length} onChange={(e) => setLength(e.target.value)}>
                  <option>One scene (~500w)</option>
                  <option>Short chapter (~1,400w)</option>
                  <option>Full chapter (~3,500w)</option>
                  <option>Long chapter (~6,000w)</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="aiw__section-title">Avoid</span>
                <input className="loc-body__filter" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="What to not do"/>
              </label>
            </div>

            <div>
              <div className="aiw__section-title">Required beats</div>
              <div className="aiw__beats">
                {beats.map((b, i) => (
                  <div key={i} className="aiw__beat">
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-4)", fontSize: "var(--fs-2xs)" }}>{i + 1}</span>
                    <input style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px dashed var(--line-2)", font: "inherit", color: "inherit" }}
                           value={b} placeholder="Describe the beat…"
                           onChange={(e) => setBeats((curr) => curr.map((x, ix) => ix === i ? e.target.value : x))}/>
                    <button className="stat-rule-row__icon" onClick={() => setBeats((curr) => curr.filter((_, ix) => ix !== i))}>✕</button>
                  </div>
                ))}
                <button className="rpg-btn rpg-btn--small" data-callback="onAddBeat" onClick={() => setBeats((curr) => [...curr, ""])}>+ Beat</button>
              </div>
            </div>
          </>
        )}

        {/* Write Add-In — comparison preview */}
        {mode === "Write Add-In" && generated && (
          <div className="aiw__compare">
            <div className="aiw__compare-pane">
              <h4>Before</h4>
              <p style={{ fontStyle: "italic", color: "var(--ink-3)" }}>
                {live.excerpt ? '"' + live.excerpt + '"' : "—"}
              </p>
            </div>
            <div className="aiw__compare-pane" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h4>With add-in</h4>
              <p style={{ fontStyle: "italic", color: "var(--ink-3)" }}>
                {live.excerpt ? '"' + live.excerpt + '"' : ""}
              </p>
              <p>{previewText}</p>
            </div>
          </div>
        )}

        {/* Continuity Check — live results */}
        {mode === "Continuity Check" && conflicts !== null && (
          <div>
            <div className="aiw__section-title">Findings</div>
            <div className="aiw__preview" data-ui="AiwConflicts">
              {conflicts.length === 0
                ? <p style={{ fontStyle: "italic", color: "var(--ink-3)" }}>No contradictions detected against your canon sources.</p>
                : conflicts.map((c, i) => (
                    <p key={i}>• {typeof c === "string" ? c : (c.claim || c.summary || "") + (c.reference ? " — vs " + c.reference : "") + (c.evidence ? " (" + c.evidence + ")" : "")}</p>
                  ))}
            </div>
          </div>
        )}

        {/* Generate / preview */}
        {mode !== "Write Add-In" && mode !== "Continuity Check" && (
          <div>
            <div className="aiw__section-title">Preview</div>
            {generated ? (
              <div className="aiw__preview" data-ui="AiwPreview"
                data-testid={generated.mode === "local-brief" ? "aiw-fallback-brief" : "aiw-preview"}>
                <div className="aiw__preview-meta">
                  {mode} · {generated.mode === "local-brief" ? "local brief (no provider)" : "draft"} · ~{Math.round((previewText.split(/\s+/).filter(Boolean).length))}w
                </div>
                {previewText.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ) : (
              <div className="aiw__preview" style={{ fontStyle: "italic", color: "var(--ink-4)" }} data-ui="AiwPreviewEmpty">
                Press Generate to draft with your configured AI provider — the project's context (chapter, entities, canon, voice) rides along automatically.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="aiw__actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onGenerateAIWriterDraft" data-testid="aiw-generate"
                onClick={onGenerate}>{mode === "Continuity Check" ? "Run check" : "Generate"}</button>
        <button className="rpg-btn" data-callback="onAcceptGeneratedText">Accept</button>
        {mode === "Write Chapter" ? (
          <>
            <button className="rpg-btn" data-callback="onInsertGeneratedText"
                    onClick={() => generated && window.dispatchEvent(new CustomEvent("lw:composition-insert-draft", { detail: { text: generated.text, source: "ai-writer" } }))}>Insert as draft</button>
            <button className="rpg-btn" data-callback="onCreateChapter"
                    onClick={() => generated && window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onCreateChapterFromComposition", detail: { text: generated.text, title: "" } } }))}>Create as new chapter</button>
          </>
        ) : mode === "Write Add-In" ? (
          <>
            <button className="rpg-btn" data-callback="onInsertGeneratedText"
                    onClick={() => generated && window.dispatchEvent(new CustomEvent("lw:composition-insert-draft", { detail: { text: generated.text, source: "ai-writer" } }))}>Insert below</button>
          </>
        ) : (
          <button className="rpg-btn" data-callback="onInsertGeneratedText"
                  onClick={() => generated && window.dispatchEvent(new CustomEvent("lw:composition-insert-draft", { detail: { text: generated.text, source: "ai-writer" } }))}>Insert</button>
        )}
        <button className="rpg-btn" data-callback="onCopyGeneratedText">Copy</button>
        <span style={{ flex: 1 }}/>
        {mode === "Continuity Check" && (
          <button className="rpg-btn" data-callback="onRunContinuityCheck">Re-run check</button>
        )}
        <button className="rpg-btn rpg-btn--ghost" data-callback="onDismissGeneratedText"
                onClick={() => { setGenerated(null); setConflicts(null); }}>Dismiss</button>
      </div>
    </div>
  );
};

window.TODAY_SECTIONS = TODAY_SECTIONS;
window.AI_MODES          = AI_MODES;

Object.assign(window, { TodayPanelBody, TodayScreen, AiWriterPanelBody, TodayCardCompact, AiEntityDropZone });
