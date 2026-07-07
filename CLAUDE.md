# Loomwright V2 — agent orientation

**⚠️ READ `docs/HANDOFF.md` FIRST — before writing any code.**
It is the live source of truth for in-flight work: the app-wide generation system
(milestones G1–G8, partially complete on branch `claude/entity-creation-generation-vafhf4`)
and the fully-specified next milestone family, **Extraction 2.0 — Story Intelligence**
(§10 — the product's most important feature: one-button whole-book extraction with
relational propagation and a forward-thinking suggestions engine). It tells you exactly
what is done, what remains, and in what order.

## Commands

- `npm run dev` — Vite dev server
- `npm run lint` — eslint over `src` + `tests` (must be clean)
- `npx tsc --noEmit` — typecheck (note: only `npm run build` / `tsc -b` enforces
  `noUnusedLocals`/`noUnusedParameters`; e2e's webServer builds, so run build if e2e
  fails with "webServer exit code 2")
- `npx vitest run` — unit tests (`tests/unit/`, fake-indexeddb)
- `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` — e2e (`tests/e2e/`),
  runs BOTH desktop and mobile projects; new UI must pass on both

## Non-negotiable rules

- **No dead buttons**: every rendered control genuinely works AND has a row in
  `docs/rebuild/SURFACE_CHECKLIST.md` naming the spec that proves it.
- Zero new runtime dependencies. TypeScript strict. Styles are `lw-*` classes in
  `src/styles/components.css`. All data lives in Dexie/IndexedDB (project-scoped);
  Zustand is UI state only.
- AI is bring-your-own-key only; e2e mocks provider HTTP via `page.route` — never
  real keys. API keys are encrypted and must never appear in exports, search, or audit.
- `/legacy` is the old prototype — reference only; its callback system is banned by eslint.
- Commit + push per milestone to the designated branch; never push elsewhere.

## Architecture map (details in `docs/rebuild/ARCHITECTURE.md` + `docs/HANDOFF.md` §2)

`src/domain/entity-configs/` (config-driven editors for 16 entity types — the machine-
readable source most systems derive from) · `src/db/` (Dexie schema/repos, soft-delete
trash, reversible audit log) · `src/services/` (extraction engine, AI layer, archive,
**generate/** — the generation system) · `src/features/` (one folder per surface) ·
`src/stores/` (Zustand).
