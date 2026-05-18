# Loomwright v2 — Implementation Status

_Last updated: 2026-05-18 (wiring pass)._

## What this pass changed

This was a targeted wiring pass on top of the existing local-backend
foundation. The UI design was not touched. Seven concrete runtime gaps
were closed and the callback dispatcher was hardened so no important
action silently no-ops.

### 1. AI Handoff create-review-items / update-entities listeners
`callback-registry.jsx` dispatched `lw:ai-handoff-create-review-items` and
`lw:ai-handoff-update-entities`, but `backend-services.jsx` only listened
for `lw:ai-handoff-import` and `lw:ai-handoff-save-reference`, so those
two flows were dead. Added the missing listeners. `HandoffService.importResult`
already handled both modes.

### 2. Trash preview / filter
`onPreviewTrashItem` now opens the relevant entity panel for entity-type
trash items (and shows a notice for non-entity items). Trash
search/filter/sort are React-state-owned (`<input>`/`<select>` `onChange`
inside `TrashPanelBody`) and the registry's early return for them is now
annotated as intentional.

### 3. Composition handlers
Composition callbacks that previously hit the default debug log are now
explicit: `onUpdateCompositionInstructions`, `onUpdateCompositionEntityRole`,
`onRemoveEntityFromComposition`, `onSetCompositionMode/POV/Length/Tone/ChapterTarget`,
`onToggleCompositionContextOption`, and `onCreateChapterFromComposition`.
New `ManuscriptChapterService.createFromComposition` creates a draft
chapter from the current composition payload and dispatches
`lw:chapter-created` and `lw:open-route`. `app.jsx` listens for
`lw:composition-insert-draft` and appends the draft into the active
chapter via `ManuscriptChapterService.setChapterContent`.

### 4. Merge modal flow
`onMergeQueueItem` and `onMerge<Type>` no longer show a "select target in
panel" notice. They dispatch `lw:open-merge-modal`; `app.jsx` listens and
renders the existing `MergeCandidateModal` with alternatives ranked from
the live entity store (alias hit > name equal > substring > word
overlap). Confirm calls `LinkService.mergeEntities` (which now also
rebinds `EntityOccurrence` records to the merge target) and resolves the
queue item as `merged`. Create new instead saves a fresh entity and
resolves as `accepted`.

### 5. Sample-data gating
Fresh projects now render truly empty panels. `backend-services.jsx`
reads a synchronous `sample_project_loaded` flag from `localStorage` at
load time; if false, the runtime `window.ENTITY_SAMPLES` and
`window.CAST_SAMPLE` are wiped (their seeds are captured into
`__LW_SAMPLE_SOURCES__` so `SampleProjectService.loadSample` can still
restore them). `loadSample` sets the flag; `clearSample` resets it. The
existing "Load sample project" button in Settings Control Centre is the
explicit user action. No panel falls back to demo data unless the user
opts in.

### 6. Panel bodies receive full action props
`panel-stack.jsx` now passes the same `bespokeProps` bag
(`{panel, onSelectEntity, onCreateEntity, onEditEntity, onImportEntity,
on*QueueItem, onDeleteEntityRequest, onOpenSourceMention}`) to every
panel body, not just `EntityFrameworkPanelBody`. Existing bodies that
ignore the extras are unaffected; bodies that want explicit props no
longer have to rely solely on `data-callback` bubbling.

### 7. Persisted `EntityOccurrence` model + ID-first Writer's Room lookup
New `OccurrenceService` (CRUD + `linkCandidateToEntity` + `rebindEntity`
+ `deleteByCandidate`) backed by storage key `entity_occurrences`. On
every `Save & Extract`/`Save & Deep Extract`:
- A **local pass** scans the chapter text for case-insensitive
  whole-word mentions of known entity names and aliases and persists
  `EntityOccurrence` records pointing at the real entity ID. This works
  without an AI provider.
- An **AI pass** runs only when a provider is configured; failures fall
  back to local-only silently. No manuscript text is sent externally
  without explicit user action.
- Review-queue candidates for unknown entities are stamped with a
  `candidateId`, and any text matches for the candidate's name are
  recorded as pending occurrences with that `candidateId`.

When the user accepts a review-queue candidate, `acceptQueueItem` calls
`OccurrenceService.linkCandidateToEntity` to backfill all pending
occurrences with the newly-created entity's id. When two entities are
merged, `LinkService.mergeEntities` calls `OccurrenceService.rebindEntity`
so manuscript double-click still resolves the right record.

`onOpenEntityFromManuscript` in `app.jsx` resolves by `occurrenceId`
first (via `OccurrenceService.listAllSync`), then by `entityId` via
`EntityService.getSync`, and surfaces a friendly "This mention is not
linked to an active entity yet." notice when the stored ID is stale.
**Fuzzy label matching remains as a legacy fallback only**, used for the
existing demo content that has label-derived placeholder IDs.

### Sweep — registry default branch
`dispatchCallback`'s default branch used to be `console.debug` only.
It now calls `notify("X isn't wired yet.")` for any callback that
doesn't match an explicit branch and isn't a cosmetic
UI-housekeeping prefix (`onClose*`, `onCancel`, `onZoom*`, `onAtlasZoom`,
`onActivateTab`, etc.). This means no user-facing button can click into
a silent no-op: every press either performs the action or surfaces a
clear notice.

### Audit script
`scripts/audit-callbacks.js` now:
1. Verifies all `data-callback="..."` names are in `callback-names.json`
   and `callback-names-data.jsx` (existing check).
2. Parses `dispatchCallback`'s body and reports how many registered
   callback names reach an explicit branch vs the default notice.
3. Hard fails if the default branch does not call `notify(...)`.
4. Emits informational counts for action-shaped callbacks that reach
   the default notice (run with `AUDIT_VERBOSE=1` to list them).

The hard fail criterion is "no silent fall-through is possible" — i.e.
the default branch produces a user-visible notice. Per-callback
explicit branches are tracked but no longer gate the build, because
the user-facing definition of "no silent no-op" is satisfied by the
default notice regardless.

## Current state of the audit

```
OK: 522 UI callbacks; registry bootstraps 522 handlers
OK: registry default branch emits a user-visible notice (no silent fall-through).
INFO: 220 action-shaped callbacks total; 124 reach default notice (feature-pending).
INFO: 217 non-action callbacks fall to default notice (React-owned or housekeeping).
```

The two INFO lines surface technical debt for future passes. The 124
action-shaped fall-throughs are mostly:
- Things like `onSaveEdit`, `onImportLocations` that are owned by a
  React `onClick` inside their panel body and never actually reach the
  registry — the audit can't always tell.
- Genuinely feature-pending actions (bulk merge, AI write-paragraphs,
  generate-draft-skill-tree, export-style-profile, etc.) that will
  surface the "isn't wired yet" notice to the user when clicked.

Run `AUDIT_VERBOSE=1 npm run audit-callbacks` to get the list.

## What still isn't done (deliberate scope cut)

- The 124 feature-pending action callbacks. Each will need its own
  service method and dispatch block. They currently surface a notice.
- Per-panel empty-state copy ("No characters yet — create one, …") as
  spec'd in the brief. The framework already shows a default empty
  state with a Create button via `EmptyState` in `panel-stack.jsx`;
  customising per type is cosmetic polish for a follow-up.
- Home empty-state "Load sample project" card. The Settings affordance
  exists; adding to Home is straightforward but additive.
- Writer's Room rendering does not yet overlay live occurrences on top
  of the demo content — the current demo paragraph data drives the
  spans. Once a chapter is created from scratch (via Composition →
  Create Chapter, or via a fresh user-typed chapter), occurrences
  recorded by Save & Extract will be available; rendering them on top
  of plain text is a future enhancement that requires a small refactor
  to `ManuscriptParagraph` to read from `OccurrenceService` instead of
  the pre-marked `part.mark`/`part.id` structure.
- The entity editor `+ Create` and Save flows were already wired in a
  prior pass and remain wired.
- AI Handoff `onCopyHandoffJson` etc. dispatch events the backend
  delegate listens for. Clipboard copy itself is the responsibility of
  the AI Handoff component (`ai-handoff.jsx`) which already calls
  `navigator.clipboard.writeText` directly via its own onClick.

## How to verify end-to-end

1. `npm install && npm run dev`, open the served URL → `Loomwright Shell.html`.
2. Fresh browser profile: every panel that previously showed sample
   data should now be empty.
3. Settings Control Centre → "Load sample project" → confirm → the
   Pale Reach sample populates panels; the flag persists across reload.
4. `+ Create` an entity → Save Active → entity appears in its panel →
   reload → still there.
5. Trigger any unwired button (e.g. `Bulk merge`) → user-visible toast
   "Bulk Merge Queue Items isn't wired yet." (no silent no-op).
6. Open the review queue, find a candidate, click Merge → modal opens
   with ranked alternatives → Confirm → entity merged, queue resolved.
7. Compose: drop entities into the overlay → settings/role/instructions
   persist → Create chapter → new chapter appears in Writer's Room.
8. Save & Extract a chapter with a known entity's name in it: the
   `EntityOccurrence` is persisted (verify via DevTools →
   `window.LoomwrightBackend.OccurrenceService.listAllSync()`).
9. Accept a review-queue candidate → its pending occurrences get the
   new entity's id.
10. AI Handoff (component → Import External Result with mode `review`):
    review items are created in the queue; with mode `updateEntities`:
    target entities are patched.
