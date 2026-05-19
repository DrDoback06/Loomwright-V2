# Full Project Import / Export Pass — Report

_Branch: `claude/project-import-export-pass`. Closes the agreed-on
"safe move between devices, safe backup before destructive change,
reusable entity library" phase._

## Scope reminder

This pass adds project-level import/export/backup/library wiring on top of
the existing per-entity import/export. **No UI redesign**, no extraction
changes, no workspace rebuild, no AI work, no production build pipeline.

## What changed

### New `ProjectArchiveService` (in `backend-services.jsx`)

Single facade owning the full project archive surface:

| Method | Purpose |
|--------|---------|
| `buildExport(options)` | Build a `loomwright-project-v1` payload. Always redacts secrets and never includes the encrypted `api_keys_encrypted` blob. |
| `downloadProjectExport(options)` | `buildExport` + download as `loomwright-project-export-<stamp>.json`. |
| `createBackupBeforeReplace()` | Builds the safest possible export (all sections included) and downloads `loomwright-backup-<stamp>.json` before destructive replace. |
| `validateExportPayload(payload)` | Returns `{valid, schemaVersion, warnings, counts}`. Accepts v1 and legacy `loomwright/project-export/v1\|v2`. |
| `summarizeExportPayload(payload)` | UI-shaped preview: project name, counts by type, schema, sample/trash/queue flags, redaction posture. |
| `applyImport(payload, {mode, overwriteOnConflict})` | Applies a payload in `"merge"` (default) or `"replace"` mode across entities, chapters, references, occurrences, review queue, onboarding, project intelligence, skill trees, tangle, composition, settings, trash. Replace **never** restores secrets. |
| `buildEntityLibrary({types, includeReferences, includeOccurrences, includeSampleData})` | Builds a `loomwright-library-v1` selective subset (default: all 14 entity types). |
| `downloadEntityLibrary(options)` | `buildEntityLibrary` + download as `loomwright-library-<stamp>.json`. |
| `applyEntityLibrary(payload, opts)` | Merge-only library import. Unselected types are not touched. |

Backed by `PROJECT_SCHEMA = "loomwright-project-v1"`, `LIBRARY_SCHEMA = "loomwright-library-v1"`, and a `LEGACY_PROJECT_SCHEMAS` set for compatibility with the older `loomwright/project-export/v2` and v1 payloads.

### Privacy guarantees (non-negotiable, enforced in code)

1. The encrypted `api_keys_encrypted` storage key is **never** written to any payload — `buildExport()` does not even read it.
2. `metadata.apiKeysIncluded` is hard-coded to `false` in v1. There is no "include secrets" flag in the v1 API.
3. `settings` and `aiProviderSettings` are passed through a recursive `redactSecrets(obj)` helper that strips any field whose name is in `SECRET_FIELDS = {apiKey, secret, token, password, bearer, credential}`. Replaced with `"[redacted]"`. Verified by smoke + e2e against both top-level and deeply-nested layouts.
4. `validateExportPayload` actively warns if an external payload claims to include API keys ("Payload claims to include API keys — refusing to import secrets in v1") and the import path drops them on the floor.
5. `applyImport` only writes `aiProviderSettings` on replace mode (never on merge), to protect the user's locally-configured BYOK keys.

### Schema (v1)

```jsonc
{
  "schemaVersion": "loomwright-project-v1",
  "appName": "loomwright-v2",
  "appVersion": "v1",
  "exportedAt": "ISO-8601",
  "project": { "id", "name", "createdAt", "updatedAt" },
  "options": { "includeTrash", "includeReviewQueue", "includeSampleData", "includeSettings", "includeApiSecrets": false },
  "settings":               <redacted>,
  "aiProviderSettings":     <redacted>,
  "chapters":               { /* ManuscriptChapterService.defaultState() shape */ },
  "manuscript":             <legacy fallback>,
  "entities":               { "cast": [...], "items": [...], ... },
  "skillTrees":             { trees: [...] },
  "atlas":                  { "placed": [{ id, name, coords, atlasMap, routes }, ...] },
  "tangle":                 { nodes, groups, edges },
  "occurrences":            [...],
  "reviewQueue":            [...],         // optional
  "handoffLog":             [...],
  "references":             [...],
  "onboardingAnswers":      {...},
  "projectIntelligence":    {...},
  "composition":            {...},
  "trash":                  [...],         // optional, default off
  "speedReader":            {...},
  "extractionSession":      {...},
  "metadata": {
    "countsByType":         { type: count },
    "chapterCount":         n,
    "occurrenceCount":      n,
    "referenceCount":       n,
    "reviewQueueCount":     n,
    "trashCount":           n,
    "includesSampleData":   bool,
    "includesTrash":        bool,
    "includesReviewQueue":  bool,
    "apiKeysIncluded":      false
  }
}
```

The library schema is a strict subset:

```jsonc
{
  "schemaVersion": "loomwright-library-v1",
  "exportedAt": "...",
  "types": ["cast", "items", ...],
  "entities": { ... },        // only the requested types
  "references": [ ... ],      // optional
  "occurrences": [ ... ],     // optional, filtered to selected entity ids
  "metadata": { "countsByType", "includesSampleData" }
}
```

### Merge vs replace behaviour

| Section | Merge mode | Replace mode |
|---------|-----------|--------------|
| Entities | Id-based merge; existing wins on conflict unless `overwriteOnConflict: true` | Wipe-and-load |
| Chapters | Id-based merge; chapter map merged | Wipe-and-load (active id from payload) |
| References | Id-based merge | Wipe-and-load |
| Occurrences | Dedup by `(entityId, chapterId, startOffset, endOffset)` | Wipe-and-load |
| Review queue | Append, dedup by id | Wipe-and-load |
| Onboarding answers | Shallow merge, **current wins** | Wipe-and-load |
| Project intelligence | Shallow merge, **current wins** | Wipe-and-load |
| Skill trees | Id-based merge (`trees[]`) | Wipe-and-load |
| Tangle | Id-based merge (`nodes[]`, `groups[]`) | Wipe-and-load |
| Composition overlay | **Not touched** on merge (avoid clobbering live draft) | Wipe-and-load |
| Settings | **Not touched** on merge (BYOK protection) | Wipe-and-load |
| AI provider settings | **Not touched** on merge | Wipe-and-load |
| Trash | Append on merge | Wipe-and-load |

Replace requires the caller to invoke `createBackupBeforeReplace()`
explicitly. The registry's `onImportProjectData` branch uses two
sequential `window.confirm` prompts ("Replace will overwrite…" then
"This will erase…") and always runs the backup before clearing storage.

### Callback registry wiring (in `callback-registry.jsx` + `BACKEND_HANDLED`)

The 5 pre-existing callbacks are now routed through the new service:

- `onExportProjectData` → `ProjectArchiveService.downloadProjectExport()`
- `onBackupNow` → `ProjectArchiveService.createBackupBeforeReplace()`
- `onImportProjectData` → file-picker → preview → optional double-confirm → `applyImport({mode})`. Branches on library vs project schema automatically.
- `onExportEntityLibrary` → `ProjectArchiveService.downloadEntityLibrary()`
- `onImportEntityLibrary` → file-picker → `ProjectArchiveService.applyEntityLibrary()`

Seven **new** callback names were registered to give the Settings UI dedicated controls without overloading the existing ones:

- `onDownloadProjectExport`
- `onCreateProjectBackup`
- `onPreviewProjectImport`
- `onValidateProjectImport`
- `onConfirmProjectImport`
- `onDownloadEntityLibrary`
- `onCopyProjectExportJson`

All seven were added to:
- `scripts/callback-names.json`
- `callback-names-data.jsx`
- `BACKEND_HANDLED` in `callback-registry.jsx`

Audit count: `OK: 524 UI callbacks; registry bootstraps 531 handlers` — Bucket A still 0.

## Tests

### Smoke (`scripts/smoke-services.js`)

New `[project import/export]` block. **24 new assertions, all pass:**

```
[archive] buildExport schemaVersion = loomwright-project-v1
[archive] buildExport metadata.apiKeysIncluded = false
[archive] buildExport never includes api_keys_encrypted
[archive] buildExport redacts settings.aiProviderSettings.apiKey
[archive] buildExport entities.cast count = 2
[archive] buildExport entities.locations count = 1
[archive] buildExport metadata.chapterCount >= 1
[archive] buildExport includeSampleData=false keeps user records
[archive] buildExport excludes trash by default
[archive] validate v1 payload valid
[archive] validate legacy v2 valid with warning
[archive] validate non-object payload invalid
[archive] summarize counts.entities >= 3
[archive] summarize apiKeysIncluded false
[archive] merge adds new entity
[archive] merge does not overwrite existing on conflict
[archive] merge overwriteOnConflict updates existing
[archive] replace wipes-and-loads payload entities
[archive] library schemaVersion = loomwright-library-v1
[archive] library contains only requested types
[archive] library cast count = 2
[archive] applyEntityLibrary imports selected type
[archive] applyEntityLibrary does not import unselected types
[archive] redactSecrets strips nested apiKey
```

### E2E (`tests/e2e/10-project-import-export.spec.js`)

**5 new browser tests, all pass:**

1. **buildExport produces a v1 payload with redacted secrets** — confirms no API key or encrypted blob leaks.
2. **merge import preserves existing data and adds new records** — existing user record's name is preserved on conflict; a new id is added.
3. **replace import wipes-and-loads after backup hook is invoked** — verifies destructive path: `createBackupBeforeReplace` runs, `applyImport({mode: "replace"})` clears and loads, reload confirms persistence in IndexedDB.
4. **entity library export/import: selected types only** — exports cast only; reloads into a cleared store; locations remain absent.
5. **summarizeExportPayload reports counts and privacy posture** — preview summary carries valid schema + counts + `apiKeysIncluded: false`.

### Full suites

```
npm run validate     → OK: 524 UI callbacks; registry bootstraps 531 handlers
                       OK: 0 Bucket A action callbacks reach the generic default notice.
npm run test:smoke   → All smoke checks passed.
npm run test:e2e     → 51 passed (5.7m) — 46 pre-existing + 5 new.
```

## Files changed

- `backend-services.jsx` — `ProjectArchiveService`, `PROJECT_SCHEMA`, `LIBRARY_SCHEMA`, `LEGACY_PROJECT_SCHEMAS`, `SECRET_FIELDS`, `redactSecrets`; `exportProject`/`importProject` thin shims; expanded delegate listener for 12 callback names.
- `callback-registry.jsx` — added 7 names to `BACKEND_HANDLED`.
- `scripts/callback-names.json` + `callback-names-data.jsx` — added 7 names alphabetically.
- `scripts/smoke-services.js` — `[project import/export]` block (24 assertions).
- `tests/e2e/10-project-import-export.spec.js` — new spec, 5 tests.
- `PROJECT_IMPORT_EXPORT_PLAN.md` — plan (committed first).
- `PROJECT_IMPORT_EXPORT_REPORT.md` — this report.
- `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` — updated to reflect Implemented status.

## Status moves

In `PRODUCT_COMPLETION_AUDIT.md`:

> **Full Project Import/Export** — moves from Prototype/Thin → **Implemented** (full export, validate, preview/summary, merge, replace with backup, entity library, API-secret redaction by default; 24 smoke + 5 e2e assertions cover the contract).

## Out of scope (still)

- Speed Reader completion
- Search/indexing
- Audit log / undo
- Multi-provider AI routing
- Production build pipeline
- Extraction changes
- Field parity changes (no bugs found)
- Workspace persistence changes (no bugs found)
- UI redesign / new Settings layout

## Known gaps left for a future pass

- **Settings UI controls.** The service supports a Preview → Merge/Replace → Confirm flow, but the existing Settings panel still exposes only the older "Export project / Import project" buttons (routed to the new service). A small UI pass to expose mode selection + include-trash + include-sample checkboxes is reasonable, but is intentionally not in this PR.
- **Library import — overwrite UI.** `applyEntityLibrary({overwriteOnConflict: true})` works in code, but there is no UI affordance for it yet.
- **Cross-version migration.** Legacy v1/v2 payloads import on the best-effort path; we do not currently attempt to upgrade them into the v1 shape on disk after import.
