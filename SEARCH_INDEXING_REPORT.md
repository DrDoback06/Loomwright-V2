# Search / Indexing Pass — Report

_Branch: `claude/search-indexing-pass`. Closes the agreed "global
search across the local project" phase._

## Scope reminder

Make the existing shell-level search UI actually find live records.
This pass adds the backend `SearchService`, wires the existing
`CommandPalette` overlay to live results, and adds a typed
`lw:open-search-result` dispatcher so every result type lands on the
right surface.

No semantic/vector search, no AI search, no cloud search, no UI
redesign, no new top-bar layout.

## What changed

### New `SearchService` (in `backend-services.jsx`)

Single facade for tokenising, indexing, and ranking across the live
local store. New storage key `KEYS.searchIndex = "search_index"`
caches the last-built index across reload but is not part of the
canonical project state — `ProjectArchiveService` does not export it.

| Method | Purpose |
|--------|---------|
| `defaultState() / loadSync() / saveCacheSync(entries)` | IndexedDB + localStorage mirror via `StorageService` |
| `getIndexStatsSync()` | `{ total, byType, builtAt }` |
| `clearIndex()` | Wipes the cache |
| `buildEntityEntries()` | Index every active entity (cast, items, locations, quests, events, stats, skills, classes, races, factions, bestiary, lore, relationships, timeline) with name + aliases + summary + traits + abilities + tags + sourceMentions |
| `buildChapterEntries()` | Chapter title + `bodyText` (strips HTML when only `bodyHtml` available) |
| `buildReferenceEntries()` | Title + summary + content + tags + URL |
| `buildReviewQueueEntries()` | Candidate name + source quote + suggested changes |
| `buildProjectIntelEntries()` | One entry per section (style guide, canon rules, summaries, etc.) |
| `buildOnboardingEntries()` | One entry per onboarding section |
| `buildSettingsEntries()` | **Safe sections only** (whitelist) and **secret fields stripped recursively** |
| `buildOccurrenceEntries()` | Manuscript mentions, with chapter pointer |
| `buildTrashEntries()` | Off by default — opt-in via `includeTrash: true` |
| `rebuildIndex(options)` | Sync build of all sources |
| `rebuildIndexAsync(options)` | Debounced (~150 ms); safe to call repeatedly |
| `search(query, options)` | Ranked array of entries; sync |
| `searchSync(query, options)` | Alias |

### Index entry shape

```jsonc
{
  "id": "ent:cast:cast-abc",
  "type": "entity" | "chapter" | "reference" | "review" | "setting" |
          "projectIntelligence" | "onboarding" | "occurrence" | "trash",
  "subtype": "cast" | "items" | ... | "settings.aiProviders" | ...,
  "title": "Hess Vaela",
  "subtitle": "Cast",
  "summary": "...",
  "body": "...",
  "tokens": [...],
  "aliases": [...],
  "tags": [...],
  "entityType", "entityId", "chapterId", "referenceId",
  "occurrenceId", "reviewItemId",
  "settingsSectionId", "projectIntelSectionId", "onboardingSectionId",
  "icon",
  "updatedAt",
  // Set by search():
  "score", "matchReason", "highlights"
}
```

### Ranking (matches the brief)

| Match | Score |
|-------|-------|
| Title exact | +100 |
| Alias exact | +90 |
| Title prefix | +70 |
| Title contains | +60 |
| Tag exact | +55 |
| Body phrase contains | +40 |
| Subtitle contains | +15 |
| Token overlap | +5 per token (capped at +25) |
| Active chapter boost | +10 |
| Recently updated (< 24 h) | +5 |
| Review queue pending | +5 |

Rules:
- Stop-words (`the / a / an / of / and / to / in / on / is / it / for / with / by / at / as / or / but / this / that`) stripped from query tokens.
- Stop-word-only query returns nothing instead of flooding body matches.
- Short queries (< 2 chars) return recent records only.
- Token overlap capped at +25 so a flood of common words can't outrank a real title match.

### Privacy guarantees (enforced in code)

1. **`KEYS.apiKeys` (encrypted blob) is never read** by any `SearchService` method.
2. **`buildSettingsEntries()` walks a whitelist** (`SAFE_SETTINGS_SECTIONS = {general, editor, extraction, aiProviders, manuscript, privacy, appearance, speedReader}`) — no other sections are indexed.
3. **Inside a whitelisted section**, every key matching the existing `SECRET_FIELDS = {apiKey, secret, token, password, bearer, credential}` is **skipped at the walk level** by a recursive `safeText(obj)` helper. Even nested secrets never enter the index body.
4. Smoke + e2e tests assert that a fake `sk-ant-…` value set on `settings.aiProviderSettings.apiKey` produces **zero** search results and never appears anywhere in `JSON.stringify(SearchService.loadSync())`.
5. The encrypted `ciphertext` blob at `KEYS.apiKeys` is similarly never indexed.

### Index refresh

`installDelegates()` adds listeners for every relevant store-update
event. Each calls `SearchService.rebuildIndexAsync()` (debounced ~150 ms):

- `lw:entity-store-updated`
- `lw:manuscript-chapters-updated`
- `lw:references-updated`
- `lw:review-queue-updated`
- `lw:project-intel-updated`
- `lw:onboarding-updated`
- `lw:settings-updated`
- `lw:project-imported`
- `lw:tangle-updated`
- `lw:occurrence-store-updated`
- `lw:sample-loaded` / `lw:sample-cleared`

Initial build happens once at the end of `initialise()` after the
store has hydrated.

### CommandPalette wiring (`overlays.jsx`)

The palette overlay now reads live results via
`window.LoomwrightBackend.SearchService.search(q, { limit: 30,
includeReviewQueue: true })`. Results are grouped into the existing
palette layout:

- **Entities** — type === "entity"
- **Chapters** — type === "chapter"
- **References** — type === "reference"
- **Settings** — type === "setting"
- **Review queue** — type === "review"
- **Other** — projectIntelligence / onboarding / occurrence / trash

Each row carries a `_searchResult` pointer object with typed fields
(`entityType`, `entityId`, `chapterId`, `referenceId`,
`settingsSectionId`, `projectIntelSectionId`, etc.). Click handler
dispatches `lw:open-search-result` with that pointer.

When the index is empty (fresh project / not yet built), the palette
falls back to the original sample/recent/suggested groups so the
empty-state still has affordances.

The existing scope tabs (All / Entities / Chapters / Actions),
keyboard navigation, footer hints, and visual style are unchanged.

### Open / focus behaviour (`app.jsx`)

New `lw:open-search-result` listener maps every result type to the
right open event:

| Result type | Action |
|-------------|--------|
| `entity` | `onOpenPanel(entityType)` + dispatch `lw:open-entity-editor` |
| `chapter` | `setRouteId("writers-room")` + dispatch `lw:set-active-chapter` |
| `reference` | Open References panel + workspace + dispatch `lw:focus-reference` |
| `review` | Open Review panel + dispatch `lw:focus-review-item` |
| `setting` | Open Control Centre + dispatch `lw:settings-section` |
| `projectIntelligence` | Open References + dispatch `lw:focus-project-intel` |
| `onboarding` | Dispatch `lw:open-onboarding-answers` |
| `occurrence` | Open Writer's Room + dispatch `lw:set-active-chapter` with `occurrenceId` |
| `trash` | Open Trash panel |
| (unknown) | Specific notice — never a generic "isn't wired yet" |

The palette closes after a successful dispatch (`setPaletteOpen(false)`).

### Callback registry

Eleven **new** callback names registered:

- `onRunGlobalSearch`
- `onOpenSearchResult`
- `onClearSearch`
- `onRebuildSearchIndex`
- `onOpenEntityFromSearch`
- `onOpenChapterFromSearch`
- `onOpenReferenceFromSearch`
- `onOpenSettingsFromSearch`
- `onOpenReviewItemFromSearch`
- `onOpenProjectIntelligenceFromSearch`
- `onOpenOnboardingFromSearch`

All eleven added to `scripts/callback-names.json`,
`callback-names-data.jsx`, and `BACKEND_HANDLED` in
`callback-registry.jsx`. Click-delegate handlers in
`installDelegates()` route them to the right `SearchService` method
or dispatch the typed open event.

Audit count: **525 UI callbacks; registry bootstraps 547 handlers; Bucket A still 0.**

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[search]` block

**22 new assertions, all pass:**

```
[search] SearchService exposed
[search] defaultState is empty
[search] rebuildIndex populates entries
[search] byType includes entity / chapter / reference / review / setting
[search] exact title match returns the right entity at rank 0
[search] exact-title result has matchReason = title exact
[search] alias exact match returns the right entity
[search] chapter body phrase returns chapter
[search] reference tag returns reference
[search] project-intelligence is included in results
[search] onboarding sections are searchable
[search] safe settings section returns 'aiProviders'
[search] API key is NOT indexed (no results for the secret)
[search] index never contains the raw apiKey value
[search] index never contains the encrypted blob
[search] new entity is indexed after rebuild
[search] deleted entity is hidden by default
[search] deleted entity appears as type=trash when includeTrash:true
[search] short query (<2 chars) returns recent only (matchReason='recent')
[search] stop-word-only query returns nothing
[search] clearIndex empties the cache
[search] rebuild after clear restores entries
```

### E2E (`tests/e2e/12-search-indexing.spec.js`)

**7 new browser tests, all pass:**

1. Create Cast with alias → search alias → result carries entity pointer (entityId + entityType + matchReason "alias exact").
2. Create Location → search exact name → top result is the location with matchReason "title exact".
3. Write chapter `bodyText` → search phrase → chapter result with chapterId.
4. Add Reference → search tag → reference result with referenceId.
5. Search "provider" → safe settings result with `settingsSectionId: "aiProviders"`.
6. Delete entity → not in results by default; appears as `type: "trash"` when `includeTrash:true`.
7. **Privacy** — API key set in settings + encrypted blob set on `KEYS.apiKeys` → search for the secret returns zero hits; the cached index JSON contains neither the secret nor the blob.

### Full suites

```
npm run validate     → OK: 525 UI callbacks; registry bootstraps 547 handlers
                       OK: 0 Bucket A action callbacks reach the generic default notice.
npm run test:smoke   → All smoke checks passed (22 new [search] assertions).
npm run test:e2e     → 63 passed (≈7.2 min) — 56 pre-existing + 7 new (Workflow P).
```

## Indexed source types

| Source | Type | Notes |
|--------|------|-------|
| Every active entity (14 types) | `entity` | name + aliases + summary + traits + abilities + tags + sourceMentions |
| Manuscript chapters | `chapter` | title + bodyText (HTML stripped) |
| References collection | `reference` | title + summary + content + tags + URL |
| Review queue items | `review` | candidate name + source quote + suggestedChanges |
| Project Intelligence sections | `projectIntelligence` | one per section |
| Onboarding answers | `onboarding` | one per section |
| Settings (whitelisted, secret-free) | `setting` | section label + safe field text only |
| Manuscript occurrences | `occurrence` | exact text + chapter pointer |
| Trash (opt-in only) | `trash` | name + summary; off unless `includeTrash:true` |

## Files changed

- `backend-services.jsx` — `KEYS.searchIndex`, full `SearchService` (~350 lines), 12 store-event listeners, 11 callback delegates, initial build on `initialise()`, Backend export.
- `callback-registry.jsx` — 11 new names in `BACKEND_HANDLED`.
- `scripts/callback-names.json` + `callback-names-data.jsx` — 11 new names alphabetically.
- `overlays.jsx` — `CommandPalette` reads live results via `SearchService`; falls back to sample data only when index is empty; rows carry `_searchResult` typed pointers.
- `app.jsx` — `lw:open-search-result` listener maps 9 result types to existing open events; row click routes through it.
- `scripts/smoke-services.js` — `[search]` block (22 assertions).
- `tests/e2e/12-search-indexing.spec.js` — new spec, 7 tests.
- `SEARCH_INDEXING_PLAN.md` — plan-first commit.
- `SEARCH_INDEXING_REPORT.md` — this report.
- `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` — updated to reflect Implemented status.

## Status moves

In `PRODUCT_COMPLETION_AUDIT.md`:

> **Search / Indexing** — moves from "Out of scope this milestone" → **Implemented** with a footnote: "Local-only index over entities / chapters / references / review queue / project intelligence / onboarding / safe settings / occurrences / trash. Result click opens the correct surface. API secrets never indexed."

## Privacy / security handling summary

- `KEYS.apiKeys` (encrypted blob): never read by SearchService.
- `KEYS.settings`: only whitelisted sections walked; recursive walker skips any field named `apiKey / secret / token / password / bearer / credential` at any depth.
- `KEYS.providerSettings`: not in the safe-settings allowlist — provider keys cannot leak through there.
- `KEYS.searchIndex` cache: contains only redacted text; survives reload safely.
- `ProjectArchiveService` exports: unchanged. `KEYS.searchIndex` is **not** added to the export payload (the index is derived/rebuildable; including it would defeat the privacy redaction in the live store).

## Out of scope (strict)

- No semantic / vector search
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

## Known gaps left for a future pass

- **Search workspace.** A full-screen "Search all" workspace (different from the palette) could land once design is ready. Today's palette is sufficient for the keyboard-driven workflow.
- **Highlighting in result rows.** The `highlights` field exists on each result; the palette row template doesn't yet render the snippet — visual change deferred to keep this PR service-shaped.
- **Per-workspace "filter only this panel" search** stays React-local (out of scope; existing per-panel inputs already work).
- **Fuzzy mode.** The service supports fuzzy in its options surface but uses exact + token matching by default. Calibrating Levenshtein thresholds against real data is deferred to a tuning pass.

## Whether Search / Indexing can move to Implemented

**Yes.**

- SearchService exists and is exposed on `window.LoomwrightBackend`.
- Global search UI (`CommandPalette`) reads live results from the service.
- Entity / chapter / reference / settings / review / project-intel / onboarding / occurrence / trash result types all work and carry typed pointers.
- Result click opens the correct surface via `lw:open-search-result`.
- Index refresh fires after every relevant store mutation.
- API secrets are not indexed (asserted twice — secret value + encrypted blob).
- 22 smoke + 7 e2e assertions cover the contract.
- `npm run validate` clean; Bucket A still 0.
