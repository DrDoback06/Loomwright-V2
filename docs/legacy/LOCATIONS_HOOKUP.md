# Locations — Hook-up Notes

## Purpose
Locations is the structured wiki/dossier companion to Atlas. Atlas owns
the visual map; Locations owns the field-based information about places.
Drag/drop between the two is bidirectional.

## UI Components
- `LocationDetail` (`upgrades-locations.jsx`) — bespoke dossier renderer,
  registered into `window.RPG_DETAIL_RENDERERS.locations`. Renders into
  EntityFrameworkPanelBody when the user selects a location.
- `LocationsPanelBody` (`upgrades-locations.jsx`) — alternative compact
  body with hierarchy tree, dossier, atlas placement card, mentions
  stack, review queue. (Not currently wired to panel-stack — present
  for the next architectural pass.)
- Entity Editor: `ENTITY_EDITOR_CONFIGS.locations` in
  `entity-editor-configs.jsx`. Five modes (Quick, Full, AI Draft,
  Paste JSON, Review). Right-docked over the workspace.

## Data Shape — Location
```js
{
  id: "loc-vraska",
  type: "locations",
  name: "Vraska Pass",
  aliases: ["the Vraska", "the pass"],
  kind: "mountain",                 // from EE_LOCATION_TYPES
  customKind: null,
  parentId: "loc-reach-region",
  childrenIds: [],                  // derived from parentId graph
  placed: true,                     // pinned to Atlas?
  coords: { x: 0.43, y: 0.21, map: "salt-coast" },
  summary: "…",
  description: "…",
  history: "…",
  culture: "…",
  climate: "…",
  danger: "watched",                // safe | watched | risky | dangerous | forbidden
  currentStatus: "Held by Grey Coats",
  factionsPresent: [{ id, name }],
  characters: [{ id, name }],
  bestiary: [],
  items: [],
  quests: [],
  events: [],
  routes: ["Brittlewood Track", "Hess Road"],
  firstChapter: "Ch. 5, p. 122",
  lastChapter:  "Ch. 7, p. 188",
  mentionsByChapter: [0,0,0,0,3,1,1,...],
  sourceMentions: [SourceMention],
  references: [],
  tags: [],
  notes: "",
  status: "active",                 // ENTITY_STATUSES
  dormant: false,
  doNotSuggest: false,
  reviewQueueCount: 0,
  createdAt, updatedAt,
}
```

## Atlas ↔ Locations Link
- Saving a Location with `placed:true` must call Atlas to create or
  update its map pin (`onSaveAndPlaceLocationOnAtlas`).
- Editing an Atlas pin in `atlas-editor.jsx` updates the underlying
  Location record's `coords`.
- Cross-tab: Selecting a Location broadcasts focus via
  `focusedByType.locations` so Atlas highlights its pin.

## Review Queue
- Categories: candidate, hierarchy, placement, mention, contradiction,
  route, character-here, item-here, quest-here.
- Item shape — see CROSS_PANEL_CONTEXT_HOOKUP.md → reviewQueueItem.

## Callbacks
`onCreateLocation`, `onOpenLocationEditor`, `onSaveLocationDraft`,
`onSaveLocation`, `onSaveAndPlaceLocationOnAtlas`, `onEditLocation`,
`onMergeLocation`, `onSetParentLocation`, `onCreateChildLocation`,
`onDragLocationToAtlas`, `onShowLocationOnAtlas`,
`onOpenAtlasEditorFromLocation`, `onLinkEntityToLocation`,
`onOpenLocationSourceMention`, `onSetLocationStatus`,
`onToggleLocationDormant`, `onDropLocationIntoComposition`,
`onAcceptLocationQueueItem`, `onEditLocationQueueItem`,
`onMergeLocationQueueItem`, `onDenyLocationQueueItem`.

## Composition Drag Payload
```js
{ entityType: "locations", id, name, summary }
```
Default role on drop: `"scene setting"`. See `CO_DEFAULT_ROLES_BY_TYPE`.
