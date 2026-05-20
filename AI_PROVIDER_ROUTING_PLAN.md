# Multi-provider AI Routing Pass — Plan

_Created: 2026-05-20, on branch `claude/multi-provider-ai-routing-pass`
(started from `main` post-PR-#11)._

## Scope

Make AI provider configuration real, safe, BYOK-only, and task-routed.
Many features are already provider-gated and correctly show
"Configure an AI provider…". This pass makes that configuration
functional: multiple BYOK providers, per-task routing, a privacy
guard before any manuscript text leaves the app, local-only
enforcement, and turning the 6 provider-gated callbacks into working
actions when a provider is configured.

No cloud accounts, no app-owned keys, no payments, no background
autonomous calls, no UI redesign, no prompt-quality mega-pass.

## Current state audit

| Component | Today | Gap |
|-----------|-------|-----|
| `KeysService` | AES-GCM encrypt/decrypt via Web Crypto; `saveProvider(id, {apiKey, ...})` stores key in `KEYS.apiKeys`, settings in `KEYS.providerSettings`; `loadKey / clearProviderKey / testProvider` | No `providerType`, `baseUrl`, `useCases`, custom headers in the config shape; single hard-coded "openai" default |
| `AIService` | `getProviderConfig(id="openai")` (hard-coded openai base + gpt-4o-mini default), `testConnection` (GET /models — no manuscript text), `complete({prompt, providerId, system, maxTokens})` (OpenAI chat/completions only) | No adapter pattern, no per-provider type, no task helpers (`completeJson`, `extractStructured`, `generateDraft`, etc.), no routing |
| Task routing | None | No `AIRoutingService`, no `taskRoutes`, no mode (localOnly/balanced/…) |
| Privacy guard | None | Nothing confirms before manuscript text is sent externally |
| Context builder | Ad-hoc inline prompt strings in the registry handlers | No `AIContextBuilder`, no bounded context |
| `requireProviderOrNotice` (registry) | Checks `getProviderConfig().apiKey`; the 6 Bucket B callbacks each call it | Doesn't consider local-only mode or routing |
| Bucket B callbacks | `onGenerateAIWriterDraft`, `onGenerateDraftSkillTree`, `onGenerateCompositionDraft`, `onRunContinuityCheck`, `onRunEntitySuggestion`, `onAcceptGeneratedText`, `onCopyGeneratedText` — all wired but single-provider, no routing, no guard | Need routing + guard + adapter integration |
| Settings UI (`settings-rich.jsx`) | AI provider section exists with provider cards | Needs task-route selectors + local-only toggle + confirm-before-sending toggle wired through `SettingsService` |
| Export privacy | `ProjectArchiveService` already redacts secrets; `KEYS.apiKeys` never exported | OK — verify still holds |
| Audit privacy | `AuditService` redacts via `redactSecrets`; provider tests not logged | OK — verify still holds |
| Search privacy | `SearchService` strips secret fields, never reads `KEYS.apiKeys` | OK — verify still holds |

**Bottom line:** the key storage + single-provider OpenAI path exist
and are safe. This pass generalises the provider config, adds an
adapter layer + routing + privacy guard + context builder, and wires
the 6 callbacks through them.

## BYOK storage / security model

Unchanged foundation, extended config:
- API keys remain in `KEYS.apiKeys`, AES-GCM-encrypted via
  `KeysService.encrypt/decrypt` (Web Crypto). Never stored in
  provider config, never logged, never exported, never indexed.
- Provider **config** (no key) lives in `KEYS.providerSettings` keyed
  by provider id, extended with `providerType / baseUrl /
  defaultModel / availableModels / useCases / headers / enabled /
  label`.
- Routing settings live in a new `KEYS.aiRouting` key.
- `ProjectArchiveService` already strips `KEYS.apiKeys` and redacts
  settings — we verify `KEYS.aiRouting` carries no secrets (it
  references provider ids + model names only).

## Providers for this PR

Adapter types implemented:
1. **`openai`** — OpenAI-compatible `/chat/completions`, `Authorization: Bearer`.
2. **`openrouter`** — OpenAI-compatible, base `https://openrouter.ai/api/v1`, optional `HTTP-Referer` / `X-Title` headers.
3. **`anthropic`** — `/v1/messages`, `x-api-key` + `anthropic-version` headers, `system` top-level, content blocks.
4. **`ollama`** — local `/api/chat` (no key required), base `http://localhost:11434`.
5. **`custom`** — user-supplied `baseUrl`, OpenAI-compatible contract, optional custom headers.

**Deferred:** Google Gemini (documented as adapter-pending — its
`generateContent` request/response shape differs enough to warrant a
focused follow-up).

## Provider config shape

```jsonc
{
  "id":            "openai" | "openrouter" | "anthropic" | "ollama" | "custom-1",
  "providerType":  "openai" | "openrouter" | "anthropic" | "ollama" | "custom",
  "label":         "OpenAI",
  "enabled":       true,
  "baseUrl":       "https://api.openai.com/v1",
  "apiKeyRef":     "openai",          // points at KEYS.apiKeys[id]; never the key itself
  "defaultModel":  "gpt-4o-mini",
  "availableModels": ["gpt-4o-mini", "gpt-4o"],
  "useCases": {
    "writing": true, "extraction": true, "summarisation": true,
    "continuity": true, "skillTrees": true, "references": true,
    "projectIntelligence": true
  },
  "headers":       { },               // extra headers (never secrets)
  "createdAt", "updatedAt"
}
```

## Task routing model

`KEYS.aiRouting`:

```jsonc
{
  "mode": "localOnly" | "cheapestViable" | "balanced" | "qualityFirst" | "manual",
  "defaultProviderId": "openai",
  "taskRoutes": {
    "deepExtraction":      { "providerId", "model" },
    "writingDraft":        { "providerId", "model" },
    "continuityCheck":     { "providerId", "model" },
    "skillTreeGeneration": { "providerId", "model" },
    "referenceSummary":    { "providerId", "model" },
    "projectIntelligence": { "providerId", "model" }
  },
  "maxContextTokens": 8000,
  "preferSummaries": true,
  "confirmBeforeSendingManuscript": true,
  "redactSensitiveFields": true,
  "localFallbackEnabled": true,
  "updatedAt"
}
```

New `AIRoutingService`:
- `loadSync() / save(patch)` over `KEYS.aiRouting`
- `resolveRoute(task)` → `{ providerId, model }` honouring mode +
  taskRoutes + defaultProviderId
- `isLocalOnly()` → mode === "localOnly"
- `requiresManuscriptConfirmation()` → confirmBeforeSendingManuscript

Routing rules:
- `localOnly` → `resolveRoute` returns `null` (blocks external calls).
- `manual` → uses taskRoute if present else defaultProviderId.
- Other modes → taskRoute if present, else defaultProviderId, else
  first enabled provider.

## Privacy guard model

Before any task that sends chapter/manuscript/reference/project text:
1. If `AIRoutingService.isLocalOnly()` → blocked notice, no call.
2. If no provider resolves → provider-specific setup notice.
3. If `confirmBeforeSendingManuscript` and the context includes
   manuscript/reference/intel text → build a guard summary and
   require confirmation via the existing `window.confirm` pattern
   (brief explicitly permits this). Summary shows: provider, model,
   task, whether manuscript/references/intel are included, rough
   context size (chars), and a privacy reminder.
4. Provider **test** never sends manuscript text (uses GET /models or
   a 1-token ping) — no guard needed.

Helper: `AIService.buildGuardSummary({ task, providerId, model, context })`
returns the structured summary; the registry composes the confirm
string from it. A `lw:ai-privacy-guard` event is also dispatched so a
future modal can replace `confirm` without touching call sites.

## AIService adapter surface

```js
AIService = {
  // config
  getProviderConfig(providerId)        // resolves config + decrypted key
  listProvidersSync()                  // configured providers (no keys)
  saveProviderConfig(config)           // delegates to KeysService.saveProvider
  clearProviderKey(providerId)
  testConnection(providerId)           // never sends manuscript text

  // adapters (internal): _completeOpenAI / _completeAnthropic / _completeOllama
  complete({ providerId, model, messages, prompt, system, purpose, temperature, maxTokens, responseFormat })
  completeJson({ providerId, model, messages, schema, purpose })

  // task helpers (build context + route + guard happen in the registry/handlers)
  buildGuardSummary({ task, providerId, model, context })
}
```

`complete` accepts both the legacy `{prompt, system}` form and the new
`{messages}` form for backward compatibility. It dispatches to the
correct adapter based on the resolved provider's `providerType`.

Adapters:
- **openai / openrouter / custom** — `POST {baseUrl}/chat/completions`, `Authorization: Bearer <key>`, `{model, messages, max_tokens, temperature, response_format?}`. Response: `choices[0].message.content`.
- **anthropic** — `POST {baseUrl}/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`; body `{model, max_tokens, system, messages:[{role,content}]}`. Response: `content[0].text`.
- **ollama** — `POST {baseUrl}/api/chat`, no auth; body `{model, messages, stream:false}`. Response: `message.content`.

## AIContextBuilder

```js
AIContextBuilder.build({
  task, chapterId, selectedEntityIds,
  includeProjectIntelligence, includeReferences, detailLevel
}) → { systemPrompt, userPrompt, sections, approxChars, includesManuscript, includesReferences, includesIntel }
```

Sources: current chapter text, selected entities (by id/type),
Project Intelligence summary (when `preferSummaries`), references with
`includedInAIContext`, canon/style rules, known entities by type.
Bounded by `maxContextTokens` (≈4 chars/token heuristic). Excludes
secrets, excludes dormant entities unless explicitly selected.
Deterministic + testable (pure function over the live store).

## Wiring the 6 provider-gated callbacks

Each Bucket B handler:
1. `if (AIRoutingService.isLocalOnly())` → "AI is disabled (Local-only mode). Enable a provider in Settings." and return.
2. `const route = AIRoutingService.resolveRoute(task)` — if null → provider-specific setup notice and return.
3. Build context via `AIContextBuilder.build(...)`.
4. If context includes manuscript/refs/intel and `confirmBeforeSendingManuscript` → privacy guard confirm; abort if declined.
5. `AIService.complete({ providerId: route.providerId, model: route.model, ... })`.
6. Store result in the correct surface (`window.__LW_LAST_GENERATED_DRAFT__`, composition state, skill draftNodes, continuity event, review candidates).
7. `AuditService.log({ action: "ai.<task>", ... })` with provider label/model/status only — never prompt/secret/manuscript bodies.
8. Update UI via existing events.

`onRunContinuityCheck` and `onRunEntitySuggestion` keep their local
heuristic/extraction path always available; the AI augmentation only
runs through routing when a provider resolves and the guard passes.

`onAcceptGeneratedText` / `onCopyGeneratedText` are local (no provider)
— unchanged except they continue to read `window.__LW_LAST_GENERATED_DRAFT__`.

## Settings UI

Use the existing Control Centre AI provider section. Do not redesign.
Verify/add (wired through `SettingsService.saveSection("aiRouting", …)`
and `KeysService.saveProvider`):
- provider cards (type, label, baseUrl, default model, enabled)
- API key field (masked after save) + Save + Clear + Test buttons
- task-route selectors (provider + model per task)
- local-only toggle
- confirm-before-sending toggle
- max-context + prefer-summaries
- privacy explanation text

The e2e tests drive the services directly with mocked `fetch`, so the
exact Settings markup can iterate without breaking the contract. I'll
make the minimal wiring edits needed and not restructure the panel.

## New callbacks

- `onSaveAIProviderConfig`     — `AIService.saveProviderConfig`
- `onClearAIProviderConfig`    — `AIService.clearProviderKey` (distinct from existing `onClearAIProviderKey` if present; reuse if it exists)
- `onSetAIRoutingMode`         — `AIRoutingService.save({mode})`
- `onSetAITaskRoute`           — `AIRoutingService.save({taskRoutes:{...}})`
- `onToggleLocalOnlyMode`      — `AIRoutingService.save({mode})`
- `onConfirmAIPrivacyGuard`    — proceed with a pending guarded call

Only the ones that don't already exist get registered. `onValidateProviderKey` / `onTestAIProviderConnection` already exist and stay.

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[ai routing]` block (~18 assertions)

Uses the existing `fetch` shim (returns a canned OpenAI-style response when pointed at chat/completions).

- `AIRoutingService` exposed; default mode
- `saveProviderConfig` persists config (no key in config blob)
- key saved via KeysService is retrievable for a call but never in `loadProviderSync`
- `resolveRoute("writingDraft")` returns the default provider when no task route
- `resolveRoute` honours a task-specific route
- `isLocalOnly()` true when mode==="localOnly"; `resolveRoute` returns null in localOnly
- `AIContextBuilder.build` includes chapter text + known entities; excludes secrets; respects maxContextTokens bound
- `AIService.complete` (mocked fetch) returns the canned completion for openai adapter
- `completeJson` parses a JSON response
- `testConnection` with no key → useful message
- export redaction: provider config export has no apiKey value
- audit: an `ai.writingDraft` event logs provider/model/status, not the prompt or key
- search: the api key is not indexed (re-verify)
- `buildGuardSummary` reports includesManuscript correctly

### E2E (`tests/e2e/14-ai-provider-routing.spec.js`) — 6 tests, mocked fetch

1. Save + test provider config (mocked fetch) → test reports success.
2. Local-only mode blocks AI Writer generation (no fetch made; blocked notice path).
3. Configure fake provider → generate composition draft → `window.__LW_LAST_GENERATED_DRAFT__` set.
4. Deep extract without provider → local fallback (no throw, local extraction runs).
5. Deep extract with fake provider → structured candidates created.
6. API key never appears in export / search / audit after configuring a provider.

All tests install a `window.fetch` stub via `page.addInitScript` so no
real network calls happen.

## Out of scope (strict)

- No cloud accounts / app-owned keys / payments / team sharing
- No background autonomous AI calls
- No prompt-quality mega-pass
- No production build migration
- No UI redesign / new major panels
- No extraction algorithm expansion beyond provider call integration
- No field parity / workspace / import-export / search / Speed Reader changes
- No audit/undo changes except safe provider-action logging
- Google Gemini adapter (documented as pending)

## Commit plan

1. `AI_PROVIDER_ROUTING_PLAN.md` (this commit, no code).
2. `KEYS.aiRouting` + extended `KeysService.saveProvider` config shape
   + `AIRoutingService` + adapter-pattern `AIService` +
   `AIContextBuilder` + Backend exports.
3. Wire the 6 Bucket B callbacks through routing + guard + adapters;
   register any new callback names.
4. Settings wiring (minimal) for routing + provider config through
   `SettingsService` / `KeysService`.
5. Smoke harness `[ai routing]` block.
6. New `tests/e2e/14-ai-provider-routing.spec.js`.
7. Docs: `AI_PROVIDER_ROUTING_REPORT.md`,
   `PRODUCT_COMPLETION_AUDIT.md`, `FINAL_QA_REPORT.md`.

Each step verified with `npm run validate` + `npm run test:smoke`.
Full `npm run test:e2e` at the end.

## Acceptance bar

- `npm run validate` passes (Bucket A stays 0; Bucket B remains
  provider-gated but functional when configured).
- `npm run test:smoke` adds ~18 new assertions, all pass.
- `npm run test:e2e` adds 6 specs, all pass; existing 69 still pass.
- Provider configs persist; keys save/clear/test safely.
- Local-only mode blocks external calls.
- Privacy guard fires before manuscript text is sent.
- API keys never appear in export / audit / search (re-asserted).
- Multi-provider AI Routing moves from "Out of scope this milestone" →
  **Implemented (OpenAI-compatible / OpenRouter / Anthropic / Ollama /
  Custom; Gemini adapter pending)** in `PRODUCT_COMPLETION_AUDIT.md`.
