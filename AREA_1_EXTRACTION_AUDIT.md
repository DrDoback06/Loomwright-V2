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

## Intentionally NOT in Area 1 (later areas)
- The **visual Atlas travel map** (travel is captured as candidates/links; the map canvas is the Atlas area).
- **AI Writer suite** (revise/continue/write chapter) and its model picker — separate area (uses the same tier + `buildAuthorContext`).
- **Onboarding** completion handler + full `ProjectIntelService` field-mapping fix and document upload (Area 2). `buildAuthorContext` already reads raw onboarding answers so extraction follows the rules today.
- **Two-pass relationship extraction** and offline grammar/spell assist (Writers Room polish).
