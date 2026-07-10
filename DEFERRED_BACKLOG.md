# Deferred backlog

Items intentionally deferred from completed areas, to be covered in their
owning area later. Each notes WHERE the data already lands so the later work is
display/seed wiring, not a rebuild.

## From Area 1 — Extraction
- **Relationships tab live rendering** — ✅ **DONE in Area 4.** The
  Relationships tab now renders live cast + persisted `relationships` records
  (`data.fromId`/`toId`/`relationshipType`) unioned with per-cast related-multi
  fields, with a live review queue. See `AREA_4_RELATIONSHIPS_AUDIT.md`.
- **Skill-tree assignment selector on skill candidates** — discovered skills
  land as entities; assigning them to a tree needs the skill-tree system. →
  **Skill Trees (Area 4/7)**.
- **Travel/location display** — `cast.data.location` is set on accept; showing
  it in the Cast dossier + an Atlas travel line. → **Area 3 (Cast) / Atlas**.
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
- **Apply workspace.* layout prefs** — editorWidth/font/margins/panelStack etc.
  are now persisted to the `workspace` settings section, but the Writer's Room
  doesn't yet read them (startTab IS used for routing). → **Writers Room polish**.
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
- **Deep (BYOK) model picker on the wheel** — Deep actions route through the
  existing cost tier today; a per-action model chooser is the AI Writer model
  picker. → **Area 5 (AI Writer)**.
- **Apply remaining `workspace.*` prefs** — `workspace.mobileCompact` now drives
  the Writer's Room mobile/compact layout; editorWidth/font/margins/panelStack
  still aren't read (see Area 2 entry above). → **Writers Room polish (Area 8)**.

## From Area 4 — Relationships (tracked in AREA_4_RELATIONSHIPS_AUDIT.md)
- **Per-relationship meter/evidence editor** — the Entity Editor opens the
  `relationships` record, but a dedicated trust/conflict slider + evidence
  pinning surface is a later polish pass.
- **Atlas "shared places" cross-filter** (`onOpenAtlasForSharedLocations`) —
  dropped from the compare actions; lands with the Atlas focus area.
- **Character ↔ faction edges** — the `faction` relationship type exists but
  awaits the Factions live pass.

## From Area 5 — Timeline (tracked in AREA_5_TIMELINE_AUDIT.md)
- **Atlas "show on map"** (`onShowTimelineMomentOnAtlas`) — still a notice;
  lands with the Atlas focus area.
- **Date-conflict detection** — cross-chapter date reconciliation (the demo's
  Ch.2-vs-Ch.4 flag) is an extraction-quality follow-up.
- **Relationship / item timeline lanes** — the mode bar keeps character /
  location / quest / faction filters; dedicated per-relationship and per-item
  lanes await those live passes.

## From Area 6 — Lore & References (tracked in AREA_6_LORE_REFERENCES_AUDIT.md)
- **Live contradiction detection** — cross-chapter canon-conflict finding is an
  extraction-quality follow-up (the Contradictions tab shows an honest empty
  state today).
- **Inline AI-instruction editing** — canon rules render live/read-only; editing
  routes to onboarding. In-panel editor is later polish.
- **Reference tag editor + upload preview** — Upload/Paste save real refs; a
  richer tag/preview surface is deferred.

## Cross-cutting (not yet scheduled)
- **Multi-project support** (single project per device today).
- **AI Writer model picker UI** (routing already supports per-task models).
- **Offline grammar/spell/thesaurus** in the Writer's Room (Word-like). →
  **Writers Room polish**.
