# Loomwright v2 — Autonomous Build-Out Brief (for the Fable agent)

You are the senior engineer who is going to take Loomwright v2 from
"looks finished" to "actually works, end to end." Work autonomously and
**keep going until the Definition of Done at the bottom is fully met** —
don't stop after one pass, don't hand back a list of things for me to do.

Loomwright is a **local-first worldbuilding / story tracker**. A writer
drafts chapters in the **Writer's Room**; the app **extracts** entities
(characters, locations, items, factions, quests, events, lore,
relationships, stats, abilities…) from that prose and turns them into
structured, browsable records shown in **tabs** (compact panels) and
**full editors** (full-screen dossier workspaces). It should feel like a
quick-glance world bible *plus* an always-on editor that tells the writer
where to work next — with as much as possible done in plain code so it
works without spending AI tokens, and AI used only to make good things
better.

---

## 0. THE ONE RULE THAT MATTERS MOST

**Verify every change in the running, rendered app — never at the code or
service layer alone.**

The previous build "passed" because it was checked by calling backend
services and node tests, while the actual on-screen UI still showed demo
data and ignored real state. Their own notes admit this (the
"services correct, DOM shows demo data" class of bug). That class of bug
is **still present today** (see §2). So:

- A task is **not done** until you have opened the real app, performed the
  real user action with the mouse/touch, and seen the correct result
  rendered on screen (or proven it with a test that asserts on rendered
  **DOM**, not on `window.*Service` calls).
- **Distrust the docs.** The many `*_AUDIT.md` / `*_REPORT.md` /
  `*_HOOKUP.md` / `IMPLEMENTATION_STATUS.md` / `DEFERRED_BACKLOG.md` files
  describe *intent* and repeatedly claim things are "done and verified"
  that are not. Treat every "done" claim as a hypothesis to test in the
  UI, not a fact.

### How to verify (handle both environments)
First, **find out what your environment can do**, and record it in your
working notes:
1. Try to run the app: `npm install` then `npm run dev` (dev shell loads
   the `.jsx` files via in-browser Babel from `Loomwright Shell.html`).
   Production path is `npm run build` → `npm run preview`.
2. Try to drive a real browser (Playwright is already set up:
   `npm run test:e2e`, config in `playwright.config.js`; it needs
   Chromium — `npx playwright install chromium` or set `CHROMIUM_PATH`).
- **If you can drive a browser:** every fix must be exercised by clicking
  through the real UI and/or by a Playwright test that asserts on rendered
  DOM. Extend the existing `tests/e2e/` suite — do not delete its DOM-level
  assertions.
- **If you cannot drive a browser:** you must still verify at the render
  layer by **writing/extending Playwright specs that assert on the DOM**
  and reasoning precisely about the React render path, plus the node smoke
  suite. Never accept a `window.LoomwrightBackend.*Service` call as proof
  that the UI works.

---

## 1. HOW TO WORK

- **Autonomy:** Don't ask me to confirm obvious things. Ask up front
  **only** if you hit a true blocker (missing credentials/access, or a
  destructive/irreversible ambiguity). Otherwise pick the sensible
  default, **write the assumption into your running notes**, and proceed.
- **Forward-thinking + free rein:** I made the shell with Claude design and
  have been hooking it up. You have **full latitude to improve and even
  redesign** surfaces where it genuinely improves the experience — not just
  wire what exists. If you see something half-built, dead, or worse than it
  should be: **just make it better.** Keep it cohesive with the existing
  visual language (tokens in `tokens.css`, components in `components.css`),
  and never break a working path to ship a prettier one — every redesign
  must end up **fully wired and verified** to the same bar as everything
  else.
- **Cost posture (important):** Do as much as possible in **plain
  deterministic code with zero AI tokens.** AI is an *optional enhancer*,
  always behind a configured provider, always with a graceful no-provider
  fallback. Before reaching for AI, ask "can code do a good-enough first
  pass?" — usually yes (staleness, completeness, orphan detection,
  cross-references, basic continuity, extraction discovery all can).
- **Incremental commits:** Commit after each phase / coherent unit with
  clear messages. Keep `npm run validate`, `npm run test:smoke`, and
  `npm run build` green at every commit.
- **No cheating (they were burned by this before):**
  - A button that pops a `"… isn't wired yet."` notice is **not** done.
    No core action may resolve to that generic notice.
  - Leaving demo/sample/hardcoded fallback data rendering in place of live
    data is **not** done.
  - "The service works" is **not** done — see §0.
  - Don't mark a phase complete in your report unless you verified it in
    the rendered UI.

---

## 2. GROUND TRUTH — VERIFIED STARTING POINTS (re-confirm, then go further)

I cross-referenced the codebase before writing this. These are real,
file-level findings — confirm each in the running UI, fix it, then push
past it. File:line references are anchors, not boundaries.

### 2.1 Full editors do NOT pull the tab's data (the headline bug — CONFIRMED)
The full-screen "dossier" workspaces are the **full editors** the user
means. They are broken in three ways:
- `workspaces-narrative.jsx` (`CastDossierWorkspace`, helper `_wnSamples`)
  and `workspaces-rpg.jsx` (helper `_wrSamples`) read **`window.ENTITY_SAMPLES`**,
  not the live `EntityService`. `CastDossierWorkspace` even has a
  **hardcoded `fallback` array** (Aelinor Vey, Captain Brec, Saren of
  Hess…) it shows when samples are empty.
- They initialise selection from `items[0]?.id` and **never read
  `workspace.entityId`** — so opening the full editor for the character
  you selected in the Cast tab opens to the *first* item, not your pick.
- `app.jsx` `openPanelWorkspace` (~line 339) forwards only
  `{ workspaceId, panelKind, sourcePanel }` — the selected `entityId` is
  **never passed through** in the first place.
- Reference pattern that IS correct: `workspaces-system.jsx` reads the
  live store. The entity-editor **modal** (`entity-editor.jsx` ~967–974)
  also correctly hydrates via `EntityService.getSync`. Copy those patterns.

**Fix:** every full workspace must (a) read the **live store**
(`EntityService.listSync` / `decoratePanel`), (b) **honor a passed-in
`entityId`** so it opens focused on the tab's selection, (c) drop
hardcoded/sample fallbacks, (d) show a real empty state, (e) be a
genuinely *fuller* view of the same record the tab shows (every field the
schema supports — the editor configs are already very rich; e.g. Cast has
~64 fields across 13 sections in `entity-editor-configs*.jsx`). Do this
for **all** full editors: Cast, Bestiary, Atlas, Locations, Items,
Classes, Races, Stats, Abilities, Quests, Events, Timeline, Lore,
Relationships, Skill Trees.

### 2.2 Cross-tab context is broadcast but never consumed (CONFIRMED)
- There IS plumbing: a global `focusedByType` map (`app.jsx` ~299), an
  `onSelectEntity` broadcast (`app.jsx` ~834–843), `panelContext`
  (incl. `selectedEntityId`) spread into every panel body
  (`panel-stack.jsx` ~261–269), and a "Filtered by X" chip UI.
- But panel bodies **don't consume it.** `relationships.jsx` (~672–699)
  never reads `focusedByType`/`panelFilter`, even though
  `RELATIONSHIPS_HOOKUP.md` documents it reacting to selection. So the
  cross-referencing the product wants does not happen.

**Build (this is a core ask):**
- When two or more panels are open, panels should **react to each other's
  selection**. Concretely, the user's marquee example: open Cast, select
  **two** characters → **show the relationship between those two**
  (the bond, history, shared events, evidence). Cast already has a
  multi-select `Set` (`cast.jsx`) used only for bulk merge/tag/delete —
  extend it to a **pair/relationship view**, and surface the same pairing
  in the Relationships panel/workspace.
- Make this general: Atlas selection filters Relationships/Cast to that
  place; Timeline event snapshots relationship state at that chapter; etc.
  Wire as many panels as sensibly possible to the existing
  `focusedByType`.

### 2.3 The "lock" feature does not exist (NEW WORK — a core ask)
- Panel **pin** keeps a *panel* open; it does **not** keep a *selection*.
  Switching tabs (and especially mobile, where only one sheet shows at a
  time — `panel-stack.jsx` caps visible panels at 1 ≤700px) **loses the
  current selection**.
- Build a real **"lock / keep selected"** mechanism so a user can lock one
  or more entities and have them **stay selected as they move between
  tabs**, so they can view several entities' info side by side. Make it
  work on **desktop and mobile**, for **as many tabs as possible**. Locked
  selections should persist across tab switches and panel
  open/close, and be visibly indicated (e.g. a lock chip / "Showing Cast:
  Aelinor" badge on mobile). This is the feature that lets a phone user
  compare multiple entities at once — design it well.

### 2.4 Tangle is live but undiscoverable + has contradictory routing (CONFIRMED)
- Tangle's canvas is real and live (`tangle.jsx` + `TangleService`) and
  it's in `NAV_ITEMS` (`brand.jsx` ~107) under the **tools** group as a
  panel. But `workspace.jsx` (~line 24) still marks `tangle` as
  `soon: true` ("Coming soon"), and there's stale `routeId === "tangle"`
  routing that never fires. So users (rightly) **can't find the tab**.
- **Fix:** remove the contradiction, make Tangle a **first-class,
  obviously discoverable destination** (proper nav placement, no "coming
  soon", reachable from command palette and mobile nav), and confirm the
  canvas opens and persists from a cold start.

### 2.5 Today/Home are code-first and live (good) but the "AI editor" is half-built
- `home.jsx` and `today-ai.jsx` compute real, live, zero-token stats and
  suggestions (manuscript progress, entity health, review queue, recent
  activity, "continue chapter", open quests). Keep that.
- But several Today sections are **defined-but-stubbed** (dangling
  threads, callbacks & motifs, project-intelligence gaps), and there is
  **no** staleness detection, **no** orphan/broken-reference detection,
  **no** incomplete-entity detection, **no** stalled-thread detection. The
  "continuity check" is a near-trivial literal `"not X"` string match.
- **Build a real, code-first insight/editor engine** (zero tokens) that
  makes Today/Home feel like an editor reading over the writer's shoulder:
  - **Staleness:** entities/threads not touched in a while
    (`entity.updatedAt` aging, last-mention chapter distance).
  - **Incompleteness:** records missing key fields ("Aelinor has no
    summary / no goals / no relationships").
  - **Orphans / broken links:** relationships pointing at deleted cast;
    entities mentioned in prose with no record; records with zero links.
  - **Stalled threads:** open quests/plots/events with no recent mention.
  - **Cheap contradiction heuristics:** conflicting attributes across
    chapters (e.g. eye colour, titles, allegiances) before any AI.
  - Surface these as actionable cards ("Fix this", "Open editor",
    "Add to today") on Today **and** as nudges on Home.
  - AI remains an **optional deepener** on top, never a requirement.

### 2.6 Extraction is strong but can do more
The extraction pipeline is genuinely good and **code-first** (offline:
known-name scan + offline pronoun resolution + proper-noun discovery +
honorific/alias clustering + fuzzy dedupe + confidence calibration + 8
phrase detectors; optional AI deep pass + a second relationship pass). The
core mechanics in `backend-services.jsx` (`ExtractionService.runExtraction`)
are solid. Confirm it still works end to end from the Writer's Room
(type prose → Save & Extract → review queue → accept → entity appears in
its tab **and** full editor, rendered), then **extend its reach**:
- Dialogue attribution ("'…,' said the captain" → line attributed to Brec).
- Role/epithet nouns, not just capitalised names ("the baker", "the
  Auger-keeper") via context.
- Event/timeline **chaining** (cause → effect, before/after).
- Offline **faction / allegiance** detection ("swore to", "banner of").
- **Contradiction / canon-shift** flags fed into the Today insight engine.
- Possession/inventory **state over time** (who holds what now).
Keep every addition working **without** an AI provider; let AI enrich.

### 2.7 AI writing tools + onboarding style — real, verify fidelity
- The AI writing tools (revise/continue/write/critique/continuity in
  `today-ai.jsx`, `writers-room.jsx`, `callback-registry.jsx`) make **real**
  provider calls, are BYOK, privacy-gated, and route per task
  (`AIRoutingService`). Onboarding **does** thread the writer's style/voice
  into prompts (`onboarding-steps.jsx` → `ProjectIntelService` →
  `AIContextBuilder.build` → system+user prompt). This is wired.
- **Your job:** verify the *fidelity* of that loop end to end (does a
  voice sample + style dials + "avoid" list actually change the generated
  prose?), tighten the prompt construction if the style signal is weak,
  and make the **no-provider** experience excellent (clear, useful local
  fallback — never a dead end). Known gaps to consider: the Gemini adapter
  is unimplemented (config exists), there's no streaming, and the
  cost-mode routing is nominal.
- **AI testing posture (cover both):** if a provider key is available in
  your environment (env/secret), run at least one **real** end-to-end
  generation to judge style adherence. If not, **mock/stub the provider**
  to prove the wiring and JSON handling, and verify the graceful
  no-provider path. Either way, the code-first behaviour must be flawless
  without AI.

---

## 3. THE WORK — PHASES (drive these to completion, in roughly this order)

Each phase ends with **rendered-UI verification** and a green
`validate` + `smoke` + `build`. Commit per phase.

- **Phase 0 — Baseline & harness.** Get it running. Record what your env
  can do (browser? Playwright/Chromium?). Run `npm run validate`,
  `npm run test:smoke`, `npm run build`, and the e2e suite if possible;
  **write down the real current results** (don't trust the docs). Note
  every place a button yields `"isn't wired yet"` (run
  `AUDIT_VERBOSE=1 npm run audit-callbacks`). This is your punch list.
- **Phase 1 — Full editors pull live, focused data (§2.1).** Highest
  priority; it's the loudest complaint. Every full workspace reads the
  live store and opens focused on the selected entity, as a genuinely
  fuller view. Verify by selecting an entity in each tab and opening its
  full editor.
- **Phase 2 — Cross-tab context, pair views, and Lock (§2.2 + §2.3).**
  Panels react to each other's selection; 2 selected cast → their
  relationship; a real lock that survives tab switches on desktop and
  mobile.
- **Phase 3 — Tangle made findable + routing cleanup (§2.4).**
- **Phase 4 — Today/Home become a real code-first AI editor (§2.5).**
- **Phase 5 — Extraction depth (§2.6).**
- **Phase 6 — AI writing + onboarding fidelity & no-provider polish (§2.7).**
- **Phase 7 — Whole-app sweep: no dead buttons, no dead ends.** Go tab by
  tab, button by button, through **every** surface and confirm each
  control does something real and correct in the rendered UI. Use the
  per-surface checklist in §4. Fix everything you find.
- **Phase 8 — The in-app tutorial / help system (required final
  deliverable; see §5).**

---

## 4. PER-SURFACE AUDIT CHECKLIST (Phase 7 — test every inch)

For **each** surface below: open it in the real app and verify (1) it
renders live data with a correct empty state, (2) selection works and
drives the full editor, (3) the full editor is a correct, fuller view,
(4) it reacts to / contributes to cross-tab context where sensible,
(5) **every button, menu, filter, and field does what it claims**, (6) it
works on mobile (≤700px), (7) lock/keep-selected works where applicable.

Surfaces (audit tabs **and** their full editors):
**Today, Home, Writer's Room, Cast, Bestiary, Atlas, Locations, Items,
Classes, Races, Stats, Abilities, Skill Trees, Relationships, Quests,
Events, Timeline, Lore/Canon, References, Tangle, Speed Reader, Random
Tables, Review Queue, Trash, Settings, Onboarding, Command palette,
Adaptive wheel.** (Note: the user lists "Abilities" and "Skill Trees"
separately — make sure Abilities is its own discoverable, working
surface, not silently aliased away.)

For every surface, the bar is the same: **no disconnected button, no code
without a destination, everything working together.**

---

## 5. REQUIRED FINAL DELIVERABLE — IN-APP TUTORIAL / HELP (build BOTH)

There is **no** tour/help framework today — build one. Per the product
owner it must be **both**:
1. **A persistent Help "?" affordance on every surface** that opens a
   concise **help panel** explaining that page and what each button/control
   does.
2. **An optional guided tour** (spotlight / coachmarks) that steps the user
   through the **real** controls on that tab/page, launched from the Help
   affordance.

Requirements:
- Covers **every tab, every page, every button** — Today, Home, Writer's
  Room, all entity tabs and their full editors, Tangle, Speed Reader,
  Random Tables, Review Queue, Trash, Settings, Onboarding, command
  palette, adaptive wheel, **and the new lock / cross-tab features.**
- Content lives in code (a small registry mapping surface → steps/copy),
  driven from the **real DOM/selectors** so it can't drift silently from
  the UI. Keep it deterministic and zero-token.
- Works on desktop and mobile; dismissible; remembers "seen".
- Building a complete, accurate tour proves you understand the app inside
  out — write it from what the UI *actually does*, verified, not from the
  docs.

---

## 6. DEFINITION OF DONE

You are done only when **all** of these hold and you have verified them in
the rendered app:
1. Every full editor shows the **live** record for the **selected** entity
   as a fuller view; no demo/hardcoded fallback data renders anywhere on a
   real project.
2. Cross-tab context works: selecting in one panel reflects in others;
   selecting two cast shows their relationship; this is real and visible.
3. Lock / keep-selected works across tab switches on desktop and mobile.
4. Tangle (and every other listed tab, incl. Abilities) is discoverable
   and fully functional; nothing says "coming soon" that actually ships.
5. Today/Home surface genuine, code-first insights (staleness,
   incompleteness, orphans, stalled threads, contradictions) as actionable
   cards — an "AI editor" that works with **zero** tokens, AI optional.
6. Extraction verified end-to-end from prose → tab + full editor, with the
   depth improvements in §2.6 landed and working offline.
7. AI writing + onboarding style fidelity verified (real call if a key is
   available, mocked otherwise); the no-provider path is excellent.
8. **Phase 7 sweep complete:** no dead buttons, no `"isn't wired yet"` for
   any core action, no control without a destination, on every surface,
   incl. mobile.
9. The **tutorial/help system** (help panel + guided tour + persistent
   Help button) is live on every surface.
10. `npm run validate`, `npm run test:smoke`, and `npm run build` are
    green; the e2e suite (extended with **DOM-level** assertions for the
    new behaviour) passes where a browser is available.
11. A final `BUILD_OUT_REPORT.md` that, for each item above, states what
    you changed and **how you verified it in the rendered UI** (the
    screen/flow/test), plus anything you deliberately deferred and why.

---

## 7. OUT OF SCOPE (don't spend effort here)

Per the project's own backlog, leave these alone unless they block the
above: multi-project support, cloud sync/collaboration, a managed
(non-BYOK) AI provider, packaged offline grammar/spell/thesaurus engines,
and production-bundle minification/source-maps. Do **not** edit generated
artifacts: `Loomwright.bundle.jsx`, `Loomwright Shell - Standalone.html`,
`Loomwright Shell.standalone-src.html`, `Loomwright Shell-print.html`.
Edit the source `.jsx` / `.css` files and `Loomwright Shell.html`.

---

### Reference map (where things live)
- Shell / boot: `Loomwright Shell.html`, `index.html`, `app.jsx`
- Backend (all services, extraction, AI): `backend-services.jsx`
- Callback dispatch: `callback-registry.jsx` (+ `scripts/audit-callbacks.js`)
- Tabs/panels: `panel-stack.jsx`, `panel-access.jsx`, `cast.jsx`,
  `upgrades-*.jsx`, `rpg-entities.jsx`, `atlas*.jsx`, `tangle.jsx`,
  `relationships.jsx`, `timeline.jsx`, `skill-trees.jsx`,
  `lore-references.jsx`, `random-tables.jsx`, `speed-reader.jsx`
- Full editors / workspaces: `full-workspaces.jsx`,
  `workspaces-narrative.jsx`, `workspaces-rpg.jsx`, `workspaces-system.jsx`
- Entity editor modal + schemas: `entity-editor.jsx`,
  `entity-editor-configs.jsx`, `entity-editor-configs-extended.jsx`
- Writer's Room + extraction UI: `writers-room.jsx`, `extraction-*.jsx`,
  `review-*.jsx`
- Today/Home: `today-ai.jsx`, `home.jsx`
- Onboarding + AI routing + settings: `onboarding*.jsx`, `settings-rich.jsx`
- Mobile: `mobile-nav.jsx`, `mobile.css`; Design tokens: `tokens.css`
- Tests: `tests/` (Playwright e2e), `scripts/smoke-services.js`

Begin with Phase 0. Ask now only if you're truly blocked; otherwise go,
and keep going until §6 is fully satisfied.
