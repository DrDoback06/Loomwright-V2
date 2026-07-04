# Production Build Pipeline + Final Hardening — Plan

_Created: 2026-05-20, on branch `claude/production-build-hardening-pass`
(started from `main` post-PR-#12)._

## Scope

Give Loomwright a real production build: precompiled JSX, a stable
entrypoint, no in-browser Babel and no CDN runtime dependency on the
production path — while keeping the existing static design shell
working as a legacy/dev entry. Final product-readiness audit + docs.
**No new features, no UI redesign, no panel rebuilds.**

## 1. Current entrypoint model

`Loomwright Shell.html` is the single entry. It:
- loads 18 CSS files,
- loads vendored `react.development.js`, `react-dom.development.js`, **`babel.min.js`** (Babel Standalone, ~3 MB),
- loads **63** `.jsx` files as `<script type="text/babel" data-presets="react" data-plugins="transform-block-scoping" src="…">`, transformed **in the browser at runtime**, plus one plain `<script src="callback-names-data.jsx">`.

`vite.config.js` has a dev middleware that serves `.jsx` as
`text/plain` so Babel Standalone can fetch + transform them. The dev
server runs on port 5179 (Playwright's `webServer`).

`npm run build` today (`scripts/build-static.js`) just **copies** the
repo into `dist/` — it does **not** compile anything, so the "built"
app still depends on in-browser Babel.

## 2. Browser-Babel / global-script dependency

- Every `.jsx` file declares top-level `const`/`let` (e.g. `const Brand = …`, `const Icon = …`). Under Babel Standalone's classic-script eval **with the `transform-block-scoping` plugin**, those become top-level `var`s that attach to the global object, so later files reference earlier files' symbols as globals.
- **No file uses `import`/`export`** (verified: zero matches). The whole app is one implicit global namespace assembled by script order.
- Re-declaration across files is tolerated because `const`→`var` makes top-level redeclaration legal.
- Runtime config is exactly: `presets: ["react"]`, `plugins: ["transform-block-scoping"]`.

## 3. Files loaded by the shell (canonical order)

The 64 scripts in `Loomwright Shell.html` lines 50–113, in order:
`brand → icons → primitives → entity-drag → tweaks-panel →
layout-state → layout-controls → shell-parts → entity-data →
entity-framework → … → backend-services → callback-names-data →
callback-registry → specimen → app`.

The build must preserve this exact order — `backend-services.jsx`
defines `window.LoomwrightBackend` and calls `initialise()`,
`callback-registry.jsx` wires listeners, `app.jsx` mounts React last.

## 4. What relies on globals

- React / ReactDOM as `window.React` / `window.ReactDOM`.
- Cross-file symbols: components (`Brand`, `Icon`, `Btn`, `WorkspaceShell`, …), data constants (`ENTITY_TYPES`, `PALETTE_DATA`, …), services (`window.LoomwrightBackend`), `window.__LW_CALLBACK_NAMES`, `window.WORKSPACE_COMPONENTS`, sample-source globals (`window.__LW_SAMPLE_SOURCES__`, `ENTITY_SAMPLES`, `CAST_SAMPLE`), `window.PANEL_PRESETS`, etc.
- `app.jsx` mounts into `#root`.

## 5. Safest build strategy — concatenated precompiled bundle

The brief's recommended fallback ("generate a concatenated bundle, feed
to Babel/esbuild, output compiled JS, load from production HTML") is
the **smallest safe option** here because the files are not module-shaped.

Build steps (`scripts/build-production.js`):
1. Parse `Loomwright Shell.html` to extract the ordered list of script
   `src`s (so the build can never drift from the shell order).
2. Concatenate those files in order, each wrapped with a
   `// ==== file: <name> ====` banner (for stack-trace readability),
   into one source string.
3. Compile the whole string **once** with `@babel/standalone`
   (already a dependency) using the **identical** runtime config:
   `presets: ["react"]`, `plugins: ["transform-block-scoping"]`. This
   guarantees byte-for-byte semantic parity with the current runtime —
   top-level `const`→`var`, shared global scope, same JSX transform.
4. Write `dist/loomwright.bundle.js` (one classic script, not a module,
   so top-level `var`s attach to `window` exactly like today).
5. Generate `dist/index.html`: same `<head>` (CSS + fonts), vendored
   `react.development.js` + `react-dom.development.js` (**no babel.min.js**),
   then a single `<script src="loomwright.bundle.js"></script>`.
6. Copy CSS files, `vendor/react*.js` (not babel), and any static
   assets into `dist/`.

Why not Vite's own JSX transform? Vite rewrites JSX into ESM/runtime
code that can't run as a classic global-scope script and would break
the cross-file global sharing the app depends on. Using Babel Standalone
in Node mirrors the runtime exactly and avoids a risky module rewrite.

Why not esbuild? Not a dependency; sandbox may block installs.
`@babel/standalone` is already vendored + pinned.

## 6. What remains as fallback

- `Loomwright Shell.html` stays as the **legacy/dev design shell**
  (in-browser Babel). Marked clearly in docs + a comment as
  "legacy/dev entry — production entry is `dist/index.html` via
  `npm run build`".
- `scripts/build-static.js` is replaced by `scripts/build-production.js`
  (the `build` script repoints). The raw-copy behavior is no longer the
  build output; the legacy shell is still runnable via `npm run dev`.
- Stale `Loomwright.bundle.jsx` (if present) remains untouched and is
  documented as stale.

## 7. Testing strategy

- `npm run build` must complete and emit `dist/index.html` +
  `dist/loomwright.bundle.js` + CSS + vendor/react.
- A new `scripts/check-production-build.js` (run inside `validate` or
  standalone) asserts: bundle exists, is non-trivial in size, contains
  no `text/babel` markers, `dist/index.html` references the bundle and
  **not** `babel.min.js`, and has no `unpkg`/CDN script src.
- New Playwright project / spec `tests/e2e/15-production-build.spec.js`
  runs against `vite preview` serving `dist/` on a separate port: app
  boots, Writer's Room renders, Settings opens, a panel opens, backend
  initialises (`window.LoomwrightBackend` present), no fatal console
  errors. Added as `npm run test:e2e:preview`.
- Existing `npm run test:e2e` (dev shell) stays as-is so the full
  75-test suite keeps running against the canonical source. The
  production suite is a focused boot-smoke set (the full suite drives
  the same components, so a boot-parity check is sufficient to prove
  the build path).

## 8. Risks

- **Symbol collisions on concat**: two files declaring the same
  top-level `const` would `SyntaxError` if compiled as a module, but
  the runtime config converts to `var` (legal redeclaration), so the
  bundle behaves like the current multi-script load. Mitigated by using
  the **exact** runtime Babel config. If a genuine duplicate-`var`
  initialization causes a logic bug, the build-check + preview e2e will
  catch it at boot.
- **Top-level execution side effects** (e.g. `initialise()` in
  backend-services) run in the same order — preserved by ordered concat.
- **`document`/`window` timing**: `app.jsx` mounts last, same as today.
- **Source maps**: omitted for v1 (file banners give rough locality);
  a follow-up can add concatenated source maps.
- **CSS/asset paths**: relative paths preserved by copying into `dist/`.

## 9. Out of scope (strict)

- No new features, no extraction/field-parity/workspace/search/audit/AI
  changes except build-related bug fixes.
- No UI redesign, no panel rebuilds.
- No rewrite of modules into ES modules.
- No source-map pipeline (noted as future).
- No mobile wrapper, cloud sync, collaboration, payments, hosted backend.
- No minification beyond what Babel emits (a minify pass is optional
  future polish; correctness first).

## Commit plan

1. `PRODUCTION_BUILD_PLAN.md` (this commit, no code).
2. `scripts/build-production.js` + `scripts/check-production-build.js`;
   `package.json` scripts (`build`, `preview`, `test:e2e:preview`);
   production-preview Playwright config.
3. `tests/e2e/15-production-build.spec.js`.
4. Legacy-shell documentation note + `README.md` + readiness docs.
5. `PRODUCT_READINESS_REPORT.md`, `PRODUCT_COMPLETION_AUDIT.md`,
   `FINAL_QA_REPORT.md` updates.

Each step verified with `npm run validate` + `npm run build` +
`npm run test:smoke`. Full `npm run test:e2e` + `npm run test:e2e:preview`
at the end.

## Acceptance bar

- `npm run build` emits a precompiled bundle + production `index.html`
  with no in-browser Babel and no CDN runtime dependency.
- `npm run preview` serves the built app; it boots and behaves
  identically to the dev shell.
- `npm run test:e2e:preview` proves production boot (app + Writer's
  Room + Settings + panel + backend init, no fatal console errors).
- `npm run validate` still 0 Bucket A; `npm run test:smoke` + full
  `npm run test:e2e` (dev) still green.
- Production Build Pipeline moves to **Implemented**; product label
  becomes **"local beta candidate"**.
