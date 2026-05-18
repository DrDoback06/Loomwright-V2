# Loomwright v2 — Codex Backend Implementation Guide

This document captures the backend integration shipped on top of the existing
React UI. The UI itself is untouched; persistence, services, and BYOK wiring
sit *behind* the panels and workspaces.

## 1. Source of truth

- **Entry HTML:** `Loomwright Shell.html` (the root `index.html` redirects to it).
- **Loader:** Babel-standalone executes `<script type="text/babel">` blocks at
  runtime — **no bundler**. New modules attach exports to `window` rather
  than using ES module `import`/`export`.
- **Ignore:** `Loomwright.bundle.jsx`, `Loomwright Shell - Standalone.html`,
  `Loomwright Shell.standalone-src.html`, and `Loomwright Shell-print.html`
  are generated review artefacts (per `README.md`).

## 2. New backend modules

Loaded by `Loomwright Shell.html` **before** any feature script (`brand.jsx`,
`app.jsx`, etc.) so that services are ready when components render:

| File | Phase | Globals exported |
| --- | --- | --- |
| `lw-storage.jsx` | 1 | `StorageService` |
| `lw-services.jsx` | 2, 5–8 | `EntityService`, `ReferencesService`, `OnboardingService`, `ProjectIntelService`, `ReviewQueueService`, `ChaptersService`, `SettingsService`, `AuthorProfilesService` |
| `lw-crypto.jsx` | 10 | `KeysService` (AES-GCM + PBKDF2) |
| `lw-handoff.jsx` | 9 | `HandoffService`, `parseHandoffResult` |
| `lw-backup.jsx` | 11 | `BackupService` |

All services also live under `window.Loomwright` (namespace) for parity.

## 3. Storage layout

```
lw:entities         { [id]: Entity }
lw:chapters         { activeChapterId, chapters[], manuscript: { [id]: paragraphs[] } }
lw:references       Reference[]
lw:onboarding       OnboardingAnswers
lw:project_intel    ProjectIntelligence
lw:review_queue     ReviewQueueItem[]
lw:settings         { project, theme, editor, privacy, extraction, reviewQueue, aiRouting, aiProviders }
lw:author_profiles  AuthorProfile[]
lw:ai_routing       AIRoutingPrefs
lw:ai_keys          { [providerId]: { provider, envelope: { iv, data, alg, v }, hint, updatedAt } }
lw:byok_passphrase  string
lw:byok_salt        base64
lw:handoff_history  HandoffHistoryItem[]   (capped to 25)
```

The `lw:` prefix isolates Loomwright from any other app sharing `localStorage`.

## 4. Entity schema

All entities share a common envelope; type-specific fields are merged on top.

```json
{
  "id": "cast-abc123",
  "type": "cast|locations|items|quests|events|bestiary|...",
  "name": "Aelinor Vey",
  "aliases": ["the salt-queen"],
  "summary": "Salt-coast queen of the Pale Reach.",
  "description": "...",
  "status": "active|archived|draft|deleted",
  "flags": [],
  "tags": [],
  "sourceMentions": [
    { "chapter": "c7", "paragraph": "p4", "quote": "…", "source": "manuscript", "ts": "ISO" }
  ],
  "reviewQueueCount": 0,
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

`EntityService.ensureSeeded()` hydrates the store from
`window.ENTITY_SAMPLES` (declared in `entity-data.jsx`) the first time the
store is empty. The seeding is deferred until `window.load` so the sample
data has been registered.

## 5. Event bus

All callbacks documented in the original handoff brief route through these
`window` events. New listeners added in `app.jsx`:

| Event | Source | Effect |
| --- | --- | --- |
| `lw:open-entity-editor` | any panel | Opens the entity editor with payload `{ type, mode, initial }`. |
| `lw:open-panel` | any panel | Opens or fronts a side panel. |
| `lw:drop-to-composition` | drag layer | Drops an entity into the composition overlay. |
| `lw:open-panel-workspace` | panels / settings | Opens a full-screen workspace. |
| `lw:exit-panel-workspace` | workspace UI | Exits the current workspace. |
| `lw:reference-add` | references library | Phase 6 — saves through `ReferencesService` if `detail.content` is provided, otherwise opens the entity editor. |
| `lw:settings-add` | settings | Opens the Control Centre with `actionId`. |
| `lw:review-suggest` | extraction / panels | Adds an item to the review queue. |
| `lw:ai-handoff-copy-json` | handoff drawer | Records the pack snapshot in `HandoffService.history`. |
| `lw:ai-handoff-save` | handoff drawer | Records the pack snapshot. |
| `lw:ai-handoff-import` | handoff drawer | Routes the parsed result through `HandoffService.applyResult`. |
| `lw:ai-handoff-save-reference` | handoff drawer | Saves the AI result as a reference. |
| `lw:ai-handoff-draft-ready` | handoff service | Drops generated prose into the composition overlay. |
| `lw:entity-saved` | `app.jsx` save flow | Fires after a successful `EntityService.save`. |
| `lw:entities-changed` | `EntityService` | Mass updates (seed/import/replace). |
| `lw:references-changed` | `ReferencesService` | References mutated. |
| `lw:onboarding-changed` | `OnboardingService` | Onboarding answers mutated. |
| `lw:project-intel-changed` | `ProjectIntelService` | Project intelligence mutated. |
| `lw:review-queue-changed` | `ReviewQueueService` | Review queue mutated. |
| `lw:chapters-changed` | `ChaptersService` | Writer's Room chapter/manuscript state mutated. |
| `lw:ai-keys-changed` | `KeysService` | API keys added / removed / rotated. |
| `lw:backup-imported` | `BackupService` | A full bundle restore landed. |
| `lw:services-ready` | bootstrap | Fires once the auto-seeding finishes. |

## 6. Writer's Room persistence

`writers-room.jsx` (and its inline twin inside `Loomwright Shell.html`) holds
chapter state in component-local React state and:

1. On mount, asks `ChaptersService.load()` for previously saved state and
   adopts the active chapter id + chapter list if non-empty.
2. On every change to `chapters` or `activeId`, calls `ChaptersService.save`.

Double-clicking an entity mention in the manuscript dispatches
`onOpenEntityFromManuscript` in `app.jsx`. The handler:

1. Opens or fronts the canonical panel for the entity type.
2. Fuzzy-matches the manuscript label against the panel rows (legacy
   behaviour).
3. Asks `EntityService.findByLabel` for the canonical entity and, if a
   `chapterId` / `paragraphId` / `quote` was provided, appends a
   `sourceMention` so the manuscript ↔ entity link is durable.

## 7. Entity Editor

`<EntityEditor onSave={(p, opts) => …}>` in `app.jsx` now:

1. Calls `EntityService.save({ ...payload, type, status })`. The save mode
   maps to status:
   - `draft` → `status: "draft"` + adds an item to the review queue.
   - `active` → `status: "active"`.
   - `compose` → `status: "active"` + drops the entity into the composition
     overlay via `dropEntityIntoComposition`.
2. Dispatches `lw:entity-saved` so listeners can refresh.

## 8. References & Onboarding

`ResearchLibraryWorkspace` (in `workspaces-system.jsx`) hydrates from
`ReferencesService` and `EntityService.list("references")` on mount and
listens for `lw:references-changed` / `lw:entity-saved` to re-fetch.

The onboarding view inside the same workspace seeds its local form state
from `OnboardingService.load()`, and persists every change back to
`OnboardingService.save` via a debounced effect (effectively every render
where the answers map changes).

## 9. Project Intelligence

`SetProjectIntel` (in `settings-rich.jsx`) wires:

- **Open Project Intelligence File** → copies the JSON to the clipboard.
- **Sync from onboarding answers** → `ProjectIntelService.syncFromOnboarding`.
- **Copy full project context / style profile / canon rules / character
  bible** → reads from `ProjectIntelService`, `EntityService`,
  `ReferencesService`, `OnboardingService`, builds a JSON pack, and writes
  it to the clipboard.

## 10. AI Handoff Pack

The drawer in `ai-handoff.jsx` already builds packs and prompts. Phase 9
adds `HandoffService`:

```js
HandoffService.history();                              // recent packs (capped 25)
HandoffService.record(pack, "export"|"import"|"save"); // append to history
HandoffService.applyResult({ result, mode, raw, surface, pack }) // route result
HandoffService.parseResult(text);                      // robust parser
```

`applyResult` understands these AI return-shape keys:

| Key | Routed to |
| --- | --- |
| `entityUpdates[]` (`{ id, patch }`) | `EntityService.save` (merge with existing) |
| `suggestedReviewItems[]` | `ReviewQueueService.add` |
| `prose` (string) | dispatches `lw:ai-handoff-draft-ready` → composition overlay |
| `mode === "saveReference"` | `ReferencesService.save({ type: "ai-result", … })` |

## 11. BYOK / encryption

`KeysService` encrypts each provider key with AES-GCM derived via PBKDF2-SHA-256
(100 000 rounds, random salt). The passphrase defaults to
`"loomwright-local"` and can be rotated via `KeysService.setPassphrase(s)`
(which re-encrypts every stored key under the new key).

```js
await KeysService.save("openai", "sk-…")  // encrypts + persists
await KeysService.load("openai")          // decrypts plaintext for use
await KeysService.listMeta()              // { provider, hint, updatedAt }[]
await KeysService.testConnection("openai")// mocked — never hits the network
await KeysService.clear("openai" | null)  // clear one or all keys
```

Settings → AI Providers hydrates `apiKeyHint` from `KeysService.listMeta()`
on mount and saves changes through `KeysService.save` after a 500 ms
debounce. The plaintext is never re-displayed.

## 12. Backup / restore

```js
await BackupService.exportBundle()        // { schema, generatedAt, data }
await BackupService.downloadBundle(name?) // also offers a JSON download
await BackupService.importFromFile(file)  // restore from JSON File
await BackupService.importBundle(json)    // restore from parsed JSON
await BackupService.clearProject()        // wipes everything under lw:
```

Settings → Import / Export buttons call these. After a restore, the user is
nudged to refresh to see the panels reflect the new state.

## 13. Pre-coding checklist (resolved)

| Question | Resolution |
| --- | --- |
| Entry file? | `Loomwright Shell.html` (root `index.html` redirects). |
| Node / npm? | `npm install` + `npm run dev` (Vite serves the static app). |
| Module loader? | Babel-standalone — no ES module imports possible; services attach to `window`. |
| All entity modules present? | Yes; the audit step listed every JSX/CSS module loaded by `Shell.html`. |
| BYOK passphrase? | Defaults to `"loomwright-local"` + random salt; user can change via `KeysService.setPassphrase`. |

## 14. Verification

Per-phase verification used `npm run validate` and `@babel/parser` to parse
both standalone JSX files and the inline `<script type="text/babel">` block
in `Loomwright Shell.html`.

```
$ npm run validate
All checked HTML references exist.
```

The repository ships with no automated runtime tests; manual QA against
`Loomwright Shell.html` exercises every wired callback (see Phase 12 QA
notes in `DESIGN_FINAL_AUDIT.md`).
