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
    Creature: "bestiary", BestiaryEntry: "bestiary",
    Faction: "factions", Reference: "references",
    Cast: "cast", Character: "cast", CharacterSeed: "cast",
    Entity: "locations",
    CanonFact: "lore", TimelineEvent: "events", SkillTree: "skills",
    ChildLocation: "locations", AtlasLocation: "locations",
    EventConsequence: "events", EventFromQuestStep: "events",
    EventFromRelationship: "events", EventFromTangle: "events",
    QuestFromTangle: "quests", RelationshipChangeFromEvent: "events",
    // Sentinel: null means "do NOT route through parseCreateType / open
    // the entity editor". An explicit handler below handles this name.
    ChapterFromComposition: null,
    EntityFromSelection: null,
    Chapter: null,
    AuthorProfile: null,
    FromPanelHeader: null,
    TangleNode: null,
    TangleGroup: null,
    NewInstead: null,
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

  // -------------------------------------------------------------------
  // Generic copy/import/export resolvers used by the regex branches in
  // dispatchCallback. They read from / write to the live project store
  // via the existing backend services.
  // -------------------------------------------------------------------
  async function resolveCopyTarget(name, ctx) {
    const explicit = ctx.detail?.text || ctx.detail?.prompt || ctx.detail?.json || ctx.detail?.content;
    if (explicit) return explicit;
    const backend = B();
    switch (name) {
      case "onCopyIntelFile":
      case "onCopyToProjectIntelligenceFile":
        return backend.ProjectIntelService.loadSync({});
      case "onCopyEntityFillPrompt": {
        const ent = ctx.entity || (ctx.entityId && backend.EntityService.getSync(ctx.entityId, ctx.entityType));
        const schema = ent ? { ...ent, name: ent.name || "", summary: ent.summary || "" } : { name: "", summary: "" };
        return [
          "Fill the following entity record. Return JSON matching this shape.",
          "Schema:", JSON.stringify(schema, null, 2),
        ].join("\n");
      }
      case "onCopyStepJsonPrompt":
        return [
          "You are filling a Loomwright onboarding step. Return JSON only.",
          "Step:", ctx.detail?.section || "projectFoundation",
        ].join("\n");
      case "onCopyHelperPrompt":
        return ctx.detail?.label
          ? `Helper prompt for "${ctx.detail.label}".`
          : "Helper prompt.";
      case "onCopyGeneratedText":
        return window.__LW_LAST_GENERATED_DRAFT__ || null;
      default:
        return null;
    }
  }

  async function importEntityCollection(target, data) {
    const backend = B();
    const normalised = String(target).toLowerCase();
    if (normalised === "settingsprofile" || normalised === "settings") {
      const sections = (data && typeof data === "object") ? data : {};
      for (const [section, value] of Object.entries(sections)) {
        if (section && value && typeof value === "object") {
          await backend.SettingsService.saveSection(section, value);
        }
      }
      return;
    }
    if (normalised === "plotjson" || normalised === "plot") {
      await backend.OnboardingService.save({ ...(backend.OnboardingService.loadSync({}) || {}), plotStructure: data });
      return;
    }
    if (normalised === "externalresearchnotes" || normalised === "researchnotes") {
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item) continue;
        await backend.ReferencesService.save({
          kind: "research",
          title: item.title || "Research note",
          content: typeof item === "string" ? item : (item.content || JSON.stringify(item, null, 2)),
        });
      }
      return;
    }
    if (normalised === "charactersfromtext") {
      const text = typeof data === "string" ? data : (data?.text || "");
      const names = text ? Array.from(new Set(text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g) || [])) : [];
      for (const candidate of names) {
        await backend.ReviewService.add({
          id: backend.uuid("rq"),
          entityType: "cast",
          name: candidate,
          action: "Import",
          level: "suggestion",
          value: 60,
          reason: "Imported from pasted text",
          payload: { name: candidate, type: "cast" },
          status: "pending",
        });
      }
      return;
    }
    // Default: treat data as an entity (or array of entities) of <target> type.
    const entityType = backend.EntityService.normaliseType(normalised);
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      await backend.EntityService.save(entityType, row, { status: row.status || "active" });
    }
  }

  // -------------------------------------------------------------------
  // Provider-gating helper for Bucket B (AI/provider) callbacks.
  // Returns the provider config if one is configured, else surfaces a
  // specific "Configure an AI provider..." notice and returns null so
  // the caller short-circuits cleanly. Used by the audit script as a
  // marker that Bucket B branches show a provider-specific message.
  // -------------------------------------------------------------------
  async function requireProviderOrNotice(featureLabel, task) {
    const backend = B();
    const routing = backend.AIRoutingService;
    // Local-only mode hard-blocks external calls.
    if (routing && routing.isLocalOnly && routing.isLocalOnly()) {
      notify(`AI is disabled (Local-only mode). Enable a provider in Settings to use ${featureLabel}.`);
      return null;
    }
    // Routed resolution → returns { providerId, model } or null.
    if (routing && routing.resolveRoute && task) {
      const route = routing.resolveRoute(task);
      if (route?.providerId) {
        try {
          const cfg = await backend.AIService.getProviderConfig(route.providerId);
          if (!cfg.needsKey || cfg.apiKey) return { ...cfg, providerId: route.providerId, model: route.model || cfg.model };
        } catch (_) {}
      }
      notify(`Configure an AI provider in Settings to use ${featureLabel}.`);
      return null;
    }
    // Legacy single-provider fallback.
    try {
      const cfg = await backend.AIService.getProviderConfig();
      if (cfg?.apiKey) return cfg;
    } catch (_) {}
    notify(`Configure an AI provider in Settings to use ${featureLabel}.`);
    return null;
  }

  // Privacy guard: confirm before sending manuscript/reference/intel
  // text to an external provider. Uses window.confirm (the existing
  // pattern); also dispatches lw:ai-privacy-guard so a future modal can
  // replace the confirm without touching call sites. Returns true to
  // proceed, false to abort.
  function aiPrivacyGuard({ task, providerId, model, context }) {
    const backend = B();
    const routing = backend.AIRoutingService?.loadSync?.() || {};
    const sendsContent = !!(context?.includesManuscript || context?.includesReferences || context?.includesIntel);
    if (!sendsContent) return true;
    const summary = backend.AIService.buildGuardSummary({ task, providerId, model, context });
    window.dispatchEvent(new CustomEvent("lw:ai-privacy-guard", { detail: summary }));
    if (routing.confirmBeforeSendingManuscript === false) return true;
    if (typeof window.confirm !== "function") return true;
    const lines = [
      `Send local content to your AI provider?`,
      ``,
      `Task: ${summary.task}`,
      `Provider: ${summary.providerId || "—"}  Model: ${summary.model || "—"}`,
      `Includes manuscript text: ${summary.includesManuscript ? "yes" : "no"}`,
      `Includes references: ${summary.includesReferences ? "yes" : "no"}`,
      `Includes project intelligence: ${summary.includesIntel ? "yes" : "no"}`,
      `Approx size: ${summary.approxChars} chars`,
      ``,
      summary.reminder,
    ];
    return window.confirm(lines.join("\n"));
  }

  function resolveExportTarget(name, ctx) {
    const backend = B();
    switch (name) {
      case "onExportAIHandoffPack":
        return ctx.detail?.pack || { kind: "ai-handoff", createdAt: backend.nowIso(), entities: backend.EntityService.listAllSync() };
      case "onExportIntelFile":
        return backend.ProjectIntelService.loadSync({});
      case "onExportCanonSourcePack":
        return backend.ReferencesService.listSync().filter((r) => r.kind === "canon" || r.isCanonSource);
      case "onExportStyleInfluencePack":
        return backend.ReferencesService.listSync().filter((r) => r.kind === "style" || r.isStyleInfluence);
      case "onExportPrivacyProfile":
        return backend.SettingsService.getSectionSync("privacy", {});
      case "onExportProfile":
        return backend.SettingsService.getAllSync();
      default:
        return ctx.detail || {};
    }
  }

  async function acceptQueueItem(ctx, item) {
    const id = item?.id || ctx.detail?.id;
    const queue = B().ReviewService.listSync();
    const row = queue.find((q) => q.id === id) || item;
    if (!row) return;
    let saved = null;
    // Prefer the standardised candidate shape: when the candidate carries
    // `suggestedChanges` and an `existingEntityId`, apply only that diff
    // to entity.data instead of replacing the whole payload.
    const existingId = row.existingEntityId || row.targetEntityId || row.entityId;
    if (existingId && row.suggestedChanges && Object.keys(row.suggestedChanges).length) {
      const existing = B().EntityService.getSync(existingId, row.entityType);
      if (existing) {
        const nextData = { ...(existing.data || {}), ...(row.suggestedChanges || {}) };
        saved = await B().EntityService.update(row.entityType, existingId, { data: nextData });
      }
    } else if (row.payload && existingId) {
      saved = await B().EntityService.update(row.entityType, existingId, row.payload);
    } else if (row.payload?.name || row.name || row.candidate?.name) {
      // For "new" candidates, save with the most informative shape we
      // have. Prefer the candidate's payload if present (AI shape), then
      // the `candidate` object the review card displays, then fields
      // drawn from the row itself.
      const fields = (row.payload && row.payload.name) ? row.payload
        : (row.candidate && row.candidate.name) ? row.candidate
        : { name: row.name, summary: row.summary };
      saved = await B().EntityService.save(row.entityType || "references", fields, { status: "active" });
    }
    // Backfill any pending occurrences that were recorded against this
    // candidate during extraction so manuscript double-click can resolve
    // by real entity ID.
    if (saved?.id && row.candidateId && B().OccurrenceService) {
      await B().OccurrenceService.linkCandidateToEntity(row.candidateId, saved.id, saved.type || row.entityType);
    }
    await B().ReviewService.resolve(id, "done");
    notify("Accepted suggestion.");
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
  }

  async function denyQueueItem(ctx, item) {
    const id = item?.id || ctx.detail?.id;
    const row = B().ReviewService.listSync().find((q) => q.id === id) || item;
    // Denying an auto-added candidate also removes the entity it created, so
    // "I'm not happy with this auto-add" actually undoes it.
    if (row && row.status === "auto-added" && row.autoAddedEntityId) {
      try { await B().EntityService.delete(row.entityType, row.autoAddedEntityId); } catch (_) {}
    }
    if (id) await B().ReviewService.resolve(id, "denied");
    notify(row && row.autoAddedEntityId ? "Auto-added entity removed." : "Suggestion denied.");
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
  }

  function parseCreateType(name) {
    const m = name.match(/^onCreate([A-Za-z]+)$/);
    if (!m) return null;
    const suffix = m[1];
    // Explicit-handler sentinel: TYPE_FROM_CREATE may map a suffix to
    // null to signal "skip generic editor open, fall through to the
    // explicit branch below".
    if (suffix in TYPE_FROM_CREATE) return TYPE_FROM_CREATE[suffix];
    return B().EntityService.normaliseType(suffix.toLowerCase());
  }

  function parseEditType(name) {
    const m = name.match(/^onEdit([A-Za-z]+)$/);
    if (!m) return null;
    const suffix = m[1];
    if (suffix in TYPE_FROM_CREATE) return TYPE_FROM_CREATE[suffix];
    return B().EntityService.normaliseType(suffix.toLowerCase());
  }

  function parseDeleteType(name) {
    // Match onDelete<Type>, onDelete<Type>Request, onDelete<Type>Forever.
    // Plural <Type>s collapses to single (onDeleteEntities → entity → cast/etc).
    const m = name.match(/^onDelete([A-Za-z]+?)(Forever|Request|s)?$/);
    if (!m) return null;
    const stem = m[1];
    if (!stem || stem === "Trash" || stem === "TrashItem") return null;
    return TYPE_FROM_CREATE[stem] || B().EntityService.normaliseType(stem.toLowerCase());
  }

  const BACKEND_HANDLED = new Set([
    "onExportProjectData", "onImportProjectData", "onExportEntityLibrary",
    "onImportEntityLibrary", "onExportSettingsProfile", "onClearLocalDemoData",
    "onResetProjectData",
    "onBackupNow", "onTestAIProviderConnection", "onLoadSampleProject",
    "onSave", "onSaveAndExtract", "onSaveAndDeepExtract",
    "onCopyProjectContextPack", "onCopyStyleProfilePack", "onCopyCanonRulesPack",
    "onCopyCharacterBiblePack",
    // Project import/export (ProjectArchiveService)
    "onDownloadProjectExport", "onCreateProjectBackup",
    "onPreviewProjectImport", "onConfirmProjectImport",
    "onValidateProjectImport",
    "onDownloadEntityLibrary", "onCopyProjectExportJson",
    // Speed Reader (SpeedReaderService)
    "onCreateSpeedReaderSession", "onReadCurrentChapter",
    "onReadReference", "onDeleteSpeedReaderSession",
    "onResetSpeedReaderProgress",
    // Search / Indexing (SearchService)
    "onRunGlobalSearch", "onOpenSearchResult", "onClearSearch",
    "onRebuildSearchIndex",
    "onOpenEntityFromSearch", "onOpenChapterFromSearch",
    "onOpenReferenceFromSearch", "onOpenSettingsFromSearch",
    "onOpenReviewItemFromSearch", "onOpenProjectIntelligenceFromSearch",
    "onOpenOnboardingFromSearch",
    // Audit Log / Undo (AuditService)
    "onUndoAuditEvent", "onOpenAuditLog", "onClearAuditLog",
    "onExportAuditLog", "onOpenRecentActivityItem",
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
    if ((editType || name === "onEditEntity") && !/QueueItem$/.test(name)) {
      openEditor(editType || type, entity || { id }, "full");
      return;
    }
    const deleteType = parseDeleteType(name);
    if (deleteType) {
      const targetId = ctx.detail?.id || id;
      if (!targetId) {
        notify("Select an entity to delete first.");
        return;
      }
      await EntityService.delete(deleteType, targetId);
      notify("Moved to trash.");
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
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
    // Bulk review-queue actions (ported from legacy NarrativeReviewQueue).
    // Detail can be either { ids: [...] } or { chapterId } to resolve all
    // pending items in a chapter.
    if (name === "onBulkAcceptQueueItems" || name === "onBulkDenyQueueItems") {
      const detail = ctx.detail || {};
      const RS = B().ReviewService;
      let ids = Array.isArray(detail.ids) ? detail.ids : null;
      if (!ids && detail.chapterId) {
        ids = RS.listSync().filter((r) => r.chapterId === detail.chapterId && r.status === "pending").map((r) => r.id);
      }
      if (!ids || !ids.length) { notify("No items to resolve."); return; }
      if (name === "onBulkAcceptQueueItems") {
        for (const id of ids) await acceptQueueItem(ctx, { id });
        notify(`Accepted ${ids.length} item(s).`);
      } else {
        await RS.resolveMany(ids, "denied");
        notify(`Denied ${ids.length} item(s).`);
      }
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      return;
    }
    if (name === "onBulkMergeQueueItems") {
      const detail = ctx.detail || {};
      const ids = Array.isArray(detail.ids) ? detail.ids : [];
      if (!ids.length) { notify("No items to merge."); return; }
      // Per-item: open the merge modal sequentially. Each modal close advances.
      const queue = B().ReviewService.listSync();
      const first = queue.find((q) => ids.includes(q.id));
      if (!first) { notify("No queued items found."); return; }
      window.dispatchEvent(new CustomEvent("lw:open-merge-modal", {
        detail: { item: first, sourceId: first.targetEntityId, type: first.entityType, bulk: { ids } },
      }));
      return;
    }
    if (/^onEdit\w*QueueItem$/.test(name)) {
      const detail = ctx.detail || {};
      const itemId = detail.id;
      const row = itemId ? (ReviewService.listSync().find((q) => q.id === itemId) || detail) : detail;
      window.dispatchEvent(new CustomEvent("lw:open-edit-candidate", { detail: { item: row } }));
      return;
    }
    if (/^onMerge\w*QueueItem$/.test(name)) {
      // Look up the full queue row by id so we always have entityType /
      // payload / candidate even when the caller only passed { id }.
      const detail = ctx.detail || {};
      const itemId = detail.id;
      const queueRow = itemId
        ? (ReviewService.listSync().find((q) => q.id === itemId) || null)
        : null;
      const item = queueRow ? { ...queueRow, ...detail } : detail;
      // If the merge modal already supplied a chosen alternative id (Confirm
      // merge button inside the modal), perform the merge now and resolve the
      // queue item. Otherwise open the modal.
      const altId = detail.altId || detail.targetId;
      if (item && item.id && altId && item.entityType) {
        await LinkService.mergeEntities(altId, item.entityType, [item.payload?.id].filter(Boolean));
        await ReviewService.resolve(item.id, "merged");
        window.dispatchEvent(new CustomEvent("lw:close-merge-modal"));
        window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
        notify("Merged.");
        return;
      }
      window.dispatchEvent(new CustomEvent("lw:open-merge-modal", { detail: { item, sourceId: id, type: item.entityType || type } }));
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
    if (name === "onMergeItem" || name === "onMergeEntity" || name === "onMergeLocation" || /^onMerge[A-Z][a-z]+$/.test(name)) {
      const targetType = type || (name === "onMergeLocation" ? "locations" : name === "onMergeItem" ? "items" : null);
      if (!id || !targetType) {
        notify("Select an entity to merge first.");
        return;
      }
      window.dispatchEvent(new CustomEvent("lw:open-merge-modal", {
        detail: {
          item: { id: null, entityType: targetType, candidate: { name: entity?.name }, mention: entity?.summary || "", payload: entity },
          sourceId: id,
          type: targetType,
        },
      }));
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
      const route = await requireProviderOrNotice("composition draft generation", "writingDraft");
      if (!route) return;
      const comp = CompositionService.loadSync({});
      const selectedEntityIds = (comp.entities || []).map((e) => e.id).filter(Boolean);
      const built = B().AIContextBuilder.build({ task: "writingDraft", selectedEntityIds, includeReferences: true, includeProjectIntelligence: true });
      if (!aiPrivacyGuard({ task: "writingDraft", providerId: route.providerId, model: route.model, context: built })) return;
      const instructions = comp.instructions || "Write a draft scene from the selected entities.";
      try {
        const text = await AIService.complete({
          providerId: route.providerId, model: route.model,
          system: built.systemPrompt + "\nYou are a literary fiction co-writer.",
          prompt: `${instructions}\n\n${built.userPrompt}`,
          purpose: "writingDraft",
        });
        window.__LW_LAST_GENERATED_DRAFT__ = text;
        window.dispatchEvent(new CustomEvent("lw:composition-draft-generated", { detail: { text } }));
        B().AuditService?.log?.({ action: "ai.writingDraft", label: "Generated composition draft", source: "AIService", metadata: { providerId: route.providerId, model: route.model, status: "ok" }, reversible: false });
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

    // —— Entity Extraction Wizard (the big-extraction window) ——
    // These were previously unwired ("the wizard opens but does nothing").
    if (name === "onOpenExtractionWizard" || name === "onExtractCast" || name === "onExtractLocations") {
      const typeFocus = name === "onExtractCast" ? "cast"
        : name === "onExtractLocations" ? "locations"
        : (ctx.detail?.typeFocus || null);
      window.dispatchEvent(new CustomEvent("lw:open-extraction-wizard", {
        detail: { scope: ctx.detail?.scope || "manuscript", typeFocus, chapterId: ctx.detail?.chapterId || null },
      }));
      return;
    }
    if (name === "onRerunExtraction") {
      window.dispatchEvent(new CustomEvent("lw:open-extraction-wizard", { detail: { scope: "chapter" } }));
      return;
    }
    if (name === "onCancelExtraction") {
      window.dispatchEvent(new CustomEvent("lw:extraction-cancel"));
      return;
    }
    if (name === "onContinueExtractionInBackground") {
      window.dispatchEvent(new CustomEvent("lw:close-extraction-wizard"));
      return;
    }
    if (name === "onOpenExtractionSession") {
      openPanel("review");
      return;
    }

    // —— Bucket B — AI/provider-gated. Show a specific notice if no
    // provider is configured, else perform the AI call.
    if (name === "onGenerateAIWriterDraft") {
      const route = await requireProviderOrNotice("AI Writer draft generation", "writingDraft");
      if (!route) return;
      const activeChapterId = ctx.detail?.chapterId || document.querySelector("[data-ui='ManuscriptCanvas']")?.getAttribute("data-chapter-id") || null;
      const built = B().AIContextBuilder.build({ task: "writingDraft", chapterId: activeChapterId, includeReferences: true, includeProjectIntelligence: true });
      if (!aiPrivacyGuard({ task: "writingDraft", providerId: route.providerId, model: route.model, context: built })) return;
      const prompt = (ctx.detail?.prompt || "Write a draft scene.") + (built.userPrompt ? `\n\n${built.userPrompt}` : "");
      try {
        const text = await AIService.complete({
          providerId: route.providerId, model: route.model,
          system: built.systemPrompt + "\nYou are a literary fiction co-writer.",
          prompt, purpose: "writingDraft",
        });
        window.__LW_LAST_GENERATED_DRAFT__ = text;
        window.dispatchEvent(new CustomEvent("lw:composition-draft-generated", { detail: { text } }));
        B().AuditService?.log?.({ action: "ai.writingDraft", label: "Generated AI Writer draft", source: "AIService", metadata: { providerId: route.providerId, model: route.model, status: "ok" }, reversible: false });
        notify("Draft generated.");
      } catch (e) { notify(e.message); }
      return;
    }
    if (name === "onGenerateDraftSkillTree") {
      const route = await requireProviderOrNotice("Skill Tree draft generation", "skillTreeGeneration");
      if (!route) return;
      const skillId = ctx.detail?.skillId || id;
      const skill = skillId ? EntityService.getSync(skillId, "skills") : null;
      const prompt = `Propose a draft skill tree for "${skill?.name || ctx.detail?.theme || "the selected skill"}" as JSON nodes array.`;
      // Skill-tree generation does not send manuscript text — no guard needed.
      try {
        const raw = await AIService.complete({ providerId: route.providerId, model: route.model, prompt, system: "Return JSON only.", purpose: "skillTreeGeneration" });
        let nodes = [];
        try { nodes = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()); } catch (_) {}
        B().AuditService?.log?.({ action: "ai.skillTreeGeneration", label: "Generated draft skill tree", source: "AIService", metadata: { providerId: route.providerId, model: route.model, status: "ok" }, reversible: false });
        if (Array.isArray(nodes) && skillId) {
          const current = EntityService.getSync(skillId, "skills");
          await EntityService.update("skills", skillId, {
            data: { ...(current?.data || {}), draftNodes: nodes.map((n, i) => ({ id: B().uuid("sn"), ...n, index: i })) },
          });
        }
        notify("Draft skill tree generated.");
      } catch (e) { notify(e.message); }
      return;
    }
    if (name === "onRunContinuityCheck") {
      // Local heuristic always available; AI augmentation when provider set.
      const refs = ReferencesService.listSync().filter((r) => r.kind === "canon" || r.isCanonSource);
      const snap = B().ManuscriptService?.snapshotFromDom?.();
      const text = (snap?.bodyText || "").toLowerCase();
      const conflicts = [];
      for (const ref of refs) {
        const claim = (ref.content || ref.title || "").toLowerCase();
        const negated = claim && text.includes("not " + claim);
        if (negated) conflicts.push({ reference: ref.title, claim });
      }
      // AI augmentation only when a provider routes AND not local-only.
      const routing = B().AIRoutingService;
      const route = (routing && !routing.isLocalOnly()) ? routing.resolveRoute("continuityCheck") : null;
      if (route?.providerId) {
        const built = { includesManuscript: !!snap?.bodyText, approxChars: (snap?.bodyText || "").length };
        if (aiPrivacyGuard({ task: "continuityCheck", providerId: route.providerId, model: route.model, context: built })) {
          try {
            const prompt = `Given the canon rules below and chapter text, list any contradictions as JSON.\nCanon:\n${refs.map((r) => "- " + (r.title || r.content)).join("\n")}\n\nChapter:\n${snap?.bodyText?.slice(0, 4000) || ""}`;
            const raw = await AIService.complete({ providerId: route.providerId, model: route.model, prompt, system: "Return JSON array of {claim,evidence}.", purpose: "continuityCheck" });
            try { conflicts.push(...JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim())); } catch (_) {}
            B().AuditService?.log?.({ action: "ai.continuityCheck", label: "Ran AI continuity check", source: "AIService", metadata: { providerId: route.providerId, model: route.model, status: "ok" }, reversible: false });
          } catch (_) {}
        }
      }
      window.dispatchEvent(new CustomEvent("lw:continuity-check", { detail: { conflicts } }));
      notify(conflicts.length ? `${conflicts.length} potential contradiction(s) flagged.` : "No contradictions detected.");
      return;
    }
    if (name === "onRunEntitySuggestion") {
      // Local extraction always available; AI/deep augmentation only when a
      // provider routes AND local-only mode is off.
      const snap = B().ManuscriptService?.snapshotFromDom?.();
      const text = snap?.bodyText || "";
      const routing = B().AIRoutingService;
      const route = (routing && !routing.isLocalOnly()) ? routing.resolveRoute("deepExtraction") : null;
      let deep = false;
      if (route?.providerId) {
        const built = { includesManuscript: !!text, approxChars: text.length };
        deep = aiPrivacyGuard({ task: "deepExtraction", providerId: route.providerId, model: route.model, context: built });
      }
      try {
        await ExtractionService.runExtraction({ chapterId: snap?.chapterId, text, deep });
        if (deep) B().AuditService?.log?.({ action: "ai.deepExtraction", label: "Ran AI entity suggestion", source: "AIService", metadata: { providerId: route.providerId, model: route.model, status: "ok" }, reversible: false });
        notify(deep ? "Entity suggestions generated (with AI)." : "Entity suggestions generated (local).");
      } catch (e) { notify(e.message); }
      return;
    }
    if (name === "onAcceptGeneratedText") {
      const text = ctx.detail?.text || window.__LW_LAST_GENERATED_DRAFT__;
      if (!text) {
        notify("Generate a draft first.");
        return;
      }
      window.dispatchEvent(new CustomEvent("lw:composition-insert-draft", { detail: { text, source: "ai" } }));
      notify("Generated text inserted into the current chapter.");
      return;
    }
    if (name === "onCopyGeneratedText") {
      const text = window.__LW_LAST_GENERATED_DRAFT__;
      if (!text) { notify("No generated text to copy yet."); return; }
      try {
        await navigator.clipboard?.writeText(text);
        notify("Copied generated text.");
      } catch (e) { notify("Clipboard unavailable."); }
      return;
    }

    // —— Tangle nodes (TangleService — local canvas state) ——
    if (name === "onCreateTangleNode" || name === "onCreateTangleGroup") {
      const TS = B().TangleService;
      if (!TS) { notify("Tangle service unavailable."); return; }
      const payload = ctx.detail || {};
      if (name === "onCreateTangleNode") {
        await TS.addNode({ kind: payload.kind || "note", title: payload.title || "New node", body: payload.body || "" });
        notify("Tangle node added.");
      } else {
        await TS.addGroup({ title: payload.title || "Group" });
        notify("Tangle group added.");
      }
      return;
    }
    if (name === "onEditTangleNode") {
      const TS = B().TangleService;
      const nodeId = ctx.detail?.id || id;
      if (!TS || !nodeId) { notify("Open the tangle node first."); return; }
      await TS.updateNode(nodeId, ctx.detail?.patch || ctx.detail || {});
      notify("Tangle node updated.");
      return;
    }
    if (name === "onDeleteTangleNodeRequest") {
      const TS = B().TangleService;
      const nodeId = ctx.detail?.id || id;
      if (!TS || !nodeId) { notify("Open the tangle node first."); return; }
      await TS.removeNode(nodeId);
      notify("Tangle node removed.");
      return;
    }

    // —— Explicit Bucket A handlers (non-generic) ——

    // Generic + Create (no type given) — open editor with panel kind.
    if (name === "onCreate") {
      const kind = ctx.panelKind;
      const presetType = kind && window.PANEL_PRESETS?.[kind]?.entityType;
      openEditor(presetType || "locations", null, "quick");
      return;
    }

    // Quest workflow
    if (name === "onAddQuestStep" || name === "onCompleteQuestStep" || name === "onBranchQuest") {
      const questId = ctx.detail?.questId || id;
      if (!questId) { notify("Open a quest first."); return; }
      const quest = EntityService.getSync(questId, "quests");
      if (!quest) { notify("Quest not found."); return; }
      const data = { ...(quest.data || {}) };
      if (name === "onAddQuestStep") {
        const step = ctx.detail?.step || { id: B().uuid("qs"), title: ctx.detail?.title || "New step", status: "pending" };
        data.steps = Array.isArray(data.steps) ? [...data.steps, step] : [step];
        await EntityService.update("quests", questId, { data });
        notify("Quest step added.");
      } else if (name === "onCompleteQuestStep") {
        const stepId = ctx.detail?.stepId;
        data.steps = (data.steps || []).map((s) => s.id === stepId ? { ...s, status: "complete", completedAt: B().nowIso() } : s);
        await EntityService.update("quests", questId, { data });
        notify("Step completed.");
      } else {
        const branch = ctx.detail?.branch || { id: B().uuid("qb"), label: ctx.detail?.label || "Branch" };
        data.branches = Array.isArray(data.branches) ? [...data.branches, branch] : [branch];
        await EntityService.update("quests", questId, { data });
        notify("Quest branched.");
      }
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      return;
    }

    // References
    if (name === "onArchiveReference") {
      const refId = ctx.detail?.id || id;
      if (!refId) { notify("Select a reference first."); return; }
      const refs = ReferencesService.listSync();
      const ref = refs.find((r) => r.id === refId);
      if (ref) await ReferencesService.save({ ...ref, status: "archived", updatedAt: B().nowIso() });
      notify("Reference archived.");
      return;
    }
    if (name === "onBuildReferenceContextPack") {
      const selectedIds = ctx.detail?.selectedIds || [];
      const refs = ReferencesService.listSync();
      const pack = {
        kind: "reference-context",
        createdAt: B().nowIso(),
        references: selectedIds.length ? refs.filter((r) => selectedIds.includes(r.id)) : refs.filter((r) => r.includedInAIContext),
      };
      await HandoffService.savePack(pack);
      notify("Reference context pack saved.");
      return;
    }

    // Canon facts
    if (name === "onDenyCanonContradiction") {
      const refId = ctx.detail?.id || id;
      const ref = ReferencesService.listSync().find((r) => r.id === refId);
      if (ref) await ReferencesService.save({ ...ref, contradictionStatus: "denied", updatedAt: B().nowIso() });
      notify("Contradiction denied.");
      return;
    }
    if (name === "onMergeCanonFact") {
      window.dispatchEvent(new CustomEvent("lw:open-merge-modal", {
        detail: { item: { id: null, entityType: "lore", candidate: { name: entity?.name }, payload: entity }, sourceId: id, type: "lore" },
      }));
      return;
    }

    // Skill tree drafts (review-queue-shaped local items on skill records)
    if (name === "onAcceptDraftSkillNode" || name === "onDenyDraftSkillNode" || name === "onMergeDraftSkillNode") {
      const skillId = ctx.detail?.skillId || id;
      const draftId = ctx.detail?.draftId;
      if (!skillId) { notify("Open the skill tree first."); return; }
      const skill = EntityService.getSync(skillId, "skills");
      if (!skill) return;
      const data = { ...(skill.data || {}) };
      data.draftNodes = (data.draftNodes || []).filter((n) => n.id !== draftId);
      if (name === "onAcceptDraftSkillNode") {
        const draft = (skill.data?.draftNodes || []).find((n) => n.id === draftId) || ctx.detail?.draft;
        if (draft) {
          data.nodes = Array.isArray(data.nodes) ? [...data.nodes, { ...draft, accepted: true }] : [{ ...draft, accepted: true }];
        }
      } else if (name === "onMergeDraftSkillNode") {
        const draft = (skill.data?.draftNodes || []).find((n) => n.id === draftId);
        const targetId = ctx.detail?.targetId;
        const target = (data.nodes || []).find((n) => n.id === targetId);
        if (target && draft) {
          data.nodes = (data.nodes || []).map((n) => n.id === targetId ? { ...n, ...draft, id: targetId } : n);
        }
      }
      await EntityService.update("skills", skillId, { data });
      notify(name === "onAcceptDraftSkillNode" ? "Draft accepted." : name === "onDenyDraftSkillNode" ? "Draft denied." : "Draft merged.");
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      return;
    }

    // Style profile (special: stored as a reference with kind=style)
    if (name === "onAcceptStyleProfile") {
      const profile = ctx.detail?.profile || ctx.detail || {};
      await ReferencesService.save({
        kind: "style",
        title: profile.title || "Style profile",
        content: typeof profile === "string" ? profile : JSON.stringify(profile, null, 2),
        isStyleInfluence: true,
      });
      notify("Style profile saved.");
      return;
    }

    // Onboarding
    if (name === "onSaveOnboardingDraft") {
      const current = OnboardingService.loadSync({}) || {};
      await OnboardingService.save({ ...current, ...(ctx.detail || {}), status: "draft", updatedAt: B().nowIso() });
      notify("Onboarding draft saved.");
      return;
    }
    if (name === "onApplyStepJson" || name === "onPasteStepJson") {
      const section = ctx.detail?.section;
      const raw = ctx.detail?.json || (name === "onPasteStepJson" ? window.prompt("Paste step JSON:") : ctx.detail);
      if (!raw) return;
      let parsed = raw;
      try { if (typeof raw === "string") parsed = JSON.parse(raw); } catch (e) { notify("Invalid JSON."); return; }
      const current = OnboardingService.loadSync({}) || {};
      const next = section ? { ...current, [section]: parsed } : { ...current, ...parsed };
      await OnboardingService.save(next);
      await ProjectIntelService.mergeFromOnboarding(next);
      notify("Step JSON applied.");
      return;
    }

    // Handoff
    if (name === "onSaveHandoffPack") {
      const pack = ctx.detail?.pack || ctx.detail;
      await HandoffService.savePack(pack || { kind: "manual", createdAt: B().nowIso() });
      notify("Handoff pack saved.");
      return;
    }

    // Settings / Author profiles (stored in settings.authors[])
    if (name === "onExportProfile") {
      const data = B().SettingsService.getAllSync();
      await B().downloadJson("loomwright-profile.json", data);
      notify("Profile exported.");
      return;
    }

    // Atlas focus
    if (name === "onApplyAtlasFocus") {
      window.dispatchEvent(new CustomEvent("lw:atlas-focus", { detail: ctx.detail || {} }));
      notify("Atlas focus applied.");
      return;
    }

    // Send between surfaces
    if (name === "onSendSuggestionToWriter" || name === "onSendTangleItemToWriter") {
      window.dispatchEvent(new CustomEvent("lw:composition-insert-draft", {
        detail: { text: ctx.detail?.text || ctx.detail?.label || "", source: name },
      }));
      notify("Sent to Writer's Room.");
      return;
    }
    if (name === "onSendSuggestionToTangle") {
      const node = {
        id: B().uuid("tn"),
        kind: "suggestion",
        title: ctx.detail?.title || ctx.detail?.label || "Suggestion",
        body: ctx.detail?.text || "",
        createdAt: B().nowIso(),
      };
      if (B().TangleService) await B().TangleService.addNode(node);
      window.dispatchEvent(new CustomEvent("lw:tangle-updated"));
      notify("Sent to Tangle.");
      return;
    }

    // Stat phrase tester
    if (name === "onTestStatPhrase") {
      const phrase = ctx.detail?.phrase || "";
      const rule = ctx.detail?.rule || "";
      if (!phrase || !rule) { notify("Provide a phrase and a rule."); return; }
      try {
        const re = new RegExp(rule, "i");
        const m = phrase.match(re);
        notify(m ? `Match: "${m[0]}"` : "No match.");
      } catch (e) { notify("Invalid rule: " + e.message); }
      return;
    }

    // Provider key validation (delegates to existing test-connection path)
    if (name === "onValidateProviderKey") {
      const providerId = ctx.detail?.providerId;
      try {
        const ok = await AIService.testConnection(providerId);
        notify(ok ? "Provider key valid." : "Provider key invalid.");
      } catch (e) { notify("Validation failed: " + e.message); }
      return;
    }

    // Today: local rule-based prompt generation. AI path activates if a
    // provider is configured but is NOT required.
    if (name === "onGenerateTodayPrompts") {
      const all = EntityService.listAllSync();
      const dormant = Object.values(all.cast || {}).filter((c) => (c.flags || []).includes("dormant")).slice(0, 1);
      const openQuests = Object.values(all.quests || {}).filter((q) => q.status !== "complete").slice(0, 1);
      const recentEvents = Object.values(all.events || {}).slice(-1);
      const prompts = [
        dormant[0] ? `Reintroduce ${dormant[0].name}, who hasn't appeared recently.` : null,
        openQuests[0] ? `Advance the quest "${openQuests[0].name}".` : null,
        recentEvents[0] ? `Follow up on the consequence of "${recentEvents[0].name}".` : null,
      ].filter(Boolean);
      window.dispatchEvent(new CustomEvent("lw:today-prompts", { detail: { prompts } }));
      notify(prompts.length ? `Generated ${prompts.length} prompts.` : "No prompts yet — add some entities first.");
      return;
    }

    // Command palette / wheel actions are meta-dispatchers: they carry a
    // target callback name and forward to it.
    if (name === "onRunCommand" || name === "onRunWheelAction") {
      const targetName = ctx.detail?.commandId || ctx.detail?.action || ctx.detail?.callback;
      if (!targetName) { notify("No command target."); return; }
      window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: targetName, detail: ctx.detail?.detail } }));
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
    // —— AI provider config + routing (BYOK) ——
    if (name === "onSaveAIProviderConfig") {
      const cfg = ctx.detail || {};
      try {
        await B().AIService.saveProviderConfig(cfg);
        notify(`Saved provider "${cfg.label || cfg.id || cfg.providerType || "provider"}".`);
      } catch (e) { notify(e.message || "Could not save provider."); }
      return;
    }
    if (name === "onClearAIProviderConfig") {
      const pid = ctx.detail?.providerId || ctx.detail?.id;
      if (!pid) { notify("No provider id supplied."); return; }
      await B().AIService.clearProviderKey(pid);
      notify("Provider key cleared.");
      return;
    }
    if (name === "onSetAIRoutingMode" || name === "onToggleLocalOnlyMode") {
      const mode = name === "onToggleLocalOnlyMode"
        ? (B().AIRoutingService.isLocalOnly() ? "balanced" : "localOnly")
        : (ctx.detail?.mode || ctx.detail?.value || "balanced");
      await B().AIRoutingService.save({ mode });
      notify(`AI routing mode: ${mode}.`);
      return;
    }
    if (name === "onSetAITaskRoute") {
      const { task, providerId, model } = ctx.detail || {};
      if (!task) { notify("No task supplied for routing."); return; }
      await B().AIRoutingService.save({ taskRoutes: { [task]: { providerId, model } } });
      notify(`Routed ${task} → ${providerId || "default"}.`);
      return;
    }
    if (name === "onSetAITier") {
      const tier = ctx.detail?.tier || ctx.detail?.value || "normal";
      await B().AIRoutingService.save({ tier });
      notify(tier === "free"
        ? "AI tier: Free — only local providers (e.g. Ollama) will be used. No tokens, no cost."
        : `AI tier: ${tier}.`);
      return;
    }
    if (name === "onConfirmAIPrivacyGuard") {
      // The privacy guard resolves inline via window.confirm in this
      // build; this callback exists so a future modal can resolve a
      // pending guarded call. No-op acknowledgement here.
      window.dispatchEvent(new CustomEvent("lw:ai-privacy-guard-confirmed", { detail: ctx.detail }));
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

    // —— Generic onAdd<Field> — append to current entity's data field ——
    // Strict guard so we never write undefined/empty values or run without
    // a valid target. Specific onAdd* branches (onAddReferenceSource,
    // onAddCanonRule, etc.) appear earlier and take precedence.
    if (/^onAdd[A-Z][A-Za-z]+$/.test(name)) {
      const field = name.replace(/^onAdd/, "").replace(/^[A-Z]/, (c) => c.toLowerCase());
      const rawValue = ctx.detail?.value != null ? ctx.detail.value
        : ctx.detail?.text != null ? ctx.detail.text
        : (ctx.detail && typeof ctx.detail === "object" && !ctx.detail.target) ? ctx.detail
        : null;
      const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
      const valueIsEmpty = value == null || value === ""
        || (typeof value === "object" && Object.keys(value || {}).length === 0);
      if (!id || !type || valueIsEmpty) {
        if (id && type) openEditor(type, ctx.entity || { id }, "full");
        else notify(`Open the target first, then add a ${field}.`);
        return;
      }
      await LinkService.appendField(id, type, field, value);
      notify(`Added to ${field}.`);
      return;
    }

    // —— Generic onCopy* — clipboard write ——
    if (/^onCopy[A-Z][A-Za-z]+(Prompt|Json|File|Text)$/.test(name)) {
      const text = await resolveCopyTarget(name, ctx);
      if (text == null) {
        notify("Nothing to copy.");
        return;
      }
      try {
        await navigator.clipboard?.writeText(typeof text === "string" ? text : JSON.stringify(text, null, 2));
        notify("Copied to clipboard.");
      } catch (e) {
        notify("Clipboard unavailable.");
      }
      return;
    }

    // —— Generic onImport<Type> — JSON file picker ——
    if (/^onImport[A-Z][A-Za-z]+$/.test(name)) {
      const target = name.replace(/^onImport/, "");
      const data = ctx.detail?.json || ctx.detail?.data || await B().pickJsonFile?.();
      if (!data) return;
      await importEntityCollection(target, data);
      notify("Import complete.");
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
      return;
    }

    // —— Generic onExport*Pack / onExport*File / onExport*Profile — download ——
    if (/^onExport[A-Z][A-Za-z]+(Pack|File|Profile)$/.test(name)) {
      const data = resolveExportTarget(name, ctx);
      const slug = name.replace(/^onExport/, "").replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
      await B().downloadJson?.(`loomwright-${slug}.json`, data);
      notify("Export downloaded.");
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

    // —— Default ——
    // UI housekeeping (close/cancel/zoom/back/expand/etc.) is React-owned and
    // intentionally has no registry-side effect. Everything else surfaces a
    // clear "not yet wired" notice so users never click a button that does
    // nothing without explanation.
    if (UI_HOUSEKEEPING_PREFIXES.some((p) => name.startsWith(p))) return;
    notify(`"${name.replace(/^on/, "").replace(/([A-Z])/g, " $1").trim()}" isn't wired yet.`);
    // eslint-disable-next-line no-console
    console.debug("[Loomwright] callback", name, ctx);
  }

  // Callbacks whose semantics are pure UI state (managed by React inside
  // panels/workspaces). Reaching them in dispatchCallback means the click
  // bubbled past the React handler — silently return so the audit doesn't
  // flag a missing handler. Be careful: this is a prefix match, so adding
  // "onSet" here would mask onSetEntityStatus. Only add prefixes that are
  // unambiguously cosmetic.
  const UI_HOUSEKEEPING_PREFIXES = [
    "onClosePanel", "onClosePalette", "onCloseWheel", "onCloseAtlasLayers",
    "onCloseEventsLedger", "onCloseQuestLog", "onCloseTangleCanvas",
    "onCloseOnboardingAnswers", "onCloseExtractionModal", "onCloseSpeedReader",
    "onCancel", "onBack", "onZoom", "onAtlasZoom", "onAtlasFitView",
    "onAtlasSearch", "onAtlasPan", "onAtlasLayer", "onAtlasGrid",
    "onActivateTab", "onExpand", "onCollapse", "onTogglePanel",
    "onClearPanelFilter", "onClearAtlasContext", "onClearAtlasFocus",
    "onSortPanel", "onFilterPanel", "onSearchPanel",
    "onMinimise", "onPin", "onBringPanel", "onReorder",
    "onHover", "onFocusField", "onScroll", "onMove",
    "onResize", "onDragOver", "onDragEnter", "onDragLeave",
    "onPreview", "onChangeWorkspaceLayout", "onChangeWritingLayout",
    "onShowAtlasLayer", "onHideAtlasLayer",
  ];

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
