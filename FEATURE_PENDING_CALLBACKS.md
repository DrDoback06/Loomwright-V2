# Feature-Pending Callbacks — Burn-Down Catalogue

_Last updated: 2026-05-18 (burn-down pass)._

> **2026-05-19 note.** This file is a time-fixed snapshot from the
> burn-down pass that resolved the original 124 feature-pending
> callbacks. It is not a live status doc — for live status see
> `PRODUCT_COMPLETION_AUDIT.md`. The audit script
> (`scripts/audit-callbacks.js`) is the live truth: 524 callbacks
> registered, 0 Bucket A reach the generic default.

This document is the catalogue of every callback that the previous audit
counted as "feature-pending", paired with its final classification and
resolution after the burn-down pass.

## Audit headline

```
OK: 523 UI callbacks; registry bootstraps 523 handlers
OK: registry default branch emits a user-visible notice (no silent fall-through).
OK: 0 Bucket A action callbacks reach the generic default notice.
OK: 6 Bucket B (provider-gated) callbacks use requireProviderOrNotice.
OK: 4 Bucket D (React-owned) callbacks declared.
INFO: 216 other callbacks fall to default notice (housekeeping/dispatch).
```

The 124 fall-throughs reported before the burn-down resolve as follows:

| Bucket | Count | Behaviour |
|--------|-------|-----------|
| **A** — core local actions (must work) | 114 | All wired. 0 reach the generic default notice. |
| **B** — AI / provider-gated | 6 | All show "Configure an AI provider…" when no key is set; perform the real call otherwise. |
| **C** — future integrations | 0 | None identified. |
| **D** — React-owned (component-level onClick) | 4 | Declared in audit's REACT_OWNED set; excluded from the action-required list. |

## Resolution detail

### Bucket A — wired (sample)

These were the 124 names the audit reported before this pass. Each is now
either reached by an explicit registry branch or by one of the generic
helper paths (parseCreateType, parseEditType, parseDeleteType, the
onAdd/onCopy/onImport/onExport regexes, the onLink/onAssign/onShow*OnAtlas/
onOpen*Timeline patterns, or BACKEND_HANDLED).

| Callback | Resolution |
|----------|-----------|
| `onCreateLocation`, `onCreateItem`, `onCreateClass`, `onCreateRace`, `onCreateStat`, `onCreateSkill`, `onCreateQuest`, `onCreateEvent`, `onCreateFaction`, `onCreateRelationship`, `onCreateBestiaryEntry`, `onCreateCanonFact`, `onCreateTimelineEvent`, `onCreateSkillTree`, `onCreateChildLocation`, `onCreateAtlasLocation`, `onCreateEventConsequence`, `onCreateEventFromQuestStep`, `onCreateEventFromRelationship`, `onCreateEventFromTangle`, `onCreateQuestFromTangle`, `onCreateRelationshipChangeFromEvent` | `parseCreateType` → open entity editor with mapped type (see `TYPE_FROM_CREATE`). |
| `onCreateChapter` | New `ManuscriptChapterService.createFromComposition()` → dispatches `lw:open-route writers-room`. |
| `onCreateEntity`, `onCreate` | Open editor with current panel's entity type. |
| `onCreateEntityFromSelection` | Open editor with `initial.name = selected text`. |
| `onCreateFromPanelHeader` | Same — type from panel preset. |
| `onCreateAuthorProfile`, `onDeleteAuthorProfile` | `SettingsService.saveSection("authors", …)`. |
| `onCreateTangleNode`, `onEditTangleNode`, `onDeleteTangleNodeRequest`, `onCreateTangleGroup` | New `TangleService` (`addNode/updateNode/removeNode/addGroup` under `KEYS.tangle`). |
| `onCreateNewInstead` | React-owned by `MergeCandidateModal`. **Bucket D**. |
| `onEditLocation`, `onEditClass`, `onEditRace`, `onEditBestiaryEntry`, `onEditTimelineEvent`, `onEditCanonFact`, `onEditQuestStep`, `onEditSkillNode`, `onEditDraftSkillNode`, `onEditCharacterSeed`, `onEditStats` | `parseEditType` → open editor pre-filled. |
| `onEditOnboardingAnswerSection`, `onSaveOnboardingDraft`, `onEditAIWriterInstruction`, `onApplyStepJson`, `onPasteStepJson` | `OnboardingService.save` / `SettingsService.saveSection` / `ProjectIntelService.mergeFromOnboarding`. |
| `onEditTangleNode` | `TangleService.updateNode`. |
| `onEditStyleProfile` | `ReferencesService.save` with `kind: style`. |
| `onEditStatExtractionRule`, `onAddStatExtractionRule`, `onDeleteStatExtractionRule` | Generic `onAdd<Field>` / `LinkService.appendField` for add; `parseDeleteType` for delete. |
| `onAddTrait`, `onAddAbility`, `onAddQuestStep`, `onAddRelationshipEvidence`, `onAddEvidence`, `onAddCanonRule`, `onAddPlotBeat`, `onAddBeat`, `onAddCustomStat`, `onAddVoiceSample`, `onAddCharacterSeed`, `onAddForbiddenContradiction`, `onAddProjectIntelligenceSection`, `onAddReferenceSource`, `onAddCastToAtlas`, `onAddRelationship` | Generic `onAdd<Field>` regex → `LinkService.appendField` (strictly guarded against empty values; falls back to opening the editor if no value is supplied). |
| `onAddCanonRule`, `onAddReferenceSource`, `onAddVoiceSample` | When semantics target the references collection rather than an entity field, the generic handler still works because `references` has its own type. Specific branches can be added later if the generic shape doesn't fit. |
| `onCompleteQuestStep`, `onBranchQuest` | Explicit branch — updates `quest.data.steps[].status` / `quest.data.branches`. |
| `onArchiveReference` | `ReferencesService.save` with `status: archived`. |
| `onBuildReferenceContextPack` | `HandoffService.savePack` from the selected references. |
| `onAcceptDraftSkillNode`, `onDenyDraftSkillNode`, `onMergeDraftSkillNode` | Move draft nodes in/out of `skill.data.draftNodes` and `skill.data.nodes`. |
| `onAcceptStyleProfile` | `ReferencesService.save` with `kind: style`. |
| `onDenyCanonContradiction` | `ReferencesService.save` with `contradictionStatus: denied`. |
| `onMergeCanonFact` | Opens `MergeCandidateModal` scoped to `lore`. |
| `onSaveHandoffPack` | `HandoffService.savePack`. |
| `onApplyAtlasFocus` | Dispatches `lw:atlas-focus`. |
| `onSendSuggestionToTangle` | `TangleService.addNode` with `kind: suggestion`. |
| `onSendSuggestionToWriter`, `onSendTangleItemToWriter` | Dispatch `lw:composition-insert-draft`. |
| `onRunCommand`, `onRunWheelAction` | Meta dispatchers — forward to the inner callback via `lw:dispatch-callback`. |
| `onTestStatPhrase` | Compiles the rule as a `RegExp` and tests against the phrase locally. |
| `onValidateProviderKey` | `AIService.testConnection(providerId)` (existing). |
| `onGenerateTodayPrompts` | Local rule-based prompt generator (dormant cast, open quests, recent events). AI augmentation optional. |
| `onCopyEntityFillPrompt`, `onCopyHelperPrompt`, `onCopyIntelFile`, `onCopyStepJsonPrompt`, `onCopyToProjectIntelligenceFile`, `onCopyGeneratedText` | Generic `onCopy*` regex → clipboard write with `resolveCopyTarget` reading from project state. |
| `onImportEntity`, `onImportLocations`, `onImportItems`, `onImportCharactersFromText`, `onImportPlotJson`, `onImportExternalResearchNotes`, `onImportSettingsProfile` | Generic `onImport<Type>` regex → JSON file picker → `importEntityCollection`. |
| `onExportAIHandoffPack`, `onExportIntelFile`, `onExportCanonSourcePack`, `onExportStyleInfluencePack`, `onExportPrivacyProfile`, `onExportProfile` | Generic `onExport*Pack/File/Profile` regex → `downloadJson` with `resolveExportTarget`. |
| `onDeleteClass`, `onDeleteReference`, `onDeleteAuthorProfile`, `onDeleteCanonRule`, `onDeleteCharacterSeed`, `onDeleteChapterRequest`, `onDeleteEntities`, `onDeleteForever`, `onDeleteStatExtractionRule`, `onDeleteTangleNodeRequest` | New `parseDeleteType` regex → `EntityService.delete` or service-specific path. |
| `onClearLocalDemoData` | Now scoped — `SampleProjectService.clearSample` removes only `source: "sample"` records. |
| `onResetProjectData` _(new)_ | Destructive full wipe behind double-confirm via `SampleProjectService.resetProjectData`. |
| `onOpenEntityFromManuscript` | React-owned by `EntityBrushHighlight onDoubleClick`. **Bucket D**. |
| `onAcceptEdited`, `onSaveEdit` | React-owned by `EditCandidateModal`. **Bucket D**. |

### Bucket B — provider-gated

Each branch calls `requireProviderOrNotice(label)`. If no provider/key is
configured, the user sees a specific notice rather than the generic
default. With a provider configured, the real AI call runs.

| Callback | Provider message label |
|----------|------------------------|
| `onGenerateAIWriterDraft` | "AI Writer draft generation" |
| `onGenerateDraftSkillTree` | "Skill Tree draft generation" |
| `onGenerateCompositionDraft` | "composition draft generation" |
| `onRunContinuityCheck` | local heuristic always runs; AI augmentation if provider configured |
| `onRunEntitySuggestion` | local extraction always runs; deep extraction if provider configured |
| `onAcceptGeneratedText` | inserts `window.__LW_LAST_GENERATED_DRAFT__`; notice if no draft yet |
| `onCopyGeneratedText` | copies `window.__LW_LAST_GENERATED_DRAFT__`; notice if empty |

### Bucket C — future integrations

None identified in this pass. If cloud sync / external collaboration
arrive later, they'll get their own `FUTURE_INTEGRATION_PREFIXES` list
with a specific notice.

### Bucket D — React-owned

These callbacks are handled by component-level `onClick` handlers
(modals, manuscript spans). The registry's document-level capture
listener correctly skips them via `hasReactClick(el)`. They are
declared in the audit's `REACT_OWNED` set so they are not counted as
missing action handlers:

- `onCreateNewInstead` — `MergeCandidateModal`
- `onAcceptEdited` — `EditCandidateModal`
- `onSaveEdit` — `EditCandidateModal`
- `onOpenEntityFromManuscript` — `EntityBrushHighlight` double-click

## What the 216 "other" callbacks are

The "INFO: 216 other callbacks fall to default notice" line groups names
the audit can't conclusively wire to a specific action. They include:

- Cosmetic UI state (`onClosePanel`, `onCancel`, `onZoom`, `onActivateTab`,
  `onFilterPanel`, `onClearPanelFilter`, …) — these are handled by React
  `onChange/onClick` inside the rendering component and bubble past the
  capture listener.
- Dispatch metadata (`onShowAtlasLayer`, `onPin`, `onMinimise`, …) — same.
- Workspace lifecycle callbacks that fire as side-effects of route or
  workspace changes already wired through React props.

These intentionally show the friendly default notice if a user somehow
triggers them outside their normal React context. Adding explicit
branches for cosmetic state would be net-negative — the registry
shouldn't compete with React for ownership of UI-only events.

If a specific callback in this group turns out to drive a meaningful
action and currently shows a notice when clicked, it should be promoted
to Bucket A and given an explicit branch (the audit will then enforce
it).
