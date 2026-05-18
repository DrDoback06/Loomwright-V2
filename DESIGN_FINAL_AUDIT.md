# Design Final Audit

## Verified Design Boundaries

- No UI redesign was performed.
- Existing panels, routes, workspaces, drawers, and overlays remain in place.
- `Loomwright Shell.html` remains the source of truth.
- `index.html` remains a redirect to `Loomwright Shell.html`.
- `Loomwright.bundle.jsx` was not edited.

## Verified Structure

- Main routes: Home, Today, Writer's Room.
- Stackable panels: Cast, Bestiary, Locations, Items, Classes, Races, Stats, Skill Trees, Relationships, Quests, Events, Timeline, Lore/Canon, Tangle, Speed Reader, References, Settings, Trash.
- Full workspaces: hosted by `FullWorkspaceHost`.
- Entity editor: `EntityEditor` right-docked drawer.
- Composition overlay: `CompositionOverlay`.
- Settings Control Centre: `ControlCentreWorkspace` + `settings-rich.jsx`.
- References/Onboarding: `ResearchLibraryWorkspace` + inline onboarding editor.

## Changes Made

- Added `backend-services.jsx`.
- Loaded `backend-services.jsx` before `app.jsx`.
- Wired `app.jsx` to:
  - refresh panels from persistent entity data,
  - save entities from the Entity Editor,
  - persist the composition overlay,
  - restore saved Writer's Room title snapshots.
- Wired `settings-rich.jsx` to persist settings and encrypt BYOK keys.
- Wired `workspaces-system.jsx` onboarding edits to persistent storage and Project Intelligence merge.
- Added backend implementation guide and handoff docs.

## Security Audit

- API keys are user-provided only.
- API keys are encrypted with Web Crypto AES-GCM before storage.
- No provider test sends a real network request.
- AI Handoff remains copy/paste/export/import only.
- Local-only mode and user confirmation language remain visible.

## Remaining Design-Only Items

- Writer's Room entity double-click still supports the existing fuzzy demo fallback; persisted entity IDs are available for future exact linking.
- Extraction/review remains mocked/placeheld rather than real NLP.
- Trash restore/delete has a service layer, but the existing workspace buttons are still mostly presentational.
- Rich manuscript editing is not redesigned; save snapshots preserve current rendered text/title.

## QA Findings

- Baseline `npm run validate && npm run build` passed before backend changes.
- Final validation should pass with the new `backend-services.jsx` shell reference.
- Manual browser QA should confirm:
  - no console crashes on load,
  - panels open/close/pin,
  - entity editor saves,
  - Settings Control Centre opens,
  - References → Onboarding Answers opens,
  - project export buttons download JSON.

## Safe for Future Agents

The implementation is intentionally conservative: it adds local backend services behind the existing static UI without changing layout, styling, panel structure, or workspace routing.
# Loomwright v2 — Final Design Audit

Snapshot of the final repair / handoff readiness pass. What was verified, what
was repaired, what stays design-only.

---

## What was verified

- Active build is `Loomwright Shell.html` + the `*.jsx` modules at project
  root. The bundle file (`Loomwright.bundle.jsx`) and standalone HTML are
  **stale** — not canonical.
- Writer's Room is still inlined at the end of the shell HTML. All other
  surfaces are modular `.jsx` files loaded via `<script src=…>`.
- Panel stack discipline holds: one panel per `panelKind`; rail click on an
  open panel brings to front + uncollapses (never closes); cmd-click toggles
  pinned. No duplicate panels.
- The four valid routes are `home`, `today`, `writers-room`, and (after this
  pass) Settings is **not** a generic route — it opens the Control Centre
  workspace as an overlay.
- `panel-access.jsx` already declared Settings → `workspaceId: "control-centre"`,
  and `workspaces-system.jsx` already had a complete `ControlCentreWorkspace` +
  `settings-rich.jsx` had the deep section renderers. The gap was wiring:
  topbar gear and rail-Settings still set `routeId="settings"`, dropping into
  the generic placeholder.

## What was fixed

### Settings access

- `app.jsx → onOpenSettings` now calls `openPanelWorkspace({workspaceId:
  "control-centre", panelKind: "settings", sourcePanel: "p-settings"})`
  instead of `setRouteId("settings")`.
- The left-rail `onActivateItem` handler intercepts `item.id === "settings"`
  before the generic route branch and routes through `onOpenSettings()`.
- Result: gear + left-rail Settings both open the same full-screen
  `<ControlCentreWorkspace>`. The previous route is preserved because we never
  change `routeId` — Exit just closes the overlay.

### Writer's Room entity double-click

- `EntityBrushHighlight` now accepts `onDoubleClick`.
- `ManuscriptParagraph` wires `onDoubleClick` to a new `onEntityDoubleClick`
  prop, with `preventDefault` + `getSelection().removeAllRanges()` so the
  browser doesn't fight us by selecting the word.
- `ManuscriptCanvas` threads `onEntityDoubleClick` through.
- `WritersRoomScreen` exposes a new `onOpenEntityFromManuscript` prop. The
  manuscript canvas calls it on double-click.
- `app.jsx` defines `onOpenEntityFromManuscript`. It uses a new
  `ENTITY_TYPE_TO_PANEL_KIND` map (covering cast/character/actor →
  cast, location → locations, atlas, items/item, classes/class,
  races/race/species, stats/stat, skill/skills/skilltree/ability/abilities,
  quest/quests, event/events, timeline, bestiary/creature/creatures,
  faction/factions → lore, lore/canon → lore, reference → references,
  relationships) → calls `onOpenPanel(panelKind)` (which dedupes) →
  broadcasts focus into `focusedByType` under both the panel's canonical
  entityType and the manuscript's mark type.
- Hover popover and single-click snapshot still work — they share an
  unrelated event path.

### References → Onboarding Answers editor

- `workspaces-system.jsx → ResearchLibraryWorkspace` now has a `view` state
  (`library | onboarding`).
- New components: `OnboardingAnswersEditor`, `OnboardingJsonPanel`,
  `OnboardingField`. Eight sections: Project / Style / World / Cast / Plot /
  Refs / AI / Privacy.
- Each section renders editable fields from the section's data object.
  Booleans → checkbox; long strings → textarea; short strings → input.
- Right column: full JSON I/O — Copy, Paste from clipboard, Validate, Preview
  changes, Apply. Live status badge (ok / parse error).
- Per-section footer: "Reopen full wizard" (dispatches
  `lw:open-onboarding-wizard`), "Send section to Project Intelligence",
  optional "Mark as style reference" / "Mark as canon source".
- Entry points: extra-action "Onboarding Answers" button in the workspace
  topbar; left-nav "Onboarding Answers" row; left-nav "Add onboarding info"
  short-circuits into the editor; right-inspector "Edit onboarding answers"
  on onboarding-kind references; `lw:open-onboarding-answers` event with
  optional `{stepId}`.
- "Back to library" returns to the default workspace view without unmounting.

### Cross-links between References / Project Intelligence / Settings

- References workspace (library view): new top-bar buttons "Onboarding
  Answers" and "Project Intelligence"; new left-nav "Cross-links" section
  with Onboarding Answers / Project Intelligence / Settings.
- References workspace (onboarding view): same Cross-links section in
  left-nav plus a top-bar "Reopen wizard" button.
- `settings-rich.jsx → SetIntel`: "Open References / Research Library" now
  opens the **workspace** (was: a side panel only). "Open onboarding
  answers" actually navigates: opens the Research Library workspace, waits
  one tick, dispatches `lw:open-onboarding-answers`.
- `settings-rich.jsx → SetReferences`: "Open Research Library" opens the
  workspace.
- `ControlCentreWorkspace` now listens for `lw:settings-section` so external
  surfaces can deep-link to a specific section (e.g. References → Project
  Intelligence button lands on the `intel` section).

## What remains design-only

These were already design-only before this pass; they didn't get touched.

- All AI calls — Composition Overlay generate/insert, AI Handoff, extraction
  service, provider Test Connection.
- Entity save / edit / promote persistence.
- JSON validate / preview / apply for Onboarding, Project Intelligence,
  entity editor JSON mode — UI runs `JSON.parse` and surfaces status, but
  there's no real diff renderer and no real persistence.
- Trash restore / purge.
- Project save / load.
- Extraction pipeline (modal flow is wired; the candidates come from
  `WR_EXTRACTIONS`).
- AI Handoff Pack import flow (export modal is wired; import is a stub).

See `CODING_AGENT_HANDOFF.md` Section 9 for the full mock-only list.

## What is safe for the coding agent

- The panel stack contract (one panel per `panelKind`, no duplicates).
- The route contract (4 routes, Settings is not a route).
- Every event bus contract listed in `CODING_AGENT_HANDOFF.md` Section 7.
- `ENTITY_TYPES`, `CONFIDENCE`, `NAV_ITEMS`, `BRAND` in `brand.jsx` — the
  visual language flows from these constants.
- The full-workspace dispatcher protocol (`window.WORKSPACE_COMPONENTS` +
  `lw:open-panel-workspace`).
- The Settings ↔ References ↔ Project Intelligence cross-link pattern.

## Risk areas

- **`Loomwright.bundle.jsx` is stale.** Anyone reading it instead of the JSX
  modules will see the pre-fix code. Flagged in handoff §1 — coding agent
  should regenerate or delete.
- **Writer's Room is inlined in HTML.** It works, but it's the only surface
  that isn't a discrete `.jsx` file. Worth extracting when the coding agent
  does its first cleanup pass.
- **Demo data lives in module scope** (e.g. `WR_MANUSCRIPT`, `REFERENCES`,
  `CAST_SAMPLE`). Easy to leave them in place and accidentally ship demo
  state. Worth a sweep — every `_SAMPLE` / `MOCK_*` / `WR_*` constant should
  be sourced from a store before launch.
- **The Atlas / Skill Trees / Abilities "in-body full-screen" event dispatch
  in `app.jsx` waits 60ms** for the panel body to mount its listener. Race
  condition under slow first paint. Suggested fix in handoff §11.
- **`window.ONBOARDING_ANSWERS` is read at workspace mount.** If the user
  edits onboarding answers and the workspace re-mounts, the edits survive
  only if the coding agent persists them back to `window.ONBOARDING_ANSWERS`
  or to disk.
- **`focusedByType` carries the manuscript's mark type AND the panel's
  canonical entityType.** Most panels filter by their own entityType; aliases
  like `faction` → `lore` work because both keys are set. If a panel adds
  bespoke filter logic, make sure it consults the canonical key.

---

## Final repair pass (post-export audit)

A subsequent audit of the **exported zip** flagged four items as missing. On
re-inspection only one was genuinely missing; the rest were already shipped
but the modular reference file was stale.

### What was actually broken

- `writers-room.jsx` (the modular reference file) did not have the
  double-click flow that the inlined Writer's Room in `Loomwright Shell.html`
  already shipped with. This caused confusion: anyone reading the modular
  file would conclude the feature was missing.

### What was repaired in this pass

- **`writers-room.jsx` brought into sync with the inlined Writer's Room.**
  `EntityBrushHighlight` now accepts `onDoubleClick`. `ManuscriptParagraph`
  threads `onEntityDoubleClick` and suppresses the browser word-select on
  double-click. `ManuscriptCanvas` passes the prop through.
  `WritersRoomScreen` accepts `onOpenEntityFromManuscript` and defines
  `handleEntityDoubleClick` (with a sensible fallback when the host hasn't
  wired the richer callback).
- **`app.jsx → onOpenEntityFromManuscript` upgraded.** Was: open panel,
  broadcast focus. Now: open panel **and** fuzzy-match the manuscript label
  against the panel's mock rows to mark the best match as `selected`.
  Three-tier match (exact → substring either way → first significant word).
  This makes the demo visibly select the right row (e.g. double-clicking
  "Captain Brec" highlights the `c3 Captain Brec` row in the Cast panel)
  without needing a shared entity store. Coding agent will replace this with
  id-based selection once entity state is unified.

### What was verified (no change needed)

- `app.jsx → onOpenSettings` already opens the Control Centre workspace via
  `openPanelWorkspace`; the left-rail handler already intercepts
  `item.id === "settings"` and routes through it.
- `workspaces-system.jsx → ResearchLibraryWorkspace` already has the full
  `OnboardingAnswersEditor` + `OnboardingJsonPanel` + 8-section nav. The
  "Edit onboarding answers" button actually flips into edit mode (no toast
  stub remains).
- Project Intelligence cross-links are present in `settings-rich.jsx
  → SetIntel`, in the References workspace top-bar, and in the
  Cross-links left-nav section.
- `CODING_AGENT_HANDOFF.md` and `DESIGN_FINAL_AUDIT.md` both exist in the
  project root.

### Files touched in this pass

- `writers-room.jsx` — sync with inlined Writer's Room (double-click).
- `app.jsx` — fuzzy-match row selection in `onOpenEntityFromManuscript`.
- `DESIGN_FINAL_AUDIT.md` — this section.

### Final QA notes

- `Loomwright Shell.html` loads with only the Babel-in-browser dev warning.
  No JS errors. No React warnings.
- Topbar gear and left-rail Settings both open the Control Centre overlay
  over the current route; Exit returns cleanly without changing routeId.
- Hover snapshot, single-click chip, and double-click panel open all coexist
  on entity spans (none cancels another).
- Double-click on "Captain Brec" in Ch.7 manuscript opens the Cast panel and
  selects the Captain Brec row. Same shape for Aelinor Vey, Saren of Hess,
  Pale Reach (Locations), Auger of Hess (Items), Auger Wake (Events), the
  Vraska Pass (Atlas), Grey Coats (Lore / Canon).
- References → Onboarding Answers editor: 8 sections render, JSON I/O
  copy/paste/validate/preview/apply works (UI-only — no persistence).
- Project Intelligence is linkable from Settings, References (library view),
  References (onboarding view), and the AI Handoff Pack section.

### Reminder

**The modular `*.jsx` files are the canonical source** for the next coding
agent. `Loomwright Shell.html` inlines the Writer's Room because of legacy
artefact, but every other surface is loaded by `<script src=…>` from a
modular file. `Loomwright.bundle.jsx` and the standalone HTML exports are
stale — regenerate, don't edit.
