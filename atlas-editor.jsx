// =====================================================================
// atlas-editor.jsx — full-screen Atlas Editor workspace.
//
// Layout (desk):
//   ┌─ AtlasEdToolbar ──────────────────────────────────────────────┐
//   │ [Registry/Tray/Layers] [Map canvas]  [Inspector tabs]         │
//   │                          [floating mini-map]                  │
//   ├─ AtlasEdScrubber (full chapter timeline + travel timeline) ───┤
//   └───────────────────────────────────────────────────────────────┘
// =====================================================================

const { useState: _us_ae, useMemo: _um_ae, useCallback: _uc_ae, useEffect: _ue_ae } = React;

// ---------------------------------------------------------------------
// Toolbar — core tools always visible, advanced grouped under flyouts
// ---------------------------------------------------------------------
const AtlasEdToolbar = ({
  tool, onPickTool, onZoomIn, onZoomOut, onFitView, onExitFs,
  flyoutOpen, onToggleFlyout, onPickFlyoutTool, coreTools, flyoutGroups,
}) => (
  <div className="ae-tb" data-ui="AtlasEdToolbar">
    <div className="ae-tb__brand">
      <Icon name="compass" size={14}/>
      <span>Atlas Editor</span>
    </div>

    <div className="ae-tb__group ae-tb__group--core">
      {coreTools.map((t) => (
        <button key={t.id} className={"ae-tb__btn" + (tool === t.id ? " is-active" : "")}
                onClick={() => onPickTool(t.id)} data-callback="onPickAtlasTool" data-tool={t.id}
                title={t.label + " (" + t.kbd + ")"}>
          <Icon name={t.icon} size={13}/>
          <span className="ae-tb__lbl">{t.label}</span>
        </button>
      ))}
    </div>

    <div className="ae-tb__group ae-tb__group--flyouts">
      {flyoutGroups.map((g) => (
        <div key={g.id} className="ae-tb__flyout">
          <button className={"ae-tb__btn ae-tb__btn--flyout" + (flyoutOpen === g.id ? " is-active" : "")}
                  onClick={() => onToggleFlyout(g.id)} data-callback="onToggleAtlasFlyout" data-flyout={g.id}>
            <span className="ae-tb__lbl">{g.label}</span>
            <Icon name="chevron-d" size={9}/>
          </button>
          {flyoutOpen === g.id && (
            <div className="ae-tb__flyout-menu" onClick={(e) => e.stopPropagation()}>
              {g.tools.map((t) => (
                <button key={t.id} className="ae-tb__flyout-item"
                        onClick={() => onPickFlyoutTool(g.id, t.id)} data-callback="onPickAtlasFlyoutTool" data-tool={t.id}>
                  <Icon name={t.icon} size={11}/>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>

    <span style={{ flex: 1 }}/>

    <div className="ae-tb__group">
      <button className="ae-tb__btn" onClick={onZoomOut} data-callback="onAtlasZoomOut" title="Zoom out">
        <Icon name="close" size={11}/><span className="ae-tb__lbl">−</span>
      </button>
      <button className="ae-tb__btn" onClick={onZoomIn} data-callback="onAtlasZoomIn" title="Zoom in">
        <Icon name="plus" size={11}/><span className="ae-tb__lbl">+</span>
      </button>
      <button className="ae-tb__btn" onClick={onFitView} data-callback="onAtlasFitView" title="Fit view">
        <Icon name="expand" size={11}/><span className="ae-tb__lbl">Fit</span>
      </button>
    </div>

    <button className="ae-tb__exit" onClick={onExitFs} data-callback="onExitAtlasFullScreen">
      <Icon name="close" size={11}/>
      <span>Exit Editor</span>
    </button>
  </div>
);

// ---------------------------------------------------------------------
// Left rail — Registry / Entity Tray / Layers (tabbed; collapsible)
// ---------------------------------------------------------------------
const AtlasEdLeftRail = ({
  collapsed, onToggle, tab, onSetTab,
  locations, layers, layerState, cast, onSelectLoc, onSelectEntity, onToggleLayer,
  selectedId, query, onSetQuery,
}) => {
  // Build hierarchy tree
  const tree = _um_ae(() => {
    const byParent = {};
    locations.forEach((l) => { (byParent[l.parent || "world"] = byParent[l.parent || "world"] || []).push(l); });
    return byParent;
  }, [locations]);

  const [openIds, setOpenIds] = _us_ae(() => new Set(["world", "north", "hess", "vraska", "pr", "gc", "ac", "bm"]));
  const toggleOpen = (id) => {
    const s = new Set(openIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setOpenIds(s);
  };

  const renderNode = (id, depth) => {
    const children = tree[id] || [];
    if (!children.length) return null;
    return children.map((loc) => {
      const has = (tree[loc.id] || []).length > 0;
      const isOpen = openIds.has(loc.id);
      const matches = !query || loc.name.toLowerCase().includes(query.toLowerCase());
      const dim = query && !matches;
      return (
        <React.Fragment key={loc.id}>
          <div className={"ae-reg__row" + (selectedId === loc.id ? " is-sel" : "") + (dim ? " is-dim" : "")}
               style={{ paddingLeft: 8 + depth * 12 }}
               onClick={() => onSelectLoc(loc)}>
            {has ? (
              <button className="ae-reg__caret" onClick={(e) => { e.stopPropagation(); toggleOpen(loc.id); }}
                      data-callback="onToggleAtlasNode">
                <Icon name={isOpen ? "chevron-d" : "chevron-r"} size={9}/>
              </button>
            ) : <span className="ae-reg__caret"/>}
            <span className={"ae-reg__type ae-reg__type--" + loc.type}/>
            <span className="ae-reg__name">{loc.name}</span>
            {loc.queue > 0 && <span className="ae-reg__q">{loc.queue}</span>}
            <span className="ae-reg__kind">{loc.type}</span>
          </div>
          {isOpen && renderNode(loc.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  if (collapsed) {
    return (
      <aside className="ae-rail ae-rail--collapsed" data-ui="AtlasEdLeftRail">
        <button className="ae-rail__toggle" onClick={onToggle} title="Expand">
          <Icon name="panel-right" size={12}/>
        </button>
        <button className={"ae-rail__icn" + (tab === "registry" ? " is-on" : "")}
                onClick={() => { onToggle(); onSetTab("registry"); }} title="Registry">
          <Icon name="tree" size={14}/>
        </button>
        <button className={"ae-rail__icn" + (tab === "tray" ? " is-on" : "")}
                onClick={() => { onToggle(); onSetTab("tray"); }} title="Entity Tray">
          <Icon name="menu" size={14}/>
        </button>
        <button className={"ae-rail__icn" + (tab === "layers" ? " is-on" : "")}
                onClick={() => { onToggle(); onSetTab("layers"); }} title="Layers">
          <Icon name="stack" size={14}/>
        </button>
      </aside>
    );
  }

  return (
    <aside className="ae-rail" data-ui="AtlasEdLeftRail">
      <div className="ae-rail__tabs">
        <button className={"ae-rail__tab" + (tab === "registry" ? " is-on" : "")} onClick={() => onSetTab("registry")} data-callback="onSetAtlasRailTab">
          <Icon name="tree" size={11}/><span>Registry</span>
        </button>
        <button className={"ae-rail__tab" + (tab === "tray" ? " is-on" : "")} onClick={() => onSetTab("tray")} data-callback="onSetAtlasRailTab">
          <Icon name="menu" size={11}/><span>Tray</span>
        </button>
        <button className={"ae-rail__tab" + (tab === "layers" ? " is-on" : "")} onClick={() => onSetTab("layers")} data-callback="onSetAtlasRailTab">
          <Icon name="stack" size={11}/><span>Layers</span>
        </button>
        <button className="ae-rail__collapse" onClick={onToggle} title="Collapse">
          <Icon name="panel-left" size={11}/>
        </button>
      </div>

      {tab === "registry" && (
        <div className="ae-reg">
          <div className="ae-reg__search">
            <Icon name="search" size={11}/>
            <input value={query} onChange={(e) => onSetQuery(e.target.value)} placeholder="Filter locations…"/>
            <button className="ae-reg__add" data-callback="onCreateAtlasLocation" title="New location">
              <Icon name="plus" size={11}/>
            </button>
          </div>
          <div className="ae-reg__sectionhead">
            <span>{locations.length} locations · 6 levels</span>
          </div>
          <div className="ae-reg__tree">
            {renderNode("world", 0)}
          </div>
        </div>
      )}

      {tab === "tray" && (
        <div className="ae-tray">
          <div className="ae-tray__sec">
            <div className="ae-tray__head">Cast</div>
            <div className="ae-tray__grid">
              {cast.map((c) => (
                <button key={c.id} className="ae-tray__item" style={{ "--c": c.color }}
                        onClick={() => onSelectEntity({ type: "cast", id: c.id, label: c.name })}
                        data-callback="onSelectEntity">
                  <span className="ae-tray__avatar">{c.initials}</span>
                  <span className="ae-tray__name">{c.name}</span>
                  <span className="ae-tray__role">{c.role}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ae-tray__sec">
            <div className="ae-tray__head">Bestiary</div>
            <div className="ae-tray__grid">
              {(window.ATLAS_BEASTS || []).map((b) => (
                <button key={b.id} className="ae-tray__item" style={{ "--c": b.color }}
                        onClick={() => onSelectEntity({ type: "bestiary", id: b.id, label: b.name })}
                        data-callback="onSelectEntity">
                  <span className="ae-tray__avatar"><Icon name={b.icon} size={11}/></span>
                  <span className="ae-tray__name">{b.name}</span>
                  <span className="ae-tray__role">{b.habitat.length} hab</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ae-tray__sec">
            <div className="ae-tray__head">Items</div>
            <div className="ae-tray__grid">
              {(window.ATLAS_ITEMS || []).map((it) => (
                <button key={it.id} className="ae-tray__item" style={{ "--c": it.color }}
                        onClick={() => onSelectEntity({ type: "items", id: it.id, label: it.name })}
                        data-callback="onSelectEntity">
                  <span className="ae-tray__avatar"><Icon name={it.icon} size={11}/></span>
                  <span className="ae-tray__name">{it.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ae-tray__sec">
            <div className="ae-tray__head">Factions</div>
            <div className="ae-tray__grid">
              {(window.ATLAS_FACTIONS || []).map((f) => (
                <button key={f.id} className="ae-tray__item" style={{ "--c": f.color }}
                        onClick={() => onSelectEntity({ type: "factions", id: f.id, label: f.name })}
                        data-callback="onSelectEntity">
                  <span className="ae-tray__avatar"><Icon name="shield" size={11}/></span>
                  <span className="ae-tray__name">{f.name}</span>
                  <span className="ae-tray__role">{f.territory.length} loc</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "layers" && (
        <div className="ae-layers">
          {[
            { k: "geo", title: "Geometry" },
            { k: "ovl", title: "Overlays" },
            { k: "ann", title: "Annotations" },
            { k: "art", title: "Artwork" },
          ].map(({ k, title }) => (
            <div key={k} className="ae-layers__sec">
              <div className="ae-layers__head">{title}</div>
              {layers.filter((l) => l.kind === k).map((l) => {
                const visible = layerState[l.id] !== false;
                return (
                  <div key={l.id} className={"ae-layers__row" + (visible ? "" : " is-off")} data-layer={l.id}>
                    <button className="ae-layers__main"
                            onClick={() => onToggleLayer(l.id)} data-callback="onToggleAtlasLayer">
                      <span className="ae-layers__sw" style={{ background: l.color }}/>
                      <span className="ae-layers__lbl">{l.label}</span>
                      {l.count != null && <span className="ae-layers__count">{l.count}</span>}
                      {l.warnings > 0 && (
                        <span className="ae-layers__warn" title={l.warnings + " warning(s)"}>!{l.warnings}</span>
                      )}
                      <span className={"ae-layers__eye " + (visible ? "is-on" : "is-off")}>
                        <Icon name="eye" size={10}/>
                      </span>
                    </button>
                    <div className="ae-layers__sub">
                      <span className="ae-layers__op" title="Layer opacity">
                        <span className="ae-layers__op-fill" style={{ width: ((window.ATLAS_LAYER_OPACITY || {})[l.id] ?? 100) + "%" }}/>
                        <input type="range" className="ae-layers__op-range" min={10} max={100} step={10}
                               aria-label={l.label + " opacity"}
                               data-testid={"ae-opacity-" + l.id}
                               value={(window.ATLAS_LAYER_OPACITY || {})[l.id] ?? 100}
                               onChange={async (e) => {
                                 const B = window.LoomwrightBackend;
                                 const section = B?.SettingsService?.getSectionSync?.("atlas", {}) || {};
                                 const layerOpacity = { ...(section.layerOpacity || {}), [l.id]: Number(e.target.value) };
                                 await B?.SettingsService?.saveSection("atlas", { ...section, layerOpacity });
                               }}/>
                      </span>
                      <button className={"ae-layers__lock" + (l.locked ? " is-on" : "")}
                              title={l.locked ? "Unlock layer" : "Lock layer"}
                              data-callback="onToggleAtlasLayerLock" data-layer={l.id}>
                        <Icon name="lock" size={9}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

// ---------------------------------------------------------------------
// Right rail — Inspector / Review Queue / Related / Source mentions
// ---------------------------------------------------------------------
const AtlasEdRightRail = ({
  collapsed, onToggle, tab, onSetTab,
  selected, locById, routes, beasts, items, factions, queue,
  onSelectLoc, onSelectEntity, context,
}) => {
  if (collapsed) {
    return (
      <aside className="ae-rrail ae-rrail--collapsed">
        <button className="ae-rrail__toggle" onClick={onToggle}>
          <Icon name="panel-left" size={12}/>
        </button>
        <button className="ae-rrail__icn" onClick={() => { onToggle(); onSetTab("inspector"); }}><Icon name="paper" size={14}/></button>
        <button className="ae-rrail__icn" onClick={() => { onToggle(); onSetTab("queue"); }}>
          <Icon name="bell" size={14}/>
          {queue.length > 0 && <span className="ae-rrail__badge">{queue.length}</span>}
        </button>
        <button className="ae-rrail__icn" onClick={() => { onToggle(); onSetTab("related"); }}><Icon name="link" size={14}/></button>
        <button className="ae-rrail__icn" onClick={() => { onToggle(); onSetTab("source"); }}><Icon name="quote" size={14}/></button>
      </aside>
    );
  }

  const sel = selected && locById[selected.id];

  return (
    <aside className="ae-rrail" data-ui="AtlasEdRightRail">
      <div className="ae-rrail__tabs">
        <button className={"ae-rrail__tab" + (tab === "inspector" ? " is-on" : "")} onClick={() => onSetTab("inspector")}>
          <Icon name="paper" size={11}/><span>Inspector</span>
        </button>
        <button className={"ae-rrail__tab" + (tab === "queue" ? " is-on" : "")} onClick={() => onSetTab("queue")}>
          <Icon name="bell" size={11}/><span>Review</span>
          {queue.length > 0 && <span className="ae-rrail__tabbadge">{queue.length}</span>}
        </button>
        <button className={"ae-rrail__tab" + (tab === "related" ? " is-on" : "")} onClick={() => onSetTab("related")}>
          <Icon name="link" size={11}/><span>Related</span>
        </button>
        <button className={"ae-rrail__tab" + (tab === "source" ? " is-on" : "")} onClick={() => onSetTab("source")}>
          <Icon name="quote" size={11}/><span>Source</span>
        </button>
        <button className="ae-rrail__collapse" onClick={onToggle}><Icon name="panel-right" size={11}/></button>
      </div>

      <div className="ae-rrail__body">
        {tab === "inspector" && <AtlasEdInspectorTab selected={sel} locById={locById} routes={routes}
                                                     beasts={beasts} items={items} factions={factions}
                                                     onSelectLoc={onSelectLoc} onSelectEntity={onSelectEntity}
                                                     context={context}/>}
        {tab === "queue"     && <AtlasEdQueueTab queue={queue}/>}
        {tab === "related"   && <AtlasEdRelatedTab selected={sel} locById={locById} routes={routes}
                                                   beasts={beasts} items={items} factions={factions}
                                                   onSelectLoc={onSelectLoc} onSelectEntity={onSelectEntity}/>}
        {tab === "source"    && <AtlasEdSourceTab selected={sel}/>}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// Inspector tab — full edit form
// ---------------------------------------------------------------------
const AtlasEdInspectorTab = ({ selected, locById, routes, beasts, items, factions, onSelectLoc, context }) => {
  if (!selected) {
    return (
      <div className="ae-insp">
        {context && context.source ? (
          <div className="ae-insp__ctx">
            <div className="ae-insp__ctxh">
              <Icon name="link" size={11}/>
              <span>Driven by <b>{context.source.panel}</b></span>
            </div>
            <div className="ae-insp__ctxlbl">{context.source.label}</div>
            <p className="ae-insp__ctxd">{context.description}</p>
          </div>
        ) : null}
        <div className="ae-insp__empty">
          <Icon name="pin" size={18}/>
          <p>No location selected.</p>
          <p className="muted">Click a pin on the map, or pick a location from the registry.</p>
        </div>
      </div>
    );
  }
  const parent = selected.parent && locById[selected.parent];
  const children = Object.values(locById).filter((l) => l.parent === selected.id);
  return (
    <div className="ae-insp">
      <div className="ae-insp__head">
        <span className={"ae-insp__type-dot ae-reg__type--" + selected.type}/>
        <input className="ae-insp__name" defaultValue={selected.name}/>
        <button className="ae-insp__more"><Icon name="more" size={12}/></button>
      </div>
      <div className="ae-insp__row">
        <label>Type</label>
        <select defaultValue={selected.type}>
          {["country","region","city","town","village","district","building","room","ruin","battlefield","hidden","road"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="ae-insp__row">
        <label>Parent</label>
        <button className="ae-insp__parent" onClick={() => parent && onSelectLoc(parent)}>
          {parent ? parent.name : "World"} →
        </button>
      </div>
      {selected.fields && selected.fields.map(([k, v], i) => (
        <div key={i} className="ae-insp__row">
          <label>{k}</label>
          <input defaultValue={v}/>
        </div>
      ))}
      <div className="ae-insp__row ae-insp__row--block">
        <label>Summary</label>
        <textarea defaultValue={selected.summary} rows={3}/>
      </div>
      {children.length > 0 && (
        <div className="ae-insp__sec">
          <div className="ae-insp__sech">Children · {children.length}</div>
          <div className="ae-insp__chips">
            {children.map((c) => (
              <button key={c.id} className="ae-insp__chip" onClick={() => onSelectLoc(c)}>
                <span className={"ae-reg__type--" + c.type + " ae-insp__chipdot"}/>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ae-insp__sec ae-insp__sec--actions">
        <button className="ae-insp__btn">Move on map</button>
        <button className="ae-insp__btn">Reparent…</button>
        <button className="ae-insp__btn ae-insp__btn--danger">Delete</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Queue tab — Atlas-specific review queue (full card, per brief)
// ---------------------------------------------------------------------
const ATLAS_QUEUE_CATEGORIES = [
  { id: "all",       label: "All",            match: () => true },
  { id: "loc",       label: "Locations",      match: (q) => /add|place|merge/i.test(q.action) && !/contradict|conflict/i.test(q.name) },
  { id: "placement", label: "Placements",     match: (q) => /place|under|parent/i.test(q.action) },
  { id: "travel",    label: "Travel",         match: (q) => /route|travel|path/i.test(q.action) },
  { id: "char",      label: "Characters",     match: (q) => /character|cast/i.test(q.reason) },
  { id: "beast",     label: "Bestiary",       match: (q) => /beast|wraith|hound/i.test(q.name) },
  { id: "item",      label: "Items",          match: (q) => /item|auger|stone|cloak/i.test(q.name) && !/cliff|hall|court/i.test(q.name) },
  { id: "quest",     label: "Quests / Events",match: (q) => /quest|event/i.test(q.reason) },
  { id: "fac",       label: "Factions",       match: (q) => /faction|house|order/i.test(q.reason) },
  { id: "contradict",label: "Contradictions", match: (q) => /contradict|conflict|disagree/i.test(q.reason) },
];

const AtlasEdQueueTab = ({ queue }) => {
  const [cat, setCat] = _us_ae("all");
  const filter = ATLAS_QUEUE_CATEGORIES.find((c) => c.id === cat) || ATLAS_QUEUE_CATEGORIES[0];
  const filtered = queue.filter(filter.match);
  return (
    <div className="ae-queue">
      <div className="ae-queue__head">
        <span><b>{queue.length}</b> Atlas-only items</span>
        <button className="ae-queue__btnall" data-callback="onProcessAllAtlasQueue">Process all</button>
      </div>
      <div className="ae-queue__cats" role="tablist">
        {ATLAS_QUEUE_CATEGORIES.map((c) => {
          const n = queue.filter(c.match).length;
          if (!n && c.id !== "all") return null;
          return (
            <button key={c.id} className={"ae-queue__cat" + (cat === c.id ? " is-on" : "")}
                    onClick={() => setCat(c.id)} data-callback="onSetAtlasQueueCategory" data-cat={c.id}>
              <span>{c.label}</span><span className="ae-queue__cat__n">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="ae-queue__list">
        {filtered.length === 0 ? (
          <div className="ae-queue__empty">
            <Icon name="check" size={14}/>
            <span>No {filter.label.toLowerCase()} pending.</span>
          </div>
        ) : filtered.map((q) => (
          <AtlasEdQueueCard key={q.id} item={q}/>
        ))}
      </div>
    </div>
  );
};

// One card — confidence band, candidate type, suggested action, source chapter,
// source quote, related entity, map preview, hierarchy preview, full action bar.
const AtlasEdQueueCard = ({ item }) => {
  const q = item;
  const candidateType = q.action.includes("Region") ? "Region"
                       : q.action.includes("under") ? "Sub-location"
                       : q.action.includes("Reject") ? "Rejection"
                       : q.action.includes("Auto")   ? "Auto-add"
                       : q.action.includes("Resolve")? "Contradiction"
                       : "Location";
  return (
    <div className={"ae-queue__card ae-queue__card--" + q.level}>
      <div className="ae-queue__cardh">
        <span className={"ae-queue__lvl ae-queue__lvl--" + q.level}>{q.level}</span>
        <span className="ae-queue__name">{q.name}</span>
        <span className="ae-queue__val">{q.value}%</span>
      </div>
      <div className="ae-queue__meta">
        <span className="ae-queue__pill ae-queue__pill--type">{candidateType}</span>
        <span className="ae-queue__pill ae-queue__pill--action">{q.action}</span>
        <span className="ae-queue__pill">{q.cite}</span>
      </div>
      <p className="ae-queue__excerpt">"{q.excerpt}"</p>
      <div className="ae-queue__reason">{q.reason}</div>
      <div className="ae-queue__previews">
        <div className="ae-queue__preview">
          <div className="ae-queue__preview__lbl">Map preview</div>
          <svg viewBox="0 0 120 56" className="ae-queue__preview__svg" aria-hidden="true">
            <defs>
              <pattern id={"qp" + q.id} width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M0 6L6 0" stroke="#d6c69a" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect x="2" y="2" width="116" height="52" fill={"url(#qp" + q.id + ")"} stroke="#9a8c6e" strokeWidth="0.5" rx="3"/>
            <path d="M14 14 Q40 6 60 14 T108 18 L100 40 Q70 50 40 42 L14 36 Z" fill="#e7dfc6" stroke="#76684c" strokeWidth="0.8" opacity="0.6"/>
            <circle cx="60" cy="28" r="3.5" fill="#a8553f" stroke="#fff" strokeWidth="1"/>
            <text x="60" y="44" fontSize="6" textAnchor="middle" fill="#2a2218" fontFamily="serif">{q.name.slice(0, 12)}</text>
          </svg>
        </div>
        <div className="ae-queue__preview">
          <div className="ae-queue__preview__lbl">Hierarchy</div>
          <div className="ae-queue__hier">
            <div className="ae-queue__hier__row"><Icon name="compass" size={9}/><span>World</span></div>
            {(() => {
              const top = (window.ATLAS_LOCATIONS || []).find((l) =>
                (l.type === "country" || l.type === "continent" || l.type === "region") && (l.parent === "world" || !l.parent));
              return top ? (
                <div className="ae-queue__hier__row" style={{ paddingLeft: 10 }}>
                  <Icon name="branch" size={9}/><span>{top.name}</span>
                </div>
              ) : null;
            })()}
            <div className="ae-queue__hier__row ae-queue__hier__new" style={{ paddingLeft: 20 }}>
              <Icon name="plus" size={9}/><span>{q.name}</span>
            </div>
          </div>
        </div>
      </div>
      {q.relatedEntity && (
        <div className="ae-queue__related">
          <span className="ae-queue__related__lbl">Related</span>
          <span className="ae-queue__related__chip">{q.relatedEntity}</span>
        </div>
      )}
      <div className="ae-queue__actions">
        <button className="ae-queue__btn ae-queue__btn--ok"
                data-callback="onAcceptQueueItem" data-id={q.id}>Accept</button>
        <button className="ae-queue__btn"
                data-callback="onEditQueueItem" data-id={q.id}>Edit</button>
        <button className="ae-queue__btn"
                data-callback="onMergeQueueItem" data-id={q.id}>Merge…</button>
        <button className="ae-queue__btn ae-queue__btn--no"
                data-callback="onDenyQueueItem" data-id={q.id}>Deny</button>
        <span style={{ flex: 1 }}/>
        <button className="ae-queue__btn ae-queue__btn--ghost"
                data-callback="onOpenSourceMention" data-id={q.id} title="Open source">
          <Icon name="paper" size={9}/>
        </button>
        <button className="ae-queue__btn ae-queue__btn--ghost"
                data-callback="onShowOnAtlas" data-id={q.id} title="Show on map">
          <Icon name="pin" size={9}/>
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Related tab — entities tied to selected location
// ---------------------------------------------------------------------
const AtlasEdRelatedTab = ({ selected, locById, routes, beasts, items, factions, onSelectLoc, onSelectEntity }) => {
  if (!selected) return <div className="ae-related ae-related--empty"><p className="muted">Pick a location to see what's tied to it.</p></div>;
  const presentRoutes = routes.filter((r) => r.waypoints.some((w) => w.locationId === selected.id));
  const presentBeasts = beasts.filter((b) => b.habitat.includes(selected.id));
  const presentItems  = items.filter((i) =>
    (i.found && i.found.locationId === selected.id) ||
    (i.used  && i.used.locationId  === selected.id) ||
    (i.lost  && i.lost.locationId  === selected.id));
  const presentFacs   = factions.filter((f) => f.territory.includes(selected.id));
  const presentQuests = (window.ATLAS_QUESTS || []).filter((q) => (q.steps || []).some((s) => s.locationId === selected.id) || q.locationId === selected.id);
  const Sec = ({ title, items, render }) => items.length === 0 ? null : (
    <div className="ae-related__sec">
      <div className="ae-related__head">{title} · {items.length}</div>
      <div className="ae-related__list">{items.map(render)}</div>
    </div>
  );
  return (
    <div className="ae-related">
      <Sec title="Characters" items={presentRoutes} render={(r) => (
        <button key={r.id} className="ae-related__row" style={{ "--c": r.color }}
                onClick={() => onSelectEntity({ type: "cast", id: r.characterId, label: r.characterName })}>
          <span className="ae-related__sw"/>
          <span className="ae-related__name">{r.characterName}</span>
          <span className="ae-related__meta">{r.waypoints.find((w) => w.locationId === selected.id)?.label}</span>
        </button>
      )}/>
      <Sec title="Beasts" items={presentBeasts} render={(b) => (
        <button key={b.id} className="ae-related__row" style={{ "--c": b.color }}
                onClick={() => onSelectEntity({ type: "bestiary", id: b.id, label: b.name })}>
          <span className="ae-related__sw"/>
          <span className="ae-related__name">{b.name}</span>
          <span className="ae-related__meta">{b.summary}</span>
        </button>
      )}/>
      <Sec title="Items" items={presentItems} render={(it) => (
        <button key={it.id} className="ae-related__row" style={{ "--c": it.color }}
                onClick={() => onSelectEntity({ type: "items", id: it.id, label: it.name })}>
          <span className="ae-related__sw"/>
          <span className="ae-related__name">{it.name}</span>
          <span className="ae-related__meta">
            {it.found?.locationId === selected.id ? "Found here" : it.used?.locationId === selected.id ? "Used here" : "Lost here"}
          </span>
        </button>
      )}/>
      <Sec title="Factions" items={presentFacs} render={(f) => (
        <button key={f.id} className="ae-related__row" style={{ "--c": f.color }}
                onClick={() => onSelectEntity({ type: "factions", id: f.id, label: f.name })}>
          <span className="ae-related__sw"/>
          <span className="ae-related__name">{f.name}</span>
          <span className="ae-related__meta">{f.hq === selected.id ? "HQ here" : "Territory"}</span>
        </button>
      )}/>
      <Sec title="Quests / events" items={presentQuests} render={(q) => (
        <button key={q.id} className="ae-related__row" style={{ "--c": "#8a3a4f" }}
                onClick={() => onSelectEntity({ type: "quests", id: q.id, label: q.name })}>
          <span className="ae-related__sw"/>
          <span className="ae-related__name">{q.name}</span>
          <span className="ae-related__meta">{q.type} · {q.status}</span>
        </button>
      )}/>
    </div>
  );
};

// ---------------------------------------------------------------------
// Source tab — manuscript mentions
// ---------------------------------------------------------------------
const AtlasEdSourceTab = ({ selected }) => {
  const mentions = !selected ? [] : [
    { cite: "Ch. 1, p. 12", text: "...the " + selected.name + " was already lit before dawn..." },
    { cite: "Ch. 3, p. 76", text: "...she would not see " + selected.name + " again before the snow..." },
    { cite: "Ch. 7, p. 211", text: "...inside " + selected.name + ", the doors were already open..." },
  ];
  if (!selected) return <div className="ae-source ae-source--empty"><p className="muted">Pick a location to see manuscript mentions.</p></div>;
  return (
    <div className="ae-source">
      <div className="ae-source__head">{mentions.length} mentions in manuscript</div>
      {mentions.map((m, i) => (
        <div key={i} className="ae-source__card">
          <div className="ae-source__cite">{m.cite}</div>
          <p>{m.text}</p>
          <div className="ae-source__actions">
            <button>Open in Writer's Room →</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Bottom strip — full chapter scrubber + travel timeline lanes
// ---------------------------------------------------------------------
const AtlasEdScrubber = ({
  chapters, currentChapter, scrubChapter, onScrub, onJumpCurrent,
  routes, locById, legendChips, activeChips, onToggleChip,
}) => {
  const at = scrubChapter != null ? scrubChapter : currentChapter;
  return (
    <div className="ae-scrub" data-ui="AtlasEdScrubber">
      <div className="ae-scrub__legend">
        {legendChips.map((chip) => {
          const on = activeChips[chip.id] !== false;
          return (
            <button key={chip.id} className={"ae-scrub__chip" + (on ? " is-on" : "")}
                    onClick={() => onToggleChip(chip.id)}>
              <span className="ae-scrub__chip__sw" style={{ background: chip.color }}/>
              <span>{chip.label}</span>
              {chip.count != null && <span className="ae-scrub__chip__n">{chip.count}</span>}
            </button>
          );
        })}
      </div>

      <div className="ae-scrub__main">
        <button className="ae-scrub__jump" onClick={onJumpCurrent}>
          <Icon name="bolt" size={11}/>
          <span>Now: {chapters[currentChapter]?.label}</span>
        </button>
        <div className="ae-scrub__cells">
          {chapters.map((c, i) => (
            <button key={c.id} className={
              "ae-scrub__cell" +
              (i === at ? " is-active" : "") +
              (i === currentChapter ? " is-current" : "") +
              (c.reserved ? " is-reserved" : "")
            } onClick={() => onScrub(i)}>
              <div className="ae-scrub__cellh">
                <span className="ae-scrub__cellnum">{c.label.replace("Ch. ", "")}</span>
                {c.warnings > 0 && <span className="ae-scrub__cellwarn">!</span>}
              </div>
              <div className="ae-scrub__celltitle">{c.title}</div>
              <div className="ae-scrub__cellmeta">
                <span>{(c.locations || []).length} loc</span>
                {(c.added || []).length > 0 && <span className="ae-scrub__add">+{(c.added || []).length}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="ae-scrub__lanes">
        {routes.map((r) => (
          <div key={r.id} className="ae-scrub__lane" style={{ "--c": r.color }}>
            <div className="ae-scrub__lanelbl">
              <span className="ae-scrub__lanesw"/>
              <span>{r.characterName}</span>
            </div>
            <div className="ae-scrub__lanetrack">
              {chapters.map((c, i) => {
                const wp = r.waypoints.find((w) => w.chapter === i + 1);
                return (
                  <div key={c.id} className={"ae-scrub__lanecell" + (wp ? " has-wp" : "")}>
                    {wp && (
                      <span className={"ae-scrub__wp ae-scrub__wp--" + wp.kind}
                            title={wp.label + " — " + (locById[wp.locationId]?.name || wp.locationId)}>
                        {wp.kind === "depart" ? "↑" : wp.kind === "arrive" ? "↓" : "•"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Floating mini-map
// ---------------------------------------------------------------------
const AtlasMiniMap = ({ locations, routes, selectedId, context }) => {
  const locById = _um_ae(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);
  return (
    <div className="ae-mini" data-ui="AtlasMiniMap">
      <div className="ae-mini__head">Mini-map</div>
      <div className="ae-mini__body">
        <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width="1200" height="700" fill="#f1e7c8"/>
          <path d="M 30 130 C 60 90, 280 70, 360 200 S 400 380, 320 420 S 100 460, 60 320 Z
                   M 380 290 C 460 260, 620 230, 690 360 S 540 480, 380 420 Z
                   M 740 200 C 820 170, 1100 170, 1140 320 S 980 510, 880 480 S 720 360, 740 200 Z"
            fill="#dccda3" stroke="rgba(74,56,28,0.6)" strokeWidth="2"/>
          {locations.filter((l) => ["country","region","city"].includes(l.type)).map((l) => {
            const x = (l.x / 100) * 1200;
            const y = (l.y / 100) * 700;
            return <circle key={l.id} cx={x} cy={y} r={l.type === "city" ? 10 : 6} fill={l.id === selectedId ? "#c98a2c" : "#3a2c12"}/>;
          })}
          <rect x="40" y="80" width="500" height="360" fill="none" stroke="#c98a2c" strokeWidth="6" strokeDasharray="20 16"/>
        </svg>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Main editor — wires everything together
// ---------------------------------------------------------------------
const AtlasEditor = ({
  // Data
  locations, routes, beasts, items, factions, chapters, layers, queue, cast,
  // State
  context, scrubChapter, currentChapter, layerState, legendChipsState,
  selected, leftRailCollapsed, rightRailCollapsed, leftTab, rightTab,
  showIso, showGrid, showTexture, showLabels, miniMapVisible,
  // Callbacks
  onSelect, onClearContext, onSetScrub, onJumpCurrent,
  onToggleLayer, onToggleLegend, onToggleLeftRail, onToggleRightRail,
  onSetLeftTab, onSetRightTab, onSelectEntity, onExitFs,
}) => {
  const [tool, setTool]           = _us_ae("select");
  const [flyoutOpen, setFlyout]   = _us_ae(null);
  const [query, setQuery]         = _us_ae("");
  const [routeFrom, setRouteFrom] = _us_ae(null);
  const locById = _um_ae(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);

  // ---- Live tool actions (persist through AtlasService) -------------
  const _aeNotice = (message) => {
    try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_e) {}
  };
  const onMapPoint = async (pct, activeTool) => {
    const B = window.LoomwrightBackend;
    if (!B) return;
    if (activeTool === "addLoc" || activeTool === "label-mark") {
      // If an unplaced location is selected, pin IT here; otherwise
      // create a fresh location at the tapped point and open its editor.
      if (selected && selected.placed === false) {
        await B.AtlasService.placeLocation(selected.id, pct);
        _aeNotice(selected.name + " pinned to the map.");
        return;
      }
      const ent = await B.EntityService.save("locations", {
        name: "New location",
        data: { placed: true, coords: { x: pct.x, y: pct.y }, kind: "city" },
      }, { status: "active" });
      window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "locations", initial: ent, mode: "full" } }));
    }
  };
  const onMovePin = async (locId, pct) => {
    const B = window.LoomwrightBackend;
    if (!B) return;
    await B.AtlasService.updatePlacement(locId, { coords: pct });
  };
  const handleSelect = (loc) => {
    // Two-tap road drawing when the Add Route tool is armed.
    if ((tool === "addRoute" || tool === "path-road" || tool === "path-route" || tool === "path-river") && loc) {
      const B = window.LoomwrightBackend;
      if (!routeFrom) {
        setRouteFrom(loc.id);
        _aeNotice("Route from " + loc.name + " — tap the destination.");
        return;
      }
      if (routeFrom !== loc.id && B) {
        const kind = tool === "path-river" ? "river" : "road";
        B.AtlasService.setRoute(routeFrom, loc.id, kind).then(() => _aeNotice("Connection drawn."));
      }
      setRouteFrom(null);
      return;
    }
    onSelect && onSelect(loc);
  };

  // Build legend chips (shared with side panel format)
  const legendChips = _um_ae(() => ([
    { id: "characters", label: "Characters",  color: "#7a6aa3", count: routes.length },
    { id: "routes",     label: "Routes",      color: "#7a6aa3", count: routes.length },
    { id: "quests",     label: "Quests",      color: "#8a3a4f", count: (window.ATLAS_QUESTS || []).filter((q) => q.type === "quests").length },
    { id: "events",     label: "Events",      color: "#8a3a4f", count: (window.ATLAS_QUESTS || []).filter((q) => q.type === "events").length },
    { id: "beasts",     label: "Beasts",      color: "#8a3a4f", count: beasts.length },
    { id: "items",      label: "Items",       color: "#b78a52", count: items.length },
    { id: "factions",   label: "Factions",    color: "#324a1f", count: factions.length },
    { id: "warnings",   label: "Warnings",    color: "#c98a2c", count: chapters.reduce((a, c) => a + (c.warnings || 0), 0) },
  ]), [routes, beasts, items, factions, chapters]);

  return (
    <div className="atlas-editor" data-ui="AtlasEditor">
      <AtlasEdToolbar
        tool={tool} onPickTool={setTool}
        flyoutOpen={flyoutOpen} onToggleFlyout={(id) => setFlyout(flyoutOpen === id ? null : id)}
        onPickFlyoutTool={(g, t) => { setTool(t); setFlyout(null); }}
        coreTools={window.ATLAS_CORE_TOOLS || []}
        flyoutGroups={window.ATLAS_FLYOUT_GROUPS || []}
        onZoomIn={() => {}} onZoomOut={() => {}} onFitView={() => {}}
        onExitFs={onExitFs}/>

      <div className="atlas-editor__desk">
        <AtlasEdLeftRail
          collapsed={leftRailCollapsed} onToggle={onToggleLeftRail}
          tab={leftTab} onSetTab={onSetLeftTab}
          locations={locations} layers={layers} layerState={layerState}
          cast={cast} selectedId={selected?.id}
          query={query} onSetQuery={setQuery}
          onSelectLoc={onSelect} onSelectEntity={onSelectEntity}
          onToggleLayer={onToggleLayer}/>

        <main className="atlas-editor__canvas">
          <AtlasMap
            locations={locations} routes={routes} beasts={beasts} items={items} factions={factions} chapters={chapters}
            layers={layerState} selectedId={selected?.id}
            context={context} scrubChapter={scrubChapter}
            showLabels={showLabels} showIso={showIso} showGrid={showGrid} showTexture={showTexture}
            variant="editor" onSelect={handleSelect}
            tool={tool} onMapPoint={onMapPoint} onMovePin={onMovePin}/>
          {miniMapVisible && <AtlasMiniMap locations={locations} routes={routes} selectedId={selected?.id} context={context}/>}
          {context && context.source && (
            <div className="atlas-editor__ctxbanner">
              <Icon name="link" size={11}/>
              <span><b>{context.source.panel}</b> → <b>{context.source.label}</b></span>
              <span className="atlas-editor__ctxd">{context.description}</span>
              <button onClick={onClearContext} data-callback="onClearAtlasContext"><Icon name="close" size={9}/></button>
            </div>
          )}
        </main>

        <AtlasEdRightRail
          collapsed={rightRailCollapsed} onToggle={onToggleRightRail}
          tab={rightTab} onSetTab={onSetRightTab}
          selected={selected} locById={locById}
          routes={routes} beasts={beasts} items={items} factions={factions} queue={queue}
          context={context}
          onSelectLoc={onSelect} onSelectEntity={onSelectEntity}/>
      </div>

      <AtlasEdScrubber
        chapters={chapters} currentChapter={currentChapter} scrubChapter={scrubChapter}
        onScrub={onSetScrub} onJumpCurrent={onJumpCurrent}
        routes={routes} locById={locById}
        legendChips={legendChips} activeChips={legendChipsState} onToggleChip={onToggleLegend}/>
    </div>
  );
};

Object.assign(window, { AtlasEditor, AtlasEdToolbar, AtlasEdLeftRail, AtlasEdRightRail, AtlasEdScrubber, AtlasMiniMap });
