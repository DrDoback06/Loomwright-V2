# Workspace Persistence Pass — Plan

_Created: 2026-05-19, on branch `claude/workspace-persistence-pass` (started from `main` post-PR-#6)._

## Scope

Make five priority visual workspaces persist meaningful edits across
reload, using existing or minimal-new services. **No UI redesign, no
workspace rebuild.** Wire the persistence layer the workspaces lack;
ship tests that prove it works at the service level and end-to-end.

## Audit of current persistence state

| Workspace | File | Persistence today | Demo data source |
|-----------|------|-------------------|------------------|
| Atlas | `atlas.jsx` + `atlas-editor.jsx` + `atlas-data.jsx` + `atlas-quick.jsx` + `atlas-focus.jsx` + `atlas-map.jsx` + `atlas-side.jsx` | **None.** Pure React state + `ATLAS_DATA` constant. `placed`/`coords`/`routes` fields exist on Location editor config (added in Field Parity) but no workspace action writes through. | `atlas-data.jsx` module constants |
| Skill Trees | `skill-trees.jsx` | **None.** React state + `SKILL_TREES` constant. Skill entities persist via `EntityService` but tree-level layout/edges/nodes don't. | `SKILL_TREES` module constant |
| Relationships | `relationships.jsx` | **None at workspace level.** `EntityService.save("relationships", …)` exists and persists per the entity editor, but `RelationshipsWorkspace` reads from `RELATIONSHIPS` module constant and writes nowhere. | `RELATIONSHIPS` module constant |
| Timeline | `timeline.jsx` | **None at workspace level.** Same pattern: `EntityService.save("timeline", …)` works; workspace ignores it. | `TL_EVENTS` module constant |
| Tangle | `tangle.jsx` | **None at workspace level.** `TangleService` (added in extraction Pass 1) has `addNode/updateNode/removeNode/addGroup`, but the workspace uses `TANGLE_BOARDS` + `INITIAL_TANGLE_NODES` constants and never calls it. | `TANGLE_BOARDS` + `INITIAL_TANGLE_NODES` |

**Bottom line:** every workspace renders demo data and discards user edits on reload. The fix is service plumbing, not UI work.

## Storage / service ownership decisions

| Workspace | Owns data via | New service / key | Notes |
|-----------|---------------|-------------------|-------|
| Atlas | Existing `EntityService.update("locations", id, {data: {placed, coords, atlasMap, routes}})` | No new service required. Add `AtlasService` thin facade with `placeLocation(id, coords)` / `updatePlacement(id, patch)` / `setRoute(fromId, toId, kind)` / `listPlacedSync()` that just delegates to EntityService. Routes stored as `location.data.routes[]`. | Locations editor already has these fields; we're activating the write path. |
| Skill Trees | New `SkillTreeService` under `KEYS.skillTrees` | `KEYS.skillTrees = "skill_trees"` + service `addTree / updateTree / addNode / updateNode / connectNodes / setLayout / loadSync`. Individual skill entities still live in `EntityService("skills", …)` — the tree stores `{id, name, nodeIds[], edges[], layout{}}`. | Avoid duplicating skill records inside trees. |
| Relationships | Existing `EntityService` on `"relationships"` type | No new service. Just dispatch workspace actions through the registry to `EntityService.save`. | Editor config already exists. |
| Timeline | Existing `EntityService` on `"timeline"` type | Same as Relationships. | Editor config already exists. |
| Tangle | Existing `TangleService` (from extraction Pass 1) | No new service. Workspace actions already route through registry callbacks; dispatch the existing TangleService methods on action. | `TangleService` provides `addNode/updateNode/removeNode/addGroup` already. |

## Implementation plan per workspace

### A. Atlas

**Service**: thin `AtlasService` facade in `backend-services.jsx`:

```js
AtlasService = {
  listPlacedSync()         → locations with data.placed===true
  placeLocation(id, x, y)  → EntityService.update("locations", id, {data:{...prev, placed:true, coords:{x,y}}})
  unplaceLocation(id)
  updatePlacement(id, patch) → merges atlasMap, coords, placed, routes
  setRoute(fromId, toId, kind) → pushes {to, kind} onto fromLoc.data.routes (dedup)
  removeRoute(fromId, toId)
  linkEntityToLocation(entityId, entityType, locationId) → store on entity.data.locationId (or push into list field)
}
```

**Callbacks** (already exist in callback names):
- `onAtlasCreateLocation` → `EntityService.save("locations", {…})` → also `placeLocation(id, x, y)` if coords supplied
- `onMoveAtlasLocation`, `onUpdateAtlasPlacement` → `AtlasService.updatePlacement`
- `onCreateAtlasRoute`, `onUpdateAtlasRoute`, `onDeleteAtlasRoute` → `AtlasService.setRoute`/`removeRoute`
- `onAddCastToAtlas`, `onShowItemOnAtlas` etc. → already wired through `onShow*OnAtlas` regex in the registry

### B. Skill Trees

**Service**: new `SkillTreeService`:

```js
SkillTreeService = {
  loadSync()                   → {trees: [{id, name, description, nodeIds[], edges[], layout, assignedClasses[], assignedCast[]}]}
  save(state)                  → persists
  addTree(tree)
  updateTree(id, patch)
  removeTree(id)
  addNode(treeId, skillEntityId, position) → adds to tree.nodeIds + tree.layout[skillEntityId] = {x,y}
  updateNodePosition(treeId, skillEntityId, position)
  connectNodes(treeId, fromSkillId, toSkillId, kind?)
  disconnectNodes(treeId, fromSkillId, toSkillId)
  assignClass(treeId, classEntityId)
  assignCast(treeId, castEntityId)
}
```

Storage key `KEYS.skillTrees = "skill_trees"`.

**Callbacks**:
- `onCreateSkillTree` → SkillTreeService.addTree
- `onCreateSkillNode` → EntityService.save("skills") + SkillTreeService.addNode
- `onEditSkillNode`, `onMoveSkillNode` → SkillTreeService.updateNodePosition
- `onConnectSkillNodes` → SkillTreeService.connectNodes
- `onAssignSkillTreeToCharacter` / `onAssignSkillTreeToClass` → assignment

### C. Relationships

**Service**: existing `EntityService` (no new code).

**Callbacks**:
- `onCreateRelationship` → `EntityService.save("relationships", {fromId, toId, relationshipType})` — already wired through `parseCreateType`.
- `onEditRelationship` → `EntityService.update("relationships", id, patch)` — already wired through `parseEditType`.
- `onAddEvidence` → `LinkService.appendField(relId, "relationships", "evidence", value)` — already wired through `onAdd<Field>` regex.
- `onLinkRelationshipEvent` → `LinkService.linkField(...)` — already wired through `onLink*` regex.

The work for relationships is **verification**: confirm that the registry routes `onCreateRelationship` etc. to the right service path and that the workspace can read from `EntityService.listSync("relationships")` on mount.

### D. Timeline

Same as Relationships: existing entity-type-based persistence. Verify routes for `onCreateTimelineEvent`, `onEditTimelineEvent`, `onReorderTimelineEvent`, link callbacks.

### E. Tangle

**Service**: existing `TangleService` (no new code beyond bug fixes).

**Callbacks**:
- `onCreateTangleNode`, `onEditTangleNode`, `onDeleteTangleNodeRequest`, `onCreateTangleGroup` — all already wired through explicit registry handlers (from extraction Pass 1).
- New for this pass: `onMoveTangleNode` (canvas position) → `TangleService.updateNode(id, {position: {x, y}})`.
- `onConnectTangleNodes` → store under `node.data.edges[]` or on tangle state.

## Callbacks to verify or wire (registry)

Most workspace-relevant callbacks already exist and route through existing helpers:
- `onCreate<Type>` via `parseCreateType` ✓
- `onEdit<Type>` via `parseEditType` ✓
- `onAdd<Field>` generic ✓
- `onLink<X>` / `onAssign<X>` regex ✓
- `onShow*OnAtlas` ✓

New explicit registry branches this pass needs (if any callback name reaches the default notice):
- Atlas-specific: `onCreateAtlasLocation` (parseCreateType handles), `onMoveAtlasLocation`, `onUpdateAtlasPlacement`, `onCreateAtlasRoute`, `onDeleteAtlasRoute`
- Skill-tree-specific: `onCreateSkillTree` (parseCreateType), `onConnectSkillNodes`, `onMoveSkillNode`
- Tangle-specific: `onMoveTangleNode`, `onConnectTangleNodes`

The audit script will surface any that still hit the generic default — these get explicit handlers.

## Tests

### Smoke (extend `scripts/smoke-services.js`)

A new `[workspace persistence]` block:

- **AtlasService** (5 checks): `placeLocation` persists coords, `updatePlacement` merges patch, `setRoute` pushes deduped, `removeRoute` removes, `listPlacedSync` returns placed locations after reload simulation.
- **SkillTreeService** (6 checks): `addTree` persists, `addNode` updates nodeIds + layout, `updateNodePosition` updates layout, `connectNodes` writes edge, `disconnectNodes` removes edge, `loadSync` after `StorageService.clear` returns default state.
- **Relationships via EntityService** (3 checks): save → reload survives, edit → reload survives, evidence append via `LinkService.appendField`.
- **Timeline via EntityService** (3 checks): same pattern.
- **TangleService** (5 checks): `addNode` persists, `updateNode` patches, `removeNode` removes, `addGroup` persists, position via `updateNode({position})` round-trips.

### E2E (new spec `tests/e2e/09-workspace-persistence.spec.js`)

One test per workspace (5 tests total). Each test:
1. Open fresh app.
2. Call the workspace's service via `window.LoomwrightBackend.*` to simulate a user edit.
3. Reload page (`openAppPreserveState`).
4. Read the same service via `*.listSync` or equivalent.
5. Assert the edit survived.

## Out of scope (strict)

- No UI redesign of any workspace.
- No new sections in any workspace.
- No new full-screen workspaces.
- No extraction logic changes.
- No field parity work beyond bugs surfaced during persistence testing.
- No full project import/export.
- No production build pipeline.
- No search/indexing.
- No audit log / undo.
- No Speed Reader completion.
- No multi-provider AI routing.
- No demo-data fallback regression (workspaces should still render existing demo constants when storage is empty + sample not loaded; new persisted state takes precedence).

## Commit plan

1. `WORKSPACE_PERSISTENCE_PLAN.md` (this commit, no code).
2. `AtlasService` + `SkillTreeService` in `backend-services.jsx`. `KEYS.skillTrees` added.
3. Callback registry — explicit handlers for any workspace callback that doesn't already route through the existing generic patterns.
4. Smoke harness extension.
5. New e2e spec.
6. `WORKSPACE_PERSISTENCE_REPORT.md` + `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` updates.

Each step verified with `npm run validate` + `npm run test:smoke` before moving on. Full `test:e2e` at the end.

## Acceptance bar

- `npm run validate` passes (Bucket A still 0).
- `npm run test:smoke` adds ~22 new assertions, all pass.
- `npm run test:e2e` adds 5 new specs, all pass; existing 41 still pass.
- Atlas / Skill Trees / Relationships / Timeline / Tangle service-level persistence verified.
- Workspace Persistence moves to "Implemented for priority workspaces; audited for remaining" in `PRODUCT_COMPLETION_AUDIT.md`.
