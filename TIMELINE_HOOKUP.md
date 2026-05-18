# TIMELINE_HOOKUP.md

Timeline workspace — book order, chronological order, character / location / quest / faction timelines, review queue.

Orientation: vertical when panel is compact, horizontal when expanded.

---

## Data shapes

```ts
type TimelineEvent = {
  id: string;
  label: string;
  chapter: number | null;     // null = before/after the book
  era: "pre" | "ch" | "after" | string;
  date: string;               // human-readable: "Day 7" / "Year 738 of Hess"
  dateType: "exact" | "approx" | "before-after" | "flashback" | "future" | "unknown" | "conflict";
  confidence: "high" | "strong" | "uncertain" | "weak";
  canon: "hard" | "soft";
  entities: string[];         // cast ids
  locationId: string | null;
  quest: string | null;
  summary: string;
  flashback: boolean;
  source: string;             // citation
};

type TimelineEra = {
  id: string; label: string; color: string;
  from: number; to: number;   // ordinal positions for collapse / layout
};

type TimelineFilterState = {
  character: string[];
  location: string[];
  quest: string[];
  faction: string[];
};

type TimelineReviewQueueItem = {
  id: string; lvl: "high" | "strong" | "uncertain" | "weak";
  title: string; action: string;
  excerpt: string; cite: string;
};

type TimelineContradiction = {
  id: string;
  aEventId: string; bEventId: string | null;
  kind: "date-conflict" | "order-mismatch" | "flashback-detected" | "missing-timestamp";
  summary: string;
  suggestion: string;
};
```

---

## Modes

| Id            | Notes                                  |
|---------------|----------------------------------------|
| book          | Order by chapter ascending             |
| chronological | Order by canonical date                |
| character     | Lane per character; filter to involved |
| location      | Lane per location                      |
| quest         | Lane per quest                         |
| faction       | Lane per faction                       |
| review        | Queue cards                            |

---

## Orientation

```
panel.expanded === false  → vertical  (compact, drawer inspector)
panel.expanded === true   → horizontal (split-pane inspector)
```

When expanded, the grid becomes `grid-template-columns: 1fr 320px` and the inspector docks on the right. When compact the inspector slides up from the bottom (max 40% height).

---

## Callbacks

```
onCreateTimelineEvent(patch)
onEditTimelineEvent(id, patch)
onMoveTimelineEvent(id, toChapter)
onSetTimelineDate(id, date, dateType)
onMarkTimelineApproximate(id)
onMarkTimelineFlashback(id)

onFilterTimeline(filterState)
onZoomTimeline(level)
onCollapseEra(eraId)
onOpenTimelineSource({ chapter, page })
onShowTimelineMomentOnAtlas(eventId)

onAcceptTimelineQueueItem(id)
onEditTimelineQueueItem(id, patch)
onMergeTimelineQueueItem(id, targetEventId)
onDenyTimelineQueueItem(id)
```

---

## Cross-panel behaviour

Timeline selection updates the world snapshot:
- Atlas map state moves to that chapter (via overlayMode = "snapshot")
- Cast panel re-renders character state-at-time
- Quest / Event panels filter to that chapter
- Item ownership / location resets to that point

Implemented by broadcasting `{ type: "timeline", id: eventId, chapter, label }` to `focusedByType`.
