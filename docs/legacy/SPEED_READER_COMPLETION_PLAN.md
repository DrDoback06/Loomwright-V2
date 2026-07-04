# Speed Reader Completion Pass — Plan

_Created: 2026-05-19, on branch `claude/speed-reader-completion-pass`
(started from `main` post-PR-#8)._

## Scope

Move Speed Reader from "visual + ephemeral React state" to a fully
persistent, multi-source RSVP tool. No UI redesign, no left-rail
changes, no workspace rebuild — wire the engine that already exists
to a real service and hook real input sources.

## Current state audit

`speed-reader.jsx` is **further along than typical "prototype"** but
has zero persistence and zero real source plumbing:

| Capability | Present today | Persists? | Real source? |
|------------|--------------|-----------|--------------|
| `srTokenise(text)` — word beats with sentence/clause flags | ✅ | n/a | ✅ |
| `srSplitWord(word)` — pivot letter (ORP-style) | ✅ | n/a | ✅ |
| `srPauseMultiplier(beat, opts)` — punctuation × 1.6, sentence × 2.2, long word × 1.4 | ✅ | n/a | ✅ |
| `useSpeedReader()` — RSVP `setTimeout` loop, `play / pause`, `seek / nextWord / previousWord / nextSentence / previousSentence`, `restart`, `bookmark`, `noteCurrentSentence`, `addPastedSource` | ✅ | ❌ | n/a |
| `SpeedReaderPanelBody` — compact side panel | ✅ | ❌ | sample only |
| `SpeedReaderWorkspaceFull` — three-column workspace | ✅ | ❌ | sample only |
| Sources | Hard-coded `SR_SAMPLE_SOURCES` constant (ch.1, ch.2, ch.3, ch.7, ch.9, "selected passage") | ❌ | ❌ |
| Pasted text | `addPastedSource()` exists; sits in component state only | ❌ | ✅ (in-memory) |
| Current Writer's Room chapter as source | **No** — sample chapters are static strings | n/a | ❌ |
| WPM / font size / punctuation pause / sentence pause / long-word slow / focus mode | `useState` only | ❌ | n/a |
| `bookmarks` / `notes` | Component state only | ❌ | n/a |
| `onSpeedReader*` callbacks | 19 `data-callback` attributes wired through React `onClick`s — registry-level dispatch falls to the generic notice | n/a | n/a |
| Storage key | `KEYS.speedReader = "speed_reader"` exists; nothing writes to it | ❌ | n/a |

So the engine is real; the **session model and source plumbing** are
the missing pieces.

## Storage / service ownership

| Concern | Owner | Key |
|---------|-------|-----|
| Per-source reading sessions (idx / WPM / bookmarks / notes / settings) | New `SpeedReaderService` in `backend-services.jsx` | `KEYS.speedReader = "speed_reader"` (already exists; switch from `null` placeholder to a real `{ activeId, sessions: [] }` shape) |
| Active session pointer | Same blob, `state.activeId` | same |
| Chapter source content | `ManuscriptChapterService.loadSync()` — read-only | `KEYS.manuscriptChapters` |
| Pasted source content | Stored on the session record (`session.rawText`) | same |
| Reference source content | `ReferencesService.listSync()` — read-only | `KEYS.references` |

**No new top-level KEY**. We re-use the existing `KEYS.speedReader`.
Existing `ProjectArchiveService` already exports/imports this key, so
session persistence flows through full-project export for free.

## Service design

```
SpeedReaderService = {
  defaultState()                   → { activeId: null, sessions: [], updatedAt }
  loadSync()                       → state from KEYS.speedReader (or defaultState)
  save(state)
  listSessionsSync()               → state.sessions
  getSessionSync(id)               → session by id
  getActiveSessionSync()           → session[activeId] (or null)
  createSession(input)             → adds + sets activeId; returns the session
  updateSession(id, patch)         → shallow merge + bump updatedAt
  setActiveSession(id)
  deleteSession(id)
  setProgress(id, idx, extras={})  → patch currentWordIndex + session.totals
  setSettings(id, settings)        → patch wpm/punctuationPause/.../fontSize
  addBookmark(id, bookmark)
  removeBookmark(id, bookmarkId)
  addNote(id, note)
  removeNote(id, noteId)
  resetProgress(id)                → idx → 0; clears session counters; keeps bookmarks/notes
  markComplete(id)                 → completedAt timestamp
}
```

### Session shape (canonical)

```jsonc
{
  "id": "sr-…",
  "name": "Ch. 7 — Ash & Auger",
  "sourceType": "chapter" | "paste" | "reference" | "passage",
  "sourceId":   string | null,        // chapterId / referenceId
  "sourceTitle": string,
  "rawText":   string,                // empty for chapter/reference (resolved on read)
  "currentWordIndex": 0,
  "totalWords": 0,                    // filled on first tokenise
  "wpm": 360,
  "fontSize": 64,
  "punctuationPause": true,
  "sentencePause": true,
  "longWordSlow": true,
  "focusMode": false,
  "bookmarks": [{ id, wordIndex, label, sentence, note?, createdAt }],
  "notes":     [{ id, wordIndex, kind, body, sentence, createdAt }],
  "stats":     { wordsRead, pauses, startedAt, lastReadAt, elapsedMs },
  "completedAt": null | iso,
  "createdAt":   iso,
  "updatedAt":   iso
}
```

`stats.lastReadAt` lets the panel sort recent sessions; `completedAt`
lets it filter finished.

## Hook integration

`useSpeedReader(initialSourceId)` keeps its existing shape but:

1. On mount, reads `SpeedReaderService.getActiveSessionSync()`. If
   present, hydrates `idx`, `wpm`, settings, bookmarks, notes from it.
2. On reload, the panel and workspace point at the same session record
   so they don't fork state.
3. Every state mutation goes through `SpeedReaderService.updateSession`
   debounced (~250 ms) so the timing loop doesn't hit storage every
   word. Stats updates batch through the same path.
4. Adding a pasted source becomes `SpeedReaderService.createSession({
   sourceType: "paste", rawText, sourceTitle })`.
5. New source resolvers:
   - `sourceType: "chapter"` reads `chapter.bodyText` (or strips html)
     from `ManuscriptChapterService.loadSync().manuscripts[chapterId]`
     / `chapter.bodyText`.
   - `sourceType: "reference"` reads `reference.content` /
     `reference.body` / `reference.summary`.

## Input sources (Phase 2 minimum + selected text + reference)

Required for this PR:
- Current chapter (`ManuscriptChapterService.loadSync()` → activeChapterId)
- Pasted text (already works in memory; persist it)
- Reference content (`ReferencesService.listSync()`)

Selected-text mode keeps its existing path through the "Selected
passage (Ch.7 §2)" sample card — but the brief says don't fake it, so
when no selection is live we drop the static sample and show an empty
state. Real selected-text capture from Writer's Room is left as
out-of-scope for this PR (documented as future).

## Callbacks

Existing names (already in the registry, 19 of them) keep their
existing React `onClick` paths. We add **new explicit backend handlers**
for the persistence-side ones so they're real Bucket-A actions:

| Callback | Behaviour |
|----------|-----------|
| `onCreateSpeedReaderSession` | `SpeedReaderService.createSession(detail)` |
| `onReadCurrentChapter` | Read active chapter from `ManuscriptChapterService.loadSync()`, build a session, set active |
| `onReadReference` | Build a session from a reference id |
| `onSpeedReaderPasteText` | Build a session from `detail.text` |
| `onDeleteSpeedReaderSession` | `SpeedReaderService.deleteSession(detail.id)` |
| `onResetSpeedReaderProgress` | `SpeedReaderService.resetProgress(detail.id || activeId)` |
| `onSpeedReaderSaveSession` | `SpeedReaderService.updateSession(activeId, ...)` (already an existing data-callback) |
| `onSpeedReaderBookmark` | `SpeedReaderService.addBookmark(activeId, ...)` |
| `onSpeedReaderNoteDifficulty` | `SpeedReaderService.addNote(activeId, ...)` |

The existing `onSpeedReaderPlay / Pause / Restart / NextWord /
PreviousWord / NextSentence / PreviousSentence / ChangeWpm /
ChangeFontSize / TogglePunctuationPause / ToggleSentencePause /
SelectDocument` stay React-owned **and** are added to a dedicated
React-owned bucket (`SR_REACT_OWNED`) inside `dispatchCallback` so they
don't show the "isn't wired yet" notice when reached. They become
**registry-aware no-ops** rather than generic-default hits — because
the React handler fires first via `onClick`, the registry only sees
them through the document-level capture listener as already-handled.

## Callback names — new entries

Three new callback names registered:
- `onCreateSpeedReaderSession`
- `onDeleteSpeedReaderSession`
- `onResetSpeedReaderProgress`
- `onReadCurrentChapter`
- `onReadReference`

(plus the existing 19 stay).

Files: `scripts/callback-names.json`, `callback-names-data.jsx`,
`BACKEND_HANDLED` in `callback-registry.jsx`.

## Tests

### Smoke (`scripts/smoke-services.js`) — new `[speed reader]` block, ~14 assertions

- `srTokenise` returns 0 tokens for empty, N+1 for "Hello world."
- `srTokenise` flags last token sentence-end on `.`/`!`/`?`
- `srTokenise` flags clause-end on `,`/`;`/`:`
- `srSplitWord("at")` pivot index = 1 (length≤4 → 1, but here len=2 so 1 — clamp)
- `srSplitWord("running")` pivot index = 3 (length 7 → 3)
- `srSplitWord("communication")` pivot index = 5 (length 13 → 5)
- `SpeedReaderService.createSession` persists and sets active
- `getActiveSessionSync` returns the created session
- `updateSession` patches wpm + currentWordIndex
- `setProgress` updates `stats.lastReadAt`
- `addBookmark` pushes onto session.bookmarks (dedup by wordIndex+label)
- `addNote` pushes onto session.notes
- `resetProgress` sets idx 0 but preserves bookmarks
- `deleteSession` removes the row + clears activeId if matching
- After reload (`StorageService.clear()` simulated), `getActiveSessionSync` returns null and `defaultState()` shape holds

### E2E (`tests/e2e/11-speed-reader.spec.js`) — new spec, 5 tests

1. **Paste text → create session → start playback → pause → bookmark → reload survives.**
2. **Read current Writer's Room chapter** — creates a session from `ManuscriptChapterService` active chapter and source title appears.
3. **WPM change persists across reload.**
4. **Reset progress preserves bookmarks.**
5. **Delete session removes it from `listSessionsSync`.**

All tests drive the service via `window.LoomwrightBackend.SpeedReaderService`
to keep the e2e fixture stable while the workspace UI iterates.

## Out of scope (strict)

- No AI reading assistant
- No text-to-speech / audio
- No search / indexing
- No manuscript editor rewrite
- No production build migration
- No new visual redesign
- No new left-rail architecture
- No real Writer's Room "selected text" capture (deferred to a future
  pass when a global selection-capture mechanism exists)
- No new callback registry generalisation patterns
- No keyboard-shortcut layer (existing `data-callback` chains stay
  as-is)

## Commit plan

1. `SPEED_READER_COMPLETION_PLAN.md` (this commit, no code).
2. `SpeedReaderService` in `backend-services.jsx` + Backend export.
3. Hook `useSpeedReader` into `SpeedReaderService` for load/save +
   add chapter/reference source resolvers.
4. Callback registry — new explicit handlers + new names in
   `scripts/callback-names.json` / `callback-names-data.jsx`.
5. Smoke harness `[speed reader]` block.
6. New `tests/e2e/11-speed-reader.spec.js`.
7. Docs: `SPEED_READER_COMPLETION_REPORT.md`,
   `PRODUCT_COMPLETION_AUDIT.md`, `FINAL_QA_REPORT.md`.

Each step verified with `npm run validate` + `npm run test:smoke`.
Full `npm run test:e2e` at the end.

## Acceptance bar

- `npm run validate` passes (Bucket A stays 0).
- `npm run test:smoke` adds ~14 assertions, all pass.
- `npm run test:e2e` adds 5 specs, all pass; existing 51 still pass.
- Speed Reader moves from Prototype/Thin → **Implemented** in the
  audit, with a footnote noting that "Read selected text" remains a
  future capability gated on real Writer's Room selection capture.
