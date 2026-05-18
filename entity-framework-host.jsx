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

  const entities    = panel.entities    || (window.ENTITY_SAMPLES?.[entityType])            || [];
  const reviewItems = panel.reviewItems || (window.ENTITY_REVIEW_SAMPLES?.[entityType])     || [];
  const suggestions = panel.suggestions || (window.ENTITY_SUGGESTION_SAMPLES?.[entityType]) || [];
  const queueCount  = panel.queueCount ?? reviewItems.length;

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
