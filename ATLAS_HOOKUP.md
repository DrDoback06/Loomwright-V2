# Atlas — Hook-up notes (Loomwright v2)

Atlas opens as a stackable side panel beside Writer's Room. The
full-screen Atlas Editor is rendered as an overlay so that opening or
closing it never unmounts Writer's Room or any other panel.

```
AtlasPanelBody                 // panel body — owns all atlas state
├── AtlasSidePanel             // 3-zone tracker (toolbar / map / scrubber+inspector)
└── (overlay) AtlasEditor      // full-screen workspace
    ├── AtlasEdToolbar
    ├── AtlasEdLeftRail        // Registry · Tray · Layers
    ├── AtlasMap (canvas)
    ├── AtlasEdRightRail       // Inspector · Review · Related · Source
    ├── AtlasEdScrubber
    └── AtlasEdMiniMap (floating)
```

## State

```ts
type AtlasViewMode = "side" | "editor";

type AtlasState = {
  viewMode: AtlasViewMode;          // "editor" = the overlay is visible
  presetId: ContextPresetId;        // active cross-panel context preset
  selected: Location | null;        // user-picked map object
  currentChapter: number;           // 0-indexed; in-world "now"
  scrubChapter: number | null;      // null = follow currentChapter
  layerState: Record<LayerId, boolean>;
  legendChipsState: Record<ChipId, boolean>;
  layerLocks: Record<LayerId, boolean>;        // lockable layers
  layerOpacity: Record<LayerId, number>;       // 0..1; placeholder slider
  scrubberOpen: boolean;
  layersPopoverOpen: boolean;
  inspectorPinned: boolean;
  rightRailCollapsed: boolean;
  leftRailCollapsed: boolean;
  leftTab: "registry" | "tray" | "layers";
  rightTab: "inspector" | "queue" | "related" | "source";
  showIso: boolean; showGrid: boolean; showTexture: boolean; showLabels: boolean;
  miniMapVisible: boolean;
};
```

## Cross-panel context — `selectedAtlasContext`

When another panel selects an entity, the Atlas reflects that selection
without losing what it is showing. Drive this via context presets:

```ts
type ContextPreset = {
  id: string;
  label: string;
  source?: {
    panel: string;         // "Cast" | "Bestiary" | "Items" | "Quests" | …
    entityType: EntityType;
    id: string;
    label: string;
  };
  show?: {
    routeIds?: string[];
    focusLocId?: string;
    beastId?: string;
    itemId?: string;
    questId?: string;
    factionId?: string;
    chapterDiff?: string;
    intersect?: string[];  // ids of intersecting locations
  };
  description: string;
};
```

The Atlas Tweaks panel exposes a "Cross-panel context" segmented control
that cycles through `window.ATLAS_CONTEXT_PRESETS` so reviewers can see
every cross-panel demo state.

## Location model

```ts
type Location = {
  id: string;
  type: LocationType;     // world | continent | country | region | …
  name: string;
  parent: string;         // parent location id (or "world")
  x: number; y: number;   // anchor (% of map canvas)
  polygon?: string;       // optional SVG path in canvas px
  kind?: "waterway" | "road" | "forest" | "battlefield"
       | "ruin" | "hidden" | "item-site" | "faction-hq";
  chapters: number[];     // 1-indexed chapter numbers
  characters?: string[];  // cast ids present here
  queue?: number;         // pending review items affecting this loc
  queueLevel?: "high" | "strong" | "uncertain" | "weak";
  summary?: string;
  fields?: [string, string][];   // displayed in the inspector
  entityKind: "locations";
};
```

Hierarchy levels (sample data covers all):
`world > continent > country > province/region > city/town/village
> district > building > room`. The Location Registry visualisation walks
the `parent` tree.

## Map objects

```ts
type MapObject =
  | { kind: "pin",         locationId: string; x: number; y: number }
  | { kind: "polygon",     locationId: string; path: string }
  | { kind: "route",       routeId: string;    waypoints: Waypoint[] }
  | { kind: "habitat",     beastId: string;    locations: string[] }
  | { kind: "territory",   factionId: string;  locations: string[] }
  | { kind: "note",        id: string; x: number; y: number; text: string }
  | { kind: "extraction",  queueId: string; suggestedLocId?: string };
```

## Travel routes

```ts
type Waypoint = {
  locationId: string;
  chapter: number;
  note?: string;
};

type TravelRoute = {
  id: string;
  characterId: string;
  characterName: string;
  color: string;          // overlay tone
  waypoints: Waypoint[];
};
```

## Layers — `atlasLayer`

```ts
type AtlasLayer = {
  id: string;
  label: string;
  kind: "geo" | "ovl" | "ann" | "art";
  color: string;
  count: number | null;
  visible: boolean;
  locked?: boolean;
  warnings?: number;
};
```

Required layer ids (`atlas-data.jsx` → `ATLAS_LAYERS`):

```
base                Base map
regions             Continents / Countries / Regions
settlements         Settlements
buildings           Buildings / Rooms
natural             Natural locations
districts           Districts
story               Story-specific sites
routes              Routes / Roads
characters          Character travel
beasts              Bestiary habitats
items               Items
quests              Quests
events              Events
factions            Factions / Territories
notes               Notes
mentions            Manuscript mentions
extracts            Extraction suggestions
warnings            Review warnings
diff                Timeline changes
labels              Place labels
grid                Lat/Lon grid
isolines            Contours
texture             Parchment grain
```

Each layer row in the editor's left-rail Layers tab carries: visibility
toggle, opacity placeholder bar, lock toggle, count badge, and warning
badge — keyed off the fields above.

## Review queue — `atlasReviewQueueItem`

```ts
type AtlasReviewQueueItem = {
  id: string;
  name: string;
  level: "high" | "strong" | "uncertain" | "weak";
  value: number;             // confidence %
  action: string;            // suggested action ("Add as Region", "Place under X", …)
  excerpt: string;           // source quote
  cite: string;              // source chapter & page
  reason: string;            // why extraction surfaced it
  relatedEntity?: string;    // "<name> (<entityType>)"
};
```

Queue card categories (filterable inside the editor right rail):
Locations, Placements, Travel, Characters, Bestiary, Items,
Quests / Events, Factions, Contradictions.

Each card surfaces: confidence band, candidate type pill, suggested
action pill, source citation, source quote, reason, map preview
(stylised SVG glyph), hierarchy preview (3-row breadcrumb), related
entity chip, and an action bar with **Accept · Edit · Merge · Deny**
plus ghost buttons for **Open source** and **Show on map**.

## Required callbacks

```
onAtlasContextSync(presetId)
onSetAtlasPreset(presetId)
onSelectMapObject(obj)
onClearAtlasContext()

onOpenAtlasEditor()
onExitAtlasEditor()
onRestorePreviousWorkspace()       // editor exit returns to last panel set

onCreateLocation(parentId?)
onEditLocation(loc)
onMoveLocation(loc, x, y)
onSetParentLocation(loc, parentId)
onAddChildLocation(parentId)
onDeleteLocation(loc)

onCreateTravelRoute(characterId)
onAddRouteWaypoint(routeId, waypoint)
onMoveRouteWaypoint(routeId, idx, x, y)

onToggleAtlasLayer(layerId)
onToggleAtlasLayerLock(layerId)
onSetAtlasLayerOpacity(layerId, 0..1)
onToggleAtlasLegend(chipId)

onScrubAtlas(chapterIdx)
onJumpAtlasCurrentChapter()

onOpenAtlasReviewQueue()
onAcceptQueueItem(id)
onEditQueueItem(id)
onMergeQueueItem(id)
onDenyQueueItem(id)
onProcessAllAtlasQueue()
onSetAtlasQueueCategory(catId)
onShowOnAtlas(id)
onOpenSourceMention(id)
```

## Side-panel ⇄ Editor invariant

Opening the editor must NOT unmount the Writer's Room route, the side
panel, or any other open panel. The editor renders as a fixed
full-viewport `<div class="atlas-fs-overlay">` so all state under it is
preserved. Exiting the editor (`onExitAtlasEditor`) restores the
previous workspace exactly — no fallback to a default route.
