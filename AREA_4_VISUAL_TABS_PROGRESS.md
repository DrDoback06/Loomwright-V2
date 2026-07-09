# Area 4 — Visual tabs go live (progress + handoff)

_Branch: `claude/continue-previous-jevhpt`._

**Goal of Area 4.** Every "visual" workspace panel was originally built against
module-level demo constants (a fixed cast — Aelinor/Saren/Brec… — and fabricated
edges/events/nodes). That meant a real project saw fake data no matter what the
user had actually saved. Area 4 rewires each visual workspace to read the **live
project store** (`EntityService` / `ReviewService` / `ManuscriptChapterService`),
with honest empty states and a functional review→accept loop — matching the
"no dead data" philosophy already applied to Extraction (Area 1), Onboarding
(Area 2), and the Cast dossier (Area 3).

One workspace per pass (own commit, own e2e spec).

## Status

| Workspace | File | State | Test |
|-----------|------|-------|------|
| **Relationships** | `relationships.jsx` | ✅ **Live** | `tests/e2e/21-relationships-live.spec.js` |
| **Timeline** | `timeline.jsx` | ✅ **Live** | `tests/e2e/22-timeline-live.spec.js` |
| **Skill Trees** | `skill-trees.jsx` | ⬜ demo constants (`SKILL_TREES`, `SKILL_ORPHANS`, `SKILL_REVIEW`, `window.ATLAS_CAST`) | — |
| **Atlas** | `atlas*.jsx` | ⬜ demo constants (`ATLAS_CAST/LOCATIONS/QUESTS/FACTIONS/BEASTS/ITEMS`, `ATLAS_QUEUE`) | — |
| **Tangle** | `tangle.jsx` | ⬜ demo sample (there IS a live `TangleService`; the panel body still seeds demo on empty) | — |

## The pattern (follow this for the remaining workspaces)

Both completed passes use the same shape. Copy it.

1. **A `build<Workspace>Data()` builder** near the top of the file that reads the
   live store once and returns a plain data bundle (lists + `byId` indexes +
   the review list + `chapterNumById`). Views receive this via a `data` prop —
   no module-level demo reads, no per-view `window.*` lookups.

2. **Tolerate BOTH persisted shapes.** `EntityService.save(type, fields)` spreads
   `fields` at the **top level** of the entity, while extraction/editor flows nest
   under `entity.data.*`, and `LinkService.appendField` writes to `entity.data.*`.
   So every field read goes through a small picker that checks `data.*` first,
   then the flat entity, across candidate key names:

   ```js
   const _pick = (e, ...keys) => {
     const d = e.data || {};
     for (const k of keys) {
       if (d[k] != null && d[k] !== "") return d[k];
       if (e[k] != null && e[k] !== "") return e[k];
     }
   };
   ```

   Related pickers can be a bare id `"c1"` or an object `{id,name,type}` — resolve
   both. Extraction and the entity editor often use **different field names** for
   the same concept (e.g. timeline `characters` vs event `participants`; relationship
   `fromId` vs editor `from`) — list every alias in the picker call.

3. **Deterministic avatar colour + initials** from the entity id (see `_relColor` /
   `_tlColor`) so cast glyphs are stable without a stored colour.

4. **Live subscription.** The panel body bumps a `storeVersion` on
   `lw:entity-store-updated`, `lw:manuscript-chapters-updated`,
   `lw:review-queue-updated`, `lw:occurrences-updated`, `lw:backend-ready`, and the
   builder is `useMemo`'d on it. Selection state is re-validated against the live
   list in an effect (default to the first live item; never a demo id).

5. **Review tab = live queue.** Read `ReviewService.listSync(type)` filtered to
   `status === "pending"`. The Accept/Edit/Merge/Deny buttons dispatch
   `lw:dispatch-callback` with `{ name: "onAccept<Type>QueueItem", detail: { id } }`.
   The callback registry already routes `/^onAccept\w*QueueItem$/` etc. to
   `acceptQueueItem`, which re-fetches the full row by id, creates the entity from
   `row.suggestedChanges` (carrying the cross-links), and resolves the item — so
   you only need to pass the queue id. Edit dispatches `onEdit<Type>QueueItem`
   (registry opens the shared edit-candidate modal).

6. **Honest empty states.** A full-panel empty when the whole workspace has no
   data, plus per-mode empties. Keep the outer `data-ui="<Workspace>PanelBody"`
   wrapper on the empty state too (tests + host rely on it).

7. **Drop stale `window.*` demo exports** and fix the debug readout in
   `app.jsx` (the Tweaks panel ~line 1500 lists per-workspace counts — point it
   at the live services, as done for Relationships + Timeline).

## Verification per pass

- `npm run validate` — HTML refs + callback audit (0 Bucket A to default notice).
- `npm run test:smoke` — service round-trips.
- `npm run build` — **this compiles every `.jsx` via Babel, so it's the reliable
  syntax gate** in this environment.
- Add a `tests/e2e/<n>-<workspace>-live.spec.js` (T-number) covering: empty state,
  live render (with names that are NOT the demo names, to prove liveness), a
  review→accept loop, and any mode-specific behaviour.

### ⚠️ e2e runner caveat in the web sandbox

`npm run test:e2e` (Playwright) currently **hangs in teardown** in this remote
container — the test body runs and asserts fine, but the page/context close never
resolves, so every test reports a 30 s timeout. This affects the **pre-existing**
specs too (e.g. `20-cast-dossier.spec.js`), so it is an environment limitation of
the runner here, **not** a product regression. The specs are written correctly and
should pass in normal CI.

Until the runner is fixed here, verify behaviour with a self-contained
raw-Playwright script that drives the panel and calls `browser.close()` +
`process.exit(0)` itself (this closes cleanly). Both completed passes were
verified this way — seed live entities via `EntityService.save` /
`LinkService.appendField` / `ReviewService.add`, open the panel with
`lw:open-panel`, assert on the rendered DOM, and exercise the accept loop.
Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; run the dev
server with `npx vite --host 0.0.0.0 --port 5179` first.

## Recommended next pass

**Skill Trees** (`skill-trees.jsx`). It already has a live `SkillTreeService`
(`KEYS.skillTrees`: tree refs → nodeIds + edges + layout; skills live in
`EntityService`), so the wiring is display-side: read trees from
`SkillTreeService`, skill nodes from `EntityService("skills")`, orphans =
skills not in any tree, and the review tab from `ReviewService("skills")`.
Then Atlas (largest — many demo arrays), then Tangle (smallest — a live
`TangleService` already exists).
