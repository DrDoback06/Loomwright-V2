// =====================================================================
// entity-framework.jsx — Shared Entity Tab Framework.
//
// Plugged into DockedPanel for any entityType !== "cast". Provides:
//   - EntityTabShell      — top-level dispatcher across all 10 modes
//   - EntityRoster        — list/grid with search, filter, sort, view, group
//   - EntityRosterCard    — single roster row (list) and grid card
//   - EntityDetailHeader  — hero with portrait, name, aliases, badges
//   - EntityDetailSection — labelled block with action slot
//   - EntityContextPanel  — right-side rail (review, suggestions, etc.)
//   - RelatedEntityStrip  — pill row of related entities (cross-type)
//   - SourceMentionList   — bordered quote list with cite line
//   - EntityCreateButton  — primary "+ Add" CTA
//   - EntityImportButton  — outline import CTA
//   - EntityMergeModal    — destructive merge confirmation modal
//   - EntityDragChip      — drag-preview pill for dragging an entity
//   - EntityDropZone      — drop target with hover visuals
//   - EntityTabReviewQueue— in-tab queue list
//
// All callbacks named per the global protocol — see hook-up notes md.
// =====================================================================

const { useState: _ef_us, useMemo: _ef_um, useCallback: _ef_uc, useEffect: _ef_ue, useRef: _ef_ur } = React;

// ---------------------------------------------------------------------
// Status label map — used by the roster card subline and tooltips.
// ---------------------------------------------------------------------
const ENTITY_STATUS_LABEL = {
  active:    "Active",
  archived:  "Archived",
  alive:     "Alive",
  dead:      "Dead",
  missing:   "Missing",
  unknown:   "Unknown",
  lost:      "Lost",
  destroyed: "Destroyed",
  traded:    "Traded",
  draft:     "Draft",
};
window.ENTITY_STATUS_LABEL = ENTITY_STATUS_LABEL;

// ---------------------------------------------------------------------
// EntitySpark — tiny mention sparkline
// ---------------------------------------------------------------------
const EntitySpark = ({ data }) => {
  const safe = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...safe);
  return (
    <div className="ent-row__spark" aria-hidden>
      {safe.map((v, i) => (
        <div key={i} className="ent-row__spark__bar"
          style={{ height: Math.max(2, (v / max) * 14) + "px", opacity: v === 0 ? 0.25 : 1 }}/>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityRosterCard — single row (list view) OR grid card
// ---------------------------------------------------------------------
const EntityRosterCard = ({
  entity, view = "list",
  isSelected, isMulti, multiMode, dragSource,
  onSelectEntity, onToggleMulti, onEnterMultiMode, onDragStartEntity, onDropEntity,
}) => {
  const initials = entity.glyphChar || (entity.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
  const status = entity.status || "active";
  const onClick = (e) => {
    if (multiMode) { onToggleMulti && onToggleMulti(entity); return; }
    if (e.metaKey || e.ctrlKey) {
      if (onEnterMultiMode) onEnterMultiMode();
      onToggleMulti && onToggleMulti(entity);
      return;
    }
    onSelectEntity && onSelectEntity(entity);
  };
  const onDragStart = (e) => {
    const legacy = { id: entity.id, name: entity.name, type: entity.type };
    const modern = {
      entityType: entity.type,
      id: entity.id,
      name: entity.name,
      summary: entity.summary || entity.subtitle,
    };
    try {
      e.dataTransfer.setData("text/loomwright-entity", JSON.stringify(legacy));
      e.dataTransfer.setData("application/x-loom-entity", JSON.stringify(modern));
      e.dataTransfer.setData("text/plain", entity.name || "");
    } catch (_err) { /* */ }
    e.dataTransfer.effectAllowed = "copyMove";
    e.currentTarget.classList.add("is-dragging");
    // Broadcast through the global drag pub-sub so CSS edge-pulse lights up
    if (window.ENTITY_DRAG) {
      window.ENTITY_DRAG.set({ active: true, payload: modern });
    }
    onDragStartEntity && onDragStartEntity(entity);
  };
  const onDragEnd = (e) => {
    e.currentTarget.classList.remove("is-dragging");
    if (window.ENTITY_DRAG) {
      window.ENTITY_DRAG.set({ active: false, payload: null });
    }
  };

  if (view === "grid") {
    return (
      <div
        className={"ent-card" + (isSelected ? " is-selected" : "")}
        data-ui="EntityRosterCard"
        data-callback="onSelectEntity"
        data-testid={"ent-card-" + entity.id}
        data-entity-id={entity.id}
        onClick={onClick}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="ent-card__monogram">{initials}</div>
        <div className="ent-card__name">{entity.name}</div>
        {entity.subtitle && <div className="ent-card__sub">{entity.subtitle}</div>}
        {entity.queue ? <span className="ent-card__queue"><ReviewCountBadge count={entity.queue}/></span> : null}
        {entity.status && entity.status !== "active" && typeof EntityStatusPill !== "undefined" && (
          <div style={{ marginTop: 4 }}><EntityStatusPill status={entity.status}/></div>
        )}
      </div>
    );
  }

  return (
    <div
      className={"ent-row" + (isSelected ? " is-selected" : "") + (isMulti ? " is-multi" : "") + (dragSource ? " is-drag-source" : "")}
      data-ui="EntityRosterCard"
      data-callback="onSelectEntity"
      data-testid={"ent-row-" + entity.id}
      data-entity-id={entity.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="ent-row__check" aria-hidden>{isMulti && <Icon name="check" size={10}/>}</div>
      <div className={"ent-row__monogram" + (status === "unknown" ? " ent-row__monogram--unknown" : "")}>
        {initials}
        <span className={"ent-row__monogram__status ent-row__monogram__status--" + status}/>
      </div>
      <div className="ent-row__identity">
        <span className="ent-row__name">{entity.name}</span>
        <span className="ent-row__status">{ENTITY_STATUS_LABEL[status] || status}</span>
        {entity.dormant && typeof EntityStatusPill !== "undefined" && (
          <EntityStatusPill status="dormant"/>
        )}
      </div>
      <div className="ent-row__subline">{entity.subtitle || entity.summary}</div>
      <div className="ent-row__meta">
        <span className="ent-row__chapters">{entity.chapterRange}</span>
        <EntitySpark data={entity.mentionsByChapter}/>
        <div className="ent-row__badges">
          {entity.queue ? <ReviewCountBadge count={entity.queue}/> : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityCreateButton / EntityImportButton — small wrappers for testability
// ---------------------------------------------------------------------
const EntityCreateButton = ({ entityType, onCreateEntity, label = "Add" }) => (
  <Btn variant="primary" size="sm" icon="plus"
    onClick={() => onCreateEntity && onCreateEntity({ entityType })}
    data-callback="onCreateEntity" data-testid="ent-create" data-entity={entityType}
  >{label}</Btn>
);
const EntityImportButton = ({ entityType, onImportEntity }) => (
  <Btn variant="outline" size="sm" icon="paper"
    onClick={() => onImportEntity && onImportEntity({ entityType })}
    data-callback="onImportEntity" data-testid="ent-import" data-entity={entityType}
  >Import</Btn>
);

// ---------------------------------------------------------------------
// EntityDragChip — visible affordance for dragging an entity
// ---------------------------------------------------------------------
const EntityDragChip = ({ entity, onDragStartEntity }) => {
  const initials = entity.glyphChar || (entity.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="ent-drag-chip" draggable data-ui="EntityDragChip"
      onDragStart={(e) => {
        e.dataTransfer.setData("text/loomwright-entity",
          JSON.stringify({ id: entity.id, name: entity.name, type: entity.type }));
        onDragStartEntity && onDragStartEntity(entity);
      }}>
      <span className="ent-drag-chip__avatar">{initials}</span>
      <span>{entity.name}</span>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityDropZone — accepts dragged entities
// ---------------------------------------------------------------------
const EntityDropZone = ({ children = "Drop entity here", onDropEntity, accept }) => {
  const [over, setOver] = _ef_us(false);
  return (
    <div
      className={"ent-drop" + (over ? " is-over" : "")}
      data-ui="EntityDropZone"
      data-callback="onDropEntity"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const raw = e.dataTransfer.getData("text/loomwright-entity");
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (accept && !accept.includes(data.type)) return;
          onDropEntity && onDropEntity(data);
        } catch (_) {}
      }}
    >{children}</div>
  );
};

// ---------------------------------------------------------------------
// SourceMentionList
// ---------------------------------------------------------------------
const SourceMentionList = ({ mentions = [], onOpenSourceMention }) => (
  <div className="ent-mention-list" data-ui="SourceMentionList">
    {mentions.map((m) => (
      <div key={m.id} className="ent-mention"
        data-callback="onOpenSourceMention"
        onClick={() => onOpenSourceMention && onOpenSourceMention(m)}>
        "{m.excerpt}"
        <span className="ent-mention__cite">{m.cite}</span>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// RelatedEntityStrip
// ---------------------------------------------------------------------
const RelatedEntityStrip = ({ related = [], onSelectEntity, onOpenRelatedTab }) => (
  <div className="ent-related-strip" data-ui="RelatedEntityStrip">
    {related.map((r) => {
      const t = ENTITY_TYPES[r.type];
      const initials = r.initials || (r.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
      const style = t ? { "--rt-color": t.color, "--rt-soft": t.soft, "--rt-deep": t.deep } : {};
      return (
        <button key={r.id + "-" + r.type} className="ent-related"
          style={style}
          data-callback="onSelectEntity"
          onClick={(e) => {
            if (e.shiftKey && onOpenRelatedTab) { onOpenRelatedTab(r); return; }
            onSelectEntity && onSelectEntity(r);
          }}>
          <span className="ent-related__avatar">{initials}</span>
          <span className="ent-related__name">{r.name}</span>
          {r.kind && <span className="ent-related__kind">{r.kind}</span>}
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------
// EntityDetailSection — generic labelled block
// ---------------------------------------------------------------------
const EntityDetailSection = ({ title, action, actionCallback = "onEntitySectionAction", children }) => (
  <div className="ent-section" data-ui="EntityDetailSection" data-section-title={title}>
    <div className="ent-section__head">
      <span className="ent-section__title">{title}</span>
      {action && (
        <button className="ent-section__action"
          onClick={action.onClick}
          data-callback={action.callback || actionCallback}>
          {action.label}
        </button>
      )}
    </div>
    <div className="ent-section__body">{children}</div>
  </div>
);

// ---------------------------------------------------------------------
// EntityDetailHeader
// ---------------------------------------------------------------------
const EntityDetailHeader = ({ entity, onBack, onEditEntity, onOpenRelatedTab }) => {
  const initials = entity.glyphChar || (entity.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase();
  const totalMentions = (entity.mentionsByChapter || []).reduce((a,b) => a + b, 0);
  return (
    <>
      <button className="ent-detail__back" onClick={onBack} data-callback="onBackToOverview">
        <Icon name="close" size={9}/> Back to all {ENTITY_TYPES[entity.type]?.plural?.toLowerCase() || "entries"}
      </button>
      <div className="ent-detail__hero" data-ui="EntityDetailHeader">
        <div className="ent-detail__portrait">{initials}</div>
        <div className="ent-detail__hero__body">
          <div className="ent-detail__name">{entity.name}</div>
          {entity.aliases && entity.aliases.length > 0 && (
            <div className="ent-detail__aliases">also: {entity.aliases.join(" · ")}</div>
          )}
          {entity.subtitle && <div className="ent-detail__sub">{entity.subtitle}</div>}
          <div className="ent-detail__meta-row">
            <EntityTypeBadge type={entity.type} size="xs"/>
            {entity.chapterRange && <span className="chip chip--neutral">{entity.chapterRange}</span>}
            {totalMentions > 0 && <span className="chip chip--neutral">{totalMentions} mentions</span>}
            {entity.queue ? <ReviewCountBadge count={entity.queue}/> : null}
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------
// EntityContextPanel — right-rail style block (reused inside the panel
// body for the moment; in expanded mode it can sit beside detail)
// ---------------------------------------------------------------------
const EntityContextPanel = ({
  entity,
  reviewItems = [], suggestions = [], related = [],
  warnings = [], recent = [], mentions = [],
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onSelectEntity, onOpenRelatedTab, onOpenSourceMention, onOpenEntityReviewQueue,
  onRunEntitySuggestion,
}) => (
  <aside className="ent-ctx" data-ui="EntityContextPanel">
    {warnings.length > 0 && (
      <div>
        <div className="ent-ctx__title">Warnings</div>
        {warnings.map((w, i) => (
          <div key={i} className="ent-ctx__warn">
            <Icon name="warn" size={12}/><span>{w}</span>
          </div>
        ))}
      </div>
    )}

    {reviewItems.length > 0 && (
      <div>
        <div className="ent-ctx__title" style={{ display:"flex", justifyContent:"space-between" }}>
          <span>Review queue</span>
          <button className="ent-section__action"
            onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue(entity)}
            data-callback="onOpenEntityReviewQueue">All →</button>
        </div>
        <EntityTabReviewQueue
          items={reviewItems.slice(0, 2)}
          compact
          onAcceptQueueItem={onAcceptQueueItem}
          onEditQueueItem={onEditQueueItem}
          onMergeQueueItem={onMergeQueueItem}
          onDenyQueueItem={onDenyQueueItem}
        />
      </div>
    )}

    {suggestions.length > 0 && (
      <div>
        <div className="ent-ctx__title">Suggestions</div>
        {suggestions.slice(0, 3).map((s) => (
          <div key={s.id} style={{ display:"flex", flexDirection:"column", gap:4, padding:"6px 0", borderBottom:"1px dashed var(--line-2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <ConfidenceBadge level={s.level} value={s.value}/>
              <span style={{ flex:1, fontSize:"var(--fs-2xs)", color:"var(--ink-2)" }}>{s.lbl}</span>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              <Btn variant="primary" size="sm" data-callback="onRunEntitySuggestion"
                onClick={() => onRunEntitySuggestion && onRunEntitySuggestion(s)}>Run</Btn>
              <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem">Dismiss</Btn>
            </div>
          </div>
        ))}
      </div>
    )}

    {related.length > 0 && (
      <div>
        <div className="ent-ctx__title">Related</div>
        <RelatedEntityStrip
          related={related.slice(0, 6)}
          onSelectEntity={onSelectEntity}
          onOpenRelatedTab={onOpenRelatedTab}
        />
      </div>
    )}

    {mentions.length > 0 && (
      <div>
        <div className="ent-ctx__title">Source snippets</div>
        <SourceMentionList mentions={mentions.slice(0, 3)} onOpenSourceMention={onOpenSourceMention}/>
      </div>
    )}

    {recent.length > 0 && (
      <div>
        <div className="ent-ctx__title">Recent changes</div>
        <div className="ent-ctx__recent">
          {recent.map((r, i) => (
            <div key={i} className="ent-ctx__recent-item">
              <span>{r.when}</span><span style={{ color:"var(--ink-2)" }}>{r.what}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </aside>
);

// ---------------------------------------------------------------------
// EntityTabReviewQueue
// ---------------------------------------------------------------------
const EntityTabReviewQueue = ({
  items = [], compact = false, entityType,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
}) => {
  if (!items.length) {
    return (
      <div className="ent-empty" data-ui="EntityTabReviewQueueEmpty">
        <div className="ent-empty__seal">✓</div>
        <div className="ent-empty__title">Nothing to review</div>
        <div className="ent-empty__body">Every {ENTITY_TYPES[entityType]?.plural?.toLowerCase() || "entry"} is confirmed. New extractions will surface here.</div>
      </div>
    );
  }
  return (
    <div className="ent-review" data-ui="EntityTabReviewQueue">
      {!compact && (
        <div className="ent-review__head-note">
          Detected from the manuscript. Nothing here has been added yet.
        </div>
      )}
      {items.map((it) => (
        <div key={it.id} className="ent-review__card" data-testid={"ent-rq-" + it.id}>
          <div className="ent-review__head">
            <div className="ent-row__monogram ent-row__monogram--unknown" style={{ width:28, height:28, fontSize:"var(--fs-3xs)" }}>
              {(it.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div className="ent-review__name">{it.name}</div>
            {it.action && <span className="ent-review__action-tag">{it.action}</span>}
            <ConfidenceBadge level={it.level} value={it.value}/>
          </div>
          <div className="ent-review__excerpt" dangerouslySetInnerHTML={{ __html: '"' + it.excerpt + '"' }}/>
          <div className="ent-review__meta">
            <Icon name="paper" size={10}/> {it.cite}
            <span style={{ flex:1 }}/>
            <span>{it.reason}</span>
          </div>
          <div className="ent-review__actions">
            <Btn variant="primary" size="sm" data-callback="onAcceptQueueItem"
              onClick={() => onAcceptQueueItem && onAcceptQueueItem(it)}>Accept</Btn>
            <Btn variant="outline" size="sm" data-callback="onEditQueueItem"
              onClick={() => onEditQueueItem && onEditQueueItem(it)}>Edit</Btn>
            <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem"
              onClick={() => onMergeQueueItem && onMergeQueueItem(it)}>Merge…</Btn>
            <Btn variant="ghost" size="sm" data-callback="onDenyQueueItem"
              onClick={() => onDenyQueueItem && onDenyQueueItem(it)}>Deny</Btn>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityMergeModal — destructive, opens over the panel
// ---------------------------------------------------------------------
const EntityMergeModal = ({ open, sources = [], target, onCancel, onMergeEntity }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" data-ui="EntityMergeModal" role="dialog" aria-modal="true">
      <div className="modal modal--default" style={{ maxWidth: 460 }}>
        <div className="modal__title">Merge {sources.length} {sources.length === 1 ? "entry" : "entries"}</div>
        <div className="modal__body">
          <div style={{ marginBottom: 8, fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>
            The following will be merged into{" "}
            <strong style={{ color: "var(--ink-1)" }}>{target?.name || sources[0]?.name}</strong>.
            Merged entries become aliases; their source mentions are reassigned.
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 18px", fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>
            {sources.map((s) => <li key={s.id}>{s.name}</li>)}
          </ul>
        </div>
        <div className="modal__actions">
          <Btn variant="ghost" onClick={onCancel} data-callback="onCancel">Cancel</Btn>
          <Btn variant="primary" data-callback="onMergeEntity"
            onClick={() => onMergeEntity && onMergeEntity({ sources, target })}>Merge</Btn>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  EntitySpark, EntityRosterCard,
  EntityCreateButton, EntityImportButton,
  EntityDragChip, EntityDropZone,
  SourceMentionList, RelatedEntityStrip,
  EntityDetailSection, EntityDetailHeader,
  EntityContextPanel, EntityTabReviewQueue,
  EntityMergeModal,
});
