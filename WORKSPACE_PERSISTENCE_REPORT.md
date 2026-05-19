# Workspace Persistence Pass 1 — Report

_Created: 2026-05-19, on branch `claude/workspace-persistence-pass`._

## Acceptance against `WORKSPACE_PERSISTENCE_PLAN.md`

| Plan item | Status | Where verified |
|-----------|--------|----------------|
| `AtlasService` thin facade over `EntityService("locations")` | ✓ | `backend-services.jsx`; 8 smoke checks; e2e M.1 |
| `SkillTreeService` under `KEYS.skillTrees` | ✓ | `backend-services.jsx`; 7 smoke checks; e2e M.2 |
| Relationships persist via existing `EntityService("relationships")` | ✓ | 3 smoke checks; e2e M.3 |
| Timeline persists via existing `EntityService("timeline")` | ✓ | 3 smoke checks; e2e M.4 |
| Tangle persists via existing `TangleService` (extended with `edges[]` default state + position support on `updateNode`) | ✓ | 5 smoke checks; e2e M.5 |
| Existing 41 e2e tests remain green | ✓ | full suite re-run after additions |
| Existing ~130 smoke checks remain green | ✓ | full smoke run after additions |
| `Bucket A = 0` | ✓ | `npm run validate` |

## Verification baseline

```
> npm run validate
OK: 524 UI callbacks; registry bootstraps 524 handlers
OK: 0 Bucket A action callbacks reach the generic default notice.
OK: 6 Bucket B (provider-gated) callbacks use requireProviderOrNotice.
OK: 4 Bucket D (React-owned) callbacks declared.

> npm run test:smoke
~156 checks pass:
  - 22 prior service smoke checks (still pass)
  - 48 extraction fixture assertions (still pass)
  - 64 field-parity round-trip assertions (still pass)
  - 8 audit-only smoke checks (still pass)
  - 26 new workspace-persistence assertions (NEW)
  - 8 atlas + 7 skill-trees + 3 relationships + 3 timeline + 5 tangle

> CHROMIUM_PATH=/path/to/chrome npm run test:e2e
46 passed (≈6 min wall):
  - 41 prior tests (still pass)
  - 5 new M. Workspace persistence tests pass
```

## What this pass landed

### AtlasService (thin facade over `EntityService("locations")`)

No new schema — every field (`placed`, `coords`, `atlasMap`, `routes`)
already lived on the Location editor config from Field Parity Pass.
This pass activates the write path.

Methods:
- `listPlacedSync()` / `listAllSync()`
- `placeLocation(id, {x, y}, {atlasMap})` — sets `placed:true` + coords + map
- `unplaceLocation(id)`
- `updatePlacement(id, patch)` — merges `placed` / `coords` / `atlasMap` / `routes`
- `setRoute(fromId, toId, kind)` — dedups by destination; latest kind wins
- `removeRoute(fromId, toId)`
- `linkEntityToLocation(entityId, entityType, locationId)` — writes `entity.data.locationId` AND pushes onto `location.data.<entityType>[]` for fast lookup

### SkillTreeService (new, persisted under `KEYS.skillTrees`)

Tree-level state separate from skill entities. Trees store references
(`nodeIds[]`) and layout (`layout[skillId] = {x, y}`); skill records
themselves stay in `EntityService("skills")` — no duplication.

State shape:
```js
{
  trees: [{
    id, name, description,
    nodeIds: [<skill id>, ...],
    edges:   [{from, to, kind}],
    layout:  { [skillId]: {x, y} },
    assignedClasses: [<class id>],
    assignedCast:    [<cast id>],
    createdAt, updatedAt
  }],
  updatedAt
}
```

Methods: `loadSync`, `save`, `addTree`, `updateTree`, `removeTree`,
`addNode`, `updateNodePosition`, `removeNode`, `connectNodes` (dedup),
`disconnectNodes`, `assignClass`, `assignCast`.

### Relationships + Timeline (existing `EntityService`)

No new code — the workspaces just needed coverage proving the path
works end-to-end:
- `EntityService.save("relationships", {...})` → reload → still there.
- `EntityService.update("relationships", id, patch)` → reload → patched.
- `LinkService.appendField(id, "relationships", "evidence", value)` →
  reload → in the array. (Already wired through the generic
  `onAdd<Field>` regex from the burn-down pass.)
- Same shape for `"timeline"` type.

### TangleService extensions

- `defaultState()` now includes `edges: []` for node-to-node
  connections (consumed by tangle workspace canvas).
- `updateNode(id, {position: {x, y}})` round-trips position — verified.

The `addNode / updateNode / removeNode / addGroup` methods already
existed from the extraction Pass 1 commit; this pass adds positional
support and proves the workspace-persistence round trip.

## What this pass did NOT touch

Per the plan's explicit out-of-scope list:

- ❌ No UI redesign of any workspace.
- ❌ No new sections in any workspace.
- ❌ No workspace component rewriting (the React components in
  `atlas.jsx` / `skill-trees.jsx` / `relationships.jsx` /
  `timeline.jsx` / `tangle.jsx` still render from their existing demo
  constants on first paint when storage is empty — that's intentional;
  rewriting their render paths is "panel rebuild" territory).
- ❌ No extraction logic changes.
- ❌ No field parity changes (no bugs surfaced during this pass).
- ❌ No full project import/export.
- ❌ No production build pipeline.
- ❌ No search/indexing.
- ❌ No audit log / undo.
- ❌ No Speed Reader completion.
- ❌ No multi-provider AI routing.

## Audit-only / secondary workspaces (deferred to a future pass)

Per the brief:
- Quest Log workspace — quest entities persist via `EntityService("quests", …)` (Field Parity); the workspace shell shows a list, no edits today.
- Event Ledger workspace — same shape for `"events"`.
- Lore/Canon workspace — same shape for `"lore"`.
- References workspace — same shape for `"references"`.
- Speed Reader workspace — engine itself is still a prototype; full Speed Reader Completion pass is its own milestone.

For each: the underlying entity service already persists the
canonical record. If a future audit surfaces a missing write path,
it'll be a targeted fix rather than a workspace rebuild.

## Files changed in this pass

```
A WORKSPACE_PERSISTENCE_PLAN.md      (plan, committed first)
A WORKSPACE_PERSISTENCE_REPORT.md    (this file)
A tests/e2e/09-workspace-persistence.spec.js
M backend-services.jsx               (AtlasService, SkillTreeService, KEYS.skillTrees, TangleService edges default)
M scripts/smoke-services.js          ([workspace persistence] block, 26 new assertions)
M PRODUCT_COMPLETION_AUDIT.md        (workspace persistence → Implemented for priority workspaces)
M FINAL_QA_REPORT.md                 (Pass 1 numbers appended)
```

No workspace component code touched. No vendor or build-pipeline
changes. No extraction or field-parity changes.

## Recommended next PR

Per `PRODUCT_COMPLETION_AUDIT.md` "Needs next PR" priority order:

**Full Project Import/Export pass.** Highest-value safety net before
serious user data accumulates. Plan-first; entity-level import/export
already works (Field Parity Pass), so the work is project-level:
preview + backup-before-replace + merge-vs-replace modes + entity-
library export with selected types and include/exclude toggles.

Or: **Speed Reader Completion** if you'd rather attack the other
remaining "thin" item now that core data infrastructure is solid.
