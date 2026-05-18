# Z-Index Layering — Hook-up

Single source of truth: `tokens.css` `:root` block.

## Ladder

| Layer | Var | Value | Used by |
|---|---|---|---|
| Shell | `--z-shell` | 0 | base content |
| Left rail | `--z-leftrail` | 30 | `.app-left` |
| Right rail | `--z-rightrail` | 30 | rails |
| Status bar | `--z-statusbar` | 30 | `.app-status` |
| Top bar | `--z-topbar` | 40 | `.app-topbar` |
| Side panels | `--z-panel` / `--z-panels` | 50 | panel stack |
| Full workspace | `--z-workspace` | 60 | `.fws-overlay`, `.qe-fs`, `.tan-fs` |
| Workspace toolbar | `--z-workspace-toolbar` | 64 | workspace drag-target overlay |
| Workspace popover | `--z-workspace-popover` | 68 | workspace popover menus, toasts |
| Composition Overlay | `--z-composition-overlay` | 75 | `.co-root` |
| Modal backdrop | `--z-overlay` | 100 | modal scrims (extraction, etc) |
| Entity Editor | `--z-entity-editor` | 110 | `.ee-backdrop` + `.ee-root` + AI Handoff drawer |
| Adaptive wheel | `--z-wheel` | 150 | right-click wheel |
| Dialog | `--z-dialog` | 200 | confirm prompts |
| Command palette | `--z-palette` | 220 | ⌘K |
| Tooltip | `--z-tooltip` | 300 | hover popovers, drag preview |

## Why this fixes the bug

Before: `entity-editor.css` used `--z-overlay: 80` and `full-workspaces.css`
hard-coded `z-index: 90/95/100`. The editor was therefore *behind* any
open workspace.

After: workspaces sit at 60–68, the entity editor sits at 110, and the
AI Handoff drawer at 112. The editor always paints over the workspace.

## Escape-key contract

Both the workspace and the editor listen for Escape on `window`. To
ensure Escape closes only the topmost layer, the editor's handler runs
in the **capture phase** and calls `stopImmediatePropagation()`:

```js
const onKey = (e) => {
  if (e.key !== "Escape") return;
  e.stopImmediatePropagation();
  e.preventDefault();
  onClose && onClose();
};
window.addEventListener("keydown", onKey, true);  // capture
```

The workspace's listener still fires when no editor is open, so
single-Escape exits a workspace as before.

## Required callbacks (already wired via existing props/events)

- `onOpenEntityEditor` — workspace `extraActions`/`onCreate` → app.jsx
- `onCloseEntityEditor` — closes editor, restores workspace beneath
- `onEntityEditorLayerFocus` — focus management lives in editor
- `onRestoreWorkspaceAfterEditorClose` — implicit (workspace stays mounted)
- `onSaveEntityFromWorkspace` — workspace dispatch → `lw:open-entity-editor`
- `onSaveEntityAndAddToComposition` — editor's footer Save+Compose action

No new callbacks were added; the bug was purely CSS.

## Acceptance test

1. Open the Relationships panel → "Open Workspace".
2. Click "+ Add Relationship" in the workspace topbar.
3. The Entity Editor appears **over** the workspace with a dim
   backdrop. The workspace remains mounted underneath.
4. Press Escape → editor closes, workspace is still open.
5. Press Escape again → workspace exits.
