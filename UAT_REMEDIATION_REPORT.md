# UAT Remediation + Visible Interaction Completion Pass — Report

_Branch: `claude/uat-remediation-pass` (from PR #14 merge `09dc6aa`)._

This pass finished the remaining **visible, user-facing** gaps from
`USER_ACCEPTANCE_REGRESSION_AUDIT.md`. It did not redesign the app, replace the
editor engine, or redo any prior backend pass. Every previously-unresolved
complaint now has a definite outcome (no Partial / Needs UX / Works-ish).

## 1. Command outputs (all green, browser-verified)

```
npm run validate         → All HTML refs exist; 523 UI callbacks; 558 handlers;
                           Bucket A = 0 ✓; 6 Bucket B; 4 Bucket D.            PASS
npm run test:smoke       → All smoke checks passed (282 OK assertions),
                           incl. new chapter delete/move/restore, notes, and
                           SkillTreeService lifecycle coverage.               PASS
npm run test:e2e         → 95 passed, 0 failed (incl. 11 new UAT specs).      PASS
npm run build            → Production build checks passed (precompiled bundle,
                           no in-browser Babel, vendored React).              PASS
npm run test:e2e:preview → 2 passed (production dist boot + Writer's Room).   PASS
```

**Browser note:** `npx playwright install chromium` is blocked here
(`cdn.playwright.dev → 403 Host not in allowlist`), so the suites were run
against **Chrome-for-Testing** (allowlisted host) via `CHROMIUM_PATH`, which
`playwright.config.js` already supports:

```
curl -o /tmp/chrome.zip \
  https://storage.googleapis.com/chrome-for-testing-public/148.0.7778.96/linux64/chrome-linux64.zip
unzip /tmp/chrome.zip -d /tmp/chrome
CHROMIUM_PATH=/tmp/chrome/chrome-linux64/chrome npm run test:e2e
npm run build
CHROMIUM_PATH=/tmp/chrome/chrome-linux64/chrome npm run test:e2e:preview
```

The browser run caught a real bug: `SettingsService.getSectionSync` object-spread
mangled the array `authors` section, so the active-author selector always fell
back to "You" — fixed at the root (it now round-trips arrays).

## 2. Complaint outcomes

### Fixed (now works + persists, verified by smoke/build/authored-e2e)
- **#2 (enabling) Editable manuscript body** — the body is now an uncontrolled
  `contentEditable` region; "Start writing" seeds + focuses a paragraph; typing
  → Save snapshots the DOM into `ManuscriptChapterService` → reload restores.
- **#4 Chapter management** — create/reserve/delete persist immediately;
  `deleteChapter` (retains a restorable copy + audit), `restoreChapter`,
  `moveChapter` (renumber); visible **Move Up/Down**; the fake drag handle was
  removed; honest delete-confirm copy.
- **#6 Active author selector** — opens a live popover/list of Settings authors
  (was a cycle over demo authors) and persists `activeAuthorId`; the Settings
  authors default is a neutral "You" (no demo author names).
- **#13 Speed Reader pivot** — before/pivot/after now render in a symmetric grid
  so the pivot letter stays centred on a fixed fixation guide (panel + workspace).
- **#17 Skill trees** — new live `SkillTreeLiveManager`: create tree, add node
  (a skills entity), rename, connect, assign to live cast/class, lock/unlock —
  all persist via `SkillTreeService`/`EntityService` and survive reload; fresh
  project is empty (no demo trees).
- **#19 Notes/comments** — new `ManuscriptNoteService`; "Add paragraph note"
  anchors to the caret paragraph (captures selection as a quote when present);
  edit/resolve/delete; "Go to ¶" focuses the paragraph; persists + reloads.
- **#22 Current Chapter Context** — new right-margin card assembling mentioned
  entities (occurrences) + linked references + pending review for the active
  chapter, with quick-open; refreshes on chapter change / Save & Extract.

### Fixed for beta (works now; named future polish)
- **#7 Placeholders / fake controls** — the always-on floating selection toolbar
  is gone (now selection-driven); bold/italic/underline/strike run on the
  editable body; spellcheck drives native `spellCheck`; notes route from the
  toolbar; non-functional buttons (heading, scene-break, quote, highlight,
  insert-ref, footnote, find, thesaurus) are **disabled with a clear tooltip**.
  *Future polish:* implement heading/quote/scene-break/find as real actions.
- **#12 Inline markers** — entity/occurrence spans carry `title` + `aria-label`;
  the hover chip shows the real mention count (was a hardcoded "7 mentions").
  *Future polish:* a dedicated visual treatment for stale/relink markers.
- **#14 Item link affordances** — verified the items editor already exposes live
  pickers (owner→cast, current/found/lost/used→locations, linkedStats→stats,
  compatibleClasses→classes, quests/events) via the live `EERelatedPicker` with
  empty states; links persist + appear in saved JSON. *Future polish:* a
  structured ownership/transfer-history timeline editor.
- **#25 Save / local-only status** — `syncState` reflects the real Save/extract
  lifecycle; the bottom status strip now shows a real last-saved time, live word
  count, and live active author (were hardcoded). *Future polish:* a live-ticking
  relative timestamp.

### Explicitly deferred (with reason → future PR)
- **Drag-and-drop chapter reorder** — shipped Move Up/Down instead; no fake drag
  affordance remains. Reason: a drag board is a larger chapter-strip change.
  *Future PR: chapter-strip-drag.*
- **Live highlight-while-typing** — entity highlights refresh on
  Save/Extract/store-update, not per keystroke (avoids caret churn in the
  uncontrolled body). *Future PR: incremental-decoration.*
- **Range/selection-anchored comments** — paragraph-level notes shipped now;
  precise text-range comments deferred. *Future PR: range-comments.*
- **Skill-tree visual constellation canvas** — per the "don't rebuild the canvas"
  constraint, the drag-positioning SVG editor is deferred; opening it shows a
  clear future-scope notice and the working list manager is the editing surface.
  *Future PR: skill-tree-canvas.*

### Obsolete / not applicable
- None.

## 3. Tests added
- `tests/e2e/15-ui-acceptance.spec.js` (+11 DOM-clicking specs): editable body
  type→Save→reload; Save & Extract→occurrence; chapter create+Move+reload;
  chapter delete confirm; paragraph note add→reload→persist; author popover
  select→persist; floating toolbar hidden on load; Current Chapter Context shows
  a mentioned entity; speed-reader pivot centred; skill-tree create→add node→
  reload. (Authored to conventions/testids; require a Chromium-capable run.)
- `scripts/smoke-services.js` (+ chapter delete/move/restore, full
  `ManuscriptNoteService` lifecycle, full `SkillTreeService` lifecycle incl.
  `setNodeUnlocked`).

## 4. Files changed (this pass)
`UAT_REMEDIATION_PLAN.md`, `UAT_REMEDIATION_REPORT.md`, `app.jsx`,
`backend-services.jsx`, `scripts/smoke-services.js`, `settings-rich.jsx`,
`skill-trees.css`, `skill-trees.jsx`, `speed-reader.css`, `speed-reader.jsx`,
`tests/e2e/15-ui-acceptance.spec.js`, `writers-room.css`, `writers-room.jsx`,
plus audit-doc updates (`USER_ACCEPTANCE_REGRESSION_AUDIT.md`,
`PRODUCT_COMPLETION_AUDIT.md`, `PRODUCT_READINESS_REPORT.md`, `FINAL_QA_REPORT.md`,
`README.md`). New services: `ManuscriptNoteService`; new chapter methods
(`deleteChapter`/`restoreChapter`/`moveChapter`) and `SkillTreeService.setNodeUnlocked`.

## 5. Writer's Room manual/visual verification (DONE — Chrome-for-Testing)

Driven in a real browser and captured to screenshots; the in-test reload
assertion confirmed the body text returned verbatim:

- [x] Fresh Writer's Room shows an empty page with a working "Start writing".
- [x] Click "Start writing" → caret in the body → type two paragraphs (visible).
- [x] Click Save → status shows "Saved"; chapter header shows **35 words**
      (believable for the two typed paragraphs).
- [x] Reload → typed paragraphs return verbatim
      ("The salt flats were cold that morning… counting the bells until the
      count stopped meaning anything.").
- [x] Add a paragraph note → a "PARAGRAPH NOTE" card appears in the left margin
      attributed to the active author, and persists across reload (verified via
      `ManuscriptNoteService.listByChapterSync` after reload).
- [x] Save & Extract runs `ExtractionService.runExtraction` against the saved
      body; with a known entity in the text an occurrence is produced (e2e spec
      "Save & Extract … creates an occurrence").

**UX observation (pre-existing, not in scope):** the default workspace opens a
docked panel stack (Locations/Quests/Tangle) that overlays the manuscript until
cleared via the workspace layout "Clear" preset or the panel close buttons. The
manuscript canvas, margins, and Current Chapter Context render correctly once
panels are cleared (see the captured screenshots).

## 6. Remaining future PRs
`chapter-strip-drag`, `incremental-decoration` (live highlighting),
`range-comments`, `skill-tree-canvas` (visual constellation), plus the named
"future polish" items above (heading/quote/scene-break/find toolbar actions,
structured item ownership-history editor, stale-occurrence visual treatment).

## 7. Beta status verdict

**Yes — Loomwright V2 remains a "local beta candidate."** The core writing loop
is now genuinely usable (type → save → reload → extract), the previously
unresolved complaints are fixed or explicitly deferred with no fake UI left
behind, and the full check set is green and **browser-verified**: `validate`
(Bucket A = 0), `smoke`, `test:e2e` (95 passed), `build`, and `test:e2e:preview`
(2 passed), plus a manual/visual Writer's Room pass via Chrome-for-Testing.
