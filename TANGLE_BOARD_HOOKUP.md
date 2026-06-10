# Tangle Story Board — hookup notes

The designed Tangle UI (side panel + full-screen corkboard canvas) is the
live feature. Inspired by Alkemion Studio's node boards: cards on an
infinite parchment canvas, joined by first-class story threads.

## Data model (`TangleService`, key `tangle_canvas`)

```
{
  boards:  [{ id, name, pinned, createdAt }],
  activeBoardId,
  nodes:   [{ id, boardId, kind, entityId?, entityType?, title, preview,
              cite?, x, y }],
  edges:   [{ id, boardId, from, to, label, directed, kind, createdAt }],
  groups:  [{ id, boardId, title, nodeIds }],
}
```

- **Migration:** legacy single-board states ({nodes,edges,groups} without
  `boards`) wrap into "Board 1" in place — same storage key.
- **Edges are first-class:** labelled, directed or mutual, and MULTIPLE
  edges may join the same pair (cause + secret + echo all coexist).
- **Entity cards** (`addEntityNode`) bind to live records: title/preview
  follow the entity; deleted entities degrade the card to "unlinked";
  `LinkService.mergeEntities` rebinds cards (step 8 of the ref rewrite).

## Surfaces

- Side panel: board switcher (+ New board), live preview SVG, recent
  notes, pinned clusters (groups), New note / Send to Writer.
- Canvas: pan/zoom; node drags persist on release; handle-drag connects
  (the new edge opens selected for labelling); edge inspector (label,
  directed↔mutual, remove); entity tray with search (drag in to bind);
  blank note/quote/image/custom cards; layers (sketch = free cards,
  clusters = grouped); Group pins the selected card's cluster; Search
  centres a match; → Quest / → Event open prefilled editors;
  → Writer's Room inserts the card text; board templates stamp via
  `TemplateService.instantiateBoardTemplate`.
- Enabled everywhere: wheel + overlay entries un-disabled, wheel
  "tangle" action opens the panel, panel-stack dispatches the body.

## Verification

- Smoke `[tangle]`: migration, board CRUD/isolation, entity binding,
  multi-edge, label/direction updates, node-removal cascade, merge
  rebinding.
- e2e `tests/e2e/28-tangle-board.spec.js` (5 tests) + template stamping
  in `tests/e2e/32-templates.spec.js`.
