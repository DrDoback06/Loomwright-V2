// =====================================================================
// timeline.jsx — Timeline workspace (LIVE).
//
// Modes: book / chronological / character / location / quest / faction
//        / review
//
// Default orientation: vertical (compact); horizontal when panel
// expanded — driven by `panel.expanded`.
//
// Area 5: the timeline now reads the live "events" entity collection
// (title / summary / eventType / chapter / timelinePosition / participants
// / location / factions), resolves participants + location against the
// live cast / locations collections, buckets events into eras derived from
// their chapter placement, and lists live pending event candidates in the
// Review tab (Accept/Edit/Merge/Deny run the real generic handlers). All
// tl-* CSS classes are preserved; only the data source changed.
// =====================================================================

const { useState: _tl_us, useMemo: _tl_um, useCallback: _tl_uc, useEffect: _tl_ue } = React;

// Generic eras (relabelled from the old book-specific demo). Events land in
// one of three bands based on whether they sit before, inside, or ahead of
// the written manuscript.
const TL_ERAS = [
  { id: "pre",   label: "Backstory",         color: "#76684c" },
  { id: "ch",    label: "In the manuscript", color: "#3e6db5" },
  { id: "after", label: "Planned / ahead",   color: "#9a8c6e" },
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
// Live helpers — colour / initials, chapter parsing, related resolution.
// ---------------------------------------------------------------------
const _TL_PALETTE = ["#7a5c9e", "#3e6db5", "#5d6d4e", "#a8553f", "#8a6a2a",
  "#b86a82", "#3d3a78", "#2c7a6b", "#c98a2c", "#6a4e8a", "#4a7a4a", "#a05a7a"];
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
const _tlResolveIds = (raw) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const v of arr) {
    const id = typeof v === "string" ? v : (v && v.id) || null;
    if (id) out.push(id);
  }
  return out;
};
// Pull a chapter number out of a free-text "Ch. 5 — last week" string.
const _tlParseChapter = (s) => {
  const m = String(s || "").match(/ch\.?\s*(\d+)|chapter\s*(\d+)/i);
  if (m) return parseInt(m[1] || m[2], 10);
  return null;
};
const _tlIsFuture = (d) => {
  if (d.future === true) return true;
  const pos = String(d.timelinePosition || d.chapter || "").toLowerCase();
  return /future|unset|planned|ahead|later|to come|tbd/.test(pos);
};

// ---------------------------------------------------------------------
// buildTimelineModel — one pass over the live store → timeline events +
// filter sources + review queue.
// ---------------------------------------------------------------------
const buildTimelineModel = () => {
  const empty = { events: [], eventById: {}, castById: {}, locById: {}, questById: {},
    factionById: {}, review: [], chapters: [], chapterIndex: new Map(), hasBackend: false };
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  if (!B || !B.EntityService) return empty;

  const indexBy = (type) => {
    const out = {};
    try {
      for (const e of (B.EntityService.listSync(type) || [])) {
        if (e && e.id) out[e.id] = e;
      }
    } catch (_) {}
    return out;
  };
  const castRaw = indexBy("cast");
  const locRaw = indexBy("locations");
  const questRaw = indexBy("quests");
  const factionRaw = indexBy("factions");

  const castById = {};
  for (const [id, e] of Object.entries(castRaw)) {
    castById[id] = { id, name: e.name || "Unnamed", initials: e.glyphChar || _tlInitials(e.name), color: _tlColor(id) };
  }
  const locById = {};
  for (const [id, e] of Object.entries(locRaw)) locById[id] = { id, name: e.name || "Place", type: (e.data && e.data.type) || e.type || "" };
  const questById = {};
  for (const [id, e] of Object.entries(questRaw)) questById[id] = { id, name: e.name || "Quest" };
  const factionById = {};
  for (const [id, e] of Object.entries(factionRaw)) factionById[id] = { id, name: e.name || "Faction", color: _tlColor(id) };

  // Chapters (for parsing + occurrence-based source).
  const chapterIndex = new Map();
  let chapters = [];
  try {
    const state = B.ManuscriptChapterService?.loadSync?.() || {};
    chapters = (state.chapters || []).filter((c) => !c.reserved);
    chapters.forEach((c, i) => chapterIndex.set(c.id, { index: i, num: c.num || (i + 1), title: c.title || "", id: c.id }));
  } catch (_) {}

  // Occurrences by entity (for source citation).
  const occByEntity = new Map();
  try {
    for (const o of (B.OccurrenceService?.listAllSync?.() || [])) {
      if (!o || !o.entityId) continue;
      const list = occByEntity.get(o.entityId) || [];
      list.push(o);
      occByEntity.set(o.entityId, list);
    }
  } catch (_) {}
  const firstSourceFor = (entityId, participants) => {
    const ids = [entityId, ...(participants || [])];
    for (const id of ids) {
      const occs = occByEntity.get(id);
      if (occs && occs.length) {
        const o = occs[0];
        const num = chapterIndex.get(o.chapterId)?.num;
        if (num != null) return "Ch. " + num;
      }
    }
    return "";
  };

  // Events.
  let eventEntities = [];
  try { eventEntities = B.EntityService.listSync("events") || []; } catch (_) {}
  const events = [];
  const eventById = {};
  for (const e of eventEntities) {
    if (!e || !e.id) continue;
    const d = e.data || {};
    const participants = _tlResolveIds(d.participants).filter((id) => castById[id]);
    const locId = _tlResolveIds(d.location)[0] || null;
    const questId = _tlResolveIds(d.relatedQuests)[0] || _tlResolveIds(d.quests)[0] || null;
    const factionIds = _tlResolveIds(d.factions).filter((id) => factionById[id]);
    const chapterNum = _tlParseChapter(d.chapter) ?? (typeof d.chapterNum === "number" ? d.chapterNum : null);
    const future = _tlIsFuture(d);
    const era = future ? "after" : (chapterNum != null ? "ch" : "pre");
    const dateType = d.dateType || (future ? "future" : (d.timelinePosition ? "exact" : "approx"));
    const date = d.timelinePosition || d.chapter || (chapterNum != null ? ("Ch. " + chapterNum) : (future ? "Ahead" : "Unplaced"));
    const source = (typeof d.sourceMentions === "string" && d.sourceMentions.split(/\n/)[0].trim())
      || firstSourceFor(e.id, participants) || (e.sourceMentions && e.sourceMentions[0]) || "";
    const evt = {
      id: e.id,
      label: e.name || "Event",
      summary: e.summary || d.summary || "",
      chapter: chapterNum,
      era,
      date,
      dateType,
      confidence: d.confidence || "strong",
      canon: d.canon || (d.canonical ? "hard" : "soft"),
      eventType: d.eventType || "",
      entities: participants,
      factionIds,
      locationId: locId,
      quest: questId,
      flashback: !!d.flashback,
      source,
    };
    events.push(evt);
    eventById[e.id] = evt;
  }

  // Review queue (live pending event candidates).
  const review = [];
  try {
    for (const item of (B.ReviewService?.listSync?.("events") || [])) {
      if (item.status === "done" || item.status === "denied") continue;
      const conf = typeof item.confidence === "number" ? item.confidence : (typeof item.value === "number" ? item.value / 100 : 0.55);
      const pct = Math.round(conf * 100);
      const lvl = pct >= 85 ? "high" : pct >= 65 ? "strong" : pct >= 45 ? "uncertain" : "weak";
      const chNum = item.chapterId ? chapterIndex.get(item.chapterId)?.num : null;
      review.push({
        id: item.id,
        lvl,
        title: item.name || "Event candidate",
        action: item.suggestedAction === "update" ? "Update event" : "Add to timeline?",
        excerpt: item.sourceQuote || (item.sourceQuotes && item.sourceQuotes[0]) || item.summary || "",
        cite: chNum ? ("Ch. " + chNum) : (item.reason || item.matchType || ""),
        _raw: item,
      });
    }
  } catch (_) {}

  const model = { events, eventById, castById, locById, questById, factionById,
    review, chapters, chapterIndex, hasBackend: true };

  // Keep the diagnostics tweak-panel line (app.jsx) honest.
  try {
    window.TL_EVENTS = events;
    window.TL_ERAS = TL_ERAS;
    window.TL_REVIEW = review;
  } catch (_) {}
  return model;
};

const _tlDispatch = (name, detail) => {
  try {
    if (typeof window.LoomwrightDispatchCallback === "function") window.LoomwrightDispatchCallback(name, { detail });
    else window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name, detail } }));
  } catch (_) {}
};

const TLEmpty = ({ title, body }) => (
  <div className="tl-empty" style={{ margin: 16, padding: 16, color: "var(--ink-3)" }}>
    <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-1)" }}>{title}</div>
    <div>{body}</div>
  </div>
);

// ---------------------------------------------------------------------
// Single event card
// ---------------------------------------------------------------------
const TLEventCard = ({ event, model, orientation, onClick, selected }) => {
  const cast = model.castById;
  const loc = event.locationId ? model.locById[event.locationId] : null;
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
        {event.source && <span className="tl-card__src">{event.source}</span>}
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------
// Vertical timeline (compact)
// ---------------------------------------------------------------------
const TLVerticalView = ({ events, model, onClick, selectedId }) => (
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
                <TLEventCard event={e} model={model} orientation="vert" onClick={onClick} selected={e.id === selectedId}/>
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
const TLHorizontalView = ({ events, model, onClick, selectedId }) => (
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
              {es.map((e) => (
                <div key={e.id} className="tl-horz__item">
                  <div className="tl-horz__pip" style={{ background: era.color }}/>
                  <TLEventCard event={e} model={model} orientation="horz" onClick={onClick} selected={e.id === selectedId}/>
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
const TLInspector = ({ event, model, onClose }) => {
  if (!event) return null;
  const cast = model.castById;
  const loc = event.locationId ? model.locById[event.locationId] : null;
  const quest = event.quest ? model.questById[event.quest] : null;
  const openSource = () => {
    // Jump to the first occurrence's chapter if we can resolve one.
    const B = window.LoomwrightBackend;
    const occs = (B?.OccurrenceService?.listByEntitySync?.(event.id)) || [];
    if (occs[0]?.chapterId) window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: occs[0].chapterId } }));
  };
  const editEvent = () => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "events", initial: { id: event.id }, mode: "full" } }));
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
        {event.eventType && <TLRow k="Type" v={event.eventType}/>}
        <TLRow k="Confidence" v={event.confidence}/>
        <TLRow k="Canon"      v={event.canon}/>
        <TLRow k="Date type"  v={event.dateType}/>
        {loc && <TLRow k="Location" v={loc.name}/>}
        {quest && <TLRow k="Quest" v={quest.name}/>}
      </div>
      {event.entities.length > 0 && (
        <div className="tl-insp__sec">
          <div className="tl-insp__sech">Cast involved</div>
          <div className="tl-insp__chips">
            {event.entities.map((cid) => {
              const c = cast[cid];
              if (!c) return null;
              return (
                <button key={cid} className="tl-insp__chip" style={{ "--c": c.color }}
                        onClick={() => window.dispatchEvent(new CustomEvent("lw:focus-entity", { detail: { panelKind: "cast", entityId: cid, label: c.name } }))}>
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
        <button onClick={editEvent}>Edit event</button>
        <button onClick={editEvent}>Set date</button>
        <button data-callback="onShowTimelineMomentOnAtlas">Show on Atlas</button>
        <button onClick={openSource}>Open source</button>
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
// Filter chips — live cast / locations / quests / factions.
// ---------------------------------------------------------------------
const TLFilters = ({ model, filters, onToggleFilter }) => {
  const groups = [
    { k: "character", items: Object.values(model.castById).slice(0, 8) },
    { k: "location",  items: Object.values(model.locById).slice(0, 8) },
    { k: "quest",     items: Object.values(model.questById).slice(0, 8) },
    { k: "faction",   items: Object.values(model.factionById).slice(0, 8) },
  ].filter((g) => g.items.length);
  if (groups.length === 0) return <div className="tl-filt"><span className="tl-filt__lbl">No entities to filter by yet.</span></div>;
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
// Review view (live queue)
// ---------------------------------------------------------------------
const TLReviewView = ({ model }) => {
  const queue = model.review;
  if (queue.length === 0) {
    return <TLEmpty title="No events to review" body="Run an extraction over a chapter — detected happenings land here to accept onto the timeline."/>;
  }
  return (
    <div className="tl-review">
      {queue.map((r) => (
        <div key={r.id} className={"tl-review__card tl-review__card--" + r.lvl}>
          <div className="tl-review__head">
            {typeof ConfidenceBadge !== "undefined" ? <ConfidenceBadge level={r.lvl}/> : <span className="tl-review__pill">{r.lvl}</span>}
            <span className="tl-review__title">{r.title}</span>
          </div>
          {r.excerpt && <p className="tl-review__quote">"{r.excerpt}"</p>}
          {r.cite && <div className="tl-review__meta">{r.cite}</div>}
          <div className="tl-review__pill">{r.action}</div>
          <div className="tl-review__actions">
            <button onClick={() => _tlDispatch("onAcceptTimelineQueueItem", r._raw)}>Accept</button>
            <button onClick={() => _tlDispatch("onEditTimelineQueueItem", r._raw)}>Edit</button>
            <button onClick={() => _tlDispatch("onMergeTimelineQueueItem", r._raw)}>Merge</button>
            <button onClick={() => _tlDispatch("onDenyTimelineQueueItem", r._raw)}>Deny</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// TimelinePanelBody — main entry (LIVE).
// ---------------------------------------------------------------------
const TimelinePanelBody = ({ panel, onSelectEntity }) => {
  const [storeVersion, setStoreVersion] = _tl_us(0);
  _tl_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:manuscript-chapters-updated",
      "lw:occurrences-updated", "lw:review-queue-updated", "lw:set-active-chapter", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const model = _tl_um(() => buildTimelineModel(), [storeVersion]);

  const [mode, setMode] = _tl_us("book");
  const [filters, setFilters] = _tl_us({ character: [], location: [], quest: [], faction: [] });
  const [selectedId, setSelectedId] = _tl_us(null);
  const [showFilters, setShowFilters] = _tl_us(false);

  const onToggleFilter = _tl_uc((k, id) => {
    setFilters((f) => {
      const cur = new Set(f[k] || []);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...f, [k]: [...cur] };
    });
  }, []);

  // Filtered + sorted events.
  const events = _tl_um(() => {
    let list = model.events;
    if (filters.character.length) list = list.filter((e) => e.entities.some((c) => filters.character.includes(c)));
    if (filters.location.length)  list = list.filter((e) => e.locationId && filters.location.includes(e.locationId));
    if (filters.quest.length)     list = list.filter((e) => e.quest && filters.quest.includes(e.quest));
    if (filters.faction.length)   list = list.filter((e) => e.factionIds.some((f) => filters.faction.includes(f)));
    if (mode === "book") {
      return [...list].sort((a, b) => (a.chapter ?? 999) - (b.chapter ?? 999));
    }
    if (mode === "chronological") {
      return [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.chapter ?? 999) - (b.chapter ?? 999));
    }
    return list;
  }, [model, mode, filters]);

  const selected = selectedId ? model.eventById[selectedId] : null;
  const expanded = panel?.expanded;

  if (!model.hasBackend) {
    return <div className="tl" data-ui="TimelinePanelBody"><TLEmpty title="Loading…" body="Waiting for the project store."/></div>;
  }

  const totalFilters = Object.values(filters).flat().length;

  return (
    <div className="tl" data-ui="TimelinePanelBody" data-entity-type="events" data-orientation={expanded ? "horizontal" : "vertical"}>
      <div className="tl-bar">
        <div className="tl-bar__modes">
          {TL_MODES.map((m) => (
            <button key={m.id} className={"tl-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && model.review.length > 0 && <span className="tl-bar__q">{model.review.length}</span>}
            </button>
          ))}
        </div>
        <button className={"tl-bar__filt" + (showFilters ? " is-on" : "")} onClick={() => setShowFilters((v) => !v)}>
          <Icon name="filter" size={11}/>
          <span>Filters</span>
          {totalFilters > 0 && <span className="tl-bar__q">{totalFilters}</span>}
        </button>
        <button className="tl-bar__add" data-callback="onCreateTimelineEvent">
          <Icon name="plus" size={11}/>
          <span>Add event</span>
        </button>
      </div>

      {showFilters && <TLFilters model={model} filters={filters} onToggleFilter={onToggleFilter}/>}

      <div className="tl-grid" data-mode={expanded ? "split" : "stack"}>
        <div className="tl-stage">
          {mode === "review" ? (
            <TLReviewView model={model}/>
          ) : model.events.length === 0 ? (
            <TLEmpty title="No events yet"
              body="Add an event (＋ Add event), or extract them from the manuscript — accepted happenings appear here on the timeline."/>
          ) : events.length === 0 ? (
            <TLEmpty title="No events match these filters" body="Clear a filter to see more of the timeline."/>
          ) : expanded ? (
            <TLHorizontalView events={events} model={model} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          ) : (
            <TLVerticalView events={events} model={model} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          )}
        </div>
        {expanded && mode !== "review" && selected && (
          <div className="tl-rail">
            <TLInspector event={selected} model={model} onClose={() => setSelectedId(null)}/>
          </div>
        )}
      </div>

      {!expanded && mode !== "review" && selected && (
        <div className="tl-drawer">
          <TLInspector event={selected} model={model} onClose={() => setSelectedId(null)}/>
        </div>
      )}
    </div>
  );
};

// Live diagnostics defaults (app.jsx reads .length before first render).
window.TL_EVENTS = window.TL_EVENTS || [];
window.TL_ERAS = TL_ERAS;
window.TL_REVIEW = window.TL_REVIEW || [];

Object.assign(window, {
  TL_ERAS, TL_MODES, buildTimelineModel,
  TimelinePanelBody, TLVerticalView, TLHorizontalView, TLInspector, TLEventCard, TLReviewView, TLFilters,
});
