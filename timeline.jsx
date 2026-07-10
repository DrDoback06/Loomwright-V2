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

// =====================================================================
// Live data adapter — project real `events` entities into the timeline
// shapes the views consume. Returns null when there are no live events so
// the panel falls back to the demo constants above. Pure (no Date/random)
// so the projection is unit-testable at the Node level.
// =====================================================================

const _TL_PALETTE = [
  "#7a6aa3", "#a8553f", "#5d6d4e", "#b78a52", "#6b6f7a", "#8a6b58",
  "#3e6db5", "#b86a82", "#4b8a6f", "#9c6a3c", "#6d5aa0", "#417a86",
];
const _tlHash = (s) => {
  let h = 0; const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const _tlColorFor = (id) => _TL_PALETTE[_tlHash(id) % _TL_PALETTE.length];
const _tlInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
};
const _tlPickId = (v) => (typeof v === "string" ? v : (v && v.id) || null);

// Build the live dataset. `B` defaults to window.LoomwrightBackend but is
// injectable for tests. Null when there are no live events to render.
const buildLiveTimelineDataset = (B) => {
  B = B || (typeof window !== "undefined" && window.LoomwrightBackend);
  if (!B || !B.EntityService || typeof B.EntityService.listSync !== "function") return null;
  const eventRows = B.EntityService.listSync("events") || [];
  if (!eventRows.length) return null;

  // Live cast + location lookup maps (avatars / location names).
  const cast = {};
  for (const e of (B.EntityService.listSync("cast") || [])) {
    if (!e || !e.id) continue;
    cast[e.id] = { id: e.id, name: e.name || "Unknown", initials: e.glyphChar || e.initials || _tlInitials(e.name), color: e.color || (e.data && e.data.color) || _tlColorFor(e.id) };
  }
  const locs = {};
  for (const l of (B.EntityService.listSync("locations") || [])) {
    if (!l || !l.id) continue;
    locs[l.id] = { id: l.id, name: l.name || "Unknown", type: (l.data && l.data.type) || l.type || "" };
  }

  // chapterId -> num, and per-entity earliest chapter num from occurrences.
  const chapterNum = new Map();
  try {
    const st = (B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync) ? B.ManuscriptChapterService.loadSync() : {};
    (st.chapters || []).filter((c) => !c.reserved).forEach((c, i) => chapterNum.set(c.id, c.num || (i + 1)));
  } catch (_) {}
  const firstChapterByEntity = new Map();
  try {
    const occs = (B.OccurrenceService && B.OccurrenceService.listAllSync) ? B.OccurrenceService.listAllSync() : [];
    for (const o of occs) {
      if (!o || !o.entityId) continue;
      const num = chapterNum.get(o.chapterId);
      if (num == null) continue;
      const prev = firstChapterByEntity.get(o.entityId);
      if (prev == null || num < prev) firstChapterByEntity.set(o.entityId, num);
    }
  } catch (_) {}

  // Resolve a related / related-multi value list into cast ids we know.
  const resolveCastIds = (raw) => {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    const out = [];
    for (const v of arr) { const id = _tlPickId(v); if (id && cast[id]) out.push(id); }
    return out;
  };

  const events = eventRows.map((ent) => {
    const d = ent.data || {};
    const chapter = firstChapterByEntity.has(ent.id) ? firstChapterByEntity.get(ent.id) : null;
    const entities = resolveCastIds(d.participants);
    if (!entities.length && Array.isArray(d.relatedEntityIds)) {
      for (const id of d.relatedEntityIds) if (cast[id]) entities.push(id);
    }
    const locId = _tlPickId(d.location);
    const dateText = d.timelinePosition || d.chapter || (chapter != null ? ("Ch. " + chapter) : (d.eventType || ""));
    const future = ent.status === "reserved" || /future|unset|planned/i.test(String(d.timelinePosition || ""));
    const flashback = !!d.flashback || /flashback/i.test(String(d.eventType || "")) || (Array.isArray(d.compositionRoles) && d.compositionRoles.includes("flashback"));
    return {
      id: ent.id,
      label: ent.name || d.title || "Untitled event",
      chapter,
      era: chapter != null ? "ch" : (future ? "after" : "pre"),
      date: dateText || "—",
      dateType: future ? "future" : (d.dateType || "exact"),
      confidence: d.confidence || "strong",
      canon: d.canon || "hard",
      entities,
      locationId: locId && locs[locId] ? locId : null,
      quest: _tlPickId(d.quest) || null,
      summary: ent.summary || d.summary || "",
      flashback,
      source: chapter != null ? ("Ch. " + chapter) : (d.sourceQuote ? "Source quote" : (dateText || "")),
      _entity: ent,
    };
  });

  // Live review queue for events.
  const review = [];
  try {
    const q = (B.ReviewService && B.ReviewService.listSync) ? B.ReviewService.listSync("events") : [];
    for (const item of q) {
      if (item.status && item.status !== "pending" && item.status !== "auto-added") continue;
      const pct = Math.round((item.confidence || 0) * 100);
      const lvl = item.level || (pct >= 90 ? "high" : pct >= 75 ? "strong" : pct >= 50 ? "uncertain" : "weak");
      const num = chapterNum.get(item.chapterId);
      review.push({
        id: item.id, lvl,
        title: item.name || "Event candidate",
        action: item.suggestedAction === "update" ? "Update event" : "Add to timeline?",
        excerpt: item.sourceQuote || item.summary || "",
        cite: num != null ? ("Ch. " + num) : "",
        _item: item,
      });
    }
  } catch (_) {}

  return { live: true, events, cast, locs, review };
};

// Demo dataset — wraps the existing constants so views share one shape.
const buildDemoTimelineDataset = () => ({
  live: false,
  events: TL_EVENTS,
  cast: _tlCastById(),
  locs: _tlLocById(),
  review: TL_REVIEW.map((r) => ({ ...r })),
});

// ---------------------------------------------------------------------
// Single event card
// ---------------------------------------------------------------------
const TLEventCard = ({ event, orientation, onClick, selected, cast = {}, locs = {} }) => {
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
const TLVerticalView = ({ events, onClick, selectedId, cast, locs }) => {
  if (!events.length) return <div className="tl-empty" style={{ padding: 16, color: "var(--ink-3)" }}>No events on the timeline yet.</div>;
  return (
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
                <TLEventCard event={e} orientation="vert" onClick={onClick} selected={e.id === selectedId} cast={cast} locs={locs}/>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
  );
};

// ---------------------------------------------------------------------
// Horizontal timeline (expanded)
// ---------------------------------------------------------------------
const TLHorizontalView = ({ events, onClick, selectedId, cast, locs }) => {
  if (!events.length) return <div className="tl-empty" style={{ padding: 16, color: "var(--ink-3)" }}>No events on the timeline yet.</div>;
  return (
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
                  <TLEventCard event={e} orientation="horz" onClick={onClick} selected={e.id === selectedId} cast={cast} locs={locs}/>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};

// ---------------------------------------------------------------------
// Inspector (right column when expanded)
// ---------------------------------------------------------------------
const TLInspector = ({ event, onClose, cast = {}, locs = {} }) => {
  if (!event) return null;
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
const TLFilters = ({ filters, onToggleFilter, live }) => {
  const ES = window.LoomwrightBackend && window.LoomwrightBackend.EntityService;
  // In a live project, source the filter chips from the real store; otherwise
  // fall back to the demo ATLAS_* globals so the demo view stays populated.
  const pick = (type, demo, limit) => {
    if (live && ES) { const l = ES.listSync(type) || []; return limit ? l.slice(0, limit) : l; }
    return demo;
  };
  const groups = [
    { k: "character", items: pick("cast", (window.ATLAS_CAST || []).slice(0, 6), 6) },
    { k: "location",  items: pick("locations", (window.ATLAS_LOCATIONS || []).filter((l) => l.type === "city" || l.type === "region").slice(0, 6), 6) },
    { k: "quest",     items: pick("quests", (window.ATLAS_QUESTS || []).filter((q) => q.type === "quests")) },
    { k: "faction",   items: pick("factions", (window.ATLAS_FACTIONS || [])) },
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
// Route a review action through the global callback bus so it lands on the
// real ReviewService. Demo items (no `_item`) keep the generic data-callback.
const _tlDispatch = (name, item) =>
  window.LoomwrightDispatchCallback &&
  window.LoomwrightDispatchCallback(name, { detail: item, entityId: item?.entityId, entityType: "events" });

const TLReviewView = ({ review = [] }) => {
  if (!review.length) return <div className="tl-empty" style={{ padding: 16, color: "var(--ink-3)" }}>No event candidates awaiting review.</div>;
  return (
    <div className="tl-review">
      {review.map((r) => {
        const live = !!r._item;
        const on = (name) => (live ? { onClick: () => _tlDispatch(name, r._item) } : { "data-callback": name });
        return (
          <div key={r.id} className={"tl-review__card tl-review__card--" + r.lvl}>
            <div className="tl-review__head">
              <ConfidenceBadge level={r.lvl}/>
              <span className="tl-review__title">{r.title}</span>
            </div>
            {r.excerpt && <p className="tl-review__quote">"{r.excerpt}"</p>}
            {r.cite && <div className="tl-review__meta">{r.cite}</div>}
            <div className="tl-review__pill">{r.action}</div>
            <div className="tl-review__actions">
              <button {...on("onAcceptTimelineQueueItem")}>Accept</button>
              <button {...on("onEditTimelineQueueItem")}>Edit</button>
              <button {...on("onMergeTimelineQueueItem")}>Merge</button>
              <button {...on("onDenyTimelineQueueItem")}>Deny</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------
// TimelinePanelBody — main entry
// ---------------------------------------------------------------------
const TimelinePanelBody = ({ panel, onSelectEntity }) => {
  const [mode, setMode] = _tl_us("book");
  const [filters, setFilters] = _tl_us({ character: [], location: [], quest: [], faction: [] });
  const [selectedId, setSelectedId] = _tl_us(null);
  const [showFilters, setShowFilters] = _tl_us(false);

  // Rebuild from the live store when events / occurrences / review / chapters
  // change, so accepted events appear on the timeline without a reload.
  const [storeVersion, setStoreVersion] = _tl_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated", "lw:occurrences-updated", "lw:manuscript-chapters-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const data = _tl_um(() => buildLiveTimelineDataset() || buildDemoTimelineDataset(), [storeVersion]);

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
    let list = data.events;
    if (filters.character.length) list = list.filter((e) => e.entities.some((c) => filters.character.includes(c)));
    if (filters.location.length)  list = list.filter((e) => filters.location.includes(e.locationId));
    if (filters.quest.length)     list = list.filter((e) => filters.quest.includes(e.quest));
    // Sort by mode
    if (mode === "book") {
      return [...list].sort((a, b) => (a.chapter || 99) - (b.chapter || 99));
    }
    return list;
  }, [mode, filters, data]);

  // Resolve the effective selection against the live events so a stale id from
  // a previous project doesn't blank the inspector.
  const curSelId = (selectedId && data.events.some((e) => e.id === selectedId)) ? selectedId : (events[0]?.id || data.events[0]?.id || null);
  const selected = data.events.find((e) => e.id === curSelId);
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
              {m.id === "review" && data.review.length > 0 && <span className="tl-bar__q">{data.review.length}</span>}
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

      {showFilters && <TLFilters filters={filters} onToggleFilter={onToggleFilter} live={data.live}/>}

      <div className="tl-grid" data-mode={expanded ? "split" : "stack"}>
        <div className="tl-stage">
          {mode === "review" ? (
            <TLReviewView review={data.review}/>
          ) : expanded ? (
            <TLHorizontalView events={events} onClick={(e) => setSelectedId(e.id)} selectedId={curSelId} cast={data.cast} locs={data.locs}/>
          ) : (
            <TLVerticalView events={events} onClick={(e) => setSelectedId(e.id)} selectedId={curSelId} cast={data.cast} locs={data.locs}/>
          )}
        </div>
        {expanded && mode !== "review" && (
          <div className="tl-rail">
            <TLInspector event={selected} onClose={() => setSelectedId(null)} cast={data.cast} locs={data.locs}/>
          </div>
        )}
      </div>

      {!expanded && mode !== "review" && selected && (
        <div className="tl-drawer">
          <TLInspector event={selected} onClose={() => setSelectedId(null)} cast={data.cast} locs={data.locs}/>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  TL_EVENTS, TL_ERAS, TL_REVIEW, TL_MODES,
  TimelinePanelBody, TLVerticalView, TLHorizontalView, TLInspector, TLEventCard, TLReviewView, TLFilters,
  buildLiveTimelineDataset, buildDemoTimelineDataset,
});
