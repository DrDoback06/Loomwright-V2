# Settings Control Centre — Hook-up

Files: `settings-rich.jsx`, `settings-rich.css`.

The existing `ControlCentreWorkspace` in `workspaces-system.jsx` keeps
its layout and section nav. Each section's body is now rendered by
`<RichSettingsSection sectionId={activeId} onRequest={onRequest}/>`
when available; the legacy inline content remains as a safety
fallback.

## Section list

| Group | id | Renderer |
|---|---|---|
| Project | `project` | `<SetProject/>` — name, series, book, genre, target format, word goal, status, default route, local-only badge |
| Project | `intel` | `<SetIntel/>` — links to Project Intelligence file, References, onboarding; AI Handoff buttons |
| Project | `brand` | `<SetBrand/>` — theme, accent color picker, density, manuscript font, UI font, reduce-motion |
| Author | `authors` | `<SetAuthors/>` — editable author profiles (name, initials, colour, role, style) |
| Author | `ai` | `<SetAIProviders/>` — BYOK manager (see below) |
| Author | `ai-routing` | `<SetAIRouting/>` — routing mode, max context size, optimisation toggles |
| Author | `privacy` | `<SetPrivacy/>` — local-only/byok, confirmations, clear cache |
| Editor | `editor` | `<SetEditor/>` — spellcheck/grammar/style/thesaurus/voice toggles, autosave, margins, attribution |
| Editor | `extraction` | `<SetExtraction/>` — aggressiveness, auto-add 95%+, per-type scan, threshold |
| Editor | `review` | `<SetReview/>` — default filter, display toggles, merge suggestions |
| Library | `references` | `<SetReferences/>` — link to Research Library, include-in-AI toggles, handoff buttons |
| Library | `import` | `<SetImport/>` — export/import project, entity library, settings profile |
| System | `shortcuts` | `<SetShortcuts/>` — keyboard map |
| System | `debug` | `<SetDebug/>` — debug toggles, reset/clear actions |

## BYOK / AI Providers

`<SetAIProviders/>` renders 6 curated providers visible by default:

| id | Provider | Where to get a key |
|---|---|---|
| `openai`     | OpenAI                       | https://platform.openai.com/api-keys |
| `anthropic`  | Anthropic / Claude           | https://console.anthropic.com/settings/keys |
| `gemini`     | Google Gemini                | https://aistudio.google.com/app/apikey |
| `openrouter` | OpenRouter                   | https://openrouter.ai/keys |
| `ollama`     | Local / Ollama / LM Studio   | https://ollama.com/download |
| `custom`     | Custom OpenAI-compatible     | bring your own base URL |

Each provider card collapses until enabled. When enabled:
- API key input (mono font, never echoed elsewhere)
- Base URL for custom/local
- Model preference (string, mono)
- "Use for" 7 toggles: writing / extraction / summarisation / research
  / voice / image / embeddings
- Test connection button
- "Where to get a key" link (opens new tab)
- Privacy note under each enabled card

**Add provider** drawer reveals 7 additional providers (Mistral,
Cohere, Together, Groq, Perplexity, ElevenLabs, Stability) on demand.

The shell never proxies an API key — copy is explicit on every card:
*"Loomwright is a shell. Every AI call uses your own API key from the
provider you pick. We never proxy your key."*

## Required callbacks

| Callback | Trigger |
|---|---|
| `onUpdateProjectSettings`     | every input in `<SetProject>` (event `lw:settings-update`) |
| `onUpdateThemeSettings`       | brand controls |
| `onUpdateEditorSettings`      | editor toggles |
| `onCreateAuthorProfile` / `onEditAuthorProfile` / `onDeleteAuthorProfile` | authors |
| `onAddAIProvider`             | "Add provider" button |
| `onUpdateAIProviderSettings`  | provider key/model/uses |
| `onTestAIProviderConnection`  | per-provider Test button |
| `onUpdateAIRoutingSettings`   | routing mode + slider + toggles |
| `onUpdatePrivacySettings`     | privacy toggles |
| `onUpdateExtractionSettings`  | extraction toggles + threshold |
| `onUpdateReviewQueueSettings` | review-queue toggles |
| `onOpenProjectIntelligenceFile` | Project Intelligence card buttons |
| `onOpenReferences`            | open Research Library |
| `onExportProjectData` / `onImportProjectData` | import/export |
| `onExportSettingsProfile` / `onImportSettingsProfile` | settings profile |
| `onOpenKeyboardShortcuts`     | (read-only display) |
| `onResetLayout` / `onClearLocalDemoData` | debug |
