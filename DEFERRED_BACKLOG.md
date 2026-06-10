# Deferred backlog

Updated after the full completion pass (Area 4 visual tabs → Phase 18).
Everything below the line is **done and verified**; the short list at the
bottom is what remains intentionally out of scope.

## Completed in the full completion pass

### Area 4 — every visual tab live (phases 1–7)
- Relationships: all six designed modes live (`LinkService.listRelationshipEdgesSync`, spec 21).
- Timeline: live events/timeline stores drive eras, cards, inspector, filters, review (spec 22).
- Skill Trees: the designed constellation editor IS the panel — drag/connect/unlock/groups/validate/auto-layout persist; extraction candidates assign into a chosen tree (spec 23).
- Atlas: live map + hierarchy + editor tools (click-to-place, pin drag, route drawing), derived character travel routes, road lines, sample seeding (spec 24); per-layer opacity persisted (U24b).
- Lore/Canon + References: live records, contradiction flow, AI instructions ↔ `ProjectIntelService.canonRules`, reference toggles/tags/archive (spec 25).
- AI Writer: live context, drag-in entities, provider-gated generation with real previews, insert/accept/create-chapter; panel reachable from the live renderer (spec 26). Home stats truthful (words-today baseline, pace) (spec 26).
- Demo purge: per-panel Review tabs read `ReviewService.listCardViewsSync`; every demo constant deleted; sample fixtures live only under `__LW_SAMPLE_SOURCES__` and seed real entities on the opt-in sample load (spec 27).

### Alkemion-inspired features (phases 8–13)
- Tangle story board: boards, first-class labelled/directed multi-edges, entity-bound cards with merge rebinding, designed canvas fully persistent, panel enabled everywhere (specs 28, smoke [tangle]).
- Random tables: `RandomTableService` with builtin starters, weighted/unique rolls, history, panel + wheel action, results → Writer / entity (spec 30, smoke [rt]).
- Markdown/HTML world-bible export with manuscript/codex scoping (spec 31, smoke [md]).
- Reusable templates: entity templates (incl. genre starters — the deferred "genre RPG entity templates") + tangle board templates; entity-editor "Start from" strip + Save-as-template; export/import (spec 32, smoke [tpl]).
- Entity editor round-trip fixed: id-initials hydrate, flat fields pack into `entity.data` (spec 32).

### Remaining deferred items (phases 14–17)
- Cast dossier travel line + "Show on Atlas" + "First evidence" provenance card (spec 33).
- Onboarding "Import existing project" → validated import completes setup (spec 33).
- `workspace.*` prefs applied live (canvas width/font/margins) + Settings ▸ Editor controls (spec 33).
- Two-pass relationship extraction in the deep path (smoke [rel2]).
- Gemini adapter; provider-gated AI style critique in onboarding; Atlas layer opacity slider (U24b).
- Cast bulk operations: tag/delete/merge multiple + wheel Tag action (spec 29).

## Still intentionally out of scope
- **Multi-project support** (single project per device today).
- **Cloud sync / collaboration** (local-first by design).
- **Managed AI provider** (waitlist entry stays disabled by design — BYOK only).
- **AI Writer per-action model picker UI** (routing already supports per-task models in Settings ▸ AI routing).
- **Offline grammar/spell/thesaurus** beyond the browser's spellcheck (Settings toggles store preferences; a packaged dictionary engine is future work).
- **Full cross-app adaptive-wheel context coverage** (manuscript contexts are live; per-tab item contexts can grow incrementally).
- **Source maps / minification** for the production bundle (correctness-first build ships unminified).
