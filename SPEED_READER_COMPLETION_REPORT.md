# Speed Reader Completion Pass — Report

_Branch: `claude/speed-reader-completion-pass`. Closes the agreed
"make the Speed Reader genuinely usable" phase._

## Scope reminder

Speed Reader engine was already real (`srTokenise`, `srSplitWord`,
pause multipliers, RSVP `setTimeout` loop, controls, three-column
workspace) but had **zero persistence and zero real source plumbing**.
This pass adds the persistence-side service, real chapter / reference
source resolvers, and 5 new explicit-handler callbacks.

No UI redesign, no workspace rebuild, no extraction changes, no
project-import/export changes (except verifying the existing
`KEYS.speedReader` round-trip continues to work).

## What changed

### New `SpeedReaderService` (in `backend-services.jsx`)

Single facade owning per-source reading sessions, backed by the
existing `KEYS.speedReader = "speed_reader"` storage key. No new
storage key needed.

| Method | Purpose |
|--------|---------|
| `defaultState()` | `{ activeId: null, sessions: [], updatedAt }` |
| `loadSync()` / `save(state)` | IndexedDB + localStorage mirror |
| `listSessionsSync()` / `getSessionSync(id)` / `getActiveSessionSync()` | Read accessors |
| `resolveSource(input)` | Resolves `{ rawText, sourceTitle }` for `sourceType: "paste" \| "passage" \| "chapter" \| "reference"`. Chapter pulls from `ManuscriptChapterService.loadSync()` (active chapter when no id given); reference pulls from `KEYS.references`. |
| `createSession(input)` | Resolves source, computes `totalWords`, sets `activeId`, persists. Throws on empty/blank `rawText`. |
| `updateSession(id, patch)` | Shallow merge + `updatedAt` |
| `setActiveSession(id)` | Switch active pointer |
| `deleteSession(id)` | Removes row; clears `activeId` only if it matched |
| `setProgress(id, idx, extras)` | Clamps to `[0, totalWords]`; stamps `stats.lastReadAt` |
| `setSettings(id, {wpm, fontSize, punctuationPause, sentencePause, longWordSlow, focusMode})` | Whitelisted patch |
| `addBookmark(id, bookmark)` | Dedups by `(wordIndex, label)` |
| `removeBookmark(id, bookmarkId)` |
| `addNote(id, note)` / `removeNote(id, noteId)` |
| `resetProgress(id)` | `idx → 0`, clears `stats`, **preserves bookmarks / notes** |
| `markComplete(id)` | Sets `completedAt` timestamp |

Session shape:
```jsonc
{
  "id", "name", "sourceType", "sourceId", "sourceTitle", "rawText",
  "currentWordIndex", "totalWords",
  "wpm", "fontSize", "punctuationPause", "sentencePause",
  "longWordSlow", "focusMode",
  "bookmarks": [{ id, wordIndex, label, sentence, note?, createdAt }],
  "notes":     [{ id, wordIndex, kind, body, sentence, createdAt }],
  "stats":     { wordsRead, pauses, startedAt, lastReadAt, elapsedMs },
  "completedAt", "createdAt", "updatedAt"
}
```

### Hook integration (`speed-reader.jsx`)

`useSpeedReader(initialSourceId)` now:

1. Hydrates from `SpeedReaderService.listSessionsSync()` + `loadSync().activeId` on mount.
2. When the active source id is a persisted session (id starts with `sr-`), debounces a write (~250 ms) of progress + settings + bookmarks + notes back through `SpeedReaderService.updateSession`.
3. Switching to a persisted session via `setSourceId` re-hydrates from that session's stored state instead of resetting to word 0.
4. Live sessions replace the sample sources list when any exist (sample sources still appear only on a truly fresh store — the long-standing no-fake-data rule still holds).
5. Exposes 4 new actions on the return object:
   - `readCurrentChapter()` → creates a `sourceType: "chapter"` session
   - `readReference(referenceId)` → creates a `sourceType: "reference"` session
   - `deletePersistedSession(sessionId)`
   - `resetPersistedProgress()`
6. `addPastedSource(text, label)` now persists through `createSession({sourceType: "paste"})` while still updating the UI provisionally so paste-and-go feels instant.

### Surface wiring

- Side panel — added a new "Read chapter" button (`data-callback="onReadCurrentChapter"`) next to "Add source".
- Workspace left rail — added a new "Read current chapter" row above "Add reading source…".

The existing 19 `onSpeedReader*` callbacks (Play / Pause / Restart /
NextWord / PreviousWord / NextSentence / PreviousSentence / ChangeWpm /
ChangeFontSize / TogglePunctuationPause / ToggleSentencePause /
SelectDocument / Bookmark / NoteDifficulty / SendSentenceToWriterRoom /
CopyExcerpt / OpenSourceChapter / SaveSession / ExportSession /
AddSource / PasteText) keep their existing React-owned `onClick` paths
— they were already real on the React side; the persistence side now
catches up automatically through the debounced effect above.

### Callback registry wiring

Five **new** callback names registered:

- `onCreateSpeedReaderSession`
- `onReadCurrentChapter`
- `onReadReference`
- `onDeleteSpeedReaderSession`
- `onResetSpeedReaderProgress`

All five wired through the document-level click delegate in
`backend-services.jsx` `installDelegates()`, calling
`SpeedReaderService.{createSession, deleteSession, resetProgress}`
appropriately. Added to:
- `scripts/callback-names.json`
- `callback-names-data.jsx`
- `BACKEND_HANDLED` in `callback-registry.jsx`

### Incidental bug fix (in scope — surfaced while testing Speed Reader)

`writers-room.jsx` was crashing with `paragraphs.map is not a function`
when a chapter was created via `ManuscriptChapterService.createFromComposition`
(which stores `manuscripts[id] = { html, text }`) instead of the
legacy array-of-paragraphs shape. Added an `Array.isArray` guard:

```js
const paragraphs = activeChapter && !activeChapter.reserved
  ? (Array.isArray(manuscriptsByChapter[activeId]) ? manuscriptsByChapter[activeId] : [])
  : [];
```

The Speed Reader e2e suite was the first test to create a chapter
mid-test via `createFromComposition`, so the bug surfaced there. The
brief explicitly allows workspace fixes for bugs discovered while
testing Speed Reader.

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[speed reader]` block

**26 new assertions, all pass:**

```
[sr] tokenise empty → 0
[sr] tokenise 4-word sentence → 4 beats
[sr] tokenise marks sentence end on '.'
[sr] tokenise marks clause-end on ','
[sr] split 'at' pivot index = 1
[sr] split 'running' pivot index = 3
[sr] split 'communication' pivot index = 4 (len<=13)
[sr] split 'extraordinarily' pivot index = 5 (len>13)
[sr] SpeedReaderService exposed
[sr] defaultState shape: { activeId:null, sessions:[] }
[sr] createSession returns a session with id + totalWords
[sr] createSession sets activeId
[sr] addBookmark persists
[sr] addBookmark dedups identical (wordIndex,label)
[sr] addNote persists
[sr] setSettings patches wpm + fontSize
[sr] setProgress updates currentWordIndex
[sr] setProgress stamps stats.lastReadAt
[sr] resetProgress sets idx=0 and preserves bookmarks
[sr] listSessionsSync returns the session after persist
[sr] chapter source resolves rawText from ManuscriptChapterService
[sr] chapter source carries chapter title as sourceTitle
[sr] deleteSession removes the row
[sr] deleteSession clears activeId only when it was the deleted session
[sr] reference source resolves content + title
[sr] createSession throws on empty rawText
```

### E2E (`tests/e2e/11-speed-reader.spec.js`)

**5 new browser tests, all pass:**

1. **paste text → session → progress + bookmark persist across reload** — full IndexedDB round-trip.
2. **read current Writer's Room chapter pulls bodyText into session** — confirms `resolveSource("chapter")` reads from `ManuscriptChapterService`.
3. **WPM change persists across reload (per-session)** — settings round-trip.
4. **reset progress preserves bookmarks but rewinds idx to 0** — explicit invariant of `resetProgress`.
5. **delete session removes it from listSessionsSync and clears active if it was active** — delete semantics.

### Full suites

```
npm run validate     → OK: 525 UI callbacks; registry bootstraps 536 handlers
                       OK: 0 Bucket A action callbacks reach the generic default notice.
npm run test:smoke   → All smoke checks passed (26 new [speed reader] assertions).
npm run test:e2e     → 56 passed (≈6.4 min) — 51 pre-existing + 5 new (Workflow O).
```

## Files changed

- `backend-services.jsx` — `SpeedReaderService` (~200 lines), 5 new delegate-listener branches, Backend object export.
- `speed-reader.jsx` — `useSpeedReader` hydrates from service, persist effect, 4 new returned actions (`readCurrentChapter / readReference / deletePersistedSession / resetPersistedProgress`); panel + workspace surface a "Read chapter" affordance.
- `callback-registry.jsx` — added 5 names to `BACKEND_HANDLED`.
- `scripts/callback-names.json` + `callback-names-data.jsx` — 5 new names alphabetically.
- `writers-room.jsx` — `Array.isArray` guard on paragraphs (incidental bug fix).
- `scripts/smoke-services.js` — `[speed reader]` block (26 assertions).
- `tests/e2e/11-speed-reader.spec.js` — new spec, 5 tests.
- `SPEED_READER_COMPLETION_PLAN.md` — plan (committed first).
- `SPEED_READER_COMPLETION_REPORT.md` — this report.
- `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` — updated to reflect Implemented status.

## Source-type coverage

| Source mode | Supported? | How |
|-------------|-----------|-----|
| **Current chapter** | ✅ | `SpeedReaderService.createSession({ sourceType: "chapter" })` reads active chapter from `ManuscriptChapterService.loadSync()` (or an explicit `sourceId`). |
| **Pasted text** | ✅ | `createSession({ sourceType: "paste", rawText })` persists the raw text on the session record. |
| **Reference content** | ✅ | `createSession({ sourceType: "reference", sourceId })` reads `content / body / summary / notes` from `KEYS.references`. |
| **Selected passage** | Partial (sample) | The "Selected passage (Ch.7 §2)" sample card still works in-memory. Real cross-app selection capture from Writer's Room is **out of scope** for this PR (see Known gaps). |
| **Imported plain-text file** | Not in this pass — paste covers the same workflow. |

## Status moves

In `PRODUCT_COMPLETION_AUDIT.md`:

> **Speed Reader** — moves from Prototype/Thin → **Implemented** with a footnote: "Active chapter + paste + reference sources persist with WPM / progress / bookmarks / notes. Real Writer's Room selection-capture for the 'selected passage' mode remains a future capability."

## Known gaps left for a future pass

- **Writer's Room selection capture.** Reading the user's current text selection from Writer's Room needs a global selection-capture mechanism; the existing "Selected passage" sample card stays as a demo until that lands.
- **Plain-text file import.** Paste covers the same workflow today; a dedicated file picker can land in a UI-focused pass.
- **Keyboard shortcuts.** Space-to-play / J/K word-step bindings are intentionally not in this PR.
- **Session export / share.** `ProjectArchiveService` already includes Speed Reader state via `KEYS.speedReader`; a dedicated per-session JSON export can land later.

## Out of scope (still)

- No AI reading assistant
- No text-to-speech / audio
- No search / indexing
- No manuscript editor rewrite
- No production build migration
- No new visual redesign
- No new left-rail architecture
