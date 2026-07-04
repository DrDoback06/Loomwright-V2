# Surface checklist

Every rendered control, its action, and the spec that proves it. A surface may not ship
controls that are absent from this list. (Replaces the legacy callback audit.)

## Shell (M0)

| Control | Action | Spec |
| --- | --- | --- |
| Theme toggle (topbar) | Switches parchment-light ↔ midnight-ink, persists | `00-boot.spec.ts` |
| Left rail: Home / Cast / Trash | Routes to the surface | `00-boot`, `01-projects`, `02-cast` |
| Bottom nav (mobile) | Same routes, phone layout | all specs (mobile project) |

## Projects (M1)

| Control | Action | Spec |
| --- | --- | --- |
| Welcome gate: Create project | Creates + selects first project | `01-projects.spec.ts` |
| Switcher: project list | Switches current project (data isolated) | `01-projects.spec.ts` |
| Switcher: + New project | Inline form creates + switches | `01-projects.spec.ts` |
| Switcher: Rename | Inline form renames, persists | `01-projects.spec.ts` |
| Switcher: Delete → confirm | Deep-deletes project after explicit confirm | covered by repo unit test |

## Cast codex (M1)

| Control | Action | Spec |
| --- | --- | --- |
| + Create character | Opens editor drawer; Create saves | `02-cast.spec.ts` |
| Roster search | Filters by name/alias/summary | (unit-level; e2e in M4) |
| Roster card | Opens dossier detail | `02-cast.spec.ts` |
| Dossier: Edit | Opens drawer pre-filled; Save persists | `02-cast.spec.ts` |
| Dossier: Delete → Move to trash | Soft-deletes with Undo toast | `02-cast.spec.ts` |
| Editor: section nav, pills, chips add/remove, related pickers, stat grid, portrait upload | Each writes its field and persists | `02-cast.spec.ts` (pills/chips); rest exercised via unit + later specs |

## Trash (M1)

| Control | Action | Spec |
| --- | --- | --- |
| Restore | Returns the record to its collection | `02-cast.spec.ts` |
| Delete forever… → confirm | Purges permanently (double-confirm) | `02-cast.spec.ts` |

## Home (M1)

| Control | Action | Spec |
| --- | --- | --- |
| Cast members stat tile | Live count; click routes to Cast | `02-cast.spec.ts` |
| Recent activity: Undo | Reverts the audited action | `02-cast.spec.ts` |
