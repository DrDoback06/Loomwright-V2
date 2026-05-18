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
// Each workspace uses the shared WorkspaceShell + WorkspaceSection
// primitives from full-workspaces.jsx.
// =====================================================================

const { useState: _wr_us, useMemo: _wr_um, useEffect: _wr_ue } = React;

// ---------------------------------------------------------------------
// Shared utilities for these workspaces.
// ---------------------------------------------------------------------
function _wrSamples(type) {
  return (window.ENTITY_SAMPLES && window.ENTITY_SAMPLES[type]) || [];
}

function _wrSearch(items, q, fields = ["name", "label", "title", "subtitle"]) {
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
    return x.label || x.name || x.title || x.text || x.what || JSON.stringify(x);
  }
  return String(x);
}
function _lblList(arr, fallback) {
  const xs = (Array.isArray(arr) && arr.length) ? arr : (fallback || []);
  return xs.map(_lbl);
}

// =====================================================================
// LOCATION REGISTRY ----------------------------------------------------
// Left: hierarchy tree + filters.
// Centre: location dossier.
// Right: tabs (Review · Source · Related · Atlas Links · Timeline).
// =====================================================================
const LocationRegistryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wrSamples("locations");
  const [search, setSearch] = _wr_us("");
  const [filter, setFilter] = _wr_us("all");
  const [selectedId, setSelectedId] = _wr_us(items[0]?.id || null);
  const [tab, setTab] = _wr_us("related");

  const filtered = _wr_um(() => {
    let xs = _wrSearch(items, search);
    if (filter === "current") xs = xs.filter((x) => x.linkedChapters?.some((c) => /Ch\.?\s*7/.test(c.label || "")));
    if (filter === "review")  xs = xs.filter((x) => x.queue && x.queue > 0);
    if (filter === "placed")  xs = xs.filter((x) => x.atlasPlaced !== false);
    if (filter === "missing") xs = xs.filter((x) => x.atlasPlaced === false);
    return xs;
  }, [items, search, filter]);

  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  // Build a simple parent/child hierarchy from item.parent or item.region.
  const tree = _wr_um(() => {
    const map = new Map();
    items.forEach((it) => map.set(it.id, { ...it, children: [] }));
    const roots = [];
    items.forEach((it) => {
      const p = it.parent && map.get(it.parent);
      if (p) p.children.push(map.get(it.id));
      else roots.push(map.get(it.id));
    });
    return roots;
  }, [items]);

  const renderNode = (n, depth = 0) => (
    <React.Fragment key={n.id}>
      <div
        className={"fws-roster__row " + (selectedId === n.id ? "is-selected" : "")}
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
        {n.queue && <span className="fws-chip fws-chip--accent">{n.queue}</span>}
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
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible}
      toast={toast} onDismissToast={onDismissToast}
      extraActions={
        <button type="button" className="fws-topbar__exit"
          onClick={() => onRequest.openPanel("atlas")}
          data-callback="onOpenRelatedPanelFromWorkspace">
          <Icon name="globe" size={11}/> Show on Atlas
        </button>
      }
      left={
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
              { key: "current", label: "In Ch.7" },
              { key: "review", label: "Review" },
              { key: "placed", label: "Placed" },
              { key: "missing", label: "Off-map" },
            ]}
            active={filter}
            onChange={setFilter}
          />
          <div className="fws-roster">
            {search ? filtered.map((it) => renderNode(it)) : tree.map((n) => renderNode(n))}
            {filtered.length === 0 && (
              <div className="fws-empty">No locations match.</div>
            )}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard
              title={selected.name}
              sub={selected.subtitle}
              action={
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "locations", initial: selected })}>Edit</button>
                  <button className="fws-section__action" onClick={() => onRequest.openPanel("atlas")}>Show on Atlas →</button>
                </div>
              }
            >
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || "No description yet — open the editor to add one."}
              </p>
              <WorkspaceKV rows={[
                { k: "Type", v: selected.locationType || selected.kind || "—" },
                { k: "Region", v: selected.region || "—" },
                { k: "Parent", v: items.find((x) => x.id === selected.parent)?.name || "—" },
                { k: "Atlas", v: selected.atlasPlaced === false ? <span style={{ color: "#a84a3a" }}>Not placed</span> : <span style={{ color: "var(--accent-deep)" }}>Placed</span> },
                { k: "First seen", v: selected.firstSeen || "—" },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Children" sub={`${(selected.children || []).length || (tree.find((t) => t.id === selected.id)?.children?.length) || 0} sub-locations`}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(items.filter((x) => x.parent === selected.id) || []).map((c) => (
                  <button key={c.id} className="fws-chip" onClick={() => setSelectedId(c.id)}>{c.name}</button>
                ))}
                {items.filter((x) => x.parent === selected.id).length === 0 && (
                  <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No children.</span>
                )}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Who's been here" sub="From Cast">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(selected.castVisits || ["Aelinor Vey", "Captain Brec", "Saren of Hess"]).map((n, i) => (
                  <button key={i} className="fws-chip"
                    onClick={() => onRequest.openPanel("cast")}>{n}</button>
                ))}
              </div>
            </WorkspaceCard>
          </>
        ) : (
          <div className="fws-empty">Select a location on the left.</div>
        )
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "related", label: "Related" },
              { id: "atlas",   label: "Atlas" },
              { id: "source",  label: "Source" },
              { id: "review",  label: "Review", count: selected?.queue || 0 },
              { id: "time",    label: "Timeline" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "related" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Items found here</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {(selected?.itemsFound || ["Auger of Hess", "Vraska Lantern"]).map((n, i) => (
                    <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("items")}>{n}</button>
                  ))}
                </div>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Factions present</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {(selected?.factions || ["The Grey Coats"]).map((n, i) => (
                    <button key={i} className="fws-chip">{n}</button>
                  ))}
                </div>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Bestiary encounters</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(selected?.creatures || ["Salt-ghosts"]).map((n, i) => (
                    <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("bestiary")}>{n}</button>
                  ))}
                </div>
              </>
            )}
            {tab === "atlas" && (
              <>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 12 }}>
                  Atlas placement preview lives in the Atlas Editor.
                </p>
                <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")} style={{ marginTop: 8 }}>
                  <Icon name="globe" size={11}/> Open Atlas Editor →
                </button>
              </>
            )}
            {tab === "source" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Mentions</div>
                {(selected?.mentions || [
                  { chapter: "Ch. 1", para: "p1", quote: "The light over Pale Reach was the colour of cooled tin…" },
                  { chapter: "Ch. 7", para: "p4", quote: "Inside, the watchhouse smelled of pitch and coriander…" },
                ]).map((m, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6, fontSize: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{m.chapter}{m.para ? " · " + m.para : ""}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"{m.quote}"</div>
                  </div>
                ))}
              </>
            )}
            {tab === "review" && (
              <div className="fws-empty" style={{ padding: 20 }}>No items in review for this location.</div>
            )}
            {tab === "time" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Events here</div>
                {["The Auger Wake", "Brec's letter arrives"].map((n, i) => (
                  <div key={i} style={{ padding: 8, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12, fontFamily: "var(--font-serif)" }}>
                    {n}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// ITEM VAULT -----------------------------------------------------------
// Left: vault + filter chips.
// Centre: item dossier with equipment slot card + effects strip + history.
// Right: tabs (Ownership · Effects · Review · Source · Related).
// Bottom: ownership scrubber strip.
// =====================================================================
const ItemVaultWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wrSamples("items");
  const [search, setSearch] = _wr_us("");
  const [filter, setFilter] = _wr_us("all");
  const [selectedId, setSelectedId] = _wr_us(items[0]?.id || null);
  const [tab, setTab] = _wr_us("ownership");

  const filtered = _wr_um(() => {
    let xs = _wrSearch(items, search);
    if (filter === "questlinked") xs = xs.filter((x) => x.quests?.length);
    if (filter === "review") xs = xs.filter((x) => x.queue && x.queue > 0);
    if (filter === "equipped") xs = xs.filter((x) => x.equipped);
    if (filter === "lost") xs = xs.filter((x) => x.status === "lost" || x.status === "destroyed");
    return xs;
  }, [items, search, filter]);

  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  return (
    <WorkspaceShell
      icon="ring" entityType="items"
      eyebrow="Items" title="Item Vault"
      subtitle="Artefacts, weapons, relics — their owners, effects, and story usage."
      createLabel="Create item"
      onCreate={() => onRequest.openEntityEditor({ type: "items" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible}
      toast={toast} onDismissToast={onDismissToast}
      bottom={
        <>
          <span>Ownership scrubber</span>
          <div className="fws-strip__track">
            {[12, 28, 41, 60, 78].map((p, i) => <span key={i} className="fws-strip__tick" style={{ left: p + "%" }}/>)}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>Ch.1 → Ch.7</span>
        </>
      }
      left={
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
              { key: "equipped", label: "Equipped" },
              { key: "questlinked", label: "Quest-linked" },
              { key: "review", label: "Review" },
              { key: "lost", label: "Lost / destroyed" },
            ]}
            active={filter} onChange={setFilter}
          />
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it, entityType: "items" }}
                selected={selectedId === it.id}
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
      }
      main={
        selected ? (
          <>
            <WorkspaceCard
              title={selected.name}
              sub={selected.subtitle}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "items", initial: selected })}>Edit</button>}
            >
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || "Add a description in the editor."}
              </p>
              <WorkspaceKV rows={[
                { k: "Type", v: selected.itemType || "—" },
                { k: "Rarity", v: selected.rarity || "—" },
                { k: "Slot", v: selected.slot || "Inventory" },
                { k: "Current owner", v: (
                  <button className="fws-chip" onClick={() => onRequest.openPanel("cast")}>{selected.owner || "Aelinor Vey"}</button>
                )},
                { k: "Current location", v: (
                  <button className="fws-chip" onClick={() => onRequest.openPanel("locations")}>{selected.currentLocation || "Pale Reach"}</button>
                )},
                { k: "Status", v: selected.status || "carried" },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Effects / Modifiers">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {_lblList(selected.effects, ["+2 Cunning", "Whisper to bearer", "−1 Sleep"]).map((e, i) => (
                  <span key={i} className="fws-chip fws-chip--accent">{e}</span>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Ownership history" sub="From extraction + manual log">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(Array.isArray(selected.ownership) && selected.ownership.length
                  ? selected.ownership.map((o) => ({ ch: "Ch." + o.chapter, owner: o.what?.split(" by ")?.[1]?.split(" ")?.slice(0,2)?.join(" ") || "—", event: o.what }))
                  : (selected.ownershipHistory || [
                      { ch: "Ch.1", owner: "Saren of Hess", event: "Owned (commissioned)" },
                      { ch: "Ch.3", owner: "Saren of Hess", event: "Wrapped in felt; entrusted" },
                      { ch: "Ch.7", owner: "Aelinor Vey", event: "Carried into Pale Reach" },
                    ])
                ).map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: 8, padding: "6px 8px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontSize: 12 }}>
                    <span style={{ color: "var(--ink-3)" }}>{row.ch}</span>
                    <span style={{ fontFamily: "var(--font-serif)" }}>{row.owner}</span>
                    <span style={{ fontStyle: "italic", color: "var(--ink-2)" }}>{row.event}</span>
                  </div>
                ))}
              </div>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select an item on the left.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "ownership", label: "Ownership" },
              { id: "effects",   label: "Effects" },
              { id: "source",    label: "Source" },
              { id: "review",    label: "Review", count: selected?.queue || 0 },
              { id: "related",   label: "Related" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "ownership" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Quest links</div>
                {_lblList(selected?.quests, ["The Auger of Hess"]).map((n, i) => (
                  <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("quests")}>{n}</button>
                ))}
                <div className="fws-section__title" style={{ marginTop: 14, marginBottom: 6 }}>Stat impact</div>
                {["Cunning +2", "Sleep −1"].map((n, i) => (
                  <div key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</div>
                ))}
              </>
            )}
            {tab === "effects" && (
              <>
                {_lblList(selected?.effects, ["Active in possession", "Discharges on contact w/ Greycoat banner"]).map((n, i) => (
                  <div key={i} style={{ padding: 8, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                    {n}
                  </div>
                ))}
              </>
            )}
            {tab === "source" && (
              <>
                {(selected?.mentions || [
                  { ch: "Ch.2", q: "the Auger of Hess in a felt-lined case…" },
                  { ch: "Ch.7", q: "She set the case on the table. The wood under it gave the smallest, indignant sigh." },
                ]).map((m, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6, fontSize: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{m.ch}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"{m.q}"</div>
                  </div>
                ))}
              </>
            )}
            {tab === "review" && (
              <div className="fws-empty" style={{ padding: 20 }}>No review items for this entry.</div>
            )}
            {tab === "related" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Related cast</div>
                <button className="fws-chip" onClick={() => onRequest.openPanel("cast")}>Aelinor Vey</button>
                <button className="fws-chip" onClick={() => onRequest.openPanel("cast")} style={{ marginLeft: 4 }}>Saren of Hess</button>
              </>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// CLASS BUILDER --------------------------------------------------------
// =====================================================================
const ClassBuilderWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wrSamples("classes");
  const [search, setSearch] = _wr_us("");
  const [selectedId, setSelectedId] = _wr_us(items[0]?.id || null);
  const [tab, setTab] = _wr_us("cast");
  const filtered = _wrSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  return (
    <WorkspaceShell
      icon="shield" entityType="classes"
      eyebrow="Classes" title="Class Builder"
      subtitle="Archetypes, professions, schools — the templates your cast inherits from."
      createLabel="Create class"
      onCreate={() => onRequest.openEntityEditor({ type: "classes" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
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
                item={{ ...it, entityType: "classes" }}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar="✦"
                name={it.name}
                sub={it.subtitle || it.category}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "classes", initial: selected })}>Edit</button>}>
              <p style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || "—"}
              </p>
              <WorkspaceKV rows={[
                { k: "Category", v: selected.category || "—" },
                { k: "Restrictions", v: (selected.restrictions || []).join(", ") || "—" },
                { k: "Compatible races", v: (selected.compatibleRaces || ["Hess-born", "Greycoat-trained"]).join(", ") },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Default stats">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {(selected.defaultStats || [
                  { name: "Cunning", value: 14 }, { name: "Vigour", value: 11 }, { name: "Standing", value: 13 },
                ]).map((s, i) => (
                  <div key={i} className="fws-card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase" }}>{s.name}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-1)" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Starting equipment">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selected.startingEquipment || ["Felt-lined case", "Auger key", "Ink seal"]).map((n, i) => (
                  <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("items")}>{n}</button>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Allowed skills">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selected.allowedSkills || ["Salt-walker", "Auger-reading", "Quiet step"]).map((n, i) => (
                  <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("skillTrees")}>{n}</button>
                ))}
              </div>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select a class.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "cast", label: "Assigned cast" },
              { id: "trees", label: "Skill trees" },
              { id: "source", label: "Source" },
              { id: "review", label: "Review" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "cast" && (selected?.assignedCast || ["Aelinor Vey", "Saren of Hess"]).map((n, i) => (
              <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("cast")}>{n}</button>
            ))}
            {tab === "trees" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("skillTrees")}>
                <Icon name="branches" size={11}/> Open Skill Tree Editor →
              </button>
            )}
            {tab === "source" && (
              <div className="fws-empty" style={{ padding: 20 }}>No manuscript mentions yet.</div>
            )}
            {tab === "review" && (
              <div className="fws-empty" style={{ padding: 20 }}>No review items.</div>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// SPECIES REGISTRY -----------------------------------------------------
// =====================================================================
const SpeciesRegistryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wrSamples("races");
  const [search, setSearch] = _wr_us("");
  const [selectedId, setSelectedId] = _wr_us(items[0]?.id || null);
  const [tab, setTab] = _wr_us("cast");
  const filtered = _wrSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  return (
    <WorkspaceShell
      icon="branches" entityType="races"
      eyebrow="Races & Species" title="Species Registry"
      subtitle="Peoples, ancestries, creature types — origins, traits, cultures."
      createLabel="Create species"
      onCreate={() => onRequest.openEntityEditor({ type: "races" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
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
                item={{ ...it, entityType: "races" }}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar="✺"
                name={it.name}
                sub={it.subtitle || it.category}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "races", initial: selected })}>Edit</button>}>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || selected.description || "—"}
              </p>
              <WorkspaceKV rows={[
                { k: "Category", v: selected.category || "—" },
                { k: "Habitat / region", v: selected.habitat || selected.region || "—" },
                { k: "Origin", v: selected.origin || "—" },
                { k: "Lifespan", v: selected.lifespan || "—" },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Traits">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selected.traits || ["Salt-touched", "Pale-skinned", "Long-fingered"]).map((t, i) => (
                  <span key={i} className="fws-chip">{t}</span>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Innate skills & weaknesses">
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Innate</div>
                  {(selected.innate || ["Auger-attuned", "Cold tolerance"]).map((n, i) => (
                    <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Weaknesses</div>
                  {(selected.weaknesses || ["Salt-sickness", "Iron"]).map((n, i) => (
                    <span key={i} className="fws-chip fws-chip--warn" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>
                  ))}
                </div>
              </div>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select a species.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "cast", label: "Cast" },
              { id: "bestiary", label: "Bestiary" },
              { id: "factions", label: "Factions" },
              { id: "origins", label: "Origins" },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "cast" && (selected?.linkedCast || ["Aelinor Vey", "Saren of Hess"]).map((n, i) => (
              <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("cast")} style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
            ))}
            {tab === "bestiary" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("bestiary")}>
                <Icon name="paw" size={11}/> Open Bestiary →
              </button>
            )}
            {tab === "factions" && ["The Grey Coats"].map((n, i) => (
              <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
            ))}
            {tab === "origins" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")}>
                <Icon name="globe" size={11}/> View origins on Atlas →
              </button>
            )}
            {tab === "source" && (
              <div className="fws-empty" style={{ padding: 20 }}>No manuscript mentions yet.</div>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// STAT LAB -------------------------------------------------------------
// =====================================================================
const StatLabWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wrSamples("stats");
  const [search, setSearch] = _wr_us("");
  const [selectedId, setSelectedId] = _wr_us(items[0]?.id || "s1");
  const [tab, setTab] = _wr_us("history");
  const [phrase, setPhrase] = _wr_us("She had not slept since Brec's letter, and three nights of refusing the dreams had given her hands a fine, undignified tremor.");
  const filtered = _wrSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  const rules = selected?.rules || [
    { match: "could not sleep", effect: "Sleep −1", active: true },
    { match: "had not slept",   effect: "Sleep −2", active: true },
    { match: "the dreams gave", effect: "Grief +1", active: false },
  ];

  // Live extraction simulation: count how many rules match the phrase.
  const phraseResult = _wr_um(() => {
    const matched = rules.filter((r) => r.active && phrase.toLowerCase().includes(r.match.toLowerCase()));
    if (matched.length === 0) return { matched: 0, effects: ["No rules match this phrase."] };
    return { matched: matched.length, effects: matched.map((m) => `${m.match}  →  ${m.effect}`) };
  }, [phrase, rules]);

  return (
    <WorkspaceShell
      icon="bolt" entityType="stats"
      eyebrow="Stats" title="Stat Lab"
      subtitle="Universal stats + extraction rules. Test a phrase before saving the rule."
      createLabel="Create stat"
      onCreate={() => onRequest.openEntityEditor({ type: "stats" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
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
                item={{ ...it, entityType: "stats" }}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar={(it.name || "S").slice(0, 1)}
                name={it.name}
                sub={it.subtitle || it.valueType}
                meta={it.scope}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "stats", initial: selected })}>Edit</button>}>
              <WorkspaceKV rows={[
                { k: "Value type", v: selected.valueType || "scalar" },
                { k: "Default", v: selected.defaultValue ?? "0" },
                { k: "Range", v: (selected.min ?? "—") + " – " + (selected.max ?? "—") },
                { k: "Applies to", v: (selected.appliesTo || ["Cast"]).join(", ") },
                { k: "Display format", v: selected.displayFormat || "Integer" },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Extraction phrase rules" sub="Edit and toggle rules. Test below.">
              {rules.map((r, i) => (
                <div key={i} className="fws-rule">
                  <span className={"fws-rule__active " + (r.active ? "is-on" : "")}>{r.active ? "ON" : "OFF"}</span>
                  <span className="fws-rule__match">"{r.match}"</span>
                  <span className="fws-rule__effect">→ {r.effect}</span>
                  <button className="fws-section__action">Edit</button>
                </div>
              ))}
              <button className="fws-section__action" style={{ marginTop: 6 }}>+ Add rule</button>
            </WorkspaceCard>

            <WorkspaceCard title="Test phrase" sub="Paste a manuscript sentence and see which rules fire.">
              <div className="fws-phrase-test">
                <textarea
                  className="fws-phrase-test__input"
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
          </>
        ) : <div className="fws-empty">Select a stat.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "history", label: "History" },
              { id: "assigned", label: "Assigned to" },
              { id: "review", label: "Review" },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "history" && [
              { ch: "Ch.2", c: "Aelinor", δ: "−1 Sleep" },
              { ch: "Ch.4", c: "Brec", δ: "+1 Grief" },
              { ch: "Ch.7", c: "Aelinor", δ: "−2 Sleep" },
            ].map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 70px", gap: 6, padding: "6px 8px", fontSize: 12, borderBottom: "1px solid var(--line-1)" }}>
                <span style={{ color: "var(--ink-3)" }}>{row.ch}</span>
                <span style={{ fontFamily: "var(--font-serif)" }}>{row.c}</span>
                <span style={{ color: "var(--accent-deep)", textAlign: "right" }}>{row.δ}</span>
              </div>
            ))}
            {tab === "assigned" && ["Aelinor Vey", "Captain Brec", "Saren of Hess"].map((n, i) => (
              <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("cast")}>{n}</button>
            ))}
            {tab === "review" && (
              <div className="fws-empty" style={{ padding: 20 }}>No review items.</div>
            )}
            {tab === "source" && (
              <div className="fws-empty" style={{ padding: 20 }}>No source phrases yet.</div>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// FACTION REGISTRY -----------------------------------------------------
// =====================================================================
const FactionRegistryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wrSamples("factions");
  const [selectedId, setSelectedId] = _wr_us(items[0]?.id || null);
  const selected = items.find((x) => x.id === selectedId) || items[0];

  return (
    <WorkspaceShell
      icon="banner" entityType="factions"
      eyebrow="Factions" title="Faction Registry"
      subtitle="Houses, orders, guilds — who holds power, who's at war."
      createLabel="Create faction"
      onCreate={() => onRequest.openEntityEditor({ type: "generic" })}
      onExit={onExit} cols="lc"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section">
            <span className="fws-section__title">Factions</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div className="fws-roster">
            {items.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it, entityType: "factions" }}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
                avatar="◇"
                name={it.name}
                sub={it.subtitle}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <WorkspaceCard title={selected.name} sub={selected.subtitle}>
            <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
              {selected.summary || "—"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button className="fws-chip" onClick={() => onRequest.openPanel("cast")}>Members</button>
              <button className="fws-chip" onClick={() => onRequest.openPanel("locations")}>Territory</button>
              <button className="fws-chip" onClick={() => onRequest.openPanel("relationships")}>Rivalries</button>
            </div>
          </WorkspaceCard>
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
