# UAT Remediation + Visible Interaction Completion Pass — Plan

_Branch: `claude/uat-remediation-pass` (from PR #14 merge). Committed before feature code._

## Purpose

The backend/runtime work (PRs #3–#14) is implemented and tested and is **not** being
rebuilt. This pass targets the remaining **visible, user-facing** gaps: Writer's Room
controls and several workspace controls that look real but are React-local, stubbed, or
fake, plus the audit statuses that were still vague (Partial / Needs UX / Not built).

Every unresolved original complaint is retested against the actual code and driven to a
definite outcome — **Fix now**, **Tiny fix now**, **Disable/clarify fake UI now**,
**Explicitly defer (with reason)**, or **Already fixed (after retest)**. No ambiguous
statuses survive this pass.

## Baseline (this branch, Phase 0)

```
npm run validate         → 526 UI callbacks; 558 handlers; Bucket A = 0 ✓
npm run test:smoke       → all smoke checks passed ✓
npm run build            → production build checks passed ✓
npm run test:e2e         → CANNOT RUN in this container (see Environment note)
npm run test:e2e:preview → CANNOT RUN in this container (see Environment note)
```

### Environment note (important, honest)

This execution container's outbound network is governed by an allowlist that **blocks the
Playwright Chromium download** (`cdn.playwright.dev` → `403 Host not in allowlist`), and no
system Chrome/Chromium is present to point `CHROMIUM_PATH` at. Therefore the two
browser-driven suites and live screenshots **could not be executed here**. Mitigation:

- `npm run build` performs a **full @babel/standalone compile of all 63 app scripts**, so it
  is a real syntax/compile gate for every `.jsx` change in this pass.
- `npm run validate` gates every `data-callback`.
- `npm run test:smoke` exercises services head-less; this pass **extends** it to cover the
  new `ManuscriptNoteService` and chapter delete/reorder service methods.
- The new DOM-clicking e2e tests are **authored** in `tests/e2e/15-ui-acceptance.spec.js`
  and are runnable wherever Chromium is available:
  `npx playwright install chromium && npm run test:e2e`.

## Retested complaint table

| ID | Complaint | Current status (retested) | Root cause | Fix now? | Fix strategy | Files likely touched | Test plan |
|----|-----------|---------------------------|------------|----------|--------------|----------------------|-----------|
| 2† | Editable canvas / "Start writing" | **Broken** — body not editable (only `<h1>` title is `contentEditable`, `:825`); "Start writing" (`:813`) has no handler | Manuscript body renders static React `<p>`; empty-state CTA unwired | **Fix now** | Uncontrolled `contentEditable` body keyed per chapter; "Start writing" focuses + seeds a `<p data-paragraph-id>`; snapshot DOM→persist on Save/Extract/switch via `ManuscriptChapterService.setChapterContent`; never bind to React per keystroke | `writers-room.jsx`, `writers-room.css`, `callback-registry.jsx` | type→Save→reload persists; Save&Extract reads typed body |
| 4 | Chapter reorder; delete clarity/persistence | **Partial** + delete is local-only (no persist, no trash) | `onReorderChapter`/`onRenameChapter` = `()=>{}` (`:1017,:1026`); create/reserve/delete never call `persistChapters` (`:1009–1025`); fake `draggable` grip on `ChapterNode` | **Fix now** | `ManuscriptChapterService.deleteChapter`/`moveChapter` (+renumber +audit); wire **Move Up/Down** in chapter strip; persist create/reserve/delete; keep confirm modal; restore via Audit undo; **remove fake drag handle** | `writers-room.jsx`, `backend-services.jsx` | create×3 → move → delete(confirm) → reload order persists |
| 6 | Active author selector cycles | **Confusing** — cycles through demo `WR_AUTHORS`; not persisted | `AuthorSelector` cycles on click (`:484`); `activeAuthorId` React-local (`:895,:1116`); ignores live Settings authors | **Fix now** | Selector reads live `SettingsService` `"authors"`; opens a **popover/list** (not cycle); persists `activeAuthorId` in Settings; attribute new notes/paragraphs to active author | `writers-room.jsx` (+ read `settings-rich.jsx`) | create 2 authors → select in WR → reload persists |
| 7 | Placeholders / fake controls | **Partial** | floating selection toolbar `visible:true` by default (`:999,:1344`); dead formatting/stub buttons | **Disable/clarify + tiny fix now** | Hide floating toolbar until a real text selection; wire bold/italic/underline against the now-editable body; **disable** find/thesaurus/footnote/insert-ref with explanatory `title`; code+DOM sweep for placeholder/TODO/coming-soon/mock in visible flows | `writers-room.jsx` + sweep | toolbar hidden on load; disabled buttons carry a reason |
| 12 | Inline annotation markers unclear | **Needs clarity** | entity/occurrence/comment spans lack `title`/`aria-label`; bare comment number badge | **Fix now** | Add `title`+`aria-label` to entity highlight, occurrence, and note/comment markers; stale-occurrence relink tooltip; preserve double-click→entity | `writers-room.jsx`, `writers-room.css` | marker exposes tooltip/aria; dbl-click opens panel |
| 13 | Speed Reader pivot centering | **Real fix needed** | `.sr-panel__word` `display:inline-flex` centers the whole word, so the bold pivot drifts | **Fix now** | Render before/pivot/after in a symmetric grid (`1fr auto 1fr`) so the pivot column stays centered; add a centre guide; keep WPM/play/source/bookmark persistence | `speed-reader.jsx`, `speed-reader.css` | pivot element sits inside the centre fixture; WPM persists |
| 14 | Item link affordances | **Mostly fixed** (PR #14 pickers live+persist); some link fields display-only | richer link UI was deferred | **Fix-for-beta** | Verify owner/location/stat/quest/event pickers read live store + persist + render link chips + empty states; surface any contained missing editable link; document deep ownership/transfer history as future | `entity-editor*.jsx`, `upgrades-items.jsx` | set links via UI → save → reload retains; search finds linked item |
| 17 | Skill Tree node edit/assign/connect | **Partial; React-local** | editor never calls the (complete) `SkillTreeService` | **Fix now** | Wire create-tree/create-node/connect/assign-cast+class/move/rename to `SkillTreeService` so they persist; lock/unlock persisted in `tree.layout` if safe, else **disabled with tooltip**; binary rule — work or disabled, never fake | `skill-trees.jsx`, `callback-registry.jsx`, `backend-services.jsx` | create→node→edit→connect→assign→reload persists |
| 19 | Notes/comments on text blocks | **Not built** | no note service or create UI; `onCreate`/`onEdit`/`onCommentClick` = `()=>{}` | **Fix now** | New `ManuscriptNoteService` (paragraph-level); margin **"Add paragraph note"**, edit/resolve/delete; click→focus paragraph; persist+reload; range/selection comments documented as future | `backend-services.jsx`, `writers-room.jsx`, `callback-registry.jsx` | add note→margin list→reload→click focuses→resolve |
| 22 | Active references / current chapter context | **Not built** | no surface assembles chapter-scoped context | **Fix now** | "Current Chapter Context" card in WR right margin: mentioned entities (occurrences) + linked references + chapter review items + Project-Intel reminders; quick-open; refresh on chapter change / Save&Extract | `writers-room.jsx` (+ existing services) | entity+linked ref → context shows both → click opens correct surfaces |
| 25 | Save / local-only status truthfulness | **Mostly fixed** | verify status reflects real lifecycle | **Fix-for-beta / verify** | Ensure sync status reflects real Save/extract lifecycle; local-only blocks AI; provider state honest | `writers-room.jsx`, `app.jsx`, `callback-registry.jsx` | edit→status changes; local-only blocks AI generation |
| 1,8,9,10,16,20,21,23,24,26 | Sample default / review queue / focus exit / Home+Today live / Tangle / search / rail counts | **Already fixed (retest + verify)** | — | Verify via DOM tests; small fixes only | various | DOM-click assertions added/retained |
| 3,5,11,15,18 | Toolbar wired / AI Writer routing / extraction / shared ledgers / relationships | **Already fixed (retest + verify)** | — | Verify; spot-fix only | various | covered by smoke + new e2e |

† #2 is not on the original "unresolved" list but is the enabling fix the user explicitly
requested ("editable manuscript body / Start writing must work"); it unblocks #12 and #19.

## New service — `ManuscriptNoteService` (`backend-services.jsx`)

- `KEYS.manuscriptNotes = "manuscript_notes"`.
- Note shape: `{ id, projectId, chapterId, paragraphId, startOffset, endOffset, quote,
  noteText, authorId, status:"open"|"resolved", source:"manual"|"selection"|"review"|"system",
  createdAt, updatedAt, resolvedAt }`.
- Methods: `createNote`, `updateNote`, `resolveNote`, `deleteNote`, `listByChapterSync`,
  `listByParagraphSync`, `getSync`. Dispatches `lw:manuscript-notes-updated`; logs to
  `AuditService` on create/resolve/delete. Added to the exported `Backend`.

## Editable manuscript body — design (minimum-safe, no engine swap)

- `ManuscriptBody` becomes an **uncontrolled** `contentEditable` region, `key`ed by
  `chapterId` (remount on chapter switch). React does **not** re-render it per keystroke
  (avoids caret jumping).
- Initial content rendered from `ManuscriptChapterService.manuscripts[chapterId]`; "Start
  writing" focuses the body and ensures one empty `<p data-paragraph-id>`.
- **Save:** read block elements, assign stable `data-paragraph-id`s, build
  `{ paragraphs:[{id,text}], text, html }`, persist via `setChapterContent` (updates word
  count + active-author attribution), set sync status truthfully.
- **Occurrence/entity highlights:** `contentEditable=false` atomic spans with
  `data-occurrence-id` + `title`/`aria-label`; re-applied on mount and on
  `lw:entity-store-updated` / after Save&Extract (live re-highlighting while typing is
  deferred). Double-click delegated on the body container → opens the entity.
- **Paragraph notes:** "current paragraph" = `getSelection().anchorNode` → closest
  `[data-paragraph-id]` (fallback first block); optional selected text → `quote`.

## Test plan (extend `tests/e2e/15-ui-acceptance.spec.js`)

Real DOM clicks for the action under test; `page.evaluate` only seeds/reads. New flows:
editable body type→Save→reload; Save&Extract from typed body; chapter create×3 → Move
Up/Down → reload → delete(confirm); add paragraph note → reload → click focuses → resolve;
author popover select → reload; entity marker tooltip/aria + dbl-click; floating toolbar
hidden on load; speed-reader pivot inside centre fixture + WPM persists; item link set →
save → reload; skill-tree create/connect/assign/move → reload (or unsafe disabled);
current-chapter-context shows + opens linked entity/ref; review accept/deny/merge; Home/Today
live counts. Existing tests are not weakened. The Node smoke suite gains direct coverage of
`ManuscriptNoteService` and chapter delete/reorder.

## Explicit deferrals (documented, never left fake)

- **Live highlight-while-typing** — highlights refresh on Save/Extract/store-update, not per
  keystroke. Future PR: incremental decoration.
- **Range/selection text-anchored comments** — paragraph-level notes ship now; range
  comments deferred. Future PR: range anchoring with offset repair.
- **Drag-and-drop chapter reorder** — Move Up/Down ships; fake drag handle removed. Future
  PR: drag board.
- **Skill-tree deep canvas (drag positioning / inspector rewrite)** — visible controls wired
  or disabled; no canvas rewrite this pass.
- Anything not safely wireable is **disabled with an explanatory tooltip**.

## Out of scope (task DO-NOT)

No redesign/shell rebuild, no new editor engine, no new architecture, no redo of callback
burn-down / import-export / production build / search-indexing / AI routing / extraction
quality (beyond a tiny UAT fix if required), no new roadmap phase, no weakened or removed
tests, no default demo/sample data.
