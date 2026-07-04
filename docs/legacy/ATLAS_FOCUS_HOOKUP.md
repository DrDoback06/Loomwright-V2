# ATLAS_FOCUS_HOOKUP.md

How the Atlas Map Focus selector, side-panel layout, mini-map and focus inspector wire into a real backend. This supersedes the original Atlas comparison-preset wiring; the preset table (`ATLAS_CONTEXT_PRESETS`) is now a legacy fallback only.

---

## State shape

```ts
type AtlasFocusEntity = {
  type: "cast" | "bestiary" | "items" | "quests" | "events" | "factions"
      | "locations" | "timeline" | "lore";
  id: string;
  label: string;
  color?: string;            // entity palette
  icon?: string;
  sub?: string;              // role / habitat / status (one-liner)
  kind?: "character" | "habitat" | "trace" | "route" | "point"
        | "territory" | "focus" | "snapshot" | "filter";
};

type AtlasOverlayMode =
  | "current" | "travel" | "appearances" | "ful" | "habitat"
  | "territory" | "steps" | "snapshot" | "intersect" | "warnings";

type AtlasFocusState = {
  selectedEntityIds:   string[];          // flat ids — derived from selectedEntities
  selectedEntityTypes: string[];          // unique types
  selectedEntities:    AtlasFocusEntity[];
  selectedTimelineRange: { from: number | null, to: number | null };
  overlayMode:         AtlasOverlayMode;
  activeChapter:       number;            // 0-indexed
  comparisonMode:      "single" | "compare" | "intersect" | "diff";
  miniMapVisible:      boolean;
  inspectorCollapsed:  boolean;
};

type AtlasInspectorSummary = {
  title:           string;
  subtitle:        string;
  summary:         string;
  sections:        Array<{
    kind: "stops" | "trace" | "habitat" | "territory" | "shared" | "routes";
    label: string;
    items: Array<{ id: string, label: string, sub?: string }>;
  }>;
  relatedEntities: AtlasFocusEntity[];
  sourceMentions:  Array<{ chapter: number, page: number, excerpt: string }>;
  warnings:        Array<{ kind: "contradiction" | "missing-canon", note: string }>;
};
```

---

## Callbacks the side panel emits

```ts
onOpenAtlasFocusSelector():            void   // open the popover
onSearchAtlasFocusEntities(query):     void   // server-side search (debounce)
onSelectAtlasFocusEntity(entity):      void   // toggle on inside the popover
onDeselectAtlasFocusEntity(entity):    void   // toggle off inside the popover
onClearAtlasFocus():                   void
onApplyAtlasFocus(entities):           void   // commit draft → state
onCancelAtlasFocus():                  void   // discard draft

onRemoveAtlasFocusChip(entity):        void   // remove a chip from the toolbar
onOpenAtlasFocusSummary():             void   // expand "+N more" chip

onSetAtlasOverlayMode(mode):           void
onToggleAtlasOverlayMode(mode):        void

onAtlasSearch(query):                  void
onAtlasSearchResultFocus(entity):      void   // replace focus
onAtlasSearchResultAddToFocus(entity): void   // append to focus
onAtlasSearchResultOpenRelatedPanel(entity): void

onToggleAtlasMiniMap():                void
onMiniMapNavigate({ x, y }):           void   // center map on canvas coord

onToggleAtlasLayerFromLegend(layerId): void

onAtlasInspectorOpenSource(entity):    void   // → open Source tab in editor
onAtlasInspectorOpenRelatedEntity(e):  void   // → open the related panel
onAtlasInspectorPinFocus(entities):    void   // dock focus as a named saved view
```

---

## Side-panel layout (rows, top→bottom)

| Row              | Height       | Notes |
|------------------|--------------|-------|
| Toolbar          | auto (~40px) | search · Map Focus · jump-to-current · layers · queue · editor |
| Focus chips      | auto         | one row of pills, wraps; auto-hides when empty |
| Overlay mode     | auto         | hides when focus empty |
| Legend strip     | auto         | only shows layers with count > 0 |
| **Map (canvas)** | `1fr` (~60–70%) | dominant surface |
| Inspector        | auto, ≤36%   | collapsible — bar always visible |

Mini-map is a floating inset (`position: absolute`) inside the map row, defaults bottom-right. When collapsed it becomes a 24px round icon button.

---

## Focus → context translation (already implemented in atlas-side.jsx)

The side panel computes a `context.show.*` object from the focus list and passes it to `<AtlasMap>` (which already knows that shape). The rules:

| Focus types     | Context keys set                |
|-----------------|---------------------------------|
| cast (≥1)       | `routeIds`                      |
| cast (≥2)       | + `intersect` (locs visited ≥2) |
| bestiary        | `beastId`                       |
| items           | `itemId`                        |
| quests          | `questId`                       |
| factions        | `factionId`                     |
| locations       | `focusLocId` (single pin)       |
| timeline        | `chapterDiff` (skip "current" / "all") |

For multi-type focus, all relevant keys are set and `<AtlasMap>` layers them in render order (factions → beasts → routes → quests → items → pins).

---

## Overlay mode → supported entity types

| Mode          | Supports               | Effect                                              |
|---------------|------------------------|-----------------------------------------------------|
| `current`     | cast, items            | "Where is X right now"                              |
| `travel`      | cast                   | Full route line, beaded waypoints                   |
| `appearances` | cast, items, factions  | Pins on every mention chapter                       |
| `ful`         | items                  | Found / Used / Lost markers + dotted trace          |
| `habitat`     | bestiary               | Habitat polygon overlay + encounter pins            |
| `territory`   | factions               | Controlled-region tint + HQ marker                  |
| `steps`       | quests                 | Numbered step markers + arrows                      |
| `snapshot`    | timeline               | Re-renders all overlays at chapter state            |
| `intersect`   | cast (≥2)              | Routes + halo on shared waypoints                   |
| `warnings`    | lore                   | Contradiction icons on contested locations          |

On Apply, the panel auto-picks a sensible overlay mode based on the new focus types.

---

## Apply / Cancel semantics

- The popover keeps a **draft** copy of the focus list while open.
- `onApply` commits draft → focus and closes; `onCancel` discards.
- Apply also auto-picks a sensible overlay mode for the new focus types.

---

## Demo seed

The panel boots with `[{ type: "cast", id: "aelinor", … }]` so the inspector + map are populated on first open. Backend should treat this as the equivalent of "the writer's current cross-panel Cast selection".

---

## Debug surface (Tweaks → Atlas → Debug)

Live state visible in the tweaks panel:

```
activeAtlasFocusEntities   list of "type:id" pairs
activeAtlasFocusTypes      unique types in focus
activeOverlayMode          current mode
activeAtlasChapter         current chapter label
visibleAtlasLayers         comma list of layer ids
miniMapVisible             bool
inspectorCollapsed         bool
lastAtlasFocusChange       reason · entity · timestamp
```
