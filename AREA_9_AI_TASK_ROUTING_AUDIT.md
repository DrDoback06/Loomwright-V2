# Area 9 — Per-task AI model picker: completion & audit reference

_Status: implemented, ready for audit._

The AI routing backend already supported per-task routes —
`AIRoutingService.resolveRoute(task)` reads `state.taskRoutes[task] =
{providerId, model}` first, and the `onSetAITaskRoute` callback persists them —
and this was service-tested (e2e `14`). The gap was a **UI**: users had no way
to actually choose a provider + model per task. Area 9 adds that picker.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **"Per-task AI model" card** under Settings → AI routing — one row per AI task (draft prose, rewrite, continue writing, quick/deep extraction, project intelligence, reference summary, continuity check, skill-tree generation, handoff assist) | `settings-rich.jsx` `SetTaskRouting` + `AI_TASK_ROUTES`, rendered under `case "ai-routing"` | e2e `26` (rows render per task) |
| **Provider selector per task** — lists the configured, enabled providers (from `KeysService.loadAllProviderSettingsSync`), plus a "Default" option | `SetTaskRouting` provider `<select>` | e2e `26` (seeded provider is an option) |
| **Model field with the provider's models** — a text input backed by a `<datalist>` of the provider's `availableModels` + `defaultModel`; blank = provider default | `SetTaskRouting` model input + datalist, `modelsFor` | e2e `26` (model set → persists) |
| **Persists through the real path** — selections dispatch `onSetAITaskRoute`, which saves to `AIRoutingService.taskRoutes` (merge, not replace) | `SetTaskRouting` `setRoute` → registry handler | e2e `26` (`taskRoutes.writingDraft` persists) |
| **Honoured by resolveRoute** — an explicit per-task route wins over the default provider | (existing) `AIRoutingService.resolveRoute` | e2e `26` (`resolveRoute("writingDraft")` = the chosen provider+model) |
| **Reset to Default** — choosing "Default" clears the task's explicit route | `SetTaskRouting` (empty providerId) | e2e `26` (route cleared) |
| **Live refresh** — the picker re-reads on `lw:ai-routing-updated` / `lw:backend-ready` so external changes reflect immediately | `SetTaskRouting` effect | code |
| **No-provider guidance** — with no providers configured, the card explains how to add one instead of showing empty selectors | `SetTaskRouting` note | code |

## How to verify

```sh
npm run validate
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 26-ai-task-routing   # 3 tests
```

### Manual smoke
1. `npm run dev` → add an AI provider (Settings → AI providers) with a couple of models.
2. Settings → **AI routing & cost** → **Per-task AI model**: route "Draft prose"
   to that provider and pick a model.
3. It persists; `AIRoutingService.resolveRoute("writingDraft")` returns your choice.

## Notes / deferred
- The picker writes to the real `AIRoutingService` store (`KEYS.aiRouting`). The
  older `SetAIRouting` "routing mode" card writes to a separate `ai-routing`
  *settings* section; unifying those two stores is a pre-existing cleanup,
  tracked separately, and out of scope here.
- No API calls are made by the picker — it only records routing preferences.
