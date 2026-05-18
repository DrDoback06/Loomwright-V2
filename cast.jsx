// =====================================================================
// cast.jsx — Cast panel body. Plugged into SlidingPanel/DockedPanel
// when entityType === "cast". Renders all cast UX modes:
//   - browse list (with filters, group-by, mention sparkline)
//   - detail (selected character: hero, identity, traits,
//     relationships, mention timeline, quotes)
//   - multi-select (bulk merge / tag / delete)
//   - edit form
//   - review queue (extraction-detected cast suggestions)
//   - suggestion strip
//   - empty / loading / error
// =====================================================================

const { useState: _us_cast, useMemo: _um_cast, useCallback: _uc_cast } = React;

// ---------------------------------------------------------------------
// Sample cast records — used only when panel.cast is undefined so the
// panel has something rich to show on first paint. App can override by
// setting panel.cast = [...].
// ---------------------------------------------------------------------
const CAST_SAMPLE = [
  {
    id: "c1", name: "Aelinor Vey", initials: "AV",
    role: "protagonist", status: "alive", queue: 0,
    title: "Queen of the Pale Reach",
    epithet: "the small dark queen of the Pale Reach",
    affiliation: "House Vey", origin: "Pale Reach",
    firstSeen: "Ch. 1, p. 12", lastSeen: "Ch. 7, p. 188",
    chapterRange: "Ch. 1–7",
    age: "twenty-nine winters", pronouns: "she/her",
    traits: [
      { label: "watchful", tone: "positive" },
      { label: "patient", tone: "positive" },
      { label: "secret-keeping", tone: "negative" },
      { label: "dry-witted" },
    ],
    relationships: [
      { id: "c2", name: "Saren of Hess", initials: "SH", kind: "rival", strength: 4 },
      { id: "c3", name: "Captain Brec", initials: "CB", kind: "loyal-to", strength: 3 },
      { id: "c5", name: "Mara of Hess", initials: "MH", kind: "sister-in-law", strength: 2 },
    ],
    mentionsByChapter: [12, 8, 4, 7, 3, 9, 14, 6, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "She had learned to wait. Pale Reach taught patience the way the sea taught salt.", cite: "Ch. 1, p. 14" },
      { text: "\"Bring me the auger,\" Aelinor said, \"and the man who carries it.\"", cite: "Ch. 7, p. 188" },
    ],
    summary: "Reigning queen of the Pale Reach. Inherits the Auger crisis from her father; opens negotiations with House Hess in Ch. 3 and breaks them in Ch. 7.",
    stats: [
      { k: "Resolve",   v: 9, max: 10 },
      { k: "Cunning",   v: 8, max: 10 },
      { k: "Compassion",v: 5, max: 10 },
      { k: "Martial",   v: 4, max: 10 },
    ],
    abilities: [
      { name: "Court tongue", desc: "Reads a room before a room knows it is read.", source: "Established Ch. 1" },
      { name: "Salt-bearing", desc: "Endures the Reach's winter without complaint.", source: "Implied Ch. 2" },
      { name: "Letter-locking", desc: "Can fold a paper such that no eye but the recipient's may open it whole.", source: "Ch. 5" },
    ],
    skillTree: {
      branches: [
        { name: "Diplomacy",  nodes: [
          { name: "Listen",       state: "mastered" },
          { name: "Hold the floor",state: "mastered" },
          { name: "Bind a treaty",state: "earned"   },
          { name: "Break a treaty",state: "emerging"},
        ]},
        { name: "Statecraft", nodes: [
          { name: "Read the ledger", state: "mastered" },
          { name: "Spend the granary",state: "earned" },
          { name: "Coin a new house", state: "locked" },
        ]},
      ],
    },
    inventory: [
      { name: "The Vey signet",     kind: "regalia",  notable: true,  note: "Worn since the coronation. Unbroken." },
      { name: "Father's bone-knife",kind: "weapon",   notable: true,  note: "Carried since Ch. 1. Drawn once, in Ch. 7." },
      { name: "Saren's first letter",kind: "document", notable: false, note: "Kept in the inner desk." },
      { name: "Salt cloak",          kind: "garment",  notable: false, note: null },
    ],
    relatedAtlas: [{ id: "a1", label: "Pale Reach" }, { id: "a2", label: "Vraska Pass" }],
    relatedTimeline: [{ id: "t2", label: "Brec's letter" }],
  },
  {
    id: "c2", name: "Saren of Hess", initials: "SH",
    role: "antagonist", status: "alive", queue: 1,
    title: "Heir of Hess",
    epithet: "all teeth and tallow-smile",
    affiliation: "House Hess", origin: "Hess",
    firstSeen: "Ch. 3, p. 67", lastSeen: "Ch. 7, p. 192",
    chapterRange: "Ch. 3–7",
    age: "thirty-four", pronouns: "he/him",
    traits: [
      { label: "ambitious", tone: "negative" },
      { label: "well-spoken", tone: "positive" },
      { label: "resentful", tone: "negative" },
    ],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "rival", strength: 4 },
      { id: "c5", name: "Mara of Hess", initials: "MH", kind: "sister", strength: 3 },
    ],
    mentionsByChapter: [0, 0, 6, 11, 5, 8, 9, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "\"The Reach has had its years,\" he told the auger. \"Now Hess takes the next.\"", cite: "Ch. 4, p. 102" },
    ],
    summary: "Heir to House Hess; gambit-runner. Suspected source of the leaked auger letters in Ch. 6.",
    stats: [
      { k: "Resolve",   v: 6, max: 10 },
      { k: "Cunning",   v: 9, max: 10 },
      { k: "Compassion",v: 2, max: 10 },
      { k: "Martial",   v: 7, max: 10 },
    ],
    abilities: [
      { name: "Tallow-smile", desc: "Disarms a stranger inside three sentences.", source: "Ch. 3" },
      { name: "Letter-cracking", desc: "Opens what was meant to be sealed; leaves no obvious mark.", source: "Ch. 6" },
    ],
    skillTree: {
      branches: [
        { name: "Court", nodes: [
          { name: "Charm",     state: "mastered" },
          { name: "Goad",      state: "mastered" },
          { name: "Conspire",  state: "earned" },
        ]},
        { name: "Blade", nodes: [
          { name: "Train",     state: "earned" },
          { name: "Best a peer",state: "emerging" },
        ]},
      ],
    },
    inventory: [
      { name: "Hess sigil-ring", kind: "regalia", notable: true, note: "Twin to Mara's." },
      { name: "Pale Reach map",  kind: "document", notable: true, note: "Annotated. How did he come by it?" },
      { name: "Slim dagger",      kind: "weapon", notable: false, note: null },
    ],
    relatedAtlas: [{ id: "a3", label: "Hess" }],
    relatedTimeline: [],
  },
  {
    id: "c3", name: "Captain Brec", initials: "CB",
    role: "supporting", status: "alive", queue: 0,
    title: "Captain of the Reach Watch",
    epithet: "broad as a barn-door, soft as wet rope",
    affiliation: "Pale Reach", origin: "Vraska Pass",
    firstSeen: "Ch. 2, p. 41", lastSeen: "Ch. 5, p. 144",
    chapterRange: "Ch. 2–5",
    age: "forty-one", pronouns: "he/him",
    traits: [
      { label: "loyal", tone: "positive" },
      { label: "homesick", tone: "negative" },
      { label: "blunt", tone: "positive" },
    ],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "sworn-to", strength: 4 },
    ],
    mentionsByChapter: [0, 4, 6, 5, 7, 0, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "Brec said nothing for a long while. Then: \"I'll go. I won't like it.\"", cite: "Ch. 5, p. 144" },
    ],
    summary: "Captain of the Reach Watch; Aelinor's right hand. Carries the Ch. 5 letter to Hess at personal cost.",
  },
  {
    id: "c4", name: "The Auger", initials: "TA",
    role: "minor", status: "unknown", queue: 0,
    title: null,
    epithet: "the man who reads the bone",
    affiliation: null, origin: null,
    firstSeen: "Ch. 7, p. 184", lastSeen: "Ch. 7, p. 199",
    chapterRange: "Ch. 7",
    age: "uncertain", pronouns: "they/them",
    traits: [{ label: "ominous" }, { label: "ambiguous" }],
    relationships: [],
    mentionsByChapter: [0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "The auger did not look at the queen. The auger did not look at anything one could name.", cite: "Ch. 7, p. 186" },
    ],
    summary: "Bone-reader summoned in Ch. 7. Identity, faction, and motive all unconfirmed.",
  },
  {
    id: "c5", name: "Mara of Hess", initials: "MH",
    role: "supporting", status: "alive", queue: 0,
    title: "Lady of the Hess",
    epithet: "kinder than her brother by half",
    affiliation: "House Hess", origin: "Hess",
    firstSeen: "Ch. 4, p. 91", lastSeen: "Ch. 4, p. 96",
    chapterRange: "Ch. 4",
    age: "twenty-six", pronouns: "she/her",
    traits: [{ label: "warm", tone: "positive" }, { label: "torn" }],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "sister-in-law", strength: 2 },
      { id: "c2", name: "Saren of Hess", initials: "SH", kind: "sister", strength: 3 },
    ],
    mentionsByChapter: [0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [],
    summary: "Saren's younger sister. Possible bridge between the Houses; underused so far.",
  },
  {
    id: "c6", name: "Dav the Quiet", initials: "DQ",
    role: "minor", status: "dead", queue: 1,
    title: null,
    epithet: "the boy who carried letters",
    affiliation: "Pale Reach", origin: "Reach docks",
    firstSeen: "Ch. 6, p. 162", lastSeen: "Ch. 6, p. 171",
    chapterRange: "Ch. 6",
    age: "fifteen", pronouns: "he/him",
    traits: [{ label: "small" }, { label: "watchful", tone: "positive" }],
    relationships: [{ id: "c3", name: "Captain Brec", initials: "CB", kind: "ward-of", strength: 2 }],
    mentionsByChapter: [0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [{ text: "Dav the Quiet was found at the dock-foot, the letter still in his collar.", cite: "Ch. 6, p. 171" }],
    summary: "Letter-runner. Killed in Ch. 6; the letter triggers Brec's ride.",
  },
];

// Suggestion items (extraction-detected cast not yet confirmed)
const CAST_SUGGESTIONS_SAMPLE = [
  { id: "s1", name: "The Auger of Hess", level: "uncertain", value: 61,
    excerpt: "She remembered now — the boy had spoken of <mark>the Auger of Hess</mark>, his eyes wide as plates.",
    cite: "Ch. 7, p. 191", reason: "Compound-name match with existing 'The Auger'. Possible merge." },
  { id: "s2", name: "Sister Vell", level: "strong", value: 84,
    excerpt: "<mark>Sister Vell</mark> brought tea and waited, hands folded in the way of the Order.",
    cite: "Ch. 5, p. 138", reason: "New named figure; appears once but addressed by title." },
  { id: "s3", name: "the bone-cutter", level: "weak", value: 31,
    excerpt: "Brec had once known <mark>the bone-cutter</mark> from his Vraska days, a man of small jokes.",
    cite: "Ch. 5, p. 142", reason: "Definite article + role; may be a referent rather than a person." },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const ROLE_ORDER = ["protagonist", "antagonist", "supporting", "minor"];
const ROLE_LABEL = {
  protagonist: "Protagonist",
  antagonist:  "Antagonist",
  supporting:  "Supporting",
  minor:       "Minor",
};
const REL_KIND_LABEL = {
  "rival":         "Rival",
  "loyal-to":      "Loyal to",
  "sworn-to":      "Sworn to",
  "sister":        "Sister",
  "sister-in-law": "Sister-in-law",
  "ward-of":       "Ward of",
};

// Sparkline (12 chapters)
const CastSpark = ({ data, current }) => {
  const max = Math.max(1, ...data);
  return (
    <div className="cast-row__spark" aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          className="cast-row__spark__bar"
          style={{ height: Math.max(2, (v / max) * 14) + "px", opacity: v === 0 ? 0.25 : 1 }}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastRow — single character row in the browse list
// ---------------------------------------------------------------------
const CastRow = ({ c, isSelected, isMulti, multiMode, onSelect, onToggleMulti }) => {
  const onClick = (e) => {
    if (multiMode) { onToggleMulti && onToggleMulti(c); return; }
    if (e.metaKey || e.ctrlKey) { onToggleMulti && onToggleMulti(c, true); return; }
    onSelect && onSelect(c);
  };
  return (
    <div
      className={"cast-row" + (isSelected ? " is-selected" : "") + (isMulti ? " is-multi" : "")}
      data-ui="CastRow"
      data-cast-id={c.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      <div className="cast-row__check" aria-hidden>{isMulti && <Icon name="check" size={10}/>}</div>
      <div className={"cast-row__monogram" + (c.status === "unknown" ? " cast-row__monogram--unknown" : "")}>
        {c.initials || "?"}
        <span className={"cast-row__monogram__status cast-row__monogram__status--" + c.status}/>
      </div>
      <div className="cast-row__identity">
        <span className="cast-row__name">{c.name}</span>
        <span className={"cast-row__role cast-row__role--" + c.role}>{ROLE_LABEL[c.role] || c.role}</span>
      </div>
      <div className="cast-row__subline">{c.epithet || c.title || c.summary}</div>
      <div className="cast-row__meta">
        <span className="cast-row__chapters">{c.chapterRange}</span>
        <CastSpark data={c.mentionsByChapter || []} current={c.currentChapter}/>
        <div className="cast-row__badges">
          {c.queue ? <ReviewCountBadge count={c.queue}/> : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastBrowse — the list with filters + group-by-role + multi-select bar
// ---------------------------------------------------------------------
const CastBrowse = ({ cast, selectedId, multiSelected, multiMode, onSelect, onToggleMulti, onClearMulti, onMergeMulti, onTagMulti, onDeleteMulti, onCreate, onEnterMultiMode }) => {
  const [tab, setTab] = _us_cast("browse"); // browse | review | suggestions
  const [statusFilter, setStatusFilter] = _us_cast("all"); // all | alive | dead | missing | unknown
  const [groupBy, setGroupBy] = _us_cast("role"); // role | none | status

  const filtered = _um_cast(() => {
    if (statusFilter === "all") return cast;
    return cast.filter((c) => c.status === statusFilter);
  }, [cast, statusFilter]);

  const grouped = _um_cast(() => {
    if (groupBy === "none") return [{ key: "all", label: null, items: filtered }];
    if (groupBy === "status") {
      const order = ["alive", "missing", "unknown", "dead"];
      const lbl = { alive: "Living", missing: "Missing", unknown: "Unconfirmed", dead: "Dead" };
      return order.map((k) => ({ key: k, label: lbl[k], items: filtered.filter((c) => c.status === k) }))
                  .filter((g) => g.items.length);
    }
    return ROLE_ORDER.map((r) => ({ key: r, label: ROLE_LABEL[r], items: filtered.filter((c) => c.role === r) }))
                     .filter((g) => g.items.length);
  }, [filtered, groupBy]);

  const reviewCount = cast.reduce((a, c) => a + (c.queue || 0), 0);
  const suggestionCount = CAST_SUGGESTIONS_SAMPLE.length;

  return (
    <div className={"cast" + (multiMode ? " is-multi-mode" : "")}>
      {/* Sub-tabs */}
      <div className="cast__subtabs" role="tablist">
        <button className={"cast__subtab" + (tab === "browse" ? " is-active" : "")} onClick={() => setTab("browse")}>
          Browse <span className="cast__subtab__count">{cast.length}</span>
        </button>
        <button className={"cast__subtab" + (tab === "review" ? " is-active" : "")} onClick={() => setTab("review")}>
          Review {reviewCount ? <span className="cast__subtab__count">{reviewCount}</span> : null}
        </button>
        <button className={"cast__subtab" + (tab === "suggestions" ? " is-active" : "")} onClick={() => setTab("suggestions")}>
          Suggested <span className="cast__subtab__count">{suggestionCount}</span>
        </button>
      </div>

      {tab === "browse" && (
        <>
          {/* Filter bar */}
          <div className="cast__filterbar">
            <span className="cast__filterbar__lbl">Status</span>
            {["all", "alive", "missing", "unknown", "dead"].map((s) => (
              <button key={s}
                className={"cast__filter-chip" + (statusFilter === s ? " is-active" : "")}
                onClick={() => setStatusFilter(s)}
              >{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>
            ))}
            <span style={{ flex: 1 }}/>
            <span className="cast__filterbar__lbl">Group</span>
            {[["role","Role"], ["status","Status"], ["none","Flat"]].map(([k, l]) => (
              <button key={k}
                className={"cast__filter-chip" + (groupBy === k ? " is-active" : "")}
                onClick={() => setGroupBy(k)}
              >{l}</button>
            ))}
          </div>

          {/* Groups & rows */}
          {grouped.map((g) => (
            <div key={g.key}>
              {g.label && (
                <div className="cast__group-label">
                  <span>{g.label}</span>
                  <span className="cast__group-label__count">{g.items.length}</span>
                  <span className="cast__group-label__rule"/>
                </div>
              )}
              <div className="cast__list">
                {g.items.map((c) => (
                  <CastRow key={c.id} c={c}
                    isSelected={c.id === selectedId}
                    isMulti={multiSelected && multiSelected.has(c.id)}
                    multiMode={multiMode}
                    onSelect={onSelect}
                    onToggleMulti={(c, enterMulti) => {
                      if (enterMulti && !multiMode) onEnterMultiMode && onEnterMultiMode();
                      onToggleMulti && onToggleMulti(c);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Multi-select sticky action bar */}
          {multiMode && multiSelected && multiSelected.size > 0 && (
            <div className="cast-multibar" data-ui="CastMultiBar">
              <div className="cast-multibar__count"><strong>{multiSelected.size}</strong> selected</div>
              <Btn variant="outline" size="sm" icon="link" onClick={onMergeMulti} data-callback="onMergeEntity">Merge</Btn>
              <Btn variant="outline" size="sm" icon="bookmark" onClick={onTagMulti} data-callback="onTagEntities">Tag</Btn>
              <Btn variant="ghost" size="sm" icon="trash" onClick={onDeleteMulti} data-callback="onDeleteEntities">Delete</Btn>
              <Btn variant="ghost" size="sm" icon="close" onClick={onClearMulti} title="Cancel multi-select"/>
            </div>
          )}
        </>
      )}

      {tab === "review" && <CastReviewList cast={cast.filter((c) => c.queue)}/>}
      {tab === "suggestions" && <CastSuggestionList items={CAST_SUGGESTIONS_SAMPLE}/>}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastDetail — selected character page
// ---------------------------------------------------------------------
const CastDetail = ({ c, onBack, onEdit }) => {
  if (!c) return null;
  return (
    <div className="cast cast-detail" data-ui="CastDetail" data-cast-id={c.id}>
      <button className="cast-detail__back" onClick={onBack} data-callback="onBackToList">
        <Icon name="close" size={9}/> Back to all cast
      </button>

      {/* Hero */}
      <div className="cast-detail__hero">
        <div className="cast-detail__portrait">{c.initials}</div>
        <div className="cast-detail__hero__body">
          <div className="cast-detail__name">{c.name}</div>
          <div className="cast-detail__title-line">{c.epithet || c.title}</div>
          <div className="cast-detail__meta-row">
            <span className={"cast-row__role cast-row__role--" + c.role}>{ROLE_LABEL[c.role]}</span>
            <span className="chip chip--neutral">{c.chapterRange}</span>
            <span className="chip chip--neutral">{(c.mentionsByChapter || []).reduce((a, b) => a + b, 0)} mentions</span>
            {c.queue ? <ReviewCountBadge count={c.queue}/> : null}
          </div>
        </div>
      </div>

      {/* Summary */}
      {c.summary && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Summary</span>
            <button className="cast-section__action" onClick={onEdit} data-callback="onEditEntity">Edit</button>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
            {c.summary}
          </div>
        </div>
      )}

      {/* Identity facts */}
      <div className="cast-section">
        <div className="cast-section__head">
          <span className="cast-section__title">Identity</span>
        </div>
        <div className="cast-fields">
          {c.title       && (<><div className="cast-fields__k">Title</div><div className="cast-fields__v">{c.title}</div></>)}
          {c.affiliation && (<><div className="cast-fields__k">Affiliation</div><div className="cast-fields__v">{c.affiliation}</div></>)}
          {c.origin      && (<><div className="cast-fields__k">Origin</div><div className="cast-fields__v">{c.origin}</div></>)}
          {c.age         && (<><div className="cast-fields__k">Age</div><div className="cast-fields__v">{c.age}</div></>)}
          {c.pronouns    && (<><div className="cast-fields__k">Pronouns</div><div className="cast-fields__v">{c.pronouns}</div></>)}
          <div className="cast-fields__k">First seen</div><div className="cast-fields__v">{c.firstSeen}</div>
          <div className="cast-fields__k">Last seen</div><div className="cast-fields__v">{c.lastSeen}</div>
        </div>
      </div>

      {/* Traits */}
      {c.traits && c.traits.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Traits</span>
            <button className="cast-section__action" data-callback="onAddTrait">+ Add</button>
          </div>
          <div className="cast-traits">
            {c.traits.map((t, i) => (
              <span key={i} className={"cast-trait" + (t.tone ? " cast-trait--" + t.tone : "")}>{t.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {c.relationships && c.relationships.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Relationships</span>
            <button className="cast-section__action" data-callback="onAddRelationship">+ Link</button>
          </div>
          <div className="cast-rels">
            {c.relationships.map((r) => (
              <div key={r.id} className="cast-rel" data-callback="onSelectRelated">
                <div className="cast-rel__avatar">{r.initials}</div>
                <div className="cast-rel__lbl">
                  <span className="cast-rel__name">{r.name}</span>
                  <span className="cast-rel__kind">{REL_KIND_LABEL[r.kind] || r.kind}</span>
                </div>
                <div className="cast-rel__strength" title={"Strength " + r.strength + "/4"}>
                  {[1,2,3,4].map((i) => (
                    <span key={i} className={"cast-rel__strength__pip" + (i <= r.strength ? " is-on" : "")}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mention timeline */}
      {c.mentionsByChapter && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Mentions across the manuscript</span>
            <button className="cast-section__action" data-callback="onJumpManuscript">Jump to first</button>
          </div>
          <div className="cast-mentions">
            <div className="cast-mentions__strip">
              {c.mentionsByChapter.map((v, i) => {
                const max = Math.max(1, ...c.mentionsByChapter);
                const h = v === 0 ? 8 : Math.max(8, (v / max) * 28);
                return (
                  <div key={i}
                    className={"cast-mentions__bar" + (v === 0 ? " is-empty" : "") + ((i + 1) === c.currentChapter ? " is-current" : "")}
                    style={{ height: h + "px" }}
                    title={"Ch. " + (i + 1) + " — " + v + " mention" + (v === 1 ? "" : "s")}
                  />
                );
              })}
            </div>
            <div className="cast-mentions__axis">
              <span>Ch. 1</span>
              <span>Ch. {c.mentionsByChapter.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quotes */}
      {c.quotes && c.quotes.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Selected lines</span>
            <button className="cast-section__action" data-callback="onShowAllQuotes">All ({c.quotes.length})</button>
          </div>
          <div className="cast-quotes">
            {c.quotes.map((q, i) => (
              <div key={i} className="cast-quote" data-callback="onJumpQuote">
                "{q.text}"
                <span className="cast-quote__cite">{q.cite}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {c.stats && c.stats.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Stats</span>
            <button className="cast-section__action" data-callback="onEditStats">Edit</button>
          </div>
          <CastStats stats={c.stats}/>
        </div>
      )}

      {/* Abilities */}
      {c.abilities && c.abilities.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Abilities</span>
            <button className="cast-section__action" data-callback="onAddAbility">+ Add</button>
          </div>
          <CastShowMore threshold={2}>
            {c.abilities.map((a, i) => (
              <CastAbilities key={i} items={[a]}/>
            ))}
          </CastShowMore>
        </div>
      )}

      {/* Skill tree */}
      {c.skillTree && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Skill tree</span>
            <button className="cast-section__action" data-callback="onOpenSkillTree">Open full tree →</button>
          </div>
          <CastSkillTree tree={c.skillTree}/>
        </div>
      )}

      {/* Equipment Slots — RPG-style hookup for Items panel */}
      <div className="cast-section">
        <div className="cast-section__head">
          <span className="cast-section__title">Equipment</span>
          <span className="cast-section__hint" style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>Drag items here</span>
          <button className="cast-section__action" data-callback="onOpenItemsTab"
            onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }))}>
            Open in Items →
          </button>
        </div>
        <CastEquipmentSlots cast={c}/>
      </div>

      {/* Inventory */}
      {c.inventory && c.inventory.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Carried inventory</span>
            <button className="cast-section__action" data-callback="onOpenItemsTab"
              onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }))}>
              Open in Items →
            </button>
          </div>
          <CastShowMore threshold={3}>
            {c.inventory.map((it, i) => (
              <CastInventory key={i} items={[it]}/>
            ))}
          </CastShowMore>
        </div>
      )}

      {/* Open related tab links */}
      {((c.relatedAtlas && c.relatedAtlas.length) || (c.relatedTimeline && c.relatedTimeline.length)) && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Open related tab</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.relatedAtlas && c.relatedAtlas.map((r) => (
              <Btn key={"a-"+r.id} variant="outline" size="sm" icon="map" data-callback="onOpenAtlasFor">{r.label} in Atlas →</Btn>
            ))}
            {c.relatedTimeline && c.relatedTimeline.map((r) => (
              <Btn key={"t-"+r.id} variant="outline" size="sm" icon="clock" data-callback="onOpenTimelineFor">{r.label} on Timeline →</Btn>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: "flex", gap: 6, paddingTop: "var(--sp-4)", borderTop: "1px dashed var(--line-2)" }}>
        <Btn variant="primary" size="sm" icon="paper" data-callback="onJumpManuscript">Open in manuscript</Btn>
        <Btn variant="outline" size="sm" icon="link" data-callback="onLinkEntity">Link…</Btn>
        <Btn variant="ghost" size="sm" icon="more" data-callback="onCastMore" title="More"/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastEdit — edit form for a character
// ---------------------------------------------------------------------
const CastEdit = ({ c, onCancel, onSave }) => {
  const [form, setForm] = _us_cast({
    name:        c?.name        || "",
    title:       c?.title       || "",
    epithet:     c?.epithet     || "",
    role:        c?.role        || "supporting",
    status:      c?.status      || "alive",
    affiliation: c?.affiliation || "",
    origin:      c?.origin      || "",
    pronouns:    c?.pronouns    || "",
    summary:     c?.summary     || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="cast cast-edit" data-ui="CastEdit">
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Name<span className="cast-edit__lbl__req">*</span></label>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="As they appear in the manuscript"/>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Title</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Queen of the Pale Reach"/>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Pronouns</label>
          <input value={form.pronouns} onChange={(e) => set("pronouns", e.target.value)} placeholder="she/her"/>
        </div>
      </div>
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Epithet</label>
        <input value={form.epithet} onChange={(e) => set("epithet", e.target.value)} placeholder="A line that captures them"/>
        <span className="cast-edit__hint">Shown as the italic subline in lists.</span>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Role</label>
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="protagonist">Protagonist</option>
            <option value="antagonist">Antagonist</option>
            <option value="supporting">Supporting</option>
            <option value="minor">Minor</option>
          </select>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Status</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="alive">Alive</option>
            <option value="missing">Missing</option>
            <option value="unknown">Unconfirmed</option>
            <option value="dead">Dead</option>
          </select>
        </div>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Affiliation</label>
          <input value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} placeholder="House, faction, order…"/>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Origin</label>
          <input value={form.origin} onChange={(e) => set("origin", e.target.value)}/>
        </div>
      </div>
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Summary</label>
        <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Two sentences. Who they are; what they want."/>
      </div>
      <div className="cast-edit__actions">
        <Btn variant="ghost" size="sm" onClick={onCancel} data-callback="onCancelEdit">Cancel</Btn>
        <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract more</Btn>
        <Btn variant="primary" size="sm" onClick={() => onSave && onSave(form)} data-callback="onSave">Save</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastReviewList — items already created but flagged for review
// ---------------------------------------------------------------------
const CastReviewList = ({ cast }) => {
  if (!cast || !cast.length) {
    return (
      <div className="cast-empty">
        <div className="cast-empty__seal">✓</div>
        <div className="cast-empty__title">Nothing to review</div>
        <div className="cast-empty__body">Every cast member is confirmed. New extractions will surface here.</div>
      </div>
    );
  }
  return (
    <div className="cast-review">
      {cast.map((c) => (
        <div key={c.id} className="cast-review__card">
          <div className="cast-review__head">
            <div className="cast-row__monogram">{c.initials}</div>
            <div className="cast-review__name">{c.name}</div>
            <ConfidenceBadge level="uncertain" value={62}/>
          </div>
          <div className="cast-review__excerpt" dangerouslySetInnerHTML={{
            __html: '"' + (c.epithet || c.summary).replace(c.name, '<mark>' + c.name + '</mark>') + '"'
          }}/>
          <div className="cast-review__meta">
            <Icon name="paper" size={10}/> {c.firstSeen}
            <span style={{ flex: 1 }}/>
            <span>queued by extractor · 2m ago</span>
          </div>
          <div className="cast-review__actions">
            <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
            <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem">Merge…</Btn>
            <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Deny</Btn>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastSuggestionList — extraction-only suggestions, never committed
// ---------------------------------------------------------------------
const CastSuggestionList = ({ items }) => (
  <div className="cast-review">
    <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-3)", fontStyle: "italic", marginBottom: 4 }}>
      Detected in the current chapter. Nothing here has been added to your cast yet.
    </div>
    {items.map((s) => (
      <div key={s.id} className="cast-review__card">
        <div className="cast-review__head">
          <div className="cast-row__monogram cast-row__monogram--unknown">{s.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
          <div className="cast-review__name">{s.name}</div>
          <ConfidenceBadge level={s.level} value={s.value}/>
        </div>
        <div className="cast-review__excerpt" dangerouslySetInnerHTML={{ __html: '"' + s.excerpt + '"' }}/>
        <div className="cast-review__meta">
          <Icon name="paper" size={10}/> {s.cite}
          <span style={{ flex: 1 }}/>
          <span>{s.reason}</span>
        </div>
        <div className="cast-review__actions">
          <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Add to Cast</Btn>
          <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem">Merge…</Btn>
          <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// CastEmpty — no cast at all yet
// ---------------------------------------------------------------------
const CastEmpty = ({ onCreate, onExtract }) => (
  <div className="cast-empty" data-ui="CastEmpty">
    <div className="cast-empty__seal">◐</div>
    <div className="cast-empty__title">No cast yet</div>
    <div className="cast-empty__body">Add the people who walk through your story — or run extraction over the manuscript and let Loomwright find them.</div>
    <div className="cast-empty__actions">
      <Btn variant="primary" size="sm" icon="plus" onClick={onCreate} data-callback="onCreateEntity">Add a character</Btn>
      <Btn variant="outline" size="sm" icon="sparkle" onClick={onExtract} data-callback="onExtractCast">Extract from manuscript</Btn>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// CastPanelBody — top-level dispatcher. Replaces the generic state
// switch when entityType === "cast".
// ---------------------------------------------------------------------
const CastPanelBody = ({ panel, onSelectEntity }) => {
  const cast = (panel && panel.cast) || CAST_SAMPLE;
  const incomingState = panel?.state || "overview";

  // Local UI state for the panel (selection, multi-select, edit view).
  const [view, setView] = _us_cast(incomingState); // overview | selected | edit | empty | loading | error | review | suggestion | multi
  const [selectedId, setSelectedId] = _us_cast(panel?.selected?.id || cast.find((c) => c.role === "protagonist")?.id || cast[0]?.id);
  const [multi, setMulti] = _us_cast(() => new Set());

  // If host changes panel.state (e.g. via demo controls), follow.
  React.useEffect(() => { setView(incomingState); }, [incomingState]);

  const selected = _um_cast(() => cast.find((c) => c.id === selectedId), [cast, selectedId]);

  const onSelect = (c) => {
    setSelectedId(c.id);
    setView("selected");
    onSelectEntity && onSelectEntity({ id: c.id, label: c.name, entityType: "cast" });
  };
  const onToggleMulti = (c) => {
    setMulti((s) => {
      const n = new Set(s);
      if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
      return n;
    });
    setView("multi");
  };

  // Routing — special states first, then default to browse list
  if (view === "loading") return <LoadingState title="Reading the cast register…" lines={5}/>;
  if (view === "error")   return <ErrorState title="Couldn't load cast" body="Local index unreachable. Your characters are safe." onRetry={() => setView("overview")}/>;
  if (view === "empty")   return <CastEmpty onCreate={() => setView("edit")} onExtract={() => setView("loading")}/>;
  if (view === "edit")    return <CastEdit c={selected} onCancel={() => setView("selected")} onSave={() => setView("selected")}/>;
  if (view === "review")    return <div className="cast"><CastReviewList cast={cast.filter((c) => c.queue)}/></div>;
  if (view === "suggestion")return <div className="cast"><CastSuggestionList items={CAST_SUGGESTIONS_SAMPLE}/></div>;
  if (view === "selected" && selected) {
    return <CastDetail c={selected} onBack={() => setView("overview")} onEdit={() => setView("edit")}/>;
  }
  // Default: browse with optional multi-select
  return (
    <CastBrowse
      cast={cast}
      selectedId={selectedId}
      multiSelected={multi}
      multiMode={view === "multi"}
      onEnterMultiMode={() => setView("multi")}
      onSelect={onSelect}
      onToggleMulti={onToggleMulti}
      onClearMulti={() => { setMulti(new Set()); setView("overview"); }}
      onMergeMulti={() => {}}
      onTagMulti={() => {}}
      onDeleteMulti={() => {}}
      onCreate={() => setView("edit")}
    />
  );
};

// ---------------------------------------------------------------------
// Small dossier sub-components
// ---------------------------------------------------------------------
const CastStats = ({ stats }) => (
  <div className="cast-stats">
    {stats.map((s) => (
      <div key={s.k} className="cast-stat">
        <span className="cast-stat__k">{s.k}</span>
        <div className="cast-stat__bar"><div className="cast-stat__bar__fill" style={{ width: ((s.v / s.max) * 100) + "%" }}/></div>
        <span className="cast-stat__v">{s.v}<span className="cast-stat__max">/{s.max}</span></span>
      </div>
    ))}
  </div>
);

const CastAbilities = ({ items }) => (
  <div className="cast-abilities">
    {items.map((a, i) => (
      <div key={i} className="cast-ability">
        <div className="cast-ability__head">
          <span className="cast-ability__name">{a.name}</span>
          <span className="cast-ability__src">{a.source}</span>
        </div>
        <div className="cast-ability__desc">{a.desc}</div>
      </div>
    ))}
  </div>
);

const CastSkillTree = ({ tree }) => (
  <div className="cast-tree">
    {tree.branches.map((b) => (
      <div key={b.name} className="cast-tree__branch">
        <div className="cast-tree__branch-name">{b.name}</div>
        <div className="cast-tree__nodes">
          {b.nodes.map((n, i) => (
            <React.Fragment key={n.name}>
              <div className={"cast-tree__node cast-tree__node--" + n.state} title={n.state}>
                <span className="cast-tree__node__pip"/>
                <span className="cast-tree__node__lbl">{n.name}</span>
              </div>
              {i < b.nodes.length - 1 && <span className="cast-tree__link"/>}
            </React.Fragment>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// CastEquipmentSlots — RPG-style equipment slots; accepts item drops.
// Display-only here; the real wiring goes through onEquipItem callbacks.
// ---------------------------------------------------------------------
const CAST_EQUIP_SLOTS = [
  { id: "head",       label: "Head",        glyph: "◯" },
  { id: "body",       label: "Body",        glyph: "▦" },
  { id: "hands",      label: "Hands",       glyph: "✋" },
  { id: "main-hand",  label: "Main Hand",   glyph: "🗡" },
  { id: "off-hand",   label: "Off Hand",    glyph: "◐" },
  { id: "accessory",  label: "Accessory",   glyph: "◊" },
  { id: "tool",       label: "Tool",        glyph: "⚙" },
  { id: "relic",      label: "Relic",       glyph: "✦" },
  { id: "pack",       label: "Pack",        glyph: "▤" },
  { id: "quest",      label: "Quest",       glyph: "❖" },
];

const CastEquipmentSlots = ({ cast }) => {
  // Demo equipped items keyed by slot id. For Aelinor we wire up known items
  // from the manuscript; other characters get an empty grid.
  const demoEquipped = (() => {
    if (cast && cast.id === "c1") {
      return {
        "body":      { name: "Travel cloak",     itemId: "i-cloak",  condition: "Worn",     chapter: 7 },
        "main-hand": { name: "Bone Auger",       itemId: "i1",       condition: "Heirloom", chapter: 7, warning: "Loaned to Brec" },
        "accessory": { name: "Vey Signet",       itemId: "i2",       condition: "Pristine", chapter: 7 },
        "pack":      { name: "Auger case",       itemId: "i-case",   condition: "Used",     chapter: 7 },
        "quest":     { name: "Saren's letter",   itemId: "i-letter", condition: "Sealed",   chapter: 7 },
      };
    }
    if (cast && cast.id === "c3") {
      return {
        "body":      { name: "Salt-bitten Cloak", itemId: "i3",  condition: "Used",   chapter: 5, warning: "Not his" },
        "off-hand":  { name: "Hess Letter-key",   itemId: "i4",  condition: "Lost",   chapter: 5, warning: "Lost in Brittlewood" },
        "main-hand": { name: "Watch baton",       itemId: "i-baton", condition: "Worn", chapter: 5 },
      };
    }
    return {};
  })();

  return (
    <div className="cast-equip" data-ui="CastEquipmentSlots">
      {CAST_EQUIP_SLOTS.map((slot) => {
        const item = demoEquipped[slot.id];
        return (
          <div
            key={slot.id}
            className={"cast-equip__slot " + (item ? "is-filled" : "is-empty")}
            data-ent-drop="cast"
            onDragOver={(e) => {
              try {
                const types = e.dataTransfer.types;
                if (types && Array.from(types).some((t) => t === "application/x-loom-entity" || t === "text/loomwright-entity")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  e.currentTarget.classList.add("is-over");
                }
              } catch (_err) {}
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove("is-over")}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("is-over");
            }}
          >
            <div className="cast-equip__slot__lbl">{slot.label}</div>
            <div className="cast-equip__slot__glyph">{slot.glyph}</div>
            {item ? (
              <>
                <div className="cast-equip__slot__name">{item.name}</div>
                <div className="cast-equip__slot__sub">
                  {item.condition}
                  {item.warning && <span className="cast-equip__slot__warn" title={item.warning}>⚠</span>}
                </div>
                <div className="cast-equip__slot__actions">
                  <button title="Show item dossier" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }))}>Open</button>
                  <button title="Unequip / move to pack" data-callback="onUnequipItem">Unequip</button>
                </div>
              </>
            ) : (
              <div className="cast-equip__slot__hint">empty</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const CastInventory = ({ items }) => (
  <div className="cast-inv">
    {items.map((it, i) => (
      <div key={i} className={"cast-inv__item" + (it.notable ? " is-notable" : "")}>
        <span className={"cast-inv__kind cast-inv__kind--" + it.kind} title={it.kind}/>
        <div className="cast-inv__body">
          <div className="cast-inv__name">{it.name}{it.notable && <span className="cast-inv__star" title="Plot-significant">★</span>}</div>
          {it.note && <div className="cast-inv__note">{it.note}</div>}
        </div>
        <span className="cast-inv__kind-lbl">{it.kind}</span>
      </div>
    ))}
  </div>
);

// Section wrapper with optional Show More collapse
const CastShowMore = ({ children, threshold = 3, more = "Show all", less = "Show less" }) => {
  const [open, setOpen] = _us_cast(false);
  const arr = React.Children.toArray(children);
  if (arr.length <= threshold) return <>{children}</>;
  return (
    <>
      {open ? arr : arr.slice(0, threshold)}
      <button className="cast-section__action" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setOpen(!open)}>
        {open ? less : (more + " (" + arr.length + ")")}
      </button>
    </>
  );
};

Object.assign(window, {
  CastPanelBody, CastBrowse, CastDetail, CastEdit, CastReviewList, CastSuggestionList, CastEmpty,
  CastStats, CastAbilities, CastSkillTree, CastInventory, CastEquipmentSlots, CastShowMore,
  CAST_SAMPLE, CAST_SUGGESTIONS_SAMPLE,
});
