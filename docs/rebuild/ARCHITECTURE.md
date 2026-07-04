# Loomwright rebuild — architecture

## Principles

1. **No dead buttons.** A control renders only when its action genuinely works. Surfaces
   join the nav as their milestone lands. The legacy `data-callback` string-dispatch system
   is banned by an eslint rule (`no-restricted-syntax`), as is `window.dispatchEvent`.
2. **Domain data lives in Dexie (IndexedDB), read via `useLiveQuery`.** No parallel cache
   to fall out of sync. zustand holds only ephemeral UI state (layout, focus, palette,
   toasts) plus a settings mirror.
3. **Everything is project-scoped.** Every table row carries `projectId`; compound indexes
   `[projectId+…]` back every query.
4. **TypeScript strict.** Wiring mistakes are compile errors, not runtime toasts.
5. **Local-first.** No server. AI is BYOK via user-configured providers; keys are
   AES-GCM-encrypted with a non-extractable CryptoKey. Nothing leaves the browser without
   explicit user action.

## Layers

```
src/
  db/         Dexie schema + repos (all writes go through repos: audit + search hooks)
  domain/     entity types + per-type editor/field configs (data, not code)
  services/   pure logic: extraction detectors, AI adapters/routing, archive, search…
  stores/     zustand: ui/layout/focus/workspace/toasts
  features/   React surfaces (shell, writers-room, codex, workspaces, …)
```

## Legacy

The previous prototype is in `legacy/` (do not edit) with its design docs in
`docs/legacy/`. The `*_HOOKUP.md` files there are the per-surface design intent — treat
them as the spec when porting a surface. `tests/fixtures/extraction/` pins extraction
behaviour and must stay green.
