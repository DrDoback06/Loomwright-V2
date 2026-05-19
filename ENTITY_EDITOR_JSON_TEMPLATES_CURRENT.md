# Entity Editor JSON Templates — Current

_Generated 2026-05-19 from `window.eeJsonTemplate(type)` on
`claude/field-parity-pass` after the field-parity config additions._

> **How to use.** Every entity editor exposes:
> - **Copy blank JSON template** — produces the template below for the
>   entity's type.
> - **Copy current entity JSON** — produces a JSON with the saved
>   values.
> - **Paste JSON** — fills the editor inputs from a JSON object.
> - **Validate JSON** — checks shape before paste.
> - **Apply JSON** — populates the editor.
> - **Save** — persists the entity, including any unknown/deeper
>   fields under `extra` (preserved across save+reload).
>
> The templates below are the **blank** templates. Each key
> corresponds to one editor field. The hint values are placeholders
> the editor renders; an external AI can fill them and re-import.
>
> **JSON round-trip is guaranteed for all 8 priority types** by
> `tests/e2e/08-field-parity.spec.js` and the
> `[field-parity round-trip]` block in `npm run test:smoke`.

## Cast

```json
{
  "type": "cast",
  "name": "e.g. Aelinor Vey",
  "aliases": [],
  "summary": "One-line who-and-why.",
  "description": "",
  "role": "Protagonist | Co-protagonist | Antagonist | Deuteragonist | Mentor | Foil",
  "pronouns": "she/her | he/him | they/them | xe/xem | ze/zir | it/its",
  "ageRange": "child | teen | young adult | adult | middle-aged | elderly",
  "age": "31",
  "title": "Lady, Captain, Apprentice…",
  "species": "",
  "class": "",
  "faction": "",
  "occupation": "",
  "portrait": "",
  "physicalDescription": "",
  "clothing": "",
  "distinguishingMarks": [],
  "voiceProfile": "terse | lyrical | blunt | wry | formal | colloquial",
  "speechStyle": "Sentence rhythm. Vocabulary. Do they swear, hedge, evade?",
  "verbalTics": [],
  "languages": [],
  "personality": "",
  "goals": [],
  "fears": [],
  "secrets": "",
  "flaws": [],
  "strengths": [],
  "moralCompass": "Where do they draw lines?",
  "arcSummary": "Where do they start? Where do they end?",
  "backstory": "",
  "currentStatus": "",
  "presence": "on-stage | off-stage | mentioned only | absent | dead | missing",
  "stats": [{ "name": "Stat name", "value": 0, "min": 0, "max": 100 }],
  "skills": [],
  "abilities": [],
  "statusEffects": [],
  "inventory": [],
  "equippedItems": [],
  "wealth": "",
  "carryingNotes": "",
  "family": [],
  "allies": [],
  "enemies": [],
  "lovers": [],
  "rivals": [],
  "mentors": [],
  "relationshipNotes": "",
  "currentLocation": "",
  "homeLocation": "",
  "travelHistory": [],
  "firstAppearance": "Ch. 1, p. 4",
  "lastAppearance": "",
  "timelineEvents": [],
  "quests": [],
  "sourceMentions": "Quotes / passages where this character appears.",
  "references": [],
  "writingInstructions": "How should AI handle this character? POV rules, voice notes, things to avoid.",
  "aiInterview": "Free-form Q&A or character bible.",
  "avoidTropes": [],
  "preferredScenes": [],
  "tags": [],
  "status": "active | important | needs-review | dormant | draft | hidden",
  "doNotSuggest": false,
  "dormant": false
}
```

## Items

```json
{
  "type": "items",
  "name": "e.g. Bone Auger",
  "aliases": [],
  "itemType": "Weapon | Armour | Clothing | Tool | Key | Relic",
  "customType": "",
  "rarity": "Common | Uncommon | Rare | Heirloom | Legendary | Cursed",
  "summary": "",
  "description": "",
  "icon": "",
  "weight": "e.g. 3.4 lb",
  "value": "Currency / barter / priceless",
  "condition": "Pristine | Used | Worn | Damaged | Broken | Destroyed",
  "durability": "e.g. 3 / 3",
  "currentOwner": "",
  "currentLocation": "",
  "status": "active | carried | equipped | stored | lost | destroyed",
  "slot": "",
  "carried": false,
  "equipped": false,
  "modifiers": [{ "target": "Stat name", "delta": 0, "note": "e.g. Resolve +1 in cold" }],
  "affixes": [{ "target": "Stat name", "delta": 0, "note": "e.g. Resolve +1 in cold" }],
  "passive": "",
  "active": "",
  "triggered": "",
  "restrictions": "",
  "compatibleClasses": [],
  "compatibleRaces": [],
  "linkedStats": [],
  "linkedSkills": [],
  "quests": [],
  "events": [],
  "factions": [],
  "foundLocation": "",
  "lostLocation": "",
  "destroyedLocation": "",
  "usedLocations": [],
  "firstChapter": "",
  "lastChapter": "",
  "ownershipHistory": "",
  "tradeTransferHistory": "",
  "sourceMentions": "",
  "tags": [],
  "notes": "",
  "references": [],
  "entityStatus": "active | important | needs-review | dormant | draft | hidden",
  "doNotSuggest": false,
  "dormant": false
}
```

## Locations

```json
{
  "type": "locations",
  "name": "e.g. Vraska Pass",
  "aliases": [],
  "kind": "",
  "customKind": "",
  "parentId": "",
  "summary": "One paragraph the wiki opens with.",
  "description": "Sight, sound, smell. What's it like to enter?",
  "history": "",
  "culture": "",
  "climate": "",
  "danger": "safe | watched | risky | dangerous | forbidden",
  "currentStatus": "e.g. Held by Grey Coats, under quarantine",
  "placed": false,
  "coords": { "x": 0, "y": 0 },
  "atlasMap": "",
  "routes": [],
  "characters": [],
  "bestiary": [],
  "items": [],
  "quests": [],
  "events": [],
  "factions": [],
  "firstChapter": "Ch. 1, p. 12",
  "lastChapter": "Ch. 7, p. 188",
  "sourceMentions": "",
  "childLocationIds": [],
  "tags": [],
  "notes": "",
  "references": [],
  "status": "active | important | needs-review | dormant | draft | hidden",
  "doNotSuggest": false,
  "dormant": false,
  "reviewable": false
}
```

## Quests

```json
{
  "type": "quests",
  "title": "e.g. Brec's Letter",
  "aliases": [],
  "questType": "Main quest | Side quest | Promise | Mystery | Investigation | Challenge",
  "status": "Not started | Active | Completed | Failed | Hidden | Future",
  "summary": "",
  "goal": "",
  "owner": "",
  "participants": [],
  "factions": [],
  "steps": "",
  "branches": "",
  "conditions": [],
  "outcomes": [],
  "rewards": "",
  "relatedEvents": [],
  "locations": [],
  "items": [],
  "atlasRoute": [],
  "startChapter": "",
  "completionChapter": "",
  "timelinePosition": "e.g. Year 3 / Spring",
  "sourceMentions": "",
  "tags": [],
  "notes": "",
  "references": [],
  "entityStatus": "active | important | needs-review | unresolved | dormant | draft",
  "doNotSuggest": false,
  "dormant": false
}
```

### Quest step shape (when populating `steps`)

```json
{
  "id": "step-1",
  "title": "Leave Hess",
  "description": "Find a courier, leave by dawn.",
  "status": "complete | in-progress | pending | failed",
  "actorId": "<cast id>",
  "locationId": "<location id>",
  "itemIds": ["<item id>"],
  "eventId": "<event id>",
  "sourceMentionId": "<mention id>",
  "completedAt": "Ch. 4",
  "chapterId": "<chapter id>"
}
```

## Events

```json
{
  "type": "events",
  "title": "e.g. The Auger Wake",
  "aliases": [],
  "eventType": "Battle | Meeting | Discovery | Death | Betrayal | Travel",
  "summary": "",
  "chapter": "Ch. 5 — last week",
  "timelinePosition": "Year 3 / Spring / Day 12",
  "location": "",
  "atlasPlacement": "Pinned to map?",
  "cause": "",
  "immediateOutcome": "",
  "longTermConsequence": "",
  "participants": [],
  "factions": [],
  "relationshipChanges": [],
  "characterStateChanges": [],
  "itemStateChanges": [],
  "locationChanges": [],
  "statChanges": [],
  "relatedQuests": [],
  "relatedItems": [],
  "tags": [],
  "sourceMentions": "",
  "notes": "",
  "references": [],
  "status": "active | important | needs-review | contradiction | dormant | draft",
  "doNotSuggest": false,
  "dormant": false
}
```

## Stats

```json
{
  "type": "stats",
  "name": "e.g. Resolve",
  "aliases": [],
  "summary": "",
  "valueType": "number | percentage | scale | label | boolean | text",
  "displayFormat": "e.g. 'N / 20' or 'High / Med / Low'",
  "defaultValue": "",
  "min": 0,
  "max": 0,
  "appliesTo": ["Cast", "Bestiary", "Items"],
  "extractionRules": [],
  "testPhrase": "",
  "relatedSkills": [],
  "relatedItems": [],
  "relatedClasses": [],
  "relatedRaces": [],
  "assignedEntities": [],
  "changeHistory": "",
  "sourceMentions": "",
  "tags": [],
  "notes": "",
  "references": [],
  "status": "active | important | needs-review | dormant | draft | archived",
  "doNotSuggest": false,
  "dormant": false
}
```

### Stat extraction rule shape

```json
{
  "phrase": "resolve hardened",
  "pattern": "<actor>'s resolve hardened",
  "matchType": "phrase | regex | nlp",
  "effectType": "increase | decrease | set | qualitative | needs-review",
  "value": 1,
  "confidenceDefault": 0.75,
  "targetStat": "<stat id>",
  "appliesToEntityType": "cast",
  "exampleSentence": "Aelinor's resolve hardened against the wind.",
  "active": true
}
```

## Bestiary

```json
{
  "type": "bestiary",
  "name": "e.g. Hess Wolfhound",
  "aliases": [],
  "speciesType": "",
  "category": "mundane | minor | moderate | major | apex | mythic",
  "summary": "",
  "description": "",
  "threatLevel": "mundane | minor | moderate | major | apex | mythic | unique | unknown",
  "disposition": "docile | wary | hostile | ambush | territorial | intelligent",
  "challenge": "",
  "fightOrFlight": "",
  "habitat": "",
  "regions": [],
  "encounterLocations": [],
  "activeTimes": [],
  "behaviour": "",
  "abilities": [],
  "weaknesses": [],
  "diet": "",
  "lifecycle": "",
  "relatedRace": [],
  "relatedFactions": [],
  "relatedLocations": [],
  "relatedQuests": [],
  "relatedEvents": [],
  "lore": [],
  "chapterAppearances": [],
  "sourceMentions": "",
  "references": [],
  "status": "",
  "doNotSuggest": false,
  "dormant": false
}
```

## References

```json
{
  "type": "references",
  "title": "",
  "kind": "website | document | image | video | audio | manuscript excerpt | style sample",
  "url": "",
  "author": "",
  "summary": "",
  "body": "",
  "useFor": "voice | canon | research",
  "includeInAI": false,
  "isStyleSample": false,
  "isCanonSource": false,
  "isResearchNote": false,
  "isOnboardingAnswer": false,
  "relatedEntities": [],
  "tags": [],
  "status": "active | important | needs-review | dormant | draft",
  "doNotSuggest": false
}
```

## Unknown/deeper field preservation

`EntityService.save(type, fields, opts)` writes the entity blob whole.
Any key present in `fields` that the editor doesn't understand
survives save and reload — verified by:

- `[unknown-field preservation: extra.future survives save+reload]`
  smoke check (in `scripts/smoke-services.js`)
- `tests/e2e/08-field-parity.spec.js` "unknown/deeper fields survive
  save+reload" test

Recommended convention for callers that want to stash domain-specific
extras outside the canonical schema:

```json
{
  "name": "Future-friend",
  "extra": {
    "future": "value",
    "schemaVersion": "v3"
  }
}
```

Anything under `extra.*` is round-tripped as opaque data.

## Audit-only types

These types have their own editor configs and JSON templates (use
`window.eeJsonTemplate(type)` at runtime to retrieve them). They get
smoke-level round-trip coverage in this pass but no rich-field
template doc:

- `classes`, `races`, `skills`, `relationships`, `timeline`, `lore`

They are expected to be visited in a future pass if their panels add
new fields. Today's audit found no severe gaps in any of them.
