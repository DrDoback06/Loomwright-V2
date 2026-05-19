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
OK: 524 UI callbacks; registry bootstraps 524 handlers
OK: registry default branch emits a user-visible notice (no silent fall-through).
OK: 0 Bucket A action callbacks reach the generic default notice.
OK: 6 Bucket B (provider-gated) callbacks use requireProviderOrNotice.
OK: 4 Bucket D (React-owned) callbacks declared.
INFO: 213 other callbacks fall to default notice (housekeeping/dispatch).

> npm run test:smoke
22/22 service smoke checks passed.

> CHROMIUM_PATH=/path/to/chrome npm run test:e2e
28 passed (≈3 min wall, real Chromium)
```

The e2e suite is in `tests/e2e/`; six spec files cover 28 tests across
workflows A–J defined in `FINAL_QA_REPORT.md`.

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

---

### B. Prototype / thin (works, but quality is intentionally limited)

Things that have a working code path but where the **quality of the
result** is prototype-level. They aren't broken; they aren't great yet.

| Area | State | Why it's thin |
|------|-------|---------------|
| **Extraction quality (local pass)** | Pass 1 detectors landed: item transfer/loss, travel, relationship interaction (single-pass), stat change, quest progression, event creation, lore/canon. Persisted candidates carry `matchType`, `confidence`, `confidenceBand`, `sourceQuote`, `previousState`, `relatedEntityIds`, `suggestedChanges`. Dedupe across local + AI. | Detector confidence values are heuristics (0.62–0.80) — they need real-manuscript evaluation to calibrate. Two-pass relationship extraction (legacy `extractRelationshipsAdvanced`) is still deferred. |
| **Extraction quality (deep pass / AI)** | Uses the canon 10-category prompt verbatim with `Known characters / Known items / Known locations` injection, chunked at 5000/500 with overlap | No fixture-based prompt tuning yet. No extraction-session undo trail with `previousState`. No two-pass relationship extraction even with AI. |
| **Project Intelligence derivation** | `ProjectIntelService` persists; `mergeFromOnboarding` writes onboarding answers into the intel record | No automatic derivation from references / entities / lore / manuscript summaries. No preview/diff before applying. No versioning/rollback. |
| **References ingestion** | Paste-text / URL / manual / kind tagging / `includedInAIContext` flag / linked entities all persist | No file upload pathway with real parsing (markdown/HTML/text only via paste). No reference summarisation by AI. No search across reference content. |
| **Speed Reader** | Component exists (`speed-reader.jsx`), workspace opens, callbacks wired | RSVP word display, pivot-letter, WPM controls, punctuation/sentence pause, bookmark, session persistence — not fully implemented. Workspace shell present; reading-engine internals are placeholder. |
| **Search / indexing** | No `SearchService` exists yet. Top-bar search button has UI but no real backend. | Out of scope for this milestone. |
| **Workspace persistence (beyond what's wired)** | Atlas / Skill Trees / Relationships / Timeline / Tangle / Speed Reader open and can persist via their respective services where wired, but deep create→edit→reorder→reload paths are not test-covered for every workspace | Bespoke workspaces vary in completeness. No e2e tests per workspace. |
| **Full project import/export** | `exportProject()` / `importProject()` exist in `backend-services.jsx`; not test-covered end-to-end | No "preview before import" UI; no backup-before-replace prompt; no entity-library export with selected types and include/exclude toggles. |
| **Audit log / undo trail** | Some services log to `lw:*` events; `extractionHistoryService`-style per-action `previousState` undo is not implemented | Legacy audit documents the model; not yet ported. |
| **Field parity across all entity types** | Cast, Bestiary, Items, Quests, Events, Locations, Stats, Skills, Classes, Races, Lore, References, Factions, Relationships, Timeline editors exist. `FIELD_PARITY_AUDIT.md` documents what was filled. | Round-trip JSON import → edit → export hasn't been re-verified per type since the burn-down. |
| **Production build pipeline** | `Loomwright Shell.html` still uses in-browser Babel-standalone | A precompiled JSX/Vite pipeline is documented as a future milestone (own pass, own plan). |
| **Documentation consistency** | Many `*_HOOKUP.md` files still describe pre-implementation hookup requirements as if they were future work; addressed in this pass by adding a "Current state" footnote header referencing this audit | Bodies of those docs remain useful as design-intent references. |

---

### C. Provider-gated (Bucket B — depend on user-configured AI)

These actions only run when a BYOK provider key is configured in
Settings → AI Providers. Without a key they show a **provider-specific**
notice ("Configure an AI provider in Settings to use X."), not the
generic "isn't wired yet" message. Configured providers use
OpenAI-compatible chat-completions; multi-provider routing
(Anthropic/Gemini/OpenRouter/Ollama) is not yet implemented.

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

- **Multi-provider AI routing** (Anthropic/Claude direct, Gemini direct, OpenRouter, Local/Ollama, custom-endpoint per-task routing, cost/quality modes, privacy guard preview UI).
- **Two-pass relationship extraction** (legacy `extractRelationshipsAdvanced`) — documented in `LEGACY_EXTRACTION_AUDIT.md` but not ported.
- **Extraction-session undo trail** with per-action `previousState` and `revertSession()` — documented but not ported.
- **Character enhancement** — legacy "Enhance" button that AI-fills stats/equipment/biography for a new cast member. Out of scope.
- **Cloud sync / external collaboration / shared projects** — none planned.
- **Production build pipeline** (precompiled JSX, no in-browser Babel, real bundle output, source maps) — own milestone, requires a plan doc and migration path.
- **Search/indexing service** — no `SearchService` exists. Top-bar search is presentational.
- **Speed Reader engine** — workspace shell and callbacks exist; RSVP/word-pivot/persistence engine is not built.
- **Per-workspace e2e coverage** for Atlas / Skill Trees / Relationships / Timeline / Tangle / Speed Reader.
- **Full project import preview UI** with backup-before-replace and merge-vs-replace modes.
- **Audit log surface on Home** with undo for last review action / extraction session / entity edit / chapter delete.

---

### E. Needs next PR — recommended priority order

Per the agreement to do **one phase per PR**, the next passes (each its
own branch + PR + review) should land in this order:

1. **Docs reconciliation pass (this PR)** — landing now. Surfaces this audit, marks stale doc sections, brings every status doc into agreement with the test output. Zero feature code.
2. **Extraction Quality pass** — `tests/fixtures/extraction/` fixtures, local-rule improvements (item ownership / travel / relationship interaction / stat change / quest progression / event trigger phrases), `EXTRACTION_QUALITY_PLAN.md` first, then implementation. Highest user value next.
3. **Field Parity pass** — verify and tighten per-type JSON template ↔ editor ↔ panel ↔ persistence schema. Mostly mechanical; eliminates "I saved an entity and a field disappeared" failure modes.
4. **Workspace Persistence pass** — per-workspace create→edit→reload tests + any wiring fixes uncovered. Covers Atlas, Skill Trees, Relationships, Timeline, Tangle.
5. **Full Project Import/Export pass** — preview UI + backup-before-replace + merge-vs-replace + entity-library export. Important safety net before serious users.

Subsequent (separate milestones, in roughly this order, all optional
until earlier passes are solid):

6. **Speed Reader engine** as a focused pass with persistence tests.
7. **Search / indexing** when there's enough data to justify it.
8. **Audit log + undo** as a single safety-net pass.
9. **Multi-provider AI routing** when single-provider gating proves limiting.
10. **Production build pipeline** with `BUILD_PIPELINE_PLAN.md` first and smallest-safe-step implementation.

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
