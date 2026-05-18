// =====================================================================
// review-overview.jsx — GlobalReviewOverview
// Renders a grid of per-entity review cards. Lives inside SlidingPanel.
// =====================================================================

const { useMemo: _roUM } = React;

// Order matches brand spec; cast/bestiary/locations/items first.
const GRO_ENTITY_ORDER = [
  "cast", "bestiary", "locations", "items",
  "classes", "races", "stats", "abilities",
  "skillTrees", "quests", "events", "factions",
  "lore", "relationships", "timeline", "references",
];

// ---------------------------------------------------------------------
// GroCard — one entity tile
// ---------------------------------------------------------------------
const GroCard = ({ entityType, counts, onOpenEntityReviewQueue }) => {
  const t = ENTITY_TYPES[entityType];
  if (!t) return null;
  const total = counts?.pending ?? 0;
  const empty = total === 0 && (counts?.autoAdded ?? 0) === 0;
  const urgent = (counts?.weak ?? 0) > 0;

  // Build segmented bar — only includes bands with count > 0
  const segs = [
    { key: "high",      v: counts?.high ?? 0,      lbl: "Auto" },
    { key: "strong",    v: counts?.strong ?? 0,    lbl: "Strong" },
    { key: "uncertain", v: counts?.uncertain ?? 0, lbl: "Uncertain" },
    { key: "weak",      v: counts?.weak ?? 0,      lbl: "Weak" },
  ];
  const sum = segs.reduce((a, s) => a + s.v, 0);

  return (
    <div
      className="gro__card"
      data-ui="GroCard"
      data-callback="onOpenEntityReviewQueue"
      data-testid={"gro-card-" + entityType}
      data-empty={empty}
      data-urgent={urgent}
      tabIndex={0}
      role="button"
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
      onClick={() => onOpenEntityReviewQueue && onOpenEntityReviewQueue(entityType)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEntityReviewQueue && onOpenEntityReviewQueue(entityType); } }}
    >
      <div className="gro__card__head">
        <div className="gro__card__name">
          <span className="gro__card__glyph" aria-hidden>{t.glyph}</span>
          {t.label}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="gro__card__total">{total}</div>
          <div className="gro__card__total-lbl">Pending</div>
        </div>
      </div>

      <div className="gro__bar" aria-hidden>
        {sum > 0 ? segs.map((s) => s.v > 0 && (
          <span
            key={s.key}
            className={"gro__bar__seg gro__bar__seg--" + s.key}
            style={{ width: ((s.v / sum) * 100) + "%" }}
            title={s.lbl + ": " + s.v}
          />
        )) : (
          <span style={{ width: "100%", background: "var(--line-1)" }}/>
        )}
      </div>

      <div className="gro__card__counts">
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#2e5fa8" }}/>{counts?.high ?? 0}</span>
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#4f8045" }}/>{counts?.strong ?? 0}</span>
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#d68a2e" }}/>{counts?.uncertain ?? 0}</span>
        <span className="gro__card__counts__item"><span className="gro__card__counts__dot" style={{ background: "#9c3a2e" }}/>{counts?.weak ?? 0}</span>
      </div>

      <div className="gro__card__foot">
        <span>Auto-added · {counts?.autoAdded ?? 0}</span>
        <span className="gro__card__foot__last">{counts?.lastUpdated || "—"}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// GlobalReviewOverview
// ---------------------------------------------------------------------
const GlobalReviewOverview = ({
  countsByType = {},
  state = "default", // default | empty | loading | error | partial
  onOpenEntityReviewQueue,
  onOpenExtractionSession,
}) => {
  if (state === "loading") {
    return (
      <div className="gro" data-ui="GlobalReviewOverview" data-state="loading">
        <LoadingState title="Counting candidates…" lines={4}/>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="gro" data-ui="GlobalReviewOverview" data-state="error">
        <ErrorState title="Couldn't load review counts" body="Your queues are safe — the index just didn't respond. Try again."/>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="gro" data-ui="GlobalReviewOverview" data-state="empty">
        <EmptyState
          icon="bell"
          title="The queues are clear"
          body="No candidates are waiting. Run an extraction on a chapter to surface new entities."
        />
      </div>
    );
  }

  const totalPending = Object.values(countsByType).reduce((a, c) => a + (c?.pending || 0), 0);

  return (
    <div className="gro" data-ui="GlobalReviewOverview" data-state={state}>
      <div className="gro__intro">
        <div className="gro__intro__title">{totalPending} candidate{totalPending === 1 ? "" : "s"} across the queues</div>
        <div className="gro__intro__sub">
          Review lives inside each entity tab. Pick a queue to triage, or open the latest <a onClick={onOpenExtractionSession} style={{ color: "var(--accent-deep)", cursor: "pointer", textDecoration: "underline" }} data-callback="onOpenExtractionSession">extraction session</a>.
        </div>
      </div>

      <div className="gro__legend" aria-label="Confidence legend">
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#2e5fa8" }}/>Auto-added (95%+)</span>
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#4f8045" }}/>Strong (75–94%)</span>
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#d68a2e" }}/>Uncertain (50–74%)</span>
        <span className="gro__legend__item"><span className="gro__legend__sw" style={{ background: "#9c3a2e" }}/>Weak (&lt;50%)</span>
      </div>

      <div className="gro__grid">
        {GRO_ENTITY_ORDER.map((k) => (
          <GroCard
            key={k}
            entityType={k}
            counts={countsByType[k]}
            onOpenEntityReviewQueue={onOpenEntityReviewQueue}
          />
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { GlobalReviewOverview, GroCard, GRO_ENTITY_ORDER });
