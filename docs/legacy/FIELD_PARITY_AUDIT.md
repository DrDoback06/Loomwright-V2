# Field Parity Audit

Every entity type's panel/dossier surface vs its creation editor. Gaps
are listed and resolved.

## Cast

| Field | Panel/Dossier | Editor (before) | Editor (after) |
|---|---|---|---|
| name | ✓ | ✓ | ✓ |
| aliases | ✓ | ✓ | ✓ |
| role | ✓ | — | ✓ (Identity) |
| pronouns/age | ✓ | — | ✓ (Identity) |
| species, class, faction, occupation | ✓ | — | ✓ (Identity) |
| portrait | ✓ | — | ✓ (Appearance) |
| physical description + clothing | ✓ | — | ✓ (Appearance) |
| voice profile + speech style + verbal tics | ✓ | — | ✓ (Voice) |
| personality, goals, fears, secrets, flaws, strengths, moral compass | ✓ | — | ✓ (Psychology) |
| arc summary, backstory, current status, presence | ✓ | — | ✓ (Story Role) |
| stats, skills, abilities, status effects | ✓ | — | ✓ (RPG Systems) |
| inventory, equipped items, wealth | ✓ | — | ✓ (Equipment) |
| family/allies/enemies/lovers/rivals/mentors | ✓ | — | ✓ (Relationships) |
| current location, home, travel history, timeline, quests | ✓ | — | ✓ (Timeline/Locations) |
| source mentions, references | ✓ | — | ✓ (Source Mentions) |
| AI interview, writing instructions, avoid tropes | ✓ | — | ✓ (AI Interview) |
| status, dormant, do-not-suggest | ✓ | — | ✓ (Review/Save) |

**Result:** Cast editor rebuilt as deep 13-section sidebar layout.

## Bestiary

| Field | Panel | Editor (before) | Editor (after) |
|---|---|---|---|
| name, aliases, species, summary, description | ✓ | — | ✓ (Basics) |
| **threat level** | ✓ | **MISSING** | ✓ (Threat) |
| disposition, challenge rating, encounter posture | ✓ | — | ✓ (Threat) |
| habitat, regions, encounter locations, active times | ✓ | — | ✓ (Habitat) |
| behaviour, abilities/skills, weaknesses, diet, lifecycle | ✓ | — | ✓ (Behaviour) |
| related race/factions/quests/events/lore | ✓ | — | ✓ (Links) |
| chapter appearances, source mentions, references | ✓ | — | ✓ (Tracking) |
| status, dormant | ✓ | — | ✓ (Status) |

**Result:** Bestiary editor built from scratch with threatLevel + habitat + abilities + weaknesses + encounterLocations.

## Items

Already at parity in `entity-editor-configs.jsx`. Added:
- **ownershipHistory** (tracking)
- **sourceMentions** (tracking)

## Quests

Already at parity. Added:
- **sourceMentions** (tracking)

## Events

Already at parity. Added:
- **sourceMentions** (tracking)

## Locations

At parity — atlas placement, linked entities, tracking all present.

## Stats

At parity — extractionRules, value types, appliesTo.

## Skills

At parity.

## Classes

At parity.

## Races / Species

At parity.

## Lore / Canon

Built in `entity-editor-configs-extended.jsx`. Kind + confidence band
+ subjects + scope + source quotes + chapters + contradictions + ratifiedAt
+ status.

## References / Research

Built in extended configs. URL, kind, useFor, includeInAI, style/canon
flags, onboarding flag, related entities, tags, status.

## Factions

Built in extended configs. Kind, leader, members, size, structure, HQ,
goals, methods, ideology, allies, enemies, controlled locations, quests,
events, lore.

## Relationships

Built in extended configs. From → To, bond type, directionality,
intensity, valence, history, evidence, related events/quests, status.

## Timeline Events

Built in extended configs. Date label + absolute date, linked event,
characters, locations, quests, track, milestone, chapter.

---

## How the audit was generated

For every type registered in `window.ENTITY_EDITOR_CONFIGS`, the
template-generator helper `eeJsonTemplate(type)` walks the config
sections and emits one key per field. Comparing the generated
template to the panel renderer is now a one-liner — if a field
appears in the panel but not in the JSON template, it's missing.

Validate per-type:

```js
console.log(Object.keys(window.eeJsonTemplate("bestiary")));
// → ["type","name","aliases","speciesType","category","summary",
//    "description","threatLevel","disposition","challenge",…]
```
