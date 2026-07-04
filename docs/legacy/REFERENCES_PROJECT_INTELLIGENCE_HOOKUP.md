# References / Project Intelligence / Onboarding — Hook-up

The three things share one purpose: tell the AI (or external AI) what
this project is about. They were already separate; this pass connects
them without duplicating.

## Surfaces

| Surface | Role | File |
|---|---|---|
| **References / Research Library** | Stores raw source material — uploads, URLs, style samples, canon sources, research notes, onboarding answers, AI instruction docs. | `lore-references.jsx`, `workspaces-system.jsx :: ResearchLibraryWorkspace` |
| **Project Intelligence** | The curated brief shown to AI: voice, taboos, hard canon, current arc. Distilled from references. | `onboarding-intel.jsx`, `onboarding-intel.css`, Settings → `intel` section |
| **Onboarding** | Interview flow that *populates* Project Intelligence. Answers persist as references with `kind: "onboarding answer"`. | `onboarding.jsx`, `onboarding-data.jsx`, `onboarding-steps.jsx`, `onboarding-parts.jsx` |

## Cross-links

Settings is the hub:

```
Settings → Project Intelligence  → Open Project Intelligence File
                                 → Open References / Research Library
                                 → Open onboarding answers
                                 → AI Handoff (Project Intelligence)

Settings → References / Research → Open Research Library
                                 → AI Handoff (build reference pack, import notes)
```

References workspace has an "AI Handoff" button in `extraActions` so
the user can hand off the whole research library to an external AI
and import back improved notes.

## Storage model (recommended for backend)

```
project/
  intelligence.json          ← Project Intelligence file (structured)
  references/
    upload-<id>.{txt,md,...}
    url-<id>.json            ← { url, fetchedAt, title, excerpt }
    style-<id>.txt
    canon-<id>.md
    research-<id>.md
    onboarding-<id>.json     ← { question, answer, ts }
    ai-instruction-<id>.md
  references.index.json      ← [{ id, kind, title, includedInAI }]
```

`intelligence.json` schema:

```jsonc
{
  "voice":      "terse / cold / restrained",
  "taboos":     ["…","…"],
  "currentArc": "…",
  "canonRules": [{ "id","statement","band","scope" }],
  "style":      { "sentences": "short", "vocabulary": "earthy", "rhythm": "iambic" },
  "characterBible": "compressed dossiers",
  "extractionRules": { /* user prefs from Settings */ },
  "aiInstructions": "…"
}
```

## Required callbacks

| Callback | Trigger |
|---|---|
| `onOpenProjectIntelligenceFile`  | Settings → Intel + References workspace |
| `onOpenReferences`               | every link to Research Library |
| `onOpenOnboardingAnswers`        | Settings → Intel |
| `onBuildReferenceContextPack`    | References Settings |
| `onExportStyleInfluencePack`     | References Settings |
| `onExportCanonSourcePack`        | References Settings |
| `onImportExternalResearchNotes`  | References Settings + Handoff |
| `onCopyProjectContextPack`       | Settings → Intel |
| `onCopyStyleProfilePack`         | Settings → Intel |
| `onCopyCanonRulesPack`           | Settings → Intel |
| `onCopyCharacterBiblePack`       | Settings → Intel |
| `onImportImprovedProjectIntelligence` | Settings → Intel (via AI Handoff drawer) |
| `onValidateProjectIntelligenceJson` | AI Handoff drawer (Import tab) |
| `onAttachImportToProjectIntelligence` | References Settings |

## Acceptance

- Settings → Project Intelligence shows links to Project Intelligence
  file, References, onboarding answers, plus 4 "Copy …" buttons.
- References workspace topbar shows "AI Handoff" + "Import JSON".
- Lore panel still flags facts with the "In Project Intelligence"
  badge (existing behaviour preserved).
