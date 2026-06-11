# Loomwright v2 — Build-Out Report

This report maps each Definition-of-Done item to what changed and **how it
was verified in the rendered app**. Verification throughout this build-out
means Playwright assertions on the rendered DOM (real clicks, real screens),
never `window.*Service` calls alone. The environment provided Chromium
(`PLAYWRIGHT_BROWSERS_PATH`, chromium-1194 via `CHROMIUM_PATH`), so every
phase was exercised in a real browser.

Baseline at start: all 199 existing e2e tests passing; `validate`, `smoke`,
`build` green. Final state: the suite has grown to 7 new spec files
(38–44, ~40 new DOM-level tests) and everything runs green.

---

## DoD 1 — Full editors show the live record for the selected entity

**Root cause found:** the backend quarantines `window.ENTITY_SAMPLES` on
real projects, and `applyEntityGlobals` never mirrors cast into
`ENTITY_SAMPLES.cast` — so the Cast Dossier *always* rendered its hardcoded
fallback (Aelinor Vey…), and the 11 other sample-based workspaces rendered
empties or wrong-shaped rows. No workspace received the panel's selection.

**Changed:**
- New shared primitives in `full-workspaces.jsx`: `useLiveEntities`
  (store subscription), `useWorkspaceSelection` (honours a passed
  `entityId`, falls back, re-focuses), `WorkspaceEmptyState`, and
  `FullRecordSection` — a config-driven renderer of every populated
  `ENTITY_EDITOR_CONFIGS` field grouped by schema section, each card with
  an Edit that opens the entity editor at that section. Plus shared
  record/occurrence/chapter helpers (`_fwData`, `_fwOccsFor`, …).
- entityId plumbing end to end: `PanelHeaderActions` (panel-access.jsx)
  sends `panel.selected.id` in `lw:open-panel-workspace`; `openPanelWorkspace`
  (app.jsx) stores it on `panelWorkspace` and forwards it on
  `lw:open-existing-fullscreen`; Atlas and Skill-Tree full-screen editors
  honour it (atlas selects the location; the tree editor opens the tree
  containing the ability node).
- All 12 sample workspaces rewritten live (`workspaces-narrative.jsx`,
  `workspaces-rpg.jsx`): live rosters/filters/tabs, occurrence-fed quotes
  and chapter spans, relationship edges, owners/members/visitors/assigned
  cast, live review counts, persisting equipment-slot drop in the Cast
  Dossier, and a from-scratch live Timeline workspace (book order /
  chronological / per-entity tracks with a focus picker).

**Verified:** `tests/e2e/38-full-workspaces.spec.js` (8 tests): fresh
project shows `WorkspaceEmptyState` in all 12 with
`not.toContainText("Aelinor Vey")`; seeded records render in roster + hero +
`FullRecordSection`; opening with an entityId selects that row
(`.fws-roster__row.is-selected[data-entity-id=…]`); a live rename re-renders
without reload; FRS Edit opens the editor on the record; and the REAL
panel-header button path (click row → click "Open Dossier View") opens
focused on the clicked character.

## DoD 2 — Cross-tab context (incl. two cast → their relationship)

**Changed:** the broadcast plumbing existed but had zero consumers.
- `panel-stack.jsx` now injects the owning panel into `onSelectEntity`
  (type-matched, with the atlas→locations pairing), so every body's click
  lands in `panel.selected` *and* `focusedByType`; the row's own type wins
  over the panel's.
- Consumers added: Items / Quests / Events / Timeline / Cast filter rows by
  `panelContext.focusedEntity` (generic structured-reference scan);
  Relationships centres on a focused cast member; Atlas pushes the focus
  onto the map and selects focused locations. Fixed `onClearPanelFilter`
  (state update inside a `setPanels` updater that React dropped) and a
  long-standing paper cut where bring-to-front on header `mousedown`
  reordered the DOM mid-click and swallowed clicks on every non-front
  panel's header controls.
- Pair view: Ctrl/Cmd-selecting exactly two cast offers **View
  relationship** → new `RelationshipPairView` (bond type, strength/trust/
  conflict meters, secret badge, evidence quotes, shared chapters +
  co-mention quotes via new `LinkService.pairContextSync`), with a
  prefilled create CTA when no bond exists; `lw:pair-focus` drives the
  Relationships panel's existing compare mode.

**Verified:** `tests/e2e/39-context-pair-lock.spec.js`: selecting a cast
member filters the Items panel to their belongings with the "Filtered by"
chip (and the chip clears); the pair flow renders bond + meters and flips
the Relationships panel into Compare with both names; the no-bond CTA opens
the prefilled relationship editor.

## DoD 3 — Lock / keep-selected across tabs (desktop + mobile)

**Changed:** new `SelectionLockService` (ordered list in localStorage,
`lw:locks-updated`); lock toggle in every entity panel header
(`PanelChrome`); `LockTray` chips — floating pill above the panel stack on
desktop, a chips row above the bottom nav on mobile ("Cast: Aelinor");
first-ever listener for the previously dead `lw:focus-entity` event (which
also revived three existing "Show on Atlas" flows); panels seed and follow
`panel.selected`, so locks survive close/reopen and full reloads. Precedence:
lock sets the initial selection; a manual click wins while the panel is
open; a chip tap re-asserts.

**Verified:** spec 39: lock → tray chip + `lw:v2:selection_locks` persisted →
panel close/reopen auto-selects → full reload (no IDB clear) still selected →
tray unlock clears; chip tap re-asserts after picking another row; mobile
viewport shows the tray as a chips row sitting above the bottom nav
(bounding-box assertion). The mobile suite (35) stays green.

## DoD 4 — Tangle + every listed tab discoverable (incl. Abilities)

**Changed:** removed `soon:true` (workspace.jsx) and the dead
`routeId === "tangle"` branch (app.jsx); palette commands "Open Tangle
board" / "Open Tangle canvas (full screen)" — and fixed a real
discoverability defect where the palette's whole navigation group vanished
in live-index mode. **Abilities** rebuilt from a deprecation card into a
working catalogue of powers (skills + legacy records): type filter, live
detail (effects/requirements), Edit into the editor, drag payloads, and a
"Tree" hop that opens the Skill-Tree editor focused on the ability's node.

**Verified:** 28-tangle spec (palette opens panel + cold canvas; nothing
says "coming soon"); `43-surface-sweep.spec.js` proves Abilities is its own
working surface (roster → detail → Edit opens the editor; never the
compatibility card).

## DoD 5 — Today/Home are a real, code-first editor (zero tokens)

**Changed:** new `InsightService` in backend-services.jsx with an
event-invalidated cache. Detectors: **staleness** (mentions ≥3 chapters
behind; untouched ≥14 days), **incomplete** (≥2 missing key fields per type,
deep-links to the editor section), **orphans** (no occurrences, no inbound
or outbound references), **broken links** (relationship endpoints that
resolve to nothing — severity high), **stalled threads** (open quests/events
silent for 2+ chapters), **contradictions** (per-cast regex sweeps across
chapter texts for eye colour / honorific titles / sworn allegiances, with
quoted evidence; upgraded to high when canon/intel carries a "not/never"
rule — replacing the old trivial check), plus possession conflicts from the
ownership ledger. Today's placeholder sections (threads, callbacks & motifs,
intel gaps) now fill with these cards (dismissible, persisted); Home gains a
"Needs attention" card whose rows open the editor at the offending section.

**Verified:** smoke suite gains six deterministic `[insights]` checks;
`tests/e2e/40-insights.spec.js` seeds a contradictory eye colour, a stalled
quest, an orphan and a broken bond, then asserts the cards render under the
right Today filters, broken links rank high, and the Home card's click opens
the entity editor.

## DoD 6 — Extraction end-to-end + depth, offline

**Changed:** four new zero-token detectors beside the existing eight
(settings sliders extended to match): **dialogue attribution** (known
speakers collect the line as a voice sample; unknown speakers with ≥2 lines
become candidates), **role epithets** ("the baker" — apposition-aware so
"the gatekeeper, an old man named X" never mis-attributes; recurring
unnamed epithets become their own candidates), **event chaining** (causal
connectors record cause → effect with the quote), **faction allegiance**
(swore/pledged/banner-of binds cast → faction). `buildOwnershipLedgerSync`
assembles per-item ownership timelines and flags conflicts into the insight
engine. Item ownership writes were also unified onto the schema's
`currentOwner` (the old `assignOwner` wrote a field nothing read — a silent
no-op fixed alongside).

**Verified:** `tests/e2e/41-extraction-depth.spec.js` (6 tests) covers each
detector at the review-queue level and the full path: prose → extraction →
review panel DOM → Accept → the occupation lands on the entity → rendered
in the Cast tab AND the full dossier's FullRecordSection. All 8 existing
extraction specs stay green (37's known-vs-new invariant drove the
apposition tightening).

## DoD 7 — AI fidelity + excellent no-provider path

**Changed:** `AIContextBuilder.build` now emits structured, imperative
sections instead of one weak "Style:" line — **Style directives** (POV,
tense, tone keywords, genre, the onboarding style guide with voice
metrics), **Avoid (hard constraints)** (`Do not:` lines from
`intel.forbidden` + the style avoid list), **Canon (never contradict)**,
and **Project foundation** for writing tasks (previously never sent at
all). The AI Writer's Generate, with no provider, renders a deterministic
**DRAFT BRIEF** assembled from the exact context the model would receive —
alongside the existing specific notice, never a dead end. The Writer's Room
AI toolbar (Revise/Continue/Write…) now opens the AI Writer in that mode.

**Verified (zero real tokens — no provider key exists in this
environment):** `tests/e2e/42-ai-fidelity.spec.js` stubs fetch and records
request bodies: the prompt carries the style directives, avoid terms,
canon, and the user instruction; the mocked completion renders in the
preview; the **Anthropic and Gemini adapters round-trip** their wire
formats (Gemini, claimed unimplemented in the brief, works); the
no-provider brief renders with real project context. Spec 26's old
"preview stays empty" assertion was updated to the new, better behaviour.

## DoD 8 — Whole-app sweep: no dead buttons, no dead ends

**Changed/verified:**
- `tests/e2e/43-surface-sweep.spec.js` iterates the same registries the app
  navigates by — every route, every NAV panel, every PANEL_ACCESS workspace,
  plus the two "existing" full-screen editors — asserting rendered roots,
  no `Missing preset`, no `Workspace not registered`, and **zero page/console
  errors** on a fully seeded project. (It immediately caught and led to the
  fix of a real `cx=NaN` SVG crash in the Atlas mini-map.)
- A static scan for `data-callback` buttons with neither a React handler nor
  a registry branch found 16 truly dead controls; all are now wired with
  real behaviour: item Transfer/Trade/Assign-owner (ownership section picker
  + logged transfers), Equip/Unequip/Drop (real status+owner writes),
  Upgrade item/ability (editor at effects), Duplicate class/race (real
  clone), Today card dismiss (persisted), Writers-Room AI toolbar (mode
  hop), atlas queue Process-all (bulk accept), queue Show-on-Atlas, atlas
  co-presence chips, atlas layer lock (persisted; locked layers pin their
  visibility), Settings reset-layout / clear-caches / show-last-handoff.
  The scan now reports **0 remaining bare dead buttons**, and the audit
  keeps reporting 0 action-shaped callbacks reaching the generic notice.
- The audit's verbose mode now prints the default-notice callback list
  (scripts/audit-callbacks.js) so this stays inspectable.

## DoD 9 — Help panel + guided tour on every surface

**Changed (new framework):** `help-content.jsx` (registry: every route,
every panel — including refs/recent/notifs — and every registered
workspace, keyed to **real selectors**), `help-system.jsx` (`HelpService`
with persisted seen-state, `HelpButton`, `HelpOverlay` with per-control
"show me" target flashing and an on-screen/other-state distinction,
`CoachmarkTour` with a rect-tracking spotlight ring, keyboard navigation,
and a centred-card mobile/missing-target fallback, `HelpHost`), `help.css`.
"?" affordances: shell topbar, every panel header, every workspace topbar,
and the mobile More sheet. The topbar "?" resolves what you're actually
looking at (open workspace → front panel → route). Content covers the new
lock/pair/insight features and the palette/wheel overlays.

**Verified:** `tests/e2e/44-help-tour.spec.js`: "?" present on all three
chromes and the More sheet; the overlay lists ≥3 real controls for the
active surface; a registry-completeness test fails the build if any nav
surface or workspace lacks an entry; the tour's spotlight ring tracks the
real target's bounding box, steps walk to Done, and completion persists in
`lw:v2:help_seen`; on mobile the overlay presents as a bottom sheet.

## DoD 10 — Gates

`npm run validate`, `npm run test:smoke` (now including the insight
determinism checks), and `npm run build` are green at every commit; the
full e2e suite (44 spec files) runs green under
`CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test`.
(Note for CI parity: the environment's Playwright version wants
chromium-1223; the pinned `CHROMIUM_PATH` is how this sandbox runs the
suite against its provisioned chromium-1194.)

## DoD 11 — This report.

---

## Deliberately deferred (and why)

- **Per-brief §7 out-of-scope:** multi-project, cloud sync, managed AI
  provider, packaged grammar/spell engines, bundle minification — untouched,
  as instructed. Generated artifacts (`Loomwright.bundle.jsx`, standalone
  HTMLs, `dist/`) were never hand-edited; the build regenerates them from
  `Loomwright Shell.html`'s script list (new files: `help-content.jsx`,
  `help-system.jsx`, `help.css`).
- **AI streaming + cost-mode routing depth:** the wiring is correct and
  verified via stubs; streaming remains unimplemented (no UI depends on it)
  and routing cost-modes stay nominal — both are provider-polish beyond the
  no-provider-first posture this brief prioritised.
- **Atlas layer lock semantics** are intentionally minimal (persisted lock
  that pins a layer's visibility) — the map editor has no other
  layer-mutating gestures for a lock to guard yet.
- **`__LW_LAST_SELECTION__` fallback** covers any future panel body that
  bypasses `onSelectEntity` when carrying selection into a workspace; all
  current bodies use the primary path.

## New surface introduced (for future maintainers)

- Services: `SelectionLockService`, `InsightService.computeInsights`,
  `LinkService.pairContextSync`, `buildOwnershipLedgerSync`,
  `LinkService.dropItem`; detectors `detectDialogueAttribution`,
  `detectRoleEpithets`, `detectEventChaining`, `detectFactionAllegiance`.
- Components/hooks: `useLiveEntities`, `useWorkspaceSelection`,
  `FullRecordSection`, `WorkspaceEmptyState`, `RelationshipPairView`,
  `LockTray`, `HelpService`/`HelpButton`/`HelpOverlay`/`CoachmarkTour`/
  `HelpHost`, rebuilt `AbilitiesPanelBody`.
- Events: `lw:pair-focus`, `lw:locks-updated`, `lw:open-help`,
  `lw:aiwriter-set-mode`, `lw:reset-panel-layout`, `lw:show-handoff-pack`;
  first listener for `lw:focus-entity`; `entityId` added to
  `lw:open-panel-workspace` / `lw:open-existing-fullscreen`.
- Specs: `tests/e2e/38-full-workspaces` … `44-help-tour`.
