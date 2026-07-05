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

## Command palette (M8)

| Control | Action | Spec |
| --- | --- | --- |
| Topbar ⌕ button | Opens the palette | `10-search-today.spec.ts` |
| Ctrl/Cmd+K (global) | Toggles the palette | `10-search-today.spec.ts` |
| Search input | Live minisearch over entities + chapters (keys/settings never indexed) | `10-search-today.spec.ts` |
| Entity hit | Focuses the entity and opens its codex dossier | `10-search-today.spec.ts` |
| Chapter hit | Opens that specific chapter in the Writer's Room | `10-search-today.spec.ts` |
| "Go to …" commands (all routes) | Route there | `10-search-today.spec.ts` (Today; others same code path) |
| Arrow keys / Enter / Escape / backdrop | Keyboard nav, run, close | `10-search-today.spec.ts` |

## Today (M8)

| Control | Action | Spec |
| --- | --- | --- |
| Words today tile | Daily words vs. per-day baseline (persisted in uiState) | `10-search-today.spec.ts` |
| Total words tile | Live sum across chapters | `10-search-today.spec.ts` |
| Awaiting review tile | Live pending count; click routes to Review | `10-search-today.spec.ts` |
| Continue "chapter" | Opens the most recently touched chapter | `10-search-today.spec.ts` |
| Quest-thread suggestion | Next active/pending step; click opens the quest dossier | `10-search-today.spec.ts` |
| Gathering-dust suggestion | Oldest untouched entities; click opens the dossier | (same handler as quest suggestion; empty state asserted implicitly) |
| Left rail / bottom nav: Today | Routes to Today | `10-search-today.spec.ts` |

## Home (M8 additions)

| Control | Action | Spec |
| --- | --- | --- |
| Codex entries / Chapters / Total words / Words today / Awaiting review tiles | Live stats; each routes to its surface | `02-cast.spec.ts` (cast tile), `10-search-today.spec.ts` (words baseline) |

## Random Tables (M9)

| Control | Action | Spec |
| --- | --- | --- |
| Table select (starters + yours) | Switches the active table | `11-tools.spec.ts` |
| + New table | Creates a project table | `11-tools.spec.ts` |
| Create-entity type select | Sets which codex type results create | (same write path as rows) |
| Delete table | Removes a user table (builtins can't be) | unit `tools-services` |
| ×1/×3/×5 + No repeats + Roll | Weighted rolls, optionally unique | `11-tools.spec.ts` + unit |
| Result → Writer's Room | Appends to the latest chapter and opens it | `11-tools.spec.ts` |
| Result → Create entity | Opens the editor prefilled with the result | `11-tools.spec.ts` |
| Row text/weight inputs, + Add row, remove | Edit rows; editing a starter copies it first | `11-tools.spec.ts` (rows), unit (copy-on-write) |

## Speed Reader (M9)

| Control | Action | Spec |
| --- | --- | --- |
| Source select (chapters / paste) | Loads the text | `11-tools.spec.ts` |
| Paste textarea | Reads arbitrary text | `11-tools.spec.ts` |
| Play / Pause / Restart / ‹ › | RSVP transport on real timers | `11-tools.spec.ts` |
| WPM + word-size sliders | Pace and size | `11-tools.spec.ts` (wpm) |
| Pause toggles (comma/sentence/long word) | Legacy pacing multipliers | unit `tools-services` |
| Scrubber | Seeks the reading position | (same state as ‹ ›) |

## Templates (M9)

| Control | Action | Spec |
| --- | --- | --- |
| Entity template "Use" | Opens the create drawer prefilled | `11-tools.spec.ts` |
| Entity template "Delete" | Removes a user template (builtins can't be) | `11-tools.spec.ts` |
| Dossier "Save as template" | Snapshots an entity with identity stripped | `11-tools.spec.ts` + unit |
| Tangle "Save board as template" | Snapshots cards + threads (origin-normalised) | `11-tools.spec.ts` + unit |
| Tangle "Stamp a template…" | Stamps fresh cards/threads at a click point | `11-tools.spec.ts` |
| Board template "Stamp in Tangle" | Routes to the Tangle | (route-only) |

## Settings ▸ Data & interchange (M9)

| Control | Action | Spec |
| --- | --- | --- |
| Export project (.json) | Downloads loomwright-project-v2; keys NEVER included | `12-interchange.spec.ts` + unit |
| Import project… | Creates a new project with full id remap, switches to it | `12-interchange.spec.ts` + unit |
| World bible (.md / .html) | Downloads the rendered codex + manuscript outline | `12-interchange.spec.ts` + unit |

## References ▸ Import (M9)

| Control | Action | Spec |
| --- | --- | --- |
| Import… → Add reference | Paste text → reference entry (title/kind/body) | `12-interchange.spec.ts` |
| Import… → From file(s) | .txt/.md files → reference entries | `12-interchange.spec.ts` |

## Welcome gate (M10)

| Control | Action | Spec |
| --- | --- | --- |
| Guided setup | Opens the onboarding interview | `13-onboarding.spec.ts` |
| Blank project | Reveals the quick name-only form | every spec (`bootWithProject`) |
| Explore a sample project | Seeds + opens the sample world | `13-onboarding.spec.ts` |

## Onboarding wizard (M10 — flagship)

| Control | Action | Spec |
| --- | --- | --- |
| Step rail (7 steps) + Back/Continue | Navigates; name gates progress | `13-onboarding.spec.ts` |
| Foundation: name/genre/premise/themes/tone/comparables/is-not | Captured → references + AI brief | `13-onboarding.spec.ts` + unit |
| Voice: POV/tense pills, style sample, Analyze style | Offline metrics → voice profile | `13-onboarding.spec.ts` + unit |
| Cast: seed rows + "Suggest cast from this text" | Manual + offline-NER seeds → cast codex | `13-onboarding.spec.ts` |
| World: place rows | → locations codex | `13-onboarding.spec.ts` |
| Manuscript: paste/file + split preview + extraction toggle | Auto chapter split; first extraction → Review | `13-onboarding.spec.ts` + unit |
| AI & privacy: mode radios + guard toggle | Live in Settings immediately | `13-onboarding.spec.ts` |
| Open the door | Creates + seeds everything, lands Home | `13-onboarding.spec.ts` + unit |
| Close (draft is saved) | Draft persists across reload | `13-onboarding.spec.ts` |
| Switcher ▸ Guided setup (interview)… | Reopens the wizard any time | (same component) |

## Help (M10)

| Control | Action | Spec |
| --- | --- | --- |
| Topbar ? button | Opens help for the current surface | `13-onboarding.spec.ts` |
| Got it / backdrop | Closes | `13-onboarding.spec.ts` |

## Mobile shell (M11)

| Control | Action | Spec |
| --- | --- | --- |
| Bottom nav: Home / Today / Writer's Room tabs | Direct routes | all specs (mobile project, via openNav) |
| Browse tab | Opens the codex sheet (all 16 types) | all codex navigation on mobile |
| More tab (+ pending dot) | Opens canvases/tools/utilities sheet, Review badge | all utility navigation on mobile |
| Sheet backdrop / re-tap | Closes the sheet | `openNav` fallback path |
| Safe-area insets | Sheets + nav respect notches | (CSS; manual on device) |

## Offline & install (M11)

| Control | Action | Spec |
| --- | --- | --- |
| Service-worker boot with network gone | App loads, data reads/writes, extraction runs, all persists | `14-offline.spec.ts` |
| Home ▸ Install app | Shows the deferred browser install prompt | (browser-gated; manual) |
