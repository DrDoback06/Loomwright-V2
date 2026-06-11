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
// PanelOverview — generic list renderer for decorated panels. Rows come
// from EntityService.decoratePanel (always the live store).
// ---------------------------------------------------------------------
const PanelOverview = ({ panel, onSelectEntity }) => {
  const rows = panel.rows || [];
  if (!rows.length) return <EmptyState icon={panel.icon} title="Empty" body="Create or extract entries to populate this panel."/>;
  return (
    <div className="panel__list">
      {rows.map((r) => (
        <div
          key={r.id}
          className={"panel__list-row " + (r.selected ? "is-selected" : "")}
          data-callback="onSelectEntity"
          onClick={() => onSelectEntity && onSelectEntity(r)}
        >
          {panel.entityType && <EntityTypeBadge type={panel.entityType} size="xs" showLabel={false}/>}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          {r.queue && <ReviewCountBadge count={r.queue}/>}
          <span className="panel__list-row__sub">{r.meta}</span>
        </div>
      ))}
    </div>
  );
};

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
      onMouseDown={(e) => e.stopPropagation()}
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
// Re-render on lock changes so the lock toggle reflects live state.
const useLocksVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setV((x) => x + 1);
    window.addEventListener("lw:locks-updated", bump);
    return () => window.removeEventListener("lw:locks-updated", bump);
  }, []);
  return v;
};

const PanelChrome = ({
  panel, isFront, panelFilter,
  onPinPanel, onExpandPanel, onClosePanel, onBringPanelToFront, onClearPanelFilter,
}) => {
  const t = panel.entityType ? ENTITY_TYPES[panel.entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};
  // Resolve standardised access (+ Create / Open Workspace labels).
  const access = (typeof resolveAccess !== "undefined") ? resolveAccess(panel) : null;
  // Lock / keep-selected — entity panels only, acts on the current selection.
  useLocksVersion();
  const Locks = window.LoomwrightBackend?.SelectionLockService;
  const lockTarget = panel.entityType ? (panel.selected || null) : null;
  const lockTargetId = lockTarget && (lockTarget.id || lockTarget.entityId) || null;
  const isLocked = !!(Locks && lockTargetId && Locks.isLocked(lockTargetId));
  const onToggleLock = (e) => {
    e.stopPropagation();
    if (!Locks) return;
    if (!lockTargetId) {
      window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Select an entry first, then lock it to keep it selected across tabs." } }));
      return;
    }
    // Lock under the SELECTION's type (the Atlas panel selects locations).
    Locks.toggle({ id: lockTargetId, type: lockTarget.entityType || panel.entityType, label: lockTarget.label || lockTarget.name || "" });
  };
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
            <PanelFilterChip focus={panelFilter} onClear={() => onClearPanelFilter && onClearPanelFilter(panel.id, panel.entityType)}/>
          </div>
        </div>
      </div>
      <div className="pstk__head__actions" onMouseDown={(e) => e.stopPropagation()}>
        {typeof HelpButton !== "undefined" && (
          <HelpButton surfaceId={"panel:" + (panel.entityType || (panel.id || "").replace(/^p-/, ""))}/>
        )}
        {access && typeof PanelHeaderActions !== "undefined" && (
          <PanelHeaderActions panel={panel} access={access} compact={!panel.expanded}/>
        )}
        {panel.entityType && (
          <button
            className={"pstk__btn pstk__btn--lock " + (isLocked ? "is-active" : "")}
            onClick={onToggleLock}
            data-callback="onLockSelection"
            title={isLocked
              ? "Unlock " + (lockTarget?.label || "selection")
              : lockTargetId
                ? "Lock " + (lockTarget?.label || "selection") + " (keep selected across tabs)"
                : "Lock selection (select an entry first)"}
          >
            <Icon name="lock" size={12}/>
          </button>
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
  panelActions,
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
      data-panel-kind={panel.kind || panel.entityType}
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
        {panel.entityType && (
          <Btn variant="ghost" size="sm" icon="sparkle" title={"Extract " + panel.title.toLowerCase() + " from the manuscript"} data-testid="panel-extract"
            onClick={() => window.LoomwrightDispatchCallback?.("onOpenExtractionWizard", { detail: { scope: "manuscript", typeFocus: panel.entityType } })}/>
        )}
        <Btn variant="ghost" size="sm" icon="bell" title="Review queue" onClick={onOpenReviewQueue} data-callback="onOpenReviewQueue"/>
      </div>

      <div className="panel__body">
        {(() => {
          // Bespoke panel bodies historically received only {panel, onSelectEntity}.
          // We now spread the same panelActions bag the framework body receives so
          // bespoke bodies can call typed handlers (onCreateEntity, queue actions,
          // delete request, source-mention open) without prop-drilling. Existing
          // bodies that ignore the extra props are unaffected.
          // panelContext gives bodies a consistent snapshot of "where am I and
          // what's focused" — used by buttons that need projectId / activeChapter
          // / selectedEntity without re-deriving it from the DOM.
          const panelContext = {
            projectId: window.LoomwrightBackend?.projectId || "default",
            panelKind: panel.entityType || panel.kind || panel.id,
            panelId: panel.id,
            selectedEntityId: panel.selected?.id || panel.selectedId || null,
            focusedEntity: panelFilter || null,
            lockedEntityId: window.LoomwrightBackend?.SelectionLockService?.getLockForType?.(panel.entityType)?.id || null,
            activeChapterId: (typeof document !== "undefined" && document.querySelector?.("[data-ui='ManuscriptCanvas']")?.getAttribute("data-chapter-id")) || null,
            activeWorkspaceId: panel.workspaceId || null,
          };
          const bespokeProps = {
            panel,
            panelContext,
            // Inject this panel when the body doesn't pass one, so every
            // bespoke body's selection lands in panel.selected AND broadcasts
            // into focusedByType. Only when the row's type matches the panel —
            // bodies also pass related-entity chips (a quest's cast refs)
            // which must keep the legacy find-the-owning-panel behaviour.
            onSelectEntity: (row, p) => {
              const rowType = row && (row.entityType || row.type);
              const mine = !rowType
                || rowType === panel.entityType
                || (panel.entityType === "atlas" && rowType === "locations");
              onSelectEntity && onSelectEntity(rowType && !row.entityType ? { ...row, entityType: rowType } : row, p || (mine ? panel : undefined));
            },
            onCreateEntity: (opts) => panelActions?.onCreateEntity?.(opts, panel),
            onEditEntity: (e) => panelActions?.onEditEntity?.(e, panel),
            onImportEntity: () => panelActions?.onImportEntity?.(panel),
            onAcceptQueueItem: (item) => window.LoomwrightDispatchCallback?.("onAcceptQueueItem", { detail: item, entityId: item?.entityId, entityType: panel.entityType }),
            onEditQueueItem: (item) => window.LoomwrightDispatchCallback?.("onEditQueueItem", { detail: item, entityType: panel.entityType }),
            onMergeQueueItem: (item) => window.LoomwrightDispatchCallback?.("onMergeQueueItem", { detail: item, entityType: panel.entityType }),
            onDenyQueueItem: (item) => window.LoomwrightDispatchCallback?.("onDenyQueueItem", { detail: item, entityType: panel.entityType }),
            onKeepAutoAddedItem: (item) => window.LoomwrightDispatchCallback?.("onKeepAutoAddedItem", { detail: item, entityType: panel.entityType }),
            onRemoveAutoAddedItem: (item) => window.LoomwrightDispatchCallback?.("onRemoveAutoAddedItem", { detail: item, entityType: panel.entityType }),
            onDeleteEntityRequest: (e) => window.LoomwrightDispatchCallback?.("onDeleteEntityRequest", { entityId: e?.id, entityType: panel.entityType }),
            onOpenSourceMention: (m) => window.dispatchEvent(new CustomEvent("lw:open-source-mention", { detail: m })),
          };
          // Reachable review queue: when this entity type has pending review
          // items, render the (already-wired) EntityReviewQueue cards above
          // the panel body so Accept / Edit / Merge / Deny are clickable in
          // the actual UI — not only via the service layer.
          const _reviewItems = panel.reviewItems || [];
          const reviewQueueEl = (panel.entityType && _reviewItems.length && typeof EntityReviewQueue !== "undefined")
            ? <EntityReviewQueue
                entityType={panel.entityType}
                items={_reviewItems}
                state="default"
                filters={{}} setFilters={() => {}}
                selectedIds={[]} setSelectedIds={() => {}}
                onAcceptQueueItem={bespokeProps.onAcceptQueueItem}
                onEditQueueItem={bespokeProps.onEditQueueItem}
                onMergeQueueItem={bespokeProps.onMergeQueueItem}
                onDenyQueueItem={bespokeProps.onDenyQueueItem}
                onKeepAutoAddedItem={bespokeProps.onKeepAutoAddedItem}
                onRemoveAutoAddedItem={bespokeProps.onRemoveAutoAddedItem}
                onBulkAcceptQueueItems={(ids) => window.LoomwrightDispatchCallback?.("onBulkAcceptQueueItems", { detail: { ids }, entityType: panel.entityType })}
                onBulkDenyQueueItems={(ids) => window.LoomwrightDispatchCallback?.("onBulkDenyQueueItems", { detail: { ids }, entityType: panel.entityType })}
                onBulkMergeQueueItems={(ids) => window.LoomwrightDispatchCallback?.("onBulkMergeQueueItems", { detail: { ids }, entityType: panel.entityType })}
                onOpenRelatedTab={onSelectEntity}
              />
            : null;
          const body = (() => {
          if (panel.id === "p-speedReader" && typeof SpeedReaderPanelBody !== "undefined") return <SpeedReaderPanelBody {...bespokeProps}/>;
          if (panel.id === "p-aiWriter" && typeof AiWriterPanelBody !== "undefined") return <AiWriterPanelBody {...bespokeProps}/>;
          if (panel.id === "p-trash" && typeof TrashPanelBody !== "undefined") return <TrashPanelBody {...bespokeProps}/>;
          if (panel.id === "p-review" && typeof ReviewPanelBody !== "undefined") return <ReviewPanelBody {...bespokeProps}/>;
          if (panel.id === "p-today" && typeof TodayPanelBody !== "undefined") return <TodayPanelBody {...bespokeProps}/>;
          if (panel.id === "p-recent" && typeof RecentPanelBody !== "undefined") return <RecentPanelBody {...bespokeProps}/>;
          if (panel.id === "p-refs" && typeof ActiveRefsPanelBody !== "undefined") return <ActiveRefsPanelBody {...bespokeProps}/>;
          if (panel.id === "p-notifs") return (
            <EmptyState icon="warn" title="No notifications"
              body="Continuity warnings, failed jobs, and review alerts surface here as they happen."/>
          );
          if (panel.id === "p-tangle" && typeof TanglePanelBody !== "undefined") return <TanglePanelBody {...bespokeProps}/>;
          if (panel.id === "p-randomTables" && typeof RandomTablesPanelBody !== "undefined") return <RandomTablesPanelBody {...bespokeProps}/>;
          if (panel.entityType === "atlas" && typeof AtlasPanelBody !== "undefined") return <AtlasPanelBody {...bespokeProps}/>;
          if (panel.entityType === "cast" && typeof CastPanelBody !== "undefined" && !["loading","error","empty"].includes(panel.state)) return <CastPanelBody {...bespokeProps}/>;
          if (panel.entityType === "skills" && typeof SkillsPanelBody !== "undefined") return <SkillsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "relationships" && typeof RelationshipsPanelBody !== "undefined") return <RelationshipsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "timeline" && typeof TimelinePanelBody !== "undefined") return <TimelinePanelBody {...bespokeProps}/>;
          if (panel.entityType === "lore" && typeof LorePanelBody !== "undefined") return <LorePanelBody {...bespokeProps}/>;
          if (panel.entityType === "references" && typeof ReferencesPanelBody !== "undefined") return <ReferencesPanelBody {...bespokeProps}/>;
          if (panel.entityType === "locations" && typeof LocationsPanelBody !== "undefined") return <LocationsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "items" && typeof ItemsPanelBody !== "undefined") return <ItemsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "quests" && typeof QuestsPanelBody !== "undefined") return <QuestsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "events" && typeof EventsPanelBody !== "undefined") return <EventsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "bestiary" && typeof BestiaryPanelBody !== "undefined") return <BestiaryPanelBody {...bespokeProps}/>;
          if (panel.entityType === "factions" && typeof FactionsPanelBody !== "undefined") return <FactionsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "stats" && typeof StatsPanelBody !== "undefined") return <StatsPanelBody {...bespokeProps}/>;
          if (panel.entityType === "classes" && typeof ClassesPanelBody !== "undefined") return <ClassesPanelBody {...bespokeProps}/>;
          if (panel.entityType === "races" && typeof RacesPanelBody !== "undefined") return <RacesPanelBody {...bespokeProps}/>;
          if (panel.entityType === "abilities" && typeof AbilitiesPanelBody !== "undefined") return <AbilitiesPanelBody {...bespokeProps}/>;
          if (typeof FRAMEWORK_ENTITY_TYPES !== "undefined"
              && FRAMEWORK_ENTITY_TYPES.has(panel.entityType)
              && typeof EntityFrameworkPanelBody !== "undefined") {
            return <EntityFrameworkPanelBody {...bespokeProps} onEditEntity={(e) => { if (!e || !e.save) bespokeProps.onEditEntity(e); }}/>;
          }
          // Generic fallthrough — system panels without a bespoke body.
          // (The legacy selected/multi/review/edit/suggestion demo states
          // are gone; every such panel now has a live bespoke body above.)
          return (<>
            {(panel.state === "overview" || panel.state === "selected" || panel.state === "multi") &&
              <PanelOverview panel={panel} onSelectEntity={onSelectEntity}/>}
            {panel.state === "empty"      && <EmptyState icon={panel.icon || "paper"} title={"No " + panel.title.toLowerCase() + " yet"} body="Create your first entry, or extract from the manuscript." action={<Btn variant="primary" size="sm" icon="plus" data-callback="onCreateEntity">Create</Btn>}/>}
            {panel.state === "loading"    && <LoadingState title={"Loading " + panel.title.toLowerCase() + "…"} lines={4}/>}
            {panel.state === "error"      && <ErrorState title="Couldn't load panel" body="Local index unreachable. Your data is safe." onRetry={() => {}}/>}
            {(panel.state === "review" || panel.state === "edit" || panel.state === "suggestion") &&
              <EmptyState icon={panel.icon || "paper"} title={panel.title} body="This panel has no live body for this state — reopen it from the rail."/>}
          </>);
          })();
          return reviewQueueEl ? <>{reviewQueueEl}{body}</> : body;
        })()}
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
  const panelActions = {
    ...(window.LoomwrightCallbacks || {}),
    onSelectEntity,
    onCreateEntity: (opts, panel) => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: panel?.entityType, ...(opts || {}) },
    })),
    onEditEntity: (e, panel) => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: panel?.entityType, initial: e },
    })),
    onImportEntity: (panel) => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: panel?.entityType, mode: "json" },
    })),
  };
  // Phone: ONE full-screen sheet at a time. Pinning has no meaning on a
  // single-surface screen, so pinned panels join the ordinary stack and
  // everything but the front panel waits in the collapsed strip.
  const isMobile = typeof useIsMobile !== "undefined" ? useIsMobile() : false;

  if (!panels || panels.length === 0) return null;

  // Sort by 'order' for deterministic render
  const sorted = [...panels].sort((a, b) => (a.order || 0) - (b.order || 0));

  const pinned       = isMobile ? [] : sorted.filter((p) => p.pinned && !p.collapsed);
  const unpinnedAll  = isMobile ? sorted.filter((p) => !p.collapsed) : sorted.filter((p) => !p.pinned && !p.collapsed);
  const userCollapsed = sorted.filter((p) => p.collapsed);

  // Cap visible unpinned. Oldest (lowest order) overflows to the rail.
  const maxVisible = isMobile ? 1 : MAX_VISIBLE_UNPINNED;
  const overflow = unpinnedAll.slice(0, Math.max(0, unpinnedAll.length - maxVisible));
  const visible  = unpinnedAll.slice(Math.max(0, unpinnedAll.length - maxVisible));

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
      panelActions={panelActions}
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
