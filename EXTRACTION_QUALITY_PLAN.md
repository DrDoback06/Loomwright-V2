# Extraction Quality Pass 1 — Plan

_Created: 2026-05-19, on branch `claude/extraction-quality-pass` (started from `main` post-PR-#4)._

> **Scope discipline.** This PR is **extraction quality only**. No UI
> redesign. No panel rebuild. No field-parity, workspace-persistence,
> import/export, speed-reader, search, audit-undo, AI-routing, or
> production-build work. Existing test suite stays green.
>
> Framing: "Pass 1". Better local rules, better fixtures, better
> candidate shape, safer review/occurrence integration. Future passes
> can tune AI prompts further, add the two-pass relationship extractor
> from the legacy audit, and add the extraction-session undo trail.

## A. Current extraction state (audit of `main` as of `abe47d9`)

### What currently works

- **Save & Extract** wires through `callback-registry.jsx`:
  `onSaveAndExtract` → `ManuscriptService.saveCurrentDom` → snapshot →
  `ExtractionService.runExtraction({ chapterId, text, deep: false })`.
  `onSaveAndDeepExtract` does the same with `deep: true`.
- **Local-pass scanner** (`scanTextForKnownEntities` in
  `backend-services.jsx`) loops every entity in the store and uses
  `findRanges` (case-insensitive whole-word) to find mentions of
  `entity.name` and every `entity.aliases[]`. Every hit becomes an
  `EntityOccurrence` record stored under `KEYS.occurrences` with real
  `entityId`, `entityType`, `exactText`, `chapterId`,
  `startOffset/endOffset`, `extractionSessionId`. Persistent. Works
  without any AI provider.
- **Three-tier matcher** (`findKnownEntityMention`): exact (1.0) →
  alias (0.95) → Levenshtein fuzzy (>= 0.85). Used to enrich review
  candidates with `matchType` and resolve `targetEntityId` for the
  upgrade path.
- **Chunked AI extraction**: `chunkText(text, 5000, 500)` produces
  overlapping chunks. Each chunk gets the canon 10-category prompt
  (quick variant or deep variant) with `Known characters / Known
  items / Known locations` injection. JSON parsed; falls back
  silently on unparseable chunks.
- **Per-candidate enrichment** (current shape on review items):
  `matchType`, `confidence`, `confidenceBand`, `suggestedAction`
  (create/update/link), `sourceQuote`, `previousState`,
  `targetEntityId`, `candidateId`, `chapterId`,
  `extractionSessionId`.
- **Occurrence backfill on accept**: `acceptQueueItem` in
  `callback-registry.jsx` calls
  `OccurrenceService.linkCandidateToEntity(candidateId, savedId,
  type)` so any local-pass occurrences stamped with the candidate's id
  get their real `entityId` after acceptance.
- **Occurrence rebind on merge**: `LinkService.mergeEntities` calls
  `OccurrenceService.rebindEntity(fromId, toId)` so manuscript
  double-click keeps working after a merge.
- **Bulk review actions**: `ReviewService.resolveMany(ids, status)` +
  callback handlers `onBulkAcceptQueueItems`,
  `onBulkDenyQueueItems`, `onBulkMergeQueueItems` (opens merge modal
  in bulk-context mode).

### What is rule-based

- Whole-word name/alias matching (local pass).
- Three-tier candidate matching against known entities.
- Chunking with overlap.
- Confidence band derivation (0–1 → blue/green/orange/red).

### What is provider-gated (Bucket B)

- The AI step inside `runExtraction` (only runs if
  `AIService.getProviderConfig()` returns a key). Without a provider
  the local pass alone produces occurrences but **no candidate review
  items**.
- `onRunEntitySuggestion` (calls `runExtraction({deep:true})` only when
  configured).
- `onRunContinuityCheck` (local heuristic always; AI augmentation
  optional).

### What legacy Claimwise logic has already been ported

(See `LEGACY_EXTRACTION_AUDIT.md` for full details.)

- Chunked extraction with overlap (5000/500). ✓
- Three-tier name matcher (exact / nickname / fuzzy via Levenshtein). ✓
- Confidence scoring on every candidate, mapped to confidence band. ✓
- `Known characters / items / locations` prompt injection. ✓
- Diff-based "upgrade vs new" detection (`diffEntity`). ✓
- Bulk review-queue resolve. ✓

### What is NOT yet ported from legacy

- **Two-pass relationship extraction** (pass 1: pair identification,
  pass 2: per-pair detail). Deferred to a later pass.
- **Extraction-session undo trail** with per-action `previousState`
  records and `revertSession(sessionId)`. Deferred.
- **Character enhancement** (auto-fill stats/equipment via AI). Out
  of scope; separate feature.

### What is currently tested

- `tests/smoke-services.js`:
  - Known-entity mention becomes occurrence.
  - Occurrence bound to chapterId.
  - Occurrence points at real entityId.
  - `isOccurrenceStale` detects edited text.
- `tests/e2e/03-extraction-and-occurrence.spec.js`:
  - Local-pass scanner records `EntityOccurrence` for known names.
  - `OccurrenceService` survives reload.
  - Stale occurrence flagged correctly.
- `tests/e2e/04-review-queue.spec.js`:
  - Accept (creates entity + resolves item).
  - Deny.
  - Bulk accept.
  - Merge modal opens with ranked alternatives.

### What is NOT yet tested

- No tests for **item ownership change** detection.
- No tests for **travel / location change** detection.
- No tests for **relationship interaction** detection.
- No tests for **quest progression** detection.
- No tests for **event trigger** detection.
- No tests for **stat change phrase** detection.
- No tests for **lore/canon mention** detection.
- No tests for **alias / nickname** resolution accuracy.
- No tests for **false-positive trap** (common words that shouldn't
  match as entities).
- No tests for **long-chapter chunking** boundary behaviour (a single
  mention spanning the overlap).
- No tests for **candidate dedupe** (same name appearing many times in
  one chapter producing one candidate, not many).
- No tests for **paragraph metadata** (`paragraphId`, paragraph-local
  offsets) on occurrences.

## B. Fixture strategy

New directory: `tests/fixtures/extraction/`.

Synthetic Pale-Reach-flavoured fixtures (close enough to the
`WR_DEMO_PROJECT` sample world that they read naturally; no
copyrighted text). Each fixture is a tiny module
(`<name>.fixture.js`) exporting:

```js
module.exports = {
  name: "simple-known-mention",
  description: "...",
  // Seeded entities to load before extraction runs.
  seed: {
    cast:      [{ id: "aelinor", name: "Aelinor", aliases: ["Ael"] }],
    locations: [{ id: "vraska",  name: "Vraska Pass" }],
    items:     [{ id: "auger",   name: "Auger of Hess" }],
  },
  chapterId: "ch-fixture-001",
  text: "...",            // The chapter body
  // Expected outputs (what the extractor SHOULD produce):
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
    // ...
  ],
  expectedCandidates: [
    { entityType: "items", suggestedAction: "update",
      matchType: "exact", existingEntityId: "auger" },
    // ...
  ],
  // Sanity bounds — fixtures aren't graded; they're regression nets.
  minOccurrences: 1,
  maxOccurrences: 50,
};
```

### Required fixtures

1. **simple-known-mention** — one chapter, mentions one seeded cast
   member by name twice. Expectation: 2 occurrences, 0 candidates
   (entity already exists).
2. **alias-nickname** — same cast member referred to by alias and
   full name in the same paragraph. Expectation: occurrences for both
   mentions, both bound to the same `entityId`.
3. **character-and-location** — seeded cast walks through a seeded
   location. Expectation: occurrences for both; no candidate (both
   known).
4. **item-ownership-change** — text says "Aelinor handed the Auger to
   Saren". Expectation: one item-ownership candidate of
   `suggestedAction: "update"` with `suggestedChanges.ownerId =
   "saren"`. Plus occurrences for Aelinor, Saren, Auger.
5. **travel-location-change** — "Aelinor crossed Vraska Pass and
   reached the Glass Court". Expectation: travel candidate
   `suggestedAction: "update"` for Aelinor with
   `suggestedChanges.location = "glass-court"`; "Glass Court" is
   unknown so a new-location candidate is also created.
6. **quest-progression** — "The hunt for the Auger had moved into its
   second phase." Expectation: quest candidate referencing the Auger,
   `suggestedAction: "update"` or "create" depending on seed.
7. **event-creation** — "Then the Auger Wake began." Expectation:
   event candidate `suggestedAction: "create"` with `eventType:
   "named-event"`.
8. **relationship-interaction** — "Aelinor whispered to Saren". Both
   seeded. Expectation: relationship candidate of `relationshipType:
   "spoke-to"` linking Aelinor → Saren.
9. **stat-change-phrase** — "Aelinor felt her resolve harden". With
   a `resolve` stat seeded. Expectation: stat-change candidate
   referencing the stat and Aelinor.
10. **lore-canon-mention** — "It was said the Reach had once been
    green." Expectation: lore-candidate `suggestedAction: "create"`
    with `scope: "world-history"`.
11. **false-positive-trap** — Text that uses common words ("hess",
    "pass", "reach") in non-entity senses. Expectation: ZERO
    occurrences for those words despite Hess being a seeded entity's
    surname. Validates that whole-word/case-sensitive guard works.
12. **long-chapter-chunking** — Text ≥ 6000 chars with a deliberate
    entity mention straddling the 5000-char chunk boundary.
    Expectation: occurrence captured (no double-count from overlap).

## C. Local extraction improvements

All improvements live in `backend-services.jsx` inside the
`ExtractionService` block. **Local rules are AI-optional and run
unconditionally** — they're the floor of extraction quality.

### Improvements to existing matchers

- **Avoid common-word overmatch.** Tighten alias matching so single
  3-letter words ("Ael", "Hes") are only accepted as aliases when
  capitalised in source text AND not part of a longer word.
  `findRanges` already uses word-boundary `(?<![A-Za-z0-9])` —
  preserve this; add a tunable minimum-length per alias.
- **Fuzzy threshold sanity.** Levenshtein at 0.85 stays as the default
  but the API will accept a per-call override so high-signal callers
  can demand 0.95 (used for false-positive-prone phrase patterns).
- **Source-quote window.** Currently ~140 chars (60 before, 80 after
  first match). Keep, but trim leading/trailing whitespace and
  collapse internal newlines so review-queue cards render cleanly.

### New phrase detectors (Pass 1 set)

Each detector is a small, named function that takes
`(chapterText, knownEntitiesByType, chapterId, sessionId)` and returns
an array of candidate objects matching the standardised candidate
shape (§D). Detectors are intentionally pattern-based and
conservative — they should err on missing a real candidate rather than
producing a wrong one.

1. **Item possession / transfer.** Regex family:
   `<actor> (gave|handed|tossed|passed|sold|threw|surrendered|
   lost|dropped) (the |their |her |his |its )?<item> to <actor>` →
   `update`-shaped item candidate with `suggestedChanges.ownerId`.
2. **Item lost / destroyed.** `(lost|broke|shattered|left behind)
   (the |their |her |his |its )?<item>` → item candidate with
   `suggestedChanges.lost: true` or `destroyed: true`.
3. **Travel / location change.** `<actor> (crossed|entered|left|
   reached|arrived at|fled|returned to|set out for|came to)
   <location>` → update-shaped cast candidate with
   `suggestedChanges.location = locationId`.
4. **Relationship interaction.** `<actor> (whispered|shouted|
   confronted|kissed|embraced|struck|saved|betrayed|abandoned)
   <actor>` → relationship candidate with `relationshipType` derived
   from the verb.
5. **Quest progression.** `(the hunt for|the search for|the journey
   to|the mission against) <noun>` → quest candidate; if the noun
   matches a known entity, link `relatedEntityIds`.
6. **Event trigger.** `(the |then |at last,? )?<ProperNoun
   ProperNoun?> (began|started|broke out|came to an end)` →
   event candidate.
7. **Stat change.** `<actor>'s (resolve|fear|hope|strength|wit|grief)
   (grew|hardened|weakened|broke|sharpened|dulled|surged)` → stat
   candidate referencing the named stat (if seeded) and the actor.
8. **Lore / canon mention.** `it was said (that )?...` /
   `the legend (of|said) ...` / `centuries ago...` → lore candidate
   with `scope` heuristic (history vs prophecy vs custom).

### Candidate dedupe

A candidate is "the same" as another iff:

- same `entityType`
- AND same canonical name (case-insensitive, trimmed)
- AND same `suggestedAction`
- AND (if both have `existingEntityId`) same id.

Duplicates collapse into one candidate with `sourceQuotes[]`
aggregated (we keep up to 3 distinct quotes per candidate to give the
reviewer context without bloating the queue).

### Paragraph metadata

When extracting from a chapter that has identifiable paragraphs (the
caller passes a `paragraphs` array of `{id, start, end, text}`),
occurrences and candidates carry the originating `paragraphId` so the
Writer's Room can scroll to the source. When no paragraphs are
supplied (current default), `paragraphId` is `null` and the offsets
are chapter-global as today. No regression.

## D. Standardised candidate shape

Every extraction candidate flows through one `buildCandidate(...)`
helper that produces:

```js
{
  candidateId,         // unique per candidate
  entityType,          // "cast" | "items" | "locations" | "quests" | ...
  name,                // candidate name (existing or new)
  summary,             // 1-line description (was: `reason`)
  suggestedAction,     // "create" | "update" | "link"
  confidence,          // 0..1
  confidenceBand,      // "blue" | "green" | "orange" | "red"
  matchType,           // "exact" | "nickname" | "fuzzy" | "new"
  existingEntityId,    // null when matchType === "new" (was: targetEntityId)
  sourceQuote,         // first ~140-char window
  sourceQuotes,        // up to 3 distinct windows after dedupe
  chapterId,
  paragraphId,         // null if not known
  startOffset,         // null if not known
  endOffset,           // null if not known
  previousState,       // existing entity snapshot, null for create
  relatedEntityIds,    // [string] — other entities the candidate touches
  suggestedChanges,    // { field: newValue } — the diff to apply on update
  payload,             // raw AI payload if any; null for local-only
  status: "pending",
  extractionSessionId,
}
```

ReviewService.add still accepts the old keys (`reason`,
`targetEntityId`) for back-compat; the renamed keys (`summary`,
`existingEntityId`) are also written. The review-queue UI doesn't
care about field names because it reads via the registry's typed
handlers.

## E. Occurrence integration

Unchanged contract, reverified by tests:

- Local-pass occurrence is recorded **once** per (entityId, range).
- A candidate created for an unknown entity is stamped with
  `candidateId`. Local-pass occurrences for the same range are
  stamped with the same `candidateId` and `entityId: null`.
- `acceptQueueItem(candidate)` calls
  `OccurrenceService.linkCandidateToEntity(candidateId, savedId,
  type)` to backfill those occurrences to the new entity.
- `LinkService.mergeEntities(target, type, sources)` calls
  `OccurrenceService.rebindEntity(sourceId, targetId)`.
- `isOccurrenceStale(occ, bodyText)` continues to gate Writer's Room
  highlight rendering and the double-click resolver.

## F. Review Queue integration

No new review path. Candidates from the new detectors flow into the
existing `KEYS.reviewQueue` via `ReviewService.addMany([...])` exactly
like AI candidates today. Accept / Edit / Merge / Deny /
Bulk-Accept / Bulk-Deny / Bulk-Merge all already work for these
shapes (verified by e2e suite).

The only delta: a candidate with `suggestedAction: "update"` and a
populated `suggestedChanges` object should, on accept, apply only
those fields via `EntityService.update(type, existingEntityId, {
data: { ...existing.data, ...suggestedChanges } })` instead of
wholesale replacing the entity. (Today's `acceptQueueItem` calls
`update(...)` with `row.payload`; we'll switch to using
`suggestedChanges` when present.)

## G. Deep Extract / AI provider behaviour

- **Without provider:** unchanged. Local rules run; no AI step; no
  candidates from AI; user sees the candidates the local detectors
  produced (could be 0 for a chapter with no known entities). The
  "Configure an AI provider" notice still applies for explicitly
  AI-gated callbacks.
- **With provider:** chunked canon-pipeline prompt is unchanged.
  Pass 1 doesn't add new prompts. It does enrich the AI's input with
  the same `knownEntitiesByType` map the local detectors use (which is
  what's already happening), and runs **dedupe across local + AI
  candidates** so the queue isn't flooded with two copies of "Aelinor
  (new)" — the local detector's exact-match wins.

No app-owned keys. BYOK only.

## H. Tests

### Smoke (`scripts/smoke-services.js`)

Add a `runFixtures()` helper that loads each fixture from
`tests/fixtures/extraction/`, seeds the entity store, calls
`runExtraction`, and asserts:

- known mentions become occurrences with correct `entityId`
- alias resolves to the same entity
- false-positive trap produces zero occurrences for the trap words
- item-ownership candidate exists with `suggestedAction: "update"`
- travel candidate exists for the actor
- relationship candidate links the two actors
- quest, event, stat, lore candidates created where expected
- source quote captured non-empty
- confidence band assigned correctly
- duplicate candidates deduped (count matches expected)
- long-chapter chunking captures the boundary mention exactly once

Target: 12 fixtures × 3–5 assertions each = 40–60 new smoke checks.

### E2E (`tests/e2e/`)

One new spec file `07-extraction-quality.spec.js` covering:

- Seed two cast + one location + one item via `EntityService.save`.
- Save & Extract with a chapter mentioning all four.
- Assert: occurrence count ≥ 4, all bound to real entityIds.
- Assert: at least one item-ownership candidate created.
- Reload page. Assert: occurrences still render as highlights (the
  occurrence overlay path).
- Accept an item-ownership candidate. Assert: entity's
  `data.ownerId` updates; occurrence still resolves; queue item
  marked done.

## I. Reports

Updates / new docs in this PR:

- **`EXTRACTION_QUALITY_PLAN.md`** — this file. Committed first as
  the first commit on the branch.
- **`EXTRACTION_QUALITY_REPORT.md`** — new. Created at the END of the
  pass. Contains: final test output, list of detectors implemented,
  list of fixtures added, candidates-per-fixture results, any
  regressions found, recommended Pass-2 follow-ups.
- **`PRODUCT_COMPLETION_AUDIT.md`** — updated. Move "extraction
  quality" line from Bucket B (prototype/thin) to Bucket A
  (implemented) for the categories where Pass 1 added detectors with
  tests. Leave "relationship two-pass extraction" and
  "extraction-session undo trail" in Bucket D (future scope).
- **`FINAL_QA_REPORT.md`** — appended with Pass-1 numbers.
- **`LEGACY_EXTRACTION_AUDIT.md`** — only a small update noting which
  of its recommendations were implemented in this pass and which
  remain deferred. Bodies unchanged.

## J. Validation

Final PR output must include:

```
npm run validate         → audit passes, Bucket A = 0
npm run test:smoke       → existing 22 + new fixture checks all pass
npm run test:e2e         → existing 28 + 1 new extraction spec all pass
```

Plus parse-checks on every modified `.jsx` / `.js` file.

## Out of scope for this pass

Explicitly NOT touched (each is its own future PR):

- Two-pass relationship extraction (legacy `extractRelationshipsAdvanced`).
- Extraction-session undo trail (`extractionHistoryService`).
- Character enhancement (legacy "Enhance" auto-fill).
- Multi-provider AI routing.
- Project Intelligence rebuild from references/entities.
- Reference summarisation by AI.
- Production build pipeline migration.
- UI redesign of any kind.
- Workspace persistence work.

## Commit plan

1. **`EXTRACTION_QUALITY_PLAN.md`** (this doc) — first commit, no
   code changes.
2. **`buildCandidate` helper + standardised shape** in
   `backend-services.jsx`. `runExtraction` rewritten to use it.
   Existing review-item back-compat preserved. Tests stay green.
3. **Phrase detectors** added one logical group at a time:
   - travel + item-ownership
   - relationship interaction + stat change
   - quest progression + event trigger
   - lore/canon
4. **Candidate dedupe + multi-source-quote aggregation**.
5. **Fixture infrastructure** — `tests/fixtures/extraction/`,
   `runFixtures()` harness in `scripts/smoke-services.js`.
6. **Fixtures themselves** — 12 files.
7. **Smoke harness wiring** + new assertions.
8. **`tests/e2e/07-extraction-quality.spec.js`** + register in
   `playwright.config.js`.
9. **`EXTRACTION_QUALITY_REPORT.md` + doc updates**.

Each step verified by `npm run validate` + `npm run test:smoke` before
moving on. e2e re-run at the end and before the report doc.
