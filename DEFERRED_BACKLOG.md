# Deferred backlog

Items intentionally deferred from completed areas. Updated for the Area 4
completion pass (visual tabs all live + demo purge).

## Completed in the Area 4 pass (was deferred, now done)
- ~~Relationships tab live rendering~~ — all six modes live
  (`LinkService.listRelationshipEdgesSync`, spec 21).
- ~~Timeline tab live rendering~~ — events/timeline stores drive the designed
  cards, inspector, filters, review (spec 22).
- ~~Skill-tree assignment selector on skill candidates~~ — drafts rail in the
  constellation editor assigns accepted candidates into a chosen tree (spec 23).
- ~~Skill Trees designed canvas~~ — the constellation editor is the live panel
  (drag/connect/unlock/groups/validate/auto-layout persist; spec 23).
- ~~Travel/location display (Atlas)~~ — character travel routes derive from
  shared-chapter occurrences; roads/connections render from `data.routes`
  (spec 24). The Cast-dossier travel line remains below.
- ~~Atlas live map + editor tools~~ — placements, hierarchy, click-to-place,
  pin dragging, route drawing (spec 24).
- ~~Lore/Canon + References tabs~~ — live records, contradiction flow, AI
  instructions read/write `ProjectIntelService.canonRules` (spec 25).
- ~~AI Writer panel~~ — live context, drag-in entities, provider-gated
  generation, real previews, working insert/accept/create-chapter (spec 26);
  the panel is now reachable from the live panel renderer.
- ~~Home demo strings~~ — active chapter, words-today (daily baseline in
  `writingStatsSync`), derived pace line (spec 26).
- ~~Demo data purge~~ — per-panel Review tabs read
  `ReviewService.listCardViewsSync`; `ENTITY_REVIEW_SAMPLES` /
  `ENTITY_SUGGESTION_SAMPLES` / `*_REVIEW` / `AI_PREVIEWS` / `HOME_*` demo
  constants deleted; sample fixtures live only under `__LW_SAMPLE_SOURCES__`
  and seed real entities on the opt-in sample load (spec 27).

## Still deferred

### From Area 1 — Extraction
- **Source-quote provenance shown in the Cast dossier** (the occurrence and
  accepted `data.sourceQuote` carry it). → dossier polish pass.
- **Cast dossier travel line** — `cast.data.location` set on accept; show the
  designed travel row + "Show on Atlas". → dossier polish pass.
- **Two-pass relationship extraction** (richer relationship records — the
  Relationships panel already renders strength/trust/conflict when present).
  → extraction-quality pass.

### From Area 2 — Onboarding
- **Genre RPG entity templates** — seed example classes/races/abilities from
  the chosen genre/template. → templates feature.
- **"Import existing project"** — wire the Welcome import option to
  `ProjectArchiveService.applyImport`. → onboarding follow-up.
- **Apply workspace.* layout prefs** — editorWidth/font/margins/panelStack
  persisted but not read by the Writer's Room. → Writers Room polish.
- **Deeper AI style critique** of the voice sample (local metrics done).
  → AI polish pass.

### From the pre-Area-3 fixes pass — adaptive wheel
- **Full cross-app wheel context-awareness** — extend wheel contexts to map
  nodes, relationship nodes, timeline events. → adaptive wheel pass.
- **Wheel "Tag" action** — placeholder notice; lands with entity tagging.
- **Deep (BYOK) model picker on the wheel** — per-action model chooser.

### Cross-cutting (not yet scheduled)
- **Tangle story board** — designed UI pending live build (next phase).
- **Random tables / generators**, **Markdown/HTML export**, **reusable
  templates** — planned Alkemion-inspired features.
- **Gemini adapter** (routing already accommodates it).
- **Atlas layer opacity slider** (`atlas-editor.jsx` layers tab).
- **Multi-project support** (single project per device today).
- **AI Writer model picker UI** (routing already supports per-task models).
- **Offline grammar/spell/thesaurus** in the Writer's Room.
