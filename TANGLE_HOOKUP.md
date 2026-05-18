# TANGLE_HOOKUP.md

Tangle is a freeform mind-mapping canvas. Side panel lives in
`tangle.jsx` (`TanglePanelBody`), full-screen canvas overlay in
the same file (`TangleFullScreen`).

## Canvas behaviour

- Pan: drag empty canvas.
- Zoom: mouse wheel — zooms toward cursor.
- Drag node: mousedown on a node body.
- Drag-to-connect: mousedown on a handle (left/right edge of a node),
  drag to another node. Mid-drag preview is a dashed line.
- Drag entity tray tile onto canvas → adds a new node.
- Mini-map (bottom-right): read-only viewport indicator.

## Data shapes

```ts
tangleBoard = { id, name, active, pinned, notes, nodes }

tangleNode = {
  id, kind, title, preview?, cite?,
  x: number, y: number,    // canvas coordinates (px)
}

tangleConnection = {
  id, from, to,            // node ids
  label?: string,
}

tangleGroup = {
  id, name, nodeIds: string[],
  summary?: string, collapsed?: boolean,
}

tangleCanvasState = {
  boardId, pan: { x, y }, scale, selectedNodeId,
  filterKind: "all" | <node kind>,
  layer: "all" | "sketch" | "clusters",
}
```

Node `kind` values: `"note"` | `"cast"` | `"locations"` |
`"items"` | `"quests"` | `"events"` | `"lore"` |
`"references"` | `"image"` | `"quote"` | `"custom"`.

## Callbacks

- `onOpenTangleCanvas` (toggles full-screen)
- `onCreateTangleNode`, `onEditTangleNode`, `onDeleteTangleNodeRequest`
- `onCreateTangleGroup`
- `onConnectTangleNodes`, `onDisconnectTangleNodes`
- `onDropEntityOnTangle`
- `onSendTangleItemToWriter`
- `onCreateQuestFromTangle`, `onCreateEventFromTangle`
- `onOpenRelatedTab`
- `onTangleSearch`
- `onCloseTangleCanvas`

## Cross-panel
A node with `kind:"locations"` can have an `entityId` (not modelled
in the demo) → clicking "Open related" pins the Locations panel and
focuses that entity.
