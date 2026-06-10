// =====================================================================
// panels.jsx — SlidingPanel + PanelHeader + panel state demos
// =====================================================================

const { useState: _useState_p, useMemo: _useMemo_p } = React;

// ---------------------------------------------------------------------
// PanelHeader
// ---------------------------------------------------------------------
const PanelHeader = ({
  entityType, icon = "stack",
  title, subtitle,
  pinned, expanded,
  onPinPanel, onExpandPanel, onClosePanel, onMore,
}) => {
  const t = entityType ? ENTITY_TYPES[entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};
  return (
    <div className="panel__head" data-ui="PanelHeader" style={style}>
      <div className="panel__head__entity">
        <div className="panel__head__entity-icon">
          {t ? <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>{t.glyph}</span> : <Icon name={icon} size={14}/>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="panel__head__title">{title}</div>
          {subtitle && <div className="panel__head__sub">{subtitle}</div>}
        </div>
      </div>
      <div className="panel__head__actions">
        <Btn variant="ghost" size="sm" icon="pin-tack" aria-pressed={pinned}
          className={pinned ? "is-active" : ""}
          onClick={onPinPanel} data-callback="onPinPanel" title="Pin panel"/>
        <Btn variant="ghost" size="sm" icon="expand" aria-pressed={expanded}
          className={expanded ? "is-active" : ""}
          onClick={onExpandPanel} data-callback="onExpandPanel" title="Expand"/>
        <Btn variant="ghost" size="sm" icon="more" onClick={onMore} data-callback="onMorePanel" title="More"/>
        <Btn variant="ghost" size="sm" icon="close" onClick={onClosePanel} data-callback="onClosePanel" title="Close"/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SlidingPanel — dispatcher. For supported entity types (everything
// except "cast", which has its own bespoke panel), defers to
// EntityTabShell from the shared entity framework.
// ---------------------------------------------------------------------
const FRAMEWORK_TYPES = new Set(["bestiary","locations","items","classes","races","stats","abilities","skills","quests","events","factions","lore","relationships","timeline","references"]);

const SlidingPanel = ({
  panel, onClosePanel, onPinPanel, onExpandPanel, onOpenReviewQueue, onSelectEntity,
  ...frameworkCallbacks
}) => {
  const { id, entityType, title, subtitle, state = "overview", pinned, expanded } = panel;
  const useAtlas = entityType === "atlas";
  const useFramework = !useAtlas && entityType && FRAMEWORK_TYPES.has(entityType);

  // ---- Framework-mode local state (search/view/multi/edit) ----
  const [search, setSearch]   = _useState_p("");
  const [view, setView]       = _useState_p("list");
  const [groupBy, setGroupBy] = _useState_p("none");
  const [selectedId, setSelectedId] = _useState_p(null);
  const [multiIds, setMultiIds]     = _useState_p([]);
  const [multiMode, setMultiMode]   = _useState_p(false);
  const [editing, setEditing]       = _useState_p(false);
  const [reviewMode, setReviewMode] = _useState_p(false);
  const [mergeOpen, setMergeOpen]   = _useState_p(false);

  const entities = useFramework ? (panel.entities || (window.ENTITY_SAMPLES?.[entityType]) || []) : [];
  const reviewItems = useFramework ? (panel.reviewItems || []) : [];
  const suggestions = useFramework ? (panel.suggestions || []) : [];
  const queueCount = panel.queueCount ?? reviewItems.length;

  const filtered = _useMemo_p(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter((e) =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.subtitle || "").toLowerCase().includes(q));
  }, [entities, search]);

  const selectedEntity = useFramework ? entities.find((e) => e.id === selectedId) : null;
  const multiEntities = useFramework ? entities.filter((e) => multiIds.includes(e.id)) : [];

  // Allow panel.state to force a mode for demos (loading/error/empty/review/etc)
  const modeOverride = useFramework
    ? (state === "loading" ? "loading"
      : state === "error" ? "error"
      : state === "empty" ? "empty"
      : state === "review" ? "review"
      : state === "suggestion" ? "suggestive"
      : state === "edit" ? "edit"
      : state === "compare" ? "compare"
      : reviewMode ? "review"
      : editing && selectedEntity ? "edit"
      : multiMode && multiIds.length > 0 ? "multi"
      : selectedEntity ? "selected"
      : (filtered.length === 0 && !search) ? "overview"
      : "overview")
    : null;

  return (
    <section
      className={"panel " + (expanded ? "is-expanded" : "")}
      data-ui="SlidingPanel"
      data-panel-id={id}
      data-state={state}
      role="dialog"
      aria-label={title}
    >
      <PanelHeader
        entityType={entityType}
        icon={panel.icon}
        title={title}
        subtitle={subtitle}
        pinned={pinned}
        expanded={expanded}
        onPinPanel={() => onPinPanel(id)}
        onExpandPanel={() => onExpandPanel(id)}
        onClosePanel={() => onClosePanel(id)}
      />

      <div className="panel__body">
        {useAtlas ? (
          <AtlasPanelBody panel={panel}/>
        ) : entityType === "skills" && typeof SkillsPanelBody !== "undefined" ? (
          <SkillsPanelBody panel={panel}/>
        ) : entityType === "relationships" && typeof RelationshipsPanelBody !== "undefined" ? (
          <RelationshipsPanelBody panel={panel}/>
        ) : entityType === "timeline" && typeof TimelinePanelBody !== "undefined" ? (
          <TimelinePanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "lore" && typeof LorePanelBody !== "undefined" ? (
          <LorePanelBody panel={panel}/>
        ) : entityType === "references" && typeof ReferencesPanelBody !== "undefined" ? (
          <ReferencesPanelBody panel={panel}/>
        ) : entityType === "locations" && typeof LocationsPanelBody !== "undefined" ? (
          <LocationsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "quests" && typeof QuestsPanelBody !== "undefined" ? (
          <QuestsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "events" && typeof EventsPanelBody !== "undefined" ? (
          <EventsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "bestiary" && typeof BestiaryPanelBody !== "undefined" ? (
          <BestiaryPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "factions" && typeof FactionsPanelBody !== "undefined" ? (
          <FactionsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "stats" && typeof StatsPanelBody !== "undefined" ? (
          <StatsPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "classes" && typeof ClassesPanelBody !== "undefined" ? (
          <ClassesPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "races" && typeof RacesPanelBody !== "undefined" ? (
          <RacesPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : entityType === "abilities" && typeof AbilitiesPanelBody !== "undefined" ? (
          <AbilitiesPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.id === "p-tangle" && typeof TanglePanelBody !== "undefined" ? (
          <TanglePanelBody panel={panel}/>
        ) : panel.id === "p-today" && typeof TodayPanelBody !== "undefined" ? (
          <TodayPanelBody panel={panel} onSelectEntity={onSelectEntity}/>
        ) : panel.id === "p-trash" && typeof TrashPanelBody !== "undefined" ? (
          <TrashPanelBody panel={panel}/>
        ) : panel.id === "p-aiWriter" && typeof AiWriterPanelBody !== "undefined" ? (
          <AiWriterPanelBody panel={panel}/>
        ) : useFramework ? (
          <EntityTabShell
            panel={{ ...panel, queueCount }}
            mode={modeOverride}
            entities={filtered}
            selectedEntity={selectedEntity}
            multiEntities={multiEntities}
            reviewItems={reviewItems}
            suggestions={suggestions}
            filters={(window.RPG_FILTERS || {})[entityType] || []}
            detailRender={(window.RPG_DETAIL_RENDERERS || {})[entityType]
              ? (entity) => (window.RPG_DETAIL_RENDERERS)[entityType](entity, {
                  onSelectEntity: (e) => { setSelectedId(e.id); onSelectEntity && onSelectEntity(e); },
                  onOpenRelatedTab: frameworkCallbacks.onOpenRelatedTab,
                  onOpenSourceMention: frameworkCallbacks.onOpenSourceMention,
                })
              : undefined}
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
            onEditEntity={(e) => { if (e?.save) { setEditing(false); } else { setEditing(true); if (e?.id) setSelectedId(e.id); } frameworkCallbacks.onEditEntity && frameworkCallbacks.onEditEntity(e); }}
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
        ) : (
          <>
            <div className="panel__toolbar">
              <div className="panel__search">
                <Icon name="search" size={12}/>
                <span style={{ flex: 1 }}>Search in {title.toLowerCase()}…</span>
              </div>
              <Btn variant="ghost" size="sm" icon="filter" title="Filter" data-callback="onFilterPanel"/>
              <Btn variant="ghost" size="sm" icon="sort" title="Sort" data-callback="onSortPanel"/>
              <Btn variant="ghost" size="sm" icon="bell" title="Review queue"
                onClick={onOpenReviewQueue} data-callback="onOpenReviewQueue"/>
            </div>
            {state === "overview"   && <PanelOverview panel={panel} onSelectEntity={onSelectEntity}/>}
            {state === "selected"   && <PanelSelected panel={panel}/>}
            {state === "multi"      && <PanelMulti panel={panel}/>}
            {state === "empty"      && <EmptyState icon={panel.icon || "paper"} title={"No " + title.toLowerCase() + " yet"} body="Create your first entry, or extract from the manuscript." action={<Btn variant="primary" size="sm" icon="plus" data-callback="onCreateEntity">Create</Btn>}/>}
            {state === "loading"    && <LoadingState title={"Loading " + title.toLowerCase() + "…"} lines={4}/>}
            {state === "error"      && <ErrorState title="Couldn't load panel" body="Local index unreachable. Your data is safe." onRetry={() => {}}/>}
            {state === "review"     && <PanelReview panel={panel}/>}
            {state === "edit"       && <PanelEdit panel={panel}/>}
            {state === "suggestion" && <PanelSuggestion panel={panel}/>}
          </>
        )}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// Panel state contents (presentational placeholders)
// ---------------------------------------------------------------------
const PanelOverview = ({ panel, onSelectEntity }) => {
  const rows = panel.rows || [];
  if (!rows.length) return <EmptyState icon={panel.icon} title="Empty" body="Create or extract entries to populate this panel."/>;
  return (
    <div className="panel__list">
      {rows.map((r) => (
        <div
          key={r.id}
          className={"panel__list-row " + (r.selected ? "is-selected" : "")}
          data-callback="onSelectEntity"
          onClick={() => onSelectEntity && onSelectEntity(r)}
        >
          {panel.entityType && <EntityTypeBadge type={panel.entityType} size="xs" showLabel={false}/>}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          {r.queue && <ReviewCountBadge count={r.queue}/>}
          <span className="panel__list-row__sub">{r.meta}</span>
        </div>
      ))}
    </div>
  );
};

const PanelSelected = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", color: "var(--ink-1)" }}>{panel.selected?.label || "Aelinor Vey"}</div>
    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)" }}>"…the small dark queen of the Pale Reach."</div>
    <div className="hr"/>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <EntityTypeBadge type={panel.entityType || "cast"} size="xs"/>
      <span className="chip chip--neutral">12 mentions</span>
      <span className="chip chip--neutral">Ch. 1–7</span>
    </div>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
      Detail body placeholder — fields, relationships, mentions list, and timeline plug in here.
    </div>
  </div>
);

const PanelMulti = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>3 entities selected</div>
    <div className="hr"/>
    <div className="panel__list">
      {["Aelinor Vey", "Saren of Hess", "Captain Brec"].map((n) => (
        <div key={n} className="panel__list-row is-selected">
          <EntityTypeBadge type="cast" size="xs" showLabel={false}/>
          <span style={{ flex: 1 }}>{n}</span>
          <Icon name="check" size={12}/>
        </div>
      ))}
    </div>
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <Btn variant="outline" size="sm" icon="link" data-callback="onMergeEntity">Merge</Btn>
      <Btn variant="outline" size="sm" icon="bookmark" data-callback="onTagEntities">Tag</Btn>
      <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteEntities">Delete</Btn>
    </div>
  </div>
);

const PanelReview = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {[
      { lvl: "high",      v: 96, lbl: "Auto-added: Captain Brec (Cast)" },
      { lvl: "strong",    v: 84, lbl: "Suggest: Pale Reach (Location)" },
      { lvl: "uncertain", v: 61, lbl: "Merge: Saren ↔ Saren of Hess?" },
      { lvl: "weak",      v: 38, lbl: "New item: Bone Auger?" },
    ].map((r, i) => (
      <div key={i} className="rightrail__card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConfidenceBadge level={r.lvl} value={r.v}/>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>{r.lbl}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
          <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
          <Btn variant="outline" size="sm" data-callback="onMergeQueueItem">Merge</Btn>
          <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Deny</Btn>
        </div>
      </div>
    ))}
  </div>
);

const PanelEdit = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {[
      ["Name", "Aelinor Vey"],
      ["Title", "Queen of the Pale Reach"],
      ["First seen", "Ch. 1, p. 12"],
      ["Affiliation", "House Vey"],
    ].map(([k, v]) => (
      <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", fontWeight: 600 }}>{k}</span>
        <input defaultValue={v} style={{
          padding: "8px 10px",
          background: "var(--bg-paper)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-2)",
          fontFamily: "var(--font-serif)",
          fontSize: "var(--fs-md)",
          color: "var(--ink-1)",
        }}/>
      </label>
    ))}
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <Btn variant="primary" size="sm" data-callback="onSave">Save</Btn>
      <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract</Btn>
      <Btn variant="ghost" size="sm" data-callback="onCancelEdit">Cancel</Btn>
    </div>
  </div>
);

const PanelSuggestion = ({ panel }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>Suggested from this chapter:</div>
    {[
      { type: "cast",      lvl: "strong",    v: 81, lbl: "Saren of Hess" },
      { type: "locations", lvl: "uncertain", v: 58, lbl: "The Glass Court" },
      { type: "items",     lvl: "weak",      v: 31, lbl: "Auger of Hess" },
    ].map((s, i) => (
      <div key={i} className="rightrail__card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <EntityTypeBadge type={s.type} size="xs"/>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>{s.lbl}</span>
          <ConfidenceBadge level={s.lvl} value={s.v}/>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem">Accept</Btn>
          <Btn variant="outline" size="sm" data-callback="onEditQueueItem">Edit</Btn>
          <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Deny</Btn>
        </div>
      </div>
    ))}
  </div>
);

Object.assign(window, { SlidingPanel, PanelHeader });
