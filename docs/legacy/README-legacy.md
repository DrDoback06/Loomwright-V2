# Loomwright v2

A local-first writing and worldbuilding app. The repository contains the
canonical app shell (`Loomwright Shell.html`), its modular `.jsx` / `.css`
files, the local backend runtime (`backend-services.jsx` +
`callback-registry.jsx`), vendored React/Babel, a Playwright e2e suite,
and a Node-level service smoke test.

Current milestone: **local beta candidate**. The app now has a real
production build (`npm run build`) that precompiles the JSX into a
single bundle with no in-browser Babel and no CDN runtime dependency.
The Writer's Room is now genuinely usable for beta — a typeable + persisted
manuscript body, paragraph notes, chapter Move Up/Down + delete, a live
active-author selector, a Current Chapter Context surface, and live skill-tree
editing. See `PRODUCT_COMPLETION_AUDIT.md`, `PRODUCT_READINESS_REPORT.md`, and
`UAT_REMEDIATION_REPORT.md` (the latest pass, with the browser-only e2e caveat)
for the single source of truth on what's implemented, what's still thin, what's
provider-gated (BYOK AI), and what's deliberately out of scope.

## Entrypoints

- **Development / source of truth:** `Loomwright Shell.html` — loads the
  modular `.jsx` files and transforms them in the browser via Babel
  Standalone. **Edit the `.jsx` files here.** Run with `npm run dev`.
- **Production:** `npm run build` → `dist/index.html` +
  `dist/loomwright.bundle.js` (precompiled; vendored React only; no Babel
  at runtime). Serve with `npm run preview`.

The stale `Loomwright.bundle.jsx`, if present, is **not** canonical and
must not be edited.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The root `index.html` redirects to the
canonical app shell, `Loomwright Shell.html`.

## Useful scripts

- `npm run dev` — start the local development server (legacy/dev shell).
- `npm run validate` — static checks: every `data-callback` is registered,
  every callback name reaches an explicit branch or a user-visible notice,
  no Bucket A action callback regresses to the generic default.
- `npm run test:smoke` — Node-level smoke test that exercises every
  service end-to-end against a shimmed window/localStorage/IndexedDB in
  under a second. No browser required.
- `npm run test:e2e` — Playwright suite (75 tests, workflows A–R) against a
  real Chromium browser, run against the dev shell. Requires `npx playwright
  install chromium`, or set `CHROMIUM_PATH` to point at an existing Chrome
  binary.
- `npm run build` — **production build**: precompile the JSX (in the exact
  shell order) into `dist/loomwright.bundle.js`, generate `dist/index.html`
  with vendored React and no in-browser Babel, then run the build self-check.
- `npm run preview` — serve the precompiled `dist/` build locally.
- `npm run test:e2e:preview` — Playwright boot-smoke suite (workflow S) run
  against `npm run preview` to prove the production path boots.
- `npm run build:static-legacy` — the old raw-copy build (kept for
  reference; not the production path).

## Editing notes

- Edit `Loomwright Shell.html` and the root `*.jsx` / `*.css` files.
- Treat `Loomwright.bundle.jsx`, `Loomwright Shell - Standalone.html`,
  `Loomwright Shell.standalone-src.html`, and `Loomwright Shell-print.html` as
  generated review artifacts unless you intentionally regenerate them.
- The `*_HOOKUP.md` and audit files document design intent and backend hookup
  requirements.
