# Loomwright

A local-first writing and worldbuilding app: a manuscript editor (the Writer's Room) fused
with a story tracker — characters, locations, items, quests, events, relationships,
timelines, lore and more — fed by an extraction pipeline that turns your prose into a
cross-linked codex, with optional bring-your-own-key AI.

**This branch is the ground-up rebuild.** The previous prototype lives in [`legacy/`](legacy/)
(reference only — do not edit) and its design documentation in [`docs/legacy/`](docs/legacy/).
The rebuild's rule: **no surface ships unless every visible control genuinely works**, proven
by Playwright tests that click real rendered buttons and re-assert after a reload.

## Stack

Vite + React 19 + TypeScript · Dexie (IndexedDB) for all domain data · zustand for
ephemeral UI state · TipTap for the manuscript editor · self-hosted fonts · installable PWA.
Fully client-side: your writing never leaves the browser unless you explicitly use a
configured AI provider or export.

## Develop

```sh
npm install
npm run dev        # local dev server
npm run verify     # typecheck + lint + unit tests + production build
npm run test:e2e   # Playwright, real-click, desktop + mobile projects
```

## Deploy

Pushes to `claude/loomwright-rebuild-h5da7r` run the verify suite and publish `dist/` to
GitHub Pages via `.github/workflows/deploy.yml`.

## Repository map

- `src/` — the app (features, services, stores, db)
- `tests/unit`, `tests/e2e` — vitest + Playwright suites
- `tests/fixtures/extraction/` — golden fixtures pinning extraction behaviour
- `docs/rebuild/` — rebuild architecture + surface checklist
- `legacy/`, `docs/legacy/` — the previous prototype and its design docs (read-only reference)
