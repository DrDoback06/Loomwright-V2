// =====================================================================
// live-atlas-ui.jsx — rendered canonical Atlas workspace.
//
// Replaces the legacy sample Atlas body at the DOM boundary while preserving
// the existing docked-panel shell, header actions and application routing.
// =====================================================================

(function () {
  const service = window.LoomwrightBackend?.LiveAtlasService;
  if (!service || window.__LW_LIVE_ATLAS_UI__) return;
  window.__LW_LIVE_ATLAS_UI__ = true;

  const { useState, useEffect, useMemo, useCallback } = React;

  function useAtlasWorkspace(options) {
    const [workspace, setWorkspace] = useState(() => service.buildWorkspace(options));
    const refresh = useCallback(() => setWorkspace(service.buildWorkspace(options)), [options.anchorId, options.branchId, options.mapId]);
    useEffect(() => {
      refresh();
      const events = [
        "lw:live-atlas-updated", "lw:entity-store-updated", "lw:manuscript-chapters-updated",
        "lw:review-queue-updated", "lw:project-imported", "lw:historical-world-state-updated",
        "lw:historical-world-state-ready", "lw:backend-ready",
      ];
      events.forEach((name) => window.addEventListener(name, refresh));
      return () => events.forEach((name) => window.removeEventListener(name, refresh));
    }, [refresh]);
    return [workspace, refresh];
  }

  function AtlasPin({ location, selected, onSelect }) {
    return (
      <button
        type="button"
        className={`la-pin ${selected ? "is-selected" : ""}`}
        style={{ left: `${location.x}%`, top: `${location.y}%` }}
        data-testid={`live-atlas-pin-${location.id}`}
        onClick={(event) => { event.stopPropagation(); onSelect(location.id); }}
        title={location.name}
      >
        <span className="la-pin__dot"/>
        <span className="la-pin__label">{location.name}</span>
      </button>
    );
  }

  function PositionMarker({ position }) {
    return (
      <button
        type="button"
        className={`la-position la-position--${position.type}`}
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
        data-testid={`live-atlas-position-${position.id}`}
        title={`${position.name} · ${position.locationName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {String(position.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
      </button>
    );
  }

  function RouteLayer({ routes }) {
    const visible = routes.filter((route) => route.waypoints.length >= 2);
    return (
      <svg className="la-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Travel routes">
        {visible.map((route, index) => (
          <g key={route.id} data-testid={`live-atlas-route-${route.entityId}`}>
            <polyline
              points={route.waypoints.map((point) => `${point.x},${point.y}`).join(" ")}
              className={`la-route la-route--${index % 4}`}
              vectorEffect="non-scaling-stroke"
            />
            {route.waypoints.map((point, pointIndex) => (
              <circle key={`${route.id}-${pointIndex}`} cx={point.x} cy={point.y} r="0.8" className={`la-route-point la-route-point--${index % 4}`} vectorEffect="non-scaling-stroke"/>
            ))}
          </g>
        ))}
      </svg>
    );
  }

  function EmptyAtlas({ onCreateLocation }) {
    return (
      <div className="la-empty" data-testid="live-atlas-empty">
        <div className="la-empty__glyph">⌖</div>
        <h2>No locations yet</h2>
        <p>Create or extract a location and it will enter the Atlas staging tray. Nothing is substituted with sample geography.</p>
        <button type="button" onClick={onCreateLocation}>Create location</button>
      </div>
    );
  }

  function MapCreation({ workspace, onClose, onCreated }) {
    const [name, setName] = useState("");
    const [type, setType] = useState("region");
    const [parentMapId, setParentMapId] = useState(workspace.activeMap?.id || "");
    const [locationId, setLocationId] = useState("");
    const create = async () => {
      if (!name.trim()) return;
      const map = await service.createMap({ name: name.trim(), type, parentMapId: parentMapId || null, locationId: locationId || null });
      onCreated(map.id);
    };
    return (
      <div className="la-modal" data-testid="live-atlas-map-dialog" role="dialog" aria-modal="true">
        <div className="la-modal__card">
          <header><div><span>Nested cartography</span><h2>Create map</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
          <label>Map name<input data-testid="live-atlas-map-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Lantern Court" autoFocus/></label>
          <label>Map type<select value={type} onChange={(event) => setType(event.target.value)}><option value="world">World</option><option value="continent">Continent</option><option value="region">Region</option><option value="settlement">Settlement</option><option value="building">Building</option><option value="room">Room</option><option value="dungeon">Dungeon</option><option value="diagram">Diagram</option></select></label>
          <label>Parent map<select value={parentMapId} onChange={(event) => setParentMapId(event.target.value)}><option value="">None</option>{workspace.maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
          <label>Represented location<select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">No linked location</option>{workspace.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="is-primary" data-testid="live-atlas-map-create" onClick={create}>Create map</button></footer>
        </div>
      </div>
    );
  }

  function LiveAtlasWorkspace() {
    const initial = service.loadStateSync();
    const [mapId, setMapId] = useState(initial.activeMapId);
    const [anchorId, setAnchorId] = useState("current");
    const [branchId, setBranchId] = useState("canonical");
    const [selectedId, setSelectedId] = useState(null);
    const [pendingLocationId, setPendingLocationId] = useState(null);
    const [query, setQuery] = useState("");
    const [showRoutes, setShowRoutes] = useState(true);
    const [showPositions, setShowPositions] = useState(true);
    const [fullScreen, setFullScreen] = useState(false);
    const [mapDialog, setMapDialog] = useState(false);
    const [workspace, refresh] = useAtlasWorkspace({ mapId, anchorId, branchId });

    useEffect(() => {
      if (!workspace.maps.some((map) => map.id === mapId)) setMapId(workspace.activeMap?.id || workspace.maps[0]?.id);
    }, [workspace.maps, workspace.activeMap?.id, mapId]);

    useEffect(() => {
      const open = (event) => {
        const detail = event?.detail || {};
        if (detail.panelKind === "atlas" || detail.workspaceId === "atlas-editor") setFullScreen(true);
      };
      window.addEventListener("lw:open-existing-fullscreen", open);
      window.addEventListener("lw:open-panel-workspace", open);
      return () => {
        window.removeEventListener("lw:open-existing-fullscreen", open);
        window.removeEventListener("lw:open-panel-workspace", open);
      };
    }, []);

    const selected = selectedId ? workspace.locationById.get(selectedId) : null;
    const filteredLocations = useMemo(() => {
      const needle = query.trim().toLowerCase();
      if (!needle) return workspace.locations;
      return workspace.locations.filter((location) => `${location.name} ${location.type} ${location.summary}`.toLowerCase().includes(needle));
    }, [workspace.locations, query]);

    const changeMap = async (nextMapId) => {
      setMapId(nextMapId);
      await service.setActiveMap(nextMapId);
    };
    const autoPlace = async () => {
      await service.autoPlace(workspace.stagedLocations.map((location) => location.id), workspace.activeMap.id);
      setPendingLocationId(null);
      refresh();
    };
    const clickMap = async (event) => {
      if (!pendingLocationId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      await service.setPlacement(pendingLocationId, { mapId: workspace.activeMap.id, x, y, source: "canvas" });
      setSelectedId(pendingLocationId);
      setPendingLocationId(null);
      refresh();
    };
    const moveSelected = () => {
      if (!selected) return;
      setPendingLocationId(selected.id);
    };
    const unplaceSelected = async () => {
      if (!selected) return;
      await service.removePlacement(selected.id);
      setSelectedId(null);
      refresh();
    };
    const createLocation = () => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "locations", mode: "full", sourcePanel: "p-atlas" } }));

    const content = (
      <div className={`live-atlas ${fullScreen ? "is-fullscreen" : ""}`} data-ui="LiveAtlasWorkspace" data-testid="live-atlas-workspace">
        <header className="la-header">
          <div className="la-header__identity">
            <span className="la-eyebrow">Canonical world geography</span>
            <h1>{workspace.activeMap?.name || "Atlas"}</h1>
            <p>{workspace.anchor.label}{branchId !== "canonical" ? ` · ${workspace.branches.find((branch) => branch.id === branchId)?.name || "Branch"}` : ""}</p>
          </div>
          <div className="la-header__actions">
            <button type="button" onClick={() => setMapDialog(true)}>New map</button>
            <button type="button" onClick={() => setFullScreen((value) => !value)} data-testid="live-atlas-fullscreen">{fullScreen ? "Exit workspace" : "Open workspace"}</button>
          </div>
        </header>

        <div className="la-toolbar" role="toolbar" aria-label="Atlas view controls">
          <label>Map<select data-testid="live-atlas-map-select" value={workspace.activeMap?.id || mapId} onChange={(event) => changeMap(event.target.value)}>{workspace.maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
          <label>Story point<select data-testid="live-atlas-anchor-select" value={anchorId} onChange={(event) => setAnchorId(event.target.value)}><option value="current">Current accepted state</option>{workspace.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}</select></label>
          <label>Timeline<select data-testid="live-atlas-branch-select" value={branchId} onChange={(event) => setBranchId(event.target.value)}>{workspace.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="la-toggle"><input type="checkbox" checked={showRoutes} onChange={(event) => setShowRoutes(event.target.checked)}/> Travel routes</label>
          <label className="la-toggle"><input type="checkbox" checked={showPositions} onChange={(event) => setShowPositions(event.target.checked)}/> Entity positions</label>
        </div>

        <div className="la-summary" data-testid="live-atlas-summary">
          <span><b>{workspace.summary.locationCount}</b> locations</span>
          <span><b>{workspace.summary.placedCount}</b> placed here</span>
          <span><b>{workspace.summary.stagedCount}</b> staging</span>
          <span><b>{workspace.summary.routeCount}</b> routes</span>
          <span><b>{workspace.summary.positionCount}</b> positioned entities</span>
          {workspace.summary.reviewCount ? <span className="is-review"><b>{workspace.summary.reviewCount}</b> review candidates</span> : null}
        </div>

        {!workspace.locations.length ? <EmptyAtlas onCreateLocation={createLocation}/> : (
          <div className="la-layout">
            <aside className="la-rail la-rail--left">
              <section>
                <div className="la-section-head"><div><span>Location registry</span><h2>Canonical places</h2></div><button type="button" onClick={createLocation}>+</button></div>
                <input className="la-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations…" aria-label="Search locations"/>
                <div className="la-list" data-testid="live-atlas-location-list">
                  {filteredLocations.map((location) => (
                    <button type="button" key={location.id} className={`la-location-row ${selectedId === location.id ? "is-selected" : ""}`} onClick={() => setSelectedId(location.id)} data-testid={`live-atlas-location-${location.id}`}>
                      <span className={`la-location-row__state ${location.placed ? "is-placed" : "is-staged"}`}/>
                      <span><b>{location.name}</b><small>{location.type}{location.parentLocationId ? " · nested" : ""}</small></span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="la-staging" data-testid="live-atlas-staging">
                <div className="la-section-head"><div><span>Automatic staging tray</span><h2>Unplaced locations</h2></div>{workspace.stagedLocations.length ? <button type="button" data-testid="live-atlas-auto-place" onClick={autoPlace}>Auto-place</button> : null}</div>
                {!workspace.stagedLocations.length ? <p className="la-muted">Every canonical location has a map placement.</p> : workspace.stagedLocations.map((location) => (
                  <button type="button" key={location.id} className={`la-stage-card ${pendingLocationId === location.id ? "is-pending" : ""}`} onClick={() => setPendingLocationId(location.id)} data-testid={`live-atlas-stage-${location.id}`}>
                    <b>{location.name}</b><span>{pendingLocationId === location.id ? "Click the map to place" : "Select to place"}</span>
                  </button>
                ))}
                {workspace.pendingUnplacedReviews.map((candidate) => (
                  <button type="button" key={candidate.id} className="la-stage-card is-review" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-review-item", { detail: { id: candidate.id } }))}>
                    <b>{candidate.name}</b><span>Pending Impact Review</span>
                  </button>
                ))}
              </section>
            </aside>

            <main className={`la-map ${pendingLocationId ? "is-placing" : ""}`} data-testid="live-atlas-canvas" onClick={clickMap} aria-label={`Map canvas: ${workspace.activeMap.name}`}>
              <div className="la-map__grid"/>
              {showRoutes ? <RouteLayer routes={workspace.routes}/> : null}
              {workspace.placedLocations.map((location) => <AtlasPin key={location.id} location={location} selected={selectedId === location.id} onSelect={setSelectedId}/>)}
              {showPositions ? workspace.positions.map((position) => <PositionMarker key={`${position.type}-${position.id}`} position={position}/>) : null}
              {pendingLocationId ? <div className="la-placement-hint">Click anywhere to place {workspace.locationById.get(pendingLocationId)?.name || "location"}</div> : null}
              {!workspace.placedLocations.length && !pendingLocationId ? <div className="la-map-empty"><b>This map is empty</b><span>Choose a staged location, then click the canvas—or use Auto-place.</span></div> : null}
            </main>

            <aside className="la-rail la-rail--right">
              <section>
                <div className="la-section-head"><div><span>Inspector</span><h2>{selected ? selected.name : "Select a location"}</h2></div></div>
                {!selected ? <p className="la-muted">Choose a pin or registry entry to inspect canonical details and cartography.</p> : (
                  <div className="la-inspector" data-testid={`live-atlas-inspector-${selected.id}`}>
                    <div className="la-badges"><span>{selected.type}</span><span>{selected.status}</span>{selected.placement ? <span>{selected.placement.x.toFixed(1)}, {selected.placement.y.toFixed(1)}</span> : <span>Unplaced</span>}</div>
                    <p>{selected.summary || "No summary has been recorded yet."}</p>
                    <dl><dt>Parent</dt><dd>{selected.parentLocationId ? workspace.locationById.get(selected.parentLocationId)?.name || selected.parentLocationId : "None"}</dd><dt>Map</dt><dd>{selected.placement ? workspace.maps.find((map) => map.id === selected.placement.mapId)?.name || selected.placement.mapId : "Staging tray"}</dd></dl>
                    <div className="la-inspector__actions">
                      <button type="button" data-testid="live-atlas-move-selected" onClick={moveSelected}>{selected.placement ? "Move pin" : "Place pin"}</button>
                      {selected.placement ? <button type="button" data-testid="live-atlas-unplace-selected" onClick={unplaceSelected}>Return to staging</button> : null}
                      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-dossier", { detail: { id: selected.id, type: "locations" } }))}>Open dossier</button>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="la-section-head"><div><span>State at selected point</span><h2>Who and what is here</h2></div></div>
                {!workspace.positions.length ? <p className="la-muted">No tracked entities have a placed location at this story point.</p> : (
                  <div className="la-position-list" data-testid="live-atlas-position-list">{workspace.positions.map((position) => <div key={`${position.type}-${position.id}`}><span>{position.type}</span><b>{position.name}</b><small>{position.locationName}</small></div>)}</div>
                )}
              </section>

              <section>
                <div className="la-section-head"><div><span>Travel projection</span><h2>Routes through this map</h2></div></div>
                {!workspace.routes.some((route) => route.waypoints.length >= 2) ? <p className="la-muted">No multi-stop route is visible at this story point.</p> : workspace.routes.filter((route) => route.waypoints.length >= 2).map((route) => (
                  <div className="la-route-card" key={route.id} data-testid={`live-atlas-route-card-${route.entityId}`}><b>{route.name}</b><span>{route.waypoints.map((point) => point.locationName).join(" → ")}</span></div>
                ))}
              </section>
            </aside>
          </div>
        )}

        {mapDialog ? <MapCreation workspace={workspace} onClose={() => setMapDialog(false)} onCreated={(id) => { setMapDialog(false); setMapId(id); refresh(); }}/> : null}
      </div>
    );

    return fullScreen ? ReactDOM.createPortal(content, document.body) : content;
  }

  function mountAtlasHost(host) {
    if (!host || host.dataset.liveAtlasMounted) return;
    host.dataset.liveAtlasMounted = "true";
    Array.from(host.children).forEach((child) => {
      child.dataset.liveAtlasLegacy = "true";
      child.hidden = true;
      child.setAttribute("aria-hidden", "true");
    });
    const mount = document.createElement("div");
    mount.className = "live-atlas-mount";
    mount.setAttribute("data-ui", "LiveAtlasMount");
    host.appendChild(mount);
    ReactDOM.createRoot(mount).render(<LiveAtlasWorkspace/>);
  }

  function bindAll(root = document) {
    const hosts = [];
    if (root.matches?.("[data-ui='AtlasPanelBody'], .atlas-host")) hosts.push(root);
    root.querySelectorAll?.("[data-ui='AtlasPanelBody'], .atlas-host").forEach((host) => hosts.push(host));
    document.querySelectorAll("[data-ui='AtlasPanelBody'], .atlas-host").forEach((host) => hosts.push(host));
    [...new Set(hosts)].forEach(mountAtlasHost);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes?.forEach((node) => { if (node.nodeType === 1) bindAll(node); }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("lw:open-panel", () => setTimeout(() => bindAll(document), 0));
  window.addEventListener("lw:backend-ready", () => setTimeout(() => bindAll(document), 0));
  bindAll(document);
})();
