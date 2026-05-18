# Entity Composition Overlay — Hook-up Notes

## Purpose
The Writer's Room **Composition Overlay** (`composition-overlay.jsx`) is
a floating, draggable, pinnable window that lives over the manuscript.
Users drag entities from any side-panel into the overlay's drop zone to
construct a writing prompt: *"write a chapter where this actor uses this
item to complete this quest in this location."*

The overlay is UI-only in this build. The follow-up coding agent must
wire the listed callbacks to a real AI provider + manuscript-edit pipeline.

## UI Components
- `CompositionOverlay` (`composition-overlay.jsx`) — the floating window.
- Lives over the **manuscript only**. Conditional render in `app.jsx`:
  `view === "shell" && routeId === "writers-room"`.
- Render shape: drop zone → grouped entity chip cards → instruction textarea →
  output mode pills → POV/Length/Tone/Chapter selects → context toggles →
  prompt-summary preview → footer action buttons.
- `compositionOverlayOpen` is passed from `AppShell` to `WritersRoomScreen`
  so the *Compose* button in the canvas bar can highlight when the overlay
  is open.

## State Shape (lives in `app.jsx`)
```js
overlay: {
  open: boolean,
  minimised: boolean,
  pinned: boolean,
  entities: [{ entityType, id, name, summary, role }],
  instructions: string,
  settings: { mode, pov, length, tone, chapterTarget },
  contextOptions: { currentChapter, projectIntel, selectedRefs,
                    obeyCanon, preserveVoices, avoidContradictions },
}
```

## Drag Payload
The overlay drop zone consumes the standard entity drag payload:
```js
// dataTransfer "application/x-loom-entity"
{ entityType, id, name, summary, sourcePanelId? }
```
For backwards compat, legacy `text/loomwright-entity` (`{id, name, type}`)
is also parsed.

## Composition Payload (sent to AI)
The coding agent should serialize `overlay` into the following payload
when "Generate draft" is clicked:
```js
compositionPayload: {
  id: string,                           // generated
  mode: string,                          // e.g. "new-scene"
  droppedEntities: [{ entityType, id, name, summary, role }],
  entityRoles:   { [entityId]: role },   // duplicate-keyed convenience
  instructions: string,
  contextOptions: { ... },               // toggles object
  pov, length, tone, chapterTarget,
  targetChapterId: string?,
}
```

## Required Callbacks
All of these are wired from `app.jsx` into `<CompositionOverlay>`:
- `onOpenEntityCompositionOverlay` — manual open
- `onCloseEntityCompositionOverlay`
- `onMinimiseEntityCompositionOverlay`
- `onPinEntityCompositionOverlay`
- `onDropEntityIntoComposition(payload)` — fired on drop or via
  `window.dispatchEvent(new CustomEvent("lw:drop-to-composition", { detail: payload }))`
- `onRemoveEntityFromComposition(idx)`
- `onUpdateCompositionEntityRole(idx, role)`
- `onUpdateCompositionInstructions(text)`
- `onSetCompositionMode(mode)`
- `onSetCompositionPOV(pov)`
- `onSetCompositionLength(len)`
- `onSetCompositionTone(tone)`            (added; not in original brief)
- `onSetCompositionChapterTarget(id)`
- `onToggleCompositionContextOption(key)`
- `onGenerateCompositionDraft(payload)`  → opens AI flow (TBD)
- `onInsertCompositionDraft(draft)`      → inserts draft below cursor
- `onCreateChapterFromComposition(payload)` → creates a new chapter draft
- `onCopyCompositionPrompt(payload)`     → copies prompt to clipboard
- `onSaveCompositionPreset(payload)`     → saves to presets store

## Cross-Panel Integration
- Any side-panel card that is **draggable** (see ENTITY_DRAG below) drops
  into the overlay's `co-dropzone` element.
- The overlay is **not** part of the panel-stack. Opening the overlay
  must not close any panels.
- The Writer's Room manuscript canvas itself is a drop target — drops
  there open the overlay automatically (`onDropEntityIntoComposition`
  is fired from `WritersRoomScreen`'s canvas-wrap drop handler).

## Mode / POV / Length / Tone Options
Sourced from `composition-overlay.jsx`:
- `CO_MODES` — 8 output modes (new-chapter, new-scene, paragraphs,
  add-in, continue, rewrite, outline, beats)
- `CO_POVS` — first/third-limited/etc
- `CO_LENGTHS` — token-range hints
- `CO_TONES` — match-voice / spare / lush / etc
- `CO_ROLES_BY_TYPE` — per-type role selector options
- `CO_CONTEXT_OPTIONS` — context toggle list

## Notes for backend wiring
- The "Generate draft" button currently no-ops. Hook to:
  `POST /api/ai/compose` with the composition payload.
- The overlay shows a simulated badge — keep it until real AI is wired.
- Privacy mode chip in the topbar should warn the user if any setting
  requires manuscript text to be sent remotely.
