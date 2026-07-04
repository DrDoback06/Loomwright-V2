# User Acceptance Regression Audit — original complaints vs current app behaviour

_Created on branch `claude/user-acceptance-regression-audit`, post-PR #13._

## Framing (important)

The backend service work from PRs #3–#13 is **implemented and tested** and
is **not** being rebuilt. The defect this pass addresses is narrower and
specific: **parts of the visible render layer still show design/demo
constants instead of reading the live project store.** That is why the app
can pass service + e2e tests yet feel fake to a user — and it is compounded
by the fact that the prior e2e suite drove `window.LoomwrightBackend.*`
through `page.evaluate` and almost never clicked real UI or asserted on
rendered DOM (only `tests/e2e/01-boot…` clicks anything).

Status (after pass 2 `claude/uat-remediation-pass`): **"Local beta candidate."**
The visible Writer's Room and workspace interactions are now functional or
explicitly deferred with no fake UI left behind. See `UAT_REMEDIATION_REPORT.md`
for the full pass-2 outcomes and the (browser-only) e2e/screenshot caveat.

## Baseline (Phase 0, this branch)

```
npm run validate         → 526 UI callbacks; 558 handlers; Bucket A = 0 ✓
npm run test:smoke       → all smoke checks passed ✓
npm run test:e2e         → 75 passed ✓
npm run build            → production build checks passed ✓
npm run test:e2e:preview → 2 passed ✓
```

## Root-cause summary (confirmed by reading code)

| Root cause | Evidence | Effect |
|------------|----------|--------|
| `decoratePanel` bails when store empty | `backend-services.jsx:432` `if (!entities.length) return panel;` | Empty store keeps panel's hardcoded demo rows + fake subtitle |
| Panel presets carry demo rows + fake subtitles | `app.jsx:51–76` `PANEL_PRESETS.cast/.timeline` rows + "12 entries · 3 in review" | Fresh project shows Aelinor/Saren/etc. |
| Left-rail queue badges hardcoded | `brand.jsx:80–118` `NAV_ITEMS` `queue: 4/12/3/...`; `app.jsx:891` sums them | Fake rail badges + fake top-bar queue total |
| `tangle` marked `soon:true` | `brand.jsx:104` | Tangle rail item disabled though TangleService works |
| Today suggestions static | `today-ai.jsx:16` `TODAY_SUGGESTIONS` | Today always shows invented prompts |
| Home dashboards static | `home.jsx` `HOME_MANUSCRIPT/REVIEW/PI/WARNINGS/ENTITY_HEALTH` + "Saren's Bargain" chip | Home shows fake stats (Recent Activity is live) |
| Related-pickers read `ENTITY_SAMPLES` | `entity-editor.jsx:223` `EERelatedPicker` | Pickers don't show user-created cast (live cast goes to `CAST_SAMPLE`), and show samples by default |
| Skill-tree assign/connect/lock React-local | `skill-trees.jsx`; no registry handlers | Changes don't persist |

## Complaint table (statuses finalized after the DOM-level UI suite runs)

| ID | Original complaint | Current status | Evidence | Severity | Fix now? | Follow-up |
|----|--------------------|----------------|----------|----------|----------|-----------|
| 1 | Sample data loads by default | **Fixed** (render reads live store; fresh = empty) | decoratePanel; PANEL_PRESETS; e2e T | High | Done | — |
| 2 | "Start writing" / editable canvas | **Fixed (pass 2)** — body is now an editable contentEditable region; Start writing seeds+focuses; Save persists; reload restores; Save&Extract runs on the saved body | `writers-room.jsx` EditableManuscriptBody; `ManuscriptChapterService`; e2e | High | Done (pass 2) | live highlight-while-typing → PR `incremental-decoration` |
| 3 | Toolbar buttons did nothing | **Fixed (pass 2)** — bold/italic/underline/strike + spellcheck + notes wired; non-functional buttons disabled with a reason | `writers-room.jsx` ManuscriptToolbar | UX | Done (pass 2) | heading/quote/scene-break/find as real actions = future |
| 4 | Chapter reorder; delete tiny | **Fixed for beta (pass 2)** — persisted create/delete + visible Move Up/Down; fake drag handle removed; honest confirm copy | `ManuscriptChapterService.deleteChapter/moveChapter`; e2e | Medium | Done (pass 2) | drag reorder → PR `chapter-strip-drag` |
| 5 | AI Writer buttons decorative | **Fixed** (PR #12 routing + guard) | `callback-registry.jsx` Bucket B | Low | Done | — |
| 6 | Active author dropdown cycles | **Fixed (pass 2)** — selector opens a live popover/list and persists `activeAuthorId`; neutral "You" default (no demo authors) | `writers-room.jsx` AuthorSelector; `SettingsService`; e2e | Low | Done (pass 2) | inline coloured author-diff segments = future |
| 7 | Placeholders throughout | **Fixed for beta (pass 2)** — always-on floating toolbar removed (now selection-driven); dead toolbar buttons disabled with tooltip; fake status counts wired | `writers-room.jsx`; `app.jsx` | Medium | Done (pass 2) | implement disabled toolbar actions = future |
| 8 | Review queue accept/merge/deny/edit | **Fixed** (DOM-reachable + accept shape bug fixed) | panel-stack.jsx; e2e T | High | Done | — |
| 9 | Focus mode exit unclear | **Fixed** (visible Exit + Esc) | writers-room.jsx; e2e T | UX | Done | — |
| 10 | Today/Home fake data | **Fixed** (live store; empty states) | today-ai.jsx; home.jsx; e2e T | High | Done | — |
| 11 | Extraction does nothing | **Fixed (pass 2)** — Save&Extract now invokes `ExtractionService.runExtraction` against the saved body and refreshes the review margin | `writers-room.jsx` runExtractionFlow; e2e | Medium | Done (pass 2) | AI streaming = future |
| 12 | Inline annotation numbers unclear | **Fixed (pass 2)** — entity/occurrence markers carry `title`+`aria-label`; hover chip shows the real mention count | `writers-room.jsx` `_wrHighlightHtml`; e2e | Low | Done (pass 2) | dedicated stale/relink marker visual = future |
| 13 | Speed Reader pivot alignment | **Fixed (pass 2)** — before/pivot/after render in a symmetric grid so the pivot letter stays centred on a fixed guide (panel + workspace) | `speed-reader.css`; `speed-reader.jsx`; e2e | UX | Done (pass 2) | — |
| 14 | Item linked pickers / not in tab | **Fixed for beta (pass 2)** — items config exposes live pickers (owner/location/stat/quest/event/class) via `EERelatedPicker`; links persist + export | entity-editor-configs; e2e | High | Done (pass 2) | structured ownership/transfer-history editor = future |
| 15 | Duplicate quest/event ledgers | **Fixed** (shared store) | `EntityService` single store | Low | Done | — |
| 16 | Tangle opened Create Location | **Fixed** (TangleService wired; rail enabled) | callback-registry; brand.jsx | Medium | Done | — |
| 17 | Skill Tree create/edit/assign | **Fixed for beta (pass 2)** — live `SkillTreeLiveManager`: create tree/node, rename, connect, assign cast/class, lock — all persist; fresh = empty | `skill-trees.jsx`; `SkillTreeService`; smoke + e2e | Medium | Done (pass 2) | visual constellation canvas → PR `skill-tree-canvas` |
| 18 | Relationships for new actors | **Fixed** (persist pass) | smoke; e2e M | Low | Done | — |
| 19 | Notes/comments on text blocks | **Fixed (pass 2)** — `ManuscriptNoteService` paragraph notes: add (caret/selection), edit, resolve, delete, click-to-focus; persist + reload | backend-services.jsx; writers-room.jsx; smoke + e2e | Medium | Done (pass 2) | range/selection-anchored comments → PR `range-comments` |
| 20 | Search global | **Fixed** (PR #10) | `SearchService`; smoke; e2e P | Low | Done | — |
| 21 | Sidebar counts fake/stale | **Fixed** (rail badges + subtitles live) | app.jsx; decoratePanel; e2e T | High | Done | — |
| 22 | Active References / current context | **Fixed (pass 2)** — "Current Chapter Context" card (mentioned entities + linked references + pending review) with quick-open | `writers-room.jsx` CurrentChapterContext; e2e | Medium | Done (pass 2) | richer canon-intel surfacing = future |
| 23 | Today useful live work | **Fixed** (live builder + empty state) | today-ai.jsx; e2e T | High | Done | — |
| 24 | Home project dashboard | **Fixed** (live stats + empty states) | home.jsx; e2e T | High | Done | — |
| 25 | Save/local-only status real | **Fixed for beta (pass 2)** — `syncState` reflects the real Save/extract lifecycle; bottom strip shows real last-saved time, live word count, live author; local-only blocks AI | app.jsx BottomStatusStrip; writers-room onSave; AIRouting | Low | Done (pass 2) | live-ticking relative timestamp = future |
| 26 | App-wide action audit | **Fixed** (Bucket A = 0) + 2 UAT passes | `npm run validate` | Low | Done | — |

## Fixes made this pass (all contained — live-render, no redesign)

The dominant defect was a **render-layer demo-data leak**: bespoke panel
bodies and dashboards rendered from hardcoded `*_DATA` / `*_SAMPLE`
constants instead of the live store, so a fresh project showed Aelinor
Vey / Saren of Hess / Pale Reach and fake counts. Fixed at the source:

1. **`backend-services.jsx` `decoratePanel`** — now always recomputes
   `rows` / `entities` / `cast` / `queueCount` / a live `subtitle`
   **including the empty case** (was: `if (!entities.length) return panel`,
   which kept demo rows).
2. **`app.jsx` `PANEL_PRESETS`** — stripped the hardcoded `cast`/`timeline`
   demo rows and the fake subtitles ("12 entries · 3 in review", "2 active"…).
3. **`brand.jsx` `NAV_ITEMS`** — removed all hardcoded `queue:` badge
   numbers; un-disabled Tangle (`soon:true` removed). **`app.jsx`** now
   computes live left-rail badges + `globalQueueCount` from `ReviewService`.
4. **Bespoke bodies switched to the live store** (never demo fallback):
   `cast.jsx` (CastPanelBody), `upgrades-bestiary-factions.jsx`
   (Bestiary + Factions), `upgrades-stats.jsx`, `upgrades-quests-events.jsx`
   (4 list sources), `upgrades-locations.jsx`, `upgrades-items.jsx`.
5. **Removed demo self-seeds into `window.ENTITY_SAMPLES`**
   (`upgrades-*` files) that polluted the framework panels + pickers
   app-wide. `_mergeRpgSamples` in `rpg-entities.jsx` retained (it only
   feeds the explicit sample-project snapshot).
6. **`entity-editor.jsx` `EERelatedPicker`** — pickers read live
   `EntityService.listSync(type)` first (cast pickers previously never
   showed user cast, which lives in `CAST_SAMPLE`); empty-state row
   "No matching … yet" added.
7. **`today-ai.jsx`** — `TodayPanelBody` + `TodayScreen` render from a
   live `buildTodaySuggestions()` (quests with open steps, pending review,
   recent chapters), with an empty state. Static `TODAY_SUGGESTIONS` no
   longer rendered.
8. **`home.jsx`** — manuscript/review/entity-health/PI stats now derive
   from live services; recent-activity no longer falls back to demo rows;
   continuity warnings are empty until a real check runs; removed the
   hardcoded "Saren's Bargain" chip.
9. **`writers-room.jsx`** — focus mode now has a visible "Exit focus mode"
   button + Escape-to-exit.

## Verification

```
npm run validate         → 526 UI callbacks; 558 handlers; Bucket A = 0 ✓
npm run test:smoke       → all smoke checks passed ✓
npm run test:e2e         → 85 passed (75 prior + 10 new DOM-level UI acceptance) ✓
npm run build            → production build checks passed ✓
npm run test:e2e:preview → 2 passed ✓
```

> **Review queue was unreachable in the UI (new finding, now fixed).**
> The accept/merge/deny LOGIC was wired + service-tested, but no rendered
> surface exposed the cards — no panel showed a working review affordance.
> Fix: `panel-stack.jsx` now renders the existing (wired) `EntityReviewQueue`
> cards at the top of an entity panel whenever that type has pending items,
> so Accept/Edit/Merge/Deny are clickable in the actual UI. Also fixed a
> real bug: `acceptQueueItem` only read `payload.name`/`name` and ignored
> the `candidate` object the card displays, so accepting a candidate
> created nothing — it now honours `row.candidate`.

New DOM-level suite `tests/e2e/15-ui-acceptance.spec.js` (10 tests) CLICKS
real rendered DOM and asserts on rendered content (it does not drive
services to fake a pass):
- fresh project renders NO demo data on Home / Today / Cast (asserts the
  specific demo names + fake counts are absent);
- fresh project has a live left-rail queue (0);
- **create an entity through the UI** (click create → fill name → click
  Save) → it appears in the rendered Cast panel;
- **left-rail review badge is live** (seed 2 items → rail reflects 2);
- **sample project is opt-in** (DOM click "Load sample project" → records
  appear; fresh did not);
- **focus mode** has a visible Exit affordance (DOM toggle + exit);
- item editor related pickers show no demo entities on a fresh project.

## PR #14 verification note (answering the requested checklist)

Each item below is backed by an automated DOM-level test in
`tests/e2e/15-ui-acceptance.spec.js` (workflow T) unless noted. These
CLICK rendered DOM and assert rendered content; `page.evaluate` is used
only to seed setup state, never to perform the action under test.

1. **Fresh project renders no sample/demo data** — ✅ asserts the
   strings "Aelinor Vey", "Saren of Hess", "Pale Reach",
   "Saren's Bargain", "Captain Brec" and fake counts ("12 entries",
   "3 in review") are **absent** on Home, Today, and Cast; empty states
   shown. (Also re-probed across cast/locations/items/quests/events/
   bestiary/stats/home → 0 demo strings.)
2. **UI-created records appear + persist** — ✅ create a Cast member
   through the rendered editor (click → fill name → click Save) → it
   appears in the rendered Cast panel; service confirms persistence.
3. **Entity pickers read the live store** — ✅ a fresh-project item
   editor's related pickers show no demo names; pickers read
   `EntityService.listSync` (cast pickers now show user-created cast,
   which previously lived only in `CAST_SAMPLE`).
4. **Sample project is truly opt-in** — ✅ fresh store is empty (0); a
   real DOM click on "Load sample project" populates records; clearing
   removes sample-tagged records while user-created entities remain
   (existing smoke + e2e H also cover scoped clear).
5. **Home and Today are live** — ✅ fresh = empty states; stats/counts
   derive from live services; no hardcoded dashboard data; the
   "Saren's Bargain" chip removed.
6. **Review Queue is DOM-tested** — ✅ **Accept** clicked on the
   rendered card creates the entity and clears the item; **Deny** clicked
   removes it from pending; **Merge** clicked opens the merge modal.
   (Required making the review cards reachable + fixing the accept
   candidate-shape bug — see note above.)
7. **Focus mode** — ✅ entering focus mode shows a visible "Exit focus
   mode" button; clicking it (and Esc) exits.
8. **Final commands** — ✅ `npm run validate` (Bucket A = 0),
   `npm run test:smoke`, `npm run test:e2e` (85), `npm run build`,
   `npm run test:e2e:preview` (2) — all green.

## Counts (26 complaints)

_Final after pass 2 (`claude/uat-remediation-pass`). No vague categories remain._

- **Fixed:** 1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 18, 19, 20, 21, 22, 23, 24, 26 (21)
- **Fixed for beta (named future polish):** 4, 7, 14, 17, 25 (5)
- **Explicitly deferred (whole complaint):** 0 — all deferrals are scoped *within*
  fixed items (drag reorder, live highlighting, range comments, skill-tree canvas).
- **Needs manual UX review:** 0
- **Still broken / not built:** 0
- **Obsolete:** 0

## Follow-ups (future PRs, after pass 2)

Scoped deferrals *within* otherwise-fixed items — no complaint is left
unaddressed (full detail in `UAT_REMEDIATION_REPORT.md`):

- `chapter-strip-drag` — drag-and-drop chapter reorder (Move Up/Down shipped, #4).
- `incremental-decoration` — live entity highlighting while typing (refreshes on
  Save/Extract today, #2/#12).
- `range-comments` — precise text-range comments (paragraph notes shipped, #19).
- `skill-tree-canvas` — visual constellation drag-positioning editor (live list
  manager shipped, #17).
- Minor polish: real heading/quote/scene-break/find toolbar actions (#3/#7),
  structured item ownership-history editor (#14), stale-occurrence marker visual
  (#12), live-ticking save timestamp (#25).
