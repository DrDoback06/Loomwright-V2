# Loomwright v2 — Product Readiness Report

_Created: 2026-05-20, on branch `claude/production-build-hardening-pass`._

This is an honest, detailed snapshot of where Loomwright v2 stands after
the Production Build Hardening pass. It supersedes the milestone wording
in older docs.

## 1. Current product status

**Local beta candidate — verified with live-render UAT tests.** Loomwright
v2 is a local-first, BYOK writing and worldbuilding app with: a functional
local backend, tested core actions, a real production build (precompiled
bundle, no in-browser Babel, no CDN runtime), and full privacy-respecting
AI provider routing. A post-PR #13 User Acceptance Regression Audit
corrected a render-layer gap where panels/dashboards showed design/demo
constants instead of the live store; the rendered UI now reflects the live
project, proven by a DOM-clicking e2e suite (workflow T). It is no longer a
"prototype" — it builds, runs, and tests like a packaged React app, while
keeping the dev shell as the editing
source of truth.

It is **not** yet "1.0": extraction quality needs real-manuscript
tuning, some adapters/workspaces are light, and there's no installer /
hosting story (by design — local-first).

## 2. Implemented features

| Area | Status | Evidence |
|------|--------|----------|
| Backend wiring / callback burn-down | Implemented | `npm run validate`: 526 UI callbacks, 558 handlers, **0 Bucket A reach the generic default** |
| Extraction quality (local pass 1) | Implemented (pass 1) | local detectors + fixtures; smoke + e2e K |
| Field parity (priority 8 entity types) | Implemented | editor/JSON/persistence round-trip; e2e L |
| Workspace persistence (priority 5) | Implemented | Atlas/SkillTree/Relationships/Timeline/Tangle services; e2e M |
| Full project import / export / backup / library | Implemented | `ProjectArchiveService`; smoke + e2e N; API-key redaction |
| Speed Reader | Implemented | `SpeedReaderService`; chapter/paste/reference sources; e2e O |
| Search / indexing | Implemented | `SearchService`; live `CommandPalette`; e2e P; secrets never indexed |
| Audit log / undo (partial) | Implemented (partial) | `AuditService`; Home recent activity + undo; e2e Q; secrets redacted |
| Multi-provider AI routing | Implemented (Gemini pending) | `AIService` adapters (OpenAI/OpenRouter/Anthropic/Ollama/Custom) + `AIRoutingService` + `AIContextBuilder` + privacy guard; e2e R |
| **Production build pipeline** | **Implemented (this pass)** | `npm run build` → precompiled `dist/`; `npm run test:e2e:preview` boot smoke; build self-check |

## 3. Prototype / thin areas (honest)

- **Extraction quality** — local detectors are heuristic (confidence 0.62–0.80); they need real-manuscript calibration. Two-pass relationship extraction still deferred.
- **Project Intelligence** — persists + merges from onboarding, but no automatic derivation from references/lore/manuscript summaries, no diff-before-apply, no versioning.
- **Gemini adapter** — documented as pending; the config model + routing already accommodate it (only `_completeGemini` + a defaults entry are missing).
- **Secondary workspaces** — the priority-5 workspaces persist via their services, but render paths still read demo constants on first paint when storage is empty (sample-gating honoured); deep per-workspace create→edit→reorder coverage is not exhaustive.
- **Audit / undo** — core safe local actions are reversible; destructive/import/provider actions are audit-only (no restore-from-backup one-click, no per-entity history UI, no full versioning).
- **Settings UI for AI routing** — the service layer is complete; a richer Control Centre layout (per-task route selectors, mode picker, masked-key Test/Clear) is a UI follow-up.
- **Privacy guard** — uses `window.confirm` today; the `lw:ai-privacy-guard` event + `onConfirmAIPrivacyGuard` callback are in place for a future custom modal.
- **Build** — no source maps or minification yet (correctness-first; documented as future polish).

## 4. Provider-gated features (Bucket B)

Functional **when a BYOK provider is configured**, otherwise show a
specific "Configure an AI provider…" notice; in Local-only mode show
"AI is disabled (Local-only mode)…":
`onGenerateAIWriterDraft`, `onGenerateCompositionDraft`,
`onGenerateDraftSkillTree`, `onRunContinuityCheck` (local heuristic
always available), `onRunEntitySuggestion` (local extraction always
available), `onAcceptGeneratedText` / `onCopyGeneratedText` (local).

## 5. Future scope (deliberately out)

Mobile/desktop wrapper, cloud sync, collaboration / multi-user,
payments/licensing, hosted backend, Gemini adapter, cost/quality token
routing tables, streaming AI responses, semantic/vector search,
full Git-like manuscript versioning, source maps + minification.

## 6. Test coverage summary

| Layer | Coverage |
|-------|----------|
| Callback audit (`npm run validate`) | 526 UI callbacks; 558 handlers; **Bucket A = 0**; Bucket B = 6 (provider-gated); Bucket D = 4 (React-owned) |
| Service smoke (`npm run test:smoke`) | 256 assertions across entities, links, occurrences, extraction, sample, review, field parity, workspace persistence, project import/export, speed reader, search, audit, AI routing |
| Dev e2e (`npm run test:e2e`) | 75 Playwright tests, workflows A–R, real Chromium against the dev shell |
| Production-build e2e (`npm run test:e2e:preview`) | 2 boot-smoke tests, workflow S, against `vite preview` serving the precompiled `dist/` |
| Production build self-check (`npm run build`) | 16 assertions: bundle precompiled, no `text/babel`, no `babel.min.js`, no CDN runtime, vendored React present, all CSS present |

## 7. Security / privacy status

- **BYOK only** — no app-owned keys, no payments, no cloud accounts.
- **Local-only mode** — `AIRoutingService` blocks all external calls (`resolveRoute` returns null).
- **Key redaction** — keys live only in `KEYS.apiKeys`, AES-GCM-encrypted via Web Crypto; stripped from provider config blobs.
- **Export redaction** — `ProjectArchiveService` never exports `api_keys_encrypted`; `metadata.apiKeysIncluded` hard-coded false; recursive secret redaction.
- **Audit redaction** — every audit event's before/after/patch/metadata passes through `redactSecrets`; provider tests not logged.
- **Search redaction** — `SearchService` never reads `KEYS.apiKeys`; secret-named settings fields stripped at index time.
- **Privacy guard** — confirms before any manuscript/reference/intel text is sent to a provider; provider tests never send manuscript text.
- Verified by repeated "no leak" assertions in smoke + e2e (export / search / audit).

## 8. Packaging / build status

- `npm run build` → `dist/index.html` + `dist/loomwright.bundle.js` (≈1.6 MB precompiled) + CSS + `vendor/react*.js`. **No in-browser Babel, no CDN runtime dependency.**
- The bundle is produced by precompiling the 63 source `.jsx` files in the exact `Loomwright Shell.html` order with the identical runtime Babel config (`react` + `transform-block-scoping`), guaranteeing semantic parity with the dev shell.
- `npm run preview` serves the built app; `npm run test:e2e:preview` proves it boots and round-trips the backend.
- The dev shell (`Loomwright Shell.html`) remains the editing source of truth, clearly marked as legacy/dev.

## 9. Known limitations

- Production bundle ships React **development** build (vendored); a production-React swap + minification + source maps is a future polish step.
- Google Fonts still loaded from the Google CDN in `<head>` (cosmetic; not a runtime JS dependency — the app boots without them).
- No installer / packaging for desktop; the product is a static site served locally.
- Extraction quality, Project Intelligence depth, and AI prompt tuning need real-manuscript iteration.

## 10. Recommended next milestone

**Product polish + real-world tuning** with actual manuscripts:
- extraction calibration on real chapters,
- Settings UI for AI routing,
- production-React + minified bundle + source maps,
- Gemini adapter,
- deeper Project Intelligence derivation.

None of these are functional gaps — they're refinement. The product is
a **local beta candidate**.
