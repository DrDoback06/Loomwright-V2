# Deferred backlog

Items intentionally deferred from completed areas, to be covered in their
owning area later. Each notes WHERE the data already lands so the later work is
display/seed wiring, not a rebuild.

## From Area 1 — Extraction
- ~~**Relationships tab live rendering**~~ — **DONE in Area 4.** The
  Relationships panel (`relationships.jsx`) now renders live: it resolves
  persisted `relationships` entities (both the extraction shape
  `{fromId,toId,relationshipType}` and the editor shape
  `{from,to,bondType,intensity,valence}`) into graph edges + compare meters,
  drives the character bar from live cast, derives change history from the
  audit log, and feeds pending candidates into the Review tab. See
  `AREA_4_RELATIONSHIPS_AUDIT.md`.
- **Skill-tree assignment selector on skill candidates** — discovered skills
  land as entities; assigning them to a tree needs the skill-tree system. →
  **Skill Trees (Area 4/7)**.
- **Travel/location display** — `cast.data.location` is set on accept; showing
  it in the Cast dossier + an Atlas travel line. → **Area 3 (Cast) / Atlas**.
- **Source-quote provenance shown in dossiers** (the occurrence carries it). →
  **Area 3 (Cast dossier)**.
- **Two-pass relationship extraction** (richer relationship records). → later
  extraction-quality pass.

## From Area 4 — Relationships (visual tab)
- **Unify the two relationship `data` shapes** — the Relationships reader
  tolerates both the extraction shape (`fromId`/`toId`/`relationshipType`) and
  the entity-editor shape (`from`/`to`/`bondType`/`intensity`/`valence`). A later
  pass could make both writers emit one canonical shape so meters/type aren't
  inferred. → extraction-quality / editor polish.
- **Explicit per-relationship change tracking** — the History/Recent-changes
  view derives from the coarse audit log (create/update/accept/deny). Richer
  trust/type/secret deltas across chapters need dedicated change records. → later.
- **Shared-places / travel line between two characters** — Compare → "Show shared
  places" opens the Atlas today; drawing the shared-location line is Atlas work.

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

## Cross-cutting (not yet scheduled)
- **Multi-project support** (single project per device today).
- **AI Writer model picker UI** (routing already supports per-task models).
- **Offline grammar/spell/thesaurus** in the Writer's Room (Word-like). →
  **Writers Room polish**.
