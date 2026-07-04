# Full Project Import / Export Pass — Plan

_Created: 2026-05-19, on branch `claude/project-import-export-pass` (started from `main` post-PR-#7)._

## Scope

Make full-project export / import safe and useful. **No UI redesign.**
Wire backup-before-replace, merge-vs-replace, preview, and
entity-library selective export/import behind the existing Settings
buttons. Add the security guard that's missing today (the current
`exportProject` writes encrypted API keys into the JSON file).

## Audit of current state

| Surface | Today | What's wrong |
|---------|-------|--------------|
| `exportProject()` in `backend-services.jsx:2266` | `StorageService.getAll()` → dumps every key including `KEYS.apiKeys` (the encrypted keyring) → `downloadJson` | **Privacy bug**: encrypted API key blob is exported. Even though it's AES-GCM-encrypted with a non-extractable IDB-resident root key, it should not appear in the file at all by default. No "include secrets" opt-in flow. |
| `importProject(data)` | `StorageService.setAll(payload)` → wholesale replace → `initialise()` | **No backup before destructive replace.** **No merge mode.** **No preview.** **No conflict handling.** A bad file or accidental import nukes the project. |
| Settings UI (`settings-rich.jsx:715-722`) | 5 buttons: `onExportProjectData`, `onImportProjectData`, `onExportEntityLibrary`, `onImportEntityLibrary`, `onBackupNow` | Buttons exist; `Export project` and `Import project` reach the delegate listener and run the broken flow above. `onExportEntityLibrary` / `onImportEntityLibrary` reach the generic fall-through ("isn't wired yet"). `onBackupNow` runs the same broken export. |
| Tests | One smoke check (`mergeEntities rewrites refs globally`) loosely touches import paths; no project-level import/export tests. | No safety net for the most destructive flows in the app. |

## Storage keys / services to include in export

Walking `KEYS` per `backend-services.jsx`:

| Key | Service | Include in export? | Notes |
|-----|---------|-------------------|-------|
| `entities` | EntityService | ✓ always | grouped by type in the schema |
| `references` | ReferencesService | ✓ always | |
| `onboarding_answers` | OnboardingService | ✓ always | |
| `project_intelligence` | ProjectIntelService | ✓ always | |
| `settings` | SettingsService | ✓ if `includeSettings` | always redact apiKey/secret fields |
| `ai_provider_settings` | KeysService | ✓ if `includeSettings` | metadata only (model, baseUrl, enabled); no `apiKey` |
| `api_keys_encrypted` | KeysService | ✗ **never by default** | the encrypted keyring. Even with the new "include secrets" toggle we don't ship this in v1 — it requires a separate flow that re-prompts for the key on the destination machine |
| `review_queue` | ReviewService | ✓ if `includeReviewQueue` (default true) | |
| `manuscript` | ManuscriptService | ✓ always | flat manuscript snapshots |
| `composition_overlay` | CompositionService | ✓ always | |
| `ai_handoff_log` | HandoffService | ✓ if `includeReviewQueue` | small log of recent packs |
| `trash` | TrashService | ✓ if `includeTrash` (default false) | |
| `manuscript_chapters` | ManuscriptChapterService | ✓ always | chapters + author + manuscripts map |
| `speed_reader` | (state under SpeedReader) | ✓ always | small UI state |
| `extraction_session` | ExtractionService | ✓ always | last session summary |
| `sample_project_loaded` | SampleProjectService | ✓ always (boolean) | |
| `entity_occurrences` | OccurrenceService | ✓ always | |
| `tangle_canvas` | TangleService | ✓ always | |
| `skill_trees` | SkillTreeService | ✓ always | |

## Project export schema (versioned)

```js
{
  schemaVersion: "loomwright-project-v1",
  appName:       "loomwright-v2",
  appVersion:    "v1",
  exportedAt:    "<iso>",
  project: {
    id:        "<projectId or 'default'>",
    name:      "<from settings or 'Loomwright project'>",
    createdAt: "<earliest createdAt found>",
    updatedAt: "<latest updatedAt found>",
  },
  options: {
    includeTrash, includeReviewQueue, includeSampleData,
    includeSettings, includeApiSecrets: false,  // v1 always false
  },
  settings:                <safe section copy or null>,
  aiProviderSettings:      <metadata-only array or null>,
  chapters:                <ManuscriptChapterService state>,
  entities: {
    cast: [], bestiary: [], locations: [], items: [], classes: [],
    races: [], stats: [], skills: [], quests: [], events: [],
    factions: [], relationships: [], timeline: [], lore: [],
    references: [],
  },
  skillTrees:              <SkillTreeService state>,
  atlas:                   <derived: locations with data.placed===true>,
  tangle:                  <TangleService state>,
  occurrences:             [<EntityOccurrence>...],
  reviewQueue:             [...] | omitted,
  references:              [...],  // the references *collection*; distinct from entities.references
  onboardingAnswers:       {...},
  projectIntelligence:     {...},
  composition:             {...},
  trash:                   [...] | omitted,
  speedReader:             {...},
  extractionSession:       {...},
  metadata: {
    countsByType:        { cast: N, items: N, ... },
    chapterCount:        N,
    occurrenceCount:     N,
    referenceCount:      N,
    reviewQueueCount:    N | 0,
    trashCount:          N | 0,
    includesSampleData,
    includesTrash,
    includesReviewQueue,
    apiKeysIncluded:     false,
  }
}
```

Notes:
- `references` lives at the top level AND inside `entities.references`. The Reference editor config makes them an entity type, but the legacy `KEYS.references` array still exists; export both for compatibility.
- `atlas` is **derived** at export time (locations with `data.placed===true`); not a separate storage key.
- v2 read-compatibility: if the file has `schema === "loomwright/project-export/v2"` (the old format produced by the existing broken `exportProject()`), `validateExportPayload` accepts it as a `v0` fallback and applies a translation shim.

## Project import — modes

### Validation + preview

`ProjectArchiveService.validateExportPayload(payload)` returns:
```js
{
  valid: boolean,
  schemaVersion: "loomwright-project-v1" | "loomwright/project-export/v2" | "unknown",
  warnings: [string],  // schema mismatch, contains sample data, contains trash, etc.
  counts: { entities: N, chapters: N, references: N, occurrences: N, reviewQueue: N, trash: N }
}
```

`ProjectArchiveService.summarizeExportPayload(payload)` returns a
preview-friendly object: project name, exported-at, counts by type,
chapter/reference/occurrence/queue/trash counts, settings included
flag, sample-data included flag, schema version match yes/no, warnings.

### Merge mode

Adds records from payload into the current store:
- For each entity type: existing records stay; payload records with **new ids** are added; payload records with **conflicting ids** are skipped unless `overwriteOnConflict: true`.
- Chapters: same id-based merge.
- References: same.
- Occurrences: append; dedup by `(entityId, chapterId, startOffset, endOffset)`.
- Review queue: append.
- Onboarding answers / Project Intelligence: shallow merge with current winning on conflict (we never want to clobber a user's intel by accident).
- Composition / settings / sample-loaded flag: untouched on merge.

### Replace mode

- Requires explicit double-confirm at the UI layer.
- `createBackupBeforeReplace()` builds a fresh export of the current store and downloads it as `loomwright-backup-<timestamp>.json` BEFORE any destructive operation.
- Then `StorageService.clear()` wipes everything.
- Then payload is loaded.
- Then `initialise()` rehydrates.
- `lw:project-imported` event fired with `{mode: "replace", backupGenerated: true}`.

### API key / privacy rules

- `api_keys_encrypted` key is **never** written to the export payload in v1.
- `ai_provider_settings` is stripped of any `apiKey` / `secret` / `token` field before export. Redact value to `"[redacted]"` if present (defensive).
- Validate also rejects an import that claims `apiKeysIncluded: true` unless a future opt-in flow exists.
- Export and import **must not** trigger any AI calls.

## Entity library export/import

`buildEntityLibrary({ types, includeReferences, includeOccurrences, includeSourceMentions, includeSampleData, includeRelationships })`:

```js
{
  schemaVersion: "loomwright-library-v1",
  exportedAt: ...,
  types,           // [cast, items, …]
  entities: { [type]: [...] },
  references: [...] | omitted,
  occurrences: [...] | omitted,
  metadata: { countsByType, includesSampleData },
}
```

`applyEntityLibrary(payload, { mode })` — merge mode by default. Sample-tagged records skipped unless `includeSampleData: true` at import.

Use case: export Items + Classes + Stats from one project, import into another project as a reusable library.

## Callbacks

Already in `callback-names.json`:
- `onExportProjectData` — was wired to broken export; now routes via service
- `onImportProjectData` — was wired to broken import; now routes via service
- `onExportEntityLibrary` — was unwired
- `onImportEntityLibrary` — was unwired
- `onBackupNow` — was wired to broken export; now routes via service

New callback names this pass:
- `onPreviewProjectImport`
- `onConfirmProjectImport`
- `onCreateProjectBackup`
- `onDownloadProjectExport`
- `onValidateProjectImport`

Settings UI: keep the existing 5 buttons in `settings-rich.jsx`; their `data-callback` strings already point at the right names. Just make sure the registry routes each to the new service. Replace mode requires double-confirm via `window.confirm` (matches `onResetProjectData` pattern).

## Tests

### Smoke (in `scripts/smoke-services.js`, new `[project import/export]` block)

- `buildExport()` produces a payload with the v1 schema.
- `buildExport()` omits the `api_keys_encrypted` blob.
- `buildExport()` omits trash by default; includes trash when `includeTrash: true`.
- `buildExport()` omits sample-tagged records when `includeSampleData: false`.
- `validateExportPayload()` accepts a v1 export.
- `validateExportPayload()` accepts a v2 legacy export (compatibility shim).
- `summarizeExportPayload()` returns correct counts.
- `applyImport(payload, {mode: "merge"})` preserves an existing user entity not in the payload.
- `applyImport(payload, {mode: "merge"})` adds payload entities that don't conflict.
- `applyImport(payload, {mode: "merge", overwriteOnConflict: false})` skips conflicting ids.
- `applyImport(payload, {mode: "replace"})` wipes current state and loads payload.
- `createBackupBeforeReplace()` produces an export before the replace runs.
- `buildEntityLibrary({types: ["items"]})` returns only those types.
- `applyEntityLibrary(libraryPayload, {mode: "merge"})` merges only the included types.
- Settings export redacts any `apiKey` field to `"[redacted]"` if encountered.
- API keys storage key is NOT readable from the export JSON regardless of settings.

### E2E (`tests/e2e/10-project-import-export.spec.js`)

- Build project export via `ProjectArchiveService.buildExport()` from a clean fresh project + a few created entities → assert schema version, counts, and **no `api_keys_encrypted` key** in the payload.
- Save → reload → merge import a payload containing a NEW entity → assert original entity survives AND new entity is added.
- Save → reload → replace import a payload containing different entities → assert original entities gone AND new entities loaded AND backup was generated.
- Entity library round-trip: build library with only `["items"]` → save in fresh project → assert only items imported, no cast.
- API key redaction: configure a fake provider key, build full export, assert `api_keys_encrypted` is absent and any `apiKey` in `settings` / `aiProviderSettings` is `"[redacted]"`.

## Files to modify

- `backend-services.jsx` — add `ProjectArchiveService` (replaces the lone `exportProject` / `importProject` functions); register new callback names in BACKEND_HANDLED; update delegate listener for old + new callbacks.
- `callback-registry.jsx` — handlers for new callback names if not in BACKEND_HANDLED.
- `scripts/callback-names.json` + `callback-names-data.jsx` — add new names.
- `scripts/smoke-services.js` — new `[project import/export]` block.
- `tests/e2e/10-project-import-export.spec.js` — new e2e spec.
- `PROJECT_IMPORT_EXPORT_PLAN.md` (this), `PROJECT_IMPORT_EXPORT_REPORT.md`, `PRODUCT_COMPLETION_AUDIT.md`, `FINAL_QA_REPORT.md`.

No UI files touched beyond data-attribute additions to settings if needed (the existing buttons in `settings-rich.jsx` already carry the right `data-callback` names).

## Strict out-of-scope

- ❌ Speed Reader work
- ❌ Search/indexing
- ❌ Audit log / undo
- ❌ Multi-provider AI routing
- ❌ Production build pipeline
- ❌ Extraction logic changes (unless an import bug requires touching it)
- ❌ Field parity changes (unless an import bug surfaces a missing field)
- ❌ Workspace persistence changes (unless an import bug)
- ❌ UI redesign / panel rebuild
- ❌ Cloud sync / upload

## Acceptance bar

- `npm run validate` passes (Bucket A = 0).
- `npm run test:smoke` adds ~16 new assertions, all pass.
- `npm run test:e2e` adds 5 new tests, all pass; existing 46 still pass.
- Full export works; preview accurate; merge preserves user data; replace creates backup; entity library selective; API keys never exported.
- `PRODUCT_COMPLETION_AUDIT.md` Full-Project Import/Export → Implemented.

## Commit plan

1. `PROJECT_IMPORT_EXPORT_PLAN.md` (this, no code).
2. `ProjectArchiveService` + redact + new callback names in `backend-services.jsx` / `callback-registry.jsx` / `callback-names-data.jsx`.
3. Smoke harness extension.
4. E2E spec.
5. `PROJECT_IMPORT_EXPORT_REPORT.md` + audit/QA doc updates.

Each step: `npm run validate` + `npm run test:smoke` before moving on. Full `npm run test:e2e` at the end.
