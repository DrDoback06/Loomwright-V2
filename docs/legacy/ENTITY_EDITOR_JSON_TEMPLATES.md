# Entity Editor — JSON Templates

Every entity type now has a typed JSON template generated from its
editor config. Lives in `entity-editor-configs-extended.jsx` via:

```js
window.eeJsonTemplate(type)        // blank skeleton with placeholder hints
window.eeJsonCurrent(data)         // strip metadata, keep current values
window.eeAIFillPrompt(type, data?) // template + instructions for external AI
```

## Field → hint mapping

| Editor field kind | Template value |
|---|---|
| `text`            | `"placeholder string"` or `""` |
| `textarea`/`longtext` | `"placeholder string"` |
| `chips`           | `[]` |
| `related`         | `""` |
| `related-multi`   | `[]` |
| `toggle`          | `false` |
| `number`          | `0` |
| `dual-number`     | `{ x: 0, y: 0 }` |
| `stat-grid`       | `[{ name: "Stat name", value: 0, min: 0, max: 100 }]` |
| `rule-list`       | `[{ target: "Stat name", delta: 0, note: "…" }]` |
| `pills` (options) | `"opt1 \| opt2 \| opt3"` so the AI knows the enum |
| `image-placeholder` | `""` |

## Three buttons in the editor

The PasteJSON tab (renamed "JSON · External AI handoff") exposes:

1. **Copy blank template** — `eeJsonTemplate(config.type)`, with
   placeholder hints. Also loaded into the textarea so the user can
   tweak before sending.
2. **Copy current entity JSON** — `eeJsonCurrent(data)`. Useful for
   asking an external AI to *improve* what you have.
3. **Copy AI fill prompt** — `eeAIFillPrompt(config.type, data)`.
   Returns a single prompt string including the template, the
   list of required fields, and the rule that the AI must return
   pure JSON.
4. **Open AI Handoff** — the full drawer (`<AIHandoffButton/>`).
5. **Validate** / **Apply to fields** — the existing JSON pipeline.

## Example template — Bestiary

```jsonc
{
  "type": "bestiary",
  "name": "e.g. Auger Wake",
  "aliases": [],
  "speciesType": "e.g. Spirit-beast",
  "category": "Beast | Spirit | Construct | Undead | Plant | Aberration",
  "summary": "",
  "description": "",
  "threatLevel": "mundane | minor | moderate | major | apex | mythic",
  "disposition": "docile | wary | hostile | ambush | territorial | intelligent",
  "challenge": "e.g. CR 8 / Apex pack",
  "fightOrFlight": "Stalks · ambushes · negotiates · flees",
  "habitat": "Salt flats, frostlight forest, brine caves.",
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
  "relatedQuests": [],
  "relatedEvents": [],
  "lore": [],
  "chapterAppearances": [],
  "sourceMentions": "",
  "references": [],
  "status": "active | important | needs-review | dormant | draft | hidden | archived | extinct",
  "doNotSuggest": false,
  "dormant": false
}
```

## Required callbacks

| Callback | Trigger |
|---|---|
| `onCopyEntityJsonTemplate` | "Copy blank template" |
| `onCopyEntityFillPrompt`   | "Copy AI fill prompt" |
| `onExportCurrentEntity`    | "Copy current entity JSON" |
| `onPasteCompletedEntityJson` | (the textarea itself) |
| `onValidateEntityJson`     | "Validate" |
| `onPreviewEntityJsonImport` | (Review tab) |
| `onApplyEntityJsonToEditor` | "Apply to fields" |
