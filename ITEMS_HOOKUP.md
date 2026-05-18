# Items — Hook-up Notes

## Purpose
Items are the manuscript's pickable, equipable, traded, lost, destroyed
objects. They hook into Cast equipment, Quests, Events, Atlas (found /
used / lost locations), and Stats (modifiers).

## UI Components
- `ItemDetail` (`rpg-entities.jsx`) — bespoke dossier renderer with
  modifiers, affixes, effects, ownership timeline, found/used/lost sites.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.items`. Slot picker, modifier
  list, effects list, related-entity pickers.
- Cast integration: `CastEquipmentSlots` (`cast.jsx`) renders the
  10-slot equipment grid in every CastDetail dossier. Drops items into
  slots via the standard drag payload.

## Data Shape — Item
```js
{
  id, type: "items", name, aliases,
  itemType, customType, rarity, slot,
  description, summary, weight, value,
  condition, durability, charges,
  currentOwner: { id, name },
  currentLocation: { id, name },
  carried: bool, equipped: bool,
  status: "active|carried|equipped|stored|lost|destroyed|retired|dormant",
  modifiers: [{ target, delta, note }],
  affixes:   [{ name, note }],
  passive:   [{ trigger, effect, cost }],
  active:    [{ trigger, effect, cost }],
  triggered: [{ trigger, effect, cost }],
  restrictions: "…",
  compatibleClasses: [{ id, name }],
  compatibleRaces:   [{ id, name }],
  linkedStats: [], linkedSkills: [],
  quests: [], events: [], factions: [],
  foundLocation: { id, name },
  lostLocation:  { id, name },
  usedLocations: [{ id, name }],
  ownership: [{ chapter, what, cite }],
  equipped:   [{ chapter, what, cite }],
  trades:     [{ chapter, what, cite }],
  upgrades:   [{ chapter, what, cite }],
  mentionsByChapter, sourceMentions, references,
  tags, notes,
  status, dormant, doNotSuggest,
  createdAt, updatedAt,
}
```

## Equipment Slot Object
```js
EquipmentSlot {
  id: "head|body|hands|main-hand|off-hand|accessory|tool|relic|pack|quest|custom",
  label, glyph,
  // when filled (in CastEquipmentSlots):
  itemId, name, condition, chapter, warning?
}
```

## Item Effect Object
```js
ItemEffect {
  trigger: "On strike|On equip|On full moon|…",
  effect:  "Bores three palm-deep…",
  cost:    "—|1 mana|1 charge|…",
}
```

## Item Modifier Object
```js
ItemModifier {
  target: "Resolve|Cunning|…",   // a Stat name
  delta:  +2 | -1,
  note:   "Carrier rolls with the rite's gravity.",
}
```

## Cast Equipment Integration
- Equipment slots (10 by default) live in `CastEquipmentSlots`.
- Each slot is a drop target tagged `data-ent-drop="cast"`.
- Dropping an item on a slot should fire `onEquipItem({ castId, itemId, slot })`.
- Slot status badges:
  - `warning` — yellow ⚠ for "not theirs" / "lost"
  - condition pills draw from `EE_ITEM_CONDITIONS`
  - last-mentioned chapter shown
- Cross-panel: clicking an equipped slot opens the Items panel
  (`window.dispatchEvent("lw:open-panel", { kind: "items" })`).

## Review Queue Categories
candidate, ownership change, owner transfer, found location, used location,
lost/destroyed, equipped/unequipped, property/effect, quest/event link,
duplicate, contradiction in ownership/location, forgotten-item warning.

## Callbacks
`onCreateItem`, `onOpenItemEditor`, `onSaveItemDraft`, `onSaveItem`,
`onSaveAndAssignItem`, `onEditItem`, `onAssignItemOwner`,
`onChangeItemLocation`, `onEquipItem`, `onUnequipItem`, `onTransferItem`,
`onDropItem`, `onLoseItem`, `onDestroyItem`, `onUpgradeItem`,
`onMergeItem`, `onAddItemEffect`, `onAddItemModifier`,
`onLinkItemToQuest`, `onLinkItemToEvent`, `onShowItemOnAtlas`,
`onOpenItemTimeline`, `onSetItemStatus`, `onToggleItemDormant`,
`onDropItemIntoComposition`, `onAcceptItemQueueItem`, `onEditItemQueueItem`,
`onMergeItemQueueItem`, `onDenyItemQueueItem`.

## Composition Drag Payload
`{ entityType: "items", id, name, summary }`. Default role: `"used by character"`.
