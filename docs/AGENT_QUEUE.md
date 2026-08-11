# Agent queue

The single source of truth for what is in flight. Read it first, rewrite it last, **every
run**. Operating instructions: `docs/AGENT_RUNBOOK.md`. Full spec: `docs/REDESIGN_PLAN.md`.

**Current:** N3 · step 6 of 8
**Last verified green:** N2 complete — lint ✅ tsc ✅ build ✅ vitest 218 ✅ playwright 164 passed / 10 skipped / 0 failed on desktop + mobile ✅
**Blocked:** —

| # | Milestone | Steps | State |
|---|---|---|---|
| N1 | Studio design system | 6 | ✅ 6/6 |
| N2 | Four destinations + palette + empty states | 6 | ✅ 6/6 |
| N3 | Acts › Chapters › Scenes + snapshots | 8 | 🔄 5/8 |
| N4 | Plan: Outline / Board / Matrix / Timeline | 7 | ⬜ |
| N5 | Beats, inline AI, sections, focus mode | 8 | ⬜ |
| N6 | Typed `@` mentions | 4 | ⬜ |
| N7 | Context engine + policy + tracking + budget rail | 7 | ⬜ |
| N8 | Progressions + scene summaries / storySoFar | 7 | ⬜ |
| N9 | Chat dock | 6 | ⬜ |
| N10 | Prompt library | 6 | ⬜ |
| N11 | Story health charts | 7 | ⬜ |
| N12 | Nudge inbox | 6 | ⬜ |
| N13 | Momentum | 5 | ⬜ |
| N14 | G6/G7/G8 + review-lane merge | 5 | ⬜ |

---

## N1 — Studio design system ✅

- [x] 1. Baseline established: lint ✅ tsc ✅ build ✅ vitest 218 ✅ playwright 141 passed / 10 skipped / 1 failed (`14-offline` mobile — passes in isolation, a parallel-load flake, not a regression; green in every run since)
- [x] 2. Shared token scale revision in `src/styles/tokens.css` (type + line-height + tracking + weights, 4px spacing, radii, easing language, `--measure`). No token id deleted; `--ease-out`/`--ease-in-out` aliased.
- [x] 3. `studio-dark` + `studio-light` theme blocks (OKLCH hue 265 / accent 300). `--ok/--warn/--risk/--info` and `--line-highlight` added to **all four** themes so components can use them freely.
- [x] 4. `Theme` union + `ALL_THEMES` + `THEME_COUNTERPART` + `studio-dark` default in `stores/ui.ts`; a stored legacy choice is preserved. `TopBar`'s dark check covers both dark themes.
- [x] 5. `src/lib/motion.ts` (`prefersReducedMotion`, `motionDuration`) + reduced-motion blocks in `tokens.css` honouring both the media query and `data-motion-pref`
- [x] 6. `TweaksPanel.tsx` in Settings (theme ×4, density ×3, typeset ×3, measure 28–44em, motion ×3, focus ×4); `lib/tweaks.ts`; pre-paint restore in `index.html`; `lw-tweak*` styles; SURFACE_CHECKLIST rows; e2e `19-studio.spec.ts` (6/6 on both projects)

**Deviation from the plan, deliberate:** tweaks persist to **localStorage**, not `db.uiState`.
The pre-paint script in `index.html` has to read them synchronously to avoid a flash of the
default theme on every boot, and IndexedDB cannot be read before first paint. They are pure
presentation, so this does not weaken the "all data lives in Dexie" rule. `applyTweaks()` in
`main.tsx` re-applies authoritatively so the two paths cannot drift.

## N2 — Four destinations ✅

- [x] 1. `RouteId` + `ROUTE_ALIAS` + `WorldsView`/`InsightsView` in `stores/ui.ts`. **`setRoute` normalises** a legacy id into destination + sub-view, so ~100 existing call sites, palette commands and toast actions needed no edit at all.
- [x] 2. `LeftRail.tsx` → four destinations + More… + Settings; the 16 types became `CodexSurface`'s filter strip, each chip carrying its live active count
- [x] 3. `MobileNav.tsx` → the same four + More; Browse/More sheets deleted (nothing left to hide behind them). `openNav` signature unchanged, body now a routing table
- [x] 4. `WorldsSurface` + `InsightsSurface` with sub-view switchers; `HelpDialog` resolves help through the sub-view so it still describes what you are looking at
- [x] 5. `CommandPalette`: `>` `@` `#` `/` modes, recents-first when idle, real shortcuts rendered per row (Alt+1..4, bound in `App.tsx`)
- [x] 6. Write's empty state leads with the paste path; SURFACE_CHECKLIST rows; e2e `20-shell.spec.ts` 16/16 on both projects

**Deliberate scope change: four destinations, not five.** Plan has no surface until
scenes exist (N3/N4), and the repo's first law is that a nav entry appears only once its
surface genuinely works. Plan joins the rail in N4.

**Three real regressions the suite caught, all fixed:**
1. `"Go to Insights"` has *Overview, Today, Review* as its subtitle, so it outranked
   `"Go to Today"` for the query "today". The palette now scores a title match above a
   subtitle match — worth keeping in mind for any subtitle that names another surface.
2. The rail lost its group headings, which `17-identity-resolution` asserted on.
3. `openNav` was matching a regex label by stringifying it. It now tests the regex against
   a table of known surface names, which is what makes `/Import & Extract|Handoff/` work.

## N3 — Acts › Chapters › Scenes

- [x] 1. `Act` / `Scene` / `SceneSnapshot` types in `src/db/types.ts`; `Chapter.actId`
- [x] 2. Dexie v9 + the chapter→scene upgrade (chapter `doc` left in place, so a rollback loses no text)
- [x] 3. `src/db/repos/scenes.ts` — acts, scenes, ordering, `moveScene` (incl. re-anchoring occurrences across chapters), trash, audit
- [x] 4. Snapshot policy: one `interval` per 3-min window, always `pre-ai` / `pre-import`, keep last 20 + one per day; `pre-ai`/`pre-import` never pruned; restore takes its own snapshot first
- [x] 5. `chapterRollup()` + `ensureScenesForProject()` backfill on project load
- [ ] 6. Writer's Room: scene list, scene switcher, scene metadata drawer, snapshot history  ← IN PROGRESS
- [ ] 7. Ripple: extraction/session, chapter-awareness, search, archive (v3, accepts v2), world-bible, manuscript-import, generate/apply
- [ ] 8. `tests/unit/scenes-repo.spec.ts` incl. the v8→v9 migration on a seeded DB; e2e `21-scenes.spec.ts`

## N4 — Plan

- [ ] 1. `usePlanData.ts` — the single shared query + derived indexes
- [ ] 2. `OutlineView.tsx` (tree, rename, drag-reorder, per-level word counts)
- [ ] 3. `BoardView.tsx` (kanban by status / act / POV)
- [ ] 4. `MatrixView.tsx` — Show axis switcher, sticky header + first column, arrow-key nav
- [ ] 5. Matrix three-source cells: author-asserted solid / summary-matched underlined / **extraction-derived at 55%, click to promote**
- [ ] 6. `TimelineView.tsx` reusing `features/codex/TimelineView.tsx`
- [ ] 7. Mobile fallbacks; SURFACE_CHECKLIST; e2e `22-plan.spec.ts`

## N5 — Beats, inline AI, sections, focus

- [ ] 1. `scene-beat.ts` TipTap node + `/beat` input rule + `Mod-Enter` / `Mod-Shift-b`
- [ ] 2. `services/ai/prompts/beat.ts` built on `prompts/prose.ts`
- [ ] 3. `expandBeat()`: `pre-ai` snapshot → `complete()` → `checkDraftAgainstCanon()` → insert; Apply / Retry / Discard / As-section
- [ ] 4. Offline path: copy a fully-formed prompt + paste box (mirror `PasteTab`)
- [ ] 5. `[bracketed]` stage directions passed through and labelled in the prompt
- [ ] 6. `section.ts` node with `hiddenFromAi` / `hiddenFromWordCount`; `/note` preset; both flags honoured by context + word count
- [ ] 7. `RewriteBubble.tsx` — Expand / Rephrase / Shorten on ≥4 selected words
- [ ] 8. Focus mode (chrome fade after 3s typing, sentence/line/paragraph dimming, typewriter at 45%), all gated on `prefersReducedMotion()`; e2e `23-beats.spec.ts`

## N6 — Typed `@` mentions

- [ ] 1. `mention-suggest.ts` suggestion plugin on `@tiptap/pm` (no new dep)
- [ ] 2. `mention` mark carrying `entityId` / `entityType`; preview card on click
- [ ] 3. Write an `Occurrence` with `source: 'typed'` on select; `MentionHighlights` renders typed solid, extracted dimmer
- [ ] 4. e2e `24-mentions.spec.ts`

## N7 — Context engine

- [ ] 1. `EntityAiPolicy` in the reserved `__ai` block + an AI section in `EntityEditorDrawer`
- [ ] 2. `caseSensitive` + `exclusions` wired into `extraction/known-index.ts` (improves extraction too)
- [ ] 3. `hiddenFieldIds` honoured by every digest path; sensible appearance-field defaults
- [ ] 4. `services/context/scene-context.ts` — lanes, ranking, budget truncation, `aiVisible` and `hiddenFromAi` exclusions
- [ ] 5. `ContextRail.tsx` — three lanes, live budget bar, drag between lanes, per-chip digest, Preview disclosure
- [ ] 6. Route `ComposePanel`, `AiTab`, beats through `buildSceneContext()`
- [ ] 7. `tests/unit/scene-context.spec.ts`; e2e `25-context.spec.ts`

## N8 — Progressions + story memory

- [ ] 1. `Progression` type + Dexie v10 + `src/db/repos/progressions.ts`
- [ ] 2. `entityAtScene()` layering (additions on, replacements over, later anchors invisible)
- [ ] 3. `buildSceneContext()` calls `entityAtScene()` for every item
- [ ] 4. `/progress` editor affordance anchoring a progression at the caret's scene
- [ ] 5. **`intelligence/apply.ts` writes `source:'extracted'` progressions from field patches** — the auto-generated timeline of truth
- [ ] 6. `services/context/story-so-far.ts` + `summarizeScene()` with the **offline extractive fallback** (reuse `extraction/quality.ts` scoring)
- [ ] 7. `summary-stale` detection; unit specs; e2e `26-progressions.spec.ts`

## N9 — Chat

- [ ] 1. Dexie v11 + `src/db/repos/chat.ts`
- [ ] 2. `services/ai/prompts/chat.ts` — one system prompt per mode
- [ ] 3. `ChatDock.tsx` in the existing `PanelDock` z-layer
- [ ] 4. `+ Context` breadth (novel / outline / act / chapter / scenes / codex by type or tag) + removable chips; `memoryPairs` cutoff
- [ ] 5. **Insert into scene** (snapshot-then-insert) and **Send to codex** via `parseDeltaReply`
- [ ] 6. Offline empty state ("Copy this conversation as a prompt"); e2e `27-chat.spec.ts`

## N10 — Prompt library

- [ ] 1. `PromptTemplate` / `PromptInput` types + Dexie v12 + repo
- [ ] 2. `services/prompts/resolve.ts` — the C-style, case-insensitive, non-chaining resolver
- [ ] 3. Seed builtins by exporting the existing hardcoded prompts (prose, extraction, delta)
- [ ] 4. Settings ▸ Prompts: list, edit, duplicate, reset-to-builtin, **test-run showing resolved text**
- [ ] 5. Clipboard import/export; model banks; prompt picker at every AI entry point
- [ ] 6. Resolver unit specs; e2e `28-prompts.spec.ts`

## N11 — Story health

- [ ] 1. `services/health/types.ts` + `HealthInput` assembly
- [ ] 2. `pacing`, `povBalance`, `screenTime`, `locationSpread` analyzers (pure, DB-free)
- [ ] 3. `tension.ts` offline heuristic + `CONFLICT_VERBS` / `STAKES_NOUNS` lexicons
- [ ] 4. `arc` positions vs `ARC_EXPECTED`; `threads` open/resolved tracking
- [ ] 5. `HealthCharts.tsx` — pure SVG, no library; every bar/point a button that opens the scene
- [ ] 6. "View as data" `<table>` fallback per chart; tabular numerals; reduced-motion entry
- [ ] 7. Golden fixtures per analyzer; e2e `29-health.spec.ts`

## N12 — Nudge inbox

- [ ] 1. `Nudge` type + Dexie v13 + `src/db/repos/nudges.ts`
- [ ] 2. `services/health/nudges.ts` rule registry (flat pure functions, shaped like `intelligence/rules.ts`)
- [ ] 3. Compute on session start + explicit Analyse only; cap 5 pending, ranked by severity × staleness
- [ ] 4. Inbox UI: Dismiss / Snooze-for-N-scenes / Never-show-this-kind, reversible in Settings
- [ ] 5. "Why am I seeing this?" popover rendering `why`; 6px dot badge, not a count
- [ ] 6. Golden fixture per rule; e2e `30-nudges.spec.ts`

## N13 — Momentum

- [ ] 1. `WritingSession` + Dexie v14 + session rollup on save
- [ ] 2. Rolling "12 of the last 14 days" ratio — **no resettable streak, no missed-day notification**
- [ ] 3. Artefact celebrations only (scene → final, thread resolved), max one large per session
- [ ] 4. Progress rings encoding remaining work; informational daily bar chart
- [ ] 5. Unit specs; e2e `31-momentum.spec.ts` incl. the reduced-motion path

## N14 — Existing debt (docs/HANDOFF.md §5)

- [ ] 1. G6: `RelationshipGraph` ghost edges, `TangleSurface` staged overlay, roster "✨ Generate relationships", Paste-tab context checkboxes
- [ ] 2. G7 as **scene** generation: `case 'scene'`, `parseScenePayload`, "✨ Generate scene…"; beats become `sceneBeat` nodes
- [ ] 3. G8: Dexie v15 `generations` history + re-stage/copy-seed, field locks, save-as-template, duplicate-guard badges
- [ ] 4. Review-lane merge — flat queue becomes the "everything else" lane under the cascade board
- [ ] 5. `buildExtractionPrompt` derives from `promptFieldLines(type)`; extend `16-generate.spec.ts`

---

## Notes for the next run

N1 and N2 are done and pushed. Start N3 step 1 — the scenes schema.

Hard-won facts, in rough order of how much time they cost:

- **`npx tsc --noEmit` does NOT typecheck `src`.** Only `npm run build` (`tsc -b`) does. A
  missing `Record<RouteId, …>` key passed `--noEmit` cleanly and failed the build. Run the
  build before believing a type is sound. CLAUDE.md's wording is optimistic here.
- **The route is not persisted.** A reload lands on the default destination. Any e2e
  assertion after `page.reload()` must navigate back first.
- **A palette row's accessible name is its title *and* its subtitle**, so `exact: true`
  never matches one. And a subtitle that names another surface will compete with it in
  search — the scorer in `CommandPalette.tsx` handles this, but keep subtitles specific.
- `openNav(page, label)` is now a routing table over `SURFACE_HOME` / `PALETTE_ONLY` in
  `tests/e2e/helpers.ts`. **When N4 adds Plan, add its surfaces there** or specs will fall
  through to the codex-chip branch and throw.
- `tests/e2e/15-sweep.spec.ts` walks every surface asserting zero console errors. It is the
  canary for any structural change — run it early, not last.
- Appearance is stamped by `index.html` pre-paint **and** `applyTweaks()` in `main.tsx`. A
  new preference must go in both or it flashes on boot.
- For N3 specifically: `Chapter.doc` must stay untouched by the v9 migration for one
  release. `chapterRollup()` is what keeps extraction, search, world-bible export and the
  speed reader working while scenes take over as the source of truth.
