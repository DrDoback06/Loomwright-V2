# Area 8 — Skill Tree constellation canvas: completion & audit reference

_Status: implemented, ready for audit._

The skill-tree panel was **already live** — `SkillTreeLiveManager` edits real
trees over `SkillTreeService` + `EntityService("skills")`: create/delete trees,
add/rename/lock/remove nodes (each a skills entity), connect nodes, and assign
cast/classes, all persisting. The one deferred piece was the **visual
drag-and-drop constellation canvas**, which showed a "planned enhancement"
notice. Area 8 builds it — the backend already had everything
(`layout[id].{x,y}`, `edges`, `updateNodePosition`, `connectNodes`).

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Live constellation canvas** — the selected tree's nodes render as stars at their persisted `layout[id].{x,y}` (0–100), with edges drawn between connected nodes | `skill-trees.jsx` `SkillTreeConstellation`, embedded in `SkillTreeLiveManager` detail | e2e `25` (stars render per nodeId) |
| **Drag to reposition + persist** — dragging a star moves it live (local override) and persists the new position via `SkillTreeService.updateNodePosition` on drop | `SkillTreeConstellation` pointer handlers (`onDown/onMove/onUp`) + `moveNode` | e2e `25` (drag → persisted layout changes) |
| **Tap to select / connect** — a tap (no drag) selects the star; when a connection is armed (a node row's "Connect"), tapping a star on the canvas creates + persists the edge | `nodeClick` (routes to `connect` when `connectFrom` set) | e2e `25` (armed connect → edge persists from→to) |
| **Locked / unlocked + selection styling** — unlocked stars fill solid (★), locked are hollow (☆); selected / connect-armed stars get a halo | `SkillTreeConstellation` node render | code |
| **Honest overlay copy** — the full-screen "planned enhancement" notice now describes the in-panel canvas (drag / tap / connect) instead of promising a future feature | `SkillsPanelBody` overlay | code |
| **Pointer-capture drag** — uses pointer events + `setPointerCapture` with `touch-action: none`, so drags track smoothly and work on touch | `SkillTreeConstellation` | e2e `25` (mouse-driven pointer drag) |

## How to verify

```sh
npm run validate
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 25-skill-tree-canvas   # 3 tests
```

### Manual smoke
1. `npm run dev` → open **Skill Trees**.
2. Create tree → Add node twice → two stars appear on the canvas.
3. Drag a star — it moves; reload and it stays put.
4. On a node row, click **Connect**, then tap the other star on the canvas — an
   edge is drawn and listed under Connections.

## Notes
- Nodes are skill entities; the tree stores only references + positions
  (`SkillTreeService` never duplicates skill data). Renaming a node edits the
  underlying `skills` entity.
- The canvas is embedded in the panel detail (always visible for the selected
  tree). A dedicated full-screen editor with tier rings / marquee-select is a
  possible later polish, but is no longer required for a working visual tree.

This completes the last demo-driven / deferred narrative surface: every major
tab (Cast, Relationships, Timeline, Lore, References, Skill Trees) is now live.
