# Area 4 — Relationships tab becomes a live visual hub: completion & audit reference

_Status: implemented, ready for audit._

The Relationships panel (`relationships.jsx`) was the last major surface still
driven entirely by module-level demo constants (`RELATIONSHIPS`, `REL_EVIDENCE`,
`REL_CHANGES`, `REL_REVIEW`, `REL_HOPES_FEARS`) and `window.ATLAS_CAST`. Persisted
relationship records — created by extraction/accept and by the entity editor —
were never rendered, and every button was a dead `data-callback` that reached the
generic default notice. Area 4 rewires all six modes (Single / Compare / Network /
History / Conflict / Review) to the live entity store, following the Area 3 (Cast
dossier) pattern, and wires every button.

## The data reality it had to reconcile

Relationship records live in the shared entity store under type `"relationships"`
(`EntityService.listSync("relationships")`) — there is no dedicated service. Two
writers produce two shapes, and the adapter normalises **both**:

| Writer | `data.*` shape |
|---|---|
| Extraction / review-accept (`detectRelationships` → `autoApplyCandidate` / `acceptQueueItem`) | `{ fromId, toId, relationshipType, relatedEntityIds }` — `relationshipType` is a verb slug (`betrayed`, `kissed`, …) |
| Entity editor (`EE_RELATIONSHIP`) | `{ from, to, bondType, intensity, valence, summary, history, evidence, … }` — pickers store `{id,name,type}` |

The backlog note ("persist with fromId/toId/**type**") was loose: the extraction
key is `relationshipType`, and the editor key is `bondType`. Both are handled.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Live graph edges** — persisted `relationships` entities resolve to `{a,b,type,strength,trust,conflict,secret,summary,chapters,evidence}`; both `fromId/toId/relationshipType` and `from/to/bondType/intensity/valence` shapes; verb/bond slugs normalised to a `REL_TYPES` bucket | `liveRelEdge` / `buildEdges` / `_normRelType` in `relationships.jsx` | e2e `21` (extraction shape → single+network; editor shape → compare meters) |
| **Derived meters** — `strength` from `intensity` (or a per-type default); `trust`/`conflict` from `valence` (or per-type default); `secret` from `data.secret`/`hidden`/cold valence | `liveRelEdge` + `_REL_TYPE_*` / `_REL_VALENCE_METERS` tables | e2e `21` (negative valence → trust low / conflict 82; intensity 90 → strength 90) |
| **Live character bar** — driven by real cast entities (sorted by role), deterministic per-id avatar colour; empty state when no cast | `buildCastMap` / `liveCastNode` / `_relColor`; `RelationshipsPanelBody` | e2e `21` (empty store; both members show) |
| **Chapters + evidence** from the relationship's own occurrences (`OccurrenceService`), plus editor free-text evidence | `liveRelEdge` (occurrence walk) | code + e2e `21` (compare evidence) |
| **Change history** derived from the audit log (create/update/accept/deny/merge on relationship entities) | `buildRelChanges` + `AuditService.loadSync` | code (History + Recent-changes empty states when none) |
| **Hopes / fears** pulled from the focused cast entity's `data.goals` / `data.fears` | `RelationshipsPanelBody` `hopesFears` memo | code |
| **Network graph** — deterministic circular layout over the cast that actually participate in an edge (no more 6 hardcoded positions); legend reflects live types | `RelNetworkView` + `_relLayout` | e2e `21` (both nodes graphed) |
| **Review tab** — pending `relationships` candidates from `ReviewService`; Accept / Edit / Merge / Deny route to the shared, already-wired queue handlers | `buildReviewCards`; `RelReviewView`; `fireQueue` (prefers panel props, falls back to `lw:dispatch-callback`) | e2e `21` (Accept persists an entity; Deny resolves without creating) |
| **Live re-render** — subscribes to the same store events the Cast dossier watches | `RelationshipsPanelBody` effect over `lw:entity-store-updated`, `lw:review-queue-updated`, `lw:occurrences-updated`, `lw:manuscript-chapters-updated`, `lw:set-active-chapter`, `lw:audit-log-updated`, `lw:backend-ready` | code |
| **Cross-panel focus** — a Cast/Timeline selection (`window.focusedByType.cast`) focuses that character | `RelationshipsPanelBody` focus effect | code |

## Buttons wired (all were dead `data-callback` no-ops)

DEAD→wired, now real React handlers dispatching live events:
- **Change type / Add evidence / Create** → open the Relationship entity editor
  (`lw:open-entity-editor` type `relationships`, section hint) on the right record.
- **Create event** → opens the Timeline editor pre-linked to both characters.
- **Show shared places** → opens the Atlas panel.
- **Open dossier** / relationship cards / network nodes → focus the Cast panel or
  hop to the other character's Single view.
- **Review Accept / Edit / Merge / Deny** → the shared `onAcceptQueueItem` /
  `onEditQueueItem` / `onMergeQueueItem` / `onDenyQueueItem` path (same as the
  Review Queue), so accepts persist a real relationship entity and denies resolve
  the candidate — no bespoke duplicate logic.
- **All changes / mode tabs** → switch modes in-panel.

The demo constants remain exported (a dev diagnostics readout in `app.jsx` reads
their `window` globals) but are no longer rendered.

## Robustness notes
- **Edges with an unresolvable endpoint are dropped** (endpoint not a known cast
  entity) so the graph never renders a half-edge or a `?` node. e2e covers it.
- **`sourceQuote` is a string in real candidates** — `buildReviewCards` renders it
  as text and tolerates the legacy `{text}` object shape defensively (never passes
  an object to React).
- Empty states everywhere (no cast, no relationships for a character, no changes,
  no conflicts, no review) — honest, matching the Area 3 live-or-empty stance; no
  demo fallback.

## How to verify
```
npm run validate        # static refs + callback audit (dead rel callbacks removed)
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 21-relationships   # 6 tests
```
Manual: `npm run dev` → add two cast members → extract a chapter that mentions them
interacting (or add a relationship from the editor) → open Relationships → the pair
appears in the bar, the edge shows in Single/Network/Compare with derived meters,
and pending candidates land in Review with working Accept/Deny.

## Deferred from Area 4 (tracked in DEFERRED_BACKLOG.md)
- **Unify the two relationship `data` shapes** — the reader tolerates both
  `fromId/toId/relationshipType` (extraction) and `from/to/bondType/intensity`
  (editor); a later pass could make both writers emit one canonical shape.
- **Explicit per-relationship change tracking** — history is currently derived
  from the coarse audit log; richer trust/type/secret deltas over chapters would
  need dedicated change records.
- **Shared-places / travel line** between two characters (Compare → "Show shared
  places" currently just opens the Atlas) → Atlas area.
