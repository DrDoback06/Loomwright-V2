# Quests + Events — Hook-up Notes

## Purpose
Quests and Events are distinct but linked. **Quests** are ongoing
trackable threads with steps, branches, status, and an owner. **Events**
are specific happenings at a time/place that create Timeline nodes.

Events can progress quests, change relationships, mutate items, change
stats. A quest step can promote into an Event (with
`onCreateEventFromQuestStep`).

## UI Components
### Quests
- `QuestsPanelBody` (`upgrades-quests-events.jsx`) — bespoke list +
  dossier with step tracker.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.quests`. Step list (`step-list`),
  branch list (`branch-list`), conditions, outcomes, atlas route.

### Events
- `EventsPanelBody` (`upgrades-quests-events.jsx`) — bespoke list +
  dossier with cause → consequence chain.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.events`. Cause/outcome/consequence
  textareas, relationship/character/item/location/stat change lists.

## Data Shape — Quest
```js
{
  id, type: "quests", title, aliases,
  questType,                          // see EE_QUEST_TYPES
  status,                             // "Not started|Active|Completed|Failed|Hidden|Future|Abandoned|Optional|Recurring|Unknown"
  summary, goal,
  owner: { id, name },                // primary actor
  participants: [{ id, name }],
  factions: [{ id, name }],
  steps: [QuestStep],
  branches: [QuestBranch],
  conditions: [{ name, note }],
  outcomes: [{ name, note }],
  rewards: "…",
  relatedEvents: [{ id, name }],
  locations: [{ id, name }],
  items: [{ id, name }],
  atlasRoute: [{ id, name }],         // in travel order
  startChapter, completionChapter,
  timelinePosition: "Year 3 / Spring",
  sourceMentions, references,
  tags, notes,
  status (entity), dormant, doNotSuggest,
}
```

## QuestStep / QuestBranch
```js
QuestStep {
  id, title, status,          // Not started | Active | Completed | Failed | Skipped | Optional
  chapter, location,
  participants?: [{id, name}],
  sourceMention?: SourceMention,
}
QuestBranch {
  id, name, condition, outcome,
  steps?: [QuestStep],
}
```

## Data Shape — Event
```js
{
  id, type: "events", title, aliases,
  eventType,                          // EE_EVENT_TYPES
  summary,
  chapter,                            // "Ch. 5 — last week"
  timelinePosition: "Year 3 / Spring / Day 12",
  location: { id, name },
  atlasPlacement: "…",
  participants: [{ id, name }],
  factions: [{ id, name }],
  cause,                              // textarea
  immediateOutcome,                   // textarea
  longTermConsequence,                // textarea
  relationshipChanges:   [{ target, delta, note }],
  characterStateChanges: [{ target, delta, note }],
  itemStateChanges:      [{ target, delta, note }],
  locationChanges:       [{ target, delta, note }],
  statChanges:           [{ target, delta, note }],
  relatedQuests, relatedItems,
  sourceMentions, references,
  tags, notes,
  status, dormant, doNotSuggest,
}
```

## Quest → Event Promotion
`onCreateEventFromQuestStep(stepId, questId)` creates a new Event,
copies the step's chapter/location/participants, and links the Event
back as a `relatedEvents` entry on the Quest.

## Review Queue Categories
**Quests**: candidate, step detected, progression, completion, failure,
branch, participant link, item link, location link, unresolved thread,
contradiction.

**Events**: candidate, event type detected, participant detected,
location link, cause/outcome detected, relationship change, stat change,
item change, quest progression, timeline conflict, consequence detected,
duplicate.

## Callbacks (Quests)
`onCreateQuest`, `onOpenQuestEditor`, `onSaveQuestDraft`, `onSaveQuest`,
`onEditQuest`, `onAddQuestStep`, `onCompleteQuestStep`,
`onFailQuestStep`, `onBranchQuest`, `onLinkQuestCharacter`,
`onLinkQuestItem`, `onLinkQuestLocation`, `onLinkQuestFaction`,
`onLinkQuestEvent`, `onShowQuestOnAtlas`, `onOpenQuestTimeline`,
`onCreateEventFromQuestStep`, `onSetQuestStatus`,
`onToggleQuestDormant`, `onDropQuestIntoComposition`,
`onAcceptQuestQueueItem`, `onEditQuestQueueItem`,
`onMergeQuestQueueItem`, `onDenyQuestQueueItem`.

## Callbacks (Events)
`onCreateEvent`, `onOpenEventEditor`, `onSaveEventDraft`, `onSaveEvent`,
`onEditEvent`, `onLinkEventCharacter`, `onLinkEventItem`,
`onLinkEventLocation`, `onLinkEventFaction`, `onLinkEventQuest`,
`onCreateEventConsequence`, `onCreateRelationshipChangeFromEvent`,
`onCreateTimelineNodeFromEvent`, `onShowEventOnAtlas`,
`onOpenEventTimeline`, `onSetEventStatus`, `onToggleEventDormant`,
`onDropEventIntoComposition`, `onAcceptEventQueueItem`,
`onEditEventQueueItem`, `onMergeEventQueueItem`,
`onDenyEventQueueItem`.

## Composition Drag Payloads
- Quest: `{ entityType: "quests", id, name, summary }`. Role: `"progressed"`.
- Event: `{ entityType: "events", id, name, summary }`. Role: `"current happening"`.
