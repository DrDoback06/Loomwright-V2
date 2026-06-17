// =====================================================================
// upgrades-items.jsx — Items system: bespoke ItemsPanelBody.
//
// Wires into PanelStack via window.ItemsPanelBody.
// Uses RPG_ITEM_DATA + ItemDetail from rpg-entities.jsx so we don't
// duplicate dossier markup; this file owns the panel chrome,
// equipment-slot/owner widgets, ownership timeline, and review tab.
// =====================================================================

const { useState: _it_us, useMemo: _it_um, useCallback: _it_uc } = React;

// ---------------------------------------------------------------------
// Item-system review queue (extends what's already loaded).
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Rarity tone (matches ItemDetail's facet tones)
// ---------------------------------------------------------------------
const ITEM_RARITY_COLORS = {
  "Common":     { dot: "#8a8275", soft: "#efe9dc" },
  "Uncommon":   { dot: "#5b7a4a", soft: "#e7eddc" },
  "Rare":       { dot: "#3e6db5", soft: "#dde7f5" },
  "Heirloom":   { dot: "#9a7b3a", soft: "#f1e7cf" },
  "Mythic":     { dot: "#7a4a8a", soft: "#ecdef1" },
  "Cursed":     { dot: "#a84a3a", soft: "#f3dcd7" },
};

const ITEM_STATUS_LABEL = {
  "active":    { label: "Active",    tone: "ok" },
  "carried":   { label: "Carried",   tone: "ok" },
  "equipped":  { label: "Equipped",  tone: "ok" },
  "lost":      { label: "Lost",      tone: "warn" },
  "destroyed": { label: "Destroyed", tone: "danger" },
  "dormant":   { label: "Dormant",   tone: "neutral" },
  "draft":     { label: "Draft",     tone: "neutral" },
};

// ---------------------------------------------------------------------
// Live-data adapters
//
// Live item entities keep identity fields top-level (name, summary,
// status, glyphChar…) and ALL other custom fields under entity.data.*
// using the editor's field ids. The bespoke roster/dossier + the shared
// ItemDetail were written against flat demo objects, so without these a
// real item renders empty. Mirrors liveCastToDossier / liveBestiaryToDetail
// / liveLocationToDetail.
// ---------------------------------------------------------------------
const _itB = () => (typeof window !== "undefined") && window.LoomwrightBackend;
function _itResolveRef(r) {
  if (!r) return null;
  if (typeof r === "object") return { id: r.id, name: r.name || r.label || r.id, label: r.name || r.label || r.id, type: r.type || "" };
  let nm = r, ty = "";
  try { const B = _itB(); const ent = B && B.EntityService && B.EntityService.getSync(r); if (ent) { nm = ent.name || r; ty = ent.type || ""; } } catch (_e) {}
  return { id: r, name: nm, label: nm, type: ty };
}
function _itRefList(arr, ty) {
  return (Array.isArray(arr) ? arr : []).map((r) => { const x = _itResolveRef(r); if (x && ty && !x.type) x.type = ty; return x; }).filter(Boolean);
}

// Cheap projection for the roster + status/rarity filters (no occurrence scan).
function liveItemToRow(entity) {
  if (!entity) return entity;
  const d = entity.data || {};
  const owner = _itResolveRef(d.currentOwner);
  return {
    ...entity,
    itemType: d.itemType || d.customType || "",
    rarity: d.rarity || "",
    slot: d.slot || "",
    weight: d.weight || "",
    glyphChar: entity.glyphChar || d.icon || "",
    currentOwner: owner,
    queue: entity.reviewQueueCount || entity.queue || 0,
  };
}

// Full projection for the selected dossier — maps every field the dossier
// widgets + the shared ItemDetail render, builds `sites` from the editor's
// found/used/lost location fields, and derives mentions + per-chapter spark
// from the occurrence index.
function liveItemToDetail(entity) {
  if (!entity) return entity;
  const top = entity, d = entity.data || {};
  const B = _itB();
  const norm = (s) => (s == null ? "" : String(s));
  const modifiers = (Array.isArray(d.modifiers) ? d.modifiers : []).map((m) => ({
    target: m.target || m.stat || m.label || m.name || "",
    delta: (m.delta != null ? m.delta : (m.value != null ? m.value : m.amount)),
    note: m.note || m.detail || "",
  })).filter((m) => m.target);
  const affixes = (Array.isArray(d.affixes) ? d.affixes : []).map((a) => ({
    name: a.name || a.label || a.affix || a.target || "",
    note: a.note || a.detail || "",
  })).filter((a) => a.name);
  const found = _itResolveRef(d.foundLocation);
  const lost  = _itResolveRef(d.lostLocation || d.destroyedLocation);
  const used  = _itRefList(d.usedLocations, "locations");
  const sites = (found || lost || used.length) ? { found, used, lost } : {};
  let occ = [], chapters = [];
  try { occ = (B && B.OccurrenceService && (B.OccurrenceService.listByEntitySync ? B.OccurrenceService.listByEntitySync(entity.id) : (B.OccurrenceService.listAllSync() || []).filter((o) => o.entityId === entity.id))) || []; } catch (_e) {}
  try { chapters = ((B && B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync().chapters) || []).filter((c) => c && !c.reserved); } catch (_e) {}
  const numById = new Map(); chapters.forEach((c, i) => numById.set(c.id, c.num || i + 1));
  const maxNum = chapters.reduce((m, c) => Math.max(m, numById.get(c.id) || 0), 0);
  const mentionsByChapter = maxNum ? new Array(maxNum).fill(0) : [];
  const mentions = [];
  for (const o of occ) {
    if (!o || o.isPronounResolution) continue;
    const n = numById.get(o.chapterId);
    if (n != null && mentionsByChapter[n - 1] != null) mentionsByChapter[n - 1] += 1;
    if (mentions.length < 12 && o.exactText) mentions.push({ id: o.occurrenceId || ("occ-" + mentions.length), cite: n != null ? "Ch. " + n : "—", excerpt: o.exactText, chapterId: o.chapterId });
  }
  return {
    ...entity,
    itemType: d.itemType || d.customType || "",
    rarity: d.rarity || "",
    status: top.status || "active",
    summary: top.summary || d.summary || "",
    description: d.description || "",
    glyphChar: top.glyphChar || d.icon || "",
    slot: d.slot || "",
    weight: d.weight || "",
    value: d.value || "",
    condition: d.condition || "",
    first: d.firstChapter || "",
    last: d.lastChapter || "",
    currentOwner: _itResolveRef(d.currentOwner),
    ownershipText: norm(d.ownershipHistory),
    restrictions: norm(d.restrictions),
    modifiers,
    affixes,
    effects: Array.isArray(d.triggered) ? d.triggered : [],
    ownership: [], equipped: [], trades: [], upgrades: [],
    quests: _itRefList(d.quests, "quests"),
    events: _itRefList(d.events, "events"),
    factions: _itRefList(d.factions, "factions"),
    sites,
    mentions,
    mentionsByChapter,
  };
}

// ---------------------------------------------------------------------
// EquipmentSlotCard — small composed widget for the selected item
// ---------------------------------------------------------------------
const ItemEquipmentSlotCard = ({ item }) => {
  if (!item) return null;
  const owner = item.currentOwner || (item.ownership && item.ownership[item.ownership.length - 1]);
  const ownerName = owner ? (owner.name || owner) : "Unclaimed";
  const rarity = ITEM_RARITY_COLORS[item.rarity] || ITEM_RARITY_COLORS["Common"];
  return (
    <div className="item-eqcard" data-ui="ItemEquipmentSlotCard">
      <div className="item-eqcard__slot" style={{ background: rarity.soft, color: rarity.dot }}>
        <span className="item-eqcard__monogram">{item.glyphChar || (item.name || "").slice(0, 2)}</span>
      </div>
      <div className="item-eqcard__meta">
        <div className="item-eqcard__row">
          <span className="item-eqcard__lbl">Slot</span>
          <span className="item-eqcard__val">{item.slot || "—"}</span>
        </div>
        <div className="item-eqcard__row">
          <span className="item-eqcard__lbl">Owner</span>
          <span className="item-eqcard__val item-eqcard__val--strong">{ownerName}</span>
        </div>
        <div className="item-eqcard__row">
          <span className="item-eqcard__lbl">Weight</span>
          <span className="item-eqcard__val">{item.weight || "—"}</span>
        </div>
      </div>
      <div className="item-eqcard__actions">
        <button className="rpg-btn rpg-btn--small" data-callback="onEquipItem">Equip</button>
        <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onTransferItem">Transfer</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// ItemEffectsStrip — compact display of modifiers + affixes
// ---------------------------------------------------------------------
const ItemEffectsStrip = ({ item }) => {
  if (!item) return null;
  const mods = item.modifiers || [];
  const aff  = item.affixes   || [];
  if (mods.length === 0 && aff.length === 0) {
    return <div className="item-effects item-effects--empty">No modifiers recorded.</div>;
  }
  return (
    <div className="item-effects" data-ui="ItemEffectsStrip">
      {mods.map((m, i) => (
        <div key={"m" + i} className={"item-effects__chip item-effects__chip--" + (m.delta > 0 ? "up" : m.delta < 0 ? "down" : "flat")}
             title={m.note || ""}>
          <span className="item-effects__t">{m.target}</span>
          <span className="item-effects__d">{m.delta > 0 ? "+" + m.delta : m.delta}</span>
        </div>
      ))}
      {aff.map((a, i) => (
        <div key={"a" + i} className="item-effects__chip item-effects__chip--affix" title={a.note || ""}>
          <span className="item-effects__t">{a.name}</span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// ItemOwnershipTimeline — chronological history of who held the item
// ---------------------------------------------------------------------
const ItemOwnershipTimeline = ({ item, onOpenSourceMention }) => {
  if (!item) return null;
  const events = []
    .concat((item.ownership || []).map((o) => ({ ...o, kind: "ownership" })))
    .concat((item.equipped  || []).map((o) => ({ ...o, kind: "equipped"  })))
    .concat((item.trades    || []).map((o) => ({ ...o, kind: "trade"     })))
    .concat((item.upgrades  || []).map((o) => ({ ...o, kind: "upgrade"   })))
    .sort((a, b) => (a.chapter || 0) - (b.chapter || 0));

  if (events.length === 0) {
    return <EmptyState icon="paper" title="No history yet" body="Ownership and equip moves will appear here as the manuscript references this item."/>;
  }

  return (
    <ol className="item-otline" data-ui="ItemOwnershipTimeline">
      {events.map((ev, i) => (
        <li key={i} className={"item-otline__row item-otline__row--" + ev.kind}>
          <span className="item-otline__chap">Ch. {ev.chapter || "—"}</span>
          <span className="item-otline__kind">{ev.kind}</span>
          <span className="item-otline__what">{ev.what}</span>
          {ev.cite && (
            <button className="item-otline__cite" data-callback="onOpenSourceMention"
                    onClick={() => onOpenSourceMention && onOpenSourceMention(ev)}>
              {ev.cite}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
};

// ---------------------------------------------------------------------
// ItemLocationHistory — sites.found / used / lost compact
// ---------------------------------------------------------------------
const ItemLocationHistory = ({ item, onSelectEntity }) => {
  if (!item) return null;
  const s = item.sites || {};
  const empty = !s.found && (!s.used || !s.used.length) && !s.lost;
  if (empty) return <div className="item-sites item-sites--empty">No known locations.</div>;
  return (
    <div className="item-sites" data-ui="ItemLocationHistory">
      {s.found && (
        <div className="item-sites__row">
          <span className="item-sites__lbl item-sites__lbl--found">Found</span>
          <button className="item-sites__btn" onClick={() => onSelectEntity && onSelectEntity({ id: s.found.id, type: "locations", label: s.found.name })}>{s.found.name}</button>
          {s.found.cite && <span className="item-sites__cite">{s.found.cite}</span>}
        </div>
      )}
      {s.used && s.used.length > 0 && (
        <div className="item-sites__row">
          <span className="item-sites__lbl item-sites__lbl--used">Used</span>
          <div className="item-sites__chips">
            {s.used.map((u, i) => (
              <button key={i} className="item-sites__chip" onClick={() => onSelectEntity && onSelectEntity({ id: u.id, type: "locations", label: u.name })}>{u.name}</button>
            ))}
          </div>
        </div>
      )}
      {s.lost && (
        <div className="item-sites__row">
          <span className="item-sites__lbl item-sites__lbl--lost">Lost</span>
          <button className="item-sites__btn" onClick={() => onSelectEntity && onSelectEntity({ id: s.lost.id, type: "locations", label: s.lost.name })}>{s.lost.name}</button>
          {s.lost.cite && <span className="item-sites__cite">{s.lost.cite}</span>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// ItemReviewCard — local review queue item
// ---------------------------------------------------------------------
const ItemReviewCard = ({ item }) => {
  const c = (window.CONFIDENCE || {})[item.level] || {};
  return (
    <div className="item-review" data-entity-id={item.id} data-entity-type="items" style={{ "--cc": c.color, "--cs": c.soft, "--cd": c.deep }}>
      <div className="item-review__head">
        <ConfidenceBadge level={item.level} value={item.value}/>
        <span className="item-review__type">{item.candidateType}</span>
      </div>
      <div className="item-review__name">{item.name}</div>
      <div className="item-review__sugg">{item.suggested}</div>
      <blockquote className="item-review__quote">"{item.sourceQuote}"</blockquote>
      <div className="item-review__meta">
        <span className="item-review__cite">{item.sourceChapter}</span>
        {item.related && <span className="item-review__rel">↔ {item.related}</span>}
        {item.warning && <span className="item-review__warn">⚠ {item.warning}</span>}
      </div>
      <div className="item-review__actions">
        <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onAcceptItemQueueItem">Accept</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onEditItemQueueItem">Edit</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onMergeItemQueueItem">Merge</button>
        <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDenyItemQueueItem">Deny</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// ItemsPanelBody — bespoke panel body
// ---------------------------------------------------------------------
const ItemsPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  // Live items only — never the demo RPG_ITEM_DATA. Project rows through
  // liveItemToRow so rarity/slot/owner read off entity.data.*; the selected
  // dossier gets the full liveItemToDetail adapter.
  const rawData = (window.LoomwrightBackend?.EntityService?.listSync("items")) || [];
  const data = rawData.map(liveItemToRow);
  const [selectedId, setSelectedId] = _it_us(panel?.selected?.id || (rawData[0] && rawData[0].id) || null);
  const [search, setSearch]         = _it_us("");
  const [statusFilter, setStatus]   = _it_us("all");
  const [rarityFilter, setRarity]   = _it_us("all");
  const [tab, setTab]               = _it_us("dossier"); // dossier | history | review | mentions

  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  // Cross-tab focus: another panel's selection (a cast member, a location)
  // narrows the vault to items that reference it (owner, location, links).
  const ff = panelContext?.focusedEntity || null;

  const filtered = _it_um(() => {
    return data.filter((d) => {
      if (search && !(d.name || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && (d.status || "").toLowerCase() !== statusFilter) return false;
      if (rarityFilter !== "all" && (d.rarity || "")             !== rarityFilter) return false;
      if (ff && typeof _fwReferencesEntity !== "undefined" && !_fwReferencesEntity(d, ff.id)) return false;
      return true;
    });
  }, [data, search, statusFilter, rarityFilter, ff && ff.id]);

  // Resolve selection against live data; fall back to the first visible row.
  const _selRaw = rawData.find((d) => d.id === selectedId)
    || rawData.find((d) => d.id === (filtered[0] || {}).id)
    || rawData[0] || null;
  const selected = _selRaw ? liveItemToDetail(_selRaw) : null;

  const onPickRow = _it_uc((it) => {
    setSelectedId(it.id);
    onSelectEntity && onSelectEntity({ id: it.id, type: "items", label: it.name });
  }, [onSelectEntity]);

  const onCreate = _it_uc(() => {
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "items" } }));
  }, []);

  // Open a manuscript mention in the Writer's Room at its cited chapter.
  const openSource = _it_uc((m) => {
    if (m && m.chapterId) {
      window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: m.chapterId } }));
      window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } }));
    }
  }, []);

  // Drag — make rows draggable so user can drop into Writer's Room / Composition Overlay
  const onDragRow = (e, it) => {
    try {
      const payload = { entityType: "items", id: it.id, name: it.name, glyph: it.glyphChar };
      e.dataTransfer.setData("application/x-loom-entity", JSON.stringify(payload));
      e.dataTransfer.setData("text/loomwright-entity", JSON.stringify({ type: "items", id: it.id, name: it.name }));
      e.dataTransfer.effectAllowed = "copy";
    } catch (_err) {}
  };

  return (
    <div className="loc-body" data-ui="ItemsPanelBody">
      {/* Top chrome */}
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search items…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <select className="loc-body__filter" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="carried">Carried</option>
            <option value="equipped">Equipped</option>
            <option value="stored">Stored</option>
            <option value="lost">Lost</option>
            <option value="destroyed">Destroyed</option>
            <option value="retired">Retired</option>
            <option value="dormant">Dormant</option>
          </select>
          <select className="loc-body__filter" value={rarityFilter} onChange={(e) => setRarity(e.target.value)}>
            <option value="all">All rarities</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Heirloom">Heirloom</option>
            <option value="Mythic">Mythic</option>
            <option value="Cursed">Cursed</option>
          </select>
          <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreateItem" title="Create item" onClick={onCreate}/>
          <Btn variant="ghost" size="sm" icon="bell" data-callback="onOpenItemsReviewQueue" title="Items review queue"/>
        </div>
      </div>

      {/* Split: roster + dossier */}
      <div className="loc-body__split">
        {/* Left: roster */}
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Inventory</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <div className="item-roster">
            {filtered.length === 0 ? (
              <div className="item-roster__empty">No items match.</div>
            ) : filtered.map((it) => {
              const rarity = ITEM_RARITY_COLORS[it.rarity] || ITEM_RARITY_COLORS["Common"];
              const owner = it.currentOwner || (it.ownership && it.ownership[it.ownership.length - 1]);
              const status = ITEM_STATUS_LABEL[(it.status || "active").toLowerCase()] || ITEM_STATUS_LABEL["active"];
              return (
                <div
                  key={it.id}
                  className={"item-roster__row" + (selectedId === it.id ? " is-selected" : "")}
                  draggable
                  onDragStart={(e) => onDragRow(e, it)}
                  onClick={() => onPickRow(it)}
                  data-entity-id={it.id}
                  data-entity-type="items"
                >
                  <span className="item-roster__glyph" style={{ background: rarity.soft, color: rarity.dot }}>
                    {it.glyphChar || (it.name || "").slice(0, 2)}
                  </span>
                  <div className="item-roster__body">
                    <div className="item-roster__name">{it.name}</div>
                    <div className="item-roster__sub">
                      <span className="item-roster__slot">{it.slot || "—"}</span>
                      <span className="item-roster__sep">·</span>
                      <span className="item-roster__owner">{owner ? (owner.name || owner) : "Unclaimed"}</span>
                    </div>
                  </div>
                  <div className="item-roster__meta">
                    <span className={"item-roster__status item-roster__status--" + status.tone}>{status.label}</span>
                    {it.queue ? <span className="item-roster__queue" title="Review items">{it.queue}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="loc-body__tree-actions">
            <button className="rpg-btn rpg-btn--small" onClick={onCreate} data-callback="onCreateItem">+ Item</button>
            <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onImportItems">Import</button>
          </div>
        </aside>

        {/* Right: dossier with tabs */}
        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">
                    {selected.itemType || "Item"} · {selected.rarity || "Common"}
                  </div>
                  <div className="loc-body__detail-title">{selected.name}</div>
                  {selected.subtitle && (
                    <div style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: "var(--fs-xs)", marginTop: 2 }}>
                      {selected.subtitle}
                    </div>
                  )}
                </div>
                <div className="loc-body__tabs">
                  {[
                    ["dossier",  "Dossier"],
                    ["history",  "History"],
                    ["review",   "Review" + (((window.LoomwrightBackend?.ReviewService?.listSync?.("items") || []).filter((q) => q.status === "pending").length || 0) > 0 ? " · " + (window.LoomwrightBackend?.ReviewService?.listSync?.("items") || []).filter((q) => q.status === "pending").length : "")],
                    ["mentions", "Mentions"],
                  ].map(([k, l]) => (
                    <button key={k} className={"loc-body__tab" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>{l}</button>
                  ))}
                </div>
              </div>

              <div style={{ overflowY: "auto", flex: 1 }}>
                {tab === "dossier" && (
                  <div className="item-dossier">
                    {/* Mini-widget row: equipment slot card */}
                    <div className="item-dossier__widgets">
                      <ItemEquipmentSlotCard item={selected}/>
                    </div>
                    {/* Effects strip */}
                    <div className="item-dossier__strip">
                      <div className="item-dossier__strip-label">Modifiers · affixes</div>
                      <ItemEffectsStrip item={selected}/>
                    </div>
                    {/* Location history */}
                    <div className="item-dossier__strip">
                      <div className="item-dossier__strip-label">Where it's been
                        <button className="item-dossier__strip-link" data-callback="onShowItemOnAtlas">Show on Atlas →</button>
                      </div>
                      <ItemLocationHistory item={selected} onSelectEntity={onSelectEntity}/>
                    </div>
                    {/* Quest/event chips */}
                    {((selected.quests || []).length > 0 || (selected.events || []).length > 0) && (
                      <div className="item-dossier__strip">
                        <div className="item-dossier__strip-label">Linked threads</div>
                        <div className="item-dossier__chips">
                          {(selected.quests || []).map((q) => (
                            <button key={q.id} className="item-chip item-chip--quest" onClick={() => onSelectEntity && onSelectEntity({ id: q.id, type: "quests", label: q.label })}>
                              <span className="item-chip__glyph">◈</span>{q.label}
                            </button>
                          ))}
                          {(selected.events || []).map((ev) => (
                            <button key={ev.id} className="item-chip item-chip--event" onClick={() => onSelectEntity && onSelectEntity({ id: ev.id, type: "events", label: ev.label })}>
                              <span className="item-chip__glyph">✦</span>{ev.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Full ItemDetail for the lower-fidelity sections (effects table, full history etc) */}
                    <div className="item-dossier__full">
                      {typeof ItemDetail !== "undefined" && (
                        <ItemDetail
                          entity={selected}
                          onSelectEntity={onSelectEntity}
                          onOpenRelatedTab={onSelectEntity}
                          onOpenSourceMention={openSource}
                        />
                      )}
                    </div>
                  </div>
                )}

                {tab === "history" && (
                  <div style={{ padding: 12 }}>
                    {selected.ownershipText && <p className="rpg-prose" style={{ marginBottom: 10 }}>{selected.ownershipText}</p>}
                    <ItemOwnershipTimeline item={selected} onOpenSourceMention={openSource}/>
                  </div>
                )}

                {tab === "review" && (
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("items") || []).length === 0 ? (
                      <EmptyState icon="bell" title="Inbox empty" body="Items-related extraction items will appear here."/>
                    ) : (window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("items") || []).map((r) => <ItemReviewCard key={r.id} item={r}/>)}
                  </div>
                )}

                {tab === "mentions" && (
                  <div style={{ padding: 12 }}>
                    {(selected.mentions || []).length === 0 ? (
                      <EmptyState icon="search" title="No mentions yet" body="Run extraction to surface direct source quotes for this item."/>
                    ) : (
                      <ul className="item-mentions">
                        {selected.mentions.map((m) => (
                          <li key={m.id} className="item-mentions__row">
                            <blockquote>"{m.excerpt}"</blockquote>
                            <button className="item-mentions__cite" data-callback="onOpenSourceMention" onClick={() => openSource(m)}>{m.cite}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState icon="paper" title="Pick an item" body="Select an item from the inventory to see its dossier."/>
          )}
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Wire data into globals
// ---------------------------------------------------------------------

// Mirror rich data into ENTITY_SAMPLES so other panels chip-resolve items.
if (typeof RPG_ITEM_DATA !== "undefined") {
  window.ENTITY_SAMPLES = window.ENTITY_SAMPLES || {};
}

window.RPG_FILTERS = window.RPG_FILTERS || {};
window.RPG_FILTERS.items = [
  { key: "rarity:Heirloom",  label: "Heirloom" },
  { key: "rarity:Rare",      label: "Rare" },
  { key: "rarity:Mythic",    label: "Mythic" },
  { key: "rarity:Cursed",    label: "Cursed" },
  { key: "status:active",    label: "Active" },
  { key: "status:lost",      label: "Lost" },
  { key: "status:destroyed", label: "Destroyed" },
  { key: "owner:any",        label: "Has owner" },
  { key: "queue:any",        label: "Has review" },
  { key: "linked:quest",     label: "Linked to quest" },
];

Object.assign(window, {
  ItemsPanelBody,
  ItemEquipmentSlotCard, ItemEffectsStrip, ItemOwnershipTimeline, ItemLocationHistory, ItemReviewCard, ITEM_RARITY_COLORS,
});
