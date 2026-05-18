// =====================================================================
// panel-stack.jsx — Concept A: Pinned Anchor + Stacked Column
//
// Layout (from Writer's Room outward):
//
//   [ Writer's Room ]  [ pinned panels (anchor zone) ]  [ unpinned stack ]  [ collapsed rail ]
//
// Behavior:
//   - Pinned panels dock immediately right of the manuscript so the
//     writer's reference material stays closest to where they're writing.
//   - Unpinned panels stack to the right of pinned, in order of opening
//     (newest on top / right-most).
//   - Visible cap: MAX_VISIBLE_UNPINNED. Oldest-opened unpinned panel
//     collapses to a vertical tab in the right-edge rail when the cap is
//     exceeded. Clicking a collapsed tab restores it to the stack.
//   - Pinned panels never collapse and never count against the cap.
//   - Cross-panel filter: when a panel emits a focused entity, every
//     other open panel shows a filter chip in its header indicating
//     "Filtered by <Entity>". Per-type focus is preserved so users can
//     focus a Cast member AND a Location simultaneously.
//
// Panel header controls (Concept A — minimal):
//   - Pin / Unpin
//   - Expand width
//   - Close
//   - (Full-screen kept only for canvas-style panels: atlas, skillTrees,
//     tangle — toggled via context menu, not a header button.)
// =====================================================================

const { useState: _ps_us, useCallback: _ps_uc, useRef: _ps_ur, useEffect: _ps_ue, useMemo: _ps_um } = React;

const MAX_VISIBLE_UNPINNED = 4;

// ---------------------------------------------------------------------
// FilterChip — shown in panel header when this panel is being filtered
// by another panel's focused entity (cross-panel focus propagation).
// ---------------------------------------------------------------------
const PanelFilterChip = ({ focus, onClear }) => {
  if (!focus) return null;
  const t = ENTITY_TYPES[focus.type];
  return (
    <button
      className="pstk__filter-chip"
      title={"Filtered by " + focus.label + ". Click to clear."}
      onClick={(e) => { e.stopPropagation(); onClear && onClear(); }}
      style={t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {}}
      data-callback="onClearPanelFilter"
    >
      <span className="pstk__filter-chip__dot"/>
      <span className="pstk__filter-chip__lbl">Filtered by {focus.label}</span>
      <Icon name="close" size={9}/>
    </button>
  );
};

// ---------------------------------------------------------------------
// PanelChrome — header. Pin / Expand / Close. (No dock/float/full-screen.)
// Also renders the standardised PanelHeaderActions (+ Create / Open Workspace).
// ---------------------------------------------------------------------
const PanelChrome = ({
  panel, isFront, panelFilter,
  onPinPanel, onExpandPanel, onClosePanel, onBringPanelToFront, onClearPanelFilter,
}) => {
  const t = panel.entityType ? ENTITY_TYPES[panel.entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};
  // Resolve standardised access (+ Create / Open Workspace labels).
  const access = (typeof resolveAccess !== "undefined") ? resolveAccess(panel) : null;
  return (
    <div
      className="pstk__head"
      data-ui="PanelHeader"
      style={style}
      onMouseDown={() => onBringPanelToFront && onBringPanelToFront(panel.id)}
    >
      <div className="pstk__head__entity">
        <div className="pstk__head__entity-icon">
          {t
            ? <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>{t.glyph}</span>
            : <Icon name={panel.icon || "stack"} size={14}/>}
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div className="pstk__head__title">{panel.title}</div>
          <div className="pstk__head__meta">
            {panel.subtitle && <span className="pstk__head__sub">{panel.subtitle}</span>}
            <PanelFilterChip focus={panelFilter} onClear={() => onClearPanelFilter && onClearPanelFilter(panel.id)}/>
          </div>
        </div>
      </div>
      <div className="pstk__head__actions">
        {access && typeof PanelHeaderActions !== "undefined" && (
          <PanelHeaderActions panel={panel} access={access} compact={!panel.expanded}/>
        )}
        <button
          className={"pstk__btn " + (panel.pinned ? "is-active" : "")}
          onClick={(e) => { e.stopPropagation(); onPinPanel && onPinPanel(panel.id); }}
          data-callback="onPinPanel"
          title={panel.pinned ? "Unpin (release from anchor zone)" : "Pin (anchor next to manuscript)"}
        >
          <Icon name="pin-tack" size={12}/>
        </button>
        <button
          className={"pstk__btn " + (panel.expanded ? "is-active" : "")}
          onClick={(e) => { e.stopPropagation(); onExpandPanel && onExpandPanel(panel.id); }}
          data-callback="onExpandPanel"
          title={panel.expanded ? "Narrow" : "Widen"}
        >
          <Icon name="expand" size={12}/>
        </button>
        <button
          className="pstk__btn pstk__btn--close"
          onClick={(e) => { e.stopPropagation(); onClosePanel && onClosePanel(panel.id); }}
          data-callback="onClosePanel"
          title="Close"
        >
          <Icon name="close" size={12}/>
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CollapsedPanelTab — vertical tab handle for overflow / collapsed panels
// ---------------------------------------------------------------------
const CollapsedPanelTab = ({ panel, onRestorePanel, onClosePanel }) => {
  const t = panel.entityType ? ENTITY_TYPES[panel.entityType] : null;
  return (
    <div
      className="pstk-collapsed"
      data-ui="CollapsedPanelTab"
      title={panel.title + " — click to restore"}
      onClick={() => onRestorePanel && onRestorePanel(panel.id)}
      style={t ? { "--ec": t.color } : {}}
    >
      <span className="pstk-collapsed__icon">
        {t
          ? <span style={{ fontFamily: "var(--font-display)", fontSize: 11 }}>{t.glyph}</span>
          : <Icon name={panel.icon || "stack"} size={12}/>}
      </span>
      <span className="pstk-collapsed__title">{panel.title}</span>
      {panel.pinned && <Icon name="pin-tack" size={10}/>}
      <button
        className="pstk-collapsed__close"
        onClick={(e) => { e.stopPropagation(); onClosePanel && onClosePanel(panel.id); }}
        title="Close"
      ><Icon name="close" size={10}/></button>
    </div>
  );
};

// ---------------------------------------------------------------------
// DockedPanel — single panel body
// ---------------------------------------------------------------------
const DockedPanel = ({
  panel, isFront, panelFilter,
  onClosePanel, onPinPanel, onExpandPanel,
  onBringPanelToFront, onReorderPanels,
  onOpenReviewQueue, onSelectEntity, onClearPanelFilter,
  zoneClass = "",
}) => {
  const dragRef = _ps_ur(null);
  const onDragStart = (e) => {
    e.dataTransfer.setData("text/loomwright-panel-id", panel.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/loomwright-panel-id");
    if (!draggedId || draggedId === panel.id) return;
    onReorderPanels && onReorderPanels(draggedId, panel.id);
  };

  const cls = [
    "pstk__panel",
    zoneClass,
    panel.expanded && "is-expanded",
    isFront && "is-front",
    panel.pinned && "is-pinned",
  ].filter(Boolean).join(" ");

  return (
    <section
      ref={dragRef}
      className={cls}
      data-ui="SlidingPanel"
      data-panel-id={panel.id}
      data-state={panel.state}
      data-pinned={panel.pinned ? "true" : "false"}
      role="dialog"
      aria-label={panel.title}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={() => onBringPanelToFront && onBringPanelToFront(panel.id)}
    >
      <PanelChrome
        panel={panel}
        isFront={isFront}
        panelFilter={panelFilter}
        onPinPanel={onPinPanel}
        onExpandPanel={onExpandPanel}
        onClosePanel={onClosePanel}
        onBringPanelToFront={onBringPanelToFront}
        onClearPanelFilter={onClearPanelFilter}
      />

      <div className="panel__toolbar">
        <div className="panel__search">
          <Icon name="search" size={12}/>
          <span style={{ flex: 1 }}>Search in {panel.title.toLowerCase()}…</span>
        </div>
        <Btn variant="ghost" size="sm" icon="filter" title="Filter" data-callback="onFilterPanel"/>
        <Btn variant="ghost" size="sm" icon="sort" title="Sort" data-callback="onSortPanel"/>
        <Btn variant="ghost" size="sm" icon="bell" title="Review queue" onClick={onOpenReviewQueue} data-callback="onOpenReviewQueue"/>
      </div>

      <div className="panel__body">
        {panel.id === "p-speedReader" && typeof SpeedReaderPanelBody !== "undefined" ? (
          <SpeedReaderPanelBody panel={panel}/>
        ) : panel.entityType === "atlas" && typeof AtlasPanelBody !== "undefined" ? (
          <AtlasPanelBody panel={panel}/>
        ) : panel.entityType === "cast" && typeof CastPanelBody !== "undefined" && !["loading","error","empty"].includes(panel.state) ? (
          <CastPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "skills" && typeof SkillsPanelBody !== "undefined" ? (
          <SkillsPanelBody panel={panel}/>
        ) : panel.entityType === "relationships" && typeof RelationshipsPanelBody !== "undefined" ? (
          <RelationshipsPanelBody panel={panel}/>
        ) : panel.entityType === "timeline" && typeof TimelinePanelBody !== "undefined" ? (
          <TimelinePanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "lore" && typeof LorePanelBody !== "undefined" ? (
          <LorePanelBody panel={panel}/>
        ) : panel.entityType === "references" && typeof ReferencesPanelBody !== "undefined" ? (
          <ReferencesPanelBody panel={panel}/>
        ) : panel.entityType === "locations" && typeof LocationsPanelBody !== "undefined" ? (
          <LocationsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "items" && typeof ItemsPanelBody !== "undefined" ? (
          <ItemsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "quests" && typeof QuestsPanelBody !== "undefined" ? (
          <QuestsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "events" && typeof EventsPanelBody !== "undefined" ? (
          <EventsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "bestiary" && typeof BestiaryPanelBody !== "undefined" ? (
          <BestiaryPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "factions" && typeof FactionsPanelBody !== "undefined" ? (
          <FactionsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "stats" && typeof StatsPanelBody !== "undefined" ? (
          <StatsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "classes" && typeof ClassesPanelBody !== "undefined" ? (
          <ClassesPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "races" && typeof RacesPanelBody !== "undefined" ? (
          <RacesPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.entityType === "abilities" && typeof AbilitiesPanelBody !== "undefined" ? (
          <AbilitiesPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : (typeof FRAMEWORK_ENTITY_TYPES !== "undefined"
              && FRAMEWORK_ENTITY_TYPES.has(panel.entityType)
              && typeof EntityFrameworkPanelBody !== "undefined") ? (
          <EntityFrameworkPanelBody
            panel={panel}
            onSelectEntity={onSelectEntity}
            onCreateEntity={(opts) => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: panel.entityType, ...(opts || {}) } }))}
            onEditEntity={(e) => { if (!e || !e.save) window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: panel.entityType, initial: e } })); }}
            onImportEntity={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: panel.entityType, mode: "json" } }))}
          />
        ) : (<>
        {panel.state === "overview"   && <PanelOverview panel={panel} onSelectEntity={onSelectEntity}/>}
        {panel.state === "selected"   && <PanelSelected panel={panel}/>}
        {panel.state === "multi"      && <PanelMulti panel={panel}/>}
        {panel.state === "empty"      && <EmptyState icon={panel.icon || "paper"} title={"No " + panel.title.toLowerCase() + " yet"} body="Create your first entry, or extract from the manuscript." action={<Btn variant="primary" size="sm" icon="plus" data-callback="onCreateEntity">Create</Btn>}/>}
        {panel.state === "loading"    && <LoadingState title={"Loading " + panel.title.toLowerCase() + "…"} lines={4}/>}
        {panel.state === "error"      && <ErrorState title="Couldn't load panel" body="Local index unreachable. Your data is safe." onRetry={() => {}}/>}
        {panel.state === "review"     && <PanelReview panel={panel}/>}
        {panel.state === "edit"       && <PanelEdit panel={panel}/>}
        {panel.state === "suggestion" && <PanelSuggestion panel={panel}/>}
        </>)}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// PanelStack — orchestrator (Concept A)
//
// Props:
//   panels            — array of panel objects.
//   focusedByType     — { [entityType]: { id, label } } — per-type focus map.
//                       Each panel sees the focus that ISN'T its own type.
//   onClearPanelFilter(panelId) — clears the focus filter for that panel.
// ---------------------------------------------------------------------
const PanelStack = ({
  panels, focusedByType,
  onClosePanel, onPinPanel, onExpandPanel,
  onBringPanelToFront, onReorderPanels, onRestorePanel,
  onOpenReviewQueue, onSelectEntity, onClearPanelFilter,
}) => {
  if (!panels || panels.length === 0) return null;

  // Sort by 'order' for deterministic render
  const sorted = [...panels].sort((a, b) => (a.order || 0) - (b.order || 0));

  const pinned       = sorted.filter((p) => p.pinned && !p.collapsed);
  const unpinnedAll  = sorted.filter((p) => !p.pinned && !p.collapsed);
  const userCollapsed = sorted.filter((p) => p.collapsed);

  // Cap visible unpinned at MAX_VISIBLE_UNPINNED. Oldest (lowest order) overflows.
  const overflow = unpinnedAll.slice(0, Math.max(0, unpinnedAll.length - MAX_VISIBLE_UNPINNED));
  const visible  = unpinnedAll.slice(Math.max(0, unpinnedAll.length - MAX_VISIBLE_UNPINNED));

  const railTabs = [...overflow, ...userCollapsed];

  const frontId = sorted.length ? sorted[sorted.length - 1].id : null;

  // Compute the cross-panel filter for a given panel:
  // It's the most-recently-focused entity that is NOT of this panel's type
  // (so a Cast panel doesn't filter itself by its own selection).
  const filterFor = (panel) => {
    if (!focusedByType) return null;
    const entries = Object.entries(focusedByType).filter(([type, f]) => f && type !== panel.entityType);
    if (!entries.length) return null;
    // Return the most recent one (highest ts)
    entries.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    const [type, f] = entries[0];
    return { type, label: f.label, id: f.id };
  };

  const renderPanel = (p, zoneClass) => (
    <DockedPanel
      key={p.id}
      panel={p}
      isFront={p.id === frontId}
      panelFilter={filterFor(p)}
      onClosePanel={onClosePanel}
      onPinPanel={onPinPanel}
      onExpandPanel={onExpandPanel}
      onBringPanelToFront={onBringPanelToFront}
      onReorderPanels={onReorderPanels}
      onOpenReviewQueue={onOpenReviewQueue}
      onSelectEntity={onSelectEntity}
      onClearPanelFilter={onClearPanelFilter}
      zoneClass={zoneClass}
    />
  );

  return (
    <div className="pstk pstk--concept-a" data-ui="PanelStack" data-count={panels.length}>
      {/* Pinned anchor zone — closest to Writer's Room */}
      {pinned.length > 0 && (
        <div className="pstk__zone pstk__zone--pinned" data-ui="PanelStackPinned" aria-label="Pinned panels">
          {pinned.map((p) => renderPanel(p, "pstk__panel--pinned"))}
        </div>
      )}

      {/* Unpinned visible stack */}
      {visible.length > 0 && (
        <div className="pstk__zone pstk__zone--stack" data-ui="PanelStackStack" aria-label="Open panels">
          {visible.map((p) => renderPanel(p, "pstk__panel--stack"))}
        </div>
      )}

      {/* Collapsed / overflow rail (vertical tabs) */}
      {railTabs.length > 0 && (
        <div className="pstk__rail" data-ui="PanelStackRail" aria-label="Collapsed panels">
          {railTabs.map((p) => (
            <CollapsedPanelTab
              key={p.id}
              panel={p}
              onRestorePanel={onRestorePanel || onBringPanelToFront}
              onClosePanel={onClosePanel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { PanelStack, DockedPanel, CollapsedPanelTab, PanelChrome, MAX_VISIBLE_UNPINNED });
