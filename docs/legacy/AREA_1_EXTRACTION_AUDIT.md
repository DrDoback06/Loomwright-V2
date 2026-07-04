# Area 1 — Entity Extraction: completion & audit reference

_Status: complete, production-ready for audit._

Area 1 makes entity extraction work end to end, **fully offline by default**
(no AI key, no token cost, no text egress), with optional AI enrichment when
the user opts in. AI is gated through a cost tier whose **Free** setting only
ever uses a local provider (Ollama). Every surface that handles extractions
shares one Accept / Edit / Merge / Deny model.

## What's implemented (feature → where → how it's verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Offline NER discovery** — finds brand-new cast / locations / items / skills from raw prose (honorifics, dialogue tags, "the keep of X", "called X", recurrence), with false-positive filters; never auto-adds (capped 0.92) | `backend-services.jsx`: `extractProperNounSpans`, `classifyProperNoun`, `discoverEntities`, `clusterAliases` | smoke fixtures `13–16`; smoke `[backend services]`; e2e `16` |
| **Local change-detectors** (item transfer/loss, travel, relationships, stat, quest, event, lore) | `backend-services.jsx` detectors | smoke fixtures `01–12`; e2e `07` |
| **Live streaming + cancel** — entities appear as found; abortable | `runExtraction` `onProgress` + `lw:extraction-progress` + `AbortSignal` | smoke `[ai/offline]`; e2e `16` |
| **Entity Extraction Wizard** — scope (whole manuscript / chapter / selection), Quick vs Deep AI, live stream, per-row Accept/Edit/Merge/Deny, Continue-in-background, opens Review Queue | `extraction-wizard.jsx`, `app.jsx` mount, `callback-registry.jsx` (`onExtractCast/Locations/OpenExtractionWizard/Rerun/Cancel/ContinueInBackground/OpenExtractionSession`) | e2e `16`, `17` |
| **Highlight-to-extract** — select prose → background, scoped extraction → per-chapter context + queue | `writers-room.jsx` (`onExtractSelection`, floating toolbar) | e2e `16` (selection scope) |
| **Save & Extract / Save & Deep Extract** in chapters | `writers-room.jsx` `runExtractionFlow` | e2e `15` (#2/#11) |
| **AI cost tiers (free/budget/normal/extended/full)** — Free routes only to local providers (Ollama); Local-only blocks all AI | `AIRoutingService` (`tier`, `isLocalProviderCfg`, `resolveRoute`), `settings-rich.jsx` selector, `onSetAITier` | smoke `[ai routing]` |
| **AI follows the author's rules** — onboarding + intel (genre, premise, tone, POV, canon, forbidden) injected into every AI extraction prompt | `backend-services.jsx` `buildAuthorContext` | smoke `[ai]` |
| **Auto-apply ≥95% (blue)** — applied immediately, still listed, deny removes the created entity | `runExtraction` blue loop + `autoApplyCandidate`; `denyQueueItem` undo; `onKeep/RemoveAutoAddedItem` | smoke `[auto-apply]` |
| **Real candidate rendering** — shared `candidateToCardItem` bridges the backend shape ↔ card shape + band vocabulary | `review-queue.jsx` | e2e `17`; e2e `15` (DOM accept/deny/merge) |
| **Multi-entry grouping** — one sentence's candidates cluster under a group card with "Accept all" | `assignSentenceGroups` (backend) + `groupCardItems` / `ReviewGroupCard` (UI) | smoke `[groupId]`; e2e `17` |
| **Unified Accept/Edit/Merge/Deny everywhere** — Review Queue, Writer's Room margin, per-chapter Current Chapter Context, and wizard all dispatch the same registry callbacks; one global Edit modal | `app.jsx` (edit modal), `callback-registry.jsx`, `panel-stack.jsx`, `writers-room.jsx`, `extraction-wizard.jsx` | e2e `17`; e2e `15` |

## How to verify

```sh
npm run validate     # 524 callbacks; 0 unwired Bucket A actions
npm run test:smoke   # services, offline discovery, streaming, tiers, author-context, auto-apply, grouping
npm run build        # precompiles every .jsx into the production bundle
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 16-extraction-wizard 17-extraction-unified 04-review 15-ui
```

### Manual smoke (no AI key)
1. `npm run dev`, open `Loomwright Shell.html`.
2. Paste a chapter with new names + dialogue + "the keep of X" → **Save & Extract** → the Review Queue fills with discovered cast/locations/items.
3. Open the **Extraction Wizard** (Cast → "Extract from manuscript"): pick scope + Quick/Deep, Start, watch entities stream; triage per-row or in the queue.
4. Highlight a passage → floating **Extract** → results in Current Chapter Context + queue.
5. In the queue: **Edit** opens a pre-filled modal; **Merge** opens the ranked merge modal; **Deny** removes it. Same actions in the margin and per-chapter context.
6. Add a free local provider (Ollama) + set tier **Free** → Deep extraction enriches at zero cost; **Local-only** blocks all AI.

## Audit pass (post-completion) — what the audit found & fixed

A dedicated audit (Area 1 + everything that should link to it) found and **fixed**
the following correctness gaps:

- **Extraction settings were cosmetic.** `runExtraction` now reads Settings →
  Extraction: `scan` per-type toggles skip disabled types, `threshold` drops
  sub-threshold candidates, `aggressiveness` tunes discovery recurrence, and
  `autoAdd95` / `showAutoAddedInReview` gate auto-apply. (smoke `[settings]`)
- **`suggestedChanges` were dropped when creating a NEW entity** — so accepted
  relationship / stat / quest / travel candidates landed as bare names.
  `acceptQueueItem`, `autoApplyCandidate`, and the edit modal now merge
  `suggestedChanges` + `relatedEntityIds` into the new entity's `data` (e.g. a
  relationship lands with `fromId`/`toId`/`relationshipType`). (smoke + e2e `17`)
- **Re-extraction duplicated data.** `runExtraction` is now idempotent per
  chapter: it clears that chapter's prior occurrences + still-pending candidates
  first (`OccurrenceService.deleteByChapter`, `ReviewService.removePendingByChapter`),
  preserving accepted/denied/auto-added work. (smoke: run twice → counts stable)
- **Only Cast had an extract entry point.** Every entity panel header now has a
  type-focused "Extract from manuscript" button that opens the wizard scoped to
  that type.

Confirmed already-working links: Home review count, Today pending list, Command
Palette indexing of queue items, Trash for denied/removed entities, adaptive
wheel "Extract", live panel badges, occurrence highlights + double-click in the
manuscript.

### Cross-links deferred to their owning areas (data lands correctly now)
- **Relationships tab live rendering** — accepted relationships now persist with
  `fromId/toId/type`, but the Relationships *tab* still reads demo data
  (`relationships.jsx`); rendering live relationships is **Area 4 (visual tabs)**.
- **Skill-tree assignment selector on skill candidates** — depends on the skill
  tree system + per-actor trees, which are **Skill Trees (Area 4/7)**; skills
  currently land as entities to assign later.
- **Travel/location + provenance display** — `cast.data.location` is set on
  accept; showing it in the dossier + Atlas travel line is **Area 3 (Cast) / Atlas**.

## Intentionally NOT in Area 1 (later areas)
- The **visual Atlas travel map** (travel is captured as candidates/links; the map canvas is the Atlas area).
- **AI Writer suite** (revise/continue/write chapter) and its model picker — separate area (uses the same tier + `buildAuthorContext`).
- **Onboarding** completion handler + full `ProjectIntelService` field-mapping fix and document upload (Area 2). `buildAuthorContext` already reads raw onboarding answers so extraction follows the rules today.
- **Two-pass relationship extraction** and offline grammar/spell assist (Writers Room polish).
