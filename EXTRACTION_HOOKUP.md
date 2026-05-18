# Loomwright — Extraction & Review Hook-up Notes

This document maps the presentational React surface to the backend events and
mutations Claude Code needs to wire up. All components are presentational —
state lives outside; every interactive element exposes a `data-callback` and a
named `on*` prop.

> **Convention.** Every mock data entry in `extraction-data.jsx` is tagged
> `_mock: true`. Strip those entries before shipping; or replace the four
> exports (`MOCK_QUEUE_ITEMS`, `MOCK_SESSIONS`, `MOCK_AUTOADDED`,
> `MOCK_OVERVIEW_COUNTS`) with backend-fed equivalents. `EXTRACTION_STAGES`
> is **not** mock — it is the canonical pipeline order.

---

## 1. Save & Extract → ExtractionProgressModal

**Trigger.** `SaveModeControls` in the canvas toolbar.
- `data-callback="onSaveAndExtract"` → quick sweep
- `data-callback="onSaveAndDeepExtract"` → deep sweep

**Component.** `ExtractionProgressModal` (in `extraction-progress.jsx`).

**Props the host owns:**
| Prop | Backend source |
| --- | --- |
| `open` | `extraction.session.status === "running"` |
| `mode` | `"quick" \| "deep"` |
| `stages` | Use `EXTRACTION_STAGES` constant (canonical order) |
| `currentStage` | Index into `stages` matching server's last `stage_complete` event |
| `chapterLabel` | `"Ch. " + n + " — " + title` |
| `progress` | Optional 0–1; component renders an indeterminate bar otherwise |

**Events to emit:**
- `onCancel()` → POST `extraction/cancel`. Server should mark the session
  `cancelled`, keep partial candidates in `pending`, and the UI hides the
  modal.
- `onContinueInBackground()` → just hide modal; session keeps running.
  Surface progress in the chapter-strip dot (`state: "extracting"`).
- `onOpenSession(session)` → opens `ExtractionSessionDrawer`.
- `onOpenReviewQueue()` → emits `onOpenReviewQueue` upward; host opens the
  global review queue panel.

**Failure path.** When the server emits `extraction.failed`:
- Set `progressFailed = true`. The Writers Room renders
  `ExtractionFailedState` (also in `extraction-progress.jsx`).
- `onRetry()` → POST `extraction/retry`. Resets stage to 0.
- `onClose()` → dismisses the failure overlay and clears session.

---

## 2. Status strip on chapters

`ChapterNode` (in `writers-room.jsx`) reads `chapter.state`:
| State | Meaning | Visual |
| --- | --- | --- |
| `unsaved` | Local edits not persisted | Amber dot |
| `saved` | Persisted, not yet extracted | Neutral |
| `extracting` | Server actively running | Pulsing blue dot |
| `extracted` | Last extraction complete | Green check dot |
| `error` | Last extraction failed | Red dot |
| `reserved` | Empty placeholder slot | Dashed |

Host should patch `state` on every save / extraction event.

---

## 3. Right-margin extraction cards

**Component.** `MarginExtractionCard` (in `writers-room.jsx`) — the slim
suggestion shown during/after extraction. **Different from**
`ReviewQueueCard` which lives in the review queue panel.

**Props.** `ext` shape:
```ts
{
  id, type: EntityTypeId, conf: "high"|"strong"|"uncertain"|"weak",
  pct: number, name: string, summary: string, quote: string, anchor: string,
  merge?: boolean,
}
```

**Callbacks (already wired in WritersRoomScreen):**
- `onAcceptQueueItem(item)` → POST `queue/accept`
- `onEditQueueItem(item)` → opens `EditCandidateModal`
- `onMergeQueueItem(item)` → opens `MergeCandidateModal`
- `onDenyQueueItem(item)` → opens `DenyConfirmation`

The shell **normalizes** margin-card shape into queue-item shape before
opening modals. Backend should ideally supply both shapes, or compute one
from the other.

---

## 4. EntityReviewQueue (panel body)

**Component.** `EntityReviewQueue` (in `review-queue.jsx`).

Mounted inside whichever panel currently displays the queue (likely
`panels.jsx` review-queue panel kind). Owns its filter bar, bulk strip, list
body, and the auto-added collapsible.

**Required props:**
- `entityType: EntityTypeId`
- `items: QueueItem[]` (see shape in `extraction-data.jsx` header)
- `autoAdded: AutoAddedItem[]`
- `chapters: { id, num, title }[]`
- `sessions: { id }[]`
- `state: "default" | "loading" | "error" | "empty"`
- `filters` + `setFilters` — controlled. Keys: `query, confidence, status,
  chapter, session, sortBy, view`.
- `selectedIds` + `setSelectedIds` for bulk actions.

**Callbacks (POST these to the backend):**
- `onAcceptQueueItem(item)` → adds to dossier as a confirmed entity.
- `onEditQueueItem(item)` → opens edit modal; backend gets PATCH on save.
- `onMergeQueueItem(item)` → opens merge modal; backend gets POST `queue/merge`.
- `onDenyQueueItem(item)` → POST `queue/deny`. Item moves to history.
- `onBulkAcceptQueueItems(ids)` / `onBulkDenyQueueItems(ids)` /
  `onBulkMergeQueueItems(ids)` — bulk endpoints.
- `onOpenSourceInManuscript(item)` → host scrolls Writers Room to
  `item.sourceChapter.id` + `item.sourceParagraph` and highlights the mention.
- `onOpenRelatedTab(item)` → opens entity dossier (existing entity-detail flow).
- `onKeepAutoAddedItem(item)` / `onRemoveAutoAddedItem(item)` — for the
  auto-added (blue) section. Keep marks it permanent; remove undoes the
  auto-add and moves the candidate back into pending.

---

## 5. GlobalReviewOverview

**Component.** `GlobalReviewOverview` (in `review-overview.jsx`).

Renders a grid of cards, one per entity type, plus a session list. Used as
the landing view of the review queue panel before drilling into a specific
type.

**Props:**
- `counts` — shape matches `MOCK_OVERVIEW_COUNTS`. Backend should aggregate
  per-entity totals + per-band counts.
- `sessions` — recent extraction sessions (history list).
- `autoAdded` — recent auto-added items, surfaced under each card.

**Callbacks:**
- `onOpenEntityQueue(entityType)` — host swaps the panel body to
  `EntityReviewQueue` filtered to that type.
- `onOpenSession(session)` — opens `ExtractionSessionDrawer`.
- `onRerunExtraction()` — POST `extraction/start` for the active chapter.

---

## 6. Modals

| Component | Trigger | Backend on confirm |
| --- | --- | --- |
| `MergeCandidateModal` | onMergeQueueItem | POST `queue/merge` `{candidateId, targetEntityId}` |
| `EditCandidateModal` | onEditQueueItem | PATCH `queue/{id}` with edited fields, then POST `queue/accept` if user clicked "Accept edited version" |
| `DenyConfirmation` | onDenyQueueItem | POST `queue/deny` `{candidateId}` |

`MergeCandidateModal` expects `alternatives: { id, name, confidence,
summary, aliases }[]`. The host fetches these via a `queue/match` lookup.

---

## 7. Auto-added (blue) items

Items the system added to canon automatically (confidence ≥ ~95) but kept
reviewable. Two surfaces:

1. **In the queue panel** — bottom collapsible (`AutoAddedHistoryCard`).
2. **In overview cards** — small "X auto-added" stat under each entity card.

Backend should not delete these unless `onRemoveAutoAddedItem` fires.
Default lifetime: 30 days, after which they age out of the reviewable list.

---

## 8. Tweaks (already wired)

The `Tweaks` panel exposes (look in `app.jsx`):
- `extractionDefault` — `quick` | `deep`
- `autoAcceptThreshold` — slider 80–99 — confidence above which the server
  should auto-add (blue items)
- `confidenceColors` — palette for the four bands
- `extractionEvents` — toggle to show/hide the right-margin extraction stream
- `bulkActionsEnabled` — show/hide the bulk strip in `EntityReviewQueue`

---

## 9. Component → File map (quick reference)

| Component | File |
| --- | --- |
| `ExtractionProgressModal`, `ExtractionFailedState` | `extraction-progress.jsx` |
| `ExtractionSessionDrawer` | `extraction-session.jsx` |
| `GlobalReviewOverview` | `review-overview.jsx` |
| `EntityReviewQueue`, `ReviewQueueCard`, `AutoAddedHistoryCard`, `QueueFilterBar`, `QueueBulkActions` | `review-queue.jsx` |
| `MergeCandidateModal`, `EditCandidateModal`, `DenyConfirmation` | `review-modals.jsx` |
| `MarginExtractionCard`, `SaveModeControls`, `ChapterNode` | `writers-room.jsx` |
| Mock data + canonical `EXTRACTION_STAGES` | `extraction-data.jsx` |
| Styles | `extraction-review.css` |
