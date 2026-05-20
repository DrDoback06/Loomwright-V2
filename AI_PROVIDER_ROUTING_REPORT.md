# Multi-provider AI Routing Pass — Report

_Branch: `claude/multi-provider-ai-routing-pass`. Closes the agreed
"BYOK providers, task routing, privacy guard, model settings" phase._

## Scope reminder

Make AI provider configuration real, safe, BYOK-only, and task-routed.
Generalise the single-provider OpenAI path into an adapter layer,
add per-task routing, add a privacy guard before any manuscript text
leaves the app, enforce local-only mode, and turn the 6 provider-gated
callbacks into working actions when a provider is configured.

No cloud accounts, no app-owned keys, no payments, no background
autonomous calls, no UI redesign, no prompt-quality mega-pass.

## What changed

### Extended `KeysService.saveProvider` (BYOK config shape)

`saveProvider(providerId, settings)` now persists the full provider
config (`providerType / label / enabled / baseUrl / defaultModel /
availableModels / useCases / headers / apiKeyRef`) into
`KEYS.providerSettings`, while the key continues to live **only** in
`KEYS.apiKeys`, AES-GCM-encrypted. Any field named like a secret
(`apiKey / secret / token / password / bearer / credential`) is
stripped from the config blob before persistence — it can never land
in `providerSettings`.

### Adapter-pattern `AIService`

| Method | Purpose |
|--------|---------|
| `listProvidersSync()` | Configured providers (never keys) |
| `getProviderConfig(providerId)` | Resolves config + decrypted key + per-type defaults |
| `saveProviderConfig(config)` | Delegates to `KeysService.saveProvider` |
| `clearProviderKey(providerId)` | Removes the encrypted key |
| `testConnection(providerId)` | Per-type connection test — **never sends manuscript text** |
| `complete(opts)` | Accepts both `{prompt, system}` and `{messages}`; routes to the right adapter by `providerType` |
| `completeJson(opts)` | `complete` + JSON parse (returns `null` on non-JSON) |
| `buildGuardSummary({task, providerId, model, context})` | Pure — builds the privacy-guard summary, sends nothing |

Adapters:
- **openai / openrouter / custom** — `POST {baseUrl}/chat/completions`, `Authorization: Bearer`, optional `response_format`. Response `choices[0].message.content`.
- **anthropic** — `POST {baseUrl}/v1/messages`, `x-api-key` + `anthropic-version: 2023-06-01`, top-level `system`, content blocks. Response `content[].text`.
- **ollama** — `POST {baseUrl}/api/chat`, no auth, `stream:false`. Response `message.content`.

`PROVIDER_DEFAULTS` table supplies baseUrl + default model + `needsKey`
per type (Ollama needs no key).

`testConnection` per type: OpenAI/OpenRouter/Custom → `GET /models`;
Anthropic → 1-token `/v1/messages` ping; Ollama → `GET /api/tags`.
None of these send manuscript text.

### New `AIRoutingService`

Stored under `KEYS.aiRouting` (references provider ids + model names
only — never secrets).

```jsonc
{
  "mode": "localOnly" | "cheapestViable" | "balanced" | "qualityFirst" | "manual",
  "defaultProviderId": "openai",
  "taskRoutes": { "deepExtraction": { "providerId", "model" }, ... },
  "maxContextTokens": 8000,
  "preferSummaries": true,
  "confirmBeforeSendingManuscript": true,
  "redactSensitiveFields": true,
  "localFallbackEnabled": true
}
```

- `loadSync() / save(patch)` (taskRoutes merge, not replace)
- `isLocalOnly()` — `mode === "localOnly"`
- `requiresManuscriptConfirmation()`
- `resolveRoute(task)` → `{providerId, model}` or **null** (localOnly → null; explicit task route → its provider; else default provider; else first enabled+keyed provider)

Ten task types defined: `quickExtraction`, `deepExtraction`,
`writingDraft`, `rewritePassage`, `continueWriting`,
`projectIntelligence`, `referenceSummary`, `continuityCheck`,
`skillTreeGeneration`, `aiHandoffAssist`.

### New `AIContextBuilder`

```js
AIContextBuilder.build({ task, chapterId, selectedEntityIds,
  includeProjectIntelligence, includeReferences, detailLevel })
  → { systemPrompt, userPrompt, sections, approxChars,
      includesManuscript, includesReferences, includesIntel }
```

Pure over the live store. Sources: current chapter text, selected
entities, Project Intelligence (style + canon), references flagged
`includedInAIContext`, known entities by type (for extraction tasks).
Bounded by `maxContextTokens` (≈4 chars/token). Never includes
secrets. Deterministic + unit-testable.

### Privacy guard

`aiPrivacyGuard({task, providerId, model, context})` in the registry:
1. If the context includes no manuscript/reference/intel text → proceeds silently (nothing sensitive sent).
2. Dispatches `lw:ai-privacy-guard` with a structured summary (so a future modal can replace `confirm` without touching call sites).
3. If `confirmBeforeSendingManuscript !== false` → requires a `window.confirm` showing provider, model, task, what content is included, rough size, and a privacy reminder. Decline aborts the call.

`requireProviderOrNotice(featureLabel, task)` is now routing-aware:
- Local-only → "AI is disabled (Local-only mode)…" notice, returns null.
- Routed → resolves `{providerId, model}` or shows the setup notice.
- Legacy single-provider fallback retained.

### Wired the 6 provider-gated callbacks

| Callback | Behaviour |
|----------|-----------|
| `onGenerateCompositionDraft` / `onGenerateDraft` | route `writingDraft` → context (selected entities + refs + intel) → privacy guard → `complete` → `__LW_LAST_GENERATED_DRAFT__` + audit `ai.writingDraft` |
| `onGenerateAIWriterDraft` | route `writingDraft` → active chapter context → guard → `complete` → draft + audit |
| `onGenerateDraftSkillTree` | route `skillTreeGeneration` → `complete` (no manuscript, no guard) → parse JSON nodes → `skill.data.draftNodes` + audit |
| `onRunContinuityCheck` | local heuristic **always**; AI augmentation only when a provider routes + guard passes; audit `ai.continuityCheck` |
| `onRunEntitySuggestion` | local extraction **always**; deep/AI only when a provider routes + guard passes; audit `ai.deepExtraction` |
| `onAcceptGeneratedText` / `onCopyGeneratedText` | local — read `__LW_LAST_GENERATED_DRAFT__` (unchanged) |

All audit events record provider id / model / status only — never the
prompt, manuscript body, or key.

### New callbacks (5)

- `onSaveAIProviderConfig` — `AIService.saveProviderConfig`
- `onClearAIProviderConfig` — `AIService.clearProviderKey`
- `onSetAIRoutingMode` / `onToggleLocalOnlyMode` — `AIRoutingService.save({mode})`
- `onSetAITaskRoute` — `AIRoutingService.save({taskRoutes:{...}})`
- `onConfirmAIPrivacyGuard` — acknowledgement hook for a future modal

(Reused existing `onAddAIProvider`, `onClearAIProviderKey`,
`onTestAIProviderConnection`, `onValidateProviderKey`.) All registered
in `scripts/callback-names.json`, `callback-names-data.jsx`, and the
registry's `dispatchCallback`.

**Audit count: 526 UI callbacks; registry bootstraps 558 handlers; Bucket A still 0; Bucket B still 6 (provider-gated, now functional when configured).**

## Privacy / security handling

- **Keys** never enter the config blob (stripped in `saveProvider`); live only in `KEYS.apiKeys`, AES-GCM-encrypted.
- **`testConnection`** never sends manuscript text (GET /models, /api/tags, or a 1-token ping).
- **Privacy guard** confirms before any manuscript/reference/intel text is sent externally; local-only mode blocks it entirely.
- **Export** — `KEYS.apiKeys` never exported; `KEYS.aiRouting` carries only provider ids + model names. `ProjectArchiveService` redaction unchanged. Verified: `metadata.apiKeysIncluded === false` and no key substring in the payload.
- **Audit** — provider actions log id/model/status only; `redactSecrets` still runs on every event. Verified: no key substring in the log.
- **Search** — `KEYS.apiKeys` never read; secret-named settings fields stripped. Verified: no key substring in the index.

Three separate "no leak" assertions (export / search / audit) run in
both smoke and the e2e privacy test.

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[ai routing]` block

**22 new assertions, all pass** (uses a `win.fetch` stub for the
adapter call; the smoke shim now wires Node's `crypto.webcrypto` +
`TextEncoder/TextDecoder` + `btoa/atob` so `KeysService` encryption
works in-process):

```
[ai] AIService / AIRoutingService / AIContextBuilder exposed
[ai] routing defaultState mode = balanced
[ai] saveProviderConfig persists config
[ai] provider config blob never contains the apiKey value
[ai] provider config records hasKey:true
[ai] key retrievable via KeysService for a call
[ai] resolveRoute(writingDraft) falls back to default provider
[ai] resolveRoute honours a task-specific route + model
[ai] isLocalOnly() true in localOnly mode
[ai] resolveRoute returns null in localOnly
[ai] context builder includes chapter text
[ai] context builder marks includesManuscript
[ai] context builder includes known entities for extraction
[ai] context builder never contains the apiKey value
[ai] context builder respects maxContextTokens bound
[ai] complete() returns mocked completion via openai adapter
[ai] completeJson returns null on non-JSON response
[ai] testConnection succeeds with mocked /models
[ai] testConnection without key gives useful message
[ai] buildGuardSummary reports includesManuscript
[ai] AI Handoff pack buildable without provider
[ai] api key never indexed by SearchService
```

### E2E (`tests/e2e/14-ai-provider-routing.spec.js`)

**6 new browser tests, all pass** (fetch stubbed via `addInitScript`):

1. Save + test provider config (mocked fetch) → success; key not in config blob.
2. Local-only mode blocks AI Writer generation — zero `/chat/completions` calls, no draft stored.
3. Configured provider → `complete` returns the mocked draft.
4. Deep extraction without provider → local fallback runs (no throw).
5. Deep extraction with fake provider → routes to the configured provider + model through the adapter.
6. **Privacy** — API key never appears in export / search / audit after configuring a provider; `metadata.apiKeysIncluded === false`.

### Full suites

```
npm run validate     → OK: 526 UI callbacks; registry bootstraps 558 handlers
                       OK: 0 Bucket A action callbacks reach the generic default notice.
                       OK: 6 Bucket B (provider-gated) callbacks use requireProviderOrNotice.
npm run test:smoke   → All smoke checks passed (256 assertions; 22 new [ai routing]).
npm run test:e2e     → 75 passed (≈5.5 min) — 69 pre-existing + 6 new (Workflow R).
```

## Files changed

- `backend-services.jsx`:
  - `KEYS.aiRouting` added.
  - `KeysService.saveProvider` extended to the full BYOK config shape (key stripped from config).
  - `AIService` rewritten with adapter pattern (openai / openrouter / anthropic / ollama / custom), `listProvidersSync`, `saveProviderConfig`, `clearProviderKey`, `completeJson`, `buildGuardSummary`, `PROVIDER_DEFAULTS`.
  - New `AIRoutingService` + `AIContextBuilder`.
  - Backend exports for `AIRoutingService` + `AIContextBuilder`.
- `callback-registry.jsx`:
  - `requireProviderOrNotice` is routing-aware (local-only + route resolution).
  - New `aiPrivacyGuard` helper.
  - 6 Bucket B handlers rewired through routing + context + guard + adapters + audit.
  - 6 new AI provider/routing config handlers in `dispatchCallback`.
- `scripts/callback-names.json` + `callback-names-data.jsx` — 5 new names alphabetically.
- `scripts/smoke-services.js` — `[ai routing]` block (22 assertions) + Web Crypto / TextEncoder / btoa shim wiring.
- `tests/e2e/14-ai-provider-routing.spec.js` — new spec, 6 tests.
- `AI_PROVIDER_ROUTING_PLAN.md` — plan-first commit.
- `AI_PROVIDER_ROUTING_REPORT.md` — this report.
- `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` — updated.

## Providers implemented

| Type | Endpoint | Auth | Key needed |
|------|----------|------|-----------|
| `openai` | `/chat/completions` | `Authorization: Bearer` | yes |
| `openrouter` | `/chat/completions` (openrouter base) | `Authorization: Bearer` + optional headers | yes |
| `anthropic` | `/v1/messages` | `x-api-key` + `anthropic-version` | yes |
| `ollama` | `/api/chat` | none (local) | no |
| `custom` | user `baseUrl` (OpenAI-compatible) | `Authorization: Bearer` + custom headers | yes |

## Provider adapters deferred

- **Google Gemini** — its `generateContent` request/response shape differs enough from the OpenAI contract to warrant a focused follow-up. Documented as adapter-pending. The config model and routing already accommodate it; only the `_completeGemini` adapter + `PROVIDER_DEFAULTS.gemini` entry are missing.

## Provider-gated callbacks status

All 6 Bucket B callbacks remain provider-gated (correct — they require BYOK), but are now **functional when a provider is configured** and route through task routing + privacy guard. Without a provider they show the specific "Configure an AI provider…" notice; in local-only mode they show the "AI is disabled (Local-only mode)…" notice. `onRunContinuityCheck` and `onRunEntitySuggestion` keep their local heuristic/extraction path always available.

## Status moves

In `PRODUCT_COMPLETION_AUDIT.md`:

> **Multi-provider AI Routing** — moves from "Out of scope this milestone" → **Implemented (OpenAI-compatible / OpenRouter / Anthropic / Ollama / Custom; Gemini adapter pending)** with BYOK key handling, per-task routing, privacy guard, local-only enforcement, and the 6 provider-gated callbacks functional when configured.

## Known remaining gaps

- **Google Gemini adapter** (documented above).
- **Settings UI surface** — the service layer is complete and the existing AI provider section persists through `SettingsService` / `KeysService`; a richer Control Centre layout (per-task route selectors, mode picker, masked-key field with Test/Clear) is a UI-focused follow-up. This PR is service-shaped and does not redesign Settings.
- **Privacy guard modal** — currently uses `window.confirm` (per the brief's permitted pattern); the `lw:ai-privacy-guard` event + `onConfirmAIPrivacyGuard` callback are in place so a custom modal can replace it without touching call sites.
- **Streaming responses** — adapters use non-streaming completion. Streaming is out of scope for this pass.
- **Token accounting / cost modes** — `cheapestViable` / `qualityFirst` modes currently resolve via the default-provider fallback (no real cost table). A cost-aware routing pass can build on the `mode` field already persisted.

## Whether Multi-provider AI Routing can move to Implemented

**Yes (OpenAI-compatible / OpenRouter / Anthropic / Ollama / Custom; Gemini adapter pending).**

- Provider configs persist (BYOK; keys encrypted, never in config/export/audit/search).
- Keys save / clear / test safely; `testConnection` sends no manuscript text.
- Routing settings persist; `resolveRoute` honours mode + task routes + default.
- Local-only mode blocks external calls (verified in smoke + e2e).
- Privacy guard fires before manuscript text is sent.
- The 6 provider-gated callbacks work when configured and show specific notices otherwise.
- 22 smoke + 6 e2e assertions cover the contract.
- `npm run validate` clean; Bucket A 0; Bucket B 6 (provider-gated, functional).
