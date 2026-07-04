// =====================================================================
// entity-framework-host.jsx
// EntityFrameworkPanelBody — wrapper that holds the local panel-side
// state (search/view/multi/edit/review/merge) and renders EntityTabShell.
// Designed to be dropped into the DockedPanel body the same way
// CastPanelBody is — siblings of the PanelHeader/toolbar/body markup.
// =====================================================================

const { useState: _useState_efh, useMemo: _useMemo_efh } = React;

const FRAMEWORK_ENTITY_TYPES = new Set([
  "bestiary","locations","items","classes","races","stats","abilities",
  "skills","quests","events","factions","lore","relationships",
  "timeline","references"
]);

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

  const entities    = panel.entities    || (window.__LW_SAMPLE_LOADED__ ? window.ENTITY_SAMPLES?.[entityType] : null) || [];
  const reviewItems = panel.reviewItems || [];
  const suggestions = panel.suggestions || [];
  const queueCount  = panel.queueCount ?? reviewItems.length;

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
    return entities.filter((e) =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.subtitle || "").toLowerCase().includes(q));
  }, [entities, search]);

  const selectedEntity = entities.find((e) => e.id === selectedId);
  const multiEntities  = entities.filter((e) => multiIds.includes(e.id));

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
        onSelectEntity: (e) => {
          setSelectedId(e.id);
          onSelectEntity && onSelectEntity(e);
          frameworkCallbacks.onOpenRelatedTab && frameworkCallbacks.onOpenRelatedTab(e);
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
      onSelectEntity={(e) => { setSelectedId(e.id); setEditing(false); setReviewMode(false); onSelectEntity && onSelectEntity(e); }}
      onBackToOverview={() => { setSelectedId(null); setEditing(false); setReviewMode(false); }}
      onToggleMulti={(e) => setMultiIds((ids) => ids.includes(e.id) ? ids.filter((x) => x !== e.id) : ids.concat(e.id))}
      onEnterMultiMode={() => setMultiMode(true)}
      onExitMultiMode={() => { setMultiMode(false); setMultiIds([]); }}
      onCreateEntity={frameworkCallbacks.onCreateEntity || (() => {})}
      onImportEntity={frameworkCallbacks.onImportEntity || (() => {})}
      onEditEntity={(e) => {
        if (e?.save) { setEditing(false); }
        else { setEditing(true); if (e?.id) setSelectedId(e.id); }
        frameworkCallbacks.onEditEntity && frameworkCallbacks.onEditEntity(e);
      }}
      onDeleteEntityRequest={frameworkCallbacks.onDeleteEntityRequest || (() => {})}
      onMergeEntity={(p) => { setMergeOpen(true); frameworkCallbacks.onMergeEntity && frameworkCallbacks.onMergeEntity(p); }}
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
