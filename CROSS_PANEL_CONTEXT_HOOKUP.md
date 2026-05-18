# Cross-Panel Context — Hook-up Notes

## Purpose
Panels can react to selections in other panels. Selecting Aelinor Vey in
Cast should update Items (her equipment), Atlas (her last-seen pin),
Timeline (her appearances), Skill Trees (her skills), Relationships.

## Context Broadcast Mechanism
Selecting an entity in a panel:
1. Updates the panel's local selection.
2. Broadcasts to AppShell via `onSelectEntity(row, panel)`.
3. AppShell stores `focusedByType[entityType] = { id, label, ts }`.
4. Each panel renders a *filter chip* showing focuses for **other**
   entity types, and can scope its list to that focus.

## Selection State
```js
focusedByType: {
  cast:      { id: "c1", label: "Aelinor Vey", ts: 1234 },
  items:     { id: "i1", label: "Bone Auger",  ts: 1235 },
  locations: { id: "loc-vraska", label: "Vraska Pass", ts: 1236 },
}
```

## crossPanelContext Payload
Hooks that need to broadcast a multi-entity selection use:
```js
crossPanelContext {
  sourcePanel:        "p-cast",
  selectedEntityIds:  ["c1", "i1"],
  selectedEntityTypes:["cast", "items"],
  selectionReason:    "ambient | user-click | extraction-candidate",
  overlayMode:        "filter | highlight | scope",
  targetPanels:       ["p-items", "p-atlas", "p-timeline"],
}
```

## Per-Tab Cross-Panel Reactions

### Locations
- Atlas → show pin
- Cast seen here
- Bestiary found here
- Items found/used here
- Quests/Events located here
- Timeline events here
- Factions present here

### Items
- Cast equipment slots → assign
- Atlas found/used/lost locations
- Quests/Events linked
- Stats affected (via modifiers)
- Skills granted (via item-granted skills)
- Timeline appearances
- Dormant/forgotten flags

### Classes
- Cast assigned
- Stats linked
- Skills / Skill Trees linked
- Items / starting equipment
- Race/Faction restrictions

### Races
- Cast assigned
- Bestiary linked
- Factions linked
- Origin Location / Atlas
- Classes / Stats / Skills linked

### Stats
- Apply to Cast, Items, Bestiary, Factions, Classes, Races
- Extraction rules → Review Queue
- Significant changes → Events / Timeline markers

### Quests
- Cast, Items, Locations, Events, Factions
- Atlas route nodes (in travel order)
- Quest timeline
- Events from steps
- Completion / failure tracking

### Events
- Timeline nodes
- Atlas placement
- Quests progression
- Relationship changes
- Item state mutations
- Stat changes
- Cast / Faction effects

## Shared Cross-Panel Callbacks
`onBroadcastPanelSelection(selection)`,
`onReceivePanelContext(context)`,
`onOpenRelatedTab(entityType, entityId)`,
`onPinRelatedPanel(panelKind)`,
`onShowSelectedOnAtlas(entityId)`,
`onShowSelectedOnTimeline(entityId)`,
`onOpenSourceChapter(chapterId, paragraphId)`,
`onLinkEntityToEntity(sourceId, targetId, kind)`,
`onCreateEntityFromRelationship(relId)`,
`onCreateEventFromEntityChange(entityId, changeId)`.

## Manual Creation vs Extraction Creation
Both produce the same final entity object. UI distinction:
- Manual: `<EntityEditor open type=... />`
- Extraction: `<EntityEditor open type=... initial=... promoteFrom={candidate}/>`

Candidates can be promoted into the full editor with one click (Edit
button in the queue card). Blue-confidence items may auto-save but stay
visible in the queue for review.
