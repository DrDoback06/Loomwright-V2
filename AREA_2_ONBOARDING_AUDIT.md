# Area 2 — Onboarding that learns your book: completion & audit reference

_Status: implemented, ready for audit._

The onboarding wizard was orphaned — its files weren't loaded in the app, it
was never mounted, completion had no handler, edits weren't persisted, the
intel mapping read fields that don't exist, uploads were faked, and several
buttons were dead/stubbed. Area 2 makes onboarding genuinely capture the book +
writing style, persist it, seed the project, and feed the AI.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Wizard mounts** (first-run gate on status "pending"; reopen via `lw:open-onboarding-wizard` / `onReopenOnboardingWizard`) | `app.jsx` onboarding overlay + listeners; `Loomwright Shell.html` now loads the onboarding `.jsx`/CSS | e2e `18` (first-run, reopen, no-reopen-when-complete) |
| **Completion seeds the project** — intel + cast (from seeds, with role/personality/etc.) + chapters (pasted/uploaded, auto-split) + references (with content) + AI provider/privacy + extraction settings + optional first extraction | `OnboardingService.applyCompletion` + `splitChaptersText` | smoke `[ob]` + e2e `18` |
| **Intel mapping fixed** — premise/themes/tone/POV/style signature/canon now reach the AI (was reading non-existent fields) | `deriveIntelFromOnboarding` used by `defaultIntel` + `mergeFromOnboarding` | smoke `[ob]` |
| **Edits persist** (save & continue / reopen restores) | `onboarding.jsx` `setSection` → `OnboardingService.save` (debounced) | code + e2e reopen |
| **Real document upload** (.txt/.md via FileReader; binary flagged honestly) | `DropZone` in `onboarding-parts.jsx`; manuscript/voice/reference steps store real content | code + smoke (content seeded) |
| **Every wizard button wired** — see the per-button list below | `onboarding.jsx` callbacks bag + `onboarding-steps.jsx` | e2e `18` (cast import, analyze) |
| **Offline style analysis** — real metrics (avg sentence length, variance, lexical diversity, dialogue ratio, adverb density, register, pacing); folds into the style guide | `analyzeWritingStyle` (backend) + Voice step | smoke `[ob]` + e2e `18` |
| **Cast "Import from pasted text"** — extracts character seeds offline via the Area 1 NER engine | `Step_Cast` → `discoverEntities` | e2e `18` |

### Buttons fixed in the button-level pass
STUB→real: **Validate key** (real `AIService.testConnection`, was a fake "sk-" check), **Copy prompt / Copy helper prompt** (clipboard), **Quick-import JSON** (merge+persist), **privacy-mode toggle** (persists).
DEAD→wired: **Import from pasted text** (cast NER), **Add another sample** / **Accept profile** / **Edit profile** / delete-upload (Voice), **Import outline JSON** (Plot), **Add custom stat** (RPG, real editable list), **delete uploaded** (Manuscript).

## How to verify
```
npm run test:smoke   # [ob] intel mapping, seeding (cast/chapters/refs), analyzer, style guide
npm run build && npm run validate
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 18-onboarding   # 6 tests
```
Manual: `npm run dev` on a fresh project → wizard appears → fill it (Cast → "Import from pasted text" to extract seeds; Voice → "Analyze") → "Open the door" → land in the Writer's Room with cast, chapters, references seeded and the style/canon captured for the AI.

## Deferred from Area 2 (tracked in DEFERRED_BACKLOG.md)
- **Genre RPG entity templates** (seed example classes/races/stats from the chosen genre/template) → RPG depth area; the choice is captured.
- **"Import existing project"** start option (welcome.start === "import") has no file-import flow wired in onboarding yet → wire to `ProjectArchiveService.applyImport`.
- **Deeper AI style critique** of the voice sample (beyond the local metrics) → AI Writer area.
