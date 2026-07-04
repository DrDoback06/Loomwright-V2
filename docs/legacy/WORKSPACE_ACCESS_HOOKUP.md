# WORKSPACE_ACCESS_HOOKUP

This document describes the **tab consistency** layer added in the Tab Consistency + Full Workspace Access pass.

It covers:

1. Panel-header `+ Create` / `Open Workspace` standardisation
2. Workspace registry shape
3. Panel → workspace mapping
4. Entity Creation Editor opening payloads
5. Workspace open / exit / drag-into-Writer's-Room behaviour
6. Related-panel behaviour
7. References / Research Library + Onboarding amalgamation
8. Settings / Trash workspace integration
9. File layout

> **The current tab interiors are intact.** This pass only adds the
> standard access controls in the panel header, the full-workspace
> overlay system, and the wiring between them.

---

## 1. Panel-header standardised access

Every stackable panel header (`PanelChrome` in `panel-stack.jsx`) now renders
a `<PanelHeaderActions>` button cluster between the title and the existing
Pin / Expand / Close buttons.

It shows two buttons (contextual labels):

| Slot               | Source                          |
|--------------------|---------------------------------|
| `+ Create / + Add` | `PANEL_ACCESS[<key>].createLabel` |
| `Open Workspace`   | `PANEL_ACCESS[<key>].workspaceLabel` |

When the panel is **narrow** (not expanded) the labels collapse to icons. When
**widened** they show the full label.

`PANEL_ACCESS` is keyed first by panel `id` (so `p-trash`, `p-settings`, etc.
can have bespoke entries), then by `entityType`.

### Panel access map (panel-access.jsx)

```js
PANEL_ACCESS = {
  cast:          { createLabel: "Create character",     workspaceLabel: "Open Dossier View",    workspaceId: "cast-dossier" },
  bestiary:      { createLabel: "Add creature",         workspaceLabel: "Open Bestiary",        workspaceId: "bestiary-field-guide" },
  atlas:         { createLabel: "Add location",         workspaceLabel: "Open Atlas Editor",    workspaceId: "atlas-editor",        workspaceMode: "existing" },
  locations:     { createLabel: "Create location",      workspaceLabel: "Open Registry",        workspaceId: "location-registry" },
  items:         { createLabel: "Create item",          workspaceLabel: "Open Vault",           workspaceId: "item-vault" },
  classes:       { createLabel: "Create class",         workspaceLabel: "Open Builder",         workspaceId: "class-builder" },
  races:         { createLabel: "Create species",       workspaceLabel: "Open Registry",        workspaceId: "species-registry" },
  stats:         { createLabel: "Create stat",          workspaceLabel: "Open Stat Lab",        workspaceId: "stat-lab" },
  skills:        { createLabel: "Create skill",         workspaceLabel: "Open Skill Tree Editor", workspaceId: "skill-tree-editor", workspaceMode: "existing" },
  relationships: { createLabel: "Add relationship",     workspaceLabel: "Open Relationship Map", workspaceId: "relationship-map",   workspaceMode: "existing-or-shell" },
  quests:        { createLabel: "Create quest",         workspaceLabel: "Open Quest Log",       workspaceId: "quest-log" },
  events:        { createLabel: "Create event",         workspaceLabel: "Open Event Ledger",    workspaceId: "event-ledger" },
  timeline:      { createLabel: "Add timeline event",   workspaceLabel: "Open Timeline",        workspaceId: "timeline-workspace" },
  lore:          { createLabel: "Add canon fact",       workspaceLabel: "Open Canon Vault",     workspaceId: "canon-vault" },
  factions:      { createLabel: "Create faction",       workspaceLabel: "Open Faction Registry", workspaceId: "faction-registry" },
  abilities:     { hideCreate: true,                    workspaceLabel: "Open Skill Tree Editor", workspaceId: "skill-tree-editor", workspaceMode: "existing" },
  references:    { createLabel: "Add reference",        workspaceLabel: "Open Research Library", workspaceId: "research-library", createMenu: [...] },

  "p-tangle":      { createLabel: "Add note",           workspaceLabel: "Open Canvas",          workspaceId: "tangle-canvas" },
  "p-speedReader": { createLabel: "Add reading source", workspaceLabel: "Open Reader",          workspaceId: "speed-reader" },
  "p-settings":    { hideCreate: true,                  workspaceLabel: "Open Control Centre",  workspaceId: "control-centre", createMenu: [...] },
  "p-trash":       { hideCreate: true,                  workspaceLabel: "Open Trash Manager",   workspaceId: "trash-manager" },
  "p-review":      { hideCreate: true, hideWorkspace: true },
  "p-recent":      { hideCreate: true, hideWorkspace: true },
  "p-aiWriter":    { hideCreate: true, hideWorkspace: true },
}
```

`hideCreate` / `hideWorkspace` suppress the respective button.
`createMenu` switches the `+` button to a popover with a curated list of
specialised actions (References / Settings).

`workspaceMode: "existing"` indicates the workspace is already implemented
**inside the panel body** (Atlas Editor in `atlas.jsx`, Skill Tree Editor in
`skill-trees.jsx`). In that mode the host doesn't open the full-workspace
overlay; instead it brings the panel to front and dispatches
`lw:open-existing-fullscreen` so the panel body opens its internal editor.

---

## 2. Workspace registry shape

Workspaces register themselves into the global `window.WORKSPACE_COMPONENTS`
map keyed by `workspaceId`.

```js
window.WORKSPACE_COMPONENTS["cast-dossier"] = CastDossierWorkspace;
```

Each workspace component receives:

```ts
type WorkspaceProps = {
  workspace: { id: string; panelKind: string; sourcePanel: string; name?: string };
  onExit: () => void;
  onRequest: {
    openEntityEditor: (opts) => void;          // open right-docked editor
    openPanel: (kind, ctx) => void;            // queue panel behind workspace + toast
    setToast: (toast) => void;                 // show a related/info toast
    dropIntoComposition: (payload) => void;    // forward to Writer's Room overlay
    switchWorkspace: (newId) => void;          // hand-off to a different workspace
  };
  dragTargetVisible: boolean;  // true while user drags an entity inside a workspace
  toast: ToastShape | null;
  onDismissToast: () => void;
};
```

Workspaces are encouraged to use the shared primitives exported by
`full-workspaces.jsx`:

| Primitive             | Purpose                                                  |
|----------------------|----------------------------------------------------------|
| `WorkspaceShell`     | Top bar (icon, title, sub, crumbs, `+ Create`, Exit) + body grid (`l c r`) + bottom strip + drag-target overlay + toast |
| `WorkspaceSection`   | Bordered section heading with optional count + action     |
| `WorkspaceFilters`   | Pill row of filter chips                                  |
| `WorkspaceRosterRow` | Draggable roster row (avatar / name / sub / meta / badges)|
| `WorkspaceTabs`      | Tabbed right-inspector                                    |
| `WorkspaceCard`      | Standard card with head + body                            |
| `WorkspaceKV`        | Two-column key / value grid                                |

---

## 3. Panel → workspace mapping

| Panel             | Create action               | Workspace                    | Workspace name |
|-------------------|-----------------------------|------------------------------|----------------|
| Cast              | Create character            | `cast-dossier`               | Cast Dossier Workspace |
| Bestiary          | Add creature                | `bestiary-field-guide`       | Bestiary Field Guide |
| Atlas             | Add location                | `atlas-editor` *(existing)*  | Atlas Editor |
| Locations         | Create location             | `location-registry`          | Location Registry |
| Items             | Create item                 | `item-vault`                 | Item Vault |
| Classes           | Create class                | `class-builder`              | Class Builder |
| Races / Species   | Create species              | `species-registry`           | Species Registry |
| Stats             | Create stat                 | `stat-lab`                   | Stat Lab |
| Skill Trees       | Create skill                | `skill-tree-editor` *(existing)* | Skill Tree Editor |
| Relationships     | Add relationship            | `relationship-map`           | Relationship Workspace |
| Quests            | Create quest                | `quest-log`                  | Quest Log |
| Events            | Create event                | `event-ledger`               | Event Ledger |
| Timeline          | Add timeline event          | `timeline-workspace`         | Timeline Workspace |
| Lore / Canon      | Add canon fact              | `canon-vault`                | Canon Vault |
| Factions          | Create faction              | `faction-registry`           | Faction Registry |
| References        | Add reference (menu)        | `research-library`           | Research Library |
| Tangle            | Add note                    | `tangle-canvas` *(shell)*    | Tangle Canvas |
| Speed Reader      | Add reading source          | `speed-reader`               | Speed Reader |
| Settings          | + Author / + Provider menu  | `control-centre`             | Settings Control Centre |
| Trash             | — (no create)               | `trash-manager`              | Trash Manager |
| Abilities (deprecated) | —                        | `skill-tree-editor` *(existing)* | Skill Tree Editor |
| Review queue / Recent / Notifications / AI Writer | — | — | (no workspace) |

---

## 4. Entity Creation Editor opening payloads

The `+ Create` button dispatches a global event the AppShell handles:

```js
window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
  detail: {
    type: "<entityType>",      // cast | locations | items | … | generic | references
    initial: { … } | null,     // optional pre-filled fields (used for "Edit")
    mode: "full" | "quick" | "ai" | "json" | "review",
    sourcePanel: "<panelId>",  // for telemetry / focus restoration
  },
}));
```

`AppShell` listens for this event and routes to `openEntityEditor(opts)`,
which is the existing right-docked `<EntityEditor>` (`entity-editor.jsx`).

### Reference / Settings sub-actions

When `PANEL_ACCESS.createMenu` is present, the `+` button opens a small
popover. Each popover row dispatches a specialised event:

| Panel        | Popover event       | Payload `detail.actionId` values |
|--------------|---------------------|-----------------------------------|
| References   | `lw:reference-add`  | `upload`, `paste`, `url`, `style`, `canon`, `research`, `onboarding`, `json` |
| Settings     | `lw:settings-add`   | `author`, `provider`, `refsource`, `intel`, `export` |

`AppShell` routes `lw:reference-add` into the standard entity editor
seeded with `{ type: "references", initial: { kind: <actionId> } }`.
`lw:settings-add` opens the Control Centre workspace and dispatches
`lw:settings-section` so the Control Centre can scroll to the right
section.

### Required callback names (for downstream wiring)

The pasted brief lists these callback names. They are surfaced as
`data-callback="…"` attributes on the appropriate buttons inside the
editor + workspaces so downstream automation / telemetry can attach.

```
onOpenEntityEditor
onCloseEntityEditor
onSetEntityEditorMode
onUpdateEntityDraftField
onValidateEntityJson
onPreviewEntityJsonImport
onApplyEntityJsonImport
onGenerateEntityDraftPreview
onSaveEntityDraft
onSaveEntityActive
onSaveEntityAndAddToComposition
onCancelEntityEdit

onUploadReference
onPasteReference
onAddReferenceUrl
onAddWritingStyleSample
onAddCanonSource
onAddResearchNote
onAddOnboardingReference
onImportReferenceJson

onCreateAuthorProfile
onAddAIProvider
onAddReferenceSource
onAddProjectIntelligenceSection
onExportProfile
```

---

## 5. Workspace open / exit / drag-into-Writer's-Room

### Open

A panel's `Open Workspace` button dispatches:

```js
window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
  detail: { workspaceId, sourcePanel, panelKind },
}));
```

`AppShell` listens and calls `openPanelWorkspace(opts)` which:

1. Resolves `PANEL_ACCESS[panelKind]`.
2. If `workspaceMode === "existing"`, brings the panel to front and
   dispatches `lw:open-existing-fullscreen`. Atlas + Skill Tree
   panel bodies listen and enter their internal full-screen.
3. Otherwise sets `panelWorkspace = { open, id, panelKind, sourcePanel, name }`.
   `<FullWorkspaceHost>` picks the component from `WORKSPACE_COMPONENTS`
   and renders it as a full-bleed overlay on top of the panel stack.

### Exit

Three ways to exit:

| Trigger                       | Effect |
|-------------------------------|--------|
| Top-bar `Exit Workspace` button | `onExit` → `exitPanelWorkspace()` |
| `Escape` key                   | Same as above |
| Drop entity into Writer's Room | Toast surfaces an `Exit to view` shortcut |

Panel stack state is preserved across open/exit (we never destroy panels
when entering/leaving a workspace).

### Stack discipline

**Only one full workspace is active at a time.** Opening a different
workspace replaces the current one. We do **not** layer workspaces.

### Drag → Writer's Room

`FullWorkspaceHost` installs window-level `dragstart` / `dragend` / `drop`
listeners that detect entity drags (payload type
`text/loomwright-entity`). When such a drag begins, it shows the
`fws-drag-target` overlay (`Drop into Writer's Room composition`).
On drop:

1. Calls `onDropEntityIntoComposition(payload)` — appends the entity to
   the Writer's Room Composition Overlay.
2. Shows a toast: `Added to Writer's Room` with an `Exit to view` shortcut.

Workspace roster rows are draggable by default — they set the
`text/loomwright-entity` payload with `{ entityType, id, name }`.

The Item Vault Cast equipment slot is itself a drop target — dropping an
Item onto a slot shows an `Equipped` toast so the integration is visible.

---

## 6. Related-panel behaviour

When a workspace surfaces a related entity (e.g. clicking "Captain Brec"
inside the Item Vault), the workspace calls `onRequest.openPanel("cast")`.
The host:

1. Opens or brings the related panel to front **behind** the workspace.
2. Shows a toast: `Related panel opened behind this workspace`
   with an `Exit to view` action.

We **never** layer multiple full-screen workspaces. Related entities open
their **side panel**; the user must use the `Open Workspace` button in
that side panel to switch to its full workspace.

---

## 7. References = Research Library

The Research Library is intentionally the **central place** for:

- Uploaded files (PDF, images)
- Pasted reference text
- Website / URL references
- Writing style samples / voice influences
- Canon source documents
- Research notes
- Onboarding answers
- Project Intelligence inputs

The right-rail inspector exposes three context toggles per reference:

- `Include in AI context`
- `Use as writing-style influence`
- `Treat as canon source`

These map to the documented callbacks
`onToggleReferenceAIContext`, `onToggleReferenceStyleInfluence`,
`onToggleReferenceCanonSource`.

For onboarding references, an `Edit onboarding answers` action surfaces
in the inspector for `onEditOnboardingInfo`.

---

## 8. Settings = Control Centre, Trash = Trash Manager

The Settings panel never had generic `+ Create Entity`. The Control
Centre exposes the documented settings-specific add actions:

- `+ Author Profile` (`onCreateAuthorProfile`)
- `+ AI Provider` (`onAddAIProvider`)
- `+ Reference Source` (`onAddReferenceSource`)
- `+ Project Intelligence Section` (`onAddProjectIntelligenceSection`)
- `Export Profile` (`onExportProfile`)

The Trash Manager replaces the older empty Trash panel content with a
filter + table + preview + restore / delete-forever flow, with a
double-confirm step on the destructive action (`onDeleteForever`).

---

## 9. File layout

```
panel-access.jsx              ← PANEL_ACCESS map + PanelHeaderActions
full-workspaces.css           ← Shell + workspace primitive styles
full-workspaces.jsx           ← WorkspaceShell + FullWorkspaceHost + primitives
workspaces-rpg.jsx            ← Location, Item, Class, Species, Stat, Faction
workspaces-narrative.jsx      ← Cast, Bestiary, Quest, Event, Timeline, Canon
workspaces-system.jsx         ← Research Library, Control Centre, Trash, Speed Reader, Relationship Map, Tangle Canvas
panel-stack.jsx               ← PanelChrome now renders <PanelHeaderActions>
app.jsx                       ← panelWorkspace state + event listeners + <FullWorkspaceHost> overlay
atlas.jsx, skill-trees.jsx    ← listen for "lw:open-existing-fullscreen"
```

---

## 10. Manual QA Crib Sheet

1. **Header controls** — Open each panel from the left rail. Confirm that
   each panel header shows the correct `+ Create` and `Open Workspace`
   labels (or hides them per access rules).
2. **Entity Editor** — Click `+ Create` on a content panel; the
   right-docked editor opens with the correct type pre-selected.
3. **Workspace opening** — Click `Open Workspace` on a content panel.
   The workspace overlay opens, occupying the app-work area; `Exit`
   restores the panel stack untouched.
4. **Atlas + Skill Trees** — `Open Workspace` should pop the in-panel
   full-screen editor (not open an extra overlay).
5. **Drag → Writer's Room** — Open Item Vault, start dragging an item.
   A "Drop into Writer's Room composition" overlay appears. Drop it; a
   toast confirms it was queued; the Items panel stays open.
6. **Related panel** — In Item Vault, click an owner chip. A toast says
   "Related panel opened behind this workspace"; the Cast panel is
   queued behind the workspace.
7. **References** — Open the References panel. Click `+ Add reference`
   in the header — popover shows Upload/Paste/URL/Style/Canon/Research/
   Onboarding/JSON. Open the workspace; library + drop zone + inspector
   appear with AI/style/canon toggles.
8. **Settings** — Open Settings panel. The `+` button shows a popover
   of settings-specific add actions. `Open Control Centre` shows the
   grouped left-nav and section editor.
9. **Trash** — Open Trash panel. No `+`. `Open Trash Manager` shows
   filter / table / preview / restore / delete-forever (with confirm).
10. **Esc** closes any open workspace.
