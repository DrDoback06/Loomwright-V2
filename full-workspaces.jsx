// =====================================================================
// full-workspaces.jsx — Full-screen workspace shell + host.
//
// This file provides:
//   • WorkspaceShell           — common top toolbar + body grid (left /
//                                centre / right inspector). Consistent
//                                Exit button + + Create primary action
//                                wired to PANEL_ACCESS metadata.
//   • WorkspaceDragTarget      — the "Drop into Writer's Room" overlay
//                                that appears when a card is dragged
//                                inside an active full workspace.
//   • WorkspaceRelatedToast    — "Related panel opened behind this
//                                workspace" toast.
//   • FullWorkspaceHost        — dispatches by workspaceId to the right
//                                workspace component (see
//                                workspaces-*.jsx for the bodies).
//
// All workspaces share these props from app.jsx (via Host):
//   open, workspaceId, panelKind, sourcePanel, onExit, onOpenEntityEditor,
//   onOpenPanel, onDropEntityIntoComposition, onOpenRelatedPanel,
//   onWorkspaceDragStart, onSetRelatedToast, etc.
// =====================================================================

const { useState: _fw_us, useEffect: _fw_ue, useRef: _fw_ur, useCallback: _fw_uc, useMemo: _fw_um } = React;

// ---------------------------------------------------------------------
// WorkspaceShell — generic shell every workspace renders inside.
// ---------------------------------------------------------------------
const WorkspaceShell = ({
  // Identity
  icon = "stack",
  eyebrow,            // e.g. "Cast"
  title,              // e.g. "Cast Dossier Workspace"
  subtitle,           // serif italic
  crumbs = [],        // [{ label, onClick }]
  entityType,         // for tint
  // Actions
  createLabel,
  onCreate,
  extraActions,       // ReactNode rendered between exit and primary
  onExit,
  // Body
  cols = "lcr",       // "lcr" | "lc" | "cr" | "c" | "lcr-wide"
  left, main, right,
  bottom,
  // Drag-into-WritersRoom + related-panel overlays
  dragTargetVisible,
  toast,
  onDismissToast,
}) => {
  const t = entityType ? ENTITY_TYPES[entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};

  return (
    <div className="fws-overlay paper-grain" data-ui="WorkspaceShell" style={style}
      data-entity={entityType || undefined}>
      <div className="fws-topbar">
        <div className="fws-topbar__lead">
          <div className="fws-topbar__icon">
            {t ? <span style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{t.glyph}</span> : <Icon name={icon} size={16}/>}
          </div>
          <div className="fws-topbar__titles">
            {eyebrow && <div className="fws-topbar__eyebrow">{eyebrow}</div>}
            <div className="fws-topbar__title">{title}</div>
            {subtitle && <div className="fws-topbar__sub">{subtitle}</div>}
          </div>
          {crumbs.length > 0 && (
            <div className="fws-topbar__crumbs">
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="fws-topbar__crumbs__sep">›</span>}
                  {c.onClick
                    ? <button className="fws-section__action" onClick={c.onClick}>{c.label}</button>
                    : <span>{c.label}</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="fws-topbar__spacer"/>
        <div className="fws-topbar__actions">
          {extraActions}
          {createLabel && onCreate && (
            <button type="button" className="fws-topbar__primary"
              onClick={onCreate}
              data-callback="onWorkspaceCreateEntity">
              <Icon name="plus" size={11}/> {createLabel}
            </button>
          )}
          <button type="button" className="fws-topbar__exit"
            onClick={onExit}
            data-callback="onExitPanelWorkspace"
            title="Exit workspace (Esc)">
            <Icon name="close" size={11}/> Exit Workspace
          </button>
        </div>
      </div>

      <div className="fws-body" data-cols={cols}>
        {left  && <div className="fws-left" data-ui="WorkspaceLeftRail">{left}</div>}
        <div className="fws-main">
          <div className="fws-main__inner">{main}</div>
        </div>
        {right && <div className="fws-right" data-ui="WorkspaceRightInspector">{right}</div>}
      </div>

      {bottom && <div className="fws-strip">{bottom}</div>}

      {dragTargetVisible && (
        <div className="fws-drag-target" data-ui="WorkspaceDragTarget">
          <div className="fws-drag-target__card">
            <Icon name="feather" size={14}/> Drop into Writer's Room composition
          </div>
        </div>
      )}

      {toast && (
        <div className="fws-toast" data-ui="WorkspaceRelatedToast">
          <Icon name="info" size={12}/>
          <div>
            <div className="fws-toast__title">{toast.title || "Related panel opened"}</div>
            {toast.sub && <div style={{ color: "var(--ink-3)", fontSize: 11 }}>{toast.sub}</div>}
          </div>
          {toast.action && (
            <button className="fws-toast__action" onClick={toast.action.onClick}>{toast.action.label}</button>
          )}
          <button className="fws-toast__action" onClick={onDismissToast} title="Dismiss">Dismiss</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Common building blocks used by workspaces.
// ---------------------------------------------------------------------
const WorkspaceSection = ({ title, count, action, children }) => (
  <>
    <div className="fws-section">
      <span className="fws-section__title">{title}</span>
      {count !== undefined && <span className="fws-section__count">{count}</span>}
      <span className="fws-section__spacer"/>
      {action && <button className="fws-section__action" onClick={action.onClick}>{action.label}</button>}
    </div>
    {children}
  </>
);

const WorkspaceFilters = ({ filters, active, onChange }) => (
  <div className="fws-filters">
    {filters.map((f) => (
      <button key={f.key}
        className={"fws-filter " + (active === f.key ? "is-on" : "")}
        onClick={() => onChange(f.key)}>
        {f.icon && <Icon name={f.icon} size={9}/>}
        <span>{f.label}</span>
        {f.count !== undefined && <span>({f.count})</span>}
      </button>
    ))}
  </div>
);

const WorkspaceRosterRow = ({
  item, selected, onClick, onDragStart, avatar, name, sub, meta, badges,
}) => {
  const dragHandlers = onDragStart ? {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "copy";
      // Set generic + Loomwright-specific payloads so Composition Overlay
      // and other drop targets can claim it.
      try {
        e.dataTransfer.setData("text/loomwright-entity", JSON.stringify(item));
      } catch (_) { /* nothing */ }
      try { e.dataTransfer.setData("text/plain", item.name || item.label || item.id || ""); } catch (_) {}
      onDragStart(item, e);
    },
  } : {};
  return (
    <div className={"fws-roster__row " + (selected ? "is-selected" : "")}
      data-ui="WorkspaceRosterRow"
      data-entity-id={item?.id}
      {...dragHandlers}
      onClick={onClick}>
      {avatar !== false && (
        <div className="fws-roster__row__avatar">{avatar || (name || "?").slice(0, 1)}</div>
      )}
      <div className="fws-roster__row__body">
        <div className="fws-roster__row__name">{name}</div>
        {sub && <div className="fws-roster__row__sub">{sub}</div>}
      </div>
      {meta && <div className="fws-roster__row__meta">{meta}</div>}
      {badges}
    </div>
  );
};

const WorkspaceTabs = ({ tabs, active, onChange }) => (
  <div className="fws-tabs">
    {tabs.map((t) => (
      <button key={t.id}
        className={"fws-tabs__btn " + (active === t.id ? "is-on" : "")}
        onClick={() => onChange(t.id)}>
        {t.label}
        {t.count !== undefined && t.count > 0 && (
          <span style={{
            marginLeft: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 14,
            height: 14,
            padding: "0 4px",
            borderRadius: 7,
            background: "var(--accent-soft)",
            color: "var(--accent-deep)",
            fontSize: 9,
          }}>{t.count}</span>
        )}
      </button>
    ))}
  </div>
);

const WorkspaceCard = ({ title, sub, action, children, style }) => (
  <div className="fws-card" style={style}>
    {(title || sub || action) && (
      <div className="fws-card__head">
        {title && <span className="fws-card__title">{title}</span>}
        {sub && <span className="fws-card__sub">{sub}</span>}
        <span className="fws-card__spacer"/>
        {action}
      </div>
    )}
    {children}
  </div>
);

const WorkspaceKV = ({ rows }) => (
  <div className="fws-kv">
    {rows.map((r, i) => (
      <React.Fragment key={i}>
        <div className="fws-kv__k">{r.k}</div>
        <div className="fws-kv__v">{r.v ?? <span style={{ color: "var(--ink-4)" }}>—</span>}</div>
      </React.Fragment>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// FullWorkspaceHost — dispatcher. Picks the right workspace by id.
//
// Workspace component contract: ({ context, onExit, onRequest }) => JSX
// where `context` includes panelKind/sourcePanel and `onRequest` lets
// the workspace ask the app shell to open the entity editor, open a
// related panel, drop into composition, or set the related-panel toast.
// ---------------------------------------------------------------------
const FullWorkspaceHost = ({
  workspace,                  // { id, panelKind, sourcePanel, entityId, name }
  onExit,
  onOpenEntityEditor,
  onOpenPanel,
  onDropEntityIntoComposition,
  onSwitchWorkspaceRequest,
}) => {
  const [dragTargetVisible, setDragTargetVisible] = _fw_us(false);
  const [toast, setToast] = _fw_us(null);

  // Esc closes workspace.
  _fw_ue(() => {
    if (!workspace?.id) return;
    const onKey = (e) => {
      if (e.key === "Escape") onExit && onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspace?.id, onExit]);

  // Global drag listeners — when the user drags an entity from anywhere
  // inside the workspace, show the WritersRoom drop target overlay so
  // they can release it.
  _fw_ue(() => {
    if (!workspace?.id) return;
    let dragging = false;
    const onDragStart = (e) => {
      // Only respond to entity-typed drags
      const types = e.dataTransfer?.types;
      if (!types) return;
      if (Array.from(types).some((tt) => tt.includes("loomwright-entity"))) {
        dragging = true;
        setDragTargetVisible(true);
      }
    };
    const onDragEnd = () => {
      if (dragging) {
        dragging = false;
        setDragTargetVisible(false);
      }
    };
    const onDrop = (e) => {
      if (!dragging) return;
      dragging = false;
      setDragTargetVisible(false);
      try {
        const raw = e.dataTransfer?.getData("text/loomwright-entity");
        if (raw) {
          const data = JSON.parse(raw);
          onDropEntityIntoComposition && onDropEntityIntoComposition({
            entityType: data.entityType || workspace.panelKind,
            id: data.id || ("ws-" + Date.now()),
            name: data.name || data.label || data.title || "Untitled",
            summary: data.summary,
          });
          setToast({
            title: "Added to Writer's Room",
            sub: (data.name || "Entity") + " queued in Composition overlay.",
            action: { label: "Exit to view", onClick: onExit },
          });
          setTimeout(() => setToast(null), 4200);
        }
      } catch (_) { /* swallow */ }
    };
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [workspace?.id, workspace?.panelKind, onDropEntityIntoComposition, onExit]);

  if (!workspace || !workspace.id) return null;

  const onRequest = {
    openEntityEditor: (opts) => onOpenEntityEditor && onOpenEntityEditor(opts),
    openPanel: (kind, ctx) => {
      onOpenPanel && onOpenPanel(kind, ctx);
      setToast({
        title: "Related panel opened behind this workspace",
        sub: "Exit the workspace to see it in the panel stack.",
        action: { label: "Exit to view", onClick: onExit },
      });
      setTimeout(() => setToast(null), 4200);
    },
    setToast,
    dropIntoComposition: (payload) => {
      onDropEntityIntoComposition && onDropEntityIntoComposition(payload);
      setToast({ title: "Added to Writer's Room", sub: (payload.name || "Entity") + " queued.", action: { label: "Exit to view", onClick: onExit }});
      setTimeout(() => setToast(null), 4200);
    },
    switchWorkspace: (newId) => onSwitchWorkspaceRequest && onSwitchWorkspaceRequest(newId),
  };

  // Lookup the workspace component on window.
  const registry = window.WORKSPACE_COMPONENTS || {};
  const Comp = registry[workspace.id];

  if (!Comp) {
    return (
      <WorkspaceShell
        icon="warn"
        eyebrow="Workspace"
        title={workspace.name || workspace.id}
        subtitle={"Workspace not registered for id: " + workspace.id}
        cols="c"
        main={
          <div className="fws-empty">
            <p>No workspace component is registered for <code>{workspace.id}</code>.</p>
            <p style={{ marginTop: 8 }}>Register it via <code>window.WORKSPACE_COMPONENTS["{workspace.id}"]</code>.</p>
          </div>
        }
        onExit={onExit}
      />
    );
  }

  return (
    <Comp
      workspace={workspace}
      onExit={onExit}
      onRequest={onRequest}
      dragTargetVisible={dragTargetVisible}
      toast={toast}
      onDismissToast={() => setToast(null)}
    />
  );
};

Object.assign(window, {
  WorkspaceShell,
  WorkspaceSection,
  WorkspaceFilters,
  WorkspaceRosterRow,
  WorkspaceTabs,
  WorkspaceCard,
  WorkspaceKV,
  FullWorkspaceHost,
});

// Initialise the registry — workspace files register themselves into it.
if (!window.WORKSPACE_COMPONENTS) window.WORKSPACE_COMPONENTS = {};
