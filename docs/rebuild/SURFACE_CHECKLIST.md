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

## Writer's Room (M2)

| Control | Action | Spec |
| --- | --- | --- |
| Chapter strip tabs | Switch active chapter | `03-writers-room.spec.ts` |
| + New chapter (strip + empty state) | Creates and opens a chapter | `03-writers-room.spec.ts` |
| Chapter title input | Renames live, persists | `03-writers-room.spec.ts` |
| Move earlier / later | Reorders chapters, persists | `03-writers-room.spec.ts` |
| Delete → Move to trash | Soft-deletes; restorable from Trash with full text | `03-writers-room.spec.ts` |
| Toolbar: Bold/Italic/Underline/Strike/Heading/Quote/Scene break/Undo/Redo | Real persisted marks & nodes | `03-writers-room.spec.ts` (bold; others same code path) |
| Manuscript body | Typing autosaves (600ms), word count live | `03-writers-room.spec.ts` |
| Notes toggle | Opens/closes paragraph-note rail | `03-writers-room.spec.ts` |
| Add note / Resolve / Reopen / Delete / Show resolved | Paragraph-keyed notes CRUD, persists | `03-writers-room.spec.ts` |

## Extraction + Review (M3)

| Control | Action | Spec |
| --- | --- | --- |
| Save & Extract (Writer's Room) | Flush-saves, runs offline extraction, toasts results | `04-extraction-review.spec.ts` |
| Mention highlight (manuscript) | Click opens the entity's dossier | `04-extraction-review.spec.ts` |
| Review nav badge | Live pending count | `04-extraction-review.spec.ts` |
| Queue card: Accept | Creates/updates/merges the entity, backfills mentions | `04-extraction-review.spec.ts` |
| Queue card: Deny | Dismisses candidate + its pending mentions, persists | `04-extraction-review.spec.ts` |
| Accept all strong | Bulk-accepts blue+green candidates | (unit `review` path; e2e in M4 sweep) |
| Toast: Review action | Routes to the review queue | `04-extraction-review.spec.ts` |

Engine contract: all 16 golden fixtures in `tests/fixtures/extraction/` pass via
`tests/unit/extraction-fixtures.spec.ts`.

## All 16 codex types + cross-panel context (M4)

| Control | Action | Spec |
| --- | --- | --- |
| Nav: 16 codex type entries (desktop rail + mobile bottom nav) | Route to that type's roster/dossier surface | `05-cross-panel.spec.ts` |
| Editor drawer for every type | Config-driven sections/fields (legacy field-id parity); title-named types + derived relationship names supported | `05-cross-panel.spec.ts` (locations/items/factions/quests spot-check) |
| Dock strip glyphs (desktop) | Open codex panel beside any surface; persists per project | `05-cross-panel.spec.ts` |
| Panel: row click | Focus entity (broadcasts to all panels) | `05-cross-panel.spec.ts` |
| Panel: filter chip | Filters roster to entities related to the foreign focus; dismissible | `05-cross-panel.spec.ts` |
| Panel: lock 🔓/🔒 | Pins context; with same-type focus shows pair strip | `05-cross-panel.spec.ts` |
| Pair strip: Unlock | Clears the lock | `05-cross-panel.spec.ts` |
| Panel: ⤢ expand / × close | Full surface / close panel | covered via panel persistence assertions |
| Dossier: Lock / Merge into… | Lock context; merge with full reference/mention rewrite | `05-cross-panel.spec.ts` |
| Stats entities extend the stat-change detector vocabulary | extraction picks up custom stats | engine unit path |

## Document workspaces (M5)

| Control | Action | Spec |
| --- | --- | --- |
| Quest editor: step-list (add/reorder/remove, status cycle) | Ordered steps with pending/active/done/skipped | `06-workspaces.spec.ts` |
| Quest dossier: step glyph click | Advances the step live, progress counter, persists | `06-workspaces.spec.ts` |
| Events/Timeline surface: List ↔ Timeline toggle | Chronological lane ordered by when/chapter/order fields | `06-workspaces.spec.ts` |
| Timeline card click | Selects + focuses the event | `06-workspaces.spec.ts` |
| Writer's Room: Compose toggle | Opens the composition panel | `06-workspaces.spec.ts` |
| Compose: mode/POV/length/direction + context chips | Builds a structured writing brief from focused/locked entities | `06-workspaces.spec.ts` |
| Compose: Insert brief | Inserts as manuscript blockquote (persists) | `06-workspaces.spec.ts` |
| Compose: Copy for external AI | Copies the brief to the clipboard | manual (clipboard) |

## Atlas (M6a)

| Control | Action | Spec |
| --- | --- | --- |
| Nav: Atlas | Opens the world map | `07-atlas.spec.ts` |
| Unplaced location button | Arms click-to-place mode | `07-atlas.spec.ts` |
| Canvas click (placing) | Drops the pin, persists | `07-atlas.spec.ts` |
| Pin drag (pointer) | Moves the pin, position persists after reload | `07-atlas.spec.ts` |
| Pin click / tap | Focuses the location (cross-panel) | `07-atlas.spec.ts` (mobile tap) |
| Layer toggles (labels / travel / grid) | Show/hide layers, persist | `07-atlas.spec.ts` |
| Travel routes | Derived polylines from cast travelHistory → currentLocation | `07-atlas.spec.ts` |
| Pinned list: row / unpin × | Focus / remove pin | covered by place+focus flows |
| Canvas pan (drag) + wheel zoom + pinch | Shared useCanvas primitives (all M6 canvases) | `07-atlas.spec.ts` (touch pan path) |

## Canvas workspaces (M6b)

| Control | Action | Spec |
| --- | --- | --- |
| Nav: Tangle / Skill Trees | Open the canvas workspaces | `08-canvases.spec.ts` |
| Tangle: board select / + New / rename / Delete | Board management, persists | `08-canvases.spec.ts` |
| Tangle: note card place / entity card place | Click-to-place cards (entity cards colored by type) | `08-canvases.spec.ts` |
| Tangle: Connect two cards (+ label + directed toggle) | Click-click labelled threads with arrows | `08-canvases.spec.ts` |
| Tangle: thread click | Removes the thread | covered by connect flow |
| Tangle: selected card → Focus entity / Remove card | Cross-panel focus / delete | node-click path |
| Skill Trees: tree management, node place (codex skill or free label) | Constellation building | `08-canvases.spec.ts` |
| Skill Trees: Link prerequisite (directed) / line click removes | Prerequisite edges | `08-canvases.spec.ts` |
| Skill Trees: Unlocked toggle | Per-node unlock state (green ring), persists | `08-canvases.spec.ts` |
| Relationships: Graph view | d3-force network of bonds; node click focuses; lock highlighted | `08-canvases.spec.ts` |
| Node drag (all canvases) | Pointer-drag with persistence (tangle/skill trees) | shared NodeGraphCanvas + atlas drag spec |

## AI layer (M7)

| Control | Action | Spec |
| --- | --- | --- |
| Settings: provider key Save / Clear | AES-GCM-encrypts in this browser only; never exported | `09-ai.spec.ts` + `ai-layer` unit |
| Settings: default provider radio | Selects the active provider, persists | `09-ai.spec.ts` |
| Settings: Test connection | Mock-verified reachability check (no manuscript text sent) | `09-ai.spec.ts` |
| Settings: Local-only mode | Hides/blocks every AI entry point; offline paths remain | `09-ai.spec.ts` |
| Settings: privacy guard toggle | Ask vs always-allow before sending text | `09-ai.spec.ts` (guard shown) |
| Compose: Generate with AI → guard → draft → Insert draft | In-app drafting; drafts insert as prose paragraphs | `09-ai.spec.ts` |
| Writer's Room: Deep Extract (AI) → guard | Chunked AI pass feeding the same review queue (deduped) | `09-ai.spec.ts` |
| AI Handoff: Build pack / Copy pack | Self-contained external-AI prompt with known-entity context | `09-ai.spec.ts` |
| AI Handoff: Import to review queue | Tolerant JSON parse → pending candidates, dedupe | `09-ai.spec.ts` + unit |
| Settings: extraction detector sliders | Live per-detector confidence overrides (session-wired) | settings surface; engine override unit path |
