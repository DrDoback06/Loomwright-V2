// =====================================================================
// timeline.jsx — Timeline workspace (LIVE).
//
// Modes: book / chronological / character / location / quest / faction
//        / review
//
// Default orientation: vertical (compact); horizontal when panel
// expanded — driven by `panel.expanded`.
//
// Area 4 (visual tabs): the timeline now reads the live project store.
// Beats come from BOTH persisted entity types that represent story
// moments — "timeline" entities (dateLabel / absoluteDate / characters /
// isMilestone) and "events" entities (chapter / participants / location /
// eventType) — folded into one ordered list. Cast / locations / quests /
// factions for cards + filter chips come from EntityService; the review
// tab reads pending "timeline" + "events" candidates from ReviewService.
// No demo data; honest empty states.
// =====================================================================

const { useState: _tl_us, useMemo: _tl_um, useCallback: _tl_uc, useEffect: _tl_ue } = React;

// ---------------------------------------------------------------------
// Static vocab — eras (derived buckets) + mode tabs.
// ---------------------------------------------------------------------
const TL_ERAS = [
  { id: "backstory", label: "Backstory",  color: "#76684c" },
  { id: "story",     label: "The Story",  color: "#3e6db5" },
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

// ---------------------------------------------------------------------
// Live-store adapters
// ---------------------------------------------------------------------
const _TL_PALETTE = [
  "#7a6aa3", "#a8553f", "#5d6d4e", "#b78a52", "#6b6f7a", "#8a6b58",
  "#3e6db5", "#b86a82", "#c98a2c", "#3d3a78", "#4f7d6a", "#9a5b7a",
];
const _tlColor = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _TL_PALETTE[h % _TL_PALETTE.length];
};
const _tlInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
};

// Read a field from either the flat entity or its nested `data.*`.
const _tlPick = (e, ...keys) => {
  if (!e) return undefined;
  const d = e.data || {};
  for (const k of keys) {
    if (d[k] != null && d[k] !== "") return d[k];
    if (e[k] != null && e[k] !== "") return e[k];
  }
  return undefined;
};

// Related-multi → array of ids (tolerates ["id"] or [{id,name,type}]).
const _tlIds = (raw) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((v) => (typeof v === "string" ? v : (v && v.id) || null)).filter(Boolean);
};

// Resolve a chapter reference (id / "Ch. 3" / number) to a chapter number.
const _tlChapterNum = (val, chapterNumById) => {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  if (chapterNumById[val] != null) return chapterNumById[val];
  const m = String(val).match(/\d+/);
  return m ? Number(m[0]) : null;
};

// Map one persisted timeline/event entity → the card shape the views expect.
const _tlLiveEvent = (e, chapterNumById) => {
  if (!e) return null;
  const chapter = _tlChapterNum(_tlPick(e, "chapter", "chapterId", "chapterNum"), chapterNumById);
  const dateLabel = _tlPick(e, "dateLabel", "absoluteDate", "timelinePosition", "date");
  const track = String(_tlPick(e, "track") || "").toLowerCase();
  const flashback = _tlPick(e, "flashback") === true || track === "flashback"
    || String(_tlPick(e, "eventType") || "").toLowerCase() === "flashback";

  const entities = _tlIds(_tlPick(e, "characters", "participants", "entities"));
  const locations = _tlIds(_tlPick(e, "locations", "location"));
  const quests = _tlIds(_tlPick(e, "quests", "quest"));
  const factions = _tlIds(_tlPick(e, "factions", "faction"));

  const dateType = _tlPick(e, "dateType")
    || (/\bapprox|~|circa|around/i.test(String(dateLabel || "")) ? "approx"
      : /\bor\b|\?/.test(String(dateLabel || "")) ? "conflict"
      : "exact");

  return {
    id: e.id,
    label: e.name || e.title || _tlPick(e, "title") || "Untitled event",
    entityType: e.type || "timeline",
    chapter,
    era: chapter != null ? "story" : "backstory",
    date: dateLabel || (chapter != null ? ("Ch. " + chapter) : "Undated"),
    dateType,
    confidence: _tlPick(e, "confidence") || "high",
    canon: _tlPick(e, "canon") || "hard",
    entities,
    locationId: locations[0] || null,
    quest: quests[0] || null,
    factions,
    summary: e.summary || _tlPick(e, "summary", "body") || "",
    flashback,
    isMilestone: _tlPick(e, "isMilestone") === true,
    source: chapter != null ? ("Ch. " + chapter) : (dateLabel || ""),
    _entity: e,
  };
};

const _tlSortKey = (ev) => (ev.chapter != null ? ev.chapter : (ev.era === "backstory" ? -1000 : 9999));

// Build the whole live data bundle once per render pass.
const buildTimelineData = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const ES = B && B.EntityService;

  const chapterNumById = {};
  try {
    const state = (B && B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync()) || {};
    (state.chapters || []).filter((c) => !c.reserved).forEach((c, i) => {
      chapterNumById[c.id] = c.num || (i + 1);
    });
  } catch (_e) {}

  const mapEnt = (e) => ({
    id: e.id,
    name: e.name || (e.data && e.data.name) || "Unnamed",
    color: _tlColor(e.id),
    initials: e.glyphChar || _tlInitials(e.name),
    type: e.type,
  });
  const cast = ((ES && ES.listSync("cast")) || []).map(mapEnt);
  const locations = ((ES && ES.listSync("locations")) || []).map(mapEnt);
  const quests = ((ES && ES.listSync("quests")) || []).map(mapEnt);
  const factions = ((ES && ES.listSync("factions")) || []).map(mapEnt);
  const castById = Object.fromEntries(cast.map((c) => [c.id, c]));
  const locById = Object.fromEntries(locations.map((l) => [l.id, l]));

  // Timeline beats come from both "timeline" and "events" entities.
  const rawTimeline = (ES && ES.listSync("timeline")) || [];
  const rawEvents = (ES && ES.listSync("events")) || [];
  const events = [...rawTimeline, ...rawEvents]
    .filter((e) => e && e.status !== "deleted")
    .map((e) => _tlLiveEvent(e, chapterNumById))
    .filter(Boolean);

  // Which eras actually contain events (empty eras are hidden anyway).
  const eras = TL_ERAS.filter((era) => events.some((e) => e.era === era.id));

  // Pending review candidates for timeline + event types.
  const rawReview = [
    ...((B && B.ReviewService && B.ReviewService.listSync("timeline")) || []),
    ...((B && B.ReviewService && B.ReviewService.listSync("events")) || []),
  ];
  const review = rawReview
    .filter((q) => q.status === "pending")
    .map((q) => {
      const conf = typeof q.confidence === "number" ? q.confidence
        : typeof q.value === "number" ? q.value / 100 : 0.55;
      const pct = Math.round(conf * 100);
      const lvl = pct >= 80 ? "strong" : pct >= 60 ? "uncertain" : "weak";
      const chNum = _tlChapterNum(q.chapterId, chapterNumById);
      return {
        id: q.id,
        lvl,
        title: q.name || "Event candidate",
        action: q.action || "Add to timeline?",
        excerpt: q.sourceQuote || (q.payload && q.payload.context) || q.summary || "",
        cite: chNum != null ? ("Ch. " + chNum) : (q.cite || ""),
      };
    });

  return { events, eras, cast, locations, quests, factions, castById, locById, review, chapterNumById };
};

// ---------------------------------------------------------------------
// Single event card
// ---------------------------------------------------------------------
const TLEventCard = ({ event, data, orientation, onClick, selected }) => {
  const { castById, locById, eras } = data;
  const loc = event.locationId ? locById[event.locationId] : null;
  const era = eras.find((e) => e.id === event.era) || TL_ERAS[1];
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
        {event.isMilestone && <span className="tl-card__pill" title="Milestone">★</span>}
        {event.flashback && <span className="tl-card__pill tl-card__pill--fb">FB</span>}
      </div>
      <div className="tl-card__title">{event.label}</div>
      {event.summary && <div className="tl-card__sum">{event.summary}</div>}
      <div className="tl-card__foot">
        <span className="tl-card__cast">
          {event.entities.slice(0, 3).map((cid) => {
            const c = castById[cid];
            if (!c) return null;
            return (
              <span key={cid} className="tl-card__avatar" style={{ "--c": c.color }}>{c.initials}</span>
            );
          })}
        </span>
        {loc && <span className="tl-card__loc">{loc.name}</span>}
        {event.source && <span className="tl-card__src">{event.source}</span>}
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------
// Vertical timeline (compact)
// ---------------------------------------------------------------------
const TLVerticalView = ({ events, data, onClick, selectedId }) => (
  <div className="tl-vert">
    {data.eras.map((era) => {
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
                <TLEventCard event={e} data={data} orientation="vert" onClick={onClick} selected={e.id === selectedId}/>
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
const TLHorizontalView = ({ events, data, onClick, selectedId }) => (
  <div className="tl-horz">
    <div className="tl-horz__line"/>
    <div className="tl-horz__rows">
      {data.eras.map((era) => {
        const es = events.filter((e) => e.era === era.id);
        if (es.length === 0) return null;
        return (
          <div key={era.id} className="tl-horz__era" style={{ "--c": era.color }}>
            <div className="tl-horz__era-band">
              <span>{era.label}</span>
              <span className="tl-horz__era-n">{es.length}</span>
            </div>
            <div className="tl-horz__track">
              {es.map((e) => (
                <div key={e.id} className="tl-horz__item">
                  <div className="tl-horz__pip" style={{ background: era.color }}/>
                  <TLEventCard event={e} data={data} orientation="horz" onClick={onClick} selected={e.id === selectedId}/>
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
const _tlOpenEditor = (event) =>
  window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
    detail: { type: event.entityType || "timeline", initial: { id: event.id }, mode: "full" },
  }));

const TLInspector = ({ event, data, onClose }) => {
  if (!event) return null;
  const { castById, locById } = data;
  const loc = event.locationId ? locById[event.locationId] : null;

  const toggleFlashback = async () => {
    const B = window.LoomwrightBackend;
    if (!B || !event._entity) return;
    const nextData = { ...(event._entity.data || {}), flashback: !event.flashback };
    await B.EntityService.update(event.entityType || "timeline", event.id, { data: nextData });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
  };
  const openSource = () => {
    if (event.chapter == null) return;
    const cid = Object.entries(data.chapterNumById).find(([, n]) => n === event.chapter)?.[0];
    if (cid) window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: cid } }));
  };

  return (
    <div className="tl-insp">
      <div className="tl-insp__head">
        <span className="tl-insp__date">{event.date}</span>
        {event.chapter != null && <span className="tl-insp__ch">Ch. {event.chapter}</span>}
        <button className="tl-insp__x" onClick={onClose}><Icon name="close" size={11}/></button>
      </div>
      <div className="tl-insp__title">{event.label}</div>
      {event.summary && <p className="tl-insp__sum">{event.summary}</p>}
      <div className="tl-insp__rows">
        <TLRow k="Confidence" v={event.confidence}/>
        <TLRow k="Canon"      v={event.canon}/>
        <TLRow k="Date type"  v={event.dateType}/>
        {loc && <TLRow k="Location" v={loc.name}/>}
        {event.isMilestone && <TLRow k="Milestone" v="yes"/>}
      </div>
      {event.entities.length > 0 && (
        <div className="tl-insp__sec">
          <div className="tl-insp__sech">Cast involved</div>
          <div className="tl-insp__chips">
            {event.entities.map((cid) => {
              const c = castById[cid];
              if (!c) return null;
              return (
                <button key={cid} className="tl-insp__chip" style={{ "--c": c.color }}
                        onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } }))}>
                  <span className="tl-insp__chip-avatar">{c.initials}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {event.source && (
        <div className="tl-insp__sec">
          <div className="tl-insp__sech">Source</div>
          <div className="tl-insp__source">{event.source}</div>
        </div>
      )}
      <div className="tl-insp__actions">
        <button onClick={() => _tlOpenEditor(event)}>Edit event</button>
        <button onClick={() => _tlOpenEditor(event)}>Set date</button>
        <button onClick={toggleFlashback}>{event.flashback ? "Clear flashback" : "Mark flashback"}</button>
        <button onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } }))}>Show on Atlas</button>
        {event.chapter != null && <button onClick={openSource}>Open source</button>}
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
const TLFilters = ({ filters, onToggleFilter, data }) => {
  const groups = [
    { k: "character", items: data.cast.slice(0, 8) },
    { k: "location",  items: data.locations.slice(0, 8) },
    { k: "quest",     items: data.quests.slice(0, 8) },
    { k: "faction",   items: data.factions.slice(0, 8) },
  ].filter((g) => g.items.length);

  if (!groups.length) {
    return <div className="tl-filt"><span className="tl-filt__lbl" style={{ opacity: 0.7 }}>No cast, locations, quests, or factions to filter by yet.</span></div>;
  }
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
                <span>{it.name}</span>
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
const _tlQueueDispatch = (name, id) =>
  window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name, detail: { id } } }));

const TLReviewView = ({ data }) => {
  const items = data.review;
  if (!items.length) {
    return (
      <div className="tl-review">
        <div className="tl-empty" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", color: "var(--ink-2)", marginBottom: 6 }}>Nothing to review</div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>Event candidates found during extraction will surface here.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="tl-review">
      {items.map((r) => (
        <div key={r.id} className={"tl-review__card tl-review__card--" + r.lvl}>
          <div className="tl-review__head">
            <ConfidenceBadge level={r.lvl}/>
            <span className="tl-review__title">{r.title}</span>
          </div>
          {r.excerpt && <p className="tl-review__quote">"{r.excerpt}"</p>}
          {r.cite && <div className="tl-review__meta">{r.cite}</div>}
          <div className="tl-review__pill">{r.action}</div>
          <div className="tl-review__actions">
            <button onClick={() => _tlQueueDispatch("onAcceptTimelineQueueItem", r.id)}>Accept</button>
            <button onClick={() => _tlQueueDispatch("onEditTimelineQueueItem", r.id)}>Edit</button>
            <button onClick={() => _tlQueueDispatch("onMergeTimelineQueueItem", r.id)}>Merge</button>
            <button onClick={() => _tlQueueDispatch("onDenyTimelineQueueItem", r.id)}>Deny</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Full-panel empty state — no beats and nothing to review.
// ---------------------------------------------------------------------
const TLEmpty = ({ expanded }) => (
  <div className="tl" data-ui="TimelinePanelBody" data-orientation={expanded ? "horizontal" : "vertical"}>
    <div className="tl-bar">
      <div className="tl-bar__modes"/>
      <button className="tl-bar__add" data-callback="onCreateTimelineEvent">
        <Icon name="plus" size={11}/>
        <span>Add event</span>
      </button>
    </div>
    <div className="tl-empty" style={{ margin: "48px auto", maxWidth: 460, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", color: "var(--ink-2)", marginBottom: 8 }}>No timeline yet</div>
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)", lineHeight: 1.55 }}>
        The timeline pins the moments of your story. Add an event — or run
        extraction over the manuscript — and its beats will appear here in
        book and chronological order.
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// TimelinePanelBody — main entry
// ---------------------------------------------------------------------
const TimelinePanelBody = ({ panel, onSelectEntity }) => {
  const [storeVersion, setStoreVersion] = _tl_us(0);
  _tl_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:manuscript-chapters-updated",
      "lw:review-queue-updated", "lw:occurrences-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const data = _tl_um(() => buildTimelineData(), [storeVersion]);

  const [mode, setMode] = _tl_us("book");
  const [filters, setFilters] = _tl_us({ character: [], location: [], quest: [], faction: [] });
  const [selectedId, setSelectedId] = _tl_us(null);
  const [showFilters, setShowFilters] = _tl_us(false);

  const onToggleFilter = _tl_uc((k, id) => {
    setFilters((f) => {
      const cur = new Set(f[k] || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...f, [k]: [...cur] };
    });
  }, []);

  // Filtered + sorted events.
  const events = _tl_um(() => {
    let list = data.events;
    if (filters.character.length) list = list.filter((e) => e.entities.some((c) => filters.character.includes(c)));
    if (filters.location.length)  list = list.filter((e) => e.locationId && filters.location.includes(e.locationId));
    if (filters.quest.length)     list = list.filter((e) => e.quest && filters.quest.includes(e.quest));
    if (filters.faction.length)   list = list.filter((e) => e.factions.some((f) => filters.faction.includes(f)));
    // Book + the entity-facet modes order by chapter; chronological groups
    // backstory first, then by chapter.
    return [...list].sort((a, b) => _tlSortKey(a) - _tlSortKey(b));
  }, [data.events, mode, filters]);

  // Keep the selection valid as the live store changes.
  _tl_ue(() => {
    setSelectedId((prev) => (prev && data.events.some((e) => e.id === prev)) ? prev
      : (data.events[0]?.id || null));
  }, [data.events]);

  const selected = data.events.find((e) => e.id === selectedId);
  const expanded = panel?.expanded;

  if (!data.events.length && !data.review.length) return <TLEmpty expanded={expanded}/>;

  return (
    <div className="tl" data-ui="TimelinePanelBody" data-orientation={expanded ? "horizontal" : "vertical"}>
      <div className="tl-bar">
        <div className="tl-bar__modes">
          {TL_MODES.map((m) => (
            <button key={m.id} className={"tl-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-mode={m.id}>
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

      {showFilters && <TLFilters filters={filters} onToggleFilter={onToggleFilter} data={data}/>}

      <div className="tl-grid" data-mode={expanded ? "split" : "stack"}>
        <div className="tl-stage">
          {mode === "review" ? (
            <TLReviewView data={data}/>
          ) : events.length === 0 ? (
            <div className="tl-empty" style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}>
              No events match the current filters.
            </div>
          ) : expanded ? (
            <TLHorizontalView events={events} data={data} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          ) : (
            <TLVerticalView events={events} data={data} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          )}
        </div>
        {expanded && mode !== "review" && selected && (
          <div className="tl-rail">
            <TLInspector event={selected} data={data} onClose={() => setSelectedId(null)}/>
          </div>
        )}
      </div>

      {!expanded && mode !== "review" && selected && (
        <div className="tl-drawer">
          <TLInspector event={selected} data={data} onClose={() => setSelectedId(null)}/>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  TL_ERAS, TL_MODES, buildTimelineData,
  TimelinePanelBody, TLVerticalView, TLHorizontalView, TLInspector, TLEventCard, TLReviewView, TLFilters,
});
