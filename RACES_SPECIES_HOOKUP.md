# Races / Species — Hook-up Notes

## Purpose
Races/species cover ancestry, culture, bloodline, synthetic type, alien
species, spirit type, creature kind, etc. Drive traits, default stats,
innate skills, origin locations, and bestiary links.

## UI Components
- `RaceDetail` (`rpg-entities.jsx`) — dossier renderer.
- `RacesPanelBody` (`upgrades-classes-races.jsx`) — bespoke list +
  dossier. Wired into `panel-stack.jsx` for `entityType === "races"`.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.races`. Trait chip-field,
  stat-grid, innate-skills picker, origin location picker.

## Data Shape — Race / Species
```js
{
  id, type: "races", name, aliases,
  category,                        // Folk | Spirit | Beast | Synthetic | Alien | Undead | Elemental | Hybrid | Other
  summary, description,
  traits: ["Cold-acclimated", "Letter-trained", …],
  physical: "…",
  weaknesses: [{ name, note }],
  defaultStats: [{ name, value, min, max }],
  innateSkills: [{ id, name }],
  originLocations: [{ id, name }],
  habitat: "…",
  factions:      [{ id, name }],
  bestiary:      [{ id, name }],
  culture: "…",
  history: "…",
  compatibleClasses: [{ id, name }],
  linkedCast:        [{ id, name }],
  firstChapter, sourceMentions, references,
  tags, notes,
  status, dormant, doNotSuggest,
}
```

## Review Queue Categories
race/species candidate, assignment suggestion, trait suggestion,
origin location suggestion, faction link, bestiary link, contradiction.

## Callbacks
`onCreateRace`, `onOpenRaceEditor`, `onSaveRaceDraft`, `onSaveRace`,
`onEditRace`, `onAssignRaceToCharacter`, `onLinkRaceBestiary`,
`onLinkRaceFaction`, `onAddRaceTrait`, `onAddRaceDefaultStat`,
`onAddRaceSkill`, `onShowRaceOnAtlas`, `onSetRaceStatus`,
`onToggleRaceDormant`, `onDropRaceIntoComposition`,
`onAcceptRaceQueueItem`, `onEditRaceQueueItem`, `onMergeRaceQueueItem`,
`onDenyRaceQueueItem`.

## Composition Drag Payload
`{ entityType: "races", id, name, summary }`. Default role: `"background culture"`.
