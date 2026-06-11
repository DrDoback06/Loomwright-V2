// =====================================================================
// mobile-nav.jsx — phone shell: bottom navigation + sheets.
//
// The desktop multi-tab system becomes ONE surface at a time on phones:
//   · routes render full-width (Home / Writer's Room / Today)
//   · docked panels open as a single full-screen sheet (panel-stack caps
//     visible unpinned panels at 1 when mobile)
//   · the left rail is replaced by this bottom bar:
//       Home · Write · Browse (all tabs) · Search · More (utilities)
//
// Everything routes through the SAME handlers the rail uses — no
// parallel mobile-only logic.
// =====================================================================

const { useState: _mn_us, useEffect: _mn_ue } = React;

// Shared mobile breakpoint. Writer's Room keeps its own 860px compact
// mode; the app shell switches at 700px.
const LW_MOBILE_QUERY = "(max-width: 700px)";

const useIsMobile = () => {
  const [m, setM] = _mn_us(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(LW_MOBILE_QUERY).matches
      : false
  );
  _mn_ue(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(LW_MOBILE_QUERY);
    const onChange = (e) => setM(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return m;
};

// ---------------------------------------------------------------------
// MobileSheet — bottom sheet host (Browse / More). Tap the scrim or the
// grab-handle to dismiss.
// ---------------------------------------------------------------------
const MobileSheet = ({ title, onClose, children, testid }) => (
  <div className="mnav-sheet-backdrop" data-ui="MobileSheetBackdrop" onClick={onClose}>
    <div className="mnav-sheet" data-ui="MobileSheet" data-testid={testid}
      role="dialog" aria-label={title}
      onClick={(e) => e.stopPropagation()}>
      <button className="mnav-sheet__handle" aria-label="Close" onClick={onClose}/>
      <div className="mnav-sheet__title">{title}</div>
      <div className="mnav-sheet__body">{children}</div>
    </div>
  </div>
);

const MobileSheetRow = ({ icon, label, sub, badge, active, onClick, testid }) => (
  <button type="button" className={"mnav-sheet__row " + (active ? "is-active" : "")}
    data-testid={testid} onClick={onClick}>
    <span className="mnav-sheet__row-icon"><Icon name={icon} size={15}/></span>
    <span className="mnav-sheet__row-label">{label}</span>
    {badge ? <span className="mnav-sheet__row-badge">{badge}</span> : null}
    {sub ? <span className="mnav-sheet__row-sub">{sub}</span> : null}
  </button>
);

// ---------------------------------------------------------------------
// MobileBottomNav
// ---------------------------------------------------------------------
const MobileBottomNav = ({
  routeId,
  navItems,
  openPanelKinds,
  onSetRoute,
  onOpenPanel,
  onOpenSettings,
  onOpenCommandPalette,
}) => {
  const [sheet, setSheet] = _mn_us(null); // null | "browse" | "more"
  const items = navItems || (typeof NAV_ITEMS !== "undefined" ? NAV_ITEMS : []);

  const entities = items.filter((n) => n.group === "entities");
  const tools = items.filter((n) => n.group === "tools");
  const utilities = items.filter((n) => n.group === "utilities");

  const openPanel = (item) => {
    setSheet(null);
    onOpenPanel && onOpenPanel(item.panelKind || item.entity || item.id);
  };
  const goRoute = (id) => {
    setSheet(null);
    onSetRoute && onSetRoute(id);
  };

  const slot = (id, icon, label, onClick, active) => (
    <button type="button"
      className={"mnav__slot " + (active ? "is-active" : "")}
      data-testid={"mnav-" + id}
      aria-label={label}
      onClick={onClick}>
      <Icon name={icon} size={17}/>
      <span className="mnav__slot-label">{label}</span>
    </button>
  );

  return (
    <>
      {sheet === "browse" && (
        <MobileSheet title="Browse your world" onClose={() => setSheet(null)} testid="mnav-sheet-browse">
          <div className="mnav-sheet__group">Entities</div>
          {entities.map((n) => (
            <MobileSheetRow key={n.id} icon={n.icon} label={n.label}
              badge={n.queue || 0}
              active={openPanelKinds && openPanelKinds.has(n.panelKind || n.entity || n.id)}
              testid={"mnav-browse-" + n.id}
              onClick={() => openPanel(n)}/>
          ))}
          <div className="mnav-sheet__group">Tools</div>
          {tools.map((n) => (
            <MobileSheetRow key={n.id} icon={n.icon} label={n.label}
              active={openPanelKinds && openPanelKinds.has(n.panelKind || n.id)}
              testid={"mnav-browse-" + n.id}
              onClick={() => openPanel(n)}/>
          ))}
        </MobileSheet>
      )}

      {sheet === "more" && (
        <MobileSheet title="More" onClose={() => setSheet(null)} testid="mnav-sheet-more">
          <MobileSheetRow icon="sun" label="Today" sub="Suggestions"
            testid="mnav-more-today" onClick={() => goRoute("today")}/>
          {utilities.map((n) => (
            <MobileSheetRow key={n.id} icon={n.icon} label={n.label}
              badge={n.queue || 0}
              testid={"mnav-more-" + n.id}
              onClick={() => openPanel(n)}/>
          ))}
          <div className="mnav-sheet__group">System</div>
          <MobileSheetRow icon="info" label="Help" sub="This page's controls + tour"
            testid="mnav-more-help"
            onClick={() => { setSheet(null); window.dispatchEvent(new CustomEvent("lw:open-help", { detail: {} })); }}/>
          <MobileSheetRow icon="gear" label="Settings" sub="Control Centre"
            testid="mnav-more-settings"
            onClick={() => { setSheet(null); onOpenSettings && onOpenSettings(); }}/>
        </MobileSheet>
      )}

      <nav className="mnav" data-ui="MobileBottomNav" data-testid="mnav" aria-label="Primary">
        {slot("home", "home", "Home", () => goRoute("home"), routeId === "home" && !sheet)}
        {slot("write", "feather", "Write", () => goRoute("writers-room"), routeId === "writers-room" && !sheet)}
        {slot("browse", "stack", "Browse", () => setSheet(sheet === "browse" ? null : "browse"), sheet === "browse")}
        {slot("search", "search", "Search", () => { setSheet(null); onOpenCommandPalette && onOpenCommandPalette(); }, false)}
        {slot("more", "wheel", "More", () => setSheet(sheet === "more" ? null : "more"), sheet === "more")}
      </nav>
    </>
  );
};

Object.assign(window, { MobileBottomNav, MobileSheet, useIsMobile, LW_MOBILE_QUERY });
