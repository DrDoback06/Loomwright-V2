# Callback Audit

## Scope
Every `data-callback="onX"` attribute in the project is enumerated here
so the follow-up coding agent can wire each to backend behaviour.

## Conventions
- Names use camelCase `on<Verb><Noun>`.
- The string in `data-callback` matches the prop name passed to the
  component, where applicable.
- Buttons without explicit `onClick` rely on:
  - The component's prop (preferred), or
  - A global event (`lw:open-entity-editor`, `lw:open-panel`,
    `lw:drop-to-composition`).

## Top-level Editor & Overlay
- `onOpenEntityEditor({type, initial?, mode?, promoteFrom?})`
- `onSaveEntity(payload, {mode})` — mode in: `draft | active | compose`
- `onSaveEntityDraft`, `onSaveAndAddToComposition`
- `onOpenEntityCompositionOverlay`, `onCloseEntityCompositionOverlay`,
  `onMinimiseEntityCompositionOverlay`, `onPinEntityCompositionOverlay`
- `onDropEntityIntoComposition`, `onRemoveEntityFromComposition`,
  `onUpdateCompositionEntityRole`, `onUpdateCompositionInstructions`,
  `onSetCompositionMode`, `onSetCompositionPOV`,
  `onSetCompositionLength`, `onSetCompositionTone`,
  `onSetCompositionChapterTarget`,
  `onToggleCompositionContextOption`, `onGenerateCompositionDraft`,
  `onInsertCompositionDraft`, `onCreateChapterFromComposition`,
  `onCopyCompositionPrompt`, `onSaveCompositionPreset`,
  `onClearComposition`

## Cross-panel & Status
- `onSetEntityStatus(status)`, `onToggleEntityDormant`,
  `onWakeEntity`, `onArchiveEntity`,
  `onFlagEntityImportant`, `onFlagEntityNeedsReview`,
  `onToggleEntityDoNotSuggest`
- `onStartEntityDrag(payload)`, `onEndEntityDrag`
- `onDropEntityOnWriterRoom`, `onDropEntityOnCompositionOverlay`,
  `onDropEntityOnAtlas`, `onDropEntityOnTimeline`,
  `onDropEntityOnQuest`, `onDropEntityOnEvent`,
  `onDropEntityOnCast`, `onDropEntityOnItem`,
  `onDropEntityOnSkillTree`, `onDropEntityOnLocation`

## Per-Tab Create / Save
- Locations: `onCreateLocation`, `onSaveLocation`, `onSaveLocationDraft`,
  `onSaveAndPlaceLocationOnAtlas`
- Items: `onCreateItem`, `onSaveItem`, `onSaveItemDraft`,
  `onSaveAndAssignItem`
- Classes: `onCreateClass`, `onSaveClass`, `onSaveClassDraft`
- Races: `onCreateRace`, `onSaveRace`, `onSaveRaceDraft`
- Stats: `onCreateStat`, `onSaveStat`, `onSaveStatDraft`
- Quests: `onCreateQuest`, `onSaveQuest`, `onSaveQuestDraft`
- Events: `onCreateEvent`, `onSaveEvent`, `onSaveEventDraft`
- Skills: `onCreateSkill`, `onSaveSkill`
- (Abilities deprecation): `onOpenSkillTreesFromAbilities`,
  `onAcceptAbilityMigration`

## Per-Tab Edit / Manage
- Locations: `onEditLocation`, `onMergeLocation`, `onSetParentLocation`,
  `onCreateChildLocation`, `onLinkEntityToLocation`,
  `onSetLocationStatus`, `onToggleLocationDormant`,
  `onShowLocationOnAtlas`, `onDragLocationToAtlas`,
  `onOpenAtlasEditorFromLocation`, `onOpenLocationSourceMention`
- Items: `onEditItem`, `onAssignItemOwner`, `onChangeItemLocation`,
  `onEquipItem`, `onUnequipItem`, `onTransferItem`,
  `onDropItem`, `onLoseItem`, `onDestroyItem`, `onUpgradeItem`,
  `onMergeItem`, `onAddItemEffect`, `onAddItemModifier`,
  `onLinkItemToQuest`, `onLinkItemToEvent`, `onShowItemOnAtlas`,
  `onOpenItemTimeline`, `onSetItemStatus`, `onToggleItemDormant`
- Classes: `onEditClass`, `onDuplicateClass`,
  `onAssignClassToCharacter`, `onLinkClassSkill`,
  `onLinkClassSkillTree`, `onAddClassDefaultStat`,
  `onAddClassRestriction`, `onAddClassStartingEquipment`,
  `onOpenClassCharacter`, `onOpenClassSkillTree`,
  `onSetClassStatus`, `onToggleClassDormant`
- Races: `onEditRace`, `onAssignRaceToCharacter`,
  `onLinkRaceBestiary`, `onLinkRaceFaction`,
  `onAddRaceTrait`, `onAddRaceDefaultStat`, `onAddRaceSkill`,
  `onShowRaceOnAtlas`, `onSetRaceStatus`, `onToggleRaceDormant`
- Stats: `onEditStat`, `onAssignStat`, `onUpdateStatValue`,
  `onAddStatChange`, `onAddStatExtractionRule`,
  `onEditStatExtractionRule`, `onDisableStatExtractionRule`,
  `onDeleteStatExtractionRule`, `onTestStatPhrase`,
  `onPreviewStatQueueResult`, `onSetStatStatus`,
  `onToggleStatDormant`
- Quests: `onEditQuest`, `onAddQuestStep`, `onCompleteQuestStep`,
  `onFailQuestStep`, `onBranchQuest`,
  `onLinkQuestCharacter`, `onLinkQuestItem`,
  `onLinkQuestLocation`, `onLinkQuestFaction`,
  `onLinkQuestEvent`, `onShowQuestOnAtlas`,
  `onOpenQuestTimeline`, `onCreateEventFromQuestStep`,
  `onSetQuestStatus`, `onToggleQuestDormant`
- Events: `onEditEvent`, `onLinkEventCharacter`, `onLinkEventItem`,
  `onLinkEventLocation`, `onLinkEventFaction`,
  `onLinkEventQuest`, `onCreateEventConsequence`,
  `onCreateRelationshipChangeFromEvent`,
  `onCreateTimelineNodeFromEvent`,
  `onShowEventOnAtlas`, `onOpenEventTimeline`,
  `onSetEventStatus`, `onToggleEventDormant`

## Review Queue (per entity)
- `onAccept<Entity>QueueItem`, `onEdit<Entity>QueueItem`,
  `onMerge<Entity>QueueItem`, `onDeny<Entity>QueueItem`,
  `onOpenSource<Entity>Mention`, `onOpen<Entity>InTab`

## Composition Drag Per-Tab
- `onDropLocationIntoComposition`, `onDropItemIntoComposition`,
  `onDropClassIntoComposition`, `onDropRaceIntoComposition`,
  `onDropStatIntoComposition`, `onDropSkillIntoComposition`,
  `onDropQuestIntoComposition`, `onDropEventIntoComposition`,
  `onDropCastIntoComposition`, etc.

## Global System Events (CustomEvent on window)
- `lw:open-entity-editor` → `{detail: {type, initial?, mode?, promoteFrom?}}`
- `lw:open-panel` → `{detail: {kind}}`
- `lw:drop-to-composition` → `{detail: payload}`
- `lw:open-panel-workspace` → `{detail: {workspaceId, panelKind, sourcePanel}}`
- `lw:exit-panel-workspace`
- `lw:reference-add` → `{detail: {actionId, sourcePanel}}`
- `lw:settings-add` → `{detail: {actionId}}`
- `lw:settings-update` → `{detail: {section, key, value}}`
- `lw:settings-section` → `{detail: {actionId}}`

### Speed Reader events
- `lw:speed-reader-add` → `{detail: {sourcePanel}}`
- `lw:speed-reader-bookmark` → bookmark object
- `lw:speed-reader-send-sentence` → `{kind, body, sentence, sourceId, idx, ts}`
- `lw:speed-reader-save-session`, `lw:speed-reader-export-session`

### AI Handoff Pack events
- `lw:ai-handoff-copy-json` → `{pack}`
- `lw:ai-handoff-copy-prompt` → `{pack, prompt}`
- `lw:ai-handoff-download` → `{pack}`
- `lw:ai-handoff-save` → `{pack}`
- `lw:ai-handoff-import` → `{mode, raw, result, surface}`
- `lw:ai-handoff-create-review-items` → same payload, when mode=review
- `lw:ai-handoff-update-entities` → same payload, when mode=updateEntities
- `lw:ai-handoff-save-reference` → same payload, when mode=saveReference

These bypass prop-drilling; any sub-component can fire them.

---

## Pass 3 — Settings / Speed Reader / AI Handoff / JSON

### Speed Reader (`speed-reader.jsx`)
- `onSpeedReaderSelectDocument`
- `onSpeedReaderAddSource`
- `onSpeedReaderPasteText`
- `onSpeedReaderPlay` / `onSpeedReaderPause` / `onSpeedReaderRestart`
- `onSpeedReaderPreviousWord` / `onSpeedReaderNextWord`
- `onSpeedReaderPreviousSentence` / `onSpeedReaderNextSentence`
- `onSpeedReaderChangeWpm` / `onSpeedReaderChangeFontSize`
- `onSpeedReaderTogglePunctuationPause` / `onSpeedReaderToggleSentencePause`
- `onSpeedReaderBookmark`
- `onSpeedReaderNoteDifficulty`
- `onSpeedReaderSendSentenceToWriterRoom`
- `onSpeedReaderCopyExcerpt`
- `onSpeedReaderOpenSourceChapter`
- `onSpeedReaderSaveSession` / `onSpeedReaderExportSession`
- `onOpenSpeedReaderWorkspace` / `onExitSpeedReaderWorkspace`

### AI Handoff (`ai-handoff.jsx`)
- `onOpenAIHandoffPack`
- `onCopyHandoffJson` / `onCopyHandoffPrompt`
- `onDownloadHandoffJson` / `onSaveHandoffPack`
- `onImportAIResult`
- `onParseAIResultJson` (internal)
- `onCreateReviewItemsFromAIResult`
- `onUpdateEntitiesFromAIResult`
- `onSaveAIResultAsReference`

### Entity Editor — JSON tab
- `onCopyEntityJsonTemplate`
- `onCopyEntityFillPrompt`
- `onExportCurrentEntity`
- `onValidateEntityJson`
- `onApplyEntityJsonToEditor`

### Settings Control Centre (`settings-rich.jsx`)
- `onUpdateProjectSettings`, `onUpdateThemeSettings`, `onUpdateEditorSettings`
- `onCreateAuthorProfile`, `onEditAuthorProfile`, `onDeleteAuthorProfile`
- `onAddAIProvider`, `onTestAIProviderConnection`
- `onUpdateAIProviderSettings`, `onUpdateAIRoutingSettings`
- `onUpdatePrivacySettings`, `onClearCachedContext`, `onExportPrivacyProfile`
- `onUpdateExtractionSettings`, `onUpdateReviewQueueSettings`
- `onOpenProjectIntelligenceFile`, `onOpenReferences`, `onOpenOnboardingAnswers`
- `onCopyProjectContextPack`, `onCopyStyleProfilePack`, `onCopyCanonRulesPack`, `onCopyCharacterBiblePack`
- `onBuildReferenceContextPack`, `onExportStyleInfluencePack`, `onExportCanonSourcePack`, `onImportExternalResearchNotes`
- `onExportProjectData`, `onImportProjectData`
- `onExportEntityLibrary`, `onImportEntityLibrary`
- `onExportAIHandoffPack`, `onExportSettingsProfile`, `onImportSettingsProfile`
- `onBackupNow`
- `onResetLayout`, `onClearLocalDemoData`, `onShowLastAIHandoff`
