# AI Handoff Pack — Hook-up

Files: `ai-handoff.jsx`, `ai-handoff.css`.

Purpose: let users use external AI cheaply by exporting structured
context, working with another AI tool, then pasting results back in.

## Surfaces

### Primary — Writer's Room Composition Overlay
Footer button "AI Handoff" sits between "Generate draft" and "Insert
as draft". Context auto-built from:
- dropped entities + their composition roles
- overlay instructions
- POV / tone / length / mode → output type
- project info (title/genre via `window.LW_BRAND`)

### Secondary

- **Entity Editor → JSON tab**: "Open AI Handoff" + Copy blank
  template / Copy current entity / Copy AI fill prompt.
- **References / Research Library workspace**: AI Handoff in topbar
  `extraActions`, context = references list, output = outline.
- **Settings → Project Intelligence**: full project bible handoff.

## Drawer API

```jsx
<AIHandoffDrawer
  open
  onClose
  surface="composition" | "entity-editor" | "references" | "project-intelligence"
  context={{
    selectedEntities, entityRoles, instructions,
    outputType, targetChapterId, pov, tone, length,
    projectContext,        // optional bag of project-level data
  }}
  onApplyResult={({ mode, result, raw, surface }) => /* ... */}
/>
```

The drawer is positioned at `z-index: calc(--z-entity-editor + 2)` so
it always paints above the editor and the workspace.

## Export → Import flow

1. User picks output type (paragraph / scene / chapter / rewrite /
   outline / bullets / continuity / entity).
2. Picks detail level: minimal / balanced / full / custom. Detail
   level seeds the context-options checkboxes.
3. Ticks/unticks ~17 context options grouped under: Entities, World,
   Project, Manuscript, Filters.
4. Copies JSON, or Copy prompt+JSON, or Downloads the JSON file.
5. External AI returns prose or JSON.
6. User pastes into Import tab. The drawer auto-detects:
   - **JSON** (top-level object or fenced ```json``` block)
   - **prose** (anything else)
7. Picks an apply mode and clicks Apply. CustomEvents fire on
   `window` so the app can route the import:
   - `lw:ai-handoff-import` — generic
   - `lw:ai-handoff-create-review-items` — review mode
   - `lw:ai-handoff-update-entities` — updateEntities mode
   - `lw:ai-handoff-save-reference` — saveReference mode

## Pack shape

`buildAIHandoffPack(opts)` returns:

```jsonc
{
  "id": "ahp-…",
  "schema": "loomwright/ai-handoff/v1",
  "purpose": "scene",
  "outputType": "scene",
  "detailLevel": "balanced",
  "surface": "composition",
  "targetChapterId": "ch7",
  "pov": "…", "tone": "…", "length": "…",
  "instructions": "…",
  "selectedEntities": [{ "id","type","name","role","summary","dossier" }],
  "contextOptions": { /* per-key booleans */ },
  "projectContext": {
    "title","genre",
    "styleProfile","canonRules","relationships","locations","quests",
    "events","timeline","references","currentChapter",
    "previousChapterSummary","sourceMentions","projectIntelligence",
    "avoidContradictions","reviewWarnings"
  },
  "constraints": { "excludeDormant": true },
  "expectedReturnShape": {
    "resultType","prose","entityUpdates","questUpdates","eventUpdates",
    "continuityNotes","suggestedReviewItems"
  },
  "ts": 1700000000000
}
```

`buildAIHandoffPrompt(pack)` flattens the pack into a copy-pasteable
text prompt that ends with the JSON in a fenced block.

## Required callbacks

| Callback | Trigger |
|---|---|
| `onOpenAIHandoffPack` | "AI Handoff" button click |
| `onBuildAIHandoffPack` | (internal — useMemo) |
| `onToggleHandoffContextOption` | context-option checkbox |
| `onSetHandoffDetailLevel` | detail-level pill |
| `onCopyHandoffJson` | Copy JSON button + `lw:ai-handoff-copy-json` |
| `onCopyHandoffPrompt` | Copy prompt+JSON + `lw:ai-handoff-copy-prompt` |
| `onDownloadHandoffJson` | Download + `lw:ai-handoff-download` |
| `onSaveHandoffPack` | Save pack + `lw:ai-handoff-save` |
| `onImportAIResult` | Apply (Import tab) + `lw:ai-handoff-import` |
| `onParseAIResultJson` | (internal — useEffect on textarea change) |
| `onInsertAIResultDraft` | mode = draft / below / newChapter |
| `onCreateReviewItemsFromAIResult` | mode = review |
| `onUpdateEntitiesFromAIResult` | mode = updateEntities |
| `onSaveAIResultAsReference` | mode = saveReference |

## Token-saving copy in the UI

- "Detail level — token budget" pills with descriptions.
- A privacy note: "External AI receives whatever you copy. Manuscript
  text is only included if you tick 'Current chapter excerpt'."
- An import note: "Imported results land in the review queue (or as
  drafts) before they change your project. You can revert."
