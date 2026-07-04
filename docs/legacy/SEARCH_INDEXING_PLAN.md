# Search / Indexing Pass — Plan

_Created: 2026-05-19, on branch `claude/search-indexing-pass`
(started from `main` post-PR-#9)._

## Scope

Make global search across the local project genuinely work. The
shell already has a search button that opens a `CommandPalette`
overlay; today that palette filters **static sample data**
(`PALETTE_DATA` constant in `overlays.jsx`). This pass adds the
backend `SearchService`, makes the palette read live results, and
wires "open this result" plumbing for every result type.

No UI redesign, no new top-bar layout, no semantic/vector search,
no AI-powered search. Pure local indexing over what's already in
the store.

## Current state audit

| Surface | Today | Real? |
|---------|-------|-------|
| Top-bar search button (`shell-parts.jsx`) | Opens CommandPalette via `onOpenCommandPalette` | ✅ |
| `CommandPalette` (`overlays.jsx`) | Filters `PALETTE_DATA` (static sample arrays for recent / suggested / entities / chapters / tabs) | ❌ — no live results |
| Per-panel "Search …" inputs (entity framework shell, trash, review queue, atlas-focus, atlas-quick) | React-local string filters over the panel's already-loaded list | ✅ at panel scope; never global |
| `onQueryChange` (palette), `onSearchChange` (panel header), `onSearchQueue`, `onSearchTrash`, `onSearchLocation`, `onSearchAtlasFocusEntities` | All React-owned, panel-local | ✅ at their scopes |
| `SearchService` | **Does not exist.** | ❌ |
| `KEYS.searchIndex` | **Does not exist.** | ❌ |
| Indexing on entity/chapter/reference mutations | None | ❌ |
| Privacy guards for indexed settings | n/a (nothing is indexed) | n/a |

**Bottom line:** there is exactly one visible global-search surface
(the palette overlay), and it is currently a UI mock. Wire the
palette to a new `SearchService` and the work is done.

## Storage / service ownership

| Concern | Owner | Storage |
|---------|-------|---------|
| Live search index | New `SearchService` in `backend-services.jsx` | `KEYS.searchIndex = "search_index"` — derived/rebuildable, not part of the project's canonical state |
| Index entries for entities | Read from `EntityService.listAllSync()` at build time | n/a (no separate persistence required; can re-derive on boot) |
| Index entries for chapters | Read from `ManuscriptChapterService.loadSync()` | n/a |
| Index entries for references | Read from `KEYS.references` via `ReferencesService.listSync()` | n/a |
| Index entries for review queue | `ReviewService.listSync()` | n/a |
| Index entries for project intelligence | `ProjectIntelService.loadSync()` | n/a |
| Index entries for onboarding | `OnboardingService.loadSync()` | n/a |
| Index entries for settings (safe fields only) | `SettingsService.getAllSync()` | n/a |
| Index entries for occurrences | `OccurrenceService.listAllSync()` | n/a |
| Index entries for trash (off by default) | `TrashService.listSync()` | n/a |

`KEYS.searchIndex` exists so we can persist the **last-built index**
across reload without paying the rebuild cost on every boot. But the
service is fully capable of rebuilding from scratch on demand, and
this pass treats the persisted form as a cache, not a source of
truth. **No new canonical storage key is needed** — the persisted
index does not enter `ProjectArchiveService` exports.

## SearchService design

```js
SearchService = {
  defaultState()            → { entries: [], builtAt: null }
  loadSync()                → cached index from KEYS.searchIndex or defaultState
  saveCacheSync(entries)    → persists entries to KEYS.searchIndex (best-effort)
  getIndexStatsSync()       → { total, byType, builtAt }
  clearIndex()              → wipes cache

  // Indexers (sync, return entries — never async, never throw)
  buildEntityEntries()      → entries for every active entity
  buildChapterEntries()
  buildReferenceEntries()
  buildReviewQueueEntries()
  buildProjectIntelEntries()
  buildOnboardingEntries()
  buildSettingsEntries()
  buildOccurrenceEntries()
  buildTrashEntries()       // only if includeTrash

  // Rebuild
  rebuildIndex(options)     → array of entries; persists cache
  rebuildIndexAsync()       → debounced wrapper; safe to call repeatedly

  // Query
  search(query, options)    → ranked array of entries (sync, no network)
  searchSync(query, opts)   → alias
}
```

### Entry shape (canonical)

```jsonc
{
  "id":            "entry-id",         // unique within an index build
  "type":          "entity" | "chapter" | "reference" | "review" |
                   "setting" | "projectIntelligence" | "onboarding" |
                   "occurrence" | "trash",
  "subtype":       "cast" | "items" | … | "settings.aiProviders" | …,
  "title":         "Aelinor Vey",
  "subtitle":      "Cast · Hess",
  "summary":       "Bearer of the Auger. Tense, lean, loyal to Saren.",
  "body":          "...long form text used for token search...",
  "tokens":        ["aelinor", "vey", "auger", "bearer", "hess"],
  "aliases":       ["Ael"],
  "tags":          ["protagonist", "POV"],
  "icon":          "user",

  // typed pointers (only set for entries that need them)
  "entityType":    "cast",     "entityId":          "cast-abc",
  "chapterId":     null,
  "referenceId":   null,
  "occurrenceId":  null,
  "reviewItemId":  null,
  "settingsSectionId":     null,
  "projectIntelSectionId": null,

  // ephemeral, set by `search()`
  "score":         <number>,
  "matchReason":   "alias exact" | "title prefix" | "body phrase" |
                   "token overlap (2/3)" | "tag exact",
  "highlights":    [{ field: "body", snippet: "...Auger of Hess...",
                       start: 12, end: 24 }],

  "updatedAt":     "iso"
}
```

### Ranking

Per the brief:

| Match | Score |
|-------|-------|
| Exact title/name match (case-insensitive, full string) | +100 |
| Alias exact match | +90 |
| Title prefix match | +70 |
| Title contains query | +60 |
| Tag exact | +55 |
| Body phrase contains query | +40 |
| Token overlap | +5 per token |
| Active chapter boost | +10 |
| Recently updated boost (updated within 24 h) | +5 |
| Review queue pending boost | +5 |

Rules:
- Queries shorter than 2 chars return recent/favourites only (no
  fuzzy expansion).
- Common stop-words (`the`, `a`, `an`, `of`, `and`, `to`, `in`,
  `on`, `is`, `it`) are stripped from query tokens.
- Token overlap caps at +25 (i.e. 5 tokens) so a query like "the
  the the…" can't outrun a real title match.
- Fuzzy mode (off by default) allows one-edit substitutions
  (Levenshtein 1) on tokens of length >= 4.

### Search options

```js
{
  types:               string[]    // optional whitelist
  entityTypes:         string[]
  includeTrash:        false
  includeReviewQueue:  true
  includeSettings:     true
  limit:               25
  sort:                "score" | "recent" | "title"
  fuzzy:               false
  activeChapterId:     null
  exactBoost:          true
}
```

## Privacy / safety

**API secrets must never be indexed.** Implementation:

1. `SearchService.buildSettingsEntries()` walks `SettingsService.getAllSync()`
   sections and **only emits entries for whitelisted sections**:
   `general`, `editor`, `extraction`, `aiProviders` (provider names
   only, never keys), `manuscript`, `privacy`, `appearance`.
2. Inside each section, fields whose key matches the existing
   `SECRET_FIELDS = {apiKey, secret, token, password, bearer,
   credential}` set are skipped entirely.
3. `KEYS.apiKeys` (the encrypted blob) is never read by any
   `SearchService` method.
4. New smoke + e2e tests assert that a fake `apiKey` set in
   `settings.aiProviderSettings` does **not** surface in any search
   result.

## Index refresh

`SearchService.rebuildIndexAsync()` debounces ~150 ms. Triggered by:

- `lw:entity-store-updated` (covers create/update/delete/restore via `EntityService`)
- `lw:manuscript-chapters-updated`
- `lw:references-updated`
- `lw:review-queue-updated`
- `lw:project-intel-updated`
- `lw:onboarding-updated`
- `lw:settings-updated`
- `lw:project-imported`
- `lw:tangle-updated` (covers tangle nodes through entity references — cheap to include)
- `lw:occurrence-store-updated`
- A `setInterval` safety rebuild every 60 s while the tab is active

`installDelegates()` in `backend-services.jsx` adds these listeners
once on bootstrap. The initial index build happens on `initialise()`.

## Surface wiring (CommandPalette)

`overlays.jsx`'s `CommandPalette` becomes the live UI:

1. Remove the static `PALETTE_DATA` constant (or keep as a fallback
   for "empty-source" state when index is empty).
2. On open and on `q` change, call
   `window.LoomwrightBackend.SearchService.search(q, { activeChapterId, types: scopeToTypes(scope) })`.
3. Group results by `type` into the existing palette groups:
   - `entities` → Cast / Locations / Items / Quests / Events / etc.
   - `chapters` → Chapter entries
   - `recent`   → top 5 most-recently-updated (when q is empty)
   - `suggested` → keep existing action rows (Create chapter, etc.)
4. Click handler dispatches `lw:open-search-result` with `{ type,
   id, entityType, chapterId, referenceId, settingsSectionId,
   projectIntelSectionId, reviewItemId }`. The shell listens and
   maps to the right open/focus event.
5. Empty state: "No matches" message stays unchanged (already
   exists). When the index is empty (fresh project, no records),
   render the existing "No history yet" state and the suggested
   actions block.

No visual redesign. The same row template, scope tabs, keyboard
handling, footer hints, all stay.

## Open / focus behaviour

Single dispatch event `lw:open-search-result` listened to in `app.jsx`:

```js
window.addEventListener("lw:open-search-result", (e) => {
  const r = e.detail || {};
  switch (r.type) {
    case "entity":  openPanel(r.entityType); selectEntity(r.entityType, r.entityId); break;
    case "chapter": openWorkspace("writers-room"); setActiveChapter(r.chapterId);    break;
    case "reference": openPanel("references"); selectReference(r.referenceId);       break;
    case "review":  openPanel("review");                                             break;
    case "setting": openWorkspace("control-centre"); openSettingsSection(r.settingsSectionId); break;
    case "projectIntelligence": openPanel("references"); openIntelSection(r.projectIntelSectionId); break;
    case "onboarding": openOnboardingEditor(r.onboardingSectionId);                  break;
    case "occurrence": openWorkspace("writers-room"); setActiveChapter(r.chapterId); break;
    case "trash": openPanel("trash"); break;
  }
});
```

Plumbing reuses existing events: `lw:open-route`, `lw:open-panel`,
`lw:open-onboarding-answers`, `lw:settings-open-section` (added if
absent). Anywhere we'd otherwise show a generic "isn't wired yet"
notice, we show a **specific** notice like "Open the chapter you
want — search will jump you to it."

## New callbacks

Names registered:

- `onRunGlobalSearch`        — top-bar / palette query change
- `onOpenSearchResult`       — generic open dispatcher (Bucket A; routes to typed open events)
- `onClearSearch`            — clears the palette query
- `onRebuildSearchIndex`     — forces a rebuild (Settings or Tweaks button)
- `onOpenEntityFromSearch`
- `onOpenChapterFromSearch`
- `onOpenReferenceFromSearch`
- `onOpenSettingsFromSearch`
- `onOpenReviewItemFromSearch`
- `onOpenProjectIntelligenceFromSearch`
- `onOpenOnboardingFromSearch`

Total: 11 new callback names. All real Bucket A actions (no notice
shortcuts). Registered in:
- `scripts/callback-names.json`
- `callback-names-data.jsx`
- `BACKEND_HANDLED` in `callback-registry.jsx`

The dispatch handlers in `installDelegates()` route these to the
corresponding `SearchService` methods or `lw:open-search-result`
events.

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[search]` block (~22 assertions)

- `SearchService` exposed on Backend
- `defaultState` shape
- After save, `rebuildIndex()` includes the new entity
- Title exact match outranks token-overlap match
- Alias exact match returns the right entity
- Chapter `bodyText` returns chapter entries
- Reference `content` returns reference entries
- Review queue entries are indexed
- Project Intelligence section is indexed
- Onboarding answer is indexed
- Settings: section name appears
- Settings: `apiKey` **never** appears (privacy assertion)
- Settings: encrypted blob never appears
- Trash off by default — deleted entity not in results
- Trash on → deleted entity appears with `type: "trash"`
- `clearSample()` removes sample entries from index after rebuild
- Search short query (< 2 chars) returns recent only
- Stop-word query "the" returns nothing useful (low score)
- `getIndexStatsSync` returns `{ total, byType, builtAt }`
- `clearIndex()` empties the cache
- Re-create entity, search finds it (refresh path)
- Delete entity, search no longer finds it (refresh path)

### E2E (`tests/e2e/12-search-indexing.spec.js`) — 7 tests

1. Create Cast with alias → search alias → result carries entity/entityId.
2. Create Location → search exact name → result top.
3. Write chapter `bodyText` → search phrase → chapter result.
4. Add Reference → search tag → reference result.
5. Search "provider" → safe settings result with `settingsSectionId`.
6. Delete entity → search hidden; with `includeTrash: true` it appears with `type: "trash"`.
7. Set fake API key → rebuild index → search for it → no result.

All e2e tests drive `window.LoomwrightBackend.SearchService` directly
to keep specs stable while CommandPalette wiring iterates.

## Out of scope (strict)

- No semantic/vector search
- No cloud search
- No AI-powered search
- No audit log / undo
- No multi-provider AI routing
- No production build pipeline
- No extraction changes
- No field parity expansion
- No project import/export changes
- No Speed Reader changes
- No workspace redesign
- No new major UI design
- No new document parser beyond indexing existing stored content
- No search inside binary references unless already text

## Commit plan

1. `SEARCH_INDEXING_PLAN.md` (this commit, no code).
2. `SearchService` in `backend-services.jsx` + `KEYS.searchIndex` +
   index-refresh listeners + Backend export.
3. `BACKEND_HANDLED` + new callback names in
   `callback-registry.jsx` / `callback-names-data.jsx` /
   `scripts/callback-names.json` + dispatch handlers.
4. Smoke harness `[search]` block.
5. New `tests/e2e/12-search-indexing.spec.js`.
6. Wire `CommandPalette` to live results in `overlays.jsx`.
7. Wire `lw:open-search-result` listener in `app.jsx`.
8. Docs: `SEARCH_INDEXING_REPORT.md`,
   `PRODUCT_COMPLETION_AUDIT.md`, `FINAL_QA_REPORT.md`.

Each step verified with `npm run validate` + `npm run test:smoke`.
Full `npm run test:e2e` at the end.

## Acceptance bar

- `npm run validate` passes (Bucket A still 0).
- `npm run test:smoke` adds ~22 new assertions, all pass.
- `npm run test:e2e` adds 7 specs, all pass; existing 56 still pass.
- API secrets never appear in search results (asserted twice — once
  for the encrypted blob, once for a settings `apiKey` field).
- Search/Indexing moves from "Out of scope this milestone" → **Implemented** in `PRODUCT_COMPLETION_AUDIT.md`.
