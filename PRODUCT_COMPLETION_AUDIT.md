# Loomwright v2 — Product Completion Audit

_Created: 2026-05-19 (post-PR-#3 merge to `main`)._

> **Purpose.** This document is the single source of truth for what
> Loomwright v2 currently implements, what is intentionally thin, what
> is provider-gated, and what remains out of scope. Older docs (listed
> below) contain useful design intent but may include obsolete status
> claims from earlier passes — this file supersedes their _status_
> sections.

## Verification baseline

Reproduce on a clean checkout of `main`:

```
> npm install
> npm run validate
All checked HTML references exist.
OK: 526 UI callbacks; registry bootstraps 558 handlers
OK: registry default branch emits a user-visible notice (no silent fall-through).
OK: 0 Bucket A action callbacks reach the generic default notice.
OK: 6 Bucket B (provider-gated) callbacks use requireProviderOrNotice.
OK: 4 Bucket D (React-owned) callbacks declared.
INFO: 213 other callbacks fall to default notice (housekeeping/dispatch).

> npm run test:smoke
All smoke checks passed (… + audit + ai routing — 22 new [ai routing] assertions).

> CHROMIUM_PATH=/path/to/chrome npm run test:e2e
85 passed (real Chromium) — workflows A–R + T (DOM-level UI acceptance, incl. review Accept/Deny/Merge) against the dev shell.

> npm run build
Production build complete → dist/   (precompiled bundle, no in-browser Babel)
Production build checks passed.     (16 self-check assertions)

> CHROMIUM_PATH=/path/to/chrome npm run test:e2e:preview
2 passed — workflow S, production boot against `vite preview` serving dist/.
```

The dev e2e suite is in `tests/e2e/` (workflows A–R, plus T = DOM-level
UI acceptance in `15-ui-acceptance.spec.js`); the production boot smoke
is in `tests/e2e-preview/` (workflow S). Product milestone:
**local beta candidate** (see `PRODUCT_READINESS_REPORT.md` and
`USER_ACCEPTANCE_REGRESSION_AUDIT.md`).

> **UAT live-render fix (post-PR #13).** The render layer previously
> showed design/demo constants (Aelinor Vey, "12 entries · 3 in review")
> on a fresh project even though the services were correct, because the
> prior e2e suite drove services via `page.evaluate` and never asserted
> on rendered DOM. Fixed: panels, dashboards (Home/Today), left-rail
> badges, subtitles, and entity pickers now read the live store with
> proper empty states; workflow T clicks real DOM to prove it. See
> `USER_ACCEPTANCE_REGRESSION_AUDIT.md`.

## Scope buckets

The buckets below are mutually exclusive. Every behaviour the product
exposes is in exactly one of them.

---

### A. Implemented (verified by tests)

Things that have working code paths AND test coverage. Regressing these
breaks `npm run test:smoke` or `npm run test:e2e`.

| Area | Coverage |
|------|----------|
| App boot — Writer's Room renders, Settings opens, no fatal console errors | e2e A. (3 tests) |
| Fresh project starts truly empty (no silent demo data); Home empty-state card; panels do not crash on empty store | e2e B. (3 tests) |
| Entity creation + persistence across reload for Cast / Location / Item / Quest / Event | e2e C. (5 + 1 link test) |
| `EntityService.save / update / delete / listSync / getSync` + IndexedDB+localStorage mirror | smoke + e2e |
| `LinkService.appendField` (creates array, dedupes primitives) | smoke |
| `LinkService.linkField` (entity-to-entity references) | e2e |
| `LinkService.mergeEntities` — global reference rewrite across entities, review queue, composition, references, trash, project intelligence | smoke + e2e J |
| `OccurrenceService.save / listByChapterSync / saveMany / rebindEntity / markStale` | smoke |
| `isOccurrenceStale(occ, bodyText)` staleness detection | smoke + e2e D |
| Local-pass extraction scanner — records `EntityOccurrence` for known entity names without any AI provider | smoke + e2e D |
| Local phrase detectors (item transfer/loss, travel, relationship interaction, stat change, quest progression, event creation, lore/canon) — produce candidates with `suggestedChanges` from chapter text without any AI provider | 12 extraction fixtures (smoke) + e2e K (3 tests) |
| Candidate dedupe across local + AI passes; standardised candidate shape (`candidateId`, `suggestedAction`, `confidence`, `confidenceBand`, `matchType`, `existingEntityId`, `sourceQuote`, `sourceQuotes[]`, `previousState`, `relatedEntityIds`, `suggestedChanges`) | smoke fixtures + e2e K |
| Accept-on-`suggestedChanges` applies only the diff to `entity.data` (pre-existing fields preserved) | e2e K.3 |
| Paragraph-aware extraction — `runExtraction({paragraphs})` tags occurrences and AI candidates with `paragraphId` when supplied | code path, not yet exercised by tests |
| `OccurrenceService` survives reload | e2e D |
| `EntityOccurrence` records render as Writer's Room highlights on chapter load; demo placeholder IDs get replaced by real entity IDs when an occurrence covers the same text | rendering wired in `writers-room.jsx` (visible after reload — manual verification step in FINAL_QA_REPORT.md) |
| Writer's Room manuscript double-click resolves by `occurrenceId` → `entityId` → fuzzy fallback; "may need relinking" notice on stale occurrence | code path; smoke covers staleness |
| Review queue: Accept (creates/updates entity, links candidate occurrences to new entity), Deny, bulk Accept, bulk Deny | e2e E (4 tests) |
| Merge modal: dispatches `lw:open-merge-modal` with ranked alternatives (alias > name-equal > substring > word-overlap heuristic); Confirm calls `LinkService.mergeEntities` + resolves queue item as `merged` | e2e E |
| Composition overlay: drop entity persists; instructions/role/mode/POV/length/tone/chapter-target persist; Create chapter from composition produces a chapter via `ManuscriptChapterService.createFromComposition` | e2e F (2 tests) |
| AI Handoff: `lw:ai-handoff-import` review mode creates queue items; `updateEntities` mode patches existing entity; `saveReference` mode saves a reference | e2e G (2 tests) |
| Sample project: opt-in only; `loadSample` merges (user records preserved on id conflict, sample records tagged `source: "sample"`); `clearSample` removes only sample-tagged records | smoke + e2e H (2 tests) |
| Trash: delete moves entity to trash; restore returns it | e2e I |
| Settings: `requireProviderOrNotice` surfaces "Configure an AI provider in Settings to use X." when no key configured | e2e J |
| Callback registry: 524 names bootstrapped; document-level capture listener; `lw:dispatch-callback` event support; default branch emits a user-visible notice; **0 Bucket A reaches the generic default** (audit-enforced as hard fail) | `scripts/audit-callbacks.js` |
| Vendored React 18.3.1 / ReactDOM 18.3.1 / Babel-standalone 7.29.0 under `./vendor/` — pinned in `package.json`, app boots in sandboxed/offline environments | shell loads them |
| `ReviewService.resolveMany(ids, status)` — bulk resolve for the review queue | smoke + e2e E |
| `TangleService.addNode / updateNode / removeNode / addGroup` with `KEYS.tangle` persistence | code + smoke (used by `onSendSuggestionToTangle`) |
| Onboarding paste-JSON / apply-step-JSON path → `OnboardingService.save` + `ProjectIntelService.mergeFromOnboarding` | code |
| Resilient cosmetic data-attributes for testing: `data-ui="WorkspaceShell"`, `data-workspace-id={id}` (on `FullWorkspaceHost` wrapper), `data-ui="HomeEmptyState"`, `data-testid` on empty-state buttons | code + e2e |
| **Full Project Import / Export / Backup / Entity Library** — `ProjectArchiveService` builds `loomwright-project-v1` payloads; `validateExportPayload` accepts v1 + legacy `loomwright/project-export/v1\|v2`; `summarizeExportPayload` powers the import preview; `applyImport({mode: "merge" \| "replace", overwriteOnConflict})` covers entities/chapters/refs/occurrences/queue/onboarding/intel/skill-trees/tangle/composition/settings/trash; `createBackupBeforeReplace()` downloads a recovery file before destructive replace; `buildEntityLibrary({types})` / `applyEntityLibrary` move selected entity types between projects. **API keys never export** (`api_keys_encrypted` blob is never read; `metadata.apiKeysIncluded` is hard-coded `false`; `redactSecrets` strips any `apiKey/secret/token/password/bearer/credential` recursively). | smoke (24 assertions) + e2e N (5 tests) |
| **Speed Reader** — `SpeedReaderService` persists per-source RSVP sessions under `KEYS.speedReader`. Source resolvers: current chapter (via `ManuscriptChapterService`), pasted text, references (via `KEYS.references`). Session shape carries `currentWordIndex`, `wpm`, `fontSize`, pause settings, `bookmarks`, `notes`, `stats`. `useSpeedReader` hydrates on mount, debounces persistence (~250 ms) for the active persisted session, and re-hydrates on source switch. Five new callbacks (`onCreateSpeedReaderSession`, `onReadCurrentChapter`, `onReadReference`, `onDeleteSpeedReaderSession`, `onResetSpeedReaderProgress`) wired through the backend delegate. | smoke (26 assertions) + e2e O (5 tests) |
| **Search / Indexing** — `SearchService` builds a local global index across entities (14 types), chapters, references, review queue, project intelligence, onboarding answers, safe settings sections, occurrences, and (opt-in) trash. Ranking: title exact > alias exact > title prefix > title contains > tag exact > body phrase > token overlap (capped). `CommandPalette` reads live results; result rows carry typed pointers (`entityId`, `chapterId`, `referenceId`, `settingsSectionId`, …) and click dispatches `lw:open-search-result` which maps to the right open event in `app.jsx`. Index refreshes (~150 ms debounced) on every relevant store mutation. **API secrets never indexed** — encrypted `api_keys_encrypted` blob is never read; secret-named fields are stripped recursively inside whitelisted settings sections. 11 new callbacks registered. | smoke (22 assertions) + e2e P (7 tests) |
| **Audit Log / Undo (partial)** — `AuditService` records every meaningful mutation across `EntityService`, `ManuscriptChapterService`, `ReviewService`, `ReferencesService`, `OnboardingService`, `ProjectIntelService`, `SettingsService`, `SampleProjectService`. Each event carries `before/after` snapshots redacted via `redactSecrets`. Reversible actions (`entity.create/update/delete`, `chapter.create/save/delete`, `reference.*`, `onboarding.update`, `intel.update`, `settings.section-update`, `review.accept/deny`, `sample.load`) support `AuditService.undo(eventId)` with an anti-recursion `{skipAudit:true}` flag to prevent cascades. Destructive actions (`project.reset`, `entity.merge`, `project.import`, hard-delete, `library.import`, `review.bulk-*`) are audit-only. Home Recent Activity card reads live from `getRecentSync(10)` with Undo buttons. **API secrets never logged** (redacted on every event). 5 new callbacks registered (`onUndoAuditEvent`, `onOpenAuditLog`, `onClearAuditLog`, `onExportAuditLog`, `onOpenRecentActivityItem`). | smoke (23 assertions) + e2e Q (6 tests) |
| **Multi-provider AI Routing** — `AIService` adapter pattern (OpenAI-compatible / OpenRouter / Anthropic / Ollama / Custom; Gemini pending) with `complete / completeJson / testConnection / saveProviderConfig / clearProviderKey / buildGuardSummary`. `AIRoutingService` persists per-task routing under `KEYS.aiRouting` (`mode`, `defaultProviderId`, `taskRoutes`, privacy flags); `resolveRoute(task)` returns `{providerId, model}` or null (localOnly blocks). `AIContextBuilder.build()` assembles bounded context (chapter + entities + intel + references). Privacy guard confirms before any manuscript/reference/intel text is sent; local-only mode blocks external calls. The 6 provider-gated callbacks route through routing + guard + adapters and are functional when configured. **Keys never in config/export/audit/search** (encrypted in `KEYS.apiKeys`; stripped from config; `testConnection` sends no manuscript text). 5 new config/routing callbacks registered. | smoke (22 assertions) + e2e R (6 tests) |
| **Production build pipeline** — `npm run build` (`scripts/build-production.js`) precompiles the 63 source `.jsx` files (in the exact `Loomwright Shell.html` order, with the identical runtime Babel config: `react` + `transform-block-scoping`) into `dist/loomwright.bundle.js`, and generates `dist/index.html` loading vendored React + the bundle — **no in-browser Babel, no CDN runtime dependency**. `scripts/check-production-build.js` (16 assertions) verifies the output. `npm run preview` serves it; `npm run test:e2e:preview` proves production boot. The dev shell stays the editing source of truth, marked legacy/dev. | build self-check (16 assertions) + e2e S (2 boot tests) |

---

### B. Prototype / thin (works, but quality is intentionally limited)

Things that have a working code path but where the **quality of the
result** is prototype-level. They aren't broken; they aren't great yet.

| Area | State | Why it's thin |
|------|-------|---------------|
| **Extraction quality (local pass)** | Pass 1 detectors landed: item transfer/loss, travel, relationship interaction (single-pass), stat change, quest progression, event creation, lore/canon. Persisted candidates carry `matchType`, `confidence`, `confidenceBand`, `sourceQuote`, `previousState`, `relatedEntityIds`, `suggestedChanges`. Dedupe across local + AI. | Detector confidence values are heuristics (0.62–0.80) — they need real-manuscript evaluation to calibrate. Two-pass relationship extraction (legacy `extractRelationshipsAdvanced`) is still deferred. |
| **Field parity (priority 8: Cast, Items, Locations, Quests, Events, Stats, Bestiary, References)** | Pass 1 landed: schema-aspirational/display-descriptive split. Every priority-8 entity's editor / JSON template / persistence / import / export round-trips its full required-field set. Unknown/deeper fields survive save+reload (`extra.*` preservation). Severe gap closed (`Locations.sourceMentions`); aspirational additions for trade-transfer log, destroyed-location, child-locations, related-locations (Bestiary), assigned-entities / change-history (Stats), `isResearchNote` (References), `dormant` toggle for consistency. | Audit-only types (Classes, Races, Skills, Relationships, Timeline, Lore) have basic round-trip smoke coverage; deep coverage deferred to Pass 2 if their panels add new fields. Panels still render some demo data alongside live store; that's by-design display work, not a parity gap. |
| **Workspace persistence (priority 5: Atlas, Skill Trees, Relationships, Timeline, Tangle)** | Pass 1 landed: AtlasService (thin facade over EntityService for placement + routes + entity-to-location links), SkillTreeService (new, under KEYS.skillTrees — tree refs nodeIds + edges + layout; skills stay in EntityService), Relationships/Timeline via existing EntityService, TangleService extended with position support and edges default state. 26 new smoke assertions + 5 new e2e tests prove service-level round-trip. | Workspace component rendering still reads from module-level demo constants on first paint when storage is empty (sample-data-gating rule honoured). Rewriting workspace render paths to consume services first is panel-rebuild territory and was deliberately not in scope. |
| **Extraction quality (deep pass / AI)** | Uses the canon 10-category prompt verbatim with `Known characters / Known items / Known locations` injection, chunked at 5000/500 with overlap | No fixture-based prompt tuning yet. No extraction-session undo trail with `previousState`. No two-pass relationship extraction even with AI. |
| **Project Intelligence derivation** | `ProjectIntelService` persists; `mergeFromOnboarding` writes onboarding answers into the intel record | No automatic derivation from references / entities / lore / manuscript summaries. No preview/diff before applying. No versioning/rollback. |
| **References ingestion** | Paste-text / URL / manual / kind tagging / `includedInAIContext` flag / linked entities all persist | No file upload pathway with real parsing (markdown/HTML/text only via paste). No reference summarisation by AI. No search across reference content. |
| ~~**Speed Reader**~~ | _Moved to **A. Implemented** by `SPEED_READER_COMPLETION_REPORT.md`._ Row kept for diff-tracking only. | _n/a_ |
| ~~**Search / indexing**~~ | _Moved to **A. Implemented** by `SEARCH_INDEXING_REPORT.md`._ Row kept for diff-tracking only. | _n/a_ |
| **Workspace persistence (beyond what's wired)** | Atlas / Skill Trees / Relationships / Timeline / Tangle / Speed Reader open and can persist via their respective services where wired, but deep create→edit→reorder→reload paths are not test-covered for every workspace | Bespoke workspaces vary in completeness. No e2e tests per workspace. |
| ~~**Full project import/export**~~ | _Moved to **A. Implemented** by `PROJECT_IMPORT_EXPORT_REPORT.md`._ Row kept for diff-tracking only. | _n/a_ |
| ~~**Audit log / undo trail**~~ | _Moved to **A. Implemented** by `AUDIT_UNDO_REPORT.md` — partial: core safe local actions are undoable; destructive/import/provider actions are audit-only._ Row kept for diff-tracking only. | _n/a_ |
| **Field parity across all entity types** | Cast, Bestiary, Items, Quests, Events, Locations, Stats, Skills, Classes, Races, Lore, References, Factions, Relationships, Timeline editors exist. `FIELD_PARITY_AUDIT.md` documents what was filled. | Round-trip JSON import → edit → export hasn't been re-verified per type since the burn-down. |
| ~~**Production build pipeline**~~ | _Moved to **A. Implemented** by `PRODUCT_READINESS_REPORT.md` / `PRODUCTION_BUILD_PLAN.md`._ `npm run build` precompiles the JSX into `dist/loomwright.bundle.js` (no in-browser Babel, no CDN runtime); `dist/index.html` is the production entry. Row kept for diff-tracking only. | _n/a_ |
| **Documentation consistency** | Many `*_HOOKUP.md` files still describe pre-implementation hookup requirements as if they were future work; addressed in this pass by adding a "Current state" footnote header referencing this audit | Bodies of those docs remain useful as design-intent references. |

---

### C. Provider-gated (Bucket B — depend on user-configured AI)

These actions only run when a BYOK provider key is configured in
Settings → AI Providers. Without a key they show a **provider-specific**
notice ("Configure an AI provider in Settings to use X."), not the
generic "isn't wired yet" message. In **Local-only mode** they show
"AI is disabled (Local-only mode)…". Multi-provider routing is now
**implemented** (`AIService` adapter pattern: OpenAI-compatible /
OpenRouter / Anthropic / Ollama / Custom; Gemini adapter pending) with
per-task routing via `AIRoutingService`, a privacy guard before
manuscript text is sent, and `AIContextBuilder` for bounded context.
See `AI_PROVIDER_ROUTING_REPORT.md`.

| Callback | Behaviour with no provider | Behaviour with provider |
|----------|----------------------------|--------------------------|
| `onGenerateAIWriterDraft` | Notice | `AIService.complete` returns draft → composition state |
| `onGenerateDraftSkillTree` | Notice | AI generates draft nodes into `skill.data.draftNodes` |
| `onGenerateCompositionDraft` | Notice | AI generates draft → `window.__LW_LAST_GENERATED_DRAFT__` |
| `onRunContinuityCheck` | Local heuristic only (scans canon facts against current chapter text for negations) | AI augmentation appended to local heuristic results |
| `onRunEntitySuggestion` | Local extraction (`deep: false`) | Deep extraction (`deep: true`) |
| `onAcceptGeneratedText` | Notice if no draft | Inserts via `lw:composition-insert-draft` |
| `onCopyGeneratedText` | Notice if no draft | Clipboard write |
| `onSaveAndDeepExtract` | Local-pass occurrence scan only; AI step skipped silently | AI step runs with the canon 10-category prompt |

`AIService.testConnection(providerId)` is wired through
`onTestAIProviderConnection` and `onValidateProviderKey`.

---

### D. Future scope (deliberately out of scope this milestone)

Items the design documents call for but that have **not** been
implemented and are not on the immediate roadmap. None of these are
blocking the "functional local prototype" status.

- _(Removed — implemented in Multi-provider AI Routing Pass; see section A row "Multi-provider AI Routing". Gemini adapter + cost/quality token tables remain pending.)_
- **Two-pass relationship extraction** (legacy `extractRelationshipsAdvanced`) — documented in `LEGACY_EXTRACTION_AUDIT.md` but not ported.
- **Extraction-session undo trail** with per-action `previousState` and `revertSession()` — documented but not ported.
- **Character enhancement** — legacy "Enhance" button that AI-fills stats/equipment/biography for a new cast member. Out of scope.
- **Cloud sync / external collaboration / shared projects** — none planned.
- _(Removed — implemented in Production Build Hardening Pass; see section A row "Production build". Source maps + minification + production-React swap remain future polish.)_
- _(Removed — implemented in Search/Indexing Pass; see section A row "Search / Indexing".)_
- _(Removed — implemented in Speed Reader Completion Pass; see section A row "Speed Reader".)_
- **Per-workspace e2e coverage** for Atlas / Skill Trees / Relationships / Timeline / Tangle / Speed Reader.
- _(Removed — implemented; see Full Project Import / Export / Backup / Entity Library row in section A.)_
- _(Removed — implemented in Audit Log / Undo Pass; see section A row "Audit Log / Undo (partial)".)_

---

### E. Needs next PR — recommended priority order

Per the agreement to do **one phase per PR**, the next passes (each its
own branch + PR + review) should land in this order:

1. **Docs reconciliation pass (this PR)** — landing now. Surfaces this audit, marks stale doc sections, brings every status doc into agreement with the test output. Zero feature code.
2. **Extraction Quality pass** — `tests/fixtures/extraction/` fixtures, local-rule improvements (item ownership / travel / relationship interaction / stat change / quest progression / event trigger phrases), `EXTRACTION_QUALITY_PLAN.md` first, then implementation. Highest user value next.
3. **Field Parity pass** — verify and tighten per-type JSON template ↔ editor ↔ panel ↔ persistence schema. Mostly mechanical; eliminates "I saved an entity and a field disappeared" failure modes.
4. **Workspace Persistence pass** — per-workspace create→edit→reload tests + any wiring fixes uncovered. Covers Atlas, Skill Trees, Relationships, Timeline, Tangle.
5. ~~**Full Project Import/Export pass**~~ _(landed; see section A row "Full Project Import / Export / Backup / Entity Library" and `PROJECT_IMPORT_EXPORT_REPORT.md`)._

Subsequent (separate milestones, in roughly this order, all optional
until earlier passes are solid):

6. ~~**Speed Reader engine**~~ _(landed; see section A row "Speed Reader" and `SPEED_READER_COMPLETION_REPORT.md`)._
7. ~~**Search / indexing**~~ _(landed; see section A row "Search / Indexing" and `SEARCH_INDEXING_REPORT.md`)._
8. ~~**Audit log + undo**~~ _(landed; see section A row "Audit Log / Undo (partial)" and `AUDIT_UNDO_REPORT.md`)._
9. ~~**Multi-provider AI routing**~~ _(landed; see section A row "Multi-provider AI Routing" and `AI_PROVIDER_ROUTING_REPORT.md`. Gemini adapter pending.)_
10. ~~**Production build pipeline**~~ _(landed; see section A row "Production build" and `PRODUCTION_BUILD_PLAN.md` / `PRODUCT_READINESS_REPORT.md`)._

---

## Stale doc sections superseded by this audit

These older docs predate the burn-down / occurrence-rendering /
sample-gating / QA-suite passes. They remain useful as design intent
references, but their _status_ claims are out of date.

| File | Old claim now updated | Where to look |
|------|-----------------------|---------------|
| `VERIFICATION_REPORT.md` | Dated 2026-05-17; describes a smaller pre-burn-down state | Marked historical (see header note added in this pass) |
| `CODING_AGENT_HANDOFF.md` | Mostly current after the 2026-05-18 update at top; older sections still describe demo seeding and "review queue placeholder" behaviour that has since been replaced | Header note added pointing here |
| `CODEX_BACKEND_IMPLEMENTATION_GUIDE.md` | "Writer's Room: inline script inside Loomwright Shell.html" — no longer true; uses `writers-room.jsx` | Header note added pointing here |
| `DESIGN_FINAL_AUDIT.md` | "Known limitations: Writer's Room entity linking (fuzzy fallback), extraction/review (mocked NLP), trash operations (presentational buttons)" — all now wired | Header note added pointing here |
| `EXTRACTION_HOOKUP.md` | Describes presentational hook-up requirements as future work; the wiring is implemented | Header note added pointing here |
| `EXTRACTION_REVIEW_HOOKUP.md` | Same | Header note added pointing here |
| `CALLBACK_AUDIT.md` | "for the follow-up coding agent to wire each to backend behaviour" — done | Header note added pointing here |
| `FEATURE_PENDING_CALLBACKS.md` | Stops at the burn-down pass — correct snapshot for that point | Header note added clarifying its time-fixed nature |
| `FIELD_PARITY_AUDIT.md` | Documents the parity push; still accurate for the fields it lists | No change needed |
| `IMPLEMENTATION_STATUS.md` | Running status; current sections OK | Append new "post-PR-#3 merged" section |
| `FINAL_QA_REPORT.md` | Round 1 + Round 2 sections current; reflect 28/28 e2e | Header note pointing here |
| `LEGACY_EXTRACTION_AUDIT.md` | Behavioural reference only; explicitly not a status doc | No change needed |
| `README.md` | "This repository contains the extracted Loomwright v2 design build." — needs to say _tested functional local prototype_ | Updated in this pass |

The `*_HOOKUP.md` files (`ATLAS_*`, `BESTIARY_*`, `CAST_*`, `CLASSES_*`,
`ITEMS_*`, `LOCATIONS_*`, …) document design intent for the panels and
workspaces. They are not status docs — they describe what each surface
expects. Their bodies remain useful as references.

---

## Outstanding action for the user

After this PR merges: pick the next focused PR. The recommendation is
**Extraction Quality pass** (E.2 above) — biggest value to users now
that the prototype is stable.
