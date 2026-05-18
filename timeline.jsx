// =====================================================================
// timeline.jsx — Timeline workspace.
//
// Modes: book / chronological / character / location / quest / faction
//        / relationship / item / review
//
// Default orientation: vertical (compact); horizontal when panel
// expanded — driven by `panel.expanded`.
// =====================================================================

const { useState: _tl_us, useMemo: _tl_um, useCallback: _tl_uc } = React;

// ---------------------------------------------------------------------
// Demo events — book order + chronological order with deltas.
// ---------------------------------------------------------------------
const TL_ERAS = [
  { id: "pre", label: "Before the Story", color: "#76684c", from: -200, to: 0 },
  { id: "ch", label: "The Hollow Crown",   color: "#3e6db5", from: 0,   to: 60 },
  { id: "after", label: "After",          color: "#9a8c6e", from: 60,  to: 100 },
];

const TL_EVENTS = [
  { id: "e1", label: "Treaty of Brittlewood", chapter: null, era: "pre",
    date: "Year 738 of Hess", dateType: "exact", confidence: "high", canon: "hard",
    entities: ["brec","saren"], locationId: "tg", quest: null,
    summary: "Treaty signed; broken in the same season. Brec broke Saren's brother's nose.",
    flashback: false, source: "Ch. 5 · p. 134" },
  { id: "e2", label: "Auger's first walk",  chapter: null, era: "pre",
    date: "Year 740, approx.", dateType: "approx", confidence: "uncertain", canon: "soft",
    entities: ["auger","aelinor"], locationId: "ac", quest: null,
    summary: "The Auger walks the cliffs while Aelinor is being born.",
    flashback: false, source: "Ch. 6 · p. 184" },

  { id: "e3", label: "Pale Reach arrival",  chapter: 1, era: "ch",
    date: "Day 1",  dateType: "exact", confidence: "high", canon: "hard",
    entities: ["aelinor","brec"], locationId: "pr", quest: null,
    summary: "Aelinor enters the Reach with the Auger Stone case.",
    flashback: false, source: "Ch. 1 · p. 12" },
  { id: "e4", label: "Brec's letter",       chapter: 1, era: "ch",
    date: "Three nights prior", dateType: "approx", confidence: "strong", canon: "hard",
    entities: ["brec","aelinor"], locationId: "wd", quest: null,
    summary: "Brec's letter summons Aelinor.",
    flashback: true, source: "Ch. 1 · p. 20" },
  { id: "e5", label: "Salt Watch night",    chapter: 2, era: "ch",
    date: "Day 4",  dateType: "exact", confidence: "high", canon: "hard",
    entities: ["aelinor"], locationId: "sw", quest: null,
    summary: "Aelinor stops at the watchtower.",
    flashback: false, source: "Ch. 2 · p. 41" },
  { id: "e6", label: "Saren's bargain",     chapter: 3, era: "ch",
    date: "Day 7",  dateType: "exact", confidence: "high", canon: "hard",
    entities: ["saren","aelinor"], locationId: "gc-gard", quest: "q2",
    summary: "Saren and Aelinor strike a quiet bargain in the gardens.",
    flashback: false, source: "Ch. 3 · p. 80" },
  { id: "e7", label: "Auger Wake",          chapter: 6, era: "ch",
    date: "Day 18",  dateType: "exact", confidence: "high", canon: "hard",
    entities: ["aelinor","brec"], locationId: "ac", quest: "q1",
    summary: "Wraith attack on the cliffs.",
    flashback: false, source: "Ch. 6 · p. 184" },
  { id: "e8", label: "Glass Audience",      chapter: 7, era: "ch",
    date: "Day 22", dateType: "exact", confidence: "high", canon: "hard",
    entities: ["aelinor","saren","mara"], locationId: "gc-throne", quest: "q2",
    summary: "Audience before the Glass Throne.",
    flashback: false, source: "Ch. 7 · p. 211" },
  { id: "e9", label: "Vraska Crossing (date conflict)", chapter: 4, era: "ch",
    date: "Day 11 or 13?", dateType: "conflict", confidence: "uncertain", canon: "soft",
    entities: ["aelinor","saren"], locationId: "vp", quest: "q2",
    summary: "Vraska crossing — Ch. 2 implies Day 11, Ch. 4 implies Day 13.",
    flashback: false, source: "Ch. 4 vs Ch. 2" },
  { id: "e10", label: "Hess fleet sets out", chapter: 9, era: "ch",
    date: "Future — unset", dateType: "future", confidence: "weak", canon: "soft",
    entities: ["saren"], locationId: "hh", quest: null,
    summary: "Reserved future event.",
    flashback: false, source: "Outline" },
];

const TL_REVIEW = [
  { id: "tq1", lvl: "strong",    title: "New event candidate: Pale Reach Arrival", action: "Add to timeline?", excerpt: "…the light over Pale Reach was the colour of cooled tin when she came through the gate.", cite: "Ch. 1 · p. 12" },
  { id: "tq2", lvl: "uncertain", title: "Vraska Crossing date contradicts Ch. 2",   action: "Resolve contradiction", excerpt: "Ch. 2 implies the crossing was on Day 11.", cite: "Ch. 4 vs Ch. 2" },
  { id: "tq3", lvl: "weak",      title: "Flashback detected: Brec's letter",         action: "Mark as flashback?", excerpt: "Brec wrote the letter three nights before the chapter opens.", cite: "Ch. 1 · p. 20" },
  { id: "tq4", lvl: "strong",    title: "Missing timestamp: Auger Wake",             action: "Set exact date?",    excerpt: "Likely Day 18 based on travel from Salt Watch.", cite: "Ch. 6" },
];

const TL_MODES = [
  { id: "book",          label: "Book",          icon: "book"   },
  { id: "chronological", label: "Chronological", icon: "clock"  },
  { id: "character",     label: "Character",     icon: "user"   },
  { id: "location",      label: "Location",      icon: "pin"    },
  { id: "quest",         label: "Quest",         icon: "scroll" },
  { id: "faction",       label: "Faction",       icon: "banner" },
  { id: "review",        label: "Review",        icon: "bell"   },
];

const _tlCastById = () => Object.fromEntries((window.ATLAS_CAST || []).map((c) => [c.id, c]));
const _tlLocById  = () => Object.fromEntries((window.ATLAS_LOCATIONS || []).map((l) => [l.id, l]));

// ---------------------------------------------------------------------
// Single event card
// ---------------------------------------------------------------------
const TLEventCard = ({ event, orientation, onClick, selected }) => {
  const cast = _tlCastById();
  const locs = _tlLocById();
  const loc = locs[event.locationId];
  const era = TL_ERAS.find((e) => e.id === event.era) || TL_ERAS[1];
  return (
    <button className={"tl-card" + (selected ? " is-on" : "") + (event.flashback ? " is-flashback" : "")}
            data-orientation={orientation}
            onClick={() => onClick && onClick(event)}
            style={{ "--c": era.color }}>
      <div className="tl-card__head">
        <span className="tl-card__date">{event.date}</span>
        {event.chapter != null && <span className="tl-card__chapter">Ch. {event.chapter}</span>}
        {event.dateType === "approx"   && <span className="tl-card__pill" title="Approximate date">~</span>}
        {event.dateType === "conflict" && <span className="tl-card__pill tl-card__pill--warn">!</span>}
        {event.dateType === "future"   && <span className="tl-card__pill">→</span>}
        {event.flashback && <span className="tl-card__pill tl-card__pill--fb">FB</span>}
      </div>
      <div className="tl-card__title">{event.label}</div>
      {event.summary && <div className="tl-card__sum">{event.summary}</div>}
      <div className="tl-card__foot">
        <span className="tl-card__cast">
          {event.entities.slice(0, 3).map((cid) => {
            const c = cast[cid];
            if (!c) return null;
            return (
              <span key={cid} className="tl-card__avatar" style={{ "--c": c.color }}>{c.initials}</span>
            );
          })}
        </span>
        {loc && <span className="tl-card__loc">{loc.name}</span>}
        <span className="tl-card__src">{event.source}</span>
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------
// Vertical timeline (compact)
// ---------------------------------------------------------------------
const TLVerticalView = ({ events, onClick, selectedId }) => (
  <div className="tl-vert">
    {TL_ERAS.map((era) => {
      const es = events.filter((e) => e.era === era.id);
      if (es.length === 0) return null;
      return (
        <div key={era.id} className="tl-vert__era" style={{ "--c": era.color }}>
          <div className="tl-vert__era-head">
            <span className="tl-vert__era-dot"/>
            <span className="tl-vert__era-name">{era.label}</span>
            <span className="tl-vert__era-n">{es.length}</span>
          </div>
          <div className="tl-vert__list">
            {es.map((e) => (
              <div key={e.id} className="tl-vert__row">
                <div className="tl-vert__rail">
                  <span className="tl-vert__pip"/>
                </div>
                <TLEventCard event={e} orientation="vert" onClick={onClick} selected={e.id === selectedId}/>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------
// Horizontal timeline (expanded)
// ---------------------------------------------------------------------
const TLHorizontalView = ({ events, onClick, selectedId }) => (
  <div className="tl-horz">
    <div className="tl-horz__line"/>
    <div className="tl-horz__rows">
      {TL_ERAS.map((era) => {
        const es = events.filter((e) => e.era === era.id);
        if (es.length === 0) return null;
        return (
          <div key={era.id} className="tl-horz__era" style={{ "--c": era.color }}>
            <div className="tl-horz__era-band">
              <span>{era.label}</span>
              <span className="tl-horz__era-n">{es.length}</span>
            </div>
            <div className="tl-horz__track">
              {es.map((e, i) => (
                <div key={e.id} className="tl-horz__item">
                  <div className="tl-horz__pip" style={{ background: era.color }}/>
                  <TLEventCard event={e} orientation="horz" onClick={onClick} selected={e.id === selectedId}/>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ---------------------------------------------------------------------
// Inspector (right column when expanded)
// ---------------------------------------------------------------------
const TLInspector = ({ event, onClose }) => {
  if (!event) return null;
  const cast = _tlCastById();
  const locs = _tlLocById();
  const loc = locs[event.locationId];
  return (
    <div className="tl-insp">
      <div className="tl-insp__head">
        <span className="tl-insp__date">{event.date}</span>
        {event.chapter && <span className="tl-insp__ch">Ch. {event.chapter}</span>}
        <button className="tl-insp__x" onClick={onClose}><Icon name="close" size={11}/></button>
      </div>
      <div className="tl-insp__title">{event.label}</div>
      <p className="tl-insp__sum">{event.summary}</p>
      <div className="tl-insp__rows">
        <TLRow k="Confidence" v={event.confidence}/>
        <TLRow k="Canon"      v={event.canon}/>
        <TLRow k="Date type"  v={event.dateType}/>
        {loc && <TLRow k="Location" v={loc.name}/>}
        {event.quest && <TLRow k="Quest" v={event.quest}/>}
      </div>
      <div className="tl-insp__sec">
        <div className="tl-insp__sech">Cast involved</div>
        <div className="tl-insp__chips">
          {event.entities.map((cid) => {
            const c = cast[cid];
            if (!c) return null;
            return (
              <button key={cid} className="tl-insp__chip" style={{ "--c": c.color }}>
                <span className="tl-insp__chip-avatar">{c.initials}</span>
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="tl-insp__sec">
        <div className="tl-insp__sech">Source</div>
        <div className="tl-insp__source">{event.source}</div>
      </div>
      <div className="tl-insp__actions">
        <button data-callback="onEditTimelineEvent">Edit event</button>
        <button data-callback="onSetTimelineDate">Set date</button>
        <button data-callback="onMarkTimelineFlashback">{event.flashback ? "Clear flashback" : "Mark flashback"}</button>
        <button data-callback="onShowTimelineMomentOnAtlas">Show on Atlas</button>
        <button data-callback="onOpenTimelineSource">Open source</button>
      </div>
    </div>
  );
};

// Local kv row
const TLRow = ({ k, v }) => (
  <div className="tl-row">
    <span className="tl-row__k">{k}</span>
    <span className="tl-row__v">{v}</span>
  </div>
);

// ---------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------
const TLFilters = ({ filters, onToggleFilter }) => {
  const groups = [
    { k: "character", items: (window.ATLAS_CAST || []).slice(0, 6) },
    { k: "location",  items: (window.ATLAS_LOCATIONS || []).filter((l) => l.type === "city" || l.type === "region").slice(0, 6) },
    { k: "quest",     items: (window.ATLAS_QUESTS || []).filter((q) => q.type === "quests") },
    { k: "faction",   items: (window.ATLAS_FACTIONS || []) },
  ];
  return (
    <div className="tl-filt">
      {groups.map((g) => (
        <div key={g.k} className="tl-filt__grp">
          <span className="tl-filt__lbl">{g.k}</span>
          {g.items.map((it) => {
            const on = filters[g.k]?.includes(it.id);
            return (
              <button key={it.id}
                className={"tl-filt__chip" + (on ? " is-on" : "")}
                onClick={() => onToggleFilter(g.k, it.id)}
                style={{ "--c": it.color || "#76684c" }}>
                <span className="tl-filt__chip-sw"/>
                <span>{it.name || it.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Review view (queue)
// ---------------------------------------------------------------------
const TLReviewView = () => (
  <div className="tl-review">
    {TL_REVIEW.map((r) => (
      <div key={r.id} className={"tl-review__card tl-review__card--" + r.lvl}>
        <div className="tl-review__head">
          <ConfidenceBadge level={r.lvl}/>
          <span className="tl-review__title">{r.title}</span>
        </div>
        <p className="tl-review__quote">"{r.excerpt}"</p>
        <div className="tl-review__meta">{r.cite}</div>
        <div className="tl-review__pill">{r.action}</div>
        <div className="tl-review__actions">
          <button data-callback="onAcceptTimelineQueueItem">Accept</button>
          <button data-callback="onEditTimelineQueueItem">Edit</button>
          <button data-callback="onMergeTimelineQueueItem">Merge</button>
          <button data-callback="onDenyTimelineQueueItem">Deny</button>
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// TimelinePanelBody — main entry
// ---------------------------------------------------------------------
const TimelinePanelBody = ({ panel, onSelectEntity }) => {
  const [mode, setMode] = _tl_us("book");
  const [filters, setFilters] = _tl_us({ character: [], location: [], quest: [], faction: [] });
  const [selectedId, setSelectedId] = _tl_us("e7");
  const [showFilters, setShowFilters] = _tl_us(false);

  const onToggleFilter = _tl_uc((k, id) => {
    setFilters((f) => {
      const cur = new Set(f[k] || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...f, [k]: [...cur] };
    });
  }, []);

  // Filtered events
  const events = _tl_um(() => {
    let list = TL_EVENTS;
    if (filters.character.length) list = list.filter((e) => e.entities.some((c) => filters.character.includes(c)));
    if (filters.location.length)  list = list.filter((e) => filters.location.includes(e.locationId));
    if (filters.quest.length)     list = list.filter((e) => filters.quest.includes(e.quest));
    // Sort by mode
    if (mode === "book") {
      return [...list].sort((a, b) => (a.chapter || 99) - (b.chapter || 99));
    }
    return list;
  }, [mode, filters]);

  const selected = TL_EVENTS.find((e) => e.id === selectedId);
  const expanded = panel?.expanded;

  return (
    <div className="tl" data-ui="TimelinePanelBody" data-orientation={expanded ? "horizontal" : "vertical"}>
      <div className="tl-bar">
        <div className="tl-bar__modes">
          {TL_MODES.map((m) => (
            <button key={m.id} className={"tl-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-callback="onSetTimelineMode" data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && <span className="tl-bar__q">{TL_REVIEW.length}</span>}
            </button>
          ))}
        </div>
        <button className={"tl-bar__filt" + (showFilters ? " is-on" : "")} onClick={() => setShowFilters((v) => !v)}>
          <Icon name="filter" size={11}/>
          <span>Filters</span>
          {Object.values(filters).flat().length > 0 && <span className="tl-bar__q">{Object.values(filters).flat().length}</span>}
        </button>
        <button className="tl-bar__add" data-callback="onCreateTimelineEvent">
          <Icon name="plus" size={11}/>
          <span>Add event</span>
        </button>
      </div>

      {showFilters && <TLFilters filters={filters} onToggleFilter={onToggleFilter}/>}

      <div className="tl-grid" data-mode={expanded ? "split" : "stack"}>
        <div className="tl-stage">
          {mode === "review" ? (
            <TLReviewView/>
          ) : expanded ? (
            <TLHorizontalView events={events} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          ) : (
            <TLVerticalView events={events} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          )}
        </div>
        {expanded && mode !== "review" && (
          <div className="tl-rail">
            <TLInspector event={selected} onClose={() => setSelectedId(null)}/>
          </div>
        )}
      </div>

      {!expanded && mode !== "review" && selected && (
        <div className="tl-drawer">
          <TLInspector event={selected} onClose={() => setSelectedId(null)}/>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  TL_EVENTS, TL_ERAS, TL_REVIEW, TL_MODES,
  TimelinePanelBody, TLVerticalView, TLHorizontalView, TLInspector, TLEventCard, TLReviewView, TLFilters,
});
