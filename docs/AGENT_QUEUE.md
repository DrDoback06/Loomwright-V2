# Agent queue

The single source of truth for what is in flight. Read it first, rewrite it last, **every
run**. Operating instructions: `docs/AGENT_RUNBOOK.md`. Full spec: `docs/REDESIGN_PLAN.md`.

**Current:** N5b · step 5 of 7 (steps 0–4 done)
**Last verified green:** N5b step 4 — lint ✅ tsc ✅ build ✅ vitest 273 ✅ playwright 221 passed / 10 skipped / 1 failed (`14-offline` desktop — the known parallel-load flake; green in isolation, recorded since N1)
**Blocked:** —

| # | Milestone | Steps | State |
|---|---|---|---|
| N1 | Studio design system | 6 | ✅ 6/6 |
| N2 | Four destinations + palette + empty states | 6 | ✅ 6/6 |
| N3 | Acts › Chapters › Scenes + snapshots | 8 | ✅ 8/8 |
| N4 | Plan: Outline / Board / Matrix / Timeline | 7 | ✅ 7/7 |
| N5a | Scene beats | 7 | ✅ 7/7 |
| N5b | AI visibility, acts, sections, rewrite, focus | 7 | 🔄 5/7 |
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

## N3 — Acts › Chapters › Scenes ✅

- [x] 1. `Act` / `Scene` / `SceneSnapshot` types in `src/db/types.ts`; `Chapter.actId`
- [x] 2. Dexie v9 + the chapter→scene upgrade (chapter `doc` left in place, so a rollback loses no text)
- [x] 3. `src/db/repos/scenes.ts` — acts, scenes, ordering, `moveScene` (incl. re-anchoring occurrences across chapters), trash, audit
- [x] 4. Snapshot policy: one `interval` per 3-min window, always `pre-ai` / `pre-import`, keep last 20 + one per day; `pre-ai`/`pre-import` never pruned; restore takes its own snapshot first
- [x] 5. `chapterRollup()` + `ensureScenesForProject()` backfill on project load
- [x] 6. Writer's Room: `SceneStrip`, `SceneHead`, `ScenePanel` (summary, status, POV, location, target, AI visibility, snapshot history). The editor is pointed at a **scene**; all the existing save-safety machinery was re-keyed rather than rewritten.
- [x] 7. Ripple: `chapterRollup` meant extraction, chapter-awareness, search, world-bible and the speed reader needed **no changes at all**. Archive is v3 and still imports v2. The five bulk chapter writers (sample project, onboarding, generate/apply, intelligence/apply, project load) call `ensureScenesForProject`.
- [x] 8. `tests/unit/scenes-repo.spec.ts` — 14 tests including a genuine v8→v9 upgrade built from a hand-made v8 database; e2e `21-scenes.spec.ts` 12/12 on both projects

**Four real bugs the work surfaced, all fixed:**
1. **Switching chapters could write into the wrong scene.** `useLiveQuery` returns its
   previous value while re-running, so the old chapter's scene id was still legitimately
   in the list for a moment. The scene is now released the instant the chapter changes.
2. **A stale closure.** `runExtraction`/`runDeep` used `activeSceneId` without it being in
   the dependency array, so Save & Extract read `null` and refused to run.
3. **Restoring a snapshot did not reload the editor** — the old text stayed on screen and
   the next keystroke wrote it straight back, silently undoing the restore. A reload token
   now forces a re-read of the same scene. **N5 needs this for AI insertion too.**
4. **Controlled inputs fed by a live query reverted between keystrokes**, dropping
   characters in the scene summary and making the AI-visibility checkbox appear dead.
   `ScenePanel` keeps an optimistic draft, re-synced only on scene id change.

## N4 — Plan ✅

- [x] 1. `usePlanData.ts` — one query, derived indexes, and the presence map every view reads
- [x] 2. `OutlineView.tsx` — chapter/scene tree, inline rename, per-level word counts
- [x] 3. `BoardView.tsx` — group by status / chapter / POV; only status accepts drops
- [x] 4. `MatrixView.tsx` — Show axis switcher, sticky header + first column, arrow-key navigation
- [x] 5. Matrix three-source cells: asserted solid / summary underlined / **extracted faint + dashed, click to promote**
- [x] 6. Timeline reuses `features/codex/TimelineView.tsx` unchanged
- [x] 7. Mobile fallbacks; SURFACE_CHECKLIST rows; e2e `22-plan.spec.ts` 14/14 on both projects

**Two deliberate design calls:**
1. **Reordering is move buttons, not drag alone.** Drag works on the Board (status only),
   but Outline reorders with ↑/↓ because those work with a keyboard, on a phone, and with
   a screen reader. A drag handle on its own would put the whole view out of reach.
2. **Grouping by chapter or POV does not accept drops.** Those columns are a lens, not an
   editor — a card that looks draggable and silently does nothing is worse than one that
   plainly is not.

**One behaviour change:** `saveSceneDoc` promotes an `outline` scene to `draft` on its
first real words. Without it the Board is a single column of "Outline" that everyone has
to hand-correct. It fires once and never demotes; a hand-set status is never overwritten.

## N5a — Scene beats ✅

- [x] 1. `src/lib/prose.ts` — one `paragraphsFromDoc`/`countWords`; the duplicate in `db/repos/scenes.ts` deleted. **`.lw-manuscript` now reads `--measure`**, so the N1 prose-width slider stops being a dead control.
- [x] 2. `scene-beat.ts` — node (`isolating`, no `pid`), `/beat ` input rule, `Mod+Shift+B`, Enter-to-exit, and a beatId repair pass modelled on `UniqueParagraphId`
- [x] 3. `SceneBeatView.tsx` — `ReactNodeViewRenderer`, controls attached to the node. All transient state is React state; nothing about a generation touches the document
- [x] 4. `services/ai/prompts/beat.ts` — composed with `buildProseBrief`, plus preceding prose, "this is a fragment", and `[bracketed]` stage directions lifted out and labelled
- [x] 5. `useBeatExpansion.ts` — flush → `pre-ai` snapshot → `completeDetailed` (for `truncated`) → `checkDraftAgainstCanon` → Apply / Retry / Discard
- [x] 6. Offline round-trip: Copy prompt is present with or without a key, and the prompt is shown as selectable text so the clipboard is only ever a convenience
- [x] 7. Toolbar button, styles, mobile; `beat-prompt.spec.ts` (11) + `23-beats.spec.ts` (6 × 2 projects)

**A dead control shipped in N1, now fixed.** `applyTweaks` wrote `--measure` and nothing
read it — `.lw-manuscript` hardcoded `max-width: 680px`. The prose-width slider did
nothing, and its SURFACE_CHECKLIST row claimed a spec proved it; the spec only proved the
variable persisted. Worth remembering as a class of mistake: **assert the effect, not the
attribute.**

**A data-loss bug the e2e caught.** Restoring a snapshot raced with a pending autosave.
The scene-load effect flushed the outgoing scene on every re-read — including a
same-scene reload triggered by `reloadToken` — which wrote the pre-restore editor content
straight back over the restored row. It now distinguishes *moving to another scene* (flush;
the editor is authoritative) from *the same scene being replaced underneath us* (drop the
pending write; the database is authoritative by definition when the token moves).

**Correcting the note left after N3:** insertion via `editor.chain()` does **not** need
`reloadToken`. The token is only for DB-originated replacement. The rule for the codebase:
anything that calls `db.scenes.update` on the currently-loaded scene must bump the token;
anything going through `editor.chain()` must not.

## N5b — AI visibility, acts, sections, rewrite, focus

The throughline is **making AI-visibility real at both scales** — per scene (`aiVisible`,
promised since N3) and per block (`hiddenFromAi`, new). They are the same feature and the
same filter; the half-built fields ride along.

- [x] 0. **`Scene.aiVisible` made real.** `chapterRollup` is the single choke point: a hidden scene contributes its `doc` and its `wordCount`, but **not** its paragraphs. `updateSceneMeta` re-rolls the chapter the instant the box is unticked. `search.ts` and `SpeedReaderSurface` re-derive from `chapter.doc` so hiding a scene from a model never hides it from its author. 5 unit tests + `24-sections.spec.ts` (2 × 2 projects).
- [x] 1. **Acts, reachable.** `+ Act`, rename, ↑/↓, Delete act and a per-chapter act picker in `OutlineView`; **Act** as a Board grouping (rendered only once an act exists) and as a band across the Matrix rows. New repo functions: `renameAct`, `moveAct`, `setChapterAct`. 4 unit tests + `22-plan.spec.ts` (1 × 2 projects).
- [x] 2. `section.ts` + `SectionView.tsx` — a colourable wrapper node (`content: 'block+'`) with independent `hiddenFromAi` / `hiddenFromWordCount`, six named colours mapped onto semantic tokens, `/note ` and `/section ` wrapping input rules, `Mod+Shift+N`, a toolbar button, and Remove section (unwrap, never delete).
- [x] 3. **The two derivations diverged.** `paragraphsFromDoc(doc, skip)` now takes a predicate *or* the old array; `deriveScene(doc)` returns both numbers so no writer can derive one and reuse it for the other. Wired through `persist`, `flushSave`, `restoreSnapshot` and `appendParagraphToChapter`. **The trap was real and is closed:** `reanchorOccurrences` and `usePlanData.sceneOfParagraph` derive ids from the **unfiltered** `scene.doc`. Speed reader filters by count only; search filters by nothing.
- [x] 4. **`RewriteBubble.tsx` + `prompts/rewrite.ts`.** Expand / Rephrase / Shorten on ≥4 selected words, positioned by hand off `posToDOMRect` (no `BubbleMenu`, no `@floating-ui/dom`); `.lw-wroom__canvas` is now `position: relative` and the bubble flips below the selection when there is no room above. Rephrase carries POV / tense / as-dialogue. Offline it copies the prompt and takes a paste, and the three AI buttons are absent from the tree. `gatherSceneContext` / `manuscriptStyleSample` extracted to `ai-context.ts` so beats and rewrites share one context source — **N7 replaces that one file, not two**. 11 unit tests + `25-rewrite.spec.ts` (4 × 2 projects).
- [ ] 5. ← IN PROGRESS · Focus mode: chrome fade after 3s typing, sentence/line/paragraph dimming, typewriter at 45%, all gated on `prefersReducedMotion()`. The `focus` tweak is **stored but never stamped** — add `data-focus` to `applyTweaks` AND the pre-paint script in `index.html`. The scroll container is `.lw-wroom__canvas`, not the window. The dimming plugin must rebuild on **selection change**, not only `docChanged`.
- [ ] 6. `Scene.labels` chips + `attachedRefs` entity picker in `ScenePanel`; give `--density-pad` / `--density-gap` consumers or delete them; SURFACE_CHECKLIST rows; finish `24-sections.spec.ts`

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

N1–N4, N5a and N5b steps 0–4 are done and pushed. Start N5b step 5 — focus mode.

**Never select text in an e2e with a triple click or with Ctrl+A on a container.** A triple
click inherits the browser's multi-click counter from whatever was clicked before it, so after
a button press it lands on a double-click and selects one word — an hour of debugging, and it
looked exactly like a product bug. Ctrl+A clicks the container's centre, which can be a popover
left open by an earlier step. Click the paragraph, then `Home`, then `Shift+End`.

**`countWords(scene.paragraphs)` now legitimately disagrees with `scene.wordCount`.** They are
two filters over one document — `deriveScene(doc)` in `lib/prose.ts` returns both, and every
writer of a scene row must go through it rather than deriving one and reusing it. Anything
that wants paragraph *ids* (occurrence re-anchoring, the Matrix's paragraph→scene map) reads
the **unfiltered** document; filtering happens once, at derivation, for text only.

**A node view's chrome must not swallow Ctrl/Cmd keys.** `swallowEditorKeys` in
`writers-room/swallow.ts` stops unmodified keys only. The full swallow made the command
palette unreachable while focus sat in a section checkbox — caught by e2e, and the same trap
is waiting for every future node view.

**Acts group chapters; they never re-order them.** `moveAct` swaps two acts' `order` and
touches no chapter. The Outline renders act sections in act order, so a chapter assigned to
an act out of sequence appears under that act rather than in manuscript position — the
Matrix band is deliberately emitted on every act *change* going down `globalOrder`, so the
same mis-assignment shows up there as a repeated band instead of being hidden. If acts ever
need to imply order, that is a `resequenceScenes` change, not a rendering one.

**`chapter.paragraphs` now means something narrower than it used to.** It is *what a model
is shown*, not *every word in the chapter*. Anything that shows the author their own text —
search, the speed reader, the world bible, a reading view — must derive from `chapter.doc`
via `paragraphsFromDoc` instead. Step 3 widens the same split to `scene.wordCount` vs
`scene.paragraphs`, after which `countWords(scene.paragraphs)` will legitimately disagree
with `scene.wordCount`. That is the contract, not a bug.

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
- **A controlled input fed by `useLiveQuery` will fight the person typing into it.** The
  value renders back from the database between keystrokes. Any new form panel needs the
  optimistic-draft pattern in `ScenePanel.tsx`.
- **`useLiveQuery` returns its previous value while re-running.** Any derived selection
  keyed off one of its rows needs to check the row still belongs to the current parent —
  this is what made chapter switching write into the wrong scene.
- When you add a `useCallback` that reads new state, **check the dependency array**. A
  stale `activeSceneId` cost a red run.
- **Adding a destination touches five places**: `RouteId` and its view type in
  `stores/ui.ts`, `NAV_ENTRIES` in `LeftRail.tsx`, `MainSurface` in `App.tsx`, the palette
  command list (and the Alt+N shortcuts shift — `20-shell.spec.ts` asserts them), `HELP`
  in `HelpDialog.tsx`, and `SURFACE_HOME` in `tests/e2e/helpers.ts`.
- **Assert the effect, not the attribute.** N1 shipped a prose-width slider whose spec
  proved a CSS variable was written, while nothing read it. The control did nothing for
  four milestones.
- **A node view's controls must `stopPropagation` on key events.** They sit inside the
  editor's DOM, so Backspace in a beat's paste box would otherwise delete the beat.
- **The clipboard can refuse** (unfocused document, locked-down browser). Anything that
  copies must also show the text. `page.bringToFront()` before a clipboard assertion.
- `editor.chain()` insertion does NOT need `reloadToken`; `db.scenes.update` on the loaded
  scene does. See the N5a notes.
- The presence map in `usePlanData.ts` is where a new "scene knows about entity X" source
  goes — it already ranks asserted > summary > extracted.
