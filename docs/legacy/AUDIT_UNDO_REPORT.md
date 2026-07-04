# Audit Log / Undo Pass — Report

_Branch: `claude/audit-undo-pass`. Closes the agreed "change history
and recovery" phase._

## Scope reminder

Add a real `AuditService` that records every meaningful local
mutation, surfaces recent activity on Home (replacing the static
mock array), and lets the user undo safe actions. Anti-recursion
flag (`{skipAudit:true}`) prevents undo from logging cascades. No
collaborative history, no cloud sync, no Git-like versioning.

## What changed

### New `AuditService` (in `backend-services.jsx`, `KEYS.auditLog`)

| Method | Purpose |
|--------|---------|
| `defaultState() / loadSync() / save(state)` | IndexedDB + localStorage mirror |
| `log(event)` | Append event, redact `before/after/patch/metadata` via existing `redactSecrets`, cap log at 500 events |
| `listSync(options) / getSync(id) / getRecentSync(limit=10) / listByTargetSync(targetType, targetId)` | Read accessors |
| `canUndo(eventId)` | Returns false if undone, missing, audit-only, or not in `AUDIT_REVERSIBLE` set |
| `markUndone(eventId, undoEventId)` | Flags the event + records the undo pointer |
| `undo(eventId)` | Dispatches the reverse action via the underlying service with `{skipAudit:true}`, logs a sibling `audit.undo` event, marks original undone |
| `clear()` | Wipes the log (Settings/Debug button only) |
| `exportSync()` | Returns redacted JSON snapshot for download |

### Event shape (canonical)

```jsonc
{
  "id", "projectId",
  "action", "label",
  "targetType", "targetId", "targetName", "entityType",
  "before", "after", "patch",          // all redacted via redactSecrets
  "source", "sourceSurface",
  "reversible", "undoType",
  "relatedIds": [...],
  "metadata": {...},                   // redacted
  "undone", "undoneAt", "undoneByEventId",
  "createdAt"
}
```

### Reversible actions (the `AUDIT_REVERSIBLE` set)

`entity.create / entity.update / entity.delete / chapter.create /
chapter.save / chapter.delete / reference.create / reference.update /
reference.delete / onboarding.update / intel.update /
settings.section-update / review.accept / review.deny / sample.load`.

All others are **audit-only** (logged but `canUndo === false`):
`audit.undo` itself, `entity.merge`, `project.import (merge/replace)`,
`project.reset`, `project.export`, `project.backup`,
`library.export/import`, `review.bulk-*`, hard-delete-forever,
provider tests, `speed-reader.*`, `atlas.update / skill-tree.update /
tangle.update / occurrence.*` (when added).

### Undo handlers (in `AuditService.undo()`)

| Action | Reversal |
|--------|----------|
| `entity.create` | `EntityService.delete(type, id, {skipAudit:true})` (soft-delete to trash) |
| `entity.update` | `EntityService.save(type, before, {skipAudit:true})` restores snapshot |
| `entity.delete` | `EntityService.save(type, {...before, status:"active"}, {skipAudit:true})` + `TrashService.purge(id)` |
| `chapter.create` | Removes chapter row + manuscripts entry via `ManuscriptChapterService.save({skipAudit:true})` |
| `chapter.save` | Restores chapter row + manuscripts entry from `before` snapshot |
| `chapter.delete` | Re-adds chapter row + manuscripts entry from `before` snapshot |
| `reference.create` | Removes ref by id |
| `reference.update / delete` | Restores ref from `before` |
| `onboarding.update / intel.update` | Restores previous storage value |
| `settings.section-update` | `SettingsService.saveSection(sectionId, before, {skipAudit:true})` |
| `review.accept / review.deny` | Reopens item to `status: "pending"`; for accept-that-created-entity, also deletes the created entity |
| `sample.load` | Deletes only the `relatedIds` (entity + reference ids the load event recorded); user records preserved |

### Anti-recursion + skipAudit flag

Every service method that writes storage now accepts an `opts` object
with an optional `skipAudit:true` flag. When `AuditService.undo()`
calls these services, it passes `{skipAudit:true}` so the reversal
itself doesn't generate cascading audit events. Each undo logs a
single `audit.undo` sibling event pointing back at the original (via
`relatedIds[0]` and `metadata.undidAction`).

Services updated to honour the flag:
- `EntityService.save / update / delete`
- `ManuscriptChapterService.save / setChapterContent / createFromComposition`
- `ReviewService.resolve / resolveMany`
- `ReferencesService.save / delete` (new `delete` method added)
- `OnboardingService.save`
- `ProjectIntelService.save`
- `SettingsService.saveSection`

### Privacy guarantees

- Every event's `before`, `after`, `patch`, and `metadata` field
  passes through the existing `redactSecrets(obj)` helper at log time.
- `SECRET_FIELDS = {apiKey, secret, token, password, bearer,
  credential}` are replaced with `"[redacted]"` at any nesting depth.
- `KEYS.apiKeys` (encrypted keyring blob) is **never** the target of
  any logged mutation — none of the audited services touch it.
- `KeysService.testProvider` (the provider connection test) is not
  logged — it has no state change to record.
- `AuditService.exportSync()` returns the same redacted events; no
  separate un-redacted form exists.
- `KEYS.auditLog` is **not** added to `ProjectArchiveService` exports
  (the log is local/diagnostic, not part of the canonical project).

### Home Recent Activity (`home.jsx`)

Replaced the static `HOME_RECENT_ACTIVITY` array with live data from
`AuditService.getRecentSync(10)`. Re-renders on
`lw:audit-log-updated`, `lw:audit-undo-applied`, and
`lw:audit-log-cleared` events.

Each row carries:
- Kind dot (existing CSS classes; mapped from `event.action` via
  `_homeKindForAction`)
- Action label (`event.label`)
- Relative time (`_homeFormatRelative(event.createdAt)`)
- **Undo button** when `canUndo(event.id)` — dispatches
  `AuditService.undo(event.id)` and shows a notice on failure

Click on the row opens the right surface via `lw:open-search-result`
(reuses the search/indexing routing layer from PR #10).

Empty state row: "Activity will appear here as you work." when the
audit log is genuinely empty. The original sample rows still render
as a fallback when no live data exists.

### New callbacks

Five **new** callback names registered:

- `onUndoAuditEvent`            — backend-handled: undoes by id
- `onOpenAuditLog`              — dispatches `lw:open-audit-log` for Settings
- `onClearAuditLog`             — confirms then `AuditService.clear()`
- `onExportAuditLog`            — downloads `loomwright-audit-<stamp>.json`
- `onOpenRecentActivityItem`    — maps event target to `lw:open-search-result`

All in `scripts/callback-names.json`, `callback-names-data.jsx`, and
`BACKEND_HANDLED` in `callback-registry.jsx`.

**Audit count: 526 UI callbacks; registry bootstraps 552 handlers; Bucket A still 0.**

### Incidental bug fix (in scope per the brief — surfaced by Sample undo test)

`collectDefaultEntities()` used the **live** `window.CAST_SAMPLE` /
`window.ENTITY_SAMPLES` globals as the "sample seed" source. But
`applyEntityGlobals()` rewrites those same globals with whatever's
currently in storage — including user-created entities. So a
`SampleProjectService.loadSample()` after the user had created any
cast would include the user's entity in `sampleEntities`, and
`addedIds` would record it, and undoing the load would erase the
user's work.

Fix: `collectDefaultEntities()` now prefers the boot-time
`__LW_SAMPLE_SOURCES__` snapshot (which is set once at module load
and never overwritten) and only falls back to live globals if that
snapshot is empty (legacy shells). Pre-existing latent bug. Brief
explicitly allows fixes surfaced while testing this pass.

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[audit]` block

**23 new assertions, all pass:**

```
[audit] AuditService exposed
[audit] defaultState is empty
[audit] log() persists event
[audit] entity.create event recorded
[audit] entity.create after snapshot has the new name
[audit] entity.update event recorded
[audit] entity.update before carries old name
[audit] entity.update after carries new name
[audit] entity.delete event recorded
[audit] canUndo true for entity.create
[audit] canUndo false for project.reset
[audit] undo(entity.update) restores previous name
[audit] undo marks original event as undone
[audit] undo(entity.delete) restores entity to active
[audit] canUndo false after first undo
[audit] undo(entity.create) soft-deletes the created entity
[audit] reference.create event recorded
[audit] onboarding.update event recorded
[audit] settings.section-update event recorded
[audit] API key value NEVER present in audit log JSON
[audit] settings before/after fields are redacted
[audit] exportSync redacted output never contains the secret value
[audit] clear() empties the log
```

### E2E (`tests/e2e/13-audit-undo.spec.js`)

**6 new browser tests, all pass:**

1. Create entity → audit event recorded with correct `targetId`, `entityType`, `targetName`.
2. Edit entity → undo restores old name; original event marked `undone:true`; `audit.undo` sibling logged.
3. Delete entity → undo restores entity to `status: "active"` with original name.
4. Review accept → `review.accept` event logged with right `targetId`; undo reopens item to `status: "pending"`.
5. **Privacy** — Settings provider key update logs the event but **never** the secret value in the cached log or in `exportSync()` output; `after.apiKey === "[redacted]"`.
6. Sample load → `sample.load` event with `relatedIds`; undo preserves the user-created entity (only removes sample-tagged records).

### Full suites

```
npm run validate     → OK: 526 UI callbacks; registry bootstraps 552 handlers
                       OK: 0 Bucket A action callbacks reach the generic default notice.
npm run test:smoke   → All smoke checks passed (23 new [audit] assertions).
npm run test:e2e     → 69 passed (≈6.2 min) — 63 pre-existing + 6 new (Workflow Q).
```

## Files changed

- `backend-services.jsx`:
  - `KEYS.auditLog` added.
  - Full `AuditService` (~250 lines) + Backend export.
  - `EntityService.save / delete` accept `{skipAudit, sourceSurface, hard}`; auto-log create / update / restore / delete.
  - `ManuscriptChapterService.save / setChapterContent / createFromComposition` accept `{skipAudit}`; log chapter.save / chapter.create.
  - `ReviewService.resolve / resolveMany` accept `{skipAudit, createdEntityId, createdEntityType}`; log review.accept / .deny / .merge / .bulk-*.
  - `ReferencesService.save / delete` (new `delete` method) accept `{skipAudit}`; log reference.create / .update / .delete.
  - `OnboardingService.save / ProjectIntelService.save / SettingsService.saveSection` accept `{skipAudit}`; log onboarding.update / intel.update / settings.section-update.
  - `SampleProjectService.loadSample / clearSample / resetProjectData` auto-log sample.load (with relatedIds) / sample.clear / project.reset.
  - 5 new delegate handlers (`onUndoAuditEvent`, `onOpenAuditLog`, `onClearAuditLog`, `onExportAuditLog`, `onOpenRecentActivityItem`).
  - **Incidental fix:** `collectDefaultEntities()` prefers the boot-time `__LW_SAMPLE_SOURCES__` snapshot over live globals.
- `callback-registry.jsx` — 5 new names in `BACKEND_HANDLED`.
- `scripts/callback-names.json` + `callback-names-data.jsx` — 5 new names alphabetically.
- `home.jsx` — Recent Activity card reads from `AuditService.getRecentSync(10)`; renders Undo button for reversible events; empty-state row when log is empty; row click routes through `lw:open-search-result`.
- `scripts/smoke-services.js` — `[audit]` block (23 assertions).
- `tests/e2e/13-audit-undo.spec.js` — new spec, 6 tests.
- `AUDIT_UNDO_PLAN.md` — plan-first commit.
- `AUDIT_UNDO_REPORT.md` — this report.
- `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` — updated.

## Undoable actions

| Action | Undo behaviour |
|--------|----------------|
| `entity.create` | Soft-deletes created entity (sent to trash) |
| `entity.update` | Restores previous snapshot |
| `entity.delete` | Restores entity from before snapshot (purges trash entry) |
| `chapter.create` | Removes chapter |
| `chapter.save` | Restores previous chapter body / title |
| `chapter.delete` | Re-adds chapter from snapshot |
| `reference.create / update / delete` | Restores previous reference array slot |
| `onboarding.update / intel.update` | Restores previous section value |
| `settings.section-update` | Restores previous section value (redacted-but-still-meaningful) |
| `review.accept` | Reopens to pending; if accept created an entity, also deletes it |
| `review.deny` | Reopens to pending |
| `sample.load` | Removes only the entities/refs added by that event (preserves user records) |

## Audit-only actions (logged, not undoable)

`audit.undo` itself, `entity.merge` (too risky), `project.import` (use the backup),
`project.reset` (cannot reverse), `project.export / project.backup`,
`library.export / library.import`, `review.bulk-*` (logs the batch),
hard-delete-forever, provider tests (no state change), `sample.clear`.

## Redaction / privacy handling

- Reused module-scope `redactSecrets(obj)` + `SECRET_FIELDS` allowlist from earlier passes.
- Applied to every `before`, `after`, `patch`, and `metadata` field at log time.
- Smoke + e2e assertions confirm a fake `sk-ant-…` value set via `SettingsService.saveSection("aiProviders", {...})` produces an event with `after.apiKey === "[redacted]"` and never appears in either `loadSync()` or `exportSync()` output.
- `KEYS.auditLog` excluded from `ProjectArchiveService.buildExport()` (no risk of secrets propagating through exports).

## Status moves

In `PRODUCT_COMPLETION_AUDIT.md`:

> **Audit Log / Undo** — moves from "Out of scope this milestone" → **Implemented (for core safe local actions; audit-only for destructive/import/provider actions)** with smoke + e2e coverage and Home recent-activity surface live.

## Known gaps left for a future pass

- **Settings → Debug → Audit Log workspace** view, "Clear audit log" button, and "Export audit log" button. Service supports all three; the dedicated Settings panel surface is deferred to a UI-focused pass.
- **Toast Undo affordance** after each mutation — currently the undo button hangs off Home rows; integrating into the existing toast surface is a follow-up.
- **Per-entity history view** in the Entity Editor (events filtered by `targetType: "entity", targetId: …`) — `listByTargetSync` supports it; UI deferred.
- **Restore-from-backup helper** — `ProjectArchiveService.applyImport` already supports it, but a one-click "restore from last backup" affordance from the project.reset audit row could be useful.
- **Chapter save bodyHash diffing** for compact storage — full bodies are stored on the event today, which is fine within the 500-event cap but could be optimised.

## Whether Audit Log / Undo can move to Implemented

**Yes (partial — for core safe local actions; audit-only for destructive/import/provider actions).**

- `AuditService` exists and is exposed on `window.LoomwrightBackend`.
- Every meaningful mutation across `EntityService`, `ManuscriptChapterService`, `ReviewService`, `ReferencesService`, `OnboardingService`, `ProjectIntelService`, `SettingsService`, `SampleProjectService` creates an audit event automatically.
- Home Recent Activity displays real audit events from the live log.
- Undo works end-to-end for entity create / update / delete, chapter create / save / delete, reference create / update / delete, onboarding update, intel update, settings section update, review accept / deny, and sample load.
- Destructive actions (`project.reset`, `entity.merge`, full `project.import`, `library.import`, hard-delete-forever) are clearly marked audit-only via `canUndo === false`.
- API secrets are not logged (asserted twice in smoke + once in e2e).
- 23 smoke + 6 e2e assertions cover the contract.
- `npm run validate` clean; Bucket A still 0.
