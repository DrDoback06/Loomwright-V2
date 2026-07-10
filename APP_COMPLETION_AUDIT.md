# Loomwright V2 — Full Application Completion Audit

_Status: active implementation brief_  
_Branch: `agent/complete-loomwright-app`_  
_Baseline: `main` at `c475638e82b146bd1233068fa0d555902635801b`_  
_Baseline author: Claude_  
_Baseline date: 2026-05-24_

## Purpose

This document is the implementation source of truth for taking Loomwright from a feature-rich local beta/design shell to a coherent, production-quality writing, world-state, story-tracking, entity-extraction, and optional Dungeon Master application.

The repository contains a large amount of real service code and several successful completion passes. It also contains a second, less obvious layer of unfinished work: full-screen workspaces and visual systems that still render hard-coded Pale Reach demo data or keep important changes only in React-local state even though persistence services now exist.

A service existing is not considered completion. A feature is complete only when a user can perform the intended workflow through the rendered UI, save it, reload it, see it reflected in every linked surface, export/import it safely, and pass DOM-level acceptance tests.

## Confirmed baseline

The current `main` head is the latest Claude-authored working version. It includes:

- editable and persisted Writer's Room chapters;
- paragraph notes, chapter move/delete/restore, current chapter context, and active author selection;
- local-first entity persistence and occurrence tracking;
- offline entity discovery plus optional AI-assisted extraction;
- unified extraction review actions;
- onboarding, project intelligence, references, project import/export, entity libraries, backups, audit history, and partial undo;
- multi-provider BYOK AI routing and privacy gates;
- global search, Speed Reader, composition, Tangle/Atlas/Skill Tree persistence services;
- a precompiled production build and Playwright test suite;
- a live Cast side-panel dossier and CastBrain AI chat.

These are valuable foundations and should be preserved rather than rebuilt blindly.

## Architecture reality

The application currently loads roughly sixty ordered global JSX scripts. `backend-services.jsx` is a large global IIFE containing storage, entities, extraction, AI, search, audit, project archive, manuscript, notes, Atlas, Tangle, Skill Tree, and other services. Cross-component communication relies heavily on `window`, `CustomEvent`, and callback-name dispatch.

This structure is workable for a prototype but has produced two sources of truth:

1. persistent services and live entity stores; and
2. visual modules with local state and hard-coded demo constants.

The earlier UAT issue—green service tests while the rendered application displayed fake data—was a direct consequence of this split. Completion work must therefore be service-first and DOM-tested.

## Confirmed remaining defects and incomplete systems

### 1. Duplicate live and demo render paths

Several full-screen workspaces remain separate mock applications rather than expanded views of the live panels.

- `workspaces-narrative.jsx` includes hard-coded Cast biography, goals, relationships, stats, skills, quests, events, equipment, and fallback characters.
- `relationships.jsx` renders `RELATIONSHIPS`, `REL_EVIDENCE`, `REL_CHANGES`, `REL_REVIEW`, and `REL_HOPES_FEARS` constants instead of the live entity/review/occurrence stores.
- `timeline.jsx` renders `TL_EVENTS` and `TL_REVIEW` constants and reads Atlas demo globals.
- `tangle.jsx` opens boards and nodes seeded from `TANGLE_BOARDS`, `INITIAL_TANGLE_NODES`, and `INITIAL_TANGLE_EDGES`; significant canvas state is local.
- `atlas.jsx` reads `window.ATLAS_*` demo globals, opens focused on Aelinor, hard-codes the current chapter, and contains no-op handlers.
- some app presets and workspace fallback copy still expose old sample names or “coming soon” language.

No production surface may silently fall back to sample content. Sample data must exist only inside the explicit sample-project flow.

### 2. Cross-panel context is largely descriptive, not authoritative

The design calls for one selection to project through Cast, Items, Atlas, Timeline, Quests, Events, Relationships, Skills, Stats, Lore, and References. Current focus propagation is mostly a header chip and local component behaviour. There is no single typed context/state projection service that guarantees the same entity, chapter, time snapshot, and filters are used everywhere.

Completion requires:

- a canonical cross-panel selection model;
- real filtering/highlighting/scope modes;
- typed open-related navigation;
- stable context across panel/full-workspace transitions;
- context-aware extraction, AI, source opening, and composition;
- DOM tests proving each linked surface reacts correctly.

### 3. No canonical historical world-state engine

The supporting documents describe timeline snapshots where selecting a chapter/event should show the state of characters, locations, item ownership, quests, relationships, factions, and stats at that point in the story. Current entities primarily store latest-state fields, while events, occurrences, and some history arrays are separate and inconsistent.

A production implementation needs an explicit choice between:

- event-sourced state replay;
- versioned entity snapshots/deltas; or
- latest state plus typed historical records with deterministic projection.

Without this, timeline scrubbing, continuity checking, travel history, ownership changes, retcons, and non-linear narrative views cannot be reliable.

### 4. Relationships, quests, events, timeline, and Atlas are not one graph

The intended model says that events can change relationships, items, locations, stats, and quest progress; quests can create events; timeline nodes should project those changes; Atlas should show routes and chapter snapshots. The current schemas and services can persist linked fields, but the visual systems do not consistently consume or mutate one canonical graph.

Completion requires stable IDs, reciprocal-link rules, mutation transactions, orphan cleanup, merge behaviour, provenance, and schema validation for all linked entity types.

### 5. Writer's Room is usable but not yet a production editor

The current uncontrolled `contentEditable` approach fixed typing and persistence but leaves named gaps:

- headings, quotes, scene breaks, find/replace, reference insertion, footnotes, highlight, and thesaurus actions;
- text-range comments rather than paragraph-only notes;
- incremental occurrence decoration without caret jumps;
- drag chapter reordering;
- robust undo/redo and structured document semantics;
- large-manuscript performance and reliable rich-text import/export.

A decision is required on retaining the lightweight editor or migrating to a structured editor engine.

### 6. Import, project, and platform scope is unfinished

Current onboarding file support is primarily text/Markdown. Current storage is one project per browser profile. There is no production decision for DOCX/EPUB/Scrivener/PDF ingestion, formatted manuscript export, project switching, cloud sync, desktop packaging, PWA installation, accounts, collaboration, or mobile/tablet support.

The development shell also uses a fixed-width viewport declaration and should not be treated as proof of responsive product support.

### 7. AI and extraction need product-level evaluation

The provider adapters and routing are real, but the quality layer still needs:

- a representative manuscript fixture/evaluation corpus;
- precision/recall targets per entity and mutation type;
- two-pass relationship extraction;
- extraction-session rollback;
- model selection UX and streaming;
- reference summarisation and project-intelligence derivation;
- explicit cost/token visibility;
- optional Gemini support if required;
- consistent context packing across Writer, Cast chat, continuity, extraction, and composition.

Heuristic confidence scores should not be treated as calibrated probabilities without evaluation.

### 8. Dungeon Master mode is not yet defined or implemented as a product

The existing RPG entities can support worldbuilding, but a true live Dungeon Master workflow may additionally require campaigns, sessions, encounters, initiative, dice, player characters, NPC state, inventory/resource mutation, hidden/public information, session notes, improvisation prompts, recap generation, branching canon, and player-facing views.

Those are materially different requirements from author-focused story tracking and must be specified before the data model is finalised.

### 9. Quality gates are incomplete

The repository contains strong local test scripts but no remote GitHub Actions evidence for the current head. Completion needs:

- CI on every branch and pull request;
- DOM-driven tests as the default acceptance method;
- no demo-name assertions on fresh projects;
- reload/import/export/migration tests for every persisted workflow;
- accessibility and keyboard tests;
- responsive viewport tests;
- large-project performance fixtures;
- corruption/recovery and backward-compatible migration tests.

## Completion definition

A feature is complete only when all of the following are true:

1. the visible UI uses the canonical live store and has an honest empty state;
2. every enabled control performs the labelled action;
3. mutations persist and survive reload;
4. linked records update or project consistently across all relevant tabs;
5. source/provenance links return to the correct chapter, paragraph, or reference;
6. merge/delete/import operations preserve referential integrity;
7. the feature exports, imports, migrates, and audits correctly;
8. the rendered user workflow has DOM-level automated coverage;
9. keyboard, accessibility, responsive, and failure states are handled;
10. no production path silently substitutes sample or placeholder content.

## Proposed implementation sequence

### Phase 0 — executable baseline and CI

- Add GitHub Actions for validation, service smoke, production build, Chromium e2e, and preview e2e.
- Reconcile test counts and stale status documents.
- Add a fresh-project visual/demo-leak sweep across every panel and workspace.

### Phase 1 — remove the remaining second application

- Introduce shared live selectors/adapters for every entity/workspace.
- Rewrite Cast full workspace, Relationships, Timeline, Tangle, Atlas, and narrative/RPG workspaces to consume services.
- Remove production fallback data and no-op controls.
- Make panel and full-workspace views two presentations of the same state.

### Phase 2 — canonical story graph and world-state projection

- Version the project schema.
- Define typed relationships, events, mutations, source evidence, and time coordinates.
- Add referential-integrity and transaction services.
- Implement deterministic “state as of chapter/event” projections.
- Migrate existing browser data and exported projects safely.

### Phase 3 — real cross-panel context

- Create one context service for entity selection, chapter/time snapshot, overlay/filter mode, and source focus.
- Wire all panels, workspaces, command search, composition, extraction, and AI tools to it.
- Add navigation and cross-reference acceptance tests.

### Phase 4 — story systems

- Complete Quests/Events/Relationships/Timeline/Atlas/Items/Stats/Skills as one linked story engine.
- Implement event consequences and quest-step promotion.
- Implement historical ownership, travel, relationship, stat, and quest progression views.
- Complete Tangle board persistence and entity conversion workflows.

### Phase 5 — production Writer's Room

- Choose and implement the editor architecture.
- Finish formatting, structured blocks, comments, find/replace, references, footnotes, decorations, chapter drag, undo/redo, and manuscript-scale performance.
- Add rich import/export.

### Phase 6 — Dungeon Master mode, if required

- Add the agreed campaign/session/encounter/live-play systems without compromising author mode.
- Reuse the canonical story graph rather than creating another disconnected data model.

### Phase 7 — AI and extraction quality

- Build evaluation fixtures and quality metrics.
- Complete relationship extraction, rollback, model picker, streaming, reference intelligence, continuity, and context transparency.
- Preserve BYOK/local-first privacy rules.

### Phase 8 — productisation

- Multi-project support, migrations, recovery, packaging/PWA/desktop decisions, responsive and accessibility completion, performance, onboarding/import polish, release documentation, and end-to-end UAT.

## Immediate branch rules

- Preserve `main`; all work lands on `agent/complete-loomwright-app` or short-lived child branches.
- Do not count service-only changes as feature completion.
- Do not add another demo fallback.
- Add or update a DOM-level test with every user-facing fix.
- Keep current export data readable through explicit migrations.
- Prefer small, reviewable commits grouped by system.

## Product decisions required

The questions in the accompanying project discussion must be answered before Phase 2 and the Dungeon Master/editor architecture are locked. Phase 0 and the audit portions of Phase 1 can proceed independently.