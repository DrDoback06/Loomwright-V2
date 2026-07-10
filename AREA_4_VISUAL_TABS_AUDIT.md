# Area 4 — Visual tabs go live: Relationships + Skill Trees

_Status: implemented, ready for audit._

Area 4 closes the "visual tabs still render demo data" gap tracked in
`DEFERRED_BACKLOG.md`. The Relationships workspace now graphs the live
project store, and the Skill Trees manager can pull in skills discovered by
extraction (not only freshly-created ones).

## Relationships tab — live rendering

The Relationships workspace (`relationships.jsx`) previously rendered a fixed
demo cast (Aelinor, Saren, …) from module constants. It now builds a **live
model** from the persisted store and renders that; the demo constants remain
only as a fallback for the empty/design state.

| Feature | Implementation | Notes |
|---|---|---|
| **Live model** — cast, relationships, evidence, review, hopes/fears | `buildLiveRelModel()` reads `EntityService.listSync("cast")`, `EntityService.listSync("relationships")`, and `ReviewService.listSync("relationships")` | Returns `{ live:false }` when there is no cast, so views fall back to the demo constants |
| **Relationships from two sources** | (1) accepted `relationships` entities (`data.fromId`/`toId`/`relationshipType`), (2) cast related-multi fields (family/lovers/allies/mentors/rivals/enemies) | Deduped by unordered pair; explicit relationship entities win on type + summary |
| **Type normalisation** | `_normRelType` maps verbs/labels ("married", "loves", "trained", "betrayed", …) → the 8 `REL_TYPES` keys | Meters (strength/trust/conflict) are type-shaped defaults since live records carry no numeric meters yet |
| **Context, not prop-drilling** | `RelModelContext` + `useRelModel()`; every view (Single, Compare, Network, Timeline, Conflict, Review) reads the same model | `RelationshipsPanelBody` rebuilds the model on `lw:entity-store-updated` / `lw:review-queue-updated` / `lw:occurrences-updated` / `lw:backend-ready` |
| **Network graph scales to any cast** | Ring layout computed from the live cast when the demo positions don't fit | Demo state keeps its hand-placed constellation |
| **Live review queue** | Pending relationship candidates render with real confidence bands + Accept/Edit/Merge/Deny wired through the shared queue callbacks | Accept lands a `relationships` entity → model refreshes → the new bond appears in the graph |
| **Honest empty states** | Timeline/Review/no-cast show explanatory notices instead of blank panels | — |

### Supporting fix
`resolveCtx` in `callback-registry.jsx` now folds a DOM `data-id` into
`detail.id`, so `data-callback`-only buttons (no React `onClick`) — like the
relationship review-queue Accept/Deny/Merge — can identify their row.

## Skill Trees — discovered-skill assignment

Skill Trees already renders the live, persistent `SkillTreeLiveManager`
(create tree/node, connect, lock, assign cast/class — all persisted; verified
by e2e `15` #17). The remaining `DEFERRED_BACKLOG` item was surfacing skills
**discovered by extraction** so they can be added to a tree rather than only
ever creating a brand-new skill.

| Feature | Implementation |
|---|---|
| **Add discovered skill** dropdown | `SkillTreeLiveManager` lists `EntityService.listSync("skills")` not already in the tree (`availableSkills`) and attaches the chosen one via `SkillTreeService.addNode(treeId, skillId)` |

## How to verify
```
npm run build          # both files compile under the production Babel path
npm run test:e2e       # 15 (skill tree #17), 17 (relationship accept lands fromId/toId), 20 (cast)
```
Manual: add cast + accept a relationship candidate from extraction → open
Relationships → the pair appears across Single/Network/Conflict; open Skill
Trees → "+ Add discovered skill…" lists accepted skill entities.

## Deferred from Area 4 (tracked in DEFERRED_BACKLOG.md)
- **Numeric relationship meters + change tracking** — live records carry no
  strength/trust/conflict history yet; the Timeline view shows an empty state
  until a relationship-quality pass records change events.
- **Visual constellation canvas** for skill trees (drag-and-drop) remains
  future scope; the panel manager is fully functional.
