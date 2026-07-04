# Loomwright rebuild — testing rules

The legacy suite drove synthetic `lw:*` events and `page.evaluate`, which let dead buttons
pass. These rules exist so that cannot happen again.

## E2E (Playwright, `tests/e2e/`)

- Two projects run for every spec: `desktop-chromium` and `mobile-chromium` (Pixel 7).
- Interact **only** via real rendered controls: `getByRole` / `getByLabel` / `getByTestId`
  + `click` / `fill` / `press` / `mouse`. Never `page.dispatchEvent`.
- Every spec that mutates data must `reload()` and re-assert — persistence is a
  first-class requirement (the user has lost work to the legacy app).
- `page.evaluate` is allowed only for **read-only** assertions.
- AI providers are always mocked with `page.route`; live keys never appear in tests.
- Local sandbox: `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test`.
  CI installs browsers via `npx playwright install chromium`.

## Unit (vitest, `tests/unit/`)

- Repos and services run against `fake-indexeddb` — the real Dexie code path.
- The extraction fixture runner executes every fixture in `tests/fixtures/extraction/`;
  those fixtures are the extraction contract. Change behaviour → update fixtures
  deliberately, never incidentally.

## Gate

`npm run verify` = typecheck + lint + unit + build. CI (`.github/workflows/deploy.yml`)
additionally runs the full e2e matrix before deploying to GitHub Pages.
