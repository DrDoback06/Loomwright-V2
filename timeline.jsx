// =====================================================================
// timeline.jsx — Timeline workspace.
//
// Modes: book / chronological / character / location / quest / faction
//        / review
//
// Default orientation: vertical (compact); horizontal when panel
// expanded — driven by `panel.expanded`.
//
// All views render LIVE project data:
//   events       ← EntityService.listSync("events") + listSync("timeline")
//   filter chips ← live cast / locations / quests / factions
//   review queue ← ReviewService.listSync("events"/"timeline")
//   inspector    ← record actions (edit / set date / flashback / atlas /
//                  open source) wired to the editor, store and router.
// =====================================================================

const { useState: _tl_us, useMemo: _tl_um, useCallback: _tl_uc } = React;

// Era styling is fixed; the middle era takes the manuscript's place.
const TL_ERAS = [
  { id: "pre",   label: "Before the Story", color: "#76684c" },
  { id: "ch",    label: "The Manuscript",   color: "#3e6db5" },
  { id: "after", label: "After",            color: "#9a8c6e" },
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
// Live context — one snapshot of everything the views render.
// ---------------------------------------------------------------------
const TL_PALETTE = ["#5d6d4e", "#3e6db5", "#a8553f", "#8a6a2a", "#b86a82", "#3d3a78", "#c98a2c", "#76684c"];
const _tlHash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const _tlInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
};
const _tlIds = (v) => {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (typeof x === "string" ? x : x && x.id)).filter(Boolean);
};
const _tlChapterNum = (v) => {
  const m = String(v ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

// Map one live entity (events or timeline store) onto the designed card shape.
const liveEventToTL = (e, ctx) => {
  const d = e.data || {};
  const chapter = _tlChapterNum(d.chapter) ?? (e.chapterId ? ctx.chapterNumById.get(e.chapterId) ?? null : null);
  const posText = String(d.timelinePosition || d.track || "").toLowerCase();
  const era = (d.era && TL_ERAS.some((x) => x.id === d.era)) ? d.era
    : (/\bafter\b|future|epilogue|sequel/.test(posText) || d.future === true) ? "after"
    : (chapter == null && /\bbefore\b|backstory|pre-story|prologue|\bpast\b|\bago\b|year/.test(posText)) ? "pre"
    : "ch";
  const dateRaw = d.dateLabel || d.absoluteDate || d.timelinePosition || "";
  const date = dateRaw || (chapter != null ? "Ch. " + chapter : "Undated");
  const dateType = d.dateType
    || (d.dateConflict ? "conflict"
    : era === "after" ? "future"
    : /\?|approx|about|around|~|\bor\b/i.test(dateRaw) ? "approx"
    : "exact");
  const srcText = (typeof d.sourceQuote === "string" && d.sourceQuote.trim())
    || (typeof d.sourceMentions === "string" && d.sourceMentions.trim())
    || "";
  const source = srcText
    ? '"' + (srcText.length > 64 ? srcText.slice(0, 61) + "…" : srcText) + '"'
    : (chapter != null ? "Ch. " + chapter : "Manual entry");
  return {
    id: e.id,
    entityType: e.type,
    label: e.name || "Untitled event",
    chapter,
    srcChapterId: e.chapterId || (chapter != null ? ctx.chapterIdByNum.get(chapter) || null : null),
    era,
    date,
    dateType,
    confidence: d.confidence || (srcText ? "strong" : "high"),
    canon: d.canon || d.band || "hard",
    entities: [..._tlIds(d.participants), ..._tlIds(d.characters)].filter((id) => ctx.cast[id]),
    locationId: [..._tlIds(d.location), ..._tlIds(d.locations)][0] || null,
    quest: [..._tlIds(d.relatedQuests), ..._tlIds(d.quests)][0] || null,
    summary: e.summary || d.summary || "",
    flashback: !!d.flashback,
    source,
  };
};

const buildTLContext = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const ctx = {
    cast: {}, castList: [], locs: {}, locList: [],
    quests: [], factions: [], events: [], review: [],
    chapterNumById: new Map(), chapterIdByNum: new Map(),
  };
  if (!B) return ctx;
  try {
    const chState = B.ManuscriptChapterService?.loadSync?.() || {};
    (chState.chapters || []).filter((c) => !c.reserved).forEach((c, i) => {
      const num = c.num || i + 1;
      ctx.chapterNumById.set(c.id, num);
      ctx.chapterIdByNum.set(num, c.id);
    });
  } catch (_e) {}
  for (const e of (B.EntityService?.listSync?.("cast") || [])) {
    if (!e || e.status === "deleted") continue;
    const c = {
      id: e.id, name: e.name || "Unnamed",
      initials: e.glyphChar || _tlInitials(e.name),
      color: (e.data && e.data.color) || TL_PALETTE[_tlHash(e.id) % TL_PALETTE.length],
    };
    ctx.cast[c.id] = c;
    ctx.castList.push(c);
  }
  for (const e of (B.EntityService?.listSync?.("locations") || [])) {
    if (!e || e.status === "deleted") continue;
    const l = { id: e.id, name: e.name || "Unnamed", type: (e.data && (e.data.kind || e.data.locationType)) || "", color: "#76684c" };
    ctx.locs[l.id] = l;
    ctx.locList.push(l);
  }
  ctx.quests = (B.EntityService?.listSync?.("quests") || [])
    .filter((e) => e && e.status !== "deleted")
    .map((e) => ({ id: e.id, name: e.name || "Unnamed", color: "#8a6a2a" }));
  ctx.factions = (B.EntityService?.listSync?.("factions") || [])
    .filter((e) => e && e.status !== "deleted")
    .map((e) => ({ id: e.id, name: e.name || "Unnamed", color: "#3d3a78" }));

  const rows = [
    ...(B.EntityService?.listSync?.("events") || []),
    ...(B.EntityService?.listSync?.("timeline") || []),
  ].filter((e) => e && e.status !== "deleted");
  ctx.events = rows.map((e) => liveEventToTL(e, ctx));

  ctx.review = [
    ...(B.ReviewService?.listSync?.("events") || []),
    ...(B.ReviewService?.listSync?.("timeline") || []),
  ]
    .filter((q) => q.status === "pending")
    .map((q) => {
      const conf = typeof q.confidence === "number" ? q.confidence : (typeof q.value === "number" ? q.value / 100 : 0.6);
      const lvl = conf >= 0.95 ? "high" : conf >= 0.75 ? "strong" : conf >= 0.5 ? "uncertain" : "weak";
      const chNum = q.chapterId ? ctx.chapterNumById.get(q.chapterId) : null;
      return {
        id: q.id,
        lvl,
        title: q.name || "Event candidate",
        action: q.suggestedAction === "create" ? "Add to timeline?"
          : q.suggestedAction === "update" ? "Update event"
          : (q.action || "Review"),
        excerpt: q.sourceQuote || (q.payload && q.payload.sourceQuote) || q.summary || q.reason || "",
        cite: chNum ? "Ch. " + chNum : "",
      };
    });
  return ctx;
};

const _tlDispatch = (name, detail) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));
const _tlQueueAction = (name, id) =>
  _tlDispatch("lw:dispatch-callback", { name, detail: { id } });

// ---------------------------------------------------------------------
// Single event card
// ---------------------------------------------------------------------
const TLEventCard = ({ ctx, event, orientation, onClick, selected }) => {
  const loc = event.locationId ? ctx.locs[event.locationId] : null;
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
            const c = ctx.cast[cid];
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
const TLVerticalView = ({ ctx, events, onClick, selectedId }) => (
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
                <TLEventCard ctx={ctx} event={e} orientation="vert" onClick={onClick} selected={e.id === selectedId}/>
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
const TLHorizontalView = ({ ctx, events, onClick, selectedId }) => (
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
                  <TLEventCard ctx={ctx} event={e} orientation="horz" onClick={onClick} selected={e.id === selectedId}/>
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
const TLInspector = ({ ctx, event, onClose }) => {
  if (!event) return null;
  const loc = event.locationId ? ctx.locs[event.locationId] : null;
  const quest = event.quest ? ctx.quests.find((q) => q.id === event.quest) : null;
  const B = window.LoomwrightBackend;

  const openEditor = () => {
    const rec = B?.EntityService?.getSync?.(event.id, event.entityType);
    if (rec) _tlDispatch("lw:open-entity-editor", { type: event.entityType, initial: rec, mode: "full" });
  };
  const toggleFlashback = async () => {
    const rec = B?.EntityService?.getSync?.(event.id, event.entityType);
    if (!rec) return;
    await B.EntityService.update(event.entityType, event.id, {
      data: { ...(rec.data || {}), flashback: !(rec.data && rec.data.flashback) },
    });
  };
  const showOnAtlas = () => {
    if (!event.locationId) {
      _tlDispatch("lw:backend-notice", { message: "No location linked to this event yet — set one in the editor." });
      return;
    }
    _tlDispatch("lw:open-panel", { kind: "atlas" });
    _tlDispatch("lw:focus-entity", { panelKind: "atlas", entityId: event.locationId, label: loc?.name || "" });
  };
  const openSource = () => {
    if (event.srcChapterId) {
      _tlDispatch("lw:open-search-result", { type: "chapter", chapterId: event.srcChapterId });
    } else {
      _tlDispatch("lw:backend-notice", { message: "No manuscript chapter linked to this event yet." });
    }
  };

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
        {quest && <TLRow k="Quest" v={quest.name}/>}
      </div>
      <div className="tl-insp__sec">
        <div className="tl-insp__sech">Cast involved</div>
        <div className="tl-insp__chips">
          {event.entities.map((cid) => {
            const c = ctx.cast[cid];
            if (!c) return null;
            return (
              <button key={cid} className="tl-insp__chip" style={{ "--c": c.color }}
                      onClick={() => {
                        _tlDispatch("lw:open-panel", { kind: "cast" });
                        _tlDispatch("lw:open-cast-member", { entityId: cid });
                      }}>
                <span className="tl-insp__chip-avatar">{c.initials}</span>
                <span>{c.name}</span>
              </button>
            );
          })}
          {event.entities.length === 0 && <span className="tl-insp__source">No cast linked yet.</span>}
        </div>
      </div>
      <div className="tl-insp__sec">
        <div className="tl-insp__sech">Source</div>
        <div className="tl-insp__source">{event.source}</div>
      </div>
      <div className="tl-insp__actions">
        <button data-callback="onEditTimelineEvent" onClick={openEditor}>Edit event</button>
        <button data-callback="onSetTimelineDate" onClick={openEditor}>Set date</button>
        <button data-callback="onMarkTimelineFlashback" onClick={toggleFlashback}>{event.flashback ? "Clear flashback" : "Mark flashback"}</button>
        <button data-callback="onShowTimelineMomentOnAtlas" onClick={showOnAtlas}>Show on Atlas</button>
        <button data-callback="onOpenTimelineSource" onClick={openSource}>Open source</button>
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
const TLFilters = ({ ctx, filters, onToggleFilter }) => {
  const cityish = ctx.locList.filter((l) => /city|region|settlement|town|capital/i.test(l.type));
  const groups = [
    { k: "character", items: ctx.castList.slice(0, 8) },
    { k: "location",  items: (cityish.length ? cityish : ctx.locList).slice(0, 8) },
    { k: "quest",     items: ctx.quests.slice(0, 8) },
    { k: "faction",   items: ctx.factions.slice(0, 8) },
  ];
  return (
    <div className="tl-filt">
      {groups.map((g) => (
        <div key={g.k} className="tl-filt__grp">
          <span className="tl-filt__lbl">{g.k}</span>
          {g.items.length === 0 && <span className="tl-filt__lbl" style={{ opacity: 0.6 }}>— none yet —</span>}
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
const TLReviewView = ({ ctx }) => (
  <div className="tl-review">
    {ctx.review.map((r) => (
      <div key={r.id} className={"tl-review__card tl-review__card--" + r.lvl}>
        <div className="tl-review__head">
          <ConfidenceBadge level={r.lvl}/>
          <span className="tl-review__title">{r.title}</span>
        </div>
        <p className="tl-review__quote">"{r.excerpt}"</p>
        <div className="tl-review__meta">{r.cite}</div>
        <div className="tl-review__pill">{r.action}</div>
        <div className="tl-review__actions">
          <button data-callback="onAcceptTimelineQueueItem" data-testid={"tl-accept-" + r.id}
                  onClick={() => _tlQueueAction("onAcceptTimelineQueueItem", r.id)}>Accept</button>
          <button data-callback="onEditTimelineQueueItem"
                  onClick={() => _tlQueueAction("onEditTimelineQueueItem", r.id)}>Edit</button>
          <button data-callback="onMergeTimelineQueueItem"
                  onClick={() => _tlQueueAction("onMergeTimelineQueueItem", r.id)}>Merge</button>
          <button data-callback="onDenyTimelineQueueItem"
                  onClick={() => _tlQueueAction("onDenyTimelineQueueItem", r.id)}>Deny</button>
        </div>
      </div>
    ))}
    {ctx.review.length === 0 && (
      <div className="tl-empty" data-ui="TLReviewEmpty">
        <div className="tl-empty__title">Review queue is clear</div>
        <div className="tl-empty__body">Event candidates from extraction land here.</div>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------
// Empty state — no events at all yet (panel chrome stays visible).
// ---------------------------------------------------------------------
const TLEmptyState = () => (
  <div className="tl-empty" data-ui="TLEmptyState">
    <div className="tl-empty__title">No events yet</div>
    <div className="tl-empty__body">Pin happenings to the timeline — add one by hand, or let extraction find them in your chapters.</div>
    <div className="tl-empty__actions">
      <button className="tl-bar__add" data-callback="onCreateTimelineEvent">
        <Icon name="plus" size={11}/><span>Add event</span>
      </button>
      <button className="tl-bar__add" data-callback="onExtractEvents"
              onClick={() => _tlDispatch("lw:open-extraction-wizard", { scope: "manuscript", typeFocus: "events" })}>
        <Icon name="sparkle" size={11}/><span>Extract from chapters</span>
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// TimelinePanelBody — main entry
// ---------------------------------------------------------------------
const TimelinePanelBody = ({ panel, onSelectEntity }) => {
  // Re-snapshot the live context when the store / queue / chapters move.
  const [storeVersion, setStoreVersion] = _tl_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated",
                 "lw:manuscript-chapters-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const ctx = _tl_um(() => buildTLContext(), [storeVersion]);

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

  // The entity-scoped modes are filter lenses — entering one opens the
  // matching filter rail so the chips are one click away.
  const onSetMode = _tl_uc((id) => {
    setMode(id);
    if (["character", "location", "quest", "faction"].includes(id)) setShowFilters(true);
  }, []);

  // Filtered + sorted events
  const events = _tl_um(() => {
    let list = ctx.events;
    if (filters.character.length) list = list.filter((e) => e.entities.some((c) => filters.character.includes(c)));
    if (filters.location.length)  list = list.filter((e) => filters.location.includes(e.locationId));
    if (filters.quest.length)     list = list.filter((e) => filters.quest.includes(e.quest));
    if (filters.faction.length)   list = list.filter((e) => {
      const B = window.LoomwrightBackend;
      const rec = B?.EntityService?.getSync?.(e.id, e.entityType);
      const ids = _tlIds(rec?.data?.factions);
      return ids.some((id) => filters.faction.includes(id));
    });
    if (mode === "book") {
      return [...list].sort((a, b) => (a.chapter ?? 99) - (b.chapter ?? 99));
    }
    // Chronological (and the lens modes): era order, then chapter, then label.
    const eraIx = { pre: 0, ch: 1, after: 2 };
    return [...list].sort((a, b) =>
      (eraIx[a.era] - eraIx[b.era]) || ((a.chapter ?? 999) - (b.chapter ?? 999)) || a.label.localeCompare(b.label));
  }, [ctx, mode, filters]);

  const selected = ctx.events.find((e) => e.id === selectedId);
  const expanded = panel?.expanded;

  return (
    <div className="tl" data-ui="TimelinePanelBody" data-orientation={expanded ? "horizontal" : "vertical"}>
      <div className="tl-bar">
        <div className="tl-bar__modes">
          {TL_MODES.map((m) => (
            <button key={m.id} className={"tl-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => onSetMode(m.id)} data-callback="onSetTimelineMode" data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && ctx.review.length > 0 && <span className="tl-bar__q">{ctx.review.length}</span>}
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

      {showFilters && <TLFilters ctx={ctx} filters={filters} onToggleFilter={onToggleFilter}/>}

      <div className="tl-grid" data-mode={expanded ? "split" : "stack"}>
        <div className="tl-stage">
          {mode === "review" ? (
            <TLReviewView ctx={ctx}/>
          ) : ctx.events.length === 0 ? (
            <TLEmptyState/>
          ) : expanded ? (
            <TLHorizontalView ctx={ctx} events={events} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          ) : (
            <TLVerticalView ctx={ctx} events={events} onClick={(e) => setSelectedId(e.id)} selectedId={selectedId}/>
          )}
        </div>
        {expanded && mode !== "review" && (
          <div className="tl-rail">
            <TLInspector ctx={ctx} event={selected} onClose={() => setSelectedId(null)}/>
          </div>
        )}
      </div>

      {!expanded && mode !== "review" && selected && (
        <div className="tl-drawer">
          <TLInspector ctx={ctx} event={selected} onClose={() => setSelectedId(null)}/>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  TL_ERAS, TL_MODES, buildTLContext, liveEventToTL,
  TimelinePanelBody, TLVerticalView, TLHorizontalView, TLInspector, TLEventCard, TLReviewView, TLFilters, TLEmptyState,
});
