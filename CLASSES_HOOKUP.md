# Classes — Hook-up Notes

## Purpose
Classes are archetypes / professions / roles / templates a character belongs
to. Genre-neutral. Drive default stats, allowed skills, restrictions, and
starting equipment.

## UI Components
- `ClassDetail` (`rpg-entities.jsx`) — dossier renderer.
- `ClassesPanelBody` (`upgrades-classes-races.jsx`) — bespoke list +
  dossier panel body. Wired into `panel-stack.jsx` for
  `entityType === "classes"`. Cards are draggable.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.classes`. Stat grid, starting
  skill picker, restriction rule-list, compatible races/factions.

## Data Shape — Class
```js
{
  id, type: "classes", name, aliases,
  category, role,
  summary, description,
  defaultStats: [{ name, value, min, max }],
  statMods:     [{ target, delta, note }],
  startingSkills: [{ id, name }],
  allowedSkills:  [{ id, name }],
  linkedSkillTrees: [{ id, name }],
  startingItems:    [{ id, name }],
  startingSlots:    ["Main Hand", "Body", "Pack"],
  restrictions: [{ name, note }],
  compatibleRaces:    [{ id, name }],
  compatibleFactions: [{ id, name }],
  assignedCharacters: [{ id, name }],
  progressionNotes: "…",
  firstChapter, sourceMentions, references,
  tags, notes,
  status, dormant, doNotSuggest,
}
```

## Review Queue Categories
class candidate, class assignment detected, default-stat suggestion,
skill link, starting-equipment suggestion, restriction suggestion,
duplicate class/archetype.

## Callbacks
`onCreateClass`, `onOpenClassEditor`, `onSaveClassDraft`,
`onSaveClass`, `onEditClass`, `onDuplicateClass`,
`onAssignClassToCharacter`, `onLinkClassSkill`, `onLinkClassSkillTree`,
`onAddClassDefaultStat`, `onAddClassRestriction`,
`onAddClassStartingEquipment`, `onOpenClassCharacter`,
`onOpenClassSkillTree`, `onSetClassStatus`, `onToggleClassDormant`,
`onDropClassIntoComposition`, `onAcceptClassQueueItem`,
`onEditClassQueueItem`, `onMergeClassQueueItem`, `onDenyClassQueueItem`.

## Composition Drag Payload
`{ entityType: "classes", id, name, summary }`. Default role: `"class context"`.
