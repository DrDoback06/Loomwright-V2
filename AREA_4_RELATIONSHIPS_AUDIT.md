# Area 4 — Relationships tab goes live: completion & audit reference

_Status: implemented, ready for audit._

The Relationships workspace (`relationships.jsx`) was entirely demo-driven —
every view read the `RELATIONSHIPS` / `REL_EVIDENCE` / `REL_CHANGES` /
`REL_REVIEW` / `REL_HOPES_FEARS` constants and `window.ATLAS_CAST`, so a real
project's characters never appeared and accepted relationship candidates were
invisible. Area 4 rewires the whole panel to the live store, mirroring the
Area 3 Cast-dossier pattern, while preserving every CSS class so the parchment
styling is untouched.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Live cast in the mode bar + all views** — reads the `cast` entity collection, derives a stable avatar colour (hash of id) + initials (`glyphChar`) | `relationships.jsx` `buildRelationshipsModel` (`castById`), `_relColor`, `_relInitials` | e2e `21` (mode bar lists live cast, not `ATLAS_CAST`) |
| **Relationships from two live sources, merged/deduped by unordered pair** — (a) persisted `relationships` records (`data.fromId`/`data.toId`/`data.relationshipType`), (b) per-cast related-multi fields (`family`/`lovers`/`allies`/`mentors`/`rivals`/`enemies`) | `buildRelationshipsModel` edge collector (`addEdge`, `_REL_CAST_FIELDS`); type canonicalised via `_relTypeNorm` + `_REL_TYPE_ALIASES` | e2e `21` (persisted record → Enemy edge; allies field → Friend edge) |
| **Meters derived, not faked** — strength scales with real co-occurrence count; trust/conflict follow the relationship type; persisted `data.strength/trust/conflict` win when present | `_deriveMeters`, `_REL_TYPE_METERS`, `sharedChapters` (from occurrences) | e2e `21` (Compare meters render) |
| **Compare evidence from real occurrences** — quotes pulled from either participant in the chapters where they co-occur, plus persisted `data.evidence` | `relEvidenceFor` | e2e `21` (occurrence quotes appear as evidence) |
| **History / timeline from real signal** — persisted `data.changes`, else a derived "first appear together" event from the earliest shared chapter | `buildRelationshipsModel` changes loop; `RelTimelineView` | code + e2e `21` (single-view recent changes) |
| **Live review queue** — pending `relationships` candidates from `ReviewService.listSync("relationships")`; Accept/Edit/Merge/Deny dispatch the **real** generic handlers with the queue item | `RelReviewView` + `_relDispatch` (`onAccept/Edit/Merge/DenyRelationshipQueueItem` → existing regex handlers) | e2e `21` (Deny resolves the real queue item) |
| **Network graph over live cast** — circular layout for N participating cast (falls back to all cast), conflict halos + secret dashes from live meters | `RelNetworkView` (dynamic positions) | e2e `21` (node per participating cast) |
| **Live refresh** — recomputes on `lw:entity-store-updated`, `lw:occurrences-updated`, `lw:manuscript-chapters-updated`, `lw:review-queue-updated`, `lw:set-active-chapter`, `lw:backend-ready` | `RelationshipsPanelBody` effect + `useMemo([storeVersion])` | code (mirrors `CastPanelBody`) |
| **Cross-panel focus** — a Cast selected elsewhere (`window.focusedByType.cast`) or `panel.selected` preselects that character in Single view | `RelationshipsPanelBody` `focusedCast` / `defaultChar` | code |
| **Graceful empty states** — no cast → "No characters yet"; no relationships → per-view empties; no manuscript → "Not yet in the manuscript" | `RelEmptyPanel` + per-view guards | e2e `21` (empty project shows empty state, no demo Aelinor) |
| **Compare "Edit relationship / Change type"** — persisted record opens in the Entity Editor (`lw:open-entity-editor`, `initial:{id}`); a derived-only pair routes to `onCreateRelationship` | `RelCompareView` `editRel` | code |
| **Diagnostics stay honest** — `window.RELATIONSHIPS/REL_CHANGES/REL_REVIEW` now reflect the live model (read by the Tweaks debug panel) | `buildRelationshipsModel` window stash | code (`app.jsx:1503`) |

## How to verify

```sh
npm run validate     # UI callbacks still resolve; 0 unwired Bucket A actions
npm run build        # precompiles relationships.jsx into the production bundle
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 21-relationships   # 7 tests
```

### Manual smoke (no AI key)
1. `npm run dev`, open `Loomwright Shell.html`.
2. Add two characters to the Cast (or extract them). Open **Relationships**.
3. The mode bar shows *your* characters. Link one as another's ally in the
   Cast dossier → it appears as a Friend edge in Single + Network.
4. Run an extraction over a chapter mentioning both by name in a
   relationship phrase → the **Review** tab fills; Accept lands a real
   `relationships` record that then shows as a live edge with meters.

## Design decisions / honesty notes

- **No fabricated meters.** The demo shipped invented strength/trust/conflict
  numbers. Live meters are *derived transparently*: strength from real
  co-occurrence frequency; trust/conflict from the relationship type; any
  persisted value overrides. This keeps the bars meaningful rather than
  theatrical, and they get richer as the manuscript grows.
- **Two relationship sources unified.** Extraction persists standalone
  `relationships` records; authors also link allies/rivals directly on a
  character. Both are shown, deduped by unordered pair, with the persisted
  record winning on identity (so it carries the editable id).

## Deferred from Area 4 (tracked in DEFERRED_BACKLOG.md)
- **Per-relationship trust/conflict editing UI** — the Entity Editor opens the
  record, but a dedicated meter editor + evidence-pinning surface is a later
  polish pass.
- **Atlas "shared places" cross-filter** (`onOpenAtlasForSharedLocations`) —
  removed from the compare actions for now; lands with the Atlas focus area.
- **Faction relationships** — the `faction` type exists but character↔faction
  edges await the Factions live pass.
