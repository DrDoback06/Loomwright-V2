# Extraction Quality Pass 1 — Report

_Created: 2026-05-19, on branch `claude/extraction-quality-pass`._

## Acceptance against `EXTRACTION_QUALITY_PLAN.md`

| Plan section | Status | Notes |
|--------------|--------|-------|
| A. Current state audit | ✓ | Documented in `EXTRACTION_QUALITY_PLAN.md`. |
| B. Fixture strategy | ✓ | 12 fixtures live under `tests/fixtures/extraction/`. |
| C. Local extraction improvements | ✓ | Item transfer / loss / travel / relationship / stat / quest / event / lore detectors landed. |
| D. Candidate shape | ✓ | `buildCandidate()` produces the standardised shape; legacy keys preserved for back-compat. |
| E. Occurrence integration | ✓ | Local-pass occurrences still recorded; candidate-tagged occurrences only stamped for `matchType: "new"` named-entity types to avoid double-marking. |
| F. Review Queue integration | ✓ | Candidates flow through `ReviewService.addMany`; accept honours `suggestedChanges` so only the diff is applied. |
| G. Deep Extract / AI behaviour | ✓ | AI step unchanged; provider-gating preserved. AI items now go through `buildCandidate` + dedupe so AI + local can't double up. |
| H. Tests | ✓ | 70 smoke checks (22 prior + 48 fixture) + 3 new e2e tests + 28 prior e2e (31 total). |
| I. Reports | ✓ | This file. `PRODUCT_COMPLETION_AUDIT.md` updated. |
| J. Validation | ✓ | See verification baseline below. |

## Verification baseline

```
> npm run validate
All checked HTML references exist.
OK: 524 UI callbacks; registry bootstraps 524 handlers
OK: registry default branch emits a user-visible notice (no silent fall-through).
OK: 0 Bucket A action callbacks reach the generic default notice.
OK: 6 Bucket B (provider-gated) callbacks use requireProviderOrNotice.
OK: 4 Bucket D (React-owned) callbacks declared.
INFO: 213 other callbacks fall to default notice (housekeeping/dispatch).

> npm run test:smoke
70/70 checks passed (22 service smoke + 48 fixture assertions).

> CHROMIUM_PATH=/path/to/chrome npm run test:e2e
31 passed (≈3 min wall, real Chromium)
   28 prior tests still pass
   +3 new K. Extraction quality tests pass
```

## What this pass landed

### `buildCandidate()` + standardised shape

Every extraction candidate now flows through one helper that produces:

```js
{
  candidateId, entityType, name, summary,
  suggestedAction,       // create | update | link
  confidence,            // 0..1
  confidenceBand,        // blue | green | orange | red
  matchType,             // exact | nickname | fuzzy | new | ambiguous
  existingEntityId,      // null when matchType === "new"
  sourceQuote,           // first ~140-char window
  sourceQuotes,          // up to 3 distinct windows after dedupe
  chapterId, paragraphId, startOffset, endOffset,
  previousState,         // existing entity snapshot (for update path)
  relatedEntityIds,      // other entities the candidate touches
  suggestedChanges,      // diff to apply on update
  payload,               // raw AI payload if any
  // plus back-compat legacy keys (reason, targetEntityId, action,
  // level, value, status) so existing review-queue UI keeps working
}
```

### Local phrase detectors (Pass 1 set)

8 detectors in `backend-services.jsx`, all rule-based, all running
**without any AI provider**:

| Detector | Pattern | Output |
|----------|---------|--------|
| `detectItemTransfers` | `<actor> (gave|handed|tossed|passed|sold|threw|surrendered|delivered) <item> to <actor>` | items / update + `suggestedChanges.ownerId` |
| `detectItemLoss` | `(lost|broke|shattered|left behind|dropped|abandoned|destroyed) <item>` | items / update + `lost`/`destroyed` flags |
| `detectTravel` | `<actor> (crossed|entered|left|reached|arrived at|fled|returned to|set out for|came to|travelled to|walked to|rode to|sailed to) <location>` | cast / update + `suggestedChanges.location` |
| `detectRelationships` | `<actor> (whispered to|shouted at|confronted|kissed|embraced|struck|saved|betrayed|abandoned|forgave|comforted|trusted) <actor>` | relationships / create with `relationshipType` |
| `detectStatChanges` | `<actor>'s (resolve|fear|hope|strength|wit|grief|courage|rage|doubt) (grew|hardened|weakened|broke|sharpened|dulled|surged|faltered|crumbled|swelled|kindled)` | stats / create with direction + verb |
| `detectQuestProgression` | `[Tt]he (hunt|search|journey|mission|quest) (for|to|against) <ProperNoun>` | quests / create with subject |
| `detectEvents` | `<ProperNoun(s)> (began|started|broke out|came to an end|erupted|ended)` | events / create with verb |
| `detectLore` | `(it was said(?: that)?|the legend (?:of|said)|centuries ago|long before|once,? long ago) <phrase>` | lore / create with scope |

Detectors are conservative: they prefer missing a real candidate to
producing a wrong one. The fixture set includes a deliberate false-
positive trap (common-noun "pass", verb "reach", lowercase "hess") to
guard against drift.

### Dedupe

Same `(entityType, name, suggestedAction, existingEntityId)` collapses
into one candidate. Up to 3 distinct `sourceQuotes` are aggregated;
`relatedEntityIds` are unioned; `suggestedChanges` shallow-merged;
highest confidence wins. Prevents AI-pass + local-pass duplicates.

### Paragraph metadata

`runExtraction({ chapterId, text, deep, paragraphs })` accepts an
optional `paragraphs: [{ id, start, end }]` array. When supplied,
occurrences and AI candidates carry `paragraphId` so the Writer's
Room can scroll to the source. When omitted, behaviour is unchanged
and `paragraphId` is `null`.

### Accept-with-diff

`callback-registry.jsx acceptQueueItem` now checks for a non-empty
`suggestedChanges` + `existingEntityId` on the candidate and applies
only that diff to `entity.data`. The earlier behaviour (overwriting
the whole entity with `row.payload`) is preserved for the case where
the caller supplies a full payload but no `suggestedChanges`.

### Fixture infrastructure

`tests/fixtures/extraction/` with 12 fixtures + README documenting the
shape. The smoke harness (`scripts/smoke-services.js`) iterates every
fixture, seeds entities, runs `runExtraction`, and asserts:

- minimum / maximum occurrence count bounds
- every expected `(entityId, exactText)` occurrence is present
- every forbidden `(entityId)` occurrence is ABSENT
- every expected candidate `(entityType, suggestedAction, [matchType],
  [existingEntityId], [suggestedChanges])` is present

Resets persistent storage between fixtures so each runs from a clean
slate.

### New e2e spec

`tests/e2e/07-extraction-quality.spec.js` (3 tests):

1. **Item-ownership detector creates an update candidate with
   `suggestedChanges.ownerId`.** Seeds Aelinor / Saren / Auger, runs
   extraction on `"Aelinor handed the Auger of Hess to Saren without
   a word."`, asserts the queue has the right shape with `matchType:
   "exact"`, `existingEntityId: <auger.id>`, and `sourceQuote`
   containing "handed".
2. **Occurrences persist across reload and remain bound to real
   entityIds.** Reload-after-extract still surfaces the entity link.
3. **Accept on `update + suggestedChanges` applies only the diff.**
   Pre-existing `data.rarity` field survives; only `data.ownerId` is
   added.

## What was deliberately left out

Per `EXTRACTION_QUALITY_PLAN.md` "Out of scope":

- Two-pass relationship extraction (legacy
  `extractRelationshipsAdvanced`).
- Extraction-session undo trail with per-action `previousState`
  records and `revertSession(sessionId)`.
- Character enhancement (legacy "Enhance" auto-fill of stats /
  equipment).
- Multi-provider AI routing.
- Project Intelligence rebuild from references / entities / lore /
  manuscript summaries.
- Reference summarisation by AI.
- Production build pipeline migration.
- Any UI work.
- Workspace persistence work.

These remain in `PRODUCT_COMPLETION_AUDIT.md` under Future scope.

## Recommended Pass-2 follow-ups

1. **Two-pass relationship extraction** when the user wants richer
   relationship records (per-pair detail rather than just verb +
   pair). The legacy audit documents the prompt.
2. **Extraction-session undo trail** as a safety net for users who
   accept candidates in bulk and want to revert.
3. **Detector tuning against real Pale Reach / Grimguff manuscript
   text** — current fixtures are synthetic. Once the user has real
   chapters, drift will surface and detectors can be tightened.
4. **Confidence calibration** — current detector confidence values
   (0.62–0.80) are heuristics. With real evaluation data we could
   calibrate against accept/deny rates.
5. **AI prompt tuning per category** — the canon 10-category prompt
   is generic. Per-category prompts (the legacy file had them) may
   produce cleaner candidates for relationships and timeline events.

## Files changed in this PR

| Group | Files |
|-------|-------|
| Plan + report | `EXTRACTION_QUALITY_PLAN.md` (new), `EXTRACTION_QUALITY_REPORT.md` (this file) |
| Backend detectors + candidate shape | `backend-services.jsx` |
| Accept-with-diff | `callback-registry.jsx` |
| Fixtures | `tests/fixtures/extraction/README.md`, 12 `*.fixture.js` files |
| Smoke harness | `scripts/smoke-services.js` |
| E2E spec | `tests/e2e/07-extraction-quality.spec.js` |
| Status doc | `PRODUCT_COMPLETION_AUDIT.md` (moved extraction line from Bucket B to Bucket A for the wired categories) |

No `.jsx`/`.css` UI files touched. No panel rebuild. No production-build
migration. Existing 28 e2e tests still pass; existing 22 smoke checks
still pass; new fixtures add 48 assertions; new e2e spec adds 3 tests.

## Acceptance summary

✓ existing 28 e2e tests still pass
✓ existing 22 smoke checks still pass
✓ callback audit remains Bucket A = 0
✓ extraction fixture tests pass (48 new assertions)
✓ Save & Extract quality is visibly better (8 phrase detectors where
  there were 0)
✓ Review Queue candidates are richer (matchType, sourceQuote,
  suggestedChanges, relatedEntityIds, previousState, confidenceBand)
  and less noisy (dedupe across local + AI)
✓ Occurrence rendering still works after reload (verified by e2e K.2)
✓ No UI redesign
✓ No unrelated feature scope
✓ Docs updated accurately (audit doc updated to reflect the new
  Bucket A entries)
