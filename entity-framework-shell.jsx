// =====================================================================
// entity-framework-shell.jsx — EntityRoster + EntityTabShell.
//
// EntityTabShell is the dispatcher across the 10 universal entity tab
// modes (overview, selected, multi, review, suggestive, empty, loading,
// error, edit, compare). It composes the small components from
// entity-framework.jsx into a coherent layout: roster on the left,
// detail centre, context panel right.
//
// Used by panels.jsx for any panel where entityType is one of the
// supported types and entityType !== "cast" (Cast keeps its bespoke
// panel for now). EntityTabShell never hard-codes per-type fields —
// type-specific detail bodies plug in via the `detailRender` slot.
// =====================================================================

const { useState: _ets_us, useMemo: _ets_um } = React;

// ---------------------------------------------------------------------
// EntityRoster — search + filter + sort + view + group + create + import
// + bulk action bar. Renders EntityRosterCards (list or grid).
// ---------------------------------------------------------------------
const EntityRoster = ({
  entityType,
  entities = [], queueCount = 0,
  selectedId, multiIds = [], multiMode,
  search, filters = [], sortKeys = [], view = "list", groupBy,
  onSearchChange, onFilterChange, onSortChange, onViewChange, onGroupByChange,
  onSelectEntity, onToggleMulti, onEnterMultiMode, onExitMultiMode,
  onCreateEntity, onImportEntity, onOpenEntityReviewQueue,
  onMergeEntity, onDeleteEntityRequest, onCompareEntities,
  onDragStartEntity, onDropEntity,
}) => {
  const t = ENTITY_TYPES[entityType] || {};
  const [activeFilters, setActiveFilters] = _ets_us(new Set());
  const [sortKey, setSortKey] = _ets_us(sortKeys[0] || "name");
  const [filterMenuOpen, setFilterMenuOpen] = _ets_us(false);
  const [sortMenuOpen, setSortMenuOpen] = _ets_us(false);

  const toggleFilter = (k) => {
    const next = new Set(activeFilters);
    next.has(k) ? next.delete(k) : next.add(k);
    setActiveFilters(next);
    onFilterChange && onFilterChange(Array.from(next));
  };

  const isGrid = view === "grid";
  const groups = _ets_um(() => {
    if (!groupBy || groupBy === "none") return [{ key: null, label: null, items: entities }];
    const m = new Map();
    for (const e of entities) {
      const g = e[groupBy] || "—";
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(e);
    }
    return Array.from(m.entries()).map(([k, items]) => ({ key: k, label: k, items }));
  }, [entities, groupBy]);

  return (
    <div className={"ent-roster " + (multiMode ? "is-multi-mode" : "")}
      data-ui="EntityRoster" data-entity={entityType}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
    >
      {/* Toolbar row 1 — search + view */}
      <div className="ent-roster__toolbar">
        <div className="ent-roster__search">
          <Icon name="search" size={12}/>
          <input
            value={search || ""}
            placeholder={"Search " + (t.plural || entityType).toLowerCase() + "…"}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            data-callback="onSearchChange"
            data-testid="ent-search"
          />
          {search && (
            <button className="ent-roster__search__clear"
              onClick={() => onSearchChange && onSearchChange("")}
              aria-label="Clear search"><Icon name="close" size={9}/></button>
          )}
        </div>
        <div className="ent-roster__view">
          <button className={"ent-roster__view__btn" + (view === "list" ? " is-on" : "")}
            onClick={() => onViewChange && onViewChange("list")}
            data-callback="onViewChange" title="List view">
            <Icon name="list" size={11}/>
          </button>
          <button className={"ent-roster__view__btn" + (view === "grid" ? " is-on" : "")}
            onClick={() => onViewChange && onViewChange("grid")}
            data-callback="onViewChange" title="Grid view">
            <Icon name="grid" size={11}/>
          </button>
        </div>
      </div>

      {/* Toolbar row 2 — filters / sort / queue / create / import */}
      <div className="ent-roster__toolbar ent-roster__toolbar--compact">
        <div className="ent-roster__filters">
          <button className={"ent-roster__chip" + (filterMenuOpen ? " is-on" : "")}
            onClick={() => { setFilterMenuOpen((v) => !v); setSortMenuOpen(false); }}
            data-callback="onOpenFilterMenu">
            <Icon name="filter" size={10}/> Filter
            {activeFilters.size > 0 && <span className="ent-roster__chip__count">{activeFilters.size}</span>}
          </button>
          <button className={"ent-roster__chip" + (sortMenuOpen ? " is-on" : "")}
            onClick={() => { setSortMenuOpen((v) => !v); setFilterMenuOpen(false); }}
            data-callback="onOpenSortMenu">
            <Icon name="sort" size={10}/> Sort: {sortKey}
          </button>
          {groupBy !== undefined && (
            <button className="ent-roster__chip"
              onClick={() => onGroupByChange && onGroupByChange(groupBy === "none" ? "status" : "none")}
              data-callback="onGroupByChange">
              <Icon name="stack" size={10}/> {groupBy === "none" ? "Group" : "Ungroup"}
            </button>
          )}
          {queueCount > 0 && (
            <button className="ent-roster__chip ent-roster__chip--queue"
              onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue({ entityType })}
              data-callback="onOpenEntityReviewQueue">
              <Icon name="bell" size={10}/> Review <ReviewCountBadge count={queueCount}/>
            </button>
          )}
        </div>
        <div className="ent-roster__cta">
          <EntityImportButton entityType={entityType} onImportEntity={onImportEntity}/>
          <EntityCreateButton entityType={entityType} onCreateEntity={onCreateEntity}/>
        </div>
      </div>

      {/* Filter dropdown */}
      {filterMenuOpen && (
        <div className="ent-roster__menu" data-ui="EntityRosterFilterMenu">
          {(filters.length ? filters : [
            { key: "status:active", label: "Status: Active" },
            { key: "status:archived", label: "Status: Archived" },
            { key: "queue:hasReview", label: "Has review items" },
            { key: "chapters:current", label: "In current chapter" },
          ]).map((f) => (
            <button key={f.key} className={"ent-roster__menu__row" + (activeFilters.has(f.key) ? " is-on" : "")}
              onClick={() => toggleFilter(f.key)}>
              <span className="ent-roster__menu__check">{activeFilters.has(f.key) ? <Icon name="check" size={10}/> : null}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sort dropdown */}
      {sortMenuOpen && (
        <div className="ent-roster__menu" data-ui="EntityRosterSortMenu">
          {(sortKeys.length ? sortKeys : ["name", "first seen", "mentions", "recently edited"]).map((k) => (
            <button key={k} className={"ent-roster__menu__row" + (sortKey === k ? " is-on" : "")}
              onClick={() => { setSortKey(k); setSortMenuOpen(false); onSortChange && onSortChange(k); }}>
              <span className="ent-roster__menu__check">{sortKey === k ? <Icon name="check" size={10}/> : null}</span>
              <span>{k}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar (multi-select) */}
      {multiMode && (
        <div className="ent-roster__bulk" data-ui="EntityBulkActionBar">
          <span className="ent-roster__bulk__count">{multiIds.length} selected</span>
          <div className="ent-roster__bulk__actions">
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeEntity"
              onClick={() => onMergeEntity && onMergeEntity({ entityType, ids: multiIds })}>Merge</Btn>
            <Btn variant="outline" size="sm" icon="bookmark" data-callback="onCompareEntities"
              onClick={() => onCompareEntities && onCompareEntities({ entityType, ids: multiIds })}>Compare</Btn>
            <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntityRequest"
              onClick={() => onDeleteEntityRequest && onDeleteEntityRequest({ entityType, ids: multiIds })}>Delete</Btn>
            <span style={{ flex:1 }}/>
            <Btn variant="ghost" size="sm" data-callback="onExitMultiMode" onClick={onExitMultiMode}>Done</Btn>
          </div>
        </div>
      )}

      {/* Body */}
      <div className={"ent-roster__body " + (isGrid ? "is-grid" : "is-list")}>
        {groups.map((g) => (
          <div key={g.key || "all"} className="ent-roster__group">
            {g.label && (
              <div className="ent-roster__group__head">
                <span>{g.label}</span><span className="ent-roster__group__count">{g.items.length}</span>
              </div>
            )}
            {isGrid ? (
              <div className="ent-roster__grid">
                {g.items.map((e) => (
                  <EntityRosterCard key={e.id} entity={e} view="grid"
                    isSelected={selectedId === e.id}
                    isMulti={multiIds.includes(e.id)} multiMode={multiMode}
                    onSelectEntity={onSelectEntity} onToggleMulti={onToggleMulti}
                    onEnterMultiMode={onEnterMultiMode}
                    onDragStartEntity={onDragStartEntity} onDropEntity={onDropEntity}
                  />
                ))}
              </div>
            ) : (
              <div className="ent-roster__list">
                {g.items.map((e) => (
                  <EntityRosterCard key={e.id} entity={e} view="list"
                    isSelected={selectedId === e.id}
                    isMulti={multiIds.includes(e.id)} multiMode={multiMode}
                    onSelectEntity={onSelectEntity} onToggleMulti={onToggleMulti}
                    onEnterMultiMode={onEnterMultiMode}
                    onDragStartEntity={onDragStartEntity} onDropEntity={onDropEntity}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityCompareView — side-by-side fields view used by Compare mode
// ---------------------------------------------------------------------
const EntityCompareView = ({ entities = [], onMergeEntity, onSelectEntity, onExitCompare }) => {
  const fields = ["subtitle", "chapterRange", "status", "summary"];
  return (
    <div className="ent-compare" data-ui="EntityCompareView">
      <div className="ent-compare__head">
        <span>Comparing {entities.length} entries</span>
        <Btn variant="ghost" size="sm" data-callback="onExitCompare" onClick={onExitCompare}>Close</Btn>
      </div>
      <div className="ent-compare__grid" style={{ gridTemplateColumns: "120px " + entities.map(() => "1fr").join(" ") }}>
        <div className="ent-compare__cell ent-compare__cell--label">Entry</div>
        {entities.map((e) => (
          <div key={e.id} className="ent-compare__cell ent-compare__cell--head">
            <button className="ent-compare__title" data-callback="onSelectEntity"
              onClick={() => onSelectEntity && onSelectEntity(e)}>{e.name}</button>
          </div>
        ))}
        {fields.map((f) => (
          <React.Fragment key={f}>
            <div className="ent-compare__cell ent-compare__cell--label">{f}</div>
            {entities.map((e) => (
              <div key={e.id + f} className="ent-compare__cell">{e[f] || <span style={{ color:"var(--ink-4)" }}>—</span>}</div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="ent-compare__footer">
        <Btn variant="primary" size="sm" icon="link" data-callback="onMergeEntity"
          onClick={() => onMergeEntity && onMergeEntity({ ids: entities.map((e) => e.id) })}>Merge these</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityTabShell — orchestrates everything per panel
// ---------------------------------------------------------------------
const EntityTabShell = ({
  panel, mode: modeProp,
  entities, selectedEntity, multiEntities = [], compareEntities = [],
  reviewItems = [], suggestions = [],
  detailRender, // (entity) => ReactNode for type-specific detail body
  // Roster state
  search, filters, sortKeys, view = "list", groupBy = "none",
  onSearchChange, onFilterChange, onSortChange, onViewChange, onGroupByChange,
  // Selection
  onSelectEntity, onBackToOverview, onToggleMulti, onEnterMultiMode, onExitMultiMode,
  // CRUD
  onCreateEntity, onImportEntity, onEditEntity, onDeleteEntityRequest, onMergeEntity,
  onDropEntity, onDragStartEntity,
  // Cross-tab + queue
  onOpenRelatedTab, onOpenSourceMention,
  onOpenEntityReviewQueue, onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onRunEntitySuggestion, onCompareEntities, onExitCompare,
  onRetry,
  mergeModalOpen, mergeModalSources = [], mergeModalTarget, onCancelMerge,
}) => {
  const entityType = panel?.entityType || "lore";
  const t = ENTITY_TYPES[entityType] || {};
  const queueCount = (panel?.queueCount ?? reviewItems.length) || 0;

  // Auto-derive mode from props if not provided
  const derivedMode = modeProp
    || (panel?.state === "loading" ? "loading"
      : panel?.state === "error" ? "error"
      : panel?.state === "empty" ? "empty"
      : panel?.state === "review" ? "review"
      : panel?.state === "suggestion" ? "suggestive"
      : panel?.state === "edit" ? "edit"
      : panel?.state === "compare" ? "compare"
      : compareEntities.length >= 2 ? "compare"
      : multiEntities.length > 0 ? "multi"
      : selectedEntity ? "selected"
      : (entities && entities.length === 0) ? "empty"
      : "overview");

  const showRoster = ["overview","selected","multi","review","suggestive","compare"].includes(derivedMode);

  return (
    <div className="ent-shell" data-ui="EntityTabShell" data-mode={derivedMode}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
    >
      {/* LOADING */}
      {derivedMode === "loading" && (
        <div className="ent-shell__center">
          <LoadingState title={"Loading " + (t.plural || "entries").toLowerCase() + "…"} lines={4}/>
        </div>
      )}

      {/* ERROR */}
      {derivedMode === "error" && (
        <div className="ent-shell__center">
          <ErrorState
            title="Couldn't load this tab"
            body="Local index unreachable. Your manuscript and entries are safe — try again in a moment."
            onRetry={onRetry || (() => {})}
          />
        </div>
      )}

      {/* EMPTY (whole tab) */}
      {derivedMode === "empty" && (
        <div className="ent-shell__center">
          <div className="ent-shell__empty" data-ui="EntityTabEmpty">
            <div className="ent-empty__seal" style={{ background: "var(--es)", color: "var(--ed)" }}>
              <Icon name={panel?.icon || "paper"} size={20}/>
            </div>
            <div className="ent-empty__title">{"No " + (t.plural || "entries").toLowerCase() + " yet"}</div>
            <div className="ent-empty__body">
              Add your first {(t.singular || "entry").toLowerCase()} by hand, import from a file,
              or have <strong>{brand.name}</strong> extract from the manuscript.
            </div>
            <div className="ent-empty__actions">
              <EntityCreateButton entityType={entityType} onCreateEntity={onCreateEntity}
                label={"Add " + (t.singular || "entry").toLowerCase()}/>
              <EntityImportButton entityType={entityType} onImportEntity={onImportEntity}/>
              <Btn variant="ghost" size="sm" icon="sparkle" data-callback="onSaveAndExtract">
                Extract from manuscript
              </Btn>
            </div>
            <div className="ent-shell__mobile-note">
              On mobile, this tab opens as a full-screen sheet; bulk-action bar collapses to a bottom card.
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT — roster + body */}
      {showRoster && (
        <div className="ent-shell__main">
          <EntityRoster
            entityType={entityType}
            entities={entities || []}
            queueCount={queueCount}
            selectedId={selectedEntity?.id}
            multiIds={multiEntities.map((e) => e.id)}
            multiMode={multiEntities.length > 0 || derivedMode === "multi"}
            search={search} filters={filters} sortKeys={sortKeys}
            view={view} groupBy={groupBy}
            onSearchChange={onSearchChange} onFilterChange={onFilterChange}
            onSortChange={onSortChange} onViewChange={onViewChange} onGroupByChange={onGroupByChange}
            onSelectEntity={onSelectEntity}
            onToggleMulti={onToggleMulti} onEnterMultiMode={onEnterMultiMode} onExitMultiMode={onExitMultiMode}
            onCreateEntity={onCreateEntity} onImportEntity={onImportEntity}
            onOpenEntityReviewQueue={onOpenEntityReviewQueue}
            onMergeEntity={onMergeEntity}
            onDeleteEntityRequest={onDeleteEntityRequest}
            onCompareEntities={onCompareEntities}
            onDragStartEntity={onDragStartEntity}
            onDropEntity={onDropEntity}
          />

          <div className="ent-shell__body">
            {/* OVERVIEW */}
            {derivedMode === "overview" && (
              <div className="ent-shell__overview" data-ui="EntityTabOverview">
                <div className="ent-shell__overview__head">
                  <div>
                    <div className="ent-shell__overview__eyebrow">{t.plural || "Entries"}</div>
                    <div className="ent-shell__overview__title">{(entities || []).length} entries</div>
                    <div className="ent-shell__overview__sub">
                      Pick one on the left, or drop an entity here to link.
                    </div>
                  </div>
                  {queueCount > 0 && (
                    <button className="ent-shell__queue-card"
                      onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue({ entityType })}
                      data-callback="onOpenEntityReviewQueue">
                      <ReviewCountBadge count={queueCount}/>
                      <span>in review</span>
                    </button>
                  )}
                </div>
                <EntityDropZone onDropEntity={onDropEntity}>
                  Drop a {(t.singular || "entry").toLowerCase()} chip here to link
                </EntityDropZone>
                {suggestions.length > 0 && (
                  <EntityDetailSection title="Suggestions for this tab">
                    {suggestions.slice(0, 3).map((s) => (
                      <div key={s.id} className="ent-shell__sugg">
                        <ConfidenceBadge level={s.level} value={s.value}/>
                        <span style={{ flex:1 }}>{s.lbl}</span>
                        <Btn variant="primary" size="sm" data-callback="onRunEntitySuggestion"
                          onClick={() => onRunEntitySuggestion && onRunEntitySuggestion(s)}>Run</Btn>
                        <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
                      </div>
                    ))}
                  </EntityDetailSection>
                )}
                <div className="ent-shell__partial-note">
                  <Icon name="info" size={11}/>
                  Showing {(entities || []).length} of {(entities || []).length}. Some chapters not yet indexed —
                  re-extract to refresh counts.
                </div>
              </div>
            )}

            {/* SELECTED */}
            {derivedMode === "selected" && selectedEntity && (
              <div className="ent-shell__detail" data-ui="EntityTabSelected">
                <EntityDetailHeader entity={selectedEntity}
                  onBack={onBackToOverview} onEditEntity={onEditEntity}
                  onOpenRelatedTab={onOpenRelatedTab}/>
                <div className="ent-shell__detail__actions">
                  <Btn variant="primary" size="sm" icon="edit" data-callback="onEditEntity"
                    onClick={() => onEditEntity && onEditEntity(selectedEntity)}>Edit</Btn>
                  <Btn variant="outline" size="sm" icon="link" data-callback="onMergeEntity"
                    onClick={() => onMergeEntity && onMergeEntity({ ids: [selectedEntity.id] })}>Merge…</Btn>
                  <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenRelatedTab"
                    onClick={() => onOpenRelatedTab && onOpenRelatedTab({ type: entityType, id: selectedEntity.id })}>
                    Open related tab
                  </Btn>
                  <span style={{ flex:1 }}/>
                  <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntityRequest"
                    onClick={() => onDeleteEntityRequest && onDeleteEntityRequest(selectedEntity)}>Delete</Btn>
                </div>

                {/* Type-specific body OR generic fallback */}
                {detailRender ? detailRender(selectedEntity) : (
                  <>
                    {selectedEntity.summary && (
                      <EntityDetailSection title="Summary">
                        <p style={{ margin:0, fontFamily:"var(--font-serif)", fontSize:"var(--fs-md)", color:"var(--ink-1)", lineHeight:1.6 }}>
                          {selectedEntity.summary}
                        </p>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.fields && selectedEntity.fields.length > 0 && (
                      <EntityDetailSection title="Fields">
                        <div className="ent-fields">
                          {selectedEntity.fields.map((f) => (
                            <React.Fragment key={f.k}>
                              <div className="ent-fields__k">{f.k}</div>
                              <div className="ent-fields__v">{f.v}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.linkedChapters?.length > 0 && (
                      <EntityDetailSection title="Linked chapters">
                        <div className="ent-chip-row">
                          {selectedEntity.linkedChapters.map((c) => (
                            <button key={c.id} className="ent-chip" data-callback="onSelectChapter"
                              onClick={() => onOpenSourceMention && onOpenSourceMention(c)}>
                              <Icon name="paper" size={10}/> {c.label}
                            </button>
                          ))}
                        </div>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.related?.length > 0 && (
                      <EntityDetailSection title="Related entities"
                        action={{ label: "Open related tab →", callback: "onOpenRelatedTab",
                          onClick: () => onOpenRelatedTab && onOpenRelatedTab({ type: entityType, id: selectedEntity.id }) }}>
                        <RelatedEntityStrip related={selectedEntity.related}
                          onSelectEntity={onSelectEntity} onOpenRelatedTab={onOpenRelatedTab}/>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.mentions?.length > 0 && (
                      <EntityDetailSection title="Source mentions"
                        action={{ label: "Show all", callback: "onOpenSourceMention",
                          onClick: () => onOpenSourceMention && onOpenSourceMention({ entityId: selectedEntity.id }) }}>
                        <SourceMentionList mentions={selectedEntity.mentions}
                          onOpenSourceMention={onOpenSourceMention}/>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.notes && (
                      <EntityDetailSection title="Notes">
                        <p style={{ margin:0, fontFamily:"var(--font-serif)", fontStyle:"italic", color:"var(--ink-2)", lineHeight:1.55 }}>
                          {selectedEntity.notes}
                        </p>
                      </EntityDetailSection>
                    )}
                    {selectedEntity.references?.length > 0 && (
                      <EntityDetailSection title="References">
                        <ul className="ent-ref-list">
                          {selectedEntity.references.map((r, i) => (
                            <li key={i}><Icon name="paper" size={10}/> {r}</li>
                          ))}
                        </ul>
                      </EntityDetailSection>
                    )}
                  </>
                )}

                <button className="ent-shell__more"
                  onClick={() => onOpenRelatedTab && onOpenRelatedTab({ type: entityType, id: selectedEntity.id })}
                  data-callback="onOpenRelatedTab">
                  Show more in {(t.plural || "entries")} → <Icon name="caret-right" size={9}/>
                </button>
              </div>
            )}

            {/* MULTI */}
            {derivedMode === "multi" && (
              <div className="ent-shell__multi" data-ui="EntityTabMulti">
                <div className="ent-shell__multi__head">
                  <div className="ent-shell__multi__count">{multiEntities.length} selected</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn variant="primary" size="sm" icon="link" data-callback="onMergeEntity"
                      onClick={() => onMergeEntity && onMergeEntity({ ids: multiEntities.map((e) => e.id) })}>Merge</Btn>
                    <Btn variant="outline" size="sm" data-callback="onCompareEntities"
                      onClick={() => onCompareEntities && onCompareEntities({ ids: multiEntities.map((e) => e.id) })}>Compare</Btn>
                    <Btn variant="outline" size="sm" icon="bookmark" data-callback="onTagEntities">Tag</Btn>
                    <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntityRequest"
                      onClick={() => onDeleteEntityRequest && onDeleteEntityRequest({ ids: multiEntities.map((e) => e.id) })}>Delete</Btn>
                  </div>
                </div>
                <EntityDetailSection title="Selected entries">
                  <div className="ent-shell__multi__list">
                    {multiEntities.map((e) => (
                      <EntityRosterCard key={e.id} entity={e} view="list"
                        isSelected isMulti multiMode
                        onSelectEntity={onSelectEntity} onToggleMulti={onToggleMulti}/>
                    ))}
                  </div>
                </EntityDetailSection>
                <EntityDetailSection title="Combined source mentions">
                  <SourceMentionList
                    mentions={multiEntities.flatMap((e) => e.mentions || []).slice(0, 4)}
                    onOpenSourceMention={onOpenSourceMention}/>
                </EntityDetailSection>
              </div>
            )}

            {/* COMPARE */}
            {derivedMode === "compare" && (
              <EntityCompareView entities={compareEntities.length ? compareEntities : multiEntities}
                onMergeEntity={onMergeEntity} onSelectEntity={onSelectEntity}
                onExitCompare={onExitCompare}/>
            )}

            {/* REVIEW */}
            {derivedMode === "review" && (
              <div className="ent-shell__review" data-ui="EntityTabReview">
                <div className="ent-shell__review__head">
                  <div>
                    <div className="ent-shell__overview__eyebrow">Review queue</div>
                    <div className="ent-shell__overview__title">{reviewItems.length} pending</div>
                  </div>
                  <Btn variant="ghost" size="sm" data-callback="onBackToOverview" onClick={onBackToOverview}>Back</Btn>
                </div>
                <EntityTabReviewQueue items={reviewItems} entityType={entityType}
                  onAcceptQueueItem={onAcceptQueueItem}
                  onEditQueueItem={onEditQueueItem}
                  onMergeQueueItem={onMergeQueueItem}
                  onDenyQueueItem={onDenyQueueItem}/>
              </div>
            )}

            {/* SUGGESTIVE */}
            {derivedMode === "suggestive" && (
              <div className="ent-shell__sugg-mode" data-ui="EntityTabSuggestive">
                <div className="ent-shell__overview__eyebrow">Suggested for {t.plural?.toLowerCase()}</div>
                <div className="ent-shell__overview__title">{suggestions.length} ideas</div>
                <div className="ent-shell__sugg-list">
                  {suggestions.map((s) => (
                    <div key={s.id} className="ent-shell__sugg-card">
                      <div className="ent-shell__sugg-card__head">
                        <ConfidenceBadge level={s.level} value={s.value}/>
                        <span style={{ flex:1, fontSize:"var(--fs-sm)", color:"var(--ink-1)" }}>{s.lbl}</span>
                      </div>
                      {s.excerpt && <div className="ent-shell__sugg-card__ex">"{s.excerpt}"</div>}
                      <div className="ent-shell__sugg-card__actions">
                        <Btn variant="primary" size="sm" data-callback="onRunEntitySuggestion"
                          onClick={() => onRunEntitySuggestion && onRunEntitySuggestion(s)}>Run</Btn>
                        <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit first…</Btn>
                        <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EDIT */}
            {derivedMode === "edit" && selectedEntity && (
              <div className="ent-shell__edit" data-ui="EntityTabEdit">
                <button className="ent-detail__back" onClick={onBackToOverview} data-callback="onCancelEdit">
                  <Icon name="close" size={9}/> Cancel edit
                </button>
                <div className="ent-shell__overview__title">Edit {selectedEntity.name || (t.singular?.toLowerCase())}</div>
                <div className="ent-fields-form">
                  {(selectedEntity.editFields || [
                    { k: "Name", v: selectedEntity.name },
                    { k: "Aliases", v: (selectedEntity.aliases || []).join(", ") },
                    { k: "Subtitle", v: selectedEntity.subtitle },
                    { k: "Status", v: selectedEntity.status },
                    { k: "Summary", v: selectedEntity.summary, multi: true },
                    { k: "Notes", v: selectedEntity.notes, multi: true },
                  ]).map((f) => (
                    <label key={f.k}>
                      <span>{f.k}</span>
                      {f.multi
                        ? <textarea defaultValue={f.v || ""} rows={3}/>
                        : <input defaultValue={f.v || ""}/>}
                    </label>
                  ))}
                </div>
                <div className="ent-shell__edit__actions">
                  <Btn variant="primary" size="sm" data-callback="onSave"
                    onClick={() => onEditEntity && onEditEntity({ id: selectedEntity.id, save: true })}>Save</Btn>
                  <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract</Btn>
                  <Btn variant="outline" size="sm" icon="bolt" data-callback="onSaveAndDeepExtract">Save + Deep Extract</Btn>
                  <span style={{ flex:1 }}/>
                  <Btn variant="ghost" size="sm" data-callback="onCancelEdit" onClick={onBackToOverview}>Cancel</Btn>
                </div>
              </div>
            )}
          </div>

          {/* CONTEXT PANEL — only when there's a selection or queue */}
          {(selectedEntity || reviewItems.length > 0 || suggestions.length > 0) && derivedMode !== "compare" && (
            <EntityContextPanel
              entity={selectedEntity}
              reviewItems={reviewItems}
              suggestions={suggestions}
              related={selectedEntity?.related || []}
              warnings={selectedEntity?.warnings || []}
              recent={selectedEntity?.recent || []}
              mentions={selectedEntity?.mentions || []}
              onAcceptQueueItem={onAcceptQueueItem}
              onEditQueueItem={onEditQueueItem}
              onMergeQueueItem={onMergeQueueItem}
              onDenyQueueItem={onDenyQueueItem}
              onSelectEntity={onSelectEntity}
              onOpenRelatedTab={onOpenRelatedTab}
              onOpenSourceMention={onOpenSourceMention}
              onOpenEntityReviewQueue={onOpenEntityReviewQueue}
              onRunEntitySuggestion={onRunEntitySuggestion}
            />
          )}
        </div>
      )}

      <EntityMergeModal
        open={!!mergeModalOpen}
        sources={mergeModalSources}
        target={mergeModalTarget}
        onCancel={onCancelMerge}
        onMergeEntity={onMergeEntity}
      />
    </div>
  );
};

Object.assign(window, { EntityRoster, EntityTabShell, EntityCompareView });
