// =====================================================================
// workspaces-rpg.jsx — Full workspaces for RPG entity tabs.
//
// Registered:
//   • location-registry  — Location Registry (wiki/registry companion to Atlas)
//   • item-vault         — Item Vault (ownership/equipment/history)
//   • class-builder      — Class Builder
//   • species-registry   — Species Registry (Races)
//   • stat-lab           — Stat Lab (phrase rule editor + test phrase)
//   • faction-registry   — Faction Registry
//
// Each workspace uses the shared WorkspaceShell + live-store hooks from
// full-workspaces.jsx (useLiveEntities / useWorkspaceSelection /
// WorkspaceEmptyState / FullRecordSection). The old ENTITY_SAMPLES
// `_wrSamples` path is gone — every roster, dossier, and tab reads the
// live EntityService store and honours workspace.entityId.
// =====================================================================

const { useState: _wr_us, useMemo: _wr_um, useEffect: _wr_ue } = React;

function _wrSearch(items, q, fields = ["name", "label", "title", "subtitle", "sub"]) {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.filter((it) => fields.some((f) => (it[f] || "").toLowerCase().includes(s)));
}

// Safe label coercion — entity records sometimes carry plain strings
// and sometimes structured objects ({trigger, effect}, {id, type, label}, …).
// Rendering these objects directly crashes React. _lbl(x) always returns
// a renderable string.
function _lbl(x) {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (typeof x === "object") {
    if (x.trigger && x.effect) return x.trigger + " → " + x.effect + (x.cost ? "  (" + x.cost + ")" : "");
    if (x.phrase && x.treatedAs) return '"' + x.phrase + '" → ' + x.treatedAs;
    if (x.target && x.delta != null) return x.target + " " + (x.delta > 0 ? "+" + x.delta : x.delta) + (x.note ? " (" + x.note + ")" : "");
    if (x.name && x.note) return x.name + " — " + x.note;
    return x.label || x.name || x.title || x.text || x.what || JSON.stringify(x);
  }
  return String(x);
}
function _lblList(arr) {
  return (Array.isArray(arr) ? arr : []).map(_lbl).filter(Boolean);
}

// Render a list of entity refs as chips that open a panel.
const _wrRefChips = (refs, onOpen, related) => {
  const list = (refs == null ? [] : (Array.isArray(refs) ? refs : [refs])).filter(Boolean);
  return list.map((ref, i) => (
    <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={onOpen}>
      {_fwRefName(ref, related) || "?"}
    </button>
  ));
};

// =====================================================================
// LOCATION REGISTRY ----------------------------------------------------
// Left: hierarchy tree + filters.
// Centre: location dossier.
// Right: tabs (Related · Atlas · Source · Review · Timeline).
// =====================================================================
const LocationRegistryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("locations", (e) => {
    const d = _fwData(e);
    return {
      id: e.id,
      name: e.name || "Unnamed",
      subtitle: d.kind || e.summary || "",
      kind: d.kind || "",
      parentId: _fwRefId(d.parentId),
      placed: d.placed === true,
      queue: e.reviewQueueCount || 0,
      raw: e,
    };
  });
  const cast = useLiveEntities("cast");
  const liveItems = useLiveEntities("items");
  const factions = useLiveEntities("factions");
  const bestiary = useLiveEntities("bestiary");
  const events = useLiveEntities("events");

  const [search, setSearch] = _wr_us("");
  const [filter, setFilter] = _wr_us("all");
  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const [tab, setTab] = _wr_us("related");

  // "Current chapter" = locations with an occurrence in the highest chapter.
  const latestChapter = _wr_um(() => {
    const { chapters, num } = _fwChapterState();
    let max = null;
    for (const c of chapters) { const n = num.get(c.id); if (n != null && (max == null || n > max)) max = n; }
    return max;
  }, [items]);

  const filtered = _wr_um(() => {
    let xs = _wrSearch(items, search);
    if (filter === "current") xs = xs.filter((x) => latestChapter != null && _fwOccsFor(x.id).some((o) => o.chapterNum === latestChapter));
    if (filter === "review")  xs = xs.filter((x) => x.queue > 0);
    if (filter === "placed")  xs = xs.filter((x) => x.placed);
    if (filter === "missing") xs = xs.filter((x) => !x.placed);
    return xs;
  }, [items, search, filter, latestChapter]);

  const selected = items.find((x) => x.id === selectedId) || filtered[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wr_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, items]);

  // Build a simple parent/child hierarchy from data.parentId.
  const tree = _wr_um(() => {
    const map = new Map();
    items.forEach((it) => map.set(it.id, { ...it, children: [] }));
    const roots = [];
    items.forEach((it) => {
      const p = it.parentId && map.get(it.parentId);
      if (p) p.children.push(map.get(it.id));
      else roots.push(map.get(it.id));
    });
    return roots;
  }, [items]);

  const children = selected ? items.filter((x) => x.parentId === selected.id) : [];
  // Who's been here: explicit links + cast whose current/home location is this.
  const visitors = _wr_um(() => {
    if (!selected) return [];
    const ids = new Set((Array.isArray(d.characters) ? d.characters : []).map(_fwRefId).filter(Boolean));
    for (const c of cast) {
      const cd = _fwData(c);
      if (_fwRefId(cd.currentLocation) === selected.id || _fwRefId(cd.homeLocation) === selected.id) ids.add(c.id);
    }
    return [...ids].map((id) => cast.find((c) => c.id === id)).filter(Boolean);
  }, [selected && selected.id, cast, items]);
  const itemsHere = selected ? liveItems.filter((it) => {
    const id2 = _fwData(it);
    return _fwRefId(id2.currentLocation) === selected.id || _fwRefId(id2.foundLocation) === selected.id;
  }) : [];
  const factionsHere = selected ? factions.filter((f) => _fwReferencesEntity(f, selected.id)) : [];
  const creaturesHere = selected ? bestiary.filter((b) => _fwReferencesEntity(b, selected.id)) : [];
  const eventsHere = selected ? events.filter((ev) => _fwRefId(_fwData(ev).location) === selected.id || _fwReferencesEntity(ev, selected.id)) : [];
  const reviewItems = _wr_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("locations") || []).filter((q) => q.status === "pending");
  }, [items]);

  const renderNode = (n, depth = 0) => (
    <React.Fragment key={n.id}>
      <div
        className={"fws-roster__row " + (selected && selected.id === n.id ? "is-selected" : "")}
        data-entity-id={n.id}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => setSelectedId(n.id)}
        draggable
        onDragStart={(e) => {
          try { e.dataTransfer.setData("text/loomwright-entity", JSON.stringify({ entityType: "locations", id: n.id, name: n.name })); } catch (_) {}
        }}
      >
        <div className="fws-roster__row__avatar"><Icon name="map-pin" size={11}/></div>
        <div className="fws-roster__row__body">
          <div className="fws-roster__row__name">{n.name}</div>
          <div className="fws-roster__row__sub">{n.subtitle}</div>
        </div>
        {n.queue > 0 && <span className="fws-chip fws-chip--accent">{n.queue}</span>}
      </div>
      {n.children?.map((c) => renderNode(c, depth + 1))}
    </React.Fragment>
  );

  return (
    <WorkspaceShell
      icon="map-pin" entityType="locations"
      eyebrow="Locations" title="Location Registry"
      subtitle="The wiki companion to Atlas — every place, who's there, what's happened."
      createLabel="Create location"
      onCreate={() => onRequest.openEntityEditor({ type: "locations" })}
      onExit={onExit} cols={items.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible}
      toast={toast} onDismissToast={onDismissToast}
      extraActions={
        <button type="button" className="fws-topbar__exit"
          onClick={() => onRequest.openPanel("atlas")}
          data-callback="onOpenRelatedPanelFromWorkspace">
          <Icon name="globe" size={11}/> Show on Atlas
        </button>
      }
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Hierarchy</span>
            <span className="fws-section__count">{items.length}</span>
            <span className="fws-section__spacer"/>
          </div>
          <div style={{ padding: "6px 10px 0" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations…"
              style={{
                width: "100%", padding: "6px 8px", fontSize: 12,
                background: "var(--bg-paper-2)", border: "1px solid var(--line-2)",
                borderRadius: "var(--r-2)", color: "var(--ink-1)",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
          <WorkspaceFilters
            filters={[
              { key: "all", label: "All", count: items.length },
              { key: "current", label: latestChapter != null ? "In Ch." + latestChapter : "Current" },
              { key: "review", label: "Review", count: items.filter((x) => x.queue > 0).length || undefined },
              { key: "placed", label: "Placed", count: items.filter((x) => x.placed).length || undefined },
              { key: "missing", label: "Off-map" },
            ]}
            active={filter}
            onChange={setFilter}
          />
          <div className="fws-roster">
            {(search || filter !== "all") ? filtered.map((it) => renderNode(it)) : tree.map((n) => renderNode(n))}
            {filtered.length === 0 && (
              <div className="fws-empty">No locations match.</div>
            )}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="locations" noun="locations" onCreate={() => onRequest.openEntityEditor({ type: "locations" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard
              title={selected.name}
              sub={selected.subtitle}
              action={
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "locations", initial: { id: selected.id } })}>Edit</button>
                  <button className="fws-section__action" onClick={() => onRequest.openPanel("atlas")}>Show on Atlas →</button>
                </div>
              }
            >
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.description || selected.raw.summary || "No description yet — open the editor to add one."}
              </p>
              <WorkspaceKV rows={[
                { k: "Type", v: selected.kind || null },
                { k: "Parent", v: selected.parentId ? (items.find((x) => x.id === selected.parentId)?.name || null) : null },
                { k: "Climate", v: d.climate || null },
                { k: "Danger", v: d.danger || null },
                { k: "Atlas", v: selected.placed ? <span style={{ color: "var(--accent-deep)" }}>Placed</span> : <span style={{ color: "#a84a3a" }}>Not placed</span> },
                { k: "First seen", v: d.firstChapter || (occs.length && occs[0].chapterNum != null ? "Ch." + occs[0].chapterNum : null) },
              ].filter((r) => r.v)}/>
            </WorkspaceCard>

            <WorkspaceCard title="Children" sub={children.length + " sub-locations"}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {children.map((c) => (
                  <button key={c.id} className="fws-chip" onClick={() => setSelectedId(c.id)}>{c.name}</button>
                ))}
                {children.length === 0 && (
                  <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No children.</span>
                )}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Who's been here" sub="From Cast">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {visitors.map((c) => (
                  <button key={c.id} className="fws-chip"
                    onClick={() => onRequest.openPanel("cast")}>{c.name}</button>
                ))}
                {visitors.length === 0 && (
                  <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No linked cast yet — set a character's current or home location to {selected.name}.</span>
                )}
              </div>
            </WorkspaceCard>

            <FullRecordSection entity={selected.raw} type="locations"/>
          </>
        ) : (
          <div className="fws-empty">Select a location on the left.</div>
        )
      }
      right={items.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "related", label: "Related" },
              { id: "atlas",   label: "Atlas" },
              { id: "source",  label: "Source", count: occs.length },
              { id: "review",  label: "Review", count: reviewItems.length },
              { id: "time",    label: "Timeline", count: eventsHere.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "related" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Items found here</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {itemsHere.map((it) => (
                    <button key={it.id} className="fws-chip" onClick={() => onRequest.openPanel("items")}>{it.name}</button>
                  ))}
                  {itemsHere.length === 0 && <span style={{ color: "var(--ink-4)", fontSize: 11 }}>None recorded.</span>}
                </div>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Factions present</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {factionsHere.map((f) => (
                    <button key={f.id} className="fws-chip" onClick={() => onRequest.openPanel("lore")}>{f.name}</button>
                  ))}
                  {factionsHere.length === 0 && <span style={{ color: "var(--ink-4)", fontSize: 11 }}>None recorded.</span>}
                </div>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Bestiary encounters</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {creaturesHere.map((b) => (
                    <button key={b.id} className="fws-chip" onClick={() => onRequest.openPanel("bestiary")}>{b.name}</button>
                  ))}
                  {creaturesHere.length === 0 && <span style={{ color: "var(--ink-4)", fontSize: 11 }}>None recorded.</span>}
                </div>
              </>
            )}
            {tab === "atlas" && (
              <>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 12 }}>
                  {selected.placed ? "Placed on the Atlas map." : "Not placed yet — open the Atlas Editor to pin it."}
                </p>
                <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")} style={{ marginTop: 8 }}>
                  <Icon name="globe" size={11}/> Open Atlas Editor →
                </button>
              </>
            )}
            {tab === "source" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Mentions</div>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No manuscript mentions yet.")}
              </>
            )}
            {tab === "review" && (
              reviewItems.length
                ? <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>{reviewItems.length} pending — open review queue →</button>
                : _fwTabEmpty("No items in review for locations.")
            )}
            {tab === "time" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Events here</div>
                {eventsHere.map((ev) => (
                  <div key={ev.id} style={{ padding: 8, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12, fontFamily: "var(--font-serif)" }}>
                    {ev.name}
                  </div>
                ))}
                {eventsHere.length === 0 && _fwTabEmpty("No events recorded here.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// ITEM VAULT -----------------------------------------------------------
// Left: vault + filter chips.
// Centre: item dossier with effects strip + ownership history.
// Right: tabs (Ownership · Effects · Source · Review · Related).
// Bottom: mention scrubber strip (live occurrence chapters).
// =====================================================================
const ItemVaultWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("items", (e) => {
    const d = _fwData(e);
    return {
      id: e.id,
      name: e.name || "Unnamed",
      subtitle: d.itemType || e.summary || "",
      itemType: d.itemType || "",
      rarity: d.rarity || "",
      status: d.status || "",
      equipped: d.equipped === true || d.status === "equipped",
      questLinked: Array.isArray(d.quests) && d.quests.length > 0,
      queue: e.reviewQueueCount || 0,
      raw: e,
    };
  });
  const cast = useLiveEntities("cast");
  const [search, setSearch] = _wr_us("");
  const [filter, setFilter] = _wr_us("all");
  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const [tab, setTab] = _wr_us("ownership");

  const filtered = _wr_um(() => {
    let xs = _wrSearch(items, search);
    if (filter === "questlinked") xs = xs.filter((x) => x.questLinked);
    if (filter === "review") xs = xs.filter((x) => x.queue > 0);
    if (filter === "equipped") xs = xs.filter((x) => x.equipped);
    if (filter === "lost") xs = xs.filter((x) => x.status === "lost" || x.status === "destroyed");
    return xs;
  }, [items, search, filter]);

  const selected = items.find((x) => x.id === selectedId) || filtered[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wr_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, items]);
  const reviewItems = _wr_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("items") || []).filter((q) => q.status === "pending");
  }, [items]);

  const effects = [..._lblList(d.modifiers), ..._lblList(d.passive), ..._lblList(d.affixes), ..._lblList(d.effects)];
  const triggered = _lblList(d.triggered);
  // Ownership rows: structured data.ownership first, then trade history.
  const ownershipRows = _wr_um(() => {
    const rows = [];
    for (const o of (Array.isArray(d.ownership) ? d.ownership : [])) {
      rows.push({ ch: o.chapter != null ? "Ch." + o.chapter : "—", owner: _fwRefName(o.owner, "cast") || "—", event: _lbl(o.what || o.note || o.event) || "Owned" });
    }
    for (const t of (Array.isArray(d.tradeTransferHistory) ? d.tradeTransferHistory : [])) {
      rows.push({ ch: t.chapter != null ? "Ch." + t.chapter : "—", owner: _fwRefName(t.to, "cast") || "—", event: _lbl(t.what || t.note) || "Transferred" });
    }
    return rows;
  }, [selected && selected.id, items]);
  const mentionChapters = [...new Set(occs.map((o) => o.chapterNum).filter((n) => n != null))].sort((a, b) => a - b);
  const { chapters: allChapters } = _fwChapterState();
  const maxCh = allChapters.length || (mentionChapters.length ? mentionChapters[mentionChapters.length - 1] : 0);

  return (
    <WorkspaceShell
      icon="ring" entityType="items"
      eyebrow="Items" title="Item Vault"
      subtitle="Artefacts, weapons, relics — their owners, effects, and story usage."
      createLabel="Create item"
      onCreate={() => onRequest.openEntityEditor({ type: "items" })}
      onExit={onExit} cols={items.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible}
      toast={toast} onDismissToast={onDismissToast}
      bottom={items.length && selected && maxCh > 0 ? (
        <>
          <span>Mentions</span>
          <div className="fws-strip__track">
            {mentionChapters.map((n, i) => <span key={i} className="fws-strip__tick" title={"Ch." + n} style={{ left: (n / (maxCh + 1) * 100) + "%" }}/>)}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>
            {mentionChapters.length ? "Ch." + mentionChapters[0] + " → Ch." + mentionChapters[mentionChapters.length - 1] : "No mentions yet"}
          </span>
        </>
      ) : null}
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Vault</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div style={{ padding: "6px 10px 0" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
              style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}/>
          </div>
          <WorkspaceFilters
            filters={[
              { key: "all", label: "All", count: items.length },
              { key: "equipped", label: "Equipped", count: items.filter((x) => x.equipped).length || undefined },
              { key: "questlinked", label: "Quest-linked", count: items.filter((x) => x.questLinked).length || undefined },
              { key: "review", label: "Review", count: items.filter((x) => x.queue > 0).length || undefined },
              { key: "lost", label: "Lost / destroyed" },
            ]}
            active={filter} onChange={setFilter}
          />
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "items" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                onDragStart={() => {}}
                avatar="◇"
                name={it.name}
                sub={it.subtitle}
                meta={it.rarity || it.itemType}
                badges={it.queue ? <span className="fws-chip fws-chip--accent">{it.queue}</span> : null}
              />
            ))}
            {filtered.length === 0 && <div className="fws-empty">No items match.</div>}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="items" noun="items" onCreate={() => onRequest.openEntityEditor({ type: "items" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard
              title={selected.name}
              sub={selected.subtitle}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "items", initial: { id: selected.id } })}>Edit</button>}
            >
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.description || selected.raw.summary || "Add a description in the editor."}
              </p>
              <WorkspaceKV rows={[
                { k: "Type", v: selected.itemType || null },
                { k: "Rarity", v: selected.rarity || null },
                { k: "Slot", v: d.slot || null },
                { k: "Current owner", v: d.currentOwner ? (
                  <button className="fws-chip" onClick={() => onRequest.openPanel("cast")}>{_fwRefName(d.currentOwner, "cast")}</button>
                ) : null },
                { k: "Current location", v: d.currentLocation ? (
                  <button className="fws-chip" onClick={() => onRequest.openPanel("locations")}>{_fwRefName(d.currentLocation, "locations")}</button>
                ) : null },
                { k: "Status", v: selected.status || null },
              ].filter((r) => r.v)}/>
            </WorkspaceCard>

            {effects.length > 0 && (
              <WorkspaceCard title="Effects / Modifiers">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {effects.map((e, i) => (
                    <span key={i} className="fws-chip fws-chip--accent">{e}</span>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            <WorkspaceCard title="Ownership history" sub="From extraction + manual log">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ownershipRows.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: 8, padding: "6px 8px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontSize: 12 }}>
                    <span style={{ color: "var(--ink-3)" }}>{row.ch}</span>
                    <span style={{ fontFamily: "var(--font-serif)" }}>{row.owner}</span>
                    <span style={{ fontStyle: "italic", color: "var(--ink-2)" }}>{row.event}</span>
                  </div>
                ))}
                {ownershipRows.length === 0 && d.ownershipHistory && (
                  <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{String(d.ownershipHistory)}</p>
                )}
                {ownershipRows.length === 0 && !d.ownershipHistory && (
                  <span style={{ color: "var(--ink-4)", fontSize: 11, fontStyle: "italic" }}>
                    No ownership log yet{d.currentOwner ? " — current owner: " + _fwRefName(d.currentOwner, "cast") : ""}. Item transfers found by extraction land here.
                  </span>
                )}
              </div>
            </WorkspaceCard>

            <FullRecordSection entity={selected.raw} type="items"/>
          </>
        ) : <div className="fws-empty">Select an item on the left.</div>
      }
      right={items.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "ownership", label: "Ownership" },
              { id: "effects",   label: "Effects" },
              { id: "source",    label: "Source", count: occs.length },
              { id: "review",    label: "Review", count: reviewItems.length },
              { id: "related",   label: "Related" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "ownership" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Quest links</div>
                {_wrRefChips(d.quests, () => onRequest.openPanel("quests"), "quests")}
                {!(Array.isArray(d.quests) && d.quests.length) && <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>No quest links.</div>}
                <div className="fws-section__title" style={{ marginTop: 14, marginBottom: 6 }}>Stat impact</div>
                {_lblList(d.modifiers).map((n, i) => (
                  <div key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</div>
                ))}
                {!(Array.isArray(d.modifiers) && d.modifiers.length) && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>No stat modifiers.</div>}
              </>
            )}
            {tab === "effects" && (
              <>
                {[...effects, ...triggered].map((n, i) => (
                  <div key={i} style={{ padding: 8, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                    {n}
                  </div>
                ))}
                {effects.length + triggered.length === 0 && _fwTabEmpty("No effects recorded.")}
              </>
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No manuscript mentions yet.")}
              </>
            )}
            {tab === "review" && (
              reviewItems.length
                ? <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>{reviewItems.length} pending — open review queue →</button>
                : _fwTabEmpty("No review items for this entry.")
            )}
            {tab === "related" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Related cast</div>
                {d.currentOwner && _wrRefChips(d.currentOwner, () => onRequest.openPanel("cast"), "cast")}
                {cast.filter((c) => c.id !== _fwRefId(d.currentOwner) && _fwReferencesEntity(c, selected.id)).map((c) => (
                  <button key={c.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("cast")}>{c.name}</button>
                ))}
                {!d.currentOwner && cast.filter((c) => _fwReferencesEntity(c, selected.id)).length === 0 && _fwTabEmpty("No cast linked to this item.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// CLASS BUILDER --------------------------------------------------------
// =====================================================================
const ClassBuilderWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("classes", (e) => {
    const d = _fwData(e);
    return { id: e.id, name: e.name || "Unnamed", subtitle: d.category || d.role || "", category: d.category || "", raw: e };
  });
  const cast = useLiveEntities("cast");
  const [search, setSearch] = _wr_us("");
  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const [tab, setTab] = _wr_us("cast");
  const filtered = _wrSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wr_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, items]);
  const reviewItems = _wr_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("classes") || []).filter((q) => q.status === "pending");
  }, [items]);
  // Assigned cast: explicit links + cast whose class points at this record.
  const assigned = _wr_um(() => {
    if (!selected) return [];
    const ids = new Set((Array.isArray(d.assignedCharacters) ? d.assignedCharacters : []).map(_fwRefId).filter(Boolean));
    for (const c of cast) {
      const cd = _fwData(c);
      if (_fwRefId(cd.class) === selected.id || String(cd.class || "") === selected.name) ids.add(c.id);
    }
    return [...ids].map((id) => cast.find((c) => c.id === id)).filter(Boolean);
  }, [selected && selected.id, cast, items]);
  const defaultStats = Array.isArray(d.defaultStats) ? d.defaultStats.filter((s) => s && s.name) : [];

  return (
    <WorkspaceShell
      icon="shield" entityType="classes"
      eyebrow="Classes" title="Class Builder"
      subtitle="Archetypes, professions, schools — the templates your cast inherits from."
      createLabel="Create class"
      onCreate={() => onRequest.openEntityEditor({ type: "classes" })}
      onExit={onExit} cols={items.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Classes</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div style={{ padding: "6px 10px 0" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes…"
              style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}/>
          </div>
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "classes" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar="✦"
                name={it.name}
                sub={it.subtitle}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="classes" noun="classes" onCreate={() => onRequest.openEntityEditor({ type: "classes" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "classes", initial: { id: selected.id } })}>Edit</button>}>
              <p style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontSize: 14, color: d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.description || selected.raw.summary || "No description yet — open the editor to add one."}
              </p>
              <WorkspaceKV rows={[
                { k: "Category", v: selected.category || null },
                { k: "Role", v: d.role || null },
                { k: "Restrictions", v: Array.isArray(d.restrictions) ? d.restrictions.map(_lbl).join(", ") : (d.restrictions || null) },
                { k: "Compatible races", v: Array.isArray(d.compatibleRaces) && d.compatibleRaces.length ? d.compatibleRaces.map((r) => _fwRefName(r, "races")).join(", ") : null },
              ].filter((r) => r.v)}/>
            </WorkspaceCard>

            {defaultStats.length > 0 && (
              <WorkspaceCard title="Default stats">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {defaultStats.map((s, i) => (
                    <div key={i} className="fws-card" style={{ padding: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase" }}>{s.name}</div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-1)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            {_fwHasValue(d.startingItems) && (
              <WorkspaceCard title="Starting equipment">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {_wrRefChips(d.startingItems, () => onRequest.openPanel("items"), "items")}
                </div>
              </WorkspaceCard>
            )}

            {(_fwHasValue(d.allowedSkills) || _fwHasValue(d.startingSkills)) && (
              <WorkspaceCard title="Allowed skills">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {_wrRefChips([...(Array.isArray(d.allowedSkills) ? d.allowedSkills : []), ...(Array.isArray(d.startingSkills) ? d.startingSkills : [])], () => onRequest.openPanel("skillTrees"), "skills")}
                </div>
              </WorkspaceCard>
            )}

            <FullRecordSection entity={selected.raw} type="classes"/>
          </>
        ) : <div className="fws-empty">Select a class.</div>
      }
      right={items.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "cast", label: "Assigned cast", count: assigned.length },
              { id: "trees", label: "Skill trees" },
              { id: "source", label: "Source", count: occs.length },
              { id: "review", label: "Review", count: reviewItems.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "cast" && (
              <>
                {assigned.map((c) => (
                  <button key={c.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("cast")}>{c.name}</button>
                ))}
                {assigned.length === 0 && _fwTabEmpty("No cast assigned to this class yet.")}
              </>
            )}
            {tab === "trees" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("skillTrees")}>
                <Icon name="branches" size={11}/> Open Skill Tree Editor →
              </button>
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No manuscript mentions yet.")}
              </>
            )}
            {tab === "review" && (
              reviewItems.length
                ? <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>{reviewItems.length} pending — open review queue →</button>
                : _fwTabEmpty("No review items.")
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// SPECIES REGISTRY -----------------------------------------------------
// =====================================================================
const SpeciesRegistryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("races", (e) => {
    const d = _fwData(e);
    return { id: e.id, name: e.name || "Unnamed", subtitle: d.category || "", category: d.category || "", raw: e };
  });
  const cast = useLiveEntities("cast");
  const [search, setSearch] = _wr_us("");
  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const [tab, setTab] = _wr_us("cast");
  const filtered = _wrSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wr_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, items]);
  const linkedCast = _wr_um(() => {
    if (!selected) return [];
    const ids = new Set((Array.isArray(d.linkedCast) ? d.linkedCast : []).map(_fwRefId).filter(Boolean));
    for (const c of cast) {
      const cd = _fwData(c);
      if (_fwRefId(cd.species) === selected.id || String(cd.species || "") === selected.name) ids.add(c.id);
    }
    return [...ids].map((id) => cast.find((c) => c.id === id)).filter(Boolean);
  }, [selected && selected.id, cast, items]);

  return (
    <WorkspaceShell
      icon="branches" entityType="races"
      eyebrow="Races & Species" title="Species Registry"
      subtitle="Peoples, ancestries, creature types — origins, traits, cultures."
      createLabel="Create species"
      onCreate={() => onRequest.openEntityEditor({ type: "races" })}
      onExit={onExit} cols={items.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Species</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div style={{ padding: "6px 10px 0" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}/>
          </div>
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "races" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar="✺"
                name={it.name}
                sub={it.subtitle}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="races" noun="species" onCreate={() => onRequest.openEntityEditor({ type: "races" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "races", initial: { id: selected.id } })}>Edit</button>}>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.description || selected.raw.summary || "No description yet — open the editor to add one."}
              </p>
              <WorkspaceKV rows={[
                { k: "Category", v: selected.category || null },
                { k: "Habitat / region", v: d.habitat || null },
                { k: "Origin", v: Array.isArray(d.originLocations) && d.originLocations.length ? d.originLocations.map((r) => _fwRefName(r, "locations")).join(", ") : null },
                { k: "Culture", v: d.culture ? String(d.culture).slice(0, 120) : null },
              ].filter((r) => r.v)}/>
            </WorkspaceCard>

            {_fwHasValue(d.traits) && (
              <WorkspaceCard title="Traits">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {_lblList(d.traits).map((t, i) => (
                    <span key={i} className="fws-chip">{t}</span>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            {(_fwHasValue(d.innateSkills) || _fwHasValue(d.weaknesses)) && (
              <WorkspaceCard title="Innate skills & weaknesses">
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div className="fws-section__title" style={{ marginBottom: 4 }}>Innate</div>
                    {_lblList(d.innateSkills).map((n, i) => (
                      <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>
                    ))}
                    {!_fwHasValue(d.innateSkills) && <span style={{ color: "var(--ink-4)", fontSize: 11 }}>None.</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fws-section__title" style={{ marginBottom: 4 }}>Weaknesses</div>
                    {_lblList(d.weaknesses).map((n, i) => (
                      <span key={i} className="fws-chip fws-chip--warn" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>
                    ))}
                    {!_fwHasValue(d.weaknesses) && <span style={{ color: "var(--ink-4)", fontSize: 11 }}>None.</span>}
                  </div>
                </div>
              </WorkspaceCard>
            )}

            <FullRecordSection entity={selected.raw} type="races"/>
          </>
        ) : <div className="fws-empty">Select a species.</div>
      }
      right={items.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "cast", label: "Cast", count: linkedCast.length },
              { id: "bestiary", label: "Bestiary" },
              { id: "factions", label: "Factions" },
              { id: "origins", label: "Origins" },
              { id: "source", label: "Source", count: occs.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "cast" && (
              <>
                {linkedCast.map((c) => (
                  <button key={c.id} className="fws-chip" onClick={() => onRequest.openPanel("cast")} style={{ marginRight: 4, marginBottom: 4 }}>{c.name}</button>
                ))}
                {linkedCast.length === 0 && _fwTabEmpty("No cast of this species yet.")}
              </>
            )}
            {tab === "bestiary" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("bestiary")}>
                <Icon name="paw" size={11}/> Open Bestiary →
              </button>
            )}
            {tab === "factions" && (
              <>
                {_wrRefChips(d.factions, () => onRequest.openPanel("lore"), "factions")}
                {!_fwHasValue(d.factions) && _fwTabEmpty("No linked factions.")}
              </>
            )}
            {tab === "origins" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")}>
                <Icon name="globe" size={11}/> View origins on Atlas →
              </button>
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No manuscript mentions yet.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// STAT LAB -------------------------------------------------------------
// =====================================================================
const StatLabWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("stats", (e) => {
    const d = _fwData(e);
    return { id: e.id, name: e.name || "Unnamed", subtitle: d.valueType || "", scope: d.scope || "", raw: e };
  });
  const cast = useLiveEntities("cast");
  const [search, setSearch] = _wr_us("");
  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const [tab, setTab] = _wr_us("history");
  const [phrase, setPhrase] = _wr_us("");
  const filtered = _wrSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wr_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, items]);
  const reviewItems = _wr_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("stats") || []).filter((q) => q.status === "pending");
  }, [items]);

  // Live extraction rules from the record (EE_STAT extractionRules shape:
  // { phrase, treatedAs, kind, review, effect, confidence, active }).
  const rules = Array.isArray(d.extractionRules) ? d.extractionRules : (Array.isArray(d.rules) ? d.rules : []);
  const ruleActive = (r) => r.active !== false;
  const ruleMatchText = (r) => String(r.phrase || r.match || "");
  const ruleEffectText = (r) => String(r.treatedAs || r.effect || "");

  // Live extraction simulation: which rules match the phrase.
  const phraseResult = _wr_um(() => {
    if (!phrase.trim()) return { matched: 0, effects: ["Type or paste a sentence above to test the rules."] };
    const matched = rules.filter((r) => ruleActive(r) && ruleMatchText(r) && phrase.toLowerCase().includes(ruleMatchText(r).toLowerCase()));
    if (matched.length === 0) return { matched: 0, effects: ["No rules match this phrase."] };
    return { matched: matched.length, effects: matched.map((m) => `"${ruleMatchText(m)}"  →  ${ruleEffectText(m) || "(no effect set)"}`) };
  }, [phrase, rules]);

  // Assigned to: explicit links + cast whose stat-grid includes this stat name.
  const assigned = _wr_um(() => {
    if (!selected) return [];
    const ids = new Set((Array.isArray(d.assignedEntities) ? d.assignedEntities : []).map(_fwRefId).filter(Boolean));
    for (const c of cast) {
      const stats = _fwData(c).stats;
      if (Array.isArray(stats) && stats.some((s) => s && String(s.name || "").toLowerCase() === selected.name.toLowerCase())) ids.add(c.id);
    }
    return [...ids].map((id) => cast.find((c) => c.id === id)).filter(Boolean);
  }, [selected && selected.id, cast, items]);

  const history = Array.isArray(d.changeHistory) ? d.changeHistory : [];
  const openEditor = (sectionId) => selected && window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
    detail: { type: "stats", initial: { id: selected.id }, mode: "full", sectionId: sectionId || undefined },
  }));

  return (
    <WorkspaceShell
      icon="bolt" entityType="stats"
      eyebrow="Stats" title="Stat Lab"
      subtitle="Universal stats + extraction rules. Test a phrase before saving the rule."
      createLabel="Create stat"
      onCreate={() => onRequest.openEntityEditor({ type: "stats" })}
      onExit={onExit} cols={items.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Stats</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div style={{ padding: "6px 10px 0" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stats…"
              style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}/>
          </div>
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "stats" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar={(it.name || "S").slice(0, 1)}
                name={it.name}
                sub={it.subtitle}
                meta={it.scope}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="stats" noun="stats" onCreate={() => onRequest.openEntityEditor({ type: "stats" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.raw.summary || ""}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("basics")}>Edit</button>}>
              <WorkspaceKV rows={[
                { k: "Value type", v: d.valueType || "scalar" },
                { k: "Default", v: d.defaultValue ?? null },
                { k: "Range", v: (d.min != null || d.max != null) ? (d.min ?? "—") + " – " + (d.max ?? "—") : null },
                { k: "Applies to", v: Array.isArray(d.appliesTo) ? d.appliesTo.map(_lbl).join(", ") : (d.appliesTo || null) },
                { k: "Display format", v: d.displayFormat || null },
              ].filter((r) => r.v != null)}/>
            </WorkspaceCard>

            <WorkspaceCard title="Extraction phrase rules" sub="Rules live on the stat record. Test below.">
              {rules.map((r, i) => (
                <div key={i} className="fws-rule">
                  <span className={"fws-rule__active " + (ruleActive(r) ? "is-on" : "")}>{ruleActive(r) ? "ON" : "OFF"}</span>
                  <span className="fws-rule__match">"{ruleMatchText(r)}"</span>
                  <span className="fws-rule__effect">→ {ruleEffectText(r) || "—"}</span>
                  <button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("rules")}>Edit</button>
                </div>
              ))}
              {rules.length === 0 && _fwTabEmpty("No phrase rules yet — add one and extraction will track this stat from prose.")}
              <button className="fws-section__action" style={{ marginTop: 6 }} data-callback="onEditEntity" onClick={() => openEditor("rules")}>+ Add rule</button>
            </WorkspaceCard>

            <WorkspaceCard title="Test phrase" sub="Paste a manuscript sentence and see which rules fire.">
              <div className="fws-phrase-test">
                <textarea
                  className="fws-phrase-test__input"
                  placeholder='e.g. "She had not slept since the letter came."'
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                />
                <div className="fws-phrase-test__result">
                  <div style={{ marginBottom: 4, fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                    {phraseResult.matched} rule{phraseResult.matched === 1 ? "" : "s"} matched
                  </div>
                  {phraseResult.effects.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              </div>
            </WorkspaceCard>

            <FullRecordSection entity={selected.raw} type="stats"/>
          </>
        ) : <div className="fws-empty">Select a stat.</div>
      }
      right={items.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "history", label: "History", count: history.length },
              { id: "assigned", label: "Assigned to", count: assigned.length },
              { id: "review", label: "Review", count: reviewItems.length },
              { id: "source", label: "Source", count: occs.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "history" && (
              <>
                {history.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 70px", gap: 6, padding: "6px 8px", fontSize: 12, borderBottom: "1px solid var(--line-1)" }}>
                    <span style={{ color: "var(--ink-3)" }}>{row.chapter != null ? "Ch." + row.chapter : "—"}</span>
                    <span style={{ fontFamily: "var(--font-serif)" }}>{_fwRefName(row.who || row.target, "cast") || _lbl(row.who || row.target) || "—"}</span>
                    <span style={{ color: "var(--accent-deep)", textAlign: "right" }}>{_lbl(row.delta ?? row.change ?? row.what) || "—"}</span>
                  </div>
                ))}
                {history.length === 0 && _fwTabEmpty("No stat changes logged yet. Extraction's stat detector writes here.")}
              </>
            )}
            {tab === "assigned" && (
              <>
                {assigned.map((c) => (
                  <button key={c.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("cast")}>{c.name}</button>
                ))}
                {assigned.length === 0 && _fwTabEmpty("Not assigned to any cast yet.")}
              </>
            )}
            {tab === "review" && (
              reviewItems.length
                ? <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>{reviewItems.length} pending — open review queue →</button>
                : _fwTabEmpty("No review items.")
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No source phrases yet.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// FACTION REGISTRY -----------------------------------------------------
// =====================================================================
const FactionRegistryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("factions", (e) => {
    const d = _fwData(e);
    return { id: e.id, name: e.name || "Unnamed", subtitle: d.kind || e.summary || "", raw: e };
  });
  const cast = useLiveEntities("cast");
  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const selected = items.find((x) => x.id === selectedId) || items[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  // Members: explicit links + cast sworn to this faction.
  const members = _wr_um(() => {
    if (!selected) return [];
    const ids = new Set((Array.isArray(d.members) ? d.members : []).map(_fwRefId).filter(Boolean));
    for (const c of cast) {
      const cd = _fwData(c);
      if (_fwRefId(cd.faction) === selected.id || String(cd.faction || "") === selected.name || _fwRefId(cd.allegiance) === selected.id) ids.add(c.id);
    }
    return [...ids].map((id) => cast.find((c) => c.id === id)).filter(Boolean);
  }, [selected && selected.id, cast, items]);

  return (
    <WorkspaceShell
      icon="banner" entityType="factions"
      eyebrow="Factions" title="Faction Registry"
      subtitle="Houses, orders, guilds — who holds power, who's at war."
      createLabel="Create faction"
      onCreate={() => onRequest.openEntityEditor({ type: "factions" })}
      onExit={onExit} cols={items.length ? "lc" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Factions</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div className="fws-roster">
            {items.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "factions" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar="◇"
                name={it.name}
                sub={it.subtitle}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="factions" noun="factions" onCreate={() => onRequest.openEntityEditor({ type: "factions" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "factions", initial: { id: selected.id } })}>Edit</button>}>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.description || selected.raw.summary || "No description yet — open the editor to add one."}
              </p>
              <WorkspaceKV rows={[
                { k: "Kind", v: d.kind || null },
                { k: "Leader", v: d.leader ? <button className="fws-chip" onClick={() => onRequest.openPanel("cast")}>{_fwRefName(d.leader, "cast")}</button> : null },
                { k: "Headquarters", v: d.headquarters ? <button className="fws-chip" onClick={() => onRequest.openPanel("locations")}>{_fwRefName(d.headquarters, "locations")}</button> : null },
                { k: "Size", v: d.size || null },
                { k: "Ideology", v: d.ideology || null },
              ].filter((r) => r.v)}/>
            </WorkspaceCard>

            {(_fwHasValue(d.goals) || d.methods) && (
              <WorkspaceCard title="Goals & methods">
                {_fwHasValue(d.goals) && (
                  <div style={{ marginBottom: 8 }}>
                    {_lblList(d.goals).map((g, i) => <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{g}</span>)}
                  </div>
                )}
                {d.methods && <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>{String(d.methods)}</p>}
              </WorkspaceCard>
            )}

            <WorkspaceCard title="Members" sub={members.length + " linked cast"}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {members.map((c) => (
                  <button key={c.id} className="fws-chip" onClick={() => onRequest.openPanel("cast")}>{c.name}</button>
                ))}
                {members.length === 0 && <span style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 11 }}>No members linked yet — set a character's faction, or let extraction find allegiances.</span>}
              </div>
            </WorkspaceCard>

            {(_fwHasValue(d.allies) || _fwHasValue(d.enemies) || _fwHasValue(d.controlsLocations)) && (
              <WorkspaceCard title="Standing">
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {_fwHasValue(d.controlsLocations) && (
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div className="fws-section__title" style={{ marginBottom: 4 }}>Territory</div>
                      {_wrRefChips(d.controlsLocations, () => onRequest.openPanel("locations"), "locations")}
                    </div>
                  )}
                  {_fwHasValue(d.allies) && (
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div className="fws-section__title" style={{ marginBottom: 4 }}>Allies</div>
                      {_wrRefChips(d.allies, () => onRequest.openPanel("relationships"), "factions")}
                    </div>
                  )}
                  {_fwHasValue(d.enemies) && (
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div className="fws-section__title" style={{ marginBottom: 4 }}>Enemies</div>
                      {_wrRefChips(d.enemies, () => onRequest.openPanel("relationships"), "factions")}
                    </div>
                  )}
                </div>
              </WorkspaceCard>
            )}

            <FullRecordSection entity={selected.raw} type="factions"/>
          </>
        ) : <div className="fws-empty">No factions yet.</div>
      }
    />
  );
};

// Register
Object.assign(window.WORKSPACE_COMPONENTS, {
  "location-registry": LocationRegistryWorkspace,
  "item-vault":        ItemVaultWorkspace,
  "class-builder":     ClassBuilderWorkspace,
  "species-registry":  SpeciesRegistryWorkspace,
  "stat-lab":          StatLabWorkspace,
  "faction-registry":  FactionRegistryWorkspace,
});

Object.assign(window, {
  LocationRegistryWorkspace, ItemVaultWorkspace, ClassBuilderWorkspace,
  SpeciesRegistryWorkspace, StatLabWorkspace, FactionRegistryWorkspace,
});
