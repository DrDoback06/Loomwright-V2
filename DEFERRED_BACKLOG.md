# Deferred backlog

Items intentionally deferred from completed areas, to be covered in their
owning area later. Each notes WHERE the data already lands so the later work is
display/seed wiring, not a rebuild.

## Area 4 — Visual tabs (in progress)
- **Relationships tab** — ✅ **DONE.** See the Area 1 entry below.
- **Timeline tab** — ✅ **DONE.** `timeline.jsx` now projects real `events`
  entities via `buildLiveTimelineDataset`: label/summary from the entity,
  participants resolved to live cast avatars, location resolved to live
  locations, per-event chapter derived from occurrences (drives era + sort),
  and review mode listing live event candidates (Accept/Deny wired to the real
  queue). Filter chips source from the live store when a real project exists.
  Demo constants remain a fallback for an empty project. The inspector now
  resolves the event's quest id to the quest name. Deferred within the tab: real
  per-event date-type/canon/era authoring (currently defaulted or heuristic) →
  later timeline-depth pass.
- **Skill Trees tab** — the panel (`SkillTreeLiveManager`) is already live-backed
  by `SkillTreeService` + `EntityService("skills")`. Remaining: the visual
  constellation canvas and a skill-candidate → tree assignment selector → later
  skill-tree-depth pass.

## Area 5 — AI Writer (in progress)
- **Per-task model picker** — ✅ **DONE.** Settings → AI routing & cost →
  *Per-task model routing* (`SetTaskRouting`); persists to
  `AIRoutingService.taskRoutes`. See the Cross-cutting entry below.
- **Composition draft generation** — ✅ **DONE.** The generate/insert loop is
  fully wired: the registry resolves `writingDraft`, builds bounded context,
  passes the privacy guard, calls `AIService.complete`, and dispatches
  `lw:composition-draft-generated`. The overlay now **surfaces that draft**
  (with a generating/failed state driven by registry events) and **Insert**
  splices the real generated text into the current chapter via
  `lw:composition-insert-draft`. The AI call itself is BYOK/provider-gated.
  Deferred: streaming token display, and an inline diff when inserting into
  existing prose → later AI-Writer-depth pass.
- **Deeper AI style critique** of the voice sample beyond the local metrics
  (implemented) still open. → AI Writer depth.

## From Area 1 — Extraction
- **Relationships tab live rendering** — ✅ **DONE (Area 4).** The Relationships
  tab (`relationships.jsx`) now renders the live entity store: cast + graph come
  from real `cast` entities, and relationships are derived from three live
  sources — the cast editor's relationship pickers (family/lovers/allies/…), the
  legacy inline `relationships` array, and standalone `relationships` entities
  accepted from extraction (`data.fromId`/`toId`/`relationshipType`). Verbs map
  to the eight type buckets, chapters are derived from shared occurrences, review
  mode lists live relationship candidates (Accept/Deny wired to the real queue),
  and hopes/fears read from `cast.data.goals`/`fears`. The demo constants remain
  a fallback for an empty project. Adapter: `buildLiveRelDataset`.
- **Skill-tree assignment selector on skill candidates** — discovered skills
  land as entities; assigning them to a tree needs the skill-tree system. →
  **Skill Trees (Area 4/7)**.
- **Travel/location display** — `cast.data.location` is set on accept; showing
  it in the Cast dossier + an Atlas travel line. → **Area 3 (Cast) / Atlas**.
- **Source-quote provenance shown in dossiers** — accepted candidates now
  persist `data.sourceQuote` (callback-registry `acceptQueueItem` +
  `autoApplyCandidate`), and the Relationships compare view cites it as
  evidence. Surfacing the same quote in the **Cast dossier** is still open. →
  **Area 3 (Cast dossier)**.
- **Two-pass relationship extraction** (richer relationship records). → later
  extraction-quality pass.
- **Live relationship meters / change-history** — strength/trust/conflict are
  currently keyed off the relationship type (the persisted record carries no
  meters), and History shows a derived "new relationship" event per pair. Real
  per-relationship meters + tracked change deltas are a later relationship-depth
  pass. → **Area 4/7 (relationship depth)**.

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
- **Full cross-app wheel context-awareness** — the wheel is context-aware over
  the manuscript (selection / chapter / entity-span) with Standard (free/local)
  + Deep (BYOK) actions. **Area 6 progress:** a reusable `lw:open-entity-wheel`
  mechanism now lets entity-tab nodes open the wheel with entity context
  (Open / Edit / Merge / Review resolve against the real entity). **Timeline
  event cards** (right-click / long-press) and **relationship cards backed by a
  real `relationships` entity** (single + conflict views) are wired. Remaining:
  Atlas map nodes and generic-framework tab rows → adopt the same
  `lw:open-entity-wheel` dispatch. → **Area 6 (adaptive wheel)**.
- **Wheel "Tag" action** — currently a placeholder notice; real tagging lands
  with the entity tabs/dossier. → **Area 7/8**.
- **Deep (BYOK) model picker on the wheel** — Deep actions route through the
  existing cost tier today; a per-action model chooser is the AI Writer model
  picker. → **Area 5 (AI Writer)**.
- **Apply remaining `workspace.*` prefs** — the Writer's Room now reads
  `mobileCompact`, `editorWidth`, `font`, `margins`, **`authorAttribution`**
  (drives the attribution toggle), **`chapterRail`** (`hidden` hides the chapter
  strip; left/right render the default top strip), and **`focus`** (starts the
  room in focus mode on mount). **`themeIntensity`** now modulates the app-wide
  accent (muted toward neutral grey at low intensity; strict no-op when unset so
  the default palette identity is preserved). Still unread: `panelStack` (needs
  the panel-stack layout modes) — the only remaining workspace pref. → **panel
  layout polish**.

## Cross-cutting (not yet scheduled)
- **Multi-project support** (single project per device today).
- **AI Writer model picker UI** — ✅ **DONE (Area 5).** Settings → AI routing &
  cost now has a **Per-task model routing** card (`SetTaskRouting`): each AI
  task (draft/rewrite/continue/extraction/continuity/intel/…) can be pinned to a
  configured provider + model or left on Auto, persisting to
  `AIRoutingService.taskRoutes` which `resolveRoute` already honours. Shows an
  empty note until a usable provider is configured. Remaining: a per-action
  Deep-model chooser on the adaptive wheel → **Area 6 (wheel)**.
- **Offline grammar/spell/thesaurus** in the Writer's Room (Word-like). →
  **Writers Room polish**.
