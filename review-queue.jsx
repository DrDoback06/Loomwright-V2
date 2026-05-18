// =====================================================================
// review-queue.jsx — EntityReviewQueue + ReviewQueueCard + filter bar
// + bulk actions + auto-added collapsible.
// All presentational; emits hook-ready callbacks.
// =====================================================================

const { useState: _rqUS, useMemo: _rqUM } = React;

// ---------------------------------------------------------------------
// Suggestion label helper
// ---------------------------------------------------------------------
const SUGGESTION_LABELS = {
  "create":       "Create new",
  "enrich":       "Enrich existing",
  "link":         "Link mention",
  "merge":        "Merge with existing",
  "update state": "Update state",
};

// ---------------------------------------------------------------------
// QueueFilterBar
// ---------------------------------------------------------------------
const QueueFilterBar = ({
  query, onQuery,
  confidence, onConfidence,
  status, onStatus,
  chapter, onChapter,
  session, onSession,
  sortBy, onSortBy,
  view, onView,
  chapters = [],
  sessions = [],
}) => {
  return (
    <div className="qfb" data-ui="QueueFilterBar">
      <div className="qfb__row">
        <label className="qfb__search">
          <Icon name="search" size={12}/>
          <input
            value={query || ""}
            onChange={(e) => onQuery && onQuery(e.target.value)}
            placeholder="Search candidates, mentions, quotes…"
            data-callback="onSearchQueue"
            data-testid="queue-search"
          />
        </label>
        <div className="qfb__seg" role="group" aria-label="Confidence filter">
          {[
            { k: "all",       l: "All",    c: null },
            { k: "high",      l: "Auto",   c: "#2e5fa8" },
            { k: "strong",    l: "Strong", c: "#4f8045" },
            { k: "uncertain", l: "Unc.",   c: "#d68a2e" },
            { k: "weak",      l: "Weak",   c: "#9c3a2e" },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              className={"qfb__seg__btn " + (confidence === f.k ? "is-active" : "")}
              onClick={() => onConfidence && onConfidence(f.k)}
              data-callback="onFilterConfidence"
            >
              {f.c && <span className="qfb__seg__dot" style={{ background: f.c }}/>}
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="qfb__row">
        <select className="qfb__select" value={status || "all"} onChange={(e) => onStatus && onStatus(e.target.value)} data-callback="onFilterStatus">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="auto-added">Auto-added</option>
          <option value="needs-attention">Needs attention</option>
          <option value="accepted">Accepted</option>
          <option value="edited">Edited</option>
          <option value="merged">Merged</option>
          <option value="denied">Denied</option>
        </select>
        <select className="qfb__select" value={chapter || "all"} onChange={(e) => onChapter && onChapter(e.target.value)} data-callback="onFilterChapter">
          <option value="all">All chapters</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>Ch. {c.num} — {c.title || "Untitled"}</option>)}
        </select>
        <select className="qfb__select" value={session || "all"} onChange={(e) => onSession && onSession(e.target.value)} data-callback="onFilterSession">
          <option value="all">All sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
        </select>
        <span style={{ flex: 1 }}/>
        <select className="qfb__select" value={sortBy || "confidence"} onChange={(e) => onSortBy && onSortBy(e.target.value)} data-callback="onSortQueue">
          <option value="confidence">Sort: Confidence</option>
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="qfb__seg" role="group" aria-label="View toggle">
          <button type="button" className={"qfb__seg__btn " + (view === "list" ? "is-active" : "")} onClick={() => onView && onView("list")} title="List" data-callback="onToggleQueueView">
            <Icon name="bars" size={11}/>List
          </button>
          <button type="button" className={"qfb__seg__btn " + (view === "grid" ? "is-active" : "")} onClick={() => onView && onView("grid")} title="Grid" data-callback="onToggleQueueView">
            <Icon name="grip" size={11}/>Grid
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// QueueBulkActions
// ---------------------------------------------------------------------
const QueueBulkActions = ({ count, onBulkAccept, onBulkDeny, onBulkMerge, onClearSelection }) => {
  if (!count) return null;
  return (
    <div className="qba" data-ui="QueueBulkActions" role="region" aria-label="Bulk queue actions">
      <span className="qba__lbl"><strong>{count}</strong> selected</span>
      <Btn variant="ghost" size="sm" icon="check" data-callback="onBulkAcceptQueueItems" onClick={onBulkAccept}>Accept all</Btn>
      <Btn variant="ghost" size="sm" icon="link" data-callback="onBulkMergeQueueItems" onClick={onBulkMerge}>Merge all</Btn>
      <Btn variant="ghost" size="sm" icon="close" data-callback="onBulkDenyQueueItems" onClick={onBulkDeny}>Deny all</Btn>
      <span className="qba__spacer"/>
      <Btn variant="ghost" size="sm" onClick={onClearSelection}>Clear</Btn>
    </div>
  );
};

// ---------------------------------------------------------------------
// ConfidenceStrip — coloured left edge w/ percentage chip in card head
// ---------------------------------------------------------------------
const ConfidenceStrip = ({ band }) => <div className="rqc__strip" data-ui="ConfidenceStrip" data-band={band} aria-hidden/>;

// ---------------------------------------------------------------------
// ConfidenceBandBadge — text label per band
// ---------------------------------------------------------------------
const CONFIDENCE_LABELS = {
  high:      "Auto-added · still reviewable",
  strong:    "Strong suggestion",
  uncertain: "Needs review",
  weak:      "Weak match · manual confirmation",
};
const ConfidenceBandBadge = ({ band }) => (
  <span className="rqc__head__band" data-ui="ConfidenceBandBadge"><span>{CONFIDENCE_LABELS[band] || band}</span></span>
);

// ---------------------------------------------------------------------
// ReviewQueueCard
// ---------------------------------------------------------------------
const ReviewQueueCard = ({
  item, selected, expanded: expandedProp,
  onToggleSelect,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onOpenSourceInManuscript, onOpenRelatedTab,
  onKeepAutoAddedItem, onRemoveAutoAddedItem,
}) => {
  const [expanded, setExpanded] = _rqUS(!!expandedProp);
  const c = CONFIDENCE[item.confidence?.band] || CONFIDENCE.uncertain;
  const t = ENTITY_TYPES[item.entityType];
  const isAuto = item.status === "auto-added";

  return (
    <article
      className={"rqc " + (selected ? "is-selected " : "")}
      data-ui="ReviewQueueCard"
      data-testid={"rqc-" + item.id}
      data-status={item.status}
      data-band={item.confidence?.band}
      style={{
        "--cc": c.color, "--cs": c.soft, "--cd": c.deep,
        "--ec": t?.color, "--es": t?.soft, "--ed": t?.deep,
      }}
    >
      <ConfidenceStrip band={item.confidence?.band}/>
      <div className="rqc__main">
        <div className="rqc__head">
          <EntityTypeBadge type={item.entityType} size="xs"/>
          <ConfidenceBadge level={item.confidence?.band} value={item.confidence?.value}/>
          <span className="rqc__head__suggestion">· {SUGGESTION_LABELS[item.suggestion] || item.suggestion}</span>
          <ConfidenceBandBadge band={item.confidence?.band}/>
        </div>

        <div className="rqc__name">
          <span>{item.candidate?.name}</span>
          {item.matched && (
            <span className="rqc__name__match">
              <span className="rqc__name__match__arrow">↦</span>
              <span className="rqc__name__match__hit">{item.matched.name}</span>
              <span style={{ color: "var(--ink-4)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", marginLeft: 4 }}>· {item.matched.confidence}% match</span>
            </span>
          )}
        </div>

        <div className="rqc__summary">{item.candidate?.summary}</div>

        <div className="rqc__mention">
          <em>"{item.mention}"</em>
        </div>

        {item.conflict && (
          <div className="rqc__conflict">
            <span className="rqc__conflict__kind">{item.conflict.kind}</span>
            <span>{item.conflict.note}</span>
          </div>
        )}

        <div className="rqc__meta">
          <a data-callback="onOpenSourceInManuscript" onClick={() => onOpenSourceInManuscript && onOpenSourceInManuscript(item)}>↳ Ch. {item.sourceChapter?.num} · {item.sourceParagraph}</a>
          <span>·</span>
          <span>{item.extractedAt}</span>
          {item.candidate?.aliases?.length > 0 && (
            <>
              <span>·</span>
              <span>aliases: {item.candidate.aliases.join(", ")}</span>
            </>
          )}
        </div>

        {expanded && (
          <div className="rqc__detail">
            <div className="rqc__detail__sec">
              <div className="rqc__detail__sec__lbl">Source quote</div>
              <div className="rqc__detail__quote">"{item.mention}"</div>
            </div>
            <div className="rqc__detail__sec">
              <div className="rqc__detail__sec__lbl">Why this was detected</div>
              <div>{item.rationale}</div>
            </div>
            {item.candidate?.aliases?.length > 0 && (
              <div className="rqc__detail__sec">
                <div className="rqc__detail__sec__lbl">Aliases</div>
                <div className="mono" style={{ fontSize: "var(--fs-xs)" }}>{item.candidate.aliases.join(" · ")}</div>
              </div>
            )}
            <div className="rqc__detail__sec">
              <div className="rqc__detail__sec__lbl">Extraction session</div>
              <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>{item.sessionId}</div>
            </div>
          </div>
        )}

        <div className="rqc__actions">
          {isAuto ? (
            <>
              <Btn variant="primary" size="sm" icon="check" className="rqc__primary" data-callback="onKeepAutoAddedItem" data-testid={"rqc-keep-" + item.id} onClick={() => onKeepAutoAddedItem && onKeepAutoAddedItem(item)}>Keep</Btn>
              <Btn variant="ghost" size="sm" icon="more" data-callback="onEditQueueItem" onClick={() => onEditQueueItem && onEditQueueItem(item)}>Edit</Btn>
              <Btn variant="ghost" size="sm" icon="link" data-callback="onMergeQueueItem" onClick={() => onMergeQueueItem && onMergeQueueItem(item)}>Merge</Btn>
              <Btn variant="ghost" size="sm" icon="trash" data-callback="onRemoveAutoAddedItem" onClick={() => onRemoveAutoAddedItem && onRemoveAutoAddedItem(item)}>Remove</Btn>
            </>
          ) : (
            <>
              <Btn variant="primary" size="sm" icon="check" className="rqc__primary" data-callback="onAcceptQueueItem" data-testid={"rqc-accept-" + item.id} onClick={() => onAcceptQueueItem && onAcceptQueueItem(item)}>Accept</Btn>
              <Btn variant="outline" size="sm" icon="more" data-callback="onEditQueueItem" data-testid={"rqc-edit-" + item.id} onClick={() => onEditQueueItem && onEditQueueItem(item)}>Edit</Btn>
              <Btn variant="outline" size="sm" icon="link" data-callback="onMergeQueueItem" data-testid={"rqc-merge-" + item.id} onClick={() => onMergeQueueItem && onMergeQueueItem(item)}>Merge</Btn>
              <Btn variant="ghost" size="sm" icon="close" data-callback="onDenyQueueItem" data-testid={"rqc-deny-" + item.id} onClick={() => onDenyQueueItem && onDenyQueueItem(item)}>Deny</Btn>
            </>
          )}
          <span className="rqc__actions__spacer"/>
          <Btn variant="ghost" size="sm" icon="feather" data-callback="onOpenSourceInManuscript" onClick={() => onOpenSourceInManuscript && onOpenSourceInManuscript(item)} aria-label="Open source"/>
          <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenRelatedTab" onClick={() => onOpenRelatedTab && onOpenRelatedTab(item)} aria-label="Open dossier"/>
          <button className="rqc__expand" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse" : "Expand"}>
            <Icon name={expanded ? "chevron-up" : "chevron-d"} size={11}/>
            {expanded ? "Less" : "Why?"}
          </button>
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------
// AutoAddedHistoryCard — slim row for blue items in collapsible section
// ---------------------------------------------------------------------
const AutoAddedHistoryCard = ({ item, onKeepAutoAddedItem, onRemoveAutoAddedItem, onEditQueueItem, onOpenRelatedTab }) => {
  const t = ENTITY_TYPES[item.entityType];
  return (
    <div className="aahc" data-ui="AutoAddedHistoryCard" data-testid={"aahc-" + item.id}>
      <div className="aahc__strip" aria-hidden/>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <EntityTypeBadge type={item.entityType} size="xs"/>
          <span className="aahc__name">{item.name}</span>
        </div>
        <div className="aahc__meta">
          <span>{item.confidence}%</span>
          <span>·</span>
          <span>{item.addedAt}</span>
          <span>·</span>
          <span style={{ color: "var(--ink-3)" }}>{t?.label}</span>
        </div>
      </div>
      <div className="aahc__actions">
        <Btn variant="ghost" size="sm" icon="check" data-callback="onKeepAutoAddedItem" onClick={() => onKeepAutoAddedItem && onKeepAutoAddedItem(item)} aria-label="Keep"/>
        <Btn variant="ghost" size="sm" icon="more" data-callback="onEditQueueItem" onClick={() => onEditQueueItem && onEditQueueItem(item)} aria-label="Edit"/>
        <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenRelatedTab" onClick={() => onOpenRelatedTab && onOpenRelatedTab(item)} aria-label="Open dossier"/>
        <Btn variant="ghost" size="sm" icon="trash" data-callback="onRemoveAutoAddedItem" onClick={() => onRemoveAutoAddedItem && onRemoveAutoAddedItem(item)} aria-label="Remove"/>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityReviewQueue — full per-entity queue (lives in panel body)
// ---------------------------------------------------------------------
const EntityReviewQueue = ({
  entityType,
  items = [],
  autoAdded = [],
  chapters = [],
  sessions = [],
  state = "default",       // default | empty | loading | error
  filters = {},
  setFilters,
  selectedIds = [],
  setSelectedIds,
  onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem,
  onBulkAcceptQueueItems, onBulkDenyQueueItems, onBulkMergeQueueItems,
  onOpenSourceInManuscript, onOpenRelatedTab,
  onKeepAutoAddedItem, onRemoveAutoAddedItem,
}) => {
  const t = ENTITY_TYPES[entityType] || ENTITY_TYPES.cast;
  const [autoOpen, setAutoOpen] = _rqUS(false);

  const set = (k, v) => setFilters && setFilters({ ...filters, [k]: v });
  const view = filters.view || "list";

  const filtered = _rqUM(() => {
    let out = items;
    if (filters.confidence && filters.confidence !== "all") out = out.filter((x) => x.confidence?.band === filters.confidence);
    if (filters.status && filters.status !== "all")     out = out.filter((x) => x.status === filters.status);
    if (filters.chapter && filters.chapter !== "all")   out = out.filter((x) => x.sourceChapter?.id === filters.chapter);
    if (filters.session && filters.session !== "all")   out = out.filter((x) => x.sessionId === filters.session);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      out = out.filter((x) =>
        (x.candidate?.name || "").toLowerCase().includes(q) ||
        (x.candidate?.summary || "").toLowerCase().includes(q) ||
        (x.mention || "").toLowerCase().includes(q));
    }
    const sortBy = filters.sortBy || "confidence";
    out = [...out].sort((a, b) => {
      if (sortBy === "name") return (a.candidate?.name || "").localeCompare(b.candidate?.name || "");
      if (sortBy === "date") return (b.extractedAt || "").localeCompare(a.extractedAt || "");
      return (b.confidence?.value || 0) - (a.confidence?.value || 0);
    });
    return out;
  }, [items, filters]);

  // Filter out auto-added from main list — they live in the bottom collapsible
  const main = filtered.filter((x) => x.status !== "auto-added");

  return (
    <div className="rqp" data-ui="EntityReviewQueue" data-entity={entityType} data-state={state} data-testid={"rqp-" + entityType}>
      <header className="rqp__head">
        <div className="rqp__head-row">
          <EntityTypeBadge type={entityType} size="sm"/>
          <div className="rqp__title-stack">
            <div className="rqp__eyebrow">Review queue</div>
            <div className="rqp__title">{t.label}</div>
          </div>
          <div className="rqp__count">
            <strong>{main.length}</strong> pending
            {autoAdded.length > 0 && <> · {autoAdded.length} auto-added</>}
          </div>
        </div>

        <QueueFilterBar
          query={filters.query}      onQuery={(v) => set("query", v)}
          confidence={filters.confidence || "all"} onConfidence={(v) => set("confidence", v)}
          status={filters.status}    onStatus={(v) => set("status", v)}
          chapter={filters.chapter}  onChapter={(v) => set("chapter", v)}
          session={filters.session}  onSession={(v) => set("session", v)}
          sortBy={filters.sortBy}    onSortBy={(v) => set("sortBy", v)}
          view={view}                onView={(v) => set("view", v)}
          chapters={chapters}        sessions={sessions}
        />

        <QueueBulkActions
          count={selectedIds.length}
          onBulkAccept={() => { onBulkAcceptQueueItems && onBulkAcceptQueueItems(selectedIds); setSelectedIds && setSelectedIds([]); }}
          onBulkDeny={()   => { onBulkDenyQueueItems   && onBulkDenyQueueItems(selectedIds);   setSelectedIds && setSelectedIds([]); }}
          onBulkMerge={()  => { onBulkMergeQueueItems  && onBulkMergeQueueItems(selectedIds);  setSelectedIds && setSelectedIds([]); }}
          onClearSelection={() => setSelectedIds && setSelectedIds([])}
        />
      </header>

      <div className="rqp__body" data-grid={view === "grid"}>
        {state === "loading" && <LoadingState title={"Reading the " + t.label.toLowerCase() + " queue…"} lines={4}/>}
        {state === "error"   && <ErrorState title="Couldn't load this queue" body="The local index didn't respond. Your candidates are safe."/>}
        {state === "default" && main.length === 0 && (
          <EmptyState icon="bell" title={"No " + t.label.toLowerCase() + " candidates"} body="Run an extraction to surface new entries here."/>
        )}
        {state === "default" && main.map((x) => (
          <ReviewQueueCard
            key={x.id}
            item={x}
            selected={selectedIds.includes(x.id)}
            onAcceptQueueItem={onAcceptQueueItem}
            onEditQueueItem={onEditQueueItem}
            onMergeQueueItem={onMergeQueueItem}
            onDenyQueueItem={onDenyQueueItem}
            onOpenSourceInManuscript={onOpenSourceInManuscript}
            onOpenRelatedTab={onOpenRelatedTab}
            onKeepAutoAddedItem={onKeepAutoAddedItem}
            onRemoveAutoAddedItem={onRemoveAutoAddedItem}
          />
        ))}

        {/* Auto-added collapsible at bottom */}
        {autoAdded.length > 0 && state === "default" && (
          <div className="rqp__autoadded">
            <button className="rqp__autoadded__head" onClick={() => setAutoOpen((v) => !v)} aria-expanded={autoOpen}>
              <span className="rqp__autoadded__title">
                <span className="rqp__autoadded__title-dot"/>
                Auto-added · still reviewable
              </span>
              <span className="rqp__autoadded__count">{autoAdded.length}</span>
              <Icon name={autoOpen ? "chevron-up" : "chevron-d"} size={11}/>
            </button>
            {autoOpen && (
              <div className="rqp__autoadded__list">
                {autoAdded.map((a) => (
                  <AutoAddedHistoryCard
                    key={a.id} item={a}
                    onKeepAutoAddedItem={onKeepAutoAddedItem}
                    onRemoveAutoAddedItem={onRemoveAutoAddedItem}
                    onEditQueueItem={onEditQueueItem}
                    onOpenRelatedTab={onOpenRelatedTab}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, {
  EntityReviewQueue, ReviewQueueCard, AutoAddedHistoryCard,
  ConfidenceStrip, ConfidenceBandBadge,
  QueueFilterBar, QueueBulkActions,
  SUGGESTION_LABELS, CONFIDENCE_LABELS,
});
