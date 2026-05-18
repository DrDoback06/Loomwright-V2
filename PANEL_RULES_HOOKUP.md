# Panel Rules — Hook-up notes (Loomwright v2)

This file documents the panel/route behaviour required by Brief 1 and how
the front-end implements them. All logic is front-end only and hook-ready —
swap the no-op sample data and callbacks for your real backend.

## Routes vs. panels

| Kind     | Item            | Notes |
|----------|-----------------|-------|
| route    | Home            | full-screen workspace |
| route    | Today           | full-screen workspace, carries a queue badge |
| route    | Writer's Room   | the anchor workspace; panels open *beside* it, never replace it |
| route    | Settings        | secondary route |
| panel    | Cast            | bespoke `CastPanelBody` |
| panel    | Atlas           | bespoke `AtlasPanelBody` (side panel + full-screen editor overlay) |
| panel    | Bestiary, Locations, Items, Classes, Races, Stats, Abilities, Skill Trees, Relationships, Quests, Events, Timeline, Lore, References | render through `EntityFrameworkPanelBody` |
| panel    | Tangle, Speed Reader, Trash, Recent, Active References, Notifications | render through `SlidingPanel`'s system-panel modes |
| utility  | Review Queue, Today Suggestions | demoted panel kind in the left rail |

Defined in `brand.jsx` → `NAV_ITEMS`.

## Click protocol (left rail) — `app.jsx` → `onTogglePanel`

| Click                       | Open? | Action |
|-----------------------------|-------|--------|
| plain click on closed panel | no    | open it at the end of the stack |
| plain click on open panel   | yes   | **bring-to-front + uncollapse** (never closes) |
| cmd/ctrl + click closed     | no    | open and pin it |
| cmd/ctrl + click open       | yes   | toggle pinned state |

Plain click never closes. The only ways to close a panel are:

* the panel header's close button (`onClosePanel`)
* the adaptive wheel's "close panel" slot (`onRunWheelAction("close")`)
* `onApplyWorkspacePreset("clear", …)` for a clean reset

Writer's Room is **never** closed by panel actions — it is the route
underneath the panel stack.

## State shape

```ts
type Panel = {
  id: string;             // unique within the stack
  kind: "entity" | "system";
  entityType?: EntityType;
  title: string;
  subtitle?: string;
  state?: "overview" | "selected" | "multi" | "review" | "edit" | "suggestion"
        | "empty" | "loading" | "error" | "compare";
  pinned: boolean;        // pinned panels anchor closest to the manuscript
  expanded: boolean;      // double-wide
  collapsed: boolean;     // collapsed to the rail
  fullScreen: boolean;
  dockMode: "docked" | "float";
  order: number;          // higher = closer to the front
};
```

`PANEL_PRESETS` (in `app.jsx`) is the catalogue of openable panels.

## Required callbacks

```
onOpenPanel(panelKind, ctx?)          // open + bring-to-front
onTogglePanel(panelKind, ctx?)        // implements the click protocol above
onClosePanel(panelId)
onPinPanel(panelId)
onExpandPanel(panelId)
onRestorePanel(panelId)               // uncollapse + bring-to-front
onBringPanelToFront(panelId)
onReorderPanels(draggedId, targetId)
onApplyWorkspacePreset(presetId, panelKinds)
onSelectEntity(row, panel)            // updates that panel + broadcasts the
                                      // selection so other panels can filter
onClearPanelFilter(panelId)           // drops cross-panel filter chips
onOpenReviewQueue()
onOpenSettings()
onOpenAdaptiveWheel({x, y, contextLabel})
onCloseAdaptiveWheel()
onRunWheelAction(id)
```

Every interactive element in `panels.jsx`, `panel-stack.jsx`, `atlas-*.jsx`,
`rpg-entities.jsx`, and the framework shell carries a `data-callback="..."`
attribute pointing at the conceptual callback to wire up.

## Per-panel required states

Every entity panel renders all of:

* empty (`state: "empty"`)
* loading (`state: "loading"`)
* error (`state: "error"`)
* selected (auto-derived when an entity is picked)
* review queue (auto-derived when the queue is opened)
* related entities + source mentions (rendered inside the detail body)

For panels rendered through `EntityFrameworkPanelBody`, the mode is derived
from a combination of `panel.state` and local UI state (multi-mode, editing,
review mode). See `entity-framework-host.jsx`.
