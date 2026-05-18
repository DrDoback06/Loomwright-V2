# Skill Trees / Skills — Hook-up Notes

## Purpose
Skill Trees absorbs the formerly-separate Abilities tab. All abilities
are now Skills — active, passive, triggered, one-time, temporary,
innate, item-granted, class-granted, race-granted.

## Migration Status
- The Abilities tab in the left rail now shows a **deprecation card**
  (`AbilitiesPanelBody` in `upgrades-classes-races.jsx`) that:
  1. Explains the merge.
  2. Provides "Open Skill Trees" CTA.
  3. Lists legacy ability records that have been migrated.
- Existing `window.ENTITY_SAMPLES.abilities` records are preserved and
  treated as Skills for drag/drop purposes (`entityType: "skills"` on
  the drag payload).

## UI Components
- `SkillsPanelBody` (`skill-trees.jsx`) — existing tree visualisation
  + skill list. Unchanged in this pass.
- `AbilityDetail` (`rpg-entities.jsx`) — still renders for legacy
  abilities; treated as a skill of type `abilityType`.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.skills` (also wired as
  `abilities` config). Skill type pills, effects list, requirements,
  upgrade path, linked stats/classes/races/items/cast.

## Data Shape — Skill (subsumes Ability)
```js
{
  id, type: "skills", name, aliases,
  skillType: "active|passive|triggered|one-time|temporary|innate|item-granted|class-granted|race-granted|custom",
  cost, cooldown, limit,
  summary, description,
  requirements: [{ name, note }],
  effects: [{ trigger, effect, cost }],
  upgradePath: [{ tier, name, effect, unlocked }],
  linkedStats:   [{ id, name }],
  linkedClasses: [{ id, name }],
  linkedRaces:   [{ id, name }],
  linkedItems:   [{ id, name }],
  assignedCast:  [{ id, name }],
  skillTreeNodes: ["Diplomacy tree → Listen node", …],
  firstChapter, sourceMentions, references,
  tags, notes,
  status, dormant, doNotSuggest,
}
```

## Callbacks
`onCreateSkill`, `onOpenSkillEditor`, `onSaveSkill`,
`onAssignSkillToCharacter`, `onLinkSkillToClass`, `onLinkSkillToRace`,
`onLinkSkillToItem`, `onLinkSkillToStat`, `onAcceptAbilityMigration`,
`onOpenSkillTreesFromAbilities`.

## Composition Drag Payload
`{ entityType: "skills", id, name, summary }`. Role: `"used skill"`.
