# Area 5 — AI Writer: per-task model routing

_Status: model-picker UI implemented, ready for audit._

The routing backend (`AIRoutingService.taskRoutes` + `resolveRoute`) already
supported assigning a provider + model to each AI task, but nothing drove it —
every task used the default provider. Area 5 adds the UI that makes per-task
routing real, plus surrounding polish.

## What's implemented

| Feature | Implementation | Verified by |
|---|---|---|
| **Per-task model picker** — one row per AI task (writing/draft, continue, rewrite, quick + deep extraction, project intelligence, reference summaries, continuity check, skill-tree gen, AI handoff) with a provider select + model select | `SetAITaskRouting` in `settings-rich.jsx`, rendered in the `ai-routing` section | e2e `24` |
| **Persists to routing, not settings** | each change calls `AIRoutingService.save({ taskRoutes: { [task]: { providerId, model } } })` (merges); clearing a task ("Default") removes its route so `resolveRoute` falls back to the default provider + cost tier | e2e `24` (persist + resolveRoute + default-fallback) |
| **Only configured providers offered** | provider dropdown lists providers that are enabled and keyed (or local Ollama); if none are configured the card explains that every task uses the default | code |
| **Curated model shortlists + custom** | `SET_AI_MODEL_CATALOGUE` per provider type (accurate current model ids), always including the provider's own default; "Custom…" reveals a free-text `model-id` field for anything not listed | code + e2e `24` |
| **Live refresh** | rebuilds on `lw:ai-routing-updated` / `lw:settings-saved` / `lw:backend-ready` | code |

## How to verify
```
npm run build
npm run test:e2e -- tests/e2e/24-ai-task-routing.spec.js   # (needs CHROMIUM_PATH in this env)
```
Manual: Settings → AI routing → scroll to "Per-task model routing" → set
"Writing / drafting" to a provider + model → it persists and drives which
model the AI Writer uses for that task.

| **Deep · AI wheel slots advertise the model** | `deepWheelModelLabel()` resolves `deepExtraction`'s route; the "Deep · AI" wheel slots (selection + chapter) show the model as a sublabel + tooltip, so the user sees which model a Deep call uses. Change it in Settings → AI routing. | e2e `24` (+ `19` no regression) |

## Deferred from Area 5 (tracked in DEFERRED_BACKLOG.md)
- **Deeper AI style critique** of the voice sample beyond the local metrics —
  needs a live AI call flow.
