# Area 5 — Timeline goes live: completion & audit reference

_Status: implemented, ready for audit._

The Timeline workspace (`timeline.jsx`) was entirely demo-driven — every view
read the `TL_EVENTS` / `TL_ERAS` / `TL_REVIEW` constants and `window.ATLAS_CAST`
/ `ATLAS_LOCATIONS`, so a real project's events never appeared and accepted
event candidates were invisible. Area 5 rewires the whole panel to the live
store, mirroring Areas 3–4, while preserving every `tl-*` CSS class.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Live events** — reads the `events` entity collection (title / summary / eventType / chapter / timelinePosition / participants / location / factions / relatedQuests) | `timeline.jsx` `buildTimelineModel` | e2e `22` (live event renders with title/summary/chapter) |
| **Live participant + location resolution** — `data.participants` → cast avatars (initials + hashed colour); `data.location` → place name | `buildTimelineModel` (`castById`, `locById`), `TLEventCard`, `TLInspector` | e2e `22` (cast avatar `TV`; inspector shows location) |
| **Era bucketing from chapter placement** — an event with a parsed chapter number → "In the manuscript"; future/unset → "Planned / ahead"; otherwise → "Backstory" | `buildTimelineModel` (`_tlParseChapter`, `_tlIsFuture`, `era`) | e2e `22` (Ch. 3 → manuscript band; no-chapter → Backstory band) |
| **Source citation derived from occurrences** — first occurrence chapter of the event / its participants, or `data.sourceMentions` | `buildTimelineModel` `firstSourceFor` | code |
| **Live filters** — character / location / quest / faction chips come from the live collections and actually filter the events | `TLFilters` + `TimelinePanelBody` events memo | code (empty when no entities; real ids when present) |
| **Book / Chronological sort** — book sorts by chapter number; chronological by the date/placement string | `TimelinePanelBody` events memo | code |
| **Live review queue** — pending `events` candidates from `ReviewService.listSync("events")`; Accept/Edit/Merge/Deny dispatch the real generic handlers with the item id | `TLReviewView` + `_tlDispatch` | e2e `22` (Deny resolves the real queue item) |
| **Inspector actions wired** — Edit event / Set date open the Entity Editor on the real record; cast chips focus the Cast panel; Open source jumps to the first occurrence's chapter | `TLInspector` (`editEvent`, chip `lw:focus-entity`, `openSource`) | code |
| **Live refresh** — recomputes on the same six store events as Cast/Relationships | `TimelinePanelBody` effect + `useMemo([storeVersion])` | code |
| **Graceful empty states** — no events → "No events yet"; filters exclude all → "No events match"; no review → friendly empty | `TLEmpty` + guards | e2e `22` (empty project, no demo events) |
| **Diagnostics stay honest** — `window.TL_EVENTS/TL_ERAS/TL_REVIEW` reflect the live model | `buildTimelineModel` window stash | code (`app.jsx:1504`) |

## How to verify

```sh
npm run validate
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 22-timeline   # 6 tests
```

### Manual smoke (no AI key)
1. `npm run dev`, open `Loomwright Shell.html`.
2. Open **Timeline** → empty state. Click **＋ Add event**, fill title +
   "Ch. 3" + a couple of participants → it appears in the "In the
   manuscript" band with the cast avatars.
3. Run an extraction that detects a happening → the **Review** tab fills;
   Accept lands a real `events` record that then shows on the timeline.

## Notes
- Eras were relabelled from the book-specific demo ("The Hollow Crown", …) to
  generic bands (Backstory / In the manuscript / Planned-ahead) derived from
  each event's chapter placement — no hardcoded story.
- `dateType`/`confidence`/`canon`/`flashback` read from `data.*` when present
  and default sensibly otherwise (the events editor can set them).

## Deferred from Area 5 (tracked in DEFERRED_BACKLOG.md)
- **Atlas "show on map"** (`onShowTimelineMomentOnAtlas`) — still a notice;
  lands with the Atlas focus area.
- **Date-conflict detection** — the demo flagged Ch.2-vs-Ch.4 conflicts; real
  cross-chapter date reconciliation is an extraction-quality follow-up.
- **Relationship/item timeline modes** — the mode bar keeps character/location/
  quest/faction filters; per-relationship and per-item lanes await those live
  passes.
