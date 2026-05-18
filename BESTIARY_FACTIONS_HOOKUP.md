# BESTIARY_FACTIONS_HOOKUP.md

Bespoke renderers + side panels in `upgrades-bestiary-factions.jsx`.
Styles in `upgrades.css`.

## Bestiary data

```ts
bestiaryEntry = {
  id, type:"bestiary", name, glyphChar, subtitle, summary,
  species: string, habitat: string, behaviour: string,
  threat: 1 | 2 | 3 | 4 | 5,                  // 5-pip threat bar
  diet?: string, chapterRange?: string, queue?: number,
  mentionsByChapter?: number[],
  abilities?: string[], weaknesses?: string[],
  locations?: EntityChip[],
  factions?:  EntityChip[],
  encounters?: Array<{ id, chapter, location, outcome, cite? }>,
  quests?:  EntityChip[], events?: EntityChip[],
  lore?: string[],
  sourceMentions?: Array<{ id, excerpt, cite }>,
  contradictions?: Array<{ id, note }>,
}
```

`bestiaryHabitat` is implied by `habitat` plus the linked
`locations[]`. `bestiaryEncounter` is one row inside `encounters[]`.

## Faction data

```ts
faction = {
  id, type:"factions", name, glyphChar, subtitle, summary,
  facType: "House" | "Institution" | "Guild" | "Cult" | "Army" |
           "Religion" | "Organisation" | "Custom",
  ideology?: string, goals?: string,
  chapterRange?: string, queue?: number,
  mentionsByChapter?: number[],
  leaders: Array<{ id, type, label, role? }>,
  members: EntityChip[],
  territory: EntityChip[],
  controlledLocations: EntityChip[],
  resources?: string[],
  quests?: EntityChip[], events?: EntityChip[],
  relationships: Array<{
    id, with: { id, label },
    kind: "ally" | "enemy" | "rival" | "neutral",
    note?: string,
  }>,
  timeline?: Array<{ chapter, what }>,
  lore?: string[],
  sourceMentions?: Array<{ id, excerpt, cite }>,
}

factionMembership = { factionId, memberId, role?, since?, ended? }
factionTerritory  = { factionId, locationId, kind?, contested? }
factionRelationship = (see relationships[])
```

## Callbacks

Bestiary:
- `onCreateBestiaryEntry`, `onEditBestiaryEntry`
- `onAssignBestiaryHabitat`, `onLinkBestiaryLocation`
- `onOpenBestiaryOnAtlas`, `onLinkRaceBestiary`
- `onOpenBestiarySourceMention`
- `onAcceptBestiaryQueueItem`, `onEditBestiaryQueueItem`, `onMergeBestiaryQueueItem`, `onDenyBestiaryQueueItem`
- `onOpenBestiaryReviewQueue`

Factions:
- `onCreateFaction`, `onEditFaction`
- `onAssignFactionMember`, `onAssignFactionLeader`, `onAssignFactionTerritory`
- `onOpenFactionOnAtlas`, `onOpenFactionRelationships`, `onOpenFactionTimeline`
- `onAcceptFactionQueueItem`, `onEditFactionQueueItem`, `onMergeFactionQueueItem`, `onDenyFactionQueueItem`
- `onOpenFactionsReviewQueue`

## Cross-panel
Selecting a bestiary entry updates Atlas (habitat), Locations
(creatures found here), Lore (canon facts), and Bestiary review queue.
Selecting a faction updates Cast (members), Locations (territory),
Quests/Events, Relationships, Timeline.
