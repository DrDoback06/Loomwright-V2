// =====================================================================
// panel-access.jsx — Panel header action consistency layer.
//
// Adds two callbacks across every relevant panel:
//   1. + Create / Add / Import — opens the right-docked Entity Creation
//      Editor (or panel-specific importer for References / Settings).
//   2. Open Workspace — opens the contextual full-screen workspace.
//
// Source of truth: PANEL_ACCESS — keyed by panelKind OR entityType.
// Each entry defines what the contextual labels look like, which
// workspace to open, and which entity-editor type to pass to
// EntityEditor when + Create is hit.
//
// Used by:
//   - panel-stack.jsx → PanelChrome (header buttons)
//   - full-workspaces.jsx → workspace-level + Create buttons
//   - any other surface that needs to spawn a create flow or a workspace
// =====================================================================

// ---------------------------------------------------------------------
// PANEL_ACCESS map
//
// Keys can be either:
//   - a panelKind (e.g. "tangle", "trash", "speedReader", "settings")
//   - an entityType (e.g. "cast", "locations", "items", …)
//
// The resolveAccess() helper takes a panel object and tries panelId,
// then panelKind, then entityType in that order.
// ---------------------------------------------------------------------
const PANEL_ACCESS = {
  // Entity tabs --------------------------------------------------------
  cast: {
    createLabel: "Create character",
    createIcon: "plus",
    editorType: "cast",
    workspaceLabel: "Open Dossier View",
    workspaceId: "cast-dossier",
    workspaceName: "Cast Dossier Workspace",
  },
  bestiary: {
    createLabel: "Add creature",
    createIcon: "plus",
    editorType: "bestiary",
    workspaceLabel: "Open Bestiary",
    workspaceId: "bestiary-field-guide",
    workspaceName: "Bestiary Field Guide",
  },
  atlas: {
    createLabel: "Add location",
    createIcon: "plus",
    editorType: "locations",
    workspaceLabel: "Open Atlas Editor",
    workspaceId: "atlas-editor",
    workspaceName: "Atlas Editor",
    workspaceMode: "existing", // existing full-screen editor lives inside AtlasPanelBody
  },
  locations: {
    createLabel: "Create location",
    createIcon: "plus",
    editorType: "locations",
    workspaceLabel: "Open Registry",
    workspaceId: "location-registry",
    workspaceName: "Location Registry",
  },
  items: {
    createLabel: "Create item",
    createIcon: "plus",
    editorType: "items",
    workspaceLabel: "Open Vault",
    workspaceId: "item-vault",
    workspaceName: "Item Vault",
  },
  classes: {
    createLabel: "Create class",
    createIcon: "plus",
    editorType: "classes",
    workspaceLabel: "Open Builder",
    workspaceId: "class-builder",
    workspaceName: "Class Builder",
  },
  races: {
    createLabel: "Create species",
    createIcon: "plus",
    editorType: "races",
    workspaceLabel: "Open Registry",
    workspaceId: "species-registry",
    workspaceName: "Species Registry",
  },
  stats: {
    createLabel: "Create stat",
    createIcon: "plus",
    editorType: "stats",
    workspaceLabel: "Open Stat Lab",
    workspaceId: "stat-lab",
    workspaceName: "Stat Lab",
  },
  skills: {
    createLabel: "Create skill",
    createIcon: "plus",
    editorType: "skills",
    workspaceLabel: "Open Skill Tree Editor",
    workspaceId: "skill-tree-editor",
    workspaceName: "Skill Tree Editor",
    workspaceMode: "existing", // existing full-screen editor lives inside SkillsPanelBody
  },
  relationships: {
    createLabel: "Add relationship",
    createIcon: "plus",
    editorType: "relationships",
    workspaceLabel: "Open Relationship Map",
    workspaceId: "relationship-map",
    workspaceName: "Relationship Workspace",
    workspaceMode: "existing-or-shell",
  },
  quests: {
    createLabel: "Create quest",
    createIcon: "plus",
    editorType: "quests",
    workspaceLabel: "Open Quest Log",
    workspaceId: "quest-log",
    workspaceName: "Quest Log",
  },
  events: {
    createLabel: "Create event",
    createIcon: "plus",
    editorType: "events",
    workspaceLabel: "Open Event Ledger",
    workspaceId: "event-ledger",
    workspaceName: "Event Ledger",
  },
  timeline: {
    createLabel: "Add timeline event",
    createIcon: "plus",
    editorType: "events",
    workspaceLabel: "Open Timeline",
    workspaceId: "timeline-workspace",
    workspaceName: "Timeline Workspace",
  },
  lore: {
    createLabel: "Add canon fact",
    createIcon: "plus",
    editorType: "lore",
    workspaceLabel: "Open Canon Vault",
    workspaceId: "canon-vault",
    workspaceName: "Canon Vault",
  },
  factions: {
    createLabel: "Create faction",
    createIcon: "plus",
    editorType: "generic",
    workspaceLabel: "Open Faction Registry",
    workspaceId: "faction-registry",
    workspaceName: "Faction Registry",
  },
  abilities: {
    // Deprecated. Hidden create. Workspace routes to Skill Tree Editor.
    hideCreate: true,
    workspaceLabel: "Open Skill Tree Editor",
    workspaceId: "skill-tree-editor",
    workspaceName: "Skill Tree Editor",
    workspaceMode: "existing",
  },
  references: {
    // References is not a standard entity tab — it has its own import flow.
    createLabel: "Add reference",
    createIcon: "plus",
    editorType: "references",
    workspaceLabel: "Open Research Library",
    workspaceId: "research-library",
    workspaceName: "Research Library",
    createMenu: [
      { id: "upload",    label: "Upload reference",     icon: "paper" },
      { id: "paste",     label: "Paste reference",      icon: "bookmark" },
      { id: "url",       label: "Add website / URL",    icon: "link" },
      { id: "style",     label: "Add writing style sample", icon: "feather" },
      { id: "canon",     label: "Add canon source",     icon: "book" },
      { id: "research",  label: "Add research note",    icon: "paper" },
      { id: "onboarding", label: "Add onboarding material", icon: "info" },
      { id: "json",      label: "Import JSON",          icon: "code" },
    ],
  },

  // System panels by id ----------------------------------------------
  "p-tangle": {
    createLabel: "Add note",
    createIcon: "plus",
    editorType: "generic",
    workspaceLabel: "Open Canvas",
    workspaceId: "tangle-canvas",
    workspaceName: "Tangle Canvas",
    workspaceMode: "shell",
  },
  "p-speedReader": {
    createLabel: "Add reading source",
    createIcon: "plus",
    workspaceLabel: "Open Reader",
    workspaceId: "speed-reader",
    workspaceName: "Speed Reader",
  },
  "p-settings": {
    hideCreate: true,
    workspaceLabel: "Open Control Centre",
    workspaceId: "control-centre",
    workspaceName: "Settings Control Centre",
    createMenu: [
      { id: "author",       label: "Author profile",          icon: "feather" },
      { id: "provider",     label: "AI provider",             icon: "sparkle" },
      { id: "refsource",    label: "Reference source",        icon: "paper" },
      { id: "intel",        label: "Project intelligence section", icon: "book" },
      { id: "export",       label: "Export profile",          icon: "share" },
    ],
  },
  "p-trash": {
    hideCreate: true,
    workspaceLabel: "Open Trash Manager",
    workspaceId: "trash-manager",
    workspaceName: "Trash Manager",
  },
  "p-review": {
    hideCreate: true,
    hideWorkspace: true,
  },
  "p-recent": {
    hideCreate: true,
    hideWorkspace: true,
  },
  "p-refs": {
    createLabel: "Add reference",
    createIcon: "plus",
    editorType: "references",
    workspaceLabel: "Open Research Library",
    workspaceId: "research-library",
    workspaceName: "Research Library",
  },
  "p-notifs": {
    hideCreate: true,
    hideWorkspace: true,
  },
  "p-aiWriter": {
    hideCreate: true,
    hideWorkspace: true,
  },
  "p-demo": {
    hideCreate: true,
    hideWorkspace: true,
  },
};

// ---------------------------------------------------------------------
// resolveAccess(panel) — find the right access definition for a panel.
// Tries: panel.id → panel.kind → panel.entityType → null
// ---------------------------------------------------------------------
function resolveAccess(panel) {
  if (!panel) return null;
  if (panel.id && PANEL_ACCESS[panel.id]) return PANEL_ACCESS[panel.id];
  if (panel.kind && PANEL_ACCESS[panel.kind]) return PANEL_ACCESS[panel.kind];
  if (panel.entityType && PANEL_ACCESS[panel.entityType]) return PANEL_ACCESS[panel.entityType];
  return null;
}

// ---------------------------------------------------------------------
// PanelHeaderActions — small bar of consistent controls that goes in the
// panel header alongside the existing Pin / Expand / Close cluster.
//
// Layout:
//   [+ Create]   [▢ Open Workspace]   <... existing pin/expand/close>
//
// Behaviour:
//   - + Create dispatches lw:open-entity-editor with the configured type.
//   - When createMenu is present (References / Settings), clicking +
//     opens a small popover with the configured options. Each popover
//     option dispatches a specialised event ("lw:reference-add" or
//     "lw:settings-add") so app.jsx can route accordingly. Falls back
//     to a normal create if no listener is wired.
//   - Open Workspace dispatches "lw:open-panel-workspace" with the
//     configured workspace id and (where useful) the source panel id.
// ---------------------------------------------------------------------
const { useState: _pa_us, useEffect: _pa_ue, useRef: _pa_ur } = React;

const PanelCreatePopover = ({ items, eventName, sourcePanel, onClose }) => {
  const ref = _pa_ur(null);
  _pa_ue(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose && onClose(); };
    const onEsc = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  return (
    <div className="pa-popover" ref={ref} role="menu" data-ui="PanelCreatePopover">
      <div className="pa-popover__list">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="pa-popover__row"
            role="menuitem"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(eventName, {
                detail: { actionId: it.id, sourcePanel, label: it.label },
              }));
              onClose && onClose();
            }}
            data-callback={eventName}
          >
            <Icon name={it.icon || "plus"} size={11}/>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const PanelHeaderActions = ({ panel, access, compact = false }) => {
  if (!access) return null;
  const [menuOpen, setMenuOpen] = _pa_us(false);

  const handleCreate = (e) => {
    e.stopPropagation();
    if (access.createMenu && access.createMenu.length > 0) {
      setMenuOpen((v) => !v);
      return;
    }
    // Default — open the entity editor
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: {
        type: access.editorType || panel.entityType || "generic",
        sourcePanel: panel.id,
        mode: "full",
      },
    }));
  };

  const handleWorkspace = (e) => {
    e.stopPropagation();
    // Carry the panel's current selection so the full workspace opens
    // focused on the record the user was looking at, not items[0].
    const lastSel = window.__LW_LAST_SELECTION__;
    const entityId = panel.selected?.id
      || panel.selectedId
      || (lastSel && lastSel.entityType === panel.entityType ? lastSel.entityId : null)
      || null;
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
      detail: {
        workspaceId: access.workspaceId,
        sourcePanel: panel.id,
        panelKind: panel.entityType || panel.kind || panel.id,
        entityId,
      },
    }));
  };

  // Decide which create-event name to use for the popover.
  // References → lw:reference-add. Settings → lw:settings-add.
  const popoverEventName = panel.id === "p-settings"
    ? "lw:settings-add"
    : (panel.entityType === "references" || panel.id === "p-refs" || panel.id === "p-references")
      ? "lw:reference-add"
      : "lw:create-action";

  return (
    <div className={"pa-actions " + (compact ? "is-compact " : "")} data-ui="PanelHeaderActions">
      {!access.hideCreate && (
        <div className="pa-actions__create-wrap">
          <button
            type="button"
            className="pa-actions__btn pa-actions__btn--create"
            onClick={handleCreate}
            data-callback="onCreateFromPanelHeader"
            title={access.createLabel || "Create"}
            aria-haspopup={access.createMenu ? "menu" : undefined}
            aria-expanded={menuOpen || undefined}
          >
            <Icon name={access.createIcon || "plus"} size={10}/>
            {!compact && <span>{access.createLabel || "Create"}</span>}
          </button>
          {menuOpen && access.createMenu && (
            <PanelCreatePopover
              items={access.createMenu}
              eventName={popoverEventName}
              sourcePanel={panel.id}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
      {!access.hideWorkspace && access.workspaceLabel && (
        <button
          type="button"
          className="pa-actions__btn pa-actions__btn--workspace"
          onClick={handleWorkspace}
          data-callback="onOpenPanelWorkspace"
          title={access.workspaceLabel}
        >
          <Icon name="expand" size={10}/>
          {!compact && <span>{access.workspaceLabel}</span>}
        </button>
      )}
    </div>
  );
};

Object.assign(window, {
  PANEL_ACCESS,
  resolveAccess,
  PanelHeaderActions,
});
