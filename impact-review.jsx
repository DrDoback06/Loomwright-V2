// =====================================================================
// impact-review.jsx — visible Impact Review Centre enhancements.
//
// The existing ReviewQueueCard / EntityReviewQueue remain the functional
// base. This module wraps them so every current Accept/Edit/Merge/Deny path
// keeps working while users gain evidence, before/after changes, linked
// spiderwebs, consequence guidance, postpone/scenario actions, and safe
// acceptance receipts with reversion.
// =====================================================================

(function () {
  if (typeof ReviewQueueCard === "undefined" || typeof EntityReviewQueue === "undefined") return;
  const BaseReviewQueueCard = ReviewQueueCard;
  const BaseEntityReviewQueue = EntityReviewQueue;
  const BaseQueueFilterBar = typeof QueueFilterBar !== "undefined" ? QueueFilterBar : null;
  const { useState, useEffect, useMemo } = React;

  const service = () => window.LoomwrightBackend?.ImpactReviewService || window.ImpactReviewService;
  const backend = () => window.LoomwrightBackend;

  function humanKey(key) {
    return String(key || "field").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  }

  function formatValue(value) {
    if (value == null || value === "") return "—";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      return value.map((v) => typeof v === "object" ? (v.name || v.label || v.title || JSON.stringify(v)) : String(v)).join(", ") || "—";
    }
    if (typeof value === "object") return value.name || value.label || value.title || JSON.stringify(value, null, 2);
    return String(value);
  }

  function openEntity(entity) {
    if (!entity?.id) return;
    window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: {
      type: "entity", entityType: entity.type, entityId: entity.id,
    } }));
  }

  const ImpactBar = ({ analysis, expanded, onToggle, status }) => {
    if (!analysis) return null;
    const { impact, sourceKind } = analysis;
    return (
      <div className="ir-impactbar" data-ui="ImpactReviewBar">
        <span className="ir-impactbar__severity" data-level={impact.severity}>{impact.severity} impact</span>
        <span className="ir-impactbar__fact"><Icon name="link" size={10}/>{impact.affected.length} linked</span>
        <span className="ir-impactbar__fact"><Icon name="book" size={10}/>{impact.chapters.length} chapters</span>
        <span className="ir-impactbar__fact"><Icon name="branch" size={10}/>{impact.knockOnCount} knock-on</span>
        <span className="ir-impactbar__source">{sourceKind}</span>
        {status === "postponed" && <span className="ir-impactbar__source">postponed</span>}
        <span className="ir-impactbar__spacer"/>
        <button className="ir-impactbar__toggle" onClick={onToggle} data-testid="impact-toggle">
          {expanded ? "Hide impact" : "Inspect impact →"}
        </button>
      </div>
    );
  };

  const EvidencePanel = ({ analysis, onOpenSource }) => (
    <div className="ir-panel">
      <div className="ir-panel__head"><Icon name="paper" size={10}/> Evidence & provenance</div>
      <div className="ir-evidence">
        {analysis.evidence.length === 0 && <div style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 11 }}>No direct quote was stored. Review the detector rationale and linked records carefully.</div>}
        {analysis.evidence.map((evidence) => (
          <button key={evidence.id} className="ir-evidence__row" onClick={() => onOpenSource?.(analysis.item)}>
            <div className="ir-evidence__quote">“{evidence.quote}”</div>
            <div className="ir-evidence__meta">{evidence.kind} · {evidence.chapterId || "project source"}{evidence.paragraphId ? ` · ${evidence.paragraphId}` : ""}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const ChangePanel = ({ analysis }) => (
    <div className="ir-panel">
      <div className="ir-panel__head"><Icon name="branch" size={10}/> Proposed before → after</div>
      {analysis.changes.length === 0 && <div style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 11 }}>This action links or confirms existing information without a simple field replacement.</div>}
      {analysis.changes.slice(0, 12).map((change) => (
        <div className="ir-change" key={change.key}>
          <div className="ir-change__key">{humanKey(change.key)}</div>
          <div className="ir-change__value">{formatValue(change.before)}</div>
          <div className="ir-change__arrow">→</div>
          <div className="ir-change__value ir-change__value--after">{formatValue(change.after)}</div>
        </div>
      ))}
    </div>
  );

  const SpiderwebPanel = ({ analysis }) => {
    const directIds = new Set((analysis.impact.direct || []).map((entity) => entity.id));
    const target = analysis.impact.direct?.[0] || analysis.impact.affected?.[0] || null;
    const related = (analysis.impact.affected || []).filter((entity) => entity.id !== target?.id);
    return (
      <div className="ir-panel ir-panel--wide">
        <div className="ir-panel__head"><Icon name="knot" size={10}/> Knock-on spiderweb</div>
        <div className="ir-web">
          <button className="ir-web__target" onClick={() => openEntity(target)}>{target?.name || analysis.item.name || analysis.item.candidate?.name || "New entity"}</button>
          {related.slice(0, 14).map((entity) => (
            <React.Fragment key={entity.id}>
              <span className="ir-web__line">—</span>
              <button className="ir-web__node" onClick={() => openEntity(entity)} title={directIds.has(entity.id) ? "Directly involved" : "Indirect knock-on"}>
                {(ENTITY_TYPES[entity.type]?.glyph || "·")} {entity.name}
              </button>
            </React.Fragment>
          ))}
          {!related.length && <span style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 11 }}>No existing linked records were found. The new entity can still create future links.</span>}
        </div>
        {analysis.impact.chapters?.length > 0 && (
          <div className="ir-chapters">
            {analysis.impact.chapters.slice(0, 12).map((chapter) => <span className="ir-chapter" key={chapter.id}>Ch. {chapter.number}{chapter.title ? ` · ${chapter.title}` : ""}</span>)}
          </div>
        )}
      </div>
    );
  };

  const ConsequencesPanel = ({ analysis }) => (
    <div className="ir-panel ir-panel--wide">
      <div className="ir-panel__head"><Icon name="warn" size={10}/> What to check after this decision</div>
      {analysis.hints.length ? (
        <ul className="ir-hints">{analysis.hints.map((hint, index) => <li key={index}>{hint}</li>)}</ul>
      ) : (
        <div style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 11 }}>No additional consequence category was detected. The acceptance receipt will still record every entity actually changed.</div>
      )}
    </div>
  );

  const ImpactDetail = ({ analysis, item, onOpenSource }) => {
    const [busy, setBusy] = useState("");
    const current = service()?.getItemSync?.(item.id) || item;
    const postpone = async () => {
      const reason = window.prompt?.("Why are you postponing this decision?", current.decision?.reason || "Need more evidence") || "Need more evidence";
      setBusy("postpone");
      try { await service()?.postpone?.(current, reason); } finally { setBusy(""); }
    };
    const resume = async () => {
      setBusy("resume");
      try { await service()?.resume?.(current); } finally { setBusy(""); }
    };
    const scenario = async () => {
      const defaultTitle = `Scenario · ${current.name || current.candidate?.name || "Alternative"}`;
      const title = window.prompt?.("Name this alternative scenario", defaultTitle) || defaultTitle;
      setBusy("scenario");
      try { await service()?.createScenario?.(current, title); } finally { setBusy(""); }
    };
    return (
      <div className="ir-detail" data-ui="ImpactReviewDetail" data-testid={`impact-detail-${item.id}`}>
        <div className="ir-detail__grid">
          <EvidencePanel analysis={analysis} onOpenSource={onOpenSource}/>
          <ChangePanel analysis={analysis}/>
          <SpiderwebPanel analysis={analysis}/>
          <ConsequencesPanel analysis={analysis}/>
        </div>
        <div className="ir-decisionbar">
          <span className="ir-decisionbar__note">Nothing here changes canon by itself. Accept applies the existing queue action and records a reversible receipt.</span>
          {current.status === "postponed"
            ? <button className="rpg-btn rpg-btn--small" onClick={resume} disabled={!!busy} data-testid={`impact-resume-${item.id}`}>Return to pending</button>
            : <button className="rpg-btn rpg-btn--small" onClick={postpone} disabled={!!busy} data-testid={`impact-postpone-${item.id}`}>Postpone</button>}
          <button className="rpg-btn rpg-btn--small" onClick={scenario} disabled={!!busy} data-testid={`impact-scenario-${item.id}`}><Icon name="branch" size={10}/> Explore as scenario</button>
        </div>
      </div>
    );
  };

  ReviewQueueCard = function ImpactReviewQueueCard(props) {
    const rawItem = props.item || {};
    const [expandedImpact, setExpandedImpact] = useState(false);
    const [busy, setBusy] = useState(false);
    const [tick, setTick] = useState(0);
    useEffect(() => {
      const bump = () => setTick((value) => value + 1);
      ["lw:impact-review-updated", "lw:review-queue-updated", "lw:entity-store-updated", "lw:occurrence-store-updated"]
        .forEach((eventName) => window.addEventListener(eventName, bump));
      return () => ["lw:impact-review-updated", "lw:review-queue-updated", "lw:entity-store-updated", "lw:occurrence-store-updated"]
        .forEach((eventName) => window.removeEventListener(eventName, bump));
    }, []);
    const current = service()?.getItemSync?.(rawItem.id) || rawItem;
    const analysis = useMemo(() => {
      void tick;
      return service()?.analyse?.(current) || null;
    }, [rawItem.id, current.updatedAt, tick]);

    const accept = async (item) => {
      if (busy) return;
      const latest = service()?.getItemSync?.(item.id) || item;
      const latestAnalysis = service()?.analyse?.(latest) || analysis;
      if (latestAnalysis?.requiresDeliberateConfirm) {
        const lines = [
          `Accept this ${latestAnalysis.impact.severity}-impact change?`,
          "",
          `${latestAnalysis.impact.affected.length} linked records`,
          `${latestAnalysis.impact.chapters.length} affected chapters`,
          `${latestAnalysis.impact.knockOnCount} indirect knock-on records`,
          "",
          "A reversible impact receipt will be created.",
        ];
        if (typeof window.confirm === "function" && !window.confirm(lines.join("\n"))) return;
      }
      const acceptFn = props.onAcceptQueueItem || ((row) => window.LoomwrightDispatchCallback?.("onAcceptQueueItem", { detail: row }));
      setBusy(true);
      try { await service()?.acceptWithReceipt?.(latest, acceptFn); }
      finally { setBusy(false); }
    };

    return (
      <div className="ir-shell" data-ui="ImpactReviewCardShell" data-testid={`impact-shell-${rawItem.id}`} data-severity={analysis?.impact?.severity || "low"} data-status={current.status || "pending"}>
        <ImpactBar analysis={analysis} expanded={expandedImpact} onToggle={() => setExpandedImpact((value) => !value)} status={current.status}/>
        <BaseReviewQueueCard {...props} item={current} onAcceptQueueItem={accept}/>
        {expandedImpact && analysis && <ImpactDetail analysis={analysis} item={current} onOpenSource={props.onOpenSourceInManuscript}/>} 
      </div>
    );
  };

  const ImpactSummary = ({ items = [], entityType }) => {
    const analyses = items.map((item) => service()?.analyse?.(item)).filter(Boolean);
    const critical = analyses.filter((analysis) => analysis.impact.severity === "critical").length;
    const high = analyses.filter((analysis) => analysis.impact.severity === "high").length;
    const postponed = items.filter((item) => item.status === "postponed").length;
    const inferred = analyses.filter((analysis) => analysis.sourceKind === "inferred").length;
    const receipts = service()?.receiptHistory?.(entityType) || [];
    return (
      <div className="ir-summary" data-ui="ImpactReviewSummary">
        <div className="ir-summary__lead">
          <div className="ir-summary__eyebrow">Impact Review Centre</div>
          <div className="ir-summary__title">Decide with the whole story visible.</div>
          <div className="ir-summary__sub">Evidence, proposed changes, linked records, chapters, consequences, scenarios, and safe reversion.</div>
        </div>
        {[
          [items.length, "Open decisions", ""],
          [critical, "Critical", "danger"],
          [high, "High impact", "warn"],
          [postponed, "Postponed", ""],
          [inferred, "Inferred", ""],
          [receipts.filter((item) => !item.impactReceipt?.revertedAt).length, "Reversible", ""],
        ].map(([value, label, tone]) => <div className="ir-summary__metric" data-tone={tone} key={label}><div className="ir-summary__value">{value}</div><div className="ir-summary__label">{label}</div></div>)}
      </div>
    );
  };

  const ReceiptHistory = ({ entityType }) => {
    const [open, setOpen] = useState(true);
    const [tick, setTick] = useState(0);
    const [busyId, setBusyId] = useState(null);
    useEffect(() => {
      const bump = () => setTick((value) => value + 1);
      ["lw:impact-review-updated", "lw:review-queue-updated", "lw:entity-store-updated"].forEach((name) => window.addEventListener(name, bump));
      return () => ["lw:impact-review-updated", "lw:review-queue-updated", "lw:entity-store-updated"].forEach((name) => window.removeEventListener(name, bump));
    }, []);
    const receipts = useMemo(() => {
      void tick;
      return service()?.receiptHistory?.(entityType) || [];
    }, [entityType, tick]);
    if (!receipts.length) return null;
    const revert = async (item) => {
      const safety = service()?.receiptSafety?.(item);
      if (!safety?.safe) return;
      if (typeof window.confirm === "function" && !window.confirm(`Revert the accepted change for ${item.name || item.candidate?.name || item.id}?\n\n${item.impactReceipt.changedEntities.length} entity changes will be restored and the decision will return to pending.`)) return;
      setBusyId(item.id);
      try { await service()?.revertAcceptance?.(item); }
      catch (error) { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: error.message || "Could not revert this receipt." } })); }
      finally { setBusyId(null); }
    };
    return (
      <div className="ir-history" data-ui="ImpactReceiptHistory">
        <div className="ir-history__head">
          <Icon name="clock" size={11}/><span className="ir-history__title">Accepted change receipts</span>
          <span className="ir-history__sub">Revert remains enabled only while no later edits conflict with the recorded result.</span>
          <button className="rpg-btn rpg-btn--small" onClick={() => setOpen((value) => !value)}>{open ? "Hide" : `Show ${receipts.length}`}</button>
        </div>
        {open && receipts.slice(0, 12).map((item) => {
          const receipt = item.impactReceipt;
          const safety = service()?.receiptSafety?.(item) || { safe: false, conflicts: [] };
          const reverted = !!receipt.revertedAt;
          return (
            <div className="ir-receipt" key={item.id} data-reverted={reverted ? "true" : "false"} data-testid={`impact-receipt-${item.id}`}>
              <div className="ir-receipt__top">
                <span className="ir-receipt__name">{item.name || item.candidate?.name || item.id}</span>
                <span className="ir-receipt__pill">{receipt.severity} impact</span>
                <span className="ir-receipt__pill">{receipt.changedEntities.length} changed</span>
                {reverted ? <span className="ir-receipt__pill">reverted</span> : (
                  <button className="rpg-btn rpg-btn--small" disabled={!safety.safe || busyId === item.id} onClick={() => revert(item)} data-testid={`impact-revert-${item.id}`}>
                    {busyId === item.id ? "Reverting…" : safety.safe ? "Revert safely" : "Later edits detected"}
                  </button>
                )}
              </div>
              <div className="ir-receipt__meta">Accepted {receipt.acceptedAt || ""} · {receipt.affectedChapterIds?.length || 0} chapters · source: {receipt.sourceKind}</div>
              <div className="ir-receipt__changes">{receipt.changedEntities.map((change) => <span className="ir-receipt__entity" key={change.id}>{change.kind} · {change.name}</span>)}</div>
              {!reverted && !safety.safe && <div className="ir-receipt__warning">Revert paused: {safety.conflicts.map((conflict) => conflict.name).join(", ")} changed after acceptance.</div>}
            </div>
          );
        })}
      </div>
    );
  };

  if (BaseQueueFilterBar) {
    QueueFilterBar = function ImpactQueueFilterBar(props) {
      return (
        <>
          <BaseQueueFilterBar {...props}/>
          <div className="ir-quickfilters" data-ui="ImpactQuickFilters">
            <span className="ir-quickfilters__label">Decision state</span>
            {["all", "pending", "postponed", "auto-added", "needs-attention"].map((status) => (
              <button key={status} className={`ir-quickfilters__btn ${String(props.status || "all") === status ? "is-active" : ""}`} onClick={() => props.onStatus?.(status)}>{status.replace("-", " ")}</button>
            ))}
          </div>
        </>
      );
    };
  }

  EntityReviewQueue = function ImpactEntityReviewQueue(props) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
      const bump = () => setTick((value) => value + 1);
      ["lw:impact-review-updated", "lw:review-queue-updated", "lw:entity-store-updated"].forEach((name) => window.addEventListener(name, bump));
      return () => ["lw:impact-review-updated", "lw:review-queue-updated", "lw:entity-store-updated"].forEach((name) => window.removeEventListener(name, bump));
    }, []);
    const liveItems = useMemo(() => {
      void tick;
      const all = service()?.listAllReviewSync?.() || props.items || [];
      const type = props.entityType ? backend()?.EntityService?.normaliseType?.(props.entityType) : null;
      return type ? all.filter((item) => backend()?.EntityService?.normaliseType?.(item.entityType || item.type) === type && item.status !== "done") : all.filter((item) => item.status !== "done");
    }, [props.entityType, props.items, tick]);
    return (
      <div className="ir-centre" data-ui="ImpactReviewCentre">
        <ImpactSummary items={liveItems} entityType={props.entityType}/>
        <BaseEntityReviewQueue {...props} items={liveItems}/>
        <ReceiptHistory entityType={props.entityType}/>
      </div>
    );
  };

  Object.assign(window, { ImpactReviewService: service(), ImpactReviewSummary: ImpactSummary, ImpactReceiptHistory: ReceiptHistory });
})();
