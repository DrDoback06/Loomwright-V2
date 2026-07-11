// =====================================================================
// entity-framework-host.jsx
// EntityFrameworkPanelBody — wrapper that holds the local panel-side
// state (search/view/multi/edit/review/merge) and renders EntityTabShell.
// Designed to be dropped into the DockedPanel body the same way
// CastPanelBody is — siblings of the PanelHeader/toolbar/body markup.
// =====================================================================

const {
  useState: _useState_efh,
  useMemo: _useMemo_efh,
  useEffect: _useEffect_efh,
} = React;

const FRAMEWORK_ENTITY_TYPES = new Set([
  "bestiary","locations","items","classes","races","stats","abilities",
  "skills","quests","events","factions","lore","relationships",
  "timeline","references"
]);

const ENTITY_FRAMEWORK_STORE_EVENTS = [
  "lw:entity-store-updated",
  "lw:review-queue-updated",
  "lw:impact-review-updated",
  "lw:project-imported",
  "lw:sample-project-loaded",
  "lw:backend-ready",
];

const EntityFrameworkPanelBody = ({ panel, onSelectEntity, ...frameworkCallbacks }) => {
  const { entityType } = panel;

  const [search, setSearch]   = _useState_efh("");
  const [view, setView]       = _useState_efh("list");
  const [groupBy, setGroupBy] = _useState_efh("none");
  const [selectedId, setSelectedId] = _useState_efh(null);
  const [multiIds, setMultiIds]     = _useState_efh([]);
  const [multiMode, setMultiMode]   = _useState_efh(false);
  const [editing, setEditing]       = _useState_efh(false);
  const [reviewMode, setReviewMode] = _useState_efh(false);
  const [mergeOpen, setMergeOpen]   = _useState_efh(false);
  const [storeVersion, setStoreVersion] = _useState_efh(0);

  // Panels can remain open while extraction, editors, imports, Impact Review,
  // sample loading or tests mutate the canonical stores. Re-read those stores
  // instead of freezing the panel.entities snapshot captured when the panel was
  // first decorated.
  _useEffect_efh(() => {
    const bump = () => setStoreVersion((value) => value + 1);
    ENTITY_FRAMEWORK_STORE_EVENTS.forEach((name) => window.addEventListener(name, bump));
    return () => ENTITY_FRAMEWORK_STORE_EVENTS.forEach((name) => window.removeEventListener(name, bump));
  }, [entityType]);

  const entities = _useMemo_efh(() => {
    void storeVersion;
    const service = window.LoomwrightBackend?.EntityService;
    if (service?.listSync) return service.listSync(entityType);
    return panel.entities
      || (window.__LW_SAMPLE_LOADED__ ? window.ENTITY_SAMPLES?.[entityType] : null)
      || [];
  }, [entityType, panel.entities, storeVersion]);

  const reviewItems = _useMemo_efh(() => {
    void storeVersion;
    const service = window.LoomwrightBackend?.ReviewService;
    if (service?.listSync) return service.listSync(entityType);
    return panel.reviewItems
      || (window.__LW_SAMPLE_LOADED__ ? window.ENTITY_REVIEW_SAMPLES?.[entityType] : null)
      || [];
  }, [entityType, panel.reviewItems, storeVersion]);

  const suggestions = panel.suggestions
    || (window.__LW_SAMPLE_LOADED__ ? window.ENTITY_SUGGESTION_SAMPLES?.[entityType] : null)
    || [];

  const queueCount = reviewItems.length
    + entities.reduce((sum, entity) => sum + (entity.reviewQueueCount || entity.queue || 0), 0);

  // Per-panel polished empty state — when the live store is empty AND the
  // sample project hasn't been loaded, surface clear actions instead of
  // an empty list. Each panel can override with panel.state === "empty"
  // to get the default shell empty state.
  if (entities.length === 0 && !panel.state) {
    const labels = {
      bestiary:      { title: "No creatures yet",       hint: "Add the bestiary as you encounter beings." },
      locations:     { title: "No locations yet",       hint: "Map the world as your story unfolds." },
      items:         { title: "No items yet",           hint: "Track weapons, equipment, and artefacts." },
      classes:       { title: "No classes yet",         hint: "Define class archetypes for your cast." },
      races:         { title: "No races / species yet", hint: "Set up the species and cultures of your world." },
      stats:         { title: "No stats yet",           hint: "Define the numeric systems used by entities." },
      abilities:     { title: "No abilities yet",       hint: "Catalogue special powers and techniques." },
      skills:        { title: "No skills yet",          hint: "Track learned techniques and trained abilities." },
      quests:        { title: "No quests yet",          hint: "Outline goals and the steps to reach them." },
      events:        { title: "No events yet",          hint: "Mark key moments on the story timeline." },
      factions:      { title: "No factions yet",        hint: "Group your world into allegiances and rivalries." },
      lore:          { title: "No canon yet",           hint: "Lock in world facts that your story must honour." },
      relationships: { title: "No relationships yet",   hint: "Capture bonds, rivalries, and dynamics." },
      timeline:      { title: "Timeline empty",         hint: "Place events to build the chronology." },
      references:    { title: "No references yet",      hint: "Add notes, uploads, URLs, or style samples." },
    };
    const lbl = labels[entityType] || { title: "Nothing here yet", hint: "Add your first record to get started." };
    return (
      <div data-ui="EntityFrameworkPanelBody" data-state="empty" style={{ padding: 24 }}>
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{lbl.title}</div>
          <div style={{ color: "var(--ink-2, #6b5a3a)", marginBottom: 20 }}>{lbl.hint}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <button
              className="rpg-btn rpg-btn--primary"
              onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: entityType } }))}
              data-callback="onCreateEntity"
              data-testid={"empty-create-" + entityType}
            >
              + Create
            </button>
            <button
              className="rpg-btn"
              onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: entityType, mode: "json" } }))}
              data-callback="onImportEntity"
              data-testid={"empty-import-" + entityType}
            >
              Import JSON
            </button>
            {(entityType === "cast" || entityType === "locations" || entityType === "items" || entityType === "quests" || entityType === "events" || entityType === "bestiary") && (
              <button
                className="rpg-btn"
                onClick={() => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onSaveAndExtract" } }))}
                data-testid={"empty-extract-" + entityType}
              >
                Run extraction
              </button>
            )}
            <button
              className="rpg-btn"
              onClick={() => {
                if (!window.confirm) return;
                if (window.confirm("Load the Pale Reach sample project? Sample records will be added; your existing work is preserved.")) {
                  window.LoomwrightBackend?.SampleProjectService?.loadSample();
                }
              }}
              data-callback="onLoadSampleProject"
              data-testid={"empty-sample-" + entityType}
            >
              Load sample project
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filtered = _useMemo_efh(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter((entity) =>
      (entity.name || "").toLowerCase().includes(q)
      || (entity.subtitle || "").toLowerCase().includes(q)
    );
  }, [entities, search]);

  const selectedEntity = entities.find((entity) => entity.id === selectedId);
  const multiEntities  = entities.filter((entity) => multiIds.includes(entity.id));

  // If a selected or multi-selected record is removed elsewhere, clean the
  // local selection without disturbing the rest of the panel state.
  _useEffect_efh(() => {
    if (selectedId && !entities.some((entity) => entity.id === selectedId)) {
      setSelectedId(null);
      setEditing(false);
    }
    setMultiIds((ids) => ids.filter((id) => entities.some((entity) => entity.id === id)));
  }, [entities, selectedId]);

  // panel.state can override the auto-derived mode (loading/error/empty/review/etc)
  const mode = panel.state === "loading"     ? "loading"
            : panel.state === "error"        ? "error"
            : panel.state === "empty"        ? "empty"
            : panel.state === "review"       ? "review"
            : panel.state === "suggestion"   ? "suggestive"
            : panel.state === "edit"         ? "edit"
            : panel.state === "compare"      ? "compare"
            : reviewMode                      ? "review"
            : editing && selectedEntity       ? "edit"
            : multiMode && multiIds.length    ? "multi"
            : selectedEntity                  ? "selected"
            : "overview";

  // Type-specific detail body + filter chips
  const detailRender = (window.RPG_DETAIL_RENDERERS || {})[entityType];
  const typeFilters  = (window.RPG_FILTERS || {})[entityType] || [];

  return (
    <EntityTabShell
      panel={{ ...panel, queueCount }}
      mode={mode}
      entities={filtered}
      selectedEntity={selectedEntity}
      multiEntities={multiEntities}
      reviewItems={reviewItems}
      suggestions={suggestions}
      filters={typeFilters}
      detailRender={detailRender ? (entity) => detailRender(entity, {
        onSelectEntity: (related) => {
          setSelectedId(related.id);
          onSelectEntity && onSelectEntity(related);
          frameworkCallbacks.onOpenRelatedTab && frameworkCallbacks.onOpenRelatedTab(related);
        },
        onOpenRelatedTab: frameworkCallbacks.onOpenRelatedTab,
        onOpenSourceMention: frameworkCallbacks.onOpenSourceMention,
      }) : undefined}
      search={search}
      view={view}
      groupBy={groupBy}
      onSearchChange={setSearch}
      onViewChange={setView}
      onGroupByChange={setGroupBy}
      onSortChange={() => {}}
      onFilterChange={() => {}}
      onSelectEntity={(entity) => {
        setSelectedId(entity.id);
        setEditing(false);
        setReviewMode(false);
        onSelectEntity && onSelectEntity(entity);
      }}
      onBackToOverview={() => { setSelectedId(null); setEditing(false); setReviewMode(false); }}
      onToggleMulti={(entity) => setMultiIds((ids) => ids.includes(entity.id) ? ids.filter((id) => id !== entity.id) : ids.concat(entity.id))}
      onEnterMultiMode={() => setMultiMode(true)}
      onExitMultiMode={() => { setMultiMode(false); setMultiIds([]); }}
      onCreateEntity={frameworkCallbacks.onCreateEntity || (() => {})}
      onImportEntity={frameworkCallbacks.onImportEntity || (() => {})}
      onEditEntity={(entity) => {
        if (entity?.save) { setEditing(false); }
        else { setEditing(true); if (entity?.id) setSelectedId(entity.id); }
        frameworkCallbacks.onEditEntity && frameworkCallbacks.onEditEntity(entity);
      }}
      onDeleteEntityRequest={frameworkCallbacks.onDeleteEntityRequest || (() => {})}
      onMergeEntity={(payload) => { setMergeOpen(true); frameworkCallbacks.onMergeEntity && frameworkCallbacks.onMergeEntity(payload); }}
      mergeModalOpen={mergeOpen}
      mergeModalSources={multiEntities.length ? multiEntities : (selectedEntity ? [selectedEntity] : [])}
      mergeModalTarget={(multiEntities[0] || selectedEntity)}
      onCancelMerge={() => setMergeOpen(false)}
      onDropEntity={frameworkCallbacks.onDropEntity || (() => {})}
      onDragStartEntity={frameworkCallbacks.onDragStartEntity || (() => {})}
      onOpenRelatedTab={frameworkCallbacks.onOpenRelatedTab || (() => {})}
      onOpenSourceMention={frameworkCallbacks.onOpenSourceMention || (() => {})}
      onOpenEntityReviewQueue={() => { setReviewMode(true); setSelectedId(null); }}
      onAcceptQueueItem={frameworkCallbacks.onAcceptQueueItem || (() => {})}
      onEditQueueItem={frameworkCallbacks.onEditQueueItem || (() => {})}
      onMergeQueueItem={frameworkCallbacks.onMergeQueueItem || (() => {})}
      onDenyQueueItem={frameworkCallbacks.onDenyQueueItem || (() => {})}
      onRunEntitySuggestion={frameworkCallbacks.onRunEntitySuggestion || (() => {})}
      onCompareEntities={frameworkCallbacks.onCompareEntities || (() => {})}
      onExitCompare={() => { setMultiIds([]); setMultiMode(false); }}
      onRetry={() => {}}
    />
  );
};

Object.assign(window, { EntityFrameworkPanelBody, FRAMEWORK_ENTITY_TYPES });
