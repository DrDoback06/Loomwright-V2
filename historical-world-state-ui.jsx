// =====================================================================
// historical-world-state-ui.jsx — shared projection workspace.
//
// Mounted as an independent overlay host so existing Timeline, Relationships,
// dossiers and panels keep their current implementation. All controls read and
// write through HistoricalWorldStateService and ReviewService.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const worldState = backend?.HistoricalWorldStateService;
  if (!worldState || window.HistoricalWorldStateHost) return;

  const { useState, useEffect, useMemo } = React;
  const CURRENT_ANCHOR = { type: "current", id: "current", label: "Current accepted state" };
  const TYPE_ORDER = ["cast", "locations", "items", "relationships", "quests", "events", "factions", "lore", "bestiary"];

  const display = (value) => {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((row) => typeof row === "object" ? (row.name || row.label || row.type || row.statement || row.id || "Record") : String(row)).join(" · ") || "—";
    return value.name || value.label || value.title || value.status || value.id || JSON.stringify(value);
  };
  const short = (value, max = 150) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  };
  const entityRef = (entity) => entity ? ({ id: entity.id, name: entity.name, type: entity.type || entity.entityType }) : null;
  const anchorFromId = (id, context) => id === "current"
    ? CURRENT_ANCHOR
    : { type: "chapter", id, label: context.chapterById.get(id)?.label || id };

  function useWorldRefresh() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
      const bump = () => setTick((value) => value + 1);
      const names = [
        "lw:historical-world-state-updated", "lw:entity-store-updated", "lw:review-queue-updated",
        "lw:occurrence-store-updated", "lw:manuscript-chapters-updated", "lw:impact-review-updated",
        "lw:narrative-tracking-updated", "lw:project-imported",
      ];
      names.forEach((name) => window.addEventListener(name, bump));
      return () => names.forEach((name) => window.removeEventListener(name, bump));
    }, []);
    return tick;
  }

  function Metric({ value, label }) {
    return <div className="hws-metric"><div className="hws-metric__value">{value}</div><div className="hws-metric__label">{label}</div></div>;
  }

  function StateRows({ entity }) {
    const data = entity.data || {};
    const rows = [
      ["Status", entity.status || data.currentStatus || data.status],
      ["Location", data.currentLocation || data.location],
      ["Owner", data.currentOwner || data.owner],
      ["Condition", data.condition],
      ["Faction", data.faction || data.affiliation],
      ["Knowledge", (data.knowledgeClaims || []).length ? `${data.knowledgeClaims.length} claims` : null],
      ["Beliefs", (data.beliefs || []).length ? `${data.beliefs.length} beliefs` : null],
      ["Markers", (data.markers || data.relationshipMarkers || []).length ? `${(data.markers || data.relationshipMarkers).length} markers` : null],
    ].filter(([, value]) => value != null && value !== "");
    return <div className="hws-state">{rows.map(([key, value]) => <React.Fragment key={key}><div className="hws-state__key">{key}</div><div className="hws-state__value">{display(value)}</div></React.Fragment>)}</div>;
  }

  function SnapshotView({ anchor, branchId, focusEntityId }) {
    const tick = useWorldRefresh();
    const [query, setQuery] = useState("");
    const [type, setType] = useState("all");
    const summary = useMemo(() => {
      void tick;
      return worldState.summary({ anchor, branchId });
    }, [anchor.id, anchor.type, branchId, tick]);
    const snapshot = summary.snapshot;
    const changed = new Set(snapshot.changedEntityIds || []);
    const types = ["all", ...TYPE_ORDER.filter((name) => snapshot.byType[name]?.length), ...Object.keys(snapshot.byType).filter((name) => !TYPE_ORDER.includes(name))];
    const entities = snapshot.entities.filter((entity) => {
      if (type !== "all" && entity.type !== type) return false;
      if (!query.trim()) return true;
      const haystack = `${entity.name} ${entity.type} ${entity.data?.summary || ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    }).sort((a, b) => {
      if (a.id === focusEntityId) return -1;
      if (b.id === focusEntityId) return 1;
      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    });
    return (
      <div data-ui="HistoricalSnapshotView">
        <div className="hws-metrics">
          <Metric value={summary.entityCount} label="Entities at this point"/>
          <Metric value={summary.changedEntityCount} label="Tracked state"/>
          <Metric value={summary.branchChangeCount} label="Branch changes"/>
          <Metric value={snapshot.canonicalDeltas.length} label="Accepted deltas"/>
          <Metric value={snapshot.confidence === "tracked-history" ? "Tracked" : "Partial"} label="History coverage"/>
        </div>
        <div className="hws-toolbar">
          <input className="hws-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an entity in this state…"/>
          <span className="hws-toolbar__spacer"/>
          {types.slice(0, 14).map((name) => <button key={name} className={`hws-chip ${type === name ? "is-active" : ""}`} onClick={() => setType(name)}>{name === "all" ? "All" : (window.ENTITY_TYPES?.[name]?.label || name)}</button>)}
        </div>
        <div className="hws-grid">
          {entities.map((entity) => <div className="hws-card" data-changed={changed.has(entity.id) ? "true" : "false"} key={entity.id} data-testid={`world-state-entity-${entity.id}`}>
            <div className="hws-card__head"><span className="hws-card__glyph">{window.ENTITY_TYPES?.[entity.type]?.glyph || entity.name.slice(0, 1)}</span><span className="hws-card__copy"><span className="hws-card__name">{entity.name}</span><span className="hws-card__type">{entity.type}{changed.has(entity.id) ? " · changed by this point" : ""}</span></span></div>
            <StateRows entity={entity}/>
          </div>)}
        </div>
        {!entities.length && <div className="hws-empty">No entities match this state filter.</div>}
      </div>
    );
  }

  function DeltaRow({ delta, branch = false }) {
    return <div className="hws-delta" data-branch={branch ? "true" : "false"}><span className="hws-delta__kind">{delta.kind || delta.field || "change"}</span><span className="hws-delta__entity">{delta.entityName || delta.entityId}</span><span className="hws-delta__change">{delta.path}: {display(delta.before)} → {display(delta.after)}{delta.sourceQuote ? ` · “${short(delta.sourceQuote, 90)}”` : ""}</span></div>;
  }

  function TimelineView({ anchor, branchId }) {
    const tick = useWorldRefresh();
    const [relationshipId, setRelationshipId] = useState("");
    const rows = useMemo(() => {
      void tick;
      return worldState.timelineProjection({ branchId });
    }, [branchId, tick]);
    const relationshipEntities = useMemo(() => worldState.entitySnapshot().entities.filter((entity) => entity.type === "relationships"), [tick]);
    const trajectory = relationshipId ? worldState.relationshipTrajectory(relationshipId, { anchor }) : null;
    return (
      <div data-ui="HistoricalTimelineView">
        <div className="hws-toolbar">
          <span style={{ color: "var(--ink-4)", font: "700 8px/1 var(--font-sans)", textTransform: "uppercase" }}>Relationship trajectory</span>
          <select className="hws-select" value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)} aria-label="Relationship trajectory"><option value="">Choose a relationship…</option>{relationshipEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select>
          <span className="hws-toolbar__spacer"/>
          <span className="hws-chip is-active">Canonical + {branchId === "canonical" ? "no branch" : "selected branch"}</span>
        </div>
        <div className="hws-timeline">
          {rows.map((row) => {
            const total = row.deltas.length + row.branchDeltas.length + row.events.length;
            if (!total && row.id === "unplaced") return null;
            return <div className="hws-time" key={row.id} data-testid={`world-timeline-${row.id}`}><div><div className="hws-time__anchor">{row.label}</div><div className="hws-time__meta">{row.deltas.length} accepted · {row.branchDeltas.length} branch · {row.events.length} events</div></div><div className="hws-time__rows">{row.events.map((event) => <div className="hws-delta" key={`event-${event.id}`}><span className="hws-delta__kind">event</span><span className="hws-delta__entity">{event.label}</span><span className="hws-delta__change">Canonical event marker</span></div>)}{row.deltas.map((delta) => <DeltaRow key={delta.id} delta={delta}/>)}{row.branchDeltas.map((delta) => <DeltaRow key={delta.id} delta={delta} branch/>)}</div></div>;
          })}
        </div>
        {trajectory && <div className="hws-trajectory"><div className="hws-trajectory__title">Relationship markers through the selected point</div>{trajectory.rows.map((row) => <div className="hws-trajectory__row" key={row.id} style={{ opacity: row.chapterIndex > trajectory.cutoff ? .4 : 1 }}><span>{row.chapterLabel}</span><span>{row.type}{row.value != null ? ` · ${row.value}` : ""}</span><span>{row.polarity || "neutral"}{row.sourceQuote ? ` — “${short(row.sourceQuote, 110)}”` : ""}</span></div>)}</div>}
      </div>
    );
  }

  function ChangeEditor({ branch, anchor, onAdded }) {
    const tick = useWorldRefresh();
    const entities = useMemo(() => worldState.entitySnapshot().entities.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)), [tick]);
    const [entityId, setEntityId] = useState("");
    const [path, setPath] = useState("data.currentOwner");
    const [value, setValue] = useState("");
    const entity = entities.find((row) => row.id === entityId) || null;
    const referenceType = path === "data.currentOwner" ? "cast" : path === "data.currentLocation" ? "locations" : path === "data.faction" ? "factions" : null;
    const referenceOptions = referenceType ? entities.filter((row) => row.type === referenceType) : [];
    const add = async () => {
      if (!entity || !value) return;
      const after = referenceType ? entityRef(referenceOptions.find((row) => row.id === value)) : value;
      await worldState.addBranchDelta({
        branchId: branch.id,
        entityId: entity.id,
        entityType: entity.type,
        path,
        after,
        anchor,
        kind: path.replace(/^data\./, "alternative-"),
        relatedEntityIds: referenceType ? [value] : [],
      });
      setValue("");
      onAdded?.();
    };
    return <div className="hws-form">
      <label className="hws-label">Entity<select className="hws-select" value={entityId} onChange={(event) => setEntityId(event.target.value)} data-testid="branch-change-entity"><option value="">Choose entity…</option>{entities.map((row) => <option key={row.id} value={row.id}>{window.ENTITY_TYPES?.[row.type]?.singular || row.type}: {row.name}</option>)}</select></label>
      <label className="hws-label">State field<select className="hws-select" value={path} onChange={(event) => { setPath(event.target.value); setValue(""); }} data-testid="branch-change-path"><option value="data.currentOwner">Current owner</option><option value="data.currentLocation">Current location</option><option value="data.condition">Condition</option><option value="data.currentStatus">Status</option><option value="data.faction">Faction</option><option value="data.unresolved">Unresolved state</option></select></label>
      <label className="hws-label hws-form__wide">Alternative value{referenceType ? <select className="hws-select" value={value} onChange={(event) => setValue(event.target.value)} data-testid="branch-change-value"><option value="">Choose {referenceType}…</option>{referenceOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : <input className="hws-input" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter the alternative state" data-testid="branch-change-value"/>}</label>
      <div className="hws-form__wide" style={{ display: "flex", justifyContent: "flex-end" }}><button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={add} disabled={!entityId || !value} data-testid="branch-add-change">Add sandbox change</button></div>
    </div>;
  }

  function BranchesView({ anchor, selectedBranchId, onSelectBranch }) {
    const tick = useWorldRefresh();
    const [createName, setCreateName] = useState("");
    const [createDescription, setCreateDescription] = useState("");
    const store = useMemo(() => {
      void tick;
      return worldState.loadStoreSync();
    }, [tick]);
    const branch = store.branches.find((row) => row.id === selectedBranchId) || store.branches[0] || null;
    const deltas = branch ? store.deltas.filter((delta) => delta.branchId === branch.id) : [];
    const diff = branch ? worldState.diffSnapshots({ anchor, branchId: "canonical" }, { anchor, branchId: branch.id }) : null;
    const create = async () => {
      const next = await worldState.createBranch({ name: createName || undefined, description: createDescription, fromAnchor: anchor, parentBranchId: selectedBranchId !== "canonical" ? selectedBranchId : "canonical" });
      setCreateName(""); setCreateDescription(""); onSelectBranch(next.id);
    };
    const commit = async () => {
      const ids = await worldState.commitBranchToReview(branch.id);
      window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: `${ids.length} branch proposal${ids.length === 1 ? "" : "s"} added to Impact Review.` } }));
    };
    const discard = async () => {
      if (typeof window.confirm === "function" && !window.confirm(`Discard ${branch.name} and all of its sandbox changes?`)) return;
      await worldState.discardBranch(branch.id);
      onSelectBranch("canonical");
    };
    return <div className="hws-branches" data-ui="HistoricalBranchesView">
      <aside className="hws-branch-list"><div className="hws-section-head"><span className="hws-section-title">Alternative branches</span><span className="hws-chip">{store.branches.length}</span></div>{store.branches.map((row) => <button className={`hws-branch ${branch?.id === row.id ? "is-active" : ""}`} key={row.id} onClick={() => onSelectBranch(row.id)} data-testid={`world-branch-${row.id}`}><div className="hws-branch__name">{row.name}</div><div className="hws-branch__meta">{row.status} · forked {row.forkAnchor?.label || row.forkAnchor?.id || "current"}{row.parentBranchId !== "canonical" ? " · child branch" : ""}</div></button>)}<div style={{ marginTop: 12 }}><div className="hws-section-title" style={{ marginBottom: 7 }}>Create from selected state</div><label className="hws-label">Name<input className="hws-input" value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Alternative ending…" data-testid="branch-create-name"/></label><label className="hws-label" style={{ marginTop: 7 }}>Purpose<textarea className="hws-textarea" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="What are you testing?"/></label><button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={create} style={{ marginTop: 7 }} data-testid="branch-create">Create branch</button></div></aside>
      <section className="hws-branch-work">{branch ? <><div className="hws-section-head"><span className="hws-section-title">{branch.name}</span><span className="hws-chip is-active">{branch.status}</span></div><div style={{ color: "var(--ink-3)", font: "11px/1.4 var(--font-serif)", marginBottom: 9 }}>{branch.description || "No branch description yet."}</div><ChangeEditor branch={branch} anchor={anchor}/><div className="hws-delta-list">{deltas.map((delta) => <div className="hws-delta-edit" key={delta.id} data-testid={`branch-delta-${delta.id}`}><span><strong>{delta.entityName}</strong><br/><small>{delta.path}</small></span><span>{display(delta.before)} → {display(delta.after)}</span><button className="rpg-btn rpg-btn--small" onClick={() => worldState.removeBranchDelta(delta.id)}>Remove</button></div>)}{!deltas.length && <div className="hws-empty">This branch is clean. Add a state change to play out an alternative.</div>}</div>{diff && <div className="hws-diff"><div className="hws-section-head"><span className="hws-section-title">Canonical vs branch</span><span className="hws-chip">{diff.changedEntityCount} entities · {diff.changedFieldCount} fields</span></div>{diff.rows.map((row) => <div className="hws-diff__entity" key={row.entityId}><div className="hws-diff__name">{row.entityName}</div><div className="hws-diff__rows">{row.changes.map((change) => <div className="hws-diff__row" key={change.field}><span>{change.field}</span><span>{display(change.before)}</span><span>→</span><span>{display(change.after)}</span></div>)}</div></div>)}</div>}<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={commit} disabled={!deltas.length} data-testid="branch-commit">Send branch to Impact Review</button><button className="rpg-btn rpg-btn--small" onClick={discard} data-testid="branch-discard">Discard branch</button></div></> : <div className="hws-empty">Create a branch to test an alternative timeline without changing canon.</div>}</section>
    </div>;
  }

  function RetconView({ anchor, branchId, focusEntityId }) {
    const tick = useWorldRefresh();
    const entities = useMemo(() => worldState.entitySnapshot().entities.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)), [tick]);
    const [entityId, setEntityId] = useState(focusEntityId || "");
    const [path, setPath] = useState("data.currentOwner");
    const [value, setValue] = useState("");
    const [impact, setImpact] = useState(null);
    const referenceType = path === "data.currentOwner" ? "cast" : path === "data.currentLocation" ? "locations" : path === "data.faction" ? "factions" : null;
    const references = referenceType ? entities.filter((row) => row.type === referenceType) : [];
    const after = referenceType ? entityRef(references.find((row) => row.id === value)) : value;
    const analyse = () => setImpact(worldState.retconImpact({ entityId, path, anchor, after, branchId }));
    const propose = async () => {
      const result = await worldState.proposeRetcon({ entityId, path, anchor, after, branchId });
      setImpact(result.impact);
      window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Retcon added to Impact Review with its downstream evidence." } }));
    };
    return <div className="hws-retcon" data-ui="HistoricalRetconView"><section className="hws-retcon__form"><div className="hws-section-head"><span className="hws-section-title">Test a historical change</span></div><div className="hws-form"><label className="hws-label hws-form__wide">Entity<select className="hws-select" value={entityId} onChange={(event) => { setEntityId(event.target.value); setImpact(null); }} data-testid="retcon-entity"><option value="">Choose entity…</option>{entities.map((row) => <option key={row.id} value={row.id}>{window.ENTITY_TYPES?.[row.type]?.singular || row.type}: {row.name}</option>)}</select></label><label className="hws-label hws-form__wide">State field<select className="hws-select" value={path} onChange={(event) => { setPath(event.target.value); setValue(""); setImpact(null); }} data-testid="retcon-path"><option value="data.currentOwner">Current owner</option><option value="data.currentLocation">Current location</option><option value="data.condition">Condition</option><option value="data.currentStatus">Status</option><option value="data.faction">Faction</option></select></label><label className="hws-label hws-form__wide">Proposed historical value{referenceType ? <select className="hws-select" value={value} onChange={(event) => setValue(event.target.value)} data-testid="retcon-value"><option value="">Choose {referenceType}…</option>{references.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : <input className="hws-input" value={value} onChange={(event) => setValue(event.target.value)} data-testid="retcon-value" placeholder="New historical state"/>}</label></div><button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={analyse} disabled={!entityId || !value} style={{ marginTop: 9 }} data-testid="retcon-analyse">Analyse knock-on effects</button></section><section className="hws-retcon__impact">{impact ? <><div className="hws-impact-head"><span className="hws-section-title">Retcon impact</span><span className="hws-impact-level" data-level={impact.severity}>{impact.severity}</span></div><div className="hws-impact-grid"><div className="hws-impact-box"><div className="hws-impact-box__value">{impact.affectedEntityIds.length}</div><div className="hws-impact-box__label">Affected entities</div></div><div className="hws-impact-box"><div className="hws-impact-box__value">{impact.chapterIds.length}</div><div className="hws-impact-box__label">Later chapters</div></div><div className="hws-impact-box"><div className="hws-impact-box__value">{impact.laterDeltas.length}</div><div className="hws-impact-box__label">Dependent state changes</div></div></div><ul className="hws-impact-reasons">{impact.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul><div className="hws-impact-links">{impact.affectedEntities.slice(0, 12).map((row) => <span className="hws-impact-link" key={row.id}>{row.name}</span>)}</div><div className="hws-impact-links">{impact.chapters.map((chapter) => <span className="hws-impact-link" key={chapter.id}>{chapter.label}</span>)}</div><button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={propose} style={{ marginTop: 10 }} data-testid="retcon-propose">Send retcon to Impact Review</button></> : <div className="hws-empty">Choose a historical change. Loomwright will trace later state, manuscript references, review decisions and linked entities before anything can alter canon.</div>}</section></div>;
  }

  function HistoricalWorldStateWorkspace({ initial = {}, onClose }) {
    const refresh = useWorldRefresh();
    const context = useMemo(() => worldState.chapterContext(), [refresh]);
    const store = useMemo(() => worldState.loadStoreSync(), [refresh]);
    const [tab, setTab] = useState(initial.tab || "snapshot");
    const [anchorId, setAnchorId] = useState(initial.anchorId || initial.chapterId || "current");
    const [branchId, setBranchId] = useState(initial.branchId || "canonical");
    const anchor = anchorFromId(anchorId, context);
    const tabs = [["snapshot", "Snapshot"], ["timeline", "Timeline"], ["branches", `Branches ${store.branches.length}`], ["retcon", "Retcon impact"]];
    return <div className="hws-backdrop" role="dialog" aria-modal="true" data-ui="HistoricalWorldStateWorkspace" data-testid="historical-world-state"><div className="hws"><header className="hws__head"><div className="hws__head-copy"><div className="hws__eyebrow">Historical world state</div><div className="hws__title">What was true here?</div><div className="hws__sub">Reconstruct accepted state by chapter, test alternative branches without touching canon, and preview every retcon’s downstream spiderweb before review.</div></div><div className="hws__controls"><select className="hws-select" value={anchorId} onChange={(event) => setAnchorId(event.target.value)} aria-label="World state point" data-testid="world-anchor"><option value="current">Current accepted state</option>{context.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}</select><select className="hws-select" value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="World state branch" data-testid="world-branch-select"><option value="canonical">Canonical timeline</option>{store.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><button className="rpg-btn rpg-btn--small" onClick={onClose}>Close</button></div></header><nav className="hws__tabs">{tabs.map(([id, label]) => <button key={id} className={`hws__tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)} data-testid={`world-tab-${id}`}>{label}</button>)}</nav><main className="hws__body">{tab === "snapshot" && <SnapshotView anchor={anchor} branchId={branchId} focusEntityId={initial.entityId}/>} {tab === "timeline" && <TimelineView anchor={anchor} branchId={branchId}/>} {tab === "branches" && <BranchesView anchor={anchor} selectedBranchId={branchId} onSelectBranch={setBranchId}/>} {tab === "retcon" && <RetconView anchor={anchor} branchId={branchId} focusEntityId={initial.entityId}/>}</main><footer className="hws__foot"><span className="hws__foot-note">Canonical state is read-only here. Branch commits and retcons always enter Impact Review with evidence and safe reversion.</span><span className="hws-chip is-active">{anchor.label}</span><span className="hws-chip">{branchId === "canonical" ? "Canonical" : store.branches.find((branch) => branch.id === branchId)?.name || "Branch"}</span></footer></div></div>;
  }

  function HistoricalWorldStateHost() {
    const [open, setOpen] = useState(false);
    const [initial, setInitial] = useState({});
    useEffect(() => {
      const launch = (event) => { setInitial(event.detail || {}); setOpen(true); };
      window.addEventListener("lw:open-world-state", launch);
      return () => window.removeEventListener("lw:open-world-state", launch);
    }, []);
    return <><button className="hws-launcher" onClick={() => { setInitial({}); setOpen(true); }} data-testid="world-state-launcher"><span className="hws-launcher__pulse"/>World state</button>{open && <HistoricalWorldStateWorkspace initial={initial} onClose={() => setOpen(false)}/>}</>;
  }

  window.openHistoricalWorldState = (detail = {}) => window.dispatchEvent(new CustomEvent("lw:open-world-state", { detail }));
  window.HistoricalWorldStateHost = HistoricalWorldStateHost;
  window.HistoricalWorldStateWorkspace = HistoricalWorldStateWorkspace;

  // Add a contextual launch button to the shared dossier without replacing it.
  if (typeof LiveEntityDossier !== "undefined") {
    const BaseLiveEntityDossierForWorldState = LiveEntityDossier;
    LiveEntityDossier = function WorldStateEnabledDossier(props) {
      const entityId = props.entity?.id;
      return <div data-ui="WorldStateEnabledDossier"><div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}><button className="rpg-btn rpg-btn--small" onClick={() => window.openHistoricalWorldState({ entityId, tab: "snapshot" })} data-testid="dossier-world-state"><Icon name="clock" size={10}/> World state</button></div><BaseLiveEntityDossierForWorldState {...props}/></div>;
    };
    window.LiveEntityDossier = LiveEntityDossier;
  }

  const mount = () => {
    if (document.getElementById("historical-world-state-host")) return;
    const node = document.createElement("div");
    node.id = "historical-world-state-host";
    document.body.appendChild(node);
    ReactDOM.createRoot(node).render(<HistoricalWorldStateHost/>);
  };
  if (document.body) mount();
  else window.addEventListener("DOMContentLoaded", mount, { once: true });
})();
