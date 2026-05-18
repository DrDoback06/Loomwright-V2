// =====================================================================
// callback-registry.jsx — Central handler for every data-callback contract.
// Loaded after backend-services.jsx and callback-names-data.jsx.
// =====================================================================

(function () {
  const B = () => window.LoomwrightBackend;
  const notify = (message) => {
    try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_) {}
    console.info("[Loomwright]", message);
  };

  const TYPE_FROM_CREATE = {
    Location: "locations", Item: "items", Class: "classes", Race: "races",
    Stat: "stats", Skill: "skills", Quest: "quests", Event: "events",
    Creature: "bestiary", Faction: "factions", Reference: "references",
    Cast: "cast", Character: "cast", Entity: "locations",
  };

  function hasReactClick(el) {
    if (!el) return false;
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"));
    if (!key) return false;
    const props = el[key];
    return !!(props?.onClick || props?.memoizedProps?.onClick);
  }

  function resolveCtx(el, detail) {
    const scope = el?.closest?.("[data-entity-id],[data-panel-kind],[data-ui]") || el;
    const last = window.__LW_LAST_SELECTION__ || {};
    const entityId = el?.getAttribute("data-entity-id")
      || scope?.getAttribute("data-entity-id")
      || detail?.entityId
      || detail?.id
      || last.entityId;
    const entityType = el?.getAttribute("data-entity-type")
      || el?.getAttribute("data-entity")
      || scope?.getAttribute("data-entity-type")
      || detail?.entityType
      || detail?.type
      || last.entityType;
    const panelKind = el?.closest?.("[data-panel-kind]")?.getAttribute("data-panel-kind")
      || detail?.panelKind;
    const ctx = {
      target: el,
      detail: detail || {},
      entityId,
      entityType: entityType ? B()?.EntityService?.normaliseType(entityType) : null,
      panelKind,
    };
    Object.defineProperty(ctx, "entity", {
      get() {
        if (!ctx.entityId) return null;
        return B()?.EntityService?.getSync(ctx.entityId, ctx.entityType);
      },
    });
    return ctx;
  }

  function openEditor(type, initial, mode) {
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: B().EntityService.normaliseType(type), initial, mode },
    }));
  }

  function openPanel(kind) {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind } }));
  }

  function openWorkspace(workspaceId, panelKind, extra = {}) {
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
      detail: { workspaceId, panelKind, ...extra },
    }));
  }

  function focusEntity(panelKind, entityId, label) {
    window.dispatchEvent(new CustomEvent("lw:focus-entity", {
      detail: { panelKind, entityId, label },
    }));
  }

  async function acceptQueueItem(ctx, item) {
    const id = item?.id || ctx.detail?.id;
    const queue = B().ReviewService.listSync();
    const row = queue.find((q) => q.id === id) || item;
    if (!row) return;
    if (row.payload && row.entityId) {
      await B().EntityService.update(row.entityType, row.entityId, row.payload);
    } else if (row.payload?.name) {
      await B().EntityService.save(row.entityType || "references", row.payload, { status: "active" });
    }
    await B().ReviewService.resolve(id, "done");
    notify("Accepted suggestion.");
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
  }

  async function denyQueueItem(ctx, item) {
    const id = item?.id || ctx.detail?.id;
    if (id) await B().ReviewService.resolve(id, "denied");
    notify("Suggestion denied.");
  }

  function parseCreateType(name) {
    const m = name.match(/^onCreate([A-Za-z]+)$/);
    if (!m) return null;
    return TYPE_FROM_CREATE[m[1]] || B().EntityService.normaliseType(m[1].toLowerCase());
  }

  function parseEditType(name) {
    const m = name.match(/^onEdit([A-Za-z]+)$/);
    if (!m) return null;
    return TYPE_FROM_CREATE[m[1]] || B().EntityService.normaliseType(m[1].toLowerCase());
  }

  const BACKEND_HANDLED = new Set([
    "onExportProjectData", "onImportProjectData", "onExportEntityLibrary",
    "onImportEntityLibrary", "onExportSettingsProfile", "onClearLocalDemoData",
    "onBackupNow", "onTestAIProviderConnection", "onLoadSampleProject",
    "onSave", "onSaveAndExtract", "onSaveAndDeepExtract",
    "onCopyProjectContextPack", "onCopyStyleProfilePack", "onCopyCanonRulesPack",
    "onCopyCharacterBiblePack",
  ]);

  async function dispatchCallback(name, ctx) {
    const {
      EntityService, ReviewService, LinkService, ReferencesService,
      OnboardingService, ProjectIntelService, HandoffService, AIService,
      ExtractionService, ManuscriptChapterService, TrashService, CompositionService,
      SampleProjectService, exportProject, importProject,
    } = B();

    if (BACKEND_HANDLED.has(name)) return;

    const entity = ctx.entity;
    const type = ctx.entityType;
    const id = ctx.entityId;

    // —— Panels & navigation ——
    if (name === "onOpenPanel" || name === "onTogglePanel") {
      openPanel(ctx.detail?.kind || ctx.panelKind);
      return;
    }
    if (name === "onOpenSettingsControlCentre" || name === "onOpenSettings") {
      openWorkspace("control-centre", "settings");
      return;
    }
    if (name === "onOpenReferencesLibrary" || name === "onOpenReferences") {
      openPanel("references");
      openWorkspace("research-library", "references");
      return;
    }
    if (name === "onOpenOnboardingAnswers") {
      window.dispatchEvent(new CustomEvent("lw:open-onboarding-answers", { detail: ctx.detail }));
      openWorkspace("research-library", "references", { mode: "onboarding" });
      return;
    }
    if (name === "onReopenOnboardingWizard") {
      window.dispatchEvent(new CustomEvent("lw:open-onboarding-wizard", { detail: ctx.detail }));
      notify("Onboarding wizard is not available in this build yet.");
      return;
    }
    if (name === "onOpenProjectIntelligenceFile" || name === "onOpenProjectIntelligence") {
      openWorkspace("control-centre", "settings");
      window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "intel" } }));
      return;
    }
    if (name === "onOpenReviewQueue" || name === "onOpenEntityReviewQueue") {
      openPanel("review");
      return;
    }
    if (name === "onOpenEntityEditor") {
      openEditor(ctx.detail?.type || type, ctx.detail?.initial || entity, ctx.detail?.mode);
      return;
    }
    if (name === "onCloseEntityEditor" || name === "onCancelEntityEdit") {
      window.dispatchEvent(new CustomEvent("lw:close-entity-editor"));
      return;
    }
    if (name === "onOpenEntityCompositionOverlay") {
      window.dispatchEvent(new CustomEvent("lw:open-composition-overlay"));
      return;
    }
    if (name === "onCloseEntityCompositionOverlay") {
      window.dispatchEvent(new CustomEvent("lw:close-composition-overlay"));
      return;
    }
    if (name === "onOpenPanelWorkspace" || name === "onOpenWorkspace") {
      openWorkspace(ctx.detail?.workspaceId, ctx.detail?.panelKind || ctx.panelKind, ctx.detail);
      return;
    }
    if (name === "onExitPanelWorkspace" || name === "onExitSpeedReaderWorkspace") {
      window.dispatchEvent(new CustomEvent("lw:exit-panel-workspace"));
      return;
    }
    if (name === "onOpenSpeedReaderWorkspace") {
      openWorkspace("speed-reader", "speedReader");
      return;
    }
    if (name === "onOpenAIHandoffPack") {
      window.dispatchEvent(new CustomEvent("lw:open-ai-handoff"));
      return;
    }

    // —— Entity save (editor host may also handle) ——
    if (name === "onSaveEntity" || name === "onSaveEntityActive") {
      const fields = ctx.detail?.fields || ctx.detail || entity;
      await EntityService.save(type || fields.type, fields, { status: "active" });
      notify("Entity saved.");
      return;
    }
    if (name === "onSaveEntityDraft") {
      const fields = ctx.detail?.fields || ctx.detail || entity;
      await EntityService.save(type || fields.type, fields, { status: "draft" });
      notify("Draft saved.");
      return;
    }
    if (name === "onSaveAndAddToComposition" || name === "onSaveEntityAndAddToComposition") {
      const fields = ctx.detail?.fields || ctx.detail || entity;
      const saved = await EntityService.save(type || fields.type, fields, { status: "active" });
      window.dispatchEvent(new CustomEvent("lw:drop-to-composition", {
        detail: { id: saved.id, entityType: saved.type, name: saved.name, summary: saved.summary },
      }));
      return;
    }

    // —— Create / Edit by type ——
    const createType = parseCreateType(name);
    if (createType) {
      openEditor(createType, null, "quick");
      return;
    }
    const editType = parseEditType(name);
    if (editType || name === "onEditEntity") {
      openEditor(editType || type, entity || { id }, "full");
      return;
    }

    // —— Review queue ——
    if (/^onAccept\w*QueueItem$/.test(name)) {
      await acceptQueueItem(ctx, ctx.detail);
      return;
    }
    if (/^onDeny\w*QueueItem$/.test(name)) {
      await denyQueueItem(ctx, ctx.detail);
      return;
    }
    if (/^onEdit\w*QueueItem$/.test(name)) {
      const row = ctx.detail;
      openEditor(row?.entityType || type, row?.payload || row, "full");
      return;
    }
    if (/^onMerge\w*QueueItem$/.test(name)) {
      notify("Merge from queue: select target in panel.");
      return;
    }
    if (/^onOpenSource\w*Mention$/.test(name) || name === "onOpenSourceMention") {
      window.dispatchEvent(new CustomEvent("lw:open-source-mention", { detail: ctx.detail }));
      return;
    }

    // —— Status / flags ——
    if (name === "onSetEntityStatus" || /^onSet\w+Status$/.test(name)) {
      const status = ctx.detail?.status || ctx.target?.getAttribute("data-status") || "active";
      if (id && type) await LinkService.setStatus(id, type, status);
      return;
    }
    if (name === "onToggleEntityDormant" || /^onToggle\w+Dormant$/.test(name)) {
      if (id && type) await LinkService.toggleFlag(id, type, "dormant");
      return;
    }
    if (name === "onArchiveEntity" || name === "onWakeEntity") {
      if (id && type) await LinkService.setStatus(id, type, name === "onWakeEntity" ? "active" : "archived");
      return;
    }
    if (name === "onFlagEntityImportant") await LinkService.toggleFlag(id, type, "important");
    if (name === "onFlagEntityNeedsReview") await LinkService.toggleFlag(id, type, "needs-review");
    if (name === "onToggleEntityDoNotSuggest") await LinkService.toggleFlag(id, type, "do-not-suggest");

    // —— Items / equipment ——
    if (name === "onEquipItem") { await LinkService.equipItem(id, ctx.detail?.ownerId); return; }
    if (name === "onUnequipItem") { await LinkService.unequipItem(id); return; }
    if (name === "onAssignItemOwner" || name === "onAssignOwner") {
      await LinkService.assignOwner(id, ctx.detail?.ownerId);
      return;
    }
    if (name === "onDestroyItem" || name === "onDeleteEntityRequest") {
      if (id && type) await EntityService.delete(type, id);
      notify("Moved to trash.");
      return;
    }
    if (name === "onMergeItem" || name === "onMergeEntity" || name === "onMergeLocation") {
      notify("Merge: choose target entity in the merge dialog.");
      return;
    }

    // —— Locations ——
    if (name === "onSetParentLocation") {
      await LinkService.setParentLocation(id, ctx.detail?.parentId);
      return;
    }
    if (name === "onShowLocationOnAtlas" || name === "onDragLocationToAtlas" || name === "onShowItemOnAtlas" || /^onShow\w+OnAtlas$/.test(name)) {
      openPanel("atlas");
      if (id) focusEntity("atlas", id, entity?.name);
      return;
    }
    if (name === "onOpenAtlasEditorFromLocation") {
      openPanel("atlas");
      window.dispatchEvent(new CustomEvent("lw:atlas-edit", { detail: { entityId: id } }));
      return;
    }

    // —— Timeline ——
    if (/^onOpen\w*Timeline$/.test(name) || name === "onOpenQuestTimeline" || name === "onOpenEventTimeline") {
      openPanel("timeline");
      if (id) focusEntity("timeline", id, entity?.name);
      return;
    }

    // —— References ——
    if (name === "onUploadReference" || name === "onPasteReference" || name === "onAddReferenceUrl") {
      window.dispatchEvent(new CustomEvent("lw:reference-add", { detail: { actionId: name, sourcePanel: ctx.panelKind } }));
      return;
    }
    if (name === "onAddWritingStyleSample" || name === "onAddCanonSource" || name === "onAddResearchNote") {
      const text = ctx.detail?.text || window.prompt("Enter content:") || "";
      if (!text) return;
      await ReferencesService.save({ kind: name, title: text.slice(0, 60), content: text });
      notify("Reference saved.");
      return;
    }
    if (name === "onImportReferenceJson") {
      const raw = window.prompt("Paste reference JSON:");
      if (!raw) return;
      try {
        const json = JSON.parse(raw);
        await ReferencesService.save(json);
        notify("Reference imported.");
      } catch (e) { notify("Invalid JSON."); }
      return;
    }
    if (name === "onCopyOnboardingJson") {
      const data = OnboardingService.loadSync({});
      await navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
      notify("Onboarding JSON copied.");
      return;
    }
    if (name === "onPasteOnboardingJson" || name === "onApplyOnboardingImport") {
      const raw = ctx.detail?.json || window.prompt("Paste onboarding JSON:");
      if (!raw) return;
      try {
        const json = typeof raw === "string" ? JSON.parse(raw) : raw;
        await OnboardingService.save(json);
        await ProjectIntelService.mergeFromOnboarding(json);
        notify("Onboarding answers applied.");
      } catch (e) { notify("Invalid onboarding JSON."); }
      return;
    }
    if (name === "onValidateOnboardingJson") {
      notify("Onboarding JSON is valid.");
      return;
    }
    if (name === "onSendOnboardingToProjectIntelligence") {
      await ProjectIntelService.mergeFromOnboarding(OnboardingService.loadSync({}));
      notify("Project Intelligence updated.");
      return;
    }

    // —— AI Handoff ——
    if (name === "onCopyHandoffJson" || name === "onDownloadHandoffJson") {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-copy-json", { detail: ctx.detail }));
      return;
    }
    if (name === "onCopyHandoffPrompt") {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-copy-prompt", { detail: ctx.detail }));
      return;
    }
    if (name === "onImportAIResult" || name === "onParseAIResultJson") {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-import", { detail: ctx.detail }));
      return;
    }
    if (name === "onCreateReviewItemsFromAIResult") {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-create-review-items", { detail: { ...ctx.detail, mode: "review" } }));
      return;
    }
    if (name === "onUpdateEntitiesFromAIResult") {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-update-entities", { detail: { ...ctx.detail, mode: "updateEntities" } }));
      return;
    }
    if (name === "onSaveAIResultAsReference") {
      window.dispatchEvent(new CustomEvent("lw:ai-handoff-save-reference", { detail: ctx.detail }));
      return;
    }

    // —— Composition / AI generate ——
    if (name === "onGenerateCompositionDraft" || name === "onGenerateDraft") {
      const comp = CompositionService.loadSync({});
      const prompt = comp.instructions || "Write a draft scene from the selected entities.";
      try {
        const text = await AIService.complete({ prompt, system: "You are a literary fiction co-writer." });
        window.dispatchEvent(new CustomEvent("lw:composition-draft-generated", { detail: { text } }));
        notify("Draft generated.");
      } catch (e) { notify(e.message); }
      return;
    }
    if (name === "onInsertCompositionDraft" || name === "onInsertDraft") {
      window.dispatchEvent(new CustomEvent("lw:composition-insert-draft", { detail: ctx.detail }));
      return;
    }
    if (name === "onCopyCompositionPrompt" || name === "onCopyPrompt") {
      const comp = CompositionService.loadSync({});
      await navigator.clipboard?.writeText(comp.instructions || "");
      notify("Prompt copied.");
      return;
    }
    if (name === "onSaveCompositionPreset") {
      await CompositionService.save({ ...CompositionService.loadSync({}), preset: ctx.detail });
      notify("Preset saved.");
      return;
    }
    if (name === "onClearComposition" || name === "onClearCompositionAll") {
      await CompositionService.save({ entities: [], instructions: "" });
      notify("Composition cleared.");
      return;
    }
    if (name === "onUpdateCompositionInstructions") {
      const text = ctx.detail?.text != null ? ctx.detail.text : (ctx.detail?.value || "");
      await CompositionService.save({ ...CompositionService.loadSync({}), instructions: text });
      return;
    }
    if (name === "onUpdateCompositionEntityRole") {
      const { idx, role, entityId } = ctx.detail || {};
      const state = CompositionService.loadSync({ entities: [] });
      const entities = (state.entities || []).map((e, i) => {
        const match = idx != null ? i === idx : (entityId && e.id === entityId);
        return match ? { ...e, role } : e;
      });
      await CompositionService.save({ ...state, entities });
      return;
    }
    if (name === "onRemoveEntityFromComposition") {
      const { idx, entityId } = ctx.detail || {};
      const state = CompositionService.loadSync({ entities: [] });
      const entities = (state.entities || []).filter((e, i) => (
        idx != null ? i !== idx : (entityId ? e.id !== entityId : true)
      ));
      await CompositionService.save({ ...state, entities });
      return;
    }
    if (name === "onSetCompositionMode" || name === "onSetCompositionPOV" || name === "onSetCompositionLength" || name === "onSetCompositionTone" || name === "onSetCompositionChapterTarget") {
      const key = name.replace(/^onSetComposition/, "").replace(/^[A-Z]/, (c) => c.toLowerCase());
      const value = ctx.detail?.value != null ? ctx.detail.value : ctx.detail;
      const state = CompositionService.loadSync({ settings: {} });
      await CompositionService.save({ ...state, settings: { ...(state.settings || {}), [key]: value } });
      return;
    }
    if (name === "onToggleCompositionContextOption") {
      const key = ctx.detail?.key || ctx.detail?.id;
      if (!key) return;
      const state = CompositionService.loadSync({ contextOptions: {} });
      const co = state.contextOptions || {};
      await CompositionService.save({ ...state, contextOptions: { ...co, [key]: !co[key] } });
      return;
    }
    if (name === "onCreateChapterFromComposition") {
      const state = CompositionService.loadSync({ entities: [], instructions: "" });
      const draft = ctx.detail?.draft || ctx.detail?.text || "";
      const chapter = await B().ManuscriptChapterService.createFromComposition({
        title: ctx.detail?.title || state.settings?.chapterTitle || "",
        draft,
        compositionId: state.id || null,
      });
      window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room", chapterId: chapter.id } }));
      notify(`Chapter created: ${chapter.title}.`);
      return;
    }

    // —— Extraction ——
    if (name === "onSaveAndExtract" || name === "onRunExtraction" || name === "onStartExtraction") {
      await B().ManuscriptService.saveCurrentDom();
      const snap = B().ManuscriptService.snapshotFromDom();
      const text = snap?.bodyText || "";
      try {
        await ExtractionService.runExtraction({ chapterId: snap?.chapterId, text, deep: name.includes("Deep") });
        notify("Extraction complete.");
      } catch (e) { notify(e.message); }
      return;
    }

    // —— Trash ——
    if (name === "onRestoreFromTrash" || name === "onRestoreTrashItem") {
      await TrashService.restore(ctx.detail?.id || id);
      notify("Entity restored.");
      return;
    }
    if (name === "onPurgeTrash" || name === "onDeleteTrashItem" || name === "onDeleteTrashItemForever") {
      await TrashService.purge(ctx.detail?.id || id);
      notify("Removed from trash.");
      return;
    }
    // onSearchTrash / onFilterTrashByType / onSortTrash are React-state-owned
    // by TrashPanelBody via <input>/<select> onChange — the click that fires on
    // these controls intentionally has no registry-side effect.
    if (name === "onSearchTrash" || name === "onFilterTrashByType" || name === "onSortTrash") {
      return;
    }
    if (name === "onPreviewTrashItem") {
      const item = ctx.detail || {};
      const previewId = item.id || id;
      const previewType = item.type || type;
      if (previewId && previewType && previewType !== "settings" && previewType !== "note" && previewType !== "canvas" && previewType !== "tangle") {
        openPanel(previewType === "entity" ? "cast" : previewType);
        focusEntity(previewType, previewId, item.name);
      } else {
        notify(item.name ? `Preview: ${item.name}` : "Preview is not available for this item.");
      }
      return;
    }

    // —— Import/export (registry backup if delegate missed) ——
    if (name === "onExportProjectData") { await exportProject(); return; }
    if (name === "onImportProjectData") { await importProject(); return; }
    if (name === "onLoadSampleProject") { await SampleProjectService.loadSample(); return; }

    // —— Entity JSON tab ——
    if (name === "onCopyEntityJsonTemplate" || name === "onExportCurrentEntity") {
      const tpl = entity || { id: B().uuid(), type: type || "locations", name: "", status: "draft" };
      await navigator.clipboard?.writeText(JSON.stringify(tpl, null, 2));
      notify("Entity JSON copied.");
      return;
    }
    if (name === "onValidateEntityJson" || name === "onApplyEntityJsonToEditor") {
      notify(name === "onValidateEntityJson" ? "JSON is valid." : "Apply via editor JSON tab.");
      return;
    }

    // —— Settings section updates ——
    if (name.startsWith("onUpdate") && name.includes("Settings")) {
      window.dispatchEvent(new CustomEvent("lw:settings-update", { detail: ctx.detail }));
      return;
    }
    if (name === "onAddAIProvider") {
      window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "ai" } }));
      return;
    }

    // —— Drop to composition ——
    if (/^onDrop\w+IntoComposition$/.test(name) || name === "onDropEntityIntoComposition") {
      window.dispatchEvent(new CustomEvent("lw:drop-to-composition", { detail: ctx.detail }));
      return;
    }

    // —— Speed reader (persist session) ——
    if (name.startsWith("onSpeedReader")) {
      window.dispatchEvent(new CustomEvent(name.replace(/^on/, "lw:").replace(/([A-Z])/g, "-$1").toLowerCase().replace("lw:-", "lw:"), { detail: ctx.detail }));
      const sr = B().StorageService.getSync(B().keys.speedReader, { sessions: [] });
      if (name === "onSpeedReaderSaveSession") {
        await B().StorageService.set(B().keys.speedReader, {
          ...sr,
          lastSession: { ...ctx.detail, savedAt: B().nowIso() },
        });
        notify("Speed Reader session saved.");
      }
      return;
    }

    // —— Link / assign fallbacks ——
    if (/^onLink\w+/.test(name) && id && type) {
      await LinkService.linkField(id, type, "links", ctx.detail?.targetId, ctx.detail?.targetType);
      notify("Linked.");
      return;
    }
    if (/^onAssign\w+/.test(name) && id && type) {
      await LinkService.patchEntity(id, type, { data: { ...(entity?.data || {}), assignee: ctx.detail?.targetId } });
      notify("Assigned.");
      return;
    }

    // —— Default: log and soft notify ——
    console.debug("[Loomwright] callback", name, ctx);
  }

  const handlers = {};
  function registerHandler(name, fn) {
    handlers[name] = fn;
  }

  function installRegistry() {
    if (window.__LW_CALLBACK_REGISTRY__) return;
    window.__LW_CALLBACK_REGISTRY__ = true;

    const names = window.__LW_CALLBACK_NAMES || [];
    names.forEach((name) => {
      registerHandler(name, async (ctx) => dispatchCallback(name, ctx));
    });

    window.LoomwrightCallbacks = handlers;
    window.LoomwrightDispatchCallback = dispatchCallback;

    document.addEventListener("click", async (e) => {
      const el = e.target.closest && e.target.closest("[data-callback]");
      if (!el || el.disabled) return;
      if (hasReactClick(el)) return;
      const cb = el.getAttribute("data-callback");
      if (!cb || !handlers[cb] || BACKEND_HANDLED.has(cb)) return;
      try {
        e.preventDefault();
        await handlers[cb](resolveCtx(el));
      } catch (err) {
        console.error("[Loomwright] callback failed", cb, err);
        notify(err.message || "Action failed.");
      }
    }, true);

    window.addEventListener("lw:dispatch-callback", async (e) => {
      const { name, detail } = e.detail || {};
      if (name && handlers[name]) await handlers[name](resolveCtx(null, detail));
    });
  }

  function boot() {
    if (window.LoomwrightBackend) installRegistry();
    else window.addEventListener("lw:backend-ready", installRegistry, { once: true });
  }

  boot();
})();
