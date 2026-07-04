# Entity Tab Framework — Hook-up Notes

The shared entity tab framework lives in:

- `entity-framework.jsx` — small components (cards, header, sections, context panel, review queue, drag chip, drop zone, merge modal)
- `entity-framework-shell.jsx` — `EntityRoster` + `EntityTabShell` orchestrator
- `entity-framework.css` — all `.ent-*` styles
- `entity-data.jsx` — sample placeholder data (drop in real data via `panel.entities` etc.)

`SlidingPanel` (in `panels.jsx`) auto-routes any `entityType` in the
`FRAMEWORK_TYPES` set through `EntityTabShell`. The bespoke Cast panel
is unchanged.

---

## Generic entity object shape

```ts
type Entity = {
  id: string;                 // stable
  type: EntityType;           // "bestiary" | "locations" | ... (drives accent colour)
  name: string;
  glyphChar?: string;         // 2-letter monogram override (else derived)
  status?: "active" | "archived" | "alive" | "dead" | "missing" | "unknown";
  subtitle?: string;          // single-line role / kind / role-line
  summary?: string;           // longer paragraph for detail
  aliases?: string[];
  chapterRange?: string;      // e.g. "Ch. 1–7"
  mentionsByChapter?: number[]; // sparkline data
  queue?: number;             // count of review items pending on THIS entity
  fields?: { k: string; v: string }[];        // tabular detail
  editFields?: { k: string; v: string; multi?: boolean }[]; // edit mode override
  related?: RelatedEntity[];
  mentions?: SourceMention[];
  linkedChapters?: { id: string; label: string }[];
  references?: string[];
  notes?: string;
  warnings?: string[];        // surface in context panel
  recent?: { when: string; what: string }[];
};
```

## Section shape (for custom detailRender)

```ts
type EntityDetailSection = {
  title: string;
  action?: { label: string; onClick: () => void; callback?: string };
};
```

## Source mention shape

```ts
type SourceMention = {
  id: string;
  excerpt: string;            // already-quoted prose snippet
  cite: string;               // "Ch. 3, p. 76"
};
```

## Related entity shape

```ts
type RelatedEntity = {
  id: string;
  type: EntityType;           // drives the related pill colour
  name: string;
  kind?: string;              // optional relationship label, e.g. "rival"
  initials?: string;
};
```

---

## Entity review queue connection

Each entity tab receives `reviewItems: ReviewItem[]`:

```ts
type ReviewItem = {
  id: string;
  name: string;               // the proposed entity name
  action?: string;            // "New entry" | "Merge?" | etc.
  level: "high" | "strong" | "uncertain" | "weak"; // confidence band
  value: number;              // 0–100 numeric confidence
  excerpt: string;            // source quote
  cite: string;               // citation
  reason: string;             // why the queue surfaced it
};
```

`EntityTabShell` shows the top two items in the right-rail context
panel and exposes a "All →" link that switches the tab into Review
mode (`mode="review"`). All four queue actions are fired by name:

- `onAcceptQueueItem(item)`
- `onEditQueueItem(item)`
- `onMergeQueueItem(item)`
- `onDenyQueueItem(item)`

The same items also drive any `q-badge` (review count badge) shown in
the panel header, the roster toolbar, and per-row.

---

## Mode dispatch

`EntityTabShell` derives its mode automatically from props:

| When                            | Mode         |
|---------------------------------|--------------|
| `panel.state === "loading"`     | loading      |
| `panel.state === "error"`       | error        |
| `entities.length === 0`         | empty        |
| `compareEntities.length >= 2`   | compare      |
| `multiEntities.length > 0`      | multi        |
| `selectedEntity` set            | selected     |
| `panel.state === "review"`      | review       |
| `panel.state === "suggestion"`  | suggestive   |
| else                            | overview     |

Pass `mode="..."` explicitly to override.

---

## Callbacks (every interactive element)

All wired through `EntityTabShell` props; every button carries
`data-callback="<name>"` for test/automation:

`onCreateEntity`, `onImportEntity`, `onSelectEntity`, `onEditEntity`,
`onDeleteEntityRequest`, `onMergeEntity`, `onDropEntity`,
`onDragStartEntity`, `onOpenRelatedTab`, `onOpenSourceMention`,
`onOpenEntityReviewQueue`, `onAcceptQueueItem`, `onEditQueueItem`,
`onMergeQueueItem`, `onDenyQueueItem`, `onRunEntitySuggestion`,
`onCompareEntities`, `onExitCompare`, `onSearchChange`,
`onFilterChange`, `onSortChange`, `onViewChange`, `onGroupByChange`,
`onToggleMulti`, `onEnterMultiMode`, `onExitMultiMode`,
`onBackToOverview`, `onRetry`.

---

## Mobile collapse note

- Roster collapses above the body on `<= 760px` — bordered with a
  dashed underline rather than a side rail.
- Right-rail context panel folds back into the body sections (the
  warning, queue, suggestions, related, snippets, recent blocks
  already exist inline in the detail body).
- Bulk action bar becomes a sticky bottom sheet (apply via your shell's
  drawer system).
- Adaptive wheel opens on long-press of any roster row (wire via your
  long-press handler around `EntityRosterCard`).

---

## Slotting type-specific detail

Pass `detailRender={(entity) => <YourTypeBody entity={entity}/>}` to
`EntityTabShell` to replace the generic Summary / Fields / Linked
chapters / Related / Mentions / Notes / References stack with
type-specific UI (e.g. a Skill-Tree branch view, a Faction allegiance
graph, a Timeline ribbon). The header, actions row, context panel,
and review queue all stay shared.
