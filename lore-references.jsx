// =====================================================================
// lore-references.jsx — Lore / Canon panel + References panel.
//
// Both panels share a card-list visual vocabulary but track different
// objects:
//   Lore / Canon: facts and rules the world is bound to.
//   References:  external materials (uploads, pasted text, instructions).
// =====================================================================

const { useState: _lr_us, useMemo: _lr_um, useCallback: _lr_uc } = React;

// ---------------------------------------------------------------------
// Canon facts — sample data
// ---------------------------------------------------------------------
const CANON_FACTS = [
  { id: "cf1", text: "Salt-wraiths cannot cross a circle of poured salt.",
    scope: "world rule", hardness: "hard", confidence: "high",
    source: "Ch. 6 · p. 184", linkedEntities: ["b-saltwraith","a-augur"],
    contradictions: 0, included: true, lastUpdated: "2 days ago",
    note: "Brec confirms; Auger's discipline matches." },
  { id: "cf2", text: "House Vey's banner is never lowered.",
    scope: "faction rule", hardness: "soft", confidence: "uncertain",
    source: "Bk I · Ch. 4", linkedEntities: ["f-vey"], contradictions: 1,
    included: true, lastUpdated: "5 days ago",
    note: "Ch. 7 of Bk II shows them lowering it." },
  { id: "cf3", text: "Glass Throne audiences last exactly three days.",
    scope: "historical", hardness: "hard", confidence: "high",
    source: "Bk I · Ch. 11", linkedEntities: ["f-glass","gc-throne"], contradictions: 0,
    included: true, lastUpdated: "2 weeks ago" },
  { id: "cf4", text: "Augur Stones are made by spiral-binding cliff-salt and bone.",
    scope: "magic rule", hardness: "soft", confidence: "strong",
    source: "Ch. 6 · p. 188", linkedEntities: ["i-augerstone","ao"], contradictions: 0,
    included: true, lastUpdated: "3 days ago" },
  { id: "cf5", text: "Hess has no winter — only a long autumn that ends abruptly.",
    scope: "world rule", hardness: "hard", confidence: "high",
    source: "Bk I · Author note", linkedEntities: ["hess"], contradictions: 0,
    included: true, lastUpdated: "1 month ago" },
  { id: "cf6", text: "Reach speech contracts on the second syllable of every word.",
    scope: "language rule", hardness: "soft", confidence: "uncertain",
    source: "Voice profile", linkedEntities: ["aelinor","brec"], contradictions: 0,
    included: false, lastUpdated: "1 week ago",
    note: "Style note; not strict — author may break it." },
  { id: "cf7", text: "The Auger Stone, once used, cannot be used again in the same generation.",
    scope: "magic rule", hardness: "hard", confidence: "high",
    source: "Ch. 6 · p. 192", linkedEntities: ["i-augerstone"], contradictions: 0,
    included: true, lastUpdated: "3 days ago" },
];

const CANON_CONTRADICTIONS = [
  { id: "cc1", a: { factId: "cf2", source: "Bk I · Ch. 4" }, b: { source: "Bk II · Ch. 7" },
    summary: "Banner was lowered in Ch. 7 of Bk II, contradicting Bk I's hard rule.",
    affected: ["f-vey"],
    suggestion: "Mark Bk II as a canonical break — banner now lowers under treaty conditions." },
  { id: "cc2", a: { source: "Ch. 4 · p. 102", text: "Hess Tunnel rumour" }, b: { source: "Ch. 6 · p. 188", text: "Hess Tunnel rumour" },
    summary: "Ch. 4 and Ch. 6 both reference 'the rumour of a tunnel under Hess' — but neither commits.",
    affected: ["ht"],
    suggestion: "Decide canon status — confirm location or remove from atlas." },
];

const CANON_AI_INSTRUCTIONS = [
  { id: "ai1", text: "When Aelinor speaks, contract every second syllable. She does not use contractions of common verbs." },
  { id: "ai2", text: "Never confirm the existence of the Hess Tunnel in narrator voice. Always frame as rumour." },
  { id: "ai3", text: "Salt-wraiths do not have eyes. Never give them eyes." },
];

const CANON_SCOPES = [
  { id: "all",         label: "All",            color: "#76684c" },
  { id: "world",       label: "World rule",     color: "#3e6db5" },
  { id: "magic",       label: "Magic rule",     color: "#7a6aa3" },
  { id: "history",     label: "Historical",     color: "#7a5a3a" },
  { id: "cultural",    label: "Cultural",       color: "#5d6d4e" },
  { id: "language",    label: "Language",       color: "#998f78" },
  { id: "faction",     label: "Faction",        color: "#3d3a78" },
  { id: "ai",          label: "AI instruction", color: "#c98a2c" },
];

// ---------------------------------------------------------------------
// LorePanelBody
// ---------------------------------------------------------------------
const LorePanelBody = ({ panel }) => {
  const [scope, setScope] = _lr_us("all");
  const [showAI, setShowAI] = _lr_us(false);
  const [view, setView] = _lr_us("facts"); // facts | contradictions | ai

  const filteredFacts = scope === "all"
    ? CANON_FACTS
    : CANON_FACTS.filter((f) => f.scope.includes(scope === "world" ? "world" : scope === "magic" ? "magic" : scope === "history" ? "historical" : scope === "cultural" ? "cultural" : scope === "language" ? "language" : scope === "faction" ? "faction" : "—"));

  return (
    <div className="lore" data-ui="LorePanelBody">
      <div className="lore-bar">
        <div className="lore-bar__views">
          {[["facts","Canon facts","book"], ["contradictions","Contradictions","warn"], ["ai","AI instructions","sparkle"]].map(([id, lbl, icon]) => (
            <button key={id} className={"lore-bar__view" + (view === id ? " is-on" : "")}
                    onClick={() => setView(id)}>
              <Icon name={icon} size={10}/>
              <span>{lbl}</span>
              {id === "contradictions" && CANON_CONTRADICTIONS.length > 0 && (
                <span className="lore-bar__q">{CANON_CONTRADICTIONS.length}</span>
              )}
            </button>
          ))}
        </div>
        <button className="lore-bar__add" data-callback="onCreateCanonFact">
          <Icon name="plus" size={11}/><span>Add fact</span>
        </button>
      </div>

      {view === "facts" && (
        <div className="lore-scopes">
          {CANON_SCOPES.map((s) => (
            <button key={s.id} className={"lore-scope" + (scope === s.id ? " is-on" : "")}
                    onClick={() => setScope(s.id)}
                    style={{ "--c": s.color }}>
              <span className="lore-scope__sw"/>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="lore-body">
        {view === "facts" && (
          <div className="lore-facts">
            {filteredFacts.map((f) => (
              <article key={f.id} className={"lore-fact lore-fact--" + f.hardness} data-included={f.included}>
                <div className="lore-fact__head">
                  <span className={"lore-fact__hardness lore-fact__hardness--" + f.hardness}>{f.hardness === "hard" ? "HARD CANON" : "SOFT CANON"}</span>
                  <span className="lore-fact__scope">{f.scope}</span>
                  {f.included && <span className="lore-fact__badge lore-fact__badge--include">In Project Intelligence</span>}
                  {f.contradictions > 0 && <span className="lore-fact__badge lore-fact__badge--warn">⚠ Contradiction</span>}
                  <span style={{ flex: 1 }}/>
                  <span className="lore-fact__updated">Updated {f.lastUpdated}</span>
                </div>
                <p className="lore-fact__text">{f.text}</p>
                {f.note && <p className="lore-fact__note">{f.note}</p>}
                <div className="lore-fact__foot">
                  <span className="lore-fact__source">{f.source}</span>
                  {f.linkedEntities.length > 0 && (
                    <span className="lore-fact__chips">
                      {f.linkedEntities.map((e) => (
                        <span key={e} className="lore-fact__chip" data-callback="onLinkCanonToEntity">{e}</span>
                      ))}
                    </span>
                  )}
                  <span style={{ flex: 1 }}/>
                  <ConfidenceBadge level={f.confidence}/>
                </div>
                <div className="lore-fact__actions">
                  <button data-callback="onMarkHardCanon">{f.hardness === "hard" ? "→ Soft" : "→ Hard"}</button>
                  <button data-callback="onEditCanonFact">Edit</button>
                  <button data-callback="onLinkCanonToReference">Link reference</button>
                  <button data-callback="onCopyToProjectIntelligenceFile">{f.included ? "Exclude from AI" : "Include in AI"}</button>
                  <button data-callback="onFlagContradiction" className="lore-fact__actions-warn">Flag contradiction</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {view === "contradictions" && (
          <div className="lore-contras">
            {CANON_CONTRADICTIONS.map((c) => (
              <article key={c.id} className="lore-contra">
                <div className="lore-contra__head">
                  <Icon name="warn" size={11}/>
                  <span>Contradiction</span>
                  <span style={{ flex: 1 }}/>
                </div>
                <div className="lore-contra__split">
                  <div className="lore-contra__col">
                    <div className="lore-contra__lbl">Source A</div>
                    <div className="lore-contra__source">{c.a.source}</div>
                    {c.a.factId && CANON_FACTS.find((f) => f.id === c.a.factId) && (
                      <p className="lore-contra__quote">"{CANON_FACTS.find((f) => f.id === c.a.factId).text}"</p>
                    )}
                    {c.a.text && <p className="lore-contra__quote">{c.a.text}</p>}
                  </div>
                  <div className="lore-contra__vs">vs</div>
                  <div className="lore-contra__col">
                    <div className="lore-contra__lbl">Source B</div>
                    <div className="lore-contra__source">{c.b.source}</div>
                    {c.b.text && <p className="lore-contra__quote">{c.b.text}</p>}
                  </div>
                </div>
                <p className="lore-contra__sum">{c.summary}</p>
                <div className="lore-contra__suggestion">
                  <Icon name="sparkle" size={10}/>
                  <span><b>Suggestion:</b> {c.suggestion}</span>
                </div>
                <div className="lore-contra__actions">
                  <button data-callback="onResolveCanonContradiction">Accept suggestion</button>
                  <button data-callback="onEditCanonFact">Edit</button>
                  <button data-callback="onMergeCanonFact">Merge</button>
                  <button data-callback="onDenyCanonContradiction">Dismiss</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {view === "ai" && (
          <div className="lore-ai">
            <p className="lore-ai__intro">
              These instructions are appended to the AI's context every time it generates text for this project.
            </p>
            {CANON_AI_INSTRUCTIONS.map((i) => (
              <div key={i.id} className="lore-ai__card">
                <span className="lore-ai__bullet">▶</span>
                <p>{i.text}</p>
                <button data-callback="onEditCanonFact">Edit</button>
                <button data-callback="onRemoveCanonFact" className="lore-ai__danger">Remove</button>
              </div>
            ))}
            <button className="lore-ai__add" data-callback="onCreateCanonFact">
              <Icon name="plus" size={11}/><span>Add AI instruction</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// References data
// ---------------------------------------------------------------------
const REFERENCES = [
  { id: "ref1", title: "Hess Court Etiquette — research note",
    type: "research", tags: ["worldbuilding","hess"], linkedEntities: ["f-glass","gc-throne"],
    aiContext: true, canonSource: true, styleSource: false,
    lastOpened: "Yesterday", privacy: "local", sourceState: "active",
    size: "1.2k words", excerpt: "Audience protocol, court seating, who may speak first…" },
  { id: "ref2", title: "Aelinor — voice profile",
    type: "style", tags: ["voice","aelinor","style"], linkedEntities: ["aelinor"],
    aiContext: true, canonSource: false, styleSource: true,
    lastOpened: "3 days ago", privacy: "local", sourceState: "active",
    size: "820 words", excerpt: "Reach contraction, deliberate cadence, weather metaphors…" },
  { id: "ref3", title: "salt-cliffs-reference.jpg",
    type: "image", tags: ["atlas","pale-reach","mood"], linkedEntities: ["ac"],
    aiContext: false, canonSource: false, styleSource: false,
    lastOpened: "1 week ago", privacy: "local", sourceState: "active",
    size: "2.1 MB", excerpt: "Photo reference — Donegal coast, used for the Auger Cliffs." },
  { id: "ref4", title: "Bk I draft — Ch. 11",
    type: "manuscript", tags: ["bk1","reference","canon"], linkedEntities: ["gc"],
    aiContext: true, canonSource: true, styleSource: true,
    lastOpened: "Today", privacy: "local", sourceState: "pinned",
    size: "6.8k words", excerpt: "First Glass Audience scene — establishes the three-day rule." },
  { id: "ref5", title: "Marlowe — style notes (private)",
    type: "instructions", tags: ["author","instructions","style"], linkedEntities: [],
    aiContext: true, canonSource: false, styleSource: true,
    lastOpened: "Yesterday", privacy: "private", sourceState: "active",
    size: "480 words", excerpt: "No epigraphs. Avoid prophesy unless filtered through dialogue…" },
  { id: "ref6", title: "Pale Reach — character pinboard",
    type: "image", tags: ["mood","atlas","cast"], linkedEntities: ["pr","aelinor","brec"],
    aiContext: false, canonSource: false, styleSource: false,
    lastOpened: "5 days ago", privacy: "local", sourceState: "active",
    size: "4 photos · 3 sketches", excerpt: "Visual reference board." },
];

const REF_TYPE_META = {
  research:     { label: "Research",     color: "#3e6db5", icon: "book"    },
  style:        { label: "Style",        color: "#b86a82", icon: "feather" },
  image:        { label: "Image",        color: "#c97a3a", icon: "image"   },
  manuscript:   { label: "Manuscript",   color: "#5d6d4e", icon: "scroll"  },
  instructions: { label: "Instructions", color: "#c98a2c", icon: "sparkle" },
};

// ---------------------------------------------------------------------
// ReferencesPanelBody
// ---------------------------------------------------------------------
const ReferencesPanelBody = ({ panel }) => {
  const [filter, setFilter] = _lr_us("all");
  const [search, setSearch] = _lr_us("");

  const filtered = REFERENCES.filter((r) => {
    if (filter !== "all" && r.type !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="refs" data-ui="ReferencesPanelBody">
      <div className="refs-bar">
        <div className="refs-bar__search">
          <Icon name="search" size={11}/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search references…"/>
        </div>
        <button className="refs-bar__add" data-callback="onUploadReference">
          <Icon name="plus" size={11}/><span>Upload</span>
        </button>
        <button className="refs-bar__add refs-bar__add--paste" data-callback="onPasteReference">
          <Icon name="paper" size={11}/><span>Paste</span>
        </button>
      </div>

      <div className="refs-types">
        <button className={"refs-type" + (filter === "all" ? " is-on" : "")} onClick={() => setFilter("all")}>
          <span>All</span><span className="refs-type__n">{REFERENCES.length}</span>
        </button>
        {Object.entries(REF_TYPE_META).map(([id, m]) => {
          const n = REFERENCES.filter((r) => r.type === id).length;
          return (
            <button key={id}
              className={"refs-type" + (filter === id ? " is-on" : "")}
              onClick={() => setFilter(id)}
              style={{ "--c": m.color }}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              <span className="refs-type__n">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="refs-list">
        {filtered.map((r) => {
          const t = REF_TYPE_META[r.type] || REF_TYPE_META.research;
          return (
            <article key={r.id} className="refs-card" style={{ "--c": t.color }}>
              <div className="refs-card__head">
                <span className="refs-card__type-dot"/>
                <span className="refs-card__type">{t.label}</span>
                <span className="refs-card__title">{r.title}</span>
                {r.privacy === "private" && <span className="refs-card__priv" title="Private — never sent to cloud">🔒</span>}
                {r.sourceState === "pinned" && <Icon name="pin-tack" size={10}/>}
              </div>
              <p className="refs-card__excerpt">{r.excerpt}</p>
              <div className="refs-card__badges">
                {r.aiContext   && <span className="refs-card__badge refs-card__badge--ai">In AI context</span>}
                {r.canonSource && <span className="refs-card__badge refs-card__badge--canon">Canon source</span>}
                {r.styleSource && <span className="refs-card__badge refs-card__badge--style">Style ref</span>}
                {!r.aiContext  && <span className="refs-card__badge refs-card__badge--off">Excluded from AI</span>}
              </div>
              <div className="refs-card__tags">
                {r.tags.map((tag) => <span key={tag} className="refs-card__tag">#{tag}</span>)}
              </div>
              {r.linkedEntities.length > 0 && (
                <div className="refs-card__entities">
                  <span className="refs-card__lbl">Linked:</span>
                  {r.linkedEntities.map((e) => (
                    <button key={e} className="refs-card__entity" data-callback="onOpenRelatedEntity">{e}</button>
                  ))}
                </div>
              )}
              <div className="refs-card__foot">
                <span>{r.size}</span>
                <span>·</span>
                <span>Last opened {r.lastOpened}</span>
                <span style={{ flex: 1 }}/>
                <div className="refs-card__actions">
                  <button data-callback="onToggleReferenceAIContext">{r.aiContext ? "Exclude" : "Include"} AI</button>
                  <button data-callback="onToggleReferenceCanonSource">Canon {r.canonSource ? "✓" : ""}</button>
                  <button data-callback="onToggleReferenceStyleSource">Style {r.styleSource ? "✓" : ""}</button>
                  <button data-callback="onTagReference">Tag</button>
                  <button data-callback="onArchiveReference" className="refs-card__actions-warn">Archive</button>
                </div>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="refs-empty">
            <Icon name="paper" size={20}/>
            <p>No references match.</p>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, {
  CANON_FACTS, CANON_CONTRADICTIONS, CANON_AI_INSTRUCTIONS, CANON_SCOPES,
  REFERENCES, REF_TYPE_META,
  LorePanelBody, ReferencesPanelBody,
});
