# Loomwright v2 — Backend Implementation Audit

This file records the audit performed before backend wiring began.

## Entry Point

- `index.html` redirects to `Loomwright Shell.html`.
- `Loomwright Shell.html` is the canonical entry. It loads all `.jsx` modules
  via `<script type="text/babel" data-presets="react">` tags and inlines the
  Writer's Room module between an inline `<script type="text/babel">` block
  (the standalone `writers-room.jsx` file mirrors that block — both must be
  updated when Writer's Room logic changes so the file stays a faithful
  source-of-truth artifact).

## Loader constraints

- The app uses Babel-standalone at runtime — there is **no bundler**.
- Scripts are loaded individually and share the global `window` scope.
- New modules MUST attach exported symbols to `window` so other scripts can
  reach them. ES module `import`/`export` syntax is unsupported.

## Bundled artefacts to ignore

- `Loomwright.bundle.jsx`
- `Loomwright Shell - Standalone.html`
- `Loomwright Shell.standalone-src.html`
- `Loomwright Shell-print.html`

These are generated review artefacts (per `README.md`).

## Verification

- `npm install` succeeds.
- `npm run validate` passes — all HTML references resolve.
- `Loomwright Shell.html` mounts the `AppShell` from `app.jsx` and renders the
  Writer's Room route by default.

## Backend strategy

- Persistence layer: `lw-storage.jsx` (wraps `window.localStorage` behind an
  async interface so it can be swapped for IndexedDB later).
- Domain services: `lw-services.jsx` (entities, references, onboarding,
  project intelligence, keys, handoff).
- All services attach to `window.Loomwright` and individual globals
  (`StorageService`, `EntityService`, ...).
- API surface mimics REST (`list`, `get`, `save`, `delete`) so swapping to a
  remote API is a one-file change.

## BYOK / Security

- API keys are AES-GCM encrypted via `window.crypto.subtle`.
- Encryption key is derived per-browser via PBKDF2 from a passphrase the user
  can configure in Settings; default passphrase is the static project salt
  (suitable for the local-only demo, **not** suitable for production).
- All AI requests are mocked — no network calls are issued by default.

## Files added by backend integration

| File | Phase | Purpose |
| --- | --- | --- |
| `lw-storage.jsx` | 1 | Async `StorageService` wrapping `localStorage` |
| `lw-services.jsx` | 2,6,7,8 | Entity / References / Onboarding / ProjectIntel services |
| `lw-crypto.jsx` | 10 | Web Crypto wrappers + `KeysService` |
| `lw-handoff.jsx` | 9 | Handoff Pack generator and AI-result parser |
| `lw-backup.jsx` | 11 | Project import/export bundle |
| `lw-bootstrap.jsx` | 1 | Wires services to `window` + hydrates initial state |

All files are loaded by `Loomwright Shell.html` *before* `app.jsx` so the
services are available to UI handlers at first render.
