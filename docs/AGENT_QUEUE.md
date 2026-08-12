# Agent queue

The single source of truth for what is in flight. Read it first, rewrite it last, **every
run**. Operating instructions: `docs/AGENT_RUNBOOK.md`. Full spec: `docs/REDESIGN_PLAN.md`.

**Current:** N10 · not started (N9 closed)
**Last verified green:** N9 — lint ✅ tsc ✅ build ✅ vitest 411 ✅ playwright 282 passed / 10 skipped / 0 failed on desktop + mobile ✅
**Blocked:** —

| # | Milestone | Steps | State |
|---|---|---|---|
| N1 | Studio design system | 6 | ✅ 6/6 |
| N2 | Four destinations + palette + empty states | 6 | ✅ 6/6 |
| N3 | Acts › Chapters › Scenes + snapshots | 8 | ✅ 8/8 |
| N4 | Plan: Outline / Board / Matrix / Timeline | 7 | ✅ 7/7 |
| N5a | Scene beats | 7 | ✅ 7/7 |
| N5b | AI visibility, acts, sections, rewrite, focus | 7 | ✅ 7/7 |
| N6 | Typed `@` mentions | 6 | ✅ 6/6 |
| N7 | Context engine + policy + tracking + budget rail | 8 | ✅ 8/8 |
| N8 | Progressions + scene summaries / storySoFar | 7 | ✅ 7/7 |
| N9 | Chat dock | 6 | ✅ 6/6 |
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

## N5b — AI visibility, acts, sections, rewrite, focus ✅

The throughline is **making AI-visibility real at both scales** — per scene (`aiVisible`,
promised since N3) and per block (`hiddenFromAi`, new). They are the same feature and the
same filter; the half-built fields ride along.

- [x] 0. **`Scene.aiVisible` made real.** `chapterRollup` is the single choke point: a hidden scene contributes its `doc` and its `wordCount`, but **not** its paragraphs. `updateSceneMeta` re-rolls the chapter the instant the box is unticked. `search.ts` and `SpeedReaderSurface` re-derive from `chapter.doc` so hiding a scene from a model never hides it from its author. 5 unit tests + `24-sections.spec.ts` (2 × 2 projects).
- [x] 1. **Acts, reachable.** `+ Act`, rename, ↑/↓, Delete act and a per-chapter act picker in `OutlineView`; **Act** as a Board grouping (rendered only once an act exists) and as a band across the Matrix rows. New repo functions: `renameAct`, `moveAct`, `setChapterAct`. 4 unit tests + `22-plan.spec.ts` (1 × 2 projects).
- [x] 2. `section.ts` + `SectionView.tsx` — a colourable wrapper node (`content: 'block+'`) with independent `hiddenFromAi` / `hiddenFromWordCount`, six named colours mapped onto semantic tokens, `/note ` and `/section ` wrapping input rules, `Mod+Shift+N`, a toolbar button, and Remove section (unwrap, never delete).
- [x] 3. **The two derivations diverged.** `paragraphsFromDoc(doc, skip)` now takes a predicate *or* the old array; `deriveScene(doc)` returns both numbers so no writer can derive one and reuse it for the other. Wired through `persist`, `flushSave`, `restoreSnapshot` and `appendParagraphToChapter`. **The trap was real and is closed:** `reanchorOccurrences` and `usePlanData.sceneOfParagraph` derive ids from the **unfiltered** `scene.doc`. Speed reader filters by count only; search filters by nothing.
- [x] 4. **`RewriteBubble.tsx` + `prompts/rewrite.ts`.** Expand / Rephrase / Shorten on ≥4 selected words, positioned by hand off `posToDOMRect` (no `BubbleMenu`, no `@floating-ui/dom`); `.lw-wroom__canvas` is now `position: relative` and the bubble flips below the selection when there is no room above. Rephrase carries POV / tense / as-dialogue. Offline it copies the prompt and takes a paste, and the three AI buttons are absent from the tree. `gatherSceneContext` / `manuscriptStyleSample` extracted to `ai-context.ts` so beats and rewrites share one context source — **N7 replaces that one file, not two**. 11 unit tests + `25-rewrite.spec.ts` (4 × 2 projects).
- [x] 5. **Focus mode, all three parts.** `data-focus` stamped by `applyTweaks` *and* the pre-paint script; `focus-dim.ts` decorations rebuilding on `selectionSet` as well as `docChanged`; chrome fade after a 3s burst, restored on mousemove or Escape; typewriter scrolling on `.lw-wroom__canvas` consulting `prefersReducedMotion()` directly, with a 55vh tail so the last paragraph can reach the line. **The N1 `line` option is retired** — a rendered line is a layout fact the document does not hold, so it could only ever have behaved as `sentence`; a stored `line` migrates. The Tweaks fieldnote no longer lies when focus is off. 6 unit tests + `26-focus.spec.ts` (4 × 2 projects).
- [x] 6. **The last half-built fields.** `Scene.labels` is a chips field and `attachedRefs` an entity picker in `ScenePanel` — both had readers and no writer. `--density-pad` and `--density-gap` now drive `.lw-card` padding and the `.lw-page` section gap, with `balanced` set to exactly what those rules hardcoded, so Density finally moves spacing as its token names always claimed and the default layout does not shift. `19-studio.spec.ts` asserts the computed padding, not the attribute.

## N6 — Typed `@` mentions ✅

- [x] 1. **Derivation.** `mentionsFromDoc` + `TypedMention` in `lib/prose.ts`; `deriveScene` returns it; `Scene.mentions` and `Occurrence.source` added (both non-indexed — **no Dexie bump**). Offsets come from the same walk `textOf` uses, so they cannot drift from `paragraphsFromDoc`.
- [x] 2. `mention.ts` — a **Mark**, not a node, so `textOf` ignores it and word count, extraction and every export are unaffected by construction. Carries `entityId`/`entityType`/`label`, `inclusive: false`, plus an `appendTransaction` that drops a mark whose words no longer read as its label.
- [x] 3. `mention-suggest.ts` (plugin, hand-rolled — **`@tiptap/suggestion` is not installed at all**) + `MentionSuggest.tsx`. All 16 types searchable, ranked by match quality → type weight → existing mention count. Inline create over the five story types.
- [x] 4. Reconciliation in `saveSceneDoc` / `restoreSnapshot` / `deleteSceneToTrash`. **Ids are resolved through `mergedIntoId` BEFORE the change comparison** — the marks are identical either side of a merge, so comparing raw ids would decide nothing changed and leave every row pointing at a dead entity. A unit test caught exactly that.
- [x] 5. Extraction integration: the opening delete excludes `source: 'typed'`, and detector hits overlapping a typed span are dropped. One mention is one row.
- [x] 6. `MentionPreview.tsx` replaces the straight-to-dossier click; `MentionHighlights` skips typed rows (the mark renders them); styles; 12 + 6 unit tests; e2e `27-mentions.spec.ts` (6 × 2 projects), with `04-extraction-review` and `05-cross-panel` updated to click through the card.

**The finding that set the architecture.** `extractChapter` opens by deleting *every* occurrence in the chapter. A typed mention written as a row at pick time would have been destroyed by the Save & Extract button in the same toolbar. So the **document is the source of truth and occurrences are a projection** re-derived on save — the same relationship `scene.paragraphs` has. Delete the sentence and the mention goes with it, because there was never a second copy to forget.

**A deliberate call worth not re-litigating:** a typed mention lands in the Matrix's `extracted` lane, not `asserted`. Mentioning someone is not the same as their being in the scene — "Vex thought of Marrow" mentions a man who is miles away — so a mention of any provenance sits in the "found in the prose" lane, and clicking it still promotes it to an assertion of presence, which is a stronger claim than either the author or the engine had made.

## N7 — Context engine

- [x] 1. **`toKnownEntity()` — the enabling refactor.** `services/extraction/entity-to-known.ts` (type-only imports, so `known-index.ts` stays decoupled from Dexie) adopted by all **seven** hand-rolled builders. Fixed two silent bugs on the way: `intelligence/engine.ts` read `fields.statPhrases` where the stats config writes `extractionRules` (whole-book intake had never seen an author-defined phrase rule), and four builders dropped `pronouns`/`gender` entirely, disabling pronoun resolution on those paths. `HandoffSurface` had no status filter at all. 9 unit tests; the 16 extraction fixtures and `extraction-bootstrap` green **unchanged**, which is the condition for the refactor being right.
- [x] 2. **`EntityAiPolicy` at `fields.__ai`** — `src/domain/ai-policy.ts`: the type, `DEFAULT_AI_POLICY` (`context: 'detected'`), a guarded `readAiPolicy` that degrades to the default rather than throwing on a malformed bag, `isFieldHiddenFromAi`, and `isReservedFieldKey`. `FieldDef` gained `aiHidden?: true`; cast's three appearance fields carry it. **The opinion lives in the entity config, not in rows** — nothing is written on create, so a later change to the default still reaches everyone who never expressed one, and the three entity-creation paths needed no edits. Override is a three-state map because a `hiddenFieldIds` array cannot express "send this field the config hides".
- [x] 3. **"AI context" section in the drawer** — a synthetic nav entry (`AiContextSection.tsx`), not a config section. `ChipsInput` exported and reused via a synthetic `FieldDef` rather than a second chips editor. `formFromEntity`/`splitForm`/`deriveName` extracted to `entity-form.ts` so the round-trip is testable without React. Reserved keys skipped in `merge.ts` (inside the fields loop only, so `__summary` keeps its conflict row) and `templates.ts`. 16 unit tests + `28-context.spec.ts` 3/3 on both projects.
- [x] 4. **Tracking controls into the matcher.** `findRanges` gained an **optional** `{caseSensitive}` bag (a new default would have silently killed every discovery highlight via `extraction/engine.ts:180`, which lowercases its needle); `isExcludedAt` in `text-utils.ts` suppresses **by surrounding phrase**, windowed to the phrase length either side. Wired into `buildKnownIndex` (per-entity regex flags), `scanTextForKnownEntities`, `resolvePronounsInText` and `findEntityInSpan` — which **walks past** an excluded hit rather than giving up on the entity, so a real mention behind an excluded one still lands. `findKnownEntityMention` deliberately untouched and now carries a long comment saying why. New fixture `17-tracking-controls`, and the runner passes both controls through from the seed. 17 unit tests.
- [x] 5. **`src/services/context/scene-context.ts` — the assembler.** Lanes (`always`/`detected`/`excluded`) each carrying a plain-words `reason` the rail renders verbatim. **`entityDigest` is the first generic renderer of entity fields in the app** — every other AI path names ~8 fields by hand — which is what makes step 2's per-field gate real and what finally reads cast's `writingInstructions`/`avoidTropes` (zero readers until now). `detected` is the **union of a live scan and this scene's `source:'typed'` occurrences**, with the typed mention ranked higher: it is an assertion, and it catches "the ferryman → Marrow" which no matcher can. Budget from `TIER_BUDGET[tier].digestChars` with `fitToBudget`; depth clamped by tier as `enrich.ts:42` does; a per-entity cap so one digest cannot starve the scene. **`always` is trimmed last but still trimmed** — 30 Always entities would otherwise fail a small model's request outright — and anything cut moves to `excluded` with the reason "no room in the budget". New `field-text.ts` (`fieldValueToText`) rather than extracting world-bible's `renderValue`, which is shaped for markdown a person reads. 17 unit tests.
- [x] 6. **`ContextRail.tsx` — the trust surface.** Fourth panel beside Compose/Scene/Notes, built on the free-standing `<aside>` shape `ScenePanel` set (there is no shared panel wrapper in the Writer's Room; `PanelDock` is the app shell's codex rail, a different thing). Three lanes, the **app's first progress meter** (`.lw-budget`, new CSS — nothing in `src/styles/` rendered a filled track before), and a `<details>` Preview whose body is `ctx.text` **verbatim**. **Lane moves are per-scene**: `scene.attachedRefs` / the new non-indexed `Scene.excludedRefs` (no Dexie bump, the `scene.mentions` trick from N6). Never the entity policy — a gesture while reading one scene must not silently change the other two hundred; each chip links to the global setting instead. Buttons as well as drag (the N4 rule). 12 e2e on both projects.
- [x] 7. **Everything routed through `buildSceneContext`.** `gatherSceneContext` kept its return shape, so **beats and the rewrite bubble converted with zero edits** — their specs staying green is the proof. `ProseBrief.cast` became `context: string`, so `prose.ts` has one rendering and beat/rewrite dropped their own duplicate heading. `ComposePanel` takes a `scene` prop, is gated on it like `ScenePanel`, and lost both its byte-identical `personality`/`speechStyle` block and its dead `dropped` state — **deleted, not wired**: the rail is the place to shape context now, with a real drop target and a reason per chip. `EntityDetail`'s Copy AI prompt filters through `isFieldHiddenFromAi` via `entityWireString(e, {forPrompt:true})`; Copy as JSON deliberately does not. **New `services/context/pinned.ts`**: the rail passed only the focus lock while `gatherSceneContext` also folded in `focusedByType`, so the Preview would have under-reported what beats send — one helper, read by both.
- [x] 8. **Coverage.** `tests/unit/scene-context.spec.ts` (lanes, ranking, budget reporting, depth clamping, the per-field gate asserted against the real digest) and `28-context.spec.ts` — the Preview proved byte-identical to what a beat's Copy prompt produces, and a field hidden from AI absent from both. SURFACE_CHECKLIST rows for every rail control.

## N8 — Progressions + story memory

- [x] 1. **`Progression` + Dexie v10 + `db/repos/progressions.ts`.** A new table needs no `upgrade()`. **The row stores `sceneId` and no position** — `resequenceScenes` rewrites `globalOrder` on every insert or move, so a stored order goes stale the first time the author adds a scene. Position is resolved at read time through an `orderOf` callback the caller supplies.
- [x] 2. **`entityAtScene()`** — pure, DB-free, tested first. Additions layer onto the summary in story order; replacements override their field, latest anchor winning; anything anchored later is invisible. **And a field whose replacements are all anchored later is withheld entirely**: the stored row already holds chapter 40's owner, so leaving it in place while claiming to have withheld the progression would be the same leak wearing a fix. Never mutates the row — the codex, the roster and the Matrix keep showing current truth.
- [x] 3. **`buildSceneContext()` layers it in.** One call site. Because N7 made the assembler the only path to a model, drafting an earlier scene stopped leaking later facts across beats, rewrite, Compose and the Preview at once.
- [x] 4. **Authoring.** A "What changed here" section in `ScenePanel` (entity picker, an optional field picker that makes it a replacement, the list with delete), plus `slash-progress.ts`: `/progress ` opens that composer focused. **Deliberately leaves nothing in the document** — a progression node would reach the word count, the exports and extraction, which would then propose back the fact it had just been told.
- [x] 5. **The multiplier — extraction writes progressions.** One `Progression` per accepted field patch in `applyDelta`, `source: 'extracted'`, at `delta.sceneId`. `replace` → a replacement anchored to the field; `append`/`remove` → a prose addition, because a list gaining a member is an event rather than a new value for the whole list. Written after the missing-entity guard and against the **idMap-resolved** id, so nothing is orphaned. `db.progressions` in the transaction table list (and in undo's), `DeltaApplyRecord.progressionIds` optional so pre-N8 audit entries still revert.
- [x] 6. **Story memory.** `story-so-far.ts` (`storySoFar` / `storyToCome`). **Truncates newest-first**, so when the book outgrows the budget the *opening* falls off — the obvious front-truncating implementation hands a model the setup and withholds the situation it is being asked to continue. Threaded into `ProseBrief.storySoFar`, so beats, rewrite and Compose all carry it. `summarize.ts`: an extractive summariser scoring position + named subjects + verbs of consequence, minus dialogue-only lines — **the default path, not the fallback**; the model path is `completeDetailed` and surfaces `truncated`.
- [x] 7. **Stale summaries + coverage.** New non-indexed `Scene.proseUpdatedAt`, stamped by `saveSceneDoc`; `updateSceneMeta` stamps `summaryUpdatedAt` itself whenever `summary` is in the patch, so no caller has to remember. **Compared against `proseUpdatedAt`, never `updatedAt`** — the latter also moves for a label, a status or a POV, and a dropdown cannot stale a summary. 24 unit tests + `29-progressions.spec.ts` 5/5 on both projects.

## N9 — Chat

- [x] 1. **Dexie v11 + `db/repos/chat.ts`.** `chatThreads` / `chatMessages`, no `upgrade()`. Threads are working notes, so `deleteThread` is a hard delete that takes its messages with it rather than a trip through the trash. A thread titles itself from the first thing the author said, once.
- [x] 2. **`services/ai/prompts/chat.ts`.** Five modes, and **every one of them ends in the same rule: do not invent canon** — not politeness, but what makes a reply safe to hand to `parseDeltaReply` afterwards. `recentHistory` cuts at a **user turn, never at a message count**: a count-based window eventually opens the history with an answer whose question was left behind. The prompt is rendered as text rather than a messages array, because the offline path copies it verbatim.
- [x] 3. **`ChatDock.tsx` — a fifth Writer's Room panel**, not a `PanelDock` entry: the dock is the app shell's codex rail and does not exist on a phone, and the plan's own IA puts chat inside Write. Same `<aside>` shape as the context rail, sheet-over-manuscript on mobile.
- [x] 4. **`+ Context` and `services/context/chat-context.ts`.** This scene · the story so far · the outline · a whole codex type · one entry. Assembled from the **same** pieces the Writer's Room uses (`buildSceneContext`, `storySoFar`, `entityDigest`) — a chat that described entities differently from a beat would be two apps sharing a database. "The story so far" stops at the latest attached scene, not at the end of the book, or attaching scene two hands the model the ending. `memoryPairs` defaults to 14.
- [x] 5. **Insert into scene** (a `pre-ai` snapshot labelled "Before a chat insertion", then the same insertion path Compose uses) and **Send to codex** (`parseDeltaReply` → `stageDelta`, so a chat reply becomes a verified, propagated, undoable cascade rather than text).
- [x] 6. **The offline path is the same conversation**, not a reduced one: Copy conversation is present with or without a key, and the paste box puts the reply in the log where both buttons work identically. 18 unit tests + `30-chat.spec.ts` 6/6 on both projects.

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

N1–N6 and N7 steps 1–5 are complete and pushed. Start N7 step 6 — the context rail.

**There is no token counter in this repo.** Everything budgets in *characters* — `TIER_BUDGET`
is `chunkChars`/`digestChars`/`namesPerType`, and `fitToBudget` (`ai/prompts/index.ts:165`) is
the single sentence-aware truncation primitive. `enrich.ts:41-49` is the worked example of
composing tier + depth + `fitToBudget`. Do not invent an estimator; show characters.

**Automatic plurals are deliberately deferred.** They inject into the same label arrays as
exclusions and must inherit the case flag, and 16 golden fixtures plus
`extraction-bootstrap.spec.ts:124`'s occurrence-count equality pin current matcher behaviour.
Three matcher changes at once makes a red run impossible to attribute.

**Fixture `11-false-positive-trap` lies in its comments.** It claims `Hess` "should only match
when capitalised"; it does not today, and passes for an unrelated reason (the `(?![A-Za-z0-9])`
boundary rejects `hessian`), and it passes **identically with the tracking controls on or off**,
which makes it worthless as proof of them. `17-tracking-controls` is the fixture that actually
fails when the feature is unwired — verified by temporarily removing the wiring and watching it
go red. **Do that check for any fixture you add**: a golden fixture that cannot fail is worse
than none, because it reads as coverage.

**N7's `buildSceneContext()` replaces the body of ONE file**, `writers-room/ai-context.ts` —
beats and the rewrite bubble both go through it. Do not add a third context builder.

**`Occurrence` now has provenance.** `source: 'typed'` rows are a projection of `mention`
marks, re-derived on every scene save; `'extraction'` rows are owned by `extractChapter`,
which still deletes and rewrites its own on every run. Anything new that writes occurrences
must say which it is, and anything that deletes them in bulk must say which it is deleting.

**Ids in a mark are raw; ids in a row are canonical.** The mark keeps whatever entity id it
was written with and `resolvedMentions` follows `mergedIntoId` on the way to the row — which
is why a merge never has to rewrite a document.

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

**`services/context/pinned.ts` is the only reader of focus for context.** The rail and every
AI path call it, so the Preview cannot show less than the payload. Anything new that wants
"what is in scope" calls `buildSceneContext` with `pinnedRefs()` — never `useFocusStore`
directly, which is how the rail and `gatherSceneContext` drifted apart within one milestone.

**A lane move in the context rail is per-scene, never global.** `scene.attachedRefs` and
`scene.excludedRefs` are the local assertions; `entity.fields.__ai.context` is the global one,
reachable from each chip's popover and deliberately a separate act. Anything that later edits
context from a scene-level surface must follow this — the whole point is that a gesture made
while reading one scene cannot silently change what every other scene sends.

**The drag payload is not an `EntityRef`.** `services/drag.ts` carries
`{kind, entityId, entityType, name}`; an `EntityRef` is `{id, type, name}`. They are not
interchangeable, and the mapping is easy to get silently wrong because both have `name`.

**`buildSceneContext` is the only thing that decides what an AI is told about a scene.**
`services/context/scene-context.ts`. It is deterministic and offline — no provider, no network,
no randomness — because the rail renders its output verbatim and a Preview that differs from
the payload is worse than no Preview. Anything new that wants entity context calls it rather
than naming fields by hand; that hand-rolling is what produced five divergent renderings before
N7. `entityDigest` uses the **same** `generableFields` filter as the drawer's checkbox list, so
the two cannot disagree about which fields exist.

**`__`-prefixed keys in `entity.fields` are reserved.** `isReservedFieldKey` in
`domain/ai-policy.ts` is the predicate; `__ai` holds the per-entity AI policy and `merge.ts`
uses `__summary` as a synthetic diff row. Anything that iterates `entity.fields` generically
and shows the result to a human must skip them — `merge.ts` and `templates.ts` do, and
`world-bible.ts` gets away with it only because `renderValue` returns `''` for an object with
no `.name`, which is why `reserved-fields.spec.ts` pins the intent. `relations.ts` and
`generate/serialize.ts` are safe by construction. The **project archive deliberately keeps
them** — it round-trips whole rows, and a policy should survive an export/import.

**The appearance-hidden opinion lives in the entity config, not in rows.** `FieldDef.aiHidden`
carries it; `EntityAiPolicy.fieldVisibility` overrides per entity in **both** directions, which
is why it is a three-state map and not a list of hidden ids. Nothing is written on create, so
changing the config default later still reaches every entity that never expressed an opinion.

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
- **Never store a scene's position on another row.** `resequenceScenes` reassigns
  `globalOrder` on every insert and move, so anything that cached it is wrong by the next
  scene the author adds. Store `sceneId` and resolve the order at read time.
- **`updatedAt` is not "the prose changed".** Every metadata edit bumps it. N8 added
  `proseUpdatedAt` for the question the stale-summary chip actually asks.
- **`useLiveQuery` with an empty-array default cannot be told from a genuinely empty
  table.** N9's dock created a fresh thread on every reload because of it. Omit the default
  and guard on `undefined` whenever "no rows yet" triggers a write.
- The Writer's Room panel button row wraps now (`.lw-wroom__chapteractions`). It grew from
  three buttons to five, and before the wrap it ran under the notes rail where it could not
  be clicked.
- A new table added to `applyDelta` must go in **both** transaction table lists — the one
  in `intelligence/apply.ts` and the one in `db/repos/undo.ts` — or the write throws.
