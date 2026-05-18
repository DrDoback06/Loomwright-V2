# RPG Core — Hook-up Notes

## Purpose
Documents the conceptual model shared by the RPG-style entity systems:
**Classes · Races / Species · Stats · Skills · Items**. These are
genre-neutral and intended to work for any author's project.

## Conceptual Model
| Entity | Meaning | Drives |
|---|---|---|
| **Class** | archetype / profession / role / template | default stats, allowed skills, restrictions, starting equipment |
| **Race / Species** | ancestry / species / culture / kind | traits, default stats, innate skills, origin location, factions, bestiary links |
| **Stat** | trackable value or trait | extraction phrase rules; applies to Cast, Bestiary, Items, Factions, Classes, Races, Quests, Events, custom |
| **Skill** | reusable action / trait / power / talent / technique / spell / ability | active / passive / triggered / one-time / temporary / innate / item-granted / class-granted / race-granted |
| **Item** | physical, abstract, magical, technological, symbolic, or story-significant object | ownership, slot, condition, effects, modifiers, history, links to quests/events/locations |

## Inter-System Links
- **Class → Race**: `compatibleRaces` field.
- **Class → Skill**: `startingSkills`, `allowedSkills`, `linkedSkillTrees`.
- **Class → Item**: `startingItems`, `startingSlots`.
- **Class → Stats**: `defaultStats`, `statMods`.
- **Race → Class**: `compatibleClasses`.
- **Race → Skill**: `innateSkills`.
- **Race → Stats**: `defaultStats`.
- **Race → Bestiary**: `bestiary` (links).
- **Race → Faction**: `factions`.
- **Race → Location**: `originLocations`.
- **Stat → Skill**: `relatedSkills`.
- **Stat → Item**: `relatedItems`.
- **Stat → Class/Race**: `relatedClasses`, `relatedRaces`.
- **Skill → Stat**: `linkedStats`.
- **Skill → Class/Race/Item**: `linkedClasses`, `linkedRaces`, `linkedItems`.
- **Skill → Cast**: `assignedCast`.
- **Item → Class/Race**: `compatibleClasses`, `compatibleRaces`.
- **Item → Stat/Skill**: `linkedStats`, `linkedSkills`.

## Genre-Neutrality Rules
- Vocabulary stays generic: "modifier", "affix", "trigger", "tier".
- No D&D / class-fantasy assumptions baked into the configs.
- Authors can rename every type via aliases.

## Default Data
The system seeds genre-neutral default examples in `rpg-entities.jsx`
`RPG_*_DATA` constants. They use the Pale Reach / Hess sample world.

## Cross-System Callbacks
`onAssignClassToCharacter`, `onAssignRaceToCharacter`,
`onAssignSkillToCharacter`, `onAssignStat`, `onAssignItemOwner`,
`onLinkSkillToClass`, `onLinkSkillToRace`, `onLinkSkillToItem`,
`onLinkSkillToStat`, `onLinkClassSkillTree`, `onLinkRaceFaction`,
`onLinkRaceBestiary`, `onLinkItemToQuest`, `onLinkItemToEvent`.
