// =====================================================================
// shell-parts.jsx — TopBar, LeftRail, RightUtilityRail, BottomStatusStrip
// =====================================================================

const { useState: _useState_sp, useEffect: _useEffect_sp, useRef: _useRef_sp } = React;

// Dev-only affordance gate. The Shell ↔ Design System view toggle drives an
// internal component showcase (the Specimen view) — useful for development,
// not for end users. It renders only when dev mode is on:
//   • URL has ?dev or ?design, or
//   • localStorage 'lw:v2:devMode' is set ("1"/"true").
// Default (shipped) = off, so users never see or reach the showcase.
const LW_DEV_MODE = (() => {
  try {
    const q = new URLSearchParams(window.location.search || "");
    if (q.has("dev") || q.has("design")) return true;
    const raw = window.localStorage.getItem("lw:v2:devMode");
    return raw === "1" || raw === "true" || raw === '"true"' || raw === '"1"';
  } catch (_) { return false; }
})();
try { window.__LW_DEV__ = LW_DEV_MODE; } catch (_) {}

// ---------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------
const TopBar = ({
  brand, project, book, view, onSetView, leftRailExpanded, onToggleLeftRail,
  privacyMode, onTogglePrivacyMode,
  syncState,
  globalQueueCount,
  selectedEntity,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenProfile,
  onOpenReviewQueue,
  onSelectProject,
  onSelectBook,
}) => {
  return (
    <header className="topbar" data-ui="TopBar">
      <button
        className="btn btn--ghost btn--icon btn--sm"
        title={leftRailExpanded ? "Collapse rail" : "Expand rail"}
        data-callback="onToggleLeftRail"
        data-testid="topbar-toggle-leftrail"
        onClick={onToggleLeftRail}
      ><Icon name={leftRailExpanded ? "panel-left" : "menu"} size={14}/></button>

      <div className="topbar__brand" title={brand.name + " — " + brand.tagline}>
        <BrandMark variant={brand.logoMark} size={26} short={brand.shortName}/>
        <div className="topbar__brand-text">
          <div className="topbar__brand-name">{brand.name}</div>
          <div className="topbar__brand-tag">{brand.tagline}</div>
        </div>
      </div>

      <div className="topbar__divider"/>

      <button className="topbar__selector" data-callback="onSelectProject" onClick={onSelectProject} title="Switch project">
        <Icon name="stack" size={13}/>
        <span>{project.name}</span>
        <Icon name="chevron-d" size={11}/>
      </button>
      <button className="topbar__selector" data-callback="onSelectBook" onClick={onSelectBook} title="Switch manuscript">
        <Icon name="book" size={13}/>
        <span>{project.book}<span className="topbar__selector__sub"> · MS</span></span>
        <Icon name="chevron-d" size={11}/>
      </button>

      <div className="topbar__spacer"/>

      {typeof HelpButton !== "undefined" && <HelpButton className="helpbtn--topbar" title="Help for the current page (and a guided tour)"/>}
      <button
        className="topbar__search"
        data-callback="onOpenCommandPalette"
        data-testid="topbar-search"
        onClick={onOpenCommandPalette}
        title="Open command palette"
      >
        <Icon name="search" size={13}/>
        <span className="topbar__search__lbl">Search entities, chapters, commands…</span>
        <span style={{ display: "flex", gap: 3 }}><Kbd>⌘</Kbd><Kbd>P</Kbd></span>
      </button>

      <div className="topbar__spacer"/>

      {LW_DEV_MODE && (
        <div className="view-tabs" role="tablist" aria-label="View">
          <button className={"view-tabs__btn " + (view === "shell" ? "is-active" : "")} onClick={() => onSetView("shell")} role="tab">Shell</button>
          <button className={"view-tabs__btn " + (view === "system" ? "is-active" : "")} onClick={() => onSetView("system")} role="tab">Design System</button>
        </div>
      )}

      <div className="topbar__right">
        {selectedEntity && (
          <div className="topbar__entity-context" title="Current selected entity">
            <EntityTypeBadge type={selectedEntity.type} size="xs" showLabel={false}/>
            <span>{selectedEntity.label}</span>
          </div>
        )}
        <PrivacyModeChip mode={privacyMode} onClick={onTogglePrivacyMode}/>
        <SyncStateChip state={syncState}/>
        <button
          className="topbar__queue-pill"
          data-callback="onOpenReviewQueue"
          data-testid="topbar-review-queue"
          onClick={onOpenReviewQueue}
          title="Global review queue"
        >
          <Icon name="bell" size={12}/>
          <span>Queue</span>
          {globalQueueCount > 0 && <ReviewCountBadge count={globalQueueCount}/>}
        </button>
        <Btn variant="ghost" size="sm" icon="gear" onClick={onOpenSettings} data-callback="onOpenSettings" data-testid="topbar-settings" title="Settings"/>
        <button
          className="topbar__avatar"
          data-callback="onOpenProfile"
          data-testid="topbar-profile"
          onClick={onOpenProfile}
          title={brand.project?.author || "Author"}
        >EM</button>
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------
// LeftRailItem
//
// Three kinds of items:
//   - route   : navigates the workspace (full screen). Active when routeId matches.
//   - panel   : toggles a side panel. "Open" indicator + pinned indicator.
//   - utility : same as panel, demoted styling.
//
// Click rules:
//   - route:  single-click navigates
//   - panel:  single-click toggles open/close; cmd-click pins
//   - utility: same as panel
// ---------------------------------------------------------------------
const LeftRailItem = ({
  item, expanded, active, open, pinned, dropTarget,
  onActivate, onShowTooltip, onHideTooltip, onContextMenu,
}) => {
  const queue = item.queue || 0;
  const disabled = !!item.soon;
  const isRoute = item.kind === "route";
  const className = [
    "leftrail__item",
    "leftrail__item--" + (item.kind || "route"),
    active && "is-active",
    open && !active && "is-open",
    pinned && "is-pinned",
    disabled && "is-disabled",
    dropTarget && "is-drop-target",
  ].filter(Boolean).join(" ");

  const ref = _useRef_sp(null);

  const handleEnter = () => {
    if (expanded) return;
    if (!ref.current || !onShowTooltip) return;
    const r = ref.current.getBoundingClientRect();
    onShowTooltip({ x: r.right + 8, y: r.top + r.height / 2, label: item.label, queue, kind: item.kind, open, pinned });
  };

  return (
    <div
      ref={ref}
      className={className}
      data-ui="LeftRailItem"
      data-callback="onActivateTab"
      data-testid={"leftrail-" + item.id}
      data-tab={item.id}
      data-kind={item.kind}
      role="tab"
      aria-selected={active || open}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      draggable={!disabled && !isRoute}
      onDragStart={(e) => {
        if (disabled || isRoute) return;
        const kind = item.panelKind || item.entity || item.id;
        try {
          e.dataTransfer.setData("text/loomwright-nav-kind", kind);
          e.dataTransfer.setData("text/plain", item.label || kind);
          e.dataTransfer.effectAllowed = "copy";
        } catch (_e) {}
        onHideTooltip && onHideTooltip();
      }}
      title={!isRoute && !disabled ? "Click to open · drag onto the canvas for a floating window" : undefined}
      onClick={(e) => {
        if (disabled) return;
        onActivate && onActivate(item, { meta: e.metaKey || e.ctrlKey });
      }}
      onContextMenu={(e) => {
        if (disabled) return;
        e.preventDefault();
        onContextMenu && onContextMenu(item, { x: e.clientX, y: e.clientY });
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={onHideTooltip}
      onFocus={handleEnter}
      onBlur={onHideTooltip}
    >
      <span className="leftrail__item__icon">
        {item.entity
          ? <span className="e-dot" style={{ "--ec": ENTITY_TYPES[item.entity]?.color }}/>
          : <Icon name={item.icon} size={14}/>}
      </span>
      <span className="leftrail__item__lbl">{item.label}</span>
      {!isRoute && open && expanded && (
        <span className="leftrail__item__open" title={pinned ? "Pinned panel" : "Open panel"} aria-label="Open">
          {pinned ? <Icon name="pin-tack" size={10}/> : <span className="leftrail__item__opendot"/>}
        </span>
      )}
      {item.soon && expanded && <span className="leftrail__soon">Soon</span>}
      {!item.soon && queue > 0 && expanded && <ReviewCountBadge count={queue}/>}
      {!item.soon && queue > 0 && !expanded && (
        <span className="leftrail__item__queue-collapsed">{queue > 9 ? "9+" : queue}</span>
      )}
      {!isRoute && open && !expanded && (
        <span className="leftrail__item__opendot leftrail__item__opendot--collapsed" data-pinned={pinned ? "true" : "false"}/>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// LeftRail
//
// Three sections, visually distinct:
//   1. Routes — Home, Today, Writer's Room (full-screen workspaces)
//   2. Panels — Entities + Tools (open as docked side-panels)
//   3. Utilities — Review queue, Today suggestions, Recent, etc. (also panels,
//                  but demoted to a quieter footer area)
//
// `openPanelKinds` is a Set of panelKind strings currently open in the stack.
// `pinnedPanelKinds` is a Set of panelKind strings currently pinned.
// `activeRouteId` is the current full-screen route.
// ---------------------------------------------------------------------
const LeftRail = ({
  items, activeRouteId, expanded, dropTargetId,
  openPanelKinds, pinnedPanelKinds,
  onActivateItem, onTabContextMenu,
}) => {
  const [tooltip, setTooltip] = _useState_sp(null);

  // Three section meta — "Tools" rolls into the Panels section visually,
  // separated by a thin divider, so users see "everything you can dock"
  // as one functional group.
  const sections = [
    { id: "routes",    label: "Workspace",  className: "leftrail__sec--routes" },
    { id: "panels",    label: "Panels",     className: "leftrail__sec--panels", subgroups: [
      { id: "entities", label: null },
      { id: "tools",    label: "Tools" },
    ] },
    { id: "utilities", label: "Utilities",  className: "leftrail__sec--utilities" },
    { id: "system",    label: null,         className: "leftrail__sec--system" },
  ];

  const renderItem = (item) => (
    <LeftRailItem
      key={item.id}
      item={item}
      expanded={expanded}
      active={item.kind === "route" && activeRouteId === item.id}
      open={item.kind !== "route" && openPanelKinds && openPanelKinds.has(item.panelKind || item.id)}
      pinned={item.kind !== "route" && pinnedPanelKinds && pinnedPanelKinds.has(item.panelKind || item.id)}
      dropTarget={dropTargetId === item.id}
      onActivate={onActivateItem}
      onContextMenu={onTabContextMenu}
      onShowTooltip={setTooltip}
      onHideTooltip={() => setTooltip(null)}
    />
  );

  return (
    <nav className="leftrail" data-ui="LeftRail" aria-label="Primary">
      {sections.map((sec) => {
        let groupItems;
        if (sec.id === "panels") {
          // Panels section spans entities + tools subgroups
          const ents  = items.filter((i) => i.group === "entities");
          const tools = items.filter((i) => i.group === "tools");
          if (!ents.length && !tools.length) return null;
          return (
            <div key={sec.id} className={"leftrail__group " + sec.className}>
              {sec.label && expanded && <div className="leftrail__group-label">{sec.label}</div>}
              {ents.map(renderItem)}
              {tools.length > 0 && (
                <>
                  {expanded && <div className="leftrail__subgroup-label">Tools</div>}
                  {!expanded && <div className="leftrail__divider"/>}
                  {tools.map(renderItem)}
                </>
              )}
            </div>
          );
        }
        groupItems = items.filter((i) => i.group === sec.id);
        if (!groupItems.length) return null;
        const isFooter = sec.id === "system" || sec.id === "utilities";
        return (
          <div key={sec.id} className={"leftrail__group " + sec.className + (isFooter ? " leftrail__footer-group" : "")}>
            {sec.label && expanded && <div className="leftrail__group-label">{sec.label}</div>}
            {groupItems.map(renderItem)}
          </div>
        );
      })}
      {tooltip && !expanded && (
        <div
          className="lr-tooltip"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translateY(-50%)" }}
        >
          <span>{tooltip.label}</span>
          {tooltip.kind && tooltip.kind !== "route" && tooltip.open && (
            <span className="lr-tooltip__chip">{tooltip.pinned ? "Pinned" : "Open"}</span>
          )}
          {tooltip.queue > 0 && <ReviewCountBadge count={tooltip.queue}/>}
        </div>
      )}
    </nav>
  );
};

// ---------------------------------------------------------------------
// RightUtilityRail — DEPRECATED. Utilities now live in the LeftRail
// "Utilities" section. Kept as a no-op for backwards compat.
// ---------------------------------------------------------------------
const RightUtilityRail_DEPRECATED = ({ expanded, queues, onOpenPanel, onOpenReviewQueue, onToggleExpanded }) => {
  const buttons = [
    { id: "review",     icon: "bell",     label: "Review Queues",      badge: queues.review,   panel: "review" },
    { id: "today",      icon: "sparkle",  label: "Today Suggestions",  badge: queues.today,    panel: "today" },
    { id: "recent",     icon: "clock",    label: "Recent Entities",    panel: "recent" },
    { id: "refs",       icon: "paper",    label: "Active References", panel: "refs" },
    { id: "trash",      icon: "trash",    label: "Trash",              panel: "trash" },
    { id: "notifs",     icon: "warn",     label: "Notifications",      badge: queues.notifs,   panel: "notifs" },
  ];

  if (!expanded) {
    return (
      <aside className="rightrail" data-ui="RightUtilityRail" aria-label="Utilities">
        <button
          className="rightrail__btn"
          title="Expand utilities"
          onClick={onToggleExpanded}
          data-testid="rightrail-expand"
        ><Icon name="panel-right" size={14}/></button>
        {buttons.map((b) => (
          <button
            key={b.id}
            className="rightrail__btn"
            title={b.label}
            onClick={() => onOpenPanel(b.panel, { from: "rightrail" })}
            data-callback="onOpenPanel"
            data-testid={"rightrail-" + b.id}
          >
            <Icon name={b.icon} size={15}/>
            {b.badge > 0 && <span className="rightrail__btn__badge">{b.badge > 9 ? "9+" : b.badge}</span>}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="rightrail" data-ui="RightUtilityRail" aria-label="Utilities">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "var(--fs-3xs)", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--ink-4)", fontWeight: 600 }}>Utilities</span>
        <button className="rightrail__btn" style={{ width: 24, height: 24 }} title="Collapse" onClick={onToggleExpanded}><Icon name="close" size={12}/></button>
      </div>
      <div className="rightrail__cards">
        <div className="rightrail__card">
          <div className="rightrail__card__head">
            <Icon name="bell" size={12}/> Review Queue
            <ReviewCountBadge count={queues.review}/>
          </div>
          <div className="rightrail__card__row">
            <ConfidenceBadge level="strong" value={88}/>
            <span style={{ fontSize: "var(--fs-xs)" }}>New character: Saren</span>
          </div>
          <div className="rightrail__card__row">
            <ConfidenceBadge level="uncertain" value={62}/>
            <span style={{ fontSize: "var(--fs-xs)" }}>Location merge?</span>
          </div>
          <div className="rightrail__card__row">
            <ConfidenceBadge level="weak" value={42}/>
            <span style={{ fontSize: "var(--fs-xs)" }}>Quest tag review</span>
          </div>
        </div>
        <div className="rightrail__card">
          <div className="rightrail__card__head"><Icon name="sparkle" size={12}/> Today</div>
          <div className="rightrail__card__row" style={{ fontSize: "var(--fs-xs)" }}>3 chapters drafted</div>
          <div className="rightrail__card__row" style={{ fontSize: "var(--fs-xs)" }}>1 unresolved thread</div>
        </div>
        <div className="rightrail__card">
          <div className="rightrail__card__head"><Icon name="clock" size={12}/> Recent</div>
          <div className="rightrail__card__row"><EntityTypeBadge type="cast" size="xs"/><span style={{ fontSize: "var(--fs-xs)" }}>Aelinor Vey</span></div>
          <div className="rightrail__card__row"><EntityTypeBadge type="locations" size="xs"/><span style={{ fontSize: "var(--fs-xs)" }}>Pale Reach</span></div>
          <div className="rightrail__card__row"><EntityTypeBadge type="items" size="xs"/><span style={{ fontSize: "var(--fs-xs)" }}>Auger of Hess</span></div>
        </div>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------
// BottomStatusStrip
// ---------------------------------------------------------------------
const BottomStatusStrip = ({
  mode = "Manuscript",
  lastSavedAt = "just now",
  isLocal = false,
  wordCount = 0,
  reviewQueueCount = 0,
  activeAuthor = "E. Marlowe",
  extractionState = "idle",
  canvasZoom = null,
}) => {
  const extractionLabels = { idle: "Idle", running: "Extracting…", deep: "Deep extract…", error: "Error" };
  const extractionTone = { idle: "var(--ink-3)", running: "#3e6db5", deep: "#7a6aa3", error: "#a84a3a" };
  return (
    <footer className="statusbar" data-ui="BottomStatusStrip" role="contentinfo">
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">MODE</span>
        <span className="statusbar__seg__val">{mode}</span>
      </div>
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">SAVED</span>
        <span className="statusbar__seg__val">{lastSavedAt}</span>
      </div>
      <div className="statusbar__seg" style={{ color: isLocal ? "#5e3415" : "#2c5a2a" }}>
        <span className="statusbar__seg__dot"/>
        <span className="statusbar__seg__val">{isLocal ? "Offline" : "Online"}</span>
      </div>
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">WORDS</span>
        <span className="statusbar__seg__val">{wordCount.toLocaleString()}</span>
      </div>
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">QUEUE</span>
        <span className="statusbar__seg__val">{reviewQueueCount}</span>
      </div>
      <div className="statusbar__spacer"/>
      <div className="statusbar__seg" style={{ color: extractionTone[extractionState] }}>
        <span className="statusbar__seg__dot"/>
        <span className="statusbar__seg__val">{extractionLabels[extractionState] || "—"}</span>
      </div>
      {canvasZoom != null && (
        <div className="statusbar__seg">
          <span className="statusbar__seg__lbl">ZOOM</span>
          <span className="statusbar__seg__val">{Math.round(canvasZoom * 100)}%</span>
        </div>
      )}
      <div className="statusbar__seg">
        <span className="statusbar__seg__lbl">AUTHOR</span>
        <span className="statusbar__seg__val">{activeAuthor}</span>
      </div>
    </footer>
  );
};

// Backwards-compat shim: export a no-op RightUtilityRail so existing imports don't crash.
const RightUtilityRail = () => null;

// ---------------------------------------------------------------------
// LockTray — chips for "keep selected" entity locks. Renders nothing
// when no locks exist. Desktop: slim strip under the topbar. Mobile:
// chips row above the bottom nav ("Cast: Aelinor"). Tapping a chip
// re-opens that entity's panel focused on it (lw:focus-entity); the ×
// releases the lock.
// ---------------------------------------------------------------------
const LockTray = ({ mobile = false }) => {
  const [locks, setLocks] = React.useState(() => window.LoomwrightBackend?.SelectionLockService?.listSync?.() || []);
  React.useEffect(() => {
    const sync = () => setLocks(window.LoomwrightBackend?.SelectionLockService?.listSync?.() || []);
    const evs = ["lw:locks-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, sync));
    return () => evs.forEach((e) => window.removeEventListener(e, sync));
  }, []);
  if (!locks.length) return null;
  const typeLabel = (t) => (typeof ENTITY_TYPES !== "undefined" && ENTITY_TYPES[t]?.label) || t;
  return (
    <div className={"locktray " + (mobile ? "locktray--mobile" : "")} data-ui="LockTray" role="toolbar" aria-label="Locked selections">
      <span className="locktray__lead" title="Locked selections stay selected as you move between tabs.">
        <Icon name="lock" size={10}/>
      </span>
      {locks.map((l) => {
        const t = (typeof ENTITY_TYPES !== "undefined") ? ENTITY_TYPES[l.type] : null;
        return (
          <span key={l.id} className="locktray__chip" style={t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {}}>
            <button
              type="button"
              className="locktray__chip__open"
              data-callback="onFocusLockedEntity"
              title={"Show " + typeLabel(l.type) + ": " + l.label}
              onClick={() => window.dispatchEvent(new CustomEvent("lw:focus-entity", {
                detail: { entityType: l.type, entityId: l.id, label: l.label },
              }))}
            >
              {t && <span className="locktray__chip__glyph">{t.glyph}</span>}
              <span className="locktray__chip__type">{typeLabel(l.type)}:</span>
              <span className="locktray__chip__label">{l.label}</span>
            </button>
            <button
              type="button"
              className="locktray__chip__x"
              data-callback="onUnlockEntity"
              title={"Unlock " + l.label}
              onClick={() => window.LoomwrightBackend?.SelectionLockService?.unlockEntity?.(l.id)}
            >
              <Icon name="close" size={9}/>
            </button>
          </span>
        );
      })}
    </div>
  );
};

Object.assign(window, { TopBar, LeftRail, LeftRailItem, RightUtilityRail, BottomStatusStrip, LockTray });
