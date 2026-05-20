# Audit Log / Undo Pass — Plan

_Created: 2026-05-20, on branch `claude/audit-undo-pass`
(started from `main` post-PR-#10)._

## Scope

Add change history and recovery: a real `AuditService` that records
every meaningful local mutation, surfaces recent activity on Home, and
lets the user undo safe actions. No UI redesign, no Git-like
versioning, no collaborative or cloud sync.

## Current state audit

| Surface | Today | Real? |
|---------|-------|-------|
| `home.jsx` Recent Activity card | Renders a hard-coded `HOME_RECENT_ACTIVITY` array of 6 sample rows | ❌ — pure mock |
| Per-service mutations (`EntityService.save / delete`, `ReviewService.resolve`, `ManuscriptChapterService.save`, `ReferencesService`, `OnboardingService`, `ProjectIntelService`, `SettingsService`, `SampleProjectService`, `ProjectArchiveService`, `SkillTreeService`, `TangleService`) | All write to storage but emit no audit record | ❌ |
| `OnboardingService.undoLast` (intel panel) | Single-section undo via `onUndoLastIntel` callback; React-local | ✅ at panel scope only |
| `TrashService.restore` | Soft-delete recovery via Trash UI | ✅ at panel scope only |
| `KEYS.auditLog` | Does not exist | ❌ |
| `AuditService` | Does not exist | ❌ |
| Undo toast / affordance per action | None | ❌ |

**Bottom line:** the data model has no history, the Home card is a
mock, and undo exists only for one localised intel-panel action. The
fix is a new persistent service plus careful integration at the
mutation sites that matter.

## Storage / service ownership

| Concern | Owner | Storage |
|---------|-------|---------|
| Persistent audit log | New `AuditService` | `KEYS.auditLog = "audit_log"` |
| Before/after snapshots | Same blob, on the event itself | same |
| Soft-deleted entities (existing) | `TrashService` (unchanged) | `KEYS.trash` |
| Undone-marker on events | Same blob | same |

`KEYS.auditLog` is **not** added to `ProjectArchiveService.buildExport()`
since the log can be derived from history of mutations and including
it would defeat the secret-redaction model in the live store.

## `AuditService` design

```js
AuditService = {
  defaultState()            → { events: [], updatedAt: null }
  loadSync()                → cached events from KEYS.auditLog
  save(state)               → persist
  listSync(options)         → filtered + sorted desc by createdAt
  getSync(id)               → event by id
  getRecentSync(limit=10)   → most recent N events (after filter)
  listByTargetSync(targetType, targetId)
  log(event)                → push event, persist, dispatch lw:audit-log-updated
  markUndone(eventId, undoEventId)
                            → flips event.undone=true, records pointer to the undo event
  canUndo(eventId)          → boolean — based on undoType, undone flag, age, reversibility
  undo(eventId)             → reverses the action and logs a sibling event with
                              undoType="undo-of"; throws if !canUndo
  clear()                   → wipes the log (Settings/Debug button only)
  exportSync()              → redacted JSON export
}
```

### Event shape (canonical)

```jsonc
{
  "id":            "aud-...",
  "projectId":     "default",
  "action":        "entity.create" | "entity.update" | "entity.delete" |
                   "entity.restore" | "entity.merge" |
                   "chapter.create" | "chapter.save" | "chapter.delete" |
                   "review.accept" | "review.deny" | "review.merge" |
                   "review.bulk-accept" | "review.bulk-deny" |
                   "reference.create" | "reference.update" | "reference.delete" |
                   "onboarding.update" | "intel.update" |
                   "settings.update" | "settings.section-update" |
                   "sample.load" | "sample.clear" | "project.reset" |
                   "project.export" | "project.import" | "project.backup" |
                   "library.export" | "library.import" |
                   "atlas.update" | "skill-tree.update" |
                   "tangle.update" | "speed-reader.session-created" |
                   "speed-reader.bookmark" | "speed-reader.session-completed" |
                   "occurrence.create" | "occurrence.stale" |
                   "merge.entities" | "audit.undo",
  "label":         "Created Hess Vaela",
  "targetType":    "entity" | "chapter" | "review" | "reference" |
                   "settings" | "intel" | "onboarding" | "project" | ...,
  "targetId":      "cast-abc",
  "targetName":    "Hess Vaela",
  "entityType":    "cast",                  // for entity actions
  "before":        <redacted snapshot>,     // null if no previous state
  "after":         <redacted snapshot>,     // null if delete
  "patch":         null,                    // optional small-diff form
  "source":        "EntityService" | "ReviewService" | ... | "user",
  "sourceSurface": "entity-editor" | "review-modal" | "writers-room" |
                   "home" | "settings" | null,
  "reversible":    true | false,            // matches undoType availability
  "undoType":      "restore-snapshot" | "reapply-patch" |
                   "delete-created" | "restore-deleted" |
                   "remove-sample-tagged" | null,
  "relatedIds":    [...],                   // e.g. mergedFromId, occurrenceIds
  "metadata":      { ... },
  "undone":        false,
  "undoneAt":      null,
  "undoneByEventId": null,
  "createdAt":     "iso"
}
```

### Undo table (what is reversible vs audit-only)

| Action | Undoable? | Mechanism |
|--------|-----------|-----------|
| `entity.create` | ✅ | `EntityService.delete(type, id, {skipAudit:true})` |
| `entity.update` | ✅ | `EntityService.save(type, before, {skipAudit:true})` |
| `entity.delete` (soft) | ✅ | `TrashService.restore(id, {skipAudit:true})` or `EntityService.save(type, before)` |
| `chapter.create` | ✅ | Delete the chapter |
| `chapter.save` | ✅ | Restore previous chapter body / title from `before` |
| `chapter.delete` | ✅ | Restore from before snapshot |
| `reference.create / update / delete` | ✅ | Restore previous reference array slot |
| `onboarding.update` | ✅ | Restore previous section value |
| `intel.update` | ✅ | Restore previous intel snapshot |
| `settings.section-update` | ✅ | Restore previous section value (redacted before is still meaningful for non-secret fields) |
| `review.accept` | Partial | Reverts the entity write where a `before` exists; reopens the review item as `status: "pending"` |
| `review.deny` | Partial | Reopens review item as pending |
| `sample.load` | ✅ | Removes records tagged `source: "sample"` added by that event |
| `entity.merge` | **Audit only** | Source/target snapshots stored; restoration is too risky for this pass |
| `project.import (replace)` | **Audit only** | User must use the backup that ProjectArchiveService downloaded |
| `project.import (merge)` | **Audit only** | Too many cross-cutting effects to safely reverse |
| `project.reset` | **Audit only** | Cannot reverse (storage cleared) |
| `entity.delete forever` (TrashService.purge) | **Audit only** | Cannot reverse |
| Provider test / export / AI calls | **Audit only** | No effective state change to reverse |
| `speed-reader.*` | **Audit only** | Too noisy / low value for undo |

`canUndo(eventId)` returns `false` for any event whose `undoType` is
`null`, whose `undone` is already `true`, or whose action is in the
audit-only list above.

### Anti-recursion

Every internal write triggered by `AuditService.undo()` calls the
underlying service with `{ skipAudit: true }`. Services check this flag
before logging. This prevents an undo from generating its own
mutate-event (the undo itself is logged separately as a single
`audit.undo` event pointing back at the original).

### Redaction

Reuse existing `redactSecrets(obj)` from `ProjectArchiveService` (already
exported via the `backend-services.jsx` IIFE — promoted to module
scope in this pass so `AuditService.log` can call it). Every
`before` and `after` snapshot passes through `redactSecrets`. The
`SECRET_FIELDS` allowlist (`apiKey, secret, token, password, bearer,
credential`) catches deep-nested keys.

The `KEYS.apiKeys` encrypted blob is never read into any audit event —
it's not a target of any mutation that gets logged.

For chapter bodies, store `bodyHash + first 240 chars` in `before/after`
rather than the full chapter text, to keep log size bounded. Undo
still works by storing the *full* previous `bodyText/bodyHtml` in the
event's `before.full` field (one event, not every keystroke — chapter
save is event-shaped).

## UI surfacing

### Home (`home.jsx`)

Replace `HOME_RECENT_ACTIVITY` with live data from
`AuditService.getRecentSync(10)`. Each row carries:
- Action label (`event.label`)
- When (relative time formatted from `event.createdAt`)
- Kind dot (existing CSS classes: `chapter / extraction / entity / panel`) chosen from `event.action`
- Undo button when `canUndo(event.id)` — dispatches `lw:undo-audit-event` with `{eventId}`

If the log is empty, show an empty-state row ("Activity will appear here as you work.").

### Settings / Debug

Add a tiny "Recent activity" section to Settings → Debug (or Tweaks)
with:
- List of last 25 events
- "Clear audit log" button (double-confirmed)
- "Export audit log (JSON)" button → downloads redacted log

No new full-screen workspace.

### Toast affordances

When a mutation logs an event with `canUndo:true`, dispatch
`lw:backend-notice` with `{ message, undoEventId }`. The existing
toast surface (if it carries `undoEventId`) shows an "Undo" button.
For this pass we keep the existing toast rendering — the message
includes the action label and the undo affordance hangs off the same
`onUndoAuditEvent` callback dispatched from Home / Settings.

## New callbacks

Five new callback names:

- `onUndoAuditEvent`        — backend-handled: undoes the event by id
- `onOpenAuditLog`          — opens Settings → Debug → Audit Log
- `onClearAuditLog`         — backend-handled: clears the log (confirm)
- `onExportAuditLog`        — backend-handled: downloads redacted JSON
- `onOpenRecentActivityItem` — alias for `onOpenRecentEntity` semantics; opens the entity / chapter / reference the event points at

All in `scripts/callback-names.json`, `callback-names-data.jsx`, and
`BACKEND_HANDLED` in `callback-registry.jsx`. Bucket A stays 0.

## Integration sites

The following services gain inline `AuditService.log({...})` calls
**after** the storage write succeeds, with `before` captured from the
pre-write `getSync`:

| Service | Method | Action |
|---------|--------|--------|
| `EntityService` | `save` (create vs update detected by `previous` existence) | `entity.create` / `entity.update` |
| `EntityService` | `delete` | `entity.delete` |
| `TrashService` | `restore` | `entity.restore` |
| `ManuscriptChapterService` | `createFromComposition` | `chapter.create` |
| `ManuscriptChapterService` | `setChapterContent` | `chapter.save` |
| `ReviewService` | `resolve` (status decides accept/deny/merge) | `review.accept` / `review.deny` / `review.merge` |
| `ReviewService` | `resolveMany` | `review.bulk-*` |
| `ReferencesService` | `save` / `update` / `delete` | `reference.create` / `.update` / `.delete` |
| `OnboardingService` | `save` | `onboarding.update` (per section) |
| `ProjectIntelService` | `save` | `intel.update` |
| `SettingsService` | `saveSection` | `settings.section-update` (with `before` redacted) |
| `SampleProjectService` | `loadSample` | `sample.load` (with `relatedIds` = added record ids) |
| `SampleProjectService` | `clearSample` | `sample.clear` |
| `SampleProjectService` | `resetProjectData` | `project.reset` |
| `ProjectArchiveService` | `downloadProjectExport` | `project.export` |
| `ProjectArchiveService` | `applyImport` | `project.import` |
| `ProjectArchiveService` | `createBackupBeforeReplace` | `project.backup` |
| `ProjectArchiveService` | `downloadEntityLibrary` / `applyEntityLibrary` | `library.export` / `library.import` |
| `LinkService` | `mergeEntities` | `entity.merge` (audit-only) |
| `SkillTreeService` | major writes (addTree / removeTree / addNode / removeNode) | `skill-tree.update` |
| `TangleService` | major writes (addNode / removeNode / addGroup) | `tangle.update` |
| `SpeedReaderService` | `createSession` / `addBookmark` / `markComplete` | `speed-reader.session-created` / `.bookmark` / `.session-completed` |

**Excluded** (intentionally not logged to avoid noise):
- `SearchService` rebuilds
- `OccurrenceService.save` for individual mentions (chapter save covers it)
- `SpeedReaderService.setProgress / setSettings / updateSession`
- `LinkService.appendField` (covered by the parent entity.update)
- Provider key tests (status only, no state change — but emits a single `settings.section-update` if provider settings change)

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[audit]` block (~18 assertions)

- `AuditService` exposed on Backend
- `defaultState` is empty
- `log()` persists across reload
- Entity create → `entity.create` event with after snapshot
- Entity update → `entity.update` event with before + after
- Entity delete → `entity.delete` event with before
- `getRecentSync(5)` returns 5 most recent
- `listByTargetSync` filters by target
- `canUndo("entity.create")` returns true; `canUndo("project.reset")` returns false
- `undo("entity.create")` deletes the entity AND records an `audit.undo` event AND marks original `undone:true`
- `undo("entity.update")` restores `before` snapshot
- `undo("entity.delete")` restores entity via TrashService path
- `undo` twice on same event throws (canUndo:false after first undo)
- API key set in settings → settings.update event → before/after redacted
- `redactSecrets` strips nested apiKey from `before`
- `exportSync()` redacted output never contains the secret value
- `clear()` empties the log
- `sample.load` event has `relatedIds` with the ids tagged "sample"

### E2E (`tests/e2e/13-audit-undo.spec.js`) — 6 tests

1. Create entity → `AuditService.getRecentSync(1)[0]` has the right action + label + entityId.
2. Edit entity → undo restores old name.
3. Delete entity → undo restores entity (TrashService path).
4. Review accept → audit entry appears with action `review.accept`.
5. Settings update with fake apiKey → audit log contains the event but never the secret value.
6. Sample load → recent activity shows it → user-created records survive sample clear.

## Out of scope (strict)

- No collaborative history / multi-user conflict resolution
- No cloud sync of audit logs
- No real-time merge conflict UI
- No full Git-like versioning
- No complete manuscript diff engine
- No production build pipeline
- No new major UI design
- No multi-provider AI routing
- No extraction / field-parity / project-import-export / search /
  Speed Reader changes beyond bug fixes surfaced while testing

## Commit plan

1. `AUDIT_UNDO_PLAN.md` (this commit, no code).
2. `AuditService` + `KEYS.auditLog` + `redactSecrets` promotion +
   Backend export. **`{skipAudit:true}` flag** propagated through
   `EntityService.save / delete`, `TrashService.restore`,
   `ManuscriptChapterService.{save, createFromComposition, setChapterContent}`,
   `ReviewService.resolve / resolveMany`, `ReferencesService.{save,update,delete}`,
   `OnboardingService.save`, `ProjectIntelService.save`,
   `SettingsService.saveSection`, `SampleProjectService.*`,
   `ProjectArchiveService.*`, `LinkService.mergeEntities`,
   `SkillTreeService.*`, `TangleService.*`,
   `SpeedReaderService.{createSession, addBookmark, markComplete}`.
3. Five new callbacks (`onUndoAuditEvent`, `onOpenAuditLog`,
   `onClearAuditLog`, `onExportAuditLog`,
   `onOpenRecentActivityItem`) registered in names + registry +
   delegate handlers.
4. `home.jsx` Recent Activity card reads from
   `AuditService.getRecentSync(10)` with undo affordance for
   reversible events. Sample fallback used only when log is empty.
5. Smoke harness `[audit]` block.
6. New `tests/e2e/13-audit-undo.spec.js`.
7. Docs: `AUDIT_UNDO_REPORT.md`,
   `PRODUCT_COMPLETION_AUDIT.md`, `FINAL_QA_REPORT.md`.

Each step verified with `npm run validate` + `npm run test:smoke`.
Full `npm run test:e2e` at the end.

## Acceptance bar

- `npm run validate` passes (Bucket A stays 0).
- `npm run test:smoke` adds ~18 new assertions, all pass.
- `npm run test:e2e` adds 6 specs, all pass; existing 63 still pass.
- Home Recent Activity displays real audit events from the live store.
- Undo works end-to-end for entity create / update / delete and
  review accept.
- API secrets never appear in audit log entries or exports
  (asserted twice — fake apiKey value + encrypted blob).
- Audit Log / Undo moves from "Out of scope this milestone" →
  **Implemented** in `PRODUCT_COMPLETION_AUDIT.md`.
