# TODAY_AI_HOOKUP.md

## Today

Two surfaces:
- `TodayScreen` — full-width route (routeId === "today"); see app.jsx.
- `TodayPanelBody` — side-panel version (panel.id === "p-today").

### Suggestion shape
```ts
todaySuggestion = {
  id, section,                     // see TODAY_SECTIONS
  title: string,
  why: string,                     // why this matters
  related: EntityChip[],
  action: string,                  // suggested action label
  chapter?: string,
  confidence: "high" | "strong" | "uncertain" | "weak",
}
```

Sections: `prompts` · `quests` · `threads` · `untouched` ·
`continuity` · `callbacks` · `queue` · `intel`.

### Callbacks
- `onGenerateTodayPrompts`
- `onDismissTodaySuggestion`, `onSaveTodaySuggestion`
- `onSendSuggestionToWriter`, `onSendSuggestionToTangle`
- `onOpenRelatedTab`

## AI Writer

Lives in `AiWriterPanelBody` (panels.jsx checks `panel.id === "p-aiWriter"`).
Modes: Revise Passage · Continue Writing · Write Chapter · Write
Paragraphs · Write Add-In · Style Match · Tone Shift · Dialogue Polish
· Continuity Check.

### Mode shape
```ts
aiWriterRequest = {
  mode: AIWriterMode,
  selection?: { chapter, range, text },
  cursor?:    { chapter, page, offset },
  entities: EntityChip[],
  instruction: string,
  style?: string, pov?: string, length?: string,
  beats?: string[],
  avoid?: string,
}

aiWriterDraft = {
  id, mode, text, words,
  generatedAt: number,
  rejected?: boolean,
}
```

### Callbacks
- `onOpenAIWriter`, `onOpenAIWriterMode`
- `onGenerateAIWriterDraft`
- `onAcceptGeneratedText`, `onInsertGeneratedText`,
  `onCopyGeneratedText`, `onDismissGeneratedText`
- `onDropEntityIntoAIWriter`
- `onRunContinuityCheck`
- `onAddBeat`
- `onEditAIWriterInstruction`

## Note on previews

Previews are static, hand-written prose samples in the Pale Reach
voice (see `AI_PREVIEWS` in `today-ai.jsx`). Hooking up to a real
model: replace the static `previewText` with the model's response,
keyed by `mode`. Generate button already wires `onGenerateAIWriterDraft`.
