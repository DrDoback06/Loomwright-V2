# Loomwright v2

A local-first writing and worldbuilding app. The repository contains the
canonical app shell (`Loomwright Shell.html`), its modular `.jsx` / `.css`
files, the local backend runtime (`backend-services.jsx` +
`callback-registry.jsx`), vendored React/Babel, a Playwright e2e suite,
and a Node-level service smoke test.

Current milestone: **tested functional local prototype**. See
`PRODUCT_COMPLETION_AUDIT.md` for the single source of truth on what's
implemented, what's still thin, what's provider-gated (BYOK AI), and
what's deliberately out of scope.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The root `index.html` redirects to the
canonical app shell, `Loomwright Shell.html`.

## Useful scripts

- `npm run dev` — start the local development server.
- `npm run validate` — static checks: every `data-callback` is registered,
  every callback name reaches an explicit branch or a user-visible notice,
  no Bucket A action callback regresses to the generic default.
- `npm run test:smoke` — Node-level smoke test that exercises every
  service end-to-end against a shimmed window/localStorage/IndexedDB in
  under a second. No browser required.
- `npm run test:e2e` — Playwright suite (28 tests across 10 workflows)
  against a real Chromium browser. Requires `npx playwright install
  chromium`, or set `CHROMIUM_PATH` to point at an existing Chrome binary.
- `npm run build` — copy the static app into `dist/` for preview/deployment.
- `npm run preview` — serve the built `dist/` directory locally.

## Editing notes

- Edit `Loomwright Shell.html` and the root `*.jsx` / `*.css` files.
- Treat `Loomwright.bundle.jsx`, `Loomwright Shell - Standalone.html`,
  `Loomwright Shell.standalone-src.html`, and `Loomwright Shell-print.html` as
  generated review artifacts unless you intentionally regenerate them.
- The `*_HOOKUP.md` and audit files document design intent and backend hookup
  requirements.
