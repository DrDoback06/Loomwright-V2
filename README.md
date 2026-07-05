# Loomwright

A local-first writing and worldbuilding app: a manuscript editor (the **Writer's Room**)
fused with a DM-style story tracker — cast, locations, items, quests, events,
relationships, timelines, factions, classes, races, skills, stats, bestiary, lore and
references — fed by an extraction pipeline that turns your prose into a cross-linked
codex, with optional bring-your-own-key AI.

**This branch is the completed ground-up rebuild.** The previous prototype lives in
[`legacy/`](legacy/) (reference only — do not edit) and its design documentation in
[`docs/legacy/`](docs/legacy/). The rebuild's rule: **no surface ships unless every
visible control genuinely works**, proven by Playwright tests that click real rendered
buttons and re-assert after a reload. The full control-by-control inventory is
[`docs/rebuild/SURFACE_CHECKLIST.md`](docs/rebuild/SURFACE_CHECKLIST.md).

## What's inside

- **Writer's Room** — TipTap manuscript editor with persistent formatting, chapter
  management, paragraph notes, and a hardened autosave (flushes on chapter switch, tab
  hide, and page close — losing work is treated as a P0 bug, and tests prove it).
- **Extraction → Review → Codex** — an offline scanner (occurrences, pronoun resolution,
  12 phrase detectors, NER discovery, alias clustering) proposes entities and updates from
  your prose. *Everything* goes through the Review queue — nothing edits the codex
  silently. Known-entity mentions highlight in the manuscript; click one to open its
  dossier.
- **16 codex types** with config-driven editors and dossiers, cross-panel focus (select in
  one panel, others react), selection lock, and a project-wide merge that rewrites every
  mention, reference, and pending candidate in one transaction.
- **Canvases** — Atlas map (pins, layers, derived travel routes), relationship graph
  (d3-force), skill-tree constellations, and the Tangle corkboard (entity cards, labelled
  threads, board templates).
- **AI, three ways, all optional** — in-app BYOK (OpenAI / OpenRouter / Anthropic /
  Gemini / Ollama; keys AES-GCM-encrypted on device, never exported), an AI Handoff
  pack + paste-back loop for any external chat AI, and a local-only mode that blocks every
  external call while the whole app keeps working offline.
- **Tools** — command palette (Ctrl/Cmd+K), Today dashboard (words today, next quest
  steps, review queue, dusty entities), random tables, RSVP speed reader, entity/board
  templates with genre starters.
- **Interchange** — full project export/import (`loomwright-project-v2`, keys never
  included), world-bible export (Markdown/HTML), reference ingestion from paste or files.
- **Onboarding interview** — a seven-step guided setup: premise/themes/tone, offline
  writing-style analysis, cast/world seeds (with offline NER suggestions from your own
  text), manuscript import with automatic chapter splitting and a first extraction pass,
  and AI/privacy setup. Drafts persist; every answer is consumed.
- **PWA** — installable, fully offline (service-worker precache + IndexedDB), mobile
  bottom-nav shell with Browse/More sheets.

## Stack

Vite + React 19 + TypeScript · Dexie (IndexedDB) for all domain data · zustand for
ephemeral UI state · TipTap for the manuscript editor · minisearch · d3-force ·
self-hosted fonts · installable PWA. Fully client-side: your writing never leaves the
browser unless you explicitly use a configured AI provider or export.

## Develop

```sh
npm install
npm run dev        # local dev server
npm run verify     # typecheck + lint + unit tests + production build
npm run test:e2e   # Playwright, real-click, desktop + Pixel-7 mobile projects
```

Testing rules (enforced): specs act only through real rendered controls
(`getByRole`/`getByLabel`/`getByTestId` + real clicks and keystrokes), every mutation
re-asserts after a reload, AI HTTP is always mocked with `page.route`, and real API keys
never appear anywhere. The extraction engine is pinned by 16 golden fixtures in
`tests/fixtures/extraction/`.

## Deploy

Pushes to `claude/loomwright-rebuild-h5da7r` run the verify suite and publish `dist/` to
GitHub Pages via `.github/workflows/deploy.yml`. (One-time repo setting: Pages → Source →
GitHub Actions.)

## Repository map

- `src/` — the app (features, services, stores, db)
- `tests/unit`, `tests/e2e` — vitest + Playwright suites
- `tests/fixtures/extraction/` — golden fixtures pinning extraction behaviour
- `docs/rebuild/` — architecture, testing rules, and the surface checklist
- `legacy/`, `docs/legacy/` — the previous prototype and its design docs (read-only reference)
