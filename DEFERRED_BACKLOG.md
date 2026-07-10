# Deferred backlog

Items intentionally deferred from completed areas, to be covered in their
owning area later. Each notes WHERE the data already lands so the later work is
display/seed wiring, not a rebuild.

## From Area 1 — Extraction
- ~~**Relationships tab live rendering**~~ — ✅ **Done in Area 4.** The
  Relationships tab now builds a live model (`buildLiveRelModel`) from
  `relationships` entities + cast related-multi fields and graphs it; demo
  data is fallback-only. See `AREA_4_VISUAL_TABS_AUDIT.md`.
- ~~**Skill-tree assignment selector on skill candidates**~~ — ✅ **Done in
  Area 4.** `SkillTreeLiveManager` now has an "Add discovered skill" picker
  listing `skills` entities not yet in the tree.
- ~~**Travel/location display**~~ — ✅ **Done.** `cast.data.location` (set by
  the extraction travel pass) now resolves in the Cast dossier as the
  "Currently" location + an Atlas-linked place. The animated Atlas travel line
  itself remains → **Atlas polish**.
- **Source-quote provenance shown in dossiers** (the occurrence carries it). →
  **Area 3 (Cast dossier)**.
- **Two-pass relationship extraction** (richer relationship records). → later
  extraction-quality pass.

## From Area 2 — Onboarding
- **Genre RPG entity templates** — seed example classes/races/abilities from the
  chosen genre/template. The template + toggles + custom stats are captured and
  persisted (custom stats already seed real Stats entities). → **RPG depth**.
- **"Import existing project"** — the Welcome "import" start option has no
  file-import flow in onboarding; wire it to `ProjectArchiveService.applyImport`.
  → onboarding follow-up / Project I/O.
- **Apply workspace.* layout prefs** — the Writer's Room now reads
  `workspace.editorWidth` + `workspace.font` (CSS vars on `.wr-canvas`) in
  addition to startTab (routing) and mobileCompact. Still deferred:
  `margins`/`panelStack`/`chapterRail` (these interact with the runtime
  layout-mode system). → **Writers Room polish**.
- **Deeper AI style critique** of the voice sample beyond the local metrics
  (which are implemented). → **AI Writer area**.

## From the pre-Area-3 fixes pass — adaptive wheel
- **Full cross-app wheel context-awareness** — the wheel is now context-aware
  over the manuscript (selection / chapter / entity-span) and exposes Standard
  (free/local) + Deep (BYOK) AI/extraction actions. Extending contexts to map
  nodes, relationship nodes, timeline events, and every tab's items is the rest
  of → **Area 6 (adaptive wheel)**.
- **Wheel "Tag" action** — currently a placeholder notice; real tagging lands
  with the entity tabs/dossier. → **Area 7/8**.
- ~~**Deep (BYOK) model picker on the wheel**~~ — ✅ **Done in Area 5.** The
  "Deep · AI" wheel slots now advertise the resolved `deepExtraction` model
  (sublabel + tooltip); the model is chosen in Settings → AI routing.
- **Apply remaining `workspace.*` prefs** — `workspace.mobileCompact`,
  `editorWidth`, and `font` are now read by the Writer's Room;
  margins/panelStack/chapterRail still aren't (see Area 2 entry above). →
  **Writers Room polish (Area 8)**.

## From Area 4 — Visual tabs
- **Numeric relationship meters + change tracking** — live relationship
  records carry no strength/trust/conflict values or change history; the tab
  renders type-shaped default meters and the Timeline view shows an empty
  state. → **relationship-quality pass**.
- **Visual constellation canvas** for skill trees (drag-and-drop node
  layout). The live manager (create/connect/assign/lock) is complete. →
  **Skill Trees polish**.

## From Area 5 — AI Writer
- ~~**AI Writer / per-task model picker UI**~~ — ✅ **Done.** Settings → AI
  routing now renders a provider + model picker per AI task
  (`SetAITaskRouting`), persisted to `AIRoutingService.taskRoutes` which
  `resolveRoute` already honours. Curated model shortlists per provider +
  free-text custom. See `AREA_5_AI_WRITER_AUDIT.md`.
- **Deeper AI style critique** of the voice sample beyond the local metrics. →
  still open (needs a live AI call flow).

## Cross-cutting (not yet scheduled)
- **Multi-project support** (single project per device today).
- **Offline grammar/spell/thesaurus** in the Writer's Room (Word-like). →
  **Writers Room polish**.
