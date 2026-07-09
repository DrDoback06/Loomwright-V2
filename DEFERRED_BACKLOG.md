# Deferred backlog

Items intentionally deferred from completed areas, to be covered in their
owning area later. Each notes WHERE the data already lands so the later work is
display/seed wiring, not a rebuild.

## From Area 1 — Extraction
- ~~**Relationships tab live rendering**~~ — **DONE (Area 4).** Every mode of
  the Relationships panel (`relationships.jsx`) now reads the live store:
  cast from `EntityService("cast")`, edges from `EntityService("relationships")`
  (tolerating both the extraction shape `data.fromId/toId/relationshipType` and
  the editor shape `from/to/bondType/intensity/valence`), the review tab from
  `ReviewService("relationships")` with real Accept/Edit/Merge/Deny, hopes/fears
  from each character's `goals`/`fears`, and honest empty states throughout.
  Covered by `tests/e2e/21-relationships-live.spec.js`.
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

## From Area 4 — visual tabs
- **Relationships** — done (see the Area 1 entry above).
- **Timeline / Skill Trees / Atlas / Tangle live rendering** — these workspaces
  still paint module-level demo constants (`TL_EVENTS`, `SKILL_TREES`,
  `ATLAS_*`) on first render when the live store is empty. Same treatment as
  Relationships: read `EntityService`/`ReviewService`, honest empty states. →
  **remaining Area 4 passes** (one workspace per pass).
- **Relationship History timeline** — the History mode groups edges by the
  chapter they were discovered in; a per-edge change log (trust/type deltas over
  chapters) needs a stored change trail, deferred to an extraction-quality pass.

## Cross-cutting (not yet scheduled)
- **Multi-project support** (single project per device today).
- **AI Writer model picker UI** (routing already supports per-task models).
- **Offline grammar/spell/thesaurus** in the Writer's Room (Word-like). →
  **Writers Room polish**.
