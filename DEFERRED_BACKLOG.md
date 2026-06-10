# Deferred backlog

Updated after completion pass 2 (extraction upgrades + surface gaps).
Everything below the line is **done and verified**; the short list at the
bottom is what remains intentionally out of scope.

## Completed in completion pass 2

### Day 1 — extraction model upgrades (E1–E6, spec 34, smoke [exq]/[pron]/[enrich])
- AI deep-pass fields map onto real editor fields on accept (`mapAiPayloadToData`); owner/member names resolve to entity refs.
- Fuzzy near-duplicate names (≥0.80) promote to merge suggestions instead of new records; discovery skips near-existing names.
- Title/epithet alias clustering ("Captain Brec" ↔ "Brec").
- Offline pronoun resolution (he/she/they → recent gender-compatible cast mention, flagged `isPronounResolution`); dossier mention counts benefit.
- Detector confidence calibration + chunk-overlap dedupe by offsets.
- "Fill from manuscript" per-entity enrichment (Cast dossier chip + entity editor footer; provider-gated with a useful local path).

### Day 3 — mobile app version (M1–M5, spec 35 + preview PWA tests)
- Phone shell (≤700px): bottom nav + Browse/More sheets replace the rail;
  panels are one full-screen sheet at a time with a collapsed strip.
- Installable PWA: manifest + maskable icon + build-stamped cache-first
  service worker (production only); responsive viewport everywhere.
- Touch: pointer-event drags + pinch zoom on tangle & skill-tree
  canvases; tap-to-add tray fallback; enlarged atlas pin hit-targets.

### Day 2 — every remaining demo surface live (S1–S7, spec 36)
- Research Library: real linked-entity chips + inline Link-entity picker; AI/style/canon toggles persist.
- Trash: workspace + docked panel fully live (real rows, preview, restore, double-confirmed purge).
- Relationship workspace embeds the live graph + live health rail.
- Command palette: demo rows deleted; real actions; designed empty state; index-update re-search.
- System docked panels live: Review (cross-type queue), Today, Recent (audit activity), Active references; honest Notifications empty state.
- Legacy purge: panels.jsx deleted; legacy settings fallback + demo Speed Reader workspace removed; Tangle workspace renders the real canvas; speed reader reads YOUR chapters (samples only with the sample project).
- Settings ▸ Extraction: per-detector confidence sliders driving the live detectors.

## Completed in the full completion pass (pass 1)

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
