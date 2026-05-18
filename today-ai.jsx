// =====================================================================
// today-ai.jsx — Today dashboard panel + AI Writer panel
//
// Today: a side-panel dashboard of suggestions (writing prompts,
// dangling threads, characters not seen, etc.) with filter chips.
// AI Writer: tabbed modes (Revise / Continue / Write Chapter / etc.)
// with bespoke layouts per mode. Previews use static, hand-written
// prose samples in the Pale Reach voice.
// =====================================================================

const { useState: _td_us, useMemo: _td_um, useCallback: _td_uc } = React;

// ---------------------------------------------------------------------
// Today data
// ---------------------------------------------------------------------
const TODAY_SUGGESTIONS = [
  // -- writing prompts --
  { id: "ts1", section: "prompts", title: "Open Ch. 8 in Brec's voice.",
    why: "Brec hasn't held POV since Ch. 5. The negotiation break is his moment to come back.",
    related: [{ id: "c3", type: "cast", label: "Captain Brec" }, { id: "e1", type: "events", label: "Negotiation break" }],
    action: "Open Writer's Room · Ch. 8", chapter: "Ch. 8", confidence: "high" },
  { id: "ts2", section: "prompts", title: "Show what Aelinor sees in the salt-cold.",
    why: "She's been carrying the Auger four chapters. A quiet moment would re-centre Acts III.",
    related: [{ id: "c1", type: "cast", label: "Aelinor Vey" }, { id: "i1", type: "items", label: "Bone Auger" }],
    action: "Send to AI Writer", chapter: "Ch. 8", confidence: "strong" },

  // -- unfinished quests --
  { id: "ts3", section: "quests", title: "The Auger Wake — step 4 unwritten.",
    why: "Steps 1–3 done. Step 4 ('Return the Auger to the vault') is not on the page.",
    related: [{ id: "q1", type: "quests", label: "The Auger Wake" }],
    action: "Open Quest in Quests panel", chapter: "Ch. 7", confidence: "high" },
  { id: "ts4", section: "quests", title: "The Hess negotiation — day three open.",
    why: "Day three of the audience is active. The branch is undecided.",
    related: [{ id: "q3", type: "quests", label: "The Hess negotiation" }],
    action: "Open in Quests panel", chapter: "Ch. 7", confidence: "high" },

  // -- dangling plot threads --
  { id: "ts5", section: "threads", title: "The Hess Letter-key — lost or not?",
    why: "Ch. 5 says lost. Ch. 6 has Brec using it. Pick canon.",
    related: [{ id: "i4", type: "items", label: "Hess Letter-key" }],
    action: "Open contradiction in Lore", chapter: "Ch. 5–6", confidence: "uncertain" },
  { id: "ts6", section: "threads", title: "Salt Watch is unplaced on the Atlas.",
    why: "Mentioned twice. No coordinates. Locate or remove.",
    related: [{ id: "sw", type: "locations", label: "Salt Watch" }],
    action: "Open in Atlas editor", chapter: "Ch. 2, 6", confidence: "strong" },

  // -- characters not seen --
  { id: "ts7", section: "untouched", title: "Mara of Hess — last seen Ch. 4.",
    why: "Mentioned in Ch. 7 review queue (possible witness). She hasn't been on the page in 80 pages.",
    related: [{ id: "c5", type: "cast", label: "Mara of Hess" }],
    action: "Open in Cast", chapter: "Ch. 4", confidence: "strong" },

  // -- items introduced but unused --
  { id: "ts8", section: "untouched", title: "Vey Signet — has rules, no uses.",
    why: "Affix 'sealing wax' is defined; no chapter has actually used it.",
    related: [{ id: "i2", type: "items", label: "Vey Signet" }],
    action: "Send to Tangle", chapter: "—", confidence: "uncertain" },

  // -- locations mentioned but unexplored --
  { id: "ts9", section: "untouched", title: "Auger Cliffs — not on Atlas yet.",
    why: "Five mentions. No placement. Place or merge with Pale Reach.",
    related: [{ id: "loc-auger-cliffs", type: "locations", label: "Auger Cliffs" }],
    action: "Open in Locations", chapter: "Ch. 4, 6", confidence: "strong" },

  // -- continuity warnings --
  { id: "ts10", section: "continuity", title: "House Vey banner — hard canon broken.",
    why: "Bk I says 'never lowered.' Ch. 7 of Bk II lowers it.",
    related: [{ id: "f1", type: "factions", label: "House Vey" }],
    action: "Open contradiction in Lore", chapter: "Ch. 7", confidence: "high" },
  { id: "ts11", section: "continuity", title: "Outer wall breaches — 1 or 2?",
    why: "Ch. 2 says one breach. Ch. 5 says two. Decide.",
    related: [{ id: "a1", type: "locations", label: "Pale Reach Hold" }],
    action: "Open contradiction", chapter: "Ch. 2, 5", confidence: "strong" },

  // -- callbacks / motifs --
  { id: "ts12", section: "callbacks", title: "Motif: salt.",
    why: "Salt has carried four chapters of weight. Worth a callback in the close of Ch. 7.",
    related: [],
    action: "Add to Tangle", chapter: "—", confidence: "uncertain" },

  // -- review queue reminders --
  { id: "ts13", section: "queue", title: "11 review queue items pending across panels.",
    why: "Lore has 7. Cast has 3. Items has 1. Triage before drafting more.",
    related: [],
    action: "Open Review Queue", chapter: "—", confidence: "high" },

  // -- project intelligence gaps --
  { id: "ts14", section: "intel", title: "No style sample from Ch. 1 yet.",
    why: "Project Intelligence wants 1 style reference per book. None linked.",
    related: [],
    action: "Open References", chapter: "Ch. 1", confidence: "uncertain" },
];

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
const TodayPanelBody = ({ panel, onSelectEntity }) => {
  const [filter, setFilter] = _td_us("all");
  const filtered = filter === "all" ? TODAY_SUGGESTIONS : TODAY_SUGGESTIONS.filter((s) => s.section === filter);

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
        {filtered.map((s) => (
          <TodayCardCompact key={s.id} s={s} onSelectEntity={onSelectEntity}/>
        ))}
      </div>
    </div>
  );
};

const TodayCardCompact = ({ s, onSelectEntity }) => (
  <div className="today__card" style={{ padding: 12 }}>
    <div className="today__card-head">
      <ConfidenceBadge level={s.confidence} value={s.confidence === "high" ? 95 : s.confidence === "strong" ? 78 : 56}/>
      {s.chapter && s.chapter !== "—" && <span style={{ marginLeft: "auto" }}>{s.chapter}</span>}
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
      <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onSendSuggestionToWriter">{s.action}</button>
      <button className="rpg-btn rpg-btn--small" data-callback="onSendSuggestionToTangle">→ Tangle</button>
      <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDismissTodaySuggestion">Dismiss</button>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// TodayScreen — full-width route (when routeId === "today")
// ---------------------------------------------------------------------
const TodayScreen = ({ onSelectEntity }) => {
  const [filter, setFilter] = _td_us("all");
  const filtered = filter === "all" ? TODAY_SUGGESTIONS : TODAY_SUGGESTIONS.filter((s) => s.section === filter);
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
                {items.map((s) => <TodayCardCompact key={s.id} s={s} onSelectEntity={onSelectEntity}/>)}
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
const AI_PREVIEWS = {
  "Revise Passage":
    "The light over Pale Reach was the colour of cooled tin, and Aelinor Vey came through the stockade gate the way salt comes off the sea — without warning, without invitation, and impossible to argue with afterwards.",
  "Continue Writing":
    "She set the case on the table and did not open it. Brec waited. The brazier coughed once, and the room smelled — for a moment — of the chapel three nights ago, when she had told herself she had not made up her mind. She put her hand on the lid and left it there.",
  "Write Chapter":
    "Chapter Eight\n\nThe road from the Watchhouse to the Glass Court had been measured once in a wedding-march and once in a march of mourners, and the difference between the two ran through Brec's shoulders the whole way. The salt was thinner here, this far south of the Hold; the air did not so much cut as press. He walked behind Aelinor without speaking, the Bone Auger in its felt case across his back. Twice the road turned past a cairn he did not recognise, and twice she stopped, and twice she walked on without saying what she had seen.",
  "Write Paragraphs":
    "The wind off the salt flats turned each flake into a small, deliberate cut. Aelinor did not lift her hood. She had been wearing the cold long enough to know which parts of her face it had architecture in, and which parts it would not bother with.",
  "Write Add-In":
    "(between paragraphs two and three) — She had not slept since Brec's letter, and three nights of refusing the dreams had given her hands a fine, undignified tremor. The Auger pressed against her shoulder like a second pulse.",
  "Style Match":
    "The room smelled of pitch and coriander, and the brazier had been pulled close to the lieutenant's table. There were three cups, and only one of them had been touched.",
  "Tone Shift":
    "[Shifted toward bleaker] The light over Pale Reach was the colour of cooled tin, and the gulls would not call to her.",
  "Dialogue Polish":
    "\"You're the wrong shape for this weather,\" Brec said. \"You always were. I just thought, this time, you'd come dressed for it.\"",
  "Continuity Check":
    "Continuity:\n  • Ch. 5: 'two gaps in the outer wall.'\n  • Ch. 2: 'a breach in the outer wall.' — singular.\n  → Possible canon break. Resolve before Ch. 8.\n\n  • Letter-key: lost Ch. 5; used Ch. 6 (Brec seals second letter). Reconcile.\n",
};

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
  const [mode, setMode] = _td_us("Write Chapter");
  const [chips, setChips] = _td_us([
    { id: "c1", type: "cast", label: "Aelinor Vey" },
    { id: "c3", type: "cast", label: "Captain Brec" },
    { id: "i1", type: "items", label: "Bone Auger" },
    { id: "a3", type: "locations", label: "Glass Court" },
  ]);
  const [instruction, setInstruction] = _td_us(mode === "Write Chapter"
    ? "Write Chapter 8 in Brec's POV. He walks behind Aelinor on the road from the Watchhouse to the Glass Court. Cold has thinned; salt has thinned with it. Use the established voice."
    : "");
  const [style, setStyle]   = _td_us("Pale Reach prose");
  const [pov, setPov]       = _td_us("Brec — close third");
  const [length, setLength] = _td_us("Short chapter (~1,400w)");
  const [beats, setBeats]   = _td_us([
    "Brec follows Aelinor along the salt-thinned road.",
    "Twice she stops at a cairn and does not name it.",
    "End on the gate of the Glass Court.",
  ]);
  const [avoid, setAvoid]   = _td_us("Don't open the Bone Auger case on the page.");
  const [generated, setGenerated] = _td_us(true);

  // Reset preview content when mode changes
  React.useEffect(() => { setGenerated(true); }, [mode]);

  const previewText = AI_PREVIEWS[mode] || "";

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
              {mode === "Write Add-In" ? "Selection · Ch. 7, ¶ 2–3" :
               mode === "Continue Writing" ? "Cursor · Ch. 7, p. 188" :
               mode === "Revise Passage" ? "Selection · Ch. 7, ¶ 1" :
               mode === "Write Chapter" ? "Append after Ch. 7" :
               "Manuscript · Ch. 7"}
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-sm)", color: "var(--ink-2)", marginTop: 4 }}>
              {mode === "Write Add-In" ?
                "\"…the Auger of Hess in a felt-lined case slung across her back, and even wrapped, even quiet, it pressed against her like a second pulse.\"" :
                "Current cursor is after the line: 'Tell me first whether the road through the Vraska Pass is still walkable.'"}
            </div>
          </div>
        </div>

        {/* Entity drop zone */}
        <div>
          <div className="aiw__section-title">Entities in context</div>
          <AiEntityDropZone chips={chips} onDropEntity={() => {}}/>
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
                  <option>Pale Reach prose</option>
                  <option>Plain workhorse</option>
                  <option>Bleak / cold</option>
                  <option>Court formal</option>
                  <option>Folk-tale</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="aiw__section-title">POV</span>
                <select className="loc-body__filter" value={pov} onChange={(e) => setPov(e.target.value)}>
                  <option>Aelinor — close third</option>
                  <option>Brec — close third</option>
                  <option>Saren — close third</option>
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
                    <span style={{ flex: 1 }}>{b}</span>
                    <button className="stat-rule-row__icon" onClick={() => setBeats((curr) => curr.filter((_, ix) => ix !== i))}>✕</button>
                  </div>
                ))}
                <button className="rpg-btn rpg-btn--small" data-callback="onAddBeat" onClick={() => setBeats((curr) => [...curr, "New beat…"])}>+ Beat</button>
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
                "She carried the Auger of Hess in a felt-lined case slung across her back, and even wrapped, even quiet, it pressed against her like a second pulse."
              </p>
            </div>
            <div className="aiw__compare-pane" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h4>With add-in</h4>
              <p style={{ fontStyle: "italic", color: "var(--ink-3)" }}>
                "She carried the Auger of Hess in a felt-lined case slung across her back, and even wrapped, even quiet, it pressed against her like a second pulse."
              </p>
              <p>
                {previewText}
              </p>
            </div>
          </div>
        )}

        {/* Generate / preview */}
        {mode !== "Write Add-In" && (
          <div>
            <div className="aiw__section-title">Preview</div>
            {generated ? (
              <div className="aiw__preview">
                <div className="aiw__preview-meta">
                  {mode} · sample · ~{Math.round((previewText.split(/\s+/).length))}w
                </div>
                {previewText.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ) : (
              <div className="aiw__preview" style={{ fontStyle: "italic", color: "var(--ink-4)" }}>
                Press Generate to preview.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="aiw__actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onGenerateAIWriterDraft" onClick={() => setGenerated(true)}>Generate</button>
        <button className="rpg-btn" data-callback="onAcceptGeneratedText">Accept</button>
        {mode === "Write Chapter" ? (
          <>
            <button className="rpg-btn" data-callback="onInsertGeneratedText">Insert as draft</button>
            <button className="rpg-btn" data-callback="onCreateChapter">Create as new chapter</button>
          </>
        ) : mode === "Write Add-In" ? (
          <>
            <button className="rpg-btn" data-callback="onInsertGeneratedText">Insert below</button>
          </>
        ) : (
          <button className="rpg-btn" data-callback="onInsertGeneratedText">Insert</button>
        )}
        <button className="rpg-btn" data-callback="onCopyGeneratedText">Copy</button>
        <span style={{ flex: 1 }}/>
        {mode === "Continuity Check" && (
          <button className="rpg-btn" data-callback="onRunContinuityCheck">Re-run check</button>
        )}
        <button className="rpg-btn rpg-btn--ghost" data-callback="onDismissGeneratedText">Dismiss</button>
      </div>
    </div>
  );
};

window.TODAY_SUGGESTIONS = TODAY_SUGGESTIONS;
window.TODAY_SECTIONS    = TODAY_SECTIONS;
window.AI_PREVIEWS       = AI_PREVIEWS;
window.AI_MODES          = AI_MODES;

Object.assign(window, { TodayPanelBody, TodayScreen, AiWriterPanelBody, TodayCardCompact, AiEntityDropZone });
