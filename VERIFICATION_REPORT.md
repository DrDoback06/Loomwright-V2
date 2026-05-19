# Loomwright — Final Repair Pass — Verification Report

> **HISTORICAL (2026-05-17).** This document captures the panel-dispatcher
> repair pass that happened BEFORE the runtime/backend layer was added. It
> remains accurate for the work that landed on 2026-05-17 but predates the
> wiring, burn-down, occurrence rendering, sample gating, and QA-suite
> passes. For the current product status see `PRODUCT_COMPLETION_AUDIT.md`.
> For the current QA result see `FINAL_QA_REPORT.md`.

Date: 2026-05-17

## Summary
Active-build verification confirmed via direct DOM evaluation on the running shell.

## Critical fix
The active dispatcher (`PanelStack` in `panel-stack.jsx`) was routing only **classes / races / abilities** to bespoke bodies; all other RPG entity types fell through to the generic `EntityFrameworkPanelBody`. The dispatcher now routes the full 8 + `factions`:

```
locations  → LocationsPanelBody
items      → ItemsPanelBody       (NEW — built this pass)
quests     → QuestsPanelBody
events     → EventsPanelBody
bestiary   → BestiaryPanelBody
factions   → FactionsPanelBody
stats      → StatsPanelBody
classes    → ClassesPanelBody
races      → RacesPanelBody
abilities  → AbilitiesPanelBody   (deprecation card)
```

## Tests run live in user preview

| Test | Expected | Result |
|---|---|---|
| App loads | No console errors | ✓ clean |
| Open Items panel | `ItemsPanelBody` renders | ✓ confirmed |
| Open Locations panel | `LocationsPanelBody` renders | ✓ confirmed |
| Open Quests panel | `QuestsPanelBody` renders | ✓ confirmed |
| Open Stats panel | `StatsPanelBody` renders | ✓ confirmed |
| Open Bestiary panel | `BestiaryPanelBody` renders | ✓ confirmed |
| Open Events panel | `EventsPanelBody` renders | ✓ confirmed |
| Open Classes panel | `ClassesPanelBody` renders | ✓ confirmed |
| Open Races panel | `RacesPanelBody` renders | ✓ confirmed |
| Open Abilities panel | Deprecation card to Skill Trees | ✓ confirmed |
| Items dossier | Equipment slot card visible | ✓ `.item-eqcard` present |
| Home route | `HomeScreen` renders | ✓ 8 cards, "Project Command Centre" title |
| Home entity grid | Tiles for each major system | ✓ 8 entity tiles |
| Home PI ring | Conic-gradient ring | ✓ rendered |
| Home warnings | Continuity warnings | ✓ 4 warning cards |
| Home quick launch | Quick-jump tiles | ✓ 8 tiles |
| Compose button | Opens overlay | ✓ overlay opens, state=open |
| Drop entity → overlay | Grouped cards | ✓ 4 groups (Cast/Items/Locations/Quests), `.co-chip` cards render |
| Overlay instructions | Textarea + mode controls | ✓ instructions box + 8 modes |

## Files changed

### Wiring fixes
- `panel-stack.jsx` — dispatcher now routes all 8 entity types to their bespoke bodies before falling back to `EntityFrameworkPanelBody`.
- `app.jsx` — added `routeId === "home"` branch that renders `<HomeScreen>` (was falling through to generic Workspace placeholder).
- `Loomwright Shell.html` — added `home.css` + `home.jsx` imports.

### New files
- `upgrades-items.jsx` — was just a review-queue stub; now exports `ItemsPanelBody`, `ItemEquipmentSlotCard`, `ItemEffectsStrip`, `ItemOwnershipTimeline`, `ItemLocationHistory`, `ItemReviewCard`. Roster + tabbed dossier (Dossier / History / Review / Mentions). Draggable rows. Uses `RPG_ITEM_DATA` from `rpg-entities.jsx`.
- `home.jsx` — `HomeScreen` (project command centre) with 8 cards: Manuscript Progress, Entity System Health, Review Queue Summary, Project Intelligence, Continuity Warnings, Recent Activity, Quick Launch, Today Bridge. Distinct from Today (Home = overview, Today = action plan).
- `home.css` — full responsive grid layout, paper-grain feel matching the rest of the shell.

### CSS additions
- `upgrades.css` — appended Items panel styles (`.item-roster`, `.item-dossier`, `.item-eqcard`, `.item-effects`, `.item-otline`, `.item-sites`, `.item-review`, `.item-mentions`).

## Not touched intentionally
- Atlas, Skill Trees, Relationships, Timeline, Lore/Canon, Cast, References panels — already at-standard.
- Writer's Room manuscript editor.
- Entity Editor framework (already wired via `lw:open-entity-editor` event).
- Composition Overlay JSX itself (verified working, no changes needed).
- Abilities deprecation card (already implemented).
- Hook-up docs (per scoping: quick audit only; existing docs already cover the contracts).

## Known limitations / followups
- Drag-from-panels into Composition Overlay is wired via `dataTransfer` / `application/x-loom-entity` payload. Items panel rows are draggable; full audit of every other panel's drag support is recommended but out of scope for this pass.
- Home's "Import manuscript" CTA currently opens the locations editor in JSON mode as a placeholder; a real import flow needs a backend.
- Today screen was scoped out of this pass and is unchanged (still action-oriented; differs from Home).
