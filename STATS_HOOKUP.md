# Stats — Hook-up Notes

## Purpose
Stats are universal trackable values applied to Cast, Bestiary, Items,
Classes, Races, Factions, Quests, Events, or custom entities. Stats are
**the foundation of entity extraction** — phrase rules convert
manuscript prose into stat change candidates for the review queue.

## UI Components
- `StatDetail` (`rpg-entities.jsx`) — dossier renderer.
- Entity Editor: `ENTITY_EDITOR_CONFIGS.stats`. Includes:
  - **Extraction Rule List** (`extraction-rule-list` field kind) —
    inline editor for phrase / match-type / effect / value / confidence rows.
  - **Test Phrase Tool** (`test-phrase` field kind) — type a phrase, see
    which rule matches, the confidence band, and the preview queue card.
- Stat panel body is the standard EntityFrameworkPanelBody.

## Data Shape — Stat
```js
{
  id, type: "stats", name, aliases,
  summary,
  valueType: "number|percentage|scale|label|boolean|text|custom",
  displayFormat: "N / 20",
  defaultValue, min, max,
  appliesTo: ["Cast","Bestiary",…],
  extractionRules: [ExtractionRule],
  relatedSkills, relatedItems, relatedClasses, relatedRaces,
  history:   [{ chapter, subject, delta?, qualitative?, cite }],
  sourceMentions, references,
  tags, notes,
  status, dormant, doNotSuggest,
}
```

## Extraction Rule Object
```js
ExtractionRule {
  phrase:     "strength increased by +N",
  match:      "exact phrase | contains phrase | synonym group |
               numeric pattern | qualitative phrase |
               decrease phrase | increase phrase",
  effect:     "increase | decrease | set | qualitative | needs-review",
  value:      "+3" | "−1" | "no value (qualitative)" | "{ min, max }",
  confidence: "blue (95+) | green | orange | red",
  targetStat: "Strength",          // for cross-stat rules
  appliesTo:  "Cast" | "Bestiary" | "*",
  exampleSentence: "She held the line through the long night.",
  active: bool,
}
```

## Stat Change Review Queue Item
```js
reviewQueueItem (stat change) {
  id, entityType: "stats",
  candidateType: "exact increase|exact decrease|qualitative change|
                  unknown value|possible contradiction|assignment|
                  rule suggestion",
  confidence: { band: "blue|green|orange|red", value: 0-100 },
  sourceChapter: { num, paragraphId, cite },
  sourceQuote:   "…",
  targetEntity:  { type: "cast", id: "c1", name: "Aelinor Vey" },
  targetStat:    "Resolve",
  suggestedChange: { delta: +1 } | { qualitative: "held the line" } | { setValue: "House-recognized" },
  conflict?: { kind: "value-contradiction", note: "Was +2 in Ch.3" },
  status: "pending|accepted|denied|merged",
}
```

## Test Phrase Behaviour
- Reads `data.extractionRules` (the current editor state).
- For each rule, compares phrase fragment (with `+N/-N` placeholders
  stripped) against the test input (case-insensitive contains).
- Returns first match. Backend should replace with a real NLP run.
- Output card mirrors the Review Queue card shape so coding agents can
  reuse the same component.

## Callbacks
`onCreateStat`, `onOpenStatEditor`, `onSaveStatDraft`, `onSaveStat`,
`onEditStat`, `onAssignStat`, `onUpdateStatValue`, `onAddStatChange`,
`onAddStatExtractionRule`, `onEditStatExtractionRule`,
`onDisableStatExtractionRule`, `onDeleteStatExtractionRule`,
`onTestStatPhrase`, `onPreviewStatQueueResult`, `onSetStatStatus`,
`onToggleStatDormant`, `onDropStatIntoComposition`,
`onAcceptStatQueueItem`, `onEditStatQueueItem`, `onMergeStatQueueItem`,
`onDenyStatQueueItem`.

## Significant Stat Change → Event Trigger
When a stat change crosses a threshold (TBD per stat), the backend
should create an Event entity (`onCreateEventFromEntityChange`) so the
Timeline can pin the moment. This is the cross-system glue between
Stats → Events → Timeline.

## Composition Drag Payload
`{ entityType: "stats", id, name, summary }`. Default role: `"central stat"`.
